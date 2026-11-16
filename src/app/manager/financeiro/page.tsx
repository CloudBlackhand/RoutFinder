import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { schema } from "@/db";
import { ActionForm, Submit } from "@/components/forms";
import { Act, Empty, Field, Kpi, KpiStrip, Page, PageHead, Panel, Status, Tabs } from "@/components/ui";
import { INVOICE, brl, fmtDate, invoiceState, thisMonth, type InvoiceState } from "@/lib/telecom";
import { cancelInvoice, generateInvoices, payInvoice, suspendOverdue } from "../actions";
import { managerDb } from "../data";

const FILTERS: (InvoiceState | "todas")[] = ["todas", "aberta", "vencida", "paga", "cancelada"];

export default async function FinancePage(props: PageProps<"/manager/financeiro">) {
  const sp = (await props.searchParams) as { m?: string; s?: string };
  const month = /^\d{4}-\d{2}$/.test(sp.m ?? "") ? sp.m! : thisMonth();
  const filter = FILTERS.includes(sp.s as InvoiceState) ? (sp.s as InvoiceState | "todas") : "todas";
  const db = await managerDb();
  const all = await db
    .select({ i: schema.invoices, customer: schema.customers.name, plan: schema.plans.name })
    .from(schema.invoices)
    .innerJoin(schema.customers, eq(schema.customers.id, schema.invoices.customerId))
    .innerJoin(schema.contracts, eq(schema.contracts.id, schema.invoices.contractId))
    .innerJoin(schema.plans, eq(schema.plans.id, schema.contracts.planId))
    .orderBy(desc(schema.invoices.dueDate));

  const withState = all.map((r) => ({ ...r, st: invoiceState(r.i) }));
  const ofMonth = withState.filter((r) => r.i.competence === month);
  const sum = (xs: typeof withState) => xs.reduce((s, r) => s + r.i.amountCents, 0);
  const billed = sum(ofMonth.filter((r) => r.st !== "cancelada"));
  const paid = sum(ofMonth.filter((r) => r.st === "paga"));
  const pending = sum(ofMonth.filter((r) => r.st === "aberta"));
  const overdueAll = withState.filter((r) => r.st === "vencida");
  const pastDue = withState.filter((r) => r.st === "vencida" || (r.st === "paga" && r.i.dueDate < new Date().toISOString().slice(0, 10)));
  const delinquency = sum(pastDue) ? sum(overdueAll) / sum(pastDue) : 0;
  const rows = ofMonth.filter((r) => filter === "todas" || r.st === filter);
  const months = [...new Set([thisMonth(), ...withState.map((r) => r.i.competence)])].sort().reverse();
  const href = (s: string) => `/manager/financeiro?m=${month}&s=${s}`;

  return (
    <Page>
      <PageHead kicker="Financeiro" title="Faturas e cobrança">
        <form className="flex items-center gap-2">
          <span className="label">Competência</span>
          <select name="m" defaultValue={month} className="field w-[120px]">
            {months.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <button className="btn">Ver</button>
        </form>
      </PageHead>

      <KpiStrip cols={5}>
        <Kpi label="Faturado" value={brl(billed)} hint={`${ofMonth.filter((r) => r.st !== "cancelada").length} faturas em ${month}`} />
        <Kpi label="Recebido" value={brl(paid)} hint={billed ? `${Math.round((paid / billed) * 100)}% do faturado` : "—"} />
        <Kpi label="A receber" value={brl(pending)} hint="dentro do vencimento" />
        <Kpi label="Vencido (geral)" value={brl(sum(overdueAll))} hint={`${new Set(overdueAll.map((r) => r.i.customerId)).size} cliente(s)`} warn={overdueAll.length > 0} />
        <Kpi label="Inadimplência" value={`${(delinquency * 100).toFixed(1)}%`} hint="do valor já vencido" warn={delinquency > 0.05} />
      </KpiStrip>

      <div className="grid items-start gap-5 xl:grid-cols-[1fr_300px]">
        <section className="panel min-w-0">
          <Tabs active={href(filter)} items={FILTERS.map((f) => ({ href: href(f), label: f === "todas" ? "Todas" : INVOICE[f].label, count: f === "todas" ? ofMonth.length : ofMonth.filter((r) => r.st === f).length }))} />
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Cliente</th>
                  <th>Plano</th>
                  <th>Vencimento</th>
                  <th className="text-right">Valor</th>
                  <th>Situação</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map(({ i, customer, plan, st }) => (
                  <tr key={i.id}>
                    <td className="num text-mute">{i.id}</td>
                    <td><Link href={`/manager/clientes/${i.customerId}`} className="hover:underline">{customer}</Link></td>
                    <td className="text-mute">{plan}</td>
                    <td className="num">{fmtDate(i.dueDate)}</td>
                    <td className="num text-right">{brl(i.amountCents)}</td>
                    <td>
                      <Status {...INVOICE[st]} />
                      {i.paidAt && <div className="num text-[11px] text-mute">em {fmtDate(i.paidAt)}</div>}
                    </td>
                    <td className="text-right">
                      {i.status === "aberta" && (
                        <div className="inline-flex gap-1">
                          <Act action={payInvoice} fields={{ id: i.id }}>Baixar pagamento</Act>
                          <Act action={cancelInvoice} fields={{ id: i.id }} className="btn btn-sm btn-danger">Cancelar</Act>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {!rows.length && <Empty cols={7} text={ofMonth.length ? "Nenhuma fatura nesse filtro." : "Nenhuma fatura nessa competência. Gere as faturas ao lado."} />}
              </tbody>
            </table>
          </div>
        </section>

        <div className="flex flex-col gap-5">
          <Panel title="Faturamento">
            <ActionForm action={generateInvoices} className="flex flex-col gap-3 p-3">
              <Field label="Competência">
                <input name="competence" type="month" defaultValue={month} className="field" />
              </Field>
              <Submit>Gerar faturas</Submit>
              <p className="text-[11px] text-dim">Emite uma fatura por contrato ativo, com o valor e o dia de vencimento do contrato. Faturas já emitidas não são duplicadas.</p>
            </ActionForm>
          </Panel>
          <Panel title="Régua de cobrança">
            <ActionForm action={suspendOverdue} className="flex flex-col gap-3 p-3">
              <Field label="Suspender com atraso acima de (dias)">
                <input name="days" type="number" min={1} defaultValue={15} className="field" />
              </Field>
              <Submit className="btn btn-danger">Suspender inadimplentes</Submit>
              <p className="text-[11px] text-dim">Ao baixar o pagamento das faturas vencidas, o contrato é reativado automaticamente.</p>
            </ActionForm>
          </Panel>
        </div>
      </div>
    </Page>
  );
}
