// Héros 3D de Tess l'Ingénieure. Même marionnette, mêmes pièces et même style chibi que les autres (models-heroes.js prête
// ses pièces : build(sh, C, evo, K)) : salopette orange sur un tee-shirt crème, lunettes d'aviatrice sur le front, couettes,
// sac à dos mécanique (pots d'échappement, roue dentée, cadrans), clé à molette géante. 5 stades visibles chacun :
// Mécano (ceinture à outils, gants, antenne), Turbo (réacteurs dorsaux, épaulières, lance-flammes au poignet), Cyber
// (salopette bleu nuit, visière lumineuse, mini-drones en orbite), Oméga (blindage chromé, ailes de plaques, roue dentée
// lumineuse, aura de super guerrière). atk = geste d'attaque : ses armes ne tirent rien que le modèle suive, fx-engineer.js
// le déclenche (tourelle posée, mines lancées, jet de flammes).
import { THREE, PI, TAU, lerp, smooth, shade } from './models-kit.js';

const STEEL = '#b8c2d0', STEEL_D = '#7a8496', BRASS = '#e0a83a', LEATHER = '#6a4426', LEATHER_L = '#8a5a32', DARK = '#2a2e3a', HAZ = '#ffd23a';
const MT = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
const RX = a => new THREE.Matrix4().makeRotationX(a), RY = a => new THREE.Matrix4().makeRotationY(a), RZ = a => new THREE.Matrix4().makeRotationZ(a);
const SC = (x, y, z) => new THREE.Matrix4().makeScale(x, y, z);

// roue dentée (disque face à +z, tourné de ry autour de la verticale) : rayon r, n dents, moyeu
function gear(s, col, x, y, z, r, { ry = 0, n = 8, glow = 0, hub = null, th = 0.08 } = {}) {
  const B = MT(x, y, z).multiply(RY(ry)), o = { grad: 0, glow };
  s.add('cyl:10', col, B.clone().multiply(RX(PI / 2)).multiply(SC(r * 1.6, th, r * 1.6)), o);
  for (let i = 0; i < n; i++) s.add('box', col, B.clone().multiply(RZ(i / n * TAU)).multiply(MT(r * 0.86, 0, 0)).multiply(SC(r * 0.34, r * 0.3, th * 0.9)), o);
  s.add('cyl:8', hub || shade(col, -0.3), B.clone().multiply(RX(PI / 2)).multiply(SC(r * 0.55, th + 0.03, r * 0.55)), { grad: 0, glow: glow * 0.6 });
}
// petit drone (vue de 3/4) : corps, œil, 4 bras et disques d'hélices
function miniDrone(s, x, y, z, k, body, eye, rotor = '#8a96aa') {
  s.put('rbox:0.3', body, x, y, z, 0.26 * k, 0.12 * k, 0.26 * k, 0, 0, 0, { grad: 0.1 });
  s.put('sph:6:4', eye, x, y - 0.02 * k, z + 0.13 * k, 0.09 * k, 0.09 * k, 0.06 * k, 0, 0, 0, { grad: 0, glow: 1 });
  for (let i = 0; i < 4; i++) {
    const a = PI / 4 + i * PI / 2, cx = Math.cos(a) * 0.2 * k, cz = Math.sin(a) * 0.2 * k;
    s.put('box', DARK, x + cx / 2, y + 0.02 * k, z + cz / 2, 0.22 * k, 0.03 * k, 0.04 * k, 0, -a, 0, { grad: 0 });
    s.put('cyl:8', rotor, x + cx, y + 0.05 * k, z + cz, 0.2 * k, 0.015, 0.2 * k, 0, 0, 0, { grad: 0 });
  }
}

// ---------- Tess (ingénieure) ----------
function buildEngineer(sh, C, evo, K) {
  const suit = C[1], suitS = C[2], shirt = C[3], neon = C.a, hair = C.h, skin = C.s, metal = C.c;
  const [H, E, HR, CH, HP, L, R, AL, AR, W, OF, CP, FL] = ['head', 'eyes', 'hair', 'chest', 'hips', 'legL', 'legR', 'armL', 'armR', 'wpn', 'off', 'cape', 'float'].map(sh);
  const cyber = evo === 3, omega = evo >= 4, ng = 0.45 + evo * 0.14; // lueur des voyants (plus vive à chaque stade)
  const glove = omega ? '#f4f6fb' : cyber ? '#3a4660' : evo >= 1 ? '#3a3e4a' : skin, boot = omega ? '#d8dee8' : cyber ? DARK : LEATHER;
  // grosses chaussures de chantier (bout renforcé), bas de salopette retroussé
  K.boots(L, R, boot, { top: omega ? BRASS : cyber ? metal : '#3a2a1e' });
  for (const [s, sd] of [[L, 1], [R, -1]]) s.put('rbox:0.3', omega ? '#ffffff' : STEEL_D, 0.19 * sd, 0.1, 0.22, 0.26, 0.12, 0.08, 0, 0, 0, { grad: 0 });
  K.legs(L, R, suit, { w: 0.25 });
  for (const [s, sd] of [[L, 1], [R, -1]]) s.put('rbox:0.3', suitS, 0.19 * sd, 0.27, 0, 0.3, 0.09, 0.31, 0, 0, 0, { grad: 0 });
  // salopette : bas, ceinture (sacoches et tournevis dès Mécano), boucle dorée
  HP.put('rbox:0.32', suit, 0, 0.57, 0, 0.78, 0.36, 0.56, 0, 0, 0, { grad: 0.2 });
  HP.put('rbox:0.3', evo >= 1 ? LEATHER : suitS, 0, 0.74, 0, 0.82, 0.1, 0.6, 0, 0, 0, { grad: 0 });
  HP.put('rbox:0.2', BRASS, 0, 0.74, 0.3, 0.14, 0.11, 0.04, 0, 0, 0, { grad: 0, glow: 0.15 });
  if (evo >= 1) {
    HP.sym('rbox:0.3', LEATHER_L, 0.37, 0.62, 0.16, 0.17, 0.22, 0.13, 0, 0.3, 0, { grad: 0.1 }); // sacoches
    HP.put('cyl:6', '#c83a2a', -0.37, 0.8, 0.2, 0.06, 0.14, 0.06, 0, 0, 0, { grad: 0 }); // tournevis (manche rouge)
    HP.put('cyl:4', STEEL, -0.37, 0.92, 0.2, 0.025, 0.14, 0.025, 0, 0, 0, { grad: 0 });
    HP.put('rbox:0.2', STEEL, 0.37, 0.76, 0.2, 0.05, 0.16, 0.03, 0, 0, 0.15, { grad: 0 }); // petite clé plate
  }
  // buste : tee-shirt, bavette de salopette avec poche et bretelles aux boutons dorés
  CH.put('rbox:0.32', shirt, 0, 1.02, 0, 0.72, 0.58, 0.5, 0, 0, 0, { grad: 0.2 });
  CH.put('rbox:0.2', suit, 0, 0.9, 0.17, 0.52, 0.42, 0.2, 0, 0, 0, { grad: 0.15 });
  CH.put('box', suitS, 0, 0.93, 0.275, 0.24, 0.15, 0.02, 0, 0, 0, { grad: 0 });
  CH.put('cyl:4', HAZ, 0.07, 1.04, 0.27, 0.03, 0.12, 0.03, 0, 0, -0.2, { grad: 0 }); // crayon dans la poche
  for (const sd of [1, -1]) {
    CH.put('box', suit, 0.19 * sd, 1.2, 0.2, 0.11, 0.22, 0.05, -0.15, 0, 0, { grad: 0 }); // bretelles devant…
    CH.put('box', suit, 0.19 * sd, 1.3, -0.02, 0.11, 0.05, 0.5, 0, 0, 0, { grad: 0 }); // … par-dessus l'épaule
    CH.put('cyl:6', BRASS, 0.19 * sd, 1.1, 0.28, 0.08, 0.03, 0.08, PI / 2, 0, 0, { grad: 0, glow: 0.2 });
  }
  if (omega) { // plastron chromé et réacteur lumineux au centre
    CH.put('rbox:0.2', '#f4f6fb', 0, 1.02, 0.2, 0.6, 0.4, 0.16, 0, 0, 0, { grad: 0.15 });
    CH.put('cyl:8', neon, 0, 1.04, 0.29, 0.2, 0.04, 0.2, PI / 2, 0, 0, { grad: 0, glow: 1.2 });
    CH.put('tor:0.12:4:12', metal, 0, 1.04, 0.29, 0.26, 0.26, 0.26, 0, 0, 0, { grad: 0, glow: 0.3 });
  }
  // ---- sac à dos mécanique ----
  const pack = cyber ? '#3a4a6a' : omega ? '#e8ecf4' : metal, bz = -0.42;
  CH.put('rbox:0.22', pack, 0, 1.05, bz, 0.66, 0.66, 0.34, 0, 0, 0, { grad: 0.2 });
  CH.put('rbox:0.2', omega ? metal : suit, 0, 1.08, bz - 0.17, 0.5, 0.44, 0.04, 0, 0, 0, { grad: 0.1 }); // panneau
  for (let i = 0; i < 3; i++) CH.put('box', i % 2 ? DARK : HAZ, -0.16 + i * 0.16, 0.8, bz - 0.17, 0.14, 0.06, 0.03, 0, 0, 0.5, { grad: 0 }); // rayures de danger
  CH.put('cyl:8', '#f4f0e0', 0.12, 1.16, bz - 0.2, 0.16, 0.03, 0.16, PI / 2, 0, 0, { grad: 0 }); // cadran
  CH.put('box', '#c83a2a', 0.13, 1.18, bz - 0.22, 0.02, 0.07, 0.01, 0, 0, -0.6, { grad: 0 });
  for (const [x, c] of [[-0.14, '#5aff7a'], [-0.06, neon]]) CH.put('sph:6:4', c, x, 1.2, bz - 0.2, 0.05, 0.05, 0.04, 0, 0, 0, { grad: 0, glow: 1 }); // voyants
  gear(CH, omega ? BRASS : STEEL, 0.36, 1.08, bz, 0.17, { ry: PI / 2, glow: omega ? 0.5 : 0 }); // roue dentée sur le côté
  for (const sd of [1, -1]) { // pots d'échappement (fumée : rendu)
    CH.put('cyl:6', STEEL, 0.21 * sd, 1.46, bz - 0.04, 0.1, 0.3, 0.1, 0, 0, 0, { grad: 0.1 });
    CH.put('cyl:6', DARK, 0.21 * sd, 1.62, bz - 0.04, 0.13, 0.05, 0.13, 0, 0, 0, { grad: 0 });
  }
  if (evo >= 1) { // antenne à voyant
    CH.put('cyl:4', DARK, -0.08, 1.75, bz + 0.02, 0.03, 0.62, 0.03, 0, 0, 0.12, { grad: 0 });
    CH.put('sph:6:4', evo >= 2 ? neon : '#ff4a3a', -0.12, 2.08, bz + 0.02, 0.09, 0.09, 0.09, 0, 0, 0, { grad: 0, glow: 1.1 });
  }
  if (evo >= 2) for (const sd of [1, -1]) { // réacteurs dorsaux, flamme bleue
    CH.put('cyl:8', omega ? '#f4f6fb' : STEEL, 0.22 * sd, 0.82, bz - 0.06, 0.2, 0.26, 0.2, 0, 0, 0, { grad: 0.2 });
    CH.put('cyl:8', DARK, 0.22 * sd, 0.67, bz - 0.06, 0.16, 0.05, 0.16, 0, 0, 0, { grad: 0 });
    CH.put('cone:6', neon, 0.22 * sd, 0.5, bz - 0.06, 0.13, 0.3, 0.13, PI, 0, 0, { grad: 0, glow: 1.2 });
  }
  // bras : manches courtes, gants de travail (gantelets en Cyber / Oméga), épaulières dès Turbo
  K.arm(AL, 1, shirt, skin, { cuff: suitS, glove, w: 0.22 });
  K.arm(AR, -1, shirt, skin, { cuff: suitS, glove, w: 0.22 });
  if (evo >= 2) for (const sd of [1, -1]) {
    K.pauldron(CH, sd, omega ? '#f4f6fb' : cyber ? '#4a5a7a' : metal, omega ? BRASS : neon, 0.8);
    CH.put('box', HAZ, 0.52 * sd, 1.34, 0.08, 0.2, 0.04, 0.08, 0, 0, -0.25 * sd, { grad: 0 });
  }
  if (evo >= 3) for (const [s, sd] of [[AL, 1], [AR, -1]]) { // avant-bras mécaniques : plaques et vérin
    s.put('rbox:0.3', omega ? '#e8ecf4' : '#4a5a7a', 0.53 * sd, 0.92, 0, 0.27, 0.2, 0.27, 0, 0, 0, { grad: 0.1 });
    s.put('box', neon, 0.53 * sd, 0.92, 0.14, 0.12, 0.04, 0.02, 0, 0, 0, { grad: 0, glow: 1 });
  }
  // ---- tête : yeux verts (lumineux en Cyber), taches de rousseur, trace de cambouis, grand sourire ----
  K.headBlock(H, C);
  K.eyes(E, { col: omega ? '#ffb21a' : cyber ? '#3affd8' : '#2a9a5a', glow: evo >= 3 ? 0.7 : 0.15, r: 0.105, tall: 1.15 });
  E.sym('box', '#3a2414', 0.3, 1.89, 0.45, 0.09, 0.03, 0.02, 0, 0.35, -0.55, { grad: 0 }); // cils
  K.brows(H, shade(hair, -0.3), { angry: -0.05, th: 0.05 });
  K.mouth(H, 'grin');
  for (const [x, y] of [[0.24, 1.7], [0.3, 1.68], [0.27, 1.65]]) H.sym('box', shade(skin, -0.28), x, y, 0.448, 0.03, 0.03, 0.02, 0, 0.5, 0, { grad: 0 });
  if (evo < 3) H.put('box', '#4a3a3a', -0.3, 1.62, 0.43, 0.12, 0.04, 0.02, 0, 0.4, 0.3, { grad: 0 }); // cambouis sur la joue
  // cheveux châtains : carré à frange, couettes nouées de chaque côté (lumineuses en Oméga)
  const tie = omega ? neon : evo >= 1 ? neon : '#ff7a2f';
  if (omega) K.superHair(HR, hair, 0.8);
  else {
    H.put('rbox:0.4', hair, 0, 2.02, -0.06, 1.0, 0.5, 0.96, 0, 0, 0, { grad: 0.15 });
    for (const [x, r] of [[-0.27, 0.35], [-0.05, 0.08], [0.18, -0.2], [0.36, -0.4]]) H.put('cone:4', shade(hair, 0.04), x, 2.0, 0.4, 0.24, 0.3, 0.12, PI + 0.2, 0, r, { grad: 0 }); // frange en mèches
    H.sym('rbox:0.4', hair, 0.45, 1.72, 0.02, 0.15, 0.5, 0.5, 0, 0, 0.04, { grad: 0.12 });
    HR.put('rbox:0.4', hair, 0, 1.66, -0.42, 0.88, 0.56, 0.2, 0.05, 0, 0, { grad: 0.12 });
    H.put('cone:4', hair, 0.05, 2.32, 0.02, 0.12, 0.26, 0.1, 0.3, 0, -0.4, { grad: 0 }); // épi
  }
  for (const sd of [1, -1]) { // couettes : élastique, trois boules de cheveux qui descendent vers l'extérieur, pointe
    const hc = omega ? shade(hair, 0.15) : hair, og = { grad: 0.1, glow: omega ? 0.5 : 0 };
    HR.put('tor:0.3:4:8', tie, 0.5 * sd, 1.98, -0.12, 0.17, 0.17, 0.17, 0, 0, PI / 2 + 0.6 * sd, { grad: 0, glow: evo >= 1 ? 0.6 : 0.1 });
    HR.put('sph:6:5', hc, 0.62 * sd, 1.86, -0.16, 0.3, 0.32, 0.28, 0, 0, -0.5 * sd, og);
    HR.put('sph:6:5', hc, 0.74 * sd, 1.62, -0.2, 0.26, 0.3, 0.24, 0, 0, -0.3 * sd, og);
    HR.put('sph:6:5', hc, 0.78 * sd, 1.4, -0.22, 0.21, 0.26, 0.2, 0, 0, -0.15 * sd, og);
    HR.put('cone:5', hc, 0.79 * sd, 1.2, -0.22, 0.16, 0.2, 0.15, PI, 0, 0, og);
  }
  // lunettes d'aviatrice sur le front (visière lumineuse en Cyber, verres dorés en Oméga)
  if (cyber) {
    H.put('rbox:0.3', DARK, 0, 2.13, 0.08, 1.04, 0.14, 0.8, -0.12, 0, 0, { grad: 0 });
    H.put('rbox:0.3', neon, 0, 2.12, 0.46, 0.78, 0.14, 0.06, -0.15, 0, 0, { grad: 0, glow: 1.1 });
  } else {
    H.put('tor:0.06:4:16', DARK, 0, 2.14, -0.04, 1.04, 1.0, 1.0, PI / 2 - 0.12, 0, 0, { grad: 0 }); // sangle
    for (const sd of [1, -1]) {
      H.put('cyl:10', omega ? BRASS : '#a8743a', 0.2 * sd, 2.2, 0.4, 0.3, 0.12, 0.3, PI / 2 - 0.5, 0, 0, { grad: 0 });
      H.put('cyl:10', omega ? '#ffd23a' : neon, 0.2 * sd, 2.22, 0.45, 0.22, 0.04, 0.22, PI / 2 - 0.5, 0, 0, { grad: 0, glow: 0.5 + ng * 0.4 });
      H.put('box', '#ffffff', 0.2 * sd - 0.05, 2.25, 0.47, 0.05, 0.05, 0.02, -0.5, 0, 0, { grad: 0, glow: 0.8 });
    }
    H.put('box', DARK, 0, 2.22, 0.42, 0.1, 0.05, 0.05, 0, 0, 0, { grad: 0 });
  }
  // ---- clé à molette géante (main droite) : manche plat, poignée rouge, tête en C (ouverte vers le haut) ----
  const sx = -0.53, sz = 0.07, kk = 1 + evo * 0.07, steelW = omega ? '#f4f6fb' : cyber ? '#9ab0d0' : STEEL;
  const hy = 0.86 + 1.18 * kk; // centre de la tête
  W.put('rbox:0.2', steelW, sx, 0.86 + 0.55 * kk, sz, 0.15 * kk, 1.0 * kk, 0.1, 0, 0, 0, { grad: 0.1 });
  W.put('rbox:0.3', omega ? BRASS : '#c83a2a', sx, 0.66, sz, 0.2, 0.44, 0.15, 0, 0, 0, { grad: 0.1 });
  W.put('cyl:6', DARK, sx, 0.4, sz, 0.12, 0.06, 0.12, 0, 0, 0, { grad: 0 });
  W.add('arc:0.21:4.4:12', steelW, MT(sx, hy, sz).multiply(RZ(PI / 2 - 5.34)).multiply(SC(0.56 * kk, 0.56 * kk, 0.7)), { grad: 0.1 });
  W.put('cyl:8', steelW, sx, hy - 0.17 * kk, sz, 0.3 * kk, 0.12, 0.3 * kk, PI / 2, 0, 0, { grad: 0.1 }); // vis de réglage
  W.put('box', DARK, sx, hy - 0.17 * kk, sz + 0.07, 0.2 * kk, 0.03, 0.02, 0, 0, 0, { grad: 0 });
  if (evo >= 2) W.put('box', neon, sx, 0.86 + 0.6 * kk, sz + 0.055, 0.05, 0.7 * kk, 0.02, 0, 0, 0, { grad: 0, glow: 1 }); // rainure d'énergie
  if (evo >= 3) for (const sd of [1, -1]) W.put('oct', neon, sx + sd * 0.26 * kk, hy + 0.22 * kk, sz, 0.08, 0.16, 0.08, 0, 0, -sd * 0.5, { grad: 0, glow: 1.1 }); // étincelles aux mâchoires
  // ---- main gauche : boîtier au poignet (écran), puis petit lance-flammes dès Turbo ----
  if (evo >= 2) {
    OF.put('cyl:8', omega ? '#e8ecf4' : STEEL_D, 0.6, 0.9, 0.2, 0.16, 0.36, 0.16, PI / 2, 0, 0, { grad: 0.15 });
    OF.put('cyl:8', DARK, 0.6, 0.9, 0.4, 0.12, 0.06, 0.12, PI / 2, 0, 0, { grad: 0 });
    OF.put('sph:6:4', '#ff9a2a', 0.6, 0.9, 0.44, 0.07, 0.07, 0.07, 0, 0, 0, { grad: 0, glow: 1.2 }); // veilleuse
    OF.put('cyl:6', '#c83a2a', 0.66, 1.0, 0.05, 0.1, 0.24, 0.1, PI / 2, 0, 0, { grad: 0 }); // réservoir
  } else {
    OF.put('rbox:0.3', DARK, 0.53, 0.88, 0.1, 0.2, 0.1, 0.18, 0, 0, 0, { grad: 0 });
    OF.put('box', neon, 0.53, 0.94, 0.11, 0.13, 0.02, 0.11, 0, 0, 0, { grad: 0, glow: 0.9 });
  }
  // ---- stades ----
  if (cyber) for (let i = 0; i < 2; i++) { const a = i * PI; miniDrone(FL, Math.cos(a) * 1.0, 1.15 + i * 0.3, Math.sin(a) * 1.0, 0.95, '#ff8a2a', neon); } // mini-drones en orbite
  if (omega) {
    // ailes de plaques chromées bordées de lumière, grande roue dentée lumineuse dans le dos, étincelles en orbite
    for (const [bn, sd] of [['wingL', 1], ['wingR', -1]]) {
      const s = sh(bn);
      for (let i = 0; i < 4; i++) {
        const m = MT(sd * 0.16, 1.24 + 0.04 * i, -0.4 - i * 0.03).multiply(RY(sd * 0.35)).multiply(RZ(-sd * (0.45 + i * 0.36)));
        s.add('box', i % 2 ? '#e8ecf4' : '#c8d0e0', m.clone().multiply(MT(0, (1.25 - i * 0.18) / 2, 0)).multiply(SC(0.24, 1.25 - i * 0.18, 0.06)), { grad: -0.2, glow: 0.15 });
        s.add('box', neon, m.clone().multiply(MT(0.13, (1.25 - i * 0.18) / 2, 0.02)).multiply(SC(0.04, 1.2 - i * 0.18, 0.05)), { grad: 0, glow: 1.2 });
      }
    }
    gear(CH, BRASS, 0, 1.3, -0.68, 0.42, { n: 10, glow: 0.8, hub: neon });
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; FL.put('oct', i % 2 ? '#ffd23a' : '#ffffff', Math.cos(a) * 1.0, 1.05 + (i % 2) * 0.42, Math.sin(a) * 1.0, 0.13, 0.3, 0.13, 0, a, 0.3, { grad: 0, glow: 1.2 }); }
  }
}

// ---------- Attaque (pose.atk : 1 au coup, décroît ; w = poids, u = avancement 0 → 1) ----------
// la clé à molette est levée puis abattue devant elle (tourelle posée, mines lancées), la main gauche pointe la cible
function atkEngineer(b, w, u) {
  const s = smooth(u / 0.32);
  b.armR.rotation.x = lerp(b.armR.rotation.x, lerp(-2.7, -0.5, s), w);
  b.armR.rotation.z = lerp(b.armR.rotation.z, -0.2, w);
  b.wpn.rotation.x = lerp(-0.3, 0.6, s) * w;
  b.armL.rotation.x = lerp(b.armL.rotation.x, -1.4, w); b.armL.rotation.z = lerp(b.armL.rotation.z, 0.1, w);
  b.chest.rotation.x += lerp(-0.18, 0.26, s) * w; b.chest.rotation.y = lerp(-0.3, 0.25, s) * w;
  b.head.rotation.x += lerp(-0.1, 0.08, s) * w;
}

export const HEROES_ENG = {
  engineer: { build: buildEngineer, atk: atkEngineer },
};
