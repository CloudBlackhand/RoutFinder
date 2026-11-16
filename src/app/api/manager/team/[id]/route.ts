import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { unauthorized } from "@/lib/auth";
import { requireRole } from "@/lib/session";

const body = z.object({ name: z.string().min(2).optional(), active: z.boolean().optional(), password: z.string().min(6).optional() });

export async function PATCH(req: Request, ctx: RouteContext<"/api/manager/team/[id]">) {
  if (!(await requireRole("manager"))) return unauthorized();
  const id = Number((await ctx.params).id);
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !Number.isInteger(id)) return Response.json({ error: "Dados inválidos" }, { status: 400 });
  const { password, ...rest } = parsed.data;
  const set = { ...rest, ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}) };
  if (!Object.keys(set).length) return Response.json({ error: "Nada para atualizar" }, { status: 400 });
  const db = getDb();
  const [row] = await db.update(schema.users).set(set).where(and(eq(schema.users.id, id), eq(schema.users.role, "installer"))).returning({ id: schema.users.id });
  if (!row) return Response.json({ error: "Instalador não encontrado" }, { status: 404 });
  if (rest.active === false) await db.update(schema.jobs).set({ installerId: null, stopOrder: null }).where(and(eq(schema.jobs.installerId, id), eq(schema.jobs.status, "pendente")));
  return Response.json({ ok: true });
}
