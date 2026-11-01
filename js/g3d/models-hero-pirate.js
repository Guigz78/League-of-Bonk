// Héros 3D de Morgane la capitaine pirate. Même marionnette, mêmes pièces et même style chibi que les autres
// (models-heroes.js prête ses pièces : build(sh, C, evo, K)) : grand tricorne à plume et tête de mort, manteau rouge à
// galons d'or (pans longs, revers, jabot), cache-œil, longue tresse, hautes bottes à revers, deux pistolets à silex en
// main et un sabre d'abordage au fourreau. 5 stades visibles chacun : Corsaire (épaulettes, ceinture d'étoffe, baudrier,
// boucle d'oreille), Amirale (manteau bleu nuit, cape, médailles, longue-vue), Fantôme (manteau spectral en lambeaux,
// galons et œil verts lumineux, feux follets), Tempête (manteau blanc et or, voiles en guise d'ailes, gouvernail
// doré dans le dos, doublons en orbite, aura de super guerrière). atk = geste d'attaque : POSE.k (posé par fx-pirate.js)
// dit lequel : tir main droite / gauche, coup de sabre aller / retour (le sabre est dessiné par fx-pirate.js), ordre, estocade.
import { THREE, PI, TAU, lerp, smooth, shade } from './models-kit.js';

const GOLD = '#ffc23a', LEATHER = '#3a2416', WOOD = '#6a3a1e', STEEL = '#b8c2d0', INK = '#141014', BONE = '#f4ecd8';
const MT = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
const RX = a => new THREE.Matrix4().makeRotationX(a), RY = a => new THREE.Matrix4().makeRotationY(a), RZ = a => new THREE.Matrix4().makeRotationZ(a);
const SC = (x, y, z) => new THREE.Matrix4().makeScale(x, y, z);

// geste demandé par le rendu (fx-pirate.js) : 1 tir main droite, 2 tir main gauche, 3 sabre (aller), 6 sabre (retour),
// 4 ordre (canon), 5 estocade ; set = posé par le rendu (sinon l'aperçu alterne les deux pistolets)
export const POSE = { k: 1, set: false };

// pièce tournée vers l'extérieur (normale à l'angle a dans le plan du sol), à r du centre, penchée de tilt vers l'extérieur ;
// (ox, oy) = décalage dans son plan (le long du bord, vers le haut)
const radial = (s, key, col, B, a, r, y, sx, sy, sz, tilt, o, oy = 0) => s.add(key, col, B.clone().multiply(MT(Math.cos(a) * r, y, Math.sin(a) * r)).multiply(RY(PI / 2 - a)).multiply(RX(tilt)).multiply(MT(0, oy, 0)).multiply(SC(sx, sy, sz)), o);

// pistolet à silex tenu dans la main en (x, y, z) : crosse dans le poing, canon horizontal vers l'avant (+z) au repos
function pistol(s, x, y, z, { metal = STEEL, wood = WOOD, trim = GOLD, glow = 0 } = {}) {
  const o = { grad: 0.1 }, g = { grad: 0, glow };
  s.put('rbox:0.3', wood, x, y - 0.03, z - 0.02, 0.13, 0.28, 0.16, 0.35, 0, 0, o); // crosse
  s.put('sph:6:4', trim, x, y - 0.17, z - 0.08, 0.15, 0.12, 0.15, 0, 0, 0, g); // calotte
  s.put('rbox:0.2', '#3a3a44', x, y + 0.1, z + 0.1, 0.11, 0.14, 0.16, 0, 0, 0, o); // platine
  s.put('box', '#3a3a44', x, y + 0.2, z + 0.04, 0.04, 0.12, 0.05, -0.5, 0, 0, o); // chien
  s.put('rbox:0.3', wood, x, y + 0.08, z + 0.3, 0.11, 0.1, 0.36, 0, 0, 0, o); // fût
  s.put('cyl:6', metal, x, y + 0.13, z + 0.38, 0.09, 0.5, 0.09, Math.PI / 2, 0, 0, { grad: 0.1, glow: glow * 0.5 }); // canon
  for (const zz of [0.28, 0.5]) s.put('cyl:6', trim, x, y + 0.13, z + zz, 0.115, 0.035, 0.115, Math.PI / 2, 0, 0, g);
  s.put('cyl:6', trim, x, y + 0.13, z + 0.64, 0.13, 0.05, 0.13, Math.PI / 2, 0, 0, g); // bouche
}
// tête de mort (cocarde du tricorne, boucle) : crâne, orbites, os croisés derrière ; face vers +z
function skull(s, B, k, { bone = BONE, eye = INK, glow = 0 } = {}) {
  const o = { grad: 0, glow: glow * 0.3 };
  for (const r of [0.7, -0.7]) s.add('box', bone, B.clone().multiply(RZ(r)).multiply(SC(0.34 * k, 0.06 * k, 0.04)), o);
  s.add('sph:6:5', bone, B.clone().multiply(MT(0, 0.02 * k, 0.03)).multiply(SC(0.2 * k, 0.18 * k, 0.1)), o);
  s.add('box', bone, B.clone().multiply(MT(0, -0.07 * k, 0.04)).multiply(SC(0.11 * k, 0.06 * k, 0.06)), o);
  for (const sd of [1, -1]) s.add('box', eye, B.clone().multiply(MT(sd * 0.045 * k, 0.03 * k, 0.085)).multiply(SC(0.05 * k, 0.05 * k, 0.03)), { grad: 0, glow });
}
// plume : grandes barbes qui se chevauchent, de la base (x, y, z) vers le haut, l'extérieur et l'arrière, en se recourbant
function plume(s, cols, x, y, z, n, k, glow = 0) {
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1), px = x + 0.06 * i * k, py = y + (0.17 * i - 0.025 * i * i) * k, pz = z - 0.14 * i * k;
    s.put('sph:6:4', cols[i % cols.length], px, py, pz, (0.3 - 0.12 * f) * k, (0.13 - 0.03 * f) * k, (0.5 - 0.12 * f) * k, -0.5 - f * 0.9, 0.3, -0.35, { grad: 0.05, glow });
  }
  s.put('sph:6:4', cols[0], x - 0.02, y - 0.04, z + 0.06, 0.16 * k, 0.12 * k, 0.16 * k, 0, 0, 0, { grad: 0, glow }); // pied de la plume
}
// roue de gouvernail (dans le dos, face à -z) : jante, moyeu, 8 rayons à poignées
function wheel(s, col, x, y, z, r, glow) {
  const B = MT(x, y, z), o = { grad: 0, glow };
  s.add('tor:0.09:4:16', col, B.clone().multiply(SC(r * 2, r * 2, r * 2)), o);
  s.add('cyl:8', col, B.clone().multiply(RX(PI / 2)).multiply(SC(r * 0.5, 0.1, r * 0.5)), o);
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * TAU;
    s.add('box', col, B.clone().multiply(RZ(a)).multiply(MT(r * 0.62, 0, 0)).multiply(SC(r * 1.3, 0.05, 0.05)), o);
    s.add('cyl:5', col, B.clone().multiply(RZ(a)).multiply(MT(r * 1.25, 0, 0)).multiply(RZ(PI / 2)).multiply(SC(0.07, r * 0.36, 0.07)), o);
  }
}
// doublon (pièce d'or) debout
const coin = (s, x, y, z, ry, glow) => { s.put('cyl:10', '#ffd23a', x, y, z, 0.2, 0.04, 0.2, PI / 2, ry, 0, { grad: 0, glow }); s.put('box', '#fff0a0', x, y, z, 0.08, 0.08, 0.05, 0, ry, PI / 4, { grad: 0, glow: glow + 0.3 }); };

// ---------- Morgane (capitaine pirate) ----------
function buildPirate(sh, C, evo, K) {
  const coat = C[1], coatS = C[2], shirt = C[3], gold = C.a, hair = C.h, skin = C.s, dark = C.c;
  const [H, E, HR, CH, HP, L, R, AL, AR, W, OF, CP, FL] = ['head', 'eyes', 'hair', 'chest', 'hips', 'legL', 'legR', 'armL', 'armR', 'wpn', 'off', 'cape', 'float'].map(sh);
  const adm = evo === 2, ghost = evo === 3, queen = evo >= 4;
  const gg = ghost ? 0.9 : queen ? 0.35 : evo >= 1 ? 0.1 : 0, T = { grad: 0, glow: gg }; // lueur des galons
  const boot = ghost ? '#16262a' : queen ? '#1a3a6a' : '#2a1a14', cuffB = queen ? gold : ghost ? '#2a4a48' : '#6a4426';
  const breeches = queen ? '#ffffff' : ghost ? '#2a3e40' : adm ? '#f0ece0' : '#e8d8b8', glove = queen ? '#f4f0e6' : ghost ? '#1e3436' : LEATHER;
  // ---- jambes : culotte claire, hautes bottes à revers évasés, boucle dorée ----
  K.boots(L, R, boot, {});
  K.legs(L, R, breeches, { w: 0.24 });
  for (const [s, sd] of [[L, 1], [R, -1]]) {
    s.put('rbox:0.3', boot, 0.19 * sd, 0.32, 0.02, 0.27, 0.36, 0.3, 0, 0, 0, { grad: 0.2 });
    s.put('frust:0.2:0.16:8', cuffB, 0.19 * sd, 0.54, 0.03, 0.95, 0.15, 1.0, -0.12, 0, 0, { grad: 0, glow: gg * 0.4 });
    s.put('box', gold, 0.19 * sd, 0.2, 0.2, 0.12, 0.06, 0.04, 0, 0, 0, T);
  }
  // ---- manteau (bas) : pans évasés ouverts devant, ourlet d'or, longues basques dans le dos ----
  HP.put('frust:0.38:0.52:8', coat, 0, 0.47, -0.04, 0.98, 0.56, 0.92, 0, PI / 8, 0, { grad: 0.25 });
  HP.put('frust:0.52:0.54:8', gold, 0, 0.2, -0.04, 0.99, 0.06, 0.93, 0, PI / 8, 0, T);
  HP.put('box', breeches, 0, 0.47, 0.405, 0.24, 0.52, 0.04, -0.23, 0, 0, { grad: 0.1 });
  HP.sym('box', gold, 0.135, 0.47, 0.41, 0.045, 0.54, 0.045, -0.23, 0, 0, T);
  HP.put('box', coatS, 0, 0.36, -0.45, 0.6, 0.62, 0.05, 0.28, 0, 0, { grad: 0.2 });
  HP.put('box', gold, 0, 0.065, -0.5, 0.62, 0.05, 0.06, 0.28, 0, 0, T);
  if (ghost) for (let i = 0; i < 9; i++) { const a = PI * 0.15 + i / 8 * PI * 1.7, x = Math.cos(a) * 0.48, z = Math.sin(a) * 0.44 - 0.04; HP.put('cone:4', coatS, x, 0.12, z, 0.14, 0.2, 0.1, PI, -a, 0, { grad: 0 }); } // lambeaux
  // ceinture noire à grosse boucle dorée ; ceinture d'étoffe nouée sur le côté dès Corsaire
  HP.put('rbox:0.3', INK, 0, 0.76, 0, 0.8, 0.12, 0.58, 0, 0, 0, { grad: 0 });
  HP.put('rbox:0.2', gold, 0, 0.76, 0.3, 0.2, 0.16, 0.04, 0, 0, 0, { grad: 0, glow: 0.2 });
  HP.put('box', INK, 0, 0.76, 0.32, 0.1, 0.07, 0.02, 0, 0, 0, { grad: 0 });
  if (evo >= 1) {
    const sash = queen ? '#22c8b0' : ghost ? '#3a6a5a' : adm ? '#c8202e' : '#ffd04a';
    HP.put('rbox:0.3', sash, 0, 0.66, 0, 0.84, 0.09, 0.62, 0, 0, 0, { grad: 0.1 });
    HP.put('sph:6:4', sash, -0.36, 0.64, 0.18, 0.16, 0.14, 0.12, 0, 0, 0, { grad: 0.1 });
    for (const [x, r] of [[-0.36, 0.15], [-0.43, 0.4]]) HP.put('box', sash, x, 0.48, 0.22, 0.09, 0.32, 0.04, 0.1, 0.3, r, { grad: 0.1 });
  }
  // sabre d'abordage au fourreau, sur la hanche gauche : fourreau de cuir, bout et garde dorés
  HP.seg('rbox:0.3', LEATHER, [0.55, 0.72, 0.1], [0.66, 0.12, -0.34], 0.1, 0.07, { grad: 0.1 });
  HP.put('cone:5', gold, 0.665, 0.09, -0.37, 0.09, 0.12, 0.07, PI - 0.6, 0, 0, T);
  HP.put('hemi:8:4', gold, 0.54, 0.8, 0.16, 0.24, 0.12, 0.2, -0.9, 0, 0, { grad: 0, glow: 0.15 + gg });
  HP.seg('cyl:6', INK, [0.54, 0.82, 0.18], [0.52, 0.98, 0.28], 0.07, 0.07, { grad: 0 });
  HP.put('sph:6:4', gold, 0.52, 1.0, 0.29, 0.09, 0.09, 0.09, 0, 0, 0, T);
  if (adm) { HP.seg('cyl:8', '#d8a83a', [-0.56, 0.72, -0.24], [-0.62, 0.3, -0.4], 0.11, 0.11, { grad: 0.1 }); HP.put('cyl:8', INK, -0.63, 0.27, -0.41, 0.13, 0.05, 0.13, 0.35, 0, 0, { grad: 0 }); } // longue-vue
  // ---- manteau (buste) : revers galonnés, chemise et jabot, boutons dorés, col montant ----
  CH.put('rbox:0.32', coat, 0, 1.02, 0, 0.74, 0.58, 0.52, 0, 0, 0, { grad: 0.2 });
  CH.put('box', shirt, 0, 1.1, 0.262, 0.24, 0.36, 0.02, 0, 0, 0, { grad: 0 });
  for (const sd of [1, -1]) {
    CH.put('box', coatS, 0.15 * sd, 1.07, 0.27, 0.12, 0.46, 0.03, 0, 0, 0.28 * sd, { grad: 0.1 }); // revers
    CH.put('box', gold, 0.1 * sd, 1.08, 0.285, 0.035, 0.46, 0.02, 0, 0, 0.28 * sd, T);
    for (const y of [0.86, 0.98]) CH.put('sph:5:4', gold, 0.27 * sd, y, 0.26, 0.06, 0.06, 0.04, 0, 0, 0, T);
  }
  CH.put('cone:6', shirt, 0, 1.16, 0.28, 0.18, 0.2, 0.08, PI, 0, 0, { grad: 0 }); // jabot
  CH.put('sph:6:4', shirt, 0, 1.25, 0.25, 0.22, 0.1, 0.12, 0, 0, 0, { grad: 0 });
  CH.put('rbox:0.3', coat, 0, 1.3, -0.12, 0.66, 0.18, 0.32, 0.2, 0, 0, { grad: 0.1 }); // col
  CH.put('box', gold, 0, 1.39, -0.12, 0.66, 0.03, 0.32, 0.2, 0, 0, T);
  if (evo >= 1) { // baudrier : sangle en travers, boucles dorées ; épaulettes à franges
    CH.add('box', LEATHER, MT(0, 1.02, 0.27).multiply(RZ(-0.72)).multiply(SC(0.09, 0.82, 0.03)), { grad: 0 });
    for (const t of [-0.22, 0.18]) CH.put('box', gold, t * Math.sin(0.72) * -1, 1.02 + t * Math.cos(0.72), 0.29, 0.08, 0.06, 0.02, 0, 0, -0.72, T);
    for (const sd of [1, -1]) {
      const ep = queen ? '#ffe070' : gold;
      CH.put('rbox:0.3', ep, 0.43 * sd, 1.32, 0, 0.32, 0.08, 0.34, 0, 0, -0.2 * sd, { grad: 0, glow: 0.15 + gg * 0.5 });
      for (let i = 0; i < 5; i++) { const z = -0.12 + i * 0.06; CH.put('cyl:4', ep, 0.57 * sd, 1.22, z, 0.03, 0.14, 0.03, 0, 0, -0.2 * sd, T); }
    }
  }
  if (adm || queen) { // médailles et aiguillette dorée
    for (const [x, c] of [[-0.2, '#3a7ae8'], [-0.08, '#e83a3a']]) { CH.put('box', c, x, 1.16, 0.272, 0.07, 0.08, 0.02, 0, 0, 0, { grad: 0 }); CH.put('cyl:8', gold, x, 1.07, 0.275, 0.09, 0.02, 0.09, PI / 2, 0, 0, { grad: 0, glow: 0.3 }); }
    for (const k of [0, 1]) CH.put('tor:0.12:4:10', gold, 0.3, 1.08 - k * 0.07, 0.2, 0.3 - k * 0.06, 0.28 - k * 0.06, 0.3, 0.2, 0.9, 0, T);
  }
  if (queen) { // collier de perles
    for (let i = 0; i < 9; i++) { const a = PI * 0.2 + i / 8 * PI * 0.6; CH.put('sph:5:4', '#ffffff', Math.cos(a) * 0.24, 1.28 - Math.sin(a) * 0.12, 0.17 + Math.sin(a) * 0.1, 0.07, 0.07, 0.07, 0, 0, 0, { grad: 0, glow: 0.4 }); }
  }
  // ---- bras : manches du manteau, grands parements galonnés, dentelle aux poignets, gants ----
  K.arm(AL, 1, coat, skin, { glove, w: 0.24 });
  K.arm(AR, -1, coat, skin, { glove, w: 0.24 });
  for (const [s, sd] of [[AL, 1], [AR, -1]]) {
    s.put('rbox:0.3', coatS, 0.53 * sd, 0.92, 0, 0.32, 0.16, 0.32, 0, 0, 0, { grad: 0.1 });
    s.put('rbox:0.3', gold, 0.53 * sd, 0.99, 0, 0.33, 0.035, 0.33, 0, 0, 0, T);
    s.put('cone:6', shirt, 0.53 * sd, 0.84, 0.01, 0.27, 0.08, 0.27, PI, 0, 0, { grad: 0 });
  }
  // ---- tête : un œil (cache-œil sur l'autre), sourire en coin, boucle d'oreille ----
  K.headBlock(H, C);
  const eyeC = ghost ? '#5affc0' : queen ? '#22d8c0' : '#2a7a4a';
  E.eye(0.2, 1.8, 0.42, 0.105, { pupil: eyeC, ry: 0.22, tall: 1.18, glow: ghost ? 1 : queen ? 0.6 : 0.15, pr: 0.66 });
  E.put('box', '#3a2414', 0.3, 1.9, 0.45, 0.09, 0.03, 0.02, 0, 0.35, -0.55, { grad: 0 }); // cils
  H.put('rbox:0.35', INK, -0.2, 1.8, 0.43, 0.22, 0.22, 0.07, 0, -0.22, 0, { grad: 0 }); // cache-œil
  if (ghost || queen) H.put('box', ghost ? '#5affc0' : gold, -0.2, 1.8, 0.47, 0.06, 0.06, 0.02, 0, -0.22, PI / 4, { grad: 0, glow: 1 });
  H.add('tor:0.045:4:18', INK, MT(0, 1.94, 0.02).multiply(RZ(0.3)).multiply(RX(PI / 2)).multiply(SC(1.04, 0.98, 1)), { grad: 0 }); // lacet
  K.brows(H, shade(hair, -0.35), { angry: -0.08, th: 0.05 });
  H.put('box', '#8a3040', 0.02, 1.6, 0.445, 0.16, 0.045, 0.03, 0, 0, 0.1, { grad: 0 }); // sourire en coin
  H.put('box', '#8a3040', 0.1, 1.625, 0.44, 0.06, 0.04, 0.03, 0, 0, 0.6, { grad: 0 });
  H.put('tor:0.2:4:10', gold, 0.5, 1.58, 0.04, 0.14, 0.14, 0.14, 0, PI / 2, 0, { grad: 0, glow: 0.3 }); // boucle d'oreille
  // ---- cheveux auburn : mèches sous le tricorne, longue tresse dans le dos ----
  H.put('rbox:0.4', hair, 0, 2.0, -0.06, 1.0, 0.44, 0.96, 0, 0, 0, { grad: 0.15 });
  for (const [x, r] of [[-0.26, 0.3], [-0.04, 0.05], [0.2, -0.25], [0.37, -0.45]]) H.put('cone:4', shade(hair, 0.05), x, 2.04, 0.4, 0.24, 0.3, 0.12, PI + 0.2, 0, r, { grad: 0 });
  H.sym('rbox:0.4', hair, 0.45, 1.7, 0.04, 0.15, 0.56, 0.46, 0, 0, 0.04, { grad: 0.12 });
  HR.put('rbox:0.4', hair, 0, 1.7, -0.42, 0.86, 0.56, 0.2, 0.05, 0, 0, { grad: 0.12 });
  const bk = 1 + evo * 0.04, bg = ghost ? 0.25 : queen ? 0.3 : 0;
  for (let i = 0; i < 7; i++) HR.put('sph:6:5', i % 2 ? shade(hair, -0.1) : hair, (i % 2 ? 0.04 : -0.04), 1.48 - i * 0.14 * bk, -0.52 - i * 0.03, 0.2 - i * 0.012, 0.19, 0.17 - i * 0.008, 0.2, 0, i % 2 ? 0.4 : -0.4, { grad: 0.1, glow: bg });
  const tie = queen ? '#22e8c8' : ghost ? '#5affc0' : gold, by = 1.48 - 7 * 0.14 * bk;
  HR.put('tor:0.3:4:8', tie, 0, by + 0.04, -0.73, 0.14, 0.14, 0.14, PI / 2, 0, 0, { grad: 0, glow: 0.3 + gg });
  HR.put('cone:5', hair, 0, by - 0.1, -0.74, 0.16, 0.22, 0.14, PI, 0, 0, { grad: 0.1, glow: bg });
  // ---- tricorne : calotte, bord relevé en triangle (pointe devant), galon d'or, tête de mort, grande plume ----
  // bord : 3 côtés, chacun en deux moitiés qui remontent vers les coins pincés ; le tout penché en arrière (on voit le visage)
  const hat = dark, hk = 1 + evo * 0.04, hB = MT(0, 2.17, -0.08).multiply(RX(-0.2)).multiply(SC(hk, hk, hk * 0.92)), ht = queen ? '#ffe070' : gold, ir = 0.4, HL = 1.42;
  H.add('hemi:10:5', hat, hB.clone().multiply(MT(0, 0.04, 0)).multiply(SC(0.9, 0.86, 0.92)), { grad: -0.25 });
  H.add('cyl:3', hat, hB.clone().multiply(MT(0, 0.04, 0)).multiply(SC(1.64, 0.06, 1.64)), { grad: 0 });
  for (const a of [PI / 6, PI * 5 / 6, PI * 3 / 2]) for (const sd of [1, -1]) {
    const M0 = hB.clone().multiply(MT(Math.cos(a) * ir, 0.04, Math.sin(a) * ir)).multiply(RY(PI / 2 - a)).multiply(RX(0.42)).multiply(MT(sd * HL / 4, 0, 0)).multiply(RZ(sd * 0.22));
    H.add('box', hat, M0.clone().multiply(MT(0, 0.15, 0)).multiply(SC(HL / 2 + 0.06, 0.3, 0.07)), { grad: -0.2 });
    H.add('box', ht, M0.clone().multiply(MT(0, 0.3, 0)).multiply(SC(HL / 2 + 0.07, 0.05, 0.09)), { grad: 0, glow: 0.15 + gg });
  }
  for (const a of [PI / 2, PI * 7 / 6, -PI / 6]) H.add('sph:6:4', ht, hB.clone().multiply(MT(Math.cos(a) * 0.93, 0.42, Math.sin(a) * 0.93)).multiply(SC(0.13, 0.13, 0.13)), { grad: 0, glow: 0.2 + gg }); // coins pincés
  if (ghost) for (const a of [PI / 3, PI * 2 / 3, PI * 1.25, PI * 1.75]) H.add('cone:4', hat, hB.clone().multiply(MT(Math.cos(a) * 0.62, 0.36, Math.sin(a) * 0.62)).multiply(RZ(Math.cos(a) * 0.5)).multiply(SC(0.12, 0.22, 0.08)), { grad: 0 }); // bord déchiré
  skull(H, hB.clone().multiply(MT(0, 0.36, 0.58)).multiply(RX(-0.25)), 1 + evo * 0.06, { bone: queen ? '#fff6d0' : BONE, eye: ghost ? '#5affc0' : INK, glow: ghost ? 1 : queen ? 0.4 : 0 });
  if (queen) for (let i = 0; i < 5; i++) { const f = i / 4 - 0.5; H.add('cone:4', '#ffe070', hB.clone().multiply(MT(f * 0.44, 0.5 + (1 - Math.abs(f) * 1.6) * 0.05, -0.06)).multiply(RZ(-f * 0.5)).multiply(SC(0.09, 0.2, 0.09)), { grad: 0, glow: 0.5 }); } // petite couronne
  const pc = queen ? ['#22e8c8', '#ffffff', '#ffd23a'] : ghost ? ['#5affc0', '#c8fff0'] : adm ? ['#ffffff', '#f4f0e0'] : evo >= 1 ? ['#ff3a4a', '#ffffff'] : ['#f4f0e8', '#ffe0d0'];
  plume(H, pc, 0.42, 2.56, -0.3, 5 + Math.min(evo, 2), 1.15 + evo * 0.08, ghost ? 0.9 : queen ? 0.7 : 0);
  // ---- pistolets à silex (dorés dès Amirale, spectraux en Fantôme) ----
  const pst = { metal: adm || queen ? '#ffd04a' : ghost ? '#7affd0' : STEEL, wood: queen ? '#f4f0e6' : ghost ? '#2a3a3a' : WOOD, trim: ghost ? '#5affc0' : gold, glow: ghost ? 0.8 : queen ? 0.4 : 0 };
  pistol(W, -0.53, 0.76, 0.06, pst);
  pistol(OF, 0.53, 0.76, 0.06, pst);
  // ---- stades ----
  if (adm || ghost) { // cape de capitaine (en lambeaux pour le fantôme)
    K.capeShape(CP, ghost ? '#16343a' : '#0e1a3a', ghost ? '#5affc0' : gold, { len: 0.9 + evo * 0.06, w: 0.86, glow: ghost ? 0.3 : 0 });
    if (ghost) for (let i = 0; i < 5; i++) CP.put('cone:4', '#16343a', -0.4 + i * 0.2, 0.32, -0.36 - (i % 2) * 0.04, 0.16, 0.26, 0.06, PI, 0, 0, { grad: 0 });
  }
  if (ghost) for (let i = 0; i < 2; i++) { // feux follets verts en orbite
    const a = i * PI, x = Math.cos(a) * 1.0, z = Math.sin(a) * 1.0, y = 1.1 + i * 0.35;
    FL.put('sph:6:5', '#5affc0', x, y, z, 0.22, 0.28, 0.22, 0, 0, 0, { grad: 0, glow: 1.3 });
    FL.put('cone:5', '#c8fff0', x, y + 0.2, z, 0.14, 0.26, 0.14, 0, 0, 0, { grad: 0, glow: 1.3 });
  }
  if (queen) {
    // voiles en guise d'ailes (toile blanche, vergue et cordages dorés), gouvernail doré dans le dos, doublons en orbite
    for (const [bn, sd] of [['wingL', 1], ['wingR', -1]]) {
      const s = sh(bn);
      for (let i = 0; i < 2; i++) {
        const m = MT(sd * (0.2 + i * 0.1), 1.3 + i * 0.06, -0.42 - i * 0.05).multiply(RY(sd * 0.4)).multiply(RZ(-sd * (0.55 + i * 0.5))), L = 1.2 - i * 0.25;
        s.add('rbox:0.15', i ? '#f4f0e6' : '#ffffff', m.clone().multiply(MT(sd * 0.05, L / 2, 0)).multiply(SC(0.5 - i * 0.08, L, 0.05)), { grad: -0.15, glow: 0.2 });
        s.add('box', '#ffd23a', m.clone().multiply(MT(sd * 0.05, L, 0)).multiply(SC(0.56 - i * 0.08, 0.05, 0.07)), { grad: 0, glow: 0.6 });
        s.add('box', '#22e8c8', m.clone().multiply(MT(sd * 0.05, L * 0.5, 0.03)).multiply(SC(0.5 - i * 0.08, 0.04, 0.03)), { grad: 0, glow: 1 });
      }
    }
    wheel(CH, '#ffd23a', 0, 1.3, -0.9, 0.5, 0.7);
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; coin(FL, Math.cos(a) * 1.0, 1.0 + (i % 2) * 0.42, Math.sin(a) * 1.0, a, 0.8); }
  }
}

// ---------- Attaque (pose.atk : 1 au coup, décroît ; w = poids, u = avancement 0 → 1) ----------
let prevAtk = 0;
function atkPirate(b, w, u, atk) {
  if (atk > prevAtk + 0.3 && !POSE.set) POSE.k = POSE.k === 1 ? 2 : 1; // aperçu : les deux pistolets à tour de rôle
  prevAtk = atk;
  const k = POSE.k;
  if (k === 1 || k === 2) {
    // pistolet tendu vers la cible, petit recul de l'arme au départ du coup, l'épaule du tir en avant
    const right = k === 1, arm = right ? b.armR : b.armL, gun = right ? b.wpn : b.off, kick = u < 0.3 ? Math.sin(u / 0.3 * PI) : 0;
    arm.rotation.x = lerp(arm.rotation.x, -1.55 - 0.4 * kick, w); arm.rotation.z = lerp(arm.rotation.z, right ? 0.18 : -0.18, w);
    gun.rotation.x = (1.55 - 0.5 * kick) * w;
    b.chest.rotation.y = (right ? 0.32 : -0.32) * w; b.head.rotation.y = (right ? -0.2 : 0.2) * w;
    b.chest.rotation.x -= 0.06 * kick * w;
  } else if (k === 3 || k === 6) {
    // coup de sabre horizontal (le sabre est dessiné par le rendu) : aller de droite à gauche, retour en revers
    const s = smooth(u / 0.3), back = k === 6;
    b.wpn.scale.setScalar(Math.max(0.001, 1 - w * 1.4));
    b.armR.rotation.z = lerp(b.armR.rotation.z, -1.4, w);
    b.armR.rotation.y = (back ? lerp(2.1, -0.6, s) : lerp(-0.7, 2.2, s)) * w;
    b.armR.rotation.x = lerp(b.armR.rotation.x, -0.15, w);
    b.chest.rotation.y = (back ? lerp(0.7, -0.45, s) : lerp(-0.5, 0.7, s)) * w; b.hips.rotation.y = (back ? 0.15 : -0.15) * w;
    b.armL.rotation.x = lerp(b.armL.rotation.x, -0.6, w); b.armL.rotation.z = lerp(b.armL.rotation.z, 0.5, w);
  } else if (k === 5) {
    // estocade : bras droit lancé droit devant, buste en avant
    const s = smooth(u / 0.18);
    b.wpn.scale.setScalar(Math.max(0.001, 1 - w * 1.4));
    b.armR.rotation.x = lerp(b.armR.rotation.x, lerp(-0.9, -1.6, s), w); b.armR.rotation.z = lerp(b.armR.rotation.z, 0.1, w);
    b.chest.rotation.y = 0.45 * w; b.chest.rotation.x += 0.2 * w; b.hips.rotation.y = 0.2 * w;
    b.armL.rotation.x = lerp(b.armL.rotation.x, 0.5, w); b.armL.rotation.z = lerp(b.armL.rotation.z, 0.9, w);
  } else {
    // ordre (canon) : bras gauche levé, pistolet pointé vers le ciel puis vers la cible
    const s = smooth(u / 0.35);
    b.armL.rotation.x = lerp(b.armL.rotation.x, lerp(-2.6, -1.6, s), w); b.armL.rotation.z = lerp(b.armL.rotation.z, -0.1, w);
    b.chest.rotation.y = -0.25 * w; b.head.rotation.x -= 0.12 * w;
    b.armR.rotation.z = lerp(b.armR.rotation.z, -0.45, w);
  }
}

export const HEROES_PIR = {
  pirate: { build: buildPirate, atk: atkPirate },
};
