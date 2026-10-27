// Effets 3D des champions C2 (Frida, Gaïa), branchés sur Fx (fx.js) par trois appels, comme fx-c1.js : initC2 (création),
// eventC2 (événements de la partie : ultimes, gel, tirs brisés, éclatement, épines) et frameC2 (chaque image : givre sous
// les monstres ralentis, blocs de glace et neige d'Hiver éternel, racines et couronne d'épines de la Colère de la forêt,
// sève de Gaïa, geste d'attaque du héros quand son arme frappe). Ne modifie jamais la partie (seulement gfx.hs, l'état
// d'animation du héros).
import { S, TAU, rand, col, Build, G, T, lowpoly, Pool, alphaMat } from './kit.js';
import { C2B } from '../champions-c2.js';

const C2 = new Set(['cryo', 'druid']);
const ULT_C = { winter: '#bfeaff', forest: '#7aff5a' };
const W = '#ffffff', FROST = '#9ad8ff', LEAF = '#9aff6a', PETAL = '#ff9ad8', BARK = '#6a4426';

export function initC2(fx) {
  const id = fx.run.cls.id;
  if (!C2.has(id)) return null;
  const st = { id, cryo: id === 'cryo', snow: [], mines: 0 };
  if (st.cryo) {
    // bloc de glace d'Hiver éternel : gros cristal translucide et éclats autour du monstre (taille 1 = rayon 16 px)
    const b = new Build(7);
    b.add(G.ico(0.66, 0), '#d8f4ff', T(0, 0.62, 0, 1, 1.08, 1), 0.08);
    b.add(G.oct(0.42), W, T(0.5, 0.5, 0.22, 0.55, 1.5, 0.55, 0, 0, -0.5), 0.05);
    b.add(G.oct(0.38), '#bfeaff', T(-0.46, 0.45, -0.16, 0.55, 1.4, 0.55, 0.2, 0, 0.55), 0.05);
    b.add(G.oct(0.32), '#e8f8ff', T(0.06, 1.1, -0.3, 0.55, 1.5, 0.55, -0.4, 0, 0.1), 0.05);
    b.add(G.oct(0.28), '#a8e2ff', T(-0.15, 0.3, 0.55, 0.5, 1.2, 0.5, 0.6, 0, 0.2), 0.05);
    st.ice = new Pool(fx.root, b.geo(), alphaMat({ vertexColors: true }), 160, { alpha: true, order: 5 });
  } else {
    // racines de la Colère de la forêt : trois racines torses qui sortent du sol et se referment sur le monstre
    const b = new Build(9);
    for (let i = 0; i < 3; i++) {
      const a = i / 3 * TAU + 0.4, cx = Math.cos(a), cz = Math.sin(a);
      b.add(G.cyl(0.13, 0.2, 0.8, 5), BARK, T(cx * 0.85, 0.35, cz * 0.85, 1, 1, 1, cz * 0.35, 0, -cx * 0.35), 0.1);
      b.add(G.cyl(0.09, 0.13, 0.7, 5), '#7a5232', T(cx * 0.62, 0.95, cz * 0.62, 1, 1, 1, -cz * 0.6, 0, cx * 0.6), 0.1);
      b.add(G.cone(0.09, 0.45, 5), '#8a6a3a', T(cx * 0.32, 1.38, cz * 0.32, 1, 1, 1, -cz * 1.1, 0, cx * 1.1), 0.1);
      b.add(G.oct(0.16), '#5ac83a', T(cx * 0.95, 0.75, cz * 0.95, 1, 0.5, 1.4, 0, -a, 0.6), 0.1);
    }
    b.add(G.cyl(0.95, 1.05, 0.12, 8), '#4a3420', T(0, 0.04, 0), 0.15, 0.15);
    st.root = new Pool(fx.root, b.geo(), lowpoly(), 120);
    // épine de ronce (couronne autour de Gaïa) : trois pointes brunes au bout vert, fleur rose au pied
    const e = new Build(4);
    const tc = (x, y) => (y > 0.75 ? '#b8ff7a' : y > 0.4 ? '#5a8a2a' : '#5a3a1e');
    e.add(G.cone(0.2, 1.1, 5), tc, T(0, 0.55, 0), 0.08);
    e.add(G.cone(0.14, 0.75, 5), tc, T(0.2, 0.32, 0.06, 1, 1, 1, 0, 0, -0.5), 0.08);
    e.add(G.cone(0.14, 0.7, 5), tc, T(-0.18, 0.3, -0.06, 1, 1, 1, 0, 0, 0.55), 0.08);
    for (let i = 0; i < 4; i++) { const a = i / 4 * TAU; e.add(G.sph(0.1, 5, 3), PETAL, T(Math.cos(a) * 0.12, 0.12, 0.25 + Math.sin(a) * 0.12, 1, 0.5, 1)); }
    st.thorn = new Pool(fx.root, e.geo(), lowpoly(), 40);
  }
  return st;
}

// renvoie true si l'événement est entièrement traité ici (fx.js ne fait alors rien de plus)
export function eventC2(fx, ev) {
  const st = fx.c2;
  if (!st) return false;
  const p = fx.run.p, ov = fx.gfx.overlay;
  switch (ev.type) {
    case 'ult': {
      const c = ULT_C[ev.kind];
      if (!c) return false;
      fx.bursts.push({ x: p.x, y: p.y, h: 20, r: 300, t: 0, max: 0.6, c });
      for (let i = 0; i < 3; i++) fx.ring(p.x, p.y, 20, 260 + i * 100, i === 1 ? W : c, 12, 0.65, -i * 0.1);
      fx.pillars.push({ x: p.x, y: p.y, w: 130, h: 650, t: 0, max: 0.9, c });
      if (ev.kind === 'winter') {
        // tout l'écran gèle : couronnes d'éclats, givre au sol, flash bleu glacé
        fx.shardRing(p.x, p.y, 150, 16, W, 1.6); fx.shardRing(p.x, p.y, 290, 22, '#bfeaff', 1.8);
        fx.burstStars(p.x, p.y, 30, 34, '#e8f8ff', 420);
        fx.decal(p.x, p.y, 260, '#cfeeff', 0.3);
        fx.halo('#bfeaff', 4);
        if (ov) { ov.flashA = 0.5; ov.flashC = '200,240,255'; ov.edgeA = 0.7; ov.edgeC = '150,215,255'; }
      } else {
        // la forêt se réveille : terre qui se soulève, pétales, colonne verte, flash vert
        fx.decal(p.x, p.y, 140, '#2a1a0a', 0.45);
        fx.rockBurst(p.x, p.y, 14, '#5a4028', 260);
        fx.burstStars(p.x, p.y, 26, 30, PETAL, 360);
        fx.burstStars(p.x, p.y, 20, 20, LEAF, 300);
        fx.halo('#7aff5a', 4);
        if (ov) { ov.flashA = 0.35; ov.flashC = '120,255,120'; ov.edgeA = 0.55; ov.edgeC = '90,230,90'; }
      }
      return true;
    }
    case 'c2ice': fx.shardRing(ev.x, ev.y, ev.r * 1.1, 4, W, 0.8); fx.sparkle(ev.x, ev.y, ev.r + 10, '#e8f8ff'); return true;
    case 'c2shot': fx.puff(ev.x, ev.y, 3, 10, 0.6, '#e8f8ff'); fx.burstStars(ev.x, ev.y, 20, 3, '#bfeaff', 120); return true;
    case 'c2shatter': {
      // la glace vole en éclats : étoiles, morceaux de glace, petite onde
      fx.burstStars(ev.x, ev.y, ev.r, 5, '#e8f8ff', 240);
      fx.rockBurst(ev.x, ev.y, 3, '#bfeaff', 220);
      fx.ring(ev.x, ev.y, ev.r * 0.5, ev.r * 2.4, '#e8f8ff', 5, 0.3);
      return true;
    }
    case 'c2thorns': fx.ring(ev.x, ev.y, ev.R * 0.75, ev.R * 1.05, LEAF, 5, 0.3); return true;
    case 'c2end':
      if (ev.kind === 'winter' && ev.n) { fx.ring(p.x, p.y, 40, 380, W, 12, 0.6); fx.burstStars(p.x, p.y, 30, 20, '#e8f8ff', 380); if (ov) { ov.flashA = 0.3; ov.flashC = '220,245,255'; } }
      else if (ev.kind === 'forest') fx.puff(p.x, p.y, 8, 40, 0.6, '#b8f08a');
      return true;
  }
  return false;
}

export function frameC2(fx, dt) {
  const st = fx.c2;
  if (!st) return;
  const g = fx.gfx, run = fx.run, p = run.p, t = g.t, now = run.runTime, cx = g.cam.x, cy = g.cam.y;
  const vis = e => !e.dead && !e.burrowed && Math.abs(e.x - cx) < 420 && e.y - cy > -900 && e.y - cy < 660;
  // geste d'attaque : onde de givre de Frida, champignon semé par Gaïa (le modèle n'a pas de tir à suivre)
  const hs = g.hs;
  if (st.cryo) { for (const f of run.fx) if (!f.g_c2) { f.g_c2 = 1; if (f.type === 'ring' && f.color === FROST && hs) { hs.atk = 1; hs.atkA = hs.face; } } }
  else for (const m of run.mines) if (!m.g_c2) {
    m.g_c2 = 1;
    if (hs && hs.atk < 0.5) { hs.atk = 1; hs.atkA = Math.atan2(m.y - p.y, m.x - p.x); }
    fx.puff(m.x, m.y, 2, 8, 0.5, '#b8f08a');
  }
  if (st.cryo) {
    // Morsure du givre : givre au pied des monstres ralentis
    let n = 0;
    for (const e of run.enemies) {
      if (n >= 70 || !(e.chillT > now) || e.c2ice > now || !vis(e)) continue;
      n++;
      fx.ringAt(e.x, e.y, e.r * 1.2 + 4, FROST, 0.55, 0.14, 0.12, 1, e.x, 6, 0.4, 0.5);
      if (Math.random() < 0.025) fx.sparkle(e.x + rand(-e.r, e.r), e.y, e.r + 6, '#e8f8ff');
    }
    // Hiver éternel : blocs de glace sur les monstres gelés, givre sous les boss, neige qui tombe, bord de l'écran glacé
    const P = st.ice;
    P.begin();
    for (const e of run.enemies) {
      if (!(e.c2ice > now) || !vis(e)) continue;
      const left = e.c2ice - now, k = e.r / 16, grow = Math.min(1, (C2B.winter.dur - left) / 0.18 + 0.2), al = Math.min(1, left / 0.25);
      if (e.boss) { fx.ringAt(e.x, e.y, e.r * 1.4, '#e8f8ff', 0.8 * al, 0.12, 0.25, 1, t * 0.3, 10, 0.3, 0.6); if (Math.random() < 0.2) fx.sparkle(e.x + rand(-e.r, e.r), e.y, e.r * 2, W); continue; }
      const i = P.put(e.x * S, 0, e.y * S, e.x * 0.37, k * 1.15 * grow, k * 1.2 * grow, k * 1.15 * grow);
      P.alpha(i, 0.72 * al);
    }
    P.end();
    if (run.c2w && !run.dying) {
      const ov = g.overlay;
      if (ov) { ov.edgeA = Math.max(ov.edgeA, 0.35); ov.edgeC = '150,215,255'; }
      for (let i = 0; i < 2 && st.snow.length < 90; i++) st.snow.push({ x: cx + rand(-380, 380), y: cy + rand(-720, 420), z: rand(260, 420), vx: rand(-20, 20), vz: -rand(140, 220), r: rand(3, 6) });
      fx.ringAt(p.x, p.y, 70 + Math.sin(t * 4) * 6, '#e8f8ff', 0.6, 0.06, 0.08, 1, -t * 0.8, 12, -0.5, 0.6, true, 0.1);
    }
  } else {
    // sève de Gaïa : feuilles lumineuses qui montent quand elle se soigne
    if (p.hp < p.maxHp - 0.5 && !run.dying && Math.random() < dt * 5) fx.sparkle(p.x + rand(-14, 14), p.y + rand(-6, 6), rand(8, 30), Math.random() < 0.3 ? PETAL : LEAF);
    // racines : sortent du sol sous les monstres immobilisés, puis rentrent
    const Rp = st.root, dur = C2B.forest.root;
    Rp.begin();
    for (const e of run.enemies) {
      if (!(e.c2root > now) || !vis(e)) continue;
      const left = e.c2root - now, k = e.r / 16 * (e.boss ? 0.8 : 1), up = Math.min(1, (dur - left) / 0.2) * Math.min(1, left / 0.3);
      Rp.put(e.x * S, 0, e.y * S, e.x * 0.53, k * 1.1, k * 1.15 * up, k * 1.1);
    }
    Rp.end();
    // couronne d'épines autour de Gaïa (Colère de la forêt)
    const Tp = st.thorn, F = C2B.forest, tt = run.c2t;
    Tp.begin();
    if (tt && !run.dying) {
      const R = F.tR * p.area, n = 16, up = Math.min(1, (F.dur - tt.t) / 0.25) * Math.min(1, tt.t / 0.3);
      for (let i = 0; i < n; i++) {
        const a = i / n * TAU + t * 0.5, x = p.x + Math.cos(a) * R, y = p.y + Math.sin(a) * R * 0.95, k = (0.9 + (i % 3) * 0.18) * up;
        Tp.put(x * S, 0, y * S, -a + Math.PI / 2, k * 1.1, k * 1.3, k * 1.1);
      }
      fx.ringAt(p.x, p.y, R, LEAF, 0.7 * up, 0.04, 0.1, 1, t * 0.5, 16, 0.5, 0.5, true, 0.1);
      fx.glow(p.x, p.y, 20, 60, '#7aff5a', 0.3 * up);
      if (Math.random() < dt * 12) { const a = Math.random() * TAU; fx.sparkle(p.x + Math.cos(a) * R, p.y + Math.sin(a) * R, rand(10, 30), Math.random() < 0.5 ? PETAL : LEAF); }
    }
    Tp.end();
  }
  // flocons qui tombent (Hiver éternel)
  let n = 0;
  for (const f of st.snow) {
    f.z += f.vz * dt; f.x += (f.vx + Math.sin(t * 2 + f.r) * 25) * dt;
    if (f.z <= 2) continue;
    st.snow[n++] = f;
    fx.star(f.x, f.y, f.z, f.r, W, 0.85);
  }
  st.snow.length = n;
}
