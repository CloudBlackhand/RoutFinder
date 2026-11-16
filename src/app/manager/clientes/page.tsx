import { asc, eq, ne } from "drizzle-orm";
import Link from "next/link";
import { schema } from "@/db";
import { ActionForm, Submit } from "@/components/forms";
import { Empty, Field, Kpi, KpiStrip, Page, PageHead, Panel, Status } from "@/components/ui";
import { CONTRACT, brl, invoiceState } from "@/lib/telecom";
import { createCustomer } from "../actions";
import { managerDb } from "../data";

export default async function CustomersPage(props: PageProps<"/manager/clientes">) {
  const { q = "" } = (await props.searchParams) as { q?: string };
  const db = await managerDb();
  const [customers, contracts, invoices, plans] = await Promise.all([
    db.select().from(schema.customers).orderBy(asc(schema.customers.name)),
    db
      .select({ id: schema.contracts.id, customerId: schema.contracts.customerId, status: schema.contracts.status, priceCents: schema.contracts.priceCents, plan: schema.plans.name })
      .from(schema.contracts)
      .innerJoin(schema.plans, eq(schema.plans.id, schema.contracts.planId))
      .where(ne(schema.contracts.status, "cancelado")),
    db.select({ customerId: schema.invoices.customerId, status: schema.invoices.status, dueDate: schema.invoices.dueDate, amountCents: schema.invoices.amountCents }).from(schema.invoices).where(eq(schema.invoices.status, "aberta")),
    db.select().from(schema.plans).where(eq(schema.plans.active, true)).orderBy(asc(schema.plans.priceCents)),
  ]);

  const overdue = invoices.filter((i) => invoiceState(i) === "vencida");
  const lateBy = new Map<number, number>();
  for (const i of overdue) lateBy.set(i.customerId, (lateBy.get(i.customerId) ?? 0) + i.amountCents);
  const active = contracts.filter((c) => c.status === "ativo");
  const term = q.trim().toLowerCase();
  const rows = customers.filter((c) => !term || [c.name, c.document, c.phone, c.email, c.address].some((v) => v?.toLowerCase().includes(term)));

  return (
    <Page>
      <PageHead kicker="Comercial" title="Clientes" />

      <KpiStrip>
        <Kpi label="Clientes" value={String(customers.length)} hint={`${new Set(active.map((c) => c.customerId)).size} com contrato ativo`} />
        <Kpi label="Contratos ativos" value={String(active.length)} hint={`${contracts.filter((c) => c.status === "aguardando_instalacao").length} aguardando instalação`} />
        <Kpi label="Receita recorrente" value={brl(active.reduce((s, c) => s + c.priceCents, 0))} hint="MRR dos contratos ativos" />
        <Kpi label="Inadimplentes" value={String(lateBy.size)} hint={brl(overdue.reduce((s, i) => s + i.amountCents, 0)) + " vencido"} warn={lateBy.size > 0} />
      </KpiStrip>

      <div className="grid items-start gap-5 xl:grid-cols-[1fr_340px]">
        <Panel title="Carteira" meta={`${rows.length} de ${customers.length}`}>
          <form className="flex gap-2 border-b border-line p-3">
            <input name="q" defaultValue={q} placeholder="Buscar por nome, CPF/CNPJ, telefone, e-mail ou endereço" className="field" />
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
                  const cs = contracts.filter((k) => k.customerId === c.id);
                  const main = cs.find((k) => k.status === "ativo") ?? cs[0];
                  const late = lateBy.get(c.id);
                  return (
                    <tr key={c.id}>
                      <td>
                        <Link href={`/manager/clientes/${c.id}`} className="font-medium hover:underline">
                          {c.name}
                        </Link>
                        <div className="max-w-[320px] truncate text-[12px] text-mute">{c.address}</div>
                      </td>
                      <td className="num text-[12px] text-mute">{c.document ?? "—"}</td>
                      <td className="text-[12px]">
                        <div>{c.phone ?? "—"}</div>
                        <div className="text-mute">{c.email}</div>
                      </td>
                      <td>{main ? `${main.plan}${cs.length > 1 ? ` +${cs.length - 1}` : ""}` : <span className="text-dim">Sem contrato</span>}</td>
                      <td>{main ? <Status {...CONTRACT[main.status]} /> : <Status label="Prospecto" color="#71717a" />}</td>
                      <td className={`num text-right ${late ? "text-red-400" : "text-dim"}`}>{late ? brl(late) : "—"}</td>
                    </tr>
                  );
                })}
                {!rows.length && <Empty cols={6} text="Nenhum cliente encontrado." />}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Novo cliente">
          <ActionForm action={createCustomer} className="flex flex-col gap-3 p-3">
            <Field label="Nome / razão social">
              <input name="name" required className="field" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="CPF / CNPJ">
                <input name="document" className="field" />
              </Field>
              <Field label="Telefone">
                <input name="phone" className="field" />
              </Field>
            </div>
            <Field label="E-mail">
              <input name="email" type="email" className="field" />
            </Field>
            <Field label="Endereço de instalação">
              <input name="address" required placeholder="Rua, número, bairro, cidade - UF" className="field" />
            </Field>
            <Field label="Plano contratado">
              <select name="planId" className="field" defaultValue="">
                <option value="">Sem pedido agora</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {brl(p.priceCents)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Observações">
              <textarea name="notes" rows={2} className="field h-auto py-2" />
            </Field>
            <Submit>Cadastrar cliente</Submit>
            <p className="text-[11px] text-dim">Escolhendo um plano, um pedido de nova assinatura é aberto para agendar a instalação.</p>
          </ActionForm>
        </Panel>
      </div>
    </Page>
  );
}
