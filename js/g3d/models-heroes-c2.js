// Héros 3D des champions C2 : Frida (cryomancienne), Gaïa (druidesse). Même marionnette, mêmes pièces et même style
// chibi que les autres (models-heroes.js prête ses pièces : build(sh, C, evo, K)). 5 stades d'évolution visibles chacun,
// aura de super guerrier au dernier (models-heroes.js). atk = animation d'attaque propre au champion ; leurs armes ne
// tirent rien : fx-c2.js la déclenche (onde de givre de Frida, champignon semé par Gaïa).
import { THREE, PI, TAU, lerp, smooth, shade } from './models-kit.js';

const GOLD = '#ffd54a', FUR = '#ffffff', ANTLER = '#e8d4aa', WOOD = '#7a5232', SHROOM = '#e84a3a', STEM = '#f4ead8';
const MT = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
const RX = a => new THREE.Matrix4().makeRotationX(a), RY = a => new THREE.Matrix4().makeRotationY(a), RZ = a => new THREE.Matrix4().makeRotationZ(a);
const SC = (x, y, z) => new THREE.Matrix4().makeScale(x, y, z);

// ---------- Pièces ----------
// flocon de neige à 6 branches dans un plan vertical (face vers +z, tourné de ry autour de la verticale, rx vers l'arrière)
function flake(s, col, x, y, z, r, { ry = 0, rx = 0, glow = 0 } = {}) {
  const B = MT(x, y, z).multiply(RY(ry)).multiply(RX(rx)), w = Math.max(0.045, r * 0.14), o = { grad: 0, glow };
  for (let i = 0; i < 3; i++) s.add('box', col, B.clone().multiply(RZ(i * PI / 3)).multiply(SC(r * 2, w, 0.05)), o);
  for (let i = 0; i < 6; i++) {
    const a = i * PI / 3, px = Math.cos(a) * r * 0.58, py = Math.sin(a) * r * 0.58, L = r * 0.36;
    for (const sd of [1, -1]) { const b = a + sd * 0.8; s.add('box', col, B.clone().multiply(MT(px + Math.cos(b) * L / 2, py + Math.sin(b) * L / 2, 0)).multiply(RZ(b)).multiply(SC(L, w * 0.8, 0.045)), o); }
  }
  s.add('oct', col, B.clone().multiply(SC(w * 2.6, w * 2.6, 0.09)), o);
}
// éclat de glace (octaèdre étiré) planté en (x, y, z), penché de (rx, rz)
const crystal = (s, col, x, y, z, h, w, rx = 0, rz = 0, o = { grad: 0 }) => s.tip('oct', col, x, y, z, rx, 0, rz, w, h, w, o);
// pièce tournée vers l'extérieur autour de l'axe vertical : angle a, rayon r, hauteur y, penchée de tilt vers l'extérieur
const radial = (s, key, col, a, r, y, sx, sy, sz, tilt, o) => s.add(key, col, MT(Math.cos(a) * r, y, Math.sin(a) * r).multiply(RY(PI / 2 - a)).multiply(RX(tilt)).multiply(SC(sx, sy, sz)), o);
// fleur à 5 pétales et cœur jaune : à plat (vue du dessus) ou face vers l'avant (front)
function flower(s, col, x, y, z, r, { front = false, glow = 0, heart = '#ffe04a' } = {}) {
  const B = front ? MT(x, y, z).multiply(RX(PI / 2)) : MT(x, y, z);
  for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; s.add('sph:6:4', col, B.clone().multiply(MT(Math.cos(a) * r * 0.62, 0, Math.sin(a) * r * 0.62)).multiply(SC(r * 0.8, r * 0.34, r * 0.8)), { grad: 0, glow }); }
  s.add('sph:6:4', heart, B.clone().multiply(MT(0, r * 0.14, 0)).multiply(SC(r * 0.52, r * 0.4, r * 0.52)), { grad: 0, glow: glow + 0.3 });
}
// petit champignon (chapeau rouge à pois blancs)
function shroom(s, x, y, z, k, { cap = SHROOM, glow = 0 } = {}) {
  s.put('cyl:6', STEM, x, y + 0.07 * k, z, 0.09 * k, 0.15 * k, 0.09 * k, 0, 0, 0, { grad: 0.1 });
  s.put('hemi:8:4', cap, x, y + 0.12 * k, z, 0.3 * k, 0.24 * k, 0.3 * k, 0, 0, 0, { grad: -0.1, glow });
  for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + 0.4; s.put('sph:5:3', '#ffffff', x + Math.cos(a) * 0.08 * k, y + 0.2 * k, z + Math.sin(a) * 0.08 * k, 0.05 * k, 0.03 * k, 0.05 * k, 0, 0, 0, { grad: 0 }); }
}
// bois de cerf (côté sd) : merrain en trois segments, trois andouillers ; renvoie les pointes (fleurs, lianes)
function antler(s, sd, k, col, { glow = 0, tip = null } = {}) {
  const P = (x, y, z) => [sd * (0.27 + x * k), 2.2 + y * k, -0.04 + z * k], o = { grad: 0.1, glow }, ot = { grad: 0, glow: glow + (tip ? 0.3 : 0) };
  const a = P(0, 0, 0), b = P(0.15, 0.3, -0.04), c = P(0.32, 0.58, -0.12), d = P(0.4, 0.86, -0.22);
  const t1 = P(0.4, 0.32, 0.14), t2 = P(0.15, 0.82, 0.02), t3 = P(0.64, 0.68, -0.18), w = 0.085 * Math.min(k, 1.25);
  s.put('sph:6:4', shade(col, -0.15), ...a, w * 1.9, w * 1.2, w * 1.9, 0, 0, 0, { grad: 0 });
  s.seg('cyl:5', col, a, b, w, w, o); s.seg('cyl:5', col, b, c, w * 0.9, w * 0.9, o);
  s.seg('cone:5', tip || col, c, d, w * 0.95, w * 0.95, ot);
  s.seg('cone:5', tip || col, b, t1, w * 0.8, w * 0.8, ot); s.seg('cone:5', tip || col, c, t2, w * 0.75, w * 0.75, ot); s.seg('cone:5', tip || col, c, t3, w * 0.75, w * 0.75, ot);
  return [d, t1, t2, t3];
}
// ailes de cristal (Frida) ou de feuilles (Gaïa) : éventail d'éclats ou de grandes feuilles dans le dos (os des ailes)
function fanWings(get, cols, { key = 'oct', k = 1, glow = 0.6, w = 0.26, d = 0.1 } = {}) {
  for (const [bn, sd] of [['wingL', 1], ['wingR', -1]]) {
    const s = get(bn);
    for (let i = 0; i < 4; i++) s.tip(key, cols[i % cols.length], sd * 0.16, 1.24 + 0.04 * i, -0.36 - i * 0.03, -0.35, sd * 0.35, -sd * (0.42 + i * 0.36), w * k, (1.3 - i * 0.18) * k, d, { grad: 0, glow });
  }
}

// ---------- Frida (cryomancienne) : robe blanche et bleu glacier, diadème de cristaux, longue tresse blanche, sceptre de glace ----------
function buildCryo(sh, C, evo, K) {
  const robe = C[1], robeS = C[2], light = C[3], cry = C.a, hair = C.h, skin = C.s, trim = C.c;
  const [H, E, HR, CH, HP, L, R, AL, AR, W, OF, CP, FL] = ['head', 'eyes', 'hair', 'chest', 'hips', 'legL', 'legR', 'armL', 'armR', 'wpn', 'off', 'cape', 'float'].map(sh);
  const cg = 0.4 + evo * 0.14, queen = evo === 3;
  K.boots(L, R, trim, { top: FUR });
  K.legs(L, R, shade(robeS, -0.15), { w: 0.2 });
  // robe longue : jupe blanche, pan bleu devant, ourlet foncé et couronne de givre (éclats qui poussent tout autour)
  HP.put('frust:0.36:0.6:8', robe, 0, 0.43, 0, 1, 0.64, 0.95, 0, PI / 8, 0, { grad: 0.25 });
  HP.put('frust:0.6:0.62:8', trim, 0, 0.13, 0, 1, 0.07, 0.96, 0, PI / 8, 0, { grad: 0 });
  HP.put('box', robeS, 0, 0.43, 0.46, 0.2, 0.6, 0.04, -0.3, 0, 0, { grad: 0.1 });
  const nh = 8 + evo * 2;
  for (let i = 0; i < nh; i++) {
    const a = i / nh * TAU + 0.2, dx = Math.cos(a), dz = Math.sin(a), hh = (0.16 + (i % 2) * 0.1) * (1 + evo * 0.08);
    crystal(HP, i % 3 ? cry : light, dx * 0.55, 0.1, dz * 0.53, hh, 0.09, dz * 0.55, -dx * 0.55, { grad: 0, glow: cg * 0.6 });
  }
  HP.put('rbox:0.3', trim, 0, 0.74, 0, 0.72, 0.1, 0.52, 0, 0, 0, { grad: 0 });
  HP.put('oct', cry, 0, 0.74, 0.28, 0.14, 0.18, 0.08, 0, 0, 0, { grad: 0, glow: 0.9 });
  // buste : corsage blanc, pan bleu, broche flocon ; col de fourrure et petite pèlerine bleue
  CH.put('rbox:0.32', robe, 0, 1.02, 0, 0.72, 0.58, 0.5, 0, 0, 0, { grad: 0.2 });
  CH.put('box', robeS, 0, 0.98, 0.255, 0.22, 0.46, 0.03, 0, 0, 0, { grad: 0 });
  flake(CH, cry, 0, 1.08, 0.29, 0.11, { glow: 0.5 + cg * 0.5 });
  CH.put('hemi:10:5', robeS, 0, 1.12, -0.01, 0.98, 0.46, 0.68, 0, 0, 0, { grad: -0.15 });
  CH.put('rbox:0.3', trim, 0, 1.31, -0.02, 0.66, 0.08, 0.5, 0, 0, 0, { grad: 0 });
  for (let i = 0; i < 5; i++) { const a = PI + 0.35 + i / 4 * (PI - 0.7); crystal(CH, i % 2 ? light : cry, Math.cos(a) * 0.3, 1.3, Math.sin(a) * 0.26 - 0.04, 0.34 + (i % 2 ? 0 : 0.1), 0.1, Math.sin(a) * 0.45, -Math.cos(a) * 0.45, { grad: 0, glow: cg * 0.7 }); } // col de glace dressé derrière la nuque
  // longue tresse blanche sur l'épaule gauche, nouée d'un cristal
  for (let i = 0; i < 5; i++) CH.put('sph:6:5', i % 2 ? shade(hair, -0.06) : hair, 0.3 + i * 0.012, 1.4 - i * 0.12, 0.2 + i * 0.03, 0.2 - i * 0.015, 0.17, 0.18 - i * 0.012, 0, 0, 0.2, { grad: 0.1 });
  CH.put('oct', cry, 0.36, 0.78, 0.33, 0.12, 0.16, 0.12, 0, 0, 0, { grad: 0, glow: 0.8 });
  K.arm(AL, 1, robeS, skin, { bell: true, cuff: FUR });
  K.arm(AR, -1, robeS, skin, { bell: true, cuff: FUR });
  // tête : yeux bleu glacier (violets pour la reine), longs cils, sourire
  K.headBlock(H, C);
  K.eyes(E, { col: evo >= 4 ? '#5ae0ff' : queen ? '#7a5ae8' : '#2a9ae8', glow: evo >= 2 ? 0.55 : 0.2, r: 0.105, tall: 1.18 });
  E.sym('box', '#2a3a6a', 0.3, 1.9, 0.45, 0.09, 0.03, 0.02, 0, 0.35, -0.55, { grad: 0 }); // cils
  K.brows(H, shade(hair, -0.3), { angry: 0.04, th: 0.04, y: 1.97 });
  K.mouth(H, 'smile');
  if (evo >= 4) {
    K.superHair(HR, hair, 0.85);
    for (const [x, h, r] of [[0, 0.5, 0], [0.22, 0.34, -0.3], [-0.22, 0.34, 0.3]]) crystal(H, '#ffffff', x, 2.12, 0.36, h, 0.13, 0.25, r, { grad: 0, glow: 1 });
  } else {
    // cheveux blancs : frange de côté, mèches le long des joues, nappe dans le dos
    H.put('rbox:0.4', hair, 0, 2.0, -0.06, 1.02, 0.52, 0.98, 0, 0, 0, { grad: 0.15 });
    H.put('rbox:0.4', hair, -0.16, 2.04, 0.39, 0.6, 0.22, 0.14, 0.25, 0, 0.3, { grad: 0 });
    H.put('rbox:0.4', hair, 0.26, 2.06, 0.38, 0.4, 0.18, 0.12, 0.2, 0, -0.28, { grad: 0 });
    H.sym('rbox:0.4', hair, 0.45, 1.6, 0.08, 0.16, 0.66, 0.26, 0, 0, 0.05, { grad: 0.12 });
    HR.put('rbox:0.4', hair, 0, 1.5, -0.42, 0.84, 0.96, 0.2, 0.06, 0, 0, { grad: 0.18 });
    // diadème de cristaux (plus grand à chaque stade), couronne de glace pour la reine
    const band = queen ? light : shade(cry, 0.35);
    H.put('tor:0.1:4:14', band, 0, 2.15, -0.02, 1.0, 1.0, 0.98, PI / 2 - 0.12, 0, 0, { grad: 0, glow: 0.2 });
    const n = queen ? 7 : evo >= 1 ? 5 : 3, big = 1 + evo * 0.25;
    for (let i = 0; i < n; i++) {
      const f = n > 1 ? i / (n - 1) - 0.5 : 0, a = PI / 2 + f * (queen ? 3.6 : 2.0), c0 = 1 - Math.abs(f) * 1.1;
      crystal(H, i % 2 ? light : cry, Math.cos(a) * 0.48, 2.2, Math.sin(a) * 0.46, (0.14 + 0.2 * c0) * big, 0.12 + 0.03 * c0, Math.sin(a) * 0.25, -Math.cos(a) * 0.3, { grad: 0, glow: cg });
    }
    if (evo >= 1 && !queen) flake(H, light, 0, 2.2, 0.5, 0.12 + evo * 0.02, { glow: 0.7 });
    if (evo === 2) for (const sd of [1, -1]) crystal(HR, cry, sd * 0.44, 2.06, -0.06, 0.5, 0.12, -0.9, -sd * 0.7, { grad: 0, glow: cg }); // cornes de givre
    if (queen) HR.put('oct', '#c8b8ff', 0, 2.22, 0.5, 0.14, 0.2, 0.1, 0, 0, 0, { grad: 0, glow: 1 });
  }
  // sceptre de glace (main droite) : hampe pâle cerclée de givre, grand cristal entouré de griffes, éclats en plus aux stades 2+
  const sx = -0.53, sz = 0.06, top = 2.45 + evo * 0.08, ck = 1 + evo * 0.1, shaftC = evo >= 3 ? light : '#d8ecff';
  W.put('cyl:6', shaftC, sx, (0.2 + top) / 2 - 0.12, sz, 0.08, top - 0.36, 0.08, 0, 0, 0, { grad: 0.1 });
  for (const y of [0.95, 1.55]) W.put('tor:0.18:4:8', cry, sx, y, sz, 0.16, 0.16, 0.16, PI / 2, 0, 0, { grad: 0, glow: 0.4 });
  W.put('cone:6', trim, sx, top - 0.3, sz, 0.26, 0.2, 0.26, PI, 0, 0, { grad: 0 });
  for (let i = 0; i < 3; i++) { const a = i / 3 * TAU; crystal(W, trim, sx + Math.cos(a) * 0.1, top - 0.24, sz + Math.sin(a) * 0.1, 0.24, 0.07, Math.sin(a) * 0.5, -Math.cos(a) * 0.5); }
  W.put('oct', evo >= 4 ? '#ffffff' : cry, sx, top + 0.06, sz, 0.3 * ck, 0.72 * ck, 0.3 * ck, 0, 0.4, 0, { grad: 0, glow: 0.7 + cg * 0.5 });
  if (evo >= 1) flake(W, light, sx, top + 0.06, sz - 0.02, 0.3 * ck, { glow: 0.5 + cg * 0.4 });
  if (evo >= 2) for (const sd of [1, -1]) crystal(W, light, sx + sd * 0.12, top - 0.1, sz, 0.42 * ck, 0.12, 0, -sd * 0.6, { grad: 0, glow: cg });
  // main gauche : petite boule de glace qui flotte (flocon dès le stade 1)
  if (evo >= 1) flake(OF, light, 0.53, 1.06, 0.14, 0.13 + evo * 0.02, { glow: 0.9 });
  else OF.put('ico', '#e8faff', 0.53, 1.02, 0.12, 0.18, 0.18, 0.18, 0, 0, 0, { grad: 0, glow: 0.9 });
  // stades
  if (evo >= 1) K.capeShape(CP, queen ? '#5a48c0' : evo >= 4 ? '#e8f8ff' : robeS, FUR, { len: 0.78 + evo * 0.11, w: 0.82 + evo * 0.05, glow: evo >= 3 ? 0.12 : 0 });
  if (evo >= 2) for (const sd of [1, -1]) {
    // épaulières de glace : grappe d'éclats sur chaque épaule (bien visibles du dessus)
    CH.put('sph:7:5', trim, 0.46 * sd, 1.28, 0, 0.36, 0.22, 0.38, 0, 0, -0.25 * sd, { grad: 0.2 });
    for (const [dx, dz, h, t] of [[0, 0, 0.42, 0.5], [0.06, 0.12, 0.3, 0.8], [0.04, -0.13, 0.3, 0.7]]) crystal(CH, evo === 2 ? cry : light, sd * (0.5 + dx), 1.34, dz, h * (evo >= 3 ? 1.2 : 1), 0.12, dz * 3, -sd * t, { grad: 0, glow: cg });
  }
  if (queen) for (let i = 0; i < 4; i++) { const a = i / 4 * TAU; FL.put('oct', i % 2 ? '#c8b8ff' : '#e8faff', Math.cos(a) * 0.95, 1.3 + (i % 2) * 0.35, Math.sin(a) * 0.95, 0.16, 0.42, 0.16, 0, 0, 0.3, { grad: 0, glow: 1 }); }
  if (evo >= 4) {
    fanWings(sh, ['#e8faff', '#9ae6ff', '#ffffff', '#5ad0ff'], { k: 1.05, glow: 0.7 });
    flake(CH, '#e8faff', 0, 1.75, -0.5, 0.62, { rx: -0.25, glow: 0.9 }); // grand flocon dans le dos
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; flake(FL, i % 2 ? '#bff4ff' : '#ffffff', Math.cos(a) * 1.0, 1.05 + (i % 2) * 0.42, Math.sin(a) * 1.0, 0.15, { ry: PI / 2 - a, glow: 1.1 }); }
  }
}

// ---------- Gaïa (druidesse) : robe de mousse et jupe de feuilles, bois de cerf fleuris, couronne de fleurs, bâton noueux ----------
function buildDruid(sh, C, evo, K) {
  const moss = C[1], mossD = C[2], leaf = C[3], flw = C.a, hair = C.h, skin = C.s, bark = C.c;
  const [H, E, HR, CH, HP, L, R, AL, AR, W, OF, CP, FL] = ['head', 'eyes', 'hair', 'chest', 'hips', 'legL', 'legR', 'armL', 'armR', 'wpn', 'off', 'cape', 'float'].map(sh);
  const lg = evo >= 2 ? 0.25 + evo * 0.12 : 0.1, keeper = evo === 3;
  K.boots(L, R, bark, { top: mossD });
  K.legs(L, R, mossD, { w: 0.21 });
  // jupe de mousse aux genoux, grandes feuilles qui pendent tout autour (alternées clair / foncé)
  HP.put('frust:0.36:0.5:8', moss, 0, 0.52, 0, 1, 0.46, 0.92, 0, PI / 8, 0, { grad: 0.25 });
  for (let i = 0; i < 11; i++) radial(HP, 'oct', i % 2 ? leaf : moss, i / 11 * TAU + 0.2, 0.46, 0.27, 0.22, 0.4, 0.05, -0.35, { grad: 0.15, glow: i % 2 ? lg * 0.4 : 0 });
  // ceinture de liane, fleur sur la hanche, petits champignons à la ceinture (son arme)
  HP.put('tor:0.14:4:12', bark, 0, 0.75, 0, 0.74, 0.74, 0.56, PI / 2, 0, 0, { grad: 0 });
  flower(HP, flw, 0.3, 0.77, 0.24, 0.13, { front: true, glow: lg * 0.5 });
  shroom(HP, -0.36, 0.58, 0.14, 0.9); shroom(HP, -0.27, 0.56, 0.24, 0.65);
  // buste : corsage de mousse lacé d'écorce, broche fleur ; collerette de feuilles (vue du dessus)
  CH.put('rbox:0.32', moss, 0, 1.02, 0, 0.72, 0.58, 0.5, 0, 0, 0, { grad: 0.2 });
  CH.put('box', bark, 0, 0.98, 0.255, 0.05, 0.44, 0.03, 0, 0, 0, { grad: 0 });
  for (let i = 0; i < 3; i++) CH.sym('box', bark, 0.06, 0.84 + i * 0.12, 0.27, 0.16, 0.035, 0.02, 0, 0, 0.4, { grad: 0 });
  flower(CH, flw, 0, 1.2, 0.28, 0.12, { front: true, glow: lg * 0.5 });
  for (let i = 0; i < 9; i++) radial(CH, 'oct', i % 2 ? leaf : moss, i / 9 * TAU + PI / 2, 0.38, 1.36, 0.2, 0.34, 0.05, 1.15, { grad: 0.1, glow: i % 2 ? lg * 0.3 : 0 });
  K.arm(AL, 1, mossD, skin, { cuff: bark, w: 0.21 });
  K.arm(AR, -1, mossD, skin, { cuff: bark, w: 0.21 });
  for (const [s, sd] of [[AL, 1], [AR, -1]]) s.put('tor:0.14:4:10', leaf, 0.53 * sd, 1.0, 0, 0.27, 0.27, 0.27, PI / 2 + 0.35 * sd, 0, 0, { grad: 0, glow: lg * 0.3 }); // liane au bras
  // tête : yeux verts (lumineux dès le stade 2), taches de rousseur, sourire
  K.headBlock(H, C);
  K.eyes(E, { col: evo >= 4 ? '#7aff5a' : evo >= 2 ? '#3ad86a' : '#3a9a4a', glow: evo >= 2 ? 0.6 : 0.15, r: 0.105, tall: 1.15 });
  E.sym('box', '#3a2414', 0.3, 1.89, 0.45, 0.09, 0.03, 0.02, 0, 0.35, -0.55, { grad: 0 }); // cils
  K.brows(H, shade(hair, -0.3), { angry: 0.02, th: 0.045 });
  K.mouth(H, 'smile');
  for (const [x, y] of [[0.24, 1.7], [0.3, 1.68], [0.27, 1.65]]) H.sym('box', shade(skin, -0.28), x, y, 0.448, 0.03, 0.03, 0.02, 0, 0.5, 0, { grad: 0 });
  // bois de cerf : plus grands à chaque stade ; fleurs aux pointes (stade 1+), lianes (gardienne), lumineux (forme ultime)
  const ak = 0.82 + evo * 0.13, acol = evo >= 4 ? '#f0ffd8' : keeper ? '#f4e2b0' : ANTLER;
  for (const sd of [1, -1]) {
    const tips = antler(H, sd, ak, acol, { glow: evo >= 4 ? 0.7 : keeper ? 0.15 : 0, tip: keeper ? GOLD : evo >= 4 ? '#ffffff' : null });
    if (evo >= 1) for (const t of tips.slice(1)) flower(H, evo >= 4 ? '#ffd0f0' : flw, t[0], t[1] - 0.02, t[2], 0.09 + evo * 0.01, { glow: lg });
    if (keeper || evo >= 4) for (const t of tips.slice(0, 2)) { H.put('box', leaf, t[0], t[1] - 0.28, t[2], 0.04, 0.5, 0.04, 0, 0, 0, { grad: 0, glow: lg * 0.5 }); H.put('oct', leaf, t[0], t[1] - 0.56, t[2], 0.12, 0.18, 0.04, 0, 0, 0, { grad: 0, glow: lg * 0.5 }); }
  }
  if (evo >= 4) {
    K.superHair(HR, hair, 0.8);
    for (let i = 0; i < 5; i++) { const a = PI / 2 + (i / 4 - 0.5) * 2.6; flower(H, i % 2 ? '#ffffff' : '#ff9ad8', Math.cos(a) * 0.46, 2.14, Math.sin(a) * 0.44, 0.1, { glow: 0.8 }); }
  } else {
    // cheveux châtains ondulés, raie au milieu, longue nappe dans le dos qui finit en pointes
    H.put('rbox:0.4', hair, 0, 2.0, -0.06, 1.02, 0.5, 0.98, 0, 0, 0, { grad: 0.15 });
    H.sym('rbox:0.4', hair, 0.2, 2.04, 0.38, 0.5, 0.2, 0.14, 0.2, 0, -0.35, { grad: 0 });
    H.sym('rbox:0.4', hair, 0.46, 1.55, 0.06, 0.18, 0.8, 0.3, 0, 0, 0.06, { grad: 0.12 });
    HR.put('rbox:0.4', hair, 0, 1.7, -0.42, 0.9, 0.56, 0.22, 0.06, 0, 0, { grad: 0.1 });
    for (const sd of [1, -1, 0]) {
      const hc = sd ? hair : shade(hair, -0.08), x = sd * 0.27;
      HR.put('frust:0.5:0.36:6', hc, x, 1.1, -0.46 - (sd ? 0 : 0.02), 0.34, 0.92, 0.22, 0.06, 0, -sd * 0.08, { grad: 0.15 });
      HR.put('cone:6', hc, x - sd * 0.03, 0.56, -0.49, 0.24, 0.22, 0.16, PI, 0, -sd * 0.2, { grad: 0 });
    }
    flower(HR, flw, 0.22, 1.5, -0.57, 0.11, { front: true, glow: lg * 0.4 }); // fleur piquée dans les cheveux
    // couronne de fleurs et de feuilles (plus fournie à chaque stade)
    H.put('tor:0.06:4:14', keeper ? GOLD : bark, 0, 2.16, 0, 0.98, 0.98, 0.96, PI / 2 - 0.16, 0, 0, { grad: 0, glow: keeper ? 0.3 : 0 });
    const nf = 3 + evo * 2;
    for (let i = 0; i < nf; i++) {
      const a = PI / 2 + (i / Math.max(1, nf - 1) - 0.5) * (evo ? 4.4 : 2.2), x = Math.cos(a) * 0.48, z = Math.sin(a) * 0.47;
      flower(H, i % 2 && evo === 2 ? '#ffffff' : flw, x, 2.18 + z * 0.08, z, 0.13 + (i === (nf - 1) / 2 ? 0.03 : 0), { glow: lg * 0.6 });
      if (i % 2 === 0) radial(H, 'oct', leaf, a, 0.55, 2.16, 0.12, 0.22, 0.04, 1.2, { grad: 0 });
    }
  }
  // bâton noueux (main droite) : bois tordu, volute qui tient une graine lumineuse, feuilles qui poussent
  const sx = -0.53, sz = 0.06, top = 2.4 + evo * 0.08, wood = keeper ? '#5a3a1e' : evo >= 4 ? '#c89a5a' : WOOD;
  const P = [[sx, 0.14, sz], [sx + 0.05, 0.85, sz + 0.03], [sx - 0.04, 1.5, sz - 0.02], [sx + 0.02, top - 0.2, sz]];
  for (let i = 0; i < 3; i++) W.seg('cyl:5', wood, P[i], P[i + 1], 0.1 - i * 0.008, 0.1 - i * 0.008, { grad: 0.1 });
  for (const p of P.slice(1, 3)) W.put('sph:5:4', shade(wood, -0.15), ...p, 0.15, 0.12, 0.15, 0, 0, 0, { grad: 0 }); // nœuds
  W.add('arc:0.07:4.4:10', wood, MT(sx + 0.02, top + 0.02, sz).multiply(RZ(-1.2)).multiply(SC(0.5, 0.5, 0.5)), { grad: 0 });
  W.put('ico', evo >= 4 ? '#f0ffc0' : '#9aff5a', sx + 0.02, top + 0.04, sz, 0.24 + evo * 0.02, 0.24 + evo * 0.02, 0.24 + evo * 0.02, 0, 0, 0, { grad: 0, glow: 1 });
  for (const sd of [1, -1]) W.tip('oct', leaf, sx + 0.02, top - 0.16, sz, 0, 0, sd * 0.9, 0.14, 0.3, 0.04, { grad: 0, glow: lg * 0.4 });
  if (evo >= 1) flower(W, flw, sx + 0.18, top + 0.12, sz, 0.1, { front: true, glow: lg });
  if (evo >= 2) { shroom(W, sx + 0.07, 1.15, sz + 0.02, 0.7, { glow: lg * 0.4 }); shroom(W, sx - 0.08, 1.62, sz, 0.55, { glow: lg * 0.4 }); }
  if (keeper) for (const y of [1.0, 1.8]) W.put('tor:0.18:4:8', GOLD, sx, y, sz, 0.17, 0.17, 0.17, PI / 2, 0, 0, { grad: 0, glow: 0.3 });
  // main gauche : petite pousse lumineuse (spores)
  OF.put('sph:6:4', evo >= 2 ? '#c8ff8a' : '#9ae06a', 0.53, 0.98, 0.12, 0.14, 0.14, 0.14, 0, 0, 0, { grad: 0, glow: 0.7 + lg });
  // stades
  if (evo >= 1) {
    const len = 0.8 + evo * 0.1;
    K.capeShape(CP, evo >= 4 ? '#5ac04a' : mossD, keeper ? GOLD : leaf, { len, w: 0.84 + evo * 0.05, glow: evo >= 3 ? 0.08 : 0 });
    for (let i = 0; i < 3; i++) CP.put('oct', i === 1 ? leaf : moss, (i - 1) * 0.32, 1.28 - len, -0.38, 0.2, 0.32, 0.05, 0.1, 0, (i - 1) * 0.3, { grad: 0.1, glow: lg * 0.3 });
  }
  if (evo === 1) for (const sd of [1, -1]) flower(CH, flw, 0.47 * sd, 1.36, 0, 0.18, { glow: 0.15 });
  if (evo >= 2 && evo <= 3) for (const sd of [1, -1]) {
    // épaulières d'écorce couvertes de mousse ; champignon sur l'épaule gauche
    K.pauldron(CH, sd, bark, leaf, 0.85);
    CH.put('hemi:8:4', moss, 0.5 * sd, 1.36, 0, 0.36, 0.14, 0.38, 0, 0, -0.25 * sd, { grad: 0 });
    if (sd > 0) shroom(CH, 0.52, 1.4, 0.02, 1.0, { glow: lg * 0.3 });
  }
  if (keeper) for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; FL.put('ico', i % 2 ? '#e8ff8a' : '#9aff6a', Math.cos(a) * 0.95, 1.25 + (i % 2) * 0.4, Math.sin(a) * 0.95, 0.13, 0.13, 0.13, 0, 0, 0, { grad: 0, glow: 1.2 }); } // lucioles
  if (evo >= 4) {
    fanWings(sh, ['#9aff6a', '#5ad04a', '#d8ffa0', '#7ae05a'], { key: 'sph:6:4', k: 1.05, glow: 0.5, w: 0.42, d: 0.06 });
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; flower(FL, i % 2 ? '#ff9ad8' : '#ffffff', Math.cos(a) * 1.0, 1.05 + (i % 2) * 0.42, Math.sin(a) * 1.0, 0.13, { glow: 1 }); }
  }
}

// ---------- Attaques (pose.atk : 1 au coup, décroît ; w = poids, u = avancement 0 → 1) ----------
// onde de givre : sceptre levé puis planté au sol, la main gauche s'ouvre
function atkCryo(b, w, u) {
  const s = smooth(u / 0.35);
  b.armR.rotation.x = lerp(b.armR.rotation.x, lerp(-2.6, -0.35, s), w);
  b.armR.rotation.z = lerp(b.armR.rotation.z, -0.12, w);
  b.wpn.rotation.x = lerp(0.35, -0.15, s) * w;
  b.armL.rotation.z = lerp(b.armL.rotation.z, 1.25, w); b.armL.rotation.x = lerp(b.armL.rotation.x, -0.5, w);
  b.chest.rotation.x += lerp(-0.2, 0.22, s) * w; b.head.rotation.x += lerp(-0.15, 0.08, s) * w;
}
// champignon semé : penchée en avant, le bâton touche le sol, la main gauche lance des spores
function atkDruid(b, w, u) {
  const s = smooth(u / 0.3);
  b.chest.rotation.x += 0.38 * w * (1 - 0.3 * s); b.head.rotation.x += 0.15 * w;
  b.armR.rotation.x = lerp(b.armR.rotation.x, lerp(-1.2, -0.35, s), w); b.wpn.rotation.x = lerp(-0.4, 0.45, s) * w;
  b.armL.rotation.x = lerp(b.armL.rotation.x, lerp(-0.6, -1.3, s), w); b.armL.rotation.z = lerp(b.armL.rotation.z, 0.35, w);
}

export const HEROES_C2 = {
  cryo: { build: buildCryo, atk: atkCryo },
  druid: { build: buildDruid, atk: atkDruid },
};
