// Effets 3D de Morgane la capitaine pirate, branchés sur Fx (fx.js) par deux appels : eventPir (ultime, salves, impacts
// de la Bordée) et framePir (chaque image : balles et éclairs des pistolets, sabre qui balaie et vagues de la Lame des
// marées, canon posé, boulets qui roulent et boulets ramés, perroquets et aras, boulets de la Bordée en vol).
// L'état des armes est lu dans PIRS (js/arsenal-pirate.js), celui de l'ultime dans run.pirU (js/champion-pirate.js), les
// effets ponctuels dans run.fx (types 'pir…' et 'slash' marqués pir). Groupes d'instances créés au premier besoin et
// confiés à fx (begin / end / dispose). Ne modifie jamais la partie (seulement gfx.hs et POSE : geste du héros).
import { THREE, S, TAU, rand, clamp, col, Build, G, T, lowpoly, Pool } from './kit.js';
import { PIRS, PIRW } from '../arsenal-pirate.js';
import { PIRB } from '../champion-pirate.js';
import { POSE } from './models-hero-pirate.js';

const IDS = new Set(['pistols', 'cutlass', 'cannon', 'parrot']);
const W = '#ffffff', GOLD = '#ffc23a', IRON = '#2a2a34', FIRE = '#ffb04a', SMOKE = '#8a847e', SEA = '#2ab8ff', FOAM = '#c8fbff', WOOD = '#7a4a26';
const PI = Math.PI;

function addPool(fx, build, cap, mat = lowpoly(), o = {}) { const b = new Build(23); build(b); const P = new Pool(fx.root, b.geo(), mat, cap, o); fx.pools.push(P); return P; }
// aile de perroquet (côté sd : +1 gauche = +Z, −1 droite) : plumes en éventail, couleurs de l'intérieur vers le bout
function wingGeo(b, sd, cols) {
  for (let i = 0; i < 4; i++) b.add(G.box(0.62 - i * 0.1, 0.06, 0.3), cols[Math.min(i, cols.length - 1)], T(-0.12 - i * 0.06, 0, sd * (0.16 + i * 0.22), 1, 1, 1, 0, sd * (0.15 + i * 0.12), 0));
}
// perroquet (face à +X) : corps, tête à joue blanche, bec crochu, longue queue
function birdGeo(b, body, belly, tail, beak) {
  b.add(G.sph(0.5, 7, 5), body, T(0, 0, 0, 1.25, 0.82, 0.8));
  b.add(G.sph(0.4, 7, 5), belly, T(0.12, -0.12, 0, 0.9, 0.6, 0.62));
  b.add(G.sph(0.36, 7, 5), body, T(0.52, 0.28, 0));
  for (const z of [0.15, -0.15]) { b.add(G.sph(0.12, 5, 4), W, T(0.66, 0.3, z)); b.add(G.sph(0.06, 4, 3), '#141014', T(0.72, 0.34, z * 1.2)); }
  b.add(G.cone(0.14, 0.32, 5), beak, T(0.84, 0.18, 0, 1, 1, 0.8, 0, 0, -PI / 2 - 0.5));
  b.add(G.box(0.9, 0.06, 0.2), tail, T(-0.9, -0.06, 0, 1, 1, 1, 0, 0, 0.18));
  b.add(G.box(0.7, 0.05, 0.14), body, T(-0.8, -0.02, 0.1, 1, 1, 1, 0, 0.15, 0.16));
}
// modèles (unités 3D, face à +X), créés au premier besoin
const MK = {
  ball: fx => addPool(fx, b => { b.add(G.ico(0.5, 1), IRON, T(), 0.05); b.add(G.ico(0.16, 0), '#7a7a88', T(0.2, 0.26, 0.18)); b.add(G.cyl(0.06, 0.06, 0.2, 5), '#c8a070', T(0, 0.52, 0)); }, 40),
  // petit canon de pont : affût de bois, 2 roues de chaque côté, fût de fonte cerclé d'or
  cannon: fx => addPool(fx, b => {
    b.add(G.box(1.3, 0.34, 0.8), WOOD, T(-0.1, 0.38, 0));
    b.add(G.box(0.5, 0.3, 0.8), '#5a3418', T(-0.55, 0.62, 0));
    for (const x of [0.32, -0.5]) for (const z of [0.46, -0.46]) { b.add(G.cyl(0.3, 0.3, 0.1, 8), '#5a3418', T(x, 0.3, z, 1, 1, 1, PI / 2, 0, 0)); b.add(G.cyl(0.09, 0.09, 0.14, 5), GOLD, T(x, 0.3, z, 1, 1, 1, PI / 2, 0, 0)); }
    b.add(G.cyl(0.26, 0.34, 1.6, 8), IRON, T(0.25, 0.78, 0, 1, 1, 1, 0, 0, -PI / 2 + 0.12));
    b.add(G.cyl(0.32, 0.32, 0.12, 8), GOLD, T(1.0, 0.86, 0, 1, 1, 1, 0, 0, -PI / 2 + 0.12));
    b.add(G.cyl(0.37, 0.37, 0.1, 8), GOLD, T(-0.3, 0.72, 0, 1, 1, 1, 0, 0, -PI / 2 + 0.12));
    b.add(G.sph(0.28, 6, 4), IRON, T(-0.56, 0.7, 0));
  }, 6),
  // sabre d'abordage (lame courbe le long de +X, garde dorée, poignée sombre)
  sabre: fx => addPool(fx, b => {
    for (let i = 0; i < 4; i++) b.add(G.box(0.42, 0.06, 0.16 - i * 0.02), i === 3 ? '#ffffff' : '#dfe6f0', T(0.45 + i * 0.38, 0, 0.02 * i * i, 1, 1, 1, 0, -0.08 * i, 0));
    b.add(G.cone(0.08, 0.26, 4), '#ffffff', T(2.0, 0, 0.2, 1, 1, 0.6, PI / 2, 0, -PI / 2 - 0.4));
    b.add(G.sph(0.22, 6, 4), GOLD, T(0.14, 0, 0, 0.6, 1, 1.2));
    b.add(G.box(0.36, 0.1, 0.1), '#2a1a12', T(-0.14, 0, 0));
    b.add(G.sph(0.08, 5, 4), GOLD, T(-0.34, 0, 0));
  }, 4),
  sabreE: fx => addPool(fx, b => { // Lame des marées : lame d'écume bleutée
    for (let i = 0; i < 4; i++) b.add(G.box(0.46, 0.07, 0.2 - i * 0.02), i === 3 ? '#ffffff' : '#bff4ff', T(0.48 + i * 0.42, 0, 0.025 * i * i, 1, 1, 1, 0, -0.08 * i, 0));
    b.add(G.sph(0.24, 6, 4), '#3ac8ff', T(0.14, 0, 0, 0.6, 1, 1.2));
    b.add(G.box(0.36, 0.1, 0.1), '#0e2a3a', T(-0.14, 0, 0));
  }, 4, new THREE.MeshBasicMaterial({ vertexColors: true })),
  bird: fx => addPool(fx, b => birdGeo(b, '#e8283a', '#ff5a4a', '#2a6ae8', '#f4ecd8'), 4),
  wingL: fx => addPool(fx, b => wingGeo(b, 1, ['#e8283a', '#ffd23a', '#2a6ae8', '#1a4ab8']), 4),
  wingR: fx => addPool(fx, b => wingGeo(b, -1, ['#e8283a', '#ffd23a', '#2a6ae8', '#1a4ab8']), 4),
  ara: fx => addPool(fx, b => birdGeo(b, '#ffc81a', '#fff0a0', '#22d8c0', '#2a2a34'), 4),
  araL: fx => addPool(fx, b => wingGeo(b, 1, ['#ffc81a', '#22e8c8', '#1a9ad8', '#ffffff']), 4),
  araR: fx => addPool(fx, b => wingGeo(b, -1, ['#ffc81a', '#22e8c8', '#1a9ad8', '#ffffff']), 4),
  // navire de la Bordée (coque le long de Z, proue vers −Z) : coque, château arrière, sabords, deux mâts, voiles, pavillon noir
  galleon: fx => addPool(fx, b => {
    const H0 = '#5a3218', H1 = '#7a4a26';
    b.add(G.box(2.4, 1.1, 7.2), H0, T(0, 0.55, 0));
    b.add(G.box(1.6, 0.6, 6.4), '#3a2010', T(0, -0.2, 0.1));
    b.add(G.cone(1.25, 2.2, 4), H0, T(0, 0.6, -4.6, 1, 0.9, 1, -PI / 2, PI / 4, 0));
    b.add(G.box(2.5, 0.16, 7.3), GOLD, T(0, 0.9, 0));
    b.add(G.box(2.2, 0.12, 7.0), '#c8a070', T(0, 1.12, 0));
    b.add(G.box(2.5, 1.0, 1.8), H1, T(0, 1.6, 2.7));
    b.add(G.box(2.6, 0.12, 1.9), GOLD, T(0, 2.12, 2.7));
    for (const x of [1.22, -1.22]) for (let i = 0; i < 4; i++) b.add(G.box(0.08, 0.3, 0.36), '#141014', T(x, 0.5, -2.2 + i * 1.3));
    for (const [z, h] of [[-1.4, 6.2], [1.2, 5.2]]) {
      b.add(G.cyl(0.12, 0.16, h, 6), H1, T(0, 1.1 + h / 2, z));
      for (const [y, w] of [[0.5, 2.6], [0.78, 2.0]]) b.add(G.box(w, h * 0.24, 0.12), '#f4f0e6', T(0, 1.1 + h * y, z, 1, 1, 1, 0.12, 0, 0));
      b.add(G.box(0.08, 0.5, 0.9), '#141014', T(0, 1.4 + h, z - 0.45));
      b.add(G.sph(0.16, 5, 4), '#f4f0e6', T(0.06, 1.42 + h, z - 0.45));
    }
    b.add(G.cyl(0.07, 0.1, 2.4, 5), H1, T(0, 1.2, -5.4, 1, 1, 1, -1.1, 0, 0));
  }, 1),
};
const get = (st, fx, k) => st[k] || (st[k] = MK[k](fx));
// aile qui bat : base (avant, haut, côté) tournée de roll autour de l'axe du corps (cap a), échelle k
function putWing(P, X, Y, Z, a, roll, k) {
  const ca = Math.cos(a), sa = Math.sin(a), cr = Math.cos(roll), sr = Math.sin(roll);
  // X local = cap (ca, 0, sa) ; Y local = haut tourné ; Z local = côté (−sa, 0, ca) tourné
  P.putB(X, Y, Z, ca * k, 0, sa * k, -sa * sr * k, cr * k, ca * sr * k, -sa * cr * k, -sr * k, ca * cr * k);
}
// croissant d'écume (vague de la Lame des marées) au point (x, y), tourné vers a
function crescent(fx, x, y, a, R, al, big) {
  const cx = x - Math.cos(a) * R, cy = y - Math.sin(a) * R, arc = big ? 1.9 : 1.6;
  fx.ringAt(cx, cy, R, SEA, 0.75 * al, 0.3, 0, arc / TAU, a - arc / 2, 0, 0, 0.6, true, 0.5);
  fx.ringAt(cx, cy, R * 1.06, FOAM, 0.9 * al, 0.12, 0, arc / TAU, a - arc / 2, 0, 0, 0.9, true, 0.55);
  fx.ringAt(cx, cy, R * 0.9, '#0a4a8a', 0.35 * al, 0.2, 0, arc / TAU, a - arc / 2, 0, 0, 0, false, 0.08);
}

// ---------- Armes en cours ----------
const DRAW = {
  pistols(fx, st, w, s) {
    const E = w.evo, c = E ? '#ffd23a' : '#ffe8b0';
    for (const b of s.aux) { // balles traçantes
      const ca = Math.cos(b.a), sa = Math.sin(b.a), X = b.x * S, Y = 1.4, Z = b.y * S, L = E ? 36 : 26;
      fx.line(X, Y, Z, (b.x - ca * L) * S, Y, (b.y - sa * L) * S, E ? 0.42 : 0.3, E ? '#ffb01a' : '#ffc870', 0.7);
      fx.line(X, Y, Z, (b.x - ca * L * 0.5) * S, Y, (b.y - sa * L * 0.5) * S, 0.12, W, 1);
      fx.glow(b.x, b.y, 28, E ? 10 : 7, c, 0.85);
    }
  },
  cutlass(fx, st, w, s, t) {
    for (const b of s.aux) { // vagues tranchantes
      const al = clamp(b.life / 0.15, 0, 1) * clamp((b.max - b.life) / 0.08, 0, 1);
      crescent(fx, b.x, b.y, b.a, PIRW.waveW, al, true);
      if (Math.random() < 0.5 && fx.stars.length < 300) fx.stars.push({ x: b.x + rand(-20, 20), y: b.y + rand(-20, 20), z: rand(6, 26), vx: -b.vx * 0.15, vy: -b.vy * 0.15, vz: 40, life: 0.35, max: 0.35, c: FOAM, s: 1 });
      fx.shadow(b.x, b.y, 50, 0.15);
    }
  },
  cannon(fx, st, w, s, t) {
    const E = w.evo, B = get(st, fx, 'ball');
    for (const b of s.list) {
      if (E) { // boulets ramés : deux boulets qui tournoient autour de la chaîne
        const d = PIRW.chainW * 0.82, ox = Math.cos(b.spin) * d, oy = Math.sin(b.spin) * d * 0.9, h = 14;
        B.put((b.x + ox) * S, h * S, (b.y + oy) * S, b.spin, 0.95); B.put((b.x - ox) * S, h * S, (b.y - oy) * S, -b.spin, 0.95);
        for (let i = 0; i < 4; i++) { const f0 = i / 4 - 0.5, f1 = f0 + 0.25; fx.line((b.x + ox * f0 * 2) * S, (h + 2) * S, (b.y + oy * f0 * 2) * S, (b.x + ox * f1 * 2) * S, (h + 2) * S, (b.y + oy * f1 * 2) * S, 0.16, i % 2 ? '#6a6a78' : '#4a4a58', 1); }
        fx.ringAt(b.x, b.y, d, '#c8c8d8', 0.35, 0.12, 0, 0.32, b.spin + PI * 0.68, 0, 0, 0.3, true, 0.7);
        fx.ringAt(b.x, b.y, d, '#c8c8d8', 0.35, 0.12, 0, 0.32, b.spin - PI * 0.32, 0, 0, 0.3, true, 0.7);
        fx.shadow(b.x, b.y, 50, 0.22);
      } else { // boulet qui roule, mèche allumée
        B.put(b.x * S, 0.45, b.y * S, b.spin, 0.95);
        fx.shadow(b.x, b.y, 22, 0.35);
        fx.glow(b.x, b.y, 22, 8 + Math.random() * 4, FIRE, 0.9);
        if (Math.random() < 0.3) fx.sparkle(b.x + rand(-3, 3), b.y, 22, '#ffd27a');
      }
      if (Math.random() < 0.35 && fx.puffs.length < 200) fx.puffs.push({ x: b.x - Math.cos(b.a) * 14, y: b.y - Math.sin(b.a) * 14, z: 4, vx: 0, vy: 0, vz: 12, s: rand(5, 8), life: 0.45, max: 0.45, a: 0.4, c: '#c8b8a0' });
    }
  },
  parrot(fx, st, w, s, t) {
    const E = w.evo, Bd = get(st, fx, E ? 'ara' : 'bird'), WL = get(st, fx, E ? 'araL' : 'wingL'), WR = get(st, fx, E ? 'araR' : 'wingR'), k = E ? 0.95 : 0.85;
    for (const q of s.list) {
      const X = q.x * S, Y = q.z * S, Z = q.y * S, dive = q.m === 1, fl = dive ? 0.25 + Math.sin(t * 12 + q.id) * 0.15 : Math.sin(t * (q.m === 2 ? 26 : 18) + q.id * 2) * 0.75;
      const nod = q.peck * 0.5, a = q.a;
      Bd.putB(X, Y, Z, Math.cos(a) * Math.cos(nod) * k, -Math.sin(nod) * k, Math.sin(a) * Math.cos(nod) * k, Math.cos(a) * Math.sin(nod) * k, Math.cos(nod) * k, Math.sin(a) * Math.sin(nod) * k, -Math.sin(a) * k, 0, Math.cos(a) * k);
      putWing(WL, X, Y + 0.12, Z, a, -fl - (dive ? 0.5 : 0), k);
      putWing(WR, X, Y + 0.12, Z, a, fl + (dive ? 0.5 : 0), k);
      fx.shadow(q.x, q.y, 18, 0.22);
      if (E) fx.glow(q.x, q.y, q.z, 16, '#ffd23a', 0.3);
      if (dive && Math.random() < 0.3 && fx.stars.length < 300) fx.stars.push({ x: q.x, y: q.y, z: q.z, vx: 0, vy: 0, vz: 10, life: 0.3, max: 0.3, c: E ? '#22e8c8' : '#ff5a4a', s: 0.8 });
    }
  },
};

// ---------- Effets ponctuels (run.fx 'pir…', 'slash' marqué pir) ----------
const FX = {
  pirAtk(fx, f) { const hs = fx.gfx.hs; if (!f.g_e && hs && hs.atk < 0.6) { f.g_e = 1; hs.atk = 1; hs.atkA = f.a; POSE.k = f.k; POSE.set = true; } },
  // éclair de bouche et fumée du pistolet
  pirShot(fx, f, k) {
    const ca = Math.cos(f.a), sa = Math.sin(f.a), x = f.x + ca * 12, y = f.y + sa * 12, a = 1 - k;
    fx.glow(x, y, 30, 22 * (0.6 + a), f.evo ? '#ffd23a' : '#ffc870', a);
    fx.star(x, y, 30, 10 * a + 4, W, a);
    if (!f.g_e) { f.g_e = 1; for (let i = 0; i < 2 && fx.puffs.length < 200; i++) fx.puffs.push({ x: x + ca * 8, y: y + sa * 8, z: 30, vx: ca * 40, vy: sa * 40, vz: 20, s: rand(5, 8), life: 0.4, max: 0.4, a: 0.45, c: '#d8d0c8' }); }
  },
  // estocade : trait de lumière droit devant, étoile au bout
  pirThrust(fx, f, k, st) {
    const ca = Math.cos(f.a), sa = Math.sin(f.a), L = f.len * Math.min(1, k * 4), a = 1 - k, Y = 1.2;
    fx.line((f.x + ca * 14) * S, Y, (f.y + sa * 14) * S, (f.x + ca * L) * S, Y, (f.y + sa * L) * S, 1.2 * a, f.evo ? SEA : GOLD, 0.6 * a);
    fx.line((f.x + ca * 14) * S, Y, (f.y + sa * 14) * S, (f.x + ca * L) * S, Y, (f.y + sa * L) * S, 0.35 * a, W, a);
    fx.star(f.x + ca * L, f.y + sa * L, 24, 14 * a + 4, W, a);
    if (k < 0.6) get(st, fx, f.evo ? 'sabreE' : 'sabre').put((f.x + ca * (L * 0.45)) * S, Y, (f.y + sa * (L * 0.45)) * S, -f.a, 1.25);
  },
  // petit canon de pont : surgit, tire (éclair, fumée, recul), puis s'enfonce
  pirCannon(fx, f, k, st) {
    const C = get(st, fx, 'cannon'), ca = Math.cos(f.a), sa = Math.sin(f.a);
    const pop = clamp(k / 0.1, 0, 1), sink = clamp((k - 0.75) / 0.25, 0, 1), rec = k < 0.12 ? 0 : Math.sin(clamp((k - 0.12) / 0.3, 0, 1) * PI) * 10;
    const x = f.x - ca * rec, y = f.y - sa * rec, sc = (f.evo ? 1.3 : 1.1) * (0.4 + 0.6 * pop) * (1 - 0.6 * sink);
    C.put(x * S, -sink * 0.6, y * S, -f.a, sc);
    fx.shadow(x, y, 34 * sc, 0.3);
    if (k > 0.1 && k < 0.3) { const mx = x + ca * 26 * sc, my = y + sa * 26 * sc, a = 1 - (k - 0.1) / 0.2; fx.glow(mx, my, 18 * sc, 46 * a, '#ffb04a', a); fx.star(mx, my, 18 * sc, 18 * a, W, a); }
    if (k > 0.1 && !f.g_e) {
      f.g_e = 1;
      const mx = f.x + ca * 28, my = f.y + sa * 28;
      for (let i = 0; i < 6 && fx.puffs.length < 200; i++) fx.puffs.push({ x: mx + rand(-6, 6), y: my + rand(-6, 6), z: 18, vx: ca * rand(40, 110) + rand(-20, 20), vy: sa * rand(40, 110) + rand(-20, 20), vz: rand(15, 40), s: rand(8, 13), life: 0.7, max: 0.7, a: 0.55, c: '#d8d0c8' });
      fx.ring(mx, my, 6, 40, '#ffd27a', 5, 0.25);
      fx.gfx.kick = Math.max(fx.gfx.kick || 0, 3);
    }
    if (!f.g_in) { f.g_in = 1; fx.puff(f.x, f.y, 4, 14, 0.5, '#c8b8a0'); }
  },
  // explosion d'un boulet
  pirBoom(fx, f, k) {
    if (f.g_e) return;
    f.g_e = 1;
    const R = f.R;
    fx.decal(f.x, f.y, R * 0.7, '#1a1010', 0.45);
    fx.bursts.push({ x: f.x, y: f.y, h: 8, r: R * 1.5, t: 0, max: 0.35, c: f.evo ? '#ffd27a' : FIRE });
    fx.ring(f.x, f.y, 10, R * 1.15, '#ff8a2a', 8, 0.35); fx.ring(f.x, f.y, 6, R * 0.7, W, 5, 0.25);
    fx.puff(f.x, f.y, 7, R * 0.5, 0.8, '#5a524c');
    fx.rockBurst(f.x, f.y, 4, '#4a3a32', 180);
    fx.burstStars(f.x, f.y, 12, f.evo ? 10 : 6, '#ffb04a', 260);
  },
  // coup de bec : plumes et petite étoile
  pirPeck(fx, f, k) {
    const a = 1 - k;
    fx.star(f.x, f.y, f.z, 9 * a + 3, W, a);
    if (!f.g_e) { f.g_e = 1; for (let i = 0; i < 3 && fx.stars.length < 300; i++) { const an = Math.random() * TAU; fx.stars.push({ x: f.x, y: f.y, z: f.z, vx: Math.cos(an) * 80, vy: Math.sin(an) * 60, vz: 60, g: 200, life: 0.4, max: 0.4, c: f.evo ? (i ? '#22e8c8' : '#ffd23a') : (i ? '#ff3a4a' : '#2a6ae8'), s: 1.1 }); } }
  },
  // pièce d'or rapportée par un ara : vole de la victime vers Morgane
  pirCoin(fx, f, k) {
    const p = fx.run.p, e = k * k * (3 - 2 * k), x = f.x + (p.x - f.x) * e, y = f.y + (p.y - f.y) * e, h = f.z + Math.sin(k * PI) * 60 + (40 - f.z) * e;
    fx.glow(x, y, h, 12, '#ffd23a', 0.9); fx.star(x, y, h, 6, '#fff0a0', 1);
    if (k > 0.9 && !f.g_e) { f.g_e = 1; fx.burstStars(p.x, p.y, 40, 3, '#ffd23a', 120); }
  },
};
// coup de sabre : le sabre balaie l'arc du croissant ('slash' de fx.js) à hauteur de main
function sabreSlash(fx, f, k, st) {
  const P = get(st, fx, f.evo ? 'sabreE' : 'sabre');
  if (!f.g_p) { f.g_p = 1; POSE.k = f.pir === 2 ? 6 : 3; POSE.set = true; }
  if (k > 0.55) return;
  const a = f.a - 1.3 + 2.6 * Math.min(1, k * 2.2), r = 12;
  P.put((f.x + Math.cos(a) * r) * S, 1.25, (f.y + Math.sin(a) * r) * S, -a, (f.r / 98) * 1.25);
}

// ---------- Bordée (run.pirU) : navire au bord de l'écran, boulets en vol, cibles au sol ----------
// le navire vole à PIRB.alt du sol, à PIRB.side de Morgane (côté sh.side) : il arrive, tire ses salves (il roule), repart
function ship(fx, st, dt, t) {
  const sh = st.ship, p = fx.run.p, B = PIRB.broadside;
  sh.t += dt; sh.roll = Math.max(0, sh.roll - dt * 2.5);
  if (sh.out) sh.out += dt;
  const inK = clamp(sh.t / 0.45, 0, 1), outK = clamp(sh.out / 0.7, 0, 1);
  if (outK >= 1 || sh.t > 6) { st.ship = null; return; }
  const off = (1 - inK * inK * (3 - 2 * inK)) * 260 + outK * outK * 300, x = p.x - sh.side * (B.side + off), y = p.y + 20, h = B.alt + Math.sin(t * 2) * 6;
  const P = get(st, fx, 'galleon'), r = Math.sin(sh.t * 18) * sh.roll * 0.12 * sh.side, k = 1.05;
  // coque penchée (roulis) : base X = côté, Y = haut, Z = longueur
  P.putB(x * S, h * S, y * S, Math.cos(r) * k, Math.sin(r) * k, 0, -Math.sin(r) * k, Math.cos(r) * k, 0, 0, 0, k);
  fx.shadow(x, y, 100, 0.3);
  for (let i = 0; i < 3; i++) fx.glow(x + rand(-50, 50), y + rand(-80, 80), h - 10, 40, '#e8f4ff', 0.12); // nuées sous la coque
  sh.x = x; sh.y = y; sh.h = h;
}
function broadside(fx, st, U, t) {
  const B = get(st, fx, 'ball');
  for (const b of U.balls) {
    if (!b.on || b.t < 0) continue;
    const h0 = PIRB.broadside.alt + 30, k = clamp(b.t / b.dur, 0, 1), x = b.sx + (b.x - b.sx) * k, y = b.sy + (b.y - b.sy) * k, h = h0 * (1 - k) + Math.sin(k * PI) * 210;
    B.put(x * S, h * S, y * S, t * 6 + b.x, 0.85);
    fx.glow(x, y, h, 16, FIRE, 0.8);
    const k0 = Math.max(0, k - 0.06), x0 = b.sx + (b.x - b.sx) * k0, y0 = b.sy + (b.y - b.sy) * k0, hp = h0 * (1 - k0) + Math.sin(k0 * PI) * 210; // traînée de feu
    fx.line(x * S, h * S, y * S, x0 * S, hp * S, y0 * S, 0.7, '#ff7a2a', 0.6);
    if (Math.random() < 0.4 && fx.puffs.length < 200) fx.puffs.push({ x, y, z: h, vx: 0, vy: 0, vz: 10, s: rand(6, 9), life: 0.5, max: 0.5, a: 0.4, c: '#a8a098' });
    // cible au sol : anneau rouge qui se resserre, ombre qui grandit
    const R = PIRB.broadside.R * fx.run.p.area, w = clamp((k - 0.2) / 0.8, 0, 1);
    fx.ringAt(b.x, b.y, R, '#ff3a3a', 0.15 + 0.55 * w, 0.06, 0.1 + 0.25 * w * w, 1, 0, 0, 0, 0.3, false, 0.08);
    fx.ringAt(b.x, b.y, R * 0.18, '#ff5a3a', 0.4 + 0.5 * w, 0.4, 0.6, 1, 0, 0, 0, 0.5, false, 0.09);
    fx.shadow(b.x, b.y, 14 + 30 * k, 0.15 + 0.3 * k);
  }
}

// renvoie true si l'événement est entièrement traité ici (fx.js ne fait alors rien de plus)
export function eventPir(fx, ev) {
  const p = fx.run.p, ov = fx.gfx.overlay;
  switch (ev.type) {
    case 'ult':
      if (ev.kind !== 'broadside') return false;
      // « Feu ! » : le sabre levé, anneaux dorés, halo orange
      fx.ring(p.x, p.y, 20, 180, GOLD, 8, 0.5); fx.ring(p.x, p.y, 20, 240, W, 6, 0.55, -0.1);
      fx.halo('#ffb04a', 2);
      { const hs = fx.gfx.hs; if (hs) { hs.atk = 1; POSE.k = 4; POSE.set = true; } }
      (fx.pir ||= {}).ship = { side: fx.run.pirU?.side || 1, t: 0, out: 0, roll: 0 };
      return true;
    case 'pirVolley': { // salve : le navire roule, éclairs et fumée à ses sabords
      const sh = fx.pir?.ship, ex = sh?.x ?? ev.x, ey = sh?.y ?? ev.y, h = (sh?.h ?? 140) + 12, B = PIRB.broadside;
      if (sh) sh.roll = 1;
      for (let i = 0; i < 4; i++) {
        const y = ey + (i - 1.5) * B.hull * 0.6, x = ex + ev.side * 34;
        fx.glow(x, y, h, 50, '#ffb04a', 0.95); fx.star(x, y, h, 22, W, 1);
        for (let j = 0; j < 2 && fx.puffs.length < 200; j++) fx.puffs.push({ x: x + ev.side * rand(10, 40), y: y + rand(-10, 10), z: h, vx: ev.side * rand(40, 90), vy: rand(-15, 15), vz: rand(5, 25), s: rand(12, 18), life: 0.9, max: 0.9, a: 0.6, c: '#e0d8d0' });
      }
      fx.gfx.kick = Math.max(fx.gfx.kick || 0, 4);
      if (ov) { ov.flashA = Math.max(ov.flashA || 0, 0.18); ov.flashC = '255,200,120'; }
      return true;
    }
    case 'pirImpact': {
      fx.decal(ev.x, ev.y, ev.R * 0.8, '#1a1010', 0.5);
      fx.bursts.push({ x: ev.x, y: ev.y, h: 10, r: ev.R * 1.6, t: 0, max: 0.4, c: FIRE });
      fx.ring(ev.x, ev.y, 10, ev.R * 1.3, '#ff7a2a', 10, 0.4); fx.ring(ev.x, ev.y, 6, ev.R * 0.8, W, 6, 0.3);
      fx.puff(ev.x, ev.y, 8, ev.R * 0.55, 0.85, '#4a4240');
      fx.rockBurst(ev.x, ev.y, 6, '#4a3a32', 240);
      fx.burstStars(ev.x, ev.y, 14, 8, '#ffb04a', 300);
      return true;
    }
    case 'pirEnd': { const sh = fx.pir?.ship; if (sh && !sh.out) sh.out = 0.001; return true; }
  }
  return false;
}

export function framePir(fx, dt) {
  const run = fx.run, p = run.p, t = fx.gfx.t;
  let st = fx.pir;
  for (const w of p.weapons) {
    if (!IDS.has(w.id)) continue;
    const s = PIRS.get(w);
    if (!s || s.stage !== run.stage) continue;
    st = st || (fx.pir = {});
    DRAW[w.id](fx, st, w, s, t, dt);
  }
  if (run.pirU) { st = st || (fx.pir = {}); broadside(fx, st, run.pirU, t); }
  if (st?.ship) ship(fx, st, dt, t);
  if (!st) return;
  for (const f of run.fx) {
    if (f.type === 'slash') { if (f.pir) sabreSlash(fx, f, clamp(1 - f.life / f.max, 0, 1), st); continue; }
    const d = f.type.charCodeAt(0) === 112 && f.type.charCodeAt(1) === 105 && f.type.charCodeAt(2) === 114 ? FX[f.type] : null; // 'pir…'
    if (d) d(fx, f, clamp(1 - f.life / f.max, 0, 1), st);
  }
}
