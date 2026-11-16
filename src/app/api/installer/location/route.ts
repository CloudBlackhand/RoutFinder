import { and, eq, lt } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { unauthorized } from "@/lib/auth";
import { requireRole } from "@/lib/session";
import { isWithinGeofence, todayStr } from "@/lib/geo";

const point = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  speed: z.number().nullish(),
  heading: z.number().nullish(),
  accuracy: z.number().nullish(),
  ts: z.number(),
});
const body = z.object({ points: z.array(point).min(1).max(200) });

export async function POST(req: Request) {
  const session = await requireRole("installer");
  if (!session) return unauthorized();
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Dados inválidos" }, { status: 400 });
  const db = getDb();
  const pts = parsed.data.points.sort((a, b) => a.ts - b.ts);
  const last = pts[pts.length - 1];

  await db.insert(schema.locations).values(
    pts.map((p) => ({ installerId: session.uid, lat: p.lat, lng: p.lng, speed: p.speed ?? null, heading: p.heading ?? null, accuracy: p.accuracy ?? null, ts: new Date(p.ts) })),
  );
  const live = { lat: last.lat, lng: last.lng, speed: last.speed ?? null, heading: last.heading ?? null, ts: new Date(last.ts) };
  await db.insert(schema.livePositions).values({ installerId: session.uid, ...live }).onConflictDoUpdate({ target: schema.livePositions.installerId, set: live });

  const [job] = await db
    .select({ id: schema.jobs.id, lat: schema.customers.lat, lng: schema.customers.lng, arrivedAt: schema.jobs.arrivedAt, status: schema.jobs.status })
    .from(schema.jobs)
    .innerJoin(schema.customers, eq(schema.jobs.customerId, schema.customers.id))
    .where(and(eq(schema.jobs.installerId, session.uid), eq(schema.jobs.day, todayStr()), eq(schema.jobs.status, "a_caminho")))
    .orderBy(schema.jobs.stopOrder)
    .limit(1);
  let arrivedJobId: number | null = null;
  if (job && !job.arrivedAt && isWithinGeofence(last, job)) {
    await db.update(schema.jobs).set({ arrivedAt: new Date(last.ts) }).where(eq(schema.jobs.id, job.id));
    arrivedJobId = job.id;
  }

  if (Math.random() < 0.01) await db.delete(schema.locations).where(lt(schema.locations.ts, new Date(Date.now() - 30 * 864e5)));
  return Response.json({ ok: true, arrivedJobId });
}

