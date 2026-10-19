// Boss 3D uniques (variante 'b' du MonsterPool) : Roi Gobelin, Ronce-Brûlante, Léviathan pourpre, Cryophénix,
// Geôlier spectral, Ver-Roi du Néant. Même chaîne que les monstres (géométrie animée dans le shader) ;
// la « pose » (rugissement, élan d'attaque) lève les bras, ouvre les gueules, redresse les têtes.
import { THREE, PI, TAU, shade } from './models-kit.js';
import { BOSS, crown } from './models-monsters.js';

const GOLD = '#ffd54a', GOLD_D = '#c8901a', INK = '#1a1020', GOB = '#84c440', GOB_D = '#5e9a2e';
const L2 = [[1, 0], [-1, PI]];

// ---------- Roi Gobelin : gros ventre, cape royale, couronne, sceptre-masse doré ----------
BOSS['Roi Gobelin'] = c => {
  const { s } = c, robe = '#7a2a9a', cape = '#c8283a', fur = '#fbf6ec';
  for (const [sd, off] of L2) {
    s.part([0.32 * sd, 0.6, 0], { rx: 0.4, off, body: 0 });
    s.put('rbox:0.35', GOB_D, 0.32 * sd, 0.36, 0, 0.32, 0.46, 0.34);
    s.put('rbox:0.3', '#5a3a22', 0.32 * sd, 0.1, 0.06, 0.4, 0.2, 0.52, 0, 0, 0, { grad: 0.2 });
    s.put('rbox:0.3', GOLD, 0.32 * sd, 0.22, 0.06, 0.42, 0.06, 0.5, 0, 0, 0, { grad: 0, glow: 0.2 });
  }
  s.part(null);
  // cape (derrière, ondule)
  s.part([0, 1.62, -0.4], { rx: 0.08, f: 1, off: 0.5 });
  s.put('frust:0.36:0.62:6', cape, 0, 0.95, -0.62, 1.7, 1.4, 0.18, 0.18, 0, 0, { grad: 0.35 });
  s.put('frust:0.62:0.64:6', fur, 0, 0.28, -0.74, 1.72, 0.12, 0.2, 0.18, 0, 0, { grad: 0 });
  s.part(null);
  // ventre et tunique
  s.put('sph:10:8', GOB, 0, 1.02, 0.08, 1.56, 1.24, 1.3, 0, 0, 0, { grad: 0.25 });
  s.put('sph:8:6', shade(GOB, 0.15), 0, 0.95, 0.42, 0.9, 0.8, 0.5);
  s.put('sph:4:3', GOB_D, 0, 0.92, 0.72, 0.1, 0.1, 0.06); // nombril
  for (const sd of [1, -1]) {
    s.put('rbox:0.4', robe, 0.55 * sd, 1.1, 0.02, 0.5, 1.1, 1.1, 0, 0, 0.1 * sd, { grad: 0.2 });
    s.put('box', GOLD, 0.34 * sd, 1.1, 0.5, 0.07, 1.0, 0.07, 0, 0, 0.12 * sd, { grad: 0, glow: 0.2 });
  }
  s.put('tor:0.08:4:14', GOLD_D, 0, 0.86, 0.08, 1.52, 1.52, 1.3, PI / 2, 0, 0, { grad: 0 });
  s.put('rbox:0.3', GOLD, 0, 0.86, 0.72, 0.34, 0.28, 0.1, 0, 0, 0, { grad: 0, glow: 0.4 });
  s.put('oct', '#ff3a5a', 0, 0.86, 0.78, 0.14, 0.16, 0.08, 0, 0, 0, { glow: 1 });
  // col d'hermine
  s.put('tor:0.17:5:12', fur, 0, 1.6, 0.0, 1.3, 1.3, 1.1, PI / 2, 0, 0, { grad: 0.1 });
  for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + 0.2; s.put('box', INK, Math.cos(a) * 0.66, 1.7, Math.sin(a) * 0.56, 0.06, 0.1, 0.06, 0, 0, 0, { grad: 0 }); }
  // tête : grandes oreilles, gros nez, sourire avec dent en or, couronne
  s.part([0, 1.66, 0.05], { rx: 0.05, f: 2, off: 0.6, pose: [-0.35, 0, 0, 0.06] });
  s.put('rbox:0.42', GOB, 0, 2.08, 0.1, 1.1, 0.86, 0.92, 0, 0, 0, { grad: 0.15 });
  s.put('rbox:0.4', GOB, 0, 1.8, 0.2, 0.74, 0.3, 0.7, 0, 0, 0, { grad: 0.1 });
  s.symTip('cone:4', GOB, 0.5, 2.14, 0.06, 0, 0, -1.2, 0.36, 0.95, 0.16, { grad: -0.3 });
  s.symTip('cone:4', '#e0907a', 0.55, 2.14, 0.1, 0, 0, -1.2, 0.2, 0.66, 0.1, { grad: 0 });
  s.eye(0.24, 2.16, 0.52, 0.13, { white: '#fff4b0', pr: 0.5, ry: 0.25 });
  s.eye(-0.24, 2.12, 0.52, 0.12, { white: '#fff4b0', pr: 0.5, ry: -0.25, tall: 0.8 }); // un œil plissé, l'air narquois
  s.put('box', GOB_D, 0.24, 2.36, 0.55, 0.3, 0.08, 0.08, 0, 0, -0.25, { grad: 0 });
  s.put('box', GOB_D, -0.24, 2.3, 0.55, 0.3, 0.08, 0.08, 0, 0, -0.35, { grad: 0 });
  s.tip('cone:5', GOB, 0, 2.02, 0.5, PI / 2 - 0.3, 0, 0, 0.24, 0.42, 0.24, { grad: -0.2 });
  s.put('box', '#3a1420', 0.04, 1.8, 0.56, 0.62, 0.14, 0.06, 0, 0, 0.08, { grad: 0 });
  s.put('box', '#ffffff', -0.14, 1.85, 0.58, 0.1, 0.07, 0.04, 0, 0, 0.08, { grad: 0 });
  s.put('box', GOLD, 0.06, 1.86, 0.585, 0.1, 0.07, 0.04, 0, 0, 0.08, { grad: 0, glow: 0.6 });
  s.put('box', '#ffffff', 0.24, 1.88, 0.58, 0.1, 0.07, 0.04, 0, 0, 0.08, { grad: 0 });
  crown(s, 0, 2.58, 0.06, 0.8, GOLD, '#ff3a5a');
  s.put('tor:0.12:4:12', '#ff3a5a', 0, 2.56, 0.06, 0.82, 0.82, 0.82, PI / 2, 0, 0, { grad: 0, glow: 0.2 });
  s.part(null);
  // bras : sceptre-masse dans la main droite, la gauche levée (bagues)
  for (const sd of [1, -1]) {
    s.part([0.78 * sd, 1.5, 0], { rx: 0.35, off: sd > 0 ? PI : 0, pose: sd < 0 ? [-2.9, 0, 0, 0] : [-2.2, 0.5, 0, 0] });
    s.put('rbox:0.4', robe, 0.84 * sd, 1.42, 0, 0.44, 0.4, 0.44, 0, 0, 0, { grad: 0.1 });
    s.put('rbox:0.4', GOB, 0.88 * sd, 1.0, 0.02, 0.3, 0.6, 0.3, 0, 0, 0.06 * sd);
    s.put('sph:7:5', GOB, 0.92 * sd, 0.66, 0.06, 0.4, 0.38, 0.4);
    s.put('tor:0.2:4:8', GOLD, 0.92 * sd, 0.8, 0.06, 0.34, 0.34, 0.34, PI / 2, 0, 0, { glow: 0.3 });
    if (sd < 0) {
      s.tip('cyl:6', GOLD_D, -0.92, 0.5, 0.06, 0.4, 0, 0, 0.12, 1.5, 0.12, { grad: 0 });
      const ex = -0.92, ey = 0.5 + Math.cos(0.4) * 1.55, ez = 0.06 + Math.sin(0.4) * 1.55;
      s.put('ico:1', GOLD, ex, ey, ez, 0.56, 0.56, 0.56, 0, 0, 0, { grad: 0.1, glow: 0.35 });
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; s.tip('cone:4', '#fff6c0', ex + Math.cos(a) * 0.22, ey + Math.sin(a) * 0.22, ez, 0, 0, a - PI / 2, 0.12, 0.26, 0.12, { glow: 0.4 }); }
      s.put('oct', '#ff3a5a', ex, ey, ez + 0.28, 0.18, 0.22, 0.1, 0, 0, 0, { glow: 1.2 });
    }
  }
  s.part(null);
  c.body = [0.05, 0.06, 0.015, 0];
  c.h = 3.0;
};

// ---------- Ronce-Brûlante : géant de ronces en feu ----------
BOSS['Ronce-Brûlante'] = c => {
  const { s, P } = c, bark = '#5a2618', vine = '#7a2a1a', fire = '#ff8a2a', fire2 = '#ffd54a', ember = '#ff5a2a';
  for (const [sd, off] of L2) {
    s.part([0.38 * sd, 0.75, 0], { rx: 0.35, off, body: 0 });
    s.put('dod', bark, 0.38 * sd, 0.45, 0, 0.5, 0.8, 0.5, 0, 0.4, 0, { grad: 0.2 });
    for (let i = 0; i < 3; i++) s.tip('cone:4', vine, (0.38 + Math.cos(i * 2.1) * 0.2) * sd, 0.08, Math.sin(i * 2.1) * 0.2, 1.2, i * 2.1, 0, 0.12, 0.4, 0.12, { grad: 0 });
  }
  s.part(null);
  // tronc tressé de ronces avec braises qui brillent dans les fissures
  s.put('dod', bark, 0, 1.4, 0, 1.6, 1.5, 1.2, 0, 0.3, 0, { grad: 0.3 });
  s.put('dod', vine, 0, 1.05, 0.1, 1.1, 0.7, 0.9, 0, 0.7, 0, { grad: 0.2 });
  for (const [x, y, rz] of [[0.2, 1.5, 0.5], [-0.25, 1.3, -0.4], [0.05, 1.1, 0.1], [-0.1, 1.75, 1.2]]) s.put('box', ember, x, y, 0.6, 0.08, 0.42, 0.04, 0, 0, rz, { grad: 0, glow: 1.6 });
  s.put('oct', fire2, 0, 1.4, 0.58, 0.3, 0.38, 0.12, 0, 0, 0, { grad: 0, glow: 1.8 }); // cœur ardent
  for (let i = 0; i < 16; i++) {
    const a = i * 2.39996, y = 0.9 + (i % 5) * 0.22, r = 0.7 - Math.abs(y - 1.4) * 0.25;
    s.tip('cone:4', i % 3 ? P.m : '#e8c8a0', Math.cos(a) * r, y, Math.sin(a) * r * 0.85, Math.sin(a) * 1.3, 0, -Math.cos(a) * 1.3, 0.12, 0.34, 0.12, { grad: -0.2 });
  }
  // tête : masque de bois, yeux de braise, couronne de flammes
  s.part([0, 2.0, 0.1], { rx: 0.06, f: 2, off: 1, pose: [-0.4, 0, 0, 0.08] });
  s.put('dod', bark, 0, 2.28, 0.12, 0.95, 0.8, 0.8, 0, 0.2, 0, { grad: 0.15 });
  s.put('box', '#120808', 0, 2.3, 0.5, 0.66, 0.16, 0.06, 0, 0, 0, { grad: 0 });
  s.sym('box', fire2, 0.17, 2.3, 0.53, 0.18, 0.1, 0.04, 0, 0, 0.25, { grad: 0, glow: 2 });
  s.put('box', '#120808', 0, 2.06, 0.5, 0.44, 0.1, 0.06, 0, 0, 0, { grad: 0 });
  for (let i = -2; i <= 2; i++) s.tip('cone:4', '#e8c8a0', i * 0.08, 2.1, 0.52, PI, 0, 0, 0.06, 0.1, 0.05, { grad: 0 });
  s.symTip('cone:5', vine, 0.36, 2.5, 0.0, -0.3, 0, -0.6, 0.18, 0.5, 0.18, { grad: -0.2 });
  s.part(null);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7 - 0.5) * 2.4;
    s.part([Math.sin(a) * 0.35, 2.6, -0.05], { sway: 0.06, bob: 0.08, f: 3.2, off: i * 1.7 });
    s.tip('cone:4', i % 2 ? fire : fire2, Math.sin(a) * 0.35, 2.55, -0.05 + Math.abs(a) * 0.05, -0.2, 0, -a * 0.45, 0.32, 0.75 - Math.abs(a) * 0.15, 0.32, { grad: -0.4, glow: 1.4 });
  }
  s.part(null);
  // bras-lianes : gros poings de ronce, épines
  for (const sd of [1, -1]) {
    s.part([0.85 * sd, 1.85, 0], { rx: 0.35, off: sd > 0 ? PI : 0, pose: [-2.6, 0.4 * sd, 0, 0] });
    s.seg('rbox:0.3', vine, [0.85 * sd, 1.85, 0], [1.05 * sd, 1.1, 0.1], 0.32, 0.32);
    s.seg('rbox:0.3', bark, [1.05 * sd, 1.1, 0.1], [1.1 * sd, 0.6, 0.18], 0.28, 0.28);
    s.put('dod', bark, 1.12 * sd, 0.5, 0.2, 0.62, 0.55, 0.62, 0, 0.5, 0, { grad: 0.2 });
    for (let i = 0; i < 4; i++) s.tip('cone:4', '#e8c8a0', 1.12 * sd + Math.cos(i * 1.6) * 0.25, 0.5 + Math.sin(i * 1.6) * 0.22, 0.2, 0, 0, i * 1.6 - PI / 2, 0.1, 0.24, 0.1, { grad: 0 });
    s.put('box', ember, 1.0 * sd, 1.3, 0.28, 0.06, 0.4, 0.04, 0, 0, 0.3 * sd, { grad: 0, glow: 1.4 });
  }
  s.part(null);
  c.body = [0.05, 0.07, 0, 0];
  c.h = 3.2;
};

// ---------- Léviathan pourpre : serpent de mer dressé sur ses anneaux ----------
BOSS['Léviathan pourpre'] = c => {
  const { s, P } = c, sk = P.m, dk = P.d, belly = '#f0c8ff', fin = '#ff6ad8';
  // anneaux posés au sol
  s.put('tor:0.2:6:14', sk, 0, 0.26, -0.2, 1.5, 1.5, 1.2, PI / 2, 0, 0, { grad: 0.2 });
  s.put('tor:0.19:6:12', shade(sk, -0.12), 0.08, 0.56, -0.25, 1.1, 1.1, 0.95, PI / 2 - 0.15, 0, 0.15, { grad: 0.2 });
  for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; s.tip('wedge', fin, Math.cos(a) * 0.75, 0.5, -0.2 + Math.sin(a) * 0.6, 0, -a, 0, 0.08, 0.32, 0.3, { grad: 0, glow: 0.3 }); }
  // queue qui dépasse, nageoire
  s.part([-0.7, 0.3, -0.8], { ry: 0.4, f: 1.5 });
  s.seg('sph:6:4', sk, [-0.7, 0.3, -0.8], [-1.25, 0.55, -1.25], 0.32, 0.32);
  s.tip('wedge', fin, -1.25, 0.55, -1.25, 0, 0.8, -0.9, 0.12, 0.7, 0.6, { glow: 0.4 });
  s.part(null);
  // cou en S : 4 segments qui ondulent
  const neck = [[0, 0.95, 0.15, 0.55], [0, 1.45, 0.3, 0.5], [0, 1.95, 0.42, 0.46], [0, 2.38, 0.6, 0.42]];
  neck.forEach(([x, y, z, r], i) => {
    s.part([0, y - 0.3, z - 0.1], { sway: 0.07 * (i + 1), rx: 0.03, f: 1.2, off: -i * 0.7, pose: [0, 0, 0, 0.05 * i] });
    s.put('sph:8:6', sk, x, y, z, r * 2, r * 2.2, r * 2, 0, 0, 0, { grad: 0.15 });
    s.put('sph:7:5', belly, x, y, z + r * 0.62, r * 1.3, r * 2.0, r * 0.9, 0, 0, 0, { grad: 0.1 });
    s.tip('wedge', fin, x, y + r * 0.6, z - r * 0.7, -0.6, 0, 0, 0.08, 0.5, 0.5, { glow: 0.4 });
  });
  // tête de dragon marin : long museau, mâchoire, crocs, yeux brillants, cornes, collerette
  s.part([0, 2.55, 0.6], { sway: 0.32, rx: 0.06, f: 1.2, off: -2.8, pose: [-0.5, 0, 0, 0.2] });
  s.put('rbox:0.35', sk, 0, 2.9, 0.78, 1.0, 0.7, 0.92, 0, 0, 0, { grad: 0.15 });
  s.put('rbox:0.35', sk, 0, 2.82, 1.34, 0.62, 0.36, 0.74, 0.1, 0, 0, { grad: 0.1 });
  s.put('rbox:0.35', belly, 0, 2.58, 1.2, 0.5, 0.18, 0.8, -0.25, 0, 0, { grad: 0 }); // mâchoire ouverte
  s.put('box', '#3a0a2a', 0, 2.7, 1.25, 0.46, 0.12, 0.6, -0.1, 0, 0, { grad: 0 });
  for (let i = 0; i < 4; i++) for (const sd of [1, -1]) {
    s.tip('cone:4', '#ffffff', 0.2 * sd, 2.72, 1.0 + i * 0.16, PI, 0, 0, 0.08, 0.14, 0.06, { grad: 0 });
    s.tip('cone:4', '#ffffff', 0.18 * sd, 2.62, 1.0 + i * 0.16, 0, 0, 0, 0.07, 0.12, 0.05, { grad: 0 });
  }
  s.eye(0.32, 3.02, 1.05, 0.11, { white: '#ffe8ff', pupil: '#ff2ad8', glow: 1.2, pr: 0.55, tall: 0.8, ry: 0.7 });
  s.eye(-0.32, 3.02, 1.05, 0.11, { white: '#ffe8ff', pupil: '#ff2ad8', glow: 1.2, pr: 0.55, tall: 0.8, ry: -0.7 });
  s.sym('box', dk, 0.3, 3.16, 1.06, 0.3, 0.08, 0.08, 0, 0.6, 0.35, { grad: 0 });
  s.symTip('cone:5', '#f0e0ff', 0.28, 3.15, 0.6, -0.9, 0, -0.35, 0.16, 0.7, 0.16, { grad: -0.2 });
  for (const sd of [1, -1]) for (let i = 0; i < 3; i++) s.tip('wedge', fin, 0.42 * sd, 2.9 - i * 0.12, 0.6, -0.5, 0, -sd * (1.1 + i * 0.25), 0.06, 0.55 - i * 0.1, 0.32, { glow: 0.4 });
  s.part(null);
  c.body = [0.03, 0.03, 0.02, 0];
  c.h = 3.4;
};

// ---------- Cryophénix : oiseau de glace aux ailes de cristal ----------
BOSS['Cryophénix'] = c => {
  const { s, P } = c, ice = P.m, deep = P.d, frost = P.l;
  // queue de longues plumes qui flottent
  for (let i = -2; i <= 2; i++) {
    s.part([i * 0.1, 0.7, -0.5], { sway: 0.08, rx: 0.15, f: 1.3, off: i * 0.8 });
    const rx = -1.75 + Math.abs(i) * 0.12, rz = -i * 0.3, L = 1.9 - Math.abs(i) * 0.3;
    s.tip('rbox:0.45', i % 2 ? frost : ice, i * 0.1, 0.7, -0.5, rx, 0, rz, 0.26, L, 0.06, { grad: -0.3, glow: 0.3 });
    const d = new THREE.Vector3(0, 1, 0).applyEuler(new THREE.Euler(rx, 0, rz));
    s.put('oct', '#ffffff', i * 0.1 + d.x * L, 0.7 + d.y * L, -0.5 + d.z * L, 0.2, 0.2, 0.3, 0, 0, 0, { glow: 1 });
  }
  s.part(null);
  // corps
  s.put('sph:9:7', ice, 0, 0.95, 0, 1.3, 1.3, 1.6, -0.3, 0, 0, { grad: 0.25, glow: 0.1 });
  s.put('sph:8:6', '#f4fbff', 0, 0.82, 0.38, 0.84, 0.86, 0.66, 0, 0, 0, { grad: 0.1, glow: 0.15 });
  for (const sd of [1, -1]) { s.part([0.22 * sd, 0.45, 0.1], { rx: 0.25, off: sd > 0 ? 0 : PI, body: 0 }); s.tip('cyl:4', '#c8e8ff', 0.22 * sd, 0.45, 0.1, PI - 0.3, 0, 0, 0.08, 0.36, 0.08); s.put('cone:3', '#e0f4ff', 0.22 * sd, 0.12, 0.24, 0.24, 0.12, 0.3, PI / 2, 0, 0); }
  s.part(null);
  // cou + tête : crête de cristaux, bec, yeux bleus lumineux
  s.part([0, 1.3, 0.35], { rx: 0.08, f: 1, off: 0.8, pose: [-0.55, 0, 0, 0.15] });
  s.seg('sph:7:5', ice, [0, 1.25, 0.45], [0, 1.8, 0.7], 0.5, 0.5);
  s.put('sph:8:6', ice, 0, 1.98, 0.78, 0.76, 0.7, 0.74, 0, 0, 0, { grad: 0.15, glow: 0.1 });
  s.tip('cone:4', GOLD, 0, 1.94, 1.08, PI / 2 + 0.15, PI / 4, 0, 0.26, 0.5, 0.26, { grad: 0.2 });
  s.eye(0.22, 2.06, 1.04, 0.1, { white: '#ffffff', pupil: '#2a8aff', glow: 1.4, pr: 0.6, tall: 0.85, ry: 0.6 });
  s.eye(-0.22, 2.06, 1.04, 0.1, { white: '#ffffff', pupil: '#2a8aff', glow: 1.4, pr: 0.6, tall: 0.85, ry: -0.6 });
  s.sym('box', deep, 0.22, 2.18, 1.06, 0.26, 0.07, 0.06, 0, 0.6, 0.4, { grad: 0 });
  for (let i = -3; i <= 3; i++) s.tip('oct', i % 2 ? frost : '#ffffff', i * 0.12, 2.24, 0.68 - Math.abs(i) * 0.06, -0.7 - Math.abs(i) * 0.12, 0, -i * 0.28, 0.2, 1.2 - Math.abs(i) * 0.18, 0.2, { grad: -0.2, glow: 0.8 });
  s.part(null);
  // grandes ailes de cristal (battent lentement)
  for (const [sd] of L2) {
    s.part([0.5 * sd, 1.15, 0], { rz: 0.6 * sd, f: 1.3, pose: [0, 0.6 * sd, 0, 0] });
    s.put('rbox:0.4', ice, 1.0 * sd, 1.25, -0.05, 1.1, 0.16, 0.7, 0, 0, 0.25 * sd, { grad: 0, glow: 0.15 });
    for (let i = 0; i < 6; i++) {
      const x = (0.6 + i * 0.3) * sd, L = 1.0 + (i < 3 ? i * 0.25 : (5 - i) * 0.2 + 0.4);
      s.tip('oct', i % 2 ? frost : ice, x, 1.25 + i * 0.08, -0.05, -0.15, 0, -sd * (1.25 + i * 0.12), 0.32, L, 0.14, { grad: -0.3, glow: 0.45 });
    }
  }
  s.part(null);
  c.body = [0.14, 0.05, 0, 1];
  c.h = 2.6;
};

// ---------- Geôlier spectral : spectre encapuchonné, chaînes, lanterne et faux ----------
BOSS['Geôlier spectral'] = c => {
  const { s, P } = c, cloak = '#1f3a34', cloakD = '#122420', soul = P.m, chain = '#8a9a98';
  // robe en lambeaux
  s.put('frust:0.55:0.95:8', cloak, 0, 1.0, 0, 1, 1.4, 0.9, 0, 0, 0, { grad: -0.25, glow: 0.05 });
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * TAU;
    s.part([Math.cos(a) * 0.8, 0.3, Math.sin(a) * 0.7], { sway: 0.1, rx: 0.2, f: 1.4, off: i * 1.1 });
    s.tip('cone:4', i % 2 ? cloak : cloakD, Math.cos(a) * 0.8, 0.36, Math.sin(a) * 0.7, PI + Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3, 0.42, 0.6, 0.3, { grad: 0 });
  }
  s.part(null);
  s.put('rbox:0.4', cloak, 0, 1.85, -0.05, 1.5, 0.8, 1.1, 0, 0, 0, { grad: 0.15 });
  // chaînes autour du corps
  for (let i = 0; i < 9; i++) { const a = i / 9 * PI * 1.1 - 0.2; s.put('tor:0.2:3:6', chain, Math.cos(a) * 0.8, 1.2 + i * 0.07, Math.sin(a) * 0.6 + 0.1, 0.22, 0.22, 0.22, 0, a, PI / 2 * (i % 2), { grad: 0 }); }
  s.put('rbox:0.2', '#5a5a48', 0.5, 0.95, 0.55, 0.3, 0.36, 0.14, 0, 0.4, 0, { grad: 0 }); // cadenas
  s.put('box', GOLD_D, 0.5, 0.92, 0.63, 0.06, 0.12, 0.02, 0, 0.4, 0, { grad: 0 });
  // capuche, visage vide, yeux d'âme
  s.part([0, 2.0, 0.05], { rx: 0.05, f: 1, off: 0.4, pose: [-0.35, 0, 0, 0.1] });
  s.put('rbox:0.45', cloak, 0, 2.5, 0.0, 1.1, 1.0, 1.0, 0, 0, 0, { grad: 0.1 });
  s.tip('cone:5', cloak, 0, 2.85, -0.3, -1.3, 0, 0, 0.6, 0.8, 0.5, { grad: 0 });
  s.put('sph:7:5', '#050208', 0, 2.42, 0.36, 0.8, 0.74, 0.4, 0, 0, 0, { grad: 0 });
  s.eye(0.17, 2.46, 0.5, 0.11, { white: null, pupil: soul, glow: 2, pr: 1, tall: 1.3, noHi: true, ry: 0.2 });
  s.eye(-0.17, 2.46, 0.5, 0.11, { white: null, pupil: soul, glow: 2, pr: 1, tall: 1.3, noHi: true, ry: -0.2 });
  s.put('box', soul, 0, 2.2, 0.52, 0.3, 0.05, 0.03, 0, 0, 0, { grad: 0, glow: 1.2 });
  crown(s, 0, 3.0, -0.02, 0.6, '#5a6a68', soul);
  s.part(null);
  // bras : faux (main droite), lanterne d'âmes (main gauche)
  for (const sd of [1, -1]) {
    s.part([0.75 * sd, 2.0, 0], { rx: 0.25, off: sd > 0 ? PI : 0, f: 1, pose: sd < 0 ? [-2.7, 0, 0, 0] : [-1.4, 0.3, 0, 0] });
    s.seg('frust:0.5:0.3:6', cloak, [0.75 * sd, 2.05, 0], [0.95 * sd, 1.25, 0.15], 0.5, 0.5);
    s.put('sph:6:4', '#a8d8c8', 0.98 * sd, 1.12, 0.2, 0.26, 0.26, 0.26, 0, 0, 0, { glow: 0.4 });
    if (sd < 0) {
      s.tip('cyl:5', '#3a2a24', -0.98, 0.3, 0.2, 0.15, 0, 0, 0.1, 2.6, 0.1, { grad: 0 });
      const tx = -0.98, ty = 0.3 + Math.cos(0.15) * 2.5, tz = 0.2 + Math.sin(0.15) * 2.5;
      s.put('box', '#5a6a68', tx, ty, tz, 0.16, 0.16, 0.16, 0, 0, 0, { grad: 0 });
      s.add('arc:0.08:1.6:8', '#d8f0e8', new THREE.Matrix4().makeTranslation(tx + 0.75, ty - 0.1, tz).multiply(new THREE.Matrix4().makeRotationZ(PI * 0.5)).multiply(new THREE.Matrix4().makeScale(1.6, 1.6, 0.6)), { grad: 0, glow: 0.6 });
    } else {
      s.put('cyl:4', chain, 0.98, 0.95, 0.2, 0.04, 0.3, 0.04, 0, 0, 0, { grad: 0 });
      s.put('frust:0.18:0.26:6', '#3a3a30', 0.98, 0.78, 0.2, 1, 0.08, 1, 0, 0, 0, { grad: 0 });
      s.put('cyl:6', soul, 0.98, 0.6, 0.2, 0.36, 0.34, 0.36, 0, 0, 0, { grad: 0, glow: 1.8 });
      s.put('frust:0.26:0.18:6', '#3a3a30', 0.98, 0.42, 0.2, 1, 0.08, 1, 0, 0, 0, { grad: 0 });
    }
  }
  s.part(null);
  c.body = [0.16, 0.05, 0, 1];
  c.ghost = 0.93;
  c.h = 3.3;
};

// ---------- Ver-Roi du Néant : ver géant dressé hors d'un gouffre, couronné, gueule circulaire ----------
BOSS['Ver-Roi du Néant'] = c => {
  const { s, P } = c, sk = P.m, dk = P.d, rune = P.l, plate = '#4a1a78';
  // gouffre au sol
  s.put('tor:0.14:5:14', '#3a1a58', 0, 0.05, 0, 1.7, 1.7, 1.7, PI / 2, 0, 0, { grad: 0 });
  s.put('cyl:14', '#0a0414', 0, 0.02, 0, 1.6, 0.03, 1.6, 0, 0, 0, { grad: 0, glow: 0 });
  for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; s.tip('cone:4', dk, Math.cos(a) * 0.98, 0.06, Math.sin(a) * 0.98, Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6, 0.14, 0.42, 0.14, { grad: 0, glow: 0.2 }); }
  // tentacules autour
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * TAU + 0.4, x = Math.cos(a) * 0.85, z = Math.sin(a) * 0.85;
    s.part([x, 0.1, z], { rx: 0.25, rz: 0.2, f: 1.1, off: i * 1.6 });
    s.tip('cone:5', sk, x, 0.1, z, Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7, 0.26, 1.2, 0.26, { grad: -0.2 });
  }
  s.part(null);
  // corps en segments qui ondulent de plus en plus en montant
  const segs = 6;
  for (let i = 0; i < segs; i++) {
    const y = 0.35 + i * 0.42, r = 0.72 - i * 0.04;
    s.part([0, 0.2, 0], { sway: 0.025 * i * i, rz: 0.01 * i, f: 1.1, off: -i * 0.5, body: 1, pose: [-0.05 * i, 0, 0, 0] });
    s.put('sph:9:6', i % 2 ? sk : shade(sk, -0.08), 0, y, 0, r * 2, 0.6, r * 2, 0, 0, 0, { grad: 0.25 });
    s.put('tor:0.08:4:12', plate, 0, y + 0.22, 0, r * 1.9, r * 1.9, r * 1.9, PI / 2, 0, 0, { grad: 0 });
    s.put('box', rune, 0, y, r * 0.98, 0.08, 0.24, 0.05, 0, 0, 0, { grad: 0, glow: 1.4 });
    s.tip('cone:4', plate, 0, y + 0.1, -r * 0.9, -1.0, 0, 0, 0.2, 0.4, 0.2, { grad: 0 });
  }
  // tête : gueule ronde pleine de dents, yeux tout autour, couronne
  const hy = 0.35 + segs * 0.42 + 0.2;
  s.part([0, 0.2, 0], { sway: 0.025 * 49, rz: 0.06, f: 1.1, off: -3.3, pose: [-0.45, 0, 0, 0.2] });
  s.put('sph:10:8', sk, 0, hy, 0.1, 1.5, 1.3, 1.4, 0, 0, 0, { grad: 0.2 });
  s.put('cyl:12', '#2a0414', 0, hy - 0.05, 0.72, 1.0, 0.1, 1.0, PI / 2 - 0.25, 0, 0, { grad: 0 });
  for (let k = 0; k < 2; k++) for (let i = 0; i < 10; i++) {
    const a = i / 10 * TAU + k * 0.3, rr = 0.48 - k * 0.18;
    s.tip('cone:4', k ? '#ffd0e0' : '#fff6f0', Math.cos(a) * rr, hy - 0.05 + Math.sin(a) * rr, 0.74 - k * 0.06, 0, 0, a + PI / 2, 0.1, 0.24 - k * 0.06, 0.08, { grad: 0 });
  }
  s.put('sph:6:4', '#ff2a6a', 0, hy - 0.05, 0.62, 0.3, 0.3, 0.1, 0, 0, 0, { grad: 0, glow: 1.6 });
  for (let i = 0; i < 6; i++) { const a = PI * (0.15 + i * 0.14); s.put('sph:5:3', '#ffe8ff', Math.cos(a) * 0.62, hy + Math.sin(a) * 0.5, 0.52, 0.14, 0.14, 0.08, 0, 0, 0, { glow: 0.6 }); s.put('sph:4:3', '#ff2ad8', Math.cos(a) * 0.62, hy + Math.sin(a) * 0.5, 0.57, 0.08, 0.08, 0.04, 0, 0, 0, { glow: 1.6 }); }
  crown(s, 0, hy + 0.66, -0.05, 0.9, '#c8a0ff', '#ff2ad8');
  for (let i = 0; i < 5; i++) s.tip('cone:4', rune, -0.5 + i * 0.25, hy + 0.66, -0.3, -0.4, 0, (2 - i) * 0.25, 0.12, 0.5, 0.12, { glow: 1 });
  s.part(null);
  c.body = [0.02, 0, 0.02, 0];
  c.h = hy + 1.2;
};
