"use client";

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MAP_STYLE } from "./Map3D";
import { JOB_COLOR, type JobStatus } from "@/lib/status";

type Job = { id: number; lat: number; lng: number; status: JobStatus; stopOrder: number | null };
type Props = { jobs: Job[]; route: [number, number][] | null; me: { lat: number; lng: number } | null };

export default function InstallerMap({ jobs, route, me }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const meMarker = useRef<maplibregl.Marker | null>(null);
  const loaded = useRef(false);
  const fitted = useRef(false);

  useEffect(() => {
    const m = new maplibregl.Map({ container: el.current!, style: MAP_STYLE, center: [-46.6333, -23.5505], zoom: 12, pitch: 50 });
    map.current = m;
    m.on("load", () => {
      m.addSource("route", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      m.addLayer({ id: "route", type: "line", source: "route", paint: { "line-color": "#38bdf8", "line-width": 5 } });
      loaded.current = true;
    });
    return () => m.remove();
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const apply = () => {
      markers.current.forEach((k) => k.remove());
      markers.current = jobs.map((j) => {
        const d = document.createElement("div");
        d.className = "flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-slate-900";
        d.style.background = JOB_COLOR[j.status];
        d.textContent = String(j.stopOrder ?? "•");
        return new maplibregl.Marker({ element: d }).setLngLat([j.lng, j.lat]).addTo(m);
      });
      (m.getSource("route") as maplibregl.GeoJSONSource | undefined)?.setData({
        type: "FeatureCollection",
        features: route ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: route } }] : [],
      });
      if (!fitted.current && jobs.length) {
        fitted.current = true;
        const b = new maplibregl.LngLatBounds();
        jobs.forEach((j) => b.extend([j.lng, j.lat]));
        m.fitBounds(b, { padding: 50, maxZoom: 15, duration: 0 });
      }
    };
    if (loaded.current) apply();
    else m.once("load", apply);
  }, [jobs, route]);

  useEffect(() => {
    const m = map.current;
    if (!m || !me) return;
    if (!meMarker.current) {
      const d = document.createElement("div");
      d.className = "h-4 w-4 rounded-full border-2 border-white bg-blue-500 shadow-[0_0_0_6px_rgba(59,130,246,.3)]";
      meMarker.current = new maplibregl.Marker({ element: d }).setLngLat([me.lng, me.lat]).addTo(m);
    } else meMarker.current.setLngLat([me.lng, me.lat]);
  }, [me]);

  return <div ref={el} className="h-64 w-full overflow-hidden rounded-xl" />;
}
