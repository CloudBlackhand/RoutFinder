import { unauthorized } from "@/lib/auth";
import { requireRole } from "@/lib/session";

type Hit = { display_name: string; lat: string; lon: string };

export async function GET(req: Request) {
  if (!(await requireRole("manager"))) return unauthorized();
  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q || q.length < 4) return Response.json({ results: [] });
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=br&q=${encodeURIComponent(q)}`, {
      headers: { "User-Agent": "Finder/1.0 (roteirizacao de instaladores)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(String(res.status));
    const hits: Hit[] = await res.json();
    return Response.json({ results: hits.map((h) => ({ label: h.display_name, lat: Number(h.lat), lng: Number(h.lon) })) });
  } catch {
    return Response.json({ error: "Busca de endereço indisponível, tente novamente" }, { status: 502 });
  }
}
