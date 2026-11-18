import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { unauthorized } from "@/lib/auth";
import { requireRole } from "@/lib/session";
import { todayStr } from "@/lib/geo";
import { tickSim } from "@/lib/sim";

export async function GET() {
  if (!(await requireRole("manager"))) return unauthorized();
  const db = getDb();
  const day = todayStr();
  await tickSim(db);
  const [installers, positions, jobs, routes, sims] = await Promise.all([
    db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users).where(and(eq(schema.users.role, "installer"), eq(schema.users.active, true))),
    db.select().from(schema.livePositions),
    db
      .select({
        id: schema.jobs.id,
        installerId: schema.jobs.installerId,
        type: schema.jobs.type,
        status: schema.jobs.status,
        stopOrder: schema.jobs.stopOrder,
        startedRouteAt: schema.jobs.startedRouteAt,
        arrivedAt: schema.jobs.arrivedAt,
        startedAt: schema.jobs.startedAt,
        finishedAt: schema.jobs.finishedAt,
        customer: schema.customers.name,
        address: schema.customers.address,
        phone: schema.customers.phone,
        lat: schema.customers.lat,
        lng: schema.customers.lng,
      })
      .from(schema.jobs)
      .innerJoin(schema.customers, eq(schema.jobs.customerId, schema.customers.id))
      .where(eq(schema.jobs.day, day)),
    db.select().from(schema.routes).where(eq(schema.routes.day, day)),
    db.select({ installerId: schema.simAgents.installerId }).from(schema.simAgents),
  ]);
  return Response.json({ now: Date.now(), installers: installers.map((i) => ({ ...i, sim: sims.some((x) => x.installerId === i.id) })), positions, jobs, routes });
}
