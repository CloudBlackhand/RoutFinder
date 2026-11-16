"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import type { Picked } from "@/components/map/FinderLayer";
import { Status } from "@/components/ui";
import { JOB_COLOR, JOB_LABEL, STATE_COLOR, STATE_LABEL, activity, fmtClock, fmtDuration, installerState, type JobStatus } from "@/lib/status";
import { useLive } from "../shell";

const Map3D = dynamic(() => import("@/components/map/Map3D"), { ssr: false });

export default function MonitoringPage() {
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
        const jobs = data!.jobs.filter((j) => j.installerId === i.id).sort((a, b) => (a.stopOrder ?? 99) - (b.stopOrder ?? 99));
        return { ...i, pos, jobs, state: installerState(pos, jobs, now) };
      }),
    [data, now],
  );
  const feed = useMemo(() => (data ? activity(data, 30) : []), [data]);

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
  const route = selRow ? data?.routes.find((x) => x.installerId === selRow.id) : null;

  return (
    <div className="grid h-screen grid-cols-1 lg:grid-cols-[280px_1fr_320px]">
      <aside className="hidden min-h-0 flex-col border-r border-line bg-panel lg:flex">
        <div className="panel-head shrink-0">
          <span className="label">Unidades</span>
          <span className="num text-[11px] text-mute">{rows.filter((r) => r.state !== "offline").length}/{rows.length} online</span>
        </div>
        <ul className="shrink-0">
          {rows.map((r) => {
            const done = r.jobs.filter((j) => j.status === "concluido").length;
            return (
              <li key={r.id}>
                <button onClick={() => pick({ kind: "installer", id: r.id })} className={`block w-full border-b border-l-2 border-b-line px-3 py-2.5 text-left ${selInstaller === r.id ? "border-l-fg bg-raised" : "border-l-transparent hover:bg-raised"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{r.name}</span>
                    <Status color={STATE_COLOR[r.state]} label={STATE_LABEL[r.state]} />
                  </div>
                  <div className="num mt-1 flex gap-3 text-[11px] text-mute">
                    <span>{r.pos ? `${Math.round((r.pos.speed ?? 0) * 3.6)} km/h` : "-- km/h"}</span>
                    <span>{done}/{r.jobs.length} serviços</span>
                    <span>{r.pos ? fmtClock(r.pos.ts) : "sem sinal"}</span>
                  </div>
                </button>
              </li>
            );
          })}
          {!rows.length && <li className="px-3 py-6 text-center text-dim">{data ? "Nenhum instalador ativo." : "Carregando..."}</li>}
        </ul>
        <div className="panel-head shrink-0"><span className="label">Atividade</span></div>
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {feed.map((a, i) => (
            <li key={i}>
              <button onClick={() => pick({ kind: "job", id: a.jobId })} className="flex w-full items-start gap-2 border-b border-line px-3 py-2 text-left hover:bg-raised">
                <span className="num pt-px text-[11px] text-mute">{fmtClock(a.ts)}</span>
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0" style={{ background: a.color }} />
                <span className="text-xs leading-snug">{a.text}</span>
              </button>
            </li>
          ))}
          {!feed.length && <li className="px-3 py-6 text-center text-xs text-dim">Sem atividade registrada hoje.</li>}
        </ul>
      </aside>

      <div className="relative min-h-[60vh]">
        <Map3D data={data} selected={selected} onSelect={pick} trail={trail} focus={focus} />
        <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap gap-x-4 gap-y-1 border border-line bg-panel/90 px-3 py-2">
          {(Object.keys(JOB_LABEL) as JobStatus[]).map((k) => <Status key={k} color={JOB_COLOR[k]} label={JOB_LABEL[k]} />)}
        </div>
      </div>

      <aside className="flex min-h-0 flex-col overflow-y-auto border-l border-line bg-panel max-lg:border-l-0 max-lg:border-t">
        {!selRow && !selJob && (
          <>
            <div className="panel-head"><span className="label">Detalhes</span></div>
            <p className="px-3 py-6 text-xs leading-relaxed text-dim">Selecione uma unidade na lista ou clique em um veículo ou cliente no mapa para ver os detalhes.</p>
          </>
        )}
        {selRow && (
          <>
            <div className="panel-head">
              <span className="label">Unidade</span>
              <button onClick={() => pick(null)} className="label hover:!text-fg">Fechar ×</button>
            </div>
            <div className="border-b border-line px-3 py-3">
              <div className="text-base font-semibold">{selRow.name}</div>
              <div className="mt-1"><Status color={STATE_COLOR[selRow.state]} label={STATE_LABEL[selRow.state]} /></div>
            </div>
            <dl>
              <Row k="Velocidade" v={selRow.pos ? `${Math.round((selRow.pos.speed ?? 0) * 3.6)} km/h` : "--"} />
              <Row k="Último sinal" v={selRow.pos ? `${Math.max(0, Math.round((now - new Date(selRow.pos.ts).getTime()) / 1000))}s atrás` : "--"} />
              <Row k="Cliente atual" v={activeJob?.customer ?? "--"} />
              <Row k={activeJob?.status === "em_andamento" ? "Tempo no cliente" : "Em rota há"} v={since ? fmtDuration(now - new Date(since).getTime()) : "--"} />
              <Row k="Rota planejada" v={route ? `${(route.distanceM / 1000).toFixed(1)} km · ${fmtDuration(route.durationS * 1000)}` : "--"} />
            </dl>
            <div className="panel-head">
              <span className="label">Paradas</span>
              <span className="num text-[11px] text-mute">{selRow.jobs.filter((j) => j.status === "concluido").length}/{selRow.jobs.length}</span>
            </div>
            <ol>
              {selRow.jobs.map((j) => (
                <li key={j.id}>
                  <button onClick={() => pick({ kind: "job", id: j.id })} className="flex w-full items-center gap-3 border-b border-line px-3 py-2 text-left hover:bg-raised">
                    <span className="num w-5 text-[11px] text-mute">{String(j.stopOrder ?? 0).padStart(2, "0")}</span>
                    <span className="h-2 w-2 shrink-0" style={{ background: JOB_COLOR[j.status] }} />
                    <span className="min-w-0 flex-1 truncate text-xs">{j.customer}</span>
                    <span className="num text-[11px] text-mute">{j.finishedAt ? fmtClock(j.finishedAt) : j.arrivedAt ? fmtClock(j.arrivedAt) : ""}</span>
                  </button>
                </li>
              ))}
              {!selRow.jobs.length && <li className="px-3 py-6 text-center text-xs text-dim">Sem serviços atribuídos.</li>}
            </ol>
          </>
        )}
        {selJob && (
          <>
            <div className="panel-head">
              <span className="label">Serviço #{selJob.id}</span>
              <button onClick={() => pick(null)} className="label hover:!text-fg">Fechar ×</button>
            </div>
            <div className="border-b border-line px-3 py-3">
              <div className="text-base font-semibold">{selJob.customer}</div>
              <div className="mt-0.5 text-xs text-mute">{selJob.address}</div>
              <div className="mt-2"><Status color={JOB_COLOR[selJob.status]} label={JOB_LABEL[selJob.status]} /></div>
            </div>
            <dl>
              <Row k="Tipo" v={selJob.type === "reparo" ? "Reparo" : "Instalação"} />
              <Row k="Instalador" v={data?.installers.find((i) => i.id === selJob.installerId)?.name ?? "Não atribuído"} />
              <Row k="Parada" v={selJob.stopOrder ? String(selJob.stopOrder).padStart(2, "0") : "--"} />
              <Row k="Telefone" v={selJob.phone ?? "--"} />
              <Row k="Saída" v={selJob.startedRouteAt ? fmtClock(selJob.startedRouteAt) : "--"} />
              <Row k="Chegada" v={selJob.arrivedAt ? fmtClock(selJob.arrivedAt) : "--"} />
              <Row k="Início" v={selJob.startedAt ? fmtClock(selJob.startedAt) : "--"} />
              <Row k="Conclusão" v={selJob.finishedAt ? fmtClock(selJob.finishedAt) : "--"} />
              <Row k="Duração" v={selJob.startedAt ? fmtDuration(new Date(selJob.finishedAt ?? now).getTime() - new Date(selJob.startedAt).getTime()) : "--"} />
            </dl>
          </>
        )}
      </aside>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line px-3 py-2">
      <dt className="label">{k}</dt>
      <dd className="num truncate text-xs">{v}</dd>
    </div>
  );
}
