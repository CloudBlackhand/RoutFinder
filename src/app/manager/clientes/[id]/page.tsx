import { asc, desc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { schema } from "@/db";
import { ActionForm, Submit } from "@/components/forms";
import { Act, Empty, Field, Page, PageHead, Panel, Status } from "@/components/ui";
import { JOB_COLOR, JOB_LABEL } from "@/lib/status";
import { CONTRACT, INVOICE, ORDER, ORDER_TYPE, PRIORITY, TICKET, TICKET_CATEGORY, brl, fmtDate, invoiceState } from "@/lib/telecom";
import { createOrder, createTicket, payInvoice, setContractStatus, updateCustomer } from "../../actions";
import { managerDb } from "../../data";

export default async function CustomerPage(props: PageProps<"/manager/clientes/[id]">) {
  const id = Number((await props.params).id);
  if (!Number.isInteger(id)) notFound();
  const db = await managerDb();
  const [[c], contracts, invoices, orders, tickets, jobs, plans] = await Promise.all([
    db.select().from(schema.customers).where(eq(schema.customers.id, id)),
    db
      .select({ c: schema.contracts, plan: schema.plans.name, down: schema.plans.downMbps, up: schema.plans.upMbps })
      .from(schema.contracts)
      .innerJoin(schema.plans, eq(schema.plans.id, schema.contracts.planId))
      .where(eq(schema.contracts.customerId, id))
      .orderBy(desc(schema.contracts.createdAt)),
    db.select().from(schema.invoices).where(eq(schema.invoices.customerId, id)).orderBy(desc(schema.invoices.dueDate)),
    db
      .select({ o: schema.orders, plan: schema.plans.name })
      .from(schema.orders)
      .leftJoin(schema.plans, eq(schema.plans.id, schema.orders.planId))
      .where(eq(schema.orders.customerId, id))
      .orderBy(desc(schema.orders.createdAt)),
    db.select().from(schema.tickets).where(eq(schema.tickets.customerId, id)).orderBy(desc(schema.tickets.createdAt)),
    db
      .select({ j: schema.jobs, installer: schema.users.name })
      .from(schema.jobs)
      .leftJoin(schema.users, eq(schema.users.id, schema.jobs.installerId))
      .where(eq(schema.jobs.customerId, id))
      .orderBy(desc(schema.jobs.day)),
    db.select().from(schema.plans).where(eq(schema.plans.active, true)).orderBy(asc(schema.plans.priceCents)),
  ]);
  if (!c) notFound();

  const live = contracts.filter((k) => k.c.status !== "cancelado");
  const openTotal = invoices.filter((i) => i.status === "aberta").reduce((s, i) => s + i.amountCents, 0);

  return (
    <Page>
      <PageHead kicker={`Cliente #${c.id} · desde ${fmtDate(c.createdAt)}`} title={c.name}>
        <span className="text-[12px] text-mute">Em aberto: <span className="num text-fg">{brl(openTotal)}</span></span>
        <Link href="/manager/clientes" className="btn">Voltar</Link>
      </PageHead>

      <div className="grid items-start gap-5 xl:grid-cols-[340px_1fr]">
        <div className="flex flex-col gap-5">
          <Panel title="Cadastro">
            <ActionForm action={updateCustomer} className="flex flex-col gap-3 p-3">
              <input type="hidden" name="id" value={c.id} />
              <Field label="Nome / razão social">
                <input name="name" defaultValue={c.name} required className="field" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="CPF / CNPJ">
                  <input name="document" defaultValue={c.document ?? ""} className="field" />
                </Field>
                <Field label="Telefone">
                  <input name="phone" defaultValue={c.phone ?? ""} className="field" />
                </Field>
              </div>
              <Field label="E-mail">
                <input name="email" type="email" defaultValue={c.email ?? ""} className="field" />
              </Field>
              <Field label="Endereço de instalação">
                <div className="border border-line bg-bg px-2.5 py-2 text-[12px] text-mute">{c.address}</div>
              </Field>
              <Field label="Observações">
                <textarea name="notes" rows={2} defaultValue={c.notes ?? ""} className="field h-auto py-2" />
              </Field>
              <Submit className="btn">Salvar alterações</Submit>
            </ActionForm>
          </Panel>

          <Panel title="Novo pedido">
            <ActionForm action={createOrder} className="flex flex-col gap-3 p-3">
              <input type="hidden" name="customerId" value={c.id} />
              <Field label="Tipo">
                <select name="type" className="field" defaultValue={live.length ? "mudanca_plano" : "nova_assinatura"}>
                  {Object.entries(ORDER_TYPE).map(([k, v]) => (
                    <option key={k} value={k} disabled={k !== "nova_assinatura" && !live.length}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Plano (assinatura / mudança)">
                <select name="planId" className="field">
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {brl(p.priceCents)}
                    </option>
                  ))}
                </select>
              </Field>
              {live.length > 0 && (
                <Field label="Contrato (mudança / cancelamento)">
                  <select name="contractId" className="field">
                    {live.map((k) => (
                      <option key={k.c.id} value={k.c.id}>
                        #{k.c.id} · {k.plan}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <Field label="Observações">
                <input name="notes" className="field" />
              </Field>
              <Submit className="btn">Registrar pedido</Submit>
            </ActionForm>
          </Panel>

          <Panel title="Abrir chamado">
            <ActionForm action={createTicket} className="flex flex-col gap-3 p-3">
              <input type="hidden" name="customerId" value={c.id} />
              <Field label="Assunto">
                <input name="subject" required className="field" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Categoria">
                  <select name="category" className="field">
                    {Object.entries(TICKET_CATEGORY).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Prioridade">
                  <select name="priority" className="field" defaultValue="media">
                    {Object.entries(PRIORITY).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Descrição">
                <textarea name="description" rows={2} className="field h-auto py-2" />
              </Field>
              <Submit className="btn">Abrir chamado</Submit>
            </ActionForm>
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <Panel title="Contratos" meta={`${live.length} vigente(s)`}>
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Plano</th>
                    <th className="text-right">Mensalidade</th>
                    <th>Vencimento</th>
                    <th>Ativação</th>
                    <th>Situação</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {contracts.map(({ c: k, plan, down, up }) => (
                    <tr key={k.id}>
                      <td className="num text-mute">{k.id}</td>
                      <td>
                        {plan}
                        <div className="num text-[11px] text-mute">{down}/{up} Mbps</div>
                      </td>
                      <td className="num text-right">{brl(k.priceCents)}</td>
                      <td className="num">dia {k.dueDay}</td>
                      <td className="num text-mute">{fmtDate(k.activatedAt)}</td>
                      <td><Status {...CONTRACT[k.status]} /></td>
                      <td className="text-right">
                        <div className="inline-flex gap-1">
                          {k.status === "ativo" && <Act action={setContractStatus} fields={{ id: k.id, status: "suspenso" }}>Suspender</Act>}
                          {k.status === "suspenso" && <Act action={setContractStatus} fields={{ id: k.id, status: "ativo" }}>Reativar</Act>}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!contracts.length && <Empty cols={7} text="Nenhum contrato. Registre um pedido de nova assinatura." />}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="Faturas" meta={`${invoices.length} no histórico`}>
            <div className="max-h-[320px] overflow-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Competência</th>
                    <th>Contrato</th>
                    <th>Vencimento</th>
                    <th className="text-right">Valor</th>
                    <th>Situação</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((i) => {
                    const st = invoiceState(i);
                    return (
                      <tr key={i.id}>
                        <td className="num">{i.competence}</td>
                        <td className="num text-mute">#{i.contractId}</td>
                        <td className="num">{fmtDate(i.dueDate)}</td>
                        <td className="num text-right">{brl(i.amountCents)}</td>
                        <td>
                          <Status {...INVOICE[st]} />
                          {i.paidAt && <div className="num text-[11px] text-mute">em {fmtDate(i.paidAt)}</div>}
                        </td>
                        <td className="text-right">{i.status === "aberta" && <Act action={payInvoice} fields={{ id: i.id }}>Baixar</Act>}</td>
                      </tr>
                    );
                  })}
                  {!invoices.length && <Empty cols={6} text="Nenhuma fatura emitida." />}
                </tbody>
              </table>
            </div>
          </Panel>

          <div className="grid gap-5 2xl:grid-cols-2">
            <Panel title="Pedidos">
              <table className="tbl">
                <tbody>
                  {orders.map(({ o, plan }) => (
                    <tr key={o.id}>
                      <td className="num text-mute">#{o.id}</td>
                      <td>
                        {ORDER_TYPE[o.type]}
                        <div className="text-[11px] text-mute">{plan ?? (o.contractId ? `Contrato #${o.contractId}` : "")} · {fmtDate(o.createdAt)}</div>
                      </td>
                      <td className="text-right"><Status {...ORDER[o.status]} /></td>
                    </tr>
                  ))}
                  {!orders.length && <Empty cols={3} text="Sem pedidos." />}
                </tbody>
              </table>
            </Panel>

            <Panel title="Chamados">
              <table className="tbl">
                <tbody>
                  {tickets.map((t) => (
                    <tr key={t.id}>
                      <td className="num text-mute">#{t.id}</td>
                      <td>
                        {t.subject}
                        <div className="text-[11px] text-mute">{TICKET_CATEGORY[t.category]} · {fmtDate(t.createdAt)}</div>
                      </td>
                      <td className="text-right"><Status {...TICKET[t.status]} /></td>
                    </tr>
                  ))}
                  {!tickets.length && <Empty cols={3} text="Sem chamados." />}
                </tbody>
              </table>
            </Panel>
          </div>

          <Panel title="Visitas técnicas">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Tipo</th>
                  <th>Instalador</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map(({ j, installer }) => (
                  <tr key={j.id}>
                    <td className="num">{fmtDate(j.day)}</td>
                    <td>{j.type === "instalacao" ? "Instalação" : "Reparo"}{j.notes && <span className="text-mute"> · {j.notes}</span>}</td>
                    <td>{installer ?? <span className="text-dim">Sem instalador</span>}</td>
                    <td><Status color={JOB_COLOR[j.status]} label={JOB_LABEL[j.status]} /></td>
                  </tr>
                ))}
                {!jobs.length && <Empty cols={4} text="Nenhuma visita registrada." />}
              </tbody>
            </table>
          </Panel>
        </div>
      </div>
    </Page>
  );
}
