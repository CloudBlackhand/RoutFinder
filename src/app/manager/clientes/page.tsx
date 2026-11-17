import { asc, eq, ne } from "drizzle-orm";
import Link from "next/link";
import { schema } from "@/db";
import { Empty, Kpi, KpiStrip, Page, PageHead, Status, Tabs } from "@/components/ui";
import { CONTRACT, SOURCE, brl, invoiceState, waLink } from "@/lib/telecom";
import { managerDb } from "../data";

const FILTERS = [
  { k: "", label: "Todos" },
  { k: "ativo", label: "Ativos" },
  { k: "inadimplente", label: "Inadimplentes" },
  { k: "aguardando", label: "Aguard. instalação" },
  { k: "prospecto", label: "Prospectos" },
];

export default async function CustomersPage(props: PageProps<"/manager/clientes">) {
  const { q = "", s = "" } = (await props.searchParams) as { q?: string; s?: string };
  const db = await managerDb();
  const [customers, contracts, invoices] = await Promise.all([
    db.select().from(schema.customers).orderBy(asc(schema.customers.name)),
    db
      .select({ id: schema.contracts.id, customerId: schema.contracts.customerId, status: schema.contracts.status, priceCents: schema.contracts.priceCents, plan: schema.plans.name })
      .from(schema.contracts)
      .innerJoin(schema.plans, eq(schema.plans.id, schema.contracts.planId))
      .where(ne(schema.contracts.status, "cancelado")),
    db.select({ customerId: schema.invoices.customerId, status: schema.invoices.status, dueDate: schema.invoices.dueDate, amountCents: schema.invoices.amountCents }).from(schema.invoices).where(eq(schema.invoices.status, "aberta")),
  ]);

  const overdue = invoices.filter((i) => invoiceState(i) === "vencida");
  const lateBy = new Map<number, number>();
  for (const i of overdue) lateBy.set(i.customerId, (lateBy.get(i.customerId) ?? 0) + i.amountCents);
  const byCustomer = new Map<number, typeof contracts>();
  for (const k of contracts) byCustomer.set(k.customerId, [...(byCustomer.get(k.customerId) ?? []), k]);
  const active = contracts.filter((c) => c.status === "ativo");

  const kind = (id: number) => {
    const cs = byCustomer.get(id) ?? [];
    if (cs.some((k) => k.status === "ativo")) return "ativo";
    if (lateBy.has(id)) return "inadimplente";
    if (cs.some((k) => k.status === "aguardando_instalacao")) return "aguardando";
    if (cs.some((k) => k.status === "suspenso")) return "suspenso";
    return "prospecto";
  };
  const counts = (f: string) => customers.filter((c) => !f || kind(c.id) === f).length;
  const term = q.trim().toLowerCase();
  const rows = customers
    .filter((c) => !term || [c.name, c.document, c.phone, c.phone2, c.email, c.address, c.neighborhood, c.city].some((v) => v?.toLowerCase().includes(term)))
    .filter((c) => !s || kind(c.id) === s);
  const href = (f: string) => `/manager/clientes?${new URLSearchParams({ ...(q ? { q } : {}), ...(f ? { s: f } : {}) })}`;

  return (
    <Page>
      <PageHead kicker="Comercial" title="Clientes">
        <Link href="/manager/clientes/novo" className="btn">Novo cliente</Link>
        <Link href="/manager/vendas/nova" className="btn btn-primary">Nova venda</Link>
      </PageHead>

      <KpiStrip>
        <Kpi label="Clientes" value={String(customers.length)} hint={`${new Set(active.map((c) => c.customerId)).size} com contrato ativo`} />
        <Kpi label="Contratos ativos" value={String(active.length)} hint={`${contracts.filter((c) => c.status === "aguardando_instalacao").length} aguardando instalação`} />
        <Kpi label="Receita recorrente" value={brl(active.reduce((s, c) => s + c.priceCents, 0))} hint="MRR dos contratos ativos" />
        <Kpi label="Inadimplentes" value={String(lateBy.size)} hint={brl(overdue.reduce((s, i) => s + i.amountCents, 0)) + " vencido"} warn={lateBy.size > 0} />
      </KpiStrip>

      <section className="panel min-w-0">
          <Tabs active={href(s)} items={FILTERS.map((f) => ({ href: href(f.k), label: f.label, count: counts(f.k) }))} />
          <form className="flex gap-2 border-b border-line p-3">
            <input name="q" defaultValue={q} placeholder="Buscar por nome, CPF/CNPJ, telefone, e-mail ou endereço" className="field" />
            {s && <input type="hidden" name="s" value={s} />}
            <button className="btn">Buscar</button>
          </form>
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Documento</th>
                  <th>Contato</th>
                  <th>Plano</th>
                  <th>Situação</th>
                  <th className="text-right">Em atraso</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const cs = byCustomer.get(c.id) ?? [];
                  const main = cs.find((k) => k.status === "ativo") ?? cs[0];
                  const late = lateBy.get(c.id);
                  const wa = waLink(c.phone);
                  return (
                    <tr key={c.id}>
                      <td>
                        <Link href={`/manager/clientes/${c.id}`} className="font-medium hover:underline">
                          {c.name}
                        </Link>
                        <div className="max-w-[300px] truncate text-[12px] text-mute">
                          {c.neighborhood ? `${c.neighborhood} · ` : ""}
                          {c.address}
                        </div>
                      </td>
                      <td className="num text-[12px] text-mute">
                        {c.document ?? "—"}
                        <div className="text-[11px]">{c.personType === "pj" ? "PJ" : ""}</div>
                      </td>
                      <td className="text-[12px]">
                        <div className="flex items-center gap-1.5">
                          {c.phone ?? "—"}
                          {wa && (
                            <a href={wa} target="_blank" rel="noreferrer" className="num text-[10px] text-emerald-400 hover:underline">
                              WA
                            </a>
                          )}
                        </div>
                        <div className="text-mute">{c.email}</div>
                      </td>
                      <td>
                        {main ? `${main.plan}${cs.length > 1 ? ` +${cs.length - 1}` : ""}` : <span className="text-dim">Sem contrato</span>}
                        {c.source && <div className="text-[11px] text-dim">{SOURCE[c.source]}</div>}
                      </td>
                      <td>{main ? <Status {...CONTRACT[main.status]} /> : <Status label="Prospecto" color="#71717a" />}</td>
                      <td className={`num text-right ${late ? "text-red-400" : "text-dim"}`}>{late ? brl(late) : "—"}</td>
                    </tr>
                  );
                })}
                {!rows.length && <Empty cols={6} text="Nenhum cliente encontrado." />}
              </tbody>
            </table>
          </div>
      </section>
    </Page>
  );
}
