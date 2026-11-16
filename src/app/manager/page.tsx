"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Picked } from "@/components/map/FinderLayer";
import { JOB_COLOR, JOB_LABEL, STATE_COLOR, STATE_LABEL, fmtDuration, installerState, jobStats, type LiveData } from "@/lib/status";

const Map3D = dynamic(() => import("@/components/map/Map3D"), { ssr: false });
const POLL_MS = 4000;

export default function ManagerPage() {
  const router = useRouter();
  const [data, setData] = useState<LiveData | null>(null);
  const [selected, setSelected] = useState<Picked>(null);
  const [trail, setTrail] = useState<[number, number][]>([]);
  const [focus, setFocus] = useState<[number, number] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const r = await fetch("/api/manager/live", { cache: "no-store" });
    if (r.status === 401) return router.replace("/login");
    if (r.ok) setData(await r.json());
  }, [router]);

  useEffect(() => {
    const t0 = setTimeout(load, 0);
    const t = setInterval(load, POLL_MS);
    return () => {
      clearTimeout(t0);
      clearInterval(t);
    };
  }, [load]);

  const selInstaller = selected?.kind === "installer" ? selected.id : null;
  useEffect(() => {
    if (selInstaller == null) return;
    let alive = true;
    const run = async () => {
      const r = await fetch(`/api/manager/trail/${selInstaller}`, { cache: "no-store" });
      if (alive && r.ok) setTrail(((await r.json()).points as { lat: number; lng: number }[]).map((p) => [p.lng, p.lat]));
    };
    run();
    const t = setInterval(run, 10000);
    return () => {
      alive = false;
      clearInterval(t);
      setTrail([]);
    };
  }, [selInstaller]);

  const now = data?.now ?? 0;
  const rows = useMemo(
    () =>
      (data?.installers ?? []).map((i) => {
        const pos = data!.positions.find((p) => p.installerId === i.id);
        const jobs = data!.jobs.filter((j) => j.installerId === i.id);
        return { ...i, pos, jobs, state: installerState(pos, jobs, now) };
      }),
    [data, now],
  );
  const stats = useMemo(() => jobStats(data?.jobs ?? [], now), [data, now]);

  async function optimize() {
    setBusy(true);
    setMsg("");
    const r = await fetch("/api/manager/optimize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ autoAssign: true }) });
    const j = await r.json();
    setMsg(r.ok ? `Rotas geradas para ${j.summary.length} instalador(es)` : j.error ?? "Erro");
    setBusy(false);
    load();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  const pick = (p: Picked) => {
    setSelected(p);
    if (!p || !data) return;
    if (p.kind === "installer") {
      const pos = data.positions.find((x) => x.installerId === p.id);
      if (pos) setFocus([pos.lng, pos.lat]);
    } else {
      const j = data.jobs.find((x) => x.id === p.id);
      if (j) setFocus([j.lng, j.lat]);
    }
  };

  const selRow = selInstaller != null ? rows.find((r) => r.id === selInstaller) : null;
  const selJob = selected?.kind === "job" ? data?.jobs.find((j) => j.id === selected.id) : null;
  const activeJob = selRow?.jobs.find((j) => j.status === "em_andamento") ?? selRow?.jobs.find((j) => j.status === "a_caminho");
  const since = activeJob ? activeJob.startedAt ?? activeJob.arrivedAt ?? activeJob.startedRouteAt : null;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      <Map3D data={data} selected={selected} onSelect={pick} trail={trail} focus={focus} />

      <aside className="absolute left-3 top-3 bottom-3 flex w-80 flex-col gap-3 overflow-y-auto rounded-xl border border-white/10 bg-slate-900/85 p-4 backdrop-blur">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Finder · Gestão</h1>
          <button onClick={logout} className="text-xs text-slate-400 hover:text-white">Sair</button>
        </div>

        <div className="grid grid-cols-2 gap-2 text-center text-xs">
          <Kpi label="Concluídos" value={`${stats.done}/${stats.total}`} />
          <Kpi label="Em atendimento" value={String(stats.active)} />
          <Kpi label="Tempo médio/cliente" value={stats.avgService ? fmtDuration(stats.avgService) : "-"} />
          <Kpi label="Deslocamento médio" value={stats.avgTravel ? fmtDuration(stats.avgTravel) : "-"} />
        </div>

        <button onClick={optimize} disabled={busy} className="rounded-lg bg-sky-500 px-3 py-2 text-sm font-medium text-slate-950 disabled:opacity-50">
          {busy ? "Calculando..." : "Atribuir e otimizar rotas"}
        </button>
        {msg && <p className="text-xs text-slate-300">{msg}</p>}

        <h2 className="mt-1 text-xs uppercase tracking-wide text-slate-400">Instaladores</h2>
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <li key={r.id}>
              <button onClick={() => pick({ kind: "installer", id: r.id })} className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${selInstaller === r.id ? "border-sky-400 bg-sky-400/10" : "border-white/10 hover:bg-white/5"}`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium">{r.name}</span>
                  <span className="flex items-center gap-1 text-xs" style={{ color: STATE_COLOR[r.state] }}>
                    <span className="h-2 w-2 rounded-full" style={{ background: STATE_COLOR[r.state] }} />
                    {STATE_LABEL[r.state]}
                  </span>
                </div>
                <div className="text-xs text-slate-400">{r.jobs.filter((j) => j.status === "concluido").length}/{r.jobs.length} serviços</div>
              </button>
            </li>
          ))}
          {!rows.length && <li className="text-xs text-slate-500">Carregando...</li>}
        </ul>
      </aside>

      {(selRow || selJob) && (
        <section className="absolute right-3 bottom-3 w-80 rounded-xl border border-white/10 bg-slate-900/90 p-4 text-sm backdrop-blur">
          <button onClick={() => pick(null)} className="float-right text-xs text-slate-400 hover:text-white">fechar</button>
          {selRow && (
            <>
              <h3 className="text-base font-semibold">{selRow.name}</h3>
              <p style={{ color: STATE_COLOR[selRow.state] }}>{STATE_LABEL[selRow.state]}</p>
              <dl className="mt-2 grid grid-cols-2 gap-y-1 text-xs text-slate-300">
                <dt>Velocidade</dt><dd>{selRow.pos ? `${Math.round((selRow.pos.speed ?? 0) * 3.6)} km/h` : "-"}</dd>
                <dt>Última posição</dt><dd>{selRow.pos ? `${Math.round((now - new Date(selRow.pos.ts).getTime()) / 1000)}s atrás` : "-"}</dd>
                <dt>Cliente atual</dt><dd>{activeJob?.customer ?? "-"}</dd>
                <dt>{activeJob?.status === "em_andamento" ? "Tempo no cliente" : "Em rota há"}</dt><dd>{since ? fmtDuration(now - new Date(since).getTime()) : "-"}</dd>
                <dt>Restantes</dt><dd>{selRow.jobs.filter((j) => j.status !== "concluido").length}</dd>
                <dt>Rota planejada</dt><dd>{(() => { const rt = data?.routes.find((x) => x.installerId === selRow.id); return rt ? `${(rt.distanceM / 1000).toFixed(1)} km · ${fmtDuration(rt.durationS * 1000)}` : "-"; })()}</dd>
              </dl>
            </>
          )}
          {selJob && (
            <>
              <h3 className="text-base font-semibold">{selJob.customer}</h3>
              <p className="text-xs text-slate-400">{selJob.address}</p>
              <p className="mt-1" style={{ color: JOB_COLOR[selJob.status] }}>{JOB_LABEL[selJob.status]} · {selJob.type === "reparo" ? "Reparo" : "Instalação"}</p>
              <dl className="mt-2 grid grid-cols-2 gap-y-1 text-xs text-slate-300">
                <dt>Instalador</dt><dd>{data?.installers.find((i) => i.id === selJob.installerId)?.name ?? "Não atribuído"}</dd>
                <dt>Parada</dt><dd>{selJob.stopOrder ?? "-"}</dd>
                <dt>Telefone</dt><dd>{selJob.phone ?? "-"}</dd>
                <dt>Chegada</dt><dd>{selJob.arrivedAt ? new Date(selJob.arrivedAt).toLocaleTimeString("pt-BR") : "-"}</dd>
                <dt>Duração</dt><dd>{selJob.startedAt ? fmtDuration(new Date(selJob.finishedAt ?? now).getTime() - new Date(selJob.startedAt).getTime()) : "-"}</dd>
              </dl>
            </>
          )}
        </section>
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/5 p-2">
      <div className="text-base font-semibold">{value}</div>
      <div className="text-slate-400">{label}</div>
    </div>
  );
}
