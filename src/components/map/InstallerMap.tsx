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
      m.addLayer({ id: "route", type: "line", source: "route", paint: { "line-color": "#7dd3fc", "line-width": 4 } });
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
        d.className = "flex h-6 w-6 items-center justify-center border border-bg font-mono text-[11px] font-semibold text-bg";
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
      d.className = "h-3.5 w-3.5 rotate-45 border-2 border-bg bg-fg shadow-[0_0_0_5px_rgba(237,237,240,.2)]";
      meMarker.current = new maplibregl.Marker({ element: d }).setLngLat([me.lng, me.lat]).addTo(m);
    } else meMarker.current.setLngLat([me.lng, me.lat]);
  }, [me]);

  return <div ref={el} className="h-64 w-full border border-line" />;
}
