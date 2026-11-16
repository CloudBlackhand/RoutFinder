"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { JOB_COLOR, JOB_LABEL, type JobStatus } from "@/lib/status";
import { enqueue, flush } from "@/lib/queue";
import { isWithinGeofence } from "@/lib/geo";

const InstallerMap = dynamic(() => import("@/components/map/InstallerMap"), { ssr: false });

type Job = { id: number; type: "instalacao" | "reparo"; status: JobStatus; stopOrder: number | null; arrivedAt: string | null; customer: string; address: string; phone: string | null; lat: number; lng: number };
type RouteData = { name: string; jobs: Job[]; route: { geometry: [number, number][] } | null };
type Action = "a_caminho" | "chegou" | "iniciar" | "concluir";

export default function InstallerPage() {
  const router = useRouter();
  const [data, setData] = useState<RouteData | null>(null);
  const [tracking, setTracking] = useState(false);
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const [pending, setPending] = useState(0);
  const [error, setError] = useState("");
  const [nearJob, setNearJob] = useState<number | null>(null);
  const watchId = useRef<number | null>(null);
  const wake = useRef<WakeLockSentinel | null>(null);
  const jobsRef = useRef<Job[]>([]);

  const load = useCallback(async () => {
    const r = await fetch("/api/installer/route", { cache: "no-store" });
    if (r.status === 401) return router.replace("/login");
    if (r.ok) {
      const d: RouteData = await r.json();
      jobsRef.current = d.jobs;
      setData(d);
    }
  }, [router]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const send = useCallback(async (pts: unknown[]) => {
    try {
      const r = await fetch("/api/installer/location", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ points: pts }) });
      if (r.status === 401) router.replace("/login");
      return r.ok;
    } catch {
      return false;
    }
  }, [router]);

  useEffect(() => {
    if (!tracking) return;
    const t = setInterval(async () => setPending((await flush(send)).pending), 5000);
    return () => clearInterval(t);
  }, [tracking, send]);

  async function start() {
    setError("");
    if (!navigator.geolocation) return setError("Este dispositivo não suporta GPS.");
    watchId.current = navigator.geolocation.watchPosition(
      (p) => {
        const pos = { lat: p.coords.latitude, lng: p.coords.longitude };
        setMe(pos);
        enqueue({ ...pos, speed: p.coords.speed, heading: p.coords.heading, accuracy: p.coords.accuracy, ts: p.timestamp });
        const target = jobsRef.current.find((j) => j.status === "a_caminho");
        setNearJob(target && isWithinGeofence(pos, target) ? target.id : null);
      },
      (e) => setError(e.code === 1 ? "Permissão de localização negada." : "Não foi possível obter o GPS."),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 },
    );
    try {
      wake.current = (await navigator.wakeLock?.request("screen")) ?? null;
    } catch {}
    setTracking(true);
  }

  async function stop() {
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
    await wake.current?.release().catch(() => {});
    await flush(send);
    setTracking(false);
  }

  useEffect(() => {
    const onVisible = async () => {
      if (document.visibilityState === "visible" && tracking) wake.current = (await navigator.wakeLock?.request("screen").catch(() => null)) ?? null;
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [tracking]);

  async function act(id: number, action: Action) {
    await fetch(`/api/installer/jobs/${id}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    load();
  }

  async function logout() {
    await stop();
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  const jobs = data?.jobs ?? [];
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-4 bg-slate-950 p-4 text-slate-100">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Olá, {data?.name ?? "..."}</h1>
        <button onClick={logout} className="text-xs text-slate-400">Sair</button>
      </header>

      {!tracking ? (
        <div className="rounded-xl border border-white/10 bg-slate-900 p-4 text-sm">
          <p className="text-slate-300">Ao iniciar o turno, sua localização será compartilhada com a gestão enquanto o app estiver aberto. O rastreio termina ao encerrar o turno ou sair.</p>
          <button onClick={start} className="mt-3 w-full rounded-lg bg-emerald-500 py-3 font-semibold text-slate-950">Aceitar e iniciar turno</button>
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">
          <span>GPS ativo{pending > 0 ? ` · ${pending} pendente(s)` : ""}</span>
          <button onClick={stop} className="rounded-lg bg-slate-800 px-3 py-1 text-xs">Encerrar turno</button>
        </div>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}

      <InstallerMap jobs={jobs} route={data?.route?.geometry ?? null} me={me} />

      <ul className="flex flex-col gap-3">
        {jobs.map((j) => (
          <li key={j.id} className="rounded-xl border border-white/10 bg-slate-900 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-medium">{j.stopOrder ? `${j.stopOrder}. ` : ""}{j.customer}</div>
                <div className="text-xs text-slate-400">{j.address}</div>
                <div className="text-xs text-slate-500">{j.type === "reparo" ? "Reparo" : "Instalação"}{j.phone ? ` · ${j.phone}` : ""}</div>
              </div>
              <span className="rounded-full px-2 py-0.5 text-xs font-medium text-slate-950" style={{ background: JOB_COLOR[j.status] }}>{JOB_LABEL[j.status]}</span>
            </div>
            {nearJob === j.id && j.status === "a_caminho" && <p className="mt-2 text-xs text-emerald-400">Você chegou ao local. Inicie o atendimento.</p>}
            <div className="mt-3 flex gap-2">
              {j.status === "pendente" && <Btn onClick={() => act(j.id, "a_caminho")}>Ir para cá</Btn>}
              {j.status === "a_caminho" && <Btn onClick={() => act(j.id, "iniciar")}>{j.arrivedAt ? "Iniciar atendimento" : "Cheguei e iniciar"}</Btn>}
              {j.status === "em_andamento" && <Btn onClick={() => act(j.id, "concluir")}>Concluir</Btn>}
              <a className="rounded-lg bg-slate-800 px-3 py-2 text-xs" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${j.lat},${j.lng}`}>Navegar</a>
            </div>
          </li>
        ))}
        {data && !jobs.length && <li className="text-sm text-slate-500">Nenhum serviço atribuído para hoje.</li>}
      </ul>
    </main>
  );
}

function Btn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return <button onClick={onClick} className="flex-1 rounded-lg bg-sky-500 py-2 text-sm font-medium text-slate-950">{children}</button>;
}
