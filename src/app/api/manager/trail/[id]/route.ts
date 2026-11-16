import { and, asc, eq, gte } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { unauthorized } from "@/lib/auth";
import { requireRole } from "@/lib/session";

export async function GET(_req: Request, ctx: RouteContext<"/api/manager/trail/[id]">) {
  if (!(await requireRole("manager"))) return unauthorized();
  const id = Number((await ctx.params).id);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const rows = await getDb()
    .select({ lat: schema.locations.lat, lng: schema.locations.lng, ts: schema.locations.ts })
    .from(schema.locations)
    .where(and(eq(schema.locations.installerId, id), gte(schema.locations.ts, start)))
    .orderBy(asc(schema.locations.ts))
    .limit(5000);
  return Response.json({ points: rows });
}
