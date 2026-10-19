// Rendu 3D low-poly d'une partie, façon Megabonk : caméra haute de trois quarts à orientation FIXE (jamais de
// rotation, pas de zoom qui pompe), suivi doux, rendu WebGL en basse résolution (effet pixel) sous un calque 2D
// net (chiffres, flèches, mini-carte, joystick). Le jeu (run.js) ne connaît que :
// new Gfx(run, canvas), gfx.resize(), gfx.render(dt), gfx.dispose().
import { THREE, S, TAU, PITCH, clamp, col, backOut } from './kit.js';
import { World3D, LOOK } from './world.js';
import { Fx } from './fx.js';
import { Objects } from './objects.js';
import { Overlay } from './overlay.js';
import { save } from '../save.js';
import { PETS } from '../data.js';
import * as SI from './stand-in.js';
import { RIM } from './models-kit.js';
export { zoneBannerURL } from './world.js';

// personnages : js/g3d/models.js (agent des personnages) s'il est là, sinon les modèles provisoires
let M = SI;
try { const m = await import('./models.js'); if (m && m.heroModel && m.MonsterPool) M = m; } catch (e) { /* modèles provisoires */ }

let sup = null;
export function supported() {
  if (sup !== null) return sup;
  try {
    const c = document.createElement('canvas'), gl = c.getContext('webgl2');
    sup = !!gl;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch (e) { sup = false; }
  return sup;
}

const FOV = 32, VIEW_W = 22; // ≈ 460 px de large au niveau du héros (écran portrait)

export class Gfx {
  constructor(run, canvas) {
    this.run = run;
    this.cv = canvas;
    this.t = 0; this.dt = 0;
    this.quality = 1; this.frameMs = 16; this.slowT = 0;
    // toile WebGL sous la toile 2D (qui garde les entrées et l'interface dessinée)
    const c3 = this.c3 = document.createElement('canvas');
    c3.className = 'cv3d';
    Object.assign(c3.style, { position: 'absolute', left: '0', top: '0', width: '100%', height: '100%', display: 'block', zIndex: '0', imageRendering: 'pixelated', pointerEvents: 'none' });
    canvas.parentNode.insertBefore(c3, canvas);
    const R = this.renderer = new THREE.WebGLRenderer({ canvas: c3, antialias: false, alpha: false, stencil: true, powerPreference: 'high-performance' });
    R.autoClear = false;
    R.info.autoReset = false; // les statistiques couvrent toute l'image (3 passes)
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 2, 400);
    this.camera.rotation.set(-PITCH, 0, 0);
    // lumières : ciel + soleil chaud, brouillard pour la profondeur
    const L = this.look = LOOK[run.zone.bg] || LOOK.lane;
    RIM.c.value.set(L.rim || '#fff4e0'); RIM.w.value = L.rimW ?? 0.35; // reflet de bord des personnages, par monde
    this.fogC = col(L.fog).clone(); this.skyC = col(L.sky).clone();
    this.scene.background = this.fogC.clone();
    this.scene.fog = new THREE.Fog(this.fogC.clone(), 80, 200);
    this.hemi = new THREE.HemisphereLight(this.skyC.clone(), col(L.grd), L.hemi);
    this.sun = new THREE.DirectionalLight(col(L.sun), L.sunI);
    this.sun.position.set(-0.55, 1, 0.45);
    this.scene.add(this.hemi, this.sun);
    if (L.dark) { this.lamp = new THREE.PointLight(col(L.dark && run.zone.bg === 'void' ? '#ffd0ff' : '#c8fff0'), 26, 16, 1.2); this.scene.add(this.lamp); }
    // monde : le décor évite les points d'intérêt (coffres, autels, totems, autel du boss, centre)
    const avoid = [...run.chests, ...run.shrines, ...(run.totems || []), ...run.pickups.filter(i => i.type === 'loot'), { x: 0, y: 0, r: 170 }, ...(run.altar ? [{ x: run.altar.x, y: run.altar.y, r: 200 }] : [])];
    this.world = new World3D(this.scene, run.zone, avoid);
    this.fx = new Fx(this);
    this.obj = new Objects(this);
    // héros, familier, monstres
    const p = run.p;
    this.heroEvo = Math.max(0, Math.min(4, p.evo | 0));
    this.hero = M.heroModel(run.cls.id, this.heroEvo);
    this.scene.add(this.hero.root);
    this.layer(this.hero.root);
    // silhouette du héros quand le décor le cache (repère le pochoir des pixels où il est visible, puis
    // dessine le reste de sa silhouette en bleu là où il est derrière quelque chose)
    this.markMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, depthFunc: THREE.LessEqualDepth, fog: false, stencilWrite: true, stencilRef: 1, stencilFunc: THREE.AlwaysStencilFunc, stencilZPass: THREE.ReplaceStencilOp });
    this.xrayMat = new THREE.MeshBasicMaterial({ color: col('#6ab8ff'), transparent: true, opacity: 0.6, depthWrite: false, depthFunc: THREE.GreaterDepth, fog: false, stencilWrite: true, stencilRef: 1, stencilFunc: THREE.NotEqualStencilFunc, stencilZPass: THREE.ReplaceStencilOp });
    this.hs = { hurt: 0, atk: 0, atkA: 0, face: -Math.PI / 2 };
    this.pet = null;
    if (run.pet) { try { this.pet = M.petModel(run.pet.id, PETS[run.pet.id]); this.scene.add(this.pet.root); } catch (e) { this.pet = null; } }
    this.pools = new Map();
    this.pops = [];
    for (const d of run.zone.monsters) { this.pool(d, 'n'); if (d.elite) this.pool(d, 'e'); }
    this.ms = { x: 0, y: 0, z: 0, rot: 0, scale: 1, flash: 0, freeze: false, mad: false, anim: 0, sq: 0, alpha: 1 };
    // caméra
    this.cam = { x: p.x, y: p.y, lx: 0, ly: 0, z: 1 };
    this.v3 = new THREE.Vector3();
    this.overlay = new Overlay(this, canvas);
    this.resize();
    this.world.refresh(p.x, p.y);
  }

  // groupe d'instances d'un type de monstre (créé une fois par monde)
  pool(def, v) {
    const key = def.name + v;
    let P = this.pools.get(key);
    if (!P) { P = new M.MonsterPool(this.scene, def, v, v === 'b' ? 3 : v === 'e' ? 40 : 280); this.pools.set(key, P); }
    return P;
  }

  resize() {
    const cv = this.cv;
    const vw = cv.clientWidth || window.innerWidth, vh = cv.clientHeight || window.innerHeight;
    this.vw = vw; this.vh = vh;
    const dpr = window.devicePixelRatio || 1;
    // effet pixel : la 3D est rendue à ~55 % des pixels de l'écran puis agrandie sans lissage
    this.pr = clamp(dpr * 0.55, 0.7, 1.6) * this.quality;
    this.renderer.setPixelRatio(this.pr);
    this.renderer.setSize(vw, vh, false);
    const cam = this.camera, asp = vw / Math.max(1, vh);
    cam.aspect = asp; cam.updateProjectionMatrix();
    this.D = VIEW_W / (2 * Math.tan(FOV / 2 * Math.PI / 180) * Math.min(asp, 1));
    this.scene.fog.near = this.D * 0.92; this.scene.fog.far = this.D * (this.look.dark ? 2.0 : 2.6) / (this.look.fogK || 1);
    this.overlay.resize(vw, vh);
  }

  // si l'appareil peine, on baisse la résolution de la 3D (l'interface reste nette)
  perf(dt) {
    if (!dt) return;
    this.frameMs += (dt * 1000 - this.frameMs) * 0.05;
    if (this.frameMs > 23 && this.quality > 0.62) {
      this.slowT += dt;
      if (this.slowT > 2.5) { this.slowT = 0; this.quality = Math.max(0.6, this.quality - 0.15); this.resize(); }
    } else this.slowT = 0;
  }

  // caméra haute fixe : suit le héros en douceur avec un peu d'avance, ne tourne jamais
  updateCamera(dt) {
    const run = this.run, p = run.p, c = this.cam, d = dt || 0.016;
    const k = 1 - Math.exp(-d * 2.4), lt = p.moving ? 38 : 0;
    c.lx += (p.face.x * lt - c.lx) * k; c.ly += (p.face.y * lt * 0.8 - c.ly) * k;
    const f = 1 - Math.exp(-d * 6.5);
    if (Math.abs(p.x - c.x) > 600 || Math.abs(p.y - c.y) > 600) { c.x = p.x; c.y = p.y; c.lx = c.ly = 0; } // téléporté
    c.x += (p.x + c.lx - c.x) * f; c.y += (p.y + c.ly - c.y) * f;
    // très léger recul pendant le combat de boss (l'arène est grande), lent : jamais de pompage
    const zt = run.boss && !run.boss.dead ? 1.12 : 1;
    c.z += (zt - c.z) * (1 - Math.exp(-d * 0.8));
    const sm = [0, 0.5, 1][save.settings?.shake ?? 2] ?? 1;
    if (this.kick > 0) this.kick = Math.max(0, this.kick - d * 14);
    const shk = Math.min(6, ((run.shake || 0) + (this.kick || 0)) * 0.45) * sm * S;
    const sx = shk ? Math.sin(this.t * 61) * shk : 0, sz = shk ? Math.cos(this.t * 47) * shk : 0;
    const D = this.D * c.z, cam = this.camera;
    cam.position.set(c.x * S + sx, Math.sin(PITCH) * D + sz * 0.5, c.y * S + Math.cos(PITCH) * D + sz);
    cam.updateMatrixWorld();
  }

  // pixels d'écran (CSS) par pixel du jeu, au niveau du héros
  ppu() { const D = this.D * this.cam.z, w = 2 * D * Math.tan(FOV / 2 * Math.PI / 180) * this.camera.aspect; return this.vw * S / w; }

  // monde → écran (px CSS) ; h = hauteur au-dessus du sol (px du jeu)
  ws(x, y, h = 0) {
    const v = this.v3.set(x * S, h * S, y * S).project(this.camera);
    return [(v.x + 1) * 0.5 * this.vw, (1 - v.y) * 0.5 * this.vh, v.z < 1];
  }

  render(dt) {
    const run = this.run;
    this.t += dt; this.dt = dt;
    this.perf(dt);
    const events = run.events.splice(0);
    for (const ev of events) { this.onEvent(ev); this.fx.onEvent(ev); this.obj.onEvent?.(ev); this.overlay.onEvent(ev); }
    this.updateCamera(dt);
    this.world.follow(this.cam.x, this.cam.y);
    this.world.update(dt, this.t, this.cam.x * S, this.cam.y * S);
    this.mood(dt);
    this.fx.begin();
    this.drawHero(dt);
    this.drawMonsters(dt);
    this.obj.update(dt);
    this.fx.update(dt);
    this.fx.end();
    const R = this.renderer;
    R.info.reset();
    R.clear();
    R.render(this.scene, this.camera);
    this.xray();
    this.overlay.render(dt);
  }

  // le héros est aussi sur le calque 1 (passes de la silhouette) : seulement ses pièces opaques (l'aura, son halo
  // au sol et ses étincelles, transparents, dessineraient sinon un grand rectangle bleu derrière le chemin)
  layer(o) { o.traverse(c => { if (c.isMesh && !c.material?.transparent) c.layers.enable(1); else c.layers.disable(1); }); }
  xray() {
    const R = this.renderer, sc = this.scene, cam = this.camera, run = this.run;
    if (run.dying || !this.hero.root.visible) return;
    const bg = sc.background;
    sc.background = null;
    R.clearStencil();
    cam.layers.set(1);
    sc.overrideMaterial = this.markMat; R.render(sc, cam);
    sc.overrideMaterial = this.xrayMat; R.render(sc, cam);
    sc.overrideMaterial = null; cam.layers.set(0);
    sc.background = bg;
  }

  onEvent(ev) {
    const hs = this.hs;
    if (ev.type === 'hurt') hs.hurt = 0.16;
    else if (ev.type === 'hit') ev.e.g_sq = 1;
    else if (ev.type === 'kill') this.pops.push({ e: ev.e, t: 0, max: ev.e.boss ? 0.5 : 0.16, x: ev.e.x, y: ev.e.y });
    else if (ev.type === 'elite' && ev.e) ev.e.g_new = 1;
    else if (ev.type === 'enemyDash' || ev.type === 'bossDash') ev.e.g_trail = 0.5;
    else if (ev.type === 'director') this.phase = ev.phase;
  }

  // ambiance : la folie (chrono écoulé) rougit le ciel et la brume ; lampe du héros dans les mondes sombres
  // pic de la horde (rythme des vagues) : lumière un peu plus chaude et plus sombre, le temps du pic
  mood(dt) {
    const run = this.run, L = this.look, ot = run.overtime > 0 ? Math.min(1, 0.35 + (run.otLevel || 1) * 0.09) : 0;
    this.otK = (this.otK || 0) + (ot - (this.otK || 0)) * Math.min(1, dt * 2);
    const sp = this.phase === 'spike' && !ot ? 1 : 0;
    this.spK = (this.spK || 0) + (sp - (this.spK || 0)) * Math.min(1, dt * 1.5);
    const k = this.otK, s = this.spK;
    const fogT = col(L.fog), red = col('#5a0a10');
    this.scene.fog.color.copy(fogT).lerp(red, k * 0.75 + s * 0.12);
    this.scene.background.copy(this.scene.fog.color);
    this.hemi.color.copy(col(L.sky)).lerp(col('#ff7a5a'), k * 0.55 + s * 0.15);
    this.hemi.intensity = L.hemi * (1 - k * 0.22 - s * 0.06);
    this.sun.color.copy(col(L.sun)).lerp(col('#ff6a4a'), k * 0.6 + s * 0.15);
    this.sun.intensity = L.sunI * (1 - k * 0.1);
    // folie : le brouillard se resserre, le bord des monstres rougeoie
    const f = this.scene.fog, far = this.D * (L.dark ? 2.0 : 2.6) / (L.fogK || 1);
    f.far = far * (1 - k * 0.22); f.near = this.D * 0.92 * (1 - k * 0.2);
    RIM.c.value.copy(col(L.rim || '#fff4e0')).lerp(col('#ff4a2a'), k * 0.8);
    RIM.w.value = (L.rimW ?? 0.35) + k * 0.3;
    if (this.lamp) { const p = run.p; this.lamp.position.set(p.x * S, 5, p.y * S + 2.5); }
  }

  // ---------- Héros et familier ----------
  drawHero(dt) {
    const run = this.run, p = run.p, hs = this.hs, H = this.hero, fx = this.fx;
    const evo = Math.max(0, Math.min(4, p.evo | 0));
    if (evo !== this.heroEvo) { this.heroEvo = evo; H.setEvo?.(evo); this.layer(H.root); }
    // attaque : repérée sur les effets et les tirs du héros
    for (const f of run.fx) if (!f.g_seen) { f.g_seen = 1; if (f.type === 'slash' || f.type === 'beam') { hs.atk = 1; hs.atkA = f.a; } }
    for (const s of run.shots) if (!s.g_seen) { s.g_seen = 1; if ((s.type === 'arrow' || s.type === 'crystal') && hs.atk < 0.9) { hs.atk = 1; hs.atkA = Math.atan2(s.vy, s.vx); } }
    const cls = run.cls.id;
    if (hs.atk > 0) hs.atk = Math.max(0, hs.atk - dt * (cls === 'archer' ? 3 : cls === 'mage' ? 4 : 5));
    if (p.moving || Math.hypot(p.face.x, p.face.y) > 0.1) hs.face = Math.atan2(p.face.y, p.face.x);
    if (hs.hurt > 0) hs.hurt -= dt;
    const blink = p.inv > 0 && p.inv <= 0.5 && run.hurtFlash > 0 && Math.floor(this.t * 20) % 2;
    H.root.visible = !blink;
    H.root.position.set(p.x * S, 0, p.y * S); // le modèle gère lui-même la hauteur du saut (pose.air)
    H.update(dt, {
      t: this.t, moving: p.moving && !run.dying, speed01: Math.max(0.4, p.speed01 ?? 1), air: p.h, vy: p.vh, atk: hs.atk, atkA: hs.atkA, dirA: hs.face,
      hurt: hs.hurt > 0 ? Math.min(1, hs.hurt / 0.1) : 0, inv: p.inv > 0.5, dead: !!run.dying,
    });
    // ombre, anneau d'équipe bleu
    const sh = 1 - Math.min(0.45, p.h / 200);
    if (!run.dying) {
      fx.shadow(p.x, p.y, 34 * sh, 0.42);
      fx.ringAt(p.x, p.y, 21, '#4aa8ff', 0.9, 0.18, 0.2, 1, 0, 0, 0, 0.7);
    }
    const pet = run.pet;
    if (pet && this.pet) {
      this.pet.root.position.set(pet.x * S, 0, pet.y * S);
      const dx = p.x - pet.x, dy = p.y - pet.y;
      this.pet.update(dt, { t: this.t, moving: Math.hypot(dx, dy) > 30, dirA: Math.atan2(dy, dx) });
      fx.shadow(pet.x, pet.y, 20, 0.3);
    }
  }

  // ---------- Monstres (instanciés par type) ----------
  drawMonsters(dt) {
    const run = this.run, t = this.t, s = this.ms, fx = this.fx, cx = this.cam.x, cy = this.cam.y;
    for (const P of this.pools.values()) P.begin();
    const ot = run.overtime > 0;
    for (const e of run.enemies) {
      if (e.dead) continue;
      const ex = e.x - cx, ey = e.y - cy;
      if (ex < -420 || ex > 420 || ey < -980 || ey > 640) continue; // hors du champ
      if (e.burrowed && e.jumpH < -40) { fx.mound(e); continue; }
      const P = this.pool(e.def, e.boss ? 'b' : e.elite ? 'e' : 'n');
      const body = e.def.body, age = run.time - e.born;
      let up = e.fly * 0.9, sq = e.g_sq || 0;
      if (e.fly) up += Math.sin(e.bob * 0.45) * 3;
      if (e.jumpH > 0) up += e.jumpH; else if (e.jumpH < 0) up += e.jumpH * 0.12;
      if (e.g_mini > 0) { // le champion tombe du ciel puis fend le sol
        e.g_mini -= dt * 2.4;
        if (e.g_mini <= 0) fx.miniLand(e); else up += e.g_mini * e.g_mini * 320;
      }
      if (sq > 0) e.g_sq = Math.max(0, sq - dt * 9);
      let k = e.r / 16;
      if (age < 0.3) { k *= backOut(clamp(age / 0.3, 0, 1)); if (!e.g_sp) { e.g_sp = 1; fx.puff(e.x, e.y, 3, e.r * 0.5, 0.45); } }
      const a = e.act;
      if (a && a.stage === 0 && (a.kind === 'dash' || a.kind === 'strafe' || a.kind === 'stomp')) sq = Math.max(sq, 0.35 + Math.sin(t * 40) * 0.25);
      const big = e.boss || e.elite;
      s.x = e.x * S; s.y = Math.max(0, up) * S; s.z = e.y * S;
      s.rot = Math.PI / 2 - e.ang; s.scale = k; s.anim = e.bob; s.sq = sq * (e.boss ? 0.25 : e.elite ? 0.5 : 1);
      s.flash = e.flash > 0 ? 1 : 0; // les gros monstres atténuent eux-mêmes le flash
      if (e.g_new > 0) { e.g_new -= dt * 1.5; s.flash = Math.max(s.flash, e.g_new); }
      s.freeze = e.freeze > 0; s.mad = !!(e.mad || (ot && !e.boss)); s.alpha = body === 'ghost' ? 0.88 : 1;
      P.add(e, s);
      // traînée de charge : images fantômes
      if (e.g_trail > 0) {
        e.g_trail -= dt;
        const vx = (a ? a.dx : e.dashX) || 0, vy = (a ? a.dy : e.dashY) || 0, x0 = s.x, z0 = s.z, f0 = s.flash;
        for (let i = 1; i <= 2; i++) { s.x = x0 - vx * i * e.r * 0.8 * S; s.z = z0 - vy * i * e.r * 0.8 * S; s.alpha = 0.3 / i; s.flash = 0.6; P.add(e, s); }
        s.x = x0; s.z = z0; s.flash = f0; s.alpha = 1;
      }
      fx.enemyDeco(e, up);
    }
    // morts : le monstre gonfle en blanc et disparaît
    for (let i = this.pops.length - 1; i >= 0; i--) {
      const d = this.pops[i], e = d.e;
      d.t += dt;
      const kk = d.t / d.max;
      if (kk >= 1) { this.pops.splice(i, 1); continue; }
      const P = this.pool(e.def, e.boss ? 'b' : e.elite ? 'e' : 'n');
      s.x = d.x * S; s.y = Math.max(0, e.fly * 0.9) * S; s.z = d.y * S; s.rot = Math.PI / 2 - e.ang;
      s.scale = e.r / 16 * (1 + kk * 0.35); s.sq = kk; s.flash = 1; s.freeze = false; s.mad = false; s.anim = e.bob; s.alpha = 1 - kk;
      P.add(e, s);
    }
    for (const P of this.pools.values()) P.end();
  }

  dispose() {
    try {
      this.overlay.dispose();
      for (const P of this.pools.values()) P.dispose();
      this.hero.dispose?.(); this.pet?.dispose?.();
      this.fx.dispose(); this.obj.dispose();
      this.world.dispose();
      this.markMat.dispose(); this.xrayMat.dispose();
      this.renderer.dispose();
      this.renderer.forceContextLoss?.();
    } catch (e) { /* rien */ }
    RIM.c.value.set('#fff4e0'); RIM.w.value = 0.35; // menus : reflet neutre
    this.c3.remove();
  }
}
