// Arsenal de Kenji le moine : Poings de fer (arme de départ), Paume de ki, Vague de chi, Dragon de ki, branchés sur le
// registre js/weapons-reg.js (importé une fois par run.js). stats = niveaux 1 à 5 et forme évoluée (dégâts en multiples de
// A, comme run.wstats) ; fire = chaque image, pendant run.updateWeapons (run.curW = l'arme : ses victimes lui sont comptées).
// Tout ce qui est en vol vit sur l'arme : w.q (réserve d'objets réutilisés, champ on), vidée au changement de monde : aucune
// allocation en régime établi (sauf les événements de rendu, un par coup).
// Rendu (js/g3d/fx-monk.js) : lit w.q (boules, ondes, dragons, poings de ki), w.fn / w.fa (nombre de coups, angle du
// dernier : geste du héros) et les événements 'mk' (kind = punch, palm, kiboom, wave, dive).
import { addWeapons } from './weapons-reg.js';
import { sfx } from './audio.js';
import { fmt } from './ui.js';

const TAU = Math.PI * 2;
const NEAR = []; // résultats de la grille (réutilisés ; jamais deux boucles imbriquées dessus)
// fiches de niveau (nombres à la française, comme run.js)
const NB = ' ';
const num = (v, d = 0) => { const k = 10 ** d; return (Math.round(v * k) / k).toLocaleString('fr-FR', { maximumFractionDigits: d }); };
const fI = v => fmt(v), fN = v => String(v), secS = v => num(v, 2) + NB + 's';
const fS = v => (v ? num(v, 1) + NB + 's' : 'non'), fPc = v => (v ? num(v * 100, 1) + NB + '% des PV' : 'non');
const D_ = l => ['dmg', l, fI], CD = l => ['cd', l || 'Recharge', secS];
const angd = (a, b) => { const d = a - b; return Math.atan2(Math.sin(d), Math.cos(d)); };
const ok = e => e && !e.dead && !e.burrowed;
const hold = (e, s) => { if (e.boss) e.slow = Math.max(e.slow, s); else e.freeze = Math.max(e.freeze, s); };

// objet libre d'une réserve (créé une seule fois, puis réutilisé) ; null si la réserve est pleine
function slot(a, cap, mk) {
  for (const o of a) if (!o.on) return o;
  if (a.length >= cap) return null;
  const o = { on: false, h: [], ...(mk ? mk() : null) };
  a.push(o);
  return o;
}
// réserve de l'arme ; nouveau monde : tout ce qui était en vol disparaît
function sync(run, w) {
  if (!w.q) w.q = [];
  if (w.st !== run.stage) { w.st = run.stage; for (const o of w.q) o.on = false; }
}
const fired = (w, a) => { w.fn = (w.fn || 0) + 1; w.fa = a; };
// dégâts de zone : tous les monstres à moins de R (+ la moitié de leur taille) de (x, y), repoussés depuis le centre
function zone(run, x, y, R, dmg, o) {
  let n = 0;
  for (const e of run.grid.query(x, y, R + 40, NEAR)) {
    if (e.dead || e.burrowed) continue;
    const dx = e.x - x, dy = e.y - y, d = Math.hypot(dx, dy);
    if (d > R + e.r * 0.5) continue;
    o.kx = dx / (d || 1); o.ky = dy / (d || 1);
    run.hitEnemy(e, dmg, o);
    n++;
  }
  return n;
}
// projectile qui avance et transperce : chaque monstre n'est touché qu'une fois (o.h)
function pierce(run, o, dt, opt) {
  o.life -= dt; o.x += o.vx * dt; o.y += o.vy * dt;
  for (const e of run.grid.query(o.x, o.y, o.r + 40, NEAR)) {
    if (e.dead || e.burrowed || (e.x - o.x) ** 2 + (e.y - o.y) ** 2 > (e.r + o.r) ** 2 || o.h.includes(e)) continue;
    if (o.h.length < 48) o.h.push(e);
    const v = Math.hypot(o.vx, o.vy) || 1;
    opt.kx = o.vx / v; opt.ky = o.vy / v;
    run.hitEnemy(e, o.dmg, opt);
  }
}
const KI = { knock: 120, kx: 0, ky: 0, color: '#ffd27a' }, PALM = { knock: 90, kx: 0, ky: 0, color: '#ffe48a' };
const BOOM = { knock: 260, kx: 0, ky: 0, color: '#fff0a0' }, BITE = { knock: 60, kx: 0, ky: 0, color: '#ffc23a', quiet: false };
const NS = 16; // points de la traînée d'un dragon (corps)
const MAREE_LS = 0.1; // Marée de sérénité : vol de vie compté en plus pour le plafond de soin par seconde

addWeapons({
  // ---------- Poings de fer (arme de départ) ----------
  // Coups de poing rapides vers la cible (portée courte, arc étroit) ; un coup sur trois est un coup final plus large et
  // plus long qui repousse fort (tout autour au niveau 4). Évoluée (Rafale du tigre) : bien plus rapide, chaque poing
  // projette un poing de ki qui transperce (w.q).
  fists: {
    stats: ({ A, ar, h, L, E }) => {
      const d = A * 0.85 * (L(2) ? 1.3 : 1) * (L(5) ? 1.4 : 1);
      return E ? { dmg: d * 1.3, cd: 0.2 * h, R: 112 * ar, fin: d * 1.3 * 2.3, arc: 0.8, all: 1, ki: d * 0.8, kR: 220 * ar }
        : { dmg: d, cd: (L(5) ? 0.28 : 0.33) * h, R: (L(3) ? 104 : 90) * ar, fin: d * 2.3, arc: 0.75, all: L(4) };
    },
    lines: [D_('Dégâts par coup'), ['fin', 'Coup final (1 sur 3)', fI], CD('Frappe toutes les'), ['R', 'Portée', fI], ['all', 'Coup final tout autour', v => (v ? 'oui' : 'non')], ['ki', 'Poing de ki', fI]],
    size: 'R',
    fire(run, w, S, E, dt) {
      sync(run, w);
      for (const o of w.q) { if (o.on) { pierce(run, o, dt, KI); if (o.life <= 0) o.on = false; } }
      if (w.t > 0) return;
      const p = run.p, tg = run.aim(S.R + 40);
      if (!tg) { w.t = 0.12; return; }
      w.t = S.cd;
      w.c = ((w.c || 0) + 1) % 3;
      const fin = w.c === 0, base = Math.atan2(tg.y - p.y, tg.x - p.x), R = fin ? S.R * 1.3 : S.R, all = fin && !!S.all;
      const arc = fin ? (all ? 4 : 1.25) : S.arc, dmg = fin ? S.fin : S.dmg;
      for (const e of run.grid.query(p.x, p.y, R + 40, NEAR)) {
        if (e.dead || e.burrowed) continue;
        const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy);
        if (d > R + e.r) continue;
        if (arc < 3.2 && d > 26 && Math.abs(angd(Math.atan2(dy, dx), base)) > arc + 0.08) continue;
        run.hitEnemy(e, dmg, { knock: fin ? 300 : 70, kx: dx / (d || 1), ky: dy / (d || 1), color: fin ? '#ffd27a' : null });
      }
      if (E) { // poing de ki projeté : transperce sur kR
        const o = slot(w.q, 16);
        if (o) { o.on = true; o.x = p.x; o.y = p.y; o.vx = Math.cos(base) * 560; o.vy = Math.sin(base) * 560; o.life = S.kR / 560; o.r = fin ? 30 : 20; o.dmg = fin ? S.ki * 2 : S.ki; o.h.length = 0; o.big = fin; }
      }
      w.fin = fin;
      fired(w, base);
      run.emit('mk', { kind: 'punch', x: p.x, y: p.y, a: base, R, arc, fin, all, evo: E });
      sfx(fin ? 'punchbig' : 'punch');
    },
  },

  // ---------- Paume de ki ----------
  // Boule d'énergie lente qui traverse tout (chaque monstre une fois) sur ~460 px ; 2 boules en éventail au niveau 4.
  // Évoluée (Paume céleste) : 2 énormes sphères qui explosent en bout de course.
  kipalm: {
    stats: ({ A, ar, h, L, E }) => {
      const d = A * 1.6 * (L(2) ? 1.3 : 1) * (L(5) ? 1.4 : 1);
      return E ? { dmg: d * 1.35, cd: 1.1 * h, n: 2, r: 34 * ar, v: 360, life: 1.35, boom: d * 1.4, bR: 120 * ar }
        : { dmg: d, cd: (L(5) ? 1.2 : 1.5) * h, n: 1 + L(4), r: (L(3) ? 24 : 17) * ar, v: 400, life: 1.15 };
    },
    lines: [D_('Dégâts par boule'), CD(), ['n', 'Boules', fN], ['r', 'Taille', fI], ['boom', 'Explosion finale', fI]],
    size: 'r',
    fire(run, w, S, E, dt) {
      sync(run, w);
      for (const o of w.q) {
        if (!o.on) continue;
        pierce(run, o, dt, PALM);
        if (o.life > 0) continue;
        o.on = false;
        if (o.boom) {
          zone(run, o.x, o.y, o.bR, o.boom, BOOM);
          run.emit('mk', { kind: 'kiboom', x: o.x, y: o.y, R: o.bR });
          sfx('kiboom');
        }
      }
      if (w.t > 0) return;
      const t = run.aim(470); if (!t) { w.t = 0.2; return; }
      w.t = S.cd;
      const p = run.p, ang = Math.atan2(t.y - p.y, t.x - p.x);
      for (let i = 0; i < S.n; i++) {
        const o = slot(w.q, 10); if (!o) break;
        const a = ang + (i - (S.n - 1) / 2) * 0.3;
        o.on = true; o.x = p.x + Math.cos(a) * 16; o.y = p.y + Math.sin(a) * 16; o.vx = Math.cos(a) * S.v; o.vy = Math.sin(a) * S.v;
        o.life = S.life; o.max = S.life; o.r = S.r; o.dmg = S.dmg; o.boom = E ? S.boom : 0; o.bR = S.bR || 0; o.h.length = 0;
      }
      fired(w, ang);
      run.emit('mk', { kind: 'palm', x: p.x, y: p.y, a: ang, evo: E });
      sfx('kipalm');
    },
  },

  // ---------- Vague de chi ----------
  // Onde circulaire qui part de Kenji (atteint son rayon en ~0,35 s) : chaque monstre touché une fois par onde, repoussé
  // fort. Double onde au niveau 4. Évoluée (Marée de sérénité) : 3 grandes ondes qui étourdissent, chaque monstre touché
  // rend un peu de PV (réserve de soin commune avec le vol de vie, au plus 8 monstres par onde).
  chiwave: {
    stats: ({ A, ar, h, L, E }) => {
      const d = A * 1.5 * (L(2) ? 1.3 : 1) * (L(5) ? 1.4 : 1);
      return E ? { dmg: d * 1.4, cd: 1.7 * h, R: 230 * ar, n: 3, stun: 0.6, heal: 0.004 }
        : { dmg: d, cd: (L(5) ? 1.9 : 2.4) * h, R: (L(3) ? 185 : 150) * ar, n: 1 + L(4) };
    },
    lines: [D_('Dégâts de l\'onde'), CD(), ['R', 'Rayon', fI], ['n', 'Ondes', fN], ['stun', 'Étourdit', fS], ['heal', 'Soin par ennemi', fPc]],
    size: 'R',
    fire(run, w, S, E, dt) {
      sync(run, w);
      const p = run.p;
      for (const o of w.q) {
        if (!o.on) continue;
        if (o.d > 0) { o.d -= dt; if (o.d <= 0) { o.x = p.x; o.y = p.y; run.emit('mk', { kind: 'wave', x: o.x, y: o.y, R: o.R, evo: E }); sfx('chiwave'); } continue; }
        o.r = Math.min(o.R, o.r + o.R / 0.35 * dt);
        for (const e of run.grid.query(o.x, o.y, o.r + 40, NEAR)) {
          if (e.dead || e.burrowed) continue;
          const dx = e.x - o.x, dy = e.y - o.y, d = Math.hypot(dx, dy);
          if (d - e.r * 0.5 > o.r || o.h.includes(e)) continue;
          if (o.h.length < 64) o.h.push(e);
          run.hitEnemy(e, o.dmg, { knock: 340, kx: dx / (d || 1), ky: dy / (d || 1), color: '#ffe0a0' });
          if (S.stun && !e.dead) hold(e, S.stun);
          if (S.heal && o.hl < 8 && !run.dying) { o.hl++; run.lsPool += p.maxHp * S.heal; }
        }
        if (o.r >= o.R) o.on = false;
      }
      // évoluée : relève le plafond de soin par seconde (run.updateHeal), comme la Moisson écarlate ou le Cœur de soleil
      if (E && !w.lsx) { w.lsx = 1; run.lsX += MAREE_LS; }
      if (w.t > 0) return;
      if (!run.nearest(S.R * 0.9, p)) { w.t = 0.25; return; } // personne à portée : on attend
      w.t = S.cd;
      for (let i = 0; i < S.n; i++) {
        const o = slot(w.q, 9); if (!o) break;
        o.on = true; o.x = p.x; o.y = p.y; o.r = 12; o.R = S.R * (1 - i * 0.06); o.dmg = S.dmg; o.d = i * 0.22; o.hl = 0; o.h.length = 0;
        if (!i) { o.d = 0; run.emit('mk', { kind: 'wave', x: p.x, y: p.y, R: o.R, evo: E }); }
      }
      fired(w, Math.atan2(p.face.y, p.face.x));
      sfx('chiwave');
    },
  },

  // ---------- Dragon de ki ----------
  // Un dragon d'énergie part de Kenji et serpente vers l'ennemi le plus proche de sa tête (il en change quand sa proie
  // meurt) ; sa tête et son corps mordent tout ce qu'ils traversent (chaque monstre au plus une fois toutes les 0,45 s,
  // tous dragons confondus). 2 dragons au niveau 4. Évolué (Dragon céleste) : 2 dragons dorés géants, plus longs à vivre,
  // qui plongent en explosant à la fin.
  kidragon: {
    stats: ({ A, ar, h, L, E }) => {
      const d = A * 0.8 * (L(2) ? 1.3 : 1) * (L(5) ? 1.4 : 1);
      return E ? { dmg: d * 1.3, cd: 3.4 * h, n: 2, r: 34 * ar, life: 5, v: 330, boom: d * 3.5, bR: 130 * ar }
        : { dmg: d, cd: (L(5) ? 3.8 : 4.6) * h, n: 1 + L(4), r: (L(3) ? 27 : 22) * ar, life: L(3) ? 3.8 : 3, v: 300 };
    },
    lines: [D_('Dégâts par morsure'), CD(), ['n', 'Dragons', fN], ['life', 'Durée', fS], ['r', 'Taille', fI], ['boom', 'Plongeon final', fI]],
    size: 'r',
    fire(run, w, S, E, dt) {
      sync(run, w);
      const p = run.p, now = run.time;
      for (const o of w.q) {
        if (!o.on) continue;
        o.t += dt;
        if (o.t >= o.life) {
          o.on = false;
          if (o.boom) { zone(run, o.x, o.y, o.bR, o.boom, BOOM); run.emit('mk', { kind: 'dive', x: o.x, y: o.y, R: o.bR }); sfx('kiboom'); }
          continue;
        }
        // proie : la plus proche de la tête (revue toutes les 0,4 s ou quand elle meurt) ; sinon il tourne autour de Kenji
        if ((o.k -= dt) <= 0 || !ok(o.tg)) { o.k = 0.4; o.tg = run.nearest(460, o); }
        const tx = o.tg ? o.tg.x : p.x + Math.cos(o.t * 2 + o.ph) * 110, ty = o.tg ? o.tg.y : p.y + Math.sin(o.t * 2 + o.ph) * 110;
        const turn = Math.max(-4.2 * dt, Math.min(4.2 * dt, angd(Math.atan2(ty - o.y, tx - o.x), o.a)));
        o.a += turn + Math.sin(o.t * 7 + o.ph) * 2.4 * dt; // ondulation de serpent
        const v = o.v * (o.t < 0.25 ? 0.6 + o.t * 1.6 : 1);
        o.x += Math.cos(o.a) * v * dt; o.y += Math.sin(o.a) * v * dt;
        // traînée : un point tous les 12 px (anneau circulaire o.px / o.py, o.pi = dernier écrit)
        o.acc += v * dt;
        if (o.acc >= 12) { o.acc = 0; o.pi = (o.pi + 1) % NS; o.px[o.pi] = o.x; o.py[o.pi] = o.y; if (o.pn < NS) o.pn++; }
        // morsures : la tête, puis un point du corps sur quatre
        for (let j = -1; j < o.pn; j += 4) {
          const x = j < 0 ? o.x : o.px[(o.pi - j + NS) % NS], y = j < 0 ? o.y : o.py[(o.pi - j + NS) % NS], r = j < 0 ? o.r : o.r * 0.75;
          for (const e of run.grid.query(x, y, r + 40, NEAR)) {
            if (e.dead || e.burrowed || (e.x - x) ** 2 + (e.y - y) ** 2 > (e.r + r) ** 2 || (e.hitT.kd || 0) > now) continue;
            e.hitT.kd = now + 0.45;
            BITE.kx = Math.cos(o.a); BITE.ky = Math.sin(o.a); BITE.quiet = j >= 0;
            run.hitEnemy(e, o.dmg, BITE);
          }
        }
      }
      if (w.t > 0) return;
      const t = run.aim(460); if (!t) { w.t = 0.3; return; }
      w.t = S.cd;
      const ang = Math.atan2(t.y - p.y, t.x - p.x);
      for (let i = 0; i < S.n; i++) {
        const o = slot(w.q, 6, () => ({ px: new Float32Array(NS), py: new Float32Array(NS) })); if (!o) break;
        const a = ang + (i - (S.n - 1) / 2) * 1.2;
        o.on = true; o.x = p.x; o.y = p.y; o.a = a; o.t = 0; o.k = 0; o.tg = null; o.ph = Math.random() * TAU; o.v = S.v; o.r = S.r;
        o.life = S.life; o.dmg = S.dmg; o.boom = E ? S.boom : 0; o.bR = S.bR || 0; o.acc = 0; o.pi = 0; o.pn = 1; o.px[0] = p.x; o.py[0] = p.y; o.evo = E;
      }
      fired(w, ang);
      run.emit('mk', { kind: 'dragon', x: p.x, y: p.y, a: ang, evo: E });
      sfx('dragon');
    },
  },
});
