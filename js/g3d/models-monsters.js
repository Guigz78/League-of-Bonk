// Monstres 3D low-poly : un InstancedMesh par type (une seule géométrie, un seul appel de dessin),
// animé dans le shader (jambes, bras, ailes, queues, rebond, écrasement) à partir de la phase de marche de chaque instance.
// Gobelins de la vallée, toutes les familles (blob, humanoïde, golem, bête, oiseau, crabe, fantôme, ver) et leurs variantes,
// élites (plus gros + couronne et touches dorées). Les boss (variante 'b') sont dans models-bosses.js.
import { THREE, PI, TAU, clamp, yawOf, shade, Shape, charMaterial } from './models-kit.js';
import { PETS } from '../data.js';

export const MON_R = 16; // rayon (px) pour lequel les modèles sont construits : scale = e.r / 16
const MON_K = 1.25, BOSS_K = 1.1;
const L2 = [[1, 0], [-1, PI]]; // côté, décalage de phase
const GOLD = '#ffd54a', GOLD_D = '#c8901a', INK = '#1a1020', WOOD = '#8a5a30', WOOD_D = '#5a3a1e', IRON = '#5a5a6a', STEEL = '#c8ccd8';

// ---------- Pièces communes ----------
export function crown(s, x, y, z, w, col = GOLD, gem = '#ff3a5a') {
  s.put('cyl:8', col, x, y, z, w, w * 0.3, w, 0, 0, 0, { grad: 0.1, glow: 0.2 });
  for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + PI / 2; s.put('cone:4', col, x + Math.cos(a) * w * 0.42, y + w * 0.32, z + Math.sin(a) * w * 0.42, w * 0.22, w * 0.42, w * 0.22, 0, 0, 0, { grad: 0, glow: 0.2 }); }
  s.put('oct', gem, x, y, z + w * 0.5, w * 0.24, w * 0.3, w * 0.14, 0, 0, 0, { grad: 0, glow: 0.9 });
}
function legs2(s, { x, hip, len, w, col, foot, fl = 0.34, amp = 0.6, d = w, z = 0, fw = 1.2 }) {
  for (const [sd, off] of L2) {
    s.part([x * sd, hip, z], { rx: amp, off, body: 0 });
    s.put('rbox:0.3', col, x * sd, hip - len / 2, z, w, len, d);
    if (foot) s.put('rbox:0.3', foot, x * sd, 0.07, z + 0.05, w * fw, 0.14, fl);
  }
  s.part(null);
}
// bras pendants : sd = côté ; off opposé à la jambe du même côté ; pose = [rx, rz, ry, lift] pendant l'élan
function arm1(s, sd, { x, sh, len, w, col, hand, hr = 0.2, amp = 0.5, pose, out = 0.08, z = 0 }) {
  s.part([x * sd, sh, z], { rx: amp, off: sd > 0 ? PI : 0, pose });
  s.put('rbox:0.35', col, (x + out) * sd, sh - len / 2, z, w, len, w, 0, 0, out * sd * 0.6);
  if (hand) s.put('sph:6:4', hand, (x + out * 1.6) * sd, sh - len, z + 0.02, hr, hr, hr);
}
function eyes2(s, x, y, z, r, o = {}) {
  const ry = o.ry ?? 0.25;
  s.eye(x, y, z, r, { ...o, ry }); s.eye(-x, y, z, r, { ...o, ry: -ry });
}
function brows2(s, x, y, z, w, col, ang = 0.4, th = 0.06) { s.sym('box', col, x, y, z, w, th, 0.06, 0, 0, ang, { grad: 0 }); }
function teethRow(s, x0, x1, y, z, n, col = '#ffffff', h = 0.08, down = true) {
  for (let i = 0; i < n; i++) { const x = x0 + (x1 - x0) * (n > 1 ? i / (n - 1) : 0.5); s.tip('cone:4', col, x, y, z, down ? PI : 0, 0, 0, h * 0.8, h, h * 0.6, { grad: 0 }); }
}

// ---------- Gobelins (vallée) ----------
const GOB = '#84c440', GOB_D = '#5e9a2e', GOB_E = '#e0907a';
function goblinBody(c, o = {}) {
  const { s } = c, skin = o.skin || GOB, skinD = o.skinD || GOB_D, cloth = o.cloth || c.P.m;
  legs2(s, { x: 0.18, hip: 0.5, len: 0.36, w: 0.2, col: skinD, foot: '#5a3a22' });
  // corps : gilet de cuir, ventre vert, pagne
  s.put('rbox:0.35', '#7a5230', 0, 0.82, 0, 0.7, 0.58, 0.54, 0, 0, 0, { grad: 0.2 });
  s.put('sph:6:4', skin, 0, 0.8, 0.17, 0.42, 0.42, 0.3);
  s.put('rbox:0.3', '#3a2a1a', 0, 0.57, 0, 0.74, 0.1, 0.58, 0, 0, 0, { grad: 0 });
  s.put('box', cloth, 0, 0.42, 0.26, 0.34, 0.26, 0.04, -0.15, 0, 0, { grad: 0.1 });
  s.put('box', cloth, 0.06, 0.96, 0.02, 0.2, 0.7, 0.6, 0, 0, -0.75, { grad: 0.1 }); // écharpe en bandoulière
  if (c.elite) { s.put('rbox:0.3', GOLD, 0, 0.57, 0.29, 0.16, 0.13, 0.04, 0, 0, 0, { grad: 0, glow: 0.3 }); s.sym('sph:6:4', GOLD_D, 0.42, 1.04, 0, 0.26, 0.18, 0.28, 0, 0, 0, { glow: 0.1 }); }
  // tête : grandes oreilles pointues, gros nez, sourire narquois
  s.part([0, 1.08, 0], { rx: 0.07, f: 2, off: 0.6 });
  s.put('rbox:0.42', skin, 0, 1.47, 0.02, 0.84, 0.7, 0.72, 0, 0, 0, { grad: 0.15 });
  s.put('rbox:0.4', skin, 0, 1.25, 0.1, 0.5, 0.2, 0.46, 0, 0, 0, { grad: 0.1 }); // menton
  s.symTip('cone:4', skin, 0.38, 1.52, 0, 0, 0, -1.25, 0.26, 0.62, 0.12, { grad: -0.3 });
  s.symTip('cone:4', GOB_E, 0.42, 1.52, 0.03, 0, 0, -1.25, 0.14, 0.44, 0.08, { grad: 0 });
  eyes2(s, 0.19, 1.52, 0.34, 0.11, { white: '#fff4b0', pr: 0.5, tall: 1.05 });
  brows2(s, 0.19, 1.66, 0.37, 0.24, skinD, 0.42, 0.07);
  s.tip('cone:5', skin, 0, 1.44, 0.34, PI / 2 - 0.25, 0, 0, 0.17, 0.3, 0.17, { grad: -0.2 });
  s.put('box', '#3a1420', 0.03, 1.3, 0.36, 0.38, 0.09, 0.05, 0, 0, 0.1, { grad: 0 });
  s.put('box', '#ffffff', -0.06, 1.33, 0.375, 0.08, 0.05, 0.04, 0, 0, 0.1, { grad: 0 });
  s.put('box', '#ffffff', 0.12, 1.345, 0.375, 0.07, 0.05, 0.04, 0, 0, 0.1, { grad: 0 });
  if (o.hat === 'band') { s.put('cyl:8', cloth, 0, 1.64, 0.02, 0.9, 0.12, 0.78, 0, 0, 0, { grad: 0 }); s.tip('cone:4', cloth, -0.1, 1.64, -0.38, -2.2, 0, 0.3, 0.16, 0.36, 0.06, { grad: 0 }); s.tip('cone:4', cloth, 0.1, 1.64, -0.38, -2.4, 0, -0.3, 0.16, 0.3, 0.06, { grad: 0 }); }
  if (o.hat === 'hood') {
    s.put('rbox:0.42', cloth, 0, 1.68, -0.06, 0.92, 0.44, 0.82, 0, 0, 0, { grad: 0.1 });
    s.put('rbox:0.42', cloth, 0, 1.42, -0.32, 0.86, 0.56, 0.24, 0, 0, 0, { grad: 0.15 });
    s.tip('cone:4', cloth, 0, 1.8, -0.2, -1.1, 0, 0, 0.3, 0.42, 0.26, { grad: 0 });
  }
  if (o.hat === 'helm') {
    s.put('hemi:8', IRON, 0, 1.6, 0.0, 0.92, 0.6, 0.8, 0, 0, 0, { grad: -0.1 });
    s.put('tor:0.1:4:10', shade(IRON, 0.25), 0, 1.62, 0.0, 0.92, 0.92, 0.8, PI / 2, 0, 0, { grad: 0 });
  }
  c.crown(0, 1.86, 0.0, 0.42);
  s.part(null);
  // bras
  for (const sd of [1, -1]) arm1(s, sd, { x: 0.4, sh: 1.04, len: 0.42, w: 0.16, col: skin, hand: skin, hr: 0.2, pose: sd < 0 ? o.poseR : o.poseL });
  c.h = 1.9;
}
// massue cloutée dans la main droite
function club(s, x, y, z, k = 1, col = WOOD) {
  s.tip('cyl:5', col, x, y, z, 0.55, 0, 0, 0.11 * k, 0.6 * k, 0.11 * k, { grad: 0 });
  const ex = x, ey = y + Math.cos(0.55) * 0.75 * k, ez = z + Math.sin(0.55) * 0.75 * k;
  s.put('rbox:0.35', col, ex, ey, ez, 0.3 * k, 0.42 * k, 0.3 * k, 0.55, 0, 0, { grad: 0.15 });
  for (const [dx, dy, dz, rz, rx] of [[0.15, 0.05, 0, -1.4, 0], [-0.15, 0.08, 0, 1.4, 0], [0, 0.15, 0.13, 0, 1.2], [0, -0.05, 0.16, 0, 1.6]]) s.tip('cone:4', '#d8d8e0', ex + dx * k, ey + dy * k, ez + dz * k, rx, 0, rz, 0.08 * k, 0.16 * k);
}
function gobBrawler(c) {
  const { s } = c;
  c.k = 1.12;
  goblinBody(c, { hat: 'band', poseR: [-2.9, 0, 0, 0], poseL: [-0.8, 0.3, 0, 0] });
  s.part([-0.4, 1.04, 0], { rx: 0.5, off: 0, pose: [-2.9, 0, 0, 0] });
  club(s, -0.53, 0.6, 0.04, 1.3);
  s.part(null);
}
function gobSpear(c) {
  const { s, P } = c;
  c.k = 1.12;
  goblinBody(c, { hat: 'hood', poseR: [1.1, 0, 0, 0], poseL: [-1.0, 0.2, 0, 0] });
  // javelots dans le dos
  for (let i = 0; i < 3; i++) s.tip('cyl:4', WOOD, -0.1 + i * 0.1, 0.55, -0.32, -0.25, 0, 0.2 - i * 0.2, 0.05, 0.95);
  for (let i = 0; i < 3; i++) s.tip('cone:4', STEEL, -0.1 + i * 0.1 + (0.2 - i * 0.2) * -0.95, 0.55 + 0.92, -0.32 - 0.23, -0.25, 0, 0.2 - i * 0.2, 0.1, 0.18);
  s.put('rbox:0.3', P.d, 0, 0.8, -0.32, 0.4, 0.4, 0.14, 0, 0, 0, { grad: 0.15 });
  // lance tenue à la verticale, pointe vers l'avant
  s.part([-0.4, 1.04, 0], { rx: 0.5, off: 0, pose: [1.1, 0, 0, 0] });
  s.tip('cyl:4', WOOD, -0.53, 0.25, 0.0, 0.25, 0, 0, 0.07, 1.6);
  s.tip('cone:4', STEEL, -0.53, 0.25 + Math.cos(0.25) * 1.6, Math.sin(0.25) * 1.6, 0.25, 0, 0, 0.16, 0.34, 0.06, { glow: 0.1 });
  s.part(null);
}
function furPath(s, cx, cy, cz, R, n, col, col2, k = 0.36) {
  for (let i = 0; i < n; i++) {
    const a = i * 2.39996, y = 1 - (i + 0.5) / n * 1.7, r = Math.sqrt(Math.max(0, 1 - y * y));
    const dx = Math.cos(a) * r, dz = Math.sin(a) * r, dy = y;
    const rx = Math.atan2(dz, dy), rz = -Math.atan2(dx, Math.hypot(dy, dz));
    s.add('cone:4', i % 3 ? col : col2, new THREE.Matrix4().makeTranslation(cx + dx * R * 0.86, cy + dy * R * 0.86, cz + dz * R * 0.86).multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, 0, rz, 'XYZ'))).multiply(new THREE.Matrix4().makeTranslation(0, R * k * 0.5, 0)).multiply(new THREE.Matrix4().makeScale(R * 0.42, R * k, R * 0.42)), { grad: -0.2 });
  }
}
function furball(c, o = {}) {
  const { s, P } = c, col = o.col || P.m, R = o.R || 0.66;
  for (const [sd, off] of L2) { s.part([0.24 * sd, 0.3, 0.05], { rx: 0.5, off, body: 0 }); s.put('sph:6:4', o.foot || shade(col, -0.25), 0.24 * sd, 0.1, 0.12, 0.26, 0.2, 0.34); }
  s.part(null);
  s.put('ico:1', col, 0, R + 0.08, 0, R * 2, R * 1.9, R * 2, 0, 0, 0, { grad: 0.25 });
  furPath(s, 0, R + 0.08, 0, R, o.n || 26, col, o.col2 || P.l);
  eyes2(s, 0.22, R + 0.2, R * 0.86, 0.15, { pr: 0.72, tall: 1.2, ry: 0.3 });
  s.put('sph:6:4', '#ff7a9a', 0, R - 0.06, R * 0.95, 0.16, 0.1, 0.06, 0, 0, 0, { grad: 0 });
  s.sym('sph:5:3', '#ffa0b0', 0.38, R + 0.02, R * 0.8, 0.14, 0.07, 0.04, 0, 0.5, 0, { grad: 0 });
  if (o.horns) s.symTip('cone:5', o.horns, 0.3, R * 1.7, 0.1, 0, 0, -0.35, 0.16, 0.3, 0.16, { grad: -0.2 });
  c.crown(0, R * 2.05 + 0.08, 0, 0.42);
  c.body = [0.18, 0, 0.08, 0];
  c.h = R * 2 + 0.2;
}
function cannonCart(c) {
  const { s, P } = c;
  c.k = 1.12;
  // roues (oscillent), chariot, canon pointé vers l'avant, gobelin artilleur derrière
  for (const sd of [1, -1]) {
    s.part([0.52 * sd, 0.36, 0.05], { rx: 0.5, off: sd > 0 ? 0 : PI, body: 0 });
    s.put('cyl:8', WOOD_D, 0.52 * sd, 0.36, 0.05, 0.72, 0.14, 0.72, 0, 0, PI / 2, { grad: 0 });
    s.put('cyl:6', '#c8a060', 0.6 * sd, 0.36, 0.05, 0.2, 0.08, 0.2, 0, 0, PI / 2, { grad: 0 });
  }
  s.part(null);
  s.put('rbox:0.2', WOOD, 0, 0.5, -0.05, 0.86, 0.3, 1.0, 0, 0, 0, { grad: 0.2 });
  s.put('box', WOOD_D, 0, 0.66, -0.05, 0.9, 0.05, 1.04, 0, 0, 0, { grad: 0 });
  s.part([0, 0.9, 0], { rx: 0.04, f: 2, pose: [-0.45, 0, 0, 0] });
  s.put('cyl:8', '#3a3a48', 0, 0.9, 0.35, 0.5, 0.95, 0.5, PI / 2 - 0.1, 0, 0, { grad: 0.25 });
  s.put('cyl:8', '#5a5a6a', 0, 0.95, 0.82, 0.62, 0.16, 0.62, PI / 2 - 0.1, 0, 0, { grad: 0 });
  s.put('cyl:8', '#1a1018', 0, 0.96, 0.9, 0.36, 0.04, 0.36, PI / 2 - 0.1, 0, 0, { grad: 0 });
  s.put('tor:0.12:4:8', GOLD_D, 0, 0.9, 0.15, 0.54, 0.54, 0.6, -0.1, 0, 0, { grad: 0 });
  s.part(null);
  // gobelin (buste) derrière le canon, casque de la couleur de l'équipe
  s.put('rbox:0.35', '#7a5230', 0, 0.98, -0.42, 0.62, 0.5, 0.46, 0, 0, 0, { grad: 0.2 });
  s.part([0, 1.15, -0.4], { rx: 0.06, f: 2, off: 0.5 });
  s.put('rbox:0.32', GOB, 0, 1.48, -0.38, 0.78, 0.6, 0.64, 0, 0, 0, { grad: 0.15 });
  s.symTip('cone:4', GOB, 0.36, 1.5, -0.4, 0, 0, -1.3, 0.24, 0.56, 0.12, { grad: -0.3 });
  eyes2(s, 0.17, 1.52, -0.08, 0.1, { white: '#fff4b0', pr: 0.5 });
  s.tip('cone:5', GOB, 0, 1.42, -0.08, PI / 2 - 0.2, 0, 0, 0.16, 0.26, 0.16);
  s.put('box', '#3a1420', 0.02, 1.3, -0.07, 0.3, 0.07, 0.05, 0, 0, 0.12, { grad: 0 });
  s.put('hemi:8', P.m, 0, 1.62, -0.38, 0.86, 0.5, 0.74, 0, 0, 0, { grad: -0.1 });
  s.put('cyl:8', P.d, 0, 1.63, -0.38, 0.9, 0.07, 0.78, 0, 0, 0, { grad: 0 });
  s.put('rbox:0.3', '#c8e0ff', 0, 1.7, -0.06, 0.5, 0.16, 0.08, 0, 0, 0, { grad: 0, glow: 0.2 }); // lunettes relevées
  c.crown(0, 1.92, -0.38, 0.4);
  s.part(null);
  for (const sd of [1, -1]) arm1(s, sd, { x: 0.34, sh: 1.12, len: 0.36, w: 0.15, col: GOB, hand: GOB, hr: 0.18, amp: 0.15, z: -0.4, pose: [-1.2, 0, 0, 0] });
  c.body = [0.03, 0.04, 0, 0];
  c.h = 1.9;
}
function ogre(c) {
  const { s, P } = c, skin = P.m, skinD = P.d;
  legs2(s, { x: 0.32, hip: 0.66, len: 0.5, w: 0.36, col: skinD, foot: '#4a3020', fl: 0.46, amp: 0.45 });
  s.put('rbox:0.35', '#6a4a2a', 0, 0.62, 0, 1.0, 0.28, 0.74, 0, 0, 0, { grad: 0.1 }); // pagne
  s.put('rbox:0.3', '#3a2414', 0, 0.76, 0, 1.06, 0.1, 0.8, 0, 0, 0, { grad: 0 });
  s.put('sph:8:6', skin, 0, 1.18, 0.02, 1.36, 1.0, 1.05, 0, 0, 0, { grad: 0.25 }); // gros ventre
  s.put('sph:7:5', shade(skin, 0.18), 0, 1.06, 0.3, 0.8, 0.62, 0.5);
  s.put('rbox:0.4', skin, 0, 1.62, -0.05, 1.3, 0.48, 0.8, 0, 0, 0, { grad: 0.1 }); // épaules
  s.put('box', '#6a4a2a', 0.1, 1.3, 0.0, 0.18, 1.0, 1.0, 0, 0, -0.7, { grad: 0.1 }); // bandoulière
  if (c.elite) { s.sym('tor:0.2:4:8', GOLD_D, 0.6, 1.7, 0, 0.36, 0.36, 0.36, PI / 2, 0, -0.3, { glow: 0.15 }); s.put('rbox:0.3', GOLD, 0, 0.76, 0.42, 0.26, 0.2, 0.06, 0, 0, 0, { glow: 0.3 }); }
  s.part([0, 1.75, 0.12], { rx: 0.06, f: 2, off: 0.8, pose: [-0.35, 0, 0, 0.05] });
  s.put('rbox:0.35', skin, 0, 1.98, 0.18, 0.64, 0.56, 0.58, 0, 0, 0, { grad: 0.12 });
  s.put('rbox:0.35', shade(skin, -0.1), 0, 1.82, 0.36, 0.56, 0.24, 0.26, 0, 0, 0, { grad: 0 }); // mâchoire
  s.symTip('cone:4', '#fff4e0', 0.18, 1.88, 0.46, -0.2, 0, -0.15, 0.1, 0.22, 0.08, { grad: 0 }); // défenses
  eyes2(s, 0.13, 2.04, 0.45, 0.07, { white: '#fff0d0', pr: 0.55, tall: 1.0 });
  s.put('box', skinD, 0, 2.15, 0.46, 0.46, 0.08, 0.08, 0, 0, 0, { grad: 0 }); // monosourcil
  s.tip('sph:5:3', shade(skin, -0.15), 0, 1.98, 0.46, 0, 0, 0, 0.16, 0.12, 0.14);
  s.symTip('cone:4', skin, 0.3, 2.02, 0.12, 0, 0, -1.3, 0.14, 0.24, 0.1);
  c.crown(0, 2.32, 0.16, 0.38);
  s.part(null);
  for (const sd of [1, -1]) arm1(s, sd, { x: 0.7, sh: 1.66, len: 0.86, w: 0.3, col: skin, hand: skin, hr: 0.38, amp: 0.4, out: 0.1, pose: sd < 0 ? [-2.8, 0, 0, 0] : [-0.6, 0.3, 0, 0] });
  s.part([-0.7, 1.66, 0], { rx: 0.4, off: 0, pose: [-2.8, 0, 0, 0] });
  club(s, -0.86, 0.68, 0.1, 1.5, WOOD_D);
  s.part(null);
  c.body = [0.05, 0.07, 0, 0];
  c.h = 2.4;
}

// ---------- Familles génériques (paramétrées pour les autres zones) ----------
function blob(c, o = {}) {
  const { s, P } = c, col = o.col || P.m, R = o.R || 0.64, fl = o.flat ?? 0.82, cy = R * fl;
  if (o.feet !== false) { for (const [sd, off] of L2) { s.part([0.26 * sd, 0.2, 0.1], { rx: 0.45, off, body: 0 }); s.put('sph:6:4', shade(col, -0.25), 0.27 * sd, 0.08, 0.2, 0.28, 0.16, 0.34); } s.part(null); }
  s.put(o.dome ? 'hemi:9' : 'sph:9:7', col, 0, o.dome ? 0.02 : cy + 0.04, 0, R * 2.1, cy * 2, R * 2, 0, 0, 0, { grad: o.dome ? -0.3 : 0.25, glow: o.glow || 0 });
  if (!o.dome) s.put('sph:7:5', o.belly || P.l, 0, cy * 0.8, R * 0.55, R * 1.2, cy * 1.1, R * 0.8, 0, 0, 0, { grad: 0.1 });
  const ey = o.dome ? cy * 0.7 : cy * 1.25;
  if (o.oneEye) {
    s.eye(0, ey + 0.02, R * 0.72, R * 0.62, { pupil: o.pupil || INK, pr: 0.55, tall: 1, glow: o.eyeGlow || 0, flat: 0.75 });
    s.put('tor:0.12:4:12', shade(col, -0.25), 0, ey + 0.02, R * 0.82, R * 1.3, R * 1.3, R * 0.6, 0, 0, 0, { grad: 0 });
  } else eyes2(s, R * 0.36, ey, R * (o.dome ? 0.88 : 0.82), R * 0.22, { pr: 0.66, tall: 1.2, ry: 0.3, pupil: o.pupil || INK, glow: o.eyeGlow || 0, white: o.white ?? '#ffffff' });
  if (o.angry) brows2(s, R * 0.36, ey + R * 0.32, R * 0.86, R * 0.36, shade(col, -0.45), 0.45, 0.07);
  if (o.mouth === 'wide') { s.put('box', '#3a1020', 0, ey - R * 0.42, R * 0.9, R * 0.9, 0.06, 0.05, 0, 0, 0, { grad: 0 }); }
  else if (o.mouth !== false) s.put('sph:5:3', '#5a1a2a', 0, ey - R * 0.38, R * 0.9, R * 0.26, R * 0.14, 0.06, 0, 0, 0, { grad: 0 });
  if (o.tentacles) for (let i = 0; i < 5; i++) {
    const a = i / 5 * TAU;
    s.part([Math.cos(a) * R * 0.5, cy * 0.4, Math.sin(a) * R * 0.5], { sway: 0.08, rx: 0.35, f: 1.4, off: i * 1.25 });
    s.tip('cone:4', i % 2 ? col : shade(col, -0.2), Math.cos(a) * R * 0.5, cy * 0.45, Math.sin(a) * R * 0.5, PI - Math.sin(a) * 0.95, 0, Math.cos(a) * 0.95, 0.18, 0.5, 0.18, { grad: 0 });
  }
  s.part(null);
  if (o.shine) s.put('sph:5:3', '#ffffff', -R * 0.4, (o.dome ? cy * 1.4 : cy * 1.7), R * 0.4, R * 0.3, R * 0.18, R * 0.14, 0, 0, 0.5, { grad: 0, glow: 0.6 });
  if (o.drop) s.tip('cone:6', col, 0, o.dome ? cy * 1.85 : cy * 2, -0.05, -0.2, 0, 0, R * 0.5, R * 0.55, R * 0.5, { grad: -0.2, glow: o.glow || 0 });
  c.crown(0, (o.dome ? cy * 2 : cy * 2.05) + 0.06, 0, 0.4);
  c.body = [o.hop ?? 0.16, 0, o.sq ?? 0.08, 0];
  c.h = (o.dome ? cy * 2 : cy * 2) + 0.1;
}
function biped(c, o = {}) { // humanoïde générique (chevaliers, squelettes)
  const { s, P } = c, main = o.col || P.m, dk = o.dk || P.d, lt = o.lt || P.l, bone = o.bone;
  if (bone) legs2(s, { x: 0.17, hip: 0.6, len: 0.46, w: 0.09, col: bone, foot: bone, fl: 0.28, fw: 2 });
  else legs2(s, { x: 0.19, hip: 0.6, len: 0.46, w: 0.24, col: dk, foot: shade(dk, -0.3), fl: 0.36 });
  if (bone) {
    s.put('rbox:0.3', bone, 0, 0.62, 0, 0.42, 0.12, 0.24, 0, 0, 0, { grad: 0 }); // bassin
    s.put('cyl:5', bone, 0, 0.82, -0.05, 0.1, 0.4, 0.1);
    for (let i = 0; i < 3; i++) s.put('tor:0.14:3:8', bone, 0, 0.9 + i * 0.13, 0.0, 0.56 - i * 0.04, 0.5 - i * 0.03, 0.46, PI / 2, 0, 0, { grad: 0 });
    s.put('rbox:0.4', bone, 0, 1.28, 0, 0.66, 0.1, 0.3, 0, 0, 0, { grad: 0 });
  } else {
    s.put('rbox:0.3', main, 0, 0.98, 0, 0.78, 0.66, 0.54, 0, 0, 0, { grad: 0.2 });
    s.put('rbox:0.3', dk, 0, 0.64, 0, 0.8, 0.12, 0.58, 0, 0, 0, { grad: 0 });
    if (o.tabard) s.put('box', o.tabard, 0, 0.8, 0.28, 0.4, 0.6, 0.03, 0, 0, 0, { grad: 0.15 });
    s.sym('sph:7:5', lt, 0.44, 1.25, 0, 0.38, 0.3, 0.42, 0, 0, -0.25, { grad: 0.2, glow: o.trimGlow || 0 });
    if (o.cape) s.put('frust:0.3:0.5:4', o.cape, 0, 0.82, -0.32, 1.1, 0.9, 0.1, 0.1, PI / 4, 0, { grad: 0.3 });
  }
  if (c.elite) s.sym('cone:5', GOLD, 0.5, 1.48, 0, 0.12, 0.3, 0.12, 0, 0, -0.6, { glow: 0.25 });
  // tête
  s.part([0, 1.3, 0], { rx: 0.05, f: 2, off: 0.5 });
  if (o.head === 'skull') {
    s.put('rbox:0.38', bone, 0, 1.66, 0.02, 0.72, 0.62, 0.66, 0, 0, 0, { grad: 0.1 });
    s.put('rbox:0.3', bone, 0, 1.38, 0.12, 0.46, 0.18, 0.42, 0, 0, 0, { grad: 0 });
    s.eye(0.16, 1.66, 0.33, 0.12, { white: '#1a0c18', pupil: o.eyeC || '#ff4a3a', pr: 0.45, glow: 1.2, ry: 0.2, noHi: true });
    s.eye(-0.16, 1.66, 0.33, 0.12, { white: '#1a0c18', pupil: o.eyeC || '#ff4a3a', pr: 0.45, glow: 1.2, ry: -0.2, noHi: true });
    s.put('cone:3', '#2a1a24', 0, 1.52, 0.34, 0.1, 0.1, 0.06, PI, 0, 0, { grad: 0 });
    for (let i = -2; i <= 2; i++) s.put('box', '#ffffff', i * 0.07, 1.4, 0.34, 0.05, 0.08, 0.04, 0, 0, 0, { grad: 0 });
  } else if (o.head === 'helm') {
    s.put('rbox:0.35', main, 0, 1.66, 0.0, 0.76, 0.7, 0.72, 0, 0, 0, { grad: 0.12 });
    s.put('box', '#120a18', 0, 1.64, 0.35, 0.56, 0.12, 0.04, 0, 0, 0, { grad: 0 });
    s.sym('box', o.eyeC || lt, 0.14, 1.64, 0.37, 0.12, 0.06, 0.03, 0, 0, 0.12, { grad: 0, glow: 1.4 });
    s.put('box', lt, 0, 1.78, 0.0, 0.08, 0.2, 0.76, 0, 0, 0, { grad: 0, glow: o.trimGlow || 0 });
    if (o.plume) s.tip('cone:5', o.plume, 0, 1.96, -0.1, -0.7, 0, 0, 0.22, 0.6, 0.12, { grad: -0.2 });
    if (o.horns) s.symTip('cone:5', o.horns, 0.32, 1.86, 0, 0, 0, -0.7, 0.14, 0.4, 0.14, { grad: -0.2 });
  }
  c.crown(0, 2.06, 0, 0.42);
  s.part(null);
  const armC = bone || main;
  for (const sd of [1, -1]) arm1(s, sd, { x: 0.45, sh: 1.24, len: 0.5, w: bone ? 0.09 : 0.2, col: armC, hand: bone || lt, hr: bone ? 0.14 : 0.22, out: 0.05, pose: sd < 0 ? [-2.6, 0, 0, 0] : [-0.9, 0.2, 0, 0] });
  // arme (main droite) + bouclier (main gauche)
  s.part([-0.45, 1.24, 0], { rx: 0.5, off: 0, pose: [-2.6, 0, 0, 0] });
  const W = o.weapon || STEEL;
  s.tip('cyl:4', '#4a3020', -0.53, 0.62, 0.02, 0.9, 0, 0, 0.07, 0.24);
  s.put('box', GOLD_D, -0.53, 0.65 + 0.12, 0.17, 0.32, 0.06, 0.08, 0.9, 0, 0, { grad: 0 });
  s.tip('box', W, -0.53, 0.75, 0.2, 0.9, 0, 0, 0.12, o.blade || 0.9, 0.04, { grad: -0.15, glow: o.bladeGlow || 0 });
  s.part(null);
  if (o.shield) {
    s.part([0.45, 1.24, 0], { rx: 0.5, off: PI, pose: [-0.9, 0.2, 0, 0] });
    s.put('cyl:8', o.shield, 0.62, 0.78, 0.12, 0.56, 0.08, 0.56, PI / 2, 0.5, 0, { grad: 0 });
    s.put('cyl:8', shade(o.shield, -0.3), 0.64, 0.78, 0.15, 0.62, 0.05, 0.62, PI / 2, 0.5, 0, { grad: 0 });
    s.put('sph:5:3', '#c8c0b0', 0.66, 0.78, 0.18, 0.14, 0.14, 0.08, 0, 0.5, 0, { grad: 0 });
    s.part(null);
  }
  c.h = 2.1;
}
function golem(c, o = {}) {
  const { s, P } = c, rock = o.col || P.m, dk = o.dk || P.d, acc = o.acc || P.l;
  legs2(s, { x: 0.3, hip: 0.62, len: 0.5, w: 0.38, col: dk, foot: shade(dk, -0.2), fl: 0.48, amp: 0.4, fw: 1.15 });
  s.put(o.ice ? 'oct' : 'dod', rock, 0, 1.2, 0, 1.4, 1.2, 1.05, 0, 0.3, 0, { grad: 0.3 });
  s.put('dod', shade(rock, -0.12), 0, 0.82, 0.05, 0.9, 0.5, 0.7, 0, 0.6, 0, { grad: 0.2 });
  if (o.moss) { s.put('sph:7:4', o.moss, 0, 1.68, -0.05, 1.2, 0.36, 0.9, 0, 0, 0, { grad: -0.2 }); s.sym('sph:6:4', o.moss, 0.6, 1.66, 0, 0.5, 0.26, 0.5); for (let i = 0; i < 4; i++) s.tip('cone:3', '#e8f070', -0.4 + i * 0.27, 1.8, -0.2 + (i % 2) * 0.3, 0, 0, 0, 0.1, 0.18 + (i % 2) * 0.08, 0.1, { grad: 0 }); }
  if (o.runes) { s.put('box', acc, 0, 1.25, 0.5, 0.1, 0.5, 0.05, 0, 0, 0, { grad: 0, glow: 1.3 }); s.put('box', acc, 0, 1.32, 0.5, 0.36, 0.08, 0.05, 0, 0, 0, { grad: 0, glow: 1.3 }); s.put('oct', acc, 0, 1.0, 0.48, 0.18, 0.24, 0.1, 0, 0, 0, { grad: 0, glow: 1.3 }); }
  if (o.crystals) for (let i = 0; i < 5; i++) { const a = -0.9 + i * 0.45; s.tip('oct', i % 2 ? acc : '#ffffff', Math.sin(a) * 0.5, 1.6, -0.25 + Math.abs(a) * 0.1, -0.35, 0, -a * 0.7, 0.3, 0.7 - Math.abs(i - 2) * 0.12, 0.3, { grad: -0.2, glow: 0.35 }); }
  if (c.elite) s.sym('cone:5', GOLD, 0.62, 1.7, 0, 0.18, 0.4, 0.18, 0, 0, -0.5, { glow: 0.25 });
  // tête enfoncée dans les épaules : fente des yeux lumineux
  s.part([0, 1.62, 0.15], { rx: 0.05, f: 2, off: 1, pose: [-0.3, 0, 0, 0] });
  s.put(o.ice ? 'oct' : 'rbox:0.25', rock, 0, 1.86, 0.25, 0.62, 0.5, 0.56, 0, o.ice ? PI / 4 : 0, 0, { grad: 0.1 });
  s.put('box', '#120a18', 0, 1.88, 0.52, 0.46, 0.12, 0.04, 0, 0, 0, { grad: 0 });
  s.sym('box', o.eye || acc, 0.12, 1.88, 0.54, 0.12, 0.08, 0.03, 0, 0, 0, { grad: 0, glow: 1.6 });
  c.crown(0, 2.18, 0.22, 0.4);
  s.part(null);
  // grands bras de pierre, poings énormes
  for (const sd of [1, -1]) {
    s.part([0.7 * sd, 1.58, 0], { rx: 0.4, off: sd > 0 ? PI : 0, pose: [-2.4, 0, 0, 0] });
    s.put(o.ice ? 'oct' : 'dod', rock, 0.78 * sd, 1.62, 0, 0.62, 0.5, 0.6, 0, 0.4, 0, { grad: 0.2 });
    s.put('rbox:0.3', dk, 0.84 * sd, 1.12, 0.02, 0.32, 0.6, 0.32, 0, 0, 0.08 * sd);
    s.put(o.ice ? 'oct' : 'dod', rock, 0.88 * sd, 0.68, 0.06, 0.58, 0.5, 0.58, 0, 0.7, 0, { grad: 0.2 });
  }
  s.part(null);
  c.body = [0.05, 0.08, 0, 0];
  c.h = 2.25;
}
function beast(c, o = {}) {
  const { s, P } = c, fur = o.col || P.m, dk = o.dk || P.d, lt = o.lt || P.l, eyeC = o.eye || '#ffe24a';
  for (const [sd, z, off] of [[1, 0.38, 0], [-1, 0.38, PI], [1, -0.48, PI], [-1, -0.48, 0]]) {
    s.part([0.25 * sd, 0.78, z], { rx: 0.65, off, body: 0 });
    s.put('rbox:0.35', dk, 0.25 * sd, 0.45, z, 0.18, 0.62, 0.2);
    s.put('rbox:0.3', shade(dk, -0.2), 0.25 * sd, 0.08, z + 0.06, 0.22, 0.14, 0.3);
  }
  s.part(null);
  s.put('rbox:0.4', fur, 0, 0.92, -0.08, 0.66, 0.56, 1.25, 0, 0, 0, { grad: 0.2 });
  s.put('sph:7:5', fur, 0, 1.0, 0.34, 0.78, 0.72, 0.66, 0, 0, 0, { grad: 0.2 });
  s.put('sph:6:4', lt, 0, 0.86, 0.5, 0.48, 0.46, 0.34, 0, 0, 0, { grad: 0.1 }); // poitrail
  if (o.spikes) for (let i = 0; i < 5; i++) s.tip('cone:4', o.spikes, 0, 1.16 - i * 0.02, 0.36 - i * 0.24, -0.5, 0, 0, 0.18, 0.4 - i * 0.04, 0.12, { grad: -0.2, glow: o.spikeGlow || 0 });
  if (c.elite) s.put('tor:0.15:4:10', GOLD, 0, 1.06, 0.48, 0.66, 0.66, 0.6, PI / 2 - 0.4, 0, 0, { glow: 0.2 });
  s.part([0, 1.0, 0.5], { rx: 0.07, f: 2, off: 1.2, pose: [-0.4, 0, 0, 0.05] });
  s.put('rbox:0.35', fur, 0, 1.24, 0.74, 0.58, 0.52, 0.56, 0, 0, 0, { grad: 0.12 });
  s.put('rbox:0.3', lt, 0, 1.1, 1.06, 0.32, 0.24, 0.38, 0, 0, 0, { grad: 0.1 });
  s.put('sph:5:3', INK, 0, 1.18, 1.25, 0.14, 0.1, 0.1, 0, 0, 0, { grad: 0 });
  s.put('box', '#3a1020', 0, 1.0, 1.08, 0.28, 0.04, 0.3, 0, 0, 0, { grad: 0 });
  s.symTip('cone:4', '#ffffff', 0.09, 1.02, 1.2, PI, 0, 0, 0.06, 0.12, 0.05, { grad: 0 });
  s.symTip('cone:4', fur, 0.18, 1.46, 0.66, -0.2, 0, -0.3, 0.2, 0.36, 0.14, { grad: -0.2 });
  eyes2(s, 0.15, 1.32, 1.0, 0.075, { white: o.white ?? '#ffffff', pupil: eyeC, glow: o.eyeGlow ?? 0.9, pr: 0.6, tall: 0.9, ry: 0.3 });
  brows2(s, 0.15, 1.42, 1.02, 0.18, dk, 0.4, 0.06);
  if (o.horns) s.symTip('cone:5', o.horns, 0.2, 1.48, 0.6, -0.5, 0, -0.4, 0.14, 0.42, 0.14, { grad: -0.2 });
  c.crown(0, 1.56, 0.72, 0.36);
  s.part([0, 1.0, -0.66], { ry: 0.45, f: 2 });
  s.tip('cone:5', fur, 0, 1.0, -0.66, -1.0, 0, 0, 0.2, 0.62, 0.2, { grad: -0.25 });
  s.part(null);
  c.body = [0.06, 0.03, 0, 0];
  c.h = 1.7;
}
// grand singe des neiges (debout)
function yeti(c) {
  const { s, P } = c, fur = P.m, dk = P.d, face = '#7aa8e8';
  legs2(s, { x: 0.28, hip: 0.6, len: 0.46, w: 0.36, col: fur, foot: '#8aa0c8', fl: 0.46, amp: 0.45 });
  s.put('sph:8:6', fur, 0, 1.18, 0, 1.3, 1.25, 1.0, 0, 0, 0, { grad: 0.2 });
  furPath(s, 0, 1.2, 0, 0.62, 16, fur, '#ffffff', 0.3);
  s.put('sph:6:4', '#dfe8fa', 0, 1.08, 0.36, 0.7, 0.7, 0.4);
  if (c.elite) s.sym('cone:5', GOLD, 0.5, 1.7, 0, 0.16, 0.36, 0.16, 0, 0, -0.5, { glow: 0.25 });
  s.part([0, 1.62, 0.1], { rx: 0.07, f: 2, off: 1, pose: [-0.4, 0, 0, 0.05] });
  s.put('sph:7:5', fur, 0, 1.9, 0.12, 0.8, 0.7, 0.7, 0, 0, 0, { grad: 0.1 });
  s.put('rbox:0.4', face, 0, 1.86, 0.36, 0.54, 0.44, 0.3, 0, 0, 0, { grad: 0.1 });
  eyes2(s, 0.12, 1.94, 0.5, 0.08, { pr: 0.55, ry: 0.2 });
  brows2(s, 0.12, 2.04, 0.52, 0.18, dk, 0.45, 0.07);
  s.put('box', '#2a1a3a', 0, 1.74, 0.52, 0.3, 0.08, 0.04, 0, 0, 0, { grad: 0 });
  s.symTip('cone:4', '#ffffff', 0.1, 1.77, 0.53, PI, 0, 0, 0.07, 0.12, 0.05, { grad: 0 });
  s.symTip('cone:5', '#c8d8f0', 0.3, 2.14, 0.08, -0.3, 0, -0.5, 0.14, 0.34, 0.14, { grad: -0.2 });
  c.crown(0, 2.3, 0.1, 0.38);
  s.part(null);
  for (const sd of [1, -1]) {
    s.part([0.62 * sd, 1.55, 0], { rx: 0.45, off: sd > 0 ? PI : 0, pose: [-2.5, 0, 0, 0] });
    s.put('rbox:0.4', fur, 0.72 * sd, 1.05, 0.02, 0.38, 0.95, 0.38, 0, 0, 0.1 * sd, { grad: 0.1 });
    s.put('sph:6:4', face, 0.78 * sd, 0.52, 0.06, 0.38, 0.34, 0.38);
  }
  s.part(null);
  c.body = [0.06, 0.07, 0, 0];
  c.h = 2.3;
}
function bird(c, o = {}) {
  const { s, P } = c, col = o.col || P.m, dk = o.dk || P.d, lt = o.lt || P.l, beak = o.beak || '#ffb02a';
  for (const [sd] of L2) { s.part([0.16 * sd, 0.32, 0], { rx: 0.3, off: sd > 0 ? 0 : PI, body: 0 }); s.put('cyl:4', beak, 0.16 * sd, 0.2, 0, 0.06, 0.26, 0.06); s.put('rbox:0.3', beak, 0.16 * sd, 0.07, 0.06, 0.16, 0.06, 0.2, 0, 0, 0, { grad: 0 }); }
  s.part(null);
  s.put('sph:8:6', col, 0, 0.72, 0, 1.0, 0.9, 0.96, 0, 0, 0, { grad: 0.25 });
  s.put('sph:7:5', lt, 0, 0.62, 0.3, 0.66, 0.6, 0.42, 0, 0, 0, { grad: 0.1 });
  s.tip('cone:4', dk, 0, 0.72, -0.4, -2.0, 0, 0, 0.42, 0.42, 0.1, { grad: 0 });
  s.tip('cone:4', col, 0.12, 0.72, -0.42, -2.1, 0, 0.3, 0.3, 0.36, 0.08, { grad: 0 });
  s.tip('cone:4', col, -0.12, 0.72, -0.42, -2.1, 0, -0.3, 0.3, 0.36, 0.08, { grad: 0 });
  // tête intégrée : yeux en colère, gros bec
  eyes2(s, 0.18, 0.92, 0.4, 0.12, { pr: 0.55, tall: 1.1, ry: 0.35, white: o.white ?? '#ffffff', pupil: o.pupil || INK, glow: o.eyeGlow || 0 });
  if (o.angry !== false) brows2(s, 0.18, 1.05, 0.44, 0.22, dk, 0.5, 0.06);
  s.tip('cone:4', beak, 0, 0.78, 0.42, PI / 2 - 0.15, PI / 4, 0, 0.3, 0.4, 0.24, { grad: 0.2 });
  s.tip('cone:4', shade(beak, -0.2), 0, 0.72, 0.42, PI / 2 + 0.3, PI / 4, 0, 0.22, 0.26, 0.18, { grad: 0 });
  if (o.crest !== false) for (let i = -1; i <= 1; i++) s.tip('cone:4', o.crest || dk, i * 0.1, 1.12, 0.06 - Math.abs(i) * 0.05, -0.45 - Math.abs(i) * 0.2, 0, -i * 0.4, 0.12, 0.32 - Math.abs(i) * 0.06, 0.08, { grad: -0.2, glow: o.crestGlow || 0 });
  if (o.hat) {
    s.put('cyl:8', o.hat, 0, 1.18, 0.0, 0.86, 0.08, 0.8, -0.1, 0, 0, { grad: 0 });
    s.put('frust:0.28:0.36:6', o.hat, 0, 1.3, -0.02, 1, 0.26, 0.92, -0.1, 0, 0, { grad: 0.1 });
    s.sym('rbox:0.4', o.hat, 0.32, 1.26, 0, 0.3, 0.24, 0.62, 0, 0, -0.55, { grad: 0 });
    s.put('sph:5:3', '#ffffff', 0, 1.32, 0.34, 0.16, 0.14, 0.06, 0, 0, 0, { grad: 0, glow: 0.2 });
  }
  if (o.patch) { s.put('cyl:8', INK, 0.18, 0.92, 0.47, 0.26, 0.04, 0.26, PI / 2, 0.35, 0, { grad: 0 }); s.put('box', INK, 0, 0.98, 0.34, 0.9, 0.04, 0.04, 0, 0, -0.3, { grad: 0 }); }
  c.crown(0, o.hat ? 1.48 : 1.25, 0, 0.36);
  // ailes qui battent
  for (const [sd] of L2) {
    s.part([0.42 * sd, 0.82, 0], { rz: 0.85 * sd, f: 2.6, pose: [0, 0.5 * sd, 0, 0] });
    s.put('rbox:0.4', col, 0.78 * sd, 0.86, -0.04, 0.74, 0.1, 0.46, 0, 0, 0.2 * sd, { grad: 0 });
    for (let i = 0; i < 3; i++) s.tip('cone:4', i === 1 ? dk : col, (1.0 + i * 0.04) * sd, 0.9, 0.12 - i * 0.18, 0, 0, -sd * 1.4, 0.2, 0.36 - i * 0.06, 0.06, { grad: 0 });
  }
  s.part(null);
  c.body = [0.12, 0.06, 0, 1];
  c.h = o.hat ? 1.5 : 1.3;
}
function crab(c, o = {}) {
  const { s, P } = c, col = o.col || P.m, dk = o.dk || P.d, lt = o.lt || P.l, nL = o.legs || 3, kind = o.kind || 'crab';
  for (const [sd] of L2) for (let i = 0; i < nL; i++) {
    const z = (nL === 4 ? 0.36 : 0.3) - i * (nL === 4 ? 0.24 : 0.3), off = (i + (sd > 0 ? 0 : 1)) % 2 ? PI : 0, ax = 0.42 * sd;
    s.part([ax, 0.5, z], { rz: 0.28 * sd, ry: 0.22, off, body: 0, f: 1.5 });
    const kx = (kind === 'spider' ? 0.95 : 0.8) * sd, ky = kind === 'spider' ? 0.82 : 0.55;
    s.seg('rbox:0.3', dk, [ax, 0.5, z], [kx, ky, z * 1.25], 0.1, 0.1);
    s.seg('rbox:0.3', dk, [kx, ky, z * 1.25], [(kind === 'spider' ? 1.2 : 1.05) * sd, 0.02, z * 1.5], 0.09, 0.09);
  }
  s.part(null);
  if (kind === 'spider') {
    s.put('sph:7:5', col, 0, 0.62, 0.12, 0.8, 0.56, 0.72, 0, 0, 0, { grad: 0.2 });
    s.put('sph:8:6', dk, 0, 0.82, -0.5, 1.0, 0.86, 1.0, 0, 0, 0, { grad: 0.25 });
    s.put('sph:6:4', lt, 0, 1.0, -0.62, 0.42, 0.24, 0.4, 0, 0, 0, { grad: 0, glow: 0.5 });
    for (const [x, y, r] of [[0.13, 0.74, 0.08], [-0.13, 0.74, 0.08], [0.24, 0.66, 0.05], [-0.24, 0.66, 0.05], [0.07, 0.62, 0.05], [-0.07, 0.62, 0.05]]) s.put('sph:5:3', lt, x, y, 0.46, r * 2, r * 2, r, 0, 0, 0, { grad: 0, glow: 1.4 });
    s.symTip('cone:4', '#e8e0d0', 0.08, 0.5, 0.44, PI + 0.3, 0, 0, 0.07, 0.18, 0.07, { grad: 0 });
    c.crown(0, 1.3, -0.5, 0.38);
  } else if (kind === 'beetle') {
    s.put('sph:8:6', dk, 0, 0.62, 0, 1.0, 0.6, 1.2, 0, 0, 0, { grad: 0.2 });
    s.put('sph:8:6', col, 0.24, 0.78, -0.12, 0.5, 0.5, 1.15, 0, 0, -0.15, { grad: 0.2, glow: 0.05 });
    s.put('sph:8:6', col, -0.24, 0.78, -0.12, 0.5, 0.5, 1.15, 0, 0, 0.15, { grad: 0.2, glow: 0.05 });
    s.put('box', lt, 0, 0.98, -0.12, 0.04, 0.06, 1.0, 0, 0, 0, { grad: 0, glow: 1 });
    s.put('rbox:0.3', dk, 0, 0.66, 0.58, 0.5, 0.36, 0.34, 0, 0, 0, { grad: 0.1 });
    s.tip('cone:5', lt, 0, 0.78, 0.66, 0.5, 0, 0, 0.16, 0.6, 0.16, { grad: -0.2, glow: 0.6 });
    eyes2(s, 0.17, 0.7, 0.74, 0.07, { white: '#1a0c18', pupil: lt, glow: 1.3, noHi: true, ry: 0.4 });
    c.crown(0, 1.22, 0.1, 0.36);
  } else {
    s.put('sph:8:6', col, 0, 0.58, 0, 1.3, 0.62, 1.0, 0, 0, 0, { grad: 0.25 });
    s.put('sph:7:4', lt, 0, 0.72, -0.04, 0.9, 0.36, 0.7, 0, 0, 0, { grad: 0 });
    for (let i = -1; i <= 1; i++) s.put('cone:4', lt, i * 0.3, 0.88, -0.1, 0.14, 0.16, 0.14, 0, 0, 0, { grad: 0 });
    // yeux pédonculés
    for (const sd of [1, -1]) {
      s.part([0.18 * sd, 0.82, 0.32], { rz: 0.12 * sd, f: 2, off: sd > 0 ? 0 : 1 });
      s.put('cyl:4', col, 0.18 * sd, 0.94, 0.32, 0.07, 0.3, 0.07);
      s.eye(0.18 * sd, 1.1, 0.36, 0.11, { pr: 0.5, tall: 1, ry: 0.2 * sd, flat: 0.9 });
    }
    s.part(null);
    s.put('box', '#3a1020', 0, 0.52, 0.5, 0.28, 0.05, 0.04, 0, 0, 0, { grad: 0 });
    c.crown(0, 1.0, -0.15, 0.36);
  }
  if (o.claws !== false) {
    const big = o.big || 1;
    for (const sd of [1, -1]) {
      const k = sd > 0 ? big : 1;
      s.part([0.42 * sd, 0.55, 0.38], { rx: 0.22, off: sd > 0 ? 0 : PI, pose: [-0.9, 0, 0, 0] });
      s.seg('rbox:0.3', dk, [0.42 * sd, 0.55, 0.38], [0.62 * sd, 0.66, 0.7], 0.14 * k, 0.14 * k);
      s.put('sph:6:4', col, 0.66 * sd, 0.7, 0.86, 0.36 * k, 0.3 * k, 0.4 * k, 0, 0, 0, { grad: 0.2 });
      s.tip('cone:4', col, 0.6 * sd, 0.8, 0.98, 1.1, 0, 0, 0.18 * k, 0.4 * k, 0.12 * k, { grad: 0 });
      s.tip('cone:4', lt, 0.72 * sd, 0.66, 0.98, 1.9, 0, 0, 0.14 * k, 0.32 * k, 0.1 * k, { grad: 0 });
    }
    s.part(null);
  }
  c.body = [0.04, 0.04, 0, 0];
  c.h = kind === 'spider' ? 1.3 : 1.2;
}
function ghost(c, o = {}) {
  const { s, P } = c, col = o.col || P.m, dk = o.dk || P.d, lt = o.lt || P.l, g = o.glow ?? 0.25;
  s.put('sph:8:6', col, 0, 1.02, 0, 0.92, 0.9, 0.86, 0, 0, 0, { grad: 0.1, glow: g });
  s.put('frust:0.46:0.2:8', col, 0, 0.52, 0, 1, 0.6, 0.92, 0, 0, 0, { grad: -0.2, glow: g });
  // traîne ondulante
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * TAU;
    s.part([Math.cos(a) * 0.2, 0.3, Math.sin(a) * 0.2], { sway: 0.08, rx: 0.25, f: 1.5, off: i * 1.3 });
    s.tip('cone:4', i % 2 ? col : dk, Math.cos(a) * 0.2, 0.32, Math.sin(a) * 0.2, PI + Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4, 0.24, 0.36, 0.24, { grad: 0, glow: g });
  }
  s.part(null);
  if (o.hood) {
    s.put('rbox:0.45', o.hood, 0, 1.22, -0.08, 1.0, 0.82, 0.92, 0, 0, 0, { grad: 0.1 });
    s.tip('cone:5', o.hood, 0, 1.52, -0.3, -1.0, 0, 0, 0.5, 0.5, 0.4, { grad: 0 });
    s.put('sph:7:5', '#0a0612', 0, 1.06, 0.3, 0.66, 0.6, 0.3, 0, 0, 0, { grad: 0 });
    for (let i = 0; i < 5; i++) s.tip('cone:4', o.hood, -0.4 + i * 0.2, 0.62, -0.05 + Math.abs(i - 2) * 0.06, PI, 0, 0, 0.2, 0.36, 0.2, { grad: 0 });
    eyes2(s, 0.14, 1.08, 0.42, 0.075, { white: null, pupil: o.eye || lt, glow: 1.8, pr: 1, noHi: true, ry: 0.2 });
  } else if (o.spooky) {
    s.eye(0.18, 1.08, 0.38, 0.12, { white: '#140a20', pupil: o.eye || lt, glow: 1.6, pr: 0.5, ry: 0.3, noHi: true });
    s.eye(-0.18, 1.08, 0.38, 0.12, { white: '#140a20', pupil: o.eye || lt, glow: 1.6, pr: 0.5, ry: -0.3, noHi: true });
    s.put('sph:6:4', '#140a20', 0, 0.86, 0.42, 0.22, 0.2, 0.08, 0, 0, 0, { grad: 0 });
  } else {
    eyes2(s, 0.17, 1.1, 0.38, 0.12, { pr: 0.66, tall: 1.25, ry: 0.3 });
    s.put('sph:6:4', '#3a1030', 0, 0.9, 0.42, 0.16, 0.12, 0.06, 0, 0, 0, { grad: 0 });
  }
  if (o.crown2) for (let i = -2; i <= 2; i++) s.tip('oct', o.crown2, i * 0.14, 1.4, 0.05 - Math.abs(i) * 0.04, -0.1, 0, -i * 0.28, 0.12, 0.42 - Math.abs(i) * 0.08, 0.12, { glow: 0.7 });
  if (o.flame) for (let i = -1; i <= 1; i++) s.tip('cone:5', o.flame, i * 0.18, 1.32, -0.08, -0.3, 0, -i * 0.5, 0.3, 0.55 - Math.abs(i) * 0.15, 0.3, { grad: -0.3, glow: 0.8 });
  if (o.hair) for (let i = 0; i < 4; i++) { s.part([0, 1.3, -0.2], { sway: 0.06, f: 1.5, off: i }); s.tip('cone:4', o.hair, -0.3 + i * 0.2, 1.3, -0.2, -2.0, 0, (i - 1.5) * 0.3, 0.2, 0.8, 0.12, { grad: -0.2, glow: 0.5 }); }
  s.part(null);
  c.crown(0, 1.5, 0, 0.38);
  for (const [sd] of L2) {
    s.part([0.42 * sd, 1.0, 0.1], { rz: 0.35 * sd, off: sd > 0 ? 0 : 1.2, f: 1.4, pose: [-1.2, 0.3 * sd, 0, 0] });
    s.tip('cone:5', col, 0.42 * sd, 1.0, 0.1, 0.3, 0, -sd * 2.2, 0.22, 0.42, 0.22, { grad: -0.1, glow: g });
  }
  s.part(null);
  c.body = [0.14, 0.05, 0, 1];
  c.ghost = o.alpha ?? 1; // opaques et lumineux (un alpha < 0,85 passe dans le lot tramé)
  c.h = 1.5;
}
function worm(c, o = {}) {
  const { s, P } = c, col = o.col || P.m, dk = o.dk || P.d, lt = o.lt || P.l, n = o.segs || 5;
  for (let i = n - 1; i >= 1; i--) {
    const r = 0.5 - i * 0.05, z = -i * 0.42;
    s.part([0, r, z], { sway: 0.16, bob: 0.06, off: -i * 0.9, body: 0 });
    s.put('sph:7:5', i % 2 ? col : shade(col, -0.08), 0, r * 0.95, z, r * 2.1, r * 1.9, r * 1.6, 0, 0, 0, { grad: 0.25 });
    s.put('tor:0.12:3:8', dk, 0, r * 0.95, z + r * 0.62, r * 1.7, r * 1.6, r * 1, 0, 0, 0, { grad: 0 });
    if (o.spikes) s.tip('cone:4', o.spikes, 0, r * 1.8, z, -0.3, 0, 0, 0.16, 0.3, 0.16, { grad: -0.2, glow: o.spikeGlow || 0.3 });
    if (o.legs) for (const sd of [1, -1]) s.put('cone:3', dk, 0.4 * sd, 0.12, z, 0.1, 0.22, 0.1, 0, 0, sd * 2.6, { grad: 0 });
  }
  // tête (relevée)
  s.part([0, 0.5, 0.1], { sway: 0.06, rx: 0.08, off: 0.6, body: 0, pose: [-0.5, 0, 0, 0.15] });
  s.put('sph:8:6', col, 0, 0.7, 0.2, 1.0, 1.0, 0.95, 0, 0, 0, { grad: 0.2 });
  if (o.maw) {
    s.put('sph:7:5', '#3a0a20', 0, 0.68, 0.6, 0.66, 0.66, 0.24, 0, 0, 0, { grad: 0 });
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; s.tip('cone:4', '#fff0e8', Math.cos(a) * 0.3, 0.68 + Math.sin(a) * 0.3, 0.64, 0, 0, a + PI / 2, 0.08, 0.2, 0.06, { grad: 0 }); }
    s.symTip('sph:5:3', lt, 0.32, 1.02, 0.38, 0, 0, 0, 0.16, 0.12, 0.12, { glow: 1.4 });
  } else {
    eyes2(s, 0.2, 0.86, 0.6, 0.11, { pr: 0.6, ry: 0.35, pupil: o.pupil || INK, glow: o.eyeGlow || 0 });
    s.symTip('cone:4', dk, 0.14, 0.5, 0.62, 1.4, 0, -0.3, 0.1, 0.24, 0.08, { grad: 0 }); // mandibules
    s.put('box', '#3a1020', 0, 0.56, 0.66, 0.2, 0.05, 0.04, 0, 0, 0, { grad: 0 });
  }
  if (o.antennae) s.symTip('cyl:4', dk, 0.14, 1.14, 0.2, -0.4, 0, -0.3, 0.05, 0.4, 0.05);
  c.crown(0, 1.24, 0.2, 0.38);
  s.part(null);
  c.body = [0, 0, 0, 0];
  c.h = 1.3;
}

// ---------- Répartition par nom (zones 0 à 5) ----------
const MON = {
  'Gobelin bagarreur': gobBrawler, 'Gobelin lanceur': gobSpear,
  'Boule de poils': c => furball(c, { col: '#f4f4f8', col2: '#d8dce8', horns: '#c8a070' }),
  'Canonnier gobelin': cannonCart, 'Ogre cogneur': ogre,
  'Piaf vorace': c => bird(c, {}),
  'Crapaud gluant': c => blob(c, { R: 0.7, flat: 0.62, mouth: 'wide', belly: '#d8f0a0', angry: true, hop: 0.24, sq: 0.1, white: '#fff4a0' }),
  'Loup des ombres': c => beast(c, { eye: '#ffe24a' }),
  'Golem moussu': c => golem(c, { moss: '#5aa83a', eye: '#b8ff5a' }),
  'Gardien de pierre bleue': c => golem(c, { runes: true }),
  'Crabe trotteur': c => crab(c, {}),
  'Gloop des eaux': c => blob(c, { dome: true, R: 0.68, flat: 0.95, shine: true, drop: true, feet: false, glow: 0.12, hop: 0.12, sq: 0.12 }),
  'Mouette pirate': c => bird(c, { col: '#f4f4f0', dk: '#c8c8c0', lt: '#ffffff', beak: '#ffb02a', hat: '#2a2030', patch: true, crest: false }),
  'Crabe géant': c => crab(c, { big: 1.6 }),
  'Ombre aquatique': c => ghost(c, { spooky: true, hair: '#7affe8', eye: '#ffffff' }),
  'Boule de neige vivante': c => furball(c, { col: '#f0f6ff', col2: '#ffffff', n: 20, foot: '#a8b8d8' }),
  'Yéti des glaces': yeti,
  'Esprit du givre': c => ghost(c, { crown2: '#e0f8ff', eye: '#ffffff', spooky: true }),
  'Golem de glace': c => golem(c, { ice: true, crystals: true, eye: '#ffffff' }),
  'Chevalier de givre': c => biped(c, { head: 'helm', plume: '#e8f8ff', shield: '#5a7ab8', weapon: '#bff0ff', bladeGlow: 0.5, eyeC: '#9af0ff', tabard: '#a8c0f0' }),
  'Âme errante': c => ghost(c, { flame: '#7affc8' }),
  'Squelette maudit': c => biped(c, { bone: '#e8e0c8', head: 'skull', shield: '#7a5a3a', weapon: '#b8bcc8', eyeC: '#ff5a3a' }),
  'Araignée de brume': c => crab(c, { kind: 'spider', legs: 4, claws: false }),
  'Revenant': c => ghost(c, { hood: '#3a4a48', eye: '#7affd0' }),
  'Chevalier déchu': c => biped(c, { head: 'helm', horns: '#d8d0c0', cape: '#1a2a28', shield: '#2a3a38', weapon: '#7affd0', bladeGlow: 0.7, eyeC: '#7affd0', trimGlow: 0.4 }),
  'Larve du Néant': c => worm(c, { antennae: true, eyeGlow: 0.3, pupil: '#ff4ad8' }),
  'Rôdeur abyssal': c => beast(c, { spikes: '#c0a0ff', spikeGlow: 0.6, eye: '#ff4ad8', horns: '#e0d0ff' }),
  'Œil du Néant': c => { blob(c, { oneEye: true, R: 0.6, flat: 1, feet: false, pupil: '#ff2ab8', eyeGlow: 1.1, mouth: false, hop: 0.06, sq: 0.04, tentacles: true }); c.s.part(null); },
  'Scarabée du Néant': c => crab(c, { kind: 'beetle', claws: false }),
  'Dévoreur affamé': c => worm(c, { maw: true, segs: 6, spikes: '#ffa0c0' }),
};
const BODY = { blob, humanoid: c => goblinBody(c, { hat: 'band' }), golem, beast, bird, crab, ghost, worm };
export const BOSS = {}; // rempli par models-bosses.js

// ---------- Construction (mise en cache par type + variante) ----------
const BUILT = new Map();
function buildDef(def, v, lod = false) {
  const key = def.name + ':' + v + (lod ? ':lod' : '');
  if (BUILT.has(key)) return BUILT.get(key);
  const s = new Shape(true); s.lo = v !== 'b'; s.lod = lod; // lod : facettes réduites (foule de monstres)
  const P = { m: def.pal[0], d: def.pal[1], l: def.pal[2] };
  const c = { s, P, v, def, elite: v === 'e', boss: v === 'b', h: 2, body: [0.05, 0.05, 0, 0], ghost: 0, crown: () => {} };
  if (c.elite) c.crown = (x, y, z, w) => crown(s, x, y, z, w);
  const fn = (v === 'b' && BOSS[def.name]) || MON[def.name] || BODY[def.body] || blob;
  fn(c);
  // un peu plus grands que leur rayon de collision (lisibilité, gabarit proche du héros)
  const k = (c.k || 1) * (v === 'b' ? BOSS_K : MON_K);
  if (k !== 1) { s.scaleAll(k); c.h *= k; c.body = c.body.map((x, i) => (i === 0 ? x * k : x)); }
  const out = { s, h: c.h, body: c.body, ghost: c.ghost, extra: c.extra || null };
  BUILT.set(key, out);
  return out;
}
export function monsterHeight(def, v = 'n') { return buildDef(def, v).h; }

// ---------- Pool d'instances ----------
const _m = new THREE.Matrix4();
// un lot = un InstancedMesh + ses attributs d'instance ; le pool en a deux : opaque (le plus courant) et « fondu »
// (alpha tramé, créé à la demande pour les traînées de charge, les morts qui s'effacent, etc.)
class Batch {
  constructor(pool, base, max, fade) {
    this.max = max;
    const g = this.geo = new THREE.BufferGeometry();
    for (const k in base.attributes) g.setAttribute(k, base.attributes[k]);
    this.iA = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.iB = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iA', this.iA); g.setAttribute('iB', this.iB);
    g.boundingSphere = base.boundingSphere;
    const mat = this.mat = charMaterial({ anim: true, alphaHash: fade, rim: 0.45, parts: pool.parts });
    mat.userData.U.uBody.value.copy(pool.uBody);
    const m = this.mesh = new THREE.InstancedMesh(g, mat, max);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false; m.count = 0; m.visible = false;
    m.name = 'mon:' + pool.def.name + ':' + pool.v + (fade ? ':fondu' : '');
    this.n = 0;
  }
  grow() {
    const max = this.max * 2, mesh = this.mesh;
    const im = new THREE.InstancedBufferAttribute(new Float32Array(max * 16), 16).setUsage(THREE.DynamicDrawUsage);
    im.array.set(mesh.instanceMatrix.array); mesh.instanceMatrix = im;
    for (const k of ['iA', 'iB']) { const a = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage); a.array.set(this[k].array); this[k] = a; this.geo.setAttribute(k, a); }
    this.max = max;
  }
  end() {
    const m = this.mesh, n = this.n;
    m.count = n; m.visible = n > 0;
    if (!n) return;
    // n'envoie au GPU que les instances utilisées
    const im = m.instanceMatrix; im.clearUpdateRanges(); im.addUpdateRange(0, n * 16); im.needsUpdate = true;
    for (const at of [this.iA, this.iB]) { at.clearUpdateRanges(); at.addUpdateRange(0, n * 4); at.needsUpdate = true; }
  }
  dispose() { this.geo.dispose(); this.mat.dispose(); }
}

export class MonsterPool {
  constructor(scene, def, variant = 'n', max = 64) {
    const B = buildDef(def, variant);
    this.def = def; this.v = variant; this.scene = scene; this.height = B.h; this.alpha = B.ghost || 1;
    this.base = B.s.geometry();
    this.parts = B.s.partUniforms(); this.uBody = new THREE.Vector4(...B.body);
    this.main = new Batch(this, this.base, Math.max(1, max | 0), false);
    this.fade = null;
    this.mesh = this.main.mesh; this.geo = this.base;
    this.extra = B.extra ? B.extra(this) : null; // boss : effets propres
    scene.add(this.mesh);
  }
  get n() { return this.main.n + (this.fade ? this.fade.n : 0) + (this.lo ? this.lo.n : 0); }
  begin() { this.main.n = 0; if (this.fade) this.fade.n = 0; if (this.lo) this.lo.n = 0; }
  // lot allégé (moins de facettes) utilisé quand le moteur signale une foule (useLo) ; créé à la demande
  loBatch() {
    if (!this.lo) { this.baseLo = buildDef(this.def, 'n', true).s.geometry(); this.lo = new Batch(this, this.baseLo, this.main.max, false); this.lo.mesh.name += ':lod'; this.scene.add(this.lo.mesh); }
    return this.lo;
  }
  add(e, s) {
    // translucide (alpha < 0,85) → lot tramé ; sinon lot opaque
    const al = (s.alpha ?? 1) * this.alpha;
    let L = this.useLo && this.v === 'n' && !this.extra ? this.loBatch() : this.main;
    if (al < 0.85) {
      if (al <= 0.02) return;
      if (!this.fade) { this.fade = new Batch(this, this.base, 16, true); this.scene.add(this.fade.mesh); }
      L = this.fade;
    }
    if (L.n >= L.max) L.grow();
    const i = L.n++, te = L.mesh.instanceMatrix.array, o = i * 16;
    const big = this.v !== 'n', sq = s.sq || 0, k = big ? (this.v === 'b' ? 0.3 : 0.6) : 1;
    const sc = s.scale || 1, sx = sc * (1 + sq * 0.16 * k), sy = sc * (1 - sq * 0.12 * k);
    const a = yawOf(s.rot || 0), cs = Math.cos(a), sn = Math.sin(a);
    te[o] = cs * sx; te[o + 1] = 0; te[o + 2] = -sn * sx; te[o + 3] = 0;
    te[o + 4] = 0; te[o + 5] = sy; te[o + 6] = 0; te[o + 7] = 0;
    te[o + 8] = sn * sx; te[o + 9] = 0; te[o + 10] = cs * sx; te[o + 11] = 0;
    te[o + 12] = s.x; te[o + 13] = s.y || 0; te[o + 14] = s.z; te[o + 15] = 1;
    // pose (élan d'attaque, rugissement) lissée sur l'entité
    let pw = 0;
    const act = e && e.act;
    if (act && act.stage === 0) pw = 1; else if (act) pw = 0.35;
    if (e && e.boss && (e.phase === 'intro' || e.phase === 'roar' || e.phase === 'aim' || e.phase === 'ringW' || e.phase === 'summonW')) pw = 1;
    if (e && L !== this.fade) { e._m3p = (e._m3p || 0) + (pw - (e._m3p || 0)) * 0.25; pw = e._m3p; } else if (e) pw = e._m3p || 0;
    const A = L.iA.array, Bb = L.iB.array, q = i * 4;
    A[q] = s.anim || 0; A[q + 1] = clamp((s.flash || 0) * (big ? 0.55 : 1), 0, 1); A[q + 2] = al; A[q + 3] = s.mad ? 0.8 : 0;
    Bb[q] = pw; Bb[q + 1] = s.freeze ? 1 : 0; Bb[q + 2] = s.mad ? 1 : 0; Bb[q + 3] = 0;
    if (this.extra) this.extra.add(e, s, i);
  }
  end() {
    this.main.end(); if (this.fade) this.fade.end(); if (this.lo) this.lo.end();
    if (this.extra) this.extra.end(this.n);
  }
  dispose() {
    this.scene.remove(this.main.mesh); this.main.dispose();
    if (this.fade) { this.scene.remove(this.fade.mesh); this.fade.dispose(); }
    if (this.lo) { this.scene.remove(this.lo.mesh); this.lo.dispose(); this.baseLo.dispose(); }
    this.base.dispose();
    if (this.extra) this.extra.dispose();
  }
}

// ---------- Familiers : versions bébés, un seul exemplaire ----------
// bébé tout rond : gros yeux brillants, joues roses, petits pieds, accessoires propres à chaque familier
function chibi(c, o = {}) {
  const { s, P } = c, col = o.col || P.m, dk = o.dk || P.d, lt = o.lt || P.l, R = 0.62;
  if (!o.float) { for (const [sd, off] of L2) { s.part([0.24 * sd, 0.24, 0.05], { rx: 0.5, off, body: 0 }); s.put('sph:6:4', dk, 0.25 * sd, 0.1, 0.12, 0.3, 0.2, 0.38); } s.part(null); }
  const cy = R + 0.12;
  s.put(o.ico ? 'ico:1' : 'sph:9:7', col, 0, cy, 0, R * 2.1, R * 1.95, R * 1.95, 0, 0, 0, { grad: 0.22, glow: o.glow || 0 });
  s.put('sph:7:5', lt, 0, cy - 0.16, R * 0.55, R * 1.1, R * 1.0, R * 0.7, 0, 0, 0, { grad: 0.05, glow: o.glow || 0 });
  eyes2(s, 0.25, cy + 0.08, R * 0.84, 0.15, { pr: 0.72, tall: 1.25, ry: 0.32, pupil: o.pupil || INK, glow: o.eyeGlow || 0 });
  s.sym('sph:5:3', '#ff9ab0', 0.42, cy - 0.1, R * 0.74, 0.16, 0.08, 0.05, 0, 0.6, 0, { grad: 0 });
  s.put('sph:5:3', '#7a2a3a', 0, cy - 0.14, R * 0.94, 0.12, 0.07, 0.05, 0, 0, 0, { grad: 0 });
  if (o.extra) o.extra(s, cy, R, col, dk, lt);
  if (o.wings) for (const [sd] of L2) { s.part([0.55 * sd, cy, 0], { rz: 0.7 * sd, f: 2.5 }); s.put('rbox:0.45', o.wings, 0.72 * sd, cy + 0.05, -0.05, 0.42, 0.1, 0.3, 0, 0, 0.35 * sd, { glow: 0.3 }); }
  s.part(null);
  c.body = [o.float ? 0.1 : 0.06, 0.06, 0.05, o.float ? 1 : 0];
  c.h = cy + R + 0.2;
}
const PET = {
  poro: c => furball(c, { col: '#f8f8fc', col2: '#e0e4f0', horns: '#d8b080', R: 0.6 }),
  brambi: c => chibi(c, { extra: (s, cy, R) => {
    for (let i = 0; i < 9; i++) { const a = i * 2.4, y = 0.5 - (i % 3) * 0.35; s.tip('cone:4', '#e8c8a0', Math.cos(a) * R * 0.95, cy + y * R, Math.sin(a) * R * 0.95 - 0.05, Math.sin(a) * 1.2, 0, -Math.cos(a) * 1.2, 0.08, 0.18, 0.08, { grad: 0 }); }
    s.tip('cone:5', '#5aa83a', 0.1, cy + R * 0.9, 0, 0, 0, -0.5, 0.12, 0.3, 0.12); s.put('sph:5:3', '#7ad04a', 0.24, cy + R * 1.18, 0, 0.26, 0.1, 0.16, 0, 0, -0.4);
    for (let i = -1; i <= 1; i++) s.tip('cone:4', i ? '#ff8a2a' : '#ffd54a', i * 0.12 - 0.12, cy + R * 0.85, 0.05, 0, 0, -i * 0.4, 0.14, 0.36 - Math.abs(i) * 0.12, 0.14, { glow: 1.2 });
  } }),
  herald: c => chibi(c, { extra: (s, cy, R, col, dk, lt) => {
    s.symTip('cone:5', '#f0e0ff', 0.22, cy + R * 0.8, 0, -0.4, 0, -0.4, 0.1, 0.3, 0.1);
    for (let i = 0; i < 3; i++) s.tip('wedge', '#ff6ad8', 0, cy + R * 0.7 - i * 0.25, -R * 0.6 - i * 0.08, -1.0 - i * 0.3, 0, 0, 0.06, 0.28, 0.24, { glow: 0.3 });
    s.symTip('wedge', '#ff6ad8', R * 0.9, cy, 0, 0, 0, -1.3, 0.06, 0.32, 0.26, { glow: 0.3 });
    s.part([0, 0.3, -R * 0.8], { ry: 0.5, f: 2 }); s.tip('cone:5', col, 0, 0.3, -R * 0.8, -1.4, 0, 0, 0.3, 0.5, 0.3); s.part(null);
  } }),
  phenix: c => chibi(c, { wings: '#bfeaff', float: true, extra: (s, cy, R) => {
    for (let i = -1; i <= 1; i++) s.tip('oct', '#e0f8ff', i * 0.14, cy + R * 0.85, -0.05, -0.3, 0, -i * 0.4, 0.14, 0.38 - Math.abs(i) * 0.1, 0.14, { glow: 0.7 });
    s.tip('cone:4', '#ffd54a', 0, cy - 0.04, R * 0.92, PI / 2 - 0.2, PI / 4, 0, 0.16, 0.2, 0.16);
  } }),
  wisp: c => chibi(c, { float: true, glow: 0.5, eyeGlow: 0.2, extra: (s, cy, R) => {
    s.put('frust:0.22:0.3:6', '#3a3a30', 0, cy + R * 0.98, 0, 1, 0.12, 1, 0, 0, 0, { grad: 0 });
    s.put('tor:0.15:4:8', '#3a3a30', 0, cy + R * 1.18, 0, 0.26, 0.26, 0.26, 0, 0, 0, { grad: 0 });
    s.put('frust:0.32:0.22:6', '#3a3a30', 0, 0.16, 0, 1, 0.1, 1, 0, 0, 0, { grad: 0 });
    for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + PI / 4; s.put('box', '#3a3a30', Math.cos(a) * R * 0.98, cy, Math.sin(a) * R * 0.98, 0.06, R * 1.9, 0.06, 0, 0, 0, { grad: 0 }); }
  } }),
  voidy: c => worm(c, { segs: 4, antennae: true, eyeGlow: 0.2 }),
};
export function petModel(petId) {
  const p = PETS[petId] || PETS.poro, def = { name: 'pet-' + petId, body: p.body, pal: p.pal };
  if (!BUILT.has(def.name + ':p')) {
    const s = new Shape(true); s.lo = true;
    const c = { s, P: { m: p.pal[0], d: p.pal[1], l: p.pal[2] }, v: 'p', def, elite: false, boss: false, h: 1.3, body: [0.06, 0.04, 0, 0], ghost: 0, crown: () => {} };
    (PET[petId] || BODY[p.body] || blob)(c);
    BUILT.set(def.name + ':p', { s, h: c.h, body: c.body, ghost: c.ghost });
  }
  const scene = new THREE.Group(), pool = new MonsterPool(scene, def, 'p', 1);
  const SC = petId === 'voidy' ? 0.55 : 0.6, st = { yaw: PI / 2, ph: 0, t: 0 };
  const sObj = { x: 0, y: 0, z: 0, rot: PI / 2, scale: SC, flash: 0, freeze: false, mad: false, anim: 0, sq: 0, alpha: 1 };
  // les fantômes et les oiseaux flottent ; les autres sautillent
  const fly = petId === 'wisp' || petId === 'phenix';
  return {
    root: scene, height: pool.height * SC,
    update(dt, pose = {}) {
      dt = Math.min(0.1, dt || 0); st.t += dt;
      const t = pose.t ?? st.t, mv = !!pose.moving;
      if (pose.dirA != null) st.yaw += Math.atan2(Math.sin(pose.dirA - st.yaw), Math.cos(pose.dirA - st.yaw)) * (1 - Math.exp(-10 * dt));
      st.ph += dt * (mv ? 11 : 4);
      sObj.rot = st.yaw; sObj.anim = st.ph;
      sObj.y = fly ? 0.7 + Math.sin(t * 3) * 0.12 : Math.abs(Math.sin(t * (mv ? 9 : 4))) * (mv ? 0.28 : 0.08);
      sObj.sq = fly ? 0 : Math.max(0, 0.6 - sObj.y * 4) * (mv ? 1 : 0.3);
      pool.begin(); pool.add(null, sObj); pool.end();
    },
    dispose() { pool.dispose(); },
  };
}
