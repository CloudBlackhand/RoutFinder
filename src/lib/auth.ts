import { jwtVerify, SignJWT } from "jose";

export type Session = { uid: number; role: "manager" | "installer"; name: string };
export const COOKIE = "finder_session";

const key = () => {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 16) throw new Error("JWT_SECRET ausente ou curto (mín. 16 caracteres)");
  return new TextEncoder().encode(s);
};

export const signSession = (s: Session) =>
  new SignJWT({ ...s }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("12h").sign(key());

export async function verifySession(token?: string): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    return { uid: payload.uid as number, role: payload.role as Session["role"], name: payload.name as string };
  } catch {
    return null;
  }
}

export const unauthorized = () => Response.json({ error: "Não autorizado" }, { status: 401 });
