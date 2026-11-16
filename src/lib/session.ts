import { cookies } from "next/headers";
import { COOKIE, verifySession, type Session } from "./auth";

export const getSession = async () => verifySession((await cookies()).get(COOKIE)?.value);

export async function requireRole(role: Session["role"]) {
  const s = await getSession();
  return s && s.role === role ? s : null;
}
