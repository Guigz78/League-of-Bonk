// Héros 3D des champions C1 : Nyx (vampire), Sora (ombre), Ragnar (berserker). Même marionnette, mêmes pièces et même
// style chibi que Lumi, Kira et Brok (models-heroes.js prête ses pièces : build(sh, C, evo, K)). 5 stades d'évolution
// visibles chacun, aura de super guerrier au dernier (models-heroes.js). atk = animation d'attaque propre au champion,
// shot = type de tir qui la déclenche en partie (renderer.js).
import { THREE, PI, TAU, lerp, smooth, shade } from './models-kit.js';

const STEEL = '#c8ccd8', GOLD = '#ffd54a', BONE = '#efe2c0', WOOD_D = '#5a3418';
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

// triangle épais (prisme 'wedge' dont les 3 arêtes passent par a, b, c) : membranes d'ailes de chauve-souris
function tri(s, col, a, b, c, th, o = { grad: 0 }) {
  const A = V3(...a), B = V3(...b), Cc = V3(...c);
  const X = B.clone().sub(A), mid = A.clone().add(B).multiplyScalar(0.5), Y = Cc.clone().sub(mid);
  const Z = X.clone().cross(Y).normalize().multiplyScalar(th);
  s.add('wedge', col, new THREE.Matrix4().makeBasis(X, Y, Z).setPosition(mid.add(Y.clone().multiplyScalar(0.5))), o);
}
// ailes de chauve-souris (une par os, elles battent comme les ailes de plumes) : 3 doigts en éventail, membranes entre eux
function batWings(get, mem, bone, { k = 1, glow = 0 } = {}) {
  for (const [bn, sd] of [['wingL', 1], ['wingR', -1]]) {
    const s = get(bn), b0 = [sd * 0.16, 1.28, -0.36];
    const tips = [[0.62, 2.05, -0.52], [1.18, 1.72, -0.6], [1.12, 1.08, -0.56], [0.62, 0.86, -0.46]].map(([x, y, z]) => [b0[0] + sd * x * k, b0[1] + (y - 1.28) * k, b0[2] + (z + 0.36) * k]);
    for (let i = 0; i < tips.length - 1; i++) {
      tri(s, i % 2 ? shade(mem, -0.18) : mem, b0, tips[i], tips[i + 1], 0.05, { grad: 0, glow });
      // bord festonné : petit creux entre deux doigts
      const m = tips[i].map((v, j) => (v + tips[i + 1][j]) / 2 + (b0[j] - (v + tips[i + 1][j]) / 2) * 0.22);
      tri(s, shade(mem, -0.3), tips[i], m, tips[i + 1], 0.04, { grad: 0, glow: glow * 0.5 });
    }
    for (const t of tips.slice(0, 3)) s.seg('cyl:4', bone, b0, t, 0.07, 0.07, { grad: 0, glow: glow * 0.6 });
    s.put('sph:6:4', bone, ...b0, 0.16, 0.16, 0.16, 0, 0, 0, { grad: 0 });
    s.add('cone:4', bone, new THREE.Matrix4().makeTranslation(...tips[0]).multiply(new THREE.Matrix4().makeRotationZ(-sd * 0.5)).multiply(new THREE.Matrix4().makeScale(0.08, 0.22, 0.08)), { grad: 0 });
  }
}

// ---------- Nyx (vampire) : robe gothique, haut col, cheveux d'argent, yeux rouges, grande faux ----------
function buildVampire(sh, C, evo, K) {
  const dress = C[1], dressS = C[2], dressL = C[3], red = C.a, hair = C.h, skin = C.s, trim = C.c;
  const [H, E, HR, CH, HP, L, R, AL, AR, W, CP, FL] = ['head', 'eyes', 'hair', 'chest', 'hips', 'legL', 'legR', 'armL', 'armR', 'wpn', 'cape', 'float'].map(sh);
  const glowR = evo >= 1 ? 0.35 + evo * 0.1 : 0.15, lining = evo === 3 ? GOLD : red;
  K.boots(L, R, '#1a1018', { top: lining });
  K.legs(L, R, '#2a2232', { w: 0.2 });
  // robe longue en corolle, jupon et ourlet rouges, pans pointus
  HP.put('frust:0.36:0.6:8', dress, 0, 0.44, 0, 1, 0.62, 0.94, 0, PI / 8, 0, { grad: 0.3 });
  HP.put('frust:0.6:0.62:8', lining, 0, 0.13, 0, 1, 0.06, 0.95, 0, PI / 8, 0, { grad: 0, glow: evo >= 3 ? 0.2 : 0 });
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + PI / 8; HP.put('cone:4', dressS, Math.cos(a) * 0.29, 0.06, Math.sin(a) * 0.28, 0.16, 0.14, 0.1, PI, -a, 0, { grad: 0 }); }
  HP.put('box', red, 0, 0.44, 0.47, 0.1, 0.56, 0.04, -0.3, 0, 0, { grad: 0, glow: 0.1 }); // fente rouge devant
  HP.put('rbox:0.3', trim, 0, 0.74, 0, 0.72, 0.1, 0.52, 0, 0, 0, { grad: 0 });
  // corset lacé, broche de sang
  CH.put('rbox:0.32', dress, 0, 1.02, 0, 0.72, 0.58, 0.5, 0, 0, 0, { grad: 0.2 });
  CH.put('box', dressL, 0, 0.98, 0.255, 0.26, 0.44, 0.03, 0, 0, 0, { grad: 0 });
  for (let i = 0; i < 3; i++) for (const sd of [1, -1]) CH.put('box', red, 0, 0.84 + i * 0.13, 0.275, 0.24, 0.035, 0.02, 0, 0, sd * 0.45, { grad: 0 });
  CH.put('oct', red, 0, 1.24, 0.29, 0.16, 0.2, 0.1, 0, 0, 0, { grad: 0, glow: 0.9 });
  CH.put('tor:0.12:4:10', GOLD, 0, 1.24, 0.27, 0.22, 0.26, 0.16, 0, 0, 0, { grad: 0, glow: 0.15 });
  // haut col de vampire derrière la tête (doublure rouge), il dépasse bien vu du dessus
  for (const sd of [1, -1]) {
    CH.put('rbox:0.2', trim, sd * 0.3, 1.62, -0.24, 0.44, 0.66, 0.06, -0.35, sd * 0.45, -sd * 0.28, { grad: 0.1 });
    CH.put('rbox:0.2', lining, sd * 0.28, 1.6, -0.2, 0.36, 0.56, 0.03, -0.35, sd * 0.45, -sd * 0.28, { grad: 0, glow: glowR * 0.4 });
  }
  CH.put('rbox:0.3', trim, 0, 1.32, -0.02, 0.7, 0.12, 0.5, 0, 0, 0, { grad: 0 });
  K.arm(AL, 1, dress, skin, { bell: true, cuff: lining });
  K.arm(AR, -1, dress, skin, { bell: true, cuff: lining });
  // tête : peau pâle, yeux rouges, petits crocs
  K.headBlock(H, C);
  K.eyes(E, { col: evo >= 4 ? '#ff2a4a' : '#d81e3a', glow: evo >= 2 ? 0.6 : 0.3, r: 0.105, tall: 1.1 });
  K.brows(H, shade(hair, -0.3), { angry: 0.18, th: 0.04, y: 1.95 });
  K.mouth(H, 'smile');
  H.sym('cone:4', '#ffffff', 0.055, 1.565, 0.452, 0.045, 0.075, 0.03, PI, 0, 0, { grad: 0 });
  if (evo >= 4) {
    K.superHair(HR, hair, 0.85);
    for (const sd of [1, -1]) HR.put('rbox:0.4', hair, sd * 0.44, 1.5, 0.05, 0.18, 0.8, 0.26, 0, 0, sd * 0.05, { grad: 0.1, glow: 0.6 });
  } else {
    // longs cheveux d'argent : frange de côté, mèches devant les oreilles, grande nappe dans le dos
    H.put('rbox:0.4', hair, 0, 2.0, -0.06, 1.02, 0.5, 0.98, 0, 0, 0, { grad: 0.2 });
    for (const [x, z, r] of [[-0.3, 0.12, 0.5], [0.0, 0.2, 0.1], [0.3, 0.14, -0.45]]) H.put('cone:4', shade(hair, -0.08), x, 2.2, z, 0.34, 0.44, 0.2, 1.75, 0, r, { grad: 0.15 }); // mèches du dessus
    H.put('rbox:0.4', hair, -0.16, 2.04, 0.39, 0.62, 0.22, 0.14, 0.25, 0, 0.32, { grad: 0 });
    H.put('rbox:0.4', hair, 0.26, 2.06, 0.38, 0.4, 0.18, 0.12, 0.2, 0, -0.25, { grad: 0 });
    H.sym('rbox:0.4', hair, 0.45, 1.56, 0.1, 0.18, 0.8, 0.26, 0, 0, 0.05, { grad: 0.12 });
    HR.put('rbox:0.4', hair, 0, 1.42, -0.44, 0.78, 1.16, 0.22, 0.08, 0, 0, { grad: 0.18 });
    HR.put('cone:4', hair, 0, 0.78, -0.5, 0.5, 0.2, 0.18, PI, PI / 4, 0, { grad: 0 });
    // barrette chauve-souris (rouge), puis diadème (stade 2) ou couronne (stade 3)
    if (evo <= 1) for (const sd of [1, -1]) H.put('wedge', red, 0.3 + sd * 0.12, 2.24, 0.2, 0.18, 0.12, 0.06, 0, 0, -sd * 1.1, { grad: 0, glow: 0.3 });
    if (evo === 2) {
      H.put('tor:0.1:4:14', '#3a2a4a', 0, 2.12, 0.02, 1.0, 1.0, 0.98, PI / 2 - 0.15, 0, 0, { grad: 0 });
      H.put('oct', red, 0, 2.22, 0.48, 0.14, 0.22, 0.08, 0, 0, 0, { grad: 0, glow: 0.9 });
      for (const sd of [1, -1]) H.put('cone:4', '#3a2a4a', sd * 0.18, 2.24, 0.46, 0.08, 0.2, 0.05, 0, 0, -sd * 0.3, { grad: 0 });
    }
    if (evo === 3) K.crownOf(HR, GOLD, '#ff1a3a', { y: 2.3, r: 0.3, n: 5, h: 0.28, glow: 0.3 });
  }
  // faux : long manche sombre, bagues rouges, lame en croissant vers l'avant (cramoisie et lumineuse aux stades 1 à 4)
  const sx = -0.53, top = 2.55 + evo * 0.06, bladeC = evo >= 1 ? (evo >= 3 ? '#ff4a64' : '#e8243e') : '#a8aebe', edgeC = evo >= 1 ? '#ffd0d8' : red;
  W.put('cyl:6', evo >= 3 ? '#1a0a12' : '#2a1a24', sx, (0.1 + top) / 2, 0.06, 0.09, top - 0.1, 0.09, 0, 0, 0, { grad: 0.1 });
  for (const y of [0.55, 1.2, top - 0.25]) W.put('cyl:6', red, sx, y, 0.06, 0.12, 0.07, 0.12, 0, 0, 0, { grad: 0, glow: 0.2 });
  W.put('oct', red, sx, top + 0.06, 0.06, 0.2, 0.26, 0.2, 0, 0, 0, { grad: 0, glow: 0.9 });
  const bl = 1 + evo * 0.07, P = [[0, 0], [0.12, 0.4], [0.02, 0.82], [-0.22, 1.12], [-0.55, 1.26]].map(([dy, dz]) => [sx, top + dy * bl, 0.06 + dz * bl]);
  for (let i = 0; i < P.length - 1; i++) {
    const wd = (0.36 - i * 0.07) * bl;
    W.seg('box', bladeC, P[i], P[i + 1], 0.05, wd, { grad: 0, glow: evo >= 1 ? glowR : 0.05 });
    // tranchant (côté intérieur, vers le bas)
    const o = (p) => [p[0], p[1] - wd * 0.42, p[2] - 0.02];
    W.seg('box', edgeC, o(P[i]), o(P[i + 1]), 0.06, wd * 0.22, { grad: 0, glow: 0.6 });
  }
  W.put('cone:4', bladeC, sx, P[4][1] - 0.06, P[4][2] + 0.04, 0.06, 0.2, 0.1, -2.2, 0, 0, { grad: 0, glow: glowR });
  // stades
  if (evo >= 1) K.capeShape(CP, evo === 2 ? '#1a0e24' : '#140a10', lining, { len: 0.72 + evo * 0.12, w: 0.84 + evo * 0.06, glow: evo >= 3 ? 0.08 : 0 });
  if (evo >= 1 && evo <= 3) for (const sd of [1, -1]) CH.put('sph:7:5', trim, 0.46 * sd, 1.3, 0, 0.36, 0.22, 0.4, 0, 0, -0.25 * sd, { grad: 0.2 });
  if (evo === 2) batWings(sh, '#3a1a4a', '#1a0e24', { k: 0.8, glow: 0.05 });
  if (evo === 3) for (let i = 0; i < 4; i++) { const a = i / 4 * TAU; FL.put('ico', '#ff2a4a', Math.cos(a) * 0.95, 1.3 + (i % 2) * 0.35, Math.sin(a) * 0.95, 0.22, 0.26, 0.22, 0, 0, 0, { grad: 0, glow: 1 }); }
  if (evo >= 4) {
    batWings(sh, '#8a0e26', '#2a0610', { k: 1.05, glow: 0.25 });
    K.halo(HR, '#ff2a4a', 3.3, 0.36);
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; FL.put('ico', i % 2 ? '#ff2a4a' : '#ffd0d8', Math.cos(a) * 1.0, 1.1 + (i % 2) * 0.45, Math.sin(a) * 1.0, 0.18, 0.22, 0.18, 0, 0, 0, { grad: 0, glow: 1.1 }); }
  }
}

// ---------- Sora (ombre) : tenue de ninja violet nuit, masque, longue écharpe magenta, deux dagues ----------
function buildAssassin(sh, C, evo, K) {
  const suit = C[1], suitS = C[2], suitL = C[3], scarf = C.a, hair = C.h, skin = C.s, ink = C.c;
  const [H, E, HR, CH, HP, L, R, AL, AR, W, OF, CP, FL] = ['head', 'eyes', 'hair', 'chest', 'hips', 'legL', 'legR', 'armL', 'armR', 'wpn', 'off', 'cape', 'float'].map(sh);
  const sg = evo >= 4 ? 0.7 : evo >= 1 ? 0.25 : 0, blade = evo === 2 ? '#bff8ff' : evo === 3 ? '#ffe9a0' : evo >= 4 ? '#e8c8ff' : '#e8eef8', bg = evo >= 2 ? 0.6 : 0.1;
  K.boots(L, R, ink, { top: suitS, x: 0.18 });
  K.legs(L, R, suitS, { x: 0.18, w: 0.21 });
  for (const [s, sd] of [[L, 1], [R, -1]]) for (const y of [0.3, 0.44]) s.put('rbox:0.3', suitL, 0.18 * sd, y, 0.01, 0.25, 0.05, 0.25, 0, 0, sd * 0.12, { grad: 0 });
  // tunique croisée, ceinture-écharpe nouée, pans qui flottent
  HP.put('frust:0.34:0.42:8', suit, 0, 0.54, 0, 1, 0.34, 0.9, 0, PI / 8, 0, { grad: 0.2 });
  HP.put('rbox:0.3', scarf, 0, 0.74, 0, 0.72, 0.12, 0.52, 0, 0, 0, { grad: 0, glow: sg * 0.3 });
  HP.put('sph:6:4', scarf, 0.24, 0.72, 0.25, 0.16, 0.14, 0.1, 0, 0, 0, { grad: 0 });
  HP.put('rbox:0.3', scarf, 0.3, 0.5, 0.24, 0.1, 0.36, 0.04, 0.1, 0, 0.25, { grad: 0.1 });
  CH.put('rbox:0.32', suit, 0, 1.02, 0, 0.72, 0.58, 0.5, 0, 0, 0, { grad: 0.2 });
  for (const sd of [1, -1]) CH.put('box', suitL, sd * 0.1, 1.08, 0.26, 0.08, 0.5, 0.03, 0, 0, sd * 0.5, { grad: 0 });
  // baudrier de dagues de lancer en travers du torse
  CH.put('box', ink, 0, 1.0, 0, 0.78, 0.08, 0.56, 0, 0, -0.7, { grad: 0 });
  for (let i = 0; i < 3; i++) CH.put('box', blade, -0.16 + i * 0.13, 0.86 + i * 0.12, 0.29, 0.04, 0.18, 0.03, 0, 0, -0.7, { grad: 0, glow: bg * 0.5 });
  // écharpe magenta : tour du cou + deux longs pans dans le dos (os de la cape : ils volent quand on court)
  CH.put('tor:0.2:5:12', scarf, 0, 1.32, 0, 0.82, 0.82, 0.7, PI / 2, 0, 0, { grad: 0.1, glow: sg * 0.4 });
  const tl = 0.85 + evo * 0.1;
  for (const sd of [1, -1]) CP.put('rbox:0.3', scarf, sd * 0.13, 1.28 - tl / 2, -0.36, 0.2, tl, 0.06, 0.18, 0, sd * 0.12, { grad: 0.25, glow: sg * 0.5 });
  for (const sd of [1, -1]) CP.put('wedge', scarf, sd * 0.13 + sd * 0.07 * tl, 1.28 - tl - 0.06, -0.36 - 0.18 * tl * 0.5, 0.2, 0.14, 0.06, PI + 0.18, 0, sd * 0.12, { grad: 0, glow: sg * 0.5 });
  K.arm(AL, 1, suit, skin, { glove: ink, cuff: suitL, w: 0.21 });
  K.arm(AR, -1, suit, skin, { glove: ink, cuff: suitL, w: 0.21 });
  // tête : yeux violets en amande, masque sur le bas du visage, bandeau à longs rubans
  K.headBlock(H, C);
  K.eyes(E, { col: evo >= 4 ? '#ff4ad8' : evo === 2 ? '#3ad8ff' : '#9a4aff', glow: evo >= 2 ? 0.6 : 0.2, r: 0.1, tall: 0.9, y: 1.83 });
  K.brows(H, hair, { angry: 0.32, th: 0.06, y: 1.97 });
  // masque de tissu sur le bas du visage (couleur de la tenue, bord clair)
  const maskC = evo === 3 ? '#0e0a18' : suitS;
  H.put('rbox:0.4', maskC, 0, 1.57, 0.34, 0.9, 0.27, 0.3, 0, 0, 0, { grad: 0.1 });
  H.put('rbox:0.4', maskC, 0, 1.62, 0.47, 0.2, 0.18, 0.08, 0, 0, 0, { grad: 0 }); // nez sous le masque
  H.put('box', evo === 3 ? GOLD : shade(maskC, 0.25), 0, 1.7, 0.45, 0.88, 0.03, 0.1, 0, 0, 0, { grad: 0, glow: evo === 3 ? 0.4 : 0 });
  if (evo >= 4) K.superHair(HR, hair, 0.8);
  else if (evo === 2) {
    // capuche fantôme rabattue (le bandeau dépasse)
    H.put('rbox:0.45', suitS, 0, 2.08, -0.1, 1.08, 0.56, 0.96, 0, 0, 0, { grad: 0.05 });
    H.sym('rbox:0.42', suitS, 0.49, 1.78, -0.12, 0.14, 0.62, 0.7, 0, 0, 0.04, { grad: 0.15 });
    H.put('rbox:0.42', suitS, 0, 1.74, -0.44, 0.98, 0.62, 0.2, 0, 0, 0, { grad: 0.15 });
    H.put('rbox:0.45', suitL, 0, 2.16, 0.32, 0.98, 0.12, 0.14, -0.3, 0, 0, { grad: 0, glow: 0.3 });
    HR.add('cone:5', suitS, new THREE.Matrix4().makeTranslation(0, 2.12, -0.5).multiply(new THREE.Matrix4().makeRotationX(-2.1)).multiply(new THREE.Matrix4().makeTranslation(0, 0.26, 0)).multiply(new THREE.Matrix4().makeScale(0.5, 0.6, 0.4)), { grad: 0.1 });
  } else {
    // cheveux noirs en pointes, chignon haut
    H.put('rbox:0.4', hair, 0, 2.02, -0.06, 1.0, 0.46, 0.96, 0, 0, 0, { grad: 0.05 });
    for (const [x, r] of [[-0.3, 0.45], [-0.08, 0.15], [0.14, -0.15], [0.32, -0.45]]) H.put('cone:4', hair, x, 2.1, 0.38, 0.26, 0.36, 0.14, 2.3, 0, r, { grad: 0 });
    H.sym('rbox:0.4', hair, 0.46, 1.74, 0.02, 0.12, 0.44, 0.52, 0, 0, 0.04, { grad: 0.1 });
    H.put('rbox:0.4', hair, 0, 1.76, -0.38, 0.9, 0.5, 0.22, 0, 0, 0, { grad: 0.1 });
    HR.put('sph:6:5', hair, 0, 2.36, -0.2, 0.38, 0.32, 0.36, 0, 0, 0, { grad: 0.1 });
    for (const sd of [1, -1, 0]) HR.put('cone:4', hair, sd * 0.12, 2.5, -0.26 - (sd ? 0 : 0.06), 0.16, 0.34, 0.14, -0.5, 0, sd * 0.5, { grad: 0 });
    HR.put('cyl:6', scarf, 0, 2.26, -0.2, 0.3, 0.07, 0.3, 0, 0, 0, { grad: 0, glow: 0.2 });
  }
  if (evo < 4) {
    // bandeau (plaque de métal) et ses deux rubans qui flottent derrière la tête
    H.put('rbox:0.3', ink, 0, 2.02, 0, 1.04, 0.13, 1.0, 0, 0, 0, { grad: 0 });
    H.put('rbox:0.3', evo === 3 ? GOLD : STEEL, 0, 2.02, 0.5, 0.36, 0.13, 0.04, 0, 0, 0, { grad: 0, glow: evo === 3 ? 0.4 : 0.1 });
    for (const sd of [1, -1]) HR.put('rbox:0.3', ink, sd * 0.1, 1.82, -0.62, 0.1, 0.42, 0.04, 0.9, 0, sd * 0.35, { grad: 0.1 });
  }
  // dagues : une dans chaque main, lame vers l'avant (kunai : anneau au pommeau)
  const dag = (s, x) => {
    s.put('tor:0.2:4:8', ink, x, 0.74, -0.08, 0.14, 0.14, 0.14, 0, PI / 2, 0, { grad: 0 });
    s.put('box', ink, x, 0.74, 0.08, 0.07, 0.07, 0.24, 0, 0, 0, { grad: 0 });
    s.put('box', evo >= 1 ? scarf : suitL, x, 0.74, 0.2, 0.16, 0.05, 0.04, 0, 0, 0, { grad: 0, glow: sg });
    s.put('oct', blade, x, 0.74, 0.42, 0.13, 0.04, 0.46, 0, 0, 0, { grad: 0, glow: bg });
  };
  dag(W, -0.53); dag(OF, 0.53);
  // stades
  if (evo >= 1 && evo <= 3) K.pauldron(CH, 1, evo === 3 ? GOLD : suitS, evo === 3 ? ink : scarf, 0.8, evo >= 2 ? (evo === 3 ? GOLD : '#bff8ff') : null);
  if (evo === 2 || evo === 3 || evo >= 4) {
    // dagues spectrales qui tournent autour d'elle
    const n = evo === 2 ? 3 : evo === 3 ? 4 : 6, c = evo === 2 ? '#7af0ff' : evo === 3 ? GOLD : '#c88aff';
    for (let i = 0; i < n; i++) { const a = i / n * TAU; FL.put('oct', c, Math.cos(a) * 0.95, 1.25 + (i % 2) * 0.3, Math.sin(a) * 0.95, 0.12, 0.05, 0.5, 0, -a, 0, { grad: 0, glow: 1 }); }
  }
  if (evo >= 3) {
    // croissant de lune dans le dos (éclipse : or ; néant : violet)
    CH.add('arc:0.09:3.6:12', evo >= 4 ? '#c88aff' : GOLD, new THREE.Matrix4().makeTranslation(0, 1.55, -0.42).multiply(new THREE.Matrix4().makeRotationZ(PI / 2 + 0.4)).multiply(new THREE.Matrix4().makeScale(1.25, 1.25, 1.2)), { grad: 0, glow: 0.8 });
  }
  if (evo >= 4) for (const sd of [1, -1]) CP.put('rbox:0.3', '#ff4ad8', sd * 0.32, 0.6, -0.5, 0.12, 1.1, 0.05, 0.4, 0, sd * 0.3, { grad: 0, glow: 0.7 });
}

// ---------- Ragnar (berserker) : fourrure, peintures de guerre bleues, barbe rousse tressée, casque à cornes, haches ----------
function buildBerserker(sh, C, evo, K) {
  const leather = C[1], leatherD = C[2], furL = C[3], paint = C.a, hair = C.h, skin = C.s, fur = C.c;
  const [H, E, HR, CH, HP, L, R, AL, AR, W, OF, CP, FL] = ['head', 'eyes', 'hair', 'chest', 'hips', 'legL', 'legR', 'armL', 'armR', 'wpn', 'off', 'cape', 'float'].map(sh);
  const steel = evo === 3 ? '#8a96ac' : STEEL, pg = evo >= 3 ? 0.9 : 0.05, big = 1 + evo * 0.06;
  // jambes : braies, grosses bottes fourrées
  K.legs(L, R, leatherD, { x: 0.21, w: 0.27 });
  K.boots(L, R, leather, { x: 0.21, top: furL });
  for (const [s, sd] of [[L, 1], [R, -1]]) s.put('sph:7:4', fur, 0.21 * sd, 0.32, 0.02, 0.38, 0.18, 0.4, 0, 0, 0, { grad: 0.2 });
  // kilt de lanières de cuir, large ceinture, boucle ronde
  HP.put('frust:0.36:0.46:8', leather, 0, 0.55, 0, 1, 0.3, 0.92, 0, PI / 8, 0, { grad: 0.2 });
  for (let i = 0; i < 6; i++) { const a = (i / 6 - 0.5) * 1.6; HP.put('box', leatherD, Math.sin(a) * 0.4, 0.42, Math.cos(a) * 0.38, 0.12, 0.3, 0.03, 0, a, 0, { grad: 0.1 }); }
  HP.put('rbox:0.3', leatherD, 0, 0.74, 0, 0.8, 0.16, 0.58, 0, 0, 0, { grad: 0 });
  HP.put('cyl:8', evo >= 4 ? GOLD : steel, 0, 0.74, 0.29, 0.24, 0.05, 0.24, PI / 2, 0, 0, { grad: 0, glow: 0.2 });
  // torse nu peint en bleu, gilet de fourrure, gros col de fourrure (bien visible du dessus)
  CH.put('rbox:0.32', skin, 0, 1.03, 0, 0.82, 0.6, 0.56, 0, 0, 0, { grad: 0.15 });
  CH.put('box', shade(skin, -0.12), 0, 1.08, 0.285, 0.03, 0.28, 0.02, 0, 0, 0, { grad: 0 });
  for (const sd of [1, -1]) {
    CH.put('box', paint, sd * 0.16, 1.02, 0.285, 0.05, 0.36, 0.02, 0, 0, sd * 0.35, { grad: 0, glow: pg });
    CH.put('box', paint, sd * 0.2, 0.86, 0.285, 0.22, 0.05, 0.02, 0, 0, -sd * 0.2, { grad: 0, glow: pg });
    CH.put('rbox:0.3', fur, sd * 0.33, 1.0, 0.02, 0.2, 0.6, 0.6, 0, 0, 0, { grad: 0.2 });
  }
  CH.put('rbox:0.3', fur, 0, 1.0, -0.22, 0.84, 0.6, 0.18, 0, 0, 0, { grad: 0.2 });
  CH.put('tor:0.3:5:12', fur, 0, 1.32, -0.02, 0.86 * big, 0.86 * big, 0.74 * big, PI / 2, 0, 0, { grad: 0.15 });
  for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; CH.put('cone:4', furL, Math.cos(a) * 0.42 * big, 1.3, Math.sin(a) * 0.36 * big - 0.02, 0.14, 0.2, 0.12, PI / 2 + 0.6, -a + PI / 2, 0, { grad: 0 }); }
  // bouclier rond dans le dos : bois, bord de fer, croix bleue
  const Sm = new THREE.Matrix4().makeTranslation(0, 1.0, -0.42);
  const sput = (key, col, x, y, z, sx, sy, sz, rx, o) => CH.add(key, col, Sm.clone().multiply(new THREE.Matrix4().makeTranslation(x, y, z)).multiply(new THREE.Matrix4().makeRotationX(rx)).multiply(new THREE.Matrix4().makeScale(sx, sy, sz)), o);
  sput('cyl:12', '#9a6236', 0, 0, 0, 0.92, 0.1, 0.92, PI / 2, { grad: 0.05 });
  sput('tor:0.14:4:14', steel, 0, 0, -0.03, 0.9, 0.9, 0.5, 0, { grad: 0 });
  sput('box', evo >= 3 ? paint : '#3a6ab8', 0, 0, -0.06, 0.12, 0.84, 0.02, 0, { grad: 0, glow: pg * 0.6 });
  sput('box', evo >= 3 ? paint : '#3a6ab8', 0, 0, -0.06, 0.84, 0.12, 0.02, 0, { grad: 0, glow: pg * 0.6 });
  sput('sph:7:5', steel, 0, 0, -0.07, 0.24, 0.24, 0.16, 0, { grad: 0 });
  // bras nus peints, brassards de cuir
  K.arm(AL, 1, skin, skin, { cuff: leatherD, w: 0.27, glove: shade(skin, -0.04) });
  K.arm(AR, -1, skin, skin, { cuff: leatherD, w: 0.27, glove: shade(skin, -0.04) });
  for (const [s, sd] of [[AL, 1], [AR, -1]]) {
    s.put('rbox:0.3', leatherD, 0.53 * sd, 0.92, 0, 0.3, 0.2, 0.3, 0, 0, 0, { grad: 0 });
    for (const y of [1.06, 1.16]) s.put('box', paint, 0.53 * sd + 0.12 * sd, y, 0, 0.04, 0.05, 0.28, 0, 0, 0, { grad: 0, glow: pg });
  }
  // tête : yeux bleus sous des sourcils froncés, peintures, grande barbe rousse tressée
  K.headBlock(H, C);
  K.eyes(E, { col: evo >= 4 ? '#ff7a1a' : '#2a6ad8', glow: evo >= 4 ? 0.9 : evo === 3 ? 0.5 : 0, r: 0.095, y: 1.83, tall: 1.0 });
  K.brows(H, shade(hair, -0.25), { angry: 0.4, th: 0.09, w: 0.25, y: 1.96 });
  H.sym('box', paint, 0.2, 1.7, 0.445, 0.05, 0.16, 0.03, 0, 0, 0, { grad: 0, glow: pg });
  H.put('rbox:0.4', hair, 0, 1.5, 0.28, 0.8, 0.36, 0.36, 0, 0, 0, { grad: 0.1 });
  H.sym('rbox:0.4', hair, 0.38, 1.64, 0.26, 0.16, 0.38, 0.26, 0, 0, 0.12, { grad: 0.1 });
  H.sym('cap:1.4:6', hair, 0.15, 1.645, 0.47, 0.13, 0.32, 0.12, 0, 0, 1.25, { grad: 0 }); // moustache
  H.put('box', '#8a3040', 0, 1.56, 0.47, 0.14, 0.04, 0.03, 0, 0, 0, { grad: 0 });
  for (const sd of [1, -1]) {
    H.put('cap:2:6', hair, sd * 0.15, 1.2, 0.4, 0.13, 0.42, 0.13, 0.15, 0, 0, { grad: 0.1 }); // tresses de barbe
    H.put('cyl:6', evo >= 4 ? GOLD : steel, sd * 0.15, 1.06, 0.42, 0.12, 0.07, 0.12, 0.15, 0, 0, { grad: 0, glow: 0.15 });
  }
  if (evo >= 4) {
    K.superHair(HR, hair, 0.9, 1.05);
    // cornes d'or sur un bandeau
    H.put('tor:0.12:4:14', GOLD, 0, 2.06, 0, 1.0, 1.0, 0.98, PI / 2, 0, 0, { grad: 0, glow: 0.4 });
    for (const sd of [1, -1]) {
      H.tip('cone:6', GOLD, sd * 0.46, 2.1, 0.05, 0, 0, -sd * 1.15, 0.24, 0.42, 0.24, { grad: 0.1, glow: 0.4 });
      H.tip('cone:5', GOLD, sd * 0.78, 2.28, 0.05, 0, 0, -sd * 0.15, 0.15, 0.38, 0.15, { grad: 0, glow: 0.5 });
    }
  } else {
    // cheveux roux dans le dos, casque à nasal et cornes (plus grandes à chaque stade)
    H.put('rbox:0.4', hair, 0, 1.98, -0.08, 1.04, 0.36, 0.96, 0, 0, 0, { grad: 0.05 });
    H.sym('rbox:0.4', hair, 0.47, 1.76, -0.08, 0.16, 0.5, 0.6, 0, 0, 0, { grad: 0.1 });
    HR.put('rbox:0.4', hair, 0, 1.62, -0.44, 0.96, 0.78, 0.26, 0.12, 0, 0, { grad: 0.15 });
    for (const sd of [1, -1, 0]) HR.put('cone:4', hair, sd * 0.3, 1.16, -0.52, 0.26, 0.3, 0.16, PI, 0, sd * 0.2, { grad: 0 });
    H.put('hemi:10:5', steel, 0, 2.06, -0.02, 1.02, 0.64, 0.98, 0, 0, 0, { grad: -0.1 });
    H.put('cyl:12', shade(steel, -0.2), 0, 2.08, -0.02, 1.04, 0.09, 1.0, 0, 0, 0, { grad: 0 });
    H.put('box', shade(steel, -0.2), 0, 2.24, -0.02, 0.09, 0.32, 0.9, 0, 0, 0, { grad: 0 });
    H.put('box', shade(steel, -0.1), 0, 1.96, 0.5, 0.08, 0.24, 0.05, 0, 0, 0, { grad: 0 });
    const hk = 1 + evo * 0.12, hc = evo === 3 ? '#e8e0d0' : BONE;
    for (const sd of [1, -1]) {
      H.tip('cone:6', hc, sd * 0.46, 2.16, 0.02, 0, 0, -sd * 1.2, 0.24 * hk, 0.4 * hk, 0.24 * hk, { grad: 0.25 });
      H.tip('cone:5', hc, sd * (0.46 + 0.34 * hk), 2.16 + 0.13 * hk, 0.02, 0, 0, -sd * 0.2, 0.16 * hk, 0.38 * hk, 0.16 * hk, { grad: 0.1 });
    }
    if (evo === 1) for (const sd of [1, -1]) H.put('cone:4', fur, sd * 0.24, 2.4, -0.24, 0.2, 0.26, 0.14, -0.2, 0, -sd * 0.2, { grad: 0.1 }); // oreilles de loup
    if (evo === 3) H.put('oct', paint, 0, 2.15, 0.5, 0.12, 0.18, 0.06, 0, 0, 0, { grad: 0, glow: 1 });
  }
  // hache (main droite) : manche de bois, fer en croissant, liseré bleu ; une 2e hache dans la main gauche à partir du stade 2
  const edge = evo >= 4 ? '#ffd08a' : evo === 3 ? '#bff4ff' : '#ffffff', eg = evo >= 3 ? 0.9 : 0.2, headC = evo >= 4 ? '#e0a040' : steel;
  const axe = (s, x, k, ry) => {
    const Am = new THREE.Matrix4().makeTranslation(x, 0, 0.06).multiply(new THREE.Matrix4().makeRotationY(ry));
    const ap = (key, col, px, py, pz, sx, sy, sz, rx, o) => s.add(key, col, Am.clone().multiply(new THREE.Matrix4().makeTranslation(px, py, pz)).multiply(new THREE.Matrix4().makeRotationX(rx)).multiply(new THREE.Matrix4().makeScale(sx, sy, sz)), o);
    const hy = 0.92 + 0.5 * k;
    ap('cyl:6', '#8a5a32', 0, 0.92, 0, 0.1 * k, 1.3 * k, 0.1 * k, 0, { grad: 0.1 });
    ap('cyl:6', paint, 0, hy - 0.26 * k, 0, 0.13 * k, 0.07, 0.13 * k, 0, { grad: 0, glow: pg * 0.6 });
    ap('cyl:6', WOOD_D, 0, 0.92 - 0.62 * k, 0, 0.14 * k, 0.1, 0.14 * k, 0, { grad: 0 });
    ap('rbox:0.2', shade(headC, -0.2), 0, hy, 0.06, 0.14, 0.28 * k, 0.26 * k, 0, { grad: 0 });
    ap('sph:9:6', headC, 0, hy - 0.04 * k, 0.3 * k, 0.1, 0.66 * k, 0.5 * k, 0, { grad: 0.05, glow: evo >= 4 ? 0.3 : 0 });
    ap('sph:9:6', edge, 0, hy - 0.04 * k, 0.42 * k, 0.085, 0.56 * k, 0.4 * k, 0, { grad: 0, glow: eg });
    ap('sph:9:6', headC, 0, hy - 0.04 * k, 0.27 * k, 0.12, 0.54 * k, 0.42 * k, 0, { grad: 0.05, glow: evo >= 4 ? 0.3 : 0 });
    ap('sph:6:4', paint, 0, hy - 0.02 * k, 0.24 * k, 0.13, 0.12, 0.12, 0, { grad: 0, glow: pg });
    ap('cone:4', headC, 0, hy, -0.14, 0.1, 0.24 * k, 0.12, -PI / 2, { grad: 0 });
  };
  axe(W, -0.53, 1 + evo * 0.06, -0.7);
  if (evo >= 2) axe(OF, 0.53, 0.82 + evo * 0.04, 0.7);
  // stades
  if (evo === 1 || evo === 2) {
    // peau de loup (gris) puis d'ours (brun) sur le dos ; grosses épaules de fourrure
    K.capeShape(CP, fur, furL, { len: 0.8 + evo * 0.1, w: 0.9 + evo * 0.06 });
    for (const sd of [1, -1]) CH.put('sph:7:5', fur, 0.48 * sd, 1.28, 0, 0.42 * big, 0.3 * big, 0.44 * big, 0, 0, -0.25 * sd, { grad: 0.2 });
    if (evo === 2) for (const sd of [1, -1]) for (let i = 0; i < 3; i++) CH.put('cone:4', BONE, 0.5 * sd + sd * 0.08 * (i - 1), 1.44, 0.18 - i * 0.12, 0.07, 0.2, 0.07, 0, 0, -sd * 0.5, { grad: 0 }); // griffes
  }
  if (evo >= 3) {
    K.pauldron(CH, 1, steel, paint, 0.9 * big, evo >= 4 ? GOLD : steel);
    K.pauldron(CH, -1, steel, paint, 0.9 * big, evo >= 4 ? GOLD : steel);
    K.capeShape(CP, evo >= 4 ? '#7a1a0a' : '#2a2a3a', evo >= 4 ? GOLD : paint, { len: 1.0, w: 1.02, glow: evo >= 4 ? 0.15 : 0.1 });
  }
  if (evo === 3) for (let i = 0; i < 4; i++) { const a = i / 4 * TAU; FL.put('oct', '#5ad8ff', Math.cos(a) * 0.95, 1.3 + (i % 2) * 0.35, Math.sin(a) * 0.95, 0.12, 0.34, 0.12, 0, 0, 0.5, { grad: 0, glow: 1 }); } // runes de foudre
  if (evo >= 4) for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; FL.put('cone:4', i % 2 ? '#ff7a1a' : '#ffd04a', Math.cos(a) * 1.0, 1.0 + (i % 2) * 0.4, Math.sin(a) * 1.0, 0.18, 0.4, 0.18, 0, 0, 0, { grad: 0, glow: 1.1 }); } // flammes
}

// ---------- Attaques (pose.atk : 1 au coup, décroît ; w = poids, u = avancement 0 → 1) ----------
// faux : fauchage à deux mains, le buste tourne largement
function atkVampire(b, w, u) {
  const s = smooth(u / 0.32), lift = smooth(u / 0.08);
  b.armR.rotation.z = lerp(b.armR.rotation.z, -1.25, w * lift);
  b.armR.rotation.y = lerp(-0.9, 2.3, s) * w;
  b.armR.rotation.x = lerp(b.armR.rotation.x, -0.2, w);
  b.wpn.rotation.x = 1.15 * w * lift;
  b.armL.rotation.x = lerp(b.armL.rotation.x, -1.0, w); b.armL.rotation.y = lerp(-0.5, 0.9, s) * w;
  b.chest.rotation.y = lerp(-0.8, 0.95, s) * w; b.hips.rotation.y = lerp(-0.3, 0.4, s) * w;
}
// dagues : pirouette éclair, bras ouverts, les dagues partent tout autour
function atkAssassin(b, w, u) {
  b.body.rotation.y = TAU * smooth(u / 0.9);
  b.armL.rotation.z = lerp(b.armL.rotation.z, 1.35, w); b.armR.rotation.z = lerp(b.armR.rotation.z, -1.35, w);
  b.armL.rotation.x = lerp(b.armL.rotation.x, -0.35, w); b.armR.rotation.x = lerp(b.armR.rotation.x, -0.35, w);
  b.chest.rotation.x += 0.12 * w; b.cape.rotation.x += 0.9 * w;
}
// hache : bras levé derrière la tête puis lancer vers l'avant
function atkBerserker(b, w, u) {
  const s = smooth(u / 0.35);
  b.armR.rotation.x = lerp(b.armR.rotation.x, lerp(-2.8, -0.6, s), w);
  b.armR.rotation.z = lerp(b.armR.rotation.z, -0.25, w);
  b.wpn.rotation.x = lerp(-0.5, 0.7, s) * w;
  b.chest.rotation.x += lerp(-0.18, 0.28, s) * w; b.chest.rotation.y = lerp(-0.5, 0.35, s) * w;
  b.armL.rotation.x = lerp(b.armL.rotation.x, -0.7, w); b.armL.rotation.z = lerp(b.armL.rotation.z, 0.45, w);
}

export const HEROES_C1 = {
  vampire: { build: buildVampire, atk: atkVampire },
  assassin: { build: buildAssassin, atk: atkAssassin, shot: 'dagger' },
  berserker: { build: buildBerserker, atk: atkBerserker, shot: 'boom' },
};
