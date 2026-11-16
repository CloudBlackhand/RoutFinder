type Hit = { display_name: string; lat: string; lon: string };
export type Place = { label: string; lat: number; lng: number };

export async function geocode(q: string, limit = 5): Promise<Place[]> {
  const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=${limit}&countrycodes=br&q=${encodeURIComponent(q)}`, {
    headers: { "User-Agent": "Finder/1.0 (roteirizacao de instaladores)" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(String(res.status));
  const hits: Hit[] = await res.json();
  return hits.map((h) => ({ label: h.display_name, lat: Number(h.lat), lng: Number(h.lon) }));
}
