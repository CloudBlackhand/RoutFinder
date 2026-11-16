import { distanceM, type LatLng } from "./geo";
import { haversineMatrix, type Matrix } from "./optimize";

const BASE = process.env.OSRM_URL ?? "https://router.project-osrm.org";
const coords = (pts: LatLng[]) => pts.map((p) => `${p.lng},${p.lat}`).join(";");

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { signal: AbortSignal.timeout(8000), cache: "no-store" });
  if (!res.ok) throw new Error(`OSRM ${res.status}`);
  return res.json();
}

export async function durationMatrix(pts: LatLng[]): Promise<{ matrix: Matrix; fallback: boolean }> {
  try {
    const r = await get<{ code: string; durations: number[][] }>(`/table/v1/driving/${coords(pts)}?annotations=duration`);
    if (r.code !== "Ok") throw new Error(r.code);
    return { matrix: r.durations, fallback: false };
  } catch {
    return { matrix: haversineMatrix(pts), fallback: true };
  }
}

export type RouteResult = { geometry: [number, number][]; distanceM: number; durationS: number };

export async function routeThrough(pts: LatLng[]): Promise<RouteResult> {
  try {
    const r = await get<{ code: string; routes: { geometry: { coordinates: [number, number][] }; distance: number; duration: number }[] }>(
      `/route/v1/driving/${coords(pts)}?overview=full&geometries=geojson`,
    );
    if (r.code !== "Ok" || !r.routes[0]) throw new Error(r.code);
    const rt = r.routes[0];
    return { geometry: rt.geometry.coordinates, distanceM: rt.distance, durationS: rt.duration };
  } catch {
    let d = 0;
    for (let i = 1; i < pts.length; i++) d += distanceM(pts[i - 1], pts[i]);
    return { geometry: pts.map((p) => [p.lng, p.lat]), distanceM: d, durationS: d / 8 };
  }
}
