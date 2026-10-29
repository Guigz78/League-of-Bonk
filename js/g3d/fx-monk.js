// Effets 3D de Kenji le moine (js/champion-monk.js, js/arsenal-monk.js) : poings fantômes des coups de poing et de la
// rafale de Mille poings, poings de ki projetés (Rafale du tigre), boules de ki (Paume de ki), ondes de la Vague de chi,
// dragons de ki (tête et corps qui serpentent), onde de ki finale, lueur du Flux du combo. Branché sur Fx (fx.js) par deux
// appels, comme fx-engineer.js : eventMonk (événements 'mk', 'mkfist', 'mkwave', 'mkflow', 'ult') et frameMonk (chaque
// image : objets en vol lus sur les armes w.q). Tout est instancié, créé à la 1re image d'une partie de Kenji. Ne modifie
// jamais la partie (seulement gfx.hs, l'état d'animation du héros, et MKP, le geste choisi : models-hero-monk.js).
import { S, TAU, clamp, rand, col, Build, G, T, Pool, alphaMat, ADD, THREE } from './kit.js';
import { MKP } from './models-hero-monk.js';
import { MKB } from '../champion-monk.js';

const W = '#ffffff', KI = '#ffc23a', KI_L = '#fff0a0', SAFF = '#ff9a1a', GOLD = '#ffd54a', RED = '#ff5a2a';
const NS = 16; // points de la traînée d'un dragon (comme arsenal-monk.js)

// ---------- Modèles (unités 3D : 1 = 20 px), créés une fois ----------
function init(fx) {
  const unlit = new THREE.MeshBasicMaterial({ vertexColors: true }), ghost = alphaMat({ vertexColors: true });
  fx.mats.push(unlit, ghost);
  // poing (vers +X) : bloc des doigts, jointures, pouce, poignet bandé
  const f = new Build(3);
  f.add(G.box(0.9, 0.7, 0.8), '#ffe8b0', T(0.1, 0, 0), 0.04);
  for (let i = 0; i < 4; i++) f.add(G.box(0.24, 0.2, 0.2), W, T(0.58, 0.27 - i * 0.18, 0.02, 1, 1, 1), 0.02);
  f.add(G.box(0.5, 0.22, 0.24), '#fff4d8', T(0.2, -0.3, 0.38));
  f.add(G.cyl(0.36, 0.4, 0.5, 6), '#d89a50', T(-0.5, 0, 0, 1, 1, 1, 0, 0, Math.PI / 2));
  f.add(G.cyl(0.42, 0.42, 0.12, 6), '#8a5a3a', T(-0.36, 0, 0, 1, 1, 1, 0, 0, Math.PI / 2));
  // boule de ki : cœur facetté ; tête de dragon (vers +X) : museau, mâchoire ouverte, cornes, moustaches, crinière ;
  // anneau du corps : écailles en couronne et nageoire dorsale
  const b = new Build(4); b.add(G.ico(0.5, 1), W, T(), 0.03);
  const h = new Build(8);
  h.add(G.box(1.0, 0.5, 0.62), '#ffd27a', T(0.35, 0.08, 0), 0.05);
  h.add(G.box(0.7, 0.18, 0.5), '#ffb02a', T(0.42, -0.28, 0, 1, 1, 1, 0, 0, -0.35), 0.05);
  h.add(G.ico(0.42, 0), '#ffc23a', T(-0.15, 0.1, 0), 0.06);
  for (const sd of [1, -1]) {
    h.add(G.cone(0.1, 0.7, 4), '#fff6d8', T(-0.35, 0.45, sd * 0.2, 1, 1, 1, sd * 0.35, 0, 0.9), 0.02);
    h.add(G.oct(0.12), '#ff3a1a', T(0.35, 0.3, sd * 0.24), 0.02);
    h.add(G.box(0.7, 0.04, 0.04), '#fff6d8', T(0.75, -0.02, sd * 0.38, 1, 1, 1, 0, sd * 0.5, 0.2), 0.02);
    for (let i = 0; i < 3; i++) h.add(G.cone(0.05, 0.14, 3), W, T(0.75 - i * 0.14, -0.08, sd * 0.2, 1, 1, 1, Math.PI, 0, 0), 0.01);
  }
  for (let i = 0; i < 3; i++) h.add(G.cone(0.14, 0.5, 4), '#ff9a1a', T(-0.4 - i * 0.15, 0.3 - i * 0.05, 0, 1, 1, 1, 0, 0, 1.4 + i * 0.2), 0.04);
  const s = new Build(5);
  s.add(G.ico(0.5, 0), '#ffc23a', T(0, 0, 0, 1, 0.85, 0.85), 0.08);
  s.add(G.cone(0.16, 0.5, 4), '#fff0a0', T(0, 0.5, 0, 1, 1, 1, 0, 0, 0.5), 0.03);
  for (const sd of [1, -1]) s.add(G.cone(0.1, 0.32, 3), '#ff9a1a', T(0, 0, sd * 0.42, 1, 1, 1, sd * 1.2, 0, 0), 0.03);
  return {
    fist: new Pool(fx.root, f.geo(), ghost, 48, { color: true, alpha: true, order: 7 }),
    ball: new Pool(fx.root, b.geo(), unlit, 12, { color: true, order: 6 }),
    head: new Pool(fx.root, h.geo(), unlit, 8, { color: true, order: 6 }),
    seg: new Pool(fx.root, s.geo(), unlit, 8 * NS, { color: true, order: 6 }),
    fists: [], // poings fantômes en vol : { x, y, a, d, t, max, s, c }
    arcs: [], // croissants d'impact : { x, y, a, R, arc, t, max, c }
    flowK: 0,
  };
}

// poing fantôme : part de (x, y) dans la direction a, file sur d px
function ghostFist(st, x, y, a, d, max, s, c) {
  if (st.fists.length >= 44) st.fists.shift();
  st.fists.push({ x, y, a, d, t: 0, max, s, c });
}
// croissant d'impact devant Kenji : arc de rayon R (demi-angle arc) qui s'ouvre et s'efface
function slashArc(st, x, y, a, R, arc, c, max = 0.18) {
  if (st.arcs.length >= 16) st.arcs.shift();
  st.arcs.push({ x, y, a, R, arc, t: 0, max, c });
}
function sparks(fx, x, y, n, c, v, z = 18) {
  for (let i = 0; i < n && fx.sparks.length < 200; i++) { const a = Math.random() * TAU, s = rand(0.4, 1) * v; fx.sparks.push({ x, y, z, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.7, vz: rand(40, 200), life: 0.25, max: 0.25, c, w: 2.4 }); }
}
// geste du héros (models-hero-monk.js : MKP) ; prio = coupe un geste en cours
function gesture(fx, kind, a, prio = true) {
  const hs = fx.gfx.hs;
  if (!hs || fx.run.dying || (!prio && hs.atk > 0.5)) return;
  MKP.kind = kind;
  if (kind === 'punch' || kind === 'big') MKP.side = -MKP.side;
  hs.atk = 1; if (a != null) hs.atkA = a;
}

// renvoie true si l'événement est entièrement traité ici
export function eventMonk(fx, ev) {
  if (fx.run.cls.id !== 'monk') return false;
  const st = fx.mk || (fx.mk = init(fx)), p = fx.run.p, ov = fx.gfx.overlay;
  switch (ev.type) {
    case 'mk': {
      const { x, y, a } = ev;
      if (ev.kind === 'punch') {
        // direct : poing fantôme qui file jusqu'à la portée, choc à l'impact ; coup final : plus gros, onde en arc ;
        // tout autour : coup de pied tournoyant et anneau complet
        gesture(fx, ev.all ? 'spin' : ev.fin ? 'big' : 'punch', a);
        const R = ev.R, ix = x + Math.cos(a) * R * 0.8, iy = y + Math.sin(a) * R * 0.8, c = ev.evo ? GOLD : KI;
        ghostFist(st, x, y, a, R * 0.85, ev.fin ? 0.22 : 0.16, ev.fin ? 2.2 : 1.6, ev.evo ? '#ffe070' : ev.fin ? '#ffc860' : '#ffb43a');
        if (!ev.all) slashArc(st, x, y, a, R, ev.fin ? 1.0 : 0.55, ev.fin ? KI_L : KI, ev.fin ? 0.24 : 0.16);
        fx.glowPulse(ix, iy, 26, ev.fin ? 40 : 24, ev.fin ? KI_L : '#ffe8c0');
        if (ev.all) {
          fx.ring(x, y, 20, R, c, 10, 0.32); fx.ring(x, y, 10, R * 0.75, W, 6, 0.28, -0.04);
          for (let i = 0; i < 6; i++) ghostFist(st, x, y, a + i / 6 * TAU, R * 0.85, 0.22, 1.7, '#ffc860');
          fx.puff(x, y, 6, R * 0.4, 0.5, '#e8d8b8');
        } else if (ev.fin) {
          fx.ring(ix, iy, 6, 46, KI_L, 6, 0.25);
          sparks(fx, ix, iy, 6, c, 260);
          fx.gfx.kick = Math.max(fx.gfx.kick || 0, 2);
        } else sparks(fx, ix, iy, 2, '#ffe0a0', 200);
        return true;
      }
      if (ev.kind === 'palm') { gesture(fx, 'palm', a, false); fx.glowPulse(x + Math.cos(a) * 20, y + Math.sin(a) * 20, 26, ev.evo ? 50 : 34, KI_L); return true; }
      if (ev.kind === 'wave') {
        gesture(fx, 'wave', null, false);
        fx.ringAt(x, y, 30, KI_L, 0.8, 0.3, 0.4, 1, 0, 0, 0, 0.7, true);
        fx.puff(x, y, 4, 18, 0.5, '#e8d8b8');
        return true;
      }
      if (ev.kind === 'dragon') {
        gesture(fx, 'dragon', a, false);
        fx.pillars.push({ x, y, w: 60, h: 260, t: 0, max: 0.35, c: ev.evo ? GOLD : KI });
        fx.burstStars(x, y, 30, 8, ev.evo ? GOLD : KI, 200);
        return true;
      }
      if (ev.kind === 'kiboom' || ev.kind === 'dive') {
        // explosion de ki : boule de lumière dorée, anneaux, colonne pour le plongeon du dragon céleste
        const R = ev.R, dive = ev.kind === 'dive';
        fx.bursts.push({ x, y, h: 14, r: R * 1.3, t: 0, max: 0.45, c: KI });
        fx.ring(x, y, 10, R * 1.15, KI_L, dive ? 12 : 9, 0.4);
        fx.ring(x, y, 6, R * 0.85, SAFF, 7, 0.45, -0.05);
        fx.burstStars(x, y, 16, dive ? 18 : 10, GOLD, 300);
        fx.decal(x, y, R * 0.6, '#2a1808', 0.35);
        if (dive) { fx.pillars.push({ x, y, w: 110, h: 600, t: 0, max: 0.55, c: GOLD }); fx.rockBurst(x, y, 8, '#6a5a52', 240); }
        fx.gfx.kick = Math.max(fx.gfx.kick || 0, dive ? 5 : 3);
        return true;
      }
      return true;
    }
    case 'ult': {
      if (ev.kind !== 'thousand') return false;
      // Mille poings : éclair de ki, colonne dorée, bord de l'écran safran
      fx.bursts.push({ x: p.x, y: p.y, h: 24, r: 160, t: 0, max: 0.4, c: KI });
      fx.pillars.push({ x: p.x, y: p.y, w: 90, h: 520, t: 0, max: 0.45, c: GOLD });
      fx.ring(p.x, p.y, 20, 200, KI_L, 10, 0.4);
      fx.halo(KI, 3);
      if (ov) { ov.flashA = 0.15; ov.flashC = '255,190,80'; ov.edgeA = 0.6; ov.edgeC = '255,160,40'; }
      return true;
    }
    case 'mkfist': {
      // un coup de la rafale : 3 poings fantômes vers des points au hasard du cône, le héros enchaîne les directs
      gesture(fx, 'punch', ev.a);
      for (let i = 0; i < 4; i++) {
        const a = ev.a + rand(-ev.arc, ev.arc) * 0.85, d = ev.R * rand(0.35, 0.95), sx = ev.x + Math.cos(ev.a + (i - 1.5) * 1.0) * 18, sy = ev.y + Math.sin(ev.a + (i - 1.5) * 1.0) * 18;
        ghostFist(st, sx, sy, a, d, rand(0.16, 0.22), rand(1.6, 2.4), Math.random() < 0.3 ? '#ffe070' : '#ffb43a');
        if (Math.random() < 0.5) fx.glowPulse(ev.x + Math.cos(a) * d, ev.y + Math.sin(a) * d, 24, 30, KI_L);
      }
      if (ev.i % 3 === 0) fx.ra.ring(ev.x * S, 0.9, ev.y * S, ev.R * S, col(KI), 0.45, 0, 0.06, 2 * ev.arc / TAU, ev.a - ev.arc, 0, 0, 0.7);
      return true;
    }
    case 'mkwave': {
      // onde de ki finale : trois anneaux, colonne, cailloux, éclair safran
      const { x, y, R } = ev;
      fx.bursts.push({ x, y, h: 20, r: R, t: 0, max: 0.6, c: KI });
      for (let i = 0; i < 3; i++) fx.ring(x, y, 20, R * (0.8 + i * 0.2), i === 1 ? W : i ? SAFF : KI, 13, 0.6, -i * 0.08);
      fx.pillars.push({ x, y, w: 150, h: 700, t: 0, max: 0.8, c: KI_L });
      fx.burstStars(x, y, 30, 30, GOLD, 420);
      fx.rockBurst(x, y, 12, '#6a5a52', 300);
      fx.decal(x, y, R * 0.45, '#2a1808', 0.4);
      fx.puff(x, y, 12, 60, 0.7, '#f0e0c0');
      fx.halo(GOLD, 4);
      fx.gfx.kick = Math.max(fx.gfx.kick || 0, 9);
      gesture(fx, 'wave', null);
      if (ov) { ov.flashA = 0.45; ov.flashC = '255,220,140'; ov.edgeA = 0.5; ov.edgeC = '255,170,50'; }
      return true;
    }
    case 'mkflow': {
      // palier du Flux du combo : anneau safran au sol ; flux maximal : grand halo et étoiles
      fx.ring(p.x, p.y, 10, ev.max ? 120 : 70, ev.max ? GOLD : KI, ev.max ? 9 : 5, 0.35);
      if (ev.max) { fx.halo(KI, 2); fx.burstStars(p.x, p.y, 30, 12, GOLD, 240); }
      return true;
    }
    case 'mkend': return true;
  }
  return false;
}

export function frameMonk(fx, dt) {
  const run = fx.run;
  if (run.cls.id !== 'monk') return;
  const st = fx.mk || (fx.mk = init(fx)), p = run.p, t = fx.gfx.t;
  st.fist.begin(); st.ball.begin(); st.head.begin(); st.seg.begin();
  // poings fantômes : filent vers l'avant en grossissant, puis s'effacent
  let n = 0;
  for (const f of st.fists) {
    f.t += dt;
    if (f.t >= f.max) continue;
    st.fists[n++] = f;
    const k = f.t / f.max, e = 1 - (1 - k) ** 3, d = f.d * e, x = f.x + Math.cos(f.a) * d, y = f.y + Math.sin(f.a) * d, sc = f.s * (0.7 + 0.5 * k);
    const i = st.fist.put(x * S, 1.3, y * S, -f.a, sc, sc, sc);
    st.fist.tint(i, col(f.c)); st.fist.alpha(i, 0.95 * (1 - k * k));
    fx.glow(x, y, 26, 18 * sc, KI, 0.5 * (1 - k));
    fx.line((x - Math.cos(f.a) * 40 * sc) * S, 1.3, (y - Math.sin(f.a) * 40 * sc) * S, x * S, 1.3, y * S, 0.45 * sc, KI_L, 0.45 * (1 - k));
  }
  st.fists.length = n;
  n = 0;
  for (const c of st.arcs) {
    c.t += dt;
    if (c.t >= c.max) continue;
    st.arcs[n++] = c;
    const k = c.t / c.max, r = c.R * (0.7 + 0.35 * (1 - (1 - k) ** 2));
    fx.ra.ring(c.x * S, 0.9, c.y * S, r * S, col(c.c), 0.95 * (1 - k), 0, 0.3 * (1 - k * 0.5), 2 * c.arc / TAU, c.a - c.arc, 0, 0, 0.9);
    fx.rg.ring(c.x * S, 0.07, c.y * S, r * S, col(KI), 0.35 * (1 - k), 0, 0.3, 2 * c.arc / TAU, c.a - c.arc, 0, 0, 0);
  }
  st.arcs.length = n;
  for (const w of p.weapons) {
    if (!w.q) continue;
    if (w.id === 'fists') for (const o of w.q) { // poings de ki projetés (Rafale du tigre)
      if (!o.on) continue;
      const a = Math.atan2(o.vy, o.vx), sc = o.big ? 2.2 : 1.6, i = st.fist.put(o.x * S, 1.3, o.y * S, -a, sc, sc, sc);
      st.fist.tint(i, col(o.big ? W : '#ffe090')); st.fist.alpha(i, 0.9);
      fx.glow(o.x, o.y, 26, o.big ? 40 : 28, KI, 0.7);
      fx.line(o.x * S, 1.3, o.y * S, (o.x - o.vx * 0.12) * S, 1.3, (o.y - o.vy * 0.12) * S, sc * 0.6, GOLD, 0.45);
      fx.shadow(o.x, o.y, 18 * sc, 0.2);
    } else if (w.id === 'kipalm') for (const o of w.q) { // boules de ki : cœur blanc, halo doré, anneau qui tourne, étincelles
      if (!o.on) continue;
      const big = !!o.boom, r = o.r, z = 26 + r * 0.4, pulse = 1 + Math.sin(t * 24 + o.x * 0.1) * 0.08, i = st.ball.put(o.x * S, z * S, o.y * S, t * 3, r * 1.2 * S * pulse);
      st.ball.tint(i, col(big ? '#fffbe8' : '#fff4d0'));
      fx.glow(o.x, o.y, z, r * 3.2, big ? GOLD : KI, 0.85);
      fx.glow(o.x, o.y, z, r * 1.6, W, 0.9);
      fx.ra.ring(o.x * S, z * S, o.y * S, r * 1.6 * S, col(big ? '#ffe48a' : SAFF), 0.7, 0, 0.18, 0.6, t * 9 + o.x, 0, 0, 0.7);
      fx.shadow(o.x, o.y, r * 2, 0.25);
      const vx = o.vx / (Math.hypot(o.vx, o.vy) || 1), vy = o.vy / (Math.hypot(o.vx, o.vy) || 1);
      fx.line(o.x * S, z * S, o.y * S, (o.x - vx * r * 3.5) * S, z * S, (o.y - vy * r * 3.5) * S, r * 1.1 * S, KI, 0.35);
      if (Math.random() < 0.6 && fx.stars.length < 300) fx.stars.push({ x: o.x - vx * r + rand(-r, r) * 0.6, y: o.y - vy * r + rand(-r, r) * 0.4, z: z + rand(-r, r) * 0.5, vx: 0, vy: 0, vz: 20, life: 0.3, max: 0.3, c: Math.random() < 0.5 ? W : GOLD, s: big ? 1.4 : 1 });
    } else if (w.id === 'chiwave') for (const o of w.q) { // ondes : anneau lumineux qui s'élargit, voile au sol, poussière
      if (!o.on || o.d > 0) continue;
      const k = o.r / o.R, a = 1 - k * 0.7, ev = w.evo;
      fx.ringAt(o.x, o.y, o.r, ev ? KI_L : KI, a, clamp(18 / o.r, 0.03, 0.4), 0, 1, 0, 0, 0, 0.85, true, 0.12);
      fx.ringAt(o.x, o.y, o.r, ev ? '#fff8d8' : '#ffe0a0', 0.16 * a, 0.001, 1, 1, 0, 0, 0, 0, true, 0.1);
      fx.ringAt(o.x, o.y, o.r * 0.82, ev ? '#9ae8ff' : SAFF, 0.5 * a, 0.03, 0, 1, t * 2, 12, 1, 0.4, true, 0.11);
      if (Math.random() < 0.6 && fx.puffs.length < 200) { const an = Math.random() * TAU; fx.puffs.push({ x: o.x + Math.cos(an) * o.r, y: o.y + Math.sin(an) * o.r, z: 4, vx: Math.cos(an) * 60, vy: Math.sin(an) * 40, vz: 25, s: rand(6, 10), life: 0.35, max: 0.35, a: 0.4, c: '#e8d8b8' }); }
    } else if (w.id === 'kidragon') for (const o of w.q) { // dragons : corps d'anneaux qui suit la traînée, tête qui regarde où il va
      if (!o.on) continue;
      const E = o.evo, kz = o.r / 22, life = clamp(o.t / 0.2, 0, 1) * clamp((o.life - o.t) / 0.3, 0, 1), z = 30 + Math.sin(o.t * 6 + o.ph) * 6;
      const hc = col(E ? '#fff4c0' : W), bc = col(E ? '#ffe9a0' : '#fff0d8');
      for (let j = 1; j < o.pn; j++) {
        const ii = (o.pi - j + NS) % NS, jn = (ii - 1 + NS) % NS, x = o.px[ii], y = o.py[ii], k = 1 - j / NS;
        const a = j + 1 < o.pn ? Math.atan2(y - o.py[jn], x - o.px[jn]) : o.a, sc = (0.55 + 0.75 * k) * kz * 1.3 * life;
        const zz = z + Math.sin(o.t * 6 + o.ph - j * 0.5) * 8 - (1 - k) * 10;
        const i = st.seg.put(x * S, zz * S, y * S, -a, sc, sc, sc);
        st.seg.tint(i, bc);
        if (j % 3 === 0) fx.glow(x, y, zz, 22 * sc, E ? GOLD : KI, 0.45);
      }
      const i = st.head.put(o.x * S, z * S, o.y * S, -o.a, kz * 1.7 * life);
      st.head.tint(i, hc);
      fx.glow(o.x, o.y, z, 40 * kz, E ? GOLD : KI, 0.7);
      fx.shadow(o.x, o.y, 30 * kz, 0.22);
      if (Math.random() < 0.5 && fx.sparks.length < 190) fx.sparks.push({ x: o.x - Math.cos(o.a) * 14, y: o.y - Math.sin(o.a) * 14, z, vx: rand(-40, 40), vy: rand(-40, 40), vz: rand(20, 80), life: 0.3, max: 0.3, c: E ? GOLD : SAFF, w: 2 });
    }
  }
  // Mille poings en cours : cône de ki au sol devant Kenji, lueur sur lui
  const u = run.mku;
  if (u && !run.dying) {
    const U = MKB.ult, R = U.R * p.area, fl = 0.5 + Math.sin(t * 40) * 0.2;
    fx.ringAt(p.x, p.y, R, KI, 0.18 * fl + 0.08, 0.001, 1, 2 * U.arc / TAU, u.a - U.arc, 0, 0, 0, true, 0.08);
    fx.ringAt(p.x, p.y, R, KI_L, 0.7, 0.025, 0, 2 * U.arc / TAU, u.a - U.arc, 16, 3, 0.5, true, 0.09);
    fx.glow(p.x, p.y, 26 + p.h, 60, KI, 0.55 + Math.sin(t * 30) * 0.15);
  }
  // Flux du combo : lueur safran autour des poings qui grandit avec le flux, étincelles qui montent ; anneau au flux maximal
  const fk = (run.mkF || 0) / MKB.flow.max;
  st.flowK += (fk - st.flowK) * Math.min(1, dt * 6);
  if (st.flowK > 0.05 && !run.dying) {
    const k = st.flowK, fx0 = p.face.x, fy0 = p.face.y;
    fx.glow(p.x + fx0 * 12, p.y + fy0 * 12, 20 + p.h, 26 + 26 * k, KI, 0.25 + 0.35 * k);
    if (Math.random() < k * 0.7 && fx.sparks.length < 190) { const a = Math.random() * TAU; fx.sparks.push({ x: p.x + Math.cos(a) * 14, y: p.y + Math.sin(a) * 10, z: 8, vx: 0, vy: 0, vz: rand(90, 180), life: 0.4, max: 0.4, c: Math.random() < 0.5 ? GOLD : SAFF, w: 2 }); }
    if (k > 0.98) fx.ringAt(p.x, p.y, 34, KI, 0.7, 0.08, 0, 1, t * 2.5, 6, 1.6, 0.6, true, 0.1);
  }
  st.fist.end(); st.ball.end(); st.head.end(); st.seg.end();
}
