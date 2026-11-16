import bcrypt from "bcryptjs";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { unauthorized } from "@/lib/auth";
import { requireRole } from "@/lib/session";

const body = z.object({ name: z.string().min(2), email: z.string().email(), password: z.string().min(6) });

export async function GET() {
  if (!(await requireRole("manager"))) return unauthorized();
  const team = await getDb()
    .select({ id: schema.users.id, name: schema.users.name, email: schema.users.email, active: schema.users.active })
    .from(schema.users)
    .where(eq(schema.users.role, "installer"))
    .orderBy(asc(schema.users.name));
  return Response.json({ team });
}

export async function POST(req: Request) {
  if (!(await requireRole("manager"))) return unauthorized();
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Informe nome, e-mail válido e senha (mín. 6 caracteres)" }, { status: 400 });
  const { name, email, password } = parsed.data;
  const [user] = await getDb()
    .insert(schema.users)
    .values({ name, email: email.toLowerCase(), passwordHash: await bcrypt.hash(password, 10), role: "installer" })
    .onConflictDoNothing()
    .returning({ id: schema.users.id });
  if (!user) return Response.json({ error: "E-mail já cadastrado" }, { status: 409 });
  return Response.json({ id: user.id });
}
