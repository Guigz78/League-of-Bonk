// Arsenal de Morgane la capitaine pirate : Pistolets (arme de départ), Sabre d'abordage, Canon, Perroquet, décrits pour
// weapons-reg.js (stats, fire, lines, size). Chaque arme garde son état en cours (balles, vagues, boulets, perroquets) dans
// PIRS (arme → état), lu par le rendu js/g3d/fx-pirate.js : rien n'est ajouté à l'objet arme (copié tel quel dans le résumé
// de fin de partie) ; nouveau monde (run.stage) : état remis à zéro. Projectiles = objets réutilisés (réserve free) : aucune
// allocation en régime établi. Dégâts en multiples de A (attaque × dégâts × rareté), recharges × h (hâte), tailles × ar
// (tome de taille), comme run.wstats. Effets ponctuels pour le rendu : run.fx { type: 'pir…' } (tir, estocade, canon posé,
// explosion, coup de bec, pièce d'or) et 'slash' recoloré (sabre).
// Équilibrage (simulateur l2/sim.mjs, bot qui prend la 1re carte, Normal, monde 1 → 2, une résurrection ; mêmes réglages que
// les arsenaux W1 / W2 et Tess) : boss du monde 1 / du monde 2 tués. Références (arsenaux complets) : Lumi 12/12, 12/12 ;
// Brok 11/12, 11/12 ; Kira et Frida 10/12, 7/12 ; Nyx 13/16, 10/16 ; Sora 12/16, 11/16 ; Tess 32/32, 26/32. Morgane : 32/32,
// 30/32 (niveau ~37, ~5 200 victimes : canon 31 à 34 %, pistolets 28 à 33 %, sabre ~25 %, perroquet 11 à 14 % ; ~2
// évolutions par partie). Difficile, monde 1 : 3/16 (Tess 5/12, Sora 4/12, champions C1 2 à 3 sur 6 à 10). Banc d'essai
// (anneau de 40 monstres, dégâts par seconde en A) : pistolets 2,1 / 17,6 / 39,6 (niv. 1 / 5 / évolués ; flèches 1,6 / 22 /
// 102), sabre 22 / 53 / 83 (épée de Brok 22 / 56 / 73), canon 2,2 / 7,5 / 36, perroquet 1,4 / 6,3 / 44 (cible unique).
import { addWeapons } from './weapons-reg.js';
import { sfx } from './audio.js';
import { fmt } from './ui.js';

const TAU = Math.PI * 2, NB = ' ', HALF = 1600;
const num = (v, d = 0) => { const k = 10 ** d; return (Math.round(v * k) / k).toLocaleString('fr-FR', { maximumFractionDigits: d }); };
const fI = v => fmt(v), fN = v => String(v), secS = v => num(v, 2) + NB + 's';
const fP = v => (v ? `${v} ennemi${v > 1 ? 's' : ''}` : 'non');
const D_ = l => ['dmg', l, fI];
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const alive = e => !!e && !e.dead && !e.burrowed;
const Q = [], Q2 = []; // résultats de la grille (réutilisés, jamais deux boucles imbriquées sur le même)

// état en cours d'une arme (WeakMap : disparaît avec l'arme) ; list : perroquets / boulets, aux : balles ou vagues,
// free : projectiles réutilisables, ex : cibles déjà prises (perroquets)
export const PIRS = new WeakMap();
function st(run, w) {
  let s = PIRS.get(w);
  if (!s || s.stage !== run.stage) { s = { stage: run.stage, list: [], aux: [], free: [], ex: [], n: 0, side: 0, c: -1, ct: 0, base: 0 }; PIRS.set(w, s); }
  return s;
}
// ennemi vivant le plus proche de (x, y) à moins de R, hors de la liste not
function nearTo(run, x, y, R, not = null) {
  let best = null, bd = R * R;
  for (const e of run.grid.query(x, y, R, Q2)) {
    if (e.dead || e.burrowed || (not && not.includes(e))) continue;
    const d = (e.x - x) ** 2 + (e.y - y) ** 2;
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}
// dégâts de zone autour de (x, y)
function zone(run, x, y, R, dmg, o) {
  for (const e of run.grid.query(x, y, R + 40, Q)) {
    if (e.dead || e.burrowed) continue;
    const dx = e.x - x, dy = e.y - y, d = Math.hypot(dx, dy);
    if (d > R + e.r * 0.5) continue;
    o.kx = dx / (d || 1); o.ky = dy / (d || 1);
    run.hitEnemy(e, dmg, o);
  }
}
// projectile réutilisé (balle, vague, boulet) : de (x, y) vers l'angle a, vitesse v, durée de vie life
function proj(s, L, x, y, a, v, life, dmg) {
  const b = s.free.pop() || { hit: [] };
  b.x = x; b.y = y; b.a = a; b.vx = Math.cos(a) * v; b.vy = Math.sin(a) * v; b.v = v; b.life = life; b.max = life; b.dmg = dmg; b.hit.length = 0;
  b.pierce = 0; b.spin = 0;
  L.push(b);
  return b;
}
// coupe arrière d'un projectile : est-il dans le demi-plan devant lui, à moins de w de son axe ? (vagues, boulets ramés)
const across = (b, e, w) => { const ex = e.x - b.x, ey = e.y - b.y, c = Math.cos(b.a), s = Math.sin(b.a); return Math.abs(-ex * s + ey * c) < w + e.r * 0.5 && Math.abs(ex * c + ey * s) < 22 + e.r * 0.6; };
const atk = (run, a, k) => run.fx.push({ type: 'pirAtk', a, k, life: 0.2, max: 0.2 }); // geste d'attaque de Morgane (rendu) : k = 1 main droite, 2 main gauche, 3 sabre, 4 ordre

// Réglages communs (exportés : le simulateur d'équilibrage peut les modifier)
// bullet = vitesse des balles ; hand = écart des deux pistolets ; combo = écart entre deux coups de sabre (s), thrustW =
// largeur de l'estocade, wave = vitesse des vagues de la Lame des marées et leur demi-largeur ; ball = vitesse des boulets,
// crushW = rayon d'écrasement d'un boulet, big = taille d'un monstre qui arrête le boulet (en plus des boss et des élites),
// chainW = demi-largeur des boulets ramés ; orbit = rayon de vol des perroquets, dive / back = vitesses de piqué et de
// retour, hop = portée d'un rebond des aras, gold = or rapporté par victime des aras (× or de la partie)
export const PIRW = { bullet: 860, hand: 11, combo: 0.15, thrustW: 34, wave: 560, waveW: 58, ball: 300, crushW: 18, big: 26, chainW: 52,
  orbit: 66, dive: 680, back: 560, hop: 170, gold: 1.5 };

addWeapons({
  // ---------- Pistolets (arme de départ) ----------
  // Un tir toutes les cd s, une main puis l'autre, vers la cible ; au niveau 5, 2 balles par tir. Évolués (Pistolets d'or) :
  // gerbes de 3 balles dorées perçantes, bien plus rapides.
  pistols: {
    stats: ({ A, h, L, E }) => E
      ? { dmg: A * 0.8 * 1.3 * 1.25 * 1.3, cd: 0.2 * h, n: 3, pierce: 2, R: 420, spread: 0.13 }
      : { dmg: A * 0.8 * (L(2) ? 1.3 : 1) * (L(5) ? 1.25 : 1), cd: (L(4) ? 0.28 : 0.36) * h, n: 1 + L(5), pierce: L(3), R: 380, spread: 0.1 },
    lines: [D_('Dégâts par balle'), ['cd', 'Tir toutes les', secS], ['n', 'Balles par tir', fN], ['pierce', 'Transperce', fP], ['R', 'Portée', fI]],
    fire(run, w, S, E, dt) {
      const s = st(run, w), p = run.p;
      if (w.t <= 0) {
        const t = run.aim(S.R);
        if (!t) w.t = 0.12;
        else {
          w.t = S.cd; s.side ^= 1;
          const a = Math.atan2(t.y - p.y, t.x - p.x), sd = s.side ? 1 : -1, ox = p.x + Math.cos(a) * 14 - Math.sin(a) * PIRW.hand * sd, oy = p.y + Math.sin(a) * 14 + Math.cos(a) * PIRW.hand * sd;
          for (let i = 0; i < S.n; i++) proj(s, s.aux, ox, oy, a + (i - (S.n - 1) / 2) * S.spread, PIRW.bullet, S.R * 1.05 / PIRW.bullet, S.dmg).pierce = S.pierce;
          run.fx.push({ type: 'pirShot', x: ox, y: oy, a, sd, life: 0.16, max: 0.16, evo: E });
          atk(run, a, s.side ? 1 : 2);
          sfx('pirShot');
        }
      }
      // balles : la première rencontrée prend le coup (puis transperce selon pierce)
      const B = s.aux;
      let n = 0;
      for (const b of B) {
        if ((b.life -= dt) <= 0) { s.free.push(b); continue; }
        b.x += b.vx * dt; b.y += b.vy * dt;
        let done = false;
        for (const e of run.grid.query(b.x, b.y, 50, Q)) {
          if (e.dead || e.burrowed || (e.x - b.x) ** 2 + (e.y - b.y) ** 2 > (e.r + 7) ** 2 || b.hit.includes(e)) continue;
          run.hitEnemy(e, b.dmg, { knock: 50, kx: b.vx / b.v, ky: b.vy / b.v, color: E ? '#ffd23a' : null });
          if (b.pierce-- <= 0) { done = true; break; }
          b.hit.push(e);
        }
        if (done) { s.free.push(b); continue; }
        B[n++] = b;
      }
      B.length = n;
    },
  },

  // ---------- Sabre d'abordage ----------
  // Deux coups en arc devant elle vers la cible (l'aller, puis le retour PIRW.combo s plus tard) ; dès le niveau 4, une
  // estocade suit (coup droit en ligne, plus loin). Évolué (Lame des marées) : sabre d'écume, chaque coup lance une vague
  // tranchante qui traverse les rangs.
  cutlass: {
    stats: ({ A, ar, h, L, E }) => {
      const d = A * 1.15 * (L(2) ? 1.3 : 1) * (L(5) ? 1.4 : 1);
      return E ? { dmg: d * 1.35, cd: 0.72 * h, R: 136 * ar, arc: 2.5, thrust: d * 1.35 * 1.5, wave: d * 0.8, wR: 430 }
        : { dmg: d, cd: (L(5) ? 0.82 : 1.0) * h, R: (L(3) ? 120 : 98) * ar, arc: L(3) ? 2.35 : 2.0, thrust: L(4) ? d * 1.5 : 0, wave: 0, wR: 0 };
    },
    lines: [D_('Dégâts par coup'), ['cd', 'Recharge', secS], ['R', 'Portée', fI], ['thrust', 'Estocade', v => (v ? fI(v) : 'non')], ['wave', 'Vagues tranchantes', v => (v ? fI(v) : 'non')], ['arc', 'Arc', v => num(v * 180 / Math.PI) + NB + '°']],
    size: 'R',
    fire(run, w, S, E, dt) {
      const s = st(run, w), p = run.p;
      if (s.c < 0 && w.t <= 0) { // nouvel enchaînement vers la cible
        const t = run.aim(S.R + 70);
        if (!t) w.t = 0.15;
        else { w.t = S.cd; s.c = 0; s.ct = 0; s.base = Math.atan2(t.y - p.y, t.x - p.x); }
      }
      if (s.c >= 0) {
        s.ct += dt;
        const steps = S.thrust ? 3 : 2;
        while (s.c < steps && s.ct >= s.c * PIRW.combo) {
          const t = run.aim(S.R + 70); // le sabre suit la cible entre deux coups
          if (t) s.base = Math.atan2(t.y - p.y, t.x - p.x);
          if (s.c < 2) slash(run, s, S, E, s.base + (s.c ? 0.22 : -0.22), s.c);
          else thrust(run, s, S, E, s.base);
          s.c++;
        }
        if (s.c >= steps) s.c = -1;
      }
      // vagues tranchantes (Lame des marées)
      const V = s.aux;
      let n = 0;
      for (const b of V) {
        if ((b.life -= dt) <= 0) { s.free.push(b); continue; }
        b.x += b.vx * dt; b.y += b.vy * dt;
        for (const e of run.grid.query(b.x, b.y, PIRW.waveW + 50, Q)) {
          if (e.dead || e.burrowed || b.hit.includes(e) || !across(b, e, PIRW.waveW)) continue;
          b.hit.push(e);
          run.hitEnemy(e, b.dmg, { knock: 140, kx: b.vx / b.v, ky: b.vy / b.v, color: '#9af0ff' });
        }
        V[n++] = b;
      }
      V.length = n;
    },
  },

  // ---------- Canon ----------
  // Un petit canon apparaît à ses côtés et tire n boulets vers la cible toutes les cd s : un boulet roule (vitesse PIRW.ball)
  // en écrasant les monstres sur son passage (dmg), puis explose (boom, rayon R) au bout de sa course ou contre un gros
  // monstre (boss, élite). Évolué (Boulets ramés) : 3 paires de boulets enchaînés qui tournoient, fauchent une large bande
  // (PIRW.chainW) et explosent plus fort.
  cannon: {
    stats: ({ A, ar, h, L, E }) => {
      const k = (L(2) ? 1.3 : 1) * (L(5) ? 1.3 : 1);
      return E ? { dmg: A * 1.6 * 1.3 * 1.3 * 1.3, boom: A * 3.6 * 1.3 * 1.3 * 1.35, cd: 2.0 * h, n: 3, R: 112 * ar, range: 470 }
        : { dmg: A * 1.0 * k, boom: A * 3.2 * k, cd: (L(5) ? 2.2 : 2.8) * h, n: 1 + L(4), R: (L(3) ? 98 : 78) * ar, range: 430 };
    },
    lines: [D_('Dégâts d\'explosion'), ['boom', 'Explosion', fI], ['n', 'Boulets', fN], ['cd', 'Recharge', secS], ['R', 'Zone', fI]],
    size: 'R',
    fire(run, w, S, E, dt) {
      const s = st(run, w), p = run.p;
      if (w.t <= 0) {
        const t = run.aim(S.range);
        if (!t) w.t = 0.2;
        else {
          w.t = S.cd;
          const a0 = Math.atan2(t.y - p.y, t.x - p.x), v = PIRW.ball * (E ? 1.15 : 1), sx = p.x + Math.cos(a0) * 30, sy = p.y + Math.sin(a0) * 30;
          for (let i = 0; i < S.n; i++) {
            const b = proj(s, s.list, sx, sy, a0 + (i - (S.n - 1) / 2) * (E ? 0.34 : 0.3), v, S.range / v, S.dmg);
            b.boom = S.boom; b.R = S.R; b.evo = E;
          }
          run.fx.push({ type: 'pirCannon', x: sx, y: sy, a: a0, life: 0.75, max: 0.75, evo: E });
          atk(run, a0, 4);
          sfx('pirCannon');
        }
      }
      const B = s.list;
      let n = 0;
      for (const b of B) {
        b.spin += dt * (E ? 14 : 9);
        let stop = (b.life -= dt) <= 0;
        if (!stop) {
          b.x += b.vx * dt; b.y += b.vy * dt;
          const W = E ? PIRW.chainW : PIRW.crushW;
          for (const e of run.grid.query(b.x, b.y, W + 50, Q)) {
            if (e.dead || e.burrowed || b.hit.includes(e)) continue;
            if (E ? !across(b, e, W) : (e.x - b.x) ** 2 + (e.y - b.y) ** 2 > (e.r + W) ** 2) continue;
            if (e.boss || e.elite || e.r >= PIRW.big) { stop = true; break; } // un gros monstre arrête le boulet
            b.hit.push(e);
            const side = (-(e.x - b.x) * Math.sin(b.a) + (e.y - b.y) * Math.cos(b.a)) >= 0 ? 1 : -1; // écrasé, projeté sur le côté
            run.hitEnemy(e, b.dmg, { knock: 220, kx: -Math.sin(b.a) * side + Math.cos(b.a) * 0.4, ky: Math.cos(b.a) * side + Math.sin(b.a) * 0.4, quiet: true });
          }
          if (b.x < -HALF + 30 || b.x > HALF - 30 || b.y < -HALF + 30 || b.y > HALF - 30) stop = true;
        }
        if (stop) { // explosion
          zone(run, b.x, b.y, b.R, b.boom, { knock: 240, color: '#ffb04a' });
          run.fx.push({ type: 'pirBoom', x: b.x, y: b.y, R: b.R, life: 0.45, max: 0.45, evo: E });
          sfx('pirBoom');
          s.free.push(b); continue;
        }
        B[n++] = b;
      }
      B.length = n;
    },
  },

  // ---------- Perroquet ----------
  // n perroquets tournent autour d'elle ; toutes les cd s, chacun fond sur un monstre (à moins de R d'elle, un autre que ceux
  // des autres perroquets), le pique (dmg) puis revient. Évolués (Aras pillards) : 3 aras qui piquent en chaîne (chain
  // monstres par piqué) et rapportent de l'or à chaque victime.
  parrot: {
    stats: ({ A, ar, h, L, E }) => {
      const d = A * 1.6 * (L(2) ? 1.3 : 1) * (L(5) ? 1.3 : 1);
      return E ? { dmg: d * 1.35, cd: 0.5 * h, n: 3, R: 320 * ar, chain: 3 }
        : { dmg: d, cd: (L(3) ? 0.7 : 0.95) * h, n: 1 + L(4), R: (L(5) ? 300 : 240) * ar, chain: 1 };
    },
    lines: [D_('Dégâts par coup de bec'), ['n', 'Perroquets', fN], ['chain', 'Coups par piqué', fN], ['cd', 'Repos entre deux piqués', secS], ['R', 'Chasse à', fI]],
    size: 'R',
    fire(run, w, S, E, dt) {
      const s = st(run, w), p = run.p, P = s.list, X = s.ex;
      while (P.length < S.n) P.push({ x: p.x, y: p.y, z: 60, m: 0, k: 0.3 + P.length * 0.25, tg: null, c: 0, a: 0, ft: 0, id: P.length, hit: [], peck: 0 });
      const n = P.length;
      X.length = 0;
      for (const q of P) if (q.m === 1 && q.tg) X.push(q.tg);
      for (let i = 0; i < n; i++) {
        const q = P[i];
        q.peck = Math.max(0, q.peck - dt * 4);
        if (q.m === 1) { // piqué vers la cible
          q.ft += dt;
          if (!alive(q.tg)) q.tg = nearTo(run, q.x, q.y, PIRW.hop, q.hit); // la proie est tombée : une autre, tout près
          if (!q.tg || q.ft > 1.6) { q.m = 2; continue; }
          const e = q.tg, dx = e.x - q.x, dy = e.y - q.y, d = Math.hypot(dx, dy) || 1, step = PIRW.dive * dt;
          q.a = Math.atan2(dy, dx); q.z += (20 + e.fly * 0.5 - q.z) * Math.min(1, dt * 8);
          if (d > e.r + 10 + step) { q.x += dx / d * step; q.y += dy / d * step; continue; }
          // coup de bec
          q.x = e.x - dx / d * (e.r + 6); q.y = e.y - dy / d * (e.r + 6); q.peck = 1; q.c--;
          q.hit.push(e);
          run.hitEnemy(e, S.dmg, { knock: 70, kx: dx / d, ky: dy / d, color: E ? '#ffd23a' : '#9aff6a' });
          run.fx.push({ type: 'pirPeck', x: e.x, y: e.y, z: e.r * 1.2 + e.fly, life: 0.25, max: 0.25, evo: E });
          sfx('pirPeck');
          if (E && e.dead) { // les aras rapportent de l'or
            const g = Math.max(1, Math.round(PIRW.gold * (1 + run.zone.id * 0.5) * run.base.gold * run.diff.gold));
            run.gold += g;
            run.fx.push({ type: 'pirCoin', x: e.x, y: e.y, z: e.r * 1.2 + e.fly, g, life: 0.55, max: 0.55 });
          }
          q.tg = q.c > 0 ? nearTo(run, e.x, e.y, PIRW.hop, q.hit) : null;
          if (!q.tg) q.m = 2;
          continue;
        }
        // en vol autour d'elle (décalés les uns des autres), ou retour
        const an = w.a * 2.1 + i / n * TAU, R = PIRW.orbit + (i % 2) * 16, hx = p.x + Math.cos(an) * R, hy = p.y + Math.sin(an) * R * 0.8;
        if (q.m === 2) {
          const dx = hx - q.x, dy = hy - q.y, d = Math.hypot(dx, dy) || 1, step = PIRW.back * dt;
          q.a = Math.atan2(dy, dx); q.z += (62 - q.z) * Math.min(1, dt * 5);
          if (d <= step + 10) { q.m = 0; q.k = S.cd; } else { q.x += dx / d * step; q.y += dy / d * step; }
          continue;
        }
        const k = Math.min(1, dt * 6), ox = q.x, oy = q.y;
        q.x += (hx - q.x) * k; q.y += (hy - q.y) * k; q.z += (62 + Math.sin(w.a * 4 + i * 2) * 5 - q.z) * Math.min(1, dt * 5);
        if (Math.abs(q.x - ox) + Math.abs(q.y - oy) > 0.5) q.a = Math.atan2(q.y - oy, q.x - ox);
        if ((q.k -= dt) > 0) continue;
        const e = nearTo(run, p.x, p.y, S.R, X);
        if (!e) { q.k = 0.15; continue; }
        q.m = 1; q.tg = e; q.c = S.chain; q.ft = 0; q.hit.length = 0;
        X.push(e);
        if (s.n++ % 3 === 0) sfx('pirSquawk');
      }
    },
  },
});

// un coup de sabre : arc vers a (k = 0 l'aller, 1 le retour), recul, croissant acier et or (écume pour la Lame des marées)
function slash(run, s, S, E, a, k) {
  const p = run.p, R = S.R, half = S.arc / 2;
  run.fx.push({ type: 'slash', x: p.x, y: p.y, a, r: R, life: 0.24, max: 0.24, c1: E ? '#c8fbff' : '#f4f8ff', c2: E ? '#2ab8ff' : '#ffc23a', c3: E ? '#7ae8ff' : '#ffe8a8', evo: E, pir: k ? 2 : 1 });
  for (const e of run.grid.query(p.x, p.y, R + 40, Q)) {
    if (e.dead || e.burrowed) continue;
    const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy);
    if (d > R + e.r) continue;
    let da = Math.atan2(dy, dx) - a; da = Math.atan2(Math.sin(da), Math.cos(da));
    if (Math.abs(da) < half + 0.05 || d < 26) run.hitEnemy(e, S.dmg, { knock: 170, kx: dx / (d || 1), ky: dy / (d || 1) });
  }
  if (E) { const b = proj(s, s.aux, p.x + Math.cos(a) * 20, p.y + Math.sin(a) * 20, a, PIRW.wave, S.wR / PIRW.wave, S.wave); b.k = k; }
  sfx('pirSlash');
}
// estocade : coup droit en ligne vers a (1,7 × la portée), repousse fort
function thrust(run, s, S, E, a) {
  const p = run.p, L = S.R * 1.7, c = Math.cos(a), sn = Math.sin(a), W = PIRW.thrustW;
  run.fx.push({ type: 'pirThrust', x: p.x, y: p.y, a, len: L, life: 0.22, max: 0.22, evo: E });
  atk(run, a, 5);
  for (const e of run.grid.query(p.x + c * L / 2, p.y + sn * L / 2, L / 2 + 40, Q)) {
    if (e.dead || e.burrowed) continue;
    const ex = e.x - p.x, ey = e.y - p.y, al = ex * c + ey * sn;
    if (al < -10 || al > L + e.r * 0.5 || Math.abs(-ex * sn + ey * c) > W / 2 + e.r * 0.7) continue;
    run.hitEnemy(e, S.thrust, { knock: 240, kx: c, ky: sn, color: E ? '#9af0ff' : '#fff0c0' });
  }
  sfx('pirThrust');
}
