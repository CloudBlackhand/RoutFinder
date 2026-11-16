import { and, asc, eq, gte, lte } from "drizzle-orm";
import Link from "next/link";
import { schema } from "@/db";
import { Submit } from "@/components/forms";
import { Page, PageHead, Panel, Status } from "@/components/ui";
import { JOB_COLOR, JOB_LABEL } from "@/lib/status";
import { shiftDay, today } from "@/lib/telecom";
import { updateJob } from "../actions";
import { installersOf, managerDb } from "../data";

const DAYS = 7;
const shift = shiftDay;
const weekday = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" });

export default async function AgendaPage(props: PageProps<"/manager/agenda">) {
  const { from } = (await props.searchParams) as { from?: string };
  const start = /^\d{4}-\d{2}-\d{2}$/.test(from ?? "") ? from! : today();
  const end = shift(start, DAYS - 1);
  const db = await managerDb();
  const [jobs, installers] = await Promise.all([
    db
      .select({ j: schema.jobs, customer: schema.customers.name, address: schema.customers.address })
      .from(schema.jobs)
      .innerJoin(schema.customers, eq(schema.customers.id, schema.jobs.customerId))
      .where(and(gte(schema.jobs.day, start), lte(schema.jobs.day, end)))
      .orderBy(asc(schema.jobs.day), asc(schema.jobs.stopOrder), asc(schema.jobs.id)),
    installersOf(db),
  ]);
  const days = Array.from({ length: DAYS }, (_, i) => shift(start, i));
  const load = (day: string, id: number | null) => jobs.filter((r) => r.j.day === day && r.j.installerId === id).length;

  return (
    <Page>
      <PageHead kicker="Operação" title="Agenda">
        <div className="flex">
          <Link href={`/manager/agenda?from=${shift(start, -DAYS)}`} className="btn">← Anterior</Link>
          <Link href="/manager/agenda" className="btn -ml-px">Hoje</Link>
          <Link href={`/manager/agenda?from=${shift(start, DAYS)}`} className="btn -ml-px">Próxima →</Link>
        </div>
      </PageHead>

      <Panel title="Carga por técnico" meta={`${jobs.length} visitas entre ${start.split("-").reverse().join("/")} e ${end.split("-").reverse().join("/")}`}>
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>Técnico</th>
                {days.map((d) => (
                  <th key={d} className="text-center">{weekday(d).split(",")[0].slice(0, 3)} {d.slice(8)}/{d.slice(5, 7)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...installers, { id: null, name: "Sem técnico" }].map((i) => (
                <tr key={i.id ?? "none"}>
                  <td className={i.id ? "" : "text-amber-400"}>{i.name}</td>
                  {days.map((d) => {
                    const n = load(d, i.id);
                    return (
                      <td key={d} className="num text-center">
                        {n ? <span className={`inline-block min-w-7 border px-1.5 py-0.5 ${n >= 8 ? "border-red-500/60 text-red-400" : "border-line"}`}>{n}</span> : <span className="text-dim">·</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {days.map((d) => {
        const list = jobs.filter((r) => r.j.day === d);
        if (!list.length) return null;
        return (
          <Panel key={d} title={weekday(d)} meta={`${list.length} visita(s)${d === today() ? " · hoje" : ""}`}>
            <div className="overflow-x-auto">
              <table className="tbl">
                <tbody>
                  {list.map(({ j, customer, address }) => (
                    <tr key={j.id}>
                      <td className="num w-10 text-mute">{j.stopOrder != null ? String(j.stopOrder + 1).padStart(2, "0") : "--"}</td>
                      <td>
                        <Link href={`/manager/clientes/${j.customerId}`} className="font-medium hover:underline">{customer}</Link>
                        <div className="max-w-[340px] truncate text-[12px] text-mute">{address}</div>
                      </td>
                      <td>
                        {j.type === "instalacao" ? "Instalação" : "Reparo"}
                        <div className="text-[12px] text-mute">{j.orderId ? `Pedido #${j.orderId}` : j.ticketId ? `Chamado #${j.ticketId}` : "Avulso"}</div>
                      </td>
                      <td><Status color={JOB_COLOR[j.status]} label={JOB_LABEL[j.status]} /></td>
                      <td className="text-right">
                        {j.status === "pendente" ? (
                          <form action={updateJob} className="inline-flex items-center gap-1">
                            <input type="hidden" name="id" value={j.id} />
                            <input name="day" type="date" defaultValue={j.day} className="field h-[26px] w-[132px] px-2 text-[12px]" />
                            <select name="installerId" defaultValue={j.installerId ?? ""} className="field h-[26px] w-[150px] px-2 text-[12px]">
                              <option value="">Sem técnico</option>
                              {installers.map((i) => (
                                <option key={i.id} value={i.id}>{i.name}</option>
                              ))}
                            </select>
                            <Submit className="btn btn-sm">Salvar</Submit>
                          </form>
                        ) : (
                          <span className="text-[12px] text-mute">{installers.find((i) => i.id === j.installerId)?.name}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        );
      })}
      {!jobs.length && <div className="panel py-10 text-center text-mute">Nenhuma visita agendada nesse período.</div>}
    </Page>
  );
}
