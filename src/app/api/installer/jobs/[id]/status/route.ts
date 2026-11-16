import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { unauthorized } from "@/lib/auth";
import { requireRole } from "@/lib/session";

const body = z.object({ action: z.enum(["a_caminho", "chegou", "iniciar", "concluir"]) });

export async function POST(req: Request, ctx: RouteContext<"/api/installer/jobs/[id]/status">) {
  const session = await requireRole("installer");
  if (!session) return unauthorized();
  const { id } = await ctx.params;
  const jobId = Number(id);
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !Number.isInteger(jobId)) return Response.json({ error: "Dados inválidos" }, { status: 400 });

  const now = new Date();
  const patches = {
    a_caminho: { status: "a_caminho" as const, startedRouteAt: now },
    chegou: { arrivedAt: now },
    iniciar: { status: "em_andamento" as const, startedAt: now },
    concluir: { status: "concluido" as const, finishedAt: now },
  };
  const db = getDb();
  const [row] = await db
    .update(schema.jobs)
    .set(patches[parsed.data.action])
    .where(and(eq(schema.jobs.id, jobId), eq(schema.jobs.installerId, session.uid)))
    .returning();
  if (!row) return Response.json({ error: "Job não encontrado" }, { status: 404 });
  if (parsed.data.action === "iniciar" && !row.arrivedAt) await db.update(schema.jobs).set({ arrivedAt: now }).where(eq(schema.jobs.id, jobId));
  return Response.json({ ok: true });
}
