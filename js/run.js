// Moteur façon Megabonk / PokéBonk (rendu 2D vu de dessus) : monde ouvert, hordes, armes automatiques,
// saut, évolutions du champion, autels, coffres, boss géants.
// Difficulté : niveaux Normal / Difficile / Cauchemar par zone, comportements par type de monstre
// (chaque attaque spéciale est annoncée par l'événement 'enemyTelegraph' avant d'agir), élites à pouvoirs,
// boss à phase de rage.
import { CLASSES, WEAPONS, TOMES, ULTS, ZONE_TIME, PETS, MAX_WEAPONS, MAX_TOMES, MAX_LEVEL, EVOLUTIONS, BOONS, DIFFICULTIES, ELITE_MODS, HALF } from './data.js';
import { save, playerStats } from './save.js';
import { iconImg } from './art.js';
import { rng } from './pixel.js';
import { Gfx } from './g2d/renderer.js';
import { sfx, buzz, music, stopMusic, duckMusic } from './audio.js';
import { mount, $, esc, fmt } from './ui.js';

const TAU = Math.PI * 2;
const SPEED = { blob: 52, humanoid: 64, golem: 40, beast: 78, bird: 80, crab: 70, ghost: 64, worm: 56 };
const FLYERS = { bird: 34, ghost: 26 };
// Particularités par type de corps : PV, recul subi, dégâts au contact
// (les golems sont lents, très résistants et peu repoussés ; les volants, qu'on ne peut pas sauter, frappent un peu moins fort)
const BODY = {
  golem: { hp: 1.6, knock: 0.25, dmg: 1 }, blob: { hp: 0.85, knock: 1.1, dmg: 1 }, bird: { hp: 0.85, knock: 1, dmg: 0.85 },
  crab: { hp: 0.95, knock: 0.8, dmg: 1 }, ghost: { hp: 0.9, knock: 1, dmg: 0.9 },
};
const BODY0 = { hp: 1, knock: 1, dmg: 1 };
const HARD_CAP = 250;   // monstres simultanés au maximum (rendu instancié)
const BOSS_HP = 22;     // PV du boss = PV de base × BOSS_HP × zone × difficulté
const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const rand = (a, b) => a + Math.random() * (b - a);
const SPAWN_R = 800, VIEW_R = 520;

// ---------- Grille spatiale ----------
class Grid {
  constructor(size) { this.s = size; this.m = new Map(); }
  clear() { this.m.clear(); }
  add(e) { const k = ((e.x / this.s) | 0) * 73856093 ^ ((e.y / this.s) | 0) * 19349663; let a = this.m.get(k); if (!a) this.m.set(k, a = []); a.push(e); }
  query(x, y, r, out = []) {
    out.length = 0;
    const s = this.s, x0 = Math.floor((x - r) / s), x1 = Math.floor((x + r) / s), y0 = Math.floor((y - r) / s), y1 = Math.floor((y + r) / s);
    for (let gx = x0; gx <= x1; gx++) for (let gy = y0; gy <= y1; gy++) {
      const a = this.m.get(gx * 73856093 ^ gy * 19349663);
      if (a) for (const e of a) out.push(e);
    }
    return out;
  }
}

export class Run {
  constructor({ zone, diff = 0, onEnd, onPause, onLevelUp, onChest, onDefeat }) {
    this.zone = zone;
    this.diffId = Math.max(0, Math.min(DIFFICULTIES.length - 1, diff | 0));
    this.diff = DIFFICULTIES[this.diffId];
    this.cls = CLASSES[save.cls];
    this.onEnd = onEnd; this.onPause = onPause; this.onLevelUp = onLevelUp; this.onChest = onChest; this.onDefeat = onDefeat;
    this.duration = ZONE_TIME[zone.id];
    this.replay = save.zoneCleared[zone.id];
    const st = playerStats();
    this.base = st;
    this.p = {
      x: 0, y: 0, h: 0, vh: 0, r: 14, face: { x: 0, y: -1 },
      maxHp: st.hp, hp: st.hp, atk: st.atk, crit: st.crit, regen: st.regen * 0.1 * this.diff.heal,
      speed: 160 * st.speed, magnet: 95 * st.magnet * (save.pet === 'phenix' ? 1.4 : 1),
      armor: 0, xpMul: 1, area: 1, haste: 1, dmgMul: 1,
      inv: 0, shieldHit: 0, level: 1, xp: 0, xpNext: 5, ult: 0,
      weapons: [], tomes: {}, boons: {}, evo: 0,
    };
    this.addWeapon(this.cls.weapon);
    this.enemies = []; this.shots = []; this.eshots = []; this.fx = []; this.pickups = []; this.texts = []; this.mines = []; this.parts = []; this.waves = [];
    this.grid = new Grid(64);
    this.time = 0; this.kills = 0; this.gold = 0;
    this.spawnAcc = 0;
    // élites plus fréquentes, 4 hordes de plus en plus denses, plafond de monstres selon la zone et le niveau
    this.nextElite = 35;
    this.eliteGap = (zone.id ? 30 : 34) * this.diff.elite;
    this.swarms = [0.25, 0.46, 0.66, 0.85].map(f => f * this.duration);
    this.swarmN = 0;
    this.cap = Math.min(HARD_CAP - 10, Math.round((150 + zone.id * 16) * (1 + (this.diff.spawn - 1) * 0.6)));
    this.pack = 0; this.packX = 0; this.packY = 0;
    this.bombs = [];          // attaques de zone à retardement (explosions, météores) : { x, y, R, t, dmg, kind, e }
    this.mv = { x: 0, y: 0 }; // vitesse calculée par l'IA d'un monstre (réutilisée, pas d'allocation)
    this.acts = 0;            // attaques spéciales en cours (limitées pour rester lisibles)
    this.boss = null; this.bossSpawned = false;
    this.paused = false; this.over = false; this.revived = false;
    this.pending = 0;
    this.joy = null; this.look = null; this.yaw = 0;
    this.keys = new Set();
    this.shake = 0; this.hitSfxT = 0; this.msgT = 0;
    this.hurtFlash = 0; this.evoFlash = 0; this.ultFlash = 0;
    this.petT = 0; this.pet = save.pet ? { id: save.pet, x: -30, y: 10 } : null;
    this.slowmo = 1; this.hitStop = 0;
    this.SPAWN_R = SPAWN_R;
    this.dropChests = [];
    this.events = []; // événements pour le rendu (coups, morts, sauts...), vidés à chaque image par gfx
    this.placeInterest();
  }

  // signale un événement aux effets visuels (n'a aucun effet sur la partie)
  emit(type, data = {}) { if (this.events.length < 400) this.events.push({ type, t: this.time, ...data }); }

  // ---------- Mise en place ----------
  start() {
    const u = ULTS[this.cls.ult];
    mount(`<div class="run">
      <canvas id="cv"></canvas>
      <div class="hud">
        <div class="hud-top">
          <button class="icon-btn" id="pauseBtn" aria-label="Pause"><i class="pause-ic"></i></button>
          <div class="timer"><b id="timer">0:00</b><small id="timerLbl">Survivez !</small>${this.diffId ? `<em class="diff-tag d${this.diffId}">${esc(this.diff.name)}</em>` : ''}</div>
          <div class="hud-right"><span>${iconImg('skull', 16)}<b id="killsN">0</b></span><span>${iconImg('gold', 16)}<b id="goldRun">0</b></span></div>
        </div>
        <div class="xpbar"><div class="fill" id="xpFill"></div><span id="lvl">Niv. 1</span></div>
        <div class="evo-line" id="evoLine"></div>
        <div class="loadout" id="loadout"></div>
        <div class="bossbar" id="bossbar" hidden><div class="bn" id="bossName"></div><div class="hpbar"><div class="fill"></div><span></span></div></div>
        <div class="banner" id="banner"></div>
        <div class="hint-bubble" id="hintBubble">Glissez le doigt pour courir.<br>Touchez rapidement l'écran pour sauter.<br>Votre champion attaque tout seul !</div>
        <button class="ult-btn" id="ultBtn" aria-label="${esc(u.name)}">${iconImg(u.icon, 30)}<svg class="ring" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16"/></svg><small>${esc(u.name)}</small></button>
      </div>
    </div>`);
    this.cv = $('#cv');
    this.gfx = new Gfx(this, this.cv);
    this.resize = () => this.gfx.resize();
    this.resize();
    window.addEventListener('resize', this.resize);
    this.bindInput();
    $('#pauseBtn').addEventListener('click', () => this.pause());
    $('#ultBtn').addEventListener('click', () => this.useUlt());
    this.onVis = () => { if (document.hidden && !this.paused && !this.over) this.pause(); };
    document.addEventListener('visibilitychange', this.onVis);
    this.renderLoadout();
    this.renderEvo();
    this.banner(`<small>${esc(this.zone.name)}${this.diffId ? ' · ' + esc(this.diff.name) : ''}</small>Survivez ${Math.round(this.duration / 60)} minutes !`, 2200);
    music('zone' + this.zone.id);
    this.last = performance.now();
    this.raf = requestAnimationFrame(t => this.frame(t));
    setTimeout(() => $('#hintBubble')?.classList.add('out'), save.stats.runs > 2 ? 3000 : 7000);
  }

  placeInterest() {
    const r = rng('poi' + this.zone.id + ':' + save.stats.runs);
    const spots = [];
    const pick = minD => {
      for (let t = 0; t < 60; t++) {
        const x = (r() * 2 - 1) * (HALF - 220), y = (r() * 2 - 1) * (HALF - 220);
        if (Math.hypot(x, y) < minD) continue;
        if (spots.some(s => Math.hypot(s.x - x, s.y - y) < 260)) continue;
        spots.push({ x, y }); return { x, y };
      }
      return { x: rand(-800, 800), y: rand(-800, 800) };
    };
    this.chests = Array.from({ length: 9 }, () => ({ ...pick(260), open: false }));
    this.shrines = Array.from({ length: 5 }, () => ({ ...pick(320), charge: 0, used: false }));
    this.chestCost = Math.round(12 + this.zone.id * 8);
  }

  destroy() {
    this.over = true;
    stopMusic();
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
    document.removeEventListener('visibilitychange', this.onVis);
    window.removeEventListener('keydown', this.kd); window.removeEventListener('keyup', this.ku);
    this.gfx?.dispose();
  }

  bindInput() {
    const cv = this.cv;
    cv.addEventListener('pointerdown', e => {
      e.preventDefault();
      cv.setPointerCapture?.(e.pointerId);
      // un seul doigt : on glisse pour courir, on touche brièvement pour sauter
      if (!this.joy) this.joy = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY, t0: performance.now(), moved: 0, yaw: this.yaw };
      $('#hintBubble')?.classList.add('out');
    });
    cv.addEventListener('pointermove', e => {
      const j = this.joy;
      if (j && e.pointerId === j.id) { j.moved = Math.max(j.moved, Math.hypot(e.clientX - j.ox, e.clientY - j.oy)); j.x = e.clientX; j.y = e.clientY; }
    });
    const up = e => {
      const j = this.joy;
      if (j && e.pointerId === j.id) {
        if (j.moved < 14 && performance.now() - j.t0 < 260) this.jump();
        this.joy = null;
      }
    };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    this.kd = e => { this.keys.add(e.key.toLowerCase()); if (e.key === ' ') this.jump(); if (e.key.toLowerCase() === 'e') this.useUlt(); if (e.key === 'Escape') this.pause(); };
    this.ku = e => this.keys.delete(e.key.toLowerCase());
    window.addEventListener('keydown', this.kd); window.addEventListener('keyup', this.ku);
  }

  banner(html, ms = 1500, cls = '') {
    const b = $('#banner'); if (!b) return;
    b.className = 'banner show ' + cls;
    b.innerHTML = `<div>${html}</div>`;
    b.style.animationDuration = ms + 'ms';
    clearTimeout(this.bannerT);
    this.bannerT = setTimeout(() => { b.className = 'banner'; }, ms);
  }

  pause() {
    if (this.paused || this.over) return;
    this.paused = true; this.joy = null; this.look = null;
    duckMusic(true);
    this.onPause(() => { this.paused = false; duckMusic(false); this.last = performance.now(); });
  }

  jump() {
    const p = this.p;
    if (this.paused || this.over || p.h > 2) return;
    p.vh = 560; p.h = 1;
    this.emit('jump', { x: p.x, y: p.y });
    sfx('jump');
  }

  // ---------- Armes, tomes, autels ----------
  addWeapon(id) {
    const w = this.p.weapons.find(x => x.id === id);
    if (w) w.lv = Math.min(MAX_LEVEL, w.lv + 1); else this.p.weapons.push({ id, lv: 1, t: 0.4, a: 0 });
    this.renderLoadout?.();
  }

  addTome(id) { this.p.tomes[id] = (this.p.tomes[id] || 0) + 1; this.recalc(); this.renderLoadout(); }
  addBoon(id) {
    this.p.boons[id] = (this.p.boons[id] || 0) + 1;
    this.recalc();
    if (id === 'hp') this.p.hp = this.p.maxHp;
  }

  recalc() {
    const p = this.p, t = p.tomes, b = p.boons, evo = p.evo;
    p.dmgMul = (1 + 0.15 * (t.power || 0) + 0.12 * (b.dmg || 0)) * (1 + 0.2 * evo);
    p.haste = Math.max(0.45, 1 - 0.1 * (t.haste || 0) - 0.08 * (b.haste || 0));
    p.speed = 160 * this.base.speed * (1 + 0.1 * (t.boots || 0) + 0.08 * (b.speed || 0) + 0.05 * evo);
    p.magnet = 95 * this.base.magnet * (1 + 0.35 * (t.magnet || 0) + 0.3 * (b.magnet || 0)) * (save.pet === 'phenix' ? 1.4 : 1);
    p.crit = this.base.crit + 0.07 * (t.crit || 0) + 0.06 * (b.crit || 0);
    p.armor = Math.min(0.3, 0.06 * (t.armor || 0));
    p.xpMul = 1 + 0.15 * (t.wisdom || 0) + 0.2 * (b.xp || 0);
    p.area = 1 + 0.12 * (t.area || 0);
    const old = p.maxHp;
    p.maxHp = Math.round(this.base.hp * (1 + 0.2 * (t.vital || 0) + 0.15 * (b.hp || 0)) * (1 + 0.25 * evo));
    if (p.maxHp > old) p.hp += p.maxHp - old;
  }

  renderLoadout() {
    const el = $('#loadout'); if (!el) return;
    const p = this.p;
    el.innerHTML = p.weapons.map(w => `<span class="lo w">${iconImg(WEAPONS[w.id].icon, 18)}<b>${w.lv}</b></span>`).join('') +
      Object.entries(p.tomes).map(([id, lv]) => `<span class="lo t">${iconImg(TOMES[id].icon, 18)}<b>${lv}</b></span>`).join('');
  }

  renderEvo() {
    const el = $('#evoLine'); if (!el) return;
    const evs = EVOLUTIONS[this.cls.id], next = evs[this.p.evo + 1];
    el.innerHTML = `<b>${esc(evs[this.p.evo].name)}</b>${next ? ` <small>· évolue au niv. ${next.lvl}</small>` : ' <small>· forme ultime</small>'}`;
  }

  choices(n = 3) {
    const p = this.p, cands = [];
    for (const w of p.weapons) if (w.lv < MAX_LEVEL) cands.push({ kind: 'weapon', id: w.id, lv: w.lv + 1, wgt: 3 });
    if (p.weapons.length < MAX_WEAPONS) for (const id of Object.keys(WEAPONS)) if (!p.weapons.find(w => w.id === id)) cands.push({ kind: 'weapon', id, lv: 1, wgt: 1.6 });
    for (const [id, lv] of Object.entries(p.tomes)) if (lv < MAX_LEVEL) cands.push({ kind: 'tome', id, lv: lv + 1, wgt: 2 });
    if (Object.keys(p.tomes).length < MAX_TOMES) for (const id of Object.keys(TOMES)) if (!p.tomes[id]) cands.push({ kind: 'tome', id, lv: 1, wgt: 1.3 });
    const out = [];
    while (out.length < n && cands.length) {
      const tot = cands.reduce((s, c) => s + c.wgt, 0);
      let x = Math.random() * tot, i = 0;
      while ((x -= cands[i].wgt) > 0) i++;
      out.push(...cands.splice(i, 1));
    }
    if (!out.length) out.push({ kind: 'heal', id: 'heal', lv: 0 }, { kind: 'gold', id: 'gold', lv: 0 });
    return out;
  }

  boonChoices() {
    return Object.keys(BOONS).sort(() => Math.random() - 0.5).slice(0, 3).map(id => ({ kind: 'boon', id, lv: (this.p.boons[id] || 0) + 1 }));
  }

  applyChoice(c) {
    if (c.kind === 'weapon') this.addWeapon(c.id);
    else if (c.kind === 'tome') this.addTome(c.id);
    else if (c.kind === 'boon') this.addBoon(c.id);
    else if (c.kind === 'heal') this.p.hp = Math.min(this.p.maxHp, this.p.hp + this.p.maxHp * 0.3);
    else if (c.kind === 'gold') this.gold += Math.round((25 + this.zone.id * 10) * this.diff.gold);
    sfx('pick');
  }

  // ---------- Boucle ----------
  frame(now) {
    if (this.over) return;
    let dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (!this.paused) {
      dt *= this.slowmo;
      if (this.hitStop > 0) { this.hitStop -= dt; dt *= 0.06; } // arrêt sur image très bref (gros coups)
      this.update(dt);
      if (!this.over && !this.winning && !this.dying && !this.paused && this.p.ult >= 100 && this.autoUltReady()) this.useUlt();
      if (!this.over && !this.winning && !this.dying && !this.paused) {
        if (this.evolveReady()) this.evolve();
        else if (this.pending > 0 && this.evoFlash <= 0) this.levelUp();
      }
    }
    if (!this.over) this.render(this.paused ? 0 : dt);
    this.raf = requestAnimationFrame(t => this.frame(t));
  }

  levelUp() {
    this.paused = true; this.joy = null; this.look = null;
    this.pending--;
    const opts = this.choices();
    sfx('levelup'); buzz(20);
    this.onLevelUp(`Niveau ${this.p.level} !`, opts, c => {
      this.applyChoice(c);
      this.paused = false; this.last = performance.now();
    });
  }

  evolveReady() {
    const next = EVOLUTIONS[this.cls.id][this.p.evo + 1];
    return next && this.p.level >= next.lvl;
  }

  evolve() {
    const p = this.p;
    p.evo++;
    const ev = EVOLUTIONS[this.cls.id][p.evo];
    this.recalc();
    p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.5);
    p.ult = 100;
    this.addWeapon(this.cls.weapon);
    this.evoFlash = 1.2;
    p.inv = 2;
    this.burst(p.x, p.y, 40, 60, '#ffe48a');
    this.fx.push({ type: 'ring', x: p.x, y: p.y, r: 260, life: 0.8, max: 0.8, color: '#ffd54a' });
    for (const e of this.grid.query(p.x, p.y, 260)) if (!e.boss) { e.kx += (e.x - p.x) * 4; e.ky += (e.y - p.y) * 4; }
    this.banner(`<small>Votre champion évolue !</small>${esc(ev.name)}`, 2600, 'evo');
    this.emit('evolve', { evo: p.evo, x: p.x, y: p.y });
    this.renderEvo();
    sfx('evolve'); buzz(80);
  }

  update(dt) {
    const p = this.p;
    this.time += dt;
    this.hitSfxT -= dt; this.msgT -= dt;
    this.evoFlash = Math.max(0, this.evoFlash - dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    this.ultFlash = Math.max(0, this.ultFlash - dt);
    // déplacement dans le sens du doigt (caméra fixe, le haut de l'écran est toujours le nord)
    let jx = 0, jy = 0;
    if (this.joy) {
      const dx = this.joy.x - this.joy.ox, dy = this.joy.y - this.joy.oy, d = Math.hypot(dx, dy);
      if (d > 6) { const k = Math.min(1, d / 50); jx = dx / d * k; jy = dy / d * k; }
      if (d > 60) { this.joy.ox = this.joy.x - dx / d * 60; this.joy.oy = this.joy.y - dy / d * 60; }
    }
    const K = this.keys;
    if (K.has('arrowleft') || K.has('a') || K.has('q')) jx -= 1;
    if (K.has('arrowright') || K.has('d')) jx += 1;
    if (K.has('arrowup') || K.has('w') || K.has('z')) jy -= 1;
    if (K.has('arrowdown') || K.has('s')) jy += 1;
    const iy = this.joy ? this.joy.yaw : this.yaw;
    const fwx = -Math.sin(iy), fwy = -Math.cos(iy), rgx = Math.cos(iy), rgy = -Math.sin(iy);
    let mx = rgx * jx - fwx * jy, my = rgy * jx - fwy * jy;
    const ml = Math.hypot(mx, my);
    if (ml > 1) { mx /= ml; my /= ml; }
    if (ml > 0.05) p.face = { x: mx / ml, y: my / ml };
    p.x = Math.max(-HALF + 80, Math.min(HALF - 80, p.x + mx * p.speed * dt));
    p.y = Math.max(-HALF + 80, Math.min(HALF - 80, p.y + my * p.speed * dt));
    p.moving = ml > 0.05;
    if (p.h > 0 || p.vh > 0) { p.vh -= 1700 * dt; p.h = Math.max(0, p.h + p.vh * dt); if (p.h === 0) { p.vh = 0; this.emit('land', { x: p.x, y: p.y }); } }
    p.inv = Math.max(0, p.inv - dt);
    if (p.regen) p.hp = Math.min(p.maxHp, p.hp + p.regen * dt);

    this.spawn(dt);
    this.grid.clear();
    for (const e of this.enemies) this.grid.add(e);
    this.updateEnemies(dt);
    this.updateWeapons(dt);
    this.updateShots(dt);
    this.updateWaves(dt);
    this.updateBombs(dt);
    this.updatePickups(dt);
    this.updateInterest(dt);
    this.updatePet(dt);
    for (const f of this.fx) f.life -= dt;
    this.fx = this.fx.filter(f => f.life > 0);
    for (const t of this.texts) { t.life -= dt; t.z += 50 * dt; }
    this.texts = this.texts.filter(t => t.life > 0);
    for (const q of this.parts) { q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; q.vz -= 900 * dt; if (q.z < 0) { q.z = 0; q.vz *= -0.4; q.vx *= 0.7; q.vy *= 0.7; } }
    this.parts = this.parts.filter(q => q.life > 0);
    this.shake = Math.max(0, this.shake - dt * 30);
    this.enemies = this.enemies.filter(e => !e.dead);
    this.hud();
  }

  // ---------- Apparition ----------
  spawnPoint() {
    const p = this.p;
    for (let t = 0; t < 8; t++) {
      const a = Math.random() * TAU;
      const x = p.x + Math.cos(a) * SPAWN_R, y = p.y + Math.sin(a) * SPAWN_R;
      if (Math.abs(x) < HALF - 100 && Math.abs(y) < HALF - 100) return [x, y];
    }
    return [p.x - Math.sign(p.x || 1) * SPAWN_R, p.y];
  }

  spawn(dt) {
    const z = this.zone, t = this.time, mons = z.monsters, D = this.diff;
    if (!this.bossSpawned && t >= this.duration) return this.spawnBoss();
    // la cadence monte nettement avec le temps (zone 1 un peu plus douce)
    let rate = (0.9 + t / 18) * (1 + z.id * 0.12) * D.spawn;
    if (this.bossSpawned) rate *= this.boss && this.boss.enraged ? 0.5 : 0.32;
    this.spawnAcc += rate * dt;
    const pool = Math.min(3, Math.floor(t / (this.duration / 4)));
    while (this.spawnAcc >= 1) {
      this.spawnAcc--;
      if (this.enemies.length >= this.cap) { this.spawnAcc = Math.min(this.spawnAcc, 4); break; }
      const k = Math.floor(Math.random() * (pool + 1));
      const kk = Math.max(0, Math.min(3, k - (Math.random() < 0.3 ? 1 : 0)));
      // par petits groupes : les monstres arrivent en meutes
      if (this.pack > 0) { this.pack--; this.addEnemy(mons[kk], kk, { x: this.packX + rand(-40, 40), y: this.packY + rand(-40, 40) }); continue; }
      const e = this.addEnemy(mons[kk], kk);
      if (t > 30 && Math.random() < 0.45) { this.pack = 1 + Math.floor(Math.random() * (t > 100 ? 4 : 2)); this.packX = e.x; this.packY = e.y; }
    }
    if (t >= this.nextElite && !this.bossSpawned) {
      this.nextElite += this.eliteGap;
      const el = this.addEnemy(mons[4], 4, { elite: true });
      this.emit('elite', { e: el });
      this.banner(`<small>Un ennemi élite approche !</small><span class="tag elite">ÉLITE</span>${esc(el.name)}`, 1900);
      sfx('honk');
    }
    if (this.swarms.length && t >= this.swarms[0]) {
      this.swarms.shift();
      const wave = ++this.swarmN;
      this.emit('swarm', {});
      // hordes de plus en plus denses : un cercle (avec une brèche pour s'échapper), puis deux cercles de monstres différents
      const n = Math.round((10 + z.id * 2 + wave * 6) * (1 + (D.spawn - 1) * 0.8)), k = Math.min(pool, 3);
      const gap = Math.floor(Math.random() * n), gw = wave <= 2 ? 3 : 2;
      for (let i = 0; i < n && this.enemies.length < HARD_CAP; i++) {
        if ((i - gap + n) % n < gw) continue;
        const a = i / n * TAU, R = 430;
        this.addEnemy(mons[k], k, { x: this.p.x + Math.cos(a) * R, y: this.p.y + Math.sin(a) * R });
      }
      if (wave >= 3) {
        const n2 = Math.round(n * 0.6), k2 = Math.max(0, k - 1 - (wave & 1));
        for (let i = 0; i < n2 && this.enemies.length < HARD_CAP; i++) {
          const a = (i + 0.5) / n2 * TAU, R = 570;
          this.addEnemy(mons[k2], k2, { x: this.p.x + Math.cos(a) * R, y: this.p.y + Math.sin(a) * R });
        }
      }
      if (wave === 4 && (z.id > 0 || this.diffId > 0)) {
        const a = Math.random() * TAU, el = this.addEnemy(mons[4], 4, { elite: true, x: this.p.x + Math.cos(a) * 520, y: this.p.y + Math.sin(a) * 520 });
        this.emit('elite', { e: el });
      }
      this.banner(wave >= 3 ? 'Une énorme horde vous encercle !' : 'Une horde vous encercle !', 1500, 'warn');
      sfx('alarm');
    }
  }

  addEnemy(def, k, o = {}) {
    const z = this.zone, t = this.time, D = this.diff, B = BODY[def.body] || BODY0;
    let x = o.x, y = o.y;
    if (x == null) [x, y] = this.spawnPoint();
    const zm = 1 + z.id * 0.3;
    // progression dans le temps : PV, dégâts et vitesse montent nettement au fil de la partie
    let hp = def.hp * 0.3 * (1 + t / 110 + (t / 240) ** 2) * zm * D.hp * B.hp;
    let dmg = def.atk * 0.8 * (0.85 + t / 300 + (t / 260) ** 2) * (1 + z.id * 0.05) * D.dmg * B.dmg;
    let scale = 2.2, speed = (SPEED[def.body] || 60) * (1 + z.id * 0.04) * D.speed * (1 + Math.min(0.22, t / 800)) * rand(0.9, 1.1);
    if (o.elite) { hp *= 12; dmg *= 1.6; scale = 3.6; speed *= 0.9; }
    if (o.boss) { hp = Math.max(def.hp, 165) * BOSS_HP * (1 + z.id * 0.9) * D.boss; dmg = def.atk * 1.25 * (1 + z.id * 0.1) * D.dmg; scale = 8; speed *= 0.85; }
    if (o.gen) { hp *= 0.32; dmg *= 0.6; scale *= 0.62; speed *= 1.18; } // petit morceau d'un blob divisé
    const e = {
      def, k, x, y, hp, maxHp: hp, dmg, speed, scale, r: 7 * scale,
      elite: !!o.elite, boss: !!o.boss, ranged: def.ranged && !o.boss, shootT: rand(1.5, 3.5), fly: FLYERS[def.body] || 0,
      flash: 0, slow: 0, freeze: 0, kx: 0, ky: 0, hitT: {}, bob: Math.random() * TAU, dead: false, jumpH: 0,
      phase: 'chase', phaseT: 3, dashX: 0, dashY: 0, ang: 0, born: this.time,
      // difficulté : nom affiché (élites), pouvoirs, attaque spéciale en cours (act), recharge (cd)
      name: def.name, mods: null, knockMul: B.knock, act: null, cd: rand(1.5, 4.5), cdMul: 1, burrowed: false, gen: o.gen || 0,
      side: Math.random() < 0.5 ? 1 : -1, sideT: rand(0.5, 2), regen: 0, vamp: false, bomb: false, rage: 0, sumT: 0, enraged: false,
    };
    if (o.elite) this.makeElite(e);
    this.enemies.push(e);
    return e;
  }

  // élite : 1 pouvoir tiré au hasard (2 en Cauchemar), affiché dans son nom
  makeElite(e) {
    const keys = Object.keys(ELITE_MODS), mods = [];
    while (mods.length < Math.min(keys.length, this.diff.mods)) {
      const m = keys[Math.floor(Math.random() * keys.length)];
      if (!mods.includes(m)) mods.push(m);
    }
    e.mods = mods;
    e.name = e.def.name + ' ' + mods.map(m => (e.def.f ? ELITE_MODS[m].f : ELITE_MODS[m].name)).join(' et ');
    for (const m of mods) {
      if (m === 'rapide') { e.speed *= 1.55; e.cdMul = 0.6; }
      else if (m === 'blinde') { e.hp *= 1.8; e.maxHp = e.hp; e.knockMul = 0; e.scale *= 1.1; e.r = 7 * e.scale; }
      else if (m === 'vampirique') { e.vamp = true; e.regen = 0.012; }
      else if (m === 'explosif') e.bomb = true;
      else if (m === 'enrage') { e.dmg *= 1.35; e.rage = 1; }
      else if (m === 'invocateur') e.sumT = rand(2, 4);
    }
  }

  spawnBoss() {
    this.bossSpawned = true;
    const z = this.zone, def = z.boss || z.monsters[4];
    const a = Math.random() * TAU;
    this.boss = this.addEnemy(def, z.boss ? 5 : 4, { boss: true, x: this.p.x + Math.cos(a) * 380, y: this.p.y + Math.sin(a) * 380 });
    this.emit('boss', { e: this.boss });
    $('#bossbar').hidden = false;
    $('#bossName').innerHTML = `<span class="tag boss">BOSS</span>${esc(def.name)}`;
    this.banner(`<small>${esc(def.title || 'Le chef de la horde')}</small>${esc(def.name)}`, 2400, 'boss');
    this.shake = 10;
    sfx('boss'); music('boss'); buzz(60);
  }

  // ---------- Ennemis ----------
  updateEnemies(dt) {
    const p = this.p, near = this._near || (this._near = []), mv = this.mv;
    let acts = 0;
    for (const e of this.enemies) if (e.act && !e.dead && e.act.kind !== 'shoot' && e.act.kind !== 'volley') acts++;
    this.acts = acts;
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.bob += dt * 8;
      e.flash = Math.max(0, e.flash - dt);
      e.slow = Math.max(0, e.slow - dt);
      e.freeze = Math.max(0, e.freeze - dt);
      if (e.regen && e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * e.regen * dt);
      const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1, nx = dx / d, ny = dy / d;
      const fury = e.rage && e.hp < e.maxHp * 0.5 ? 1.3 : 1;
      const sp = e.speed * fury * (e.slow ? 0.5 : 1) * (e.freeze ? 0 : 1);
      if (e.boss) this.bossAI(e, dt, nx, ny, d, sp);
      else if (e.freeze) { mv.x = 0; mv.y = 0; }
      else this.enemyAI(e, dt, nx, ny, d, sp);
      let vx = mv.x, vy = mv.y;
      if (!e.burrowed) {
        this.grid.query(e.x, e.y, e.r * 2, near);
        for (const o of near) {
          if (o === e || o.burrowed) continue;
          const ox = e.x - o.x, oy = e.y - o.y, od = Math.hypot(ox, oy), min = (e.r + o.r) * 0.7;
          if (od > 0 && od < min) { const f = (min - od) / od * 0.5; vx += ox * f * 8; vy += oy * f * 8; }
        }
      }
      e.x += (vx + e.kx) * dt; e.y += (vy + e.ky) * dt;
      e.kx *= Math.pow(0.02, dt); e.ky *= Math.pow(0.02, dt);
      const a = e.act, dashing = !!a && a.stage === 1 && (a.kind === 'dash' || a.kind === 'strafe');
      if (!e.freeze) e.ang = dashing && a.kind === 'dash' ? Math.atan2(a.dx, a.dy) : Math.atan2(dx, dy);
      if (!e.boss && !a && d > SPAWN_R * 1.5) { const [nx2, ny2] = this.spawnPoint(); e.x = nx2; e.y = ny2; }
      // contact (on l'évite en sautant par-dessus les ennemis au sol)
      if (e.burrowed) continue;
      const overhead = !e.fly && p.h > 26 + (e.boss ? 60 : e.elite ? 16 : 0);
      if (d < e.r * 0.7 + p.r && !overhead) this.hurtPlayer(e.dmg * fury * (dashing ? 1.3 : 1), e);
    }
  }

  // annonce une attaque spéciale : les effets visuels peuvent l'afficher pendant `dur` secondes
  tele(e, kind, dur, x, y, dx, dy, R) {
    e.act = { kind, stage: 0, t: dur, dur, x, y, dx, dy, R, go: 0, v: 0 };
    this.emit('enemyTelegraph', { e, kind, x, y, dx, dy, dur, R });
    return e.act;
  }

  // cercle d'alerte au sol (rendu par les anneaux existants : il grandit jusqu'à l'impact)
  warnRing(x, y, R, dur, color = '#ff3a3a') {
    if (this.fx.length < 90) this.fx.push({ type: 'ring', x, y, r: R, life: dur, max: dur, color, warn: true });
  }

  endAct(e, cd) { e.act = null; e.cd = cd ?? rand(3.5, 6) * e.cdMul; }

  // comportements par type de corps
  enemyAI(e, dt, nx, ny, d, sp) {
    const mv = this.mv, p = this.p;
    if (e.act) return this.enemyAct(e, e.act, dt, nx, ny, d, sp);
    const body = e.def.body;
    let vx = nx * sp, vy = ny * sp;
    if (body === 'crab') { // les crabes filent de côté en zigzag
      e.sideT -= dt;
      if (e.sideT <= 0) { e.side = -e.side; e.sideT = rand(1.1, 2.2); }
      const lat = d < 420 ? 1 : 0.35;
      vx = (nx * 0.72 - ny * e.side * lat) * sp; vy = (ny * 0.72 + nx * e.side * lat) * sp;
    }
    if (e.ranged && d < 220) { vx = -nx * sp * 0.4; vy = -ny * sp * 0.4; }
    mv.x = vx; mv.y = vy;
    if (e.ranged) {
      e.shootT -= dt;
      if (e.shootT <= 0 && d < 430 && body === 'golem') { // obus de mortier : la zone d'impact est signalée
        if (this.acts >= 3 + this.zone.id + this.diffId * 2) { e.shootT = rand(0.4, 0.9); return; }
        this.tele(e, 'mortar', 0.5, p.x, p.y, nx, ny, 58);
        this.acts++;
        mv.x = 0; mv.y = 0;
        return;
      }
      if (e.shootT <= 0 && d < 430) {
        const volley = body === 'humanoid';
        this.tele(e, volley ? 'volley' : 'shoot', volley ? 0.55 : 0.4, e.x, e.y, nx, ny, 0);
        mv.x = 0; mv.y = 0;
        return;
      }
    }
    if (e.sumT) {
      e.sumT -= dt;
      if (e.sumT <= 0) {
        if (d < 650) { this.tele(e, 'summon', 0.7, e.x, e.y, 0, 0, 80); this.warnRing(e.x, e.y, 80, 0.7, '#c06aff'); return; }
        e.sumT = 1;
      }
    }
    e.cd -= dt;
    if (e.cd > 0) return;
    const maxActs = 3 + this.zone.id + this.diffId * 2 + (e.elite ? 2 : 0);
    if (this.acts >= maxActs) { e.cd = rand(0.3, 0.8); return; }
    switch (body) {
      case 'beast': case 'bird': { // élan : charge en ligne droite vers le joueur
        if (d < 100 || d > (body === 'bird' ? 340 : 310)) break;
        const len = d + 20, a = this.tele(e, 'dash', (body === 'bird' ? 0.55 : 0.65) * (e.cdMul < 1 ? 0.85 : 1), e.x, e.y, nx, ny, len);
        a.go = 0.42; a.v = Math.min(680, Math.max(300, len / a.go)) * (e.cdMul < 1 ? 1.15 : 1);
        this.acts++;
        return;
      }
      case 'humanoid': { // corps à corps : bond court (les élites chargent de plus loin)
        if (e.ranged) break;
        const max = e.elite ? 300 : 150;
        if (d < 50 || d > max) break;
        const len = d + 10, a = this.tele(e, 'dash', e.elite ? 0.65 : 0.5, e.x, e.y, nx, ny, len);
        a.go = e.elite ? 0.42 : 0.28; a.v = Math.min(620, Math.max(260, len / a.go));
        this.acts++;
        return;
      }
      case 'crab': { // pas chassé rapide sur le côté
        if (d < 60 || d > 260) break;
        let sx = -ny * e.side + nx * 0.5, sy = nx * e.side + ny * 0.5;
        const l = Math.hypot(sx, sy) || 1; sx /= l; sy /= l;
        const a = this.tele(e, 'strafe', 0.45, e.x, e.y, sx, sy, 130);
        a.go = 0.32; a.v = 400;
        this.acts++;
        return;
      }
      case 'ghost': { // se téléporte près du joueur (le point d'arrivée est signalé)
        if (d < 230 || d > 760) break;
        const ang = Math.atan2(p.face.y, p.face.x) + rand(-0.9, 0.9), R = e.ranged ? 230 : 75 + e.r;
        const lim = HALF - 120;
        const tx = Math.max(-lim, Math.min(lim, p.x + Math.cos(ang) * R)), ty = Math.max(-lim, Math.min(lim, p.y + Math.sin(ang) * R));
        this.tele(e, 'blink', 0.8, tx, ty, (p.x - tx) / R, (p.y - ty) / R, e.r * 1.4);
        this.warnRing(tx, ty, e.r * 1.6, 0.8, '#b07aff');
        this.acts++;
        return;
      }
      case 'worm': { // s'enfouit, file sous terre et ressurgit sous le joueur
        if (d < 100 || d > 650) break;
        e.act = { kind: 'burrow', stage: 0, t: 0.35, dur: 0.35, x: e.x, y: e.y, dx: nx, dy: ny, R: 55 + e.r * 0.6, go: 0, v: 0 };
        e.burrowed = true;
        this.emit('burrow', { e, x: e.x, y: e.y });
        this.burst(e.x, e.y, 8, 0, e.def.pal[1], 2);
        this.acts++;
        return;
      }
      case 'golem': { // les golems d'élite frappent le sol : onde de choc à sauter
        if (!e.elite || d > 125) break;
        this.tele(e, 'stomp', 0.8, e.x, e.y, 0, 0, 170 + e.r);
        this.warnRing(e.x, e.y, e.r * 1.6, 0.8, '#ff7a3a');
        this.acts++;
        return;
      }
    }
    e.cd = rand(0.3, 0.6);
  }

  enemyAct(e, a, dt, nx, ny, d, sp) {
    const mv = this.mv, p = this.p;
    a.t -= dt; mv.x = 0; mv.y = 0;
    if (a.stage === 0 && a.kind !== 'burrow' && (a.t * 10 | 0) % 2 === 0) e.flash = Math.max(e.flash, 0.04); // clignote pendant l'alerte
    switch (a.kind) {
      case 'dash': case 'strafe':
        if (a.stage === 0) { if (a.t <= 0) { a.stage = 1; a.t = a.go; this.emit('enemyDash', { e, dx: a.dx, dy: a.dy }); } }
        else if (a.stage === 1) { mv.x = a.dx * a.v; mv.y = a.dy * a.v; if (a.t <= 0) { a.stage = 2; a.t = a.kind === 'strafe' ? 0.3 : 0.6; } }
        else { mv.x = nx * sp * 0.25; mv.y = ny * sp * 0.25; if (a.t <= 0) this.endAct(e, a.kind === 'strafe' ? rand(2.8, 4.5) * e.cdMul : undefined); }
        return;
      case 'volley': case 'shoot':
        if (a.t <= 0) { this.enemyFire(e, a); this.endAct(e, e.cd); e.shootT = rand(2.6, 3.6); }
        return;
      case 'mortar':
        if (a.t <= 0) {
          const lead = p.moving ? 40 : 0;
          this.addBomb({ x: p.x + p.face.x * lead + rand(-20, 20), y: p.y + p.face.y * lead + rand(-20, 20), R: a.R, t: 1.1, dmg: e.dmg * 1.3, kind: 'mortar', e });
          this.burst(e.x, e.y, 6, 30, '#ffd0a0', 2);
          sfx('boom');
          this.endAct(e, e.cd); e.shootT = rand(3.2, 4.4);
        }
        return;
      case 'blink':
        if (a.stage === 0) {
          if (a.t <= 0) {
            const fx = e.x, fy = e.y;
            e.x = a.x; e.y = a.y; e.kx = 0; e.ky = 0;
            this.emit('blink', { e, fromX: fx, fromY: fy, x: a.x, y: a.y });
            this.burst(fx, fy, 8, e.fly, e.def.pal[2], 2); this.burst(a.x, a.y, 10, e.fly, e.def.pal[0], 2);
            a.stage = 1; a.t = 0.35;
          }
        } else if (a.t <= 0) this.endAct(e, rand(5.5, 8.5) * e.cdMul);
        return;
      case 'burrow':
        if (a.stage === 0) { e.jumpH = -170 * (1 - Math.max(0, a.t) / 0.35); if (a.t <= 0) { a.stage = 1; a.t = 0.7; } }
        else if (a.stage === 1) {
          e.jumpH = -170; mv.x = nx * 260; mv.y = ny * 260;
          if (a.t <= 0) {
            a.stage = 2; a.t = 0.85; a.x = p.x; a.y = p.y;
            this.emit('enemyTelegraph', { e, kind: 'emerge', x: a.x, y: a.y, dx: 0, dy: 0, dur: 0.85, R: a.R });
            this.warnRing(a.x, a.y, a.R, 0.85);
          }
        } else if (a.stage === 2) {
          e.jumpH = -170;
          const k = Math.min(1, dt * 6); e.x += (a.x - e.x) * k; e.y += (a.y - e.y) * k;
          if (a.t <= 0) {
            e.x = a.x; e.y = a.y; e.burrowed = false; e.jumpH = 0; e.born = this.time;
            const hit = Math.hypot(p.x - a.x, p.y - a.y) < a.R + p.r * 0.5 && p.h < 40;
            if (hit) this.hurtPlayer(e.dmg * 1.5, e);
            this.emit('emerge', { e, x: a.x, y: a.y, R: a.R, hit });
            this.burst(a.x, a.y, 16, 0, e.def.pal[1], 3);
            this.shake = Math.max(this.shake, 4);
            a.stage = 3; a.t = 0.5;
          }
        } else if (a.t <= 0) this.endAct(e, rand(6, 9) * e.cdMul);
        return;
      case 'stomp':
        if (a.t <= 0) {
          this.waves.push({ x: e.x, y: e.y, r: e.r, max: a.R, speed: 300, dmg: e.dmg * 0.9, hit: false });
          this.emit('enemyStomp', { e, x: e.x, y: e.y, R: a.R });
          this.burst(e.x, e.y, 16, 0, e.def.pal[1], 3);
          this.shake = Math.max(this.shake, 6); sfx('stomp');
          this.endAct(e, rand(4, 6) * e.cdMul);
        }
        return;
      case 'summon':
        if (a.t <= 0) {
          const mons = this.zone.monsters;
          for (let i = 0; i < 3 && this.enemies.length < HARD_CAP; i++) {
            const an = i / 3 * TAU + Math.random(), kk = Math.floor(Math.random() * 4);
            this.addEnemy(mons[kk], kk, { x: e.x + Math.cos(an) * 60, y: e.y + Math.sin(an) * 60 });
          }
          this.burst(e.x, e.y, 16, 20, '#c06aff', 3);
          e.sumT = rand(6, 8);
          this.endAct(e, e.cd);
        }
        return;
    }
    this.endAct(e);
  }

  // tirs : salves en éventail pour les humanoïdes à distance, tirs simples pour les autres
  enemyFire(e, a) {
    const p = this.p, volley = a.kind === 'volley';
    const n = volley ? 3 + (e.elite ? 2 : 0) + (this.diffId >= 2 ? 1 : 0) : 1 + (e.elite ? 1 : 0);
    const base = Math.atan2(p.y - e.y, p.x - e.x), spread = volley ? 0.22 : 0.14;
    for (let i = 0; i < n && this.eshots.length < 220; i++) {
      const ang = base + (i - (n - 1) / 2) * spread;
      this.eshots.push({ x: e.x, y: e.y, z: 20 + e.fly, vx: Math.cos(ang) * 165, vy: Math.sin(ang) * 165, r: 8, dmg: e.dmg * (volley ? 0.6 : 0.8), life: 4 });
    }
  }

  // ---------- Boss ----------
  bossAI(e, dt, nx, ny, d, sp) {
    const mv = this.mv, p = this.p, rage = e.enraged, cdm = rage ? 0.6 : 1;
    e.phaseT -= dt;
    mv.x = nx * sp; mv.y = ny * sp;
    if (e.ring2 > 0) { e.ring2 -= dt; if (e.ring2 <= 0) this.bossRing(e, 0.5); }
    switch (e.phase) {
      case 'chase':
        if (e.phaseT <= 0) this.bossPick(e, nx, ny, d);
        return;
      case 'aim':
        mv.x = 0; mv.y = 0;
        if ((e.phaseT * 10 | 0) % 2 === 0) e.flash = Math.max(e.flash, 0.04);
        if (e.phaseT <= 0) { e.phase = 'dash'; e.phaseT = 0.6; sfx('charge'); this.emit('bossDash', { e }); }
        return;
      case 'dash': {
        const v = 560 * (rage ? 1.2 : 1);
        mv.x = e.dashX * v; mv.y = e.dashY * v;
        if (e.phaseT <= 0) {
          if (e.dashes > 1) { e.dashes--; this.bossAim(e, nx, ny, 0.5); }
          else { e.phase = 'chase'; e.phaseT = rand(2.2, 3.4) * cdm; }
        }
        return;
      }
      case 'stomp': {
        const k = 1 - Math.max(0, e.phaseT) / 0.9;
        e.jumpH = Math.sin(k * Math.PI) * 140;
        mv.x *= 0.6; mv.y *= 0.6;
        if (e.phaseT <= 0) {
          e.jumpH = 0; e.phase = 'chase'; e.phaseT = rand(2.5, 3.8) * cdm;
          this.waves.push({ x: e.x, y: e.y, r: e.r, max: 540, speed: 330, dmg: e.dmg * 0.9, hit: false });
          if (rage) this.waves.push({ x: e.x, y: e.y, r: e.r * 0.5, max: 420, speed: 220, dmg: e.dmg * 0.9, hit: false }); // 2e onde, plus lente
          this.emit('bossStomp', { e, x: e.x, y: e.y });
          this.shake = 12; sfx('stomp'); buzz(50);
          this.burst(e.x, e.y, 30, 0, e.def.pal[1], 4);
        }
        return;
      }
      case 'ringW':
        mv.x = 0; mv.y = 0;
        if ((e.phaseT * 10 | 0) % 2 === 0) e.flash = Math.max(e.flash, 0.04);
        if (e.phaseT <= 0) { this.bossRing(e, 0); if (rage) e.ring2 = 0.45; e.phase = 'chase'; e.phaseT = rand(2.4, 3.6) * cdm; }
        return;
      case 'spiral': { // tourbillon de projectiles
        mv.x = 0; mv.y = 0;
        if (e.spinUp > 0) { e.spinUp -= dt; if ((e.spinUp * 10 | 0) % 2 === 0) e.flash = Math.max(e.flash, 0.04); return; }
        e.spT -= dt;
        while (e.spT <= 0) {
          e.spT += rage ? 0.075 : 0.1; e.spA += 0.33;
          const arms = rage ? 3 : 2;
          for (let i = 0; i < arms && this.eshots.length < 220; i++) {
            const an = e.spA + i / arms * TAU;
            this.eshots.push({ x: e.x, y: e.y, z: 40, vx: Math.cos(an) * 150, vy: Math.sin(an) * 150, r: 9, dmg: e.dmg * 0.55, life: 5 });
          }
        }
        if (e.phaseT <= 0) { e.phase = 'chase'; e.phaseT = rand(2.4, 3.4) * cdm; }
        return;
      }
      case 'rainW': // pluie de météores : le boss avance lentement pendant qu'ils tombent
        mv.x *= 0.5; mv.y *= 0.5;
        if (e.phaseT <= 0) { e.phase = 'chase'; e.phaseT = rand(1.8, 2.8) * cdm; }
        return;
      case 'blinkW':
        mv.x = 0; mv.y = 0;
        if (e.phaseT <= 0) {
          const fx = e.x, fy = e.y;
          e.x = e.bx; e.y = e.by; e.kx = 0; e.ky = 0;
          this.emit('blink', { e, fromX: fx, fromY: fy, x: e.x, y: e.y });
          this.burst(fx, fy, 24, 40, e.def.pal[2], 5); this.burst(e.x, e.y, 24, 40, e.def.pal[0], 5);
          this.bossRing(e, 0.25, 0.6);
          e.phase = 'chase'; e.phaseT = rand(2.2, 3.2) * cdm;
        }
        return;
      case 'burrow': { // le boss s'enfouit et ressurgit sous le joueur
        mv.x = 0; mv.y = 0;
        if (e.bst === 0) { e.jumpH = -260 * (1 - Math.max(0, e.phaseT) / 0.5); if (e.phaseT <= 0) { e.bst = 1; e.phaseT = 0.8; } }
        else if (e.bst === 1) {
          e.jumpH = -260; mv.x = nx * 380; mv.y = ny * 380;
          if (e.phaseT <= 0) {
            e.bst = 2; e.phaseT = 1; e.bx = p.x; e.by = p.y;
            this.emit('enemyTelegraph', { e, kind: 'emerge', x: e.bx, y: e.by, dx: 0, dy: 0, dur: 1, R: 125 });
            this.warnRing(e.bx, e.by, 125, 1);
          }
        } else {
          e.jumpH = -260;
          const k = Math.min(1, dt * 5); e.x += (e.bx - e.x) * k; e.y += (e.by - e.y) * k;
          if (e.phaseT <= 0) {
            e.x = e.bx; e.y = e.by; e.burrowed = false; e.jumpH = 0; e.born = this.time;
            const hit = Math.hypot(p.x - e.x, p.y - e.y) < 125 + p.r * 0.5 && p.h < 50;
            if (hit) this.hurtPlayer(e.dmg * 1.5, e);
            this.emit('emerge', { e, x: e.x, y: e.y, R: 125, hit });
            this.burst(e.x, e.y, 40, 0, e.def.pal[1], 6);
            this.shake = 12; sfx('stomp'); buzz(50);
            this.bossRing(e, 0, 0.7);
            e.phase = 'chase'; e.phaseT = rand(2.2, 3.2) * cdm;
          }
        }
        return;
      }
      case 'summonW':
        mv.x = 0; mv.y = 0;
        if (e.phaseT <= 0) { this.bossSummon(e); e.phase = 'chase'; e.phaseT = rand(3, 4.5) * cdm; }
        return;
    }
  }

  // choix de la prochaine attaque du boss (pondéré par son type, sans répéter la même)
  bossPick(e, nx, ny, d) {
    const B = e.def.body, easy = this.zone.id === 0 && this.diffId === 0, p = this.p;
    const W = this._bw || (this._bw = {});
    W.aim = 3; W.stomp = 2.4; W.ring = 2; W.summon = 1.2;
    W.rain = easy ? 0.8 : (B === 'golem' || B === 'worm' || B === 'beast') ? 2 : 1.1;
    W.spiral = easy ? 0 : (B === 'bird' || B === 'ghost' || B === 'worm') ? 2.2 : 0.8;
    W.blink = B === 'ghost' && d > 160 ? 2.6 : 0;
    W.burrow = B === 'worm' ? 2.6 : 0;
    if (e.last) W[e.last] *= 0.25;
    let tot = 0;
    for (const k in W) tot += W[k];
    let x = Math.random() * tot, pick = 'aim';
    for (const k in W) { x -= W[k]; if (x <= 0) { pick = k; break; } }
    e.last = pick;
    switch (pick) {
      case 'aim':
        e.dashes = e.enraged ? 3 : (B === 'beast' || B === 'bird') ? 2 : 1;
        this.bossAim(e, nx, ny, 0.9);
        break;
      case 'stomp':
        e.phase = 'stomp'; e.phaseT = 0.9;
        this.emit('bossJump', { e });
        this.emit('enemyTelegraph', { e, kind: 'stomp', x: e.x, y: e.y, dx: 0, dy: 0, dur: 0.9, R: 540 });
        this.msg('Sautez pour éviter l\'onde de choc !');
        break;
      case 'ring':
        e.phase = 'ringW'; e.phaseT = 0.6;
        this.emit('enemyTelegraph', { e, kind: 'ring', x: e.x, y: e.y, dx: 0, dy: 0, dur: 0.6, R: 0 });
        break;
      case 'spiral':
        e.phase = 'spiral'; e.phaseT = 2.6; e.spinUp = 0.55; e.spA = Math.random() * TAU; e.spT = 0;
        this.emit('enemyTelegraph', { e, kind: 'spiral', x: e.x, y: e.y, dx: 0, dy: 0, dur: 0.55, R: 0 });
        break;
      case 'rain': {
        e.phase = 'rainW'; e.phaseT = 1.7;
        const n = (e.enraged ? 8 : 5) + Math.min(3, this.zone.id), R = 62 + this.zone.id * 3;
        for (let i = 0; i < n; i++) {
          const r = i === 0 ? 0 : rand(60, 230), an = Math.random() * TAU;
          const lead = p.moving && i < 2 ? 80 : 0;
          this.addBomb({ x: p.x + p.face.x * lead + Math.cos(an) * r, y: p.y + p.face.y * lead + Math.sin(an) * r, R, t: 1.05 + i * 0.12, dmg: e.dmg * 0.9, kind: 'meteor', e });
        }
        this.msg('Des rochers tombent : sortez des cercles rouges !');
        break;
      }
      case 'blink': {
        const R = 130 + e.r, an = Math.atan2(-p.face.y, -p.face.x) + rand(-0.6, 0.6), lim = HALF - 150;
        e.bx = Math.max(-lim, Math.min(lim, p.x + Math.cos(an) * R)); e.by = Math.max(-lim, Math.min(lim, p.y + Math.sin(an) * R));
        e.phase = 'blinkW'; e.phaseT = 0.85;
        this.emit('enemyTelegraph', { e, kind: 'blink', x: e.bx, y: e.by, dx: 0, dy: 0, dur: 0.85, R: e.r });
        this.warnRing(e.bx, e.by, e.r * 1.3, 0.85, '#b07aff');
        break;
      }
      case 'burrow':
        e.phase = 'burrow'; e.bst = 0; e.phaseT = 0.5; e.burrowed = true;
        this.emit('burrow', { e, x: e.x, y: e.y });
        this.burst(e.x, e.y, 30, 0, e.def.pal[1], 5);
        break;
      case 'summon':
        e.phase = 'summonW'; e.phaseT = 0.6;
        this.emit('enemyTelegraph', { e, kind: 'summon', x: e.x, y: e.y, dx: 0, dy: 0, dur: 0.6, R: 90 });
        this.warnRing(e.x, e.y, 110, 0.6, '#c06aff');
        break;
    }
  }

  bossAim(e, nx, ny, dur) {
    e.phase = 'aim'; e.phaseT = dur; e.dashX = nx; e.dashY = ny;
    this.emit('bossAim', { e, dx: nx, dy: ny });
    this.emit('enemyTelegraph', { e, kind: 'charge', x: e.x, y: e.y, dx: nx, dy: ny, dur, R: 560 * 0.6 * (e.enraged ? 1.2 : 1) });
  }

  bossRing(e, off = 0, mul = 1) {
    const n = Math.round((14 + this.zone.id * 2) * (e.enraged ? 1.4 : 1) * mul), v = e.enraged ? 175 : 150;
    for (let i = 0; i < n && this.eshots.length < 220; i++) {
      const a = (i + off) / n * TAU;
      this.eshots.push({ x: e.x, y: e.y, z: 40, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: 9, dmg: e.dmg * 0.6, life: 5 });
    }
  }

  bossSummon(e) {
    const mons = this.zone.monsters, n = 5 + this.zone.id + (e.enraged ? 3 : 0);
    for (let i = 0; i < n && this.enemies.length < HARD_CAP; i++) {
      const a = i / n * TAU;
      this.addEnemy(mons[i % 4], i % 4, { x: e.x + Math.cos(a) * 90, y: e.y + Math.sin(a) * 90 });
    }
    if (e.enraged && !e.summonedElite && (this.zone.id > 0 || this.diffId > 0)) {
      e.summonedElite = true;
      const el = this.addEnemy(mons[4], 4, { elite: true, x: e.x + 120, y: e.y });
      this.emit('elite', { e: el });
    }
    this.burst(e.x, e.y, 20, 30, '#c06aff', 4);
  }

  // phase de rage sous 30 % de PV : plus rapide, attaques plus fréquentes et renforcées
  enrage(e) {
    e.enraged = true;
    e.speed *= 1.3;
    if (e.phase === 'chase') e.phaseT = Math.min(e.phaseT, 0.8);
    this.emit('bossEnrage', { e });
    this.banner(`<small>${esc(e.def.name)}</small>entre en rage !`, 1800, 'boss');
    this.fx.push({ type: 'ring', x: e.x, y: e.y, r: 260, life: 0.6, max: 0.6, color: '#ff3a3a' });
    this.burst(e.x, e.y, 40, 40, '#ff3a3a', 5);
    this.shake = 14; sfx('boss'); buzz(60);
  }

  // attaques de zone à retardement : le cercle d'alerte grandit jusqu'à l'impact
  addBomb(b) {
    this.bombs.push(b);
    this.emit('enemyTelegraph', { e: b.e || null, kind: b.kind, x: b.x, y: b.y, dx: 0, dy: 0, dur: b.t, R: b.R });
    this.warnRing(b.x, b.y, b.R, b.t, b.kind === 'explode' ? '#ff7a3a' : '#ff3a3a');
  }

  updateBombs(dt) {
    if (!this.bombs.length) return;
    const p = this.p;
    for (const b of this.bombs) {
      b.t -= dt;
      if (b.t > 0) continue;
      b.done = true;
      const hit = Math.hypot(p.x - b.x, p.y - b.y) < b.R + p.r * 0.5;
      if (hit) this.hurtPlayer(b.dmg, null);
      this.emit(b.kind === 'explode' ? 'explode' : 'impact', { e: b.e || null, x: b.x, y: b.y, R: b.R, hit });
      this.fx.push({ type: 'ring', x: b.x, y: b.y, r: b.R * 1.1, life: 0.3, max: 0.3, color: '#ffc87a' });
      this.burst(b.x, b.y, b.kind === 'explode' ? 26 : 12, 10, b.kind === 'explode' ? '#ff7a3a' : '#ffd0a0', 3);
      this.shake = Math.max(this.shake, b.kind === 'explode' ? 8 : 4);
      sfx('boom');
    }
    this.bombs = this.bombs.filter(b => !b.done);
  }

  updateWaves(dt) {
    const p = this.p;
    for (const w of this.waves) {
      w.r += w.speed * dt;
      const d = Math.hypot(p.x - w.x, p.y - w.y);
      if (!w.hit && Math.abs(d - w.r) < 26 && p.h < 14) { w.hit = true; this.hurtPlayer(w.dmg); }
    }
    this.waves = this.waves.filter(w => w.r < w.max);
  }

  hurtPlayer(dmg, src) {
    const p = this.p;
    if (p.inv > 0 || this.over || this.dying) return;
    if (save.pet === 'brambi' && src && !src.dead) this.hitEnemy(src, p.atk * 1.2, { noCrit: true, color: '#ff9a3a' });
    if (p.shieldHit) { p.shieldHit = 0; p.inv = 0.5; this.fx.push({ type: 'ring', x: p.x, y: p.y, r: 40, life: 0.4, max: 0.4, color: '#a8d8ff' }); sfx('block'); return; }
    const d = Math.max(1, Math.round(dmg * (1 - p.armor)));
    p.hp -= d;
    p.inv = 0.45;
    if (src && src.vamp && !src.dead) { // élite vampirique : se soigne en frappant
      const h = Math.round(src.maxHp * 0.12);
      src.hp = Math.min(src.maxHp, src.hp + h);
      this.text(src.x, src.y, src.r * 2.4 + src.fly, '+' + fmt(h), '#5ae87a', 1.1);
    }
    this.emit('hurt', { x: p.x, y: p.y, dmg: d, src: src || null });
    if (d >= p.maxHp * 0.08) this.hitStop = Math.max(this.hitStop, 0.05);
    this.shake = 6;
    this.hurtFlash = 0.25;
    this.text(p.x, p.y, 60, '-' + d, '#ff6a6a', 1.1);
    sfx('hurt'); buzz(30);
    if (p.hp <= 0) { p.hp = 0; this.die(); }
  }

  // ---------- Armes ----------
  nearest(maxD = 400, from = this.p) {
    const B = this.boss;
    if (B && !B.dead && !B.burrowed && dist2(B, from) < (maxD + B.r) ** 2) return B;
    let best = null, bd = maxD * maxD;
    for (const e of this.enemies) { if (e.dead || e.burrowed) continue; const d = dist2(e, from); if (d < bd) { bd = d; best = e; } }
    return best;
  }

  onScreen() {
    const p = this.p;
    return this.enemies.filter(e => !e.dead && !e.burrowed && dist2(e, p) < VIEW_R * VIEW_R);
  }

  updateWeapons(dt) {
    const p = this.p;
    for (const w of p.weapons) {
      const lv = w.lv, A = p.atk * p.dmgMul, area = p.area;
      w.t -= dt; w.a += dt;
      switch (w.id) {
        case 'beam': {
          if (w.t > 0) break;
          const t = this.nearest(360); if (!t) { w.t = 0.2; break; }
          w.t = (lv >= 5 ? 0.95 : 1.25) * p.haste;
          const ang = Math.atan2(t.y - p.y, t.x - p.x);
          const dmg = A * 1.8 * (lv >= 2 ? 1.3 : 1) * (lv >= 5 ? 1.4 : 1);
          const width = (lv >= 3 ? 30 : 18) * area, len = 320 * area;
          for (const a of lv >= 4 ? [ang, ang + Math.PI] : [ang]) this.beam(p.x, p.y, a, len, width, dmg);
          sfx('zap');
          break;
        }
        case 'arrows': {
          if (w.t > 0) break;
          const t = this.nearest(440); if (!t) { w.t = 0.2; break; }
          w.t = (lv >= 5 ? 0.4 : 0.52) * p.haste;
          const n = 1 + (lv >= 2) + (lv >= 5), ang = Math.atan2(t.y - p.y, t.x - p.x);
          for (let i = 0; i < n; i++) {
            const a = ang + (i - (n - 1) / 2) * 0.16;
            if (i === 0) sfx('pew');
            this.shots.push({ type: 'arrow', x: p.x, y: p.y, z: 30, vx: Math.cos(a) * 560, vy: Math.sin(a) * 560, r: 8, dmg: A * (lv >= 3 ? 1.3 : 1), pierce: lv >= 4 ? 2 : 0, life: 0.9, hit: new Set() });
          }
          break;
        }
        case 'sword': {
          if (w.t > 0) break;
          const R = (lv >= 3 ? 112 : 86) * area;
          const tg = this.nearest(R + 70);
          if (!tg) { w.t = 0.15; break; }
          w.t = (lv >= 5 ? 0.85 : 1.1) * p.haste;
          const dmg = A * 1.7 * (lv >= 2 ? 1.3 : 1) * (lv >= 5 ? 1.4 : 1);
          const base = Math.atan2(tg.y - p.y, tg.x - p.x);
          for (const a of lv >= 4 ? [base, base + Math.PI] : [base]) {
            this.fx.push({ type: 'slash', x: p.x, y: p.y, a, r: R, life: 0.22, max: 0.22 });
            for (const e of this.grid.query(p.x, p.y, R + 40)) {
              const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy);
              if (d > R + e.r) continue;
              let da = Math.atan2(dy, dx) - a; da = Math.atan2(Math.sin(da), Math.cos(da));
              if (Math.abs(da) < 1.25 || d < 26) this.hitEnemy(e, dmg, { knock: 260, kx: dx / (d || 1), ky: dy / (d || 1) });
            }
          }
          sfx('swish');
          break;
        }
        case 'orbs': {
          const n = 2 + (lv >= 2) + (lv >= 4) + (lv >= 5), R = (lv >= 4 ? 100 : 80) * area, dmg = A * 0.8 * (lv >= 3 ? 1.3 : 1) * (lv >= 5 ? 1.3 : 1);
          w.orbs = [];
          for (let i = 0; i < n; i++) {
            const a = w.a * 3 + i / n * TAU, ox = p.x + Math.cos(a) * R, oy = p.y + Math.sin(a) * R;
            w.orbs.push([ox, oy]);
            for (const e of this.grid.query(ox, oy, 40)) {
              if ((e.x - ox) ** 2 + (e.y - oy) ** 2 > (e.r + 12) ** 2) continue;
              if ((e.hitT.orb || 0) > this.time) continue;
              e.hitT.orb = this.time + 0.45;
              this.hitEnemy(e, dmg, { knock: 120, kx: (e.x - p.x) / R, ky: (e.y - p.y) / R });
            }
          }
          break;
        }
        case 'aura': {
          w.R = (64 + (lv >= 2 ? 16 : 0) + (lv >= 4 ? 20 : 0)) * area;
          if (w.t > 0) break;
          w.t = 0.5;
          const dmg = A * 0.55 * (lv >= 3 ? 1.4 : 1) * (lv >= 5 ? 1.5 : 1);
          for (const e of this.grid.query(p.x, p.y, w.R + 30)) if (dist2(e, p) < (w.R + e.r * 0.6) ** 2) this.hitEnemy(e, dmg, { quiet: true, color: '#ffb04a' });
          break;
        }
        case 'lightning': {
          if (w.t > 0) break;
          w.t = (lv >= 4 ? 1.4 : 1.8) * p.haste;
          const targets = this.onScreen();
          const n = 1 + (lv >= 2) + (lv >= 4) + (lv >= 5 ? 2 : 0), dmg = A * 2.3 * (lv >= 3 ? 1.3 : 1);
          for (let i = 0; i < n && targets.length; i++) {
            const t = targets.splice(Math.floor(Math.random() * targets.length), 1)[0];
            this.fx.push({ type: 'bolt', x: t.x, y: t.y, life: 0.25, max: 0.25 });
            for (const e of this.grid.query(t.x, t.y, 60 * area)) if (dist2(e, t) < (46 * area) ** 2) this.hitEnemy(e, dmg, {});
          }
          if (n) sfx('thunder');
          break;
        }
        case 'boomerang': {
          if (w.t > 0) break;
          const t = this.nearest(420);
          w.t = (lv >= 4 ? 1.6 : 2) * p.haste;
          const n = 1 + (lv >= 3) + (lv >= 5);
          const base = t ? Math.atan2(t.y - p.y, t.x - p.x) : Math.atan2(p.face.y, p.face.x);
          for (let i = 0; i < n; i++) {
            const a = base + i / n * TAU;
            this.shots.push({ type: 'boom', x: p.x, y: p.y, z: 26, vx: Math.cos(a) * 440, vy: Math.sin(a) * 440, r: (lv >= 4 ? 20 : 15) * area, dmg: A * 1.3 * (lv >= 2 ? 1.3 : 1) * (lv >= 5 ? 1.3 : 1), pierce: 999, life: 2.2, t0: 0, rehit: 0.35, spin: 0, id: Math.random() });
          }
          break;
        }
        case 'shrooms': {
          if (w.t > 0) break;
          w.t = (lv >= 5 ? 2 : 2.6) * p.haste;
          const n = 1 + (lv >= 2) + (lv >= 5);
          for (let i = 0; i < n; i++) {
            if (this.mines.length > 14) this.mines.shift();
            const a = Math.random() * TAU, r = rand(20, 80);
            this.mines.push({ x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r, life: 12, arm: 0.5, R: (lv >= 4 ? 80 : 58) * area, dmg: A * 3 * (lv >= 3 ? 1.4 : 1) });
          }
          break;
        }
        case 'frost': {
          if (w.t > 0) break;
          sfx('freeze');
          w.t = (lv >= 4 ? 2.4 : 3.2) * p.haste;
          const R = (lv >= 3 ? 150 : 115) * area, dmg = A * 1.2 * (lv >= 2 ? 1.3 : 1);
          this.fx.push({ type: 'ring', x: p.x, y: p.y, r: R, life: 0.45, max: 0.45, color: '#9ad8ff' });
          for (const e of this.grid.query(p.x, p.y, R + 30)) if (dist2(e, p) < (R + e.r * 0.5) ** 2) {
            this.hitEnemy(e, dmg, { color: '#9ad8ff' });
            e.slow = 2; if (lv >= 5 && !e.boss) e.freeze = 1;
          }
          break;
        }
        case 'daggers': {
          if (w.t > 0) break;
          w.t = (lv >= 5 ? 0.95 : 1.3) * p.haste;
          const n = 4 + (lv >= 2 ? 2 : 0) + (lv >= 4 ? 2 : 0);
          w.rot = (w.rot || 0) + 0.4;
          sfx('swish');
          for (let i = 0; i < n; i++) {
            const a = w.rot + i / n * TAU, sp = lv >= 5 ? 540 : 440;
            this.shots.push({ type: 'dagger', x: p.x, y: p.y, z: 26, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 8, dmg: A * 0.9 * (lv >= 3 ? 1.3 : 1), pierce: lv >= 5 ? 3 : 0, life: 0.75, hit: new Set() });
          }
          break;
        }
        case 'snowball': {
          if (w.t > 0) break;
          w.t = (lv >= 5 ? 1.7 : 2.2) * p.haste;
          const targets = this.onScreen();
          const n = 1 + (lv >= 4) + (lv >= 5);
          for (let i = 0; i < n; i++) {
            const t = targets.length ? targets[Math.floor(Math.random() * targets.length)] : null;
            const tx = t ? t.x : p.x + rand(-150, 150), ty = t ? t.y : p.y + rand(-150, 150);
            this.shots.push({ type: 'snow', x: p.x, y: p.y, sx: p.x, sy: p.y, tx, ty, t: 0, dur: 0.6, z: 0, r: 0, R: (lv >= 3 ? 76 : 56) * area, dmg: A * 2.4 * (lv >= 2 ? 1.3 : 1), life: 1 });
          }
          break;
        }
      }
    }
    for (const m of this.mines) {
      m.arm -= dt; m.life -= dt;
      if (m.arm > 0) continue;
      const hit = this.grid.query(m.x, m.y, 40).find(e => !e.dead && !e.burrowed && dist2(e, m) < (e.r + 12) ** 2);
      if (hit) {
        m.life = 0;
        this.fx.push({ type: 'ring', x: m.x, y: m.y, r: m.R, life: 0.35, max: 0.35, color: '#8aff5a' });
        this.burst(m.x, m.y, 14, 0, '#8aff5a');
        for (const e of this.grid.query(m.x, m.y, m.R + 30)) if (dist2(e, m) < (m.R + e.r * 0.5) ** 2) this.hitEnemy(e, m.dmg, { color: '#8aff5a' });
        sfx('boom');
      }
    }
    this.mines = this.mines.filter(m => m.life > 0);
  }

  beam(x, y, a, len, width, dmg) {
    const cx = Math.cos(a), cy = Math.sin(a);
    this.fx.push({ type: 'beam', x, y, a, len, w: width, life: 0.22, max: 0.22 });
    const mx = x + cx * len / 2, my = y + cy * len / 2;
    for (const e of this.grid.query(mx, my, len / 2 + 40)) {
      const dx = e.x - x, dy = e.y - y, along = dx * cx + dy * cy;
      if (along < -10 || along > len) continue;
      if (Math.abs(-dx * cy + dy * cx) < width / 2 + e.r * 0.7) this.hitEnemy(e, dmg, { knock: 60, kx: cx, ky: cy });
    }
  }

  updateShots(dt) {
    const p = this.p, near = [];
    for (const s of this.shots) {
      s.life -= dt;
      if (s.type === 'snow') {
        s.t += dt;
        const k = Math.min(1, s.t / s.dur);
        s.x = s.sx + (s.tx - s.sx) * k; s.y = s.sy + (s.ty - s.sy) * k; s.z = 20 + Math.sin(k * Math.PI) * 110;
        if (k >= 1) {
          s.life = 0;
          this.fx.push({ type: 'ring', x: s.tx, y: s.ty, r: s.R, life: 0.35, max: 0.35, color: '#e8f4ff' });
          this.burst(s.tx, s.ty, 12, 0, '#ffffff');
          for (const e of this.grid.query(s.tx, s.ty, s.R + 30)) if ((e.x - s.tx) ** 2 + (e.y - s.ty) ** 2 < (s.R + e.r * 0.5) ** 2) { this.hitEnemy(e, s.dmg, {}); e.slow = 1.5; }
          sfx('splat');
        }
        continue;
      }
      if (s.type === 'boom') {
        s.t0 += dt; s.spin += dt * 20;
        if (s.t0 > 0.55) {
          const dx = p.x - s.x, dy = p.y - s.y, d = Math.hypot(dx, dy) || 1;
          s.vx += dx / d * 1700 * dt; s.vy += dy / d * 1700 * dt;
          const v = Math.hypot(s.vx, s.vy); if (v > 540) { s.vx *= 540 / v; s.vy *= 540 / v; }
          if (d < 24) s.life = 0;
        }
      }
      s.x += s.vx * dt; s.y += s.vy * dt;
      for (const e of this.grid.query(s.x, s.y, s.r + 50, near)) {
        if (e.dead || e.burrowed) continue;
        if ((e.x - s.x) ** 2 + (e.y - s.y) ** 2 > (e.r + s.r) ** 2) continue;
        if (s.rehit) {
          const key = 'b' + s.id;
          if ((e.hitT[key] || 0) > this.time) continue;
          e.hitT[key] = this.time + s.rehit;
        } else {
          if (s.hit.has(e)) continue;
          s.hit.add(e);
        }
        const v = Math.hypot(s.vx, s.vy) || 1;
        this.hitEnemy(e, s.dmg, { knock: s.big ? 0 : 90, kx: s.vx / v, ky: s.vy / v });
        if (s.freeze && !e.boss) e.freeze = 2;
        if (s.pierce-- <= 0) { s.life = 0; break; }
      }
    }
    this.shots = this.shots.filter(s => s.life > 0);
    for (const s of this.eshots) {
      s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt;
      if (dist2(s, p) < (s.r + p.r) ** 2 && p.h < 50) { s.life = 0; this.hurtPlayer(s.dmg); }
    }
    this.eshots = this.eshots.filter(s => s.life > 0);
  }

  hitEnemy(e, dmg, o = {}) {
    if (e.dead || e.burrowed) return;
    const crit = !o.noCrit && Math.random() < this.p.crit;
    const d = Math.max(1, Math.round(dmg * (crit ? 2 : 1) * rand(0.92, 1.08)));
    e.hp -= d;
    e.flash = 0.09;
    this.emit('hit', { e, x: e.x, y: e.y, dmg: d, crit, color: o.color || null, quiet: !!o.quiet });
    if (o.knock && !e.boss) { const k = o.knock * e.knockMul * (e.elite ? 0.3 : 1); e.kx += (o.kx || 0) * k; e.ky += (o.ky || 0) * k; }
    if (this.texts.length < 60 && (!o.quiet || crit)) this.text(e.x + rand(-8, 8), e.y, e.r * 2.4 + e.fly, fmt(d), crit ? '#ffd54a' : (o.color || '#ffffff'), crit ? 1.4 : 1);
    if (!o.quiet) sfx(crit ? 'crit' : 'hit');
    if (e.boss && !e.enraged && e.hp > 0 && e.hp < e.maxHp * 0.3) this.enrage(e);
    if (e.hp <= 0) this.kill(e);
  }

  kill(e) {
    e.dead = true;
    this.emit('kill', { e, x: e.x, y: e.y });
    this.kills++;
    if (!e.boss) sfx('kill');
    const p = this.p, z = this.zone;
    p.ult = Math.min(100, p.ult + (e.boss ? 0 : e.elite ? 8 : e.gen ? 0.25 : 0.5) * (save.pet === 'voidy' ? 2 : 1));
    save.stats.seen[e.def.name] = (save.stats.seen[e.def.name] || 0) + 1;
    this.burst(e.x, e.y, e.boss ? 70 : e.elite ? 26 : 7, e.fly + 10, e.def.pal[0], e.scale);
    const xp = (1 + Math.floor(z.id / 2)) * (e.elite ? 15 : 1);
    this.pickups.push({ type: 'xp', x: e.x, y: e.y, v: xp, spin: Math.random() * 6 });
    const luck = this.base.gold * this.diff.gold;
    if (Math.random() < (e.elite ? 1 : 0.06)) this.pickups.push({ type: 'gold', x: e.x + rand(-10, 10), y: e.y + rand(-10, 10), v: Math.max(1, Math.round((1 + z.id * 0.5) * (e.elite ? 8 : 1) * luck)) });
    if (Math.random() < 0.0045 * (e.elite ? 8 : 1)) this.pickups.push({ type: 'heart', x: e.x, y: e.y });
    if (Math.random() < 0.003) this.pickups.push({ type: 'magnet', x: e.x, y: e.y });
    if (e.elite) { this.dropChest(e.x, e.y); sfx('honk'); this.hitStop = 0.08; }
    if (e.bomb) this.addBomb({ x: e.x, y: e.y, R: 115 + e.r * 0.5, t: 1, dmg: e.dmg * 1.6, kind: 'explode', e });
    if (e.def.body === 'blob' && !e.gen && !e.boss && !e.elite && this.enemies.length < HARD_CAP - 2) this.split(e);
    if (e.boss) this.win();
  }

  // un blob se divise en 2 petits à sa mort
  split(e) {
    this.emit('split', { e, x: e.x, y: e.y, n: 2 });
    const a0 = Math.random() * TAU;
    for (let i = 0; i < 2; i++) {
      const a = a0 + i * Math.PI;
      const c = this.addEnemy(e.def, e.k, { x: e.x + Math.cos(a) * 10, y: e.y + Math.sin(a) * 10, gen: 1 });
      c.born = this.time - 0.3; c.kx = Math.cos(a) * 170; c.ky = Math.sin(a) * 170; c.flash = 0.1;
    }
  }

  dropChest(x, y) {
    this.dropChests.push({ x, y, open: false });
  }

  burst(x, y, n, z = 0, color = '#ffffff', scale = 2) {
    for (let i = 0; i < n && this.parts.length < 650; i++) {
      const a = Math.random() * TAU, v = rand(60, 220) * Math.sqrt(scale / 2);
      this.parts.push({ x, y, z: z + rand(5, 20) * scale / 2, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: rand(150, 420), life: rand(0.5, 0.9), c: color, s: rand(0.7, 1.3) * Math.min(3, scale / 2) });
    }
  }

  text(x, y, z, txt, color, size = 1) { this.texts.push({ x, y, z, txt, color, size, life: 0.75 }); }
  msg(t) { if (this.msgT > 0) return; this.msgT = 3; this.banner(t, 2000, 'small'); }

  // ---------- Objets au sol ----------
  updatePickups(dt) {
    const p = this.p, R = p.magnet;
    for (const it of this.pickups) {
      const dx = p.x - it.x, dy = p.y - it.y, d = Math.hypot(dx, dy) || 1;
      if (it.pull || d < R) {
        it.pull = true;
        const sp = 400 + (it.pt = (it.pt || 0) + dt) * 900;
        it.x += dx / d * sp * dt; it.y += dy / d * sp * dt;
        if (d < 18) {
          it.taken = true;
          this.emit('pickup', { kind: it.type, x: it.x, y: it.y, v: it.v || 0 });
          if (it.type === 'xp') { this.gainXp(it.v); sfx('gem'); }
          if (it.type === 'gold') { this.gold += it.v; sfx('coin'); }
          if (it.type === 'heart') { const h = Math.round(p.maxHp * 0.25 * this.diff.heal); p.hp = Math.min(p.maxHp, p.hp + h); this.text(p.x, p.y, 70, '+' + h, '#5ae87a', 1.2); sfx('heal'); }
          if (it.type === 'magnet') { for (const o of this.pickups) if (o.type === 'xp') o.pull = true; sfx('boing'); sfx('loot'); }
        }
      }
    }
    this.pickups = this.pickups.filter(i => !i.taken);
    if (this.pickups.length > 600) {
      const far = this.pickups.filter(i => i.type === 'xp' && !i.pull).sort((a, b) => dist2(b, p) - dist2(a, p)).slice(0, 120);
      const sum = far.reduce((s, i) => s + i.v, 0);
      for (const f of far) f.taken = true;
      this.pickups = this.pickups.filter(i => !i.taken);
      if (far.length) this.pickups.push({ type: 'xp', x: far[0].x, y: far[0].y, v: sum, spin: 0 });
    }
  }

  updateInterest(dt) {
    const p = this.p;
    const tryOpen = (c, cost) => {
      if (c.open || dist2(c, p) > 46 * 46) return;
      if (cost && this.gold < cost) { this.msg(`Il faut ${cost} or pour ouvrir ce coffre.`); return; }
      if (cost) { this.gold -= cost; this.chestCost = Math.round(this.chestCost * 1.45); }
      c.open = true;
      this.openChest(c);
    };
    for (const c of this.chests) tryOpen(c, this.chestCost);
    for (const c of this.dropChests) tryOpen(c, 0);
    for (const s of this.shrines) {
      if (s.used) continue;
      const inside = dist2(s, p) < 58 * 58;
      s.charge = Math.max(0, Math.min(1, s.charge + (inside ? dt / 2.2 : -dt / 3)));
      if (inside && !s.told) { s.told = true; this.msg('Restez dans le cercle pour activer l\'autel'); }
      if (s.charge >= 1 && !this.paused) {
        s.used = true;
        this.emit('shrine', { x: s.x, y: s.y });
        sfx('shrine'); buzz(40);
        this.burst(s.x, s.y, 30, 40, '#4fd0ff');
        this.paused = true; this.joy = null; this.look = null;
        this.onLevelUp('Autel activé !', this.boonChoices(), c => { this.applyChoice(c); this.paused = false; this.last = performance.now(); }, 'Choisissez une bénédiction');
      }
    }
  }

  gainXp(v) {
    const p = this.p;
    p.xp += v * p.xpMul;
    while (p.xp >= p.xpNext) {
      p.xp -= p.xpNext;
      p.level++;
      p.xpNext = Math.round(5 + (p.level - 1) * 4 + Math.pow(p.level, 1.6));
      this.pending++;
      this.emit('levelup', { level: p.level });
    }
  }

  openChest(c) {
    this.emit('chest', { x: c.x, y: c.y });
    if (this.paused) { c.open = false; return; }
    this.paused = true; this.joy = null; this.look = null;
    const ch = this.choices(1)[0];
    const g = Math.round((10 + this.zone.id * 6) * this.base.gold * this.diff.gold);
    this.gold += g;
    sfx('chest');
    this.burst(c.x, c.y, 30, 20, '#ffd54a');
    this.onChest(ch, g, () => { this.applyChoice(ch); this.paused = false; this.last = performance.now(); });
  }

  // ---------- Familier ----------
  updatePet(dt) {
    if (!this.pet) return;
    const pet = this.pet, p = this.p;
    const tx = p.x - p.face.x * 40 + p.face.y * 20, ty = p.y - p.face.y * 40 - p.face.x * 20;
    pet.x += (tx - pet.x) * Math.min(1, dt * 5); pet.y += (ty - pet.y) * Math.min(1, dt * 5);
    this.petT -= dt;
    if (this.petT > 0) return;
    switch (pet.id) {
      case 'poro': this.petT = 4; if (p.hp < p.maxHp) { const h = Math.max(1, Math.round(p.maxHp * 0.015 * this.diff.heal)); p.hp = Math.min(p.maxHp, p.hp + h); this.text(p.x, p.y, 70, '+' + h, '#5ae87a'); } break;
      case 'herald': {
        this.petT = 1.1;
        const t = this.nearest(320, pet);
        if (t) { const a = Math.atan2(t.y - pet.y, t.x - pet.x); this.shots.push({ type: 'pet', x: pet.x, y: pet.y, z: 24, vx: Math.cos(a) * 400, vy: Math.sin(a) * 400, r: 8, dmg: p.atk * p.dmgMul * 0.9, pierce: 0, life: 1, hit: new Set() }); }
        break;
      }
      case 'wisp': this.petT = 12; p.shieldHit = 1; break;
      default: this.petT = 999;
    }
  }

  // ---------- Ultime ----------
  autoUltReady() {
    if (this.boss && !this.boss.dead && dist2(this.boss, this.p) < 300 * 300) return true;
    let n = 0;
    for (const e of this.enemies) if (!e.burrowed && dist2(e, this.p) < 240 * 240 && ++n >= 16) return true;
    return false;
  }

  useUlt() {
    const p = this.p;
    if (this.paused || this.over) return;
    if (p.ult < 100) { this.msg('Ultime en charge : battez des monstres pour le remplir.'); return; }
    p.ult = 0;
    save.stats.ults++;
    sfx('ult'); buzz(50);
    const A = p.atk * p.dmgMul * (1 + p.evo * 0.5);
    this.ultFlash = 0.5;
    if (this.cls.ult === 'nova') {
      const R = 300 * p.area;
      this.fx.push({ type: 'ring', x: p.x, y: p.y, r: R, life: 0.6, max: 0.6, color: '#ffd54a' });
      this.burst(p.x, p.y, 50, 20, '#ffe48a');
      for (const e of this.grid.query(p.x, p.y, R + 40)) if (dist2(e, p) < R * R) this.hitEnemy(e, A * 10, { knock: 400, kx: (e.x - p.x) / R, ky: (e.y - p.y) / R });
    } else if (this.cls.ult === 'crystal') {
      const t = this.nearest(650);
      const a = t ? Math.atan2(t.y - p.y, t.x - p.x) : Math.atan2(p.face.y, p.face.x);
      this.shots.push({ type: 'crystal', x: p.x, y: p.y, z: 30, vx: Math.cos(a) * 720, vy: Math.sin(a) * 720, r: 40, dmg: A * 9, pierce: 999, life: 1.4, hit: new Set(), freeze: true, big: true });
    } else {
      for (const e of this.onScreen()) { this.hitEnemy(e, A * 7, { knock: 200, kx: Math.sign(e.x - p.x), ky: Math.sign(e.y - p.y) }); this.fx.push({ type: 'bolt', x: e.x, y: e.y, life: 0.3, max: 0.3 }); }
      p.inv = 3;
      this.fx.push({ type: 'ring', x: p.x, y: p.y, r: 240, life: 0.5, max: 0.5, color: '#ffffff' });
    }
    this.emit('ult', { kind: this.cls.ult, x: p.x, y: p.y });
    this.banner(esc(ULTS[this.cls.ult].name), 900, 'ult');
  }

  // ---------- Fin ----------
  die() {
    if (this.over || this.dying) return;
    this.dying = true;
    this.emit('die', { x: this.p.x, y: this.p.y });
    this.paused = true; this.joy = null; this.look = null;
    duckMusic(true);
    sfx('lose'); buzz(80);
    setTimeout(() => this.onDefeat(!this.revived), 650);
  }

  revive() {
    const p = this.p;
    this.revived = true; this.dying = false;
    this.emit('revive', { x: p.x, y: p.y });
    p.hp = p.maxHp; p.inv = 3;
    this.eshots = []; this.waves = []; this.bombs = [];
    duckMusic(false);
    for (const e of this.grid.query(p.x, p.y, 280)) if (!e.boss) this.hitEnemy(e, 1e7, { quiet: true, noCrit: true }); else { e.kx = (e.x - p.x) * 3; e.ky = (e.y - p.y) * 3; }
    this.fx.push({ type: 'ring', x: p.x, y: p.y, r: 280, life: 0.7, max: 0.7, color: '#5ae87a' });
    sfx('revive');
    this.paused = false; this.last = performance.now();
  }

  win() {
    if (this.over || this.winning) return;
    this.winning = true;
    this.emit('win', {});
    this.slowmo = 0.25;
    stopMusic();
    sfx('win'); buzz(80);
    $('#bossbar').hidden = true;
    this.banner('VICTOIRE !', 1800, 'boss');
    for (const e of this.enemies) if (!e.boss) { e.dead = true; this.burst(e.x, e.y, 3, e.fly, '#ffffff'); }
    for (const it of this.pickups) it.pull = true;
    setTimeout(() => this.finish(true), 1800);
  }

  finish(win) {
    if (this.over) return;
    this.destroy();
    this.onEnd({
      win, diff: this.diffId, time: this.time, kills: this.kills, level: this.p.level, gold: this.gold, evo: this.p.evo,
      weapons: this.p.weapons.map(w => ({ ...w })), tomes: { ...this.p.tomes }, revived: this.revived,
    });
  }

  // ---------- Interface ----------
  hud() {
    const p = this.p;
    this.hudT = (this.hudT || 0) + 1;
    if (this.hudT % 3) return;
    const left = Math.max(0, this.duration - this.time);
    const tm = $('#timer'), lbl = $('#timerLbl');
    if (this.bossSpawned) { tm.textContent = 'BOSS'; lbl.textContent = 'Battez-le !'; tm.classList.add('boss'); }
    else { tm.textContent = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`; lbl.textContent = left < 20 ? 'Le boss arrive…' : 'Survivez !'; }
    $('#killsN').textContent = fmt(this.kills);
    $('#goldRun').textContent = fmt(this.gold);
    $('#xpFill').style.width = (p.xp / p.xpNext * 100) + '%';
    $('#lvl').textContent = 'Niv. ' + p.level;
    const ub = $('#ultBtn');
    ub.querySelector('circle').style.strokeDashoffset = 100.5 * (1 - p.ult / 100);
    ub.classList.toggle('ready', p.ult >= 100);
    if (this.boss && !this.boss.dead) {
      const b = $('#bossbar');
      b.querySelector('.fill').style.width = Math.max(0, this.boss.hp / this.boss.maxHp * 100) + '%';
      b.querySelector('span').textContent = fmt(Math.max(0, this.boss.hp));
    }
  }

  // ---------- Rendu ----------
  render(dt) { this.gfx.render(dt); }
}
