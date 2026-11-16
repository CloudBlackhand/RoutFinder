import { and, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { unauthorized } from "@/lib/auth";
import { requireRole } from "@/lib/session";
import { todayStr } from "@/lib/geo";
import { assignJobs, optimizeOrder } from "@/lib/optimize";
import { durationMatrix, routeThrough } from "@/lib/osrm";

const body = z.object({
  autoAssign: z.boolean().default(true),
  origins: z.record(z.string(), z.object({ lat: z.number(), lng: z.number() })).default({}),
});

export async function POST(req: Request) {
  if (!(await requireRole("manager"))) return unauthorized();
  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "Dados inválidos" }, { status: 400 });
  const db = getDb();
  const day = todayStr();

  const [installers, positions, pending] = await Promise.all([
    db.select({ id: schema.users.id }).from(schema.users).where(and(eq(schema.users.role, "installer"), eq(schema.users.active, true))),
    db.select().from(schema.livePositions),
    db
      .select({ id: schema.jobs.id, installerId: schema.jobs.installerId, lat: schema.customers.lat, lng: schema.customers.lng })
      .from(schema.jobs)
      .innerJoin(schema.customers, eq(schema.jobs.customerId, schema.customers.id))
      .where(and(eq(schema.jobs.day, day), eq(schema.jobs.status, "pendente"))),
  ]);
  if (!installers.length) return Response.json({ error: "Nenhum instalador cadastrado" }, { status: 400 });

  const origin = (id: number, fallback: { lat: number; lng: number }) =>
    parsed.data.origins[id] ?? positions.find((p) => p.installerId === id) ?? fallback;
  const center = pending.length ? { lat: pending[0].lat, lng: pending[0].lng } : { lat: 0, lng: 0 };
  const starts = installers.map((i) => origin(i.id, center));

  if (parsed.data.autoAssign) {
    const unassigned = pending.filter((j) => j.installerId == null);
    const idx = assignJobs(unassigned, starts);
    for (let k = 0; k < unassigned.length; k++) unassigned[k].installerId = installers[idx[k]].id;
    const ids = (n: number) => unassigned.filter((j) => j.installerId === installers[n].id).map((j) => j.id);
    await Promise.all(installers.map((inst, n) => (ids(n).length ? db.update(schema.jobs).set({ installerId: inst.id }).where(and(inArray(schema.jobs.id, ids(n)), isNull(schema.jobs.installerId))) : null)));
  }

  const summary: { installerId: number; stops: number; distanceM: number; durationS: number }[] = [];
  for (let n = 0; n < installers.length; n++) {
    const inst = installers[n];
    const mine = pending.filter((j) => j.installerId === inst.id);
    if (!mine.length) continue;
    const pts = [starts[n], ...mine];
    const { matrix } = await durationMatrix(pts);
    const order = optimizeOrder(matrix).map((i) => mine[i - 1]);
    const route = await routeThrough([starts[n], ...order]);
    await Promise.all(order.map((j, k) => db.update(schema.jobs).set({ stopOrder: k + 1 }).where(eq(schema.jobs.id, j.id))));
    const values = { geometry: route.geometry, distanceM: route.distanceM, durationS: route.durationS };
    await db.insert(schema.routes).values({ installerId: inst.id, day, ...values }).onConflictDoUpdate({ target: [schema.routes.installerId, schema.routes.day], set: values });
    summary.push({ installerId: inst.id, stops: order.length, distanceM: route.distanceM, durationS: route.durationS });
  }
  return Response.json({ ok: true, summary });
}
