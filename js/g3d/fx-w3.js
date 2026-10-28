// Effets 3D de l'arsenal W3 (js/arsenal-w3.js), branchés sur Fx (fx.js) par un seul appel chaque image (frameW3) :
// haches de guerre de Ragnar (elles tournoient en cloche et se plantent), ondes du cri de guerre, failles du séisme (rochers
// qui jaillissent, lave), tourbillon (Ragnar tourne, haches et vent) ; fouets de ronces de Gaïa (lianes épineuses, poison),
// esprits de la forêt (feux follets), nuées de pétales. Les groupes d'instances sont créés au premier besoin et confiés à fx
// (begin / end / dispose) ; l'état des armes est lu dans W3S, les effets ponctuels dans run.fx (types 'w3…'). Ne modifie
// jamais la partie (seulement gfx.hs : geste d'attaque du héros, rotation du tourbillon).
import { THREE, S, TAU, rand, clamp, backOut, col, Build, G, T, lowpoly, Pool } from './kit.js';
import { W3S, W3B } from '../arsenal-w3.js';

const W = '#ffffff', STEEL = '#c8d0dc', WOOD = '#8a5a32', BLUE = '#3a8ae0', EMBER = '#ff8a2a', GOLD = '#ffd54a';
const LEAF = '#7ad04a', VINE = '#2e6a1e', PINK = '#ff9ad8', POISON = '#9aff4a', SPIRIT = '#8affd0';
const PI = Math.PI;
const fract = v => v - Math.floor(v);

function addPool(fx, build, cap, mat = lowpoly(), o = {}) { const b = new Build(13); build(b); const P = new Pool(fx.root, b.geo(), mat, cap, o); fx.pools.push(P); return P; }
function basicV(fx) { const m = new THREE.MeshBasicMaterial({ vertexColors: true }); fx.mats.push(m); return m; }
// modèles (créés au premier besoin)
const MK = {
  // hache de guerre de Ragnar (face à +X : manche vers -X, fer en croissant vers +Y, pointe vers -Y) ; elle tourne autour de Z
  axe: fx => addPool(fx, b => {
    b.add(G.box(1.55, 0.12, 0.12), WOOD, T(-0.2, 0, 0));
    for (const x of [-0.05, -0.55]) b.add(G.box(0.13, 0.15, 0.15), BLUE, T(x, 0, 0));
    b.add(G.box(0.18, 0.17, 0.17), '#5a3418', T(-0.95, 0, 0));
    b.add(G.box(0.26, 0.34, 0.18), '#8a96a8', T(0.5, 0, 0));
    b.add(G.cyl(0.56, 0.56, 0.09, 10, 1, false, -PI / 2, PI), STEEL, T(0.5, 0.12, 0, 1.1, 1, 1.25, -PI / 2, 0, 0));
    b.add(G.cyl(0.6, 0.6, 0.05, 10, 1, false, -PI / 2 + 0.3, PI - 0.6), W, T(0.5, 0.12, 0, 1.1, 1, 1.25, -PI / 2, 0, 0));
    b.add(G.cone(0.13, 0.42, 4), '#a8b0c0', T(0.5, -0.32, 0, 1, 1, 1, PI, 0, 0));
  }, 24),
  // rochers de la faille (jaillissent du sol) : éclats de pierre, pointe claire
  rock: fx => addPool(fx, b => {
    const c = (x, y) => (y > 0.75 ? '#c8b8a0' : y > 0.35 ? '#7a6a5a' : '#4a3a30');
    b.add(G.cone(0.34, 1.25, 5), c, T(0, 0.55, 0), 0.12, 0.12);
    b.add(G.cone(0.22, 0.8, 4), c, T(0.26, 0.32, 0.1, 1, 1, 1, 0.2, 0, -0.5), 0.12, 0.1);
    b.add(G.dode(0.26), '#5a4a3e', T(-0.22, 0.12, -0.08), 0.12, 0.2);
  }, 140),
  // épine de ronce (pointe vers +X), petite feuille au pied
  thorn: fx => addPool(fx, b => {
    b.add(G.cone(0.13, 0.55, 4), (x, y, z) => (x > 0.15 ? '#d8e8a0' : '#5a7a2a'), T(0.22, 0, 0, 1, 1, 1, 0, 0, -PI / 2), 0.08);
    b.add(G.sph(0.17, 5, 3), LEAF, T(-0.05, 0.05, 0.12, 1.4, 0.4, 0.8), 0.1);
  }, 200),
  // bouton de fleur au bout du fouet
  bud: fx => addPool(fx, b => {
    for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; b.add(G.sph(0.22, 5, 3), '#ff7ab8', T(Math.cos(a) * 0.2, 0, Math.sin(a) * 0.2, 1.2, 0.45, 0.8, 0, -a, 0), 0.08); }
    b.add(G.sph(0.14, 5, 3), '#ffe48a', T(0, 0.08, 0));
  }, 16),
  // pétale (ovale plat, blanc : teinté par instance, non éclairé : couleurs vives)
  petal: fx => addPool(fx, b => { b.add(G.sph(0.5, 6, 3), W, T(0, 0, 0, 1, 0.14, 0.55), 0.04); }, 80, basicV(fx), { color: true }),
};
const get = (st, fx, k) => st[k] || (st[k] = MK[k](fx));

// hache qui tourne sur elle-même (rotation phi autour de l'axe de côté) en avançant vers (ux, uy) ; k = échelle
function axeAt(P, X, Y, Z, ux, uy, phi, k) {
  const c = Math.cos(phi) * k, s = Math.sin(phi) * k;
  // X local = c·avant + s·haut ; Y local = −s·avant + c·haut ; Z local = côté (avant × haut)
  return P.putB(X, Y, Z, ux * c, s, uy * c, -ux * s, c, -uy * s, -uy * k, 0, ux * k);
}
// hache tenue à plat (tourbillon) : manche vers l'extérieur (angle a), fer vers l'avant du mouvement
function axeFlat(P, X, Y, Z, a, k) {
  const ca = Math.cos(a) * k, sa = Math.sin(a) * k;
  return P.putB(X, Y, Z, ca, 0, sa, -sa, 0, ca, 0, -k, 0);
}

// ---------- Armes en cours ----------
const DRAW = {
  waraxe(fx, st, w, s, t) {
    const P = get(st, fx, 'axe'), E = w.evo, k = E ? 1.9 : 1.55;
    for (const q of s.list) {
      if (q.t < 0 || !q.len) continue;
      const X = q.x * S, Y = q.z * S, Z = q.y * S;
      axeAt(P, X, Y, Z, q.ux, q.uy, -q.spin, k);
      fx.glow(q.x, q.y, q.z, E ? 30 : 22, E ? '#9ad8ff' : '#ffe0b0', E ? 0.75 : 0.45); // halo : lisible sur tous les sols
      fx.shadow(q.x, q.y, 26 * k / 1.55, 0.3);
      // flou de rotation : arc de la tête de la hache derrière elle
      for (let i = 1; i <= 3; i++) {
        const ph = -q.spin + i * 0.5, r = 0.62 * k, cx = Math.cos(ph) * r, cy = Math.sin(ph) * r;
        const ph0 = ph - 0.5, cx0 = Math.cos(ph0) * r, cy0 = Math.sin(ph0) * r;
        fx.line(X + q.ux * cx0, Y + cy0, Z + q.uy * cx0, X + q.ux * cx, Y + cy, Z + q.uy * cx, 0.22 * k, E ? '#bfe8ff' : '#fff0d0', 0.5 / i);
      }
      if (E && Math.random() < 0.35 && fx.sparks.length < 190) fx.sparks.push({ x: q.x, y: q.y, z: q.z, vx: rand(-60, 60), vy: rand(-60, 60), vz: rand(-40, 60), life: 0.25, max: 0.25, c: '#bfe8ff', w: 2.4 });
    }
    // haches plantées dans le sol : manche dressé vers l'arrière, elles s'enfoncent puis disparaissent
    for (const x of s.aux) {
      const sink = clamp((x.t - 0.5) / 0.25, 0, 1), kk = k * (1 - sink * 0.3), ux = Math.cos(x.a), uy = Math.sin(x.a);
      axeAt(P, (x.x - ux * 10) * S, (0.5 - sink * 0.9) * kk, (x.y - uy * 10) * S, ux, uy, 2.1, kk);
    }
  },
  warcry(fx, st, w, s, t) {
    for (const c of s.list) {
      if (c.d < 0) continue;
      const k = c.r / c.R, a = (1 - k * k) * (c.i ? 0.75 : 1), E = c.evo;
      // front de l'onde : anneau clair épais, anneau bleu (peintures de guerre) juste derrière, tirets qui tournent
      fx.ringAt(c.x, c.y, c.r, E ? '#ffe48a' : '#fff0c8', 0.95 * a, clamp(18 / c.r, 0.03, 0.4), 0, 1, 0, 0, 0, 0.8, true, 0.11);
      fx.ringAt(c.x, c.y, c.r * 0.86, E ? '#7ad8ff' : '#5ab0ff', 0.7 * a, clamp(10 / c.r, 0.02, 0.3), 0, 1, 0, 0, 0, 0.5, true, 0.1);
      fx.ringAt(c.x, c.y, c.r * 0.7, '#ffffff', 0.35 * a, 0.03, 0, 1, t * 3, 14, 2, 0.4, true, 0.1);
      fx.ringAt(c.x, c.y, c.r, '#ffcf6a', 0.12 * a, 0.001, 1, 1, 0, 0, 0, 0, true, 0.09); // voile
      // traits du souffle (lignes radiales qui s'écartent)
      const n = E ? 14 : 10;
      for (let i = 0; i < n; i++) {
        const an = i / n * TAU + c.i * 0.3, ca = Math.cos(an), sa = Math.sin(an), r0 = c.r * 0.78, r1 = c.r * 0.98;
        fx.line((c.x + ca * r0) * S, 0.5, (c.y + sa * r0) * S, (c.x + ca * r1) * S, 0.5, (c.y + sa * r1) * S, 0.22, E ? GOLD : W, 0.7 * a);
      }
      if (c.r > 40 && Math.random() < 0.6 && fx.puffs.length < 200) {
        const an = Math.random() * TAU;
        fx.puffs.push({ x: c.x + Math.cos(an) * c.r, y: c.y + Math.sin(an) * c.r, z: 4, vx: Math.cos(an) * 90, vy: Math.sin(an) * 60, vz: 30, s: rand(7, 11), life: 0.35, max: 0.35, a: 0.4, c: '#e8dcc0' });
      }
    }
  },
  quake(fx, st, w, s, t) {
    const P = get(st, fx, 'rock'), V = W3B.quakeV, E = w.evo;
    for (const f of s.list) {
      const step = 24, n = Math.floor(f.d / step), lava = f.lava > 0, done = f.d >= f.len, fade = done ? clamp(1 - f.t / (lava ? W3B.lavaT : 0.55), 0, 1) : 1;
      let px = f.x, py = f.y;
      for (let i = 1; i <= n; i++) {
        const di = i * step, j = Math.sin(i * 12.9898 + f.seed) * f.w * 0.28, x = f.x + f.cx * di - f.cy * j, y = f.y + f.cy * di + f.cx * j;
        // fissure : sol fendu (taches sombres en zigzag), trait noir, cœur de magma (lave : plus vif et qui palpite)
        fx.ringAt(x, y, f.w * (0.3 + 0.1 * Math.sin(i * 7.3 + f.seed)), '#24140a', 0.6 * fade, 0.001, 1, 1, 0, 0, 0, 0, false, 0.066);
        fx.line(px * S, 0.08, py * S, x * S, 0.08, y * S, f.w * 0.16 * S, '#120804', 0.9 * fade);
        const glowA = lava ? (0.75 + Math.sin(t * 9 + i) * 0.25) * fade : 0.8 * fade * clamp(1 - (f.d - di) / 220 - (done ? f.t * 2 : 0), 0, 1);
        if (glowA > 0.02) fx.line(px * S, 0.1, py * S, x * S, 0.1, y * S, f.w * (lava ? 0.12 : 0.07) * S, lava ? '#ff6a1a' : EMBER, glowA);
        if (lava && i % 2 === 0) fx.ringAt(x, y, f.w * 0.26, '#ff5a1a', 0.45 * glowA, 0.001, 1, 1, 0, 0, 0, 0, true, 0.07);
        if (lava && i % 3 === 0) fx.glow(x, y, 6, f.w * 0.9, '#ff5a1a', 0.35 * fade);
        if (lava && Math.random() < 0.02 * fade && fx.sparks.length < 180) fx.sparks.push({ x, y, z: 4, vx: 0, vy: 0, vz: rand(60, 140), life: 0.5, max: 0.5, c: Math.random() < 0.5 ? '#ffb02a' : '#ff4a1a', w: 2.4 });
        // rochers qui jaillissent derrière le front, puis rentrent dans le sol
        const age = (f.d - di) / V + (done ? f.t : 0);
        if (age < 0.5) {
          const up = age < 0.09 ? backOut(age / 0.09) : 1 - (age - 0.09) / 0.41, sd = i % 2 ? 1 : -1, o = f.w * 0.22 * sd, kk = (0.9 + (i % 3) * 0.25) * (E ? 1.3 : 1.05) * Math.max(0.01, up);
          P.put((x - f.cy * o) * S, -0.3 * (1 - up), (y + f.cx * o) * S, i * 1.9 + f.seed, kk, kk * 1.15, kk);
        }
        px = x; py = y;
      }
      if (!done) { // front : poussière et cailloux
        const fx_ = f.x + f.cx * f.d, fy = f.y + f.cy * f.d;
        if (Math.random() < 0.7 && fx.puffs.length < 200) fx.puffs.push({ x: fx_ + rand(-8, 8), y: fy + rand(-6, 6), z: 4, vx: rand(-30, 30), vy: rand(-20, 20), vz: rand(30, 60), s: rand(8, 13), life: 0.45, max: 0.45, a: 0.5, c: '#c8b090' });
        fx.glow(fx_, fy, 8, 26, EMBER, 0.45);
      }
    }
  },
  whirlwind(fx, st, w, s, t) {
    const g = fx.gfx, p = fx.run.p, hs = g.hs;
    if (s.spin <= 0 || fx.run.dying) return;
    const P = get(st, fx, 'axe'), E = s.evo, R = s.R, k = clamp((s.dur - s.spin) / 0.15, 0, 1) * clamp(s.spin / 0.15, 0, 1);
    if (hs) { hs.atk = 0.62; hs.atkA = s.ang; } // Ragnar tourne sur lui-même, bras tendus
    const r = R * 0.62, kk = (E ? 1.9 : 1.6) * (0.4 + 0.6 * k);
    for (let i = 0; i < 2; i++) {
      const a = s.ang + i * PI, ca = Math.cos(a), sa = Math.sin(a), X = (p.x + ca * r) * S, Z = (p.y + sa * r) * S;
      axeFlat(P, X, 1.15, Z, a, kk);
      // traînée de la lame (arc derrière la hache)
      for (let j = 1; j <= 4; j++) {
        const a0 = a - (j - 1) * 0.32, a1 = a - j * 0.32, rr = r + 12;
        fx.line((p.x + Math.cos(a0) * rr) * S, 1.1, (p.y + Math.sin(a0) * rr) * S, (p.x + Math.cos(a1) * rr) * S, 1.1, (p.y + Math.sin(a1) * rr) * S, (E ? 0.75 : 0.55) * (1 - j * 0.18), E ? '#ffb04a' : '#e8f0ff', (0.75 - j * 0.15) * k);
      }
    }
    // vent : anneau en tirets qui tourne (portée), voile au sol, poussière au bord ; cyclone : feu, braises qui montent
    fx.ringAt(p.x, p.y, R, E ? '#ff8a2a' : '#e8f0ff', 0.75 * k, 0.05, 0, 1, -s.ang * 0.5, 9, 0, 0.5, true, 0.1);
    fx.ringAt(p.x, p.y, R * 0.8, E ? '#ffd54a' : '#bcd8ff', 0.4 * k, 0.03, 0, 1, -s.ang * 0.8 + 1, 6, 0, 0.4, true, 0.1);
    fx.ringAt(p.x, p.y, R, E ? '#ff5a1a' : '#dfe8f4', (E ? 0.16 : 0.1) * k, 0.001, 1, 1, 0, 0, 0, 0, true, 0.09);
    if (Math.random() < 0.8 && fx.puffs.length < 200) { const an = Math.random() * TAU; fx.puffs.push({ x: p.x + Math.cos(an) * R * 0.95, y: p.y + Math.sin(an) * R * 0.95, z: 4, vx: -Math.sin(an) * 140, vy: Math.cos(an) * 100, vz: 20, s: rand(7, 12), life: 0.35, max: 0.35, a: 0.45, c: E ? '#ffb070' : '#e0d8c8' }); }
    if (E) {
      fx.glow(p.x, p.y, 30, R * 0.7, '#ff6a1a', 0.35 * k);
      if (fx.sparks.length < 190) for (let i = 0; i < 2; i++) { const an = Math.random() * TAU, d = R * rand(0.4, 1); fx.sparks.push({ x: p.x + Math.cos(an) * d, y: p.y + Math.sin(an) * d, z: 6, vx: -Math.sin(an) * 120, vy: Math.cos(an) * 90, vz: rand(120, 240), life: 0.45, max: 0.45, c: Math.random() < 0.5 ? '#ffb02a' : '#ff4a1a', w: 2.6 }); }
    }
  },
  thorns(fx, st, w, s, t) {
    const p = fx.run.p, Tp = get(st, fx, 'thorn'), Bp = get(st, fx, 'bud');
    for (const v of s.list) {
      const ext = v.t < 0.15 ? v.t / 0.15 : clamp(1 - (v.t - 0.17) / 0.15, 0, 1), L = v.len * ext;
      if (L < 4) continue;
      const E = v.evo, n = Math.max(2, Math.round(L / 16)), wave = (1 - ext) * 0 + 7 * (v.t < 0.15 ? 1 - v.t / 0.15 : 0.3);
      let px = p.x + v.cx * 8, py = p.y + v.cy * 8, pz = 26;
      for (let i = 1; i <= n; i++) {
        const u = i / n, d = 8 + (L - 8) * u, off = Math.sin(u * 7 - v.t * 40) * wave * v.side * (1 - u * 0.5);
        const x = p.x + v.cx * d - v.cy * off, y = p.y + v.cy * d + v.cx * off, z = 26 - u * 16;
        fx.line(px * S, pz * S, py * S, x * S, z * S, y * S, (E ? 1.2 : 1.0) * (1 - u * 0.35), VINE, 0.95);
        fx.line(px * S, pz * S, py * S, x * S, z * S, y * S, (E ? 0.45 : 0.36) * (1 - u * 0.35), E ? '#d07aff' : '#9ae05a', 0.95);
        // épines de chaque côté, pointées vers l'extérieur
        const sd = i % 2 ? 1 : -1, a = Math.atan2(v.cy, v.cx) + sd * 1.25;
        Tp.put(x * S, z * S, y * S, -a, (E ? 1.9 : 1.6) * (1 - u * 0.3));
        if (E && i % 3 === 0) fx.glow(x, y, z, 10, '#ff7ab8', 0.6);
        px = x; py = y; pz = z;
      }
      Bp.put(px * S, pz * S, py * S, v.t * 6, E ? 1.5 : 1.2);
      fx.glow(px, py, pz, E ? 18 : 13, E ? '#ff7ad8' : '#c8ff8a', 0.7);
      fx.shadow(px, py, 12, 0.2);
    }
    // monstres empoisonnés : anneau vert au pied, bulles qui montent
    let m = 0;
    for (const o of s.aux) {
      const e = o.e;
      if (e.dead || m++ > 40) continue;
      fx.ringAt(e.x, e.y, e.r * 1.1 + 5, POISON, 0.5 * Math.min(1, o.t * 2), 0.12, 0.12, 1, e.x * 0.1, 0, 0, 0.4);
      if (Math.random() < 0.08) fx.sparkle(e.x + rand(-e.r, e.r) * 0.6, e.y, e.r * 1.5 + e.fly, Math.random() < 0.3 ? '#e0ff9a' : POISON);
    }
  },
  wisps(fx, st, w, s, t) {
    const E = w.evo, c = E ? '#ffe48a' : SPIRIT, c2 = E ? '#ffb02a' : '#4affb0';
    for (const b of s.list) {
      if (b.m === 2 && b.g <= 0.05) continue;
      const g = b.m === 2 ? b.g * 0.6 : 1, k = (E ? 1.45 : 1) * g, fl = 1 + Math.sin(t * 22 + b.ph) * 0.12;
      fx.glow(b.x, b.y, b.z, 30 * k * fl, c2, 0.6);
      fx.ringAt(b.x, b.y, 12 * k, c2, 0.5, 0.25, 0.1, 1, 0, 0, 0, 0.4, true, 0.09);
      fx.glow(b.x, b.y, b.z, 14 * k, c, 1);
      fx.star(b.x, b.y, b.z + 1, 9 * k, W, 1);
      // traînée de flamme (derrière le mouvement)
      const d = Math.hypot(b.dx, b.dy) || 1, L = (b.m === 1 ? 34 : 14) * k, ux = b.dx / d, uy = b.dy / d;
      fx.line(b.x * S, b.z * S, b.y * S, (b.x - ux * L) * S, (b.z + 4) * S, (b.y - uy * L) * S, 0.5 * k, c2, 0.55);
      fx.line(b.x * S, b.z * S, b.y * S, (b.x - ux * L * 0.55) * S, (b.z + 2) * S, (b.y - uy * L * 0.55) * S, 0.22 * k, W, 0.7);
      fx.shadow(b.x, b.y, 10 * k, 0.15);
      if (Math.random() < (E ? 0.25 : 0.12)) fx.sparkle(b.x + rand(-5, 5), b.y + rand(-4, 4), b.z + rand(-4, 4), Math.random() < 0.3 ? PINK : c);
    }
  },
  petals(fx, st, w, s, t) {
    const P = get(st, fx, 'petal'), E = w.evo, m = E ? 18 : 15;
    for (const z of s.list) {
      const R = z.R, a = z.g, sg = z.i % 2 ? -1 : 1;
      // tapis de pétales au sol, anneau rose en tirets qui tourne
      fx.ringAt(z.x, z.y, R, E ? '#ffcf6a' : PINK, 0.2 * a, 0.001, 1, 1, 0, 0, 0, 0, true, 0.08);
      fx.ringAt(z.x, z.y, R, E ? GOLD : '#ffb8e4', 0.9 * a, 0.06, 0, 1, t * 0.7 * sg, 12, 0.5 * sg, 0.5, true, 0.1);
      for (let j = 0; j < m; j++) { // pétales qui tourbillonnent en tombant (positions tirées du temps : aucun état)
        const an = t * (1.4 + fract(j * 0.37) * 0.8) * sg + j * 2.39996, rr = R * (0.2 + 0.78 * fract(j * 0.618 + z.i * 0.3)), h = 74 - (t * (38 + (j % 4) * 6) + j * 17.3) % 74;
        const x = z.x + Math.cos(an) * rr, y = z.y + Math.sin(an) * rr * 0.9, fl = Math.sin(t * 7 + j * 1.3), kk = (E ? 1.05 : 0.9) * a;
        const i = P.put(x * S, (h + 3) * S, y * S, t * 3 + j, kk * (0.45 + 0.55 * Math.abs(fl)), kk, kk);
        P.tint(i, col(E ? (j % 3 ? GOLD : '#fff0c8') : j % 4 === 0 ? W : j % 2 ? PINK : '#ff6ab0'));
      }
      if (Math.random() < 0.15) fx.sparkle(z.x + rand(-R, R) * 0.7, z.y + rand(-R, R) * 0.6, rand(10, 50), E ? GOLD : PINK);
    }
  },
};

// ---------- Effets ponctuels (run.fx 'w3…') ----------
const atk = (fx, a) => { const hs = fx.gfx.hs; if (hs && hs.atk < 0.5) { hs.atk = 1; hs.atkA = a ?? hs.face; } };
const FX = {
  w3throw(fx, f) { if (!f.g_w3) { f.g_w3 = 1; atk(fx, f.a); } },
  w3lash(fx, f) { if (!f.g_w3) { f.g_w3 = 1; atk(fx, f.a); fx.burstStars(fx.run.p.x, fx.run.p.y, 26, 3, LEAF, 120); } },
  w3chop(fx, f, k) { // hache plantée : cratère, cailloux, onde de choc
    if (!f.g_w3) {
      f.g_w3 = 1;
      fx.decal(f.x, f.y, f.r * 0.6, '#1a0c06', 0.45);
      fx.ring(f.x, f.y, 8, f.r, f.evo ? '#bfe8ff' : '#ffcf8a', 8, 0.3);
      fx.rockBurst(f.x, f.y, f.evo ? 7 : 5, '#6a5a4a', 200);
      fx.puff(f.x, f.y, 5, f.r * 0.45, 0.6, '#d8c8b0');
      fx.gfx.kick = Math.max(fx.gfx.kick || 0, f.evo ? 3 : 1.5);
    }
    fx.glow(f.x, f.y, 6, f.r * (1 - k) + 8, f.evo ? '#bfe8ff' : '#ffb04a', (1 - k) * 0.6);
  },
  w3bolt(fx, f, k, st) { // foudre des haches du Tonnerre : éclair zigzag du ciel, onde bleue
    if (!f.g_w3) {
      f.g_w3 = 1;
      const pts = f.g_pts = [];
      for (let i = 0; i <= 7; i++) { const u = i / 7, j = i && i < 7 ? rand(-1, 1) * 1.1 : 0; pts.push((f.x + 30 * (1 - u)) * S + j, 24 * (1 - u) + 0.2, f.y * S + j * 0.5); }
      fx.ring(f.x, f.y, 10, f.r * 1.2, '#bfe8ff', 7, 0.3);
      fx.burstStars(f.x, f.y, 10, 6, '#bfe8ff', 240);
    }
    const P = f.g_pts, a = 1 - k;
    for (let i = 3; i < P.length; i += 3) {
      fx.line(P[i - 3], P[i - 2], P[i - 1], P[i], P[i + 1], P[i + 2], 1.3, '#8ad0ff', a * 0.55);
      fx.line(P[i - 3], P[i - 2], P[i - 1], P[i], P[i + 1], P[i + 2], 0.4, W, a);
    }
    fx.glow(f.x, f.y, 8, 70 * a + 10, '#bfe8ff', a * 0.8);
  },
  w3roar(fx, f, k) { // cri : souffle devant la bouche, lueur
    if (!f.g_w3) {
      f.g_w3 = 1; atk(fx); const hs = fx.gfx.hs; if (hs) hs.atk = 1;
      fx.burstStars(f.x, f.y, 40, f.evo ? 10 : 6, f.evo ? GOLD : '#ffe9b0', 200);
      fx.gfx.kick = Math.max(fx.gfx.kick || 0, f.evo ? 4 : 2);
      if (f.evo) fx.halo('#ffd54a', 2);
    }
    const p = fx.run.p;
    fx.glow(p.x, p.y, 40, 40 * (1 - k) + 10, f.evo ? '#ffd54a' : '#ffcf8a', (1 - k) * 0.6);
  },
  w3stomp(fx, f) { // séisme : Ragnar frappe le sol
    if (!f.g_w3) {
      f.g_w3 = 1; atk(fx, f.a);
      fx.decal(f.x, f.y, 34, '#1a0c06', 0.4);
      fx.ring(f.x, f.y, 10, 70, f.evo ? '#ff8a2a' : '#e8c890', 8, 0.35);
      fx.puff(f.x, f.y, 6, 20, 0.6, '#d8c0a0');
      fx.rockBurst(f.x, f.y, 4, '#6a5a52', 160);
      fx.gfx.kick = Math.max(fx.gfx.kick || 0, f.evo ? 5 : 3);
    }
  },
  w3blast(fx, f) { // fin du cyclone : explosion de feu
    if (!f.g_w3) {
      f.g_w3 = 1;
      fx.bursts.push({ x: f.x, y: f.y, h: 16, r: f.r * 1.2, t: 0, max: 0.45, c: '#ff8a2a' });
      fx.ring(f.x, f.y, 20, f.r * 1.1, '#ffd54a', 10, 0.4);
      fx.puff(f.x, f.y, 10, f.r * 0.5, 0.7, '#ffb070');
      fx.burstStars(f.x, f.y, 20, 14, '#ffb02a', 320);
      fx.gfx.kick = Math.max(fx.gfx.kick || 0, 6);
    }
  },
  w3spread(fx, f, k) { // poison qui passe d'un monstre à l'autre
    const a = 1 - k, x = f.x + (f.tx - f.x) * Math.min(1, k * 2), y = f.y + (f.ty - f.y) * Math.min(1, k * 2);
    fx.line(f.x * S, 1, f.y * S, x * S, 1, y * S, 0.5, POISON, 0.6 * a);
    fx.glow(x, y, 20, 12, POISON, a);
    if (!f.g_w3) { f.g_w3 = 1; fx.burstStars(f.x, f.y, 16, 4, POISON, 140); }
  },
  w3pop(fx, f, k) { // esprit qui éclate : onde et étincelles, une lueur de soin sur Gaïa
    if (!f.g_w3) {
      f.g_w3 = 1;
      fx.ring(f.x, f.y, 6, f.r * 1.05, f.evo ? GOLD : SPIRIT, 7, 0.3);
      fx.burstStars(f.x, f.y, f.z, f.evo ? 7 : 4, f.evo ? GOLD : SPIRIT, 200);
      const p = fx.run.p; fx.sparkle(p.x + rand(-10, 10), p.y + rand(-6, 6), rand(20, 40), '#7aff6a');
    }
    fx.glow(f.x, f.y, f.z, (f.r * 0.9) * (1 - k) + 6, f.evo ? '#ffe48a' : '#bfffe8', (1 - k) * 0.8);
  },
};

export function frameW3(fx, dt) {
  const run = fx.run, p = run.p;
  let st = fx.w3;
  for (const w of p.weapons) {
    const d = DRAW[w.id];
    if (!d) continue;
    const s = W3S.get(w);
    if (!s || s.stage !== run.stage) continue;
    st = st || (fx.w3 = {});
    d(fx, st, w, s, fx.gfx.t, dt);
  }
  if (!st) return;
  for (const f of run.fx) {
    const d = f.type.charCodeAt(0) === 119 && f.type.charCodeAt(1) === 51 ? FX[f.type] : null; // 'w3…'
    if (d) d(fx, f, clamp(1 - f.life / f.max, 0, 1), st);
  }
}
