"use client";

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { FinderLayer, type Picked } from "./FinderLayer";
import { JOB_COLOR, STATE_COLOR, STATE_LABEL, installerState, type LiveData } from "@/lib/status";

maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

export const MAP_STYLE = "https://tiles.openfreemap.org/styles/dark";

type Props = { data: LiveData | null; selected: Picked; onSelect: (p: Picked) => void; trail: [number, number][]; focus: [number, number] | null };

const line = (coords: [number, number][]) => ({ type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: coords } });
const lines = (rs: [number, number][][]) => ({ type: "FeatureCollection" as const, features: rs.map(line) });

export default function Map3D({ data, selected, onSelect, trail, focus }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const layer = useRef<FinderLayer | null>(null);
  const ready = useRef(false);
  const labels = useRef(new Map<number, { marker: maplibregl.Marker; el: HTMLDivElement }>());
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
      const firstSymbol = m.getStyle().layers.find((l) => l.type === "symbol")?.id;
      m.addLayer(
        {
          id: "buildings-3d",
          type: "fill-extrusion",
          source: "openmaptiles",
          "source-layer": "building",
          minzoom: 13.5,
          paint: {
            "fill-extrusion-color": "#2b2b31",
            "fill-extrusion-height": ["coalesce", ["get", "render_height"], 8],
            "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
            "fill-extrusion-opacity": 0.9,
          },
        },
        firstSymbol,
      );
      m.addSource("routes", { type: "geojson", data: lines([]) });
      m.addSource("trail", { type: "geojson", data: lines([]) });
      m.addLayer({ id: "routes", type: "line", source: "routes", paint: { "line-color": "#7dd3fc", "line-width": 3, "line-opacity": 0.85, "line-dasharray": [2, 1.5] } });
      m.addLayer({ id: "trail", type: "line", source: "trail", paint: { "line-color": "#34d399", "line-width": 4, "line-opacity": 0.95 } });
      m.on("click", (e) => onSelectRef.current(layer.current?.pick(e.point.x, e.point.y) ?? null));
      m.on("render", updateLabels);
      ready.current = true;
      sync();
    });
    const labelMap = labels.current;
    return () => {
      ready.current = false;
      labelMap.clear();
      m.remove();
    };
  }, []);

  function updateLabels() {
    const m = map.current;
    const d = latest.current.data;
    if (!m || !layer.current || !d) return;
    const seen = new Set<number>();
    for (const p of layer.current.getPositions()) {
      seen.add(p.id);
      const pos = d.positions.find((x) => x.installerId === p.id);
      const state = installerState(pos, d.jobs.filter((j) => j.installerId === p.id), d.now);
      let l = labels.current.get(p.id);
      if (!l) {
        const el = document.createElement("div");
        el.className = "pointer-events-none flex items-center gap-1.5 whitespace-nowrap border border-line bg-panel/95 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-fg";
        l = { el, marker: new maplibregl.Marker({ element: el, anchor: "bottom", offset: [0, -30] }).setLngLat([p.lng, p.lat]).addTo(m) };
        labels.current.set(p.id, l);
      }
      l.marker.setLngLat([p.lng, p.lat]);
      const html = `<span style="background:${STATE_COLOR[state]}" class="h-1.5 w-1.5"></span>${p.name} / ${STATE_LABEL[state]}`;
      if (l.el.dataset.h !== html) {
        l.el.dataset.h = html;
        l.el.innerHTML = html;
      }
    }
    for (const [id, l] of labels.current) {
      if (seen.has(id)) continue;
      l.marker.remove();
      labels.current.delete(id);
    }
  }

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
        name: d.installers.find((i) => i.id === p.installerId)?.name ?? "",
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
