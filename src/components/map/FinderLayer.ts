import * as THREE from "three";
import { MercatorCoordinate, type CustomLayerInterface, type Map as MlMap } from "maplibre-gl";

export type InstallerView = { id: number; lat: number; lng: number; heading: number; color: string };
export type JobView = { id: number; lat: number; lng: number; color: string };
export type Picked = { kind: "installer" | "job"; id: number } | null;

type Ent = { group: THREE.Group; target: THREE.Vector3; cur: THREE.Vector3; heading: number; curHeading: number };

const toLocal = (lat: number, lng: number, o: { lat: number; lng: number }) => {
  const mpDegLat = 111_320;
  return new THREE.Vector3((lng - o.lng) * mpDegLat * Math.cos((o.lat * Math.PI) / 180), (lat - o.lat) * mpDegLat, 0);
};

function makeVan(color: string) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(18, 36, 16), mat);
  body.position.z = 12;
  const cab = new THREE.Mesh(new THREE.BoxGeometry(17, 12, 11), new THREE.MeshStandardMaterial({ color: "#e2e8f0" }));
  cab.position.set(0, 22, 9.5);
  const ring = new THREE.Mesh(new THREE.RingGeometry(28, 34, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
  ring.position.z = 0.5;
  g.add(body, cab, ring);
  g.userData.mat = mat;
  g.userData.ring = ring;
  return g;
}

function makePin(color: string) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.4 });
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 50, 12), mat);
  stick.rotation.x = Math.PI / 2;
  stick.position.z = 25;
  const head = new THREE.Mesh(new THREE.SphereGeometry(15, 20, 16), mat);
  head.position.z = 62;
  g.add(stick, head);
  g.userData.mat = mat;
  return g;
}

export class FinderLayer implements CustomLayerInterface {
  id = "finder-3d";
  type = "custom" as const;
  renderingMode = "3d" as const;
  private map!: MlMap;
  private renderer!: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.Camera();
  private raycaster = new THREE.Raycaster();
  private origin: { lat: number; lng: number };
  private installers = new Map<number, Ent>();
  private jobs = new Map<number, THREE.Group>();
  private selected: Picked = null;
  private last = performance.now();
  private pulse = 0;

  constructor(origin: { lat: number; lng: number }) {
    this.origin = origin;
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.4));
    const sun = new THREE.DirectionalLight(0xffffff, 2);
    sun.position.set(-80, -120, 200);
    this.scene.add(sun);
  }

  onAdd(map: MlMap, gl: WebGL2RenderingContext) {
    this.map = map;
    this.renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
    this.renderer.autoClear = false;
  }

  onRemove() {
    this.renderer?.dispose();
  }

  setInstallers(list: InstallerView[]) {
    const ids = new Set(list.map((i) => i.id));
    for (const [id, e] of this.installers) {
      if (ids.has(id)) continue;
      this.scene.remove(e.group);
      this.installers.delete(id);
    }
    for (const i of list) {
      const p = toLocal(i.lat, i.lng, this.origin);
      let e = this.installers.get(i.id);
      if (!e) {
        const group = makeVan(i.color);
        group.userData = { ...group.userData, kind: "installer", id: i.id };
        group.position.copy(p);
        this.scene.add(group);
        e = { group, target: p.clone(), cur: p.clone(), heading: i.heading, curHeading: i.heading };
        this.installers.set(i.id, e);
      }
      e.target.copy(p);
      e.heading = i.heading;
      (e.group.userData.mat as THREE.MeshStandardMaterial).color.set(i.color);
      ((e.group.userData.ring as THREE.Mesh).material as THREE.MeshBasicMaterial).color.set(i.color);
    }
    this.map?.triggerRepaint();
  }

  setJobs(list: JobView[]) {
    const ids = new Set(list.map((j) => j.id));
    for (const [id, g] of this.jobs) {
      if (ids.has(id)) continue;
      this.scene.remove(g);
      this.jobs.delete(id);
    }
    for (const j of list) {
      let g = this.jobs.get(j.id);
      if (!g) {
        g = makePin(j.color);
        g.userData = { ...g.userData, kind: "job", id: j.id };
        g.position.copy(toLocal(j.lat, j.lng, this.origin));
        this.scene.add(g);
        this.jobs.set(j.id, g);
      }
      (g.userData.mat as THREE.MeshStandardMaterial).color.set(j.color);
    }
    this.map?.triggerRepaint();
  }

  select(p: Picked) {
    this.selected = p;
    this.map?.triggerRepaint();
  }

  pick(x: number, y: number): Picked {
    const c = this.map.getCanvas();
    const nx = (x / c.clientWidth) * 2 - 1;
    const ny = -(y / c.clientHeight) * 2 + 1;
    const near = new THREE.Vector3(nx, ny, -1).unproject(this.camera);
    const far = new THREE.Vector3(nx, ny, 1).unproject(this.camera);
    this.raycaster.set(near, far.sub(near).normalize());
    const hits = this.raycaster.intersectObjects(this.scene.children, true);
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o && !o.userData.kind) o = o.parent;
      if (o) return { kind: o.userData.kind, id: o.userData.id };
    }
    return null;
  }

  render(_gl: WebGL2RenderingContext, opts: { modelViewProjectionMatrix: ArrayLike<number> }) {
    const now = performance.now();
    const dt = Math.min((now - this.last) / 1000, 0.1);
    this.last = now;
    this.pulse += dt;
    const k = 1 - Math.exp(-dt * 2.5);
    const zoomScale = Math.pow(2, 16 - Math.min(Math.max(this.map.getZoom(), 9), 19));
    const sel = this.selected;

    for (const [id, e] of this.installers) {
      e.cur.lerp(e.target, k);
      const dh = ((e.heading - e.curHeading + 540) % 360) - 180;
      e.curHeading += dh * k;
      e.group.position.copy(e.cur);
      e.group.rotation.z = (-e.curHeading * Math.PI) / 180;
      const selected = sel?.kind === "installer" && sel.id === id;
      e.group.scale.setScalar(zoomScale * (selected ? 1.25 + Math.sin(this.pulse * 4) * 0.06 : 1));
    }
    for (const [id, g] of this.jobs) {
      const selected = sel?.kind === "job" && sel.id === id;
      g.scale.setScalar(zoomScale * (selected ? 1.4 : 1));
    }

    const mc = MercatorCoordinate.fromLngLat([this.origin.lng, this.origin.lat], 0);
    const s = mc.meterInMercatorCoordinateUnits();
    const m = new THREE.Matrix4().fromArray(opts.modelViewProjectionMatrix as number[]);
    const l = new THREE.Matrix4().makeTranslation(mc.x, mc.y, mc.z).scale(new THREE.Vector3(s, -s, s));
    this.camera.projectionMatrix = m.multiply(l);
    this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);
    this.map.triggerRepaint();
  }
}
