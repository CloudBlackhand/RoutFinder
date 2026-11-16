import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { COOKIE, signSession } from "@/lib/auth";

const body = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Dados inválidos" }, { status: 400 });
  const [user] = await getDb().select().from(schema.users).where(eq(schema.users.email, parsed.data.email.toLowerCase()));
  if (!user || !user.active || !(await bcrypt.compare(parsed.data.password, user.passwordHash)))
    return Response.json({ error: "E-mail ou senha incorretos" }, { status: 401 });
  const token = await signSession({ uid: user.id, role: user.role, name: user.name });
  const res = Response.json({ role: user.role });
  res.headers.append("Set-Cookie", `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
  return res;
}
