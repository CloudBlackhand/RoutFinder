import { z } from "zod";
import { getDb, schema } from "@/db";
import { unauthorized } from "@/lib/auth";
import { requireRole } from "@/lib/session";
import { todayStr } from "@/lib/geo";

const body = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  phone: z.string().optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  type: z.enum(["instalacao", "reparo"]).default("instalacao"),
  installerId: z.number().int().optional(),
});

export async function POST(req: Request) {
  if (!(await requireRole("manager"))) return unauthorized();
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Dados inválidos" }, { status: 400 });
  const { type, installerId, ...c } = parsed.data;
  const db = getDb();
  const [customer] = await db.insert(schema.customers).values(c).returning();
  const [job] = await db.insert(schema.jobs).values({ customerId: customer.id, type, installerId, day: todayStr() }).returning();
  return Response.json({ job });
}
