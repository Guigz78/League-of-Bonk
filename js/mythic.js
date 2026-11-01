// Pouvoirs des objets mythiques (data.js : MYTHIC_ITEMS, MYTHIC_POWERS), mélangés à Run (Object.assign) comme giga.js.
// this.myth = { pouvoir: 1 } (objets équipés, playerStats().myth). Accroches dans run.js : hitEnemy (Faucheuse, Écho,
// Roi des Bonks), hurtPlayer (Titan, Renaissance), addCombo (onde royale), update (Pluie d'étoiles), setupWorld.
// Rendu : événements 'legend' (kind meteorFall, meteor, reap, rebirth, titan, echo, king) dessinés par g3d/fx.js.
import { MYTHIC_POWERS as MP } from './data.js';
import { sfx, buzz } from './audio.js';

const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

export const MYTH_METHODS = {
  initMyth(st) {
    this.myth = {};
    for (const id of Array.isArray(st.myth) ? st.myth : []) if (MP[id]) this.myth[id] = 1;
    this.meteors = []; this.metT = 1.5; this.reapK = 0; this.rebirthUsed = false;
  },
  // nouveau monde : la Faucheuse repart de zéro, la Renaissance est de nouveau prête
  mythWorld() { this.reapK = 0; this.rebirthUsed = false; this.meteors = []; },

  // multiplicateur de dégâts (Faucheuse : exécutions du monde ; Roi des Bonks : combo)
  mythDmg() {
    let k = 1;
    if (this.myth.reaper) k *= 1 + this.reapK;
    if (this.myth.king) k *= 1 + Math.min(MP.king.max, Math.floor(this.combo / 10) * MP.king.per);
    return k;
  },

  // Faucheuse : un ennemi touché (pas un boss ni un champion) passé sous 20 % de PV meurt net
  mythReap(e) {
    if (!this.myth.reaper || e.dead || e.hp <= 0 || e.boss || e.mini || e.hp >= e.maxHp * MP.reaper.below) return;
    e.hp = 0;
    this.reapK = Math.min(MP.reaper.max, this.reapK + MP.reaper.step);
    this.emit('legend', { kind: 'reap', x: e.x, y: e.y, r: e.r });
    if (e.elite) this.text(e.x, e.y, e.r * 2.6 + e.fly, '☠ Exécuté !', '#d08aff', 1.3);
  },

  // Écho du Néant : le coup frappe une seconde fois (sans relancer d'effets)
  mythEcho(e, dmg, o) {
    if (!this.myth.echo || o.echo || o.legend || e.dead || Math.random() >= MP.echo.chance) return;
    this.emit('legend', { kind: 'echo', x: e.x, y: e.y, r: e.r });
    this.hitEnemy(e, dmg, { ...o, echo: true, legend: true, knock: 0, quiet: true, color: '#c08aff' });
  },

  // Titan : dégâts d'un coup plafonnés, l'attaquant est puni
  mythTitan(d, src) {
    if (!this.myth.titan) return d;
    const p = this.p, cap = Math.max(1, Math.ceil(p.maxHp * MP.titan.cap));
    if (src && !src.dead && src.hp > 0) this.hitEnemy(src, p.atk * p.dmgMul * MP.titan.k, { noCrit: true, quiet: true, legend: true, color: '#ffd54a' });
    if (d > cap) this.emit('legend', { kind: 'titan', x: p.x, y: p.y });
    return Math.min(d, cap);
  },

  // Renaissance : une fois par monde, un coup fatal fait renaître (60 % de PV) dans une explosion de flammes
  mythRebirth() {
    if (!this.myth.rebirth || this.rebirthUsed) return false;
    const p = this.p, P = MP.rebirth;
    this.rebirthUsed = true;
    p.hp = Math.round(p.maxHp * P.hp); p.inv = Math.max(p.inv, 2.5);
    this.eshots = []; this.bombs = [];
    for (const e of this.grid.query(p.x, p.y, P.R + 40)) if (!e.dead && dist2(e, p) < (P.R + e.r * 0.5) ** 2) {
      this.hitEnemy(e, p.atk * p.dmgMul * P.k, { legend: true, quiet: true, noCrit: true, color: '#ff8a3a', knock: 420, kx: (e.x - p.x) / P.R, ky: (e.y - p.y) / P.R });
    }
    this.fx.push({ type: 'ring', x: p.x, y: p.y, r: P.R, life: 0.7, max: 0.7, color: '#ff8a3a' });
    this.emit('legend', { kind: 'rebirth', x: p.x, y: p.y, R: P.R });
    this.banner('<small>Armure du Phénix éternel</small>🔥 Renaissance !', 1800, 'evo');
    this.shake = 14; this.hitStop = 0.12; sfx('revive'); sfx('boom'); buzz(120);
    return true;
  },

  // Roi des Bonks : tous les 100 de combo, une onde royale autour du héros
  mythCombo() {
    if (!this.myth.king || this.combo % 100) return;
    const p = this.p, K = MP.king;
    for (const e of this.grid.query(p.x, p.y, K.R + 40)) if (!e.dead && dist2(e, p) < (K.R + e.r * 0.5) ** 2) {
      this.hitEnemy(e, p.atk * p.dmgMul * K.k, { legend: true, quiet: true, color: '#ffd54a', knock: 300, kx: (e.x - p.x) / K.R, ky: (e.y - p.y) / K.R });
    }
    this.fx.push({ type: 'ring', x: p.x, y: p.y, r: K.R, life: 0.55, max: 0.55, color: '#ffd54a' });
    this.emit('legend', { kind: 'king', x: p.x, y: p.y, R: K.R });
    this.text(p.x, p.y, 96, `👑 ${this.combo} : onde royale !`, '#ffd54a', 1.35);
    this.shake = Math.max(this.shake, 7); sfx('thunder'); buzz(50);
  },

  // Pluie d'étoiles : une étoile vise le plus gros groupe proche, s'écrase 0,35 s plus tard
  updateMyth(dt) {
    if (!this.myth.meteor || this.dying) return;
    const p = this.p, M = MP.meteor;
    for (const m of this.meteors) if ((m.t -= dt) <= 0) this.mythImpact(m);
    this.meteors = this.meteors.filter(m => m.t > 0);
    if ((this.metT -= dt) > 0) return;
    let best = null, bn = 0;
    const cand = this.grid.query(p.x, p.y, 520);
    for (let i = 0; i < cand.length && i < 48; i++) {
      const e = cand[i]; if (e.dead || e.burrowed) continue;
      let n = e.boss ? 4 : e.elite ? 2 : 0;
      for (const o of this.grid.query(e.x, e.y, M.R)) if (!o.dead && dist2(o, e) < M.R * M.R) n++;
      if (n > bn) { bn = n; best = e; }
    }
    if (!best) { this.metT = 0.5; return; }
    this.metT = M.every;
    this.meteors.push({ x: best.x, y: best.y, t: 0.35 });
    this.emit('legend', { kind: 'meteorFall', x: best.x, y: best.y, t: 0.35 });
  },
  mythImpact(m) {
    const p = this.p, M = MP.meteor, dmg = p.atk * p.dmgMul * M.k;
    for (const e of this.grid.query(m.x, m.y, M.R + 40)) if (!e.dead && dist2(e, m) < (M.R + e.r * 0.5) ** 2) {
      const d = Math.sqrt(dist2(e, m)) || 1;
      this.hitEnemy(e, dmg, { legend: true, quiet: true, color: '#ffd54a', knock: 240, kx: (e.x - m.x) / d, ky: (e.y - m.y) / d });
    }
    this.fx.push({ type: 'ring', x: m.x, y: m.y, r: M.R, life: 0.45, max: 0.45, color: '#ffb04a' });
    this.emit('legend', { kind: 'meteor', x: m.x, y: m.y, R: M.R });
    this.shake = Math.max(this.shake, 5);
    if (this.hitSfxT <= 0) { sfx('boom'); this.hitSfxT = 0.12; }
  },
};
