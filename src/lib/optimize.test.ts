import { describe, expect, it } from "vitest";
import { isWithinGeofence } from "./geo";
import { assignJobs, haversineMatrix, optimizeOrder, tourCost } from "./optimize";

const P = (lat: number, lng: number) => ({ lat, lng });

describe("optimizeOrder", () => {
  it("ordena pontos em linha do mais perto ao mais longe", () => {
    const pts = [P(0, 0), P(0, 0.03), P(0, 0.01), P(0, 0.02)];
    expect(optimizeOrder(haversineMatrix(pts))).toEqual([2, 3, 1]);
  });
  it("não é pior que a ordem original", () => {
    const pts = [P(0, 0), P(0.05, 0.05), P(0.01, 0.0), P(0.04, 0.01), P(0.02, 0.04), P(0.03, 0.03)];
    const m = haversineMatrix(pts);
    expect(tourCost(optimizeOrder(m), m)).toBeLessThanOrEqual(tourCost([1, 2, 3, 4, 5], m));
  });
  it("retorna vazio sem paradas", () => {
    expect(optimizeOrder(haversineMatrix([P(0, 0)]))).toEqual([]);
  });
});

describe("assignJobs", () => {
  it("atribui ao instalador mais próximo e equilibra carga", () => {
    const res = assignJobs([P(0, 0), P(0, 0.001), P(1, 1), P(1, 1.001)], [P(0, 0), P(1, 1)]);
    expect(res).toEqual([0, 0, 1, 1]);
  });
});

describe("geofence", () => {
  it("detecta chegada em ~50m", () => {
    expect(isWithinGeofence(P(0, 0), P(0, 0.0003))).toBe(true);
    expect(isWithinGeofence(P(0, 0), P(0, 0.001))).toBe(false);
  });
});
