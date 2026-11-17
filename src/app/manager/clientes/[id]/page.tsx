import { asc, desc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { schema } from "@/db";
import { ActionForm, Submit } from "@/components/forms";
import { CustomerFields } from "@/components/customer-fields";
import { Act, Empty, Field, Page, PageHead, Panel, Status, Tabs } from "@/components/ui";
import { JOB_COLOR, JOB_LABEL } from "@/lib/status";
import {
  CONTACT_CHANNEL, CONTACT_REASON, CONTRACT, INVOICE, ORDER, ORDER_TYPE, PERSON, PRIORITY, SOURCE, TICKET, TICKET_CATEGORY, TECH,
  brl, fmtDate, invoiceState, tenure, waLink,
} from "@/lib/telecom";
import { completeFollowUp, createInteraction, createOrder, createTicket, payInvoice, setContractStatus, updateCustomer } from "../../actions";
import { managerDb, sellersOf } from "../../data";

type Event = { ts: Date; icon: string; label: string; detail: string; sub?: string; color: string; followUp?: { id: number; date: string; done: boolean } };

const TABS = [
  { k: "resumo", label: "Resumo" },
  { k: "dados", label: "Cadastro" },
  { k: "financeiro", label: "Financeiro" },
  { k: "pedidos", label: "Pedidos" },
  { k: "chamados", label: "Chamados" },
  { k: "visitas", label: "Visitas" },
];

export default async function CustomerPage(props: PageProps<"/manager/clientes/[id]">) {
  const [{ id }, { t = "resumo" }] = await Promise.all([props.params, props.searchParams as Promise<{ t?: string }>]);
  const cid = Number(id);
  if (!Number.isInteger(cid)) notFound();
  const db = await managerDb();
  const [[c], contracts, invoices, orders, tickets, jobs, plans, sellers, contacts] = await Promise.all([
    db.select().from(schema.customers).where(eq(schema.customers.id, cid)),
    db
      .select({ c: schema.contracts, plan: schema.plans.name, down: schema.plans.downMbps, up: schema.plans.upMbps, tech: schema.plans.tech })
      .from(schema.contracts)
      .innerJoin(schema.plans, eq(schema.plans.id, schema.contracts.planId))
      .where(eq(schema.contracts.customerId, cid))
      .orderBy(desc(schema.contracts.createdAt)),
    db.select().from(schema.invoices).where(eq(schema.invoices.customerId, cid)).orderBy(desc(schema.invoices.dueDate)),
    db
      .select({ o: schema.orders, plan: schema.plans.name, seller: schema.sellers.name })
      .from(schema.orders)
      .leftJoin(schema.plans, eq(schema.plans.id, schema.orders.planId))
      .leftJoin(schema.sellers, eq(schema.sellers.id, schema.orders.sellerId))
      .where(eq(schema.orders.customerId, cid))
      .orderBy(desc(schema.orders.createdAt)),
    db.select().from(schema.tickets).where(eq(schema.tickets.customerId, cid)).orderBy(desc(schema.tickets.createdAt)),
    db
      .select({ j: schema.jobs, installer: schema.users.name })
      .from(schema.jobs)
      .leftJoin(schema.users, eq(schema.users.id, schema.jobs.installerId))
      .where(eq(schema.jobs.customerId, cid))
      .orderBy(desc(schema.jobs.day)),
    db.select().from(schema.plans).where(eq(schema.plans.active, true)).orderBy(asc(schema.plans.priceCents)),
    sellersOf(db),
    db
      .select({ i: schema.interactions, user: schema.users.name })
      .from(schema.interactions)
      .leftJoin(schema.users, eq(schema.users.id, schema.interactions.userId))
      .where(eq(schema.interactions.customerId, cid))
      .orderBy(desc(schema.interactions.createdAt)),
  ]);
  if (!c) notFound();

  const live = contracts.filter((k) => k.c.status !== "cancelado");
  const main = contracts.find((k) => k.c.status === "ativo") ?? live[0];
  const openTotal = invoices.filter((i) => i.status === "aberta").reduce((s, i) => s + i.amountCents, 0);
  const wa = waLink(c.phone);
  const seller = sellers.find((s) => s.id === c.sellerId);

  const events: Event[] = [
    ...contacts.map(({ i, user }): Event => ({
      ts: i.createdAt,
      icon: "☎",
      label: `${CONTACT_CHANNEL[i.channel]} · ${user ?? "—"}`,
      detail: i.summary,
      sub: CONTACT_REASON[i.reason].label,
      color: CONTACT_REASON[i.reason].color,
      followUp: i.followUpDate ? { id: i.id, date: i.followUpDate, done: i.followUpDone } : undefined,
    })),
    ...orders.map(({ o, plan, seller }): Event => ({
      ts: o.createdAt,
      icon: "▤",
      label: ORDER_TYPE[o.type],
      detail: plan ? `${plan}${o.priceCents ? ` · ${brl(o.priceCents)}` : ""}` : `Contrato #${o.contractId}`,
      sub: `Pedido #${o.id}${seller ? ` · ${seller}` : ""}`,
      color: ORDER[o.status].color,
    })),
    ...tickets.map((t): Event => ({
      ts: t.createdAt,
      icon: "◆",
      label: `Chamado: ${t.subject}`,
      detail: TICKET_CATEGORY[t.category],
      sub: `#${t.id}`,
      color: TICKET[t.status].color,
    })),
    ...jobs.map(({ j, installer }): Event => ({
      ts: j.finishedAt ?? j.startedAt ?? j.arrivedAt ?? new Date(`${j.day}T12:00:00`),
      icon: "▣",
      label: j.type === "instalacao" ? "Visita de instalação" : "Visita de reparo",
      detail: `${fmtDate(j.day)}${installer ? ` · ${installer}` : ""}${j.notes ? ` · ${j.notes}` : ""}`,
      color: JOB_COLOR[j.status],
    })),
    ...invoices.filter((i) => i.paidAt).map((i): Event => ({
      ts: i.paidAt!,
      icon: "$",
      label: `Pagamento ${i.competence}`,
      detail: brl(i.amountCents),
      sub: `Fatura #${i.id}`,
      color: "#22c55e",
    })),
  ].sort((a, b) => +b.ts - +a.ts);

  const tab = TABS.some((x) => x.k === t) ? t : "resumo";
  const href = (k: string) => `/manager/clientes/${cid}?t=${k}`;
  const followUpCount = contacts.filter((x) => x.i.followUpDate && !x.i.followUpDone && x.i.followUpDate <= new Date().toISOString().slice(0, 10)).length;

  return (
    <Page>
      <PageHead kicker={`${PERSON[c.personType]} · Cliente #${c.id} · ${tenure(c.createdAt)} de casa`} title={c.name}>
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-mute">Em aberto: <span className="num text-fg">{brl(openTotal)}</span></span>
          {followUpCount > 0 && <span className="num text-[12px] text-amber-400">{followUpCount} retorno(s) vencido(s)</span>}
          {wa && <a href={wa} target="_blank" rel="noreferrer" className="btn">WhatsApp</a>}
          <Link href="/manager/clientes" className="btn">Voltar</Link>
        </div>
      </PageHead>

      <section className="panel grid grid-cols-2 divide-line max-lg:divide-y lg:grid-cols-4 lg:divide-x">
        <div className="p-4">
          <div className="label">Situação</div>
          <div className="mt-2">{main ? <Status {...CONTRACT[main.c.status]} /> : <Status label="Prospecto" color="#71717a" />}</div>
        </div>
        <div className="p-4">
          <div className="label">Plano</div>
          <div className="mt-2 font-medium">{main ? main.plan : "—"}</div>
          <div className="num mt-1 text-[11px] text-mute">{main ? `${main.down}/${main.up} Mbps · ${TECH[main.tech]}` : ""}</div>
        </div>
        <div className="p-4">
          <div className="label">Mensalidade</div>
          <div className="num mt-2 text-lg">{main ? brl(main.c.priceCents) : "—"}</div>
          <div className="num mt-1 text-[11px] text-mute">{main ? `vence dia ${main.c.dueDay}` : ""}</div>
        </div>
        <div className="p-4">
          <div className="label">Origem</div>
          <div className="mt-2">{c.source ? SOURCE[c.source] : "—"}</div>
          <div className="mt-1 text-[11px] text-mute">{seller ? `Vendedor: ${seller.name}` : ""}</div>
        </div>
      </section>

      <Tabs active={href(tab)} items={TABS.map((x) => ({ href: href(x.k), label: x.label }))} />

      {tab === "resumo" && (
        <div className="grid items-start gap-5 xl:grid-cols-[1fr_340px]">
          <Panel title="Linha do tempo" meta={`${events.length} eventos`}>
            <ol className="p-3">
              {events.map((e, i) => (
                <li key={i} className="relative flex gap-3 pb-5 pl-6 last:pb-1">
                  {i < events.length - 1 && <span className="absolute left-[7px] top-4 bottom-0 w-px bg-line" />}
                  <span className="absolute left-0 top-1.5 h-[15px] w-[15px] border border-line bg-panel text-center font-mono text-[10px] leading-[13px]" style={{ color: e.color }}>
                    {e.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-medium" style={{ color: e.color }}>{e.label}</span>
                      <span className="num shrink-0 text-[11px] text-dim">{new Date(e.ts).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <div className="text-[12px]">{e.detail}</div>
                    {e.sub && <div className="text-[11px] text-mute">{e.sub}</div>}
                    {e.followUp && !e.followUp.done && (
                      <div className="mt-1 flex items-center gap-2">
                        <span className={`num text-[11px] ${e.followUp.date <= new Date().toISOString().slice(0, 10) ? "text-amber-400" : "text-mute"}`}>
                          Retorno em {fmtDate(e.followUp.date)}
                        </span>
                        <Act action={completeFollowUp} fields={{ id: e.followUp.id }} className="btn btn-sm">Feito</Act>
                      </div>
                    )}
                  </div>
                </li>
              ))}
              {!events.length && <p className="py-6 text-center text-mute">Nenhum registro ainda.</p>}
            </ol>
          </Panel>

          <Panel title="Registrar contato">
            <ActionForm action={createInteraction} className="flex flex-col gap-3 p-3">
              <input type="hidden" name="customerId" value={c.id} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Canal">
                  <select name="channel" defaultValue={wa ? "whatsapp" : "telefone"} className="field">
                    {Object.entries(CONTACT_CHANNEL).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Motivo">
                  <select name="reason" className="field">
                    {Object.entries(CONTACT_REASON).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Resumo">
                <textarea name="summary" required rows={3} placeholder="O que foi tratado com o cliente?" className="field h-auto py-2" />
              </Field>
              <Field label="Retornar em (opcional)">
                <input name="followUpDate" type="date" className="field" />
              </Field>
              <Submit>Registrar</Submit>
            </ActionForm>
          </Panel>
        </div>
      )}

      {tab === "dados" && (
        <Panel title="Cadastro" className="max-w-[720px]">
          <ActionForm action={updateCustomer} className="flex flex-col gap-3 p-3">
            <input type="hidden" name="id" value={c.id} />
            <CustomerFields d={c} sellers={sellers} />
            <Submit className="btn">Salvar alterações</Submit>
          </ActionForm>
        </Panel>
      )}

      {tab === "financeiro" && (
        <div className="flex flex-col gap-5">
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
            <div className="overflow-x-auto">
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
        </div>
      )}

      {tab === "pedidos" && (
        <div className="grid items-start gap-5 xl:grid-cols-[1fr_340px]">
          <Panel title="Histórico de pedidos">
            <table className="tbl">
              <tbody>
                {orders.map(({ o, plan, seller }) => (
                  <tr key={o.id}>
                    <td className="num text-mute">#{o.id}</td>
                    <td>
                      {ORDER_TYPE[o.type]}
                      <div className="text-[11px] text-mute">
                        {plan ?? (o.contractId ? `Contrato #${o.contractId}` : "")} · {fmtDate(o.createdAt)}
                        {seller && ` · ${seller}`}
                        {o.installFeeCents ? ` · Taxa inst. ${brl(o.installFeeCents)}` : ""}
                      </div>
                    </td>
                    <td className="text-right"><Status {...ORDER[o.status]} /></td>
                  </tr>
                ))}
                {!orders.length && <Empty cols={3} text="Sem pedidos." />}
              </tbody>
            </table>
          </Panel>
          <Panel title="Novo pedido">
            <ActionForm action={createOrder} className="flex flex-col gap-3 p-3">
              <input type="hidden" name="customerId" value={c.id} />
              <Field label="Tipo">
                <select name="type" className="field" defaultValue={live.length ? "mudanca_plano" : "nova_assinatura"}>
                  {Object.entries(ORDER_TYPE).map(([k, v]) => (
                    <option key={k} value={k} disabled={k !== "nova_assinatura" && !live.length}>{v}</option>
                  ))}
                </select>
              </Field>
              <Field label="Plano (assinatura / mudança)">
                <select name="planId" className="field">
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} · {brl(p.priceCents)}</option>
                  ))}
                </select>
              </Field>
              {live.length > 0 && (
                <Field label="Contrato (mudança / cancelamento)">
                  <select name="contractId" className="field">
                    {live.map((k) => (
                      <option key={k.c.id} value={k.c.id}>#{k.c.id} · {k.plan}</option>
                    ))}
                  </select>
                </Field>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Vendedor">
                  <select name="sellerId" defaultValue={c.sellerId ?? ""} className="field">
                    <option value="">Nenhum</option>
                    {sellers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Canal">
                  <select name="channel" defaultValue={c.source ?? ""} className="field">
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
              <Submit className="btn">Registrar pedido</Submit>
            </ActionForm>
          </Panel>
        </div>
      )}

      {tab === "chamados" && (
        <div className="grid items-start gap-5 xl:grid-cols-[1fr_340px]">
          <Panel title="Histórico de chamados">
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
      )}

      {tab === "visitas" && (
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
      )}
    </Page>
  );
}
