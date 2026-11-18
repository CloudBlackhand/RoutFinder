import { and, eq, lt, ne } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { distanceM, todayStr } from "./geo";
import { routeThrough } from "./osrm";

type Db = ReturnType<typeof getDb>;
type Point = [number, number];
type Job = { id: number; installerId: number | null; status: string; stopOrder: number | null; lat: number; lng: number };

const SPEED_MPS = 8;
const STEP_MS = 30_000;
const LOG_MS = 30_000;
const SERVICE_MS: [number, number] = [8 * 60_000, 19 * 60_000];
const ARRIVE_M = 60;

const seg = (a: Point, b: Point) => distanceM({ lat: a[1], lng: a[0] }, { lat: b[1], lng: b[0] });

function pointOnPath(path: Point[], m: number): Point {
  let left = m;
  for (let i = 1; i < path.length; i++) {
    const len = seg(path[i - 1], path[i]);
    if (left <= len) {
      const t = len ? left / len : 1;
      return [path[i - 1][0] + (path[i][0] - path[i - 1][0]) * t, path[i - 1][1] + (path[i][1] - path[i - 1][1]) * t];
    }
    left -= len;
  }
  return path[path.length - 1];
}

export async function tickSim(db: Db, now = new Date()) {
  const day = todayStr();
  await db.update(schema.jobs).set({ day, status: "pendente" }).where(and(ne(schema.jobs.status, "concluido"), lt(schema.jobs.day, day)));
  const [agents, jobs] = await Promise.all([
    db.select().from(schema.simAgents),
    db
      .select({ id: schema.jobs.id, installerId: schema.jobs.installerId, status: schema.jobs.status, stopOrder: schema.jobs.stopOrder, lat: schema.customers.lat, lng: schema.customers.lng })
      .from(schema.jobs)
      .innerJoin(schema.customers, eq(schema.customers.id, schema.jobs.customerId))
      .where(eq(schema.jobs.day, day)),
  ]);
  const byId = new Map(jobs.map((j) => [j.id, j]));
  const order = (a: Job, b: Job) => (a.stopOrder ?? 99) - (b.stopOrder ?? 99) || a.id - b.id;
  const pending = async (id: number) => {
    const mine = jobs.filter((j) => j.installerId === id && j.status === "pendente").sort(order)[0];
    if (mine) return mine;
    const free = jobs.filter((j) => j.installerId == null && j.status === "pendente").sort(order)[0];
    if (!free) return null;
    await db.update(schema.jobs).set({ installerId: id }).where(eq(schema.jobs.id, free.id));
    free.installerId = id;
    return free;
  };

  for (const a of agents) {
    let { lat, lng, phase, targetJobId, path, pathM, serviceUntil } = a;
    let t = +a.lastTick > +new Date(`${day}T06:00:00Z`) ? +a.lastTick : +new Date(`${day}T06:00:00Z`);
    let lastLog = a.lastLog ? +a.lastLog : 0;
    const end = +now;

    while (t < end) {
      t = Math.min(t + STEP_MS, end);
      const at = new Date(t);
      let speed = 0;

      if (phase === "driving") {
        const job = targetJobId != null ? byId.get(targetJobId) : undefined;
        if (!job || (job.status !== "a_caminho" && job.status !== "em_andamento")) {
          phase = "idle";
          targetJobId = null;
          path = null;
        } else {
          pathM += SPEED_MPS * (STEP_MS / 1000);
          [lng, lat] = pointOnPath(path!, pathM);
          speed = SPEED_MPS;
          if (distanceM({ lat, lng }, job) <= ARRIVE_M) {
            lat = job.lat;
            lng = job.lng;
            speed = 0;
            phase = "service";
            serviceUntil = new Date(t + SERVICE_MS[0] + Math.random() * (SERVICE_MS[1] - SERVICE_MS[0]));
            job.status = "em_andamento";
            await db.update(schema.jobs).set({ status: "em_andamento", arrivedAt: at, startedAt: at }).where(eq(schema.jobs.id, job.id));
          }
        }
      }

      if (phase === "service" && t >= +serviceUntil!) {
        const job = byId.get(targetJobId!);
        if (job) job.status = "concluido";
        await db.update(schema.jobs).set({ status: "concluido", finishedAt: at }).where(eq(schema.jobs.id, targetJobId!));
        phase = "idle";
        targetJobId = null;
        serviceUntil = null;
      }

      if (phase === "idle") {
        const job = await pending(a.installerId);
        if (job) {
          const r = await routeThrough([{ lat, lng }, job]);
          path = r.geometry;
          pathM = 0;
          targetJobId = job.id;
          phase = "driving";
          job.status = "a_caminho";
          await db.update(schema.jobs).set({ status: "a_caminho", startedRouteAt: at }).where(eq(schema.jobs.id, job.id));
        }
      }

      if (t - lastLog > LOG_MS) {
        await db.insert(schema.locations).values({ installerId: a.installerId, lat, lng, speed, heading: null, accuracy: 8, ts: at });
        lastLog = t;
      }
    }

    const speed = phase === "driving" ? SPEED_MPS : 0;
    await db
      .insert(schema.livePositions)
      .values({ installerId: a.installerId, lat, lng, speed, heading: null, ts: now })
      .onConflictDoUpdate({ target: schema.livePositions.installerId, set: { lat, lng, speed, ts: now } });
    await db
      .update(schema.simAgents)
      .set({ lat, lng, phase, targetJobId, path, pathM, serviceUntil, lastTick: now, lastLog: lastLog ? new Date(lastLog) : null })
      .where(eq(schema.simAgents.installerId, a.installerId));
  }
}
