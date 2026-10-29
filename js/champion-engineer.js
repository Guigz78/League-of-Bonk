// Tess l'Ingénieure : ultime (Frappe orbitale) et effets en cours, mélangés à Run (run.js : Object.assign(Run.prototype,
// ENG), comme js/champions-c1.js). Passif « Bricoleuse » = talents de CLASSES : gadget (durée en plus de ses tourelles,
// drones et mines, lue par js/arsenal-engineer.js) et pickup (ramassage en plus, save.playerStats).
// Frappe orbitale : une visée (réticule sur la cible), puis un énorme laser tombe du ciel (impact en zone) et balaie la
// zone en spirale autour de Tess (il la suit quand elle bouge), brûlant tout ce qu'il touche. État en cours : run.engU,
// lu par le rendu (js/g3d/fx-engineer.js) ; événements : 'ult' (kind 'orbital'), 'engImpact', 'engEnd'.
import { sfx, buzz } from './audio.js';

// Réglages (exportés : le simulateur d'équilibrage peut les modifier). Dégâts en multiples de A = attaque × dégâts ×
// (1 + 0,3 × évolution), comme les autres ultimes (Lumi ×10 autour, Brok ×7 à l'écran + 3 s d'invincibilité, Nyx ×5 + soin).
// aim = visée avant l'impact (s), dur = balayage (s), R = rayon du laser, tick = intervalle des brûlures, dmg = dégâts par
// brûlure (un monstre traversé en prend 2 à 4), impact = dégâts de l'impact dans iR, spirale de r0 (au plus loin, là où
// tombe le laser) à r1 en turns tours, boss = part des dégâts sur un boss, slow = ralentissement des brûlés (s)
export const ENGB = {
  orbital: { aim: 0.5, dur: 3, R: 95, tick: 0.1, dmg: 1.5, impact: 5, iR: 150, r0: 380, r1: 60, turns: 1.75, boss: 0.7, slow: 0.6 },
};
const ULTS_ENG = new Set(['orbital']);
export const isUltEng = id => ULTS_ENG.has(id);

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const Q = []; // résultats de la grille (réutilisés)

export const ENG = {
  ultEng(A) {
    const p = this.p, O = ENGB.orbital;
    // le laser tombe sur la cible (ou devant Tess), puis tourne autour d'elle en se rapprochant
    const t = this.aim(560), a0 = t ? Math.atan2(t.y - p.y, t.x - p.x) : Math.atan2(p.face.y, p.face.x);
    const r0 = t ? clamp(Math.hypot(t.x - p.x, t.y - p.y), 170, O.r0) : 300;
    this.engU = { t: -O.aim, k: 0, A, a0, r0, dir: Math.random() < 0.5 ? 1 : -1, x: p.x + Math.cos(a0) * r0, y: p.y + Math.sin(a0) * r0, hit: false, n: 0 };
    sfx('orbital'); buzz(60);
  },

  // position du laser au temps u (0 → 1) du balayage : spirale autour de Tess
  engAt(u) {
    const p = this.p, U = this.engU, O = ENGB.orbital, a = U.a0 + U.dir * O.turns * Math.PI * 2 * u, r = U.r0 + (O.r1 - U.r0) * u;
    U.x = p.x + Math.cos(a) * r; U.y = p.y + Math.sin(a) * r; U.ang = a; U.r = r;
  },

  // brûlure : tous les monstres sous le laser (rayon R autour de (x, y))
  engBurn(x, y, R, dmg, impact = false) {
    const O = ENGB.orbital;
    let n = 0;
    for (const e of this.grid.query(x, y, R + 40, Q)) {
      if (e.dead || e.burrowed) continue;
      const dx = e.x - x, dy = e.y - y, d = Math.hypot(dx, dy);
      if (d > R + e.r * 0.5) continue;
      this.hitEnemy(e, dmg * (e.boss ? O.boss : 1), { color: '#9af4ff', quiet: !impact && !e.boss && !e.elite, knock: impact ? 300 : 40, kx: dx / (d || 1), ky: dy / (d || 1) });
      if (!e.dead && !e.boss) e.slow = Math.max(e.slow, O.slow);
      n++;
    }
    return n;
  },

  // chaque image (run.update) : visée puis balayage du laser
  tickEng(dt) {
    const U = this.engU, O = ENGB.orbital;
    if (this.entering || this.dying || this.over) { this.engU = null; this.emit('engEnd', {}); return; }
    U.t += dt;
    if (U.t < 0) { this.engAt(0); return; } // visée : le réticule suit la spirale de départ
    if (!U.hit) { // impact : le laser touche le sol
      U.hit = true; this.engAt(0);
      this.engBurn(U.x, U.y, O.iR, U.A * O.impact, true);
      this.emit('engImpact', { x: U.x, y: U.y, R: O.iR });
      this.shake = Math.max(this.shake, 10);
      sfx('orbhit'); buzz(90);
    }
    const u = U.t / O.dur;
    if (u >= 1) { this.engU = null; this.emit('engEnd', { x: U.x, y: U.y }); return; }
    this.engAt(u);
    if ((U.k -= dt) <= 0) {
      U.k += O.tick;
      U.n += this.engBurn(U.x, U.y, O.R, U.A * O.dmg);
      this.shake = Math.max(this.shake, 3);
      sfx('laser');
    }
  },
};
