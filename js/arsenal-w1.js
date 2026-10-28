// Arsenal W1 : armes propres à Lumi (Pluie d'étoiles), Kira (Flèche explosive, Pièges à mâchoires), Brok (Bouclier volant,
// Marteau du jugement) et Frida (Stalactites, Grêle), branchées sur le registre js/weapons-reg.js (importé une fois par
// run.js). stats = niveaux 1 à 5 et forme évoluée (dégâts en multiples de A, comme run.wstats) ; fire = chaque image, pendant
// run.updateWeapons (run.curW = l'arme : ses victimes lui sont comptées). Tout ce qui est en vol vit sur l'arme : w.q (et w.q2),
// réserves d'objets réutilisés (champ on), vidées au changement de monde : aucune allocation en régime établi.
// Rendu (js/g3d/fx-w1.js) : lit w.q / w.q2, les événements 'w1' (kind = star, blast, frag, snap, bounce, hammer, wave2,
// shatter, hail, storm) et w.fn / w.fa (nombre de tirs, angle du dernier : geste d'attaque du héros). Données : data.js
// (bloc « Arsenal W1 »), icônes : art.js, sons : audio.js.
// Équilibrage (simulateur l2/sim.mjs, bot qui prend la 1re carte, Normal, monde 1 → 2, une résurrection) : voir le compte
// rendu en tête de chaque arme.
import { addWeapons } from './weapons-reg.js';
import { sfx } from './audio.js';
import { fmt } from './ui.js';

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const NEAR = []; // résultats de la grille (réutilisés ; jamais deux boucles imbriquées dessus)
// fiches de niveau (nombres à la française, comme run.js)
const NB = ' ';
const num = (v, d = 0) => { const k = 10 ** d; return (Math.round(v * k) / k).toLocaleString('fr-FR', { maximumFractionDigits: d }); };
const fI = v => fmt(v), fN = v => String(v), secS = v => num(v, 2) + NB + 's';
const fP = v => (v >= 99 ? 'tout' : v ? `${v} ennemi${v > 1 ? 's' : ''}` : 'non'), fS = v => (v ? num(v, 1) + NB + 's' : 'non');
const D_ = l => ['dmg', l, fI], CD = ['cd', 'Recharge', secS];

// objet libre d'une réserve (créé une seule fois, puis réutilisé) ; null si la réserve est pleine
function slot(a, cap) {
  for (const o of a) if (!o.on) return o;
  if (a.length >= cap) return null;
  const o = { on: false, h: [] };
  a.push(o);
  return o;
}
// réserves de l'arme ; nouveau monde : tout ce qui était en vol disparaît (le décor et les monstres ont changé)
function sync(run, w) {
  if (!w.q) { w.q = []; w.q2 = []; }
  if (w.st !== run.stage) { w.st = run.stage; for (const o of w.q) o.on = false; for (const o of w.q2) o.on = false; }
}
const fired = (w, a) => { w.fn = (w.fn || 0) + 1; w.fa = a; };
const ok = e => e && !e.dead && !e.burrowed;
// dégâts de zone : tous les monstres à moins de R (+ la moitié de leur taille) de (x, y), repoussés depuis le centre
function zone(run, x, y, R, dmg, o, f = null) {
  let n = 0;
  for (const e of run.grid.query(x, y, R + 40, NEAR)) {
    if (e.dead || e.burrowed) continue;
    const dx = e.x - x, dy = e.y - y, d = Math.hypot(dx, dy);
    if (d > R + e.r * 0.5) continue;
    o.kx = dx / (d || 1); o.ky = dy / (d || 1);
    run.hitEnemy(e, dmg, o);
    if (f && !e.dead) f(e, d);
    n++;
  }
  return n;
}
// immobilise (les boss sont seulement ralentis)
const hold = (e, s) => { if (e.boss) e.slow = Math.max(e.slow, s); else e.freeze = Math.max(e.freeze, s); };
// les n ennemis les plus forts à l'écran (boss, champion, élites, puis les plus gros PV), sans doublon
function strongest(run, n, out) {
  out.length = 0;
  const T = run.onScreen();
  T.sort((a, b) => (b.boss ? 1e12 : 0) + b.maxHp - (a.boss ? 1e12 : 0) - a.maxHp);
  for (let i = 0; i < n && i < T.length; i++) out.push(T[i]);
  return out;
}
const TOP = [];

addWeapons({
  // ---------- Lumi : Pluie d'étoiles ----------
  // Les étoiles visent des ennemis au hasard à l'écran (la cible principale d'abord), un peu en avant d'eux (ils marchent
  // vers Lumi) ; ombre au sol pendant la chute (0,65 s), puis impact en zone. Évoluée (Pluie de comètes) : étoiles bleues,
  // plus larges, chute plus rapide, et une comète géante sur la cible principale à chaque salve.
  starfall: {
    stats: ({ A, ar, h, L, E }) => {
      const d = A * 2 * (L(3) ? 1.3 : 1) * (L(5) ? 1.3 : 1);
      return E ? { dmg: d * 1.5, cd: 1.5 * h, n: 7, R: 88 * ar, big: d * 4, bR: 140 * ar }
        : { dmg: d, cd: (L(4) ? 1.8 : 2.2) * h, n: 2 + L(2) + L(5) * 2, R: (L(4) ? 70 : 56) * ar };
    },
    lines: [D_('Dégâts par étoile'), CD, ['n', 'Étoiles', fN], ['R', 'Zone d\'impact', fI], ['big', 'Comète géante', fI]],
    size: 'R',
    fire(run, w, S, E, dt) {
      sync(run, w);
      for (const o of w.q) {
        if (!o.on || (o.t += dt) < o.dur) continue;
        o.on = false;
        zone(run, o.x, o.y, o.R, o.dmg, { color: E ? '#bfe0ff' : '#ffe48a', knock: o.big ? 260 : 80 });
        run.emit('w1', { kind: 'star', x: o.x, y: o.y, R: o.R, big: o.big, evo: E });
        sfx(o.big ? 'comet' : 'star');
      }
      if (w.t > 0) return;
      const T = run.onScreen();
      if (!T.length) { w.t = 0.25; return; }
      w.t = S.cd;
      const p = run.p, main = run.target && T.includes(run.target) ? run.target : null, fall = E ? 0.5 : 0.65;
      const drop = (t, i, big) => {
        const o = slot(w.q, 48); if (!o) return;
        // un peu en avant de la cible : elle avance vers le héros pendant la chute
        const dx = p.x - t.x, dy = p.y - t.y, dd = Math.hypot(dx, dy) || 1, lead = Math.min(dd * 0.5, (t.boss ? 0 : (t.speed || 50) * (t.freeze ? 0 : t.slow ? 0.5 : 1)) * fall * 0.6);
        o.on = true; o.x = t.x + dx / dd * lead; o.y = t.y + dy / dd * lead; o.t = -i * 0.07; o.dur = fall + (big ? 0.2 : 0);
        o.R = big ? S.bR : S.R; o.dmg = big ? S.big : S.dmg; o.big = big;
      };
      for (let i = 0; i < S.n; i++) drop(i === 0 && main ? main : T[(Math.random() * T.length) | 0], i, false);
      if (E) drop(main || T[0], 0, true);
      fired(w, main ? Math.atan2(main.y - p.y, main.x - p.x) : -Math.PI / 2);
      sfx('starcast');
    },
  },

  // ---------- Kira : Flèche explosive ----------
  // Flèche lente (330 px/s, ~480 px) qui explose sur le premier ennemi touché (ou en bout de course). Évoluée (Flèche à
  // fragmentation) : 3 flèches, explosion plus grosse qui projette 6 éclats explosifs autour.
  blastarrow: {
    stats: ({ A, ar, h, L, E }) => {
      const d = A * 3 * (L(2) ? 1.3 : 1) * (L(5) ? 1.4 : 1);
      return E ? { dmg: d * 1.7, cd: 1.25 * h, n: 3, R: 108 * ar, frag: 6, fd: d * 0.6 }
        : { dmg: d, cd: (L(5) ? 1.45 : 1.85) * h, n: 1 + L(4), R: (L(3) ? 84 : 64) * ar };
    },
    lines: [D_('Dégâts d\'explosion'), CD, ['n', 'Flèches', fN], ['R', 'Explosion', fI], ['frag', 'Éclats explosifs', fN]],
    size: 'R',
    fire(run, w, S, E, dt) {
      sync(run, w);
      const boom = (o, x, y) => {
        o.on = false;
        zone(run, x, y, o.R, o.dmg, { color: '#ffb04a', knock: 220 });
        run.emit('w1', { kind: 'blast', x, y, R: o.R, evo: E });
        sfx('blast');
        if (E) for (let i = 0; i < S.frag; i++) { // éclats : petites explosions en couronne, juste après
          const f = slot(w.q2, 40); if (!f) break;
          const a = i / S.frag * TAU + rand(-0.3, 0.3), r = o.R * rand(0.8, 1.25);
          f.on = true; f.x = x + Math.cos(a) * r; f.y = y + Math.sin(a) * r; f.sx = x; f.sy = y; f.t = 0; f.dur = rand(0.28, 0.42); f.R = o.R * 0.45; f.dmg = S.fd;
        }
      };
      for (const o of w.q) {
        if (!o.on) continue;
        o.life -= dt; o.x += o.vx * dt; o.y += o.vy * dt;
        if (o.life <= 0) { boom(o, o.x, o.y); continue; }
        for (const e of run.grid.query(o.x, o.y, 50, NEAR)) {
          if (e.dead || e.burrowed || (e.x - o.x) ** 2 + (e.y - o.y) ** 2 > (e.r + 10) ** 2) continue;
          boom(o, o.x, o.y); break;
        }
      }
      for (const f of w.q2) {
        if (!f.on || (f.t += dt) < f.dur) continue;
        f.on = false;
        zone(run, f.x, f.y, f.R, f.dmg, { color: '#ffd27a', knock: 120, quiet: true });
        run.emit('w1', { kind: 'frag', x: f.x, y: f.y, R: f.R });
        sfx('blast');
      }
      if (w.t > 0) return;
      const t = run.aim(460); if (!t) { w.t = 0.2; return; }
      w.t = S.cd;
      const p = run.p, ang = Math.atan2(t.y - p.y, t.x - p.x);
      for (let i = 0; i < S.n; i++) {
        const o = slot(w.q, 12); if (!o) break;
        const a = ang + (i - (S.n - 1) / 2) * 0.32;
        o.on = true; o.x = p.x; o.y = p.y; o.vx = Math.cos(a) * 330; o.vy = Math.sin(a) * 330; o.life = 1.45; o.R = S.R; o.dmg = S.dmg;
      }
      fired(w, ang);
      sfx('bowheavy');
    },
  },

  // ---------- Kira : Pièges à mâchoires ----------
  // Pose des pièges autour d'elle (60 % vers les ennemis les plus proches), armés en 0,45 s. Un monstre qui marche dessus
  // fait claquer les mâchoires : dégâts à tout ce qui est dedans (rayon R), immobilisés (boss ralentis) et saignements
  // pendant hold s. Ensuite le piège casse. Au plus max pièges posés (le plus vieux est déplacé). Évoluée (Mâchoires
  // d'acier) : grands pièges qui se referment 3 fois.
  traps: {
    stats: ({ A, ar, h, L, E }) => {
      const d = A * 3 * (L(3) ? 1.3 : 1), b = A * 0.6 * (L(3) ? 1.3 : 1);
      return E ? { dmg: d * 1.5, cd: 1.5 * h, n: 3, R: 64 * ar, hold: 2.6, bleed: b * 1.5, snaps: 3, max: 9 }
        : { dmg: d, cd: (L(5) ? 1.9 : 2.4) * h, n: 1 + L(2) + L(5), R: (L(4) ? 52 : 40) * ar, hold: L(4) ? 2.2 : 1.6, bleed: b, snaps: 1, max: 5 + L(2) + L(5) };
    },
    lines: [D_('Dégâts de morsure'), CD, ['n', 'Pièges', fN], ['hold', 'Immobilise', fS], ['bleed', 'Saignement (0,3 s)', fI], ['R', 'Mâchoires', fI], ['snaps', 'Morsures par piège', fN]],
    size: 'R',
    fire(run, w, S, E, dt) {
      sync(run, w);
      let open = 0, old = null;
      for (const o of w.q) {
        if (!o.on) continue;
        if (o.s === 2) { if ((o.f -= dt) <= 0) o.on = false; continue; } // cassé : disparaît
        if (o.s === 1) { // refermé : saignements, puis rouvert ou cassé
          o.c -= dt;
          if ((o.k -= dt) <= 0) {
            o.k = 0.3;
            for (const e of o.h) if (ok(e)) run.hitEnemy(e, o.bleed, { quiet: true, color: '#ff6a6a', noCrit: true });
          }
          if (o.c <= 0) { o.h.length = 0; if (--o.n > 0) { o.s = 0; o.arm = 0.6; } else { o.s = 2; o.f = 0.35; } }
          continue;
        }
        if ((o.life -= dt) <= 0) { o.s = 2; o.f = 0.35; continue; }
        let hit = false;
        if ((o.arm -= dt) <= 0) for (const e of run.grid.query(o.x, o.y, 50, NEAR)) if (!e.dead && !e.burrowed && !e.air && (e.x - o.x) ** 2 + (e.y - o.y) ** 2 < (e.r + 12) ** 2) { hit = true; break; }
        if (!hit) { open++; if (!old || o.life < old.life) old = o; continue; }
        // clac : tout ce qui est dans les mâchoires est saisi
        o.s = 1; o.c = o.hold; o.k = 0.3; o.h.length = 0;
        zone(run, o.x, o.y, o.R, o.dmg, { color: '#9cc6ff' }, e => { hold(e, o.hold); if (o.h.length < 8) o.h.push(e); });
        run.emit('w1', { kind: 'snap', x: o.x, y: o.y, R: o.R, evo: E });
        sfx('snap');
      }
      if (w.t > 0) return;
      w.t = S.cd;
      const p = run.p, t = run.nearest(300);
      const base = t ? Math.atan2(t.y - p.y, t.x - p.x) : Math.atan2(p.face.y, p.face.x);
      for (let i = 0; i < S.n; i++) {
        let o = open < S.max ? slot(w.q, 16) : null;
        if (!o) { o = old; if (!o) break; old = null; } else open++;
        const a = Math.random() < 0.6 ? base + rand(-1.1, 1.1) : Math.random() * TAU, r = rand(55, 130);
        o.on = true; o.s = 0; o.x = p.x + Math.cos(a) * r; o.y = p.y + Math.sin(a) * r; o.arm = 0.45; o.life = 14; o.n = S.snaps;
        o.R = S.R; o.dmg = S.dmg; o.hold = S.hold; o.bleed = S.bleed; o.a = Math.random() * TAU; o.h.length = 0;
      }
      fired(w, base);
      sfx('trapset');
    },
  },

  // ---------- Brok : Bouclier volant ----------
  // Le bouclier file vers la cible, la frappe et la repousse, puis rebondit vers l'ennemi le plus proche pas encore touché
  // (à moins de 250 px), b fois, puis revient vers Brok. Évolué (Rempart sacré) : 2 boucliers dorés, 9 rebonds, chaque
  // rebond libère une onde sacrée (30 % des dégâts) qui étourdit les monstres un court instant.
  shieldthrow: {
    stats: ({ A, ar, h, L, E }) => {
      const d = A * 2.2 * (L(3) ? 1.3 : 1) * (L(5) ? 1.4 : 1);
      return E ? { dmg: d * 1.5, cd: 1.5 * h, n: 2, b: 9, R: 30 * ar, wave: 62 * ar }
        : { dmg: d, cd: (L(4) ? 1.8 : 2.2) * h, n: 1, b: 4 + L(2) * 2 + L(5) * 2, R: (L(4) ? 26 : 20) * ar };
    },
    lines: [D_('Dégâts par rebond'), CD, ['b', 'Rebonds', fN], ['n', 'Boucliers', fN], ['R', 'Taille', fI], ['wave', 'Onde sacrée', fI]],
    size: 'R',
    fire(run, w, S, E, dt) {
      sync(run, w);
      const p = run.p;
      for (const o of w.q) {
        if (!o.on) continue;
        o.life -= dt; o.spin += dt * 14;
        let tx, ty, v;
        if (!o.ret && !ok(o.tg)) o.tg = next(run, o.x, o.y, o.h);
        if (!o.ret && !o.tg) o.ret = true;
        if (o.ret) { tx = p.x; ty = p.y; v = 760; } else { tx = o.tg.x; ty = o.tg.y; v = 640; }
        const dx = tx - o.x, dy = ty - o.y, d = Math.hypot(dx, dy) || 1;
        o.vx = dx / d * v; o.vy = dy / d * v;
        const step = Math.min(d, v * dt);
        o.x += dx / d * step; o.y += dy / d * step;
        if (o.ret) { if (d < 26 || o.life < -2) o.on = false; continue; }
        const e = o.tg;
        if (d > e.r + o.R) continue;
        // rebond : coup, recul, puis cible suivante
        run.hitEnemy(e, o.dmg, { knock: 300, kx: dx / d, ky: dy / d, color: E ? '#ffe48a' : '#bfe0ff' });
        if (o.h.length < 16) o.h.push(e);
        if (E) zone(run, o.x, o.y, S.wave, o.dmg * 0.3, { color: '#ffe48a', knock: 160, quiet: true }, f => { if (!f.boss) f.freeze = Math.max(f.freeze, 0.3); });
        run.emit('w1', { kind: 'bounce', x: o.x, y: o.y, R: E ? S.wave : o.R * 2, evo: E });
        sfx('shield');
        o.tg = --o.left >= 0 && o.life > 0 ? next(run, o.x, o.y, o.h) : null;
        if (!o.tg) o.ret = true;
      }
      if (w.t > 0) return;
      const t = run.aim(430); if (!t) { w.t = 0.2; return; }
      w.t = S.cd;
      for (let i = 0; i < S.n; i++) {
        const o = slot(w.q, 6); if (!o) break;
        o.on = true; o.x = p.x; o.y = p.y; o.h.length = 0; o.ret = false; o.left = S.b; o.life = 4.5; o.spin = Math.random() * TAU;
        o.dmg = S.dmg; o.R = S.R; o.vx = 0; o.vy = 0;
        o.tg = i === 0 ? t : next(run, p.x, p.y, null, t) || t; // le 2e bouclier vise un autre ennemi proche
      }
      fired(w, Math.atan2(t.y - p.y, t.x - p.x));
      sfx('shieldthrow');
    },
  },

  // ---------- Brok : Marteau du jugement ----------
  // Un marteau sacré apparaît au-dessus de l'ennemi le plus fort à l'écran (boss, champion, élites…) et s'abat en 0,55 s :
  // gros coup au centre, onde de choc autour (dégâts wave, recul). Niveau 5 : un 2e marteau sur le 2e plus fort. Évolué
  // (Jugement divin) : 3 marteaux géants, une 2e onde plus large juste après, les monstres touchés sont étourdis.
  hammer: {
    stats: ({ A, ar, h, L, E }) => {
      const k = (L(2) ? 1.3 : 1) * (L(5) ? 1.4 : 1);
      return E ? { dmg: A * 4.5 * k * 1.3, wave: A * 1.7 * k * 1.3, cd: 2.1 * h, n: 3, R: 150 * ar, stun: 0.6 }
        : { dmg: A * 4.5 * k, wave: A * 1.7 * k, cd: (L(4) ? 2.5 : 3.1) * h, n: 1 + L(5), R: (L(3) ? 125 : 95) * ar, stun: 0 };
    },
    lines: [D_('Coup de marteau'), ['wave', 'Onde de choc', fI], CD, ['n', 'Marteaux', fN], ['R', 'Rayon de l\'onde', fI], ['stun', 'Étourdit', fS]],
    size: 'R',
    fire(run, w, S, E, dt) {
      sync(run, w);
      for (const o of w.q) {
        if (!o.on) continue;
        o.t += dt;
        if (o.s === 0) {
          // le marteau suit sa cible, puis se fige juste avant l'impact
          if (ok(o.e) && o.t < o.dur - 0.15) { o.x += (o.e.x - o.x) * Math.min(1, dt * 12); o.y += (o.e.y - o.y) * Math.min(1, dt * 12); }
          if (o.t < o.dur) continue;
          o.s = 1;
          const stun = S.stun;
          for (const e of run.grid.query(o.x, o.y, o.R + 40, NEAR)) {
            if (e.dead || e.burrowed) continue;
            const dx = e.x - o.x, dy = e.y - o.y, d = Math.hypot(dx, dy) || 1;
            if (d > o.R + e.r * 0.5) continue;
            const core = d < 30 + e.r * 0.6;
            run.hitEnemy(e, core ? o.dmg : o.wave, { knock: core ? 120 : 340, kx: dx / d, ky: dy / d, color: '#ffe48a', quiet: !core && !e.elite });
            if (stun && !e.dead && !e.boss) e.freeze = Math.max(e.freeze, stun);
          }
          run.emit('w1', { kind: 'hammer', x: o.x, y: o.y, R: o.R, evo: E });
          sfx('hammer');
          if (!E) { o.s = 2; o.t = 0; }
          continue;
        }
        if (o.s === 1 && o.t >= o.dur + 0.3) { // évolué : 2e onde, plus large
          o.s = 2; o.t = 0;
          zone(run, o.x, o.y, o.R * 1.5, o.wave * 0.5, { color: '#fff0a0', knock: 260, quiet: true }, e => { if (!e.boss) e.freeze = Math.max(e.freeze, S.stun * 0.5); });
          run.emit('w1', { kind: 'wave2', x: o.x, y: o.y, R: o.R * 1.5 });
          continue;
        }
        if (o.s === 2 && o.t > 0.5) o.on = false; // le marteau reste planté un instant (rendu), puis disparaît
      }
      if (w.t > 0) return;
      strongest(run, S.n, TOP);
      if (!TOP.length) { w.t = 0.25; return; }
      w.t = S.cd;
      for (const e of TOP) {
        const o = slot(w.q, 8); if (!o) break;
        o.on = true; o.s = 0; o.t = 0; o.dur = 0.55; o.e = e; o.x = e.x; o.y = e.y; o.R = S.R * (e.boss ? 1.15 : 1); o.dmg = S.dmg; o.wave = S.wave;
      }
      fired(w, Math.atan2(TOP[0].y - run.p.y, TOP[0].x - run.p.x));
      sfx('hammercall');
    },
  },

  // ---------- Frida : Stalactites ----------
  // Éventail de pointes de glace (470 px/s) qui transpercent et ralentissent (1,5 s). Évoluées (Tempête de stalactites) :
  // 11 grandes pointes en très large éventail, transpercent tout, gèlent 0,5 s et éclatent en fin de course (zone).
  icicles: {
    stats: ({ A, ar, h, L, E }) => {
      const d = A * 1.05 * (L(3) ? 1.3 : 1);
      return E ? { dmg: d * 1.5, cd: 1.05 * h, n: 11, pierce: 99, len: 480 * ar, slow: 2, freeze: 0.5, burst: 54 * ar }
        : { dmg: d, cd: (L(5) ? 1.2 : 1.55) * h, n: 3 + L(2) * 2 + L(5) * 2, pierce: L(4) ? 5 : 2, len: (L(4) ? 430 : 360) * ar, slow: 1.5, freeze: 0 };
    },
    lines: [D_('Dégâts par pointe'), CD, ['n', 'Pointes', fN], ['pierce', 'Transperce', fP], ['len', 'Portée', fI], ['freeze', 'Gel', fS]],
    size: 'len',
    fire(run, w, S, E, dt) {
      sync(run, w);
      for (const o of w.q) {
        if (!o.on) continue;
        o.life -= dt; o.x += o.vx * dt; o.y += o.vy * dt;
        if (o.life > 0) for (const e of run.grid.query(o.x, o.y, 50, NEAR)) {
          if (e.dead || e.burrowed || o.h.includes(e) || (e.x - o.x) ** 2 + (e.y - o.y) ** 2 > (e.r + o.r) ** 2) continue;
          if (o.h.length < 24) o.h.push(e);
          run.hitEnemy(e, o.dmg, { knock: 60, kx: o.vx / 470, ky: o.vy / 470, color: '#bfeaff' });
          if (!e.dead) { e.slow = Math.max(e.slow, S.slow); if (S.freeze && !e.boss) e.freeze = Math.max(e.freeze, S.freeze); }
          if (o.p-- <= 0) { o.life = 0; break; }
        }
        if (o.life > 0) continue;
        o.on = false;
        if (E) { // éclatement en fin de course
          zone(run, o.x, o.y, S.burst, o.dmg * 0.6, { color: '#e8f8ff', quiet: true }, e => { e.slow = Math.max(e.slow, S.slow); });
          run.emit('w1', { kind: 'shatter', x: o.x, y: o.y, R: S.burst });
        }
      }
      if (w.t > 0) return;
      const p = run.p, t = run.aim(420);
      w.t = S.cd;
      const ang = t ? Math.atan2(t.y - p.y, t.x - p.x) : Math.atan2(p.face.y, p.face.x);
      const span = E ? 2.3 : Math.min(1.3, 0.22 * (S.n - 1)), v = 470 * (E ? 1.1 : 1);
      for (let i = 0; i < S.n; i++) {
        const o = slot(w.q, 48); if (!o) break;
        const a = ang + (S.n > 1 ? (i / (S.n - 1) - 0.5) * span : 0);
        o.on = true; o.x = p.x + Math.cos(a) * 12; o.y = p.y + Math.sin(a) * 12; o.vx = Math.cos(a) * v; o.vy = Math.sin(a) * v;
        o.life = S.len / v; o.p = S.pierce; o.dmg = S.dmg; o.r = E ? 14 : 9; o.h.length = 0;
      }
      fired(w, ang);
      sfx('icicle');
    },
  },

  // ---------- Frida : Grêle ----------
  // Un orage se forme au-dessus de la cible : pendant dur s, rate grêlons par seconde tombent dans la zone (rayon R ; 40 %
  // visent un monstre de la zone), chacun blesse et ralentit sur un petit rayon. Évoluée (Ouragan de grêle) : 2 orages
  // géants qui suivent leur cible, grêlons plus gros qui gèlent.
  hail: {
    stats: ({ A, ar, h, L, E }) => {
      const d = A * 0.75 * (L(2) ? 1.3 : 1) * (L(5) ? 1.4 : 1);
      return E ? { dmg: d * 1.35, cd: 3.4 * h, n: 2, R: 150 * ar, dur: 4.5, rate: 14, sR: 38 * ar, freeze: 0.4 }
        : { dmg: d, cd: (L(5) ? 3.5 : 4.3) * h, n: 1, R: (L(3) ? 115 : 92) * ar, dur: L(4) ? 3.5 : 2.6, rate: L(4) ? 10 : 7, sR: (L(3) ? 32 : 27) * ar, freeze: 0 };
    },
    lines: [D_('Dégâts par grêlon'), CD, ['R', 'Zone de l\'orage', fI], ['dur', 'Durée', secS], ['rate', 'Grêlons par seconde', fN], ['n', 'Orages', fN], ['freeze', 'Gel', fS]],
    size: 'R',
    fire(run, w, S, E, dt) {
      sync(run, w);
      for (const o of w.q) { // orages
        if (!o.on) continue;
        o.t += dt;
        if (o.t > o.dur) { if (o.t > o.dur + 0.6) o.on = false; continue; } // le nuage se dissipe (rendu)
        if (E && ok(o.e)) { const dx = o.e.x - o.x, dy = o.e.y - o.y, d = Math.hypot(dx, dy) || 1, v = Math.min(d, 90 * dt); o.x += dx / d * v; o.y += dy / d * v; }
        if (o.t < 0.25) continue; // le nuage se forme
        o.acc += S.rate * dt;
        while (o.acc >= 1) {
          o.acc--;
          const s = slot(w.q2, 64); if (!s) break;
          let x, y, e = null;
          if (Math.random() < 0.4) { const L = run.grid.query(o.x, o.y, o.R, NEAR); e = L[(Math.random() * L.length) | 0]; if (e && (e.dead || (e.x - o.x) ** 2 + (e.y - o.y) ** 2 > o.R * o.R)) e = null; }
          if (e) { x = e.x + rand(-6, 6); y = e.y + rand(-6, 6); } else { const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * o.R; x = o.x + Math.cos(a) * r; y = o.y + Math.sin(a) * r; }
          s.on = true; s.x = x; s.y = y; s.t = 0; s.dur = 0.3; s.R = S.sR; s.dmg = S.dmg; s.big = E;
        }
      }
      for (const s of w.q2) { // grêlons
        if (!s.on || (s.t += dt) < s.dur) continue;
        s.on = false;
        zone(run, s.x, s.y, s.R, s.dmg, { color: '#d8f0ff' }, e => { e.slow = Math.max(e.slow, 1.2); if (S.freeze && !e.boss) e.freeze = Math.max(e.freeze, S.freeze); });
        run.emit('w1', { kind: 'hail', x: s.x, y: s.y, R: s.R, evo: E });
        sfx('hail');
      }
      if (w.t > 0) return;
      const t = run.aim(440); if (!t) { w.t = 0.25; return; }
      w.t = S.cd;
      const T = S.n > 1 ? run.onScreen() : null;
      for (let i = 0; i < S.n; i++) {
        const o = slot(w.q, 6); if (!o) break;
        let e = t;
        if (i && T.length > 1) { e = T[(Math.random() * T.length) | 0]; if (e === t) e = T.find(x => x !== t) || t; }
        o.on = true; o.e = e; o.x = e.x; o.y = e.y; o.t = 0; o.dur = S.dur; o.R = S.R; o.acc = 0; o.evo = E;
        run.emit('w1', { kind: 'storm', x: e.x, y: e.y, R: S.R });
      }
      fired(w, Math.atan2(t.y - run.p.y, t.x - run.p.x));
      sfx('hailstorm');
    },
  },
});

// bouclier volant : ennemi le plus proche de (x, y) pas encore touché par ce lancer (h), à moins de 250 px ; not = à éviter
function next(run, x, y, h, not = null) {
  let best = null, bd = 250 * 250;
  for (const e of run.grid.query(x, y, 250, NEAR)) {
    if (e.dead || e.burrowed || e === not || (h && h.length && h.includes(e))) continue;
    const d = (e.x - x) ** 2 + (e.y - y) ** 2;
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}
