// Champions C1 : Nyx la Vampire, Sora l'Ombre, Ragnar le Berserker. Ultimes et effets en cours, mélangés à Run
// (run.js : Object.assign(Run.prototype, C1)). Les passifs sont des talents de CLASSES : lifesteal (Nyx) et dodge (Sora)
// s'ajoutent à l'équipement comme l'armure de Brok ; rage (Ragnar) multiplie les dégâts dans run.hitEnemy (rageMul).
// L'arme de Nyx (faux sanglante, 'scythe') est dans run.js avec les autres armes.
// Événements pour le rendu (js/g3d/fx-c1.js) : 'ult' (kind = l'ultime), 'c1feast', 'c1hop', 'c1quake', 'c1end'.
import { HALF } from './data.js';
import { save } from './save.js';
import { sfx, buzz } from './audio.js';
import { fmt } from './ui.js';

// Réglages (exportés : le simulateur d'équilibrage peut les modifier). Dégâts en multiples de A = attaque × dégâts ×
// (1 + 0,3 × évolution), comme les ultimes de Lumi (×10 autour), Kira (×9 en ligne) et Brok (×7 à l'écran + 3 s d'invincibilité).
export const C1B = {
  // Festin de sang : dégâts à l'écran, soin = heal + per × victimes touchées (plafond max, en part des PV max)
  feast: { dmg: 5, heal: 0.15, per: 0.012, max: 0.45 },
  // Danse des ombres : durée (intouchable), intervalle entre deux bonds, dégâts sur la cible et autour (R = rayon),
  // portée d'un bond, coups au plus sur un boss (il ne fond pas en 2,5 s)
  dance: { dur: 2.5, hop: 0.16, dmg: 2.4, splash: 1.2, R: 75, reach: 380, boss: 4 },
  // Fureur : durée, vitesse d'attaque (recharges ÷ haste), onde de choc (dégâts, rayon), secousses pendant la fureur
  fury: { dur: 6, haste: 1.6, wave: 5, R: 260, quake: 1.5, qR: 170, qT: 1.5 },
  // Rage : bonus maximal (CLASSES.berserker.rage) atteint à low part des PV ou moins
  rage: { low: 0.2 },
};
const ULTS_C1 = new Set(['bloodfeast', 'shadowdance', 'fury']);
export const isUltC1 = id => ULTS_C1.has(id);

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const d2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

export const C1 = {
  ultC1(A) {
    const p = this.p, u = this.cls.ult;
    if (u === 'bloodfeast') {
      // Festin de sang (Nyx) : chaque ennemi à l'écran est vidé d'un coup ; filets de sang vers elle, gros soin
      const F = C1B.feast, list = this.onScreen();
      let n = 0;
      for (const e of list) {
        this.hitEnemy(e, A * F.dmg * (e.boss ? 0.8 : 1), { color: '#ff3a5a', knock: 120, kx: Math.sign(e.x - p.x), ky: Math.sign(e.y - p.y) });
        if (n++ < 14) this.emit('lifesteal', { x: e.x, y: e.y, h: e.r * 1.2 + e.fly });
      }
      const h = Math.min(p.maxHp - p.hp, p.maxHp * Math.min(F.max, F.heal + F.per * n) * this.diff.heal);
      if (h > 0 && !this.dying) {
        p.hp += h; this.track.lsHeal += h; save.stats.lsHeal = (save.stats.lsHeal || 0) + h; // compte comme un vol de vie (succès)
        this.text(p.x, p.y, 80, '+' + fmt(h), '#ff4d6d', 1.5);
      }
      this.lsGlow = 0.6;
      this.fx.push({ type: 'ring', x: p.x, y: p.y, r: 300, life: 0.6, max: 0.6, color: '#ff2a4a' });
      this.emit('c1feast', { x: p.x, y: p.y, n });
      this.shake = Math.max(this.shake, 8);
      sfx('feast');
    } else if (u === 'shadowdance') {
      // Danse des ombres (Sora) : intouchable, elle bondit de cible en cible (tickC1)
      const D = C1B.dance;
      this.c1d = { t: D.dur, hop: 0.05, seen: new Set(), boss: 0, n: 0 };
      p.inv = Math.max(p.inv, D.dur + 0.2);
      sfx('shadow');
    } else if (u === 'fury') {
      // Fureur (Ragnar) : onde de choc au sol puis 6 s d'attaques bien plus rapides (recalc : recharges ÷ haste)
      const F = C1B.fury;
      this.c1f = F.dur; this.c1q = F.qT; this.c1h = F.haste;
      this.recalc();
      this.c1quake(A * F.wave, F.R * p.area, true);
      sfx('fury'); buzz(90);
    }
  },

  // onde de choc de Ragnar : dégâts et recul autour de lui
  c1quake(dmg, R, big = false) {
    const p = this.p;
    for (const e of this.grid.query(p.x, p.y, R + 40)) {
      if (e.dead || e.burrowed || d2(e, p) > (R + e.r * 0.5) ** 2) continue;
      const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy) || 1;
      this.hitEnemy(e, dmg, { knock: big ? 420 : 240, kx: dx / d, ky: dy / d, color: '#ffb04a' });
    }
    this.fx.push({ type: 'ring', x: p.x, y: p.y, r: R, life: big ? 0.55 : 0.4, max: big ? 0.55 : 0.4, color: '#ff8a2a' });
    this.emit('c1quake', { x: p.x, y: p.y, R, big });
    this.shake = Math.max(this.shake, big ? 12 : 6);
    if (!big) sfx('stomp');
  },

  // bond de la danse des ombres : la cible la plus proche pas encore visitée (le boss au plus D.boss fois)
  c1hop() {
    const p = this.p, D = C1B.dance, s = this.c1d, A = this.arena, B = this.boss && !this.boss.dead ? this.boss : null;
    let best = null, bd = D.reach * D.reach;
    for (const e of this.enemies) {
      if (e.dead || e.burrowed || e.boss || s.seen.has(e) || (A && !e.inArena)) continue;
      const d = d2(e, p);
      if (d < bd) { bd = d; best = e; }
    }
    if (!best && B && s.boss < D.boss && d2(B, p) < (D.reach + B.r) ** 2 && !B.invuln) { best = B; s.boss++; }
    if (!best) return false;
    s.seen.add(best); s.n++;
    // atterrit juste derrière la cible (dans l'arène s'il y en a une)
    const fx0 = p.x, fy0 = p.y;
    let dx = best.x - p.x, dy = best.y - p.y, d = Math.hypot(dx, dy) || 1;
    dx /= d; dy /= d;
    let x = best.x + dx * (best.r + 16), y = best.y + dy * (best.r + 16);
    x = clamp(x, -HALF + 80, HALF - 80); y = clamp(y, -HALF + 80, HALF - 80);
    if (A) { const ax = x - A.x, ay = y - A.y, ad = Math.hypot(ax, ay), m = A.R - p.r - 4; if (ad > m) { x = A.x + ax / ad * m; y = A.y + ay / ad * m; } }
    p.x = x; p.y = y; p.face = { x: dx, y: dy };
    const A0 = p.atk * p.dmgMul * (1 + p.evo * 0.3), back = Math.atan2(-dy, -dx);
    this.hitEnemy(best, A0 * D.dmg * (best.boss ? 1.5 : 1), { color: '#d08aff', knock: 160, kx: dx, ky: dy });
    for (const e of this.grid.query(x, y, D.R + 40)) {
      if (e === best || e.dead || e.burrowed || d2(e, { x, y }) > (D.R + e.r * 0.5) ** 2) continue;
      this.hitEnemy(e, A0 * D.splash, { color: '#d08aff', knock: 140, kx: (e.x - x) / D.R, ky: (e.y - y) / D.R, quiet: true });
    }
    // croissant violet tourné vers la cible (l'animation d'attaque suit), traînée d'ombre
    this.fx.push({ type: 'slash', x, y, a: back, r: 70, life: 0.2, max: 0.2, c1: '#d08aff', c2: '#ff3ab0', c3: '#7a3aff' });
    this.emit('c1hop', { fromX: fx0, fromY: fy0, x, y });
    this.shake = Math.max(this.shake, 3);
    sfx('dash');
    return true;
  },

  // chaque image (run.update) : danse des ombres et fureur en cours
  tickC1(dt) {
    const s = this.c1d;
    if (s) {
      s.t -= dt; s.hop -= dt;
      if (this.entering || this.dying || this.over || s.t <= 0) { this.c1d = null; this.emit('c1end', { kind: 'shadowdance' }); }
      else if (s.hop <= 0) s.hop = this.c1hop() ? C1B.dance.hop : 0.08;
    }
    if (this.c1f > 0) {
      const F = C1B.fury;
      this.c1f -= dt; this.c1q -= dt;
      if (this.c1q <= 0 && this.c1f > 0.3 && !this.entering) { this.c1q = F.qT; const p = this.p; this.c1quake(p.atk * p.dmgMul * (1 + p.evo * 0.3) * F.quake, F.qR * p.area); }
      if (this.c1f <= 0) { this.c1f = 0; this.c1h = 1; this.recalc(); this.emit('c1end', { kind: 'fury' }); }
    }
  },

  // Rage de Ragnar : multiplicateur de dégâts selon les PV manquants (1 à 1 + rage, plein sous rage.low des PV)
  rageMul() {
    const p = this.p, k = clamp((1 - p.hp / p.maxHp) / (1 - C1B.rage.low), 0, 1);
    return 1 + (this.cls.rage || 0) * k;
  },
};

