import { openDB } from "idb";

export type QueuedPoint = { lat: number; lng: number; speed: number | null; heading: number | null; accuracy: number | null; ts: number };

const db = () => openDB("finder", 1, { upgrade: (d) => void d.createObjectStore("points", { autoIncrement: true }) });

export async function enqueue(p: QueuedPoint) {
  await (await db()).add("points", p);
}

/** Envia pontos pendentes em lote; só remove da fila se o servidor confirmar. */
export async function flush(send: (pts: QueuedPoint[]) => Promise<boolean>) {
  const d = await db();
  const keys = (await d.getAllKeys("points")).slice(0, 100);
  if (!keys.length) return { sent: 0, pending: 0 };
  const pts = (await Promise.all(keys.map((k) => d.get("points", k)))) as QueuedPoint[];
  if (!(await send(pts))) return { sent: 0, pending: await d.count("points") };
  const tx = d.transaction("points", "readwrite");
  await Promise.all(keys.map((k) => tx.store.delete(k)));
  await tx.done;
  return { sent: keys.length, pending: await d.count("points") };
}
