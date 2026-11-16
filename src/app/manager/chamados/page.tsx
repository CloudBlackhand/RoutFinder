import { asc, desc, eq } from "drizzle-orm";
import Link from "next/link";
import { schema } from "@/db";
import { ActionForm, Submit } from "@/components/forms";
import { Act, Empty, Field, Kpi, KpiStrip, Page, PageHead, Panel, Status, Tabs } from "@/components/ui";
import { fmtDuration } from "@/lib/status";
import { PRIORITY, TICKET, TICKET_CATEGORY, fmtDate, nowMs, today, type TicketStatus } from "@/lib/telecom";
import { createTicket, scheduleVisit, setTicketStatus } from "../actions";
import { installersOf, managerDb } from "../data";

const FILTERS: TicketStatus[] = ["aberto", "em_atendimento", "resolvido"];
const RANK = { alta: 0, media: 1, baixa: 2 };

export default async function TicketsPage(props: PageProps<"/manager/chamados">) {
  const { s } = (await props.searchParams) as { s?: string };
  const status = FILTERS.includes(s as TicketStatus) ? (s as TicketStatus) : "aberto";
  const db = await managerDb();
  const [tickets, customers, installers] = await Promise.all([
    db
      .select({ t: schema.tickets, customer: schema.customers.name, phone: schema.customers.phone })
      .from(schema.tickets)
      .innerJoin(schema.customers, eq(schema.customers.id, schema.tickets.customerId))
      .orderBy(desc(schema.tickets.createdAt)),
    db.select({ id: schema.customers.id, name: schema.customers.name }).from(schema.customers).orderBy(asc(schema.customers.name)),
    installersOf(db),
  ]);
  const open = tickets.filter((r) => r.t.status !== "resolvido");
  const solved = tickets.filter((r) => r.t.resolvedAt);
  const avg = solved.length ? solved.reduce((s, r) => s + (+r.t.resolvedAt! - +r.t.createdAt), 0) / solved.length : 0;
  const rows = tickets.filter((r) => r.t.status === status).sort((a, b) => RANK[a.t.priority] - RANK[b.t.priority]);
  const now = nowMs();

  return (
    <Page>
      <PageHead kicker="Suporte" title="Chamados" />

      <KpiStrip>
        <Kpi label="Em aberto" value={String(open.length)} hint={`${open.filter((r) => r.t.status === "em_atendimento").length} em atendimento`} />
        <Kpi label="Prioridade alta" value={String(open.filter((r) => r.t.priority === "alta").length)} hint="não resolvidos" warn={open.some((r) => r.t.priority === "alta")} />
        <Kpi label="Sem conexão" value={String(open.filter((r) => r.t.category === "sem_conexao").length)} hint="clientes parados" />
        <Kpi label="Tempo médio de solução" value={avg ? fmtDuration(avg) : "—"} hint={`${solved.length} resolvidos`} />
      </KpiStrip>

      <div className="flex flex-col gap-5">
        <Panel title="Abrir chamado">
          <ActionForm action={createTicket} className="grid items-end gap-3 p-3 md:grid-cols-2 xl:grid-cols-[1fr_1.3fr_150px_120px_1.3fr_auto]">
            <Field label="Cliente">
              <select name="customerId" required className="field">
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Assunto">
              <input name="subject" required className="field" />
            </Field>
              <Field label="Categoria">
                <select name="category" className="field">
                  {Object.entries(TICKET_CATEGORY).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </Field>
              <Field label="Prioridade">
                <select name="priority" defaultValue="media" className="field">
                  {Object.entries(PRIORITY).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </Field>
            <Field label="Descrição">
              <input name="description" className="field" />
            </Field>
            <Submit>Abrir chamado</Submit>
            <p className="text-[11px] text-dim md:col-span-2 xl:col-span-6">Ao agendar visita, um reparo entra na agenda do técnico. Quando ele conclui o serviço, o chamado é resolvido automaticamente.</p>
          </ActionForm>
        </Panel>
        <section className="panel min-w-0">
          <Tabs active={`/manager/chamados?s=${status}`} items={FILTERS.map((f) => ({ href: `/manager/chamados?s=${f}`, label: TICKET[f].label, count: tickets.filter((r) => r.t.status === f).length }))} />
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Prioridade</th>
                  <th>Chamado</th>
                  <th>Cliente</th>
                  <th>{status === "resolvido" ? "Resolvido" : "Aberto há"}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map(({ t, customer, phone }) => (
                  <tr key={t.id}>
                    <td className="num text-mute">{t.id}</td>
                    <td><Status {...PRIORITY[t.priority]} /></td>
                    <td>
                      <div className="font-medium">{t.subject}</div>
                      <div className="max-w-[300px] truncate text-[12px] text-mute">{TICKET_CATEGORY[t.category]}{t.description && ` · ${t.description}`}</div>
                    </td>
                    <td>
                      <Link href={`/manager/clientes/${t.customerId}`} className="hover:underline">{customer}</Link>
                      <div className="num text-[12px] text-mute">{phone}</div>
                    </td>
                    <td className="num text-mute">{t.resolvedAt ? fmtDate(t.resolvedAt) : fmtDuration(now - +t.createdAt)}</td>
                    <td>
                      {t.status !== "resolvido" ? (
                        <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                          {t.status === "aberto" && (
                            <ActionForm action={scheduleVisit} className="flex items-center gap-1">
                              <input type="hidden" name="id" value={t.id} />
                              <input name="day" type="date" min={today()} defaultValue={today()} className="field h-[26px] w-[132px] px-2 text-[12px]" />
                              <select name="installerId" className="field h-[26px] w-[130px] px-2 text-[12px]">
                                <option value="">Sem instalador</option>
                                {installers.map((i) => (
                                  <option key={i.id} value={i.id}>{i.name}</option>
                                ))}
                              </select>
                              <Submit className="btn btn-sm">Agendar visita</Submit>
                            </ActionForm>
                          )}
                          <Act action={setTicketStatus} fields={{ id: t.id, status: "resolvido" }} className="btn btn-sm btn-primary">Resolver</Act>
                        </div>
                      ) : (
                        <div className="text-right"><Act action={setTicketStatus} fields={{ id: t.id, status: "aberto" }}>Reabrir</Act></div>
                      )}
                    </td>
                  </tr>
                ))}
                {!rows.length && <Empty cols={6} text="Nenhum chamado aqui." />}
              </tbody>
            </table>
          </div>
        </section>

      </div>
    </Page>
  );
}
