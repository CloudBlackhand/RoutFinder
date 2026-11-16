"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Brand, Status } from "@/components/ui";
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
  const done = jobs.filter((j) => j.status === "concluido").length;
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col">
      <header className="sticky top-0 z-10 flex h-12 items-center justify-between border-b border-line bg-panel px-4">
        <Brand />
        <button onClick={logout} className="btn btn-sm">Sair</button>
      </header>

      <div className="flex flex-col gap-4 p-4">
        <div className="flex items-end justify-between border-b border-line pb-3">
          <div>
            <div className="label">Rota de hoje</div>
            <h1 className="mt-1 text-lg font-semibold tracking-tight">{data?.name ?? "..."}</h1>
          </div>
          <span className="num text-xs text-mute">{done}/{jobs.length} concluídos</span>
        </div>

        {!tracking ? (
          <div className="panel p-4">
            <div className="label">Rastreamento</div>
            <p className="mt-2 text-[13px] leading-relaxed text-mute">Ao iniciar o turno, sua localização será compartilhada com a gestão enquanto o app estiver aberto. O rastreio termina ao encerrar o turno ou sair.</p>
            <button onClick={start} className="btn btn-primary mt-4 !h-11 w-full !text-sm">Aceitar e iniciar turno</button>
          </div>
        ) : (
          <div className="panel flex items-center justify-between border-l-2 !border-l-emerald-400 p-3">
            <span className="num flex items-center gap-2 text-[11px] uppercase tracking-wider">
              <span className="h-1.5 w-1.5 animate-pulse bg-emerald-400" />
              GPS ativo{pending > 0 ? ` · ${pending} na fila` : ""}
            </span>
            <button onClick={stop} className="btn btn-sm">Encerrar turno</button>
          </div>
        )}
        {error && <p className="border-l-2 border-red-500 pl-2 text-xs text-red-400">{error}</p>}

        <InstallerMap jobs={jobs} route={data?.route?.geometry ?? null} me={me} />

        <ul className="flex flex-col gap-3">
          {jobs.map((j) => (
            <li key={j.id} className={`panel ${j.status === "concluido" ? "opacity-60" : ""}`}>
              <div className="panel-head">
                <span className="label">Parada {j.stopOrder ? String(j.stopOrder).padStart(2, "0") : "--"} · {j.type === "reparo" ? "Reparo" : "Instalação"}</span>
                <Status color={JOB_COLOR[j.status]} label={JOB_LABEL[j.status]} />
              </div>
              <div className="p-3">
                <div className="text-[15px] font-medium">{j.customer}</div>
                <div className="mt-0.5 text-xs leading-snug text-mute">{j.address}</div>
                {j.phone && <a href={`tel:${j.phone}`} className="num mt-1 inline-block text-xs text-mute underline">{j.phone}</a>}
                {nearJob === j.id && j.status === "a_caminho" && <p className="mt-2 border-l-2 border-emerald-400 pl-2 text-xs text-emerald-400">Você chegou ao local. Inicie o atendimento.</p>}
                {j.status !== "concluido" && (
                  <div className="mt-3 flex gap-2">
                    {j.status === "pendente" && <Btn onClick={() => act(j.id, "a_caminho")}>Ir para cá</Btn>}
                    {j.status === "a_caminho" && <Btn onClick={() => act(j.id, "iniciar")}>{j.arrivedAt ? "Iniciar atendimento" : "Cheguei e iniciar"}</Btn>}
                    {j.status === "em_andamento" && <Btn onClick={() => act(j.id, "concluir")}>Concluir</Btn>}
                    <a className="btn !h-10" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${j.lat},${j.lng}`}>Navegar</a>
                  </div>
                )}
              </div>
            </li>
          ))}
          {data && !jobs.length && <li className="panel p-6 text-center text-dim">Nenhum serviço atribuído para hoje.</li>}
        </ul>
      </div>
    </main>
  );
}

function Btn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return <button onClick={onClick} className="btn btn-primary !h-10 flex-1">{children}</button>;
}
