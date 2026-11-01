// Morgane la capitaine pirate : ultime (Bordée) et effets en cours, mélangés à Run (run.js : Object.assign(Run.prototype,
// PIR), comme js/champions-c1.js). Passif « Butin » = talents de CLASSES : goldPct (or en plus, save.playerStats ; ne compte
// pas dans la chance des cartes, run.luck0) et lootUp (chance qu'un coffre de butin monte d'un rang, run.lootTier).
// Bordée : son navire (hors de l'écran, d'un côté) tire trois salves de boulets ; chaque boulet vole en cloche vers un point
// de l'écran (un monstre le plus souvent, au hasard sinon), une cible rouge au sol annonce l'impact, puis il explose en zone.
// État en cours : run.pirU (boulets réutilisés, aucune allocation pendant la salve), lu par le rendu (js/g3d/fx-pirate.js) ;
// événements : 'ult' (kind 'broadside', side), 'pirVolley' (départ d'une salve), 'pirImpact' (un boulet touche le sol),
// 'pirEnd'.
import { sfx, buzz } from './audio.js';

// Réglages (exportés : le simulateur d'équilibrage peut les modifier). Dégâts en multiples de A = attaque × dégâts ×
// (1 + 0,3 × évolution), comme les autres ultimes (Lumi ×10 autour, Brok ×7 à l'écran + 3 s d'invincibilité, Nyx ×5 + soin).
// volleys = salves, gap = écart entre deux salves (s), per = boulets par salve, fly = durée du vol (s, + jusqu'à spread au
// hasard), R = rayon d'explosion, dmg = dégâts d'un boulet (un monstre dans la foule en prend 1 à 3), onFoe = part des
// boulets tirés sur un monstre (sinon au hasard dans l'écran), reach = rayon de l'écran visé, boss = part des dégâts sur un
// boss, bossMax = boulets au plus qui touchent un même boss, side = distance du navire (au bord de l'écran, à gauche ou à
// droite ; il vole à alt px du sol : rendu), hull = demi-longueur de sa coque (les boulets partent de ses sabords)
export const PIRB = {
  broadside: { volleys: 3, gap: 0.45, per: 8, fly: 0.75, spread: 0.25, R: 95, dmg: 3.4, onFoe: 0.75, reach: 430, boss: 0.8, bossMax: 4, side: 250, alt: 50, hull: 70 },
};
const ULTS_PIR = new Set(['broadside']);
export const isUltPir = id => ULTS_PIR.has(id);

const TAU = Math.PI * 2, HALF = 1600;
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const Q = []; // résultats de la grille (réutilisés)
const BALLS = Array.from({ length: 36 }, () => ({ on: false, sx: 0, sy: 0, x: 0, y: 0, t: 0, dur: 1 })); // boulets réutilisés

export const PIR = {
  ultPir(A) {
    const p = this.p, B = PIRB.broadside;
    // le navire est du côté où il y a le moins de monstres : il tire par-dessus Morgane, vers eux (side 1 : à gauche)
    let l = 0, r = 0;
    for (const e of this.onScreen()) if (e.x < p.x) l++; else r++;
    const side = l === r ? (Math.random() < 0.5 ? -1 : 1) : l > r ? -1 : 1;
    for (const b of BALLS) b.on = false;
    this.pirU = { t: 0, v: 0, A, side, sy: p.y + 20, balls: BALLS, n: 0, boss: 0 };
    this.shake = Math.max(this.shake, 6);
    sfx('pirBroad'); buzz(70);
  },

  // une salve : per boulets, chacun vers un monstre de l'écran (au hasard) ou un point de l'écran
  pirVolley() {
    const p = this.p, U = this.pirU, B = PIRB.broadside, T = this.onScreen();
    const sx = p.x - U.side * B.side; U.sy = p.y + 20; // le navire suit Morgane, au bord de l'écran
    for (let i = 0, k = 0; i < B.per && k < BALLS.length; k++) {
      const b = BALLS[k];
      if (b.on) continue;
      const e = T.length && Math.random() < B.onFoe ? T[(Math.random() * T.length) | 0] : null;
      let x, y;
      if (e) { x = e.x + rand(-25, 25); y = e.y + rand(-25, 25); }
      else { const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * B.reach; x = p.x + Math.cos(a) * d; y = p.y + Math.sin(a) * d * 0.85; }
      const A = this.arena;
      if (A) { const ax = x - A.x, ay = y - A.y, d = Math.hypot(ax, ay); if (d > A.R - 20) { x = A.x + ax / d * (A.R - 20); y = A.y + ay / d * (A.R - 20); } }
      b.on = true; b.rs = 0; b.x = clamp(x, -HALF + 40, HALF - 40); b.y = clamp(y, -HALF + 40, HALF - 40); // rs : départ à placer par le rendu
      b.sx = sx + U.side * 30; b.sy = U.sy + rand(-B.hull, B.hull); b.t = -i * 0.05; b.dur = B.fly + rand(0, B.spread);
      i++;
    }
    this.emit('pirVolley', { x: sx, y: U.sy, side: U.side, v: U.v });
    sfx('pirCannon');
  },

  // un boulet touche le sol : explosion en zone (les boss en prennent au plus bossMax)
  pirImpact(b) {
    const U = this.pirU, B = PIRB.broadside, R = B.R * this.p.area;
    for (const e of this.grid.query(b.x, b.y, R + 40, Q)) {
      if (e.dead || e.burrowed) continue;
      const dx = e.x - b.x, dy = e.y - b.y, d = Math.hypot(dx, dy);
      if (d > R + e.r * 0.5) continue;
      if (e.boss && U.boss++ >= B.bossMax) continue;
      this.hitEnemy(e, U.A * B.dmg * (e.boss ? B.boss : 1), { color: '#ffb04a', quiet: !e.boss && !e.elite, knock: 260, kx: dx / (d || 1), ky: dy / (d || 1) });
    }
    this.emit('pirImpact', { x: b.x, y: b.y, R });
    this.shake = Math.max(this.shake, 4);
    sfx('pirBoom');
  },

  // chaque image (run.update) : départ des salves, vol et impact des boulets
  tickPir(dt) {
    const U = this.pirU, B = PIRB.broadside;
    if (this.entering || this.dying || this.over) { this.pirU = null; for (const b of BALLS) b.on = false; this.emit('pirEnd', {}); return; }
    U.t += dt;
    while (U.v < B.volleys && U.t >= U.v * B.gap) { this.pirVolley(); U.v++; }
    let live = 0;
    for (const b of BALLS) {
      if (!b.on) continue;
      if ((b.t += dt) >= b.dur) { b.on = false; this.pirImpact(b); U.n++; continue; }
      live++;
    }
    if (U.v >= B.volleys && !live) { this.pirU = null; this.emit('pirEnd', { n: U.n }); }
  },
};
