// Héros 3D de Kenji le moine : robe safran et étole rouge en travers du buste, crâne rasé (points d'encens), grand chapelet
// de perles, poings bandés cerclés de fer. Même marionnette, mêmes pièces et même style chibi que les autres héros
// (models-heroes.js prête ses pièces : build(sh, C, evo, K)). 5 stades : Tigre (bandeau et étole rayés), Grue (robe blanche,
// plumes aux épaules, huppe rouge), Dragon (robe rouge, étole d'écailles d'or, cornes, perles de jade qui flottent), Éveillé
// (robe d'or pâle, auréole et chapelet lumineux qui tournent, troisième œil ; aura de super guerrier : models-heroes.js).
// atk = geste d'attaque : MKP (réglé par js/g3d/fx-monk.js à chaque coup) choisit le bras et le geste (direct, coup final,
// coup de pied tournoyant, double paume, onde, dragon).
import { THREE, PI, TAU, lerp, smooth, shade } from './models-kit.js';

// geste en cours : kind = punch | big | spin | palm | wave | dragon ; side = 1 bras gauche, -1 bras droit
export const MKP = { kind: 'punch', side: -1 };

const WRAP = '#f4ece0', IRON = '#8a90a0', GOLD = '#ffd54a', JADE = '#3ad890', SANDAL = '#7a4a2a';
const MT = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
const RX = a => new THREE.Matrix4().makeRotationX(a), RY = a => new THREE.Matrix4().makeRotationY(a), RZ = a => new THREE.Matrix4().makeRotationZ(a);
const SC = (x, y, z) => new THREE.Matrix4().makeScale(x, y, z);

// chapelet : perles sur une ellipse autour du cou, qui pend sur la poitrine ; grosse perle et pompon devant
function mala(s, col, big, { y = 1.3, rx = 0.42, rz = 0.33, drop = 0.34, n = 16, r = 0.11, glow = 0, tassel = '#c8302a' } = {}) {
  for (let i = 0; i < n; i++) {
    const a = i / n * TAU + PI / 2, sz = Math.sin(a), front = Math.max(0, sz);
    if (i === 0) continue; // place de la grosse perle
    s.put('sph:6:4', i % 4 === 2 ? shade(col, 0.25) : col, Math.cos(a) * rx, y - front * front * drop, sz * rz + 0.02 + front * 0.03, r, r, r, 0, 0, 0, { grad: 0, glow });
  }
  const fy = y - drop - 0.02, fz = rz + 0.08;
  s.put('sph:7:5', big, 0, fy, fz, r * 1.7, r * 1.7, r * 1.6, 0, 0, 0, { grad: 0, glow: glow + 0.2 });
  s.put('cone:5', tassel, 0, fy - 0.18, fz, 0.1, 0.22, 0.08, 0, 0, 0, { grad: 0.1, glow: glow * 0.5 });
}
// poing bandé (os d'un bras, côté sd) : bandes sur la main, jointures, anneau de fer au poignet (brassard coloré à partir
// du stade 1), flammes de ki sur le dos du poing (glow)
function fist(s, sd, C, evo, { ring = IRON, ki = 0 } = {}) {
  const x = 0.53 * sd;
  for (const y of [0.7, 0.82]) s.put('box', shade(WRAP, -0.14), x, y, 0.04, 0.255, 0.03, 0.255, 0, 0, 0, { grad: 0 });
  s.put('box', '#ffffff', x, 0.76, 0.17, 0.18, 0.1, 0.02, 0, 0, 0, { grad: 0 }); // jointures
  if (evo >= 1) s.put('rbox:0.3', ring, x, 0.93, 0.02, 0.27, 0.15, 0.27, 0, 0, 0, { grad: 0.05, glow: ring === GOLD ? 0.4 : 0 });
  else s.put('tor:0.16:4:10', ring, x, 0.9, 0.02, 0.29, 0.29, 0.29, PI / 2, 0, 0, { grad: 0, glow: 0.1 });
  if (ki) for (let i = 0; i < 2; i++) s.put('cone:4', i ? '#ffffff' : C.a, x + sd * 0.1, 0.84 + i * 0.03, -0.06 - i * 0.04, 0.12 - i * 0.04, 0.3 + ki * 0.08, 0.12 - i * 0.04, -0.3, 0, -sd * 0.3, { grad: 0, glow: 1.1 });
}
// plume (grue) : longue feuille blanche à pointe noire, plantée en (x, y, z) et penchée de (rx, rz)
function feather(s, x, y, z, rx, rz, L, w = 0.16) {
  const B = MT(x, y, z).multiply(RX(rx)).multiply(RZ(rz));
  s.add('sph:6:4', '#ffffff', B.clone().multiply(MT(0, L / 2, 0)).multiply(SC(w, L, 0.05)), { grad: -0.1 });
  s.add('cone:4', '#2a2a34', B.clone().multiply(MT(0, L * 0.93, 0)).multiply(SC(w * 0.62, L * 0.2, 0.06)), { grad: 0 });
}

// ---------- Kenji (moine) ----------
function buildMonk(sh, C, evo, K) {
  const robe = C[1], drape = C[2], light = C[3], ki = C.a, skin = C.s, dark = C.c;
  const [H, E, HR, CH, HP, L, R, AL, AR, W, OF, CP, FL] = ['head', 'eyes', 'hair', 'chest', 'hips', 'legL', 'legR', 'armL', 'armR', 'wpn', 'off', 'cape', 'float'].map(sh);
  const tiger = evo === 1, crane = evo === 2, dragon = evo === 3, woke = evo >= 4, kg = evo >= 3 ? 0.6 : evo * 0.12;
  // jambes : pantalon ample resserré aux chevilles par des bandes, sandales de corde
  K.legs(L, R, shade(robe, -0.12), { x: 0.2, w: 0.28 });
  for (const [s, sd] of [[L, 1], [R, -1]]) {
    s.put('rbox:0.3', shade(robe, -0.06), 0.2 * sd, 0.5, 0.01, 0.32, 0.26, 0.33, 0, 0, 0, { grad: 0.1 }); // pantalon bouffant
    s.put('rbox:0.3', WRAP, 0.2 * sd, 0.26, 0.01, 0.26, 0.12, 0.27, 0, 0, 0, { grad: 0 });
    s.put('rbox:0.25', skin, 0.2 * sd, 0.12, 0.06, 0.25, 0.14, 0.36, 0, 0, 0, { grad: 0.15 });
    s.put('rbox:0.2', SANDAL, 0.2 * sd, 0.03, 0.06, 0.3, 0.06, 0.42, 0, 0, 0, { grad: 0 });
    s.put('box', SANDAL, 0.2 * sd, 0.12, 0.16, 0.27, 0.04, 0.05, 0, 0, 0, { grad: 0 });
  }
  // robe : jupe courte fendue, ceinture d'étoffe rouge nouée devant (deux pans)
  HP.put('frust:0.38:0.52:8', robe, 0, 0.52, 0, 1, 0.46, 0.92, 0, PI / 8, 0, { grad: 0.25 });
  HP.put('frust:0.52:0.54:8', light, 0, 0.3, 0, 1, 0.05, 0.93, 0, PI / 8, 0, { grad: 0 });
  HP.put('rbox:0.3', drape, 0, 0.74, 0, 0.78, 0.14, 0.56, 0, 0, 0, { grad: 0.05 });
  HP.put('sph:6:4', shade(drape, -0.1), 0.16, 0.74, 0.29, 0.16, 0.13, 0.1, 0, 0, 0, { grad: 0 });
  for (const [x, r] of [[0.12, 0.12], [0.22, -0.1]]) HP.put('rbox:0.3', drape, x, 0.55, 0.3, 0.1, 0.34, 0.04, -0.15, 0, r, { grad: 0.1 });
  // buste : robe safran, étole en travers (épaule gauche -> hanche droite) devant et derrière, l'épaule droite nue
  CH.put('rbox:0.32', robe, 0, 1.02, 0, 0.76, 0.58, 0.52, 0, 0, 0, { grad: 0.2 });
  CH.put('rbox:0.3', skin, -0.2, 1.2, 0.02, 0.36, 0.22, 0.5, 0, 0, 0, { grad: 0.05 }); // haut du torse côté droit
  CH.put('box', shade(robe, -0.1), -0.02, 1.14, 0.265, 0.04, 0.32, 0.02, 0, 0, -0.85, { grad: 0 }); // revers de la robe
  for (const z of [0.275, -0.275]) CH.put('box', drape, 0.04, 1.03, z, 0.26, 0.8, 0.05, 0, 0, -0.86, { grad: 0.05 });
  CH.put('sph:7:5', drape, 0.3, 1.28, 0, 0.34, 0.17, 0.5, 0, 0, -0.3, { grad: 0.15 }); // étole sur l'épaule gauche
  if (tiger) for (let i = 0; i < 4; i++) CH.put('box', '#ff9a1a', 0.2 - i * 0.12, 1.25 - i * 0.12, 0.3, 0.05, 0.26, 0.02, 0, 0, 0.7, { grad: 0 }); // rayures de tigre
  if (dragon) for (let i = 0; i < 5; i++) CH.put('sph:5:3', light, 0.2 - i * 0.1, 1.22 - i * 0.09, 0.3, 0.1, 0.07, 0.03, 0, 0, -0.86, { grad: 0, glow: 0.3 }); // écailles d'or
  // chapelet de perles (lumineux pour l'Éveillé)
  mala(CH, woke ? GOLD : dragon ? JADE : dark, woke ? '#ffffff' : crane ? '#d02a2a' : evo === 1 ? '#ff9a1a' : '#c8302a', { glow: woke ? 0.7 : dragon ? 0.35 : 0, r: 0.11 + evo * 0.008, tassel: woke ? '#ff9a1a' : '#c8302a' });
  // bras : manche courte à gauche, bras droit nu ; poings bandés
  K.arm(AL, 1, robe, skin, { w: 0.25, glove: WRAP });
  K.arm(AR, -1, skin, skin, { w: 0.26, glove: WRAP });
  const ring = woke ? GOLD : dragon ? JADE : crane ? '#d02a2a' : evo === 1 ? '#2a1a14' : IRON;
  fist(AL, 1, C, evo, { ring, ki: evo >= 3 ? evo - 2 : 0 });
  fist(AR, -1, C, evo, { ring, ki: evo >= 3 ? evo - 2 : 0 });
  // tête rasée : dôme rond et brillant, points d'encens, oreilles un peu grandes, regard calme et déterminé
  K.headBlock(H, C);
  H.put('hemi:10:5', skin, 0, 2.05, 0.02, 0.94, 0.5, 0.86, 0, 0, 0, { grad: -0.05 });
  H.put('sph:6:4', '#fff6ec', 0.12, 2.27, 0.08, 0.26, 0.05, 0.18, 0, 0, 0, { grad: 0, glow: 0.35 }); // reflet
  if (!woke) for (const [x, z] of [[-0.12, 0], [0, 0], [0.12, 0], [-0.12, 0.14], [0, 0.14], [0.12, 0.14]]) H.put('sph:5:3', shade(skin, -0.32), x, 2.28 - z * 0.25, z - 0.02, 0.055, 0.03, 0.055, 0, 0, 0, { grad: 0 });
  K.eyes(E, { col: woke ? '#ffb43a' : dragon ? '#2ab878' : '#3a2a1a', glow: woke ? 0.9 : dragon ? 0.5 : 0, r: 0.095, y: 1.82, tall: 1.05 });
  K.brows(H, '#3a2a1a', { angry: 0.22, th: 0.065, w: 0.22, y: 1.95 });
  K.mouth(H, 'smile');
  // bandeau noué derrière la tête (dès le Tigre), pans qui flottent
  if (evo >= 1 && !woke) {
    const band = tiger ? '#ff9a1a' : crane ? '#d02a2a' : '#e6b422';
    H.put('rbox:0.45', band, 0, 2.02, 0.02, 1.0, 0.17, 0.93, 0, 0, 0, { grad: 0 });
    if (tiger) for (const a of [-0.5, 0, 0.5]) H.put('box', '#2a1a14', Math.sin(a) * 0.49, 2.02, Math.cos(a) * 0.46, 0.05, 0.14, 0.03, 0, a, 0, { grad: 0 });
    for (const sd of [1, -1]) HR.put('rbox:0.3', band, sd * 0.12, 1.86, -0.56, 0.12, 0.42, 0.04, 0.5, 0, sd * 0.35, { grad: 0.05 });
    HR.put('sph:6:4', band, 0, 2.02, -0.46, 0.16, 0.14, 0.12, 0, 0, 0, { grad: 0 });
  }
  if (crane) { // huppe rouge de la grue sur le crâne
    H.put('sph:7:5', '#d02a2a', 0, 2.3, 0.04, 0.3, 0.1, 0.26, 0, 0, 0, { grad: 0, glow: 0.15 });
    for (const sd of [1, -1]) for (const [y, L] of [[1.42, 0.62], [1.36, 0.48]]) feather(CH, sd * 0.44, y, -0.05, -0.15, -sd * (L > 0.55 ? 0.9 : 1.3), L);
  }
  if (dragon) { // cornes de dragon dorées sur le bandeau, petite crinière
    for (const sd of [1, -1]) { H.tip('cone:5', GOLD, sd * 0.3, 2.14, -0.06, -0.5, 0, -sd * 0.45, 0.13, 0.42, 0.13, { grad: 0.1, glow: 0.25 }); H.tip('cone:4', GOLD, sd * 0.4, 2.1, 0.0, -0.2, 0, -sd * 1.2, 0.08, 0.22, 0.08, { grad: 0, glow: 0.25 }); }
    for (let i = 0; i < 3; i++) HR.put('cone:4', JADE, 0, 2.2 - i * 0.18, -0.42 - i * 0.04, 0.16, 0.3, 0.1, -2.2, 0, 0, { grad: 0, glow: 0.3 });
  }
  if (woke) { // troisième œil, auréole dorée derrière la tête
    H.put('oct', '#ffffff', 0, 2.06, 0.45, 0.1, 0.14, 0.05, 0, 0, 0, { grad: 0, glow: 1.2 });
    HR.put('tor:0.1:4:24', GOLD, 0, 2.05, -0.5, 1.3, 1.3, 1.3, 0, 0, 0, { grad: 0, glow: 1.1 });
    HR.put('tor:0.06:4:24', '#ffffff', 0, 2.05, -0.52, 1.04, 1.04, 1.04, 0, 0, 0, { grad: 0, glow: 1.2 });
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; HR.put('cone:4', '#fff0a0', Math.cos(a) * 0.76, 2.05 + Math.sin(a) * 0.76, -0.5, 0.08, 0.2, 0.05, 0, 0, a - PI / 2, { grad: 0, glow: 1 }); }
  }
  // pans de la ceinture dans le dos (os de la cape : ils flottent quand il court) ; longs et rayés au Tigre
  const tail = tiger ? '#2a1a14' : drape;
  for (const sd of [1, -1]) CP.put('rbox:0.3', tail, sd * 0.1, 0.5 + (evo >= 1 ? -0.05 : 0), -0.32, 0.14, 0.5 + evo * 0.05, 0.04, 0.12, 0, sd * 0.12, { grad: 0.15 });
  if (tiger) for (const sd of [1, -1]) for (const y of [0.4, 0.58]) CP.put('box', '#ff9a1a', sd * 0.1, y, -0.35, 0.15, 0.05, 0.02, 0.12, 0, sd * 0.12, { grad: 0 });
  // stades : perles de jade (Dragon) ou grandes perles d'or (Éveillé) qui tournent autour de lui
  if (dragon) for (let i = 0; i < 4; i++) { const a = i / 4 * TAU; FL.put('ico', JADE, Math.cos(a) * 0.95, 1.2 + (i % 2) * 0.35, Math.sin(a) * 0.95, 0.2, 0.2, 0.2, 0, 0, 0, { grad: 0, glow: 1 }); }
  if (woke) for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; FL.put('sph:7:5', i % 3 ? GOLD : '#ffffff', Math.cos(a) * 1.0, 1.1 + Math.sin(a * 2) * 0.12, Math.sin(a) * 1.0, 0.2, 0.2, 0.2, 0, 0, 0, { grad: 0, glow: 1.1 }); }
  if (evo >= 3) CH.put('sph:6:4', ki, 0, 1.05, -0.32, 0.5, 0.5, 0.1, 0, 0, 0, { grad: 0, glow: kg }); // sceau de ki dans le dos
}

// ---------- Gestes (pose.atk : 1 au coup, décroît ; w = poids, u = avancement 0 → 1) ----------
function atkMonk(b, w, u) {
  const k = MKP.kind, right = MKP.side < 0, arm = right ? b.armR : b.armL, other = right ? b.armL : b.armR, sd = right ? 1 : -1;
  if (k === 'spin') {
    // coup final tout autour : coup de pied tournoyant
    b.body.rotation.y = TAU * smooth(u / 0.85);
    b.legR.rotation.x = lerp(b.legR.rotation.x, -1.5, w); b.legR.rotation.z = -0.3 * w;
    b.armL.rotation.z = lerp(b.armL.rotation.z, 1.2, w); b.armR.rotation.z = lerp(b.armR.rotation.z, -1.2, w);
    b.chest.rotation.x -= 0.15 * w;
    return;
  }
  if (k === 'palm' || k === 'wave') {
    // double paume poussée vers l'avant ; onde : bras grands ouverts et buste en arrière
    const s = smooth(Math.min(1, u / 0.15));
    if (k === 'palm') {
      for (const [a, sg] of [[b.armL, -1], [b.armR, 1]]) { a.rotation.x = lerp(a.rotation.x, lerp(-0.6, -1.6, s), w); a.rotation.z = lerp(a.rotation.z, sg * 0.3, w); }
      b.chest.rotation.x += 0.2 * w * s; b.legL.rotation.x = -0.3 * w; b.legR.rotation.x = 0.35 * w;
    } else {
      b.armL.rotation.z = lerp(b.armL.rotation.z, lerp(0.4, 1.5, s), w); b.armR.rotation.z = lerp(b.armR.rotation.z, lerp(-0.4, -1.5, s), w);
      b.armL.rotation.x = lerp(b.armL.rotation.x, -0.4, w); b.armR.rotation.x = lerp(b.armR.rotation.x, -0.4, w);
      b.chest.rotation.x -= 0.18 * w * s; b.head.rotation.x -= 0.15 * w;
    }
    return;
  }
  if (k === 'dragon') {
    // dragon : un bras tendu vers le ciel puis vers l'avant, l'autre en garde
    const s = smooth(Math.min(1, u / 0.3));
    b.armR.rotation.x = lerp(b.armR.rotation.x, lerp(-2.9, -1.5, s), w); b.armR.rotation.z = lerp(b.armR.rotation.z, 0.2, w);
    b.armL.rotation.x = lerp(b.armL.rotation.x, -1.0, w); b.armL.rotation.z = lerp(b.armL.rotation.z, -0.5, w);
    b.chest.rotation.y = 0.3 * w;
    return;
  }
  // coup de poing direct : le bras part vers la cible, l'autre poing revient à la hanche, les épaules tournent
  const big = k === 'big', s = smooth(Math.min(1, u / (big ? 0.18 : 0.1)));
  arm.rotation.x = lerp(arm.rotation.x, lerp(-0.5, big ? -1.75 : -1.6, s), w);
  arm.rotation.z = lerp(arm.rotation.z, sd * 0.28, w);
  other.rotation.x = lerp(other.rotation.x, 0.55, w); other.rotation.z = lerp(other.rotation.z, -sd * 0.2, w);
  b.chest.rotation.y = sd * (big ? 0.55 : 0.4) * w; b.hips.rotation.y = -sd * 0.15 * w;
  if (big) { b.chest.rotation.x += 0.22 * w; b.legL.rotation.x = lerp(b.legL.rotation.x, -0.5, w); b.legR.rotation.x = lerp(b.legR.rotation.x, 0.45, w); }
}

export const HEROES_MONK = {
  monk: { build: buildMonk, atk: atkMonk },
};
