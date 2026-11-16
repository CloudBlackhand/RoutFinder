import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { unauthorized } from "@/lib/auth";
import { requireRole } from "@/lib/session";

const body = z.object({ installerId: z.number().int().nullable().optional(), type: z.enum(["instalacao", "reparo"]).optional() });

export async function PATCH(req: Request, ctx: RouteContext<"/api/manager/jobs/[id]">) {
  if (!(await requireRole("manager"))) return unauthorized();
  const id = Number((await ctx.params).id);
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !Number.isInteger(id)) return Response.json({ error: "Dados inválidos" }, { status: 400 });
  const set = { ...parsed.data, ...("installerId" in parsed.data ? { stopOrder: null } : {}) };
  if (!Object.keys(set).length) return Response.json({ error: "Nada para atualizar" }, { status: 400 });
  const [row] = await getDb().update(schema.jobs).set(set).where(eq(schema.jobs.id, id)).returning({ id: schema.jobs.id });
  return row ? Response.json({ ok: true }) : Response.json({ error: "Serviço não encontrado" }, { status: 404 });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/manager/jobs/[id]">) {
  if (!(await requireRole("manager"))) return unauthorized();
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return Response.json({ error: "Dados inválidos" }, { status: 400 });
  await getDb().delete(schema.jobs).where(eq(schema.jobs.id, id));
  return Response.json({ ok: true });
}
