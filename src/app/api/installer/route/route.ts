import { and, asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { unauthorized } from "@/lib/auth";
import { requireRole } from "@/lib/session";
import { todayStr } from "@/lib/geo";

export async function GET() {
  const session = await requireRole("installer");
  if (!session) return unauthorized();
  const db = getDb();
  const day = todayStr();
  const jobs = await db
    .select({
      id: schema.jobs.id,
      type: schema.jobs.type,
      status: schema.jobs.status,
      stopOrder: schema.jobs.stopOrder,
      arrivedAt: schema.jobs.arrivedAt,
      customer: schema.customers.name,
      address: schema.customers.address,
      phone: schema.customers.phone,
      lat: schema.customers.lat,
      lng: schema.customers.lng,
    })
    .from(schema.jobs)
    .innerJoin(schema.customers, eq(schema.jobs.customerId, schema.customers.id))
    .where(and(eq(schema.jobs.installerId, session.uid), eq(schema.jobs.day, day)))
    .orderBy(asc(schema.jobs.stopOrder));
  const [route] = await db.select().from(schema.routes).where(and(eq(schema.routes.installerId, session.uid), eq(schema.routes.day, day)));
  return Response.json({ name: session.name, jobs, route: route ?? null });
}
