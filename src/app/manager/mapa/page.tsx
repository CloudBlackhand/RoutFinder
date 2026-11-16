"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import type { Picked } from "@/components/map/FinderLayer";
import { JOB_COLOR, JOB_LABEL, STATE_COLOR, STATE_LABEL, fmtDuration, installerState } from "@/lib/status";
import { useLive } from "../shell";

const Map3D = dynamic(() => import("@/components/map/Map3D"), { ssr: false });

export default function MapPage() {
  const { data } = useLive();
  const [selected, setSelected] = useState<Picked>(null);
  const [trail, setTrail] = useState<[number, number][]>([]);
  const [focus, setFocus] = useState<[number, number] | null>(null);

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
    <div className="relative min-h-[calc(100vh-3.5rem)] flex-1">
      <Map3D data={data} selected={selected} onSelect={pick} trail={trail} focus={focus} />

      <div className="absolute left-3 top-3 flex max-w-[calc(100%-1.5rem)] flex-wrap gap-2">
        {rows.map((r) => (
          <button key={r.id} onClick={() => pick({ kind: "installer", id: r.id })} className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs backdrop-blur ${selInstaller === r.id ? "border-sky-400 bg-sky-400/20" : "border-white/10 bg-slate-900/85"}`}>
            <span className="h-2 w-2 rounded-full" style={{ background: STATE_COLOR[r.state] }} />
            <span className="font-medium">{r.name}</span>
            <span className="text-slate-400">{STATE_LABEL[r.state]}</span>
          </button>
        ))}
      </div>

      <div className="absolute bottom-3 left-3 flex gap-3 rounded-lg border border-white/10 bg-slate-900/85 px-3 py-2 text-[11px] text-slate-300 backdrop-blur">
        {(Object.keys(JOB_LABEL) as (keyof typeof JOB_LABEL)[]).map((k) => (
          <span key={k} className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: JOB_COLOR[k] }} />{JOB_LABEL[k]}</span>
        ))}
        <span className="text-slate-500">· clique em uma van ou casa para detalhes</span>
      </div>

      {(selRow || selJob) && (
        <section className="absolute bottom-3 right-3 w-80 rounded-xl border border-white/10 bg-slate-900/90 p-4 text-sm backdrop-blur">
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
                <dt>Rota planejada</dt>
                <dd>{(() => { const rt = data?.routes.find((x) => x.installerId === selRow.id); return rt ? `${(rt.distanceM / 1000).toFixed(1)} km · ${fmtDuration(rt.durationS * 1000)}` : "-"; })()}</dd>
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
