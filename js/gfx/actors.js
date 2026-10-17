// Personnages : héros articulé, familier, monstres (instanciés par espèce et par partie du corps),
// couronnes/auras des élites, « pop » des monstres vaincus et ombres au sol.
// Lit l'état du jeu (run) et ses événements ; ne le modifie jamais.
import * as THREE from '../../vendor/three.module.min.js';
import { PETS } from '../data.js';
import { S } from '../world3d.js';
import { Shape, toonMaterial, radialTexture, composeYXZ } from './models.js';
import { HeroModel, HERO_SCALE } from './heroes.js';
import { buildRig, Kind, Poser, animState } from './monsters.js';

const PI = Math.PI, TAU = PI * 2;
const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const angDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
const ease = k => k * k * (3 - 2 * k);
const backOut = k => { const c = 1.9; return 1 + (c + 1) * (k - 1) ** 3 + c * (k - 1) ** 2; };

const POP_T = 0.3;

function crownGeo() {
  const s = new Shape();
  const gold = '#ffd54a';
  s.put('cyl:12', gold, 0, 0, 0, 0.62, 0.16, 0.62, 0, 0, 0, { glow: 0.3 });
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * TAU;
    s.put('cone:4', gold, Math.cos(a) * 0.27, 0.2, Math.sin(a) * 0.27, 0.14, 0.26, 0.14, 0, a, 0, { glow: 0.3 });
    s.put('sph:6:4', i % 2 ? '#c06aff' : '#ff4a8a', Math.cos(a) * 0.31, 0.0, Math.sin(a) * 0.31, 0.08, 0.08, 0.06, 0, 0, 0, { glow: 0.9, grad: 0 });
  }
  return s.build();
}

export class Actors {
  constructor(gfx) {
    this.gfx = gfx;
    const run = gfx.run, scene = gfx.scene;
    this.run = run;
    this.scene = scene;
    this.mat = toonMaterial();
    // héros
    this.heroMat = toonMaterial({ emissive: new THREE.Color('#000000') });
    this.evo = run.p.evo;
    this.hero = new HeroModel(run.cls.id, this.evo, { material: this.heroMat });
    scene.add(this.hero.root);
    this.yaw = Math.atan2(run.p.face.x, run.p.face.y);
    this.turn = 0; this.spin = 0; this.wt = 0; this.wRef = null;
    this.atkYaw = 0; this.atkHold = 0;
    this.hx = run.p.x; this.hy = run.p.y; this.hspd = 0;
    // familier
    if (run.pet) {
      const pd = PETS[run.pet.id];
      this.petKind = new Kind(scene, this.mat, buildRig({ name: 'pet:' + run.pet.id, body: pd.body, pal: pd.pal }, { pet: true }), 1);
      this.petSt = animState(0.37);
    }
    // monstres : une espèce = un groupe d'InstancedMesh, créé à la première apparition
    this.kinds = new Map();
    this.kindList = []; // même contenu que kinds, parcouru sans itérateur à chaque image
    this.states = new WeakMap();
    // espèces de la zone construites dès le chargement (pas d'à-coup à leur première apparition)
    for (const def of run.zone.monsters) this.kindFor({ def, boss: false });
    this.kindFor({ def: run.zone.boss || run.zone.monsters[4], boss: true });
    this.crowns = new Kind(scene, this.mat, { parts: [{ geo: crownGeo(), n: 1 }] }, 24);
    const ringGeo = new THREE.PlaneGeometry(2, 2); ringGeo.rotateX(-PI / 2);
    this.auraMat = new THREE.MeshBasicMaterial({ map: ringTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.auras = new Kind(scene, this.auraMat, { parts: [{ geo: ringGeo, n: 1 }] }, 24);
    // monstres vaincus : petite animation « pop » (anneau de 48 emplacements réutilisés)
    this.deaths = Array.from({ length: 48 }, () => ({ on: false, kind: null, st: animState(), x: 0, y: 0, yaw: 0, s: 1, t0: 0, fly: 0 }));
    this.di = 0;
    this.clock = 0;
    // ombres douces
    const shadowGeo = new THREE.PlaneGeometry(2, 2); shadowGeo.rotateX(-PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({ map: radialTexture('rgba(0,0,0,0.42)', 'rgba(0,0,0,0)', 64, 0.35), transparent: true, depthWrite: false });
    this.shadows = new Kind(scene, shadowMat, { parts: [{ geo: shadowGeo, n: 1 }] }, 440);
    this.shadows.meshes[0].renderOrder = -1;
  }

  kindFor(e) {
    const key = e.def.name + (e.boss ? '!' : '');
    let k = this.kinds.get(key);
    if (!k) {
      k = new Kind(this.scene, this.mat, buildRig(e.def, { boss: e.boss }), e.boss ? 2 : 260);
      this.kinds.set(key, k);
      this.kindList.push(k);
    }
    return k;
  }

  stateFor(e) {
    let st = this.states.get(e);
    if (!st) { st = animState(); this.states.set(e, st); }
    return st;
  }

  // arme principale de la classe (son minuteur révèle chaque attaque)
  mainWeapon() {
    const id = this.run.cls.weapon;
    if (this.wRef && this.run.p.weapons.includes(this.wRef)) return this.wRef;
    this.wRef = this.run.p.weapons.find(w => w.id === id) || null;
    if (this.wRef) this.wt = this.wRef.t;
    return this.wRef;
  }

  // direction de l'attaque qui vient de partir (coup d'épée, rayon ou flèche le plus récent)
  attackYaw() {
    const run = this.run, kind = run.cls.weapon;
    let best = -1, yaw = null;
    if (kind === 'sword' || kind === 'beam') {
      const type = kind === 'sword' ? 'slash' : 'beam';
      for (const f of run.fx) if (f.type === type && f.life / f.max > best) { best = f.life / f.max; yaw = Math.atan2(Math.cos(f.a), Math.sin(f.a)); }
    } else {
      for (const s of run.shots) if (s.type === 'arrow' && s.life > best) { best = s.life; yaw = Math.atan2(s.vx, s.vy); }
    }
    if (yaw === null) {
      const p = run.p; let bd = Infinity;
      for (const e of run.enemies) { const d = dist2(e, p); if (!e.dead && d < bd) { bd = d; yaw = Math.atan2(e.x - p.x, e.y - p.y); } }
    }
    return yaw;
  }

  onEvents(events) {
    const hero = this.hero;
    for (const ev of events) {
      switch (ev.type) {
        case 'jump': hero.jump(); break;
        case 'land': hero.land(); break;
        case 'hurt': hero.hurt(); break;
        case 'die': hero.die(); break;
        case 'revive': hero.revive(); break;
        case 'win': hero.win(); break;
        case 'hit': { const st = this.states.get(ev.e); if (st) st.hit = 1; break; }
        case 'bossStomp': { const st = this.states.get(ev.e); if (st) st.impact = 1; break; }
        case 'kill': this.pop(ev.e); break;
      }
    }
  }

  pop(e) {
    const st = this.states.get(e);
    if (!st) return;
    const d = this.deaths[this.di]; this.di = (this.di + 1) % this.deaths.length;
    d.on = true; d.kind = this.kindFor(e); Object.assign(d.st, st);
    d.st.atk = -1; d.st.atkK = 0; d.st.hit = 0;
    d.x = e.x; d.y = e.y; d.yaw = st.yaw; d.s = e.scale * (e.boss ? 1.08 : 1.12); d.t0 = this.clock;
    d.fly = d.kind.rig.fly ? e.fly * S : 0;
  }

  // view : { camX, camZ, camFx, camFz, camBack } (calculé par la caméra)
  update(dt, view, events = []) {
    dt = dt || 0;
    this.clock += dt;
    const run = this.run, gfx = this.gfx, p = run.p;
    if (p.evo !== this.evo) { this.evo = p.evo; this.hero.setEvo(p.evo); this.spin = 1; }
    this.onEvents(events);
    this.updateHero(dt);
    const kl = this.kindList;
    for (let i = 0; i < kl.length; i++) kl[i].begin();
    this.crowns.begin(); this.auras.begin(); this.shadows.begin();
    const sh = this.shadows;
    // ombre du héros (rétrécit quand il saute)
    const hgy = gfx.gh(p.x, p.y), hk = 1 / (1 + p.h * 0.012);
    this.shadow(p.x * S, hgy, p.y * S, 0.95 * HERO_SCALE[this.evo] * hk, 1);
    this.updatePet(dt);
    this.updateMonsters(dt, view);
    this.updateDeaths();
    for (let i = 0; i < kl.length; i++) kl[i].end();
    this.crowns.end(); this.auras.end(); sh.end();
  }

  shadow(x, gy, z, r, alpha = 1) {
    Poser.kind = this.shadows;
    Poser.col.setScalar(alpha);
    composeYXZ(Poser.R, x, gy + 0.05, z, 0, 0, 0, r, 1, r);
    Poser.part(0, Poser.R, 0, 0, 0, 0, 0, 0, 1, 1, 1);
  }

  updateHero(dt) {
    const run = this.run, p = run.p, hero = this.hero, gfx = this.gfx, t = run.time;
    // attaque : le minuteur de l'arme principale vient d'être relancé
    const w = this.mainWeapon();
    if (w) {
      if (w.t > this.wt + 0.05 && dt > 0) {
        const y = this.attackYaw();
        if (y !== null) { this.atkYaw = y; this.atkHold = 0.6; hero.attack(angDiff(this.yaw, y)); }
      }
      this.wt = w.t;
    }
    this.atkHold = Math.max(0, this.atkHold - dt);
    // cap : direction de course, ou vers la cible quand on est immobile
    const d = Math.hypot(p.x - this.hx, p.y - this.hy);
    this.hx = p.x; this.hy = p.y;
    if (dt > 0) this.hspd = damp(this.hspd, clamp(d / dt / Math.max(60, p.speed), 0, 1.5), 12, dt);
    const moveYaw = Math.atan2(p.face.x, p.face.y);
    const tgt = p.moving ? moveYaw : this.atkHold > 0 ? this.atkYaw : this.yaw;
    const prev = this.yaw;
    this.yaw += angDiff(this.yaw, tgt) * (1 - Math.exp(-(p.moving ? 12 : 8) * dt));
    if (dt > 0) this.turn = damp(this.turn, angDiff(prev, this.yaw) / dt, 10, dt);
    if (this.atkHold > 0) hero.atkYaw = clamp(angDiff(this.yaw, this.atkYaw), -1.6, 1.6);
    // tourbillon d'évolution
    this.spin = Math.max(0, this.spin - dt / 0.9);
    const spinA = this.spin > 0 ? (1 - ease(this.spin)) * TAU : 0;
    const gy = gfx.gh(p.x, p.y);
    hero.root.position.set(p.x * S, gy + p.h * S, p.y * S);
    hero.root.rotation.y = this.yaw + spinA;
    const pop = 1 + Math.max(0, run.evoFlash - 0.6) * 0.8;
    hero.root.scale.setScalar(HERO_SCALE[this.evo] * pop);
    hero.root.visible = !(p.inv > 0 && p.inv < 2.5 && !run.evoFlash && Math.floor(t * 20) % 2);
    this.heroMat.emissive.setRGB(run.hurtFlash * 2.4 + run.evoFlash * 0.8, run.evoFlash * 0.7 + run.hurtFlash * 0.2, run.evoFlash * 0.2 + run.hurtFlash * 0.25);
    hero.update(dt, { moving: p.moving && this.hspd > 0.05, speed: Math.max(this.hspd, p.moving ? 0.6 : 0), air: p.h * S, turn: this.turn });
  }

  updatePet(dt) {
    const run = this.run, pt = run.pet;
    if (!pt || !this.petKind) return;
    const st = this.petSt, p = run.p, rig = this.petKind.rig;
    if (!st.init) { st.init = true; st.px = pt.x; st.py = pt.y; }
    const dx = pt.x - st.px, dy = pt.y - st.py, d = Math.hypot(dx, dy);
    st.px = pt.x; st.py = pt.y;
    st.t += dt;
    if (dt > 0) st.spd = damp(st.spd, clamp(d / dt / 120, 0, 1.4), 8, dt);
    st.ph += d * S * rig.stride * 1.1 + dt * 1.5;
    const tgt = st.spd > 0.15 ? Math.atan2(dx, dy) : Math.atan2(p.x - pt.x, p.y - pt.y);
    st.yaw += angDiff(st.yaw, tgt) * (1 - Math.exp(-8 * dt));
    st.breath = Math.sin(st.t * 3) * (1 - Math.min(1, st.spd));
    const gy = this.gfx.gh(pt.x, pt.y);
    const y = gy + (rig.fly ? 0.9 + Math.sin(st.t * 2.4) * 0.12 : 0);
    const s = 0.8;
    Poser.kind = this.petKind; Poser.col.setScalar(1);
    this.petKind.begin();
    composeYXZ(Poser.R, pt.x * S, y, pt.y * S, 0.1 * st.spd, st.yaw, 0, s, s, s);
    rig.pose(Poser, st);
    this.petKind.end();
    this.shadow(pt.x * S, gy, pt.y * S, rig.fly ? 0.3 : 0.4);
  }

  updateMonsters(dt, view) {
    const run = this.run, gfx = this.gfx, p = run.p, t = run.time;
    const far = (run.SPAWN_R + 200) ** 2;
    const contact = p.r + 26;
    for (const e of run.enemies) {
      if (e.dead || dist2(e, p) > far) continue;
      const kind = this.kindFor(e), rig = kind.rig, st = this.stateFor(e);
      // ---- état d'animation ----
      if (!st.init) { st.init = true; st.px = e.x; st.py = e.y; st.yaw = e.ang; st.shoot = e.shootT || 0; }
      const fr = e.freeze > 0, ldt = fr ? 0 : dt;
      const d = Math.hypot(e.x - st.px, e.y - st.py);
      st.px = e.x; st.py = e.y;
      st.t += ldt;
      if (dt > 0) st.spd = damp(st.spd, fr ? 0 : clamp(d / dt / Math.max(30, e.speed), 0, 1.6), 8, dt);
      if (!fr) st.ph += d * S / (e.scale * 1.1) * rig.stride + ldt * 0.8;
      const py = st.yaw;
      if (!fr) st.yaw += angDiff(st.yaw, e.ang) * (1 - Math.exp(-10 * dt));
      if (dt > 0) st.turn = damp(st.turn, angDiff(py, st.yaw) / dt, 8, dt);
      st.breath = Math.sin(st.t * 2.4 + st.seed) * (1 - Math.min(1, st.spd));
      if (st.atk >= 0) { st.atk += ldt * (e.boss ? 1.8 : 2.6); if (st.atk >= 1) st.atk = -1; }
      else if (!fr && dist2(e, p) < (e.r * 0.7 + contact) ** 2) st.atk = 0;
      st.atkK = st.atk >= 0 ? Math.sin(st.atk * PI) : 0;
      if (e.ranged) { if ((e.shootT || 0) > st.shoot + 0.5) st.cast = 1; st.shoot = e.shootT || 0; }
      st.cast = Math.max(0, st.cast - dt * 2.5);
      if (e.boss) {
        // rugissement menaçant de temps en temps pendant la poursuite
        st.roar = (st.roar || 0) + (e.phase === 'chase' ? ldt : 0);
        if (st.roar > 6.5) st.roar = 0;
        const roar = st.roar < 1 ? Math.sin(st.roar * PI) * 0.75 : 0;
        st.breath *= 1.8;
        st.aim = Math.max(damp(st.aim, e.phase === 'aim' ? 1 : 0, 10, dt), roar);
        st.dash = damp(st.dash, e.phase === 'dash' ? 1 : 0, 12, dt);
        st.tuck = damp(st.tuck, e.phase === 'stomp' ? 1 : 0, 10, dt);
      }
      st.impact = Math.max(0, st.impact - dt * 3);
      st.hit = Math.max(0, st.hit - dt * 6);
      // les monstres entre l'objectif et le héros ne sont pas dessinés pour ne pas boucher la vue
      const rx = e.x * S - view.camX, rz = e.y * S - view.camZ;
      const along = rx * view.camFx + rz * view.camFz, lat = Math.abs(rx * -view.camFz + rz * view.camFx);
      if (along < 4.5 || (along < view.camBack - 0.6 && lat < 2 + e.scale * 0.25)) continue;
      // ---- racine : apparition qui sort du sol, écrasement, élan des boss ----
      const egy = gfx.gh(e.x, e.y);
      const rise = clamp((t - e.born) / 0.5, 0, 1);
      const rs = 0.25 + 0.75 * backOut(rise);
      const base = e.scale * (e.boss ? 1.08 : 1.12) * rs;
      const sq = st.hit * 0.13 + st.impact * 0.3 + st.aim * 0.1;
      const sy = base * (1 - sq + st.dash * 0.08), sxz = base * (1 + sq * 0.6 - st.dash * 0.04);
      const fly = rig.fly ? e.fly * S + Math.sin(e.bob * 0.6) * 0.25 : 0;
      const y = egy + fly + e.jumpH * S - (1 - rise) * (e.boss ? 4 : 1.3);
      const tremble = st.aim > 0.05 ? Math.sin(t * 55) * 0.04 * st.aim : 0;
      const pitch = 0.08 * Math.min(1, st.spd) + st.dash * 0.4 - st.aim * 0.25;
      const roll = clamp(-st.turn * 0.07, -0.3, 0.3) + tremble;
      const c = Poser.col;
      if (e.flash > 0) c.setScalar(3.2);
      else if (e.freeze > 0) c.setRGB(0.72, 1.15, 1.9);
      else if (e.slow > 0) c.setRGB(0.86, 0.98, 1.3);
      else c.setScalar(1);
      Poser.kind = kind;
      composeYXZ(Poser.R, e.x * S, y, e.y * S, pitch, st.yaw + tremble, roll, sxz, sy, sxz);
      rig.pose(Poser, st);
      // ombre (plus petite et claire sous les volants)
      this.shadow(e.x * S, egy, e.y * S, e.r * S * 1.35 * rs, rig.fly ? 0.65 : 1);
      // élites : couronne qui tourne au-dessus de la tête + aura violette au sol
      if (e.elite || e.boss) {
        if (e.elite) {
          Poser.kind = this.crowns; Poser.col.setScalar(1);
          const cs = base * 0.32;
          composeYXZ(Poser.R, e.x * S, y + rig.top * sy + 0.35 + Math.sin(t * 3 + st.seed) * 0.12, e.y * S, 0.15, t * 1.5, 0, cs, cs, cs);
          Poser.part(0, Poser.R, 0, 0, 0, 0, 0, 0, 1, 1, 1);
        }
        Poser.kind = this.auras;
        if (e.boss) Poser.col.setRGB(1, 0.25 + st.aim * 0.5, 0.2); else Poser.col.setRGB(0.75, 0.35, 1);
        const ar = e.r * S * (e.boss ? 1.9 : 2.1) * (1 + Math.sin(t * 4 + st.seed) * 0.06) * rs;
        composeYXZ(Poser.R, e.x * S, egy + 0.08, e.y * S, 0, t * 0.8, 0, ar, 1, ar);
        Poser.part(0, Poser.R, 0, 0, 0, 0, 0, 0, 1, 1, 1);
      }
    }
  }

  // les monstres vaincus gonflent puis disparaissent d'un coup (« pop »)
  updateDeaths() {
    const gfx = this.gfx;
    for (const d of this.deaths) {
      if (!d.on) continue;
      const k = (this.clock - d.t0) / POP_T;
      if (k >= 1) { d.on = false; continue; }
      const sc = d.s * (k < 0.35 ? 1 + 0.38 * ease(k / 0.35) : 1.38 * Math.pow(1 - (k - 0.35) / 0.65, 1.6));
      if (sc < 0.02) continue;
      Poser.kind = d.kind;
      Poser.col.setScalar(1 + 2.6 * (1 - k));
      composeYXZ(Poser.R, d.x * S, gfx.gh(d.x, d.y) + d.fly + k * 0.6, d.y * S, 0, d.yaw + k * 1.5, 0, sc * (1 + k * 0.2), sc * (1 - k * 0.15), sc * (1 + k * 0.2));
      d.kind.rig.pose(Poser, d.st);
    }
  }
}

// anneau lumineux des élites / boss (texture générée en code)
let ringTex = null;
function ringTexture() {
  if (ringTex) return ringTex;
  const N = 128, cv = document.createElement('canvas');
  cv.width = cv.height = N;
  const g = cv.getContext('2d');
  const gr = g.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
  gr.addColorStop(0, 'rgba(255,255,255,0.0)');
  gr.addColorStop(0.5, 'rgba(255,255,255,0.12)');
  gr.addColorStop(0.78, 'rgba(255,255,255,0.75)');
  gr.addColorStop(0.86, 'rgba(255,255,255,0.25)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, N, N);
  g.fillStyle = 'rgba(255,255,255,0.85)';
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * TAU, x = N / 2 + Math.cos(a) * N * 0.4, y = N / 2 + Math.sin(a) * N * 0.4;
    g.beginPath(); g.arc(x, y, 3.2, 0, TAU); g.fill();
  }
  ringTex = new THREE.CanvasTexture(cv);
  ringTex.colorSpace = THREE.SRGBColorSpace;
  return ringTex;
}
