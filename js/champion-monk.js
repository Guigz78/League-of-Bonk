// Kenji le moine : passif Flux du combo et ultime Mille poings, mélangés à Run (run.js : Object.assign(Run.prototype, MONK),
// comme js/champions-c1.js). Talents de CLASSES.monk : dodge = esquive (ajoutée à l'équipement comme celle de Sora),
// flow = vitesse d'attaque en plus par tranche de MKB.flow.per de combo (run.recalc divise les recharges par 1 + mkF).
// Ses 4 armes (Poings de fer, Paume de ki, Vague de chi, Dragon de ki) sont dans js/arsenal-monk.js.
// Événements pour le rendu (js/g3d/fx-monk.js) : 'ult' (kind 'thousand'), 'mkfist' (un tir de la rafale), 'mkwave' (onde
// de ki finale), 'mkflow' (palier du flux), 'mkend' (rafale interrompue).
import { sfx, buzz } from './audio.js';

// Réglages (exportés : le simulateur d'équilibrage peut les modifier). Dégâts en multiples de A = attaque × dégâts ×
// (1 + 0,3 × évolution), comme les autres ultimes (Lumi ×10 autour, Kira ×9 en ligne, Brok ×7 à l'écran + 3 s d'invincibilité).
export const MKB = {
  // Flux du combo : un palier par tranche de per victimes enchaînées (CLASSES.monk.flow chacun), plafond max
  flow: { per: 25, max: 0.2 },
  // Mille poings : durée de la rafale (intouchable, + inv après), un coup toutes les tick s sur tout le cône (rayon R,
  // demi-angle arc) à dmg × A chacun ; puis onde de ki (wave × A, rayon wR) ; boss = part des dégâts sur un boss
  ult: { dur: 1.2, tick: 0.08, dmg: 0.4, R: 330, arc: 1.15, wave: 4.5, wR: 300, boss: 0.8, inv: 0.4 },
};
const ULTS_MK = new Set(['thousand']);
export const isUltMonk = id => ULTS_MK.has(id);

const NEAR = []; // résultats de la grille (réutilisés)
const pct = v => Math.round(v * 100) + ' %';

export const MONK = {
  ultMonk(A) {
    const p = this.p, U = MKB.ult, t = this.aim(U.R * p.area);
    const a = t ? Math.atan2(t.y - p.y, t.x - p.x) : Math.atan2(p.face.y, p.face.x);
    this.mku = { t: U.dur, k: 0.03, a, A, n: 0 };
    p.inv = Math.max(p.inv, U.dur + U.inv);
    this.shake = Math.max(this.shake, 4);
    sfx('thousand'); buzz(70);
  },

  // un coup de la rafale : tout ce qui est dans le cône devant Kenji (il suit sa cible si elle bouge)
  mkBarrage() {
    const p = this.p, U = MKB.ult, s = this.mku, R = U.R * p.area, tg = this.target;
    if (tg && !tg.dead && !tg.burrowed && (tg.x - p.x) ** 2 + (tg.y - p.y) ** 2 < R * R) {
      let d = Math.atan2(tg.y - p.y, tg.x - p.x) - s.a; d = Math.atan2(Math.sin(d), Math.cos(d));
      s.a += Math.max(-0.12, Math.min(0.12, d));
    }
    let n = 0;
    for (const e of this.grid.query(p.x, p.y, R + 40, NEAR)) {
      if (e.dead || e.burrowed) continue;
      const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy);
      if (d > R + e.r * 0.5) continue;
      let da = Math.atan2(dy, dx) - s.a; da = Math.atan2(Math.sin(da), Math.cos(da));
      if (Math.abs(da) > U.arc && d > 40) continue;
      this.hitEnemy(e, s.A * U.dmg * (e.boss ? U.boss : 1), { knock: 50, kx: dx / (d || 1), ky: dy / (d || 1), color: '#ffd27a', quiet: !e.boss && !e.elite });
      n++;
    }
    s.n++;
    p.face = { x: Math.cos(s.a), y: Math.sin(s.a) };
    this.emit('mkfist', { x: p.x, y: p.y, a: s.a, R, arc: U.arc, n, i: s.n });
    if (n) this.shake = Math.max(this.shake, 2.5);
    sfx('punch');
  },

  // fin de la rafale : grande onde de ki tout autour
  mkWave(A) {
    const p = this.p, U = MKB.ult, R = U.wR * p.area;
    let n = 0;
    for (const e of this.grid.query(p.x, p.y, R + 40, NEAR)) {
      if (e.dead || e.burrowed) continue;
      const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy);
      if (d > R + e.r * 0.5) continue;
      this.hitEnemy(e, A * U.wave * (e.boss ? U.boss : 1), { knock: 440, kx: dx / (d || 1), ky: dy / (d || 1), color: '#fff0a0', quiet: n++ > 6 && !e.boss && !e.elite });
    }
    this.fx.push({ type: 'ring', x: p.x, y: p.y, r: R, life: 0.6, max: 0.6, color: '#ffc23a' });
    this.emit('mkwave', { x: p.x, y: p.y, R, n });
    this.shake = Math.max(this.shake, 10);
    sfx('kiwave'); buzz(80);
  },

  // chaque image (run.update) : Flux du combo, rafale de Mille poings en cours
  tickMonk(dt) {
    const c = this.cls;
    if (c.flow) {
      const F = MKB.flow, k = Math.min(F.max, Math.floor(this.combo / F.per) * c.flow);
      if (k !== (this.mkF || 0)) {
        const k0 = this.mkF || 0, up = k > k0, p = this.p;
        this.mkF = k; this.recalc();
        if (up) {
          // texte à mi-chemin et au plafond seulement (les paliers du combo ont déjà le leur) ; anneau à chaque palier
          const max = k >= F.max - 1e-9, half = k0 < F.max / 2 && k >= F.max / 2 - 1e-9;
          if (max || half) this.text(p.x, p.y, 44, max ? 'Flux maximal !' : 'Flux +' + pct(k), max ? '#ffd54a' : '#ffc23a', max ? 1.15 : 0.95);
          this.emit('mkflow', { k, max });
          if (max) sfx('flowmax');
        }
      }
    }
    const s = this.mku;
    if (s) {
      s.t -= dt; s.k -= dt;
      if (this.entering || this.dying || this.over) { this.mku = null; this.emit('mkend', {}); }
      else if (s.t <= 0) { this.mku = null; this.mkWave(s.A); }
      else if (s.k <= 0) { s.k += MKB.ult.tick; this.mkBarrage(); }
    }
  },
};
