export type JobStatus = "pendente" | "a_caminho" | "em_andamento" | "concluido";

export type LiveJob = {
  id: number;
  installerId: number | null;
  type: "instalacao" | "reparo";
  status: JobStatus;
  stopOrder: number | null;
  startedRouteAt: string | null;
  arrivedAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  customer: string;
  address: string;
  phone: string | null;
  lat: number;
  lng: number;
};
export type LivePosition = { installerId: number; lat: number; lng: number; speed: number | null; heading: number | null; ts: string };
export type LiveRoute = { installerId: number; geometry: [number, number][]; distanceM: number; durationS: number };
export type LiveData = {
  now: number;
  installers: { id: number; name: string; sim?: boolean }[];
  positions: LivePosition[];
  jobs: LiveJob[];
  routes: LiveRoute[];
};

export const JOB_COLOR: Record<JobStatus, string> = {
  pendente: "#eab308",
  a_caminho: "#38bdf8",
  em_andamento: "#f97316",
  concluido: "#22c55e",
};
export const JOB_LABEL: Record<JobStatus, string> = {
  pendente: "Pendente",
  a_caminho: "A caminho",
  em_andamento: "Em atendimento",
  concluido: "Concluído",
};

export const OFFLINE_AFTER_MS = 90_000;

export type InstallerState = "offline" | "atendendo" | "deslocando" | "parado";
export const STATE_COLOR: Record<InstallerState, string> = { offline: "#64748b", atendendo: "#f97316", deslocando: "#22c55e", parado: "#38bdf8" };
export const STATE_LABEL: Record<InstallerState, string> = { offline: "Offline", atendendo: "No cliente", deslocando: "Em deslocamento", parado: "Parado" };

export function installerState(pos: LivePosition | undefined, jobs: LiveJob[], now: number): InstallerState {
  if (!pos || now - new Date(pos.ts).getTime() > OFFLINE_AFTER_MS) return "offline";
  if (jobs.some((j) => j.status === "em_andamento")) return "atendendo";
  return (pos.speed ?? 0) > 1 ? "deslocando" : "parado";
}

export const fmtDuration = (ms: number) => {
  const m = Math.max(0, Math.round(ms / 60000));
  return m >= 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}` : `${m} min`;
};

export function jobStats(jobs: LiveJob[], now: number) {
  const done = jobs.filter((j) => j.status === "concluido" && j.startedAt && j.finishedAt);
  const avgService = done.length ? done.reduce((a, j) => a + (new Date(j.finishedAt!).getTime() - new Date(j.startedAt!).getTime()), 0) / done.length : 0;
  const travel = jobs.filter((j) => j.startedRouteAt && j.arrivedAt);
  const avgTravel = travel.length ? travel.reduce((a, j) => a + (new Date(j.arrivedAt!).getTime() - new Date(j.startedRouteAt!).getTime()), 0) / travel.length : 0;
  return { total: jobs.length, done: done.length, active: jobs.filter((j) => j.status === "em_andamento").length, avgService, avgTravel, now };
}

export type Activity = { ts: number; text: string; color: string; jobId: number };

/** Linha do tempo do dia, derivada dos horários registrados em cada serviço. */
export function activity(data: LiveData, limit = 40): Activity[] {
  const name = (id: number | null) => data.installers.find((i) => i.id === id)?.name.split(" ")[0] ?? "Instalador";
  const out: Activity[] = [];
  for (const j of data.jobs) {
    const add = (t: string | null, text: string, color: string) => t && out.push({ ts: new Date(t).getTime(), text, color, jobId: j.id });
    add(j.startedRouteAt, `${name(j.installerId)} saiu para ${j.customer}`, JOB_COLOR.a_caminho);
    add(j.arrivedAt, `${name(j.installerId)} chegou em ${j.customer}`, JOB_COLOR.pendente);
    add(j.startedAt, `${name(j.installerId)} iniciou ${j.type === "reparo" ? "reparo" : "instalação"} em ${j.customer}`, JOB_COLOR.em_andamento);
    add(j.finishedAt, `${name(j.installerId)} concluiu ${j.customer}`, JOB_COLOR.concluido);
  }
  return out.sort((a, b) => b.ts - a.ts).slice(0, limit);
}

export const fmtClock = (ts: number | string) => new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
