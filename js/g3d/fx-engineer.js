// Effets 3D de Tess l'Ingénieure, branchés sur Fx (fx.js) par deux appels : eventEng (ultime, impact et fin de la frappe
// orbitale) et frameEng (chaque image : tourelles, drones, tirs et missiles, jet du lance-flammes et flaques de napalm,
// mines électriques et arcs de la grille Tesla, laser de la frappe orbitale, fumée du sac à dos, geste d'attaque).
// L'état des armes est lu dans ENGS (js/arsenal-engineer.js), celui de l'ultime dans run.engU (js/champion-engineer.js),
// les effets ponctuels dans run.fx (types 'eng…'). Groupes d'instances créés au premier besoin et confiés à fx (begin /
// end / dispose) ; flammes : réserve fixe réutilisée. Ne modifie jamais la partie (seulement gfx.hs, geste du héros).
import { S, TAU, rand, clamp, backOut, col, Build, G, T, lowpoly, Pool } from './kit.js';
import { ENGS } from '../arsenal-engineer.js';
import { ENGB } from '../champion-engineer.js';

const IDS = new Set(['turret', 'drone', 'flamer', 'shockmine']);
const W = '#ffffff', ORANGE = '#ff8a2a', METAL = '#4a5266', STEEL = '#b8c2d0', DARK = '#2a2e3a', CYAN = '#3ae0ff', ICE = '#bff8ff', HAZ = '#ffd23a';
const PI = Math.PI;

function addPool(fx, build, cap, mat = lowpoly(), o = {}) { const b = new Build(17); build(b); const P = new Pool(fx.root, b.geo(), mat, cap, o); fx.pools.push(P); return P; }
// modèles (unités 3D, posés au sol, face à +X), créés au premier besoin
const MK = {
  // pied de tourelle : trépied, socle, corps orange à bandes de danger
  tbase: fx => addPool(fx, b => {
    for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + 0.5; b.add(G.cyl(0.05, 0.07, 0.95, 5), METAL, T(Math.cos(a) * 0.42, 0.36, Math.sin(a) * 0.42, 1, 1, 1, -Math.sin(a) * 0.75, 0, Math.cos(a) * 0.75)); b.add(G.box(0.18, 0.08, 0.18), DARK, T(Math.cos(a) * 0.76, 0.04, Math.sin(a) * 0.76)); }
    b.add(G.cyl(0.3, 0.36, 0.22, 8), METAL, T(0, 0.72, 0));
    b.add(G.cyl(0.26, 0.3, 0.3, 8), ORANGE, T(0, 0.95, 0));
    b.add(G.cyl(0.31, 0.31, 0.07, 8), HAZ, T(0, 0.86, 0));
  }, 16),
  // tête de tourelle : boîtier orange, canon, œil cyan
  thead: fx => addPool(fx, b => {
    b.add(G.box(0.7, 0.42, 0.55), ORANGE, T(0, 1.32, 0), 0.05);
    b.add(G.box(0.72, 0.1, 0.57), '#c85a1a', T(0, 1.55, 0));
    b.add(G.cyl(0.08, 0.1, 0.75, 6), STEEL, T(0.62, 1.3, 0, 1, 1, 1, 0, 0, -PI / 2));
    b.add(G.cyl(0.12, 0.12, 0.12, 6), DARK, T(1.0, 1.3, 0, 1, 1, 1, 0, 0, -PI / 2));
    b.add(G.sph(0.11, 6, 4), CYAN, T(0.36, 1.42, 0.2));
    b.add(G.box(0.05, 0.3, 0.05), DARK, T(-0.22, 1.72, -0.16));
  }, 16),
  // tête blindée (Batterie lance-missiles) : double canon, nacelle de missiles, radar
  thead2: fx => addPool(fx, b => {
    b.add(G.box(0.78, 0.5, 0.7), '#e8ecf4', T(0, 1.34, 0), 0.05);
    b.add(G.box(0.8, 0.1, 0.72), ORANGE, T(0, 1.62, 0));
    for (const z of [-0.17, 0.17]) { b.add(G.cyl(0.08, 0.1, 0.85, 6), STEEL, T(0.7, 1.3, z, 1, 1, 1, 0, 0, -PI / 2)); b.add(G.cyl(0.12, 0.12, 0.12, 6), DARK, T(1.12, 1.3, z, 1, 1, 1, 0, 0, -PI / 2)); }
    b.add(G.box(0.5, 0.3, 0.3), METAL, T(-0.1, 1.38, 0.5));
    for (const y of [1.32, 1.46]) for (const z of [0.42, 0.58]) b.add(G.cyl(0.05, 0.05, 0.06, 6), '#ff4a3a', T(0.16, y, z, 1, 1, 1, 0, 0, -PI / 2));
    b.add(G.cyl(0.3, 0.05, 0.12, 8), STEEL, T(-0.25, 1.85, -0.2, 1, 1, 1, 0.4, 0, 0.3));
    b.add(G.sph(0.12, 6, 4), CYAN, T(0.42, 1.48, -0.24));
  }, 16),
  // drone : corps blanc et orange, œil cyan, 4 bras (les hélices sont des disques lumineux dessinés à part)
  drone: fx => addPool(fx, b => {
    b.add(G.box(0.62, 0.24, 0.62), '#f4f0e6', T(0, 0, 0), 0.05);
    b.add(G.box(0.64, 0.08, 0.64), ORANGE, T(0, 0.14, 0));
    for (let i = 0; i < 4; i++) { const a = PI / 4 + i * PI / 2; b.add(G.box(0.6, 0.07, 0.1), DARK, T(Math.cos(a) * 0.42, 0.08, Math.sin(a) * 0.42, 1, 1, 1, 0, -a, 0)); b.add(G.cyl(0.07, 0.07, 0.12, 5), METAL, T(Math.cos(a) * 0.68, 0.13, Math.sin(a) * 0.68)); }
    b.add(G.sph(0.16, 6, 4), CYAN, T(0.3, -0.04, 0));
    b.add(G.cyl(0.05, 0.05, 0.3, 5), STEEL, T(0.32, -0.16, 0, 1, 1, 1, 0, 0, -PI / 2));
  }, 8),
  // drone de l'Escadrille : plus gros, doré, deux canons laser
  drone2: fx => addPool(fx, b => {
    b.add(G.box(0.7, 0.28, 0.7), '#e8ecf4', T(0, 0, 0), 0.05);
    b.add(G.box(0.72, 0.09, 0.72), '#ffb21a', T(0, 0.16, 0));
    for (let i = 0; i < 4; i++) { const a = PI / 4 + i * PI / 2; b.add(G.box(0.66, 0.08, 0.12), DARK, T(Math.cos(a) * 0.48, 0.1, Math.sin(a) * 0.48, 1, 1, 1, 0, -a, 0)); b.add(G.cyl(0.08, 0.08, 0.14, 5), '#ffb21a', T(Math.cos(a) * 0.76, 0.16, Math.sin(a) * 0.76)); }
    b.add(G.sph(0.18, 6, 4), CYAN, T(0.34, -0.04, 0));
    for (const z of [-0.18, 0.18]) b.add(G.cyl(0.05, 0.05, 0.42, 5), STEEL, T(0.4, -0.18, z, 1, 1, 1, 0, 0, -PI / 2));
  }, 8),
  // missile : corps blanc, pointe rouge, ailerons
  missile: fx => addPool(fx, b => {
    b.add(G.cyl(0.1, 0.1, 0.7, 6), '#f4f0e6', T(0, 0, 0, 1, 1, 1, 0, 0, -PI / 2));
    b.add(G.cone(0.1, 0.25, 6), '#ff4a3a', T(0.47, 0, 0, 1, 1, 1, 0, 0, -PI / 2));
    for (let i = 0; i < 4; i++) b.add(G.box(0.18, 0.02, 0.14), ORANGE, T(-0.3, 0, 0, 1, 1, 1, i * PI / 2, 0, 0).multiply(T(0, 0, 0.1)));
  }, 24),
  // mine : galette sombre à bandes de danger, dôme et voyant (le voyant lumineux est dessiné à part)
  mine: fx => addPool(fx, b => {
    b.add(G.cyl(0.42, 0.48, 0.14, 10), METAL, T(0, 0.07, 0));
    for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; b.add(G.box(0.18, 0.04, 0.1), HAZ, T(Math.cos(a) * 0.4, 0.13, Math.sin(a) * 0.4, 1, 1, 1, 0, -a, 0)); }
    b.add(G.sph(0.24, 8, 4), STEEL, T(0, 0.16, 0, 1, 0.55, 1));
    b.add(G.cyl(0.06, 0.06, 0.12, 5), DARK, T(0, 0.3, 0));
  }, 40),
  // mine de la grille Tesla : bobine et sphère en plus
  mine2: fx => addPool(fx, b => {
    b.add(G.cyl(0.44, 0.5, 0.14, 10), METAL, T(0, 0.07, 0));
    for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; b.add(G.box(0.18, 0.04, 0.1), HAZ, T(Math.cos(a) * 0.42, 0.13, Math.sin(a) * 0.42, 1, 1, 1, 0, -a, 0)); }
    b.add(G.cyl(0.1, 0.16, 0.5, 6), '#c87a3a', T(0, 0.38, 0));
    for (let i = 0; i < 3; i++) b.add(G.cyl(0.19 - i * 0.02, 0.19 - i * 0.02, 0.05, 8), '#e0a83a', T(0, 0.24 + i * 0.13, 0));
    b.add(G.sph(0.16, 6, 4), STEEL, T(0, 0.72, 0));
  }, 40),
};
const get = (st, fx, k) => st[k] || (st[k] = MK[k](fx));

// éclair en zigzag entre deux points du sol (px) à la hauteur h ; n segments, écart amp (px) ; dessiné en deux traits
function jag(fx, x0, y0, x1, y1, h, n, amp, wd, c, a) {
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  let px = x0, py = y0;
  for (let i = 1; i <= n; i++) {
    const k = i / n, o = i < n ? rand(-amp, amp) : 0, x = x0 + dx * k + nx * o, y = y0 + dy * k + ny * o;
    fx.line(px * S, h * S, py * S, x * S, h * S, y * S, wd * 2.4, c, a * 0.5);
    fx.line(px * S, h * S, py * S, x * S, h * S, y * S, wd * 0.7, W, a);
    px = x; py = y;
  }
}

// ---------- Armes en cours ----------
const DRAW = {
  turret(fx, st, w, s, t) {
    const B = get(st, fx, 'tbase'), Hd = get(st, fx, w.evo ? 'thead2' : 'thead'), E = w.evo, k0 = E ? 1.05 : 0.95;
    for (const o of s.list) {
      const fall = clamp(o.t / 0.25, 0, 1), left = o.dur - o.t;
      if (left < 1 && Math.sin(t * 30) < 0) continue; // clignote avant de se démonter
      let x = o.x, y = o.y, h = 0, k = k0;
      if (fall < 1) { x = o.fx + (o.x - o.fx) * fall; y = o.fy + (o.y - o.fy) * fall; h = Math.sin(fall * PI) * 60; k = k0 * (0.5 + 0.5 * fall); }
      else if (!o.g_land) { o.g_land = 1; fx.puff(o.x, o.y, 5, 14, 0.6, '#d8c8b0'); fx.ring(o.x, o.y, 6, 44, ORANGE, 5, 0.3); }
      else if (o.t < 0.45) k = k0 * (1 + 0.15 * Math.sin((o.t - 0.25) / 0.2 * PI)); // petit rebond à l'atterrissage
      const ca = Math.cos(o.a), sa = Math.sin(o.a), rk = o.kick * 4;
      B.put(x * S, h * S, y * S, o.id * 1.3, k);
      Hd.put((x - ca * rk) * S, h * S, (y - sa * rk) * S, -o.a, k);
      fx.shadow(x, y, 34 * k, 0.3);
      fx.glow(x + ca * 8, y + sa * 8, 30 * k + h, 7, CYAN, 0.7 + 0.3 * Math.sin(t * 6 + o.id));
      if (o.kick > 0.6) { // éclair de bouche
        const L = (E ? 24 : 21) * k, side = E ? (o.n % 2 ? 1 : -1) * 7 : 0, mx = x + ca * L - sa * side, my = y + sa * L + ca * side;
        fx.glow(mx, my, 26 * k, 14, '#ffd27a', o.kick);
        fx.star(mx, my, 26 * k, 7, W, o.kick);
      }
    }
    // balles traçantes (jaunes) et missiles (fumée)
    const M = E ? get(st, fx, 'missile') : null;
    for (const b of s.aux) {
      const ca = Math.cos(b.a), sa = Math.sin(b.a), X = b.x * S, Y = b.z * S, Z = b.y * S;
      if (b.boom) {
        M.put(X, Y, Z, -b.a, 1.2);
        fx.glow(b.x - ca * 12, b.y - sa * 12, b.z, 10, '#ffb04a', 0.9);
        fx.shadow(b.x, b.y, 14, 0.25);
        if (Math.random() < 0.6 && fx.puffs.length < 200) fx.puffs.push({ x: b.x - ca * 14, y: b.y - sa * 14, z: b.z, vx: 0, vy: 0, vz: 10, s: rand(5, 8), life: 0.4, max: 0.4, a: 0.55, c: '#c8c0b8' });
      } else {
        fx.line(X, Y, Z, (b.x - ca * 26) * S, Y, (b.y - sa * 26) * S, 0.42, '#ffb03a', 0.7);
        fx.line(X, Y, Z, (b.x - ca * 14) * S, Y, (b.y - sa * 14) * S, 0.16, '#fff6d0', 1);
        fx.glow(b.x, b.y, b.z, 8, '#ffd27a', 0.8);
      }
    }
  },
  drone(fx, st, w, s, t) {
    const D = get(st, fx, w.evo ? 'drone2' : 'drone'), E = w.evo, k = E ? 1.15 : 1;
    for (const d of s.list) {
      if (d.m === 0) continue; // posé dans le sac
      const ca = Math.cos(d.a), sa = Math.sin(d.a), rk = d.kick * 3, X = (d.x - ca * rk) * S, Y = d.z * S, Z = (d.y - sa * rk) * S;
      D.put(X, Y + Math.sin(t * 9 + d.id) * 0.05, Z, -d.a, k);
      fx.ra.ring(X, Y + 0.2, Z, 0.95 * k, col(E ? '#ffe7a0' : '#d8f4ff'), 0.3, 0, 0.22, 1, t * 40 + d.id, 4, 0, 0.5); // hélices
      fx.glow(d.x + ca * 7, d.y + sa * 7, d.z - 2, 7, CYAN, 0.9);
      fx.glow(d.x, d.y, d.z - 8, 12, E ? '#ffd23a' : '#7ae8ff', 0.35); // poussée sous le drone
      fx.shadow(d.x, d.y, 20 * k, 0.22);
      if (d.kick > 0.6) fx.star(d.x + ca * 16, d.y + sa * 16, d.z - 4, 7, ICE, d.kick);
    }
    for (const b of s.aux) { // tirs laser cyan (perçants et plus longs pour l'Escadrille)
      const ca = Math.cos(b.a), sa = Math.sin(b.a), X = b.x * S, Y = b.z * S * 0.8 + 0.4, Z = b.y * S, L = E ? 46 : 32;
      fx.line(X, Y, Z, (b.x - ca * L) * S, Y, (b.y - sa * L) * S, E ? 0.55 : 0.4, CYAN, 0.75);
      fx.line(X, Y, Z, (b.x - ca * L * 0.6) * S, Y, (b.y - sa * L * 0.6) * S, 0.15, W, 1);
      fx.glow(b.x, b.y, b.z * 0.8 + 8, E ? 11 : 8, CYAN, 0.8);
    }
  },
  flamer(fx, st, w, s, t, dt) {
    const p = fx.run.p, E = w.evo, P = st.flames || (st.flames = Array.from({ length: 110 }, () => ({ on: false })));
    const C0 = E ? '#e8fbff' : '#fff6c0', C1 = E ? '#5ae0ff' : '#ffb03a', C2 = E ? '#3a6aff' : '#ff4a1a';
    if (s.on > 0 && !fx.run.dying) {
      // jet : nouvelles flammes depuis la buse (main gauche), lueur du cône au sol
      const R = s.R, ca = Math.cos(s.a), sa = Math.sin(s.a), nx = p.x + ca * 20, ny = p.y + sa * 20, n = E ? 4 : 3;
      for (let i = 0, j = 0; i < n && j < P.length; j++) {
        const q = P[j];
        if (q.on) continue;
        const a = s.a + rand(-0.5, 0.5) * s.arc, v = R / 0.3 * rand(0.8, 1.08);
        q.on = true; q.x = nx; q.y = ny; q.z = 26; q.vx = Math.cos(a) * v; q.vy = Math.sin(a) * v; q.life = q.max = rand(0.26, 0.34); q.s = rand(0.8, 1.2);
        i++;
      }
      fx.ringAt(p.x, p.y, R, C1, 0.22, 0.001, 1, s.arc / TAU, s.a - s.arc / 2, 0, 0, 0, true, 0.09);
      fx.glow(nx, ny, 26, 18, C0, 0.9);
      if (!s.g_hs) { s.g_hs = 1; const hs = fx.gfx.hs; if (hs) { hs.atk = Math.max(hs.atk, 0.8); hs.atkA = s.a; } }
    } else s.g_hs = 0;
    for (const q of P) {
      if (!q.on) continue;
      if ((q.life -= dt) <= 0) { q.on = false; if (!E && Math.random() < 0.3 && fx.puffs.length < 200) fx.puffs.push({ x: q.x, y: q.y, z: q.z + 10, vx: 0, vy: 0, vz: 30, s: rand(8, 12), life: 0.5, max: 0.5, a: 0.35, c: '#5a5050' }); continue; }
      q.x += q.vx * dt; q.y += q.vy * dt; q.z += 30 * dt; q.vx *= 0.97; q.vy *= 0.97;
      const k = 1 - q.life / q.max, sz = (6 + k * 26) * q.s;
      fx.glow(q.x, q.y, q.z, sz, k < 0.3 ? C0 : k < 0.65 ? C1 : C2, (1 - k) * 0.95);
    }
    for (const o of s.aux) { // flaques de napalm
      const a = clamp(o.t / 0.2, 0, 1) * clamp((o.dur - o.t) / 0.6, 0, 1);
      fx.ringAt(o.x, o.y, o.R, '#0a1a3a', 0.4 * a, 0.001, 1, 1, 0, 0, 0, 0, false, 0.065);
      fx.ringAt(o.x, o.y, o.R, CYAN, 0.6 * a, 0.08, 0.15, 1, t, 8, 0.5, 0.5, true, 0.08);
      for (let i = 0; i < 3; i++) { const an = i * 2.1 + o.x, f = 0.5 + 0.5 * Math.sin(t * 13 + i * 2 + o.y); fx.glow(o.x + Math.cos(an) * o.R * 0.45, o.y + Math.sin(an) * o.R * 0.35, 8 + f * 10, (10 + f * 8), i ? '#5ae0ff' : '#e8fbff', 0.7 * a); }
    }
  },
  shockmine(fx, st, w, s, t) {
    const E = w.evo, M = get(st, fx, E ? 'mine2' : 'mine');
    for (const m of s.list) {
      if (m.t < 0) continue;
      if (m.t < m.fl) { // en vol, en cloche, en tournoyant
        const k = m.t / m.fl, x = m.sx + (m.x - m.sx) * k, y = m.sy + (m.y - m.sy) * k, h = 26 + Math.sin(k * PI) * 70 - k * 26;
        M.put(x * S, h * S, y * S, k * 9, 0.85);
        fx.shadow(x, y, 16, 0.25);
        continue;
      }
      if (!m.g_land) { m.g_land = 1; fx.puff(m.x, m.y, 3, 8, 0.5, '#c8c0b0'); }
      const armed = m.arm <= 0, blink = m.life < 1.5 ? Math.sin(t * 40) > 0 : Math.sin(t * 7 + m.id) > 0.2;
      M.put(m.x * S, 0, m.y * S, m.id * 0.9, 0.9);
      fx.shadow(m.x, m.y, 20, 0.25);
      const lh = E ? 15 : 7;
      if (blink || !armed) fx.glow(m.x, m.y, lh, armed ? 9 : 7, armed ? CYAN : '#ff4a3a', armed ? 0.95 : 0.8);
      if (armed) fx.ringAt(m.x, m.y, 22, CYAN, 0.35, 0.08, 0, 1, t * 2 + m.id, 6, 0, 0.4, true, 0.07);
      if (E && Math.random() < 0.08) fx.sparkle(m.x + rand(-6, 6), m.y + rand(-4, 4), 16, ICE);
    }
    // arcs électriques de la grille Tesla (redessinés en zigzag à chaque image)
    const K = s.links;
    for (let i = 0; i + 3 < K.length; i += 4) {
      jag(fx, K[i], K[i + 1], K[i + 2], K[i + 3], 15, 5, 9, 0.35, '#7ae8ff', 0.85);
      fx.glow((K[i] + K[i + 2]) / 2, (K[i + 1] + K[i + 3]) / 2, 12, 22, CYAN, 0.35);
    }
  },
};

// ---------- Effets ponctuels (run.fx 'eng…') ----------
const FX = {
  engAtk(fx, f) { const hs = fx.gfx.hs; if (hs && hs.atk < 0.5) { hs.atk = 1; hs.atkA = f.a; } },
  engPoof(fx, f) { if (!f.g_e) { f.g_e = 1; fx.puff(f.x, f.y, f.small ? 3 : 6, f.small ? 8 : 16, 0.6, '#c8c0b8'); fx.rockBurst(f.x, f.y, f.small ? 2 : 4, STEEL, 140); fx.burstStars(f.x, f.y, 14, f.small ? 2 : 4, HAZ, 160); } },
  engLaunch(fx, f) { if (!f.g_e) { f.g_e = 1; fx.puff(f.x, f.y, 4, 10, 0.5, '#e0e4ec'); fx.ring(f.x, f.y, 6, 34, CYAN, 4, 0.3); } },
  engBlast(fx, f) {
    if (f.g_e) return;
    f.g_e = 1;
    fx.decal(f.x, f.y, f.R * 0.7, '#1a1020', 0.4);
    fx.bursts.push({ x: f.x, y: f.y, h: 6, r: f.R * 1.4, t: 0, max: 0.35, c: '#ff9a3a' });
    fx.puff(f.x, f.y, 8, f.R * 0.5, 0.8, '#d8c0a0');
    fx.rockBurst(f.x, f.y, 4, '#6a5a52', 160);
  },
  // décharge d'une mine : onde, éclats, puis l'éclair qui saute de monstre en monstre
  engZap(fx, f, k) {
    const P = f.pts;
    if (!f.g_e) {
      f.g_e = 1;
      fx.ring(f.x, f.y, 10, f.R * 1.3, '#9af4ff', 8, 0.35); fx.ring(f.x, f.y, 6, f.R * 0.8, W, 5, 0.25);
      fx.burstStars(f.x, f.y, 10, f.evo ? 8 : 5, ICE, 220);
      fx.decal(f.x, f.y, f.R * 0.6, '#101a2a', 0.4);
    }
    const a = 1 - k;
    for (let i = 2; i + 1 < P.length; i += 2) { jag(fx, P[i - 2], P[i - 1], P[i], P[i + 1], 18, 4, 10, 0.4, f.evo ? '#9af4ff' : '#7ae8ff', a); fx.glow(P[i], P[i + 1], 18, 18, CYAN, a * 0.7); }
    fx.glow(f.x, f.y, 10, f.R * 1.2 * (0.5 + a), CYAN, a * 0.6);
  },
};

// ---------- Frappe orbitale (run.engU) ----------
function orbital(fx, U, t) {
  const O = ENGB.orbital, x = U.x, y = U.y, R = O.R;
  if (U.t < 0) { // visée : réticule rouge qui se resserre, trait de visée qui descend du ciel
    const k = clamp(-U.t / O.aim, 0, 1), r = R * (0.9 + k * 1.2);
    fx.ringAt(x, y, r, '#ff3a3a', 0.95, 0.07, 0, 1, t * 3, 4, 0, 0.5, true, 0.1);
    fx.ringAt(x, y, r * 0.55, '#ffb03a', 0.8, 0.09, 0, 1, -t * 4, 3, 0, 0.5, true, 0.1);
    fx.line((x - r) * S, 0.12, y * S, (x + r) * S, 0.12, y * S, 0.18, '#ff5a5a', 0.8);
    fx.line(x * S, 0.12, (y - r) * S, x * S, 0.12, (y + r) * S, 0.18, '#ff5a5a', 0.8);
    fx.line(x * S, 60, y * S, x * S, 0.2, y * S, 0.22 + (1 - k) * 0.3, '#ff6a6a', 0.5 + (1 - k) * 0.4);
    fx.glow(x, y, 6, 30, '#ff3a3a', 0.6);
    return;
  }
  const pulse = 1 + Math.sin(t * 34) * 0.07, fade = clamp(U.t / 0.12, 0, 1) * clamp((O.dur - U.t) / 0.25, 0, 1);
  // colonne de lumière : grand halo cyan, corps bleu glacier, cœur blanc
  fx.beam(x, y, R * 2.6 * pulse, 1500, CYAN, 0.55 * fade);
  fx.beam(x, y, R * 1.35 * pulse, 1500, ICE, 0.85 * fade);
  fx.beam(x, y, R * 0.55 * pulse, 1500, W, fade);
  // sol : disque brûlant, anneau qui tourne, lueur
  fx.ringAt(x, y, R * 1.05, '#d8fcff', 0.75 * fade, 0.001, 1, 1, 0, 0, 0, 0, true, 0.1);
  fx.ringAt(x, y, R * 1.25, CYAN, 0.9 * fade, 0.1, 0, 1, t * 5, 8, 0, 0.6, true, 0.11);
  fx.glow(x, y, 12, R * 2.4, '#5ae8ff', 0.8 * fade);
  // traînée calcinée, étincelles et fumée
  const L = U.g_l || (U.g_l = { x, y });
  if ((x - L.x) ** 2 + (y - L.y) ** 2 > 60 * 60) { fx.decal(x, y, R * 0.75, '#141018', 0.45); L.x = x; L.y = y; }
  for (let i = 0; i < 3 && fx.sparks.length < 200; i++) { const a = Math.random() * TAU, v = rand(160, 380); fx.sparks.push({ x: x + Math.cos(a) * R * 0.6, y: y + Math.sin(a) * R * 0.5, z: 6, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.7, vz: rand(150, 380), life: 0.4, max: 0.4, c: i ? ICE : '#ffb03a', w: 3 }); }
  if (Math.random() < 0.5 && fx.puffs.length < 200) fx.puffs.push({ x: x + rand(-R, R) * 0.6, y: y + rand(-R, R) * 0.5, z: 8, vx: 0, vy: 0, vz: 40, s: rand(14, 22), life: 0.7, max: 0.7, a: 0.4, c: '#4a4858' });
}

// renvoie true si l'événement est entièrement traité ici (fx.js ne fait alors rien de plus)
export function eventEng(fx, ev) {
  const p = fx.run.p, ov = fx.gfx.overlay;
  switch (ev.type) {
    case 'ult':
      if (ev.kind !== 'orbital') return false;
      // liaison avec le satellite : fine colonne cyan sur Tess, anneaux
      fx.pillars.push({ x: p.x, y: p.y, w: 46, h: 900, t: 0, max: 0.55, c: CYAN });
      for (let i = 0; i < 2; i++) fx.ring(p.x, p.y, 20, 140 + i * 60, i ? W : CYAN, 8, 0.5, -i * 0.1);
      fx.halo(CYAN, 2);
      return true;
    case 'engImpact': {
      // le laser touche le sol : explosion de lumière, ondes, roches, flash blanc-bleu
      for (let i = 0; i < 3; i++) fx.ring(ev.x, ev.y, 20, ev.R * (1.3 + i * 0.5), i === 1 ? W : CYAN, 12, 0.6, -i * 0.08);
      fx.bursts.push({ x: ev.x, y: ev.y, h: 10, r: ev.R * 2, t: 0, max: 0.55, c: ICE });
      fx.pillars.push({ x: ev.x, y: ev.y, w: ev.R * 2.4, h: 1400, t: 0, max: 0.4, c: W });
      fx.decal(ev.x, ev.y, ev.R, '#141018', 0.55);
      fx.rockBurst(ev.x, ev.y, 14, '#5a5262', 320);
      fx.burstStars(ev.x, ev.y, 20, 26, ICE, 420);
      fx.puff(ev.x, ev.y, 12, ev.R * 0.6, 0.8, '#c8c8d8');
      fx.gfx.kick = Math.max(fx.gfx.kick || 0, 9);
      if (ov) { ov.flashA = 0.55; ov.flashC = '210,250,255'; ov.edgeA = 0.6; ov.edgeC = '90,220,255'; }
      return true;
    }
    case 'engEnd':
      if (ev.x != null) { fx.ring(ev.x, ev.y, 30, 200, CYAN, 10, 0.5); fx.puff(ev.x, ev.y, 8, 40, 0.7, '#8a8898'); fx.burstStars(ev.x, ev.y, 20, 14, ICE, 300); }
      return true;
  }
  return false;
}

export function frameEng(fx, dt) {
  const run = fx.run, p = run.p, t = fx.gfx.t;
  let st = fx.eng;
  for (const w of p.weapons) {
    if (!IDS.has(w.id)) continue;
    const s = ENGS.get(w);
    if (!s || s.stage !== run.stage) continue;
    st = st || (fx.eng = {});
    DRAW[w.id](fx, st, w, s, t, dt);
  }
  if (run.engU) orbital(fx, run.engU, t);
  if (run.cls.id === 'engineer' && !run.dying && Math.random() < dt * 3 && fx.puffs.length < 200) { // fumée des pots d'échappement du sac à dos
    const hs = fx.gfx.hs, f = hs ? hs.face : 0, bx = p.x - Math.cos(f) * 9, by = p.y - Math.sin(f) * 7;
    fx.puffs.push({ x: bx + rand(-6, 6), y: by, z: 66 + p.h, vx: 0, vy: 0, vz: 30, s: rand(4, 6), life: 0.6, max: 0.6, a: 0.45, c: '#d8d4d0' });
  }
  if (!st) return;
  for (const f of run.fx) {
    const d = f.type.charCodeAt(0) === 101 && f.type.charCodeAt(1) === 110 && f.type.charCodeAt(2) === 103 ? FX[f.type] : null; // 'eng…'
    if (d) d(fx, f, clamp(1 - f.life / f.max, 0, 1), st);
  }
}
