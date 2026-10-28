// Arsenal de Tess l'Ingénieure : Tourelle (arme de départ), Drone d'appui, Lance-flammes, Mines électriques, décrits pour
// weapons-reg.js (stats, fire, lines, size). Passif « Bricoleuse » (CLASSES.engineer.gadget) : tourelles, drones et mines
// durent plus longtemps (dur × (1 + gadget), compris dans les fiches de niveau).
// Chaque arme garde son état en cours (tourelles, drones, tirs, mines, flaques…) dans ENGS (arme → état), lu par le rendu
// js/g3d/fx-engineer.js : rien n'est ajouté à l'objet arme (copié tel quel dans le résumé de fin de partie) ; nouveau monde
// (run.stage) : état remis à zéro. Les tirs sont des objets réutilisés (réserve free) : aucune allocation en régime établi.
// Dégâts en multiples de A (attaque × dégâts × rareté), recharges × h (hâte), tailles × ar (tome de taille), comme
// run.wstats. Effets ponctuels pour le rendu : run.fx { type: 'eng…' } (geste d'attaque, tourelle posée, décharges…).
import { addWeapons } from './weapons-reg.js';
import { sfx } from './audio.js';
import { fmt } from './ui.js';

const TAU = Math.PI * 2, NB = ' ', HALF = 1600;
const num = (v, d = 0) => { const k = 10 ** d; return (Math.round(v * k) / k).toLocaleString('fr-FR', { maximumFractionDigits: d }); };
const fI = v => fmt(v), fN = v => String(v), secS = v => num(v, 2) + NB + 's';
const fP = v => (v ? `${v} ennemi${v > 1 ? 's' : ''}` : 'non');
const D_ = l => ['dmg', l, fI], CD = (l = 'Recharge', f = secS) => ['cd', l, f];
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const alive = e => !!e && !e.dead && !e.burrowed;
const Q = [], Q2 = [], Q3 = []; // résultats de la grille (réutilisés, jamais deux boucles imbriquées sur le même)
const gk = run => 1 + (run.cls?.gadget || 0); // Bricoleuse : durée des gadgets

// état en cours d'une arme (WeakMap : disparaît avec l'arme) ; list : tourelles / drones / mines, aux : tirs ou flaques,
// free : tirs réutilisables, hit / pts : listes de travail des décharges, links : arcs de la grille Tesla (x0, y0, x1, y1…)
export const ENGS = new WeakMap();
function st(run, w) {
  let s = ENGS.get(w);
  if (!s || s.stage !== run.stage) { s = { stage: run.stage, list: [], aux: [], free: [], hit: [], links: [], n: 0, on: 0, k: 0, a: 0, pk: 0, lk: 0 }; ENGS.set(w, s); }
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
// point (x, y) ramené sur la carte et dans l'arène du boss s'il y en a une
function inside(run, o, x, y, m = 30) {
  x = clamp(x, -HALF + 80, HALF - 80); y = clamp(y, -HALF + 80, HALF - 80);
  const A = run.arena;
  if (A) { const ax = x - A.x, ay = y - A.y, d = Math.hypot(ax, ay), R = A.R - m; if (d > R) { x = A.x + ax / d * R; y = A.y + ay / d * R; } }
  o.x = x; o.y = y;
  return o;
}
// dégâts de zone autour de (x, y) ; renvoie le monstre touché le plus proche du centre
function zone(run, x, y, R, dmg, o) {
  let first = null, fd = Infinity;
  for (const e of run.grid.query(x, y, R + 40, Q)) {
    if (e.dead || e.burrowed) continue;
    const dx = e.x - x, dy = e.y - y, d = Math.hypot(dx, dy);
    if (d > R + e.r * 0.5) continue;
    o.kx = dx / (d || 1); o.ky = dy / (d || 1);
    run.hitEnemy(e, dmg, o);
    if (d < fd) { fd = d; first = e; }
  }
  return first;
}

// ---------- Tirs (balles des tourelles, missiles, lasers des drones) ----------
// tir réutilisé : de (x, y) vers l'angle a, vitesse v, durée de vie life ; pierce = monstres traversés en plus ;
// boom > 0 : missile qui suit sa cible tg et explose (rayon boom) ; z = hauteur de départ (rendu)
function shot(s, x, y, z, a, v, life, dmg, pierce = 0, boom = 0, tg = null) {
  const b = s.free.pop() || { hit: [] };
  b.x = x; b.y = y; b.z = z; b.a = a; b.vx = Math.cos(a) * v; b.vy = Math.sin(a) * v; b.v = v; b.life = life; b.max = life;
  b.dmg = dmg; b.pierce = pierce; b.boom = boom; b.tg = tg; b.hit.length = 0;
  s.aux.push(b);
  return b;
}
function moveShots(run, s, dt, color) {
  const L = s.aux;
  let n = 0;
  for (const b of L) {
    if ((b.life -= dt) <= 0) { if (b.boom) blast(run, b, color); s.free.push(b); continue; }
    if (b.boom && alive(b.tg)) { // missile : vire vers sa cible
      const da = Math.atan2(Math.sin(Math.atan2(b.tg.y - b.y, b.tg.x - b.x) - b.a), Math.cos(Math.atan2(b.tg.y - b.y, b.tg.x - b.x) - b.a));
      b.a += clamp(da, -7 * dt, 7 * dt); b.vx = Math.cos(b.a) * b.v; b.vy = Math.sin(b.a) * b.v;
    }
    b.x += b.vx * dt; b.y += b.vy * dt;
    let done = false;
    for (const e of run.grid.query(b.x, b.y, 50, Q)) {
      if (e.dead || e.burrowed || (e.x - b.x) ** 2 + (e.y - b.y) ** 2 > (e.r + 8) ** 2 || b.hit.includes(e)) continue;
      if (b.boom) { blast(run, b, color); done = true; break; }
      run.hitEnemy(e, b.dmg, { knock: 40, kx: b.vx / b.v, ky: b.vy / b.v, color });
      if (b.pierce-- <= 0) { done = true; break; }
      b.hit.push(e);
    }
    if (done) { s.free.push(b); continue; }
    L[n++] = b;
  }
  L.length = n;
}
// explosion d'un missile
function blast(run, b, color) {
  zone(run, b.x, b.y, b.boom, b.dmg, { knock: 160, color: '#ffb04a', quiet: true });
  run.fx.push({ type: 'engBlast', x: b.x, y: b.y, R: b.boom, life: 0.4, max: 0.4 });
  sfx('missile');
}
const atk = (run, a) => run.fx.push({ type: 'engAtk', a, life: 0.2, max: 0.2 }); // geste d'attaque de Tess (rendu)

// Réglages communs (exportés : le simulateur d'équilibrage peut les modifier)
// bullet / laser / missile = vitesses (px/s) ; drone : rayon de vol autour de Tess, vitesse de retour ; flamme : vitesse
// de rotation du jet (rad/s), flaques de napalm (intervalle, durée, au plus pools à la fois), recul et ralentissement (s) des
// monstres brûlés ; mines : portée du lancer, rayon de déclenchement (en plus de la taille du monstre), saut des
// décharges, réserve (au plus caps mines posées), arcs de la grille Tesla (portée, largeur, intervalle)
export const ENGW = { bullet: 760, laser: 820, missile: 430, orbit: 70, back: 560, turn: 5, puddle: 0.3, pDur: 3, pools: 10, fKnock: 45, fSlow: 0.4,
  throwMin: 55, throwMax: 140, trig: 20, jump: 170, caps: [10, 14], link: 230, linkW: 30, linkT: 0.35 };

addWeapons({
  // ---------- Tourelle (arme de départ) ----------
  // Tess pose une tourelle à ses pieds (vers la cible) toutes les cd s ; au plus n tourelles (la plus vieille saute), chacune
  // dure dur s et tire sur le monstre le plus proche d'elle à portée. Évoluée (Batterie lance-missiles) : 4 tourelles
  // blindées à double canon, tirs bien plus rapides, et un tir sur 4 est un missile qui suit sa cible et explose.
  turret: {
    stats: ({ A, ar, h, L, E, run }) => E
      ? { dmg: A * 1.0 * 1.3 * 1.3 * 1.35, cd: 2.4 * h, n: 4, rate: 0.3 * h, R: 300 * ar, dur: 9 * gk(run), mis: A * 1.0 * 1.3 * 1.3 * 3.2, mR: 70 * ar }
      : { dmg: A * 1.0 * (L(2) ? 1.3 : 1) * (L(5) ? 1.3 : 1), cd: 3.2 * h, n: 2 + L(3) + L(5), rate: (L(4) ? 0.42 : 0.55) * h, R: 260 * ar, dur: 7 * gk(run), mis: 0, mR: 0 },
    lines: [D_('Dégâts par tir'), ['n', 'Tourelles', fN], ['rate', 'Tir toutes les', secS], ['mis', 'Missiles', v => (v ? fI(v) : 'non')], ['dur', 'Durée', secS], CD('Nouvelle tourelle toutes les'), ['R', 'Portée', fI]],
    size: 'R',
    fire(run, w, S, E, dt) {
      const s = st(run, w), p = run.p, T = s.list;
      if (w.t <= 0) { // nouvelle tourelle (la plus vieille saute s'il y en a trop)
        w.t = S.cd;
        const t = run.aim(S.R), a = t ? Math.atan2(t.y - p.y, t.x - p.x) : Math.atan2(p.face.y, p.face.x);
        while (T.length >= S.n) { const o = T.shift(); run.fx.push({ type: 'engPoof', x: o.x, y: o.y, life: 0.4, max: 0.4 }); }
        const o = inside(run, { t: 0, dur: S.dur, k: 0.35, a, kick: 0, n: 0, id: s.n++, fx: p.x, fy: p.y }, p.x + Math.cos(a) * 38, p.y + Math.sin(a) * 38);
        T.push(o);
        atk(run, a);
        sfx('turret');
      }
      let n = 0;
      for (const o of T) {
        o.t += dt; o.kick = Math.max(0, o.kick - dt * 6);
        if (o.t >= o.dur) { run.fx.push({ type: 'engPoof', x: o.x, y: o.y, life: 0.4, max: 0.4 }); continue; }
        T[n++] = o;
        if ((o.k -= dt) > 0) continue;
        const e = nearTo(run, o.x, o.y, S.R);
        if (!e) { o.k = 0.15; continue; }
        o.k = S.rate; o.a = Math.atan2(e.y - o.y, e.x - o.x); o.kick = 1; o.n++;
        const side = E ? (o.n % 2 ? 1 : -1) * 7 : 0, ox = o.x - Math.sin(o.a) * side, oy = o.y + Math.cos(o.a) * side; // double canon : tirs alternés
        if (E && o.n % 4 === 0) shot(s, ox, oy, 30, o.a, ENGW.missile, 1.6, S.mis, 0, S.mR, e);
        else shot(s, ox, oy, 30, o.a, ENGW.bullet, S.R * 1.15 / ENGW.bullet, S.dmg);
        if (o.n % 2) sfx('tshot');
      }
      T.length = n;
      moveShots(run, s, dt, '#ffd27a');
    },
  },

  // ---------- Drone d'appui ----------
  // Les drones décollent du sac de Tess, tournent autour d'elle et tirent sur le monstre le plus proche ; au bout de leur
  // autonomie (dur s), ils reviennent se recharger (cd s). Évolués (Escadrille) : 4 drones qui ne se posent plus jamais et
  // tirent des lasers perçants.
  drone: {
    stats: ({ A, ar, h, L, E, run }) => E
      ? { dmg: A * 1.05 * 1.3 * 1.25 * 1.4, n: 4, rate: 0.32 * h, R: 300 * ar, pierce: 2, dur: 0, cd: 0 }
      : { dmg: A * 1.05 * (L(3) ? 1.3 : 1) * (L(5) ? 1.25 : 1), n: 1 + L(2) + L(5), rate: 0.4 * h, R: 270 * ar, pierce: 0, dur: (L(4) ? 9 : 7) * gk(run), cd: (L(4) ? 3 : 4) * h },
    lines: [D_('Dégâts par tir'), ['n', 'Drones', fN], ['pierce', 'Transperce', fP], ['rate', 'Tir toutes les', secS], ['dur', 'Autonomie', v => (v ? secS(v) : 'illimitée')], CD('Recharge', v => (v ? secS(v) : 'aucune')), ['R', 'Portée', fI]],
    size: 'R',
    fire(run, w, S, E, dt) {
      const s = st(run, w), p = run.p, D = s.list;
      while (D.length < S.n) D.push({ x: p.x, y: p.y, z: 34, m: 0, f: 0, r: 0.15 + D.length * 0.35, k: 0.3, kick: 0, a: 0, id: D.length });
      const n = D.length;
      for (let i = 0; i < n; i++) {
        const d = D[i];
        d.kick = Math.max(0, d.kick - dt * 6);
        if (d.m === 0) { // posé dans le sac : se recharge
          d.x = p.x; d.y = p.y; d.z = 34;
          if ((d.r -= dt) <= 0 || E) { d.m = 1; d.f = 0; run.fx.push({ type: 'engLaunch', x: p.x, y: p.y, life: 0.35, max: 0.35 }); sfx('drone'); }
          continue;
        }
        if (d.m === 2) { // retour au sac
          const dx = p.x - d.x, dy = p.y - d.y, dd = Math.hypot(dx, dy) || 1, step = ENGW.back * dt;
          d.z += (34 - d.z) * Math.min(1, dt * 6);
          if (dd <= step + 8) { d.m = 0; d.r = S.cd; } else { d.x += dx / dd * step; d.y += dy / dd * step; d.a = Math.atan2(dy, dx); }
          continue;
        }
        // en vol : cercle autour de Tess (décalés les uns des autres), tir sur le plus proche
        const an = w.a * 1.7 + i / n * TAU, R = ENGW.orbit + (i % 2) * 14, hx = p.x + Math.cos(an) * R, hy = p.y + Math.sin(an) * R * 0.8, k = Math.min(1, dt * 7);
        d.x += (hx - d.x) * k; d.y += (hy - d.y) * k; d.z += (60 + Math.sin(w.a * 3 + i * 2) * 6 - d.z) * Math.min(1, dt * 5);
        if (S.dur && (d.f += dt) >= S.dur) { d.m = 2; continue; }
        if ((d.k -= dt) > 0) continue;
        const e = nearTo(run, p.x, p.y, S.R);
        if (!e) { d.k = 0.15; continue; }
        d.k = S.rate * rand(0.9, 1.1); d.a = Math.atan2(e.y - d.y, e.x - d.x); d.kick = 1;
        shot(s, d.x, d.y, d.z, d.a, ENGW.laser, S.R * 1.3 / ENGW.laser, S.dmg, S.pierce);
        if (s.n++ % 2 === 0) sfx('dshot');
      }
      moveShots(run, s, dt, '#9af4ff');
    },
  },

  // ---------- Lance-flammes ----------
  // Jet de feu en cône vers la cible pendant dur s (il la suit en tournant), puis pause de cd s ; chaque tick s, tous les
  // monstres du cône brûlent. Évolué (Napalm) : flammes bleues plus longues et plus larges qui laissent des flaques de feu.
  flamer: {
    stats: ({ A, ar, h, L, E }) => E
      ? { dmg: A * 0.62 * 1.3 * 1.4 * 1.45, tick: 0.12, R: 230 * ar, arc: 0.95, dur: 2.2, cd: 1.7 * h, pool: A * 0.62 * 1.3 * 1.4 * 1.2, pR: 56 * ar }
      : { dmg: A * 0.62 * (L(2) ? 1.3 : 1) * (L(5) ? 1.4 : 1), tick: 0.12, R: (L(3) ? 175 : 145) * ar, arc: L(3) ? 0.8 : 0.62, dur: L(4) ? 1.8 : 1.3, cd: (L(5) ? 1.8 : 2.2) * h, pool: 0, pR: 0 },
    lines: [D_('Dégâts par brûlure'), ['R', 'Portée', fI], ['arc', 'Ouverture', v => num(v * 180 / Math.PI) + NB + '°'], ['pool', 'Flaques de feu', v => (v ? fI(v) : 'non')], ['dur', 'Jet', secS], CD(), ['tick', 'Brûle toutes les', secS]],
    size: 'R',
    fire(run, w, S, E, dt) {
      const s = st(run, w), p = run.p, P = s.aux;
      s.R = S.R; s.arc = S.arc; s.E = E;
      if (s.on > 0) {
        const t = run.aim(S.R + 40);
        if (t) { const da = Math.atan2(Math.sin(Math.atan2(t.y - p.y, t.x - p.x) - s.a), Math.cos(Math.atan2(t.y - p.y, t.x - p.x) - s.a)); s.a += clamp(da, -ENGW.turn * dt, ENGW.turn * dt); }
        if ((s.on -= dt) <= 0) { s.on = 0; w.t = S.cd; }
        if ((s.k -= dt) <= 0) { // brûlure : tout le cône
          s.k += S.tick;
          const ca = Math.cos(s.a), sa = Math.sin(s.a), R = S.R, half = S.arc / 2;
          for (const e of run.grid.query(p.x + ca * R / 2, p.y + sa * R / 2, R / 2 + 40, Q)) {
            if (e.dead || e.burrowed) continue;
            const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy);
            if (d > R + e.r * 0.5) continue;
            const al = dx * ca + dy * sa;
            if (d > 26 && (al <= 0 || Math.abs(Math.atan2(-dx * sa + dy * ca, al)) > half + Math.atan(e.r / d))) continue;
            run.hitEnemy(e, S.dmg, { quiet: true, color: E ? '#7ad8ff' : '#ffb04a', knock: ENGW.fKnock, kx: ca, ky: sa });
            if (!e.dead && !e.boss) e.slow = Math.max(e.slow, ENGW.fSlow); // les monstres en feu reculent et ralentissent
          }
          sfx('flame');
        }
        if (E && (s.pk -= dt) <= 0) { // napalm : une flaque de feu quelque part dans le cône
          s.pk = ENGW.puddle;
          const a = s.a + rand(-0.5, 0.5) * S.arc, r = S.R * rand(0.45, 0.9);
          if (P.length >= ENGW.pools) P.shift();
          P.push(inside(run, { t: 0, dur: ENGW.pDur, k: 0.1, R: S.pR }, p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, 0));
        }
      } else if (w.t <= 0) { // nouveau jet vers la cible
        const t = run.aim(S.R + 20);
        if (!t) w.t = 0.15;
        else { s.on = S.dur; s.k = 0; s.pk = 0.15; s.a = Math.atan2(t.y - p.y, t.x - p.x); atk(run, s.a); sfx('flameon'); }
      }
      let n = 0;
      for (const o of P) { // flaques de napalm : brûlent ce qui marche dedans
        if ((o.t += dt) >= o.dur) continue;
        P[n++] = o;
        if ((o.k -= dt) > 0) continue;
        o.k += 0.3;
        for (const e of run.grid.query(o.x, o.y, o.R + 30, Q)) if (!e.dead && !e.burrowed && (e.x - o.x) ** 2 + (e.y - o.y) ** 2 < (o.R + e.r * 0.5) ** 2) run.hitEnemy(e, S.pool, { quiet: true, color: '#7ad8ff' });
      }
      P.length = n;
    },
  },

  // ---------- Mines électriques ----------
  // Tess lance n mines autour d'elle (vers la cible) toutes les cd s ; armées après 0,5 s, elles sautent quand un monstre
  // marche dessus : décharge en zone, puis l'éclair saute sur chain monstres voisins (×cdmg). Évoluées (Grille Tesla) :
  // plus de mines, et chaque mine est reliée à sa voisine par un arc électrique qui foudroie tout ce qui passe entre elles.
  shockmine: {
    stats: ({ A, ar, h, L, E, run }) => E
      ? { dmg: A * 3 * 1.3 * 1.45, n: 3, cd: 1.7 * h, R: 72 * ar, chain: 6, cdmg: 0.75, dur: 14 * gk(run), arc: A * 1.3 }
      : { dmg: A * 3 * (L(3) ? 1.3 : 1), n: 1 + L(2) + L(5), cd: (L(5) ? 2.2 : 2.8) * h, R: 60 * ar, chain: 2 + L(4) * 2, cdmg: 0.7, dur: 12 * gk(run), arc: 0 },
    lines: [D_('Dégâts de la décharge'), ['n', 'Mines', fN], ['chain', 'Sauts de l\'éclair', fN], ['arc', 'Arcs entre les mines', v => (v ? fI(v) : 'non')], CD(), ['R', 'Zone', fI], ['dur', 'Durée', secS]],
    size: 'R',
    fire(run, w, S, E, dt) {
      const s = st(run, w), p = run.p, M = s.list;
      if (w.t <= 0) { // lancer
        w.t = S.cd;
        const t = run.aim(320), a0 = t ? Math.atan2(t.y - p.y, t.x - p.x) : Math.random() * TAU, cap = ENGW.caps[E ? 1 : 0];
        for (let i = 0; i < S.n; i++) {
          const a = a0 + (S.n > 1 ? (i / (S.n - 1) - 0.5) * 1.8 : 0) + rand(-0.4, 0.4), r = rand(ENGW.throwMin, ENGW.throwMax);
          while (M.length >= cap) { const o = M.shift(); run.fx.push({ type: 'engPoof', x: o.x, y: o.y, life: 0.3, max: 0.3, small: 1 }); }
          M.push(inside(run, { sx: p.x, sy: p.y, t: -i * 0.06, fl: 0.36, arm: 0.5, life: S.dur, id: s.n++ }, p.x + Math.cos(a) * r, p.y + Math.sin(a) * r));
        }
        atk(run, a0);
        sfx('minethrow');
      }
      let n = 0;
      for (const m of M) {
        if (m.t < m.fl) { m.t += dt; if (m.t >= m.fl) sfx('mineland'); M[n++] = m; continue; } // en vol
        m.arm -= dt;
        if ((m.life -= dt) <= 0) { run.fx.push({ type: 'engPoof', x: m.x, y: m.y, life: 0.3, max: 0.3, small: 1 }); continue; }
        if (m.arm <= 0) {
          let trig = null;
          for (const e of run.grid.query(m.x, m.y, 60, Q3)) if (!e.dead && !e.burrowed && (e.x - m.x) ** 2 + (e.y - m.y) ** 2 < (e.r + ENGW.trig) ** 2) { trig = e; break; }
          if (trig) { boom(run, s, m, S, E); continue; }
        }
        M[n++] = m;
      }
      M.length = n;
      // grille Tesla : arcs entre chaque mine armée et sa voisine la plus proche
      if (E) {
        const K = s.links;
        if ((s.lk -= dt) <= 0) {
          s.lk = ENGW.linkT; K.length = 0;
          for (let i = 0; i < M.length; i++) {
            const a = M[i];
            if (a.arm > 0) continue;
            let b = null, bd = ENGW.link * ENGW.link;
            for (let j = 0; j < M.length; j++) { const c = M[j]; if (j === i || c.arm > 0) continue; const d = (c.x - a.x) ** 2 + (c.y - a.y) ** 2; if (d < bd) { bd = d; b = c; } }
            if (!b || (b.id < a.id && nearestOf(M, b) === a)) continue; // une seule fois par paire
            K.push(a.x, a.y, b.x, b.y);
            arcHit(run, a.x, a.y, b.x, b.y, S.arc);
          }
          if (K.length) sfx('arc');
        }
      } else s.links.length = 0;
    },
  },
});

// voisine armée la plus proche d'une mine (paires de la grille Tesla)
function nearestOf(M, a) {
  let b = null, bd = ENGW.link * ENGW.link;
  for (const c of M) { if (c === a || c.arm > 0) continue; const d = (c.x - a.x) ** 2 + (c.y - a.y) ** 2; if (d < bd) { bd = d; b = c; } }
  return b;
}
// arc électrique entre deux mines : foudroie les monstres proches du segment
function arcHit(run, x0, y0, x1, y1, dmg) {
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, cx = dx / L, cy = dy / L, W = ENGW.linkW;
  for (const e of run.grid.query((x0 + x1) / 2, (y0 + y1) / 2, L / 2 + 40, Q)) {
    if (e.dead || e.burrowed) continue;
    const ex = e.x - x0, ey = e.y - y0, al = ex * cx + ey * cy;
    if (al < -8 || al > L + 8 || Math.abs(-ex * cy + ey * cx) > W / 2 + e.r * 0.6) continue;
    run.hitEnemy(e, dmg, { quiet: true, color: '#9af4ff' });
  }
}
// une mine saute : décharge en zone, puis l'éclair saute de monstre en monstre
function boom(run, s, m, S, E) {
  const first = zone(run, m.x, m.y, S.R, S.dmg, { knock: 140, color: '#9af4ff' }), H = s.hit;
  H.length = 0;
  const pts = [m.x, m.y];
  let cur = first;
  if (cur) { H.push(cur); pts.push(cur.x, cur.y); }
  for (let i = 0; i < S.chain && cur; i++) {
    const nx = nearTo(run, cur.x, cur.y, ENGW.jump, H);
    if (!nx) break;
    H.push(nx); pts.push(nx.x, nx.y);
    run.hitEnemy(nx, S.dmg * S.cdmg, { color: '#bff8ff', knock: 60, kx: Math.sign(nx.x - cur.x), ky: Math.sign(nx.y - cur.y) });
    cur = nx;
  }
  run.fx.push({ type: 'engZap', x: m.x, y: m.y, R: S.R, pts, life: 0.35, max: 0.35, evo: E });
  sfx('shock');
}
