import * as THREE from "three";

/** Escala base: os modelos são desenhados em metros reais e ampliados para ficarem visíveis no mapa. */
const VEHICLE_SCALE = 12;
const HOUSE_SCALE = 1;

const std = (color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.1, ...extra });

/** Extruda um perfil lateral (y = frente, z = altura) ao longo da largura (x). */
function sideProfile(points: [number, number][], width: number, bevel = 0.06) {
  const shape = new THREE.Shape();
  points.forEach(([y, z], i) => (i ? shape.lineTo(y, z) : shape.moveTo(y, z)));
  const depth = width - 2 * bevel;
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2 });
  g.translate(0, 0, -depth / 2);
  g.applyMatrix4(new THREE.Matrix4().set(0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1));
  return g;
}

const box = (w: number, l: number, h: number, mat: THREE.Material, x: number, y: number, z: number) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, l, h), mat);
  m.position.set(x, y, z);
  return m;
};

/** Van de serviço (estilo utilitário) com escada no teto. A cor da carroceria indica o estado do instalador. */
export function makeVan(color: string) {
  const model = new THREE.Group();
  const bodyMat = std(color, { roughness: 0.35, metalness: 0 });
  const glassMat = std("#0f172a", { roughness: 0.15, metalness: 0.6 });
  const dark = std("#111827", { roughness: 0.8 });
  const metal = std("#94a3b8", { metalness: 0.7, roughness: 0.35 });

  const body = new THREE.Mesh(
    sideProfile([[-2.3, 0.35], [2.25, 0.35], [2.4, 0.8], [2.3, 1.05], [1.55, 1.2], [0.95, 1.9], [-2.2, 1.95], [-2.35, 1.75]], 1.8),
    bodyMat,
  );
  const glass = new THREE.Mesh(sideProfile([[1.53, 1.25], [1.02, 1.84], [0.3, 1.84], [0.3, 1.25]], 1.86, 0.01), glassMat);
  model.add(body, glass);

  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.26, 20).rotateZ(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.28, 12).rotateZ(Math.PI / 2);
  for (const x of [-0.88, 0.88])
    for (const y of [-1.45, 1.5]) {
      const w = new THREE.Mesh(wheelGeo, dark);
      w.position.set(x, y, 0.38);
      const h = new THREE.Mesh(hubGeo, metal);
      h.position.copy(w.position);
      model.add(w, h);
    }

  const head = new THREE.MeshStandardMaterial({ color: "#fef9c3", emissive: "#fde68a", emissiveIntensity: 1.2 });
  const tail = new THREE.MeshStandardMaterial({ color: "#ef4444", emissive: "#dc2626", emissiveIntensity: 1 });
  for (const x of [-0.65, 0.65]) {
    model.add(box(0.4, 0.1, 0.18, head, x, 2.4, 0.85), box(0.3, 0.1, 0.35, tail, x * 1.2, -2.37, 1.2));
  }
  model.add(box(1.7, 0.12, 0.2, dark, 0, 2.42, 0.5));

  for (const x of [-0.7, 0.7]) model.add(box(0.06, 3.4, 0.06, metal, x, -0.75, 2.12));
  for (let i = 0; i < 7; i++) model.add(box(1.46, 0.05, 0.05, metal, 0, -2.3 + i * 0.5, 2.12));

  const ring = new THREE.Mesh(new THREE.RingGeometry(3.9, 4.7, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
  ring.position.z = 0.08;
  model.add(ring);

  model.scale.setScalar(VEHICLE_SCALE);
  const g = new THREE.Group();
  g.add(model);
  g.userData.mat = bodyMat;
  g.userData.ring = ring;
  return g;
}

/** Casa do cliente com telhado e marcador flutuante coloridos pelo status do serviço. */
export function makeHouse(color: string) {
  const g = new THREE.Group();
  const statusMat = std(color, { roughness: 0.4 });
  const wall = std("#e2e8f0", { roughness: 0.8 });
  const door = std("#475569");

  const base = new THREE.Mesh(new THREE.BoxGeometry(24, 24, 14), wall);
  base.position.z = 7;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(21, 12, 4), statusMat);
  roof.rotation.set(Math.PI / 2, Math.PI / 4, 0);
  roof.position.z = 20;
  const d = new THREE.Mesh(new THREE.BoxGeometry(5, 0.6, 9), door);
  d.position.set(0, -12.1, 4.5);
  const marker = new THREE.Mesh(new THREE.ConeGeometry(7, 16, 4).rotateX(-Math.PI / 2), statusMat);
  marker.position.z = 46;

  g.add(base, roof, d, marker);
  g.scale.setScalar(HOUSE_SCALE);
  g.userData.mat = statusMat;
  g.userData.marker = marker;
  return g;
}
