import { distanceM, type LatLng } from "./geo";

export type Matrix = number[][];

export function haversineMatrix(points: LatLng[]): Matrix {
  return points.map((a) => points.map((b) => distanceM(a, b)));
}

export function tourCost(order: number[], m: Matrix, start = 0) {
  let cost = 0;
  let prev = start;
  for (const i of order) {
    cost += m[prev][i];
    prev = i;
  }
  return cost;
}

/**
 * Ordena paradas (índices >=1) partindo do ponto 0 (posição atual do instalador).
 * Vizinho mais próximo + 2-opt (caminho aberto).
 */
export function optimizeOrder(m: Matrix): number[] {
  const n = m.length;
  if (n <= 1) return [];
  const left = new Set(Array.from({ length: n - 1 }, (_, i) => i + 1));
  let order: number[] = [];
  let cur = 0;
  while (left.size) {
    let best = -1;
    for (const i of left) if (best < 0 || m[cur][i] < m[cur][best]) best = i;
    order.push(best);
    left.delete(best);
    cur = best;
  }
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < order.length - 1; i++) {
      for (let j = i + 1; j < order.length; j++) {
        const cand = [...order.slice(0, i), ...order.slice(i, j + 1).reverse(), ...order.slice(j + 1)];
        if (tourCost(cand, m) < tourCost(order, m) - 1e-6) {
          order = cand;
          improved = true;
        }
      }
    }
  }
  return order;
}

/** Atribuição gulosa: cada job vai para o instalador mais próximo, equilibrando carga. */
export function assignJobs(jobs: LatLng[], installers: LatLng[], maxPerInstaller = Math.ceil(jobs.length / Math.max(installers.length, 1))): number[] {
  const load = installers.map(() => 0);
  return jobs.map((j) => {
    let best = -1;
    installers.forEach((p, k) => {
      if (load[k] >= maxPerInstaller) return;
      if (best < 0 || distanceM(j, p) < distanceM(j, installers[best])) best = k;
    });
    if (best < 0) best = load.indexOf(Math.min(...load));
    load[best]++;
    return best;
  });
}
