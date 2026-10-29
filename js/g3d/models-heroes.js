// Héros 3D low-poly (Lumi, Kira, Brok) : marionnette à os (un maillage fusionné par os), 5 stades d'évolution,
// animation procédurale (respiration, clignement, course, saut, atterrissage, attaques par classe, coup, KO)
// et aura de super guerrier animée au dernier stade (coque de flammes, étincelles, éclairs, cheveux lumineux).
import { THREE, PI, TAU, clamp, lerp, damp, smooth, angDiff, yawOf, shade, mixC, Shape, Rig, charMaterial, glowTex } from './models-kit.js';
import { CLASSES, EVOLUTIONS } from '../data.js';
import { HEROES_C1 } from './models-heroes-c1.js'; // Nyx, Sora, Ragnar (champions C1)
import { HEROES_C2 } from './models-heroes-c2.js'; // Frida, Gaïa (champions C2)
import { HEROES_ENG } from './models-hero-engineer.js'; // Tess (ingénieure)

// os : [parent, x, y, z] (pivots au repos, le modèle regarde vers +Z, sa gauche est +X)
const BONES = {
  body: [null, 0, 0, 0],
  hips: ['body', 0, 0.62, 0],
  legL: ['hips', 0.19, 0.6, 0],
  legR: ['hips', -0.19, 0.6, 0],
  chest: ['hips', 0, 0.76, 0],
  head: ['chest', 0, 1.36, 0.02],
  eyes: ['head', 0, 1.8, 0.42],
  hair: ['head', 0, 2.1, -0.1],
  armL: ['chest', 0.47, 1.22, 0],
  armR: ['chest', -0.47, 1.22, 0],
  wpn: ['armR', -0.53, 0.8, 0.06],
  off: ['armL', 0.53, 0.8, 0.06],
  cape: ['chest', 0, 1.3, -0.27],
  wingL: ['chest', 0.14, 1.25, -0.32],
  wingR: ['chest', -0.14, 1.25, -0.32],
  float: ['body', 0, 1.5, 0],
};
const EVO_SCALE = [1, 1.05, 1.1, 1.15, 1.21];
const HERO_K = 1.22; // le héros est un peu plus grand que son rayon de collision : bien lisible sous la caméra haute
export const HERO_HEIGHT = 2.4 * HERO_K; // hauteur au repos (stade 0, sans accessoires), en unités 3D

export function heroColors(clsId, evo = 0) {
  const c = { ...CLASSES[clsId].colors, ...(EVOLUTIONS[clsId][evo]?.colors || {}) };
  return c;
}

// ---------- Pièces communes ----------
const SKIN = '#ffd2b0', SKIN_D = '#e8a888', INK = '#24142e', LEATHER = '#7a4a2a', LEATHER_D = '#553018', WOOD = '#9a6236';

function headBlock(h, C, { w = 0.94, hh = 0.86, d = 0.86, skin = C.s || SKIN } = {}) {
  h.put('rbox:0.32', skin, 0, 1.8, 0.02, w, hh, d, 0, 0, 0, { grad: 0.12 });
  h.sym('sph:6:4', skin, 0.47, 1.76, 0.02, 0.14, 0.2, 0.12, 0, 0, 0, { grad: 0.1 }); // oreilles
  h.put('sph:6:4', shade(skin, -0.08), 0, 1.71, 0.46, 0.13, 0.11, 0.1, 0, 0, 0, { grad: 0 }); // nez
  h.sym('sph:6:4', '#ff9a9a', 0.29, 1.66, 0.4, 0.13, 0.07, 0.04, 0, 0.5, 0, { grad: 0 }); // joues
}
function eyes(e, { col = '#2a3a8a', glow = 0, y = 1.8, x = 0.2, r = 0.1, tall = 1.2, white = '#ffffff' } = {}) {
  for (const sd of [1, -1]) e.eye(x * sd, y, 0.42, r, { pupil: col, ry: 0.22 * sd, tall, glow, white, pr: 0.66 });
}
function brows(h, col, { y = 1.96, angry = 0.12, w = 0.2, th = 0.055 } = {}) {
  h.sym('box', col, 0.2, y, 0.44, w, th, 0.06, 0, 0, angry, { grad: 0 });
}
function mouth(h, kind = 'smile') {
  if (kind === 'smile') {
    h.put('box', '#8a3040', 0, 1.6, 0.445, 0.16, 0.05, 0.03, 0, 0, 0, { grad: 0 });
    h.sym('box', '#8a3040', 0.095, 1.62, 0.44, 0.06, 0.04, 0.03, 0, 0, 0.6, { grad: 0 });
  } else if (kind === 'grin') {
    h.put('box', '#ffffff', 0, 1.6, 0.445, 0.2, 0.06, 0.03, 0, 0, 0, { grad: 0 });
    h.put('box', '#8a3040', 0, 1.575, 0.44, 0.2, 0.025, 0.03, 0, 0, 0, { grad: 0 });
  }
}
function boots(L, R, col, { y = 0.12, x = 0.19, top = null } = {}) {
  for (const [s, sd] of [[L, 1], [R, -1]]) {
    s.put('rbox:0.25', col, x * sd, y, 0.05, 0.3, 0.24, 0.42, 0, 0, 0, { grad: 0.25 });
    if (top) s.put('rbox:0.3', top, x * sd, y + 0.15, 0.02, 0.32, 0.08, 0.34, 0, 0, 0, { grad: 0 });
  }
}
function legs(L, R, col, { x = 0.19, w = 0.24 } = {}) {
  for (const [s, sd] of [[L, 1], [R, -1]]) s.put('rbox:0.3', col, x * sd, 0.4, 0, w, 0.42, w * 1.05, 0, 0, 0, { grad: 0.15 });
}
function arm(s, sd, sleeve, hand, { cuff = null, bell = false, w = 0.22, glove = null } = {}) {
  const x = 0.53 * sd;
  if (bell) {
    s.put('frust:0.12:0.2:6', sleeve, x, 1.03, 0, 1, 0.42, 1, 0, 0, 0, { grad: 0.15 });
  } else s.put('rbox:0.35', sleeve, x, 1.04, 0, w, 0.42, w, 0, 0, 0, { grad: 0.15 });
  if (cuff) s.put('rbox:0.3', cuff, x, 0.86, 0, w + 0.06, 0.08, w + 0.06, 0, 0, 0, { grad: 0 });
  s.put('rbox:0.4', glove || hand, x, 0.76, 0.03, 0.24, 0.22, 0.24, 0, 0, 0, { grad: 0.15 });
}
function pauldron(s, sd, col, trim, k = 1, spike = null) {
  s.put('sph:7:5', col, 0.5 * sd, 1.27, 0, 0.42 * k, 0.32 * k, 0.44 * k, 0, 0, -0.25 * sd, { grad: 0.2 });
  if (trim) s.put('tor:0.12:4:10', trim, 0.5 * sd, 1.2, 0, 0.36 * k, 0.36 * k, 0.4 * k, PI / 2, 0, -0.25 * sd, { grad: 0 });
  if (spike) s.put('cone:5', spike, 0.6 * sd, 1.45, 0, 0.12 * k, 0.32 * k, 0.12 * k, 0, 0, -0.6 * sd, { grad: 0.1, glow: 0.15 });
}
function capeShape(s, col, trim, { len = 0.85, w = 0.78, y0 = 1.32, glow = 0 } = {}) {
  s.put('frust:0.3:0.5:4', col, 0, y0 - len / 2, -0.33, w * 1.25, len, 0.1, 0.12, PI / 4, 0, { grad: 0.3, glow });
  if (trim) s.put('rbox:0.4', trim, 0, y0, -0.28, w * 0.9, 0.1, 0.16, 0, 0, 0, { grad: 0, glow: glow * 0.5 });
}
function star(s, col, x, y, z, r, o = {}) { // étoile à 5 branches en relief
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * TAU;
    s.add('cone:4', col, new THREE.Matrix4().makeTranslation(x, y, z).multiply(new THREE.Matrix4().makeRotationZ(a)).multiply(new THREE.Matrix4().makeTranslation(0, r * 0.55, 0)).multiply(new THREE.Matrix4().makeScale(r * 0.45, r * 1.1, r * 0.3)), { grad: 0, ...o });
  }
  s.put('sph:6:4', col, x, y, z, r * 0.7, r * 0.7, r * 0.35, 0, 0, 0, { grad: 0, ...o });
}
function crownOf(s, col, gem, { y = 2.28, r = 0.3, n = 5, h = 0.24, glow = 0.15 } = {}) {
  s.put('cyl:10', col, 0, y, 0, r * 2, 0.12, r * 2, 0, 0, 0, { grad: 0.1, glow });
  for (let i = 0; i < n; i++) {
    const a = i / n * TAU + PI / 2;
    s.put('cone:4', col, Math.cos(a) * r * 0.92, y + h / 2 + 0.04, Math.sin(a) * r * 0.92, 0.1, h, 0.1, 0, 0, 0, { grad: 0, glow });
  }
  s.put('oct', gem, 0, y + 0.02, r + 0.02, 0.12, 0.16, 0.08, 0, 0, 0, { grad: 0, glow: 0.9 });
}
function halo(s, col, y, r = 0.38) {
  s.put('tor:0.11:4:16', col, 0, y, -0.05, r * 2, r * 2, r * 2, PI / 2 - 0.25, 0, 0, { grad: 0, glow: 1.2 });
}
// ailes de plumes (une par os, elles battent doucement) : éventail de plumes vers l'extérieur et l'arrière
function wings(get, cols, { glow = 0.3, k = 1, n = 4 } = {}) {
  for (const [bn, sd] of [['wingL', 1], ['wingR', -1]]) {
    const s = get(bn);
    for (let i = 0; i < n; i++) {
      const L = (1.25 - i * 0.17) * k, a = 0.5 + i * 0.36;
      const m = new THREE.Matrix4().makeTranslation(sd * 0.14, 1.25 + 0.05 * i, -0.34 - i * 0.02)
        .multiply(new THREE.Matrix4().makeRotationY(sd * 0.45)).multiply(new THREE.Matrix4().makeRotationZ(-sd * a))
        .multiply(new THREE.Matrix4().makeTranslation(0, L / 2, 0)).multiply(new THREE.Matrix4().makeScale(0.26 * k, L, 0.07));
      s.add('rbox:0.45', cols[i % cols.length], m, { grad: -0.25, glow });
    }
  }
}
// cheveux en pointes de super guerrier (forme ultime) : grandes mèches lumineuses vers le haut et l'arrière
function superHair(s, col, glow = 0.75, big = 1) {
  const spikes = [[0, 0.62, -0.05, 0.0, 0.0], [0.26, 0.5, -0.1, 0.0, -0.45], [-0.26, 0.5, -0.1, 0.0, 0.45], [0.42, 0.34, -0.12, 0.0, -0.9], [-0.42, 0.34, -0.12, 0.0, 0.9],
    [0.14, 0.52, -0.32, -0.55, -0.2], [-0.14, 0.52, -0.32, -0.55, 0.2], [0, 0.46, -0.42, -0.9, 0], [0.32, 0.36, -0.36, -0.7, -0.5], [-0.32, 0.36, -0.36, -0.7, 0.5]];
  s.put('rbox:0.35', col, 0, 2.12, -0.06, 0.98, 0.34, 0.9, 0, 0, 0, { grad: 0.05, glow });
  for (const [x, L, z, rx, rz] of spikes) {
    s.add('cone:4', col, new THREE.Matrix4().makeTranslation(x, 2.22, z).multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, 0, rz))).multiply(new THREE.Matrix4().makeTranslation(0, L * big / 2, 0)).multiply(new THREE.Matrix4().makeScale(0.3, L * big, 0.3)), { grad: -0.25, glow });
  }
  // mèches sur le front
  for (const sd of [1, -1, 0]) s.put('cone:4', col, sd * 0.2, 2.06, 0.38, 0.2, 0.34, 0.16, 2.3, 0, sd * 0.4, { grad: 0, glow });
}

// ---------- Lumi (mage) ----------
function buildMage(sh, C, evo) {
  const robe = C[1], robeS = C[2], trim = C.c, gold = C.a, hair = C.h, skin = C.s;
  const [H, E, HR, CH, HP, L, R, AL, AR, W, CP, FL] = ['head', 'eyes', 'hair', 'chest', 'hips', 'legL', 'legR', 'armL', 'armR', 'wpn', 'cape', 'float'].map(sh);
  boots(L, R, evo === 2 ? '#2a1a5a' : trim, { top: gold });
  legs(L, R, shade(robeS, -0.1), { w: 0.2 });
  // robe évasée + ceinture
  HP.put('frust:0.36:0.56:8', robe, 0, 0.42, 0, 1, 0.64, 0.92, 0, PI / 8, 0, { grad: 0.25 });
  HP.put('frust:0.56:0.58:8', trim, 0, 0.13, 0, 1, 0.08, 0.93, 0, PI / 8, 0, { grad: 0 });
  HP.put('box', trim, 0, 0.42, 0.46, 0.14, 0.6, 0.04, -0.3, 0, 0, { grad: 0 });
  HP.put('rbox:0.3', gold, 0, 0.74, 0, 0.72, 0.1, 0.52, 0, 0, 0, { grad: 0, glow: 0.1 });
  CH.put('rbox:0.32', robe, 0, 1.02, 0, 0.74, 0.58, 0.52, 0, 0, 0, { grad: 0.2 });
  CH.put('rbox:0.4', trim, 0, 1.3, 0.02, 0.64, 0.12, 0.5, 0, 0, 0, { grad: 0 }); // col
  CH.put('box', trim, 0, 1.0, 0.27, 0.12, 0.5, 0.03, 0, 0, 0, { grad: 0 });
  CH.put('oct', evo === 1 ? '#ff6ad8' : '#5ad0ff', 0, 1.16, 0.3, 0.16, 0.2, 0.08, 0, 0, 0, { grad: 0, glow: 0.9 });
  arm(AL, 1, robe, skin, { bell: true, cuff: trim });
  arm(AR, -1, robe, skin, { bell: true, cuff: trim });
  // tête
  headBlock(H, C);
  eyes(E, { col: evo >= 4 ? '#14b8c8' : evo === 2 ? '#7a3ad8' : '#3a5ad8', glow: evo >= 4 ? 0.45 : 0, r: 0.105 });
  brows(H, shade(hair, -0.35), { angry: 0.05 });
  mouth(H, 'smile');
  if (evo >= 4) {
    superHair(HR, hair, 0.8);
  } else {
    // cheveux : carré blond + mèches
    H.put('rbox:0.4', hair, 0, 1.98, -0.08, 1.02, 0.58, 0.98, 0, 0, 0, { grad: 0.1 });
    H.sym('rbox:0.4', hair, 0.42, 1.62, 0.02, 0.2, 0.58, 0.5, 0, 0, 0.05, { grad: 0.15 });
    H.put('rbox:0.4', hair, 0, 1.6, -0.36, 0.86, 0.6, 0.26, 0, 0, 0, { grad: 0.15 });
    H.put('rbox:0.4', hair, 0.1, 2.06, 0.38, 0.62, 0.18, 0.16, 0.3, 0, -0.15, { grad: 0 });
    // chapeau pointu (bien visible du dessus)
    const hatC = evo === 0 ? trim : evo === 1 ? trim : evo === 2 ? '#2a1a6a' : '#f4fbff';
    const tip = evo === 3 ? '#9ad8ff' : gold;
    HR.put('cyl:10', hatC, 0, 2.18, -0.05, 1.36, 0.08, 1.3, -0.08, 0, 0, { grad: 0.1 });
    HR.put('tor:0.12:4:12', shade(hatC, -0.15), 0, 2.2, -0.05, 1.3, 1.3, 1.22, PI / 2 - 0.08, 0, 0, { grad: 0 });
    HR.put('frust:0.36:0.5:8', hatC, 0, 2.38, -0.07, 1, 0.32, 0.96, -0.12, 0, 0, { grad: 0.1 });
    HR.put('frust:0.5:0.52:8', gold, 0, 2.28, -0.06, 1.02, 0.1, 0.98, -0.12, 0, 0, { grad: 0, glow: 0.15 });
    HR.add('cone:8', hatC, new THREE.Matrix4().makeTranslation(0, 2.52, -0.1).multiply(new THREE.Matrix4().makeRotationX(-0.45)).multiply(new THREE.Matrix4().makeTranslation(0, 0.4, 0)).multiply(new THREE.Matrix4().makeScale(0.72, 0.85, 0.7)), { grad: -0.2 });
    HR.add('cone:6', hatC, new THREE.Matrix4().makeTranslation(0, 2.52, -0.1).multiply(new THREE.Matrix4().makeRotationX(-0.45)).multiply(new THREE.Matrix4().makeTranslation(0, 0.78, 0)).multiply(new THREE.Matrix4().makeRotationX(-0.7)).multiply(new THREE.Matrix4().makeTranslation(0, 0.18, 0)).multiply(new THREE.Matrix4().makeScale(0.3, 0.42, 0.3)), { grad: 0 });
    star(HR, tip, 0, 2.62, 0.25, 0.2, { glow: 0.6 });
    if (evo === 1) HR.put('oct', '#ff6ad8', 0.38, 2.36, 0.3, 0.14, 0.2, 0.1, 0, 0, 0, { glow: 0.9 });
    if (evo === 3) halo(HR, gold, 3.25, 0.32);
  }
  // bâton (main droite) : orbe lumineux
  const top = 2.5 + evo * 0.08, orbC = evo === 1 ? '#ffb0f0' : evo === 2 ? '#fff0a0' : evo === 3 ? '#bff0ff' : evo === 4 ? '#ffffff' : '#9ae0ff';
  const sx = -0.53, sz = 0.06;
  W.put('cyl:6', evo >= 3 ? '#f4f0ff' : evo === 2 ? '#3a2a7a' : WOOD, sx, (0.2 + top) / 2 - 0.12, sz, 0.09, top - 0.3, 0.09, 0, 0, 0, { grad: 0.1 });
  W.put('cyl:6', gold, sx, 0.98, sz, 0.12, 0.08, 0.12, 0, 0, 0, { grad: 0 });
  W.put('cone:6', gold, sx, top - 0.22, sz, 0.28, 0.2, 0.28, PI, 0, 0, { grad: 0, glow: 0.2 });
  W.put('tor:0.1:4:10', gold, sx, top, sz, 0.56 + evo * 0.06, 0.56 + evo * 0.06, 0.5, 0, 0, 0, { grad: 0, glow: 0.25 });
  W.put('ico', orbC, sx, top, sz, 0.34 + evo * 0.04, 0.34 + evo * 0.04, 0.34 + evo * 0.04, 0, 0, 0, { grad: 0, glow: 1.2 });
  if (evo === 2) for (const sd of [1, -1]) W.put('cone:4', gold, sx + 0.24 * sd, top + 0.18, sz, 0.08, 0.36, 0.06, 0, 0, -0.55 * sd, { glow: 0.3 });
  if (evo >= 3) for (const sd of [1, -1]) W.put('oct', '#ffffff', sx + 0.3 * sd, top - 0.05, sz, 0.12, 0.3, 0.1, 0, 0, -0.4 * sd, { glow: 0.8 });
  // stades
  if (evo >= 1) {
    pauldron(CH, 1, gold, evo === 2 ? gold : trim, 0.85);
    pauldron(CH, -1, gold, evo === 2 ? gold : trim, 0.85);
    capeShape(CP, trim, gold, { len: 0.75 + evo * 0.1, w: 0.8 + evo * 0.06 });
  }
  if (evo === 1) FL.put('oct', '#ff9ae8', 0, 1.7, -0.75, 0.3, 0.46, 0.3, 0, 0.6, 0, { glow: 1 }); // prisme flottant
  if (evo === 2) for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; star(FL, '#fff6c0', Math.cos(a) * 0.95, 1.55 + (i % 2) * 0.3, Math.sin(a) * 0.95, 0.12, { glow: 1 }); }
  if (evo === 3) wings(sh, ['#ffffff', '#e8f6ff', '#bfeaff', '#ffffff'], { glow: 0.35 });
  if (evo >= 4) {
    capeShape(CP, '#ffffff', gold, { len: 1.1, w: 1.0, glow: 0.2 });
    for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; star(FL, '#fff6c0', Math.cos(a) * 1.0, 1.0 + (i % 2) * 0.4, Math.sin(a) * 1.0, 0.13, { glow: 1.2 }); }
  }
}

// ---------- Kira (archère) ----------
function buildArcher(sh, C, evo) {
  const tunic = C[1], tunicS = C[2], light = C[3], navy = C.c, hair = C.h, ice = C.a, skin = C.s;
  const [H, E, HR, CH, HP, L, R, AL, AR, W, OF, CP, FL] = ['head', 'eyes', 'hair', 'chest', 'hips', 'legL', 'legR', 'armL', 'armR', 'wpn', 'off', 'cape', 'float'].map(sh);
  boots(L, R, evo >= 3 ? light : LEATHER, { top: evo >= 1 ? light : '#a8743a' });
  legs(L, R, evo >= 4 ? '#c8e4ff' : navy, { w: 0.22 });
  HP.put('frust:0.36:0.44:8', tunic, 0, 0.56, 0, 1, 0.34, 0.92, 0, PI / 8, 0, { grad: 0.2 });
  HP.put('rbox:0.3', LEATHER, 0, 0.74, 0, 0.7, 0.1, 0.5, 0, 0, 0, { grad: 0 });
  HP.put('rbox:0.3', '#e0b040', 0, 0.74, 0.25, 0.14, 0.1, 0.04, 0, 0, 0, { grad: 0, glow: 0.1 });
  CH.put('rbox:0.32', tunic, 0, 1.02, 0, 0.72, 0.58, 0.5, 0, 0, 0, { grad: 0.2 });
  CH.put('box', light, 0, 1.02, 0.26, 0.1, 0.5, 0.03, 0, 0, 0, { grad: 0 });
  // bandoulière + carquois (visible de dos et du dessus)
  CH.put('box', LEATHER, 0, 1.02, 0, 0.78, 0.09, 0.56, 0, 0, 0.75, { grad: 0 });
  CH.put('cyl:6', LEATHER, 0.18, 1.12, -0.36, 0.26, 0.7, 0.26, 0, 0, -0.35, { grad: 0.2 });
  CH.put('cyl:6', '#a8743a', 0.3, 1.44, -0.36, 0.3, 0.07, 0.3, 0, 0, -0.35, { grad: 0 });
  for (let i = 0; i < 3; i++) {
    const ox = 0.28 + i * 0.07, oz = -0.32 - (i % 2) * 0.08;
    CH.put('cyl:4', '#f0e2c0', ox + 0.07, 1.6, oz, 0.04, 0.36, 0.04, 0, 0, -0.35, { grad: 0 });
    CH.put('cone:4', i === 1 ? ice : '#ffffff', ox + 0.14, 1.78, oz, 0.14, 0.2, 0.05, 0, 0, -0.35, { grad: 0, glow: 0.2 });
  }
  // capuche baissée sur les épaules
  CH.put('rbox:0.45', tunicS, 0, 1.3, -0.08, 0.8, 0.18, 0.56, 0, 0, 0, { grad: 0.1 });
  CH.put('sph:8:5', tunicS, 0, 1.36, -0.3, 0.6, 0.34, 0.3, 0, 0, 0, { grad: 0.2 });
  arm(AL, 1, tunicS, skin, { cuff: light, glove: LEATHER });
  arm(AR, -1, tunicS, skin, { cuff: light, glove: LEATHER });
  headBlock(H, C);
  eyes(E, { col: evo >= 4 ? '#14b8c8' : '#1a8ad8', glow: evo >= 4 ? 0.45 : 0, r: 0.105 });
  brows(H, '#6a7a9a', { angry: 0.16, y: 1.95, th: 0.05 });
  mouth(H, 'smile');
  if (evo >= 4) superHair(HR, hair, 0.85);
  else {
    // capuche de rôdeuse (pointe vers l'arrière), mèches blanches, queue de cheval qui dépasse
    const hood = evo === 0 ? tunicS : evo === 4 ? '#e8f6ff' : tunicS, hoodL = evo >= 1 ? ice : light;
    // mèches blanches (frange + côtés) sous la capuche
    H.put('rbox:0.4', hair, 0, 2.02, 0.1, 0.96, 0.34, 0.66, 0, 0, 0, { grad: 0.05 });
    for (const [x, r] of [[-0.25, 0.3], [0.02, -0.1], [0.27, -0.3]]) H.put('rbox:0.4', hair, x, 2.05, 0.41, 0.28, 0.18, 0.12, 0.2, 0, r, { grad: 0 });
    H.sym('rbox:0.4', hair, 0.43, 1.7, 0.22, 0.12, 0.4, 0.2, 0, 0, 0.06, { grad: 0.1 });
    // capuche : couvre le dessus et l'arrière, bord clair au-dessus du front
    H.put('rbox:0.45', hood, 0, 2.1, -0.12, 1.08, 0.52, 0.92, 0, 0, 0, { grad: 0.05 });
    H.sym('rbox:0.42', hood, 0.48, 1.78, -0.16, 0.16, 0.62, 0.66, 0, 0, 0.04, { grad: 0.15 });
    H.put('rbox:0.42', hood, 0, 1.74, -0.44, 0.98, 0.62, 0.22, 0, 0, 0, { grad: 0.15 });
    H.put('rbox:0.45', hoodL, 0, 2.18, 0.3, 0.98, 0.12, 0.16, -0.3, 0, 0, { grad: 0, glow: evo >= 1 ? 0.25 : 0 });
    H.sym('rbox:0.45', hoodL, 0.5, 1.86, 0.18, 0.1, 0.56, 0.12, 0, 0, 0.12, { grad: 0, glow: evo >= 1 ? 0.25 : 0 });
    HR.add('cone:5', hood, new THREE.Matrix4().makeTranslation(0, 2.16, -0.46).multiply(new THREE.Matrix4().makeRotationX(-2.0)).multiply(new THREE.Matrix4().makeTranslation(0, 0.24, 0)).multiply(new THREE.Matrix4().makeScale(0.5, 0.56, 0.4)), { grad: 0.1 });
    for (let i = 0; i < 3; i++) HR.put('sph:6:5', hair, 0, 1.5 - i * 0.2, -0.6 - i * 0.05, 0.26 - i * 0.03, 0.3, 0.24 - i * 0.02, 0, 0, 0, { grad: 0.1 });
    HR.put('cone:4', hair, 0, 0.84, -0.74, 0.16, 0.24, 0.14, PI, 0, 0, { grad: 0 });
    // plume sur la capuche
    HR.add('cone:4', evo >= 1 ? '#ffffff' : '#e84a3a', new THREE.Matrix4().makeTranslation(0.4, 2.2, -0.15).multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(-0.9, 0, -0.5))).multiply(new THREE.Matrix4().makeTranslation(0, 0.3, 0)).multiply(new THREE.Matrix4().makeScale(0.14, 0.62, 0.05)), { grad: 0.1 });
    if (evo === 2) crownOf(HR, light, ice, { y: 2.34, r: 0.34, h: 0.3, glow: 0.4 });
    if (evo === 3) for (let i = -2; i <= 2; i++) HR.put('oct', '#e8fff8', i * 0.18, 2.5 - Math.abs(i) * 0.08, 0.1, 0.12, 0.42 - Math.abs(i) * 0.1, 0.1, 0, 0, -i * 0.25, { glow: 0.6 });
  }
  // arc (main gauche) : grand arc courbé vertical, corde blanche
  // l'arc est vertical, ventre vers l'avant (+z) ; pendant le tir l'os « off » compense le bras tendu
  const bowC = evo === 0 ? WOOD : evo === 4 ? '#e8fbff' : evo === 3 ? '#7affe0' : '#bfe6ff', bowG = evo ? 0.35 : 0;
  const bx = 0.56, by = 0.78, apex = 0.2, R0 = 0.8 + evo * 0.04, sz = apex - R0 * 0.547;
  OF.add('arc:0.07:2.2:9', bowC, new THREE.Matrix4().makeTranslation(bx, by, apex - R0).multiply(new THREE.Matrix4().makeRotationY(-PI / 2)).multiply(new THREE.Matrix4().makeRotationZ(-1.1)).multiply(new THREE.Matrix4().makeScale(R0 * 2, R0 * 2, 1.5)), { grad: 0, glow: bowG });
  OF.put('cyl:4', '#ffffff', bx, by, sz, 0.025, R0 * 1.78, 0.025, 0, 0, 0, { grad: 0, glow: 0.4 });
  OF.put('rbox:0.3', LEATHER, bx, by, apex, 0.15, 0.26, 0.13, 0, 0, 0, { grad: 0 });
  if (evo >= 1) for (const sd of [1, -1]) OF.put('oct', ice, bx, by + sd * R0 * 0.9, sz + 0.02, 0.14, 0.3, 0.14, sd * 0.4, 0, 0, { grad: 0, glow: 0.8 });
  // stades
  if (evo >= 1) {
    for (const sd of [1, -1]) {
      CH.put('oct', ice, 0.48 * sd, 1.38, 0, 0.26, 0.5, 0.26, 0, 0, -0.35 * sd, { glow: 0.4 });
      CH.put('oct', light, 0.56 * sd, 1.28, 0.1, 0.16, 0.32, 0.16, 0, 0, -0.75 * sd, { glow: 0.4 });
    }
    capeShape(CP, evo >= 4 ? '#ffffff' : evo === 3 ? navy : navy, light, { len: 0.8 + evo * 0.08, w: 0.8 + evo * 0.05, glow: evo >= 3 ? 0.15 : 0 });
  }
  if (evo === 2) CH.put('tor:0.22:5:12', '#ffffff', 0, 1.33, -0.02, 0.86, 0.86, 0.66, PI / 2, 0, 0, { grad: 0.1 }); // col de fourrure
  if (evo === 3) wings(sh, ['#7affe0', '#ff8ae0', '#9a7aff'], { glow: 0.7, k: 0.9, n: 3 }); // ailes d'aurore
  if (evo >= 4) {
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; FL.put('oct', '#e8fbff', Math.cos(a) * 0.95, 1.4 + (i % 2) * 0.35, Math.sin(a) * 0.95, 0.16, 0.36, 0.16, 0, a, 0, { glow: 1 }); }
  }
}

// ---------- Brok (chevalier) ----------
function buildKnight(sh, C, evo) {
  const steel = C[1], steelS = C[2], steelL = C[3], tab = C.c, gold = C.a, hair = evo >= 4 ? '#ffd54a' : C.h, skin = C.s;
  const [H, E, HR, CH, HP, L, R, AL, AR, W, OF, CP, FL] = ['head', 'eyes', 'hair', 'chest', 'hips', 'legL', 'legR', 'armL', 'armR', 'wpn', 'off', 'cape', 'float'].map(sh);
  const dark = evo === 3;
  boots(L, R, steelS, { top: steel, x: 0.2 });
  legs(L, R, dark ? '#2a2236' : '#3a3a58', { x: 0.2, w: 0.26 });
  for (const [s, sd] of [[L, 1], [R, -1]]) s.put('sph:6:4', steel, 0.2 * sd, 0.42, 0.12, 0.2, 0.16, 0.12, 0, 0, 0, { grad: 0 });
  HP.put('rbox:0.3', LEATHER, 0, 0.7, 0, 0.74, 0.14, 0.54, 0, 0, 0, { grad: 0 });
  HP.put('rbox:0.3', gold, 0, 0.7, 0.27, 0.16, 0.13, 0.05, 0, 0, 0, { grad: 0, glow: 0.2 });
  HP.put('frust:0.34:0.42:8', steelS, 0, 0.56, 0, 1, 0.22, 0.9, 0, PI / 8, 0, { grad: 0.2 });
  // cuirasse + tabard
  CH.put('rbox:0.3', steel, 0, 1.03, 0, 0.82, 0.6, 0.56, 0, 0, 0, { grad: 0.18 });
  CH.put('box', tab, 0, 0.88, 0.285, 0.44, 0.66, 0.03, 0, 0, 0, { grad: 0.15 });
  CH.put('box', gold, 0, 1.2, 0.29, 0.48, 0.05, 0.035, 0, 0, 0, { grad: 0, glow: 0.15 });
  CH.put('box', gold, 0, 0.57, 0.29, 0.46, 0.04, 0.035, 0, 0, 0, { grad: 0 });
  // blason (croix dorée)
  CH.put('box', gold, 0, 0.92, 0.305, 0.08, 0.3, 0.02, 0, 0, 0, { grad: 0, glow: 0.25 });
  CH.put('box', gold, 0, 0.97, 0.305, 0.22, 0.07, 0.02, 0, 0, 0, { grad: 0, glow: 0.25 });
  // grosses épaulières
  const big = 1 + evo * 0.07;
  pauldron(CH, 1, steel, gold, big, evo >= 2 ? (dark ? '#ff8a2a' : gold) : null);
  pauldron(CH, -1, steel, gold, big, evo >= 2 ? (dark ? '#ff8a2a' : gold) : null);
  arm(AL, 1, steelS, skin, { glove: steel, cuff: gold, w: 0.24 });
  arm(AR, -1, steelS, skin, { glove: steel, cuff: gold, w: 0.24 });
  // tête : cheveux en arrière, grosse moustache, barbe courte
  headBlock(H, C);
  eyes(E, { col: evo >= 4 ? '#14b8c8' : dark ? '#ff8a2a' : '#2a3a6a', glow: evo >= 4 ? 0.45 : dark ? 1 : 0, r: 0.095, y: 1.83, tall: 1.05 });
  brows(H, shade(hair, -0.3), { angry: 0.3, th: 0.08, w: 0.24, y: 1.97 });
  H.put('rbox:0.4', hair, 0, 1.52, 0.3, 0.6, 0.2, 0.3, 0, 0, 0, { grad: 0.1 }); // barbe
  H.sym('rbox:0.4', hair, 0.36, 1.62, 0.28, 0.16, 0.34, 0.24, 0, 0, 0.15, { grad: 0.1 });
  // moustache en guidon
  H.sym('cap:1.4:6', hair, 0.15, 1.645, 0.47, 0.13, 0.32, 0.12, 0, 0, 1.25, { grad: 0 });
  H.sym('cap:1:6', hair, 0.3, 1.66, 0.44, 0.1, 0.18, 0.1, 0, 0, 0.3, { grad: 0 });
  H.put('box', '#8a3040', 0, 1.56, 0.44, 0.12, 0.035, 0.03, 0, 0, 0, { grad: 0 });
  if (evo >= 4) superHair(HR, hair, 0.8, 0.95);
  else if (evo === 0) {
    H.put('rbox:0.4', hair, 0, 2.08, -0.1, 0.98, 0.36, 0.9, 0, 0, 0, { grad: 0.05 });
    H.put('rbox:0.4', hair, 0, 1.8, -0.36, 0.94, 0.6, 0.26, 0, 0, 0, { grad: 0.1 });
    H.put('rbox:0.4', hair, 0, 2.12, 0.28, 0.86, 0.24, 0.3, -0.35, 0, 0, { grad: 0 }); // houppe
    H.sym('rbox:0.4', hair, 0.44, 1.9, -0.02, 0.12, 0.34, 0.5, 0, 0, 0, { grad: 0.1 });
  } else {
    // casque ouvert (visage visible), panache / cornes selon le stade
    const hc = dark ? '#3a3a4a' : steel;
    H.put('rbox:0.4', hc, 0, 2.06, -0.06, 1.04, 0.44, 1.0, 0, 0, 0, { grad: 0.05 });
    H.put('rbox:0.4', hc, 0, 1.78, -0.36, 1.0, 0.62, 0.3, 0, 0, 0, { grad: 0.1 });
    H.sym('rbox:0.4', hc, 0.47, 1.76, 0.06, 0.12, 0.58, 0.6, 0, 0, 0, { grad: 0.1 });
    H.put('rbox:0.3', gold, 0, 2.06, 0.43, 0.9, 0.09, 0.08, 0, 0, 0, { grad: 0, glow: 0.2 });
    H.put('box', gold, 0, 2.2, 0.0, 0.1, 0.12, 1.0, 0, 0, 0, { grad: 0, glow: 0.2 });
    if (evo === 1) for (const sd of [1, -1]) HR.put('rbox:0.45', '#ffffff', 0.52 * sd, 2.2, -0.1, 0.1, 0.5, 0.28, 0, 0, -0.55 * sd, { glow: 0.25 }); // ailettes
    if (evo === 2) {
      HR.put('sph:8:5', '#e83a3a', 0, 2.42, -0.15, 0.2, 0.42, 0.72, -0.2, 0, 0, { grad: 0.1 });
      HR.add('cone:6', '#e83a3a', new THREE.Matrix4().makeTranslation(0, 2.3, -0.5).multiply(new THREE.Matrix4().makeRotationX(-2.2)).multiply(new THREE.Matrix4().makeScale(0.22, 0.6, 0.22)), { grad: 0 });
    }
    if (evo === 3) for (const sd of [1, -1]) {
      HR.add('cone:5', '#e8dcc0', new THREE.Matrix4().makeTranslation(0.42 * sd, 2.2, 0.02).multiply(new THREE.Matrix4().makeRotationZ(-1.0 * sd)).multiply(new THREE.Matrix4().makeTranslation(0, 0.26, 0)).multiply(new THREE.Matrix4().makeScale(0.2, 0.52, 0.2)), { grad: 0.2 });
      HR.add('cone:5', '#e8dcc0', new THREE.Matrix4().makeTranslation(0.64 * sd, 2.5, 0.02).multiply(new THREE.Matrix4().makeRotationZ(0.2 * sd)).multiply(new THREE.Matrix4().makeTranslation(0, 0.16, 0)).multiply(new THREE.Matrix4().makeScale(0.13, 0.34, 0.13)), { grad: 0 });
    }
  }
  // épée (main droite) : lame large, garde dorée
  const blade = evo >= 4 ? '#fff8d0' : dark ? '#5a5a78' : evo === 2 ? '#f4f8ff' : steelL, bg = evo >= 3 ? 0.6 : 0.08, bl = 1.25 + evo * 0.07;
  const Wm = new THREE.Matrix4().makeTranslation(-0.53, 0.8, 0.08).multiply(new THREE.Matrix4().makeRotationY(-0.3)).multiply(new THREE.Matrix4().makeRotationX(1.9));
  const wput = (key, col, x, y, z, sx, sy, sz, o) => W.add(key, col, Wm.clone().multiply(new THREE.Matrix4().makeTranslation(x, y, z)).multiply(new THREE.Matrix4().makeScale(sx, sy, sz)), o);
  wput('cyl:6', LEATHER_D, 0, -0.02, 0, 0.1, 0.32, 0.1, { grad: 0 });
  wput('sph:6:4', gold, 0, -0.2, 0, 0.14, 0.14, 0.14, { grad: 0, glow: 0.2 });
  wput('rbox:0.3', gold, 0, 0.17, 0, 0.56, 0.1, 0.13, { grad: 0, glow: 0.2 });
  wput('box', blade, 0, 0.22 + bl / 2, 0, 0.17, bl, 0.05, { grad: -0.15, glow: bg });
  wput('box', shade(blade, 0.4), 0, 0.22 + bl / 2, 0.03, 0.04, bl, 0.02, { grad: 0, glow: bg + 0.1 });
  W.add('oct', blade, Wm.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.22 + bl, 0)).multiply(new THREE.Matrix4().makeScale(0.17, 0.26, 0.05)), { grad: 0, glow: bg });
  if (dark || evo >= 4) wput('box', dark ? '#ff8a2a' : '#ffffff', 0, 0.22 + bl / 2, 0, 0.06, bl * 0.9, 0.07, { grad: 0, glow: 1.2 });
  // bouclier (bras gauche) : écu bleu bordé d'or
  const shC = dark ? '#3a2a3a' : tab, sk = 1 + evo * 0.06;
  const Sm = new THREE.Matrix4().makeTranslation(0.66, 0.95, 0.12).multiply(new THREE.Matrix4().makeRotationY(0.5)).multiply(new THREE.Matrix4().makeScale(sk, sk, sk));
  const sput = (key, col, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0, o) => OF.add(key, col, Sm.clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz))), o);
  sput('rbox:0.2', gold, 0, 0.05, 0, 0.66, 0.58, 0.1, 0, 0, 0, { grad: 0, glow: 0.1 });
  sput('cone:4', gold, 0, -0.38, 0, 0.66, 0.36, 0.1, PI, PI / 4, 0, { grad: 0, glow: 0.1 });
  sput('rbox:0.2', shC, 0, 0.06, 0.04, 0.56, 0.48, 0.08, 0, 0, 0, { grad: 0.1 });
  sput('cone:4', shC, 0, -0.32, 0.04, 0.56, 0.3, 0.08, PI, PI / 4, 0, { grad: 0.1 });
  sput('box', evo === 1 ? '#ffffff' : gold, 0, -0.02, 0.09, 0.1, 0.56, 0.03, 0, 0, 0, { grad: 0, glow: 0.3 });
  sput('box', evo === 1 ? '#ffffff' : gold, 0, 0.1, 0.09, 0.4, 0.1, 0.03, 0, 0, 0, { grad: 0, glow: 0.3 });
  if (evo >= 3) sput('ico', dark ? '#ff8a2a' : '#ffffff', 0, 0.1, 0.12, 0.16, 0.16, 0.08, 0, 0, 0, { glow: 1.2 });
  // cape bleue (rouge selon le stade)
  capeShape(CP, evo >= 1 ? tab : tab, gold, { len: 0.7 + evo * 0.1, w: 0.82 + evo * 0.06 });
  if (evo >= 4) wings(sh, ['#ffffff', '#fff4d0', gold, '#fff4d0'], { glow: 0.35, k: 1.05 });
}

const BUILD = { mage: buildMage, archer: buildArcher, knight: buildKnight };
// pièces communes prêtées aux héros des autres fichiers (models-heroes-c1.js : build(sh, C, evo, KIT))
const KIT = { SKIN, SKIN_D, INK, LEATHER, LEATHER_D, WOOD, headBlock, eyes, brows, mouth, boots, legs, arm, pauldron, capeShape, star, crownOf, halo, wings, superHair };
const SHAPES = new Map();
function heroShapes(clsId, evo) {
  const k = clsId + ':' + evo;
  if (!SHAPES.has(k)) {
    const o = {}, get = n => o[n] || (o[n] = new Shape());
    (BUILD[clsId] || HEROES_C1[clsId]?.build || HEROES_C2[clsId]?.build || HEROES_ENG[clsId]?.build || buildKnight)(get, heroColors(clsId, evo), evo, KIT);
    SHAPES.set(k, o);
  }
  return SHAPES.get(k);
}

// ---------- Aura de super guerrier ----------
const AURA_V = `uniform float uT; varying float vH; varying float vRim; varying float vA;
void main() {
  vec3 p = position; float a = atan(p.z, p.x), h = clamp(p.y / 3.3, 0.0, 1.0);
  float n = sin(a * 5.0 + uT * 7.0 + h * 5.0) * 0.6 + sin(a * 8.0 - uT * 11.0 + h * 9.0) * 0.4;
  p.xz *= 1.0 + 0.14 * n * h;
  p.y += max(0.0, n) * 0.9 * h * h;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vec3 nr = normalize(normalMatrix * normal);
  vRim = 1.0 - abs(dot(nr, normalize(-mv.xyz)));
  vH = h; vA = a;
  gl_Position = projectionMatrix * mv;
}`;
// flammes : langues qui montent (bandes en dents de scie), plus opaques sur le bord, s'effacent en haut
const AURA_F = `uniform float uT; uniform vec3 uC; uniform float uK; varying float vH; varying float vRim; varying float vA;
void main() {
  float t1 = 0.5 + 0.5 * sin(vA * 6.0 + uT * 5.0 + vH * 7.0);
  float band = fract(vH * 2.6 - uT * 1.9 + sin(vA * 3.0 + uT) * 0.2);
  float f = smoothstep(0.3, 0.92, vRim) * (0.35 + 0.65 * t1) * (0.5 + 0.5 * band);
  f *= smoothstep(0.0, 0.1, vH) * (1.0 - smoothstep(0.55, 1.0, vH));
  vec3 c = mix(uC, vec3(1.0, 1.0, 0.92), 0.5 * t1 * (1.0 - vH));
  gl_FragColor = vec4(c, clamp(f * uK, 0.0, 1.0));
}`;
class Aura {
  constructor(col) {
    this.root = new THREE.Group();
    const C = new THREE.Color(col);
    const prof = [[0.3, 0], [0.72, 0.3], [0.92, 0.95], [0.9, 1.65], [0.68, 2.35], [0.32, 2.95], [0.02, 3.3]].map(([r, y]) => new THREE.Vector2(r, y));
    this.geo = new THREE.LatheGeometry(prof, 16);
    this.mats = [];
    // coque extérieure (couleur de l'aura, mélange normal : reste dorée sur l'herbe) + coque intérieure additive
    for (const [k, sc, sp, add] of [[0.9, 1.0, 1, false], [0.55, 0.86, 1.4, true]]) {
      const m = new THREE.ShaderMaterial({ vertexShader: AURA_V, fragmentShader: AURA_F, transparent: true, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, side: THREE.DoubleSide,
        uniforms: { uT: { value: 0 }, uC: { value: add ? C.clone().lerp(new THREE.Color('#ffffff'), 0.5) : C }, uK: { value: k } } });
      m.userData.sp = sp;
      const me = new THREE.Mesh(this.geo, m); me.scale.setScalar(sc); me.frustumCulled = false; me.renderOrder = 5;
      this.root.add(me); this.mats.push(m);
    }
    // halo au sol
    const gm = new THREE.MeshBasicMaterial({ map: glowTex(), color: C, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 });
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), gm); this.ground.rotation.x = -PI / 2; this.ground.position.y = 0.04; this.root.add(this.ground);
    // étincelles qui montent
    const N = 22, sg = new THREE.OctahedronGeometry(0.07, 0);
    sg.scale(0.8, 2.6, 0.8);
    this.sparkM = new THREE.MeshBasicMaterial({ color: C.clone().lerp(new THREE.Color('#ffffff'), 0.5), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.sparks = new THREE.InstancedMesh(sg, this.sparkM, N); this.sparks.frustumCulled = false; this.root.add(this.sparks);
    this.sp = Array.from({ length: N }, (_, i) => ({ a: Math.random() * TAU, r: 0.4 + Math.random() * 0.6, v: 1.4 + Math.random() * 1.6, ph: Math.random(), s: 0.7 + Math.random() * 0.7 }));
    // éclairs
    this.arcN = 3 * 6;
    this.arcG = new THREE.BufferGeometry(); this.arcG.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.arcN * 2 * 3), 3));
    this.arcM = new THREE.LineBasicMaterial({ color: C.clone().lerp(new THREE.Color('#ffffff'), 0.65), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.arcs = new THREE.LineSegments(this.arcG, this.arcM); this.arcs.frustumCulled = false; this.root.add(this.arcs);
    this.arcT = 0; this.m4 = new THREE.Matrix4();
  }
  update(dt, t) {
    for (const m of this.mats) m.uniforms.uT.value = t * m.userData.sp;
    this.ground.material.opacity = 0.55 + Math.sin(t * 9) * 0.15;
    const m4 = this.m4;
    this.sp.forEach((s, i) => {
      const k = (t * s.v * 0.4 + s.ph) % 1, a = s.a + t * 1.2;
      const r = s.r * (1 - k * 0.5), sc = s.s * (1 - k) * 1.2;
      m4.makeScale(sc, sc, sc).setPosition(Math.cos(a) * r, 0.2 + k * 3.0, Math.sin(a) * r);
      this.sparks.setMatrixAt(i, m4);
    });
    this.sparks.instanceMatrix.needsUpdate = true;
    this.arcT -= dt;
    if (this.arcT <= 0) {
      this.arcT = 0.05 + Math.random() * 0.07;
      const P = this.arcG.attributes.position.array;
      let j = 0;
      for (let b = 0; b < 3; b++) {
        const on = Math.random() < 0.6;
        let a = Math.random() * TAU, y = 0.4 + Math.random() * 1.8, r = 0.55 + Math.random() * 0.25;
        let x0 = Math.cos(a) * r, z0 = Math.sin(a) * r, y0 = y;
        for (let s = 0; s < 6; s++) {
          a += (Math.random() - 0.3) * 0.5; y += (Math.random() - 0.5) * 0.45; r = 0.5 + Math.random() * 0.4;
          const x1 = Math.cos(a) * r, z1 = Math.sin(a) * r;
          P[j++] = x0; P[j++] = on ? y0 : -50; P[j++] = z0; P[j++] = x1; P[j++] = on ? y : -50; P[j++] = z1;
          x0 = x1; y0 = y; z0 = z1;
        }
      }
      this.arcG.attributes.position.needsUpdate = true;
    }
  }
  dispose() {
    this.geo.dispose(); this.mats.forEach(m => m.dispose()); this.ground.geometry.dispose(); this.ground.material.dispose();
    this.sparks.geometry.dispose(); this.sparkM.dispose(); this.arcG.dispose(); this.arcM.dispose();
  }
}

// ---------- Modèle animé ----------
// heroModel(cls, evo) → { root, setEvo(evo), update(dt, pose), dispose(), height }
// Le moteur place root (x, 0, z) au sol ; update() gère l'orientation (dirA / atkA), la hauteur du saut (pose.air px)
// et toute l'animation. pose = { t, moving, speed01, air, vy, atk, atkA, dirA, hurt, inv, dead }
export function heroModel(clsId, evo = 0) {
  const mat = charMaterial({ rim: 0.5 });
  const rig = new Rig(BONES, mat), b = rig.b;
  const root = new THREE.Group(), yaw = new THREE.Group();
  root.add(yaw); yaw.add(rig.root);
  root.name = 'hero-' + clsId;
  let cur = -1, aura = null, auraCol = null;
  const st = { yaw: 0, ph: 0, mv: 0, land: 0, air: 0, blink: 2.5, bk: 0, die: 0, pop: 0, tl: 0, atk: 0, sq: 0 };
  const api = {
    root, cls: clsId, height: HERO_HEIGHT,
    atkShot: HEROES_C1[clsId]?.shot || null, // tir du héros qui déclenche son attaque (renderer.js) : dagues de Sora, haches de Ragnar
    setEvo(e) {
      e = clamp(e | 0, 0, 4);
      if (e === cur) return;
      if (cur >= 0 && e > cur) st.pop = 1;
      cur = e; api.evo = e;
      rig.setShapes(heroShapes(clsId, e));
      const col = EVOLUTIONS[clsId][e]?.aura || null;
      if (aura && col !== auraCol) { yaw.remove(aura.root); aura.dispose(); aura = null; }
      if (col && !aura) { aura = new Aura(col); auraCol = col; yaw.add(aura.root); }
      api.height = HERO_HEIGHT * EVO_SCALE[e];
    },
    update(dt, pose = {}) {
      dt = Math.min(0.1, Math.max(0, dt || 0));
      st.tl += dt;
      const t = pose.t ?? st.tl, air = Math.max(0, pose.air || 0), dead = !!pose.dead;
      const atk = clamp(pose.atk || 0, 0, 1), hurt = clamp(pose.hurt || 0, 0, 1);
      rig.rest();
      // orientation : vers la cible pendant une attaque, sinon vers le déplacement
      const tgt = atk > 0.02 && pose.atkA != null ? pose.atkA : pose.dirA;
      if (tgt != null && !dead) st.yaw += angDiff(st.yaw, yawOf(tgt)) * (1 - Math.exp(-(atk > 0.02 ? 26 : 13) * dt));
      yaw.rotation.y = st.yaw;
      // marche / course
      const moving = !!pose.moving && air < 1 && !dead, sp = pose.speed01 ?? 1;
      st.mv = damp(st.mv, moving ? 1 : 0, 12, dt);
      st.ph += dt * (8.5 + 4 * sp) * (moving ? 1 : 0.5 * st.mv);
      const sw = Math.sin(st.ph), mv = st.mv, idle = 1 - mv;
      const br = Math.sin(t * 2.4);
      b.legL.rotation.x = -sw * 0.85 * mv; b.legR.rotation.x = sw * 0.85 * mv;
      b.armL.rotation.x = sw * 0.7 * mv; b.armR.rotation.x = -sw * 0.7 * mv;
      b.armL.rotation.z = 0.1 + 0.04 * br * idle + 0.12 * mv; b.armR.rotation.z = -0.1 - 0.04 * br * idle - 0.12 * mv;
      b.hips.rotation.y = sw * 0.14 * mv; b.chest.rotation.y = -sw * 0.2 * mv;
      b.chest.rotation.x = 0.14 * mv; b.head.rotation.x = -0.1 * mv;
      b.chest.scale.y = 1 + 0.025 * br * idle;
      b.head.rotation.y = Math.sin(t * 0.7) * 0.18 * idle; b.head.rotation.z = Math.sin(t * 1.1) * 0.04 * idle;
      b.cape.rotation.x = 0.1 + 0.5 * mv + 0.04 * br + Math.sin(st.ph * 2) * 0.07 * mv;
      b.hair.rotation.x = -0.05 * mv;
      const fl = Math.sin(t * 3.2) * 0.14 + 0.1 * mv;
      b.wingL.rotation.z = -fl; b.wingR.rotation.z = fl; b.wingL.rotation.y = b.wingR.rotation.y = 0;
      b.float.rotation.y = t * 1.4; b.float.position.y = 1.5 + Math.sin(t * 2.2) * 0.06;
      let by = (1 - Math.abs(sw)) * 0.1 * mv, sx = 1, sy = 1;
      // saut : jambes repliées, bras écartés, étirement ; atterrissage : écrasement
      const ak = clamp(air / 18, 0, 1);
      if (air > 0.5) {
        const up = (pose.vy || 0) > 0;
        b.legL.rotation.x = -1.0 * ak; b.legR.rotation.x = 0.45 * ak;
        b.armL.rotation.z = 0.2 + 1.0 * ak; b.armR.rotation.z = -0.2 - 1.0 * ak;
        b.armL.rotation.x = -0.3 * ak; b.armR.rotation.x = -0.3 * ak;
        b.cape.rotation.x = up ? 0.2 : 0.95;
        if (up) { sy = 1 + 0.12 * ak; sx = 1 - 0.07 * ak; } else { sy = 1 + 0.04 * ak; }
      } else if (st.air > 6) st.land = 1;
      st.air = air;
      if (st.land > 0) { sy *= 1 - 0.2 * st.land; sx *= 1 + 0.16 * st.land; st.land = Math.max(0, st.land - dt * 6); }
      // attaques
      if (atk > 0.001) {
        const u = 1 - atk, w = smooth(atk / 0.45);
        if (HEROES_C1[clsId]?.atk) HEROES_C1[clsId].atk(b, w, u, atk); // champions C1 : faux, dagues, hache
        else if (HEROES_C2[clsId]?.atk) HEROES_C2[clsId].atk(b, w, u, atk); // champions C2 : sceptre de glace, bâton
        else if (HEROES_ENG[clsId]?.atk) HEROES_ENG[clsId].atk(b, w, u, atk); // Tess : clé à molette abattue
        else if (clsId === 'knight') {
          // grand coup d'épée horizontal : bras levé sur le côté, balayage vers l'avant et à travers
          const s = smooth(u / 0.28), lift = smooth(u / 0.08);
          b.armR.rotation.z = lerp(b.armR.rotation.z, -1.45, w * lift);
          b.armR.rotation.y = lerp(-0.7, 2.3, s) * w;
          b.armR.rotation.x = lerp(b.armR.rotation.x, 0, w);
          b.wpn.rotation.x = 0.9 * w * lift;
          b.chest.rotation.y = lerp(-0.5, 0.75, s) * w; b.hips.rotation.y = lerp(-0.2, 0.3, s) * w;
          b.armL.rotation.x = lerp(b.armL.rotation.x, -0.9, w); b.armL.rotation.y = 0.3 * w;
        } else if (clsId === 'archer') {
          // arc tendu vers la cible, la main droite tire la corde puis recule
          const rel = smooth(u / 0.12);
          b.armL.rotation.x = lerp(b.armL.rotation.x, -1.5, w); b.armL.rotation.z = lerp(b.armL.rotation.z, 0.05, w); b.armL.rotation.y = -0.2 * w;
          b.off.rotation.x = 1.5 * w;
          b.armR.rotation.x = lerp(b.armR.rotation.x, -1.45, w); b.armR.rotation.y = lerp(0.95, -0.35, rel) * w; b.armR.rotation.z = lerp(b.armR.rotation.z, 0.2, w);
          b.chest.rotation.y = -0.35 * w; b.head.rotation.y = 0.3 * w;
        } else {
          // bâton pointé vers l'avant, petit élan du buste
          const s = smooth(u / 0.18);
          b.armR.rotation.x = lerp(b.armR.rotation.x, lerp(-0.3, -1.1, s), w); b.armR.rotation.z = lerp(b.armR.rotation.z, 0.15, w);
          b.wpn.rotation.x = lerp(0.3, 1.9, s) * w;
          b.chest.rotation.x += 0.12 * w * (1 - u); b.chest.rotation.y = 0.25 * w;
          b.armL.rotation.z = lerp(b.armL.rotation.z, 0.7, w); b.armL.rotation.x = lerp(b.armL.rotation.x, -0.5, w);
        }
      }
      // coup reçu : recul + flash
      if (hurt > 0) { b.chest.rotation.x -= 0.35 * hurt; b.head.rotation.x -= 0.25 * hurt; sy *= 1 - 0.08 * hurt; sx *= 1 + 0.08 * hurt; }
      // KO : tombe en arrière
      if (dead) {
        st.die = Math.min(1, st.die + dt / 0.45);
        const k = smooth(st.die);
        b.body.rotation.x = -1.45 * k; by += 0.35 * k;
        b.armL.rotation.z = 0.2 + 1.1 * k; b.armR.rotation.z = -0.2 - 1.1 * k;
        b.legL.rotation.x = -0.4 * k; b.legR.rotation.x = 0.2 * k;
      } else st.die = 0;
      // clignement
      st.blink -= dt;
      if (st.blink <= 0) { st.bk = 0.13; st.blink = 1.8 + Math.random() * 2.6; }
      if (st.bk > 0) st.bk -= dt;
      b.eyes.scale.y = dead ? 0.15 : st.bk > 0 ? 0.12 : 1;
      // évolution : petit bond de joie
      let pk = 1;
      if (st.pop > 0) { st.pop = Math.max(0, st.pop - dt * 1.6); pk = 1 + Math.sin((1 - st.pop) * PI * 3) * 0.18 * st.pop; }
      const es = EVO_SCALE[cur] * pk * HERO_K;
      rig.root.scale.set(es * sx, es * sy, es * sx);
      b.body.position.y = air * (1 / 20) / es + by;
      if (aura) aura.root.scale.setScalar(EVO_SCALE[cur] * HERO_K);
      // flash blanc (coup) / scintillement (invincible) ; lueurs qui pulsent en forme ultime
      const U = mat.userData.U;
      U.uFx.value.x = Math.max(hurt, pose.inv && !dead ? 0.22 + 0.18 * Math.sin(t * 28) : 0);
      U.uGlow.value = (cur >= 4 ? 1.1 + 0.35 * Math.sin(t * 9) : 1) + (clsId === 'mage' ? atk * 1.2 : 0);
      if (aura) { aura.root.visible = !dead; aura.update(dt, t); }
    },
    dispose() { rig.dispose(); mat.dispose(); if (aura) aura.dispose(); },
  };
  api.setEvo(evo);
  api.update(0, {});
  return api;
}
