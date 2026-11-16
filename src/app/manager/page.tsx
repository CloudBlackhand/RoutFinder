"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PageHead, Status } from "@/components/ui";
import { JOB_COLOR, JOB_LABEL, STATE_COLOR, STATE_LABEL, activity, fmtClock, fmtDuration, installerState, jobStats, type JobStatus } from "@/lib/status";
import { useLive } from "./shell";

const STATUSES = Object.keys(JOB_LABEL) as JobStatus[];

export default function OverviewPage() {
  const { data, reload } = useLive();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const now = data?.now ?? 0;
  const stats = useMemo(() => jobStats(data?.jobs ?? [], now), [data, now]);
  const feed = useMemo(() => (data ? activity(data, 12) : []), [data]);

  const rows = useMemo(
    () =>
      (data?.installers ?? []).map((i) => {
        const pos = data!.positions.find((p) => p.installerId === i.id);
        const jobs = data!.jobs.filter((j) => j.installerId === i.id);
        const current = jobs.find((j) => j.status === "em_andamento") ?? jobs.find((j) => j.status === "a_caminho");
        const since = current ? current.startedAt ?? current.arrivedAt ?? current.startedRouteAt : null;
        const route = data!.routes.find((r) => r.installerId === i.id);
        return { ...i, pos, jobs, current, since, route, state: installerState(pos, jobs, now) };
      }),
    [data, now],
  );

  const count = (s: JobStatus) => (data?.jobs ?? []).filter((j) => j.status === s).length;
  const unassigned = (data?.jobs ?? []).filter((j) => j.installerId == null && j.status === "pendente").length;
  const pct = stats.total ? Math.round((stats.done / stats.total) * 100) : 0;
  const onlineCount = rows.filter((r) => r.state !== "offline").length;

  async function optimize() {
    setBusy(true);
    setMsg("");
    const r = await fetch("/api/manager/optimize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ autoAssign: true }) });
    const j = await r.json();
    setMsg(r.ok ? `Rotas geradas para ${j.summary.length} instalador(es)` : j.error ?? "Erro ao otimizar");
    setBusy(false);
    reload();
  }

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5 p-4 sm:p-6">
      <PageHead kicker={new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })} title="Visão geral">
        {msg && <span className="text-xs text-mute">{msg}</span>}
        <button onClick={optimize} disabled={busy} className="btn btn-primary">{busy ? "Calculando..." : "Atribuir e otimizar rotas"}</button>
      </PageHead>

      <section className="panel grid grid-cols-2 divide-line max-lg:divide-y lg:grid-cols-5 lg:divide-x">
        <Kpi label="Serviços concluídos" value={`${stats.done}/${stats.total}`} hint={`${pct}% do dia`} />
        <Kpi label="Em atendimento" value={String(stats.active)} hint={`${count("a_caminho")} a caminho`} />
        <Kpi label="Equipe online" value={`${onlineCount}/${rows.length}`} hint="com GPS ativo" />
        <Kpi label="Tempo médio no cliente" value={stats.avgService ? fmtDuration(stats.avgService) : "--"} hint="serviços concluídos" />
        <Kpi label="Deslocamento médio" value={stats.avgTravel ? fmtDuration(stats.avgTravel) : "--"} hint={unassigned ? `${unassigned} sem instalador` : "tudo atribuído"} warn={unassigned > 0} />
      </section>

      <section className="panel">
        <div className="panel-head">
          <span className="label">Andamento do dia</span>
          <div className="flex gap-4">
            {STATUSES.map((s) => (
              <span key={s} className="flex items-center gap-1.5">
                <Status color={JOB_COLOR[s]} label={JOB_LABEL[s]} />
                <span className="num text-xs">{count(s)}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="flex h-2 gap-px bg-line p-px">
          {stats.total ? STATUSES.map((s) => count(s) > 0 && <div key={s} style={{ flex: count(s), background: JOB_COLOR[s] }} />) : <div className="flex-1 bg-raised" />}
        </div>
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[1fr_360px]">
        <section className="panel overflow-hidden">
          <div className="panel-head">
            <span className="label">Equipe agora</span>
            <Link href="/manager/monitoramento" className="label !text-fg hover:underline">Abrir monitoramento →</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Instalador</th>
                  <th>Estado</th>
                  <th>Cliente atual</th>
                  <th>Tempo</th>
                  <th>Progresso</th>
                  <th>Velocidade</th>
                  <th>Rota planejada</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const done = r.jobs.filter((j) => j.status === "concluido").length;
                  return (
                    <tr key={r.id}>
                      <td className="font-medium">{r.name}</td>
                      <td><Status color={STATE_COLOR[r.state]} label={STATE_LABEL[r.state]} /></td>
                      <td className={r.current ? "" : "text-dim"}>{r.current?.customer ?? "--"}</td>
                      <td className="num">{r.since ? fmtDuration(now - new Date(r.since).getTime()) : "--"}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="h-1 w-20 bg-line"><div className="h-full bg-fg" style={{ width: `${r.jobs.length ? (done / r.jobs.length) * 100 : 0}%` }} /></div>
                          <span className="num text-xs">{done}/{r.jobs.length}</span>
                        </div>
                      </td>
                      <td className="num">{r.pos ? `${Math.round((r.pos.speed ?? 0) * 3.6)} km/h` : "--"}</td>
                      <td className="num">{r.route ? `${(r.route.distanceM / 1000).toFixed(1)} km · ${fmtDuration(r.route.durationS * 1000)}` : "--"}</td>
                    </tr>
                  );
                })}
                {!rows.length && <tr><td colSpan={7} className="!py-8 text-center text-dim">{data ? "Nenhum instalador ativo. Cadastre na aba Equipe." : "Carregando..."}</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head"><span className="label">Atividade recente</span></div>
          <ul>
            {feed.map((a, i) => (
              <li key={i} className="flex items-start gap-3 border-b border-line px-3 py-2 last:border-0">
                <span className="num pt-px text-[11px] text-mute">{fmtClock(a.ts)}</span>
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0" style={{ background: a.color }} />
                <span className="text-[13px] leading-snug">{a.text}</span>
              </li>
            ))}
            {!feed.length && <li className="px-3 py-8 text-center text-dim">Sem atividade registrada hoje.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}

function Kpi({ label, value, hint, warn }: { label: string; value: string; hint: string; warn?: boolean }) {
  return (
    <div className="p-4">
      <div className="label">{label}</div>
      <div className="num mt-2 text-[26px] font-medium leading-none tracking-tight">{value}</div>
      <div className={`mt-2 text-xs ${warn ? "text-amber-400" : "text-dim"}`}>{hint}</div>
    </div>
  );
}
