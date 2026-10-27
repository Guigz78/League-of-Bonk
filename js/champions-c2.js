// Champions C2 : Frida la Cryomancienne, Gaïa la Druidesse. Ultimes, passifs et effets en cours, mélangés à Run
// (run.js : Object.assign(Run.prototype, C2), comme js/champions-c1.js). Passifs = talents de CLASSES :
// chill (Frida) : ses coups ralentissent (run.hitEnemy -> chillC2 ; run.updateEnemies lit e.chillT / e.chillK),
// regenPct (Gaïa) : part des PV max rendue chaque seconde (tickC2), pickup (Gaïa) : ramassage en plus (save.playerStats).
// Leurs armes de départ sont partagées (Nova de givre, Champignons) : wpnMul / wpnCd les renforcent pour elles (run.wstats).
// Événements pour le rendu (js/g3d/fx-c2.js) : 'ult' (kind = l'ultime), 'c2ice' (gel), 'c2shot' (tir ennemi brisé),
// 'c2shatter' (la glace éclate), 'c2thorns' (coup d'épines), 'c2end'.
import { sfx, buzz } from './audio.js';
import { fmt } from './ui.js';

// Réglages (exportés : le simulateur d'équilibrage peut les modifier). Dégâts en multiples de A = attaque × dégâts ×
// (1 + 0,3 × évolution), comme les autres ultimes (Lumi ×10 autour, Brok ×7 à l'écran + 3 s d'invincibilité, Nyx ×5 + soin).
export const C2B = {
  // Morsure du givre : durée du ralentissement (s) ; les boss n'en subissent que la part boss
  chill: { dur: 1.5, boss: 0.5 },
  // Hiver éternel : durée du gel, dégâts au lancer puis à l'éclatement, intervalle de gel des monstres qui arrivent
  winter: { dur: 3, dmg: 4.5, shatter: 3, tick: 0.2 },
  // Colère de la forêt : soin (part des PV max), rayon des racines, immobilisation (s), dégâts des racines ;
  // épines : durée, rayon, intervalle entre deux coups, dégâts par coup
  forest: { heal: 0.3, R: 320, root: 2.5, dmg: 3, dur: 5, tR: 150, tick: 0.4, thorn: 0.5 },
};
const ULTS_C2 = new Set(['winter', 'forest']);
export const isUltC2 = id => ULTS_C2.has(id);

const VIEW = 520; // rayon de l'écran (run.js VIEW_R)
const d2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

export const C2 = {
  ultC2(A) {
    const p = this.p, u = this.cls.ult;
    if (u === 'winter') {
      // Hiver éternel (Frida) : tout l'écran gèle (les boss ralentissent), les tirs ennemis se brisent ; à la fin, éclatement
      const W = C2B.winter, until = this.runTime + W.dur;
      for (const e of this.onScreen()) {
        this.c2freeze(e, until);
        this.hitEnemy(e, A * W.dmg * (e.boss ? 0.8 : 1), { color: '#bfeaff', quiet: !e.boss && !e.elite });
      }
      this.c2shots();
      this.c2w = { t: W.dur, k: W.tick, A, until };
      this.fx.push({ type: 'ring', x: p.x, y: p.y, r: 340, life: 0.6, max: 0.6, color: '#e8f8ff' });
      this.shake = Math.max(this.shake, 8);
      sfx('winter'); buzz(80);
    } else if (u === 'forest') {
      // Colère de la forêt (Gaïa) : gros soin, racines qui immobilisent autour d'elle, puis 5 s d'épines (tickC2)
      const F = C2B.forest, R = F.R * p.area, until = this.runTime + F.root;
      const h = Math.min(p.maxHp - p.hp, p.maxHp * F.heal * this.diff.heal);
      if (h > 0 && !this.dying) { p.hp += h; this.text(p.x, p.y, 80, '+' + fmt(h), '#7aff6a', 1.5); }
      for (const e of this.grid.query(p.x, p.y, R + 40)) {
        if (e.dead || e.burrowed || d2(e, p) > (R + e.r * 0.5) ** 2) continue;
        this.hitEnemy(e, A * F.dmg * (e.boss ? 0.8 : 1), { color: '#9aff6a', quiet: !e.boss && !e.elite });
        if (e.dead) continue;
        if (e.boss) e.slow = Math.max(e.slow, F.root); else e.freeze = Math.max(e.freeze, F.root);
        e.c2root = until;
      }
      this.c2t = { t: F.dur, k: 0.25, A };
      this.fx.push({ type: 'ring', x: p.x, y: p.y, r: R, life: 0.6, max: 0.6, color: '#7aff5a' });
      this.shake = Math.max(this.shake, 7);
      sfx('forest'); buzz(80);
    }
  },

  // gel d'Hiver éternel jusqu'à until (runTime) : figé, ou ralenti pour un boss
  c2freeze(e, until) {
    const d = until - this.runTime;
    if (e.boss) e.slow = Math.max(e.slow, d); else e.freeze = Math.max(e.freeze, d);
    e.c2ice = until;
  },
  // tirs ennemis à l'écran : figés et brisés
  c2shots() {
    const p = this.p, R2 = VIEW * VIEW;
    let n = 0;
    this.eshots = this.eshots.filter(s => {
      if (d2(s, p) > R2) return true;
      if (n++ < 12) this.emit('c2shot', { x: s.x, y: s.y });
      return false;
    });
  },
  // fin d'Hiver éternel : la glace vole en éclats (dégâts sur tout ce qui est encore gelé)
  c2shatter(A, until) {
    const W = C2B.winter;
    let n = 0;
    for (const e of this.onScreen()) {
      if (e.c2ice !== until) continue;
      e.c2ice = 0;
      if (!e.boss) e.freeze = 0;
      if (n++ < 40) this.emit('c2shatter', { x: e.x, y: e.y, r: e.r });
      this.hitEnemy(e, A * W.shatter * (e.boss ? 0.8 : 1), { color: '#e8f8ff', knock: 120, kx: Math.sign(e.x - this.p.x), ky: Math.sign(e.y - this.p.y), quiet: !e.boss && !e.elite });
    }
    this.emit('c2end', { kind: 'winter', n });
    this.shake = Math.max(this.shake, 6);
    sfx('shatter');
  },
  // un coup d'épines autour de Gaïa : dégâts et recul
  c2thorns(A) {
    const p = this.p, F = C2B.forest, R = F.tR * p.area;
    let n = 0;
    for (const e of this.grid.query(p.x, p.y, R + 40)) {
      if (e.dead || e.burrowed || d2(e, p) > (R + e.r * 0.5) ** 2) continue;
      const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy) || 1;
      this.hitEnemy(e, A * F.thorn, { knock: 150, kx: dx / d, ky: dy / d, color: '#b8ff7a', quiet: n++ > 2 });
    }
    this.emit('c2thorns', { x: p.x, y: p.y, R, n });
    if (n) sfx('thorns');
  },

  // Morsure du givre (Frida) : chaque coup ralentit l'ennemi un moment
  chillC2(e) {
    e.chillT = this.runTime + C2B.chill.dur;
    e.chillK = 1 - this.cls.chill * (e.boss ? C2B.chill.boss : 1);
  },

  // chaque image (run.update) : sève de Gaïa, hiver éternel et épines en cours
  tickC2(dt) {
    const p = this.p, c = this.cls;
    if (c.regenPct && p.hp < p.maxHp && !this.dying && !this.over) p.hp = Math.min(p.maxHp, p.hp + p.maxHp * c.regenPct * this.diff.heal * dt);
    const w = this.c2w;
    if (w) {
      w.t -= dt; w.k -= dt;
      if (this.entering || this.dying || this.over) { this.c2w = null; this.emit('c2end', { kind: 'winter', n: 0 }); }
      else if (w.t <= 0) { this.c2w = null; this.c2shatter(w.A, w.until); }
      else if (w.k <= 0) {
        // l'hiver tient tout l'écran : les monstres qui arrivent gèlent aussi, les nouveaux tirs se brisent
        w.k = C2B.winter.tick;
        let n = 0;
        for (const e of this.onScreen()) if (!e.boss && e.c2ice !== w.until) { this.c2freeze(e, w.until); if (n++ < 10) this.emit('c2ice', { x: e.x, y: e.y, r: e.r }); }
        if (this.eshots.length) this.c2shots();
      }
    }
    const t = this.c2t;
    if (t) {
      t.t -= dt; t.k -= dt;
      if (this.entering || this.dying || this.over || t.t <= 0) { this.c2t = null; this.emit('c2end', { kind: 'forest', n: 0 }); }
      else if (t.k <= 0) { t.k = C2B.forest.tick; this.c2thorns(t.A); }
    }
  },
};
