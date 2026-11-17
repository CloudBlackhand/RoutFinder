import { and, asc, desc, eq, gte, lt } from "drizzle-orm";
import Link from "next/link";
import { schema } from "@/db";
import { ActionForm, Submit } from "@/components/forms";
import { Act, Empty, Field, Kpi, KpiStrip, Page, PageHead, Panel, Status } from "@/components/ui";
import { ORDER, ORDER_TYPE, SOURCE, brl, thisMonth } from "@/lib/telecom";
import { createOrder, saveSeller, toggleSeller } from "../actions";
import { managerDb, sellersOf } from "../data";

const monthRange = (m: string) => [`${m}-01`, m >= "9999-12" ? "9999-99" : new Date(Date.UTC(+m.slice(0, 4), +m.slice(5), 1)).toISOString().slice(0, 10)];

export default async function SalesPage(props: PageProps<"/manager/vendas">) {
  const sp = (await props.searchParams) as { m?: string };
  const month = /^\d{4}-\d{2}$/.test(sp.m ?? "") ? sp.m! : thisMonth();
  const [start, end] = monthRange(month);
  const db = await managerDb();
  const [orders, customers, plans, sellers, installs, activeSellers] = await Promise.all([
    db
      .select({ o: schema.orders, customer: schema.customers.name, plan: schema.plans.name, seller: schema.sellers.name, sellerPct: schema.sellers.commissionPct })
      .from(schema.orders)
      .innerJoin(schema.customers, eq(schema.customers.id, schema.orders.customerId))
      .leftJoin(schema.plans, eq(schema.plans.id, schema.orders.planId))
      .leftJoin(schema.sellers, eq(schema.sellers.id, schema.orders.sellerId))
      .where(and(gte(schema.orders.createdAt, new Date(start)), lt(schema.orders.createdAt, new Date(end))))
      .orderBy(desc(schema.orders.createdAt)),
    db.select({ id: schema.customers.id, name: schema.customers.name }).from(schema.customers).orderBy(asc(schema.customers.name)),
    db.select().from(schema.plans).where(eq(schema.plans.active, true)).orderBy(asc(schema.plans.priceCents)),
    db.select().from(schema.sellers).orderBy(asc(schema.sellers.name)),
    db
      .select({ installerId: schema.jobs.installerId })
      .from(schema.jobs)
      .where(and(eq(schema.jobs.type, "instalacao"), eq(schema.jobs.status, "concluido"), gte(schema.jobs.finishedAt, new Date(start)), lt(schema.jobs.finishedAt, new Date(end)))),
    sellersOf(db),
  ]);

  const created = orders;
  const sales = created.filter((r) => r.o.type === "nova_assinatura");
  const done = orders.filter((r) => r.o.status === "concluido" && r.o.type === "nova_assinatura");
  const lost = orders.filter((r) => r.o.status === "cancelado");
  const churn = orders.filter((r) => r.o.type === "cancelamento" && r.o.status === "concluido");
  const mrr = done.reduce((s, r) => s + (r.o.priceCents ?? 0), 0);
  const conv = created.length ? Math.round((done.length / created.length) * 100) : 0;

  const bySeller = new Map<string | null, { n: number; mrr: number }>();
  for (const r of sales) {
    const e = bySeller.get(r.seller) ?? { n: 0, mrr: 0 };
    e.n += 1;
    if (r.o.status === "concluido" || r.o.status === "agendado") e.mrr += r.o.priceCents ?? 0;
    bySeller.set(r.seller, e);
  }
  const byChannel = new Map<string, number>();
  for (const r of sales) byChannel.set(r.o.channel ?? "outro", (byChannel.get(r.o.channel ?? "outro") ?? 0) + 1);
  const byPlan = new Map<string, number>();
  for (const r of sales) if (r.plan) byPlan.set(r.plan, (byPlan.get(r.plan) ?? 0) + 1);
  const installsDone = installs.length;

  const bar = (v: number, max: number) => `${max ? Math.max(3, Math.round((v / max) * 100)) : 0}%`;
  const maxMrr = Math.max(1, ...[...bySeller.values()].map((x) => x.mrr));
  const maxChannel = Math.max(1, ...[...byChannel.values()]);
  const maxPlan = Math.max(1, ...[...byPlan.values()]);

  return (
    <Page>
      <PageHead kicker="Comercial" title="Vendas">
        <form className="flex items-center gap-2">
          <span className="label">Período</span>
          <input name="m" type="month" defaultValue={month} className="field w-[140px]" />
          <button className="btn">Ver</button>
        </form>
      </PageHead>

      <KpiStrip cols={5}>
        <Kpi label="Pedidos criados" value={String(created.length)} hint={`${sales.length} assinaturas`} />
        <Kpi label="Vendas concluídas" value={String(done.length)} hint={`${installsDone} instalações concluídas`} />
        <Kpi label="MRR novo" value={brl(mrr)} hint="mensalidades das vendas fechadas" />
        <Kpi label="Cancelamentos" value={String(churn.length)} hint={conv + "% de conversão geral"} warn={churn.length > 0} />
        <Kpi label="Recusados" value={String(lost.length)} hint="pedidos descartados" />
      </KpiStrip>

      <div className="grid items-start gap-5 xl:grid-cols-[1fr_340px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Panel title="Registros do período" meta={`${orders.length} no total`}>
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Cliente</th>
                    <th>Tipo</th>
                    <th>Plano</th>
                    <th>Canal</th>
                    <th>Vendedor</th>
                    <th className="text-right">MRR</th>
                    <th>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(({ o, customer, plan, seller }) => (
                    <tr key={o.id}>
                      <td className="num text-mute">{o.id}</td>
                      <td><Link href={`/manager/clientes/${o.customerId}`} className="hover:underline">{customer}</Link></td>
                      <td>{ORDER_TYPE[o.type]}</td>
                      <td className="text-mute">{plan ?? "—"}</td>
                      <td className="text-mute">{o.channel ? SOURCE[o.channel] : "—"}</td>
                      <td className="text-mute">{seller ?? "—"}</td>
                      <td className="num text-right">{o.priceCents ? brl(o.priceCents) : "—"}</td>
                      <td><Status {...ORDER[o.status]} /></td>
                    </tr>
                  ))}
                  {!orders.length && <Empty cols={8} text="Nenhum pedido no período." />}
                </tbody>
              </table>
            </div>
          </Panel>

          <div className="grid gap-5 md:grid-cols-3">
            <Panel title="Vendedores" meta="assinaturas no período">
              <table className="tbl">
                <tbody>
                  {[...bySeller.entries()].sort((a, b) => b[1].mrr - a[1].mrr).map(([name, x]) => {
                    const pct = sellers.find((s) => s.name === name)?.commissionPct;
                    return (
                      <tr key={name ?? "-"}>
                        <td>{name ?? "Direto"}<div className="num text-[11px] text-mute">{x.n} venda(s){pct != null ? ` · ${pct}%` : ""}</div></td>
                        <td className="w-[45%]">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 flex-1 bg-raised"><div className="h-full bg-fg" style={{ width: bar(x.mrr, maxMrr) }} /></div>
                            <span className="num text-[11px] text-mute">{brl(x.mrr)}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {!bySeller.size && <Empty cols={2} text="—" />}
                </tbody>
              </table>
            </Panel>
            <Panel title="Canais">
              <table className="tbl">
                <tbody>
                  {[...byChannel.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => (
                    <tr key={k}>
                      <td>{SOURCE[k as keyof typeof SOURCE] ?? k}</td>
                      <td className="w-[45%]">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 bg-raised"><div className="h-full bg-fg" style={{ width: bar(n, maxChannel) }} /></div>
                          <span className="num text-[11px] text-mute">{n}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!byChannel.size && <Empty cols={2} text="—" />}
                </tbody>
              </table>
            </Panel>
            <Panel title="Planos vendidos">
              <table className="tbl">
                <tbody>
                  {[...byPlan.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => (
                    <tr key={k}>
                      <td>{k}</td>
                      <td className="w-[45%]">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 bg-raised"><div className="h-full bg-fg" style={{ width: bar(n, maxPlan) }} /></div>
                          <span className="num text-[11px] text-mute">{n}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!byPlan.size && <Empty cols={2} text="—" />}
                </tbody>
              </table>
            </Panel>
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <Panel title="Registrar venda">
            <ActionForm action={createOrder} className="flex flex-col gap-3 p-3">
              <input type="hidden" name="type" value="nova_assinatura" />
              <Field label="Cliente">
                <select name="customerId" required className="field">
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Plano">
                <select name="planId" className="field">
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} · {brl(p.priceCents)}</option>
                  ))}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Vendedor">
                  <select name="sellerId" className="field">
                    <option value="">Direto</option>
                    {activeSellers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Canal">
                  <select name="channel" className="field">
                    <option value="">—</option>
                    {Object.entries(SOURCE).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Taxa de instalação (R$)">
                  <input name="installFee" placeholder="0,00" className="field" />
                </Field>
                <Field label="Observações">
                  <input name="notes" className="field" />
                </Field>
              </div>
              <Submit>Registrar</Submit>
            </ActionForm>
          </Panel>

          <Panel title="Equipe comercial">
            <table className="tbl">
              <tbody>
                {sellers.map((s) => (
                  <tr key={s.id} className={s.active ? "" : "opacity-50"}>
                    <td>
                      {s.name}
                      <div className="num text-[11px] text-mute">{s.commissionPct}% · {s.phone ?? s.email ?? "—"}</div>
                    </td>
                    <td className="text-right"><Act action={toggleSeller} fields={{ id: s.id }}>{s.active ? "Desativar" : "Reativar"}</Act></td>
                  </tr>
                ))}
                {!sellers.length && <Empty cols={2} text="Nenhum vendedor." />}
              </tbody>
            </table>
            <ActionForm action={saveSeller} className="flex flex-col gap-2 border-t border-line p-3">
              <div className="label">Novo vendedor</div>
              <div className="grid grid-cols-[1fr_80px] gap-2">
                <input name="name" required placeholder="Nome" className="field" />
                <input name="commissionPct" required placeholder="% com." className="field" />
              </div>
              <input name="phone" placeholder="Telefone" className="field" />
              <Submit className="btn">Adicionar</Submit>
            </ActionForm>
          </Panel>
        </div>
      </div>
    </Page>
  );
}
