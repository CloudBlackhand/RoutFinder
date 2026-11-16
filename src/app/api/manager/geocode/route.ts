import { unauthorized } from "@/lib/auth";
import { geocode } from "@/lib/geocode";
import { requireRole } from "@/lib/session";

export async function GET(req: Request) {
  if (!(await requireRole("manager"))) return unauthorized();
  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q || q.length < 4) return Response.json({ results: [] });
  try {
    return Response.json({ results: await geocode(q) });
  } catch {
    return Response.json({ error: "Busca de endereço indisponível, tente novamente" }, { status: 502 });
  }
}
