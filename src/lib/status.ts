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
  installers: { id: number; name: string }[];
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
