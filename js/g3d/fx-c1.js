// Effets 3D des champions C1 (Nyx, Sora, Ragnar), branchés sur Fx (fx.js) par trois appels : initC1 (création),
// eventC1 (événements de la partie : ultimes, bonds de l'ombre, ondes de choc) et frameC1 (chaque image : haches de
// Ragnar, fureur, rage, danse des ombres). La faux de Nyx réutilise le croissant 'slash' de fx.js (couleurs c1/c2/c3).
// Ne modifie jamais la partie.
import { S, TAU, rand, col, Build, G, T, lowpoly, Pool } from './kit.js';

const C1 = new Set(['vampire', 'assassin', 'berserker']);
const ULT_C = { bloodfeast: '#ff2a4a', shadowdance: '#b06aff', fury: '#ff7a1a' };
const W = '#ffffff';

export function initC1(fx) {
  const id = fx.run.cls.id;
  if (!C1.has(id)) return null;
  const st = { id, axe: id === 'berserker', hops: [] };
  if (st.axe) {
    // hache de lancer de Ragnar (lame ricochet) : à plat, elle tourne autour de la verticale ; fer en croissant au bout
    const b = new Build(5);
    b.add(G.box(1.25, 0.1, 0.13), '#8a5a32', T(-0.12, 0, 0));
    b.add(G.box(0.12, 0.13, 0.17), '#3a8ae0', T(0.12, 0, 0));
    b.add(G.box(0.12, 0.13, 0.17), '#3a8ae0', T(-0.42, 0, 0));
    b.add(G.box(0.16, 0.14, 0.18), '#5a3418', T(-0.74, 0, 0));
    b.add(G.cyl(0.46, 0.46, 0.09, 9, 1, false, 0, Math.PI), '#c8d0dc', T(0.46, 0, 0, 1, 1, 1.25));
    b.add(G.cyl(0.5, 0.5, 0.05, 9, 1, false, 0.25, Math.PI - 0.5), W, T(0.46, 0, 0, 1, 1, 1.25));
    b.add(G.box(0.22, 0.12, 0.3), '#8a96a8', T(0.42, 0, 0));
    st.axeP = new Pool(fx.root, b.geo(), lowpoly(), 30);
  }
  return st;
}

// renvoie true si l'événement est entièrement traité ici (fx.js ne fait alors rien de plus)
export function eventC1(fx, ev) {
  const st = fx.c1;
  if (!st) return false;
  const p = fx.run.p, ov = fx.gfx.overlay;
  switch (ev.type) {
    case 'ult': {
      const c = ULT_C[ev.kind];
      if (!c) return false;
      fx.bursts.push({ x: p.x, y: p.y, h: 20, r: 280, t: 0, max: 0.6, c });
      for (let i = 0; i < 3; i++) fx.ring(p.x, p.y, 20, 240 + i * 90, i === 1 ? W : c, 12, 0.6, -i * 0.1);
      fx.pillars.push({ x: p.x, y: p.y, w: 120, h: 600, t: 0, max: 0.8, c });
      fx.burstStars(p.x, p.y, 30, 26, c, 380);
      if (ov) { ov.edgeA = 0.55; ov.edgeC = ev.kind === 'bloodfeast' ? '255,30,60' : ev.kind === 'fury' ? '255,120,30' : '176,106,255'; }
      if (ev.kind === 'bloodfeast') { fx.decal(p.x, p.y, 120, '#3a0010', 0.5); fx.puff(p.x, p.y, 10, 60, 0.7, '#8a1028'); if (ov) { ov.flashA = 0.35; ov.flashC = '120,0,20'; } }
      else if (ev.kind === 'shadowdance') { fx.puff(p.x, p.y, 12, 30, 0.8, '#3a2a5a'); if (ov) { ov.flashA = 0.3; ov.flashC = '40,10,60'; } }
      else fx.halo('#ff7a1a', 4);
      return true;
    }
    case 'c1feast': fx.halo('#ff2a4a', 3); return true;
    case 'c1hop': {
      fx.puff(ev.fromX, ev.fromY, 6, 18, 0.7, '#2a1a40');
      fx.puff(ev.x, ev.y, 5, 16, 0.6, '#c8a0ff');
      fx.burstStars(ev.x, ev.y, 20, 6, '#ff5ac0', 200);
      st.hops.push({ ax: ev.fromX, ay: ev.fromY, bx: ev.x, by: ev.y, t: 0, max: 0.32 });
      if (st.hops.length > 8) st.hops.shift();
      return true;
    }
    case 'c1quake': {
      const R = ev.R;
      fx.decal(p.x, p.y, R * (ev.big ? 0.55 : 0.4), '#1a0c06', 0.45);
      fx.ring(p.x, p.y, 20, R, '#ffb04a', ev.big ? 14 : 9, ev.big ? 0.55 : 0.4);
      fx.ring(p.x, p.y, 10, R * 0.75, '#ff5a1a', 8, 0.45, -0.06);
      fx.puff(p.x, p.y, ev.big ? 14 : 7, R * 0.3, 0.8, '#d8c0a0');
      fx.rockBurst(p.x, p.y, ev.big ? 16 : 7, '#6a5a52', ev.big ? 300 : 200);
      fx.gfx.kick = Math.max(fx.gfx.kick || 0, ev.big ? 9 : 4);
      return true;
    }
    case 'c1end': if (ev.kind === 'fury') fx.puff(p.x, p.y, 6, 20, 0.5, '#d8a080'); return true;
  }
  return false;
}

export function frameC1(fx, dt) {
  const st = fx.c1;
  if (!st) return;
  const run = fx.run, p = run.p, t = fx.gfx.t;
  // haches de Ragnar (lames ricochet) : tournent à plat, reflet et flou de rotation
  if (st.axeP) {
    const P = st.axeP, ev = p.weapons.some(w => w.id === 'boomerang' && w.evo);
    P.begin();
    for (const s of run.shots) {
      if (s.type !== 'boom') continue;
      const k = (s.r || 15) / 15;
      P.put(s.x * S, 0.95, s.y * S, -(s.spin || 0) * 0.8, k * 1.15);
      fx.glow(s.x, s.y, 18, 20 * k, ev ? '#ff9a3a' : '#bfe0ff', 0.45);
      fx.shadow(s.x, s.y, 26 * k, 0.25);
      fx.ra.ring(s.x * S, 0.92, s.y * S, k * 1.2, col(ev ? '#ffb04a' : '#e8f0ff'), ev ? 0.5 : 0.28, 0, 0.3, 0.7, -(s.spin || 0) * 0.8, 0, 0, 0.7);
    }
    P.end();
  }
  // rage (Ragnar) : lueur rouge qui bat de plus en plus fort quand les PV baissent
  if (st.id === 'berserker' && !run.dying) {
    const k = (run.rageMul?.() || 1) - 1;
    if (k > 0.04) {
      fx.glow(p.x, p.y, 24 + p.h, 34 + 30 * k, '#ff2a1a', Math.min(0.6, k * 1.4) * (0.75 + Math.sin(t * (6 + k * 10)) * 0.25));
      if (Math.random() < k * 0.8) fx.sparks.push({ x: p.x + rand(-12, 12), y: p.y + rand(-8, 8), z: 10, vx: 0, vy: 0, vz: rand(60, 140), life: 0.4, max: 0.4, c: '#ff4a2a', w: 2.2 });
    }
  }
  // fureur en cours : brasier autour de Ragnar, anneau au sol qui tourne, étincelles qui montent
  if (run.c1f > 0 && !run.dying) {
    const R = 46 + Math.sin(t * 14) * 4;
    fx.glow(p.x, p.y, 26 + p.h, 70, '#ff6a1a', 0.45 + Math.sin(t * 18) * 0.12);
    fx.ringAt(p.x, p.y, R, '#ff8a2a', 0.85, 0.08, 0, 1, t * 2.2, 8, 1.4, 0.6, true, 0.1);
    fx.ringAt(p.x, p.y, R * 1.35, '#ff3a1a', 0.5, 0.05, 0, 1, -t * 1.6, 6, -1, 0.5, true, 0.1);
    if (fx.sparks.length < 190) for (let i = 0; i < 2; i++) { const a = Math.random() * TAU; fx.sparks.push({ x: p.x + Math.cos(a) * 26, y: p.y + Math.sin(a) * 20, z: 6, vx: Math.cos(a) * 30, vy: Math.sin(a) * 20, vz: rand(140, 260), life: 0.45, max: 0.45, c: Math.random() < 0.5 ? '#ffb02a' : '#ff4a1a', w: 2.6 }); }
  }
  // danse des ombres : silhouette sombre et violette qui laisse des traces ; traits entre deux bonds
  if (run.c1d && !run.dying) {
    fx.glow(p.x, p.y, 24 + p.h, 46, '#7a3aff', 0.5 + Math.sin(t * 30) * 0.15);
    if (fx.puffs.length < 210) fx.puffs.push({ x: p.x + rand(-6, 6), y: p.y + rand(-4, 4), z: rand(8, 30), vx: 0, vy: 0, vz: 10, s: rand(8, 13), life: 0.35, max: 0.35, a: 0.55, c: '#2a1a44' });
  }
  let n = 0;
  for (const h of st.hops) {
    h.t += dt; if (h.t >= h.max) continue;
    st.hops[n++] = h;
    const a = 1 - h.t / h.max;
    fx.line(h.ax * S, 1.1, h.ay * S, h.bx * S, 1.1, h.by * S, 1.3 * a, '#7a3aff', 0.55 * a);
    fx.line(h.ax * S, 1.1, h.ay * S, h.bx * S, 1.1, h.by * S, 0.4 * a, '#ff7ad8', 0.9 * a);
  }
  st.hops.length = n;
}
