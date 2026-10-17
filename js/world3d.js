// Monde 3D : relief en terrasses, décor low-poly, lumières et brouillard par zone.
import * as THREE from '../vendor/three.module.min.js';
import { rng, shade } from './pixel.js';

export const S = 1 / 20;          // 1 pixel logique = 1/20 d'unité 3D
export const HALF = 1600;         // demi-taille de la carte (pixels logiques)

// Relief : collines en terrasses, centre plat (zone de départ)
export function makeHeight(zoneId) {
  const r = rng('relief' + zoneId);
  const a = [r() * 6, r() * 6, r() * 6, r() * 6, r() * 6];
  const amp = [1, 1.2, 0.9, 1.3, 1.1, 1.4][zoneId] || 1;
  return (x, y) => {
    let h = 46 * Math.sin(x * 0.0031 + a[0]) * Math.cos(y * 0.0027 + a[1])
      + 26 * Math.sin(x * 0.0072 + y * 0.004 + a[2])
      + 16 * Math.cos(y * 0.009 - x * 0.003 + a[3]);
    h = Math.max(0, h + 20) * amp;
    // terrasses douces
    const t = h / 34, f = t - Math.floor(t);
    h = (Math.floor(t) + smooth(Math.min(1, f * 2.2))) * 34;
    // centre plat + bords relevés
    const d = Math.hypot(x, y);
    h *= smooth(Math.min(1, Math.max(0, (d - 180) / 420)));
    const edge = Math.max(Math.abs(x), Math.abs(y));
    if (edge > HALF - 160) h += (edge - (HALF - 160)) * 1.2;
    return h;
  };
}
const smooth = t => t * t * (3 - 2 * t);

export function buildWorld(scene, zone) {
  const height = makeHeight(zone.id);
  const r = rng('world' + zone.id);
  const sky = new THREE.Color(zone.sky[1]);
  scene.background = new THREE.Color(zone.sky[0]).lerp(sky, 0.6);
  scene.fog = new THREE.Fog(scene.background, 34, 95);
  scene.add(new THREE.HemisphereLight(new THREE.Color(zone.sky[1]).lerp(new THREE.Color('#ffffff'), 0.5), new THREE.Color(zone.ground[1]), zone.bg === 'void' || zone.bg === 'shadow' ? 1.6 : 2.1));
  const sun = new THREE.DirectionalLight('#fff4e0', zone.bg === 'void' || zone.bg === 'shadow' ? 1.2 : 2.2);
  sun.position.set(30, 60, 20);
  scene.add(sun);

  // ---- terrain ----
  const N = 112, size = HALF * 2 * S;
  const geo = new THREE.PlaneGeometry(size, size, N, N).toNonIndexed();
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  const colors = new Float32Array(p.count * 3);
  const g0 = new THREE.Color(zone.ground[0]), g1 = new THREE.Color(zone.ground[1]);
  const top = new THREE.Color(shade(zone.ground[0], zone.bg === 'ice' ? 0.4 : 0.22));
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) / S, y = p.getZ(i) / S;
    const h = height(x, y);
    p.setY(i, h * S);
  }
  // couleur par triangle (look low-poly)
  for (let i = 0; i < p.count; i += 3) {
    const hy = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3 / S;
    const slope = Math.abs(p.getY(i) - p.getY(i + 1)) + Math.abs(p.getY(i) - p.getY(i + 2));
    const n = r();
    c.copy(g0).lerp(top, Math.min(1, hy / 140)).lerp(g1, slope > 0.5 ? 0.6 : n < 0.15 ? 0.35 : 0);
    c.multiplyScalar(0.94 + n * 0.12);
    for (let k = 0; k < 3; k++) colors.set([c.r, c.g, c.b], (i + k) * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  scene.add(ground);

  // eau (rivière) ou brume (îles)
  if (zone.bg === 'river' || zone.bg === 'shadow' || zone.bg === 'void') {
    const wm = new THREE.MeshLambertMaterial({ color: zone.bg === 'river' ? '#3aa8d8' : zone.bg === 'void' ? '#5a1a8a' : '#2a8a70', transparent: true, opacity: zone.bg === 'river' ? 0.75 : 0.45 });
    const water = new THREE.Mesh(new THREE.PlaneGeometry(size, size), wm);
    water.rotation.x = -Math.PI / 2; water.position.y = 0.35;
    scene.add(water);
  }

  // ---- décor (instancié) ----
  const props = propKinds(zone);
  const dummy = new THREE.Object3D();
  const marks = [];
  for (const kind of props) {
    const mesh = new THREE.InstancedMesh(kind.geo, kind.mat, kind.count);
    let n = 0;
    for (let i = 0; i < kind.count * 3 && n < kind.count; i++) {
      const x = (r() * 2 - 1) * (HALF - 60), y = (r() * 2 - 1) * (HALF - 60);
      if (Math.hypot(x, y) < 220) continue;
      const s = kind.min + r() * (kind.max - kind.min);
      dummy.position.set(x * S, height(x, y) * S - 0.1, y * S);
      dummy.rotation.set(kind.tilt ? (r() - 0.5) * kind.tilt : 0, r() * Math.PI * 2, kind.tilt ? (r() - 0.5) * kind.tilt : 0);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      mesh.setMatrixAt(n++, dummy.matrix);
      if (kind.landmark) marks.push({ x, y });
    }
    mesh.count = n;
    scene.add(mesh);
  }
  return { height, ground };
}

function merge(parts) {
  // fusionne des géométries simples en une seule (avec couleurs)
  const pos = [], col = [], nor = [];
  for (const [geo, color, m] of parts) {
    const g = geo.toNonIndexed();
    if (m) g.applyMatrix4(m);
    g.computeVertexNormals();
    const c = new THREE.Color(color);
    const P = g.attributes.position, N = g.attributes.normal;
    for (let i = 0; i < P.count; i++) { pos.push(P.getX(i), P.getY(i), P.getZ(i)); nor.push(N.getX(i), N.getY(i), N.getZ(i)); col.push(c.r, c.g, c.b); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}
const M = (x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, ry = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(sx, sy, sz));

function propKinds(zone) {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const glow = new THREE.MeshBasicMaterial({ vertexColors: true });
  const pine = (leaf, trunk) => merge([
    [new THREE.CylinderGeometry(0.15, 0.2, 1, 5), trunk, M(0, 0.5)],
    [new THREE.ConeGeometry(1.1, 1.6, 6), leaf, M(0, 1.6)],
    [new THREE.ConeGeometry(0.85, 1.3, 6), shade(leaf, 0.12), M(0, 2.4)],
    [new THREE.ConeGeometry(0.55, 1, 6), shade(leaf, 0.22), M(0, 3.1)],
  ]);
  const round = (leaf, trunk) => merge([
    [new THREE.CylinderGeometry(0.2, 0.3, 1.6, 5), trunk, M(0, 0.8)],
    [new THREE.IcosahedronGeometry(1.4, 0), leaf, M(0, 2.4)],
    [new THREE.IcosahedronGeometry(0.9, 0), shade(leaf, 0.15), M(0.7, 2.9, 0.3)],
  ]);
  const rock = c => merge([[new THREE.DodecahedronGeometry(0.8, 0), c, M(0, 0.3, 0, 1, 0.7, 1)], [new THREE.DodecahedronGeometry(0.45, 0), shade(c, 0.1), M(0.7, 0.2, 0.2)]]);
  const crystal = c => merge([[new THREE.OctahedronGeometry(0.5, 0), c, M(0, 1.2, 0, 1, 3, 1)], [new THREE.OctahedronGeometry(0.3, 0), shade(c, 0.2), M(0.5, 0.6, 0.2, 1, 2.2, 1)]]);
  const dead = c => merge([
    [new THREE.CylinderGeometry(0.1, 0.22, 3, 5), c, M(0, 1.5)],
    [new THREE.CylinderGeometry(0.06, 0.1, 1.4, 4), c, new THREE.Matrix4().makeRotationZ(0.9).setPosition(0.5, 2.3, 0)],
    [new THREE.CylinderGeometry(0.05, 0.09, 1.1, 4), c, new THREE.Matrix4().makeRotationZ(-1).setPosition(-0.45, 1.8, 0)],
  ]);
  const grass = c => merge([[new THREE.ConeGeometry(0.12, 0.6, 3), c, M(0, 0.3)], [new THREE.ConeGeometry(0.1, 0.5, 3), shade(c, 0.15), M(0.2, 0.25, 0.1)], [new THREE.ConeGeometry(0.1, 0.45, 3), shade(c, -0.1), M(-0.15, 0.22, -0.1)]]);
  const tower = (c, gem) => merge([
    [new THREE.CylinderGeometry(0.8, 1.1, 4, 6), c, M(0, 2)],
    [new THREE.CylinderGeometry(1.2, 1.2, 0.5, 6), shade(c, 0.15), M(0, 4.2)],
    [new THREE.OctahedronGeometry(0.6, 0), gem, M(0, 5.3, 0, 1, 1.4, 1)],
  ]);
  const tomb = c => merge([[new THREE.BoxGeometry(0.8, 1.1, 0.25), c, M(0, 0.55)], [new THREE.CylinderGeometry(0.4, 0.4, 0.25, 8, 1, false, 0, Math.PI), c, new THREE.Matrix4().makeRotationX(Math.PI / 2).setPosition(0, 1.1, 0)]]);
  const k = (geo, count, min, max, o = {}) => ({ geo, mat: o.glow ? glow : mat, count, min, max, ...o });
  switch (zone.bg) {
    case 'lane': return [k(pine('#3f8a3a', '#6a4422'), 120, 0.8, 1.4), k(rock('#8a8a98'), 60, 0.6, 1.4, { tilt: 0.3 }), k(grass('#5aa84a'), 260, 0.8, 1.4), k(tower('#8a96b8', '#4fd0ff'), 8, 1, 1.2, { landmark: true })];
    case 'jungle': return [k(round('#2f7a3a', '#5a3a1a'), 140, 0.9, 1.6), k(pine('#245a30', '#4a2f1a'), 60, 1, 1.5), k(grass('#3f9a3a'), 320, 1, 1.8), k(rock('#6a7a5a'), 40, 0.6, 1.2)];
    case 'river': return [k(rock('#7a8a9a'), 120, 0.6, 1.6, { tilt: 0.4 }), k(grass('#5ab86a'), 260, 0.9, 1.6), k(round('#3a8a5a', '#5a3a1a'), 50, 0.8, 1.2)];
    case 'ice': return [k(pine('#e8f4ff', '#6a5a4a'), 90, 0.8, 1.3), k(crystal('#9ad8ff'), 90, 0.7, 1.6, { tilt: 0.4 }), k(rock('#c8dff0'), 50, 0.6, 1.3)];
    case 'shadow': return [k(dead('#1a2a28'), 140, 0.8, 1.4), k(tomb('#6a7a78'), 80, 0.8, 1.2, { tilt: 0.3 }), k(rock('#2a3a38'), 50, 0.6, 1.3), k(crystal('#5ae8b8'), 30, 0.4, 0.8, { glow: true })];
    default: return [k(crystal('#a83ad8'), 120, 0.8, 2.2, { tilt: 0.5, glow: true }), k(crystal('#d83aa8'), 70, 0.6, 1.6, { tilt: 0.5, glow: true }), k(rock('#3a1a5a'), 80, 0.6, 1.5, { tilt: 0.4 })];
  }
}
