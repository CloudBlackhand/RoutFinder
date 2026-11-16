"use client";

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { FinderLayer, type Picked } from "./FinderLayer";
import { JOB_COLOR, STATE_COLOR, installerState, type LiveData } from "@/lib/status";

maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

export const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";

type Props = { data: LiveData | null; selected: Picked; onSelect: (p: Picked) => void; trail: [number, number][]; focus: [number, number] | null };

const line = (coords: [number, number][]) => ({ type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: coords } });
const lines = (rs: [number, number][][]) => ({ type: "FeatureCollection" as const, features: rs.map(line) });

export default function Map3D({ data, selected, onSelect, trail, focus }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const layer = useRef<FinderLayer | null>(null);
  const ready = useRef(false);
  const fitted = useRef(false);
  const onSelectRef = useRef(onSelect);
  const latest = useRef({ data, trail });
  useEffect(() => {
    onSelectRef.current = onSelect;
    latest.current = { data, trail };
  });

  useEffect(() => {
    const m = new maplibregl.Map({ container: el.current!, style: MAP_STYLE, center: [-46.6333, -23.5505], zoom: 12.5, pitch: 60, bearing: -20, maxPitch: 80 });
    map.current = m;
    m.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    m.on("load", () => {
      m.addSource("routes", { type: "geojson", data: lines([]) });
      m.addSource("trail", { type: "geojson", data: lines([]) });
      m.addLayer({ id: "routes", type: "line", source: "routes", paint: { "line-color": "#38bdf8", "line-width": 4, "line-opacity": 0.8, "line-dasharray": [2, 1] } });
      m.addLayer({ id: "trail", type: "line", source: "trail", paint: { "line-color": "#22c55e", "line-width": 5, "line-opacity": 0.9 } });
      m.on("click", (e) => onSelectRef.current(layer.current?.pick(e.point.x, e.point.y) ?? null));
      ready.current = true;
      sync();
    });
    return () => {
      ready.current = false;
      m.remove();
    };
  }, []);

  function sync() {
    const m = map.current;
    const { data: d, trail: t } = latest.current;
    if (!ready.current || !m || !d) return;
    if (!layer.current) {
      const pts = [...d.jobs, ...d.positions];
      const origin = pts.length ? { lat: pts.reduce((a, p) => a + p.lat, 0) / pts.length, lng: pts.reduce((a, p) => a + p.lng, 0) / pts.length } : { lat: -23.5505, lng: -46.6333 };
      layer.current = new FinderLayer(origin);
      m.addLayer(layer.current);
    }
    const l = layer.current;
    l.setInstallers(
      d.positions.map((p) => ({
        id: p.installerId,
        lat: p.lat,
        lng: p.lng,
        heading: p.heading ?? 0,
        color: STATE_COLOR[installerState(p, d.jobs.filter((j) => j.installerId === p.installerId), d.now)],
      })),
    );
    l.setJobs(d.jobs.map((j) => ({ id: j.id, lat: j.lat, lng: j.lng, color: JOB_COLOR[j.status] })));
    (m.getSource("routes") as maplibregl.GeoJSONSource).setData(lines(d.routes.map((r) => r.geometry)));
    (m.getSource("trail") as maplibregl.GeoJSONSource).setData(lines(t.length > 1 ? [t] : []));
    if (!fitted.current && (d.jobs.length || d.positions.length)) {
      fitted.current = true;
      const b = new maplibregl.LngLatBounds();
      d.jobs.forEach((j) => b.extend([j.lng, j.lat]));
      d.positions.forEach((p) => b.extend([p.lng, p.lat]));
      m.fitBounds(b, { padding: 80, pitch: 60, maxZoom: 15, duration: 1200 });
    }
  }

  useEffect(sync, [data, trail]);
  useEffect(() => layer.current?.select(selected), [selected]);
  useEffect(() => {
    if (focus) map.current?.flyTo({ center: focus, zoom: Math.max(map.current.getZoom(), 15.5), pitch: 65, duration: 1000 });
  }, [focus]);

  return (
    <div className="absolute inset-0">
      <div ref={el} className="h-full w-full" />
    </div>
  );
}
