import { distance, point } from "@turf/turf";

export type LatLng = { lat: number; lng: number };

export const distanceM = (a: LatLng, b: LatLng) =>
  distance(point([a.lng, a.lat]), point([b.lng, b.lat]), { units: "meters" });

export const ARRIVAL_RADIUS_M = 50;

export const isWithinGeofence = (pos: LatLng, target: LatLng, radius = ARRIVAL_RADIUS_M) =>
  distanceM(pos, target) <= radius;

export const todayStr = () => new Date().toISOString().slice(0, 10);
