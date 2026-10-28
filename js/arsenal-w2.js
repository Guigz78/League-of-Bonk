// Arsenal W2 : armes propres à Nyx la Vampire (chauves-souris, lance de sang, cercle maudit) et à Sora l'Ombre (shurikens,
// bombes fumigènes, clone d'ombre), décrites pour weapons-reg.js (stats, fire, lines, size). Chaque arme garde son état en
// cours (chauves-souris, lances, cercles, nuages, clones…) dans W2S (arme → état), lu par le rendu js/g3d/fx-w2.js : rien
// n'est ajouté à l'objet arme (copié tel quel dans le résumé de fin de partie) ; nouveau monde (run.stage) : état remis à
// zéro. Dégâts en multiples de A (attaque × dégâts × rareté), recharges × h (hâte), tailles × ar (tome de taille), comme
// run.wstats. Effets pour le rendu : run.fx { type: 'w2…' } (fx-w2.js), et 'ring' (onde du cercle maudit évolué).
import { addWeapons } from './weapons-reg.js';
import { save } from './save.js';
import { sfx } from './audio.js';
import { fmt } from './ui.js';

const TAU = Math.PI * 2, NB = ' ';
const num = (v, d = 0) => { const k = 10 ** d; return (Math.round(v * k) / k).toLocaleString('fr-FR', { maximumFractionDigits: d }); };
const fI = v => fmt(v), fN = v => String(v), secS = v => num(v, 2) + NB + 's', pctS = v => num(v * 100, 1) + NB + '%';
const yes = v => (v ? 'oui' : 'non');
const D_ = l => ['dmg', l, fI], CD = (l = 'Recharge') => ['cd', l, secS];
const rand = (a, b) => a + Math.random() * (b - a);
const alive = e => !!e && !e.dead && !e.burrowed;
const Q = [], Q2 = []; // résultats des requêtes de la grille (réutilisés, jamais imbriqués)

// état en cours d'une arme (WeakMap : disparaît avec l'arme) ; list / aux : ses objets (chauves-souris, lances, nuages…)
export const W2S = new WeakMap();
function st(run, w) {
  let s = W2S.get(w);
  if (!s || s.stage !== run.stage) { s = { stage: run.stage, list: [], aux: [], n: 0 }; W2S.set(w, s); }
  return s;
}
// ennemi vivant le plus proche de (x, y) à moins de R, hors skip et hors de la liste not
function nearTo(run, x, y, R, skip = null, not = null) {
  let best = null, bd = R * R;
  for (const e of run.grid.query(x, y, R, Q2)) {
    if (e === skip || e.dead || e.burrowed || (not && not.includes(e))) continue;
    const d = (e.x - x) ** 2 + (e.y - y) ** 2;
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}
// autre cible que t autour du héros (au hasard parmi les monstres à portée) : bombes, shurikens et clones en plus
function other(run, R, t, not = null) {
  const p = run.p, L = run.grid.query(p.x, p.y, R, Q2);
  for (let k = 0; k < 6 && L.length; k++) {
    const e = L[(Math.random() * L.length) | 0];
    if (e !== t && !e.dead && !e.burrowed && !(not && not.includes(e)) && (e.x - p.x) ** 2 + (e.y - p.y) ** 2 < R * R) return e;
  }
  return null;
}
// soin direct (lance de sang) : compté comme un vol de vie (succès, contrats), « +N » cramoisi groupé du HUD
function heal(run, amt) {
  const p = run.p;
  if (run.dying) return;
  const h = Math.min(p.maxHp - p.hp, amt * (run.diff?.heal ?? 1));
  if (h <= 0) return;
  p.hp += h; run.lsShown += h; run.lsGlow = Math.max(run.lsGlow || 0, 0.2);
  run.track.lsHeal += h; save.stats.lsHeal = (save.stats.lsHeal || 0) + h;
}
// coup sur tous les monstres d'un segment (pieux de sang) : départ (x, y), angle a, longueur len, largeur wd
function lineHit(run, x, y, a, len, wd, dmg, o) {
  const cx = Math.cos(a), cy = Math.sin(a);
  for (const e of run.grid.query(x + cx * len / 2, y + cy * len / 2, len / 2 + 40, Q)) {
    if (e.dead || e.burrowed) continue;
    const dx = e.x - x, dy = e.y - y, al = dx * cx + dy * cy;
    if (al < -10 || al > len + 10 || Math.abs(-dx * cy + dy * cx) > wd / 2 + e.r * 0.7) continue;
    run.hitEnemy(e, dmg, o);
  }
}
function taken(B, e) { for (const o of B) if (o.tg === e) return true; return false; }

// Réglages communs (exportés : le simulateur d'équilibrage peut les modifier)
// lance : V = vitesse (px/s), range = portée, healN = ennemis transpercés qui soignent au plus par lance ;
// tick = intervalle des dégâts des zones (cercle maudit, nuages) ; clone : vitesse de course
export const W2B = { V: 780, range: 560, healN: 5, tick: 0.5, cloneV: 420 };

addWeapons({
  // ---------- Nyx ----------
  // Nuée de chauves-souris : elles volettent autour de Nyx, puis chacune pique à son tour sur un monstre proche, le mord
  // (vol de vie en plus) et revient. Évoluée (Nuée de la Lune de sang) : 8 chauves-souris, chaque piqué enchaîne 2 morsures.
  bats: {
    stats: ({ A, ar, h, L, E }) => E
      ? { dmg: A * 1.3 * 1.25 * 1.25, cd: 0.7 * h, n: 8, ls: 0.05, R: 330 * ar, chain: 1, v: 640 }
      : { dmg: A * (L(3) ? 1.3 : 1) * (L(5) ? 1.25 : 1), cd: (L(4) ? 0.9 : 1.15) * h, n: 2 + L(2) + L(4) + L(5), ls: 0.03, R: (L(3) ? 300 : 260) * ar, chain: 0, v: 560 },
    lines: [D_('Dégâts par morsure'), ['n', 'Chauves-souris', fN], CD('Piqué toutes les'), ['ls', 'Vol de vie', pctS], ['R', 'Portée', fI], ['chain', 'Morsures en chaîne', fN]],
    size: 'R',
    fire(run, w, S, E, dt) {
      const s = st(run, w), p = run.p, B = s.list;
      while (B.length < S.n) B.push({ x: p.x, y: p.y, z: 30, m: 0, t: 0.25 + B.length * 0.22, tg: null, k: 0, n: 0, dx: 1, dy: 0, ph: Math.random() * TAU });
      const n = B.length;
      for (let i = 0; i < n; i++) {
        const b = B[i];
        if (b.m === 0) { // en vol autour de Nyx (cercle qui ondule) ; piqué quand sa recharge est finie
          const a = w.a * 2.4 + i / n * TAU, r = 42 + Math.sin(w.a * 3 + i * 1.7) * 9, hx = p.x + Math.cos(a) * r, hy = p.y + Math.sin(a) * r * 0.75;
          const k = Math.min(1, dt * 9);
          b.dx = hx - b.x; b.dy = hy - b.y; b.x += b.dx * k; b.y += b.dy * k; b.z = 36 + Math.sin(w.a * 6 + i) * 5;
          if ((b.t -= dt) > 0) continue;
          let best = null, bd = Infinity, alt = null, ad = Infinity;
          for (const e of run.grid.query(p.x, p.y, S.R, Q)) {
            if (e.dead || e.burrowed || (e.x - p.x) ** 2 + (e.y - p.y) ** 2 > S.R * S.R) continue;
            const d = (e.x - b.x) ** 2 + (e.y - b.y) ** 2;
            if (taken(B, e)) { if (d < ad) { ad = d; alt = e; } } else if (d < bd) { bd = d; best = e; }
          }
          const tg = best || alt;
          if (tg) { b.m = 1; b.tg = tg; b.k = 0; b.n = 0; if (s.n++ % 2 === 0) sfx('bat'); } else b.t = 0.25;
          continue;
        }
        if (b.m === 1) { // piqué : fonce sur sa cible (qui bouge), la mord ; évoluée : enchaîne sur un voisin
          const e = b.tg;
          b.k += dt;
          if (!alive(e) || b.k > 1.6) { b.m = 2; b.tg = null; continue; }
          const dx = e.x - b.x, dy = e.y - b.y, d = Math.hypot(dx, dy) || 1, step = S.v * dt, hz = e.r * 1.1 + (e.fly || 0);
          b.dx = dx / d; b.dy = dy / d; b.z += (hz - b.z) * Math.min(1, dt * 8);
          if (d > step + e.r * 0.7 + 4) { b.x += b.dx * step; b.y += b.dy * step; continue; }
          b.x = e.x - b.dx * e.r * 0.5; b.y = e.y - b.dy * e.r * 0.5;
          run.hitEnemy(e, S.dmg, { ls: S.ls, knock: 50, kx: b.dx, ky: b.dy, color: '#ff4d6d' });
          run.fx.push({ type: 'w2bite', x: e.x, y: e.y, z: hz, life: 0.22, max: 0.22, evo: E });
          if (b.n++ < S.chain) { const o = nearTo(run, e.x, e.y, 170, e); if (o) { b.tg = o; b.k = 0; continue; } }
          b.m = 2; b.tg = null;
          continue;
        }
        // retour vers Nyx
        const dx = p.x - b.x, dy = p.y - b.y, d = Math.hypot(dx, dy) || 1, step = S.v * 0.8 * dt;
        b.dx = dx / d; b.dy = dy / d; b.z += (36 - b.z) * Math.min(1, dt * 5);
        if (d < 46 + step) { b.m = 0; b.t = S.cd * rand(0.8, 1.2); } else { b.x += b.dx * step; b.y += b.dy * step; }
      }
    },
  },

  // Lance de sang : lance longue portée vers la cible, qui transperce tout et soigne Nyx pour chaque monstre transpercé
  // (au plus W2B.healN par lance). Évoluée (Pieu de la Reine écarlate) : 3 lances, soin plus fort, et des pieux de sang
  // jaillissent du sol sur tout leur passage quand elles s'arrêtent.
  bloodlance: {
    stats: ({ A, ar, h, L, E }) => E
      ? { dmg: A * 2.6 * 1.3 * 1.4 * 1.4, cd: 1.15 * h, n: 3, heal: 0.006, w: 30 * ar, spike: A * 2.6 * 1.3 * 1.4 * 0.9 }
      : { dmg: A * 2.6 * (L(2) ? 1.3 : 1) * (L(5) ? 1.4 : 1), cd: (L(4) ? 1.35 : 1.75) * h, n: 1 + L(3), heal: L(5) ? 0.006 : 0.004, w: 20 * ar, spike: 0 },
    lines: [D_('Dégâts par lance'), CD(), ['n', 'Lances', fN], ['heal', 'Soin par ennemi', v => pctS(v) + ' des PV'], ['w', 'Largeur', fI], ['spike', 'Pieux de sang', v => (v ? fI(v) : 'non')]],
    size: 'w',
    fire(run, w, S, E, dt) {
      const s = st(run, w), p = run.p, L = s.list, X = s.aux, V = W2B.V;
      if (w.t <= 0) {
        const t = run.aim(W2B.range - 40);
        if (!t) w.t = 0.2;
        else {
          w.t = S.cd;
          const a0 = Math.atan2(t.y - p.y, t.x - p.x);
          for (let i = 0; i < S.n; i++) {
            const a = a0 + (i - (S.n - 1) / 2) * (E ? 0.22 : 0.14);
            L.push({ x: p.x, y: p.y, x0: p.x, y0: p.y, a, vx: Math.cos(a) * V, vy: Math.sin(a) * V, life: W2B.range / V, hit: [], hn: 0 });
          }
          run.fx.push({ type: 'w2throw', x: p.x, y: p.y, a: a0, life: 0.2, max: 0.2 });
          sfx('lance');
        }
      }
      let n = 0;
      const R = S.w / 2;
      for (const l of L) {
        if ((l.life -= dt) <= 0) { // fin de course ; évoluée : les pieux de sang suivront tout le trajet
          if (E) X.push({ x: l.x0, y: l.y0, a: l.a, len: Math.hypot(l.x - l.x0, l.y - l.y0), t: 0.12 });
          continue;
        }
        l.x += l.vx * dt; l.y += l.vy * dt;
        for (const e of run.grid.query(l.x, l.y, R + 40, Q)) {
          if (e.dead || e.burrowed || (e.x - l.x) ** 2 + (e.y - l.y) ** 2 > (e.r + R) ** 2 || l.hit.includes(e)) continue;
          l.hit.push(e);
          run.hitEnemy(e, S.dmg, { knock: 110, kx: l.vx / V, ky: l.vy / V, color: '#ff3a5a' });
          if (l.hn++ < W2B.healN) heal(run, p.maxHp * S.heal);
        }
        L[n++] = l;
      }
      L.length = n;
      n = 0;
      for (const k of X) {
        if ((k.t -= dt) > 0) { X[n++] = k; continue; }
        lineHit(run, k.x, k.y, k.a, k.len, 44 * (S.w / 30), S.spike, { knock: 140, kx: 0, ky: 0, color: '#ff2a4a' });
        run.fx.push({ type: 'w2spikes', x: k.x, y: k.y, a: k.a, len: k.len, life: 0.7, max: 0.7 });
        sfx('spikes');
      }
      X.length = n;
    },
  },

  // Cercle maudit : cercle au sol posé sous la cible ; il draine en continu (dégâts toutes les W2B.tick s, vol de vie en
  // plus, ralentit). Évolué (Gouffre maudit) : grands cercles qui aspirent les monstres et lâchent une onde de sang
  // (dégâts ×3) un drain sur trois.
  cursering: {
    stats: ({ A, ar, h, L, E }) => E
      ? { dmg: A * 0.55 * 1.35 * 1.3 * 1.5, cd: 2.4 * h, n: 2, R: 125 * ar, dur: 5, ls: 0.03, pull: 70 }
      : { dmg: A * 0.55 * (L(4) ? 1.35 : 1) * (L(5) ? 1.3 : 1), cd: 4 * h, n: 1 + L(5), R: (L(2) ? 82 : 66) * ar, dur: L(3) ? 5.5 : 4, ls: 0.02, pull: 0 },
    lines: [D_('Dégâts par drain'), ['R', 'Rayon', fI], ['dur', 'Durée', secS], CD('Nouveau cercle toutes les'), ['n', 'Cercles', fN], ['pull', 'Aspire les ennemis', yes]],
    size: 'R',
    fire(run, w, S, E, dt) {
      const s = st(run, w), p = run.p, C = s.list, T = W2B.tick;
      if (w.t <= 0) {
        const t = run.aim(380);
        if (!t) w.t = 0.25;
        else {
          w.t = S.cd;
          for (let i = 0; i < S.n; i++) {
            const e = i ? other(run, 380, t) : t;
            if (!e) break;
            // un peu devant la cible, côté Nyx : les monstres y entrent en avançant
            C.push({ x: e.x + (p.x - e.x) * 0.2, y: e.y + (p.y - e.y) * 0.2, R: S.R, t: 0, dur: S.dur, k: 0.15, n: 0, evo: E });
          }
          while (C.length > 6) C.shift();
          sfx('curse');
        }
      }
      let n = 0;
      for (const c of C) {
        c.t += dt;
        if (c.t >= c.dur) continue;
        const tick = (c.k -= dt) <= 0;
        if (tick) { c.k += T; c.n++; }
        if (tick || S.pull) {
          const R = c.R, nova = E && tick && c.n % 3 === 0;
          for (const e of run.grid.query(c.x, c.y, R + 30, Q)) {
            if (e.dead || e.burrowed) continue;
            const dx = c.x - e.x, dy = c.y - e.y, d2 = dx * dx + dy * dy;
            if (d2 > (R + e.r * 0.5) ** 2) continue;
            if (S.pull && !e.boss) { const d = Math.sqrt(d2) || 1, f = Math.min(d * 0.5, S.pull * dt * (e.elite ? 0.4 : 1)); e.x += dx / d * f; e.y += dy / d * f; }
            if (tick) { run.hitEnemy(e, S.dmg * (nova ? 3 : 1), { ls: S.ls, quiet: !nova, color: '#ff3a6a' }); e.slow = Math.max(e.slow, 0.6); }
          }
          if (nova) { run.fx.push({ type: 'ring', x: c.x, y: c.y, r: R * 1.15, life: 0.4, max: 0.4, color: '#ff2a5a' }); sfx('curse'); }
        }
        C[n++] = c;
      }
      C.length = n;
    },
  },

  // ---------- Sora ----------
  // Shurikens : étoiles lancées vers la cible qui ricochent d'ennemi en ennemi (le plus proche pas encore touché ; seul
  // contre un boss, elles rebondissent sur lui). Évolués (Tempête d'étoiles) : 5 shurikens géants, 7 ricochets, chaque
  // ricochet frappe 12 % plus fort.
  shuriken: {
    stats: ({ A, ar, h, L, E }) => E
      ? { dmg: A * 1.3 * 1.45, cd: 0.85 * h, n: 5, b: 7, R: 240 * ar, v: 660, grow: 0.12 }
      : { dmg: A * (L(3) ? 1.3 : 1), cd: (L(5) ? 1.0 : 1.3) * h, n: 1 + L(2) + L(5), b: 2 + L(4) * 2, R: 200 * ar, v: 600, grow: 0 },
    lines: [D_('Dégâts par shuriken'), CD(), ['n', 'Shurikens', fN], ['b', 'Ricochets', fN], ['R', 'Portée des ricochets', fI], ['grow', 'Par ricochet', v => (v ? '+' + num(v * 100) + NB + '% de dégâts' : 'non')]],
    size: 'R',
    fire(run, w, S, E, dt) {
      const s = st(run, w), p = run.p, L = s.list;
      if (w.t <= 0) {
        const t = run.aim(420);
        if (!t) w.t = 0.2;
        else {
          w.t = S.cd;
          const picked = [];
          for (let i = 0; i < S.n; i++) {
            const tg = (i && other(run, 420, t, picked)) || t;
            picked.push(tg);
            const a = Math.atan2(tg.y - p.y, tg.x - p.x) + (i ? rand(-0.6, 0.6) : 0);
            L.push({ x: p.x, y: p.y, vx: Math.cos(a) * S.v, vy: Math.sin(a) * S.v, tg, left: S.b, hit: [], k: 0, away: 0, out: 0, spin: Math.random() * TAU, mul: 1 });
          }
          run.fx.push({ type: 'w2throw', x: p.x, y: p.y, a: Math.atan2(t.y - p.y, t.x - p.x), life: 0.2, max: 0.2 });
          sfx('shuriken');
        }
      }
      let n = 0;
      for (const q of L) {
        q.spin += dt * 26;
        if (q.out > 0) { q.out -= dt; q.x += q.vx * dt; q.y += q.vy * dt; if (q.out > 0) L[n++] = q; continue; } // s'envole et s'efface
        if (q.away > 0) { q.away -= dt; q.x += q.vx * dt; q.y += q.vy * dt; L[n++] = q; continue; } // rebond sur la même cible
        q.k += dt;
        let e = q.tg;
        if (!alive(e) || q.k > 1.1) { e = q.tg = q.k > 1.1 ? null : nearTo(run, q.x, q.y, S.R, null, q.hit); q.k = 0; }
        if (!e) { q.out = 0.25; L[n++] = q; continue; }
        const dx = e.x - q.x, dy = e.y - q.y, d = Math.hypot(dx, dy) || 1, step = S.v * dt;
        q.vx = dx / d * S.v; q.vy = dy / d * S.v;
        if (d > step + e.r * 0.6 + 6) { q.x += q.vx * dt; q.y += q.vy * dt; L[n++] = q; continue; }
        // touché : ricochet vers le voisin le plus proche pas encore touché (sinon rebond sur la même cible)
        q.hit.push(e); q.k = 0;
        run.hitEnemy(e, S.dmg * q.mul, { knock: 60, kx: dx / d, ky: dy / d, color: '#ff7ad8' });
        run.fx.push({ type: 'w2spark', x: e.x, y: e.y, z: e.r + (e.fly || 0), life: 0.18, max: 0.18, evo: E });
        q.mul += S.grow;
        if (q.left-- <= 0) { q.out = 0.3; L[n++] = q; continue; }
        const o = nearTo(run, e.x, e.y, S.R, e, q.hit);
        if (o) q.tg = o;
        else { const a = Math.atan2(-dy, -dx) + rand(-1, 1); q.vx = Math.cos(a) * S.v; q.vy = Math.sin(a) * S.v; q.away = 0.13; }
        L[n++] = q;
      }
      L.length = n;
    },
  },

  // Bombes fumigènes : bombes lancées en cloche sur les monstres ; chacune éclate en un nuage qui les ralentit et les blesse
  // toutes les W2B.tick s (la 1re bouffée frappe plus fort). Évoluées (Voile de l'ombre) : immenses nuages durables qui
  // engloutissent les tirs ennemis.
  smoke: {
    stats: ({ A, ar, h, L, E }) => E
      ? { dmg: A * 0.6 * 1.3 * 1.35 * 1.5, cd: 2.4 * h, n: 3, R: 125 * ar, dur: 4.5, wall: 1 }
      : { dmg: A * 0.6 * (L(2) ? 1.3 : 1) * (L(5) ? 1.35 : 1), cd: (L(4) ? 2.6 : 3.2) * h, n: 1 + L(3) + L(5), R: (L(3) ? 86 : 74) * ar, dur: 3, wall: 0 },
    lines: [D_('Dégâts par bouffée'), CD(), ['n', 'Bombes', fN], ['R', 'Nuage', fI], ['dur', 'Durée', secS], ['wall', 'Arrête les tirs', yes]],
    size: 'R',
    fire(run, w, S, E, dt) {
      const s = st(run, w), p = run.p, B = s.list, C = s.aux, T = W2B.tick;
      if (w.t <= 0) {
        const t = run.aim(360);
        if (!t) w.t = 0.25;
        else {
          w.t = S.cd;
          for (let i = 0; i < S.n; i++) {
            const e = i ? other(run, 360, t) : t, a = Math.random() * TAU;
            const tx = e ? e.x : t.x + Math.cos(a) * S.R * 1.4, ty = e ? e.y : t.y + Math.sin(a) * S.R * 1.4;
            B.push({ sx: p.x, sy: p.y, x: p.x, y: p.y, z: 30, tx, ty, t: -i * 0.08, dur: 0.5, spin: Math.random() * TAU });
          }
          run.fx.push({ type: 'w2throw', x: p.x, y: p.y, a: Math.atan2(t.y - p.y, t.x - p.x), life: 0.2, max: 0.2 });
          sfx('throw');
        }
      }
      let n = 0;
      for (const b of B) { // bombes en cloche
        b.t += dt; b.spin += dt * 9;
        const k = Math.max(0, Math.min(1, b.t / b.dur));
        b.x = b.sx + (b.tx - b.sx) * k; b.y = b.sy + (b.ty - b.sy) * k; b.z = 24 + Math.sin(k * Math.PI) * 95;
        if (k < 1) { B[n++] = b; continue; }
        C.push({ x: b.tx, y: b.ty, R: S.R, t: 0, dur: S.dur, k: 0, n: 0, evo: E, ph: Math.random() * TAU });
        run.fx.push({ type: 'w2pop', x: b.tx, y: b.ty, r: S.R, life: 0.4, max: 0.4, evo: E });
        sfx('smoke');
      }
      B.length = n;
      while (C.length > 9) C.shift();
      n = 0;
      for (const c of C) { // nuages : ralentissent et blessent ; évolués : engloutissent les tirs ennemis
        c.t += dt;
        if (c.t >= c.dur) continue;
        if ((c.k -= dt) <= 0) {
          c.k += T;
          for (const e of run.grid.query(c.x, c.y, c.R + 30, Q)) {
            if (e.dead || e.burrowed || (e.x - c.x) ** 2 + (e.y - c.y) ** 2 > (c.R + e.r * 0.5) ** 2) continue;
            run.hitEnemy(e, S.dmg * (c.n ? 1 : 1.5), { quiet: c.n > 0, color: '#c8a8ff' });
            e.slow = Math.max(e.slow, 0.7);
          }
          c.n++;
        }
        if (S.wall) for (const q of run.eshots) {
          if (q.life <= 0 || (q.x - c.x) ** 2 + (q.y - c.y) ** 2 > c.R * c.R) continue;
          run.fx.push({ type: 'w2eat', x: q.x, y: q.y, life: 0.3, max: 0.3 });
          q.life = 0; q.vx = q.vy = 0; q.x += 1e6; // englouti (il ne peut plus toucher personne avant d'être retiré)
        }
        C[n++] = c;
      }
      C.length = n;
    },
  },

  // Clone d'ombre : un clone de Sora surgit près de la cible, court de monstre en monstre et tranche tout autour de lui
  // (toutes les rate s), puis se dissipe. Évolué (Légion d'ombres) : 3 clones qui tranchent plus vite et explosent en
  // disparaissant (dégâts ×2 autour d'eux).
  shadowclone: {
    stats: ({ A, ar, h, L, E }) => E
      ? { dmg: A * 1.2 * 1.3 * 1.3 * 1.4, cd: 3.4 * h, n: 3, dur: 4.2, R: 95 * ar, rate: 0.3, boom: 1 }
      : { dmg: A * 1.2 * (L(2) ? 1.3 : 1) * (L(5) ? 1.3 : 1), cd: (L(4) ? 4.4 : 5.6) * h, n: 1 + L(5), dur: L(3) ? 4 : 3, R: (L(3) ? 82 : 70) * ar, rate: 0.42, boom: 0 },
    lines: [D_('Dégâts par entaille'), ['n', 'Clones', fN], ['dur', 'Durée', secS], CD('Apparaît toutes les'), ['R', 'Portée', fI], ['rate', 'Entaille toutes les', secS], ['boom', 'Explose en disparaissant', yes]],
    size: 'R',
    fire(run, w, S, E, dt) {
      const s = st(run, w), p = run.p, C = s.list;
      if (w.t <= 0) {
        const t = run.aim(420);
        if (!t) w.t = 0.3;
        else {
          w.t = S.cd;
          for (let i = 0; i < S.n; i++) {
            const e = (i && other(run, 420, t)) || t, a = Math.atan2(p.y - e.y, p.x - e.x) + (i ? rand(-1.2, 1.2) : 0), d = e.r + 18;
            const x = e.x + Math.cos(a) * d, y = e.y + Math.sin(a) * d;
            C.push({ x, y, t: 0, dur: S.dur, k: 0.12 + i * 0.07, a: a + Math.PI, tg: e, m: 0, atk: 0, n: 0, id: s.n++, side: 1, evo: E });
            run.fx.push({ type: 'w2clone', x, y, fromX: p.x, fromY: p.y, life: 0.35, max: 0.35, evo: E });
          }
          while (C.length > 4) C.shift();
          sfx('clone');
        }
      }
      let n = 0;
      for (const c of C) {
        c.t += dt; c.atk = Math.max(0, c.atk - dt * 3.5);
        if (c.t >= c.dur) { // se dissipe ; évolué : explosion d'ombre
          if (S.boom) {
            for (const e of run.grid.query(c.x, c.y, S.R * 1.5 + 30, Q)) if (!e.dead && !e.burrowed && (e.x - c.x) ** 2 + (e.y - c.y) ** 2 < (S.R * 1.5 + e.r * 0.5) ** 2) run.hitEnemy(e, S.dmg * 2, { knock: 200, kx: Math.sign(e.x - c.x), ky: Math.sign(e.y - c.y), color: '#c08aff' });
            run.fx.push({ type: 'ring', x: c.x, y: c.y, r: S.R * 1.5, life: 0.4, max: 0.4, color: '#b06aff' });
          }
          run.fx.push({ type: 'w2poof', x: c.x, y: c.y, life: 0.45, max: 0.45, evo: E });
          continue;
        }
        // cible : la plus proche du clone, sinon il rejoint Sora
        let e = c.tg;
        if (!alive(e) || (e.x - c.x) ** 2 + (e.y - c.y) ** 2 > 300 * 300) e = c.tg = nearTo(run, c.x, c.y, 260);
        const gx = e ? e.x : p.x + Math.cos(c.id * 2.1) * 60, gy = e ? e.y : p.y + Math.sin(c.id * 2.1) * 45;
        const dx = gx - c.x, dy = gy - c.y, d = Math.hypot(dx, dy) || 1, stop = e ? e.r + 14 : 30;
        c.m = d > stop + 4 ? 1 : 0;
        if (c.m) { const step = Math.min(d - stop, W2B.cloneV * dt); c.x += dx / d * step; c.y += dy / d * step; }
        if (c.m || e) c.a = Math.atan2(dy, dx);
        if ((c.k -= dt) <= 0 && e && d <= S.R + e.r) { // entaille tout autour du clone
          c.k = S.rate; c.atk = 1; c.side = -c.side;
          for (const o of run.grid.query(c.x, c.y, S.R + 40, Q)) {
            if (o.dead || o.burrowed) continue;
            const ox = o.x - c.x, oy = o.y - c.y, od = Math.hypot(ox, oy) || 1;
            if (od > S.R + o.r) continue;
            run.hitEnemy(o, S.dmg, { knock: 120, kx: ox / od, ky: oy / od, color: '#c08aff' });
          }
          run.fx.push({ type: 'w2cut', x: c.x, y: c.y, a: c.a, side: c.side, r: S.R, life: 0.22, max: 0.22, evo: E });
          if (c.n++ % 2 === 0) sfx('cut');
        }
        C[n++] = c;
      }
      C.length = n;
    },
  },
});
