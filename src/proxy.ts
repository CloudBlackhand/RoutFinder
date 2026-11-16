import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, verifySession } from "@/lib/auth";

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = await verifySession(req.cookies.get(COOKIE)?.value);
  const area = pathname.startsWith("/manager") ? "manager" : "installer";
  if (!session) return NextResponse.redirect(new URL("/login", req.url));
  if (session.role !== area) return NextResponse.redirect(new URL(`/${session.role}`, req.url));
  return NextResponse.next();
}

export const config = { matcher: ["/manager/:path*", "/installer/:path*"] };
