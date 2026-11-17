import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { schema } from "@/db";
import { Act, Empty, Kpi, KpiStrip, Page, PageHead, Panel, Status, Tabs } from "@/components/ui";
import { CONTACT_CHANNEL, CONTACT_REASON, fmtDate, nowMs, today } from "@/lib/telecom";
import { completeFollowUp } from "../actions";
import { managerDb } from "../data";

const FILTERS = [
  { k: "retornos", label: "Retornos pendentes" },
  { k: "", label: "Todos os contatos" },
];

export default async function InteractionsPage(props: PageProps<"/manager/atendimentos">) {
  const { f = "retornos" } = (await props.searchParams) as { f?: string };
  const db = await managerDb();
  const rows = await db
    .select({ i: schema.interactions, customer: schema.customers.name, user: schema.users.name })
    .from(schema.interactions)
    .innerJoin(schema.customers, eq(schema.customers.id, schema.interactions.customerId))
    .leftJoin(schema.users, eq(schema.users.id, schema.interactions.userId))
    .orderBy(desc(schema.interactions.createdAt))
    .limit(300);

  const t0 = today();
  const pending = rows.filter((r) => r.i.followUpDate && !r.i.followUpDone);
  const late = pending.filter((r) => r.i.followUpDate! <= t0);
  const week = rows.filter((r) => +r.i.createdAt > nowMs() - 7 * 86_400_000);
  const shown = f === "retornos" ? pending.sort((a, b) => a.i.followUpDate!.localeCompare(b.i.followUpDate!)) : rows;
  const href = (k: string) => `/manager/atendimentos${k ? `?f=${k}` : ""}`;

  return (
    <Page>
      <PageHead kicker="Comercial" title="Atendimentos" />

      <KpiStrip>
        <Kpi label="Retornos pendentes" value={String(pending.length)} hint="acompanhamentos agendados" />
        <Kpi label="Retornos vencidos" value={String(late.length)} hint="passaram da data" warn={late.length > 0} />
        <Kpi label="Contatos na semana" value={String(week.length)} hint={`${new Set(week.map((r) => r.i.customerId)).size} clientes`} />
        <Kpi label="Cobranças na semana" value={String(week.filter((r) => r.i.reason === "cobranca").length)} hint="contatos de cobrança" />
      </KpiStrip>

      <section className="panel">
        <Tabs active={href(f === "retornos" ? "retornos" : "")} items={FILTERS.map((x) => ({ href: href(x.k), label: x.label, count: x.k === "retornos" ? pending.length : rows.length }))} />
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>Data</th>
                <th>Cliente</th>
                <th>Canal</th>
                <th>Motivo</th>
                <th>Resumo</th>
                <th>Responsável</th>
                <th>Retorno</th>
              </tr>
            </thead>
            <tbody>
              {shown.map(({ i, customer, user }) => (
                <tr key={i.id}>
                  <td className="num whitespace-nowrap text-mute">{new Date(i.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                  <td><Link href={`/manager/clientes/${i.customerId}`} className="font-medium hover:underline">{customer}</Link></td>
                  <td>{CONTACT_CHANNEL[i.channel]}</td>
                  <td><Status {...CONTACT_REASON[i.reason]} /></td>
                  <td className="max-w-[420px]">
                    <div className="truncate">{i.summary}</div>
                  </td>
                  <td className="text-mute">{user ?? "—"}</td>
                  <td>
                    {i.followUpDate && !i.followUpDone ? (
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <span className={`num text-[12px] ${i.followUpDate <= t0 ? "text-amber-400" : "text-mute"}`}>{fmtDate(i.followUpDate)}</span>
                        <Act action={completeFollowUp} fields={{ id: i.id }}>Feito</Act>
                      </div>
                    ) : i.followUpDate ? (
                      <span className="num text-[12px] text-dim">{fmtDate(i.followUpDate)} ✓</span>
                    ) : (
                      <span className="text-dim">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {!shown.length && <Empty cols={7} text={f === "retornos" ? "Nenhum retorno pendente." : "Nenhum contato registrado."} />}
            </tbody>
          </table>
        </div>
      </section>

      <Panel title="Como registrar">
        <p className="p-3 text-[12px] text-mute">
          Os contatos são registrados na ficha do cliente, na aba Resumo. Lá você escolhe o canal, o motivo e pode marcar uma data de retorno — os retornos pendentes aparecem aqui.
        </p>
      </Panel>
    </Page>
  );
}
