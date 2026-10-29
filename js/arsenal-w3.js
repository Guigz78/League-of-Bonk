// Arsenal W3 : armes propres à Ragnar le Berserker (haches de guerre — sa nouvelle arme de départ —, cri de guerre, séisme,
// tourbillon) et à Gaïa la Druidesse (ronces, esprits de la forêt, pluie de pétales), décrites pour weapons-reg.js (stats,
// fire, lines, size). Chaque arme garde son état en cours (haches en vol, ondes, failles, poisons, esprits, nuées…) dans W3S
// (arme → état), lu par le rendu js/g3d/fx-w3.js : rien n'est ajouté à l'objet arme (copié tel quel dans le résumé de fin
// de partie) ; nouveau monde (run.stage) : état remis à zéro. Dégâts en multiples de A (attaque × dégâts × rareté),
// recharges × h (hâte), tailles × ar (tome de taille), comme run.wstats. Effets ponctuels pour le rendu : run.fx
// { type: 'w3…' } (fx-w3.js). Un ennemi n'est touché qu'une fois par onde / faille : e.hitT[clé] = n° de l'onde (4 clés
// tournantes, jamais plus de 4 en même temps), sans allocation.
// Équilibrage (simulateur l2/sim.mjs, bot qui prend la 1re carte, Normal, monde 1 → 2, boss tués, 30 parties chacun) :
// Ragnar 30/30 puis 24/30 (main avant les arsenaux, lame ricochet et armes communes : 28/30 puis 26/30 ; arsenal sans ses
// nouvelles armes : 18/20 puis 4/20), Gaïa 25/30 puis 16/30 (main : 22/30 puis 14/30 ; sans ses armes : 11/20 puis 0/20).
// Difficile, monde 1 : Ragnar 8/10, Gaïa 4/10 (main : 7/10, 3/10). Premier essai : haches ×1,3 et cri ×1,2 plus forts
// (Ragnar 20/20 puis 20/20, haches 55 % des victimes), ronces, esprits, pétales ×0,77 (Gaïa 14/20 puis 5/20).
import { addWeapons } from './weapons-reg.js';
import { sfx } from './audio.js';
import { fmt } from './ui.js';

const TAU = Math.PI * 2, NB = ' ';
const num = (v, d = 0) => { const k = 10 ** d; return (Math.round(v * k) / k).toLocaleString('fr-FR', { maximumFractionDigits: d }); };
const fI = v => fmt(v), fN = v => String(v), secS = v => num(v, 2) + NB + 's', pctS = v => num(v * 100, 1) + NB + '%';
const yes = v => (v ? 'oui' : 'non'), orNo = f => v => (v ? f(v) : 'non');
const D_ = l => ['dmg', l, fI], CD = (l = 'Recharge') => ['cd', l, secS];
const rand = (a, b) => a + Math.random() * (b - a);
const alive = e => !!e && !e.dead && !e.burrowed;
const Q = [], Q2 = [], PK = []; // résultats des requêtes de la grille et cibles déjà prises (réutilisés, jamais imbriqués)
const KC = ['w3c0', 'w3c1', 'w3c2', 'w3c3'], KQ = ['w3q0', 'w3q1', 'w3q2', 'w3q3', 'w3q4', 'w3q5'];

// état en cours d'une arme (WeakMap : disparaît avec l'arme) ; list / aux : ses objets (haches, ondes, failles, poisons…)
export const W3S = new WeakMap();
function st(run, w) {
  let s = W3S.get(w);
  if (!s || s.stage !== run.stage) { s = { stage: run.stage, list: [], aux: [], n: 0, k: 0, spin: 0, ang: 0, hs: 0, ht: 0 }; W3S.set(w, s); }
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
// autre cible que t autour du héros (au hasard parmi les monstres à portée) : haches en plus
function other(run, R, t, not) {
  const p = run.p, L = run.grid.query(p.x, p.y, R, Q2);
  for (let k = 0; k < 6 && L.length; k++) {
    const e = L[(Math.random() * L.length) | 0];
    if (e !== t && !e.dead && !e.burrowed && !not.includes(e) && (e.x - p.x) ** 2 + (e.y - p.y) ** 2 < R * R) return e;
  }
  return null;
}
// soin direct (cri du Jarl, esprits de la forêt) : « +N » vert groupé au-dessus du héros (au plus ~2 par seconde)
function heal(run, s, amt) {
  const p = run.p;
  if (run.dying) return;
  const h = Math.min(p.maxHp - p.hp, amt * (run.diff?.heal ?? 1));
  if (h <= 0) return;
  p.hp += h; s.hs += h;
  if (run.runTime >= s.ht && s.hs >= 1) { run.text(p.x + rand(-8, 8), p.y, 76, '+' + fmt(s.hs), '#7aff6a', 1.1); s.hs = 0; s.ht = run.runTime + 0.55; }
}
// ennemis d'un segment (failles, ronces) : départ (x, y), direction (cx, cy), de d0 à d1, demi-largeur hw ; remplit LN
// (monstres) et LS (côté : > 0 à gauche de la ligne), renvoie leur nombre (tableaux réutilisés : aucune allocation)
const LN = [], LS = [];
function onLine(run, x, y, cx, cy, d0, d1, hw) {
  const m = (d0 + d1) / 2;
  let n = 0;
  for (const e of run.grid.query(x + cx * m, y + cy * m, (d1 - d0) / 2 + hw + 40, Q)) {
    if (e.dead || e.burrowed) continue;
    const dx = e.x - x, dy = e.y - y, al = dx * cx + dy * cy, sd = -dx * cy + dy * cx;
    if (al < d0 - e.r * 0.5 || al > d1 + e.r * 0.5 || Math.abs(sd) > hw + e.r * 0.6) continue;
    LN[n] = e; LS[n++] = sd;
  }
  return n;
}

// Réglages communs (exportés : le simulateur d'équilibrage peut les modifier)
// axe : portée de visée, vitesse (px/s) et hauteur de la cloche des haches ; cryV : vitesse de l'onde du cri ;
// quakeV : vitesse de la faille, lavaT / lavaK : durée et intervalle de la lave ; spinV : vitesse du tourbillon (rad/s, rendu) ;
// psn : poison des ronces (durée, intervalle, cap = ennemis empoisonnés au plus) ; wisp : rayon de l'orbite, portée de la
// chasse, vitesse ; lag : retard de la nuée de pétales (plus petit = traîne plus loin derrière Gaïa), orbit : rayon des nuées
// qui tournent autour d'elle
export const W3B = {
  axeR: 360, axeV: 640, axeH: 70, cryV: 600, quakeV: 780, lavaT: 2.4, lavaK: 0.5, spinV: 15,
  psn: { dur: 3, tick: 0.5, cap: 70 }, wisp: { orbit: 56, seek: 270, v: 560 }, lag: 2.6, orbit: 130,
};

addWeapons({
  // ---------- Ragnar ----------
  // Haches de guerre (arme de départ) : Ragnar lance en cloche de lourdes haches qui tournoient, fendent tous les monstres
  // sur leur passage puis se plantent derrière la cible en éclatant (dégâts autour, imp). Plusieurs haches : une par cible,
  // lancées l'une après l'autre. Évoluées (Haches du Tonnerre) : 4 haches, la foudre tombe là où chacune se plante (bolt)
  // et étourdit les monstres touchés.
  waraxe: {
    stats: ({ A, ar, h, L, E }) => E
      ? { dmg: A * 1.15 * 1.3 * 1.3 * 1.3, cd: 1.0 * h, n: 4, R: 70 * ar, imp: A * 0.7 * 1.3 * 1.3 * 1.3, bolt: A * 1.2 * 1.3 }
      : { dmg: A * 1.15 * (L(2) ? 1.3 : 1) * (L(5) ? 1.3 : 1), cd: (L(4) ? 1.05 : 1.3) * h, n: 1 + L(3) + L(5), R: (L(4) ? 62 : 50) * ar, imp: A * 0.7 * (L(2) ? 1.3 : 1) * (L(5) ? 1.3 : 1), bolt: 0 },
    lines: [D_('Dégâts par hache'), ['imp', 'Éclat à l\'impact', fI], ['n', 'Haches', fN], ['bolt', 'Foudre à l\'impact', orNo(fI)], CD(), ['R', 'Zone d\'impact', fI]],
    size: 'R',
    fire(run, w, S, E, dt) {
      const s = st(run, w), p = run.p, L = s.list, X = s.aux, R = W3B.axeR;
      if (w.t <= 0) {
        const t = run.aim(R - 20);
        if (!t) w.t = 0.2;
        else {
          w.t = S.cd;
          const a0 = Math.atan2(t.y - p.y, t.x - p.x), d0 = Math.hypot(t.x - p.x, t.y - p.y);
          PK.length = 0;
          for (let i = 0; i < S.n; i++) {
            const e = (i && other(run, R, t, PK)) || t;
            PK.push(e);
            // une cible par hache ; seule la cible principale à portée : éventail autour d'elle
            let tx = e.x, ty = e.y;
            if (i && e === t) { const a = a0 + (i % 2 ? 1 : -1) * 0.34 * Math.ceil(i / 2); tx = p.x + Math.cos(a) * d0; ty = p.y + Math.sin(a) * d0; }
            L.push({ x: p.x, y: p.y, x0: p.x, y0: p.y, tx, ty, ux: 1, uy: 0, len: 0, d: 0, t: -i * 0.11, hit: [], spin: Math.random() * TAU, z: 30, evo: E });
          }
          sfx('w3axe');
        }
      }
      let n = 0;
      for (const q of L) {
        if (q.t < 0) { // pas encore lancée (2e main) : part de Ragnar, là où il est au moment du lancer
          if ((q.t += dt) >= 0) {
            const dx = q.tx - p.x, dy = q.ty - p.y, d = Math.hypot(dx, dy) || 1;
            q.x = q.x0 = p.x; q.y = q.y0 = p.y; q.ux = dx / d; q.uy = dy / d; q.len = Math.min(R, d + 34);
            run.fx.push({ type: 'w3throw', x: p.x, y: p.y, a: Math.atan2(dy, dx), life: 0.2, max: 0.2 });
          }
          L[n++] = q; continue;
        }
        if (!q.len) { const dx = q.tx - q.x0, dy = q.ty - q.y0, d = Math.hypot(dx, dy) || 1; q.ux = dx / d; q.uy = dy / d; q.len = Math.min(R, d + 34); run.fx.push({ type: 'w3throw', x: p.x, y: p.y, a: Math.atan2(dy, dx), life: 0.2, max: 0.2 }); }
        q.d = Math.min(q.len, q.d + W3B.axeV * dt); q.spin += dt * 17;
        q.x = q.x0 + q.ux * q.d; q.y = q.y0 + q.uy * q.d;
        const k = q.d / q.len; q.z = 30 + Math.sin(k * Math.PI) * W3B.axeH - k * 22;
        for (const e of run.grid.query(q.x, q.y, 60, Q)) { // fend tout sur son passage (une fois par monstre)
          if (e.dead || e.burrowed || (e.x - q.x) ** 2 + (e.y - q.y) ** 2 > (e.r + 18) ** 2 || q.hit.includes(e)) continue;
          q.hit.push(e);
          run.hitEnemy(e, S.dmg, { knock: 150, kx: q.ux, ky: q.uy, color: '#ffd8a8' });
        }
        if (q.d < q.len) { L[n++] = q; continue; }
        // se plante dans le sol : éclat autour (et la foudre, évoluée)
        const a = Math.atan2(q.uy, q.ux);
        for (const e of run.grid.query(q.x, q.y, S.R + 30, Q)) {
          if (e.dead || e.burrowed) continue;
          const dx = e.x - q.x, dy = e.y - q.y, d = Math.hypot(dx, dy) || 1;
          if (d > S.R + e.r * 0.5) continue;
          run.hitEnemy(e, S.imp, { knock: 200, kx: dx / d, ky: dy / d, quiet: !E && q.hit.includes(e), color: '#ffb04a' });
          if (S.bolt && !e.dead) { run.hitEnemy(e, S.bolt, { color: '#9ad8ff' }); if (e.boss) e.slow = Math.max(e.slow, 0.6); else e.freeze = Math.max(e.freeze, 0.5); }
        }
        X.push({ x: q.x, y: q.y, a, t: 0, evo: E });
        if (X.length > 8) X.shift();
        run.fx.push({ type: 'w3chop', x: q.x, y: q.y, a, r: S.R, life: 0.45, max: 0.45, evo: E });
        if (E) { run.fx.push({ type: 'w3bolt', x: q.x, y: q.y, r: S.R, life: 0.35, max: 0.35 }); sfx('w3thunder'); }
        sfx('w3chop');
      }
      L.length = n;
      n = 0;
      for (const x of X) if ((x.t += dt) < 0.75) X[n++] = x; // haches plantées (rendu seulement)
      X.length = n;
    },
  },

  // Cri de guerre : quand des monstres approchent, Ragnar rugit ; une onde part de lui, blesse chaque monstre qu'elle
  // atteint, le repousse fort et le ralentit (1 s). Niveau 5 : un écho (2e onde). Évolué (Rugissement du Jarl) : 3 ondes
  // géantes qui étourdissent (stun) et soignent Ragnar pour chaque monstre touché (au plus 10 par onde).
  warcry: {
    stats: ({ A, ar, h, L, E }) => E
      ? { dmg: A * 1.55 * 1.3 * 1.4 * 1.3, cd: 2.6 * h, R: 250 * ar, n: 3, stun: 0.7, heal: 0.004 }
      : { dmg: A * 1.55 * (L(2) ? 1.3 : 1) * (L(5) ? 1.4 : 1), cd: (L(4) ? 2.9 : 3.6) * h, R: (L(3) ? 205 : 170) * ar, n: 1 + L(5), stun: 0, heal: 0 },
    lines: [D_('Dégâts de l\'onde'), ['R', 'Portée', fI], ['n', 'Ondes', fN], ['stun', 'Étourdit', orNo(secS)], ['heal', 'Soin par ennemi', orNo(v => pctS(v) + ' des PV')], CD()],
    size: 'R',
    fire(run, w, S, E, dt) {
      const s = st(run, w), p = run.p, C = s.list;
      if (w.t <= 0) {
        if (!run.nearest(S.R * 0.75)) w.t = 0.25; // personne à portée : il attend
        else {
          w.t = S.cd;
          for (let i = 0; i < S.n; i++) { C.push({ x: p.x, y: p.y, r: 8, R: S.R * (1 - i * 0.08), d: -i * 0.2, key: KC[s.n++ % 4], hn: 0, evo: E, i }); }
          while (C.length > 4) C.shift();
          run.fx.push({ type: 'w3roar', x: p.x, y: p.y, life: 0.6, max: 0.6, evo: E });
          sfx('w3cry');
        }
      }
      let n = 0;
      for (const c of C) {
        if (c.d < 0) { c.d += dt; c.x = p.x; c.y = p.y; C[n++] = c; continue; } // écho : repart de Ragnar
        const r0 = c.r;
        c.r = Math.min(c.R, c.r + W3B.cryV * dt);
        for (const e of run.grid.query(c.x, c.y, c.r + 40, Q)) {
          if (e.dead || e.burrowed || e.hitT[c.key] === c) continue;
          const dx = e.x - c.x, dy = e.y - c.y, d = Math.hypot(dx, dy) || 1;
          if (d > c.r + e.r * 0.5 || d < r0 - e.r - 40) continue;
          e.hitT[c.key] = c;
          run.hitEnemy(e, S.dmg, { knock: 380, kx: dx / d, ky: dy / d, color: '#ffcf6a' });
          if (e.dead) continue;
          e.slow = Math.max(e.slow, 1);
          if (S.stun && c.i === 0) { if (e.boss) e.slow = Math.max(e.slow, S.stun * 2); else e.freeze = Math.max(e.freeze, S.stun); }
          if (S.heal && c.hn++ < 10) heal(run, s, p.maxHp * S.heal);
        }
        if (c.r < c.R) C[n++] = c;
      }
      C.length = n;
    },
  },

  // Séisme : Ragnar frappe le sol ; une faille court vers la cible (W3B.quakeV px/s) et blesse une fois chaque monstre sur
  // sa ligne (ils sont projetés de côté et ralentis). Évolué (Faille du Ragnarök) : 3 longues failles qui laissent une
  // coulée de lave (W3B.lavaT s) brûlant tout ce qui la traverse.
  quake: {
    stats: ({ A, ar, h, L, E }) => E
      ? { dmg: A * 2.4 * 1.3 * 1.3 * 1.3, cd: 1.9 * h, n: 3, len: 430 * ar, w: 56 * ar, lava: A * 0.55 * 1.3 }
      : { dmg: A * 2.4 * (L(2) ? 1.3 : 1) * (L(5) ? 1.3 : 1), cd: (L(4) ? 2.2 : 2.7) * h, n: 1 + L(3) + L(5), len: (L(4) ? 380 : 310) * ar, w: 44 * ar, lava: 0 },
    lines: [D_('Dégâts de la faille'), ['n', 'Failles', fN], ['lava', 'Lave (par brûlure)', orNo(fI)], ['len', 'Longueur', fI], CD(), ['w', 'Largeur', fI]],
    size: 'len',
    fire(run, w, S, E, dt) {
      const s = st(run, w), p = run.p, F = s.list;
      if (w.t <= 0) {
        const t = run.aim(S.len * 0.85);
        if (!t) w.t = 0.2;
        else {
          w.t = S.cd;
          const a0 = Math.atan2(t.y - p.y, t.x - p.x), sp = E ? 0.5 : 0.4;
          for (let i = 0; i < S.n; i++) {
            const a = a0 + (i - (S.n - 1) / 2) * sp;
            F.push({ x: p.x, y: p.y, a, cx: Math.cos(a), cy: Math.sin(a), len: S.len, d: 14, w: S.w, key: KQ[s.n++ % 6], t: 0, k: 0.15, lava: S.lava, seed: Math.random() * 100 });
          }
          while (F.length > 6) F.shift();
          run.fx.push({ type: 'w3stomp', x: p.x, y: p.y, a: a0, life: 0.4, max: 0.4, evo: E });
          run.shake = Math.max(run.shake, E ? 4 : 2.5);
          sfx('w3quake');
        }
      }
      let n = 0;
      for (const f of F) {
        if (f.d < f.len) { // le front de la faille avance
          const d0 = f.d;
          f.d = Math.min(f.len, f.d + W3B.quakeV * dt);
          for (let i = 0, m = onLine(run, f.x, f.y, f.cx, f.cy, d0 - 6, f.d, f.w / 2); i < m; i++) {
            const e = LN[i];
            if (e.dead || e.hitT[f.key] === f) continue;
            e.hitT[f.key] = f;
            const sg = LS[i] >= 0 ? 1 : -1;
            run.hitEnemy(e, S.dmg, { knock: 170, kx: -f.cy * sg, ky: f.cx * sg, color: '#ffb04a' });
            if (!e.dead) e.slow = Math.max(e.slow, 0.8);
          }
          F[n++] = f; continue;
        }
        f.t += dt;
        if (f.lava && (f.k -= dt) <= 0) { // coulée de lave : brûle tout ce qui est sur la faille
          f.k += W3B.lavaK;
          for (let i = 0, m = onLine(run, f.x, f.y, f.cx, f.cy, 0, f.len, f.w * 0.45); i < m; i++) run.hitEnemy(LN[i], f.lava, { quiet: true, color: '#ff7a2a' });
        }
        if (f.t < (f.lava ? W3B.lavaT : 0.55)) F[n++] = f;
      }
      F.length = n;
    },
  },

  // Tourbillon : quand des monstres sont proches, Ragnar tourne sur lui-même haches tendues pendant dur s et frappe tout
  // autour de lui toutes les rate s (recul) ; recharge comptée après le tourbillon. Évolué (Cyclone de fureur) : immense
  // tourbillon de feu qui aspire les monstres vers lui et explose à la fin (dégâts ×3, gros recul).
  whirlwind: {
    stats: ({ A, ar, h, L, E }) => E
      ? { dmg: A * 1.1 * 1.3 * 1.3 * 1.35, cd: 2.2 * h, R: 140 * ar, dur: 2.6, rate: 0.17, pull: 1 }
      : { dmg: A * 1.1 * (L(2) ? 1.3 : 1) * (L(5) ? 1.3 : 1), cd: (L(4) ? 2.7 : 3.4) * h, R: (L(3) ? 104 : 86) * ar, dur: L(3) ? 1.9 : 1.5, rate: L(5) ? 0.2 : 0.25, pull: 0 },
    lines: [D_('Dégâts par coup'), ['R', 'Rayon', fI], ['dur', 'Durée', secS], ['rate', 'Frappe toutes les', secS], ['pull', 'Aspire les ennemis', yes], CD()],
    size: 'R',
    fire(run, w, S, E, dt) {
      const s = st(run, w), p = run.p;
      if (w.t <= 0 && s.spin <= 0) {
        if (!run.nearest(S.R + 50)) w.t = 0.2;
        else { w.t = S.dur + S.cd; s.spin = s.dur = S.dur; s.k = 0; s.n = 0; s.R = S.R; s.evo = E; sfx('w3whirl'); }
      }
      if (s.spin <= 0) return;
      s.spin -= dt; s.ang += dt * W3B.spinV; s.R = S.R;
      if (S.pull) { // cyclone : les monstres proches sont aspirés vers l'anneau des haches
        for (const e of run.grid.query(p.x, p.y, S.R * 1.9, Q)) {
          if (e.dead || e.burrowed || e.boss) continue;
          const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1;
          if (d > S.R * 1.9 || d < S.R * 0.55) continue;
          const f = Math.min(d - S.R * 0.55, 130 * dt * (e.elite ? 0.4 : 1)); e.x += dx / d * f; e.y += dy / d * f;
        }
      }
      if ((s.k -= dt) <= 0) {
        s.k += S.rate; s.n++;
        for (const e of run.grid.query(p.x, p.y, S.R + 40, Q)) {
          if (e.dead || e.burrowed) continue;
          const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy) || 1;
          if (d > S.R + e.r * 0.6) continue;
          run.hitEnemy(e, S.dmg, { knock: S.pull ? 40 : 150, kx: dx / d, ky: dy / d, quiet: s.n % 3 !== 1, color: E ? '#ffb04a' : '#ffe0b0' });
        }
        if (s.n % 3 === 1) sfx('w3whirl');
      }
      if (s.spin <= 0 && S.pull) { // fin du cyclone : explosion de feu
        const R = S.R * 1.3;
        for (const e of run.grid.query(p.x, p.y, R + 40, Q)) {
          if (e.dead || e.burrowed) continue;
          const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy) || 1;
          if (d < R + e.r * 0.5) run.hitEnemy(e, S.dmg * 3, { knock: 420, kx: dx / d, ky: dy / d, color: '#ff8a2a' });
        }
        run.fx.push({ type: 'w3blast', x: p.x, y: p.y, r: R, life: 0.5, max: 0.5 });
        run.fx.push({ type: 'ring', x: p.x, y: p.y, r: R, life: 0.4, max: 0.4, color: '#ff7a2a' });
        run.shake = Math.max(run.shake, 5);
        sfx('boom');
      }
    },
  },

  // ---------- Gaïa ----------
  // Ronces : Gaïa fouette en ligne vers la cible ; le fouet se déploie, blesse chaque monstre touché et l'empoisonne
  // (W3B.psn : dégâts psn toutes les 0,5 s pendant 3 s, renouvelé à chaque coup, sans cumul). Évoluées (Ronces dévorantes) :
  // 4 fouets tout autour qui immobilisent (root s), et le poison passe à 2 voisins quand un monstre empoisonné meurt.
  thorns: {
    stats: ({ A, ar, h, L, E }) => E
      ? { dmg: A * 1.3 * 1.3 * 1.3, cd: 1.15 * h, n: 4, len: 290 * ar, psn: A * 0.42 * 1.3 * 1.4 * 1.4, root: 0.6, spread: 1 }
      : { dmg: A * 1.3 * (L(2) ? 1.3 : 1), cd: (L(5) ? 1.3 : 1.6) * h, n: 1 + L(3) + L(5), len: (L(4) ? 250 : 210) * ar, psn: A * 0.42 * (L(2) ? 1.3 : 1) * (L(4) ? 1.4 : 1), root: 0, spread: 0 },
    lines: [D_('Dégâts du fouet'), ['psn', 'Poison (toutes les 0,5 s)', fI], ['n', 'Fouets', fN], ['root', 'Immobilise', orNo(secS)], ['spread', 'Poison contagieux', yes], ['len', 'Longueur', fI], CD()],
    size: 'len',
    fire(run, w, S, E, dt) {
      const s = st(run, w), p = run.p, V = s.list, P = s.aux, PS = W3B.psn;
      if (w.t <= 0) {
        const t = run.aim(S.len * 0.95);
        if (!t) w.t = 0.2;
        else {
          w.t = S.cd;
          const a0 = Math.atan2(t.y - p.y, t.x - p.x);
          for (let i = 0; i < S.n; i++) {
            const a = E ? a0 + i * TAU / S.n : a0 + (S.n === 2 ? (i - 0.5) * 0.55 : (i ? (i % 2 ? 1 : -1) * 0.5 : 0));
            V.push({ a, cx: Math.cos(a), cy: Math.sin(a), len: S.len, t: 0, d: 0, hit: [], side: i % 2 ? -1 : 1, evo: E });
          }
          while (V.length > 8) V.shift();
          run.fx.push({ type: 'w3lash', x: p.x, y: p.y, a: a0, life: 0.2, max: 0.2 });
          sfx('w3whip');
        }
      }
      let n = 0;
      for (const v of V) { // fouet : se déploie en 0,15 s, frappe en passant, puis se replie (0,3 s en tout)
        v.t += dt;
        const d0 = v.d;
        v.d = v.len * Math.min(1, v.t / 0.15);
        for (let i = 0, m = v.d > d0 ? onLine(run, p.x, p.y, v.cx, v.cy, Math.max(0, d0 - 8), v.d, 15) : 0; i < m; i++) {
          const e = LN[i];
          if (e.dead || v.hit.includes(e)) continue;
          v.hit.push(e);
          run.hitEnemy(e, S.dmg, { knock: 60, kx: v.cx, ky: v.cy, color: '#b8ff6a' });
          if (e.dead) continue;
          poison(P, e, S.psn);
          if (S.root) { if (e.boss) e.slow = Math.max(e.slow, S.root * 2); else { e.freeze = Math.max(e.freeze, S.root); if (!(e.c2root > run.runTime + S.root)) e.c2root = run.runTime + S.root; } }
        }
        if (v.t < 0.32) V[n++] = v;
      }
      V.length = n;
      // poison : dégâts toutes les PS.tick s ; évolué : passe aux voisins à la mort (les poisons ajoutés pendant la boucle
      // sont à la fin du tableau : la boucle les voit aussi)
      n = 0;
      for (const o of P) {
        const e = o.e;
        if (e.dead) {
          if (S.spread) {
            let k = 0;
            for (const x of run.grid.query(e.x, e.y, 95, Q)) {
              if (k >= 2 || x === e || x.dead || x.burrowed || (x.x - e.x) ** 2 + (x.y - e.y) ** 2 > 95 * 95 || hasPoison(P, x)) continue;
              k++; poison(P, x, o.d);
              run.fx.push({ type: 'w3spread', x: e.x, y: e.y, tx: x.x, ty: x.y, life: 0.3, max: 0.3 });
            }
          }
          continue;
        }
        if (e.burrowed || (o.t -= dt) <= 0) continue;
        if ((o.k -= dt) <= 0) { o.k += PS.tick; run.hitEnemy(e, o.d, { quiet: true, color: '#9aff4a' }); }
        P[n++] = o;
      }
      P.length = n;
    },
  },

  // Esprits de la forêt : des feux follets tournent autour de Gaïa ; prêts, ils foncent chacun sur un monstre proche (pas
  // déjà visé) et éclatent (dégâts autour, R), ce qui soigne un peu Gaïa ; puis ils renaissent près d'elle (cd s). Évolués
  // (Esprits ancestraux) : 6 grands esprits dorés, éclats plus larges, ils brûlent aussi les monstres qu'ils traversent (burn).
  wisps: {
    stats: ({ A, ar, h, L, E }) => E
      ? { dmg: A * 2.1 * 1.3 * 1.3 * 1.3, cd: 1.0 * h, n: 6, R: 70 * ar, heal: 0.004, burn: A * 0.6 }
      : { dmg: A * 2.1 * (L(2) ? 1.3 : 1) * (L(5) ? 1.3 : 1), cd: (L(4) ? 1.3 : 1.7) * h, n: 2 + L(3) + L(5), R: (L(4) ? 54 : 44) * ar, heal: 0.003, burn: 0 },
    lines: [D_('Dégâts par éclat'), ['n', 'Esprits', fN], ['heal', 'Soin par éclat', v => pctS(v) + ' des PV'], ['burn', 'Brûlent au passage', orNo(fI)], CD('Renaissent en'), ['R', 'Zone d\'éclat', fI]],
    size: 'R',
    fire(run, w, S, E, dt) {
      const s = st(run, w), p = run.p, B = s.list, Wp = W3B.wisp;
      while (B.length < S.n) B.push({ x: p.x, y: p.y, z: 34, m: 2, t: 0.3 + B.length * 0.25, tg: null, k: 0, g: 0, dx: 0, dy: 0, ph: Math.random() * TAU });
      const n = B.length;
      for (let i = 0; i < n; i++) {
        const b = B[i];
        if (b.m !== 1) { // en orbite (ou en train de renaître) autour de Gaïa
          const a = w.a * 1.9 + i / n * TAU, r = Wp.orbit + Math.sin(w.a * 2.3 + i * 1.3) * 8, hx = p.x + Math.cos(a) * r, hy = p.y + Math.sin(a) * r * 0.8;
          const k = Math.min(1, dt * 10);
          b.dx = hx - b.x; b.dy = hy - b.y; b.x += b.dx * k; b.y += b.dy * k; b.z = 34 + Math.sin(w.a * 4 + i) * 5;
          if (b.m === 2) { b.g = Math.min(1, b.g + dt * 3); if ((b.t -= dt) <= 0) { b.m = 0; b.t = 0.15 * i; } continue; }
          b.g = 1;
          if (S.burn && (b.k -= dt) <= 0) { // évolués : brûlent ce qu'ils traversent (orbite)
            b.k = 0.45;
            for (const e of run.grid.query(b.x, b.y, 50, Q)) if (!e.dead && !e.burrowed && (e.x - b.x) ** 2 + (e.y - b.y) ** 2 < (e.r + 16) ** 2) run.hitEnemy(e, S.burn, { quiet: true, color: '#ffe48a' });
          }
          if ((b.t -= dt) > 0) continue;
          let best = null, bd = Infinity, alt = null, ad = Infinity;
          for (const e of run.grid.query(p.x, p.y, Wp.seek, Q)) {
            if (e.dead || e.burrowed || (e.x - p.x) ** 2 + (e.y - p.y) ** 2 > Wp.seek * Wp.seek) continue;
            const d = (e.x - b.x) ** 2 + (e.y - b.y) ** 2;
            let taken = false;
            for (const o of B) if (o.tg === e) { taken = true; break; }
            if (taken) { if (d < ad) { ad = d; alt = e; } } else if (d < bd) { bd = d; best = e; }
          }
          const tg = best || alt;
          if (tg) { b.m = 1; b.tg = tg; b.k = 0; if (s.n++ % 2 === 0) sfx('w3wisp'); } else b.t = 0.25;
          continue;
        }
        // en chasse : fonce sur sa cible (qui bouge) et éclate au contact
        let e = b.tg;
        b.k += dt;
        if (!alive(e)) e = b.tg = b.k < 1.4 ? nearTo(run, b.x, b.y, 200) : null;
        if (!e) { b.m = 0; b.t = 0.3; continue; }
        const dx = e.x - b.x, dy = e.y - b.y, d = Math.hypot(dx, dy) || 1, v = Wp.v * (0.7 + Math.min(0.6, b.k * 1.5)), step = v * dt, hz = e.r + (e.fly || 0);
        b.dx = dx / d; b.dy = dy / d; b.z += (hz - b.z) * Math.min(1, dt * 7);
        if (d > step + e.r * 0.6 + 4) { b.x += b.dx * step; b.y += b.dy * step; continue; }
        let hit = 0;
        for (const o of run.grid.query(e.x, e.y, S.R + 30, Q)) {
          if (o.dead || o.burrowed || (o.x - e.x) ** 2 + (o.y - e.y) ** 2 > (S.R + o.r * 0.5) ** 2) continue;
          run.hitEnemy(o, S.dmg, { knock: 90, kx: (o.x - e.x) / S.R, ky: (o.y - e.y) / S.R, quiet: o !== e, color: E ? '#ffe48a' : '#9affc8' });
          hit++;
        }
        if (hit) heal(run, s, p.maxHp * S.heal);
        run.fx.push({ type: 'w3pop', x: e.x, y: e.y, z: hz, r: S.R, life: 0.4, max: 0.4, evo: E });
        sfx('w3pop');
        b.m = 2; b.t = S.cd; b.g = 0; b.tg = null; b.x = p.x; b.y = p.y;
      }
    },
  },

  // Pluie de pétales : une nuée de pétales tranchants suit Gaïa avec un temps de retard (W3B.lag) : quand elle court, la
  // nuée traîne derrière elle et coupe les monstres qui la poursuivent ; tous les cd s, chaque monstre dans une nuée est
  // coupé. Niveau 4 : une 2e nuée tourne autour d'elle. Évoluée (Tempête de cerisiers) : 3 grandes nuées dorées.
  petals: {
    stats: ({ A, ar, h, L, E }) => E
      ? { dmg: A * 0.65 * 1.35 * 1.4 * 1.35, cd: 0.3 * h, n: 3, R: 112 * ar }
      : { dmg: A * 0.65 * (L(3) ? 1.35 : 1) * (L(5) ? 1.4 : 1), cd: (L(5) ? 0.34 : 0.4) * h, n: 1 + L(4), R: (L(2) ? 92 : 78) * ar },
    lines: [D_('Dégâts par coupure'), ['n', 'Nuées', fN], ['R', 'Rayon', fI], CD('Coupe toutes les')],
    size: 'R',
    fire(run, w, S, E, dt) {
      const s = st(run, w), p = run.p, Z = s.list;
      while (Z.length < S.n) Z.push({ x: p.x, y: p.y, R: S.R, i: Z.length, g: 0 });
      Z.length = S.n;
      const k = 1 - Math.exp(-W3B.lag * dt), no = S.n - 1;
      for (const z of Z) {
        z.R = S.R; z.g = Math.min(1, z.g + dt * 2.5);
        if (z.i === 0) { z.x += (p.x - z.x) * k; z.y += (p.y - z.y) * k; continue; } // la 1re nuée traîne derrière Gaïa
        const a = w.a * 1.15 + (z.i - 1) / no * TAU, hx = p.x + Math.cos(a) * W3B.orbit, hy = p.y + Math.sin(a) * W3B.orbit * 0.85, kk = Math.min(1, dt * 6);
        z.x += (hx - z.x) * kk; z.y += (hy - z.y) * kk;
      }
      if (w.t > 0) return;
      w.t = S.cd; s.n++;
      for (const z of Z) for (const e of run.grid.query(z.x, z.y, z.R + 30, Q)) {
        if (e.dead || e.burrowed || (e.x - z.x) ** 2 + (e.y - z.y) ** 2 > (z.R + e.r * 0.5) ** 2) continue;
        run.hitEnemy(e, S.dmg, { quiet: s.n % 3 !== 0, color: E ? '#ffd54a' : '#ff9ad8' });
      }
      if (s.n % 4 === 0) sfx('w3petal');
    },
  },
});

// poison des ronces : renouvelle la durée (sans cumul), garde le plus fort ; au plus W3B.psn.cap monstres empoisonnés
function hasPoison(P, e) { for (const o of P) if (o.e === e) return true; return false; }
function poison(P, e, d) {
  const PS = W3B.psn;
  for (const o of P) if (o.e === e) { o.t = PS.dur; o.d = Math.max(o.d, d); return; }
  if (P.length < PS.cap) P.push({ e, t: PS.dur, k: PS.tick, d });
}
