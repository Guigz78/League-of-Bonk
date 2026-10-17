// Champions 3D articulés (Luxanne, Ashlyn, Garrus) et leurs 3 stades d'évolution.
// Un seul maillage « skinné » rigide par héros (1 appel de dessin) + quelques lueurs.
// L'animation est procédurale : respiration, course, saut, virages, attaques, coups reçus.
import * as THREE from '../../vendor/three.module.min.js';
import { CLASSES, EVOLUTIONS } from '../data.js';
import { Shape, M, toonMaterial, radialTexture, tint } from './models.js';

const PI = Math.PI, TAU = PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const ease = k => k * k * (3 - 2 * k);
const angDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

// os : [nom, parent, position de repos (espace du modèle)]
const BONES = [
  ['root', -1, 0, 0, 0],
  ['hips', 0, 0, 0.6, 0],
  ['chest', 1, 0, 0.74, 0],
  ['head', 2, 0, 1.24, 0],
  ['crown', 3, 0, 2.2, 0],
  ['armL', 2, 0.37, 1.14, 0],
  ['armR', 2, -0.37, 1.14, 0],
  ['cape', 2, 0, 1.2, -0.2],
  ['legL', 1, 0.14, 0.58, 0],
  ['legR', 1, -0.14, 0.58, 0],
  ['wingL', 2, 0.12, 1.1, -0.24],
  ['wingR', 2, -0.12, 1.1, -0.24],
];
const BI = Object.fromEntries(BONES.map((b, i) => [b[0], i]));
const CY = BONES[BI.crown][3]; // hauteur de l'os « couronne » (auréole, prisme) dans l'espace du modèle
export const HERO_SCALE = [1.12, 1.24, 1.36];

export function heroColors(clsId, evo) {
  return { ...CLASSES[clsId].colors, ...(EVOLUTIONS[clsId][evo].colors || {}) };
}

// ---------- Construction ----------
function buildHero(clsId, evo) {
  const c = heroColors(clsId, evo);
  const s = new Shape();
  const B = BI;
  const P = (bone, key, col, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0, o = {}) => s.put(key, col, x, y, z, sx, sy, sz, rx, ry, rz, { bone: B[bone], ...o });
  const A = (bone, key, col, m, o = {}) => s.add(key, col, m, { bone: B[bone], ...o });
  const glows = []; // lueurs additives : [os, x, y, z, taille, couleur]

  // visage commun (tête ronde, grands yeux, joues)
  const face = (eyeCol, { skinHead = true, eyeY = 1.6, eyeZ = 0.37 } = {}) => {
    if (skinHead) P('head', 'sph:14:10', c.s, 0, 1.64, 0.02, 0.86, 0.8, 0.8, 0, 0, 0, { grad: 0.1 });
    for (const sd of [1, -1]) {
      s.eye(0.155 * sd, eyeY, eyeZ, 0.085, { pupil: eyeCol, ry: 0.38 * sd, side: sd, bone: B.head, tall: 1.35 });
      P('head', 'sph:8:6', '#ff9aa8', 0.25 * sd, eyeY - 0.13, eyeZ - 0.04, 0.12, 0.06, 0.04, 0, 0.6 * sd, 0, { grad: 0 });
    }
    P('head', 'box', '#a0505a', 0, eyeY - 0.17, eyeZ + 0.03, 0.08, 0.025, 0.03, 0, 0, 0, { grad: 0 });
  };
  const legs = (pants, boots) => {
    for (const sd of [1, -1]) {
      const bn = sd > 0 ? 'legL' : 'legR';
      P(bn, 'rbox:0.3', pants, 0.14 * sd, 0.36, 0, 0.2, 0.42, 0.22);
      P(bn, 'rbox:0.3', boots, 0.14 * sd, 0.1, 0.035, 0.25, 0.2, 0.33);
    }
  };
  const arms = (sleeve, hand, cuff) => {
    for (const sd of [1, -1]) {
      const bn = sd > 0 ? 'armL' : 'armR';
      P(bn, 'rbox:0.35', sleeve, 0.39 * sd, 0.93, 0, 0.18, 0.42, 0.19);
      if (cuff) P(bn, 'rbox:0.3', cuff, 0.39 * sd, 0.75, 0, 0.21, 0.07, 0.21);
      P(bn, 'sph:8:6', hand, 0.39 * sd, 0.66, 0.02, 0.2, 0.2, 0.2);
    }
  };
  const cape = (col, len, wide, trim) => {
    A('cape', 'taper:0.26:0.38', col, M(0, 1.2 - len / 2, -0.27, 0.08, 0, 0, 1 * wide, len, 0.075));
    A('cape', 'rbox:0.4', trim || tint(col, -0.2), M(0, 1.2, -0.24, 0, 0, 0, 0.55 * wide, 0.1, 0.12));
  };
  const pauldrons = (col, trim, big = 1) => {
    for (const sd of [1, -1]) {
      P('chest', 'sph:10:7', col, 0.4 * sd, 1.2, 0, 0.32 * big, 0.24 * big, 0.34 * big);
      if (trim) P('chest', 'sph:8:6', trim, 0.43 * sd, 1.27, 0, 0.16 * big, 0.12 * big, 0.17 * big, 0, 0, 0, { glow: 0.15 });
    }
  };
  const halo = (col, y = 0.08) => {
    A('crown', 'torus:0.1:24', col, M(0, CY + y, -0.08, PI / 2 - 0.3, 0, 0, 0.86, 0.86, 0.86), { glow: 1.2, grad: 0 });
    glows.push(['crown', 0, CY + y, -0.08, 1.3, col, 0.4]);
  };
  const crownOf = (col, gem, y = 0) => {
    A('head', 'cyl:10', col, M(0, 2.0 + y, 0, 0, 0, 0, 0.5, 0.12, 0.5), { glow: 0.15 });
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * TAU + PI / 2;
      A('head', 'cone:4', col, M(Math.cos(a) * 0.22, 2.13 + y, Math.sin(a) * 0.22, 0, 0, 0, 0.1, 0.2, 0.1), { glow: 0.2 });
    }
    A('head', 'oct', gem, M(0, 2.02 + y, 0.25, 0, 0, 0, 0.1, 0.14, 0.08), { glow: 0.9 });
  };
  const sparkles = (col, n, r, y) => {
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU;
      A('crown', 'oct', col, M(Math.cos(a) * r, CY + y + (i % 2) * 0.06, Math.sin(a) * r - 0.06, 0, a, 0, 0.09, 0.14, 0.09), { glow: 1, grad: 0 });
    }
  };

  if (clsId === 'mage') {
    const robe = c[1], robeS = c[2], trim = c.c, gold = c.a, hair = c.h;
    legs(tint(robe, -0.1), trim);
    // robe : buste + jupe évasée
    P('chest', 'rbox:0.35', robe, 0, 0.98, 0, 0.56, 0.5, 0.38);
    P('chest', 'rbox:0.4', trim, 0, 1.22, 0, 0.44, 0.09, 0.32);
    P('chest', 'oct', gold, 0, 1.08, 0.2, 0.1, 0.13, 0.06, 0, 0, 0, { glow: 0.5 });
    P('hips', 'frust:0.29:0.5:12', robe, 0, 0.42, 0, 1, 0.62, 0.92);
    P('hips', 'frust:0.5:0.52:12', trim, 0, 0.12, 0, 1, 0.07, 0.94);
    P('hips', 'box', trim, 0, 0.42, 0.385, 0.1, 0.6, 0.03, -0.31, 0, 0, { grad: 0 });
    P('hips', 'oct', gold, 0, 0.62, 0.37, 0.09, 0.12, 0.04, -0.31, 0, 0, { glow: 0.5 });
    P('hips', 'rbox:0.3', gold, 0, 0.74, 0, 0.6, 0.08, 0.42, 0, 0, 0, { glow: 0.1 });
    arms(robe, c.s, trim);
    face(evo === 2 ? '#7a3ad8' : '#3a6ad8');
    // cheveux
    P('head', 'sph:14:10', hair, 0, 1.71, -0.07, 0.94, 0.86, 0.82);
    P('head', 'sph:12:8', hair, 0, 1.9, 0.19, 0.8, 0.3, 0.44, 0.25);
    for (const sd of [1, -1]) P('head', 'sph:10:8', hair, 0.37 * sd, 1.48, 0.06, 0.17, 0.52, 0.22, 0, 0, -0.08 * sd);
    for (const sd of [-1, 0, 1]) P('head', 'rbox:0.48', sd ? tint(hair, -0.06) : hair, sd * 0.19, 1.28 - Math.abs(sd) * 0.06, -0.3 + Math.abs(sd) * 0.04, 0.27, 0.86 - Math.abs(sd) * 0.14, 0.2, 0.12, 0, -sd * 0.12);
    P('head', 'oct', evo === 1 ? '#ff6ad8' : '#4fd0ff', 0, 1.88, 0.42, 0.1, 0.12, 0.06, 0, 0, 0, { glow: 0.8 });
    P('head', 'torus:0.06:20', gold, 0, 1.84, 0.0, 0.9, 0.9, 0.86, PI / 2 - 0.3, 0, 0, { glow: 0.2 });
    // bâton et orbe
    const SX = -0.42, SZ = 0.16, top = 2.36 + evo * 0.06;
    P('armR', 'cyl:6', evo === 2 ? '#3a2a7a' : '#f4ead2', SX, (0.22 + top) / 2 - 0.1, SZ, 0.065, top - 0.42, 0.065);
    P('armR', 'cyl:8', gold, SX, top - 0.3, SZ, 0.11, 0.1, 0.11, 0, 0, 0, { glow: 0.2 });
    P('armR', 'cone:8', gold, SX, top - 0.22, SZ, 0.2, 0.14, 0.2, PI, 0, 0, { glow: 0.2 });
    for (const sd of [1, -1]) P('armR', 'cone:4', gold, SX + 0.15 * sd, top - 0.02, SZ, 0.07, 0.3, 0.05, 0, 0, -0.5 * sd, { glow: 0.3 });
    const orbC = evo === 1 ? '#ffc8f0' : evo === 2 ? '#fff0a0' : '#fff2b0';
    P('armR', 'sph:10:8', orbC, SX, top, SZ, 0.27 + evo * 0.04, 0.27 + evo * 0.04, 0.27 + evo * 0.04, 0, 0, 0, { glow: 1.1, grad: 0 });
    glows.push(['armR', SX, top, SZ, 0.85 + evo * 0.1, evo === 1 ? '#ff8ae0' : '#ffd54a', 0.9, 'orb']);
    if (evo >= 1) {
      pauldrons(gold, evo === 2 ? '#ffffff' : '#ff6ad8', 0.95);
      cape(trim, evo === 2 ? 1.05 : 0.85, evo === 2 ? 1.25 : 1, gold);
    }
    if (evo === 1) {
      // prisme qui tourne autour de la tête
      A('crown', 'oct', '#ff9ae8', M(0, CY - 0.25, -0.62, 0, 0.6, 0, 0.2, 0.32, 0.2), { glow: 0.9 });
      glows.push(['crown', 0, CY - 0.25, -0.62, 0.6, '#ff6ad8', 0.5]);
    }
    if (evo === 2) {
      halo(gold, 0.22);
      sparkles('#fff6c0', 5, 0.5, 0.2);
      for (let i = 0; i < 6; i++) A('cape', 'oct', '#fff6c0', M((i % 3 - 1) * 0.2, 0.95 - Math.floor(i / 3) * 0.38, -0.33, 0, 0, 0, 0.07, 0.1, 0.05), { glow: 1 });
    }
  } else if (clsId === 'archer') {
    const tunic = c[1], tunicS = c[2], light = c[3], navy = c.c, hair = c.h, ice = c.a;
    const leather = '#7a4a28';
    legs(evo === 2 ? '#c8d8f0' : navy, evo === 2 ? '#e0e8f8' : '#5a3a22');
    P('chest', 'rbox:0.35', tunic, 0, 0.97, 0, 0.56, 0.5, 0.38);
    P('chest', 'box', light, 0, 0.97, 0.19, 0.1, 0.46, 0.03, 0, 0, 0, { grad: 0 });
    P('hips', 'frust:0.29:0.37:10', tunic, 0, 0.56, 0, 1, 0.28, 0.95);
    P('hips', 'rbox:0.3', leather, 0, 0.73, 0, 0.6, 0.08, 0.42);
    P('chest', 'oct', ice, 0, 1.1, 0.21, 0.11, 0.14, 0.06, 0, 0, 0, { glow: 0.6 });
    // carquois en bandoulière (bien visible de dos)
    P('chest', 'box', leather, 0, 0.98, 0, 0.62, 0.07, 0.42, 0, 0, 0.75);
    P('chest', 'cyl:8', leather, 0.15, 1.02, -0.29, 0.22, 0.66, 0.22, 0, 0, -0.38);
    P('chest', 'cyl:8', tint(leather, 0.25), 0.27, 1.32, -0.29, 0.24, 0.06, 0.24, 0, 0, -0.38);
    for (let i = 0; i < 3; i++) {
      const ox = 0.22 + i * 0.06, oz = -0.25 - (i % 2) * 0.07;
      P('chest', 'cyl:4', '#e8dcc0', ox + 0.07, 1.47, oz, 0.03, 0.34, 0.03, 0, 0, -0.38);
      P('chest', 'cone:4', i === 1 ? ice : '#ffffff', ox + 0.13, 1.62, oz, 0.09, 0.14, 0.04, 0, 0, -0.38, { glow: 0.2 });
    }
    // mantelet
    P('chest', 'rbox:0.45', navy, 0, 1.2, -0.02, 0.72, 0.17, 0.46);
    arms(tunicS, '#8a5a3a', light);
    face('#2a8ad8', { eyeZ: 0.375 });
    // capuche + tresse blanche
    P('head', 'sph:14:10', tunic, 0, 1.72, -0.1, 0.98, 0.92, 0.86);
    P('head', 'torus:0.09:18', tint(tunic, 0.35), 0, 1.66, 0.26, 0.8, 0.78, 0.9);
    P('head', 'cone:6', tunic, 0, 1.78, -0.52, 0.34, 0.5, 0.3, -PI / 2 - 0.45);
    P('head', 'sph:10:8', hair, 0, 1.87, 0.25, 0.66, 0.22, 0.34, 0.3);
    for (const sd of [1, -1]) P('head', 'sph:8:6', hair, 0.3 * sd, 1.52, 0.2, 0.14, 0.34, 0.14);
    for (let i = 0; i < 4; i++) P('head', 'sph:8:6', hair, 0, 1.3 - i * 0.17, -0.38 - i * 0.015, 0.19 - i * 0.015, 0.2, 0.17);
    P('head', 'sph:6:4', ice, 0, 0.74, -0.42, 0.1, 0.08, 0.1, 0, 0, 0, { glow: 0.6 });
    // arc de glace (main gauche)
    const bow = evo === 2 ? '#ffe9a0' : '#9ad8ff';
    const H = M(0.39, 0.68, 0.02);
    A('armL', 'arc:0.05:2.3', bow, H.clone().multiply(M(0, 0, -0.72, 0, -PI / 2, -1.15, 1.44, 1.44, 1.2)), { glow: 0.45 });
    A('armL', 'cyl:4', '#ffffff', H.clone().multiply(M(0, 0, -0.39, 0, 0, 0, 0.015, 1.3, 0.015)), { glow: 0.5, grad: 0 });
    A('armL', 'rbox:0.3', leather, H.clone().multiply(M(0, 0, 0.0, 0, 0, 0, 0.11, 0.26, 0.11)));
    for (const sd of [1, -1]) A('armL', 'oct', ice, H.clone().multiply(M(0, 0.66 * sd, -0.39, 0, 0, 0, 0.1, 0.18, 0.1)), { glow: 0.8 });
    if (evo >= 1) {
      for (const sd of [1, -1]) {
        P('chest', 'oct', ice, 0.42 * sd, 1.3, 0, 0.2, 0.38, 0.2, 0, 0, -0.35 * sd, { glow: 0.35 });
        P('chest', 'oct', light, 0.5 * sd, 1.22, 0.08, 0.13, 0.26, 0.13, 0, 0, -0.7 * sd, { glow: 0.35 });
      }
      cape(evo === 2 ? '#f4f8ff' : navy, evo === 2 ? 1.0 : 0.82, evo === 2 ? 1.2 : 1, evo === 2 ? c.c : light);
      for (let i = -1; i <= 1; i++) P('head', 'oct', '#e8f8ff', i * 0.2, 2.12 - Math.abs(i) * 0.08, 0.02, 0.1, 0.26 - Math.abs(i) * 0.08, 0.1, 0, 0, -i * 0.3, { glow: 0.5 });
    }
    if (evo === 2) {
      crownOf(c.a, '#9ad8ff', 0.12);
      halo('#bfe8ff', 0.26);
    }
  } else {
    // chevalier
    const steel = c[1], steelS = c[2], steelL = c[3], tabard = c.c, gold = c.a, leather = c.h;
    legs(steelS, '#3a3448');
    for (const sd of [1, -1]) P(sd > 0 ? 'legL' : 'legR', 'sph:8:6', steel, 0.14 * sd, 0.36, 0.1, 0.16, 0.14, 0.1);
    P('chest', 'rbox:0.35', steel, 0, 0.98, 0, 0.62, 0.52, 0.42);
    P('chest', 'box', tabard, 0, 0.86, 0.215, 0.38, 0.62, 0.035, 0, 0, 0, { grad: 0.1 });
    P('chest', 'box', tabard, 0, 0.86, -0.215, 0.38, 0.62, 0.035, 0, 0, 0, { grad: 0.1 });
    P('chest', 'box', gold, 0, 0.56, 0.22, 0.4, 0.04, 0.04, 0, 0, 0, { grad: 0 });
    P('chest', 'box', gold, 0, 0.56, -0.22, 0.4, 0.04, 0.04, 0, 0, 0, { grad: 0 });
    for (const z of [0.235, -0.235]) {
      P('chest', 'oct', gold, 0, 0.96, z, 0.16, 0.26, 0.04, 0, 0, 0, { glow: 0.3, grad: 0 });
      for (const sd of [1, -1]) P('chest', 'box', gold, 0.12 * sd, 1.0, z, 0.1, 0.035, 0.02, 0, 0, -0.45 * sd, { glow: 0.3, grad: 0 });
    }
    P('hips', 'rbox:0.3', leather, 0, 0.66, 0, 0.56, 0.12, 0.4);
    P('hips', 'rbox:0.3', gold, 0, 0.66, 0.2, 0.12, 0.1, 0.04, 0, 0, 0, { glow: 0.2 });
    arms(steelS, steel, null);
    pauldrons(steel, gold, evo >= 1 ? 1.22 : 1);
    if (evo >= 1) for (const sd of [1, -1]) P('chest', 'cone:6', gold, 0.5 * sd, 1.38, 0, 0.1, 0.22, 0.1, 0, 0, -0.5 * sd, { glow: 0.2 });
    // casque : visage visible sous la visière
    P('head', 'sph:14:10', steel, 0, 1.68, -0.03, 0.94, 0.88, 0.88);
    P('head', 'sph:12:8', c.s, 0, 1.58, 0.21, 0.6, 0.4, 0.42, 0, 0, 0, { grad: 0.05 });
    face('#2a3a6a', { skinHead: false, eyeY: 1.59, eyeZ: 0.38 });
    P('head', 'rbox:0.4', steelL, 0, 1.79, 0.3, 0.74, 0.09, 0.2, -0.2);
    P('head', 'rbox:0.45', steelL, 0, 1.92, -0.1, 0.1, 0.5, 0.74, -0.35);
    P('head', 'torus:0.07:20', gold, 0, 1.5, -0.04, 0.9, 0.9, 0.86, PI / 2 + 0.25, 0, 0, { glow: 0.15 });
    P('head', 'box', steel, 0, 1.68, 0.43, 0.06, 0.24, 0.06);
    for (const sd of [1, -1]) P('head', 'rbox:0.4', steel, 0.33 * sd, 1.46, 0.18, 0.12, 0.3, 0.26, 0, 0.35 * sd);
    // panache
    P('head', 'sph:10:8', tabard, 0, 2.14, -0.08, 0.15, 0.34, 0.56, -0.15);
    P('head', 'cone:6', tabard, 0, 1.98, -0.46, 0.16, 0.42, 0.16, -PI / 2 - 0.7);
    P('head', 'cyl:6', gold, 0, 2.02, 0.12, 0.08, 0.1, 0.08);
    // épée
    const W = M(-0.39, 0.66, 0.02, 0.45, 0, 0.35);
    A('armR', 'cyl:6', leather, W.clone().multiply(M(0, 0.02, 0, 0, 0, 0, 0.07, 0.26, 0.07)));
    A('armR', 'sph:6:4', gold, W.clone().multiply(M(0, -0.13, 0, 0, 0, 0, 0.1, 0.1, 0.1)), { glow: 0.2 });
    A('armR', 'rbox:0.3', gold, W.clone().multiply(M(0, 0.16, 0, 0, 0, 0, 0.09, 0.08, 0.42)), { glow: 0.2 });
    A('armR', 'taper:0.06:0.09', steelL, W.clone().multiply(M(0, 0.68, 0, 0, 0, 0, 1, 0.92, 1.6)), { glow: evo === 2 ? 0.5 : 0.12 });
    A('armR', 'cone:4', steelL, W.clone().multiply(M(0, 1.2, 0, 0, PI / 4, 0, 0.13, 0.14, 0.2)), { glow: evo === 2 ? 0.5 : 0.12 });
    A('armR', 'box', '#9aa4c0', W.clone().multiply(M(0, 0.66, 0, 0, 0, 0, 0.03, 0.88, 0.03)), { grad: 0 });
    // bouclier
    const Sh = M(0.5, 0.82, 0.12, 0, 0.32, 0);
    A('armL', 'cyl:8', gold, Sh.clone().multiply(M(0, 0, -0.015, PI / 2, 0, 0, 0.62, 0.06, 0.74)), { glow: 0.1 });
    A('armL', 'cyl:8', tabard, Sh.clone().multiply(M(0, 0, 0.02, PI / 2, 0, 0, 0.54, 0.06, 0.66)));
    A('armL', 'oct', gold, Sh.clone().multiply(M(0, 0.02, 0.06, 0, 0, 0, 0.26, 0.44, 0.05)), { glow: 0.3, grad: 0 });
    A('armL', 'sph:8:6', steelL, Sh.clone().multiply(M(0, 0.02, 0.08, 0, 0, 0, 0.12, 0.12, 0.06)));
    if (evo >= 1) cape(tabard, evo === 2 ? 1.08 : 0.92, evo === 2 ? 1.3 : 1.1, gold);
    if (evo === 2) {
      crownOf(gold, '#ff4a6a', 0.2);
      halo(gold, 0.32);
      for (const sd of [1, -1]) {
        const wb = sd > 0 ? 'wingL' : 'wingR';
        for (let i = 0; i < 3; i++) {
          A(wb, 'sph:8:6', i === 0 ? '#ffffff' : i === 1 ? '#fff4d0' : gold,
            M(0.12 * sd + sd * (0.3 + i * 0.1), 1.2 + 0.18 - i * 0.16, -0.32 - i * 0.03, 0, 0, sd * (-0.9 + i * 0.45), 0.2, 0.75 - i * 0.12, 0.08), { glow: 0.25 });
        }
      }
    }
  }
  return { geo: s.build({ skin: true }), glows };
}

// ---------- Modèle animé ----------
export class HeroModel {
  constructor(clsId, evo = 0, { material } = {}) {
    this.clsId = clsId;
    this.root = new THREE.Group();     // placé par l'appelant (position, cap, échelle)
    this.ownMat = !material;
    this.mat = material || toonMaterial({ emissive: new THREE.Color('#000000') });
    this.glowTex = radialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)', 64, 0.05);
    this.t = 0; this.runK = 0; this.phase = 0; this.air = 0; this.lean = 0; this.twist = 0;
    this.atk = -1; this.atkYaw = 0; this.atkKind = CLASSES[clsId].weapon;
    this.hurtT = 0; this.landT = 0; this.jumpT = 0; this.deadK = 0; this.dead = false; this.winT = -1; this.castGlow = 0;
    this.setEvo(evo);
  }

  setEvo(evo) {
    this.evo = evo;
    if (this.mesh) { this.root.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.skeleton.dispose(); for (const g of this.glows) g.material.dispose(); }
    if (this.aura) { this.root.remove(this.aura); this.aura = null; }
    const { geo, glows } = buildHero(this.clsId, evo);
    const bones = BONES.map(([, , x, y, z]) => { const b = new THREE.Bone(); b.position.set(x, y, z); return b; });
    BONES.forEach(([, parent, x, y, z], i) => {
      if (parent < 0) return;
      const p = BONES[parent];
      bones[i].position.set(x - p[2], y - p[3], z - p[4]);
      bones[parent].add(bones[i]);
    });
    bones[BI.armL].rotation.order = bones[BI.armR].rotation.order = 'YXZ';
    bones[BI.chest].rotation.order = 'YXZ';
    const mesh = new THREE.SkinnedMesh(geo, this.mat);
    mesh.add(bones[0]);
    mesh.updateMatrixWorld(true);
    mesh.bind(new THREE.Skeleton(bones));
    mesh.frustumCulled = false;
    this.mesh = mesh; this.bones = bones;
    this.b = Object.fromEntries(BONES.map(([n], i) => [n, bones[i]]));
    this.rest = bones.map(b => b.position.clone());
    // lueurs (sprites additifs attachés aux os)
    this.glows = [];
    for (const [bone, x, y, z, size, col, op, tag] of glows) {
      const bp = BONES[BI[bone]];
      const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: col, opacity: op, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      m.position.set(x - bp[2], y - bp[3], z - bp[4]);
      m.scale.setScalar(size);
      m.userData = { size, tag };
      m.renderOrder = 2;
      bones[BI[bone]].add(m);
      this.glows.push(m);
    }
    this.root.add(mesh);
    // aura lumineuse du dernier stade
    if (evo === 2) {
      const col = heroColors(this.clsId, 2).a;
      const aura = new THREE.Mesh(AURA_GEO, new THREE.MeshBasicMaterial({ color: col, map: auraTexture(), transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
      aura.position.y = 0.04;
      aura.renderOrder = 1;
      this.aura = aura;
      this.root.add(aura);
    }
  }

  // déclencheurs (appelés par actors.js / l'aperçu des menus)
  attack(yawRel = 0) { this.atk = 0; this.atkYaw = clamp(yawRel, -1.6, 1.6); this.castGlow = 1; }
  hurt() { this.hurtT = 1; }
  jump() { this.jumpT = 1; }
  land() { this.landT = 1; }
  die() { this.dead = true; }
  revive() { this.dead = false; this.deadK = 0; }
  win() { this.winT = 0; }

  // st : { moving, speed (0..1.5), air (hauteur du saut en unités), turn (rad/s) }
  update(dt, st) {
    const b = this.b, rest = this.rest;
    this.t += dt;
    const t = this.t;
    this.runK = damp(this.runK, st.moving ? clamp(st.speed ?? 1, 0, 1.3) : 0, 10, dt);
    const run = this.runK, idle = 1 - Math.min(1, run);
    this.phase += dt * (6 + 6 * run) * (st.moving ? 1 : 0.3) * (this.dead ? 0 : 1);
    const ph = this.phase, sw = Math.sin(ph), cw = Math.cos(ph);
    this.air = damp(this.air, clamp(st.air / 0.6, 0, 1), 14, dt);
    const air = this.air;
    this.lean = damp(this.lean, clamp(-(st.turn || 0) * 0.12, -0.32, 0.32) * Math.min(1, run + 0.2), 8, dt);
    this.hurtT = Math.max(0, this.hurtT - dt / 0.32);
    this.landT = Math.max(0, this.landT - dt / 0.22);
    this.jumpT = Math.max(0, this.jumpT - dt / 0.25);
    this.castGlow = Math.max(0, this.castGlow - dt * 3);
    this.deadK = damp(this.deadK, this.dead ? 1 : 0, 7, dt);
    if (this.winT >= 0) this.winT += dt;

    // attaque en cours (0..1)
    let ak = -1;
    if (this.atk >= 0) {
      this.atk += dt / (this.atkKind === 'sword' ? 0.34 : this.atkKind === 'arrows' ? 0.3 : 0.36);
      if (this.atk >= 1) this.atk = -1; else ak = this.atk;
    }
    const atkOn = ak >= 0 ? Math.sin(Math.min(1, ak * 1.25) * PI * 0.5) * (ak > 0.7 ? 1 - (ak - 0.7) / 0.3 : 1) : 0;
    this.twist = damp(this.twist, ak >= 0 ? this.atkYaw * 0.8 : 0, ak >= 0 ? 18 : 6, dt);

    // racine : rebond de course, squash, inclinaison, chute
    const hurt = this.hurtT > 0 ? Math.sin(this.hurtT * PI) : 0;
    const land = this.landT > 0 ? Math.sin(this.landT * PI) : 0;
    const jmp = this.jumpT > 0 ? Math.sin(this.jumpT * PI) : 0;
    const breath = Math.sin(t * 2.6) * idle;
    const sq = 1 - land * 0.22 - hurt * 0.2 + jmp * 0.14 + air * 0.04;
    const wide = 1 + land * 0.16 + hurt * 0.18 - jmp * 0.07;
    b.root.scale.set(wide, sq, wide);
    b.root.rotation.set(-this.deadK * PI * 0.48, 0, this.lean + Math.sin(ph) * 0.04 * run);
    b.root.position.y = this.deadK * 0.25;

    // bassin
    b.hips.position.copy(rest[BI.hips]);
    b.hips.position.y += Math.abs(cw) * 0.07 * run - 0.04 * run + breath * 0.008;
    b.hips.rotation.set(0, sw * 0.14 * run, 0);

    // jambes
    const legSw = 0.85 * Math.min(1.2, run);
    b.legL.rotation.set(-sw * legSw - air * 0.9, 0, 0.04 + air * 0.12);
    b.legR.rotation.set(sw * legSw + air * 0.5, 0, -0.04 - air * 0.12);
    if (this.winT >= 0) { b.legL.rotation.x = -0.3; b.legR.rotation.x = 0.1; }

    // buste : penché en avant en courant, respiration, torsion vers la cible
    const chestLean = 0.13 * run + air * -0.12 + hurt * -0.3;
    b.chest.rotation.set(chestLean, -sw * 0.18 * run + this.twist, -sw * 0.03 * run);
    b.chest.scale.set(1 + breath * 0.015, 1 + breath * 0.03, 1 + breath * 0.015);

    // tête : contre-balancement, regard vivant au repos
    const look = idle * (Math.sin(t * 0.7) * 0.2 + Math.sin(t * 1.9) * 0.05);
    b.head.rotation.set(-chestLean * 0.6 + Math.abs(cw) * 0.06 * run + hurt * -0.35 + breath * 0.02, look - this.twist * 0.35, Math.sin(t * 1.3) * 0.04 * idle);

    // bras : balancement opposé aux jambes + poses d'attaque
    const armSw = 0.75 * Math.min(1.2, run);
    let lx = sw * armSw - air * 0.3, lz = 0.12 + air * 1.0 + hurt * 0.6 + breath * 0.03, ly = 0;
    let rx = -sw * armSw - air * 0.3, rz = -0.12 - air * 1.0 - hurt * 0.6 - breath * 0.03, ry = 0;
    if (this.winT >= 0) { const w = Math.sin(this.winT * 8) * 0.25; lz = 2.6 + w; rz = -2.6 + w; lx = rx = 0; }
    if (ak >= 0) {
      if (this.atkKind === 'sword') {
        // armé puis grand balayage horizontal
        const wind = ak < 0.28 ? ease(ak / 0.28) : 1, sweep = ak < 0.28 ? 0 : ease(Math.min(1, (ak - 0.28) / 0.38));
        const back = ak > 0.72 ? 1 - ease((ak - 0.72) / 0.28) : 1;
        rx = (-0.5 - wind * 0.9) * back + rx * (1 - back);
        ry = (-1.3 * wind + sweep * 2.5) * back;
        rz = (-0.3 - wind * 0.4 + sweep * 0.5) * back + rz * (1 - back);
        b.chest.rotation.y += (-0.5 * wind + sweep * 1.0) * back;
        lz += 0.3 * back; lx -= 0.3 * back;
      } else if (this.atkKind === 'arrows') {
        // bras de l'arc tendu vers la cible, l'autre tire la corde puis lâche
        const draw = ak < 0.55 ? ease(ak / 0.55) : 1, rel = ak > 0.55 ? ease((ak - 0.55) / 0.45) : 0;
        lx = lx * (1 - atkOn) - 1.5 * atkOn; lz = lz * (1 - atkOn) + 0.15 * atkOn; ly = 0.25 * atkOn;
        rx = rx * (1 - atkOn) + (-1.45 + rel * 0.4) * atkOn; ry = (0.9 - draw * 0.55 - rel * 0.6) * atkOn; rz = rz * (1 - atkOn) - 0.1 * atkOn;
        b.chest.rotation.y += 0.35 * atkOn;
      } else {
        // bâton brandi vers l'avant : l'orbe flamboie
        rx = rx * (1 - atkOn) - 1.5 * atkOn; ry = -0.15 * atkOn; rz = rz * (1 - atkOn) - 0.05 * atkOn;
        lx = lx * (1 - atkOn) - 0.4 * atkOn; lz = lz * (1 - atkOn) + 0.5 * atkOn;
      }
    }
    b.armL.rotation.set(lx, ly, lz);
    b.armR.rotation.set(rx, ry, rz);

    // cape : se soulève avec la vitesse et flotte
    b.cape.rotation.set(0.12 + run * 0.55 + air * 0.6 + Math.sin(t * 9 + 1) * 0.06 * (run + air) + Math.sin(t * 1.8) * 0.03, 0, Math.sin(t * 3.1) * 0.04);
    // ailes (Dieu-Roi)
    const flap = Math.sin(t * (3 + run * 5)) * (0.15 + run * 0.2 + air * 0.4);
    b.wingL.rotation.set(0, -0.35 - flap, 0);
    b.wingR.rotation.set(0, 0.35 + flap, 0);
    // auréole / couronne flottante
    b.crown.position.y = rest[BI.crown].y + Math.sin(t * 2.2) * 0.04;
    b.crown.rotation.set(0, t * 0.8, 0);
    // lueurs
    for (const g of this.glows) {
      const k = g.userData.tag === 'orb' ? 1 + this.castGlow * 0.9 + Math.sin(t * 5) * 0.08 : 1 + Math.sin(t * 3 + g.id) * 0.1;
      g.scale.setScalar(g.userData.size * k);
    }
    if (this.aura) {
      this.aura.rotation.y = t * 0.6;
      const k = 1 + Math.sin(t * 3) * 0.06;
      this.aura.scale.set(k, 1, k);
    }
  }

  dispose() {
    this.mesh?.geometry.dispose();
    this.mesh?.skeleton.dispose();
    for (const g of this.glows) g.material.dispose();
    this.aura?.material.dispose();
    if (this.ownMat) this.mat.dispose();
  }
}

const AURA_GEO = (() => { const g = new THREE.PlaneGeometry(3.2, 3.2); g.rotateX(-PI / 2); return g; })();

let auraTex = null;
function auraTexture() {
  if (auraTex) return auraTex;
  const S = 128, cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.18)'); gr.addColorStop(0.72, 'rgba(255,255,255,0.5)'); gr.addColorStop(0.8, 'rgba(255,255,255,0.08)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  // petites runes en étoile sur l'anneau
  g.fillStyle = 'rgba(255,255,255,0.9)';
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * TAU, x = S / 2 + Math.cos(a) * S * 0.38, y = S / 2 + Math.sin(a) * S * 0.38;
    g.beginPath(); g.moveTo(x, y - 5); g.lineTo(x + 2, y); g.lineTo(x, y + 5); g.lineTo(x - 2, y); g.fill();
  }
  auraTex = new THREE.CanvasTexture(cv);
  auraTex.colorSpace = THREE.SRGBColorSpace;
  return auraTex;
}
