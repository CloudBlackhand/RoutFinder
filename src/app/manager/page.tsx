"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { JOB_COLOR, JOB_LABEL, STATE_COLOR, STATE_LABEL, fmtDuration, installerState, jobStats, type JobStatus } from "@/lib/status";
import { useLive } from "./shell";

export default function OverviewPage() {
  const { data, reload } = useLive();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const now = data?.now ?? 0;
  const stats = useMemo(() => jobStats(data?.jobs ?? [], now), [data, now]);

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

  const byStatus = (s: JobStatus) => (data?.jobs ?? []).filter((j) => j.status === s).length;
  const unassigned = (data?.jobs ?? []).filter((j) => j.installerId == null && j.status === "pendente").length;
  const pct = stats.total ? Math.round((stats.done / stats.total) * 100) : 0;

  async function optimize() {
    setBusy(true);
    setMsg("");
    const r = await fetch("/api/manager/optimize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ autoAssign: true }) });
    const j = await r.json();
    setMsg(r.ok ? `Rotas geradas para ${j.summary.length} instalador(es).` : j.error ?? "Erro ao otimizar");
    setBusy(false);
    reload();
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Visão geral de hoje</h1>
          <p className="text-sm text-slate-400">Atualiza automaticamente a cada poucos segundos.</p>
        </div>
        <div className="flex items-center gap-3">
          {msg && <span className="text-sm text-slate-300">{msg}</span>}
          <button onClick={optimize} disabled={busy} className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 disabled:opacity-50">
            {busy ? "Calculando..." : "Atribuir e otimizar rotas"}
          </button>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card label="Concluídos" value={`${stats.done}/${stats.total}`} hint={`${pct}% do dia`} />
        <Card label="Em atendimento" value={String(stats.active)} hint={`${byStatus("a_caminho")} a caminho`} />
        <Card label="Tempo médio por cliente" value={stats.avgService ? fmtDuration(stats.avgService) : "-"} hint="serviços concluídos" />
        <Card label="Deslocamento médio" value={stats.avgTravel ? fmtDuration(stats.avgTravel) : "-"} hint={unassigned ? `${unassigned} sem instalador` : "tudo atribuído"} />
      </section>

      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
      </div>

      <section className="overflow-hidden rounded-xl border border-white/10 bg-slate-900">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h2 className="font-semibold">Equipe agora</h2>
          <Link href="/manager/mapa" className="text-sm text-sky-400 hover:underline">Ver no mapa 3D</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-2">Instalador</th>
                <th className="px-4 py-2">Estado</th>
                <th className="px-4 py-2">Cliente atual</th>
                <th className="px-4 py-2">Tempo</th>
                <th className="px-4 py-2">Progresso</th>
                <th className="px-4 py-2">Velocidade</th>
                <th className="px-4 py-2">Rota planejada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((r) => {
                const done = r.jobs.filter((j) => j.status === "concluido").length;
                return (
                  <tr key={r.id}>
                    <td className="px-4 py-3 font-medium">{r.name}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5" style={{ color: STATE_COLOR[r.state] }}>
                        <span className="h-2 w-2 rounded-full" style={{ background: STATE_COLOR[r.state] }} />
                        {STATE_LABEL[r.state]}
                      </span>
                    </td>
                    <td className="px-4 py-3">{r.current?.customer ?? "-"}</td>
                    <td className="px-4 py-3">{r.since ? fmtDuration(now - new Date(r.since).getTime()) : "-"}</td>
                    <td className="px-4 py-3">{done}/{r.jobs.length}</td>
                    <td className="px-4 py-3">{r.pos ? `${Math.round((r.pos.speed ?? 0) * 3.6)} km/h` : "-"}</td>
                    <td className="px-4 py-3">{r.route ? `${(r.route.distanceM / 1000).toFixed(1)} km · ${fmtDuration(r.route.durationS * 1000)}` : "-"}</td>
                  </tr>
                );
              })}
              {!rows.length && <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-500">{data ? "Nenhum instalador ativo. Cadastre na aba Equipe." : "Carregando..."}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(Object.keys(JOB_LABEL) as JobStatus[]).map((s) => (
          <div key={s} className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-900 p-4">
            <span className="h-3 w-3 rounded-full" style={{ background: JOB_COLOR[s] }} />
            <div>
              <div className="text-xl font-semibold">{byStatus(s)}</div>
              <div className="text-xs text-slate-400">{JOB_LABEL[s]}</div>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

function Card({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-900 p-4">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      <div className="text-xs text-slate-500">{hint}</div>
    </div>
  );
}
