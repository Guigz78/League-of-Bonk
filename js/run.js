// Moteur temps réel façon « survivor » : déplacement, hordes, armes automatiques, boss.
import { CLASSES, WEAPONS, TOMES, ULTS, ZONE_TIME, PETS, MAX_WEAPONS, MAX_TOMES, MAX_LEVEL } from './data.js';
import { save, playerStats } from './save.js';
import { heroCanvas, iconCanvas, iconImg } from './art.js';
import { creatureCanvases, rng, hash } from './pixel.js';
import { propSprites, groundTile } from './scenery.js';
import { sfx, buzz } from './audio.js';
import { mount, $, esc, fmt } from './ui.js';

const TAU = Math.PI * 2;
const SPEED = { blob: 50, humanoid: 62, golem: 42, beast: 80, bird: 88, crab: 58, ghost: 66, worm: 54 };
const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const rand = (a, b) => a + Math.random() * (b - a);

// ---------- Grille spatiale pour les collisions ----------
class Grid {
  constructor(size) { this.s = size; this.m = new Map(); }
  clear() { this.m.clear(); }
  key(x, y) { return ((x / this.s) | 0) * 73856093 ^ ((y / this.s) | 0) * 19349663; }
  add(e) { const k = this.key(e.x, e.y); let a = this.m.get(k); if (!a) this.m.set(k, a = []); a.push(e); }
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
  constructor({ zone, onEnd, onPause, onLevelUp, onChest, onDefeat }) {
    this.zone = zone;
    this.cls = CLASSES[save.cls];
    this.onEnd = onEnd; this.onPause = onPause; this.onLevelUp = onLevelUp; this.onChest = onChest; this.onDefeat = onDefeat;
    this.duration = ZONE_TIME[zone.id];
    this.replay = save.zoneCleared[zone.id];
    const st = playerStats();
    this.base = st;
    this.p = {
      x: 0, y: 0, r: 12, face: { x: 1, y: 0 },
      maxHp: st.hp, hp: st.hp, atk: st.atk, crit: st.crit, regen: st.regen * 0.2,
      speed: 155 * st.speed, magnet: 95 * st.magnet * (save.pet === 'phenix' ? 1.4 : 1),
      armor: 0, xpMul: 1, area: 1, haste: 1, dmgMul: 1,
      inv: 0, shieldHit: 0, level: 1, xp: 0, xpNext: 4, ult: 0,
      weapons: [], tomes: {},
    };
    this.addWeapon(this.cls.weapon);
    this.enemies = []; this.shots = []; this.eshots = []; this.fx = []; this.pickups = []; this.texts = []; this.mines = [];
    this.grid = new Grid(64);
    this.time = 0; this.kills = 0; this.gold = 0; this.items = [];
    this.spawnAcc = 0; this.nextElite = 40; this.swarms = [0.3, 0.55, 0.8].map(f => f * this.duration);
    this.boss = null; this.bossSpawned = false;
    this.paused = false; this.over = false; this.revived = false;
    this.pending = 0; // niveaux en attente
    this.joy = null;
    this.keys = new Set();
    this.shake = 0;
    this.hitSfxT = 0;
    this.petT = 0; this.pet = save.pet ? { id: save.pet, x: -30, y: 10 } : null;
    this.slowmo = 1;
    this.sprites = new Map();
    this.prepareArt();
  }

  // ---------- Art ----------
  prepareArt() {
    const z = this.zone;
    this.hero = heroCanvas(this.cls.id, this.cls.colors);
    this.props = propSprites(z);
    this.tile = groundTile(z);
    this.icons = {};
    for (const n of ['gold', 'heart', 'ring', 'star']) this.icons[n] = iconCanvas(n);
    if (this.pet) { const p = PETS[this.pet.id]; this.petArt = creatureCanvases('pet-' + this.pet.id, p.body, p.pal).img; }
  }

  spriteFor(def, k, boss) {
    const key = def.name + (boss ? '!' : '');
    if (!this.sprites.has(key)) this.sprites.set(key, creatureCanvases(`${this.zone.id}-${k}-${def.name}`, def.body, def.pal, { boss }));
    return this.sprites.get(key);
  }

  // ---------- Écran ----------
  start() {
    const u = ULTS[this.cls.ult];
    mount(`<div class="run">
      <canvas id="cv"></canvas>
      <div class="hud">
        <div class="hud-top">
          <button class="icon-btn" id="pauseBtn" aria-label="Pause"><i class="pause-ic"></i></button>
          <div class="timer"><b id="timer">0:00</b><small id="timerLbl">Survivez !</small></div>
          <div class="hud-right"><span>${iconImg('skull', 16)}<b id="killsN">0</b></span><span>${iconImg('gold', 16)}<b id="goldRun">0</b></span></div>
        </div>
        <div class="xpbar"><div class="fill" id="xpFill"></div><span id="lvl">Niv. 1</span></div>
        <div class="loadout" id="loadout"></div>
        <div class="bossbar" id="bossbar" hidden><div class="bn" id="bossName"></div><div class="hpbar"><div class="fill"></div><span></span></div></div>
        <div class="banner" id="banner"></div>
        <div class="hint-bubble" id="hintBubble">Glissez le doigt pour vous déplacer.<br>Votre champion attaque tout seul !</div>
        <button class="ult-btn" id="ultBtn" aria-label="${esc(u.name)}">${iconImg(u.icon, 30)}<svg class="ring" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16"/></svg><small>${esc(u.name)}</small></button>
      </div>
    </div>`);
    this.cv = $('#cv');
    this.g = this.cv.getContext('2d');
    this.resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      this.vw = this.cv.clientWidth; this.vh = this.cv.clientHeight;
      this.cv.width = Math.round(this.vw * dpr); this.cv.height = Math.round(this.vh * dpr);
      this.dpr = dpr;
      this.groundPat = this.g.createPattern(this.tile, 'repeat');
    };
    this.resize();
    window.addEventListener('resize', this.resize);
    this.bindInput();
    $('#pauseBtn').addEventListener('click', () => this.pause());
    $('#ultBtn').addEventListener('click', () => this.useUlt());
    this.onVis = () => { if (document.hidden && !this.paused && !this.over) this.pause(); };
    document.addEventListener('visibilitychange', this.onVis);
    this.renderLoadout();
    this.banner(`<small>${esc(this.zone.name)}</small>Survivez ${Math.round(this.duration / 60)} minutes !`, 2200);
    this.last = performance.now();
    this.raf = requestAnimationFrame(t => this.frame(t));
    setTimeout(() => $('#hintBubble')?.classList.add('out'), save.stats.runs > 1 ? 2500 : 6000);
  }

  destroy() {
    this.over = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
    document.removeEventListener('visibilitychange', this.onVis);
    window.removeEventListener('keydown', this.kd); window.removeEventListener('keyup', this.ku);
  }

  bindInput() {
    const cv = this.cv;
    cv.addEventListener('pointerdown', e => {
      e.preventDefault();
      cv.setPointerCapture?.(e.pointerId);
      this.joy = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
      $('#hintBubble')?.classList.add('out');
    });
    cv.addEventListener('pointermove', e => { if (this.joy && e.pointerId === this.joy.id) { this.joy.x = e.clientX; this.joy.y = e.clientY; } });
    const up = e => { if (this.joy && e.pointerId === this.joy.id) this.joy = null; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    this.kd = e => { this.keys.add(e.key.toLowerCase()); if (e.key === ' ') this.useUlt(); if (e.key === 'Escape') this.pause(); };
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
    this.paused = true; this.joy = null;
    this.onPause(() => { this.paused = false; this.last = performance.now(); });
  }

  // ---------- Armes & tomes ----------
  addWeapon(id) {
    const w = this.p.weapons.find(x => x.id === id);
    if (w) w.lv++; else this.p.weapons.push({ id, lv: 1, t: 0.4, a: 0 });
    this.renderLoadout?.();
  }

  addTome(id) {
    const p = this.p;
    p.tomes[id] = (p.tomes[id] || 0) + 1;
    const applyAll = () => {
      const t = p.tomes;
      p.dmgMul = 1 + 0.15 * (t.power || 0);
      p.haste = Math.max(0.5, 1 - 0.1 * (t.haste || 0));
      p.speed = 155 * this.base.speed * (1 + 0.1 * (t.boots || 0));
      p.magnet = 95 * this.base.magnet * (1 + 0.35 * (t.magnet || 0)) * (save.pet === 'phenix' ? 1.4 : 1);
      p.crit = this.base.crit + 0.07 * (t.crit || 0);
      p.armor = Math.min(0.6, 0.08 * (t.armor || 0));
      p.xpMul = 1 + 0.15 * (t.wisdom || 0);
      p.area = 1 + 0.12 * (t.area || 0);
      const old = p.maxHp;
      p.maxHp = Math.round(this.base.hp * (1 + 0.2 * (t.vital || 0)));
      if (p.maxHp > old) p.hp += p.maxHp - old;
    };
    applyAll();
    this.renderLoadout();
  }

  renderLoadout() {
    const el = $('#loadout'); if (!el) return;
    const p = this.p;
    el.innerHTML = p.weapons.map(w => `<span class="lo w">${iconImg(WEAPONS[w.id].icon, 18)}<b>${w.lv}</b></span>`).join('') +
      Object.entries(p.tomes).map(([id, lv]) => `<span class="lo t">${iconImg(TOMES[id].icon, 18)}<b>${lv}</b></span>`).join('');
  }

  // 3 propositions au passage de niveau
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

  applyChoice(c) {
    if (c.kind === 'weapon') this.addWeapon(c.id);
    else if (c.kind === 'tome') this.addTome(c.id);
    else if (c.kind === 'heal') this.p.hp = Math.min(this.p.maxHp, this.p.hp + this.p.maxHp * 0.3);
    else if (c.kind === 'gold') this.addGold(25 + this.zone.id * 10);
    sfx('loot');
  }

  // ---------- Boucle ----------
  frame(now) {
    if (this.over) return;
    let dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (!this.paused) {
      dt *= this.slowmo;
      this.update(dt);
      if (this.pending > 0 && !this.over && !this.winning && !this.dying) this.levelUp();
    }
    this.render();
    this.raf = requestAnimationFrame(t => this.frame(t));
  }

  levelUp() {
    this.paused = true; this.joy = null;
    this.pending--;
    const opts = this.choices();
    sfx('loot'); buzz(20);
    this.onLevelUp(this.p.level, opts, c => {
      this.applyChoice(c);
      this.paused = false; this.last = performance.now();
    });
  }

  update(dt) {
    const p = this.p;
    this.time += dt;
    this.hitSfxT -= dt;
    // déplacement
    let mx = 0, my = 0;
    if (this.joy) {
      const dx = this.joy.x - this.joy.ox, dy = this.joy.y - this.joy.oy, d = Math.hypot(dx, dy);
      if (d > 6) { const k = Math.min(1, d / 50); mx = dx / d * k; my = dy / d * k; }
      if (d > 60) { this.joy.ox = this.joy.x - dx / d * 60; this.joy.oy = this.joy.y - dy / d * 60; }
    }
    const K = this.keys;
    if (K.has('arrowleft') || K.has('a') || K.has('q')) mx -= 1;
    if (K.has('arrowright') || K.has('d')) mx += 1;
    if (K.has('arrowup') || K.has('w') || K.has('z')) my -= 1;
    if (K.has('arrowdown') || K.has('s')) my += 1;
    const ml = Math.hypot(mx, my);
    if (ml > 1) { mx /= ml; my /= ml; }
    if (ml > 0.05) { p.face = { x: mx / (ml || 1), y: my / (ml || 1) }; }
    p.x += mx * p.speed * dt; p.y += my * p.speed * dt;
    p.moving = ml > 0.05;
    p.inv = Math.max(0, p.inv - dt);
    if (p.regen) p.hp = Math.min(p.maxHp, p.hp + p.regen * dt);

    this.spawn(dt);

    // grille
    this.grid.clear();
    for (const e of this.enemies) this.grid.add(e);

    this.updateEnemies(dt);
    this.updateWeapons(dt);
    this.updateShots(dt);
    this.updatePickups(dt);
    this.updatePet(dt);
    for (const f of this.fx) f.life -= dt;
    this.fx = this.fx.filter(f => f.life > 0);
    for (const t of this.texts) { t.life -= dt; t.y -= 40 * dt; }
    this.texts = this.texts.filter(t => t.life > 0);
    this.shake = Math.max(0, this.shake - dt * 30);
    this.enemies = this.enemies.filter(e => !e.dead);
    this.hud();
  }

  // ---------- Apparition des monstres ----------
  spawn(dt) {
    const z = this.zone, t = this.time, mons = z.monsters;
    if (!this.bossSpawned && t >= this.duration) return this.spawnBoss();
    const cap = 150 + z.id * 12;
    let rate = (0.9 + t / 22) * (1 + z.id * 0.12);
    if (this.bossSpawned) rate *= 0.35;
    this.spawnAcc += rate * dt;
    const pool = Math.min(3, Math.floor(t / (this.duration / 4)));
    while (this.spawnAcc >= 1) {
      this.spawnAcc--;
      if (this.enemies.length >= cap) break;
      const k = Math.floor(Math.random() * (pool + 1));
      this.addEnemy(mons[Math.max(0, Math.min(3, k - (Math.random() < 0.3 ? 1 : 0)))], k);
    }
    if (t >= this.nextElite && !this.bossSpawned) {
      this.nextElite += 45;
      this.addEnemy(mons[4], 4, { elite: true });
      this.banner('Un ennemi <span class="tag elite">ÉLITE</span> approche !', 1600);
    }
    if (this.swarms.length && t >= this.swarms[0]) {
      this.swarms.shift();
      const n = 16 + z.id * 2, def = mons[Math.min(pool, 3)];
      for (let i = 0; i < n; i++) {
        const a = i / n * TAU, R = Math.max(this.vw, this.vh) * 0.62;
        this.addEnemy(def, Math.min(pool, 3), { x: this.p.x + Math.cos(a) * R, y: this.p.y + Math.sin(a) * R });
      }
      this.banner('Une horde vous encercle !', 1500, 'warn');
      sfx('hurt');
    }
  }

  addEnemy(def, k, o = {}) {
    const z = this.zone, t = this.time;
    const tier = this.replay ? 1.2 : 1;
    let x = o.x, y = o.y;
    if (x == null) {
      const a = Math.random() * TAU, R = Math.hypot(this.vw, this.vh) / 2 + 40;
      x = this.p.x + Math.cos(a) * R; y = this.p.y + Math.sin(a) * R;
    }
    const spr = this.spriteFor(def, k, !!o.boss);
    let hp = def.hp * 0.3 * (1 + t / 150) * tier;
    let dmg = def.atk * 0.7 * tier;
    let scale = 2, speed = (SPEED[def.body] || 60) * (1 + z.id * 0.04) * rand(0.9, 1.1);
    if (o.elite) { hp *= 10; dmg *= 1.5; scale = 3.2; speed *= 0.85; }
    if (o.boss) { hp = def.hp * 8 * tier; dmg = def.atk * 1.1 * tier; scale = 5; speed *= 0.8; }
    const e = {
      def, k, x, y, hp, maxHp: hp, dmg, speed, scale, r: 7 * scale, spr,
      elite: !!o.elite, boss: !!o.boss, ranged: def.ranged && !o.boss, shootT: rand(1, 3),
      flash: 0, slow: 0, freeze: 0, kx: 0, ky: 0, hitT: {}, bob: Math.random() * TAU, dead: false,
      phase: 'chase', phaseT: 3, dashX: 0, dashY: 0,
    };
    this.enemies.push(e);
    return e;
  }

  spawnBoss() {
    this.bossSpawned = true;
    const z = this.zone;
    const def = z.boss || z.monsters[4];
    const a = Math.random() * TAU;
    this.boss = this.addEnemy(def, z.boss ? 5 : 4, { boss: true, x: this.p.x + Math.cos(a) * 320, y: this.p.y + Math.sin(a) * 320 });
    $('#bossbar').hidden = false;
    $('#bossName').innerHTML = `<span class="tag boss">BOSS</span>${esc(def.name)}`;
    this.banner(`<small>${esc(def.title || 'Le chef de la horde')}</small>${esc(def.name)}`, 2400, 'boss');
    sfx('ult'); buzz(60);
  }

  // ---------- Ennemis ----------
  updateEnemies(dt) {
    const p = this.p, near = [];
    for (const e of this.enemies) {
      e.bob += dt * 8;
      e.flash = Math.max(0, e.flash - dt);
      e.slow = Math.max(0, e.slow - dt);
      e.freeze = Math.max(0, e.freeze - dt);
      const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1;
      let sp = e.speed * (e.slow ? 0.5 : 1) * (e.freeze ? 0 : 1);
      let vx = dx / d * sp, vy = dy / d * sp;
      if (e.boss) [vx, vy] = this.bossAI(e, dt, dx / d, dy / d, d, sp);
      else if (e.ranged && d < 210) {
        vx = -vx * 0.4; vy = -vy * 0.4;
      }
      if (e.ranged && !e.freeze) {
        e.shootT -= dt;
        if (e.shootT <= 0 && d < 380) {
          e.shootT = rand(2.2, 3.2);
          this.eshots.push({ x: e.x, y: e.y, vx: dx / d * 150, vy: dy / d * 150, r: 6, dmg: e.dmg * 0.9, life: 4 });
        }
      }
      // séparation légère
      this.grid.query(e.x, e.y, e.r * 2, near);
      for (const o of near) {
        if (o === e) continue;
        const ox = e.x - o.x, oy = e.y - o.y, od = Math.hypot(ox, oy), min = (e.r + o.r) * 0.75;
        if (od > 0 && od < min) { const f = (min - od) / od * 0.5; vx += ox * f * 8; vy += oy * f * 8; }
      }
      e.x += (vx + e.kx) * dt; e.y += (vy + e.ky) * dt;
      e.kx *= Math.pow(0.02, dt); e.ky *= Math.pow(0.02, dt);
      // éloigné ? on le replace devant le joueur
      if (!e.boss && d > Math.hypot(this.vw, this.vh) * 0.9) {
        const a = Math.atan2(p.face.y, p.face.x) + rand(-0.8, 0.8), R = Math.hypot(this.vw, this.vh) / 2 + 30;
        e.x = p.x + Math.cos(a) * R; e.y = p.y + Math.sin(a) * R;
      }
      // contact
      if (d < e.r * 0.8 + p.r) this.hurtPlayer(e.dmg, e);
    }
  }

  bossAI(e, dt, nx, ny, d, sp) {
    e.phaseT -= dt;
    if (e.phase === 'chase') {
      if (e.phaseT <= 0) {
        const r = Math.random();
        e.phase = r < 0.4 ? 'aim' : r < 0.7 ? 'ring' : 'summon';
        e.phaseT = e.phase === 'aim' ? 0.8 : 0.4;
        if (e.phase === 'aim') { e.dashX = nx; e.dashY = ny; }
      }
      return [nx * sp, ny * sp];
    }
    if (e.phase === 'aim') {
      if (e.phaseT <= 0) { e.phase = 'dash'; e.phaseT = 0.55; sfx('hurt'); }
      return [0, 0];
    }
    if (e.phase === 'dash') {
      if (e.phaseT <= 0) { e.phase = 'chase'; e.phaseT = rand(2.5, 4); }
      return [e.dashX * 520, e.dashY * 520];
    }
    if (e.phase === 'ring') {
      const n = 12 + this.zone.id * 2;
      for (let i = 0; i < n; i++) { const a = i / n * TAU; this.eshots.push({ x: e.x, y: e.y, vx: Math.cos(a) * 140, vy: Math.sin(a) * 140, r: 7, dmg: e.dmg * 0.6, life: 5 }); }
      e.phase = 'chase'; e.phaseT = rand(2.5, 4);
      return [0, 0];
    }
    if (e.phase === 'summon') {
      const mons = this.zone.monsters;
      for (let i = 0; i < 5 + this.zone.id; i++) { const a = i / 6 * TAU; this.addEnemy(mons[i % 4], i % 4, { x: e.x + Math.cos(a) * 60, y: e.y + Math.sin(a) * 60 }); }
      e.phase = 'chase'; e.phaseT = rand(3, 4.5);
      return [0, 0];
    }
    return [nx * sp, ny * sp];
  }

  hurtPlayer(dmg, src) {
    const p = this.p;
    if (p.inv > 0 || this.over) return;
    if (save.pet === 'brambi' && src && !src.dead) this.hitEnemy(src, p.atk * 1.2, { noCrit: true, color: '#ff9a3a' });
    if (p.shieldHit) { p.shieldHit = 0; p.inv = 0.5; this.fx.push({ type: 'ring', x: p.x, y: p.y, r: 30, life: 0.4, max: 0.4, color: '#a8d8ff' }); sfx('block'); return; }
    const d = Math.max(1, Math.round(dmg * (1 - p.armor)));
    p.hp -= d;
    p.inv = 0.5;
    this.shake = 6;
    this.text(p.x, p.y - 26, '-' + d, '#ff6a6a', 1);
    sfx('hurt'); buzz(30);
    if (p.hp <= 0) { p.hp = 0; this.die(); }
  }

  // ---------- Armes ----------
  nearest(maxD = 400, from = this.p) {
    // le boss est visé en priorité s'il est à portée
    if (this.boss && !this.boss.dead && dist2(this.boss, from) < (maxD + this.boss.r) ** 2) return this.boss;
    let best = null, bd = maxD * maxD;
    for (const e of this.enemies) { if (e.dead) continue; const d = dist2(e, from); if (d < bd) { bd = d; best = e; } }
    return best;
  }

  onScreen() {
    const p = this.p, hw = this.vw / 2 + 20, hh = this.vh / 2 + 20;
    return this.enemies.filter(e => !e.dead && Math.abs(e.x - p.x) < hw && Math.abs(e.y - p.y) < hh);
  }

  updateWeapons(dt) {
    const p = this.p;
    for (const w of p.weapons) {
      const lv = w.lv, A = p.atk * p.dmgMul, area = p.area;
      w.t -= dt;
      w.a += dt;
      switch (w.id) {
        case 'beam': {
          if (w.t > 0) break;
          const t = this.nearest(340); if (!t) { w.t = 0.2; break; }
          w.t = (lv >= 5 ? 1.05 : 1.45) * p.haste;
          const ang = Math.atan2(t.y - p.y, t.x - p.x);
          const dmg = A * 1.8 * (lv >= 2 ? 1.3 : 1) * (lv >= 5 ? 1.4 : 1);
          const width = (lv >= 3 ? 30 : 18) * area, len = 300 * area;
          const dirs = lv >= 4 ? [ang, ang + Math.PI] : [ang];
          for (const a of dirs) this.beam(p.x, p.y, a, len, width, dmg);
          sfx('perfect');
          break;
        }
        case 'arrows': {
          if (w.t > 0) break;
          const t = this.nearest(420); if (!t) { w.t = 0.2; break; }
          w.t = (lv >= 5 ? 0.42 : 0.58) * p.haste;
          const n = 1 + (lv >= 2) + (lv >= 5);
          const ang = Math.atan2(t.y - p.y, t.x - p.x);
          for (let i = 0; i < n; i++) {
            const a = ang + (i - (n - 1) / 2) * 0.16;
            this.shots.push({ type: 'arrow', x: p.x, y: p.y, vx: Math.cos(a) * 520, vy: Math.sin(a) * 520, r: 6, dmg: A * (lv >= 3 ? 1.3 : 1), pierce: lv >= 4 ? 2 : 0, life: 0.9, hit: new Set() });
          }
          break;
        }
        case 'sword': {
          if (w.t > 0) break;
          const R = (lv >= 3 ? 108 : 82) * area;
          w.t = (lv >= 5 ? 0.85 : 1.1) * p.haste;
          const dmg = A * 1.7 * (lv >= 2 ? 1.3 : 1) * (lv >= 5 ? 1.4 : 1);
          const tg = this.nearest(R + 70);
          if (!tg) { w.t = 0.15; break; }
          const base = Math.atan2(tg.y - p.y, tg.x - p.x);
          const dirs = lv >= 4 ? [base, base + Math.PI] : [base];
          for (const a of dirs) {
            this.fx.push({ type: 'slash', x: p.x, y: p.y, a, r: R, life: 0.22, max: 0.22 });
            for (const e of this.grid.query(p.x, p.y, R + 30)) {
              const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy);
              if (d > R + e.r) continue;
              let da = Math.atan2(dy, dx) - a; da = Math.atan2(Math.sin(da), Math.cos(da));
              if (Math.abs(da) < 1.25 || d < 26) this.hitEnemy(e, dmg, { knock: 260, kx: dx / (d || 1), ky: dy / (d || 1) });
            }
          }
          sfx('bonk');
          break;
        }
        case 'orbs': {
          const n = 2 + (lv >= 2) + (lv >= 4) + (lv >= 5), R = (lv >= 4 ? 95 : 76) * area, dmg = A * 0.8 * (lv >= 3 ? 1.3 : 1) * (lv >= 5 ? 1.3 : 1);
          w.orbs = [];
          for (let i = 0; i < n; i++) {
            const a = w.a * 3 + i / n * TAU, ox = p.x + Math.cos(a) * R, oy = p.y + Math.sin(a) * R;
            w.orbs.push([ox, oy]);
            for (const e of this.grid.query(ox, oy, 30)) {
              if ((e.x - ox) ** 2 + (e.y - oy) ** 2 > (e.r + 10) ** 2) continue;
              if ((e.hitT.orb || 0) > this.time) continue;
              e.hitT.orb = this.time + 0.45;
              this.hitEnemy(e, dmg, { knock: 120, kx: (e.x - p.x) / R, ky: (e.y - p.y) / R });
            }
          }
          break;
        }
        case 'aura': {
          w.R = (60 + (lv >= 2 ? 15 : 0) + (lv >= 4 ? 19 : 0)) * area;
          if (w.t > 0) break;
          w.t = 0.5;
          const dmg = A * 0.55 * (lv >= 3 ? 1.4 : 1) * (lv >= 5 ? 1.5 : 1);
          for (const e of this.grid.query(p.x, p.y, w.R + 20)) if (dist2(e, p) < (w.R + e.r * 0.6) ** 2) this.hitEnemy(e, dmg, { quiet: true, color: '#ffb04a' });
          break;
        }
        case 'lightning': {
          if (w.t > 0) break;
          w.t = (lv >= 4 ? 1.4 : 1.8) * p.haste;
          const targets = this.onScreen();
          const n = 1 + (lv >= 2) + (lv >= 4) + (lv >= 5 ? 2 : 0), dmg = A * 2.3 * (lv >= 3 ? 1.3 : 1);
          for (let i = 0; i < n && targets.length; i++) {
            const t = targets.splice(Math.floor(Math.random() * targets.length), 1)[0];
            this.fx.push({ type: 'bolt', x: t.x, y: t.y, life: 0.25, max: 0.25, seed: Math.random() });
            for (const e of this.grid.query(t.x, t.y, 50 * area)) if (dist2(e, t) < (42 * area) ** 2) this.hitEnemy(e, dmg, {});
          }
          if (n) sfx('perfect');
          break;
        }
        case 'boomerang': {
          if (w.t > 0) break;
          const t = this.nearest(400);
          w.t = (lv >= 4 ? 1.6 : 2) * p.haste;
          const n = 1 + (lv >= 3) + (lv >= 5);
          const base = t ? Math.atan2(t.y - p.y, t.x - p.x) : Math.atan2(p.face.y, p.face.x);
          for (let i = 0; i < n; i++) {
            const a = base + i / n * TAU;
            this.shots.push({ type: 'boom', x: p.x, y: p.y, vx: Math.cos(a) * 420, vy: Math.sin(a) * 420, r: (lv >= 4 ? 18 : 13) * area, dmg: A * 1.3 * (lv >= 2 ? 1.3 : 1) * (lv >= 5 ? 1.3 : 1), pierce: 999, life: 2.2, t0: 0, rehit: 0.35, spin: 0 });
          }
          break;
        }
        case 'shrooms': {
          if (w.t > 0) break;
          w.t = (lv >= 5 ? 2 : 2.6) * p.haste;
          const n = 1 + (lv >= 2) + (lv >= 5);
          for (let i = 0; i < n; i++) {
            if (this.mines.length > 14) this.mines.shift();
            const a = Math.random() * TAU, r = rand(20, 70);
            this.mines.push({ x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r, life: 12, arm: 0.5, R: (lv >= 4 ? 78 : 56) * area, dmg: A * 3 * (lv >= 3 ? 1.4 : 1) });
          }
          break;
        }
        case 'frost': {
          if (w.t > 0) break;
          w.t = (lv >= 4 ? 2.4 : 3.2) * p.haste;
          const R = (lv >= 3 ? 145 : 112) * area, dmg = A * 1.2 * (lv >= 2 ? 1.3 : 1);
          this.fx.push({ type: 'ring', x: p.x, y: p.y, r: R, life: 0.4, max: 0.4, color: '#9ad8ff' });
          for (const e of this.grid.query(p.x, p.y, R + 20)) if (dist2(e, p) < (R + e.r * 0.5) ** 2) {
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
          for (let i = 0; i < n; i++) {
            const a = w.rot + i / n * TAU, sp = lv >= 5 ? 520 : 420;
            this.shots.push({ type: 'dagger', x: p.x, y: p.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 6, dmg: A * 0.9 * (lv >= 3 ? 1.3 : 1), pierce: lv >= 5 ? 3 : 0, life: 0.7, hit: new Set() });
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
            this.shots.push({ type: 'snow', x: p.x, y: p.y, sx: p.x, sy: p.y, tx, ty, t: 0, dur: 0.55, r: 0, R: (lv >= 3 ? 72 : 52) * area, dmg: A * 2.4 * (lv >= 2 ? 1.3 : 1), life: 1 });
          }
          break;
        }
      }
    }
    // champignons
    for (const m of this.mines) {
      m.arm -= dt; m.life -= dt;
      if (m.arm > 0) continue;
      const hit = this.grid.query(m.x, m.y, 30).find(e => dist2(e, m) < (e.r + 10) ** 2);
      if (hit) {
        m.life = 0;
        this.fx.push({ type: 'boom', x: m.x, y: m.y, r: m.R, life: 0.35, max: 0.35, color: '#8aff5a' });
        for (const e of this.grid.query(m.x, m.y, m.R + 20)) if (dist2(e, m) < (m.R + e.r * 0.5) ** 2) this.hitEnemy(e, m.dmg, { color: '#8aff5a' });
        sfx('bonk');
      }
    }
    this.mines = this.mines.filter(m => m.life > 0);
  }

  beam(x, y, a, len, width, dmg) {
    const cx = Math.cos(a), cy = Math.sin(a);
    this.fx.push({ type: 'beam', x, y, a, len, w: width, life: 0.2, max: 0.2 });
    // test sur les ennemis proches du segment
    const mx = x + cx * len / 2, my = y + cy * len / 2;
    for (const e of this.grid.query(mx, my, len / 2 + 30)) {
      const dx = e.x - x, dy = e.y - y, along = dx * cx + dy * cy;
      if (along < -10 || along > len) continue;
      const perp = Math.abs(-dx * cy + dy * cx);
      if (perp < width / 2 + e.r * 0.7) this.hitEnemy(e, dmg, { knock: 60, kx: cx, ky: cy });
    }
  }

  updateShots(dt) {
    const p = this.p, near = [];
    for (const s of this.shots) {
      s.life -= dt;
      if (s.type === 'snow') {
        s.t += dt;
        const k = Math.min(1, s.t / s.dur);
        s.x = s.sx + (s.tx - s.sx) * k; s.y = s.sy + (s.ty - s.sy) * k; s.h = Math.sin(k * Math.PI) * 60;
        if (k >= 1) {
          s.life = 0;
          this.fx.push({ type: 'boom', x: s.tx, y: s.ty, r: s.R, life: 0.35, max: 0.35, color: '#e8f4ff' });
          for (const e of this.grid.query(s.tx, s.ty, s.R + 20)) if ((e.x - s.tx) ** 2 + (e.y - s.ty) ** 2 < (s.R + e.r * 0.5) ** 2) { this.hitEnemy(e, s.dmg, {}); e.slow = 1.5; }
          sfx('bonk');
        }
        continue;
      }
      if (s.type === 'boom') {
        s.t0 += dt; s.spin += dt * 20;
        if (s.t0 > 0.55) { // retour vers le joueur
          const dx = p.x - s.x, dy = p.y - s.y, d = Math.hypot(dx, dy) || 1;
          s.vx += dx / d * 1600 * dt; s.vy += dy / d * 1600 * dt;
          const v = Math.hypot(s.vx, s.vy); if (v > 520) { s.vx *= 520 / v; s.vy *= 520 / v; }
          if (d < 20) s.life = 0;
        }
      }
      s.x += s.vx * dt; s.y += s.vy * dt;
      for (const e of this.grid.query(s.x, s.y, s.r + 40, near)) {
        if (e.dead) continue;
        if ((e.x - s.x) ** 2 + (e.y - s.y) ** 2 > (e.r + s.r) ** 2) continue;
        if (s.rehit) {
          const key = 'b' + (s.id || (s.id = Math.random()));
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
      if (dist2(s, p) < (s.r + p.r) ** 2) { s.life = 0; this.hurtPlayer(s.dmg); }
    }
    this.eshots = this.eshots.filter(s => s.life > 0);
  }

  hitEnemy(e, dmg, o = {}) {
    if (e.dead) return;
    let crit = !o.noCrit && Math.random() < this.p.crit;
    let d = dmg * (crit ? 2 : 1) * rand(0.92, 1.08);
    d = Math.max(1, Math.round(d));
    e.hp -= d;
    e.flash = 0.08;
    if (o.knock && !e.boss) { const k = o.knock * (e.elite ? 0.3 : 1); e.kx += (o.kx || 0) * k; e.ky += (o.ky || 0) * k; }
    if (this.texts.length < 50 && (!o.quiet || crit)) this.text(e.x + rand(-6, 6), e.y - e.r, fmt(d), crit ? '#ffd54a' : (o.color || '#ffffff'), crit ? 1.35 : 1);
    if (this.hitSfxT <= 0 && !o.quiet) { sfx('tap'); this.hitSfxT = 0.07; }
    if (e.hp <= 0) this.kill(e);
  }

  kill(e) {
    e.dead = true;
    this.kills++;
    const p = this.p, z = this.zone;
    p.ult = Math.min(100, p.ult + (e.boss ? 0 : e.elite ? 12 : 1.2) * (save.pet === 'voidy' ? 2 : 1));
    save.stats.seen[e.def.name] = (save.stats.seen[e.def.name] || 0) + 1;
    this.fx.push({ type: 'poof', x: e.x, y: e.y, r: e.r, life: 0.3, max: 0.3, color: e.def.pal[2] });
    const xp = (1 + Math.floor(z.id / 2)) * (e.elite ? 15 : 1);
    this.pickups.push({ type: 'xp', x: e.x, y: e.y, v: xp });
    const luck = this.base.gold;
    if (Math.random() < (e.elite ? 1 : 0.09)) this.pickups.push({ type: 'gold', x: e.x + rand(-8, 8), y: e.y + rand(-8, 8), v: Math.round((1 + z.id) * (e.elite ? 8 : 1) * luck) });
    if (Math.random() < 0.012) this.pickups.push({ type: 'heart', x: e.x, y: e.y });
    if (Math.random() < 0.003) this.pickups.push({ type: 'magnet', x: e.x, y: e.y });
    if (e.elite) { this.pickups.push({ type: 'chest', x: e.x, y: e.y }); sfx('loot'); }
    if (e.boss) this.win();
  }

  text(x, y, txt, color, size = 1) { this.texts.push({ x, y, txt, color, size, life: 0.7 }); }

  // ---------- Objets au sol ----------
  updatePickups(dt) {
    const p = this.p;
    const R = p.magnet;
    for (const it of this.pickups) {
      const dx = p.x - it.x, dy = p.y - it.y, d = Math.hypot(dx, dy) || 1;
      if (it.pull || d < R || (it.type === 'chest' && d < 30)) {
        it.pull = true;
        const sp = 380 + (it.pt = (it.pt || 0) + dt) * 900;
        it.x += dx / d * sp * dt; it.y += dy / d * sp * dt;
        if (d < 16) {
          it.taken = true;
          if (it.type === 'xp') this.gainXp(it.v);
          if (it.type === 'gold') { this.addGold(it.v); sfx('coin'); }
          if (it.type === 'heart') { const h = Math.round(p.maxHp * 0.25); p.hp = Math.min(p.maxHp, p.hp + h); this.text(p.x, p.y - 30, '+' + h, '#5ae87a', 1.2); sfx('heal'); }
          if (it.type === 'magnet') { for (const o of this.pickups) if (o.type === 'xp') o.pull = true; sfx('loot'); }
          if (it.type === 'chest') this.openChest();
        }
      }
    }
    this.pickups = this.pickups.filter(i => !i.taken);
    // trop de gemmes : on fusionne les plus lointaines
    if (this.pickups.length > 260) {
      const far = this.pickups.filter(i => i.type === 'xp' && !i.pull).sort((a, b) => dist2(b, p) - dist2(a, p)).slice(0, 60);
      const sum = far.reduce((s, i) => s + i.v, 0);
      for (const f of far) f.taken = true;
      this.pickups = this.pickups.filter(i => !i.taken);
      if (far.length) this.pickups.push({ type: 'xp', x: far[0].x, y: far[0].y, v: sum });
    }
  }

  gainXp(v) {
    const p = this.p;
    p.xp += v * p.xpMul;
    while (p.xp >= p.xpNext) {
      p.xp -= p.xpNext;
      p.level++;
      p.xpNext = Math.round(4 + (p.level - 1) * 2.6 + Math.pow(p.level, 1.25));
      this.pending++;
    }
  }

  addGold(v) { this.gold += v; }

  openChest() {
    this.paused = true; this.joy = null;
    const c = this.choices(1)[0];
    const g = Math.round((10 + this.zone.id * 6) * this.base.gold);
    this.addGold(g);
    sfx('win');
    this.onChest(c, g, () => { this.applyChoice(c); this.paused = false; this.last = performance.now(); });
  }

  // ---------- Familier ----------
  updatePet(dt) {
    if (!this.pet) return;
    const pet = this.pet, p = this.p;
    const tx = p.x - p.face.x * 34, ty = p.y - p.face.y * 34 - 8;
    pet.x += (tx - pet.x) * Math.min(1, dt * 5); pet.y += (ty - pet.y) * Math.min(1, dt * 5);
    this.petT -= dt;
    if (this.petT > 0) return;
    switch (pet.id) {
      case 'poro': this.petT = 3; if (p.hp < p.maxHp) { const h = Math.max(1, Math.round(p.maxHp * 0.02)); p.hp = Math.min(p.maxHp, p.hp + h); this.text(p.x, p.y - 30, '+' + h, '#5ae87a'); } break;
      case 'herald': {
        this.petT = 1.1;
        const t = this.nearest(300, pet);
        if (t) { const a = Math.atan2(t.y - pet.y, t.x - pet.x); this.shots.push({ type: 'pet', x: pet.x, y: pet.y, vx: Math.cos(a) * 380, vy: Math.sin(a) * 380, r: 6, dmg: p.atk * p.dmgMul * 0.9, pierce: 0, life: 1, hit: new Set() }); }
        break;
      }
      case 'wisp': this.petT = 8; p.shieldHit = 1; break;
      default: this.petT = 999;
    }
  }

  // ---------- Ultime ----------
  useUlt() {
    const p = this.p;
    if (this.paused || this.over) return;
    if (p.ult < 100) { this.banner('Ultime en charge : battez des monstres pour le remplir.', 1300); return; }
    p.ult = 0;
    save.stats.ults++;
    sfx('ult'); buzz(50);
    const A = p.atk * p.dmgMul;
    this.fx.push({ type: 'flash', life: 0.5, max: 0.5 });
    if (this.cls.ult === 'nova') {
      const R = 280 * p.area;
      this.fx.push({ type: 'ring', x: p.x, y: p.y, r: R, life: 0.6, max: 0.6, color: '#ffd54a' });
      for (const e of this.grid.query(p.x, p.y, R + 30)) if (dist2(e, p) < R * R) this.hitEnemy(e, A * 10, { knock: 400, kx: (e.x - p.x) / R, ky: (e.y - p.y) / R });
    } else if (this.cls.ult === 'crystal') {
      const t = this.nearest(600);
      const a = t ? Math.atan2(t.y - p.y, t.x - p.x) : Math.atan2(p.face.y, p.face.x);
      this.shots.push({ type: 'crystal', x: p.x, y: p.y, vx: Math.cos(a) * 700, vy: Math.sin(a) * 700, r: 34, dmg: A * 9, pierce: 999, life: 1.4, hit: new Set(), freeze: true, big: true });
    } else {
      for (const e of this.onScreen()) this.hitEnemy(e, A * 7, { knock: 200, kx: Math.sign(e.x - p.x), ky: Math.sign(e.y - p.y) });
      p.inv = 3;
      this.fx.push({ type: 'ring', x: p.x, y: p.y, r: 200, life: 0.5, max: 0.5, color: '#ffffff' });
    }
    this.banner(esc(ULTS[this.cls.ult].name), 900, 'ult');
  }

  // ---------- Fin ----------
  die() {
    if (this.over || this.dying) return;
    this.dying = true;
    this.paused = true; this.joy = null;
    sfx('lose'); buzz(80);
    setTimeout(() => this.onDefeat(!this.revived), 600);
  }

  revive() {
    const p = this.p;
    this.revived = true; this.dying = false;
    p.hp = p.maxHp; p.inv = 3;
    this.eshots = [];
    for (const e of this.grid.query(p.x, p.y, 260)) if (!e.boss) this.hitEnemy(e, 1e6, { quiet: true, noCrit: true }); else { e.kx = (e.x - p.x) * 3; e.ky = (e.y - p.y) * 3; }
    this.fx.push({ type: 'ring', x: p.x, y: p.y, r: 260, life: 0.7, max: 0.7, color: '#5ae87a' });
    sfx('heal');
    this.paused = false; this.last = performance.now();
  }

  win() {
    if (this.over || this.winning) return;
    this.winning = true;
    this.slowmo = 0.25;
    sfx('win'); buzz(80);
    $('#bossbar').hidden = true;
    this.banner('VICTOIRE !', 1800, 'boss');
    for (const e of this.enemies) if (!e.boss) e.dead = true, this.fx.push({ type: 'poof', x: e.x, y: e.y, r: e.r, life: 0.4, max: 0.4, color: '#ffffff' });
    for (const it of this.pickups) it.pull = true;
    setTimeout(() => this.finish(true), 1800);
  }

  finish(win) {
    if (this.over) return;
    this.destroy();
    this.onEnd(this.summary(win));
  }

  summary(win) {
    return {
      win, time: this.time, kills: this.kills, level: this.p.level, gold: this.gold,
      weapons: this.p.weapons.map(w => ({ ...w })), tomes: { ...this.p.tomes }, revived: this.revived,
    };
  }

  // ---------- Affichage ----------
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

  render() {
    const g = this.g, p = this.p, vw = this.vw, vh = this.vh;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.imageSmoothingEnabled = false;
    const sx = this.shake ? rand(-this.shake, this.shake) : 0, sy = this.shake ? rand(-this.shake, this.shake) : 0;
    const camX = Math.round(p.x - vw / 2 + sx), camY = Math.round(p.y - vh / 2 + sy);

    // sol (tuile agrandie ×3)
    g.save();
    g.translate(-camX, -camY);
    g.scale(3, 3);
    g.fillStyle = this.groundPat;
    g.fillRect(camX / 3, camY / 3, vw / 3 + 2, vh / 3 + 2);
    g.restore();

    g.save();
    g.translate(-camX, -camY);
    // décor (déterministe par case de 220 px)
    const C = 220;
    for (let cx = Math.floor(camX / C) - 1; cx <= Math.floor((camX + vw) / C) + 1; cx++) for (let cy = Math.floor(camY / C) - 1; cy <= Math.floor((camY + vh) / C) + 1; cy++) {
      const r = rng(hash(cx + ':' + cy + ':' + this.zone.id));
      const n = r() < 0.75 ? 1 + (r() < 0.4) : 0;
      for (let i = 0; i < n; i++) {
        const spr = this.props[Math.floor(r() * this.props.length)];
        const x = cx * C + r() * C, y = cy * C + r() * C;
        g.drawImage(spr, Math.round(x - spr.width * 1.5), Math.round(y - spr.height * 3), spr.width * 3, spr.height * 3);
      }
    }

    // champignons
    for (const m of this.mines) {
      g.fillStyle = m.arm > 0 ? '#5a8a3a' : '#e04a4a';
      g.beginPath(); g.ellipse(m.x, m.y - 4, 9, 6, 0, Math.PI, 0); g.fill();
      g.fillStyle = '#ffffff'; g.fillRect(m.x - 4, m.y - 7, 2, 2); g.fillRect(m.x + 2, m.y - 6, 2, 2);
      g.fillStyle = '#f0e0c0'; g.fillRect(m.x - 3, m.y - 4, 6, 5);
    }

    // aura
    const aura = p.weapons.find(w => w.id === 'aura');
    if (aura?.R) {
      g.fillStyle = 'rgba(255,170,60,.16)'; g.strokeStyle = 'rgba(255,190,90,.55)'; g.lineWidth = 2;
      g.beginPath(); g.arc(p.x, p.y, aura.R, 0, TAU); g.fill(); g.stroke();
    }

    // objets au sol
    for (const it of this.pickups) {
      if (it.x < camX - 20 || it.x > camX + vw + 20 || it.y < camY - 20 || it.y > camY + vh + 20) continue;
      if (it.type === 'xp') {
        const c = it.v >= 15 ? '#ff5a8a' : it.v >= 3 ? '#5ae87a' : '#4fc8ff', s = it.v >= 15 ? 7 : it.v >= 3 ? 6 : 5;
        g.fillStyle = c;
        g.beginPath(); g.moveTo(it.x, it.y - s); g.lineTo(it.x + s * 0.7, it.y); g.lineTo(it.x, it.y + s); g.lineTo(it.x - s * 0.7, it.y); g.fill();
        g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(it.x - 1, it.y - s + 2, 2, 2);
      } else if (it.type === 'gold') g.drawImage(this.icons.gold, it.x - 8, it.y - 8, 16, 16);
      else if (it.type === 'heart') g.drawImage(this.icons.heart, it.x - 10, it.y - 10, 20, 20);
      else if (it.type === 'magnet') g.drawImage(this.icons.ring, it.x - 10, it.y - 10, 20, 20);
      else if (it.type === 'chest') {
        const b = Math.sin(this.time * 5) * 2;
        g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(it.x, it.y + 10, 16, 5, 0, 0, TAU); g.fill();
        g.fillStyle = '#1a1424'; g.fillRect(it.x - 15, it.y - 12 + b, 30, 22);
        g.fillStyle = '#a0602a'; g.fillRect(it.x - 13, it.y - 10 + b, 26, 18);
        g.fillStyle = '#ffc83a'; g.fillRect(it.x - 13, it.y - 3 + b, 26, 3); g.fillRect(it.x - 3, it.y - 6 + b, 6, 8);
        g.fillStyle = 'rgba(255,220,120,.35)'; g.beginPath(); g.arc(it.x, it.y + b, 26 + Math.sin(this.time * 6) * 3, 0, TAU); g.fill();
      }
    }

    // entités triées par y
    const ents = this.enemies.filter(e => e.x > camX - 80 && e.x < camX + vw + 80 && e.y > camY - 80 && e.y < camY + vh + 100);
    const draw = [...ents, { hero: true, y: p.y }];
    if (this.pet) draw.push({ pet: true, y: this.pet.y });
    draw.sort((a, b) => a.y - b.y);
    for (const d of draw) {
      if (d.hero) this.drawHero();
      else if (d.pet) {
        const pt = this.pet, s = 2, w = this.petArt.width * s, h = this.petArt.height * s, b = Math.sin(this.time * 9) * 2;
        g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(pt.x, pt.y + h / 2 - 2, w / 3, 4, 0, 0, TAU); g.fill();
        g.drawImage(this.petArt, Math.round(pt.x - w / 2), Math.round(pt.y - h / 2 + b), w, h);
      } else {
        const e = d, s = e.scale, img = e.flash > 0 ? e.spr.flash : e.spr.img, w = img.width * s, h = img.height * s;
        const b = Math.abs(Math.sin(e.bob)) * (e.boss ? 3 : 2);
        g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(e.x, e.y + h * 0.42, w * 0.32, Math.max(3, h * 0.07), 0, 0, TAU); g.fill();
        if (e.boss && e.phase === 'aim') {
          g.strokeStyle = 'rgba(255,60,60,.6)'; g.lineWidth = e.r * 1.2; g.lineCap = 'round';
          g.beginPath(); g.moveTo(e.x, e.y); g.lineTo(e.x + e.dashX * 290, e.y + e.dashY * 290); g.stroke();
        }
        if (e.freeze) g.globalAlpha = 0.75;
        g.drawImage(img, Math.round(e.x - w / 2), Math.round(e.y - h / 2 - b), w, h);
        g.globalAlpha = 1;
        if (e.freeze) { g.fillStyle = 'rgba(150,220,255,.35)'; g.fillRect(e.x - w / 2, e.y - h / 2 - b, w, h); }
        if (e.elite && !e.boss) {
          const bw = w * 0.7;
          g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(e.x - bw / 2, e.y - h / 2 - 10, bw, 5);
          g.fillStyle = '#c06aff'; g.fillRect(e.x - bw / 2, e.y - h / 2 - 10, bw * Math.max(0, e.hp / e.maxHp), 5);
        }
      }
    }

    // tirs
    for (const s of this.shots) {
      if (s.type === 'arrow' || s.type === 'dagger') {
        const a = Math.atan2(s.vy, s.vx);
        g.save(); g.translate(s.x, s.y); g.rotate(a);
        if (s.type === 'arrow') { g.fillStyle = '#8a5a2a'; g.fillRect(-12, -1.5, 18, 3); g.fillStyle = '#e8f0ff'; g.fillRect(6, -3, 6, 6); g.fillStyle = '#e05050'; g.fillRect(-14, -3, 4, 6); }
        else { g.fillStyle = '#d8e0f0'; g.fillRect(-4, -2, 12, 4); g.fillStyle = '#e6b422'; g.fillRect(-8, -3, 4, 6); }
        g.restore();
      } else if (s.type === 'boom') {
        g.save(); g.translate(s.x, s.y); g.rotate(s.spin);
        g.fillStyle = '#e8eef8'; g.fillRect(-s.r, -3, s.r * 2, 6); g.fillRect(-3, -s.r, 6, s.r * 2);
        g.fillStyle = '#e6b422'; g.fillRect(-4, -4, 8, 8);
        g.restore();
      } else if (s.type === 'snow') {
        g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(s.x, s.y + 6, 8, 3, 0, 0, TAU); g.fill();
        g.fillStyle = '#ffffff'; g.beginPath(); g.arc(s.x, s.y - s.h, 9, 0, TAU); g.fill();
        g.fillStyle = '#c8e0f5'; g.beginPath(); g.arc(s.x + 2, s.y - s.h + 2, 5, 0, TAU); g.fill();
      } else if (s.type === 'crystal') {
        const a = Math.atan2(s.vy, s.vx);
        g.save(); g.translate(s.x, s.y); g.rotate(a);
        g.fillStyle = 'rgba(122,200,255,.35)'; g.beginPath(); g.ellipse(0, 0, 60, 30, 0, 0, TAU); g.fill();
        g.fillStyle = '#7ac8ff'; g.beginPath(); g.moveTo(40, 0); g.lineTo(-30, -16); g.lineTo(-20, 0); g.lineTo(-30, 16); g.fill();
        g.fillStyle = '#e8f8ff'; g.fillRect(-10, -3, 40, 6);
        g.restore();
      } else {
        g.fillStyle = '#d0a0ff'; g.beginPath(); g.arc(s.x, s.y, 5, 0, TAU); g.fill();
      }
    }
    // orbes
    for (const w of p.weapons) if (w.orbs) for (const [ox, oy] of w.orbs) {
      g.fillStyle = 'rgba(176,106,255,.35)'; g.beginPath(); g.arc(ox, oy, 15, 0, TAU); g.fill();
      g.fillStyle = '#e0c0ff'; g.beginPath(); g.arc(ox, oy, 8, 0, TAU); g.fill();
      g.fillStyle = '#ffffff'; g.fillRect(ox - 3, oy - 3, 3, 3);
    }
    // tirs ennemis
    for (const s of this.eshots) {
      g.fillStyle = 'rgba(255,60,90,.35)'; g.beginPath(); g.arc(s.x, s.y, s.r + 4, 0, TAU); g.fill();
      g.fillStyle = '#ff4a6a'; g.beginPath(); g.arc(s.x, s.y, s.r, 0, TAU); g.fill();
      g.fillStyle = '#ffd0d8'; g.fillRect(s.x - 2, s.y - 2, 3, 3);
    }
    // effets
    for (const f of this.fx) {
      const k = f.life / f.max;
      if (f.type === 'beam') {
        g.save(); g.translate(f.x, f.y); g.rotate(f.a);
        g.globalAlpha = k;
        g.fillStyle = 'rgba(255,213,74,.5)'; g.fillRect(0, -f.w / 2 - 4, f.len, f.w + 8);
        g.fillStyle = '#fff6c0'; g.fillRect(0, -f.w / 2, f.len, f.w);
        g.fillStyle = '#ffffff'; g.fillRect(0, -f.w / 6, f.len, f.w / 3);
        g.restore(); g.globalAlpha = 1;
      } else if (f.type === 'slash') {
        g.strokeStyle = `rgba(255,255,255,${k})`; g.lineWidth = 10 * k + 3; g.lineCap = 'round';
        const sweep = (1 - k) * 2.4 - 1.2;
        g.beginPath(); g.arc(f.x, f.y, f.r * 0.8, f.a - 1.25, f.a + sweep); g.stroke();
        g.strokeStyle = `rgba(200,220,255,${k * 0.5})`; g.lineWidth = 4;
        g.beginPath(); g.arc(f.x, f.y, f.r * 0.55, f.a - 1.1, f.a + sweep); g.stroke();
      } else if (f.type === 'ring' || f.type === 'boom') {
        const r = f.r * (f.type === 'ring' ? 1 - k * 0.7 : 0.6 + (1 - k) * 0.4);
        g.strokeStyle = f.color; g.globalAlpha = k; g.lineWidth = 6;
        g.beginPath(); g.arc(f.x, f.y, r, 0, TAU); g.stroke();
        g.fillStyle = f.color; g.globalAlpha = k * 0.25; g.fill();
        g.globalAlpha = 1;
      } else if (f.type === 'bolt') {
        g.strokeStyle = `rgba(255,240,120,${k})`; g.lineWidth = 4;
        g.beginPath(); let x = f.x + 10, y = f.y - 260; g.moveTo(x, y);
        const r = rng(Math.floor(f.seed * 1e6));
        while (y < f.y) { y += 30; x = f.x + (r() - 0.5) * 30; g.lineTo(x, Math.min(y, f.y)); }
        g.stroke();
        g.fillStyle = `rgba(255,255,200,${k * 0.6})`; g.beginPath(); g.arc(f.x, f.y, 30, 0, TAU); g.fill();
      } else if (f.type === 'poof') {
        g.fillStyle = f.color; g.globalAlpha = k;
        for (let i = 0; i < 6; i++) { const a = i / 6 * TAU, r = f.r * (1.4 - k); g.fillRect(f.x + Math.cos(a) * r - 2, f.y + Math.sin(a) * r - 2, 4, 4); }
        g.globalAlpha = 1;
      }
    }
    // textes
    g.textAlign = 'center';
    for (const t of this.texts) {
      g.globalAlpha = Math.min(1, t.life * 3);
      g.font = `900 ${Math.round(14 * t.size)}px ui-rounded, system-ui, sans-serif`;
      g.lineWidth = 3; g.strokeStyle = '#000'; g.strokeText(t.txt, t.x, t.y);
      g.fillStyle = t.color; g.fillText(t.txt, t.x, t.y);
    }
    g.globalAlpha = 1;
    g.restore();

    // flèche vers le boss
    if (this.boss && !this.boss.dead) {
      const b = this.boss, dx = b.x - p.x, dy = b.y - p.y;
      if (Math.abs(dx) > vw / 2 || Math.abs(dy) > vh / 2) {
        const a = Math.atan2(dy, dx), r = Math.min(vw, vh) / 2 - 40;
        const ax = vw / 2 + Math.cos(a) * r, ay = vh / 2 + Math.sin(a) * r;
        g.save(); g.translate(ax, ay); g.rotate(a);
        g.fillStyle = '#ff4a5a'; g.beginPath(); g.moveTo(14, 0); g.lineTo(-8, -10); g.lineTo(-8, 10); g.fill();
        g.restore();
      }
    }
    // flash d'ultime
    const fl = this.fx.find(f => f.type === 'flash');
    if (fl) { g.fillStyle = `rgba(255,240,200,${fl.life / fl.max * 0.6})`; g.fillRect(0, 0, vw, vh); }
    // dégâts : bord rouge
    if (p.inv > 0.3 && p.hp < p.maxHp) { g.fillStyle = `rgba(255,40,60,${(p.inv - 0.3) * 0.5})`; g.fillRect(0, 0, vw, vh); }
    // joystick
    if (this.joy) {
      const j = this.joy, r = this.cv.getBoundingClientRect();
      const ox = j.ox - r.left, oy = j.oy - r.top;
      let kx = j.x - j.ox, ky = j.y - j.oy; const d = Math.hypot(kx, ky); if (d > 50) { kx *= 50 / d; ky *= 50 / d; }
      g.fillStyle = 'rgba(255,255,255,.12)'; g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2;
      g.beginPath(); g.arc(ox, oy, 54, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.arc(ox + kx, oy + ky, 24, 0, TAU); g.fill();
    }
  }

  drawHero() {
    const g = this.g, p = this.p, img = this.hero, s = 2.6, w = img.width * s, h = img.height * s;
    const b = p.moving ? Math.abs(Math.sin(this.time * 14)) * 3 : Math.sin(this.time * 3) * 1;
    g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(p.x, p.y + h * 0.42, w * 0.32, 5, 0, 0, TAU); g.fill();
    if (p.shieldHit) { g.strokeStyle = 'rgba(160,220,255,.8)'; g.lineWidth = 2; g.beginPath(); g.arc(p.x, p.y, 30, 0, TAU); g.stroke(); }
    g.save();
    g.translate(Math.round(p.x), Math.round(p.y - b));
    if (p.face.x < -0.1) g.scale(-1, 1);
    if (p.inv > 0 && Math.floor(this.time * 20) % 2) g.globalAlpha = 0.45;
    g.drawImage(img, Math.round(-w / 2), Math.round(-h / 2), w, h);
    g.restore();
    g.globalAlpha = 1;
    // barre de vie sous le héros
    const bw = 40, ratio = Math.max(0, p.hp / p.maxHp);
    g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(p.x - bw / 2 - 1, p.y + h / 2 + 3, bw + 2, 6);
    g.fillStyle = ratio < 0.3 ? '#ff7a4a' : '#5ae87a'; g.fillRect(p.x - bw / 2, p.y + h / 2 + 4, bw * ratio, 4);
  }
}
