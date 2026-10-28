// Effets 3D de l'Arsenal W1 (js/arsenal-w1.js) : étoiles qui tombent (Lumi), flèches explosives et pièges à mâchoires
// (Kira), boucliers volants et marteaux du jugement (Brok), stalactites et orages de grêle (Frida). Branché sur Fx (fx.js)
// par trois appels, comme fx-c1.js : initW1 (création), eventW1 (événements 'w1' : impacts, explosions, morsures, rebonds,
// ondes, éclats, grêlons) et frameW1 (chaque image : objets en vol lus sur les armes w.q / w.q2, geste d'attaque du héros).
// Tout est instancié ; les modèles d'une arme sont construits la 1re fois qu'elle apparaît (d'avance pour le champion
// joué). Ne modifie jamais la partie (seulement gfx.hs, l'état d'animation du héros).
import { S, TAU, PITCH, clamp, rand, easeOut, backOut, col, Build, G, T, lowpoly, Pool, THREE } from './kit.js';

const IDS = ['starfall', 'blastarrow', 'traps', 'shieldthrow', 'hammer', 'icicles', 'hail'];
const W = '#ffffff', GOLD = '#ffd54a', STAR = '#ffe48a', BLUE = '#8ac8ff', FIRE = '#ff9a3a', KIRA = '#7ab8ff', ICE = '#bfeaff';
const UPY = Math.cos(PITCH), UPZ = -Math.sin(PITCH), VY = -Math.sin(PITCH), VZ = -Math.cos(PITCH); // haut de l'écran, regard

// ---------- Modèles (unités 3D : 1 = 20 px) ----------
const unlit = () => new THREE.MeshBasicMaterial({ vertexColors: true });
const MK = {
  // étoile à 5 branches dans le plan XY (tournée face à la caméra au rendu), teintée par instance
  starfall: root => {
    const b = new Build(11);
    b.add(G.ico(0.34, 0), '#ffffff', T(0, 0, 0, 1, 1, 0.55));
    for (let i = 0; i < 5; i++) { const a = Math.PI / 2 + i * TAU / 5; b.add(G.cone(0.25, 0.66, 4), (x, y) => (Math.hypot(x, y) > 0.6 ? '#ffffff' : '#fff2b0'), T(Math.cos(a) * 0.44, Math.sin(a) * 0.44, 0, 1, 1, 0.5, 0, 0, a - Math.PI / 2), 0.04); }
    return { star: new Pool(root, b.geo(), unlit(), 64, { color: true, order: 7 }) };
  },
  // flèche lourde : hampe, empennage bleu de Kira, bombe de fer cerclée de rouge à la pointe, mèche
  blastarrow: root => {
    const b = new Build(5);
    b.add(G.box(1.5, 0.11, 0.11), '#8a6a4a', T(-0.1, 0, 0));
    b.add(G.box(0.4, 0.05, 0.3), '#4f8fe6', T(-0.72, 0, 0)); b.add(G.box(0.4, 0.3, 0.05), '#9cc6ff', T(-0.72, 0, 0));
    b.add(G.ico(0.34, 1), '#3a3a48', T(0.82, 0, 0), 0.06);
    b.add(G.cyl(0.36, 0.36, 0.12, 8), '#d83a1a', T(0.82, 0, 0, 1, 1, 1, 0, 0, Math.PI / 2));
    b.add(G.cyl(0.04, 0.04, 0.26, 4), '#c8b080', T(1.05, 0.25, 0, 1, 1, 1, 0, 0, -0.6));
    return { arrow: new Pool(root, b.geo(), lowpoly(), 16) };
  },
  // piège à mâchoires : socle (plaque, palette, ressorts, piquet et chaîne) + une mâchoire en demi-cercle à dents,
  // charnière sur l'axe X, couchée vers +Z (posée deux fois, la 2e tournée d'un demi-tour)
  traps: root => {
    const b = new Build(9);
    b.add(G.cyl(0.98, 1.04, 0.1, 12), '#4a4e5a', T(0, 0.05, 0), 0.05);
    b.add(G.cyl(0.36, 0.36, 0.08, 8), '#9aa2b0', T(0, 0.12, 0));
    b.add(G.cyl(0.14, 0.14, 0.1, 6), '#4f8fe6', T(0, 0.17, 0));
    for (const s of [-1, 1]) b.add(G.box(0.5, 0.1, 0.16), '#6a7080', T(s * 1.12, 0.07, 0));
    b.add(G.cyl(0.06, 0.06, 0.5, 5), '#5a5e68', T(-1.45, 0.18, 0.2, 1, 1, 1, 0.3, 0, 0.2));
    const j = new Build(10);
    j.add(G.tor(0.92, 0.09, 4, 12, Math.PI), '#b8c0cc', T(0, 0.1, 0, 1, 1, 1, Math.PI / 2, 0, 0), 0.06);
    for (let i = 0; i < 7; i++) { const a = (i + 0.5) / 7 * Math.PI; j.add(G.cone(0.09, 0.3, 4), '#eef2f8', T(Math.cos(a) * 0.86, 0.26, Math.sin(a) * 0.86), 0.04); }
    return { base: new Pool(root, b.geo(), lowpoly(), 16, { color: true }), jaw: new Pool(root, j.geo(), lowpoly(), 32, { color: true }) };
  },
  // bouclier rond de Brok : face bleue, bord et umbo dorés, croix blanche (à plat ; incliné vers la caméra au rendu)
  shieldthrow: root => {
    const b = new Build(7);
    b.add(G.cyl(1, 1, 0.16, 14), '#2f55b8', T(), 0.05);
    b.add(G.tor(1, 0.13, 4, 16), '#e6b422', T(0, 0, 0, 1, 1, 1, Math.PI / 2, 0, 0), 0.05);
    b.add(G.box(1.5, 0.06, 0.3), '#f2f4f8', T(0, 0.1, 0)); b.add(G.box(0.3, 0.06, 1.5), '#f2f4f8', T(0, 0.1, 0));
    b.add(G.cyl(0.3, 0.36, 0.2, 8), '#ffd54a', T(0, 0.14, 0));
    return { shield: new Pool(root, b.geo(), lowpoly(), 8, { color: true }) };
  },
  // marteau sacré : tête d'acier cerclée d'or, manche de bois, pommeau doré (tête centrée en 0, manche vers +Y)
  hammer: root => {
    const b = new Build(13);
    b.add(G.box(1.5, 0.86, 0.86), '#d8dce6', T(), 0.05);
    for (const s of [-1, 1]) { b.add(G.box(0.14, 0.94, 0.94), '#e6b422', T(s * 0.5, 0, 0)); b.add(G.box(0.1, 0.62, 0.62), '#f4f6fa', T(s * 0.8, 0, 0)); }
    b.add(G.oct(0.24), '#ffd54a', T(0, 0, 0.45, 1, 1, 0.5));
    b.add(G.cyl(0.11, 0.13, 2.3, 6), '#8a5a32', T(0, 1.55, 0));
    b.add(G.cyl(0.15, 0.15, 0.2, 6), '#e6b422', T(0, 1.9, 0));
    b.add(G.oct(0.2), '#ffd54a', T(0, 2.78, 0));
    return { hammer: new Pool(root, b.geo(), lowpoly(), 8, { color: true }) };
  },
  // stalactite : longue pointe de glace vers +X (pointe blanche, base bleue), non éclairée pour rester vive
  icicles: root => {
    const b = new Build(3);
    b.add(G.cone(0.2, 1.5, 5), (x, y, z) => (x > 0.6 ? '#ffffff' : x > 0 ? '#c8ecff' : '#6ec0f0'), T(0.15, 0, 0, 1, 1, 1, 0, 0, -Math.PI / 2), 0.08);
    b.add(G.oct(0.2), '#e8f8ff', T(-0.55, 0, 0, 1.4, 1, 1));
    return { spike: new Pool(root, b.geo(), unlit(), 64, { color: true }) };
  },
  // grêlon : petit caillou de glace
  hail: root => {
    const b = new Build(4);
    b.add(G.ico(0.32, 0), '#f4fbff', T(), 0.12); b.add(G.ico(0.18, 0), '#bfe2ff', T(0.15, 0.12, 0.08));
    return { stone: new Pool(root, b.geo(), unlit(), 80, { color: true }) };
  },
};

export function initW1(fx) {
  const st = { P: {}, fn: {}, list: [] };
  for (const id of fx.run.cls.arsenal || []) if (MK[id]) pools(fx, st, id); // champion joué : modèles prêts d'avance
  return st;
}
function pools(fx, st, id) {
  let o = st.P[id];
  if (!o) { o = st.P[id] = MK[id](fx.root); for (const P of Object.values(o)) st.list.push(P); }
  return o;
}

// renvoie true si l'événement est entièrement traité ici
export function eventW1(fx, ev) {
  if (ev.type !== 'w1') return false;
  const { x, y, R } = ev;
  switch (ev.kind) {
    case 'star': {
      // impact d'étoile : éclat de lumière, onde, étoiles qui jaillissent ; comète : colonne de lumière et cailloux
      const c = ev.big ? STAR : ev.evo ? BLUE : GOLD;
      fx.bursts.push({ x, y, h: 8, r: R * 1.15, t: 0, max: ev.big ? 0.45 : 0.3, c });
      fx.ring(x, y, 8, R * 1.15, ev.big ? W : c, ev.big ? 11 : 7, ev.big ? 0.45 : 0.3);
      fx.burstStars(x, y, 12, ev.big ? 22 : 7, c, ev.big ? 400 : 220);
      fx.decal(x, y, R * 0.55, '#1a1430', 0.3);
      if (ev.big) {
        fx.pillars.push({ x, y, w: 120, h: 560, t: 0, max: 0.6, c: STAR });
        fx.ring(x, y, 10, R * 1.6, BLUE, 8, 0.5, -0.06);
        fx.rockBurst(x, y, 8, '#6a5a72', 260); fx.puff(x, y, 8, R * 0.5, 0.7, '#e8e0ff');
        fx.gfx.kick = Math.max(fx.gfx.kick || 0, 5);
      }
      return true;
    }
    case 'blast': {
      // explosion : boule de feu orange, onde bleue de Kira, fumée, cailloux, étincelles
      fx.bursts.push({ x, y, h: 10, r: R * 1.35, t: 0, max: 0.4, c: FIRE });
      fx.ring(x, y, 10, R * 1.2, '#ffd27a', ev.evo ? 11 : 9, 0.35);
      fx.ring(x, y, 6, R * 0.95, KIRA, 6, 0.42, -0.05);
      fx.puff(x, y, ev.evo ? 9 : 6, R * 0.5, 0.8, '#ffd0a0');
      fx.rockBurst(x, y, 4, '#5a4a42', 180);
      fx.decal(x, y, R * 0.7, '#1a1010', 0.4);
      fx.burstStars(x, y, 10, 6, '#ffb04a', 220);
      sparks(fx, x, y, 8, '#ffb04a', 300);
      fx.gfx.kick = Math.max(fx.gfx.kick || 0, ev.evo ? 4 : 2);
      return true;
    }
    case 'frag':
      fx.bursts.push({ x, y, h: 6, r: R * 1.4, t: 0, max: 0.28, c: '#ffb04a' });
      fx.ring(x, y, 4, R * 1.1, '#ffd27a', 5, 0.25);
      fx.puff(x, y, 2, R * 0.5, 0.6, '#ffd0a0');
      return true;
    case 'snap':
      // clac : éclair blanc, anneau bleu, étincelles métalliques
      fx.ring(x, y, R * 1.3, R * 0.6, ev.evo ? GOLD : KIRA, 6, 0.22);
      fx.glowPulse(x, y, 10, R * 0.9, '#e8f4ff');
      sparks(fx, x, y, 6, '#e8f0ff', 220);
      fx.puff(x, y, 3, 10, 0.5, '#c8c0b0');
      return true;
    case 'bounce':
      // rebond du bouclier : choc blanc ; évolué : onde sacrée dorée
      fx.glowPulse(x, y, 26, 34, ev.evo ? STAR : '#cfe0ff');
      sparks(fx, x, y, 5, ev.evo ? GOLD : W, 260, 26);
      if (ev.evo) { fx.ring(x, y, 10, R, GOLD, 8, 0.32); fx.ring(x, y, 6, R * 0.7, W, 5, 0.28, -0.04); }
      return true;
    case 'hammer': {
      // coup du jugement : sol fendu, ondes dorées, colonne de lumière, cailloux, poussière
      fx.decal(x, y, R * 0.45, '#1a1208', 0.55);
      fx.ring(x, y, 20, R, GOLD, ev.evo ? 14 : 11, 0.45);
      fx.ring(x, y, 10, R * 0.75, W, 7, 0.4, -0.05);
      fx.pillars.push({ x, y, w: ev.evo ? 120 : 90, h: 520, t: 0, max: 0.5, c: STAR });
      fx.rockBurst(x, y, ev.evo ? 12 : 8, '#6a5a52', 260);
      fx.burstStars(x, y, 20, ev.evo ? 18 : 12, STAR, 320);
      fx.puff(x, y, ev.evo ? 10 : 7, R * 0.4, 0.8, '#e0d4b8');
      fx.gfx.kick = Math.max(fx.gfx.kick || 0, ev.evo ? 7 : 5);
      return true;
    }
    case 'wave2': fx.ring(x, y, R * 0.45, R, '#fff0a0', 10, 0.42); fx.puff(x, y, 6, R * 0.6, 0.6, '#e0d4b8'); return true;
    case 'shatter': fx.shardRing(x, y, R * 0.7, 5, W, 0.55); fx.burstStars(x, y, 14, 5, '#e8f8ff', 180); fx.ring(x, y, 4, R, ICE, 5, 0.25); return true;
    case 'hail':
      fx.ring(x, y, 3, R, ev.evo ? W : '#e8f8ff', ev.evo ? 4 : 3, 0.2);
      sparks(fx, x, y, 2, '#e8f8ff', 160, 4);
      if (Math.random() < 0.3) fx.puff(x, y, 1, 6, 0.4, '#e8f4ff');
      return true;
    case 'storm': fx.ring(x, y, R * 1.25, R, ICE, 5, 0.45); return true;
  }
  return true;
}
function sparks(fx, x, y, n, c, v, z = 10) {
  for (let i = 0; i < n && fx.sparks.length < 200; i++) { const a = Math.random() * TAU, s = rand(0.4, 1) * v; fx.sparks.push({ x, y, z, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.7, vz: rand(60, 220), life: 0.28, max: 0.28, c, w: 2.4 }); }
}

export function frameW1(fx, dt) {
  const st = fx.w1;
  if (!st) return;
  const run = fx.run, p = run.p, g = fx.gfx, t = g.t, hs = g.hs;
  for (const P of st.list) P.begin();
  for (const w of p.weapons) {
    if (!MK[w.id] || !w.q) continue;
    const P = pools(fx, st, w.id);
    // geste d'attaque du héros à chaque tir
    if (w.fn !== st.fn[w.id]) { st.fn[w.id] = w.fn; if (hs && hs.atk < 0.6 && !run.dying) { hs.atk = 1; hs.atkA = w.fa; } }
    DRAW[w.id](fx, P, w, t, dt);
  }
  for (const P of st.list) P.end();
}

// quad face caméra tourné de r (étoiles)
function face(P, X, Y, Z, s, r, c, a = 1) {
  const cr = Math.cos(r), sr = Math.sin(r);
  const i = P.putB(X, Y, Z, cr * s, sr * s * UPY, sr * s * UPZ, -sr * s, cr * s * UPY, cr * s * UPZ, 0, -VY * s, -VZ * s);
  P.tint(i, col(c), a);
}

const DRAW = {
  starfall(fx, P, w, t) {
    const E = w.evo;
    for (const o of w.q) {
      if (!o.on) continue;
      const k = clamp(o.t / o.dur, 0, 1), c = o.big ? STAR : E ? BLUE : GOLD;
      // au sol : cercle d'impact qui se remplit et ombre qui grandit
      fx.ringAt(o.x, o.y, o.R, c, 0.35 + 0.5 * k, 0.05, 0.05 + 0.18 * k * k, 1, t * 1.5 + o.x, 10, 0.6, 0.5, true);
      fx.shadow(o.x, o.y, o.R * (0.5 + 0.8 * k), 0.15 + 0.3 * k);
      if (o.t < 0) continue;
      // l'étoile tombe en biais depuis le ciel (en haut à droite), traînée lumineuse derrière elle
      const H = o.big ? 640 : 520, h = H * (1 - k) * (1 - k * 0.15) + 10, sx = o.x + (h - 10) * 0.35, X = sx * S, Y = h * S, Z = o.y * S;
      const s = (o.big ? 2.8 : E ? 1.45 : 1.2) * (1 + Math.sin(t * 20 + o.x) * 0.06), L = o.big ? 260 : 150;
      face(P.star, X, Y, Z, s, t * 5 + o.x, o.big ? '#fff6d0' : E ? '#d8ecff' : '#fff0a0');
      fx.glow(sx, o.y, h, o.big ? 70 : 34, c, 0.9);
      fx.line(X, Y, Z, X + L * 0.33 * S, Y + L * 0.94 * S, Z, o.big ? 2.2 : 0.95, c, 0.55);
      fx.line(X, Y, Z, X + L * 0.2 * S, Y + L * 0.56 * S, Z, o.big ? 0.8 : 0.32, W, 0.9);
      if (Math.random() < (o.big ? 0.8 : 0.3) && fx.stars.length < 300) fx.stars.push({ x: sx + rand(-6, 6), y: o.y + rand(-4, 4), z: h + rand(-6, 6), vx: 0, vy: 0, vz: 0, life: 0.35, max: 0.35, c: Math.random() < 0.5 ? W : c, s: o.big ? 1.6 : 0.9 });
    }
  },
  blastarrow(fx, P, w, t) {
    for (const o of w.q) {
      if (!o.on) continue;
      const a = Math.atan2(o.vy, o.vx), z = 30 + Math.sin(o.life * 9) * 3, ca = Math.cos(a), sa = Math.sin(a);
      P.arrow.put(o.x * S, z * S, o.y * S, -a, 1.35);
      fx.shadow(o.x, o.y, 22, 0.28);
      // mèche qui crépite à la pointe, petite traînée de fumée
      const fx_ = o.x + ca * 24, fy = o.y + sa * 24;
      fx.glow(fx_, fy, z + 6, 12 + Math.sin(t * 40 + o.x) * 4, '#ffb04a', 0.95);
      fx.line(o.x * S, z * S, o.y * S, (o.x - ca * 46) * S, z * S, (o.y - sa * 46) * S, 0.3, '#ffd27a', 0.45);
      if (Math.random() < 0.35 && fx.puffs.length < 200) fx.puffs.push({ x: o.x - ca * 20, y: o.y - sa * 20, z, vx: 0, vy: 0, vz: 15, s: rand(5, 8), life: 0.4, max: 0.4, a: 0.35, c: '#b8b0a8' });
      if (Math.random() < 0.4 && fx.sparks.length < 190) fx.sparks.push({ x: fx_, y: fy, z: z + 8, vx: rand(-60, 60), vy: rand(-60, 60), vz: rand(40, 120), life: 0.2, max: 0.2, c: '#ffd27a', w: 1.8 });
    }
    // éclats de la flèche à fragmentation : braises en cloche vers leur point de chute
    for (const f of w.q2) {
      if (!f.on) continue;
      const k = clamp(f.t / f.dur, 0, 1), x = f.sx + (f.x - f.sx) * k, y = f.sy + (f.y - f.sy) * k, h = Math.sin(k * Math.PI) * 70 + 6;
      fx.glow(x, y, h, 16, '#ffb04a', 0.95); fx.glow(x, y, h, 6, W, 1);
      fx.shadow(x, y, 10, 0.25);
    }
  },
  traps(fx, P, w, t) {
    const E = w.evo;
    for (const o of w.q) {
      if (!o.on) continue;
      const k = o.R / 22 * (E ? 1.1 : 1);
      let up, pop = 1, sink = 0;
      if (o.s === 1) up = Math.min(1, (o.hold - o.c) / 0.07) * 1.42 + 0.05; // refermé sur sa proie
      else if (o.s === 2) { up = 1.47; sink = 1 - o.f / 0.35; } // cassé : s'enfonce
      else { const a = Math.max(0, o.arm); up = 0.1 + Math.min(1, a / 0.45) * 1.3; if (o.n === (E ? 3 : 1)) pop = backOut(clamp(1 - a / 0.45, 0, 1)) * 0.7 + 0.3; }
      const s = k * pop * (1 - sink * 0.6), y = -sink * 0.3;
      const i = P.base.put(o.x * S, y, o.y * S, o.a, s);
      P.base.tint(i, col(E ? '#ffe9b0' : W));
      for (let j = 0; j < 2; j++) jaw(P.jaw, o.x * S, y + 0.12 * s, o.y * S, o.a + j * Math.PI, up, s, o.s === 1 ? '#ffd0d0' : E ? '#ffe9b0' : W);
      if (o.s === 0 && o.arm <= 0) { // armé : cercle de prise et voyant bleu qui clignote
        fx.ringAt(o.x, o.y, o.R, E ? GOLD : KIRA, 0.4, 0.05, 0.05, 1, t * 0.8 + o.a, 8, 0.5, 0.4, true);
        if (Math.sin(t * 6 + o.a * 3) > 0.3) fx.glow(o.x, o.y, 6, 10 * k, E ? GOLD : KIRA, 0.8);
      } else if (o.s === 1) {
        fx.ringAt(o.x, o.y, o.R, '#ff5a5a', 0.45, 0.06, 0.12, 1, 0, 0, 0, 0.4);
        if (Math.random() < 0.15 && fx.sparks.length < 190) fx.sparks.push({ x: o.x + rand(-8, 8), y: o.y + rand(-6, 6), z: 14, vx: rand(-40, 40), vy: rand(-40, 40), vz: rand(60, 140), life: 0.3, max: 0.3, c: '#ff4a5a', w: 2 });
      }
    }
  },
  shieldthrow(fx, P, w, t) {
    const E = w.evo, al = 0.55;
    for (const o of w.q) {
      if (!o.on) continue;
      const k = o.R / 20 * 1.15 * (E ? 1.15 : 1), z = 30, X = o.x * S, Y = z * S, Z = o.y * S, s = -o.spin;
      // disque incliné vers la caméra (al), qui tourne sur lui-même (s)
      const cs = Math.cos(s), ss = Math.sin(s), ca = Math.cos(al), sa = Math.sin(al);
      const i = P.shield.putB(X, Y, Z, cs * k, ss * sa * k, -ss * ca * k, 0, ca * k, sa * k, ss * k, -cs * sa * k, cs * ca * k);
      P.shield.tint(i, col(E ? '#ffe9a0' : W));
      fx.glow(o.x, o.y, z, 26 * k, E ? STAR : '#9cc6ff', 0.55);
      fx.shadow(o.x, o.y, 30 * k, 0.28);
      const v = Math.hypot(o.vx, o.vy) || 1, L = 50;
      fx.line(X, Y, Z, (o.x - o.vx / v * L) * S, Y, (o.y - o.vy / v * L) * S, 0.8 * k, E ? GOLD : '#9cc6ff', 0.4);
      if (E && Math.random() < 0.4 && fx.stars.length < 300) fx.sparkle(o.x + rand(-14, 14), o.y + rand(-8, 8), z, STAR);
    }
  },
  hammer(fx, P, w, t) {
    const E = w.evo;
    for (const o of w.q) {
      if (!o.on) continue;
      const k = (E ? 2.3 : 1.7) * (o.R > 140 ? 1.1 : 1);
      let h, th, a = 1;
      if (o.s === 0) {
        // le marteau descend du ciel en pivotant (de côté vers la verticale), annoncé par un cercle doré
        const q = clamp(o.t / o.dur, 0, 1), e = q * q;
        h = 420 * (1 - e) + 0.45 * k * 20; th = 1.5 * (1 - e) + 0.15;
        const kk = 0.3 + 0.7 * q;
        fx.ringAt(o.x, o.y, o.R, GOLD, 0.45 + 0.4 * q, 0.04, 0.06 + 0.14 * q, 1, -t * 1.2, 12, -0.6, 0.5, true);
        fx.ringAt(o.x, o.y, 26 + 14 * kk, W, 0.6 * q, 0.15, 0.2, 1, 0, 0, 0, 0.6, true);
        fx.shadow(o.x, o.y, 40 * kk * k / 1.7, 0.2 + 0.3 * q);
        fx.beam(o.x, o.y, 30 + 30 * q, 700, STAR, 0.18 + 0.25 * q);
      } else {
        // planté dans le sol, puis il s'enfonce et disparaît
        const sink = o.s === 2 ? clamp(o.t / 0.5, 0, 1) : 0;
        h = 0.45 * k * 20 - sink * 40; th = 0.15; a = 1 - sink;
        if (a <= 0.02) continue;
      }
      const c = Math.cos(th), s = Math.sin(th), sc = k * (0.8 + 0.2 * a);
      const i = P.hammer.putB(o.x * S, h * S, o.y * S, c * sc, s * sc, 0, -s * sc, c * sc, 0, 0, 0, sc);
      P.hammer.tint(i, col(E ? '#fff0c0' : W));
      fx.glow(o.x, o.y, h, 34 * k / 1.7, STAR, 0.5 * a);
    }
  },
  icicles(fx, P, w, t) {
    const E = w.evo;
    for (const o of w.q) {
      if (!o.on) continue;
      const a = Math.atan2(o.vy, o.vx), z = 24, sc = E ? 1.6 : 1.1, ca = Math.cos(a), sa = Math.sin(a);
      const i = P.spike.put(o.x * S, z * S, o.y * S, -a, sc, sc, sc);
      P.spike.tint(i, col(W));
      fx.glow(o.x, o.y, z, E ? 22 : 14, ICE, 0.45);
      fx.line(o.x * S, z * S, o.y * S, (o.x - ca * 40) * S, z * S, (o.y - sa * 40) * S, E ? 0.5 : 0.3, ICE, 0.45);
      fx.shadow(o.x, o.y, 14 * sc, 0.2);
      if (Math.random() < 0.15) fx.sparkle(o.x, o.y, z, '#e8f8ff');
    }
  },
  hail(fx, P, w, t) {
    const E = w.evo;
    for (const o of w.q) { // orages : nuage gris-bleu qui tourne au-dessus de la zone, cercle au sol
      if (!o.on) continue;
      const fade = Math.min(1, o.t / 0.25) * clamp((o.dur + 0.6 - o.t) / 0.6, 0, 1), R = o.R, n = E ? 9 : 7;
      fx.ringAt(o.x, o.y, R, ICE, 0.5 * fade, 0.03, 0.05, 1, t * 0.4 + o.x, 18, 0.4, 0.5);
      fx.shadow(o.x, o.y, R * 1.5, 0.16 * fade);
      for (let j = 0; j < n; j++) {
        const an = j / n * TAU + t * 0.35 + o.x, r = R * (j % 2 ? 0.62 : 0.28), x = o.x + Math.cos(an) * r, y = o.y + Math.sin(an) * r * 0.8;
        const i = fx.pf.put(x * S, (190 + (j % 3) * 14) * S, y * S, 0, (E ? 86 : 70) * (0.85 + (j % 3) * 0.12) * S);
        fx.pf.tint(i, col(E ? (j % 2 ? '#5a6a88' : '#7a88a4') : (j % 2 ? '#8a98b0' : '#a8b4c8'))); fx.pf.alpha(i, 0.6 * fade);
      }
      if (E && Math.random() < 0.04) fx.glow(o.x + rand(-R, R) * 0.5, o.y, 200, R * 0.8, '#bfe0ff', 0.6);
    }
    for (const s of w.q2) { // grêlons : tombent en biais (vent), traînée blanche
      if (!s.on) continue;
      const k = clamp(s.t / s.dur, 0, 1), h = 190 * (1 - k) + 4, x = s.x + (h - 4) * 0.18, X = x * S, Y = h * S, Z = s.y * S, sc = s.big ? 1.25 : 0.9;
      const i = P.stone.put(X, Y, Z, s.x + t * 9, sc);
      P.stone.tint(i, col(W));
      fx.line(X, Y, Z, X + 5 * S, Y + 28 * S, Z, 0.22, '#e8f8ff', 0.6);
      fx.shadow(s.x, s.y, 9 * sc, 0.15 + 0.2 * k);
    }
  },
};

// mâchoire de piège : charnière sur l'axe X local (orienté par yaw), relevée de up (0 = à plat, π/2 = droite)
function jaw(P, X, Y, Z, yaw, up, k, c) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cu = Math.cos(up), su = Math.sin(up);
  const i = P.putB(X, Y, Z, cy * k, 0, -sy * k, -sy * su * k, cu * k, -cy * su * k, sy * cu * k, su * k, cy * cu * k);
  P.tint(i, col(c));
}
