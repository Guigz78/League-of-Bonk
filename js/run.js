// Moteur 3D façon Megabonk / PokéBonk : monde ouvert, hordes, armes automatiques,
// saut, évolutions du champion, autels, coffres, boss géants.
import * as THREE from '../vendor/three.module.min.js';
import { CLASSES, WEAPONS, TOMES, ULTS, ZONE_TIME, PETS, MAX_WEAPONS, MAX_TOMES, MAX_LEVEL, EVOLUTIONS, BOONS } from './data.js';
import { save, playerStats } from './save.js';
import { heroGrid, iconImg } from './art.js';
import { makeCreature, rng } from './pixel.js';
import { voxelGeometry } from './voxel.js';
import { buildWorld, S, HALF } from './world3d.js';
import { sfx, buzz } from './audio.js';
import { mount, $, esc, fmt } from './ui.js';

const TAU = Math.PI * 2;
const SPEED = { blob: 50, humanoid: 62, golem: 42, beast: 80, bird: 88, crab: 58, ghost: 66, worm: 54 };
const FLYERS = { bird: 34, ghost: 26 };
const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const rand = (a, b) => a + Math.random() * (b - a);
const SPAWN_R = 640, VIEW_R = 470;

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

// ---------- Groupe d'instances (dessin rapide de nombreux objets identiques) ----------
class Pool {
  constructor(scene, geo, mat, cap) {
    this.mesh = new THREE.InstancedMesh(geo, mat, cap);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.cap = cap; this.i = 0;
    this.d = new THREE.Object3D();
    this.c = new THREE.Color();
    scene.add(this.mesh);
  }
  begin() { this.i = 0; }
  add(x, y, z, ry = 0, s = 1, color = null, rx = 0, sy = null) {
    if (this.i >= this.cap) return;
    const d = this.d;
    d.position.set(x, y, z); d.rotation.set(rx, ry, 0);
    d.scale.set(s, sy ?? s, s);
    d.updateMatrix();
    this.mesh.setMatrixAt(this.i, d.matrix);
    if (color !== null) this.mesh.setColorAt(this.i, typeof color === 'number' ? this.c.setScalar(color) : this.c.set(color));
    this.i++;
  }
  addMatrix(m) { if (this.i < this.cap) this.mesh.setMatrixAt(this.i++, m); }
  end() {
    this.mesh.count = this.i;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
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
      x: 0, y: 0, h: 0, vh: 0, r: 14, face: { x: 0, y: -1 },
      maxHp: st.hp, hp: st.hp, atk: st.atk, crit: st.crit, regen: st.regen * 0.2,
      speed: 160 * st.speed, magnet: 95 * st.magnet * (save.pet === 'phenix' ? 1.4 : 1),
      armor: 0, xpMul: 1, area: 1, haste: 1, dmgMul: 1,
      inv: 0, shieldHit: 0, level: 1, xp: 0, xpNext: 4, ult: 0,
      weapons: [], tomes: {}, boons: {}, evo: 0,
    };
    this.addWeapon(this.cls.weapon);
    this.enemies = []; this.shots = []; this.eshots = []; this.fx = []; this.pickups = []; this.texts = []; this.mines = []; this.parts = []; this.waves = [];
    this.grid = new Grid(64);
    this.time = 0; this.kills = 0; this.gold = 0;
    this.spawnAcc = 0; this.nextElite = 40; this.swarms = [0.3, 0.55, 0.8].map(f => f * this.duration);
    this.boss = null; this.bossSpawned = false;
    this.paused = false; this.over = false; this.revived = false;
    this.pending = 0;
    this.joy = null; this.look = null; this.yaw = 0;
    this.keys = new Set();
    this.shake = 0; this.hitSfxT = 0; this.msgT = 0;
    this.hurtFlash = 0; this.evoFlash = 0; this.ultFlash = 0;
    this.petT = 0; this.pet = save.pet ? { id: save.pet, x: -30, y: 10 } : null;
    this.slowmo = 1;
  }

  // ---------- Mise en place ----------
  start() {
    const u = ULTS[this.cls.ult];
    mount(`<div class="run">
      <canvas id="cv3"></canvas>
      <canvas id="cv"></canvas>
      <div class="hud">
        <div class="hud-top">
          <button class="icon-btn" id="pauseBtn" aria-label="Pause"><i class="pause-ic"></i></button>
          <div class="timer"><b id="timer">0:00</b><small id="timerLbl">Survivez !</small></div>
          <div class="hud-right"><span>${iconImg('skull', 16)}<b id="killsN">0</b></span><span>${iconImg('gold', 16)}<b id="goldRun">0</b></span></div>
        </div>
        <div class="xpbar"><div class="fill" id="xpFill"></div><span id="lvl">Niv. 1</span></div>
        <div class="evo-line" id="evoLine"></div>
        <div class="loadout" id="loadout"></div>
        <div class="bossbar" id="bossbar" hidden><div class="bn" id="bossName"></div><div class="hpbar"><div class="fill"></div><span></span></div></div>
        <div class="banner" id="banner"></div>
        <div class="hint-bubble" id="hintBubble">Côté gauche : glissez pour courir.<br>Côté droit : glissez pour tourner la caméra.<br>Votre champion attaque tout seul !</div>
        <button class="jump-btn" id="jumpBtn" aria-label="Sauter"><i class="jump-ic"></i><small>Sauter</small></button>
        <button class="ult-btn" id="ultBtn" aria-label="${esc(u.name)}">${iconImg(u.icon, 30)}<svg class="ring" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16"/></svg><small>${esc(u.name)}</small></button>
      </div>
    </div>`);
    this.cv = $('#cv');
    this.g = this.cv.getContext('2d');
    this.initThree();
    this.resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      this.vw = this.cv.clientWidth; this.vh = this.cv.clientHeight;
      this.cv.width = Math.round(this.vw * dpr); this.cv.height = Math.round(this.vh * dpr);
      this.dpr = dpr;
      this.renderer.setPixelRatio(Math.min(1.5, dpr));
      this.renderer.setSize(this.vw, this.vh, false);
      this.camera.aspect = this.vw / this.vh;
      this.camera.fov = this.vw / this.vh < 0.7 ? 62 : 50;
      this.camera.updateProjectionMatrix();
    };
    this.resize();
    window.addEventListener('resize', this.resize);
    this.bindInput();
    $('#pauseBtn').addEventListener('click', () => this.pause());
    $('#ultBtn').addEventListener('click', () => this.useUlt());
    $('#jumpBtn').addEventListener('pointerdown', e => { e.preventDefault(); this.jump(); });
    this.onVis = () => { if (document.hidden && !this.paused && !this.over) this.pause(); };
    document.addEventListener('visibilitychange', this.onVis);
    this.renderLoadout();
    this.renderEvo();
    this.banner(`<small>${esc(this.zone.name)}</small>Survivez ${Math.round(this.duration / 60)} minutes !`, 2200);
    this.last = performance.now();
    this.raf = requestAnimationFrame(t => this.frame(t));
    setTimeout(() => $('#hintBubble')?.classList.add('out'), save.stats.runs > 2 ? 3000 : 7000);
  }

  initThree() {
    const canvas = $('#cv3');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.5, 120);
    this.world = buildWorld(this.scene, this.zone);
    this.height = this.world.height;
    this.placeInterest();

    this.vmat = new THREE.MeshLambertMaterial({ vertexColors: true });
    // héros
    this.heroMat = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: new THREE.Color('#000000') });
    this.hero = new THREE.Mesh(this.heroGeo(0), this.heroMat);
    this.scene.add(this.hero);
    // familier
    if (this.pet) {
      const pd = PETS[this.pet.id], cr = makeCreature('pet-' + this.pet.id, pd.body, pd.pal);
      this.petMesh = new THREE.Mesh(voxelGeometry(cr.grid, cr.colors, { size: 0.07, maxDepth: 4 }), this.vmat);
      this.scene.add(this.petMesh);
    }
    this.enemyPools = new Map();
    const shadowGeo = new THREE.CircleGeometry(1, 12); shadowGeo.rotateX(-Math.PI / 2);
    this.shadows = new Pool(this.scene, shadowGeo, new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.28, depthWrite: false }), 420);
    // objets au sol
    const gemGeo = new THREE.OctahedronGeometry(0.28, 0); gemGeo.scale(0.8, 1.2, 0.8);
    this.gems = new Pool(this.scene, gemGeo, new THREE.MeshBasicMaterial({ color: '#ffffff' }), 900);
    this.gems.mesh.setColorAt(0, new THREE.Color('#fff'));
    const coinGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.08, 10); coinGeo.rotateX(Math.PI / 2);
    this.coins = new Pool(this.scene, coinGeo, new THREE.MeshLambertMaterial({ color: '#ffc83a', emissive: '#6a4a00' }), 200);
    this.hearts = new Pool(this.scene, new THREE.OctahedronGeometry(0.4, 0), new THREE.MeshLambertMaterial({ color: '#ff4a6a', emissive: '#6a0010' }), 40);
    this.magnets = new Pool(this.scene, new THREE.TorusGeometry(0.35, 0.1, 6, 12), new THREE.MeshLambertMaterial({ color: '#4fa8ff', emissive: '#002a6a' }), 10);
    // tirs
    const unlit = c => new THREE.MeshBasicMaterial({ color: c });
    this.pArrow = new Pool(this.scene, new THREE.BoxGeometry(0.9, 0.12, 0.12), unlit('#f0e0c0'), 300);
    this.pDagger = new Pool(this.scene, new THREE.BoxGeometry(0.6, 0.1, 0.22), unlit('#e8eef8'), 300);
    this.pBall = new Pool(this.scene, new THREE.SphereGeometry(0.22, 8, 6), unlit('#d0a0ff'), 120);
    this.pSnow = new Pool(this.scene, new THREE.SphereGeometry(0.45, 10, 8), new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#4a5a6a' }), 30);
    this.pBoom = new Pool(this.scene, new THREE.BoxGeometry(1.4, 0.12, 0.3), unlit('#f4f0e0'), 20);
    this.pBoom2 = new Pool(this.scene, new THREE.BoxGeometry(0.3, 0.12, 1.4), unlit('#e6b422'), 20);
    this.pCrystal = new Pool(this.scene, new THREE.OctahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ color: '#9ad8ff', transparent: true, opacity: 0.85 }), 4);
    this.pEnemyShot = new Pool(this.scene, new THREE.SphereGeometry(0.3, 8, 6), unlit('#ff3a5a'), 200);
    this.pOrb = new Pool(this.scene, new THREE.SphereGeometry(0.38, 10, 8), unlit('#e0c0ff'), 10);
    this.pShroom = new Pool(this.scene, new THREE.SphereGeometry(0.45, 8, 6, 0, TAU, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#ffffff' }), 20);
    this.pShroom.mesh.setColorAt(0, new THREE.Color('#fff'));
    // particules
    this.pPart = new Pool(this.scene, new THREE.BoxGeometry(0.16, 0.16, 0.16), new THREE.MeshBasicMaterial({ color: '#ffffff' }), 700);
    this.pPart.mesh.setColorAt(0, new THREE.Color('#fff'));
    // effets au sol
    const ringGeo = new THREE.RingGeometry(0.9, 1, 40); ringGeo.rotateX(-Math.PI / 2);
    this.pRing = new Pool(this.scene, ringGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }), 40);
    this.pRing.mesh.setColorAt(0, new THREE.Color('#fff'));
    const discGeo = new THREE.CircleGeometry(1, 32); discGeo.rotateX(-Math.PI / 2);
    this.aura = new THREE.Mesh(discGeo, new THREE.MeshBasicMaterial({ color: '#ffaa3a', transparent: true, opacity: 0.22, depthWrite: false }));
    this.aura.visible = false; this.scene.add(this.aura);
    this.pBeam = new Pool(this.scene, new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: '#fff6c0', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }), 8);
    const slashGeo = new THREE.RingGeometry(0.6, 1, 20, 1, -1.2, 2.4); slashGeo.rotateX(-Math.PI / 2);
    this.pSlash = new Pool(this.scene, slashGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }), 6);
    this.pBolt = new Pool(this.scene, new THREE.CylinderGeometry(0.14, 0.14, 1, 4), new THREE.MeshBasicMaterial({ color: '#fff7a0', blending: THREE.AdditiveBlending, transparent: true }), 16);
    this.pools = [this.pArrow, this.pDagger, this.pBall, this.pSnow, this.pBoom, this.pBoom2, this.pCrystal, this.pEnemyShot, this.pOrb, this.pShroom, this.pPart, this.pRing, this.pBeam, this.pSlash, this.pBolt];
    // coffres & autels
    for (const c of this.chests) { c.mesh = this.makeChestMesh(); c.mesh.position.set(c.x * S, this.gh(c.x, c.y), c.y * S); this.scene.add(c.mesh); }
    for (const s of this.shrines) { s.mesh = this.makeShrineMesh(); s.mesh.position.set(s.x * S, this.gh(s.x, s.y), s.y * S); this.scene.add(s.mesh); }
    this.dropChests = [];
    this.tv = new THREE.Vector3();
    this.usedGemMat = new THREE.MeshBasicMaterial({ color: '#555566' });
  }

  heroGeo(evo) {
    const ev = EVOLUTIONS[this.cls.id][evo];
    const { grid, colors } = heroGrid(this.cls.id, { ...this.cls.colors, ...(ev.colors || {}) });
    return voxelGeometry(grid, colors, { size: 0.14 * (1 + evo * 0.14), maxDepth: 7 });
  }

  enemyPool(def, k, boss) {
    const key = def.name + (boss ? '!' : '');
    if (!this.enemyPools.has(key)) {
      const cr = makeCreature(`${this.zone.id}-${k}-${def.name}`, def.body, def.pal, { boss });
      const pool = new Pool(this.scene, voxelGeometry(cr.grid, cr.colors, { size: 1, maxDepth: 6 }), this.vmat, boss ? 2 : 260);
      pool.mesh.setColorAt(0, new THREE.Color('#fff'));
      this.enemyPools.set(key, pool);
    }
    return this.enemyPools.get(key);
  }

  makeChestMesh() {
    const g = new THREE.Group();
    const wood = new THREE.MeshLambertMaterial({ color: '#a0602a' }), gold = new THREE.MeshLambertMaterial({ color: '#ffc83a', emissive: '#5a3a00' });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 0.9), wood); body.position.y = 0.4;
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.35, 0.95), wood); lid.position.y = 0.95;
    const band = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 1), gold); band.position.y = 0.78;
    const lock = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.35, 0.1), gold); lock.position.set(0, 0.7, 0.48);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 14, 8, 1, true), new THREE.MeshBasicMaterial({ color: '#ffd54a', transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }));
    beam.position.y = 7;
    g.add(body, lid, band, lock, beam);
    g.userData = { lid, beam };
    return g;
  }

  makeShrineMesh() {
    const g = new THREE.Group();
    const stone = new THREE.MeshLambertMaterial({ color: '#8a8aa8', flatShading: true });
    for (let i = 0; i < 4; i++) {
      const a = i / 4 * TAU + 0.4;
      const pil = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.2, 0.5), stone);
      pil.position.set(Math.cos(a) * 2.4, 1.1, Math.sin(a) * 2.4);
      g.add(pil);
    }
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.6, 0), new THREE.MeshBasicMaterial({ color: '#4fd0ff' }));
    gem.position.y = 2.2;
    const disc = new THREE.Mesh(new THREE.RingGeometry(2.6, 3, 32), new THREE.MeshBasicMaterial({ color: '#4fd0ff', transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
    disc.rotation.x = -Math.PI / 2; disc.position.y = 0.1;
    const fill = new THREE.Mesh(new THREE.CircleGeometry(2.6, 32), new THREE.MeshBasicMaterial({ color: '#4fd0ff', transparent: true, opacity: 0.3, side: THREE.DoubleSide }));
    fill.rotation.x = -Math.PI / 2; fill.position.y = 0.08; fill.scale.setScalar(0.01);
    g.add(gem, disc, fill);
    g.userData = { gem, fill, disc };
    return g;
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
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
    document.removeEventListener('visibilitychange', this.onVis);
    window.removeEventListener('keydown', this.kd); window.removeEventListener('keyup', this.ku);
    try {
      this.scene.traverse(o => { o.geometry?.dispose?.(); if (o.material) [].concat(o.material).forEach(m => m.dispose?.()); });
      this.renderer.dispose();
      this.renderer.forceContextLoss?.();
    } catch (e) { /* */ }
  }

  bindInput() {
    const cv = this.cv;
    cv.addEventListener('pointerdown', e => {
      e.preventDefault();
      cv.setPointerCapture?.(e.pointerId);
      if (!this.joy && e.clientX < this.vw * 0.55) this.joy = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
      else if (!this.look) this.look = { id: e.pointerId, x: e.clientX };
      $('#hintBubble')?.classList.add('out');
    });
    cv.addEventListener('pointermove', e => {
      if (this.joy && e.pointerId === this.joy.id) { this.joy.x = e.clientX; this.joy.y = e.clientY; }
      if (this.look && e.pointerId === this.look.id) { this.yaw -= (e.clientX - this.look.x) * 0.008; this.look.x = e.clientX; }
    });
    const up = e => { if (this.joy && e.pointerId === this.joy.id) this.joy = null; if (this.look && e.pointerId === this.look.id) this.look = null; };
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
    this.onPause(() => { this.paused = false; this.last = performance.now(); });
  }

  jump() {
    const p = this.p;
    if (this.paused || this.over || p.h > 2) return;
    p.vh = 560; p.h = 1;
    sfx('tap');
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
    p.armor = Math.min(0.6, 0.08 * (t.armor || 0));
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
    else if (c.kind === 'gold') this.gold += 25 + this.zone.id * 10;
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
    sfx('loot'); buzz(20);
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
    p.hp = p.maxHp;
    p.ult = 100;
    this.addWeapon(this.cls.weapon);
    this.hero.geometry.dispose();
    this.hero.geometry = this.heroGeo(p.evo);
    this.evoFlash = 1.2;
    p.inv = 2;
    this.burst(p.x, p.y, 40, 60, '#ffe48a');
    this.fx.push({ type: 'ring', x: p.x, y: p.y, r: 260, life: 0.8, max: 0.8, color: '#ffd54a' });
    for (const e of this.grid.query(p.x, p.y, 260)) if (!e.boss) { e.kx += (e.x - p.x) * 4; e.ky += (e.y - p.y) * 4; }
    this.banner(`<small>Votre champion évolue !</small>${esc(ev.name)}`, 2600, 'evo');
    this.renderEvo();
    sfx('ult'); buzz(80);
  }

  update(dt) {
    const p = this.p;
    this.time += dt;
    this.hitSfxT -= dt; this.msgT -= dt;
    this.evoFlash = Math.max(0, this.evoFlash - dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    this.ultFlash = Math.max(0, this.ultFlash - dt);
    // déplacement relatif à la caméra
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
    const fwx = -Math.sin(this.yaw), fwy = -Math.cos(this.yaw), rgx = Math.cos(this.yaw), rgy = -Math.sin(this.yaw);
    let mx = rgx * jx - fwx * jy, my = rgy * jx - fwy * jy;
    const ml = Math.hypot(mx, my);
    if (ml > 1) { mx /= ml; my /= ml; }
    if (ml > 0.05) p.face = { x: mx / ml, y: my / ml };
    p.x = Math.max(-HALF + 80, Math.min(HALF - 80, p.x + mx * p.speed * dt));
    p.y = Math.max(-HALF + 80, Math.min(HALF - 80, p.y + my * p.speed * dt));
    p.moving = ml > 0.05;
    if (p.h > 0 || p.vh > 0) { p.vh -= 1700 * dt; p.h = Math.max(0, p.h + p.vh * dt); if (p.h === 0) p.vh = 0; }
    p.inv = Math.max(0, p.inv - dt);
    if (p.regen) p.hp = Math.min(p.maxHp, p.hp + p.regen * dt);

    this.spawn(dt);
    this.grid.clear();
    for (const e of this.enemies) this.grid.add(e);
    this.updateEnemies(dt);
    this.updateWeapons(dt);
    this.updateShots(dt);
    this.updateWaves(dt);
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
    const z = this.zone, t = this.time, mons = z.monsters;
    if (!this.bossSpawned && t >= this.duration) return this.spawnBoss();
    const cap = 140 + z.id * 12;
    let rate = (0.9 + t / 22) * (1 + z.id * 0.15);
    if (this.bossSpawned) rate *= 0.35;
    this.spawnAcc += rate * dt;
    const pool = Math.min(3, Math.floor(t / (this.duration / 4)));
    while (this.spawnAcc >= 1) {
      this.spawnAcc--;
      if (this.enemies.length >= cap) break;
      const k = Math.floor(Math.random() * (pool + 1));
      const kk = Math.max(0, Math.min(3, k - (Math.random() < 0.3 ? 1 : 0)));
      this.addEnemy(mons[kk], kk);
    }
    if (t >= this.nextElite && !this.bossSpawned) {
      this.nextElite += 45;
      this.addEnemy(mons[4], 4, { elite: true });
      this.banner('Un ennemi <span class="tag elite">ÉLITE</span> approche !', 1600);
    }
    if (this.swarms.length && t >= this.swarms[0]) {
      this.swarms.shift();
      const n = 18 + z.id * 2, k = Math.min(pool, 3), def = mons[k];
      for (let i = 0; i < n; i++) {
        const a = i / n * TAU, R = 430;
        this.addEnemy(def, k, { x: this.p.x + Math.cos(a) * R, y: this.p.y + Math.sin(a) * R });
      }
      this.banner('Une horde vous encercle !', 1500, 'warn');
      sfx('hurt');
    }
  }

  addEnemy(def, k, o = {}) {
    const z = this.zone, t = this.time;
    const tier = this.replay ? 1.2 : 1;
    let x = o.x, y = o.y;
    if (x == null) [x, y] = this.spawnPoint();
    const zm = 1 + z.id * 0.35;
    let hp = def.hp * 0.3 * (1 + t / 150) * tier * zm;
    let dmg = def.atk * 0.7 * tier * (1 + z.id * 0.12);
    let scale = 2.2, speed = (SPEED[def.body] || 60) * (1 + z.id * 0.04) * rand(0.9, 1.1);
    if (o.elite) { hp *= 10; dmg *= 1.5; scale = 3.6; speed *= 0.85; }
    if (o.boss) { hp = def.hp * 8 * tier * (1 + z.id * 0.8); dmg = def.atk * 1.1 * tier * (1 + z.id * 0.1); scale = 8; speed *= 0.8; }
    const e = {
      def, k, x, y, hp, maxHp: hp, dmg, speed, scale, r: 7 * scale, pool: this.enemyPool(def, k, !!o.boss),
      elite: !!o.elite, boss: !!o.boss, ranged: def.ranged && !o.boss, shootT: rand(1, 3), fly: FLYERS[def.body] || 0,
      flash: 0, slow: 0, freeze: 0, kx: 0, ky: 0, hitT: {}, bob: Math.random() * TAU, dead: false, jumpH: 0,
      phase: 'chase', phaseT: 3, dashX: 0, dashY: 0, ang: 0,
    };
    this.enemies.push(e);
    return e;
  }

  spawnBoss() {
    this.bossSpawned = true;
    const z = this.zone, def = z.boss || z.monsters[4];
    const a = Math.random() * TAU;
    this.boss = this.addEnemy(def, z.boss ? 5 : 4, { boss: true, x: this.p.x + Math.cos(a) * 380, y: this.p.y + Math.sin(a) * 380 });
    $('#bossbar').hidden = false;
    $('#bossName').innerHTML = `<span class="tag boss">BOSS</span>${esc(def.name)}`;
    this.banner(`<small>${esc(def.title || 'Le chef de la horde')}</small>${esc(def.name)}`, 2400, 'boss');
    this.shake = 10;
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
      const sp = e.speed * (e.slow ? 0.5 : 1) * (e.freeze ? 0 : 1);
      let vx = dx / d * sp, vy = dy / d * sp;
      if (e.boss) [vx, vy] = this.bossAI(e, dt, dx / d, dy / d, d, sp);
      else if (e.ranged && d < 220) { vx = -vx * 0.4; vy = -vy * 0.4; }
      if (e.ranged && !e.freeze) {
        e.shootT -= dt;
        if (e.shootT <= 0 && d < 400) {
          e.shootT = rand(2.2, 3.2);
          this.eshots.push({ x: e.x, y: e.y, z: 20 + e.fly, vx: dx / d * 160, vy: dy / d * 160, r: 8, dmg: e.dmg * 0.9, life: 4 });
        }
      }
      this.grid.query(e.x, e.y, e.r * 2, near);
      for (const o of near) {
        if (o === e) continue;
        const ox = e.x - o.x, oy = e.y - o.y, od = Math.hypot(ox, oy), min = (e.r + o.r) * 0.7;
        if (od > 0 && od < min) { const f = (min - od) / od * 0.5; vx += ox * f * 8; vy += oy * f * 8; }
      }
      e.x += (vx + e.kx) * dt; e.y += (vy + e.ky) * dt;
      e.kx *= Math.pow(0.02, dt); e.ky *= Math.pow(0.02, dt);
      if (!e.freeze) e.ang = Math.atan2(dx, dy);
      if (!e.boss && d > SPAWN_R * 1.5) { const [nx, ny] = this.spawnPoint(); e.x = nx; e.y = ny; }
      // contact (on l'évite en sautant par-dessus les ennemis au sol)
      const overhead = !e.fly && p.h > 26 + (e.boss ? 60 : e.elite ? 16 : 0);
      if (d < e.r * 0.7 + p.r && !overhead) this.hurtPlayer(e.dmg, e);
    }
  }

  bossAI(e, dt, nx, ny, d, sp) {
    e.phaseT -= dt;
    switch (e.phase) {
      case 'chase':
        if (e.phaseT <= 0) {
          const r = Math.random();
          e.phase = r < 0.3 ? 'aim' : r < 0.55 ? 'stomp' : r < 0.78 ? 'ring' : 'summon';
          e.phaseT = e.phase === 'aim' || e.phase === 'stomp' ? 0.9 : 0.4;
          if (e.phase === 'aim') { e.dashX = nx; e.dashY = ny; }
          if (e.phase === 'stomp') this.msg('Sautez pour éviter l\'onde de choc !');
        }
        return [nx * sp, ny * sp];
      case 'aim':
        if (e.phaseT <= 0) { e.phase = 'dash'; e.phaseT = 0.6; sfx('hurt'); }
        return [0, 0];
      case 'dash':
        if (e.phaseT <= 0) { e.phase = 'chase'; e.phaseT = rand(2.2, 3.6); }
        return [e.dashX * 560, e.dashY * 560];
      case 'stomp': {
        const k = 1 - Math.max(0, e.phaseT) / 0.9;
        e.jumpH = Math.sin(k * Math.PI) * 140;
        if (e.phaseT <= 0) {
          e.jumpH = 0; e.phase = 'chase'; e.phaseT = rand(2.5, 3.8);
          this.waves.push({ x: e.x, y: e.y, r: e.r, max: 540, speed: 330, dmg: e.dmg * 0.9, hit: false });
          this.shake = 12; sfx('bonk'); buzz(50);
          this.burst(e.x, e.y, 30, 0, e.def.pal[1], 4);
        }
        return [nx * sp * 0.6, ny * sp * 0.6];
      }
      case 'ring': {
        const n = 14 + this.zone.id * 2;
        for (let i = 0; i < n; i++) { const a = i / n * TAU; this.eshots.push({ x: e.x, y: e.y, z: 40, vx: Math.cos(a) * 150, vy: Math.sin(a) * 150, r: 9, dmg: e.dmg * 0.6, life: 5 }); }
        e.phase = 'chase'; e.phaseT = rand(2.5, 4);
        return [0, 0];
      }
      case 'summon': {
        const mons = this.zone.monsters;
        for (let i = 0; i < 5 + this.zone.id; i++) { const a = i / 6 * TAU; this.addEnemy(mons[i % 4], i % 4, { x: e.x + Math.cos(a) * 90, y: e.y + Math.sin(a) * 90 }); }
        e.phase = 'chase'; e.phaseT = rand(3, 4.5);
        return [0, 0];
      }
    }
    return [nx * sp, ny * sp];
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
    if (p.inv > 0 || this.over) return;
    if (save.pet === 'brambi' && src && !src.dead) this.hitEnemy(src, p.atk * 1.2, { noCrit: true, color: '#ff9a3a' });
    if (p.shieldHit) { p.shieldHit = 0; p.inv = 0.5; this.fx.push({ type: 'ring', x: p.x, y: p.y, r: 40, life: 0.4, max: 0.4, color: '#a8d8ff' }); sfx('block'); return; }
    const d = Math.max(1, Math.round(dmg * (1 - p.armor)));
    p.hp -= d;
    p.inv = 0.5;
    this.shake = 6;
    this.hurtFlash = 0.25;
    this.text(p.x, p.y, 60, '-' + d, '#ff6a6a', 1.1);
    sfx('hurt'); buzz(30);
    if (p.hp <= 0) { p.hp = 0; this.die(); }
  }

  // ---------- Armes ----------
  nearest(maxD = 400, from = this.p) {
    if (this.boss && !this.boss.dead && dist2(this.boss, from) < (maxD + this.boss.r) ** 2) return this.boss;
    let best = null, bd = maxD * maxD;
    for (const e of this.enemies) { if (e.dead) continue; const d = dist2(e, from); if (d < bd) { bd = d; best = e; } }
    return best;
  }

  onScreen() {
    const p = this.p;
    return this.enemies.filter(e => !e.dead && dist2(e, p) < VIEW_R * VIEW_R);
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
          w.t = (lv >= 5 ? 1.05 : 1.45) * p.haste;
          const ang = Math.atan2(t.y - p.y, t.x - p.x);
          const dmg = A * 1.8 * (lv >= 2 ? 1.3 : 1) * (lv >= 5 ? 1.4 : 1);
          const width = (lv >= 3 ? 30 : 18) * area, len = 320 * area;
          for (const a of lv >= 4 ? [ang, ang + Math.PI] : [ang]) this.beam(p.x, p.y, a, len, width, dmg);
          sfx('perfect');
          break;
        }
        case 'arrows': {
          if (w.t > 0) break;
          const t = this.nearest(440); if (!t) { w.t = 0.2; break; }
          w.t = (lv >= 5 ? 0.42 : 0.58) * p.haste;
          const n = 1 + (lv >= 2) + (lv >= 5), ang = Math.atan2(t.y - p.y, t.x - p.x);
          for (let i = 0; i < n; i++) {
            const a = ang + (i - (n - 1) / 2) * 0.16;
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
          sfx('bonk');
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
          if (n) sfx('perfect');
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
      const hit = this.grid.query(m.x, m.y, 40).find(e => dist2(e, m) < (e.r + 12) ** 2);
      if (hit) {
        m.life = 0;
        this.fx.push({ type: 'ring', x: m.x, y: m.y, r: m.R, life: 0.35, max: 0.35, color: '#8aff5a' });
        this.burst(m.x, m.y, 14, 0, '#8aff5a');
        for (const e of this.grid.query(m.x, m.y, m.R + 30)) if (dist2(e, m) < (m.R + e.r * 0.5) ** 2) this.hitEnemy(e, m.dmg, { color: '#8aff5a' });
        sfx('bonk');
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
          sfx('bonk');
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
        if (e.dead) continue;
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
    if (e.dead) return;
    const crit = !o.noCrit && Math.random() < this.p.crit;
    const d = Math.max(1, Math.round(dmg * (crit ? 2 : 1) * rand(0.92, 1.08)));
    e.hp -= d;
    e.flash = 0.09;
    if (o.knock && !e.boss) { const k = o.knock * (e.elite ? 0.3 : 1); e.kx += (o.kx || 0) * k; e.ky += (o.ky || 0) * k; }
    if (this.texts.length < 60 && (!o.quiet || crit)) this.text(e.x + rand(-8, 8), e.y, e.r * 2.4 + e.fly, fmt(d), crit ? '#ffd54a' : (o.color || '#ffffff'), crit ? 1.4 : 1);
    if (this.hitSfxT <= 0 && !o.quiet) { sfx('tap'); this.hitSfxT = 0.07; }
    if (e.hp <= 0) this.kill(e);
  }

  kill(e) {
    e.dead = true;
    this.kills++;
    const p = this.p, z = this.zone;
    p.ult = Math.min(100, p.ult + (e.boss ? 0 : e.elite ? 12 : 1.2) * (save.pet === 'voidy' ? 2 : 1));
    save.stats.seen[e.def.name] = (save.stats.seen[e.def.name] || 0) + 1;
    this.burst(e.x, e.y, e.boss ? 70 : e.elite ? 26 : 7, e.fly + 10, e.def.pal[0], e.scale);
    const xp = (1 + Math.floor(z.id / 2)) * (e.elite ? 15 : 1);
    this.pickups.push({ type: 'xp', x: e.x, y: e.y, v: xp, spin: Math.random() * 6 });
    const luck = this.base.gold;
    if (Math.random() < (e.elite ? 1 : 0.06)) this.pickups.push({ type: 'gold', x: e.x + rand(-10, 10), y: e.y + rand(-10, 10), v: Math.max(1, Math.round((1 + z.id * 0.5) * (e.elite ? 8 : 1) * luck)) });
    if (Math.random() < 0.012) this.pickups.push({ type: 'heart', x: e.x, y: e.y });
    if (Math.random() < 0.003) this.pickups.push({ type: 'magnet', x: e.x, y: e.y });
    if (e.elite) { this.dropChest(e.x, e.y); sfx('loot'); }
    if (e.boss) this.win();
  }

  dropChest(x, y) {
    const mesh = this.makeChestMesh();
    mesh.position.set(x * S, this.gh(x, y), y * S);
    this.scene.add(mesh);
    this.dropChests.push({ x, y, mesh, open: false });
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
          if (it.type === 'xp') this.gainXp(it.v);
          if (it.type === 'gold') { this.gold += it.v; sfx('coin'); }
          if (it.type === 'heart') { const h = Math.round(p.maxHp * 0.25); p.hp = Math.min(p.maxHp, p.hp + h); this.text(p.x, p.y, 70, '+' + h, '#5ae87a', 1.2); sfx('heal'); }
          if (it.type === 'magnet') { for (const o of this.pickups) if (o.type === 'xp') o.pull = true; sfx('loot'); }
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
        sfx('ult'); buzz(40);
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
      p.xpNext = Math.round(4 + (p.level - 1) * 2.6 + Math.pow(p.level, 1.25));
      this.pending++;
    }
  }

  openChest(c) {
    if (this.paused) { c.open = false; return; }
    this.paused = true; this.joy = null; this.look = null;
    const ch = this.choices(1)[0];
    const g = Math.round((10 + this.zone.id * 6) * this.base.gold);
    this.gold += g;
    sfx('win');
    this.burst(c.x, c.y, 30, 20, '#ffd54a');
    c.mesh.userData.lid.rotation.x = -1.2; c.mesh.userData.lid.position.z = -0.35;
    c.mesh.userData.beam.visible = false;
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
      case 'poro': this.petT = 3; if (p.hp < p.maxHp) { const h = Math.max(1, Math.round(p.maxHp * 0.02)); p.hp = Math.min(p.maxHp, p.hp + h); this.text(p.x, p.y, 70, '+' + h, '#5ae87a'); } break;
      case 'herald': {
        this.petT = 1.1;
        const t = this.nearest(320, pet);
        if (t) { const a = Math.atan2(t.y - pet.y, t.x - pet.x); this.shots.push({ type: 'pet', x: pet.x, y: pet.y, z: 24, vx: Math.cos(a) * 400, vy: Math.sin(a) * 400, r: 8, dmg: p.atk * p.dmgMul * 0.9, pierce: 0, life: 1, hit: new Set() }); }
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
    this.banner(esc(ULTS[this.cls.ult].name), 900, 'ult');
  }

  // ---------- Fin ----------
  die() {
    if (this.over || this.dying) return;
    this.dying = true;
    this.paused = true; this.joy = null; this.look = null;
    sfx('lose'); buzz(80);
    setTimeout(() => this.onDefeat(!this.revived), 650);
  }

  revive() {
    const p = this.p;
    this.revived = true; this.dying = false;
    p.hp = p.maxHp; p.inv = 3;
    this.eshots = []; this.waves = [];
    for (const e of this.grid.query(p.x, p.y, 280)) if (!e.boss) this.hitEnemy(e, 1e7, { quiet: true, noCrit: true }); else { e.kx = (e.x - p.x) * 3; e.ky = (e.y - p.y) * 3; }
    this.fx.push({ type: 'ring', x: p.x, y: p.y, r: 280, life: 0.7, max: 0.7, color: '#5ae87a' });
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
    for (const e of this.enemies) if (!e.boss) { e.dead = true; this.burst(e.x, e.y, 3, e.fly, '#ffffff'); }
    for (const it of this.pickups) it.pull = true;
    setTimeout(() => this.finish(true), 1800);
  }

  finish(win) {
    if (this.over) return;
    this.destroy();
    this.onEnd({
      win, time: this.time, kills: this.kills, level: this.p.level, gold: this.gold, evo: this.p.evo,
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

  // ---------- Rendu 3D ----------
  gh(x, y) { return this.height(x, y) * S; }

  render(dt) {
    const p = this.p, t = this.time, cam = this.camera;
    const px = p.x * S, pz = p.y * S, gy = this.gh(p.x, p.y), py = gy + p.h * S;
    const bob = p.moving && p.h === 0 ? Math.abs(Math.sin(t * 13)) * 0.12 : 0;
    this.hero.position.set(px, py + bob, pz);
    // style « Paper Mario » : face à la caméra, se retourne selon la direction (gauche/droite à l'écran)
    const sideX = p.face.x * Math.cos(this.yaw) - p.face.y * Math.sin(this.yaw);
    if (Math.abs(sideX) > 0.2) this.heroFlip = sideX < 0 ? -1 : 1;
    this.heroTurn = (this.heroTurn ?? 1) + ((this.heroFlip ?? 1) - (this.heroTurn ?? 1)) * Math.min(1, (dt || 0) * 16);
    this.hero.rotation.y = this.yaw + (this.heroFlip ?? 1) * 0.35;
    this.hero.visible = !(p.inv > 0 && p.inv < 2.5 && !this.evoFlash && Math.floor(t * 20) % 2);
    this.heroMat.emissive.setRGB(this.hurtFlash * 3 + this.evoFlash * 0.8, this.evoFlash * 0.7, this.evoFlash * 0.2);
    const hs = 1 + Math.max(0, this.evoFlash - 0.6) * 0.8;
    this.hero.scale.set(hs * this.heroTurn, hs, hs);
    // caméra derrière le champion
    const dist = 15 + (this.boss && !this.boss.dead ? 4 : 0), hgt = 11;
    const sh = this.shake ? (Math.random() - 0.5) * this.shake * 0.04 : 0;
    const cx = px + Math.sin(this.yaw) * dist, cz = pz + Math.cos(this.yaw) * dist;
    const cy = Math.max(this.gh(cx / S, cz / S) + 3, gy + hgt);
    if (!this.camInit) { cam.position.set(cx, cy, cz); this.camInit = true; }
    cam.position.lerp(this.tv.set(cx + sh, cy + sh, cz), Math.min(1, dt * 8 || 0.2));
    cam.lookAt(px, gy + 1.6, pz);
    // familier
    if (this.petMesh) {
      const pt = this.pet;
      this.petMesh.position.set(pt.x * S, this.gh(pt.x, pt.y) + 0.6 + Math.abs(Math.sin(t * 9)) * 0.25, pt.y * S);
      this.petMesh.rotation.y = Math.atan2(p.x - pt.x, p.y - pt.y);
    }
    // ennemis
    for (const pool of this.enemyPools.values()) pool.begin();
    this.shadows.begin();
    this.shadows.add(px, gy + 0.05, pz, 0, 0.9);
    for (const e of this.enemies) {
      if (dist2(e, p) > (SPAWN_R + 200) ** 2) continue;
      const vs = e.scale * (e.boss ? 0.06 : 0.068);
      const egy = this.gh(e.x, e.y);
      const hop = e.fly ? e.fly * S + Math.sin(e.bob * 0.6) * 0.3 : Math.abs(Math.sin(e.bob)) * 0.06 * e.scale;
      e.pool.add(e.x * S, egy + hop + e.jumpH * S, e.y * S, e.ang, vs, e.flash > 0 ? 4 : e.freeze ? 1.7 : 1, 0, vs * (e.flash > 0 ? 0.85 : 1));
      this.shadows.add(e.x * S, egy + 0.05, e.y * S, 0, e.r * S * 1.3);
    }
    for (const pool of this.enemyPools.values()) pool.end();
    this.shadows.end();
    // objets au sol
    this.gems.begin(); this.coins.begin(); this.hearts.begin(); this.magnets.begin();
    for (const it of this.pickups) {
      if (dist2(it, p) > 900 * 900) continue;
      const y = this.gh(it.x, it.y) + 0.45 + Math.sin(t * 4 + it.x) * 0.1;
      if (it.type === 'xp') this.gems.add(it.x * S, y, it.y * S, t * 3 + (it.spin || 0), it.v >= 15 ? 1.6 : it.v >= 3 ? 1.2 : 1, it.v >= 15 ? '#ff5a8a' : it.v >= 3 ? '#5ae87a' : '#4fc8ff');
      else if (it.type === 'gold') this.coins.add(it.x * S, y, it.y * S, t * 4);
      else if (it.type === 'heart') this.hearts.add(it.x * S, y + 0.2, it.y * S, t * 2);
      else if (it.type === 'magnet') this.magnets.add(it.x * S, y + 0.2, it.y * S, t * 2);
    }
    this.gems.end(); this.coins.end(); this.hearts.end(); this.magnets.end();
    // tirs et effets
    for (const pl of this.pools) pl.begin();
    for (const s of this.shots) {
      const y = this.gh(s.x, s.y) + (s.z || 26) * S;
      const a = Math.atan2(-s.vy, s.vx);
      if (s.type === 'arrow') this.pArrow.add(s.x * S, y, s.y * S, a);
      else if (s.type === 'dagger') this.pDagger.add(s.x * S, y, s.y * S, a);
      else if (s.type === 'boom') { this.pBoom.add(s.x * S, y, s.y * S, s.spin, s.r / 15); this.pBoom2.add(s.x * S, y, s.y * S, s.spin, s.r / 15); }
      else if (s.type === 'snow') this.pSnow.add(s.x * S, this.gh(s.x, s.y) + s.z * S, s.y * S);
      else if (s.type === 'crystal') this.pCrystal.add(s.x * S, y + 0.5, s.y * S, a, 1.6, null, 0, 1.6);
      else this.pBall.add(s.x * S, y, s.y * S);
    }
    for (const s of this.eshots) this.pEnemyShot.add(s.x * S, this.gh(s.x, s.y) + s.z * S, s.y * S, 0, s.r / 9);
    for (const w of p.weapons) if (w.orbs && w.id === 'orbs') for (const [ox, oy] of w.orbs) this.pOrb.add(ox * S, this.gh(ox, oy) + 1.2, oy * S);
    for (const m of this.mines) this.pShroom.add(m.x * S, this.gh(m.x, m.y), m.y * S, 0, 1, m.arm > 0 ? '#8aa86a' : '#e04a4a');
    for (const q of this.parts) this.pPart.add(q.x * S, this.gh(q.x, q.y) + q.z * S, q.y * S, q.life * 8, q.s * Math.min(1, q.life * 2), q.c);
    for (const f of this.fx) {
      const k = f.life / f.max, fgy = this.gh(f.x, f.y);
      if (f.type === 'ring') this.pRing.add(f.x * S, fgy + 0.15, f.y * S, 0, f.r * S * (1 - k * 0.75), f.color);
      else if (f.type === 'beam') {
        const cx2 = Math.cos(f.a), cy2 = Math.sin(f.a), mx = f.x + cx2 * f.len / 2, my = f.y + cy2 * f.len / 2;
        const d = this.pBeam.d;
        d.position.set(mx * S, fgy + 1.3, my * S); d.rotation.set(0, Math.atan2(-cy2, cx2), 0);
        d.scale.set(f.len * S, Math.max(0.05, f.w * S * k), Math.max(0.05, f.w * S * k)); d.updateMatrix();
        this.pBeam.addMatrix(d.matrix);
      } else if (f.type === 'slash') this.pSlash.add(f.x * S, fgy + 1, f.y * S, Math.atan2(-Math.sin(f.a), Math.cos(f.a)) + (1 - k) * 1.5 - 0.75, f.r * S);
      else if (f.type === 'bolt') this.pBolt.add(f.x * S, fgy + 6, f.y * S, 0, k * 1.5 + 0.5, null, 0, 12);
    }
    for (const w of this.waves) this.pRing.add(w.x * S, this.gh(w.x, w.y) + 0.2, w.y * S, 0, w.r * S, '#ff5a3a');
    for (const pl of this.pools) pl.end();
    // aura
    const aura = p.weapons.find(w => w.id === 'aura');
    this.aura.visible = !!aura?.R;
    if (aura?.R) { this.aura.position.set(px, gy + 0.12, pz); this.aura.scale.setScalar(aura.R * S); }
    // coffres & autels
    for (const c of this.chests.concat(this.dropChests)) if (!c.open) { c.mesh.userData.beam.material.opacity = 0.12 + Math.sin(t * 3) * 0.06; c.mesh.rotation.y = Math.sin(t) * 0.15; }
    for (const s of this.shrines) {
      const m = s.mesh.userData;
      m.gem.rotation.y = t * 2; m.gem.position.y = 2.2 + Math.sin(t * 2 + s.x) * 0.2;
      m.fill.scale.setScalar(Math.max(0.01, s.charge));
      if (s.used && m.disc.visible) { m.gem.material = this.usedGemMat; m.disc.visible = false; m.fill.visible = false; }
    }
    this.renderer.render(this.scene, cam);
    this.render2d();
  }

  project(x, y, z) {
    const v = this.tv.set(x * S, this.gh(x, y) + z * S, y * S).project(this.camera);
    if (v.z > 1 || v.z < -1) return null;
    return [(v.x + 1) / 2 * this.vw, (1 - v.y) / 2 * this.vh];
  }

  render2d() {
    const g = this.g, p = this.p, vw = this.vw, vh = this.vh;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, vw, vh);
    // barre de vie sous le héros
    const hp = this.project(p.x, p.y, p.h - 6);
    if (hp) {
      const bw = 50, ratio = Math.max(0, p.hp / p.maxHp);
      g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(hp[0] - bw / 2 - 1, hp[1] + 4, bw + 2, 7);
      g.fillStyle = ratio < 0.3 ? '#ff7a4a' : '#5ae87a'; g.fillRect(hp[0] - bw / 2, hp[1] + 5, bw * ratio, 5);
    }
    for (const e of this.enemies) if (e.elite && !e.dead) {
      const s = this.project(e.x, e.y, e.r * 2.6 + e.fly); if (!s) continue;
      g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(s[0] - 26, s[1], 52, 6);
      g.fillStyle = '#c06aff'; g.fillRect(s[0] - 25, s[1] + 1, 50 * Math.max(0, e.hp / e.maxHp), 4);
    }
    g.textAlign = 'center';
    for (const c of this.chests) if (!c.open && dist2(c, p) < 340 * 340) {
      const s = this.project(c.x, c.y, 55); if (!s) continue;
      g.font = '800 13px ui-rounded, system-ui, sans-serif';
      g.fillStyle = 'rgba(10,6,20,.8)'; g.fillRect(s[0] - 30, s[1] - 14, 60, 20);
      g.fillStyle = this.gold >= this.chestCost ? '#ffd54a' : '#ff9a8a'; g.fillText(`${this.chestCost} or`, s[0], s[1] + 1);
    }
    for (const tx of this.texts) {
      const s = this.project(tx.x, tx.y, tx.z); if (!s) continue;
      g.globalAlpha = Math.min(1, tx.life * 3);
      g.font = `900 ${Math.round(15 * tx.size)}px ui-rounded, system-ui, sans-serif`;
      g.lineWidth = 3; g.strokeStyle = '#000'; g.strokeText(tx.txt, s[0], s[1]);
      g.fillStyle = tx.color; g.fillText(tx.txt, s[0], s[1]);
    }
    g.globalAlpha = 1;
    this.minimap(g, vw);
    if (this.ultFlash > 0) { g.fillStyle = `rgba(255,240,200,${this.ultFlash})`; g.fillRect(0, 0, vw, vh); }
    if (this.evoFlash > 0.6) { g.fillStyle = `rgba(255,250,220,${(this.evoFlash - 0.6) * 1.2})`; g.fillRect(0, 0, vw, vh); }
    if (this.hurtFlash > 0) { g.fillStyle = `rgba(255,40,60,${this.hurtFlash})`; g.fillRect(0, 0, vw, vh); }
    if (this.joy) {
      const j = this.joy, r = this.cv.getBoundingClientRect();
      const ox = j.ox - r.left, oy = j.oy - r.top;
      let kx = j.x - j.ox, ky = j.y - j.oy; const d = Math.hypot(kx, ky); if (d > 50) { kx *= 50 / d; ky *= 50 / d; }
      g.fillStyle = 'rgba(255,255,255,.12)'; g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2;
      g.beginPath(); g.arc(ox, oy, 54, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.arc(ox + kx, oy + ky, 24, 0, TAU); g.fill();
    }
  }

  minimap(g, vw) {
    const p = this.p, R = 44, cx = vw - R - 12, cy = 158, range = 900;
    g.save();
    g.beginPath(); g.arc(cx, cy, R, 0, TAU);
    g.fillStyle = 'rgba(10,6,20,.6)'; g.fill();
    g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 2; g.stroke();
    g.clip();
    // le haut de la mini-carte = la direction regardée par la caméra
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    const dot = (x, y, col, r) => {
      const dx = (x - p.x) / range * R, dy = (y - p.y) / range * R;
      g.fillStyle = col; g.beginPath(); g.arc(cx + dx * c - dy * s, cy + dx * s + dy * c, r, 0, TAU); g.fill();
    };
    for (const e of this.enemies) if (!e.boss && dist2(e, p) < range * range) dot(e.x, e.y, 'rgba(255,90,90,.6)', 1.3);
    for (const ch of this.chests) if (!ch.open) dot(ch.x, ch.y, '#ffc83a', 3);
    for (const ch of this.dropChests) if (!ch.open) dot(ch.x, ch.y, '#ffc83a', 3);
    for (const sh of this.shrines) if (!sh.used) dot(sh.x, sh.y, '#4fd0ff', 3.2);
    if (this.boss && !this.boss.dead) dot(this.boss.x, this.boss.y, '#ff2a4a', 4.5);
    g.restore();
    g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(cx, cy - 5); g.lineTo(cx + 4, cy + 4); g.lineTo(cx - 4, cy + 4); g.fill();
  }
}
