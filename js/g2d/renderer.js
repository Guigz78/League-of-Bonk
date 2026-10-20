// Rendu 2D d'une partie : caméra fixe vue de dessus (aucune rotation), sprites cartoon triés en profondeur,
// effets lumineux, chiffres de dégâts regroupés, alertes au sol, ambiance par zone.
// Le jeu (run.js) ne connaît que : new Gfx(run, canvas), gfx.resize(), gfx.render(dt), gfx.dispose().
import { HALF, TOTEMS } from '../data.js';
import { save } from '../save.js';
import { fmt } from '../ui.js';
import { iconURL } from '../art.js';
import { heroSprites, monsterSprites, petSprites } from './sprites.js';
import { heroRig } from './sprites.js';
import { World2D, CH } from './world.js';
import { itemSprites, glowTex, softTex, puffTex, swirlTex, beamTex, LOOT_GLOW, rune, shade as shadeHex } from './items.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rand = (a, b) => a + Math.random() * (b - a);
const backOut = t => { const c = 2.2; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; };
const easeOut = t => 1 - (1 - t) ** 3;
const FONT = 'ui-rounded, "SF Pro Rounded", "Nunito", system-ui, sans-serif';
const HERO_SHOTS = { arrow: 'arrow', dagger: 'dagger', boom: 'boom' };
const INK2 = '#1a1030';
const SWEEP_ARC = 3.5; // le rayon tournant du boss balaie ~200° (comme run.js)
// police des chiffres et étiquettes du jeu : Lilita One (déclarée dans le CSS), police ronde du système en attendant
let LILITA = false;
const tf = (px, w = 900) => (LILITA ? `700 ${Math.round(px * 1.12)}px 'Rajdhani', ${FONT}` : `${w} ${px}px ${FONT}`);
try {
  const f = document.fonts;
  if (f) {
    if (f.check("700 16px 'Rajdhani'")) LILITA = true;
    f.load("700 16px 'Rajdhani'").then(l => {
      if (l.length) LILITA = true;
      else if (typeof FontFace === 'function') { const ff = new FontFace('Rajdhani', 'url(fonts/rajdhani-700.woff2)', { weight: '700' }); ff.load().then(x => { f.add(x); LILITA = true; }).catch(() => {}); }
    }).catch(() => {});
  }
} catch { /* police du système */ }

export class Gfx {
  constructor(run, canvas) {
    this.run = run;
    this.cv = canvas;
    this.g = canvas.getContext('2d', { alpha: false });
    this.t = 0;
    this.quality = 1;
    this.resize();
    const res = this.res = Math.min(3, this.dpr * this.zoomBase);
    this.world = new World2D(run.zone, res, [...run.chests, ...run.shrines, ...(run.totems || []), { x: 0, y: 0 }, ...(run.altar ? [{ x: run.altar.x, y: run.altar.y, r: 190 }] : [])]);
    this.T = this.world.T;
    this.items = itemSprites(res, this.T);
    this.shadowTex = softTex();
    this.puffTex = puffTex();
    this.hero = [0, 1, 2].map(evo => heroSprites(run.cls.id, evo, res));
    this.pet = run.pet ? petSprites(run.pet.id, res) : null;
    this.mons = new Map();
    this.cam = { x: run.p.x, y: run.p.y, lx: 0, ly: 0 };
    this.zoom = this.zoomBase;
    // effets propres au rendu (n'influencent jamais la partie)
    this.decals = []; this.puffs = []; this.sparks = []; this.pops = []; this.nums = []; this.teles = []; this.bursts = []; this.amb = [];
    this.numBy = new Map();
    this.hs = { face: 1, frame: 0, ft: 0, land: 0, atk: 0, atkA: 0, hurt: 0, lvl: 0, evo: 0 };
    this.list = [];
    this.props = [];
    this.vign = null;
    this.frameMs = 16; this.slowT = 0;
    // le sol autour du départ est préparé tout de suite
    for (let cx = -1; cx <= 0; cx++) for (let cy = -2; cy <= 1; cy++) this.world.bakeChunk(cx, cy);
    this.initFx();
  }

  // effets de l'expédition (autel, arène, portail, totems, butin, folie) : état propre au rendu
  initFx() {
    this.rings = []; this.pillars = []; this.debris = []; this.suck = []; this.bolts = []; this.flyLoot = []; this.embers = []; this.rays = [];
    this.flashA = 0; this.flashC = '255,255,255'; this.edgeA = 0; this.edgeC = '255,40,40'; this.otPulse = 0;
    this.arenaT = 0; this.arenaPrev = null; this.arenaFall = null;
    this.icons = {};
    for (const k in TOTEMS) { const im = new Image(); im.src = iconURL(TOTEMS[k].icon); this.icons[k] = im; }
    const sk = new Image(); sk.src = iconURL('skull'); this.icons.skull = sk;
    // arrivée par le portail : tourbillon qui se referme derrière le héros
    const p = this.run.p;
    this.arrival = 1.6; this.flashA = 0.55; this.flashC = '235,225,255';
    for (let i = 0; i < 3; i++) this.rings.push({ x: p.x, y: p.y, r0: 10, r1: 150 + i * 70, t: -i * 0.12, max: 0.7, c: i ? '#c06aff' : '#7ae8ff', w: 7 });
  }

  gh() { return 0; }

  resize() {
    const cv = this.cv;
    this.dpr = Math.min(2, window.devicePixelRatio || 1) * (this.quality || 1);
    const vw = cv.clientWidth || window.innerWidth, vh = cv.clientHeight || window.innerHeight;
    this.vw = vw; this.vh = vh;
    cv.width = Math.round(vw * this.dpr); cv.height = Math.round(vh * this.dpr);
    // on voit environ 420 unités sur la plus petite dimension de l'écran
    this.zoomBase = clamp(Math.min(vw, vh) / 420, 0.75, 1.9);
    this.vign = null;
  }

  // ---------- Sprites des monstres (cuits à la première apparition) ----------
  monSpr(e) {
    const v = e.boss ? 'b' : e.elite ? 'e' : 'n', key = e.def.name + v;
    let s = this.mons.get(key);
    if (!s) {
      const k = v === 'b' ? 3.5 : v === 'e' ? 1.6 : 0.96;
      s = { k, f: monsterSprites(e.def, { elite: v === 'e', boss: v === 'b', ranged: !!e.def.ranged }, k, this.res) };
      this.mons.set(key, s);
    }
    return s;
  }

  // ---------- Boucle ----------
  render(dt) {
    const run = this.run, p = run.p;
    this.t += dt;
    this.dt = dt;
    this.world.tick = (this.world.tick || 0) + 1;
    this.perf(dt);
    const events = run.events.splice(0);
    for (const ev of events) this.onEvent(ev);
    this.updateCamera(dt);
    const g = this.g, dpr = this.dpr, vw = this.vw, vh = this.vh;
    const K = this.K = dpr * this.zoom;
    const shk = Math.min(5, (run.shake || 0) * 0.45) * ([0, 0.5, 1][save.settings?.shake ?? 2] ?? 1); // réglage : tremblements 0 / faible / normal
    const sx = shk ? Math.sin(this.t * 61) * shk : 0, sy = shk ? Math.cos(this.t * 47) * shk : 0;
    this.OX = dpr * (vw / 2 + sx) - this.cam.x * K;
    this.OY = dpr * (vh / 2 + sy) - this.cam.y * K;
    // zone visible (unités du monde)
    const hw = vw / 2 / this.zoom + 40, hh = vh / 2 / this.zoom + 40;
    this.view = { x0: this.cam.x - hw, x1: this.cam.x + hw, y0: this.cam.y - hh, y1: this.cam.y + hh };
    this.drawGround(g);
    this.world2(g);
    this.drawGroundFx(g);
    this.drawSorted(g);
    this.drawShots(g);
    this.drawFx(g);
    this.drawLight(g);
    this.drawAmbient(g, dt);
    this.drawUi(g);
  }

  // si l'appareil peine, on baisse un peu la résolution
  perf(dt) {
    if (!dt) return;
    this.frameMs += (dt * 1000 - this.frameMs) * 0.05;
    if (this.frameMs > 24 && this.quality > 0.6) {
      this.slowT += dt;
      if (this.slowT > 2.5) { this.slowT = 0; this.quality = Math.max(0.6, this.quality - 0.15); this.resize(); }
    } else this.slowT = 0;
  }

  updateCamera(dt) {
    const run = this.run, p = run.p, c = this.cam;
    const k = 1 - Math.exp(-(dt || 0.016) * 3);
    const lt = p.moving ? 34 : 0;
    c.lx += (p.face.x * lt - c.lx) * k * 0.6; c.ly += (p.face.y * lt - c.ly) * k * 0.6;
    const f = 1 - Math.exp(-(dt || 0.016) * 7);
    c.x += (p.x + c.lx - c.x) * f; c.y += (p.y + c.ly - c.y) * f;
    const zt = this.zoomBase * (run.boss && !run.boss.dead ? 0.84 : 1);
    this.zoom += (zt - this.zoom) * (1 - Math.exp(-(dt || 0.016) * 1.4));
  }

  // matrice monde → écran (+ échelle, miroir, rotation autour du point d'ancrage)
  M(x, y, sx = 1, sy = 1, rot = 0) {
    const K = this.K;
    if (rot) { const c = Math.cos(rot), s = Math.sin(rot); this.g.setTransform(K * sx * c, K * sx * s, -K * sy * s, K * sy * c, this.OX + x * K, this.OY + y * K); }
    else this.g.setTransform(K * sx, 0, 0, K * sy, this.OX + x * K, this.OY + y * K);
  }
  W() { this.g.setTransform(this.K, 0, 0, this.K, this.OX, this.OY); }
  spr(s, x, y, sx = 1, sy = 1, rot = 0, img = s.c) { this.M(x, y, sx, sy, rot); this.g.drawImage(img, -s.ax, -s.ay, s.w, s.h); }
  glow(x, y, r, col, a = 1) { const g = this.g; g.globalAlpha = a; this.W(); g.drawImage(glowTex(col), x - r, y - r, r * 2, r * 2); g.globalAlpha = 1; }
  shadow(x, y, w, h = w * 0.4, a = 0.32) { const g = this.g; g.globalAlpha = a; g.drawImage(this.shadowTex, x - w / 2, y - h / 2, w, h); g.globalAlpha = 1; }
  inView(x, y, m = 0) { const v = this.view; return x > v.x0 - m && x < v.x1 + m && y > v.y0 - m && y < v.y1 + m; }

  // ---------- Événements de jeu ----------
  onEvent(ev) {
    const run = this.run, p = run.p, hs = this.hs;
    switch (ev.type) {
      case 'hit': {
        const e = ev.e;
        e.g_sq = 1;
        if (this.sparks.length < 160) for (let i = 0; i < (ev.crit ? 6 : 3); i++) {
          const a = Math.random() * TAU, v = rand(120, 300) * (ev.crit ? 1.4 : 1);
          this.sparks.push({ x: e.x, y: e.y - e.r - e.fly * 0.9, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rand(0.12, 0.25), max: 0.25, c: ev.crit ? '#ffd54a' : ev.color || '#ffffff', w: ev.crit ? 2.6 : 1.8 });
        }
        if (ev.crit && this.sparks.length < 170) this.sparks.push({ x: e.x + rand(-6, 6), y: e.y - e.r - e.fly * 0.9, vx: 0, vy: -40, life: 0.22, max: 0.22, c: '#fff6a0', star: true, w: 2, big: 2.4 });
        if (ev.quiet && !ev.crit) break;
        const mode = save.settings?.numbers || 'all'; // réglage : chiffres de dégâts tous / critiques / aucun
        if (mode === 'none' || (mode === 'crit' && !ev.crit)) break;
        const n = this.numBy.get(e);
        if (n && n.t < 0.45 && n.life > 0.2) { n.v += ev.dmg; n.pop = 1; n.crit = n.crit || ev.crit; n.t = Math.min(n.t, 0.2); n.life = 0.7; }
        else if (this.nums.length < (ev.crit ? 48 : 30)) {
          const m = { e, x: e.x + rand(-6, 6), y: e.y, h: e.r * 2.2 + e.fly, v: ev.dmg, crit: ev.crit, color: ev.color, t: 0, life: 0.7, pop: 1, dx: rand(-14, 14) };
          this.nums.push(m); this.numBy.set(e, m);
        }
        break;
      }
      case 'kill': {
        const e = ev.e, s = this.monSpr(e), sc = (e.r / 16) / s.k;
        this.pops.push({ s: s.f[0], x: e.x, y: e.y - e.fly * 0.9, sc, flip: e.g_face || 1, t: 0, max: e.boss ? 0.6 : 0.15 });
        this.decal(e.x, e.y, e.r * (e.boss ? 1.6 : 1.1), e.def.pal[1], 0.45);
        this.puff(e.x, e.y - e.r * 0.5 - e.fly * 0.9, e.boss ? 14 : e.elite ? 8 : 4, e.r * 0.7);
        if (e.elite || e.boss) this.bursts.push({ x: e.x, y: e.y - e.r, r: e.r * (e.boss ? 5 : 3), t: 0, max: e.boss ? 0.8 : 0.45, c: e.boss ? '#ffe48a' : '#d08aff' });
        this.numBy.delete(e);
        break;
      }
      case 'hurt': hs.hurt = 0.14; this.flashHurt = 0.35; break;
      case 'jump': hs.jump = 1; this.puff(p.x, p.y, 4, 8, 0.5); break;
      case 'land': hs.land = 1; this.puff(p.x, p.y, 6, 10, 0.5); break;
      case 'levelup': hs.lvl = 1; this.bursts.push({ x: p.x, y: p.y - 20, r: 70, t: 0, max: 0.5, c: '#ffe48a' }); break;
      case 'evolve': this.evolveFx(ev); break;
      case 'pickup':
        if (ev.kind === 'loot') { this.lootFx(ev); break; }
        if (ev.kind !== 'xp' || Math.random() < 0.4) this.sparkle(p.x + rand(-8, 8), p.y - 22 + rand(-8, 8), ev.kind === 'gold' ? '#ffd54a' : ev.kind === 'heart' ? '#ff6a8a' : '#8ad8ff');
        break;
      // ----- expédition -----
      case 'bossSummon': this.summonFx(ev); break;
      case 'arena': this.arenaT = 0; this.rings.push({ x: ev.x, y: ev.y, r0: ev.R * 1.5, r1: ev.R, t: 0, max: 0.45, c: '#ff4a3a', w: 12 }); break;
      case 'bossPhase': {
        const e = ev.e, col = ev.phase >= 3 ? '#ff2a2a' : '#ff9a3a';
        for (let i = 0; i < 3; i++) this.rings.push({ x: e.x, y: e.y, r0: e.r, r1: 260 + i * 90, t: -i * 0.14, max: 0.6, c: col, w: 10 });
        this.pillars.push({ x: e.x, y: e.y, w: e.r * 3, h: 420, t: 0, max: 0.9, c: col });
        this.edgeA = 0.55; this.edgeC = ev.phase >= 3 ? '255,30,30' : '255,140,40';
        this.burstStars(e.x, e.y - e.r, 18, col, 340);
        break;
      }
      case 'bossDeath': {
        this.flashA = 0.6; this.flashC = '255,246,214';
        for (let i = 0; i < 4; i++) this.rings.push({ x: ev.x, y: ev.y, r0: 20, r1: 300 + i * 120, t: -i * 0.1, max: 0.8, c: i % 2 ? '#ffffff' : '#ffd54a', w: 12 });
        this.pillars.push({ x: ev.x, y: ev.y, w: 200, h: 900, t: 0, max: 1.4, c: '#ffe48a' });
        this.burstStars(ev.x, ev.y - 40, 40, '#ffd54a', 520);
        this.rockBurst(ev.x, ev.y, 18, '#8a7a6a', 260);
        break;
      }
      case 'portalOpen':
        this.rings.push({ x: ev.x, y: ev.y, r0: 10, r1: 240, t: 0.0, max: 0.7, c: '#c06aff', w: 10 }, { x: ev.x, y: ev.y, r0: 10, r1: 160, t: -0.2, max: 0.6, c: '#7ae8ff', w: 8 });
        this.pillars.push({ x: ev.x, y: ev.y, w: 140, h: 900, t: 0, max: 1.6, c: '#b06aff' });
        this.burstStars(ev.x, ev.y - 50, 30, '#c8a0ff', 380);
        break;
      case 'portalEnter': {
        const P = run.portal;
        this.flashA = 0.8; this.flashC = '230,220,255';
        if (P) { this.rings.push({ x: P.x, y: P.y, r0: 140, r1: 10, t: 0, max: 0.55, c: '#ffffff', w: 8 }); this.burstStars(P.x, P.y - 56, 26, '#bff8ff', 260); }
        break;
      }
      case 'worldStart': this.arrival = Math.max(this.arrival, 1.4); break;
      case 'totem': {
        const col = TOTEMS[ev.kind]?.color || '#ffffff';
        for (let i = 0; i < 3; i++) this.rings.push({ x: ev.x, y: ev.y, r0: 20, r1: 150 + i * 70, t: -i * 0.12, max: 0.6, c: i === 1 ? '#ffffff' : col, w: 9 });
        this.pillars.push({ x: ev.x, y: ev.y, w: 90, h: 520, t: 0, max: 1, c: col });
        this.burstStars(ev.x, ev.y - 60, 24, col, 300);
        this.edgeA = 0.35; this.edgeC = hexRGB(col);
        break;
      }
      case 'lootDrop': this.puff(ev.x, ev.y, 5, 12, 0.6); this.rings.push({ x: ev.x, y: ev.y, r0: 6, r1: 60, t: -0.5, max: 0.4, c: LOOT_GLOW[ev.tier] || '#ffffff', w: 5 }); break;
      case 'overtime':
        this.flashA = 0.5; this.flashC = '255,40,30'; this.otPulse = 1;
        for (let i = 0; i < 3; i++) this.rings.push({ x: p.x, y: p.y, r0: 30, r1: 360 + i * 120, t: -i * 0.15, max: 0.8, c: '#ff3a2a', w: 12 });
        break;
      case 'overtimeStep': this.otPulse = 1; this.flashA = Math.max(this.flashA, 0.22); this.flashC = '255,40,30'; break;
      case 'legend': this.legendFx(ev); break;
      case 'block': this.rings.push({ x: p.x, y: p.y - 20, r0: 20, r1: 46, t: 0, max: 0.3, c: '#a8d8ff', w: 5 }); break;
      case 'dodge': this.puff(p.x, p.y - 10, 4, 10, 0.4, '#d8f0ff'); break;
      case 'chest': this.bursts.push({ x: ev.x, y: ev.y - 16, r: 120, t: 0, max: 0.7, c: '#ffd54a' }); break;
      case 'shrine': this.bursts.push({ x: ev.x, y: ev.y - 20, r: 160, t: 0, max: 0.9, c: '#4fd0ff' }); break;
      case 'impact': case 'explode':
        this.decal(ev.x, ev.y, ev.R * 0.75, '#1a1020', 0.35);
        this.puff(ev.x, ev.y, ev.type === 'explode' ? 12 : 7, ev.R * 0.5, 0.8);
        this.bursts.push({ x: ev.x, y: ev.y, r: ev.R * 1.3, t: 0, max: 0.35, c: ev.type === 'explode' ? '#ff9a4a' : '#ffd0a0' });
        break;
      case 'emerge': this.decal(ev.x, ev.y, ev.R * 0.6, '#2a1a10', 0.4); this.puff(ev.x, ev.y, 10, ev.R * 0.5, 0.8); break;
      case 'burrow': this.puff(ev.x, ev.y, 6, 20, 0.7); break;
      case 'blink':
        this.puff(ev.fromX, ev.fromY - 16, 6, 18, 0.6, '#c8a0ff');
        this.puff(ev.x, ev.y - 16, 6, 18, 0.6, '#c8a0ff');
        break;
      case 'enemyStomp': case 'bossStomp': this.decal(ev.x, ev.y, ev.e.r * 1.4, '#1a1020', 0.3); this.puff(ev.x, ev.y, 10, ev.e.r, 0.8); break;
      case 'enemyTelegraph':
        if (ev.kind === 'dash' || ev.kind === 'strafe' || ev.kind === 'charge' || ev.kind === 'stomp' || ev.kind === 'shoot' || ev.kind === 'volley' || ev.kind === 'ring' || ev.kind === 'spiral' || ev.kind === 'summon' || ev.kind === 'mortar')
          this.teles.push({ ...ev, t: 0 });
        break;
      case 'enemyDash': case 'bossDash': ev.e.g_trail = 0.5; break;
      case 'elite': if (ev.e) ev.e.g_new = 1; break;
      case 'ult': this.bursts.push({ x: p.x, y: p.y - 20, r: ev.kind === 'nova' ? 320 : 260, t: 0, max: 0.6, c: ev.kind === 'crystal' ? '#9ad8ff' : '#ffe48a' }); break;
      case 'revive': this.bursts.push({ x: p.x, y: p.y - 20, r: 280, t: 0, max: 0.7, c: '#5ae87a' }); break;
      case 'win': for (let i = 0; i < 90; i++) this.confetti(); break;
      case 'split': this.puff(ev.x, ev.y - 10, 4, 12, 0.5); break;
    }
  }

  decal(x, y, r, col, a) {
    if (this.decals.length > 90) this.decals.shift();
    const blobs = [];
    for (let i = 0; i < 5; i++) { const an = Math.random() * TAU, d = Math.random() * r * 0.7; blobs.push([Math.cos(an) * d, Math.sin(an) * d * 0.6, r * rand(0.25, 0.55)]); }
    this.decals.push({ x, y, col, a, life: 9, blobs });
  }
  puff(x, y, n, r, a = 0.7, col = null) {
    for (let i = 0; i < n && this.puffs.length < 140; i++) {
      const an = Math.random() * TAU, v = rand(20, 70) + r;
      this.puffs.push({ x: x + Math.cos(an) * r * 0.3, y: y + Math.sin(an) * r * 0.2, vx: Math.cos(an) * v, vy: Math.sin(an) * v * 0.5 - 10, s: rand(0.45, 0.8) * Math.max(6, r * 0.5), life: rand(0.3, 0.5), max: 0.5, a: a * 0.5, col });
    }
  }
  sparkle(x, y, c) { if (this.sparks.length < 160) this.sparks.push({ x, y, vx: 0, vy: -30, life: 0.35, max: 0.35, c, star: true, w: 2 }); }
  confetti() {
    const p = this.run.p, cols = ['#ffd54a', '#ff6ad8', '#5ae87a', '#4fb8ff', '#ff7a4a', '#ffffff'];
    const an = Math.random() * TAU, v = rand(150, 480);
    this.sparks.push({ x: p.x, y: p.y - 30, vx: Math.cos(an) * v, vy: Math.sin(an) * v - 200, g: 500, life: rand(1, 1.8), max: 1.8, c: cols[(Math.random() * cols.length) | 0], conf: Math.random() * TAU, w: 4 });
  }
  // gerbe d'étoiles (effet cartoon)
  burstStars(x, y, n, c, v = 260) {
    for (let i = 0; i < n && this.sparks.length < 220; i++) {
      const a = Math.random() * TAU, s = rand(0.3, 1) * v;
      this.sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.7 - 60, life: rand(0.4, 0.8), max: 0.8, c: Math.random() < 0.3 ? '#ffffff' : c, star: true, w: 2.4, big: rand(1.2, 2.2) });
    }
  }
  // éclats de pierre qui retombent
  rockBurst(x, y, n, c, v = 200) {
    for (let i = 0; i < n && this.debris.length < 80; i++) {
      const a = Math.random() * TAU, s = rand(0.3, 1) * v;
      this.debris.push({ x, y, z: rand(4, 20), vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6, vz: rand(180, 420), r: rand(2.5, 6), c, rot: Math.random() * TAU, vr: rand(-12, 12), life: rand(0.9, 1.4) });
    }
  }
  // invocation du boss : éclair sombre, colonne rouge, ondes de choc, le crâne de l'autel vole en éclats
  summonFx(ev) {
    const run = this.run, A = run.altar;
    this.flashA = 0.6; this.flashC = '60,0,16';
    this.edgeA = 0.6; this.edgeC = '255,30,30';
    this.pillars.push({ x: ev.x, y: ev.y, w: 150, h: 700, t: 0, max: 1.3, c: '#ff3a2a' });
    for (let i = 0; i < 3; i++) this.rings.push({ x: ev.x, y: ev.y, r0: 20, r1: 220 + i * 110, t: -i * 0.13, max: 0.7, c: i === 1 ? '#ffb04a' : '#ff3a2a', w: 12 });
    this.decal(ev.x, ev.y, 70, '#1a0810', 0.5);
    this.puff(ev.x, ev.y - 20, 16, 50, 0.9, '#5a2a3a');
    this.rockBurst(ev.x, ev.y, 20, '#6a5a52', 260);
    if (A && !ev.auto && Math.hypot(A.x - ev.x, A.y - ev.y) < 400) {
      this.rockBurst(A.x, A.y - 50, 12, '#f2e8d2', 200);
      this.puff(A.x, A.y - 40, 8, 26, 0.8);
      this.bolts.push({ pts: zigzag(A.x, A.y - 54, ev.x, ev.y - 60, 9, 26), t: 0, max: 0.5, c: '#ff4a3a' });
    }
  }
  // coffre de butin ramassé : gerbe d'étoiles et le coffre file vers son compteur
  lootFx(ev) {
    const c = LOOT_GLOW[ev.v] || '#ffffff', p = this.run.p;
    this.rings.push({ x: ev.x, y: ev.y, r0: 10, r1: 90 + ev.v * 20, t: 0, max: 0.45, c, w: 7 });
    this.burstStars(ev.x, ev.y - 16, 14 + ev.v * 6, c, 240);
    if (this.flyLoot.length < 6) { const [x, y] = this.ws(ev.x, ev.y - 16); this.flyLoot.push({ tier: ev.v, x, y, t: 0 }); }
    if (ev.v >= 2) { this.flashA = Math.max(this.flashA, 0.18); this.flashC = ev.v === 3 ? '255,140,240' : '255,230,140'; }
    if (Math.hypot(ev.x - p.x, ev.y - p.y) > 400) this.flyLoot.length = 0; // butin du boss ramassé d'office : pas d'animation
  }
  // évolution : l'effet grandit avec le stade, la forme ultime fait une énorme explosion dorée
  evolveFx(ev) {
    const p = this.run.p, k = clamp((ev.evo || 1) / 4, 0, 1), col = ev.aura || '#ffe48a';
    this.hs.evo = 1.4 + k * 0.8;
    this.bursts.push({ x: p.x, y: p.y - 20, r: 200 + 160 * k, t: 0, max: 0.9, c: '#ffe48a' });
    for (let i = 0; i < 2 + (ev.evo || 1); i++) this.rings.push({ x: p.x, y: p.y, r0: 20, r1: 160 + 90 * i * (0.6 + k), t: -i * 0.12, max: 0.7, c: i % 2 ? '#ffffff' : col, w: 8 + 4 * k });
    this.pillars.push({ x: p.x, y: p.y, w: 80 + 100 * k, h: 400 + 500 * k, t: 0, max: 1 + k * 0.6, c: col });
    this.burstStars(p.x, p.y - 24, 16 + 30 * k, col, 260 + 200 * k);
    if (ev.final) {
      this.flashA = 0.75; this.flashC = '255,240,190';
      this.rays.push({ t: 0, max: 2.2, c: col });
      for (let i = 0; i < 70; i++) this.confetti();
      for (let i = 0; i < 2; i++) this.rings.push({ x: p.x, y: p.y, r0: 40, r1: 620, t: -0.3 - i * 0.2, max: 0.9, c: '#ffd54a', w: 16 });
    } else this.flashA = Math.max(this.flashA, 0.25 + 0.2 * k), this.flashC = '255,248,220';
  }
  legendFx(ev) {
    if (ev.kind === 'chain' && ev.pts) this.bolts.push({ pts: ev.pts.flatMap((q, i) => (i ? zigzag(ev.pts[i - 1][0], ev.pts[i - 1][1] - 16, q[0], q[1] - 16, 4, 10).slice(1) : [[q[0], q[1] - 16]])), t: 0, max: 0.28, c: '#7ae8ff' });
    else if (ev.kind === 'frost') { this.burstStars(ev.x, ev.y - 16, 6, '#bfeaff', 120); this.rings.push({ x: ev.x, y: ev.y, r0: 6, r1: 40, t: 0, max: 0.35, c: '#9ad8ff', w: 5 }); }
    else if (ev.kind === 'boom') { this.puff(ev.x, ev.y - 6, 6, ev.R * 0.4, 0.7); this.rings.push({ x: ev.x, y: ev.y, r0: 10, r1: ev.R, t: 0, max: 0.3, c: '#ffb04a', w: 8 }); }
    else if (ev.kind === 'bubble') this.rings.push({ x: ev.x, y: ev.y - 20, r0: 10, r1: 34, t: 0, max: 0.4, c: '#a8d8ff', w: 5 });
  }

  // ---------- Sol ----------
  drawGround(g) {
    const v = this.view, W = this.world;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = this.T.edge; g.fillRect(0, 0, this.cv.width, this.cv.height);
    this.W();
    let baked = 0;
    for (let cx = Math.floor(v.x0 / CH); cx <= Math.floor(v.x1 / CH); cx++)
      for (let cy = Math.floor(v.y0 / CH); cy <= Math.floor(v.y1 / CH); cy++) {
        if (Math.abs(cx * CH + CH / 2) > HALF + CH || Math.abs(cy * CH + CH / 2) > HALF + CH) continue;
        let c = W.chunk(cx, cy);
        if (!c && baked < 2) { c = W.bakeChunk(cx, cy); baked++; }
        if (c) g.drawImage(c, cx * CH, cy * CH, CH + 0.8, CH + 0.8);
        else { g.fillStyle = this.T.g0; g.fillRect(cx * CH, cy * CH, CH, CH); }
      }
    // préparation en avance des morceaux juste hors de l'écran
    if (!baked) {
      const p = this.run.p, ax = Math.floor((p.x + p.face.x * 400) / CH), ay = Math.floor((p.y + p.face.y * 400) / CH);
      if (!W.chunk(ax, ay) && Math.abs(ax * CH) < HALF + CH && Math.abs(ay * CH) < HALF + CH) W.bakeChunk(ax, ay);
    }
  }

  // taches au sol, autels, coffres posés
  world2(g) {
    const dt = this.dt;
    this.W();
    for (const d of this.decals) {
      d.life -= dt;
      if (!this.inView(d.x, d.y, 60)) continue;
      g.globalAlpha = d.a * clamp(d.life / 3, 0, 1);
      g.fillStyle = d.col;
      g.beginPath();
      for (const [x, y, r] of d.blobs) { g.moveTo(d.x + x + r, d.y + y); g.ellipse(d.x + x, d.y + y, r, r * 0.62, 0, 0, TAU); }
      g.fill();
    }
    g.globalAlpha = 1;
    this.decals = this.decals.filter(d => d.life > 0);
  }

  drawGroundFx(g) {
    const run = this.run, p = run.p, t = this.t;
    this.W();
    this.groundMarks(g);
    this.W();
    // autels : cercle qui se remplit
    for (const s of run.shrines) {
      if (!this.inView(s.x, s.y, 80)) continue;
      g.lineWidth = 3;
      g.strokeStyle = s.used ? 'rgba(160,160,180,.25)' : 'rgba(79,208,255,.55)';
      g.save(); g.setLineDash([10, 8]); g.lineDashOffset = -t * 20;
      g.beginPath(); g.arc(s.x, s.y, 58, 0, TAU); g.stroke(); g.restore();
      if (!s.used && s.charge > 0) {
        g.fillStyle = 'rgba(79,208,255,.22)'; g.beginPath(); g.arc(s.x, s.y, 58 * s.charge, 0, TAU); g.fill();
        g.strokeStyle = '#bff0ff'; g.lineWidth = 4; g.beginPath(); g.arc(s.x, s.y, 58, -Math.PI / 2, -Math.PI / 2 + s.charge * TAU); g.stroke();
      }
    }
    // cape solaire (aura)
    const aura = p.weapons.find(w => w.id === 'aura');
    if (aura && aura.R) {
      const R = aura.R * (1 + Math.sin(t * 5) * 0.03);
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.5; g.drawImage(glowTex('#ff8a2a'), p.x - R * 1.15, p.y - R * 1.15, R * 2.3, R * 2.3);
      g.globalAlpha = 0.7; g.strokeStyle = '#ffb04a'; g.lineWidth = 2.4;
      g.save(); g.setLineDash([14, 10]); g.lineDashOffset = t * 30; g.beginPath(); g.arc(p.x, p.y, R, 0, TAU); g.stroke(); g.restore();
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    }
    // alertes : zones rouges qui se remplissent, couloirs de charge
    for (const f of run.fx) {
      if (f.type !== 'ring' || !f.warn) continue;
      if (!this.inView(f.x, f.y, f.r)) continue;
      const k = clamp(1 - f.life / f.max, 0, 1), blink = 0.75 + Math.sin(t * 30) * 0.25 * k;
      g.fillStyle = hexA(f.color, 0.16); g.beginPath(); g.ellipse(f.x, f.y, f.r, f.r, 0, 0, TAU); g.fill();
      g.fillStyle = hexA(f.color, 0.32 * blink); g.beginPath(); g.ellipse(f.x, f.y, f.r * k, f.r * k, 0, 0, TAU); g.fill();
      g.strokeStyle = hexA(f.color, 0.9); g.lineWidth = 2.6; g.beginPath(); g.ellipse(f.x, f.y, f.r, f.r, 0, 0, TAU); g.stroke();
    }
    this.teles = this.teles.filter(T => (T.t += this.dt) < T.dur + 0.05 && !T.e?.dead);
    for (const T of this.teles) {
      const e = T.e, k = clamp(T.t / T.dur, 0, 1);
      if (T.kind === 'dash' || T.kind === 'strafe' || T.kind === 'charge') {
        if (e.act && e.act.stage !== 0 && T.kind !== 'charge') continue;
        if (T.kind === 'charge' && e.phase !== 'aim') continue;
        const len = T.kind === 'charge' ? T.R : T.R, w = e.r * (T.kind === 'charge' ? 1.5 : 1.25);
        const dx = T.kind === 'charge' ? e.dashX : T.dx, dy = T.kind === 'charge' ? e.dashY : T.dy;
        const a = Math.atan2(dy, dx), L = len;
        g.save(); g.translate(e.x, e.y); g.rotate(a);
        g.fillStyle = 'rgba(255,58,58,.16)'; g.fillRect(0, -w / 2, L, w);
        g.fillStyle = 'rgba(255,58,58,.38)'; g.fillRect(0, -w / 2, L * k, w);
        g.strokeStyle = 'rgba(255,90,90,.9)'; g.lineWidth = 2.2; g.strokeRect(0, -w / 2, L, w);
        g.fillStyle = 'rgba(255,220,220,.85)';
        for (let i = 1; i <= 3; i++) { const x = L * (i / 4) + ((t * 120) % (L / 4)) * 0.3; g.beginPath(); g.moveTo(x, -w * 0.25); g.lineTo(x + w * 0.3, 0); g.lineTo(x, w * 0.25); g.fill(); }
        g.restore();
        this.W();
      } else if (T.kind === 'stomp') {
        const R = T.R, pulse = 0.5 + Math.sin(t * 22) * 0.5, r = Math.min(R, e.r + (R - e.r) * k);
        g.fillStyle = `rgba(255,150,60,${0.08 + pulse * 0.06})`; g.beginPath(); g.arc(e.x, e.y, r, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(40,16,8,.35)'; g.lineWidth = 9; g.beginPath(); g.arc(e.x, e.y + 2, r, 0, TAU); g.stroke();
        g.strokeStyle = `rgba(255,170,70,${0.5 + pulse * 0.45})`; g.lineWidth = 5; g.beginPath(); g.arc(e.x, e.y, r, 0, TAU); g.stroke();
      } else if (T.kind === 'mortar') {
        g.strokeStyle = 'rgba(255,80,80,.9)'; g.lineWidth = 2;
        const r = 14 + (1 - k) * 18;
        g.beginPath(); g.arc(T.x, T.y, r, 0, TAU); g.moveTo(T.x - r - 6, T.y); g.lineTo(T.x + r + 6, T.y); g.moveTo(T.x, T.y - r - 6); g.lineTo(T.x, T.y + r + 6); g.stroke();
      }
    }
    // ondes de choc (à sauter) : un muret de terre et de lumière qui avance, très visible
    for (const w of run.waves) {
      if (!this.inView(w.x, w.y, w.r + 30)) continue;
      const a = 0.35 + 0.65 * clamp(1 - w.r / w.max, 0, 1), r = w.r;
      g.strokeStyle = `rgba(50,24,12,${0.4 * a})`; g.lineWidth = 22; g.beginPath(); g.arc(w.x, w.y + 5, r, 0, TAU); g.stroke();
      g.strokeStyle = `rgba(150,80,30,${0.9 * a})`; g.lineWidth = 12; g.beginPath(); g.arc(w.x, w.y, r, 0, TAU); g.stroke();
      g.strokeStyle = `rgba(255,150,50,${a})`; g.lineWidth = 8; g.beginPath(); g.arc(w.x, w.y - 6, r, 0, TAU); g.stroke();
      g.strokeStyle = `rgba(255,226,120,${a})`; g.lineWidth = 4; g.beginPath(); g.arc(w.x, w.y - 11, r, 0, TAU); g.stroke();
      g.strokeStyle = `rgba(255,255,255,${0.9 * a})`; g.lineWidth = 1.8; g.beginPath(); g.arc(w.x, w.y - 14, r, 0, TAU); g.stroke();
      // poussière soulevée sur le front de l'onde, près du joueur
      if (Math.random() < 0.5 && this.puffs.length < 120) {
        const an = Math.atan2(p.y - w.y, p.x - w.x) + rand(-0.8, 0.8);
        this.puffs.push({ x: w.x + Math.cos(an) * r, y: w.y + Math.sin(an) * r, vx: Math.cos(an) * 60, vy: Math.sin(an) * 40 - 20, s: rand(5, 9), life: 0.4, max: 0.4, a: 0.35, col: null });
      }
    }
    // chemin lumineux au sol jusqu'au portail : des chevrons qui filent vers lui
    if (run.portal && run.portal.t > 0.5 && !run.dying) {
      const P = run.portal, dx = P.x - p.x, dy = P.y - p.y, d = Math.hypot(dx, dy);
      if (d > 90) {
        const ux = dx / d, uy = dy / d, L = Math.min(d - 40, 460), off = (t * 110) % 44, ang = Math.atan2(uy, ux);
        for (let k = 36 + off; k < L; k += 44) {
          g.save(); g.translate(p.x + ux * k, p.y + uy * k); g.rotate(ang);
          g.globalAlpha = 0.25 + 0.75 * clamp(1 - k / L, 0, 1);
          g.lineJoin = 'round'; g.lineCap = 'round';
          g.strokeStyle = 'rgba(30,8,60,.75)'; g.lineWidth = 10; g.beginPath(); g.moveTo(-8, -12); g.lineTo(6, 0); g.lineTo(-8, 12); g.stroke();
          g.strokeStyle = '#d4a8ff'; g.lineWidth = 5.5; g.beginPath(); g.moveTo(-8, -12); g.lineTo(6, 0); g.lineTo(-8, 12); g.stroke();
          g.restore();
        }
        g.globalAlpha = 1;
      }
    }
    // ombres de tout ce qui est au-dessus du sol
    g.globalAlpha = 0.3;
    const st = this.shadowTex;
    for (const e of run.enemies) {
      if (e.dead || !this.inView(e.x, e.y, e.r * 2)) continue;
      if (e.burrowed && e.jumpH < -40) continue;
      const up = Math.max(0, e.jumpH) + e.fly, k = 1 - Math.min(0.5, up / 300), w = e.r * 2.3 * k, h = e.r * 0.85 * k;
      g.drawImage(st, e.x - w / 2, e.y - h / 2, w, h);
    }
    g.globalAlpha = 1;
    // cercle d'équipe sous les élites (violet) et le boss (rouge), comme dans les arènes
    for (const e of run.enemies) {
      if (!(e.boss || e.elite) || e.dead || (e.burrowed && e.jumpH < -40) || !this.inView(e.x, e.y, e.r * 2)) continue;
      const R = e.r * (e.boss ? 1.25 : 1.15), col = e.boss ? '255,58,58' : '192,106,255';
      g.fillStyle = `rgba(${col},.16)`; g.beginPath(); g.ellipse(e.x, e.y, R, R * 0.55, 0, 0, TAU); g.fill();
      g.strokeStyle = `rgba(${col},.85)`; g.lineWidth = e.boss ? 4 : 2.6; g.stroke();
    }
    if (!run.dying) this.shadow(p.x, p.y, 30 * (1 - Math.min(0.45, p.h / 200)), 11 * (1 - Math.min(0.45, p.h / 200)), 0.34);
    if (run.pet) this.shadow(run.pet.x, run.pet.y, 18, 7);
    // objets au sol (gemmes, pièces…)
    const I = this.items;
    for (const it of run.pickups) {
      if (it.type === 'loot' || !this.inView(it.x, it.y, 20)) continue;
      const bob = Math.sin(t * 4 + it.x * 0.05) * 2;
      if (it.type === 'xp') {
        const v = it.v, i = v >= 30 ? 3 : v >= 10 ? 2 : v >= 3 ? 1 : 0;
        if (i >= 2 || it.pull) this.glowAdd(it.x, it.y - 8, 12 + i * 4, ['#4fb8ff', '#5ae87a', '#c06aff', '#ff4a6a'][i], 0.6);
        this.spr(I.gem[i], it.x, it.y - 2 + bob);
      } else if (it.type === 'gold') this.spr(I.coin, it.x, it.y - 2 + bob, Math.abs(Math.cos(t * 5 + (it.spin || it.x))) * 0.9 + 0.1, 1);
      else if (it.type === 'heart') { this.glowAdd(it.x, it.y - 9, 22, '#ff4a6a', 0.6); this.spr(I.heart, it.x, it.y - 3 + bob, 1 + Math.sin(t * 8) * 0.08, 1 + Math.sin(t * 8) * 0.08); }
      else if (it.type === 'magnet') { this.glowAdd(it.x, it.y - 10, 22, '#4fb8ff', 0.6); this.spr(I.magnet, it.x, it.y - 3 + bob, 1, 1, Math.sin(t * 3) * 0.2); }
    }
    // champignons piégés
    for (const m of run.mines) {
      if (!this.inView(m.x, m.y, 20)) continue;
      const pulse = m.arm > 0 ? 0.6 : 1 + Math.sin(t * 6 + m.x) * 0.06;
      this.spr(I.mine, m.x, m.y, pulse, pulse);
      if (m.arm <= 0 && Math.sin(t * 6 + m.x) > 0.8) this.glowAdd(m.x, m.y - 8, 14, '#8aff5a', 0.5);
    }
  }

  glowAdd(x, y, r, col, a = 1) {
    const g = this.g;
    g.globalCompositeOperation = 'lighter'; g.globalAlpha = a; this.W();
    g.drawImage(glowTex(col), x - r, y - r, r * 2, r * 2);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  }

  // texture carrée centrée en (x, y), tournée de rot puis étirée en rx × ry (tourbillons, runes au sol)
  tex(img, x, y, rx, ry, rot = 0) {
    const K = this.K, c = Math.cos(rot), s = Math.sin(rot);
    this.g.setTransform(K * rx * c, K * ry * s, -K * rx * s, K * ry * c, this.OX + x * K, this.OY + y * K);
    this.g.drawImage(img, -1, -1, 2, 2);
  }

  // ---------- Sol de l'expédition : arène, autel du boss, portail, totems, rayon tournant ----------
  groundMarks(g) {
    const run = this.run, p = run.p, t = this.t, dt = this.dt, I = this.items, v = this.view;
    // arène : l'extérieur s'assombrit, un anneau de runes rouges l'entoure
    const A = run.arena;
    if (A) {
      this.arenaT += dt;
      const k = backOut(clamp(this.arenaT / 0.5, 0, 1)), R = A.R * (1 + 0.5 * (1 - k));
      this.arenaPrev = { x: A.x, y: A.y, R: A.R };
      if (this.inView(A.x, A.y, R + 60)) {
        g.fillStyle = `rgba(30,6,20,${0.34 * clamp(this.arenaT * 3, 0, 1)})`;
        g.beginPath(); g.rect(v.x0 - 60, v.y0 - 60, v.x1 - v.x0 + 120, v.y1 - v.y0 + 120); g.moveTo(A.x + R, A.y); g.arc(A.x, A.y, R, 0, TAU, true); g.fill('evenodd');
        g.strokeStyle = 'rgba(30,12,24,.6)'; g.lineWidth = 26; g.beginPath(); g.arc(A.x, A.y + 3, R, 0, TAU); g.stroke();
        g.strokeStyle = '#4a2a34'; g.lineWidth = 16; g.beginPath(); g.arc(A.x, A.y, R, 0, TAU); g.stroke();
        g.globalCompositeOperation = 'lighter';
        g.strokeStyle = `rgba(255,58,40,${0.45 + Math.sin(t * 4) * 0.15})`; g.lineWidth = 12; g.beginPath(); g.arc(A.x, A.y, R, 0, TAU); g.stroke();
        g.strokeStyle = '#ffb08a'; g.lineWidth = 2.4; g.beginPath(); g.arc(A.x, A.y, R, 0, TAU); g.stroke();
        g.strokeStyle = '#ffe0c8'; g.lineWidth = 1.8;
        const n = 44, off = t * 0.07;
        for (let i = 0; i < n; i++) {
          const a = off + i / n * TAU, x = A.x + Math.cos(a) * R, y = A.y + Math.sin(a) * R;
          if (!this.inView(x, y, 20)) continue;
          g.globalAlpha = 0.6 + Math.sin(t * 5 + i * 1.7) * 0.4;
          this.M(x, y, 1, 1, a + Math.PI / 2); rune(g, i, 4.6);
        }
        g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
        this.W();
      }
    } else if (this.arenaPrev) { // le boss est vaincu : le mur s'effondre
      this.arenaFall = { ...this.arenaPrev, t: 0 };
      const F = this.arenaFall;
      for (let i = 0; i < 40 && this.sparks.length < 220; i++) { const a = i / 40 * TAU; this.sparks.push({ x: F.x + Math.cos(a) * F.R, y: F.y + Math.sin(a) * F.R - 20, vx: Math.cos(a) * 160, vy: Math.sin(a) * 110 - 80, life: 0.7, max: 0.7, c: '#ff8a5a', star: true, w: 2.4, big: 1.6 }); }
      this.arenaPrev = null;
    }
    // autel du boss : dalle, runes rouges qui s'allument quand on approche, anneau de charge
    const Al = run.altar;
    if (Al && this.inView(Al.x, Al.y, 110)) {
      this.spr(I.altarBase, Al.x, Al.y);
      if (!Al.used) {
        const d = Math.hypot(p.x - Al.x, p.y - Al.y), near = clamp(1 - (d - 100) / 450, 0, 1), ch = Al.charge;
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = clamp(0.32 + near * 0.35 + ch * 0.35 + Math.sin(t * 3) * 0.08, 0, 1);
        this.tex(I.altarRunes.c, Al.x, Al.y, I.altarRunes.R, I.altarRunes.R, t * 0.12);
        if (ch > 0) { const r = 56 * (0.45 + ch * 0.55); g.globalAlpha = 0.45 + ch * 0.55; this.tex(swirlTex('#6a0a14', '#ff3a2a', '#ffd8a0'), Al.x, Al.y, r, r, -t * (2 + ch * 7)); }
        g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
        this.W();
        g.lineWidth = 3.4; g.strokeStyle = `rgba(255,90,70,${0.35 + near * 0.45})`;
        g.save(); g.setLineDash([14, 10]); g.lineDashOffset = -t * 26; g.beginPath(); g.arc(Al.x, Al.y, Al.R + 16, 0, TAU); g.stroke(); g.restore();
        if (ch > 0) this.chargeArc(Al.x, Al.y, Al.R + 16, ch, '#ff4a3a', '#ffe0c8');
      }
    }
    // portail : dallage, sol tourbillonnant, runes et anneau de charge
    const Po = run.portal;
    if (Po && this.inView(Po.x, Po.y, 110)) {
      const s = backOut(clamp(Po.t / 0.9, 0, 1)), ch = Po.charge;
      this.spr(I.portalBase, Po.x, Po.y, s, s);
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.85; this.tex(swirlTex('#3a1a8a', '#a05aff', '#e8f4ff'), Po.x, Po.y, 60 * s, 60 * s, -t * (1.6 + ch * 6));
      g.globalAlpha = 0.6 + Math.sin(t * 3) * 0.25; this.tex(I.portalRunes.c, Po.x, Po.y, I.portalRunes.R * s, I.portalRunes.R * s, t * 0.25);
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      this.W();
      g.lineWidth = 3; g.strokeStyle = `rgba(200,240,255,${0.45 + Math.sin(t * 5) * 0.2})`;
      g.save(); g.setLineDash([10, 10]); g.lineDashOffset = t * 30; g.beginPath(); g.arc(Po.x, Po.y, (Po.R + 22) * s, 0, TAU); g.stroke(); g.restore();
      if (ch > 0) this.chargeArc(Po.x, Po.y, Po.R + 22, ch, '#7ae8ff', '#ffffff');
    }
    // totems : cercle de leur couleur, qui se remplit
    for (const T of run.totems || []) {
      if (!this.inView(T.x, T.y, 70)) continue;
      const col = TOTEMS[T.kind]?.color || '#ffffff';
      if (T.used) { g.strokeStyle = 'rgba(150,150,170,.3)'; g.lineWidth = 3; g.beginPath(); g.arc(T.x, T.y, 55, 0, TAU); g.stroke(); continue; }
      g.fillStyle = hexA(col, 0.13); g.beginPath(); g.arc(T.x, T.y, 55, 0, TAU); g.fill();
      g.lineWidth = 3; g.strokeStyle = hexA(col, 0.8);
      g.save(); g.setLineDash([10, 8]); g.lineDashOffset = -t * 20; g.beginPath(); g.arc(T.x, T.y, 55, 0, TAU); g.stroke(); g.restore();
      if (T.charge > 0) { g.fillStyle = hexA(col, 0.25); g.beginPath(); g.arc(T.x, T.y, 55 * T.charge, 0, TAU); g.fill(); this.chargeArc(T.x, T.y, 55, T.charge, col, '#ffffff'); }
    }
    // rayon tournant du boss : la zone balayée et la ligne de départ sont annoncées
    const B = run.boss;
    if (B && !B.dead && (B.phase === 'sweepW' || B.phase === 'sweep') && B.sweepLen) {
      const L = B.sweepLen, dir = B.sweepDir || 1, w = B.sweepW || 34, warn = B.phase === 'sweepW';
      const left = warn ? SWEEP_ARC : SWEEP_ARC * clamp(B.phaseT / (B.sweepDur || 2.4), 0, 1), a0 = B.sweepA, a1 = a0 + dir * left;
      const blink = warn ? 0.5 + Math.sin(t * 24) * 0.5 : 0;
      g.fillStyle = `rgba(255,40,30,${0.14 + blink * 0.12})`;
      g.beginPath(); g.moveTo(B.x, B.y); g.arc(B.x, B.y, L, a0, a1, dir < 0); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(255,90,60,.6)'; g.lineWidth = 3;
      g.save(); g.setLineDash([16, 12]); g.lineDashOffset = -t * 40 * dir; g.beginPath(); g.arc(B.x, B.y, L, a0, a1, dir < 0); g.stroke(); g.restore();
      if (warn) {
        this.M(B.x, B.y, 1, 1, a0);
        g.fillStyle = `rgba(255,40,30,${0.22 + blink * 0.3})`; g.fillRect(0, -w / 2, L, w);
        g.strokeStyle = `rgba(255,${120 + blink * 135 | 0},${100 + blink * 155 | 0},.95)`; g.lineWidth = 3; g.strokeRect(0, -w / 2, L, w);
        // chevrons : sens de rotation du rayon
        g.fillStyle = 'rgba(255,240,230,.9)';
        for (let i = 1; i <= 4; i++) { const x = L * i / 5; g.beginPath(); g.moveTo(x - 9, dir * (w * 0.5 + 6)); g.lineTo(x, dir * (w * 0.5 + 18)); g.lineTo(x + 9, dir * (w * 0.5 + 6)); g.lineTo(x, dir * (w * 0.5 + 11)); g.closePath(); g.fill(); }
        this.W();
      }
    }
  }

  // anneau de charge (autel, portail, totems) : arc épais qui fait le tour
  chargeArc(x, y, R, k, col, core) {
    const g = this.g, a0 = -Math.PI / 2, a1 = a0 + k * TAU;
    g.strokeStyle = 'rgba(20,8,30,.5)'; g.lineWidth = 10; g.beginPath(); g.arc(x, y + 1, R, a0, a1); g.stroke();
    g.strokeStyle = col; g.lineWidth = 7; g.beginPath(); g.arc(x, y, R, a0, a1); g.stroke();
    g.strokeStyle = core; g.lineWidth = 2.4; g.beginPath(); g.arc(x, y - 1, R, a0, a1); g.stroke();
    this.glowAdd(x + Math.cos(a1) * R, y + Math.sin(a1) * R, 16, col, 0.9);
  }

  // ---------- Éléments debout (triés avec les personnages) ----------
  drawAltar(A) {
    const run = this.run, t = this.t, p = run.p, I = this.items, Po = run.portal;
    if (Po && Math.hypot(Po.x - A.x, Po.y - A.y) < 40) return; // le portail s'ouvre sur l'autel
    if (A.used) { this.spr(I.altarTop[1], A.x, A.y); return; }
    const ch = A.charge, d = Math.hypot(p.x - A.x, p.y - A.y), near = clamp(1 - (d - 100) / 450, 0, 1);
    const sh = ch > 0.05 ? Math.sin(t * 50) * ch * 1.6 : 0;
    this.glowAdd(A.x, A.y - 50, 50 + ch * 40, '#ff2a1a', 0.25 + near * 0.25 + ch * 0.4);
    this.spr(I.altarTop[0], A.x + sh, A.y);
    const ea = 0.55 + near * 0.3 + ch * 0.5 + Math.sin(t * 5) * 0.12;
    for (const sd of [-1, 1]) this.glowAdd(A.x + sh + sd * 7, A.y - 55, 8 + ch * 9 + near * 3, '#ff3a1a', ea);
    if (Math.random() < 0.12 + near * 0.15 + ch * 0.6 && this.sparks.length < 200) this.sparks.push({ x: A.x + rand(-70, 70), y: A.y + rand(-40, 40), vx: rand(-10, 10), vy: -rand(30, 70), g: -40, life: rand(0.6, 1.1), max: 1.1, c: Math.random() < 0.5 ? '#ff5a3a' : '#ffb04a', star: true, w: 2 });
  }

  drawTotem(T) {
    const I = this.items, t = this.t, col = TOTEMS[T.kind]?.color || '#ffffff', spr = I.totem[T.kind];
    if (!spr) return;
    if (T.used) { this.spr(spr[1], T.x, T.y); return; }
    const ch = T.charge, w = ch > 0 ? Math.sin(t * 30) * 0.03 * ch : 0;
    this.glowAdd(T.x, T.y - 44, 46 + ch * 30, col, 0.3 + ch * 0.45 + Math.sin(t * 2.5 + T.x) * 0.08);
    this.spr(spr[0], T.x, T.y, 1 + w, 1 - w);
    this.badge(T.x, T.y - 112 + Math.sin(t * 2.6 + T.x) * 4, 13, col, this.icons[T.kind]);
    if (Math.random() < 0.06 + ch * 0.5 && this.sparks.length < 200) this.sparks.push({ x: T.x + rand(-40, 40), y: T.y + rand(-20, 20), vx: 0, vy: -rand(30, 60), g: -40, life: rand(0.6, 1), max: 1, c: col, star: true, w: 2 });
  }

  // pastille ronde avec une icône (totems, flèches)
  badge(x, y, r, col, img) {
    const g = this.g;
    this.W();
    g.fillStyle = INK2; g.beginPath(); g.arc(x, y + 1.5, r + 2.2, 0, TAU); g.fill();
    const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.45, 0, x, y, r);
    gr.addColorStop(0, shadeHex(col, 0.45)); gr.addColorStop(0.6, col); gr.addColorStop(1, shadeHex(col, -0.35));
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 1.4; g.beginPath(); g.arc(x, y, r - 1.6, 0, TAU); g.stroke();
    if (img && img.complete && img.naturalWidth) g.drawImage(img, x - r * 0.78, y - r * 0.8, r * 1.56, r * 1.56);
  }

  drawPortal(P) {
    const g = this.g, t = this.t, I = this.items, s = backOut(clamp(P.t / 0.9, 0, 1)), ch = P.charge;
    const cx = P.x, cy = P.y - 58 * s, sp = 1 + ch * 3;
    this.glowAdd(cx, cy, 120 * s + ch * 40, '#a05aff', 0.55 + ch * 0.3);
    g.globalAlpha = 1; this.tex(swirlTex('#2a0a6a', '#8a3aff', '#f0e0ff'), cx, cy, 45 * s, 58 * s, -t * 2.2 * sp);
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.75; this.tex(swirlTex('#1a3aaa', '#5ae8ff', '#ffffff'), cx, cy, 34 * s, 46 * s, t * 3.1 * sp);
    g.globalAlpha = 0.6 + Math.sin(t * 6) * 0.2; this.W(); g.drawImage(glowTex('#ffffff'), cx - 22 * s, cy - 26 * s, 44 * s, 52 * s);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    this.spr(I.portalArch, P.x, P.y, 1, s);
    this.glowAdd(P.x, P.y - 116 * s, 14 + Math.sin(t * 4) * 3, '#5ae8ff', 0.85);
    let i = 0;
    for (const [x, y] of [[-49, -18], [49, -18], [-49, -41], [49, -41], [-49, -62], [49, -62]]) this.glowAdd(P.x + x, P.y + y * s, 9, '#7ae8ff', 0.3 + 0.25 * Math.sin(t * 4 + i++));
  }

  drawLoot(it) {
    const g = this.g, run = this.run, t = this.t, I = this.items, tier = clamp(it.tier | 0, 0, 3), col = LOOT_GLOW[tier];
    const age = it.t0 != null && it.t0 > 0 ? run.time - it.t0 : 9;
    let up = 0, sx = 1, sy = 1;
    if (age >= 0 && age < 0.6) { const k = age / 0.6; up = Math.sin(k * Math.PI) * 70 * (1 - k * 0.3); sx = sy = 0.5 + 0.5 * easeOut(k); }
    else if (age >= 0.6 && age < 0.8) { const k = Math.sin((age - 0.6) / 0.2 * Math.PI); sx = 1 + k * 0.22; sy = 1 - k * 0.18; }
    else { const ph = (t * 1.2 + it.x * 0.013) % 2.4; if (ph < 0.4) { const k = Math.sin(ph / 0.4 * Math.PI); up = k * 6; sx = 1 - k * 0.05; sy = 1 + k * 0.07; } }
    // rayons tournants (or, mythique), halo, colonne de lumière
    if (tier >= 2) {
      g.fillStyle = tier === 3 ? '#ffb0f0' : '#fff0a0';
      this.M(it.x, it.y - 14 - up, 1, 1, t * 0.7);
      for (let i = 0; i < 8; i++) { g.rotate(TAU / 8); g.globalAlpha = 0.28 + 0.06 * tier; g.beginPath(); g.moveTo(0, 0); g.lineTo(30 + tier * 8, -5); g.lineTo(30 + tier * 8, 5); g.fill(); }
      g.globalAlpha = 1;
    }
    this.glowAdd(it.x, it.y - 14 - up, 24 + tier * 7, col, 0.35 + 0.12 * tier + Math.sin(t * 3 + it.x) * 0.08);
    if (tier >= 2 || it.hidden) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.22 + 0.05 * tier; this.W(); const w = 24 + tier * 6, h = 90 + tier * 30; g.drawImage(beamTex(col), it.x - w / 2, it.y - h, w, h); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
    this.shadow(it.x, it.y, 34 * sx, 11, 0.3);
    this.spr(I.loot[tier], it.x, it.y - up, sx, sy);
    if (Math.random() < 0.035 + 0.05 * tier) this.sparkle(it.x + rand(-18, 18), it.y - 14 - up + rand(-16, 8), Math.random() < 0.5 ? '#ffffff' : col);
  }

  // ---------- Effets de l'expédition (après les personnages) ----------
  fxWorld(g) {
    const run = this.run, t = this.t, dt = this.dt, p = run.p;
    g.globalCompositeOperation = 'lighter';
    // mur d'énergie de l'arène (colonnes de lumière tout autour)
    const A = run.arena, F = this.arenaFall;
    const wall = (W, hk, a) => {
      const n = 64, bt = beamTex('#ff3a2a'), w = TAU * W.R / n * 1.35;
      for (let i = 0; i < n; i++) {
        const an = i / n * TAU, x = W.x + Math.cos(an) * W.R, y = W.y + Math.sin(an) * W.R;
        if (!this.inView(x, y, 80)) continue;
        const h = (52 + Math.sin(t * 3 + i * 0.7) * 12) * hk;
        g.globalAlpha = a * (0.75 + Math.sin(t * 5 + i * 2.1) * 0.25);
        this.W(); g.drawImage(bt, x - w / 2, y - h, w, h);
      }
      g.globalAlpha = a * 0.5; this.W(); g.strokeStyle = '#ff6a4a'; g.lineWidth = 2.4; g.beginPath(); g.arc(W.x, W.y - 50 * hk, W.R, 0, TAU); g.stroke();
      g.globalAlpha = 1;
    };
    if (A && this.inView(A.x, A.y, A.R + 80)) {
      const k = clamp(this.arenaT / 0.5, 0, 1);
      wall(A, backOut(k), 0.42);
      if (Math.random() < 0.5 && this.sparks.length < 200) { const an = Math.random() * TAU, x = A.x + Math.cos(an) * A.R, y = A.y + Math.sin(an) * A.R; if (this.inView(x, y)) this.sparks.push({ x, y, vx: 0, vy: -rand(40, 90), g: -60, life: 0.8, max: 0.8, c: '#ffb08a', star: true, w: 2 }); }
    }
    if (F) { F.t += dt; const k = F.t / 0.7; if (k >= 1) this.arenaFall = null; else wall(F, 1 - easeOut(k), 0.42 * (1 - k)); }
    // rayon tournant du boss
    const B = run.boss;
    if (B && !B.dead && B.phase === 'sweep' && B.sweepLen && this.inView(B.x, B.y, B.sweepLen + 40)) {
      const L = B.sweepLen, w = (B.sweepW || 34) * (1 + Math.sin(t * 40) * 0.06), dir = B.sweepDir || 1;
      for (let i = 3; i >= 1; i--) { this.M(B.x, B.y - 14, 1, 1, B.sweepA - dir * i * 0.06); g.globalAlpha = 0.22 / i; g.fillStyle = '#ff5a2a'; g.fillRect(0, -w * 0.4, L, w * 0.8); }
      this.M(B.x, B.y - 14, 1, 1, B.sweepA);
      g.globalAlpha = 0.95; g.drawImage(glowTex('#ff3a1a'), -w, -w * 1.5, L + w * 2, w * 3);
      g.fillStyle = '#ff7a3a'; g.fillRect(0, -w * 0.45, L, w * 0.9);
      g.fillStyle = '#ffe0b0'; g.fillRect(0, -w * 0.24, L, w * 0.48);
      g.fillStyle = '#ffffff'; g.fillRect(0, -w * 0.09, L, w * 0.18);
      g.globalAlpha = 1;
      this.glowAdd(B.x, B.y - 14, w * 2.6, '#ff8a3a', 0.9);
      g.globalCompositeOperation = 'lighter';
      const ex = B.x + Math.cos(B.sweepA) * L, ey = B.y + Math.sin(B.sweepA) * L;
      this.W(); g.drawImage(glowTex('#ffb04a'), ex - w * 1.6, ey - 14 - w * 1.6, w * 3.2, w * 3.2);
      if (Math.random() < 0.7) this.sparks.push({ x: ex, y: ey - 14, vx: rand(-200, 200), vy: rand(-220, 40), life: 0.35, max: 0.35, c: '#ffd08a', w: 2.6 });
      if (Math.random() < 0.25) this.decal(B.x + Math.cos(B.sweepA) * L * rand(0.3, 1), B.y + Math.sin(B.sweepA) * L * rand(0.3, 1), 14, '#2a0a08', 0.3);
    }
    // colonnes de lumière (invocation, portail, totems, évolution)
    for (const c of this.pillars) {
      c.t += dt;
      const k = c.t / c.max;
      if (k >= 1 || !this.inView(c.x, c.y - c.h / 2, c.h / 2 + c.w)) continue;
      const grow = easeOut(clamp(k * 4, 0, 1)), w = c.w * (k < 0.25 ? grow : 1 - (k - 0.25) * 0.6);
      g.globalAlpha = 1 - k; this.W(); g.drawImage(beamTex(c.c), c.x - w / 2, c.y - c.h * grow, w, c.h * grow);
    }
    g.globalAlpha = 1;
    this.pillars = this.pillars.filter(c => c.t < c.max);
    // portail : grande colonne de lumière visible de loin, étincelles aspirées
    const Po = run.portal;
    if (Po && this.inView(Po.x, Po.y - 350, 450)) {
      const s = clamp(Po.t / 0.9, 0, 1), pulse = Math.sin(t * 2.5) * 0.08;
      this.W();
      g.globalAlpha = (0.3 + pulse) * s; g.drawImage(beamTex('#b06aff'), Po.x - 70, Po.y - 900, 140, 900);
      g.globalAlpha = (0.45 + pulse) * s; g.drawImage(beamTex('#7ae8ff'), Po.x - 24, Po.y - 700, 48, 700);
      g.globalAlpha = 1;
      while (this.suck.length < 28) this.suck.push({ a: Math.random() * TAU, d: rand(60, 170), v: rand(30, 70), c: Math.random() < 0.4 ? '#7ae8ff' : Math.random() < 0.5 ? '#c08aff' : '#ffffff', s: rand(4, 9) });
      const cx = Po.x, cy = Po.y - 58 * s;
      for (const q of this.suck) {
        q.d -= q.v * dt * (1 + (1 - q.d / 170) * 2.5) * (1 + Po.charge * 2); q.a += dt * (1.5 + 50 / Math.max(10, q.d));
        if (q.d < 6) { q.d = rand(110, 170); q.a = Math.random() * TAU; }
        const x = cx + Math.cos(q.a) * q.d, y = cy + Math.sin(q.a) * q.d * 0.8, a = clamp(q.d / 30, 0, 1) * clamp((170 - q.d) / 30, 0, 1);
        g.globalAlpha = a; g.drawImage(glowTex(q.c), x - q.s, y - q.s, q.s * 2, q.s * 2);
      }
      g.globalAlpha = 1;
    } else this.suck.length = 0;
    // arrivée dans un monde : le tourbillon se referme derrière le héros
    if (this.arrival > 0) {
      this.arrival -= dt;
      const k = clamp(this.arrival / 1.3, 0, 1), s = k < 0.85 ? easeOut(k / 0.85) : 1, x = p.x, y = p.y - 40;
      if (s > 0.01) {
        g.globalAlpha = 0.6 * s; this.tex(swirlTex('#3a1a8a', '#a05aff', '#ffffff'), x, y, 56 * s, 72 * s, -t * 5);
        g.globalAlpha = 0.4 * s; this.tex(swirlTex('#1a3aaa', '#5ae8ff', '#ffffff'), x, y, 40 * s, 54 * s, t * 7);
        g.globalAlpha = 0.5 * s; this.W(); g.drawImage(beamTex('#c08aff'), x - 60 * s, y - 500, 120 * s, 540);
        g.globalAlpha = 1;
      }
    }
    // éclairs (crâne -> boss, foudre en chaîne)
    for (const b of this.bolts) {
      b.t += dt;
      const a = clamp(1 - b.t / b.max, 0, 1);
      this.W();
      for (const [w, col, al] of [[10, b.c, 0.35], [4, b.c, 0.9], [1.6, '#ffffff', 1]]) {
        g.globalAlpha = a * al; g.strokeStyle = col; g.lineWidth = w; g.beginPath();
        b.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
      }
    }
    g.globalAlpha = 1;
    this.bolts = this.bolts.filter(b => b.t < b.max);
    // forme ultime : immenses rayons dorés
    for (const r of this.rays) {
      r.t += dt;
      const k = r.t / r.max, a = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85;
      g.globalCompositeOperation = 'source-over';
      this.M(p.x, p.y - 24, 1, 1, t * 0.8);
      g.fillStyle = '#ffe680';
      for (let i = 0; i < 14; i++) { g.rotate(TAU / 14); g.globalAlpha = 0.34 * a; g.beginPath(); g.moveTo(0, 0); g.lineTo(460, -36); g.lineTo(460, 36); g.fill(); }
      g.globalAlpha = 1; g.globalCompositeOperation = 'lighter';
      this.glowAdd(p.x, p.y - 24, 160, r.c, 0.6 * a); g.globalCompositeOperation = 'lighter';
    }
    this.rays = this.rays.filter(r => r.t < r.max);
    g.globalCompositeOperation = 'source-over';
    // ondes de choc cartoon
    this.W();
    for (const r of this.rings) {
      r.t += dt;
      if (r.t < 0) continue;
      const k = r.t / r.max;
      if (k >= 1 || !this.inView(r.x, r.y, Math.max(r.r0, r.r1) + 20)) continue;
      const R = r.r0 + (r.r1 - r.r0) * easeOut(k), w = r.w * (1 - k) + 1.5;
      g.globalAlpha = (1 - k) * 0.5; g.strokeStyle = INK2; g.lineWidth = w + 3; g.beginPath(); g.arc(r.x, r.y + 2, R, 0, TAU); g.stroke();
      g.globalAlpha = 1 - k * k; g.strokeStyle = r.c; g.lineWidth = w; g.beginPath(); g.arc(r.x, r.y, R, 0, TAU); g.stroke();
      g.strokeStyle = '#ffffff'; g.lineWidth = Math.max(1, w * 0.3); g.beginPath(); g.arc(r.x, r.y - w * 0.25, R, 0, TAU); g.stroke();
    }
    g.globalAlpha = 1;
    this.rings = this.rings.filter(r => r.t < r.max);
    // éclats de pierre
    for (const d of this.debris) {
      d.life -= dt; d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt; d.vz -= 900 * dt; d.rot += d.vr * dt;
      if (d.z < 0) { d.z = 0; d.vz *= -0.35; d.vx *= 0.6; d.vy *= 0.6; d.vr *= 0.5; }
      if (!this.inView(d.x, d.y, 30)) continue;
      g.globalAlpha = clamp(d.life * 3, 0, 1);
      this.M(d.x, d.y - d.z, 1, 1, d.rot);
      g.fillStyle = d.c; g.strokeStyle = INK2; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(-d.r, -d.r * 0.4); g.lineTo(-d.r * 0.2, -d.r); g.lineTo(d.r, -d.r * 0.3); g.lineTo(d.r * 0.6, d.r * 0.8); g.lineTo(-d.r * 0.7, d.r * 0.6); g.closePath(); g.fill(); g.stroke();
    }
    g.globalAlpha = 1;
    this.debris = this.debris.filter(d => d.life > 0);
  }

  // ---------- Personnages et décor, triés par profondeur ----------
  drawSorted(g) {
    const run = this.run, p = run.p, v = this.view, L = this.list;
    L.length = 0;
    this.props.length = 0;
    this.world.propsIn(v.x0 - 60, v.y0 - 20, v.x1 + 60, v.y1 + 140, this.props);
    for (const pr of this.props) L.push(pr);
    for (const c of run.chests) if (this.inView(c.x, c.y, 40)) L.push({ y: c.y, k: 'chest', o: c });
    for (const c of run.dropChests) if (this.inView(c.x, c.y, 40)) L.push({ y: c.y, k: 'gchest', o: c });
    for (const s of run.shrines) if (this.inView(s.x, s.y, 60)) L.push({ y: s.y, k: 'shrine', o: s });
    const Al = run.altar, Po = run.portal;
    if (Al && this.inView(Al.x, Al.y, 110)) L.push({ y: Al.y + 1, k: 'altar', o: Al });
    if (Po && this.inView(Po.x, Po.y, 170)) L.push({ y: Po.y + 2, k: 'portal', o: Po });
    for (const T of run.totems || []) if (this.inView(T.x, T.y, 130)) L.push({ y: T.y, k: 'totem', o: T });
    for (const it of run.pickups) if (it.type === 'loot' && this.inView(it.x, it.y, 80)) L.push({ y: it.y, k: 'loot', o: it });
    for (const e of run.enemies) if (!e.dead && this.inView(e.x, e.y, e.r * 3 + 40)) L.push({ y: e.y, k: 'enemy', o: e });
    if (run.pet) L.push({ y: run.pet.y, k: 'pet', o: run.pet });
    L.sort((a, b) => a.y - b.y);
    for (const it of L) {
      if (it.spr) this.drawProp(it);
      else if (it.k === 'enemy') this.drawEnemy(it.o);
      else if (it.k === 'chest' || it.k === 'gchest') this.drawChest(it.o, it.k === 'gchest');
      else if (it.k === 'shrine') this.drawShrine(it.o);
      else if (it.k === 'pet') this.drawPet(it.o);
      else if (it.k === 'altar') this.drawAltar(it.o);
      else if (it.k === 'portal') this.drawPortal(it.o);
      else if (it.k === 'totem') this.drawTotem(it.o);
      else if (it.k === 'loot') this.drawLoot(it.o);
    }
    // le héros toujours par-dessus la foule, avec un anneau au sol pour le repérer
    if (!run.dying) {
      this.W(); const g2 = this.g;
      g2.fillStyle = 'rgba(74,160,255,.18)'; g2.beginPath(); g2.ellipse(p.x, p.y, 18, 7.5, 0, 0, TAU); g2.fill();
      g2.strokeStyle = 'rgba(20,40,110,.5)'; g2.lineWidth = 4.4; g2.stroke();
      g2.strokeStyle = '#4aa8ff'; g2.lineWidth = 2.6; g2.stroke();
      g2.strokeStyle = 'rgba(220,240,255,.85)'; g2.lineWidth = 1; g2.beginPath(); g2.ellipse(p.x, p.y - 0.8, 18, 7.5, 0, Math.PI * 1.05, Math.PI * 1.95); g2.stroke();
    }
    this.drawHero();
  }

  drawProp(pr) {
    const p = this.run.p, g = this.g, s = pr.spr, m = s.meta;
    // le décor devant le héros devient transparent
    let a = 1;
    if (pr.tall && pr.y > p.y && pr.y - p.y < m.h * pr.s + 10 && Math.abs(pr.x - p.x) < m.w * 0.5 * pr.s + 10) a = 0.45;
    const sway = pr.kind === 'tree' || pr.kind === 'reeds' || pr.kind === 'tentacle' ? Math.sin(this.t * 1.3 + pr.ph) * 0.025 : 0;
    this.shadow(pr.x, pr.y, m.w * 0.85 * pr.s, m.w * 0.3 * pr.s, 0.28);
    g.globalAlpha = a;
    this.spr(s, pr.x, pr.y, pr.s * (pr.flip ? -1 : 1), pr.s, sway);
    g.globalAlpha = 1;
  }

  drawChest(c, gold) {
    const I = this.items, s = (gold ? I.gchest : I.chest)[c.open ? 1 : 0], t = this.t;
    if (!c.open) {
      const near = Math.hypot(c.x - this.run.p.x, c.y - this.run.p.y) < 140;
      const hop = near ? Math.abs(Math.sin(t * 6)) * 3 : 0;
      this.glowAdd(c.x, c.y - 14, gold ? 46 : 36, gold ? '#c06aff' : '#5aa8ff', gold ? 0.7 : 0.4 + Math.sin(t * 3) * 0.1);
      this.spr(s, c.x, c.y - hop, 1 + hop * 0.01, 1 - hop * 0.01);
      if (Math.sin(t * 2.3 + c.x) > 0.93) this.sparkle(c.x + rand(-14, 14), c.y - 26, '#fff4b0');
    } else { this.g.globalAlpha = 0.85; this.spr(s, c.x, c.y); this.g.globalAlpha = 1; }
  }

  drawShrine(s) {
    const I = this.items, t = this.t;
    this.spr(I.shrine, s.x, s.y);
    const bob = Math.sin(t * 2.4 + s.x) * 3;
    if (!s.used) this.glowAdd(s.x, s.y - 40 + bob, 34 + s.charge * 26, '#4fd0ff', 0.6 + s.charge * 0.4);
    this.spr(I.crystal[s.used ? 1 : 0], s.x, s.y - 26 + bob, 1, 1, s.used ? 0 : Math.sin(t * 1.5) * 0.1);
  }

  drawPet(pet) {
    if (!this.pet) return;
    const t = this.t, p = this.run.p;
    const face = pet.g_face = (p.x - pet.x > 4 ? 1 : p.x - pet.x < -4 ? -1 : pet.g_face || 1);
    const hop = Math.abs(Math.sin(t * 7)) * 3;
    this.spr(this.pet[(t * 4 | 0) & 1], pet.x, pet.y - hop - 4, face, 1 + Math.sin(t * 14) * 0.03);
  }

  drawEnemy(e) {
    const g = this.g, t = this.t, run = this.run, p = run.p, set = this.monSpr(e);
    const k = (e.r / 16) / set.k;
    if (e.burrowed && e.jumpH < -40) { // sous terre : une butte de terre file vers le joueur
      const I = this.items, w = Math.sin(t * 30) * 0.06;
      this.spr(I.mound, e.x, e.y, k * 0.9 * (1 + w), k * 0.9 * (1 - w));
      if (Math.random() < 0.3) this.puff(e.x + rand(-10, 10) * k, e.y, 1, 6 * k, 0.4, '#b89a7a');
      return;
    }
    // regard vers le joueur (ou dans le sens de la charge)
    const sx = Math.sin(e.ang);
    if (sx > 0.2) e.g_face = 1; else if (sx < -0.2) e.g_face = -1; else e.g_face = e.g_face || 1;
    const f = ((e.bob * 0.55) | 0) % set.f.length; // nombre d'images d'animation libre (2 à 6)
    const body = e.def.body, age = run.time - e.born;
    let sxs = 1, sys = 1, up = e.fly * 0.9, rot = 0;
    if (body === 'blob' || body === 'worm') { const h = Math.abs(Math.sin(e.bob * 0.7)); up += h * 5 * k; sxs = 1 + (1 - h) * 0.1; sys = 1 - (1 - h) * 0.1; }
    else if (e.fly) { up += Math.sin(e.bob * 0.45) * 3; rot = Math.sin(e.bob * 0.45) * 0.06; }
    else { up += Math.abs(Math.sin(e.bob)) * 1.6 * k; rot = Math.sin(e.bob) * 0.06; }
    if (e.jumpH > 0) { up += e.jumpH; sys *= 1.08; sxs *= 0.94; }
    else if (e.jumpH < 0) up += e.jumpH * 0.12;
    if (e.g_sq > 0) { const q = e.boss ? 0.25 : e.elite ? 0.5 : 1; sxs *= 1 + e.g_sq * 0.16 * q; sys *= 1 - e.g_sq * 0.12 * q; e.g_sq = Math.max(0, e.g_sq - this.dt * 9); }
    if (age < 0.3) { const a = backOut(clamp(age / 0.3, 0, 1)); sxs *= a; sys *= a; if (!e.g_sp) { e.g_sp = 1; this.puff(e.x, e.y, 3, e.r * 0.5, 0.45); } }
    const a = e.act;
    if (a && a.stage === 0 && (a.kind === 'dash' || a.kind === 'strafe' || a.kind === 'stomp')) { const w = Math.sin(t * 40) * 0.05; sxs *= 1 + w; sys *= 1 - w; rot += -0.12 * e.g_face; }
    if (e.boss && e.phase === 'aim') rot += -0.1 * e.g_face;
    const sc = k;
    // aura des élites / rage du boss
    if (e.elite || e.enraged) {
      const col = e.enraged ? '#ff3a3a' : '#d08aff', R = e.r * 2.2 * (1 + Math.sin(t * 5) * 0.08);
      this.glowAdd(e.x, e.y - e.r * 0.9 - up, R, col, e.enraged ? 0.75 : 0.55);
    }
    // traînée pendant une charge
    if (e.g_trail > 0) {
      e.g_trail -= this.dt;
      const vx = (e.act ? e.act.dx : e.dashX) || 0, vy = (e.act ? e.act.dy : e.dashY) || 0;
      for (let i = 1; i <= 3; i++) {
        g.globalAlpha = 0.28 / i;
        this.spr(set.f[f], e.x - vx * i * e.r * 0.8, e.y - vy * i * e.r * 0.8 - up, sc * e.g_face * sxs, sc * sys, rot, set.f[f].white);
      }
      g.globalAlpha = 1;
    }
    const s = set.f[f];
    // les gros monstres ne deviennent pas tout blancs quand on les frappe sans arrêt : simple reflet
    const big = e.boss || e.elite;
    // devenus fous après le chrono : variante enragée (contour rouge)
    const img = e.flash > 0 && !big ? s.white : e.freeze > 0 ? s.ice : (e.mad || (run.overtime > 0 && !e.boss)) && s.rage ? s.rage : s.c;
    if (body === 'ghost') g.globalAlpha = 0.88;
    this.spr(s, e.x, e.y - up, sc * e.g_face * sxs, sc * sys, rot, img);
    if (big && e.flash > 0) { g.globalAlpha = e.flash > 0.05 ? 0.4 : 0.25; this.spr(s, e.x, e.y - up, sc * e.g_face * sxs, sc * sys, rot, s.white); }
    g.globalAlpha = 1;
    if (e.g_new > 0) { e.g_new -= this.dt * 1.5; g.globalCompositeOperation = 'lighter'; g.globalAlpha = Math.max(0, e.g_new); this.spr(s, e.x, e.y - up, sc * e.g_face, sc, 0, s.white); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
    // boss : apparition et rugissement (changement de phase) font trembler l'air
    if (e.boss && (e.phase === 'intro' || e.phase === 'roar')) {
      e.g_roar = (e.g_roar || 0) - this.dt;
      if (e.g_roar <= 0) { e.g_roar = 0.22; this.rings.push({ x: e.x, y: e.y - e.r * 0.6 - up, r0: e.r * 0.8, r1: e.r * 3.2, t: 0, max: 0.45, c: e.phase === 'intro' ? '#ff4a3a' : e.enraged ? '#ff2a2a' : '#ff9a3a', w: 6 }); }
      this.glowAdd(e.x, e.y - e.r - up, e.r * 2.6, e.phase === 'intro' ? '#ff2a1a' : '#ff8a2a', 0.5 + Math.sin(t * 20) * 0.15);
      if (e.phase === 'intro' && Math.random() < 0.5) this.puff(e.x + rand(-e.r, e.r), e.y, 1, e.r * 0.5, 0.6, '#4a1a2a');
    }
    // charge d'un tir : boule qui grossit devant le monstre
    if (a && a.stage === 0 && (a.kind === 'shoot' || a.kind === 'volley')) {
      const kk = clamp(1 - a.t / a.dur, 0, 1);
      this.glowAdd(e.x + a.dx * e.r * 1.1, e.y - e.r - up + a.dy * e.r * 0.6, 6 + kk * 14, '#ff3a6a', 0.9);
    }
    if (e.boss && (e.phase === 'ringW' || (e.phase === 'spiral' && e.spinUp > 0) || e.phase === 'summonW')) {
      const col = e.phase === 'summonW' ? '#c06aff' : '#ff3a6a';
      this.glowAdd(e.x, e.y - e.r - up, e.r * (2 + Math.sin(t * 30) * 0.3), col, 0.8);
    }
  }

  drawHero() {
    const run = this.run, p = run.p, hs = this.hs, t = this.t, dt = this.dt, g = this.g;
    const cls = run.cls.id, evo = Math.max(0, Math.min(4, p.evo | 0));
    // marionnette animée (morceaux peints à la première image de chaque stade)
    const rigs = this.g_rigs || (this.g_rigs = []), rig = rigs[evo] || (rigs[evo] = heroRig(cls, evo));
    if (p.face.x > 0.15) hs.face = 1; else if (p.face.x < -0.15) hs.face = -1;
    let sx = 1, sy = 1, up = p.h * 0.9, rot = 0, ox = 0;
    if (p.h > 0) { sy *= p.vh > 0 ? 1.1 : 1.03; sx *= p.vh > 0 ? 0.92 : 0.98; }
    if (hs.land > 0) { const k = hs.land; sx *= 1 + k * 0.16; sy *= 1 - k * 0.14; hs.land = Math.max(0, hs.land - dt * 6); }
    // attaque : détectée sur les effets et les tirs du héros ; il se tourne vers sa cible
    for (const f of run.fx) if (!f.g_seen) { f.g_seen = 1; if (f.type === 'slash' || f.type === 'beam') { hs.atk = 1; hs.atkA = f.a; } }
    for (const s of run.shots) if (!s.g_seen) { s.g_seen = 1; if ((s.type === 'arrow' || s.type === 'crystal') && hs.atk < 0.9) { hs.atk = 1; hs.atkA = Math.atan2(s.vy, s.vx); } }
    if (hs.atk > 0) {
      if (Math.cos(hs.atkA) * hs.face < -0.3 && hs.atk > 0.9) hs.face = -hs.face;
      const k = Math.sin(hs.atk * Math.PI); ox = Math.cos(hs.atkA) * 2 * k;
      hs.atk = Math.max(0, hs.atk - dt * (cls === 'archer' ? 3 : cls === 'mage' ? 4 : 5));
    }
    if (run.dying) { rot = 1.4 * hs.face; up = 0; }
    // évolution : rayons de lumière derrière
    if (hs.evo > 0) {
      hs.evo -= dt;
      g.globalCompositeOperation = 'lighter';
      this.M(p.x, p.y - 22, 1, 1, t * 1.5);
      const a = Math.min(1, hs.evo), n = 10 + evo * 2, L = 130 + evo * 30, w = 12 + evo * 2;
      g.fillStyle = evo >= 4 && cls === 'archer' ? `rgba(150,240,255,${0.38 * a})` : `rgba(255,228,138,${(0.33 + evo * 0.03) * a})`;
      for (let i = 0; i < n; i++) { g.rotate(TAU / n); g.beginPath(); g.moveTo(0, 0); g.lineTo(L, -w); g.lineTo(L, w); g.fill(); }
      g.globalCompositeOperation = 'source-over';
    }
    if (hs.lvl > 0) { // niveau gagné : colonne de lumière
      hs.lvl -= dt * 1.6;
      g.globalCompositeOperation = 'lighter'; this.W();
      const a = Math.max(0, hs.lvl), gr = g.createLinearGradient(0, p.y - 140, 0, p.y);
      gr.addColorStop(0, 'rgba(255,228,138,0)'); gr.addColorStop(1, `rgba(255,228,138,${0.55 * a})`);
      g.fillStyle = gr; g.fillRect(p.x - 18 - (1 - a) * 10, p.y - 140, 36 + (1 - a) * 20, 140);
      g.globalCompositeOperation = 'source-over';
    }
    // invincibilité : flash blanc au coup, clignote ensuite, brille pendant les longues
    let hurt = 0, alpha = 1;
    if (hs.hurt > 0) { hurt = Math.min(1, hs.hurt / 0.1); hs.hurt -= dt; }
    else if (p.inv > 0 && p.inv <= 0.5 && run.hurtFlash > 0 && Math.floor(t * 20) % 2) alpha = 0.35;
    if (p.inv > 0.5 && !run.dying) this.glowAdd(p.x, p.y - 22 - up, 40, '#fff0b0', 0.35 + Math.sin(t * 12) * 0.15);
    if (p.shieldHit) { this.W(); g.strokeStyle = `rgba(168,216,255,${0.55 + Math.sin(t * 4) * 0.2})`; g.lineWidth = 2; g.beginPath(); g.arc(p.x, p.y - 22 - up, 27, 0, TAU); g.stroke(); }
    const sc = 1.02 + evo * 0.045, a = hs.face > 0 ? hs.atkA : Math.PI - hs.atkA;
    this.M(p.x + ox, p.y - up, sc * sx * hs.face, sc * sy, rot);
    rig.draw(g, {
      t, moving: p.moving && !run.dying, speed01: Math.max(0.4, p.speed01 ?? 1), air: p.h, vy: p.vh, atk: hs.atk, atkA: Math.atan2(Math.sin(a), Math.cos(a)),
      hurt, ouch: run.hurtFlash > 0 ? 1 : 0, dead: !!run.dying, alpha,
    });
    g.globalAlpha = 1;
  }

  // ---------- Tirs ----------
  drawShots(g) {
    const run = this.run, I = this.items, t = this.t;
    g.globalCompositeOperation = 'lighter';
    // orbes qui tournent autour du héros
    for (const w of run.p.weapons) if (w.id === 'orbs' && w.orbs) {
      for (const [x, y] of w.orbs) { this.W(); g.globalAlpha = 0.9; g.drawImage(glowTex('#c08aff'), x - 22, y - 34, 44, 44); g.globalAlpha = 1; g.drawImage(glowTex('#ffffff'), x - 7, y - 19, 14, 14); }
    }
    for (const s of run.shots) {
      if (!this.inView(s.x, s.y, 60)) continue;
      const a = Math.atan2(s.vy || 0, s.vx || 0);
      if (s.type === 'arrow' || s.type === 'dagger') {
        this.W(); g.strokeStyle = s.type === 'arrow' ? 'rgba(160,220,255,.55)' : 'rgba(255,255,255,.45)'; g.lineWidth = 4;
        g.beginPath(); g.moveTo(s.x, s.y - 18); g.lineTo(s.x - Math.cos(a) * 34, s.y - 18 - Math.sin(a) * 34); g.stroke();
      } else if (s.type === 'pet') this.glow(s.x, s.y - 18, 16, '#c08aff');
      else if (s.type === 'crystal') { this.glow(s.x, s.y - 22, 70, '#7ac8ff', 0.8); if (Math.random() < 0.6) this.sparks.push({ x: s.x + rand(-20, 20), y: s.y - 22 + rand(-14, 14), vx: -s.vx * 0.1, vy: -s.vy * 0.1, life: 0.4, max: 0.4, c: '#bfeaff', star: true, w: 2 }); }
      else if (s.type === 'boom') this.glow(s.x, s.y - 16, 22, '#ffd54a', 0.6);
    }
    for (const s of run.eshots) {
      if (!this.inView(s.x, s.y, 30)) continue;
      this.glow(s.x, s.y - 10, 20, '#ff2a5a', 0.85);
    }
    g.globalCompositeOperation = 'source-over';
    for (const s of run.shots) {
      if (!this.inView(s.x, s.y, 60)) continue;
      const a = Math.atan2(s.vy || 0, s.vx || 0);
      if (HERO_SHOTS[s.type]) this.spr(I[HERO_SHOTS[s.type]], s.x, s.y - (s.type === 'boom' ? 16 : 18), 1, 1, s.type === 'boom' ? s.spin : a);
      else if (s.type === 'crystal') this.spr(I.shard, s.x, s.y - 22, 1, 1, a);
      else if (s.type === 'snow') {
        this.shadow(s.x, s.y, 26, 10, 0.3);
        const k = s.R / 56;
        this.spr(I.snow, s.x, s.y - s.z * 0.9, k, k, s.t * 8);
      }
    }
    // tirs ennemis : boule rose vif à cœur blanc, lisible sur tous les sols
    this.W();
    for (const s of run.eshots) {
      if (!this.inView(s.x, s.y, 30)) continue;
      const r = s.r + 1 + Math.sin(t * 20 + s.x) * 0.8;
      this.shadow(s.x, s.y + 2, r * 1.6, r * 0.6, 0.25);
      g.fillStyle = '#2a0814'; g.beginPath(); g.arc(s.x, s.y - 10, r + 1.6, 0, TAU); g.fill();
      g.fillStyle = '#ff2a5a'; g.beginPath(); g.arc(s.x, s.y - 10, r, 0, TAU); g.fill();
      g.fillStyle = '#ffe0ea'; g.beginPath(); g.arc(s.x - r * 0.15, s.y - 10 - r * 0.15, r * 0.5, 0, TAU); g.fill();
    }
    // bombes : météores qui tombent, obus de mortier en cloche
    for (const b of run.bombs) {
      if (!this.inView(b.x, b.y, b.R + 100)) continue;
      if (b.kind === 'meteor' && b.t < 0.7) {
        const h = b.t / 0.7 * 420, k = 0.6 + (1 - b.t / 0.7) * 0.6;
        this.glowAdd(b.x + h * 0.25, b.y - h - 10, 26 * k, '#ff8a3a', 0.9);
        this.W(); g.fillStyle = '#5a3a2a'; g.strokeStyle = '#1a1030'; g.lineWidth = 2.5;
        g.beginPath(); g.arc(b.x + h * 0.25, b.y - h - 10, 13 * k, 0, TAU); g.fill(); g.stroke();
        g.fillStyle = '#8a6a4a'; g.beginPath(); g.arc(b.x + h * 0.25 - 4 * k, b.y - h - 14 * k, 4 * k, 0, TAU); g.fill();
      } else if (b.kind === 'mortar' && b.e && !b.e.dead) {
        const k = clamp(1 - b.t / 1.1, 0, 1), x = b.e.x + (b.x - b.e.x) * k, y = b.e.y + (b.y - b.e.y) * k - Math.sin(k * Math.PI) * 220 - 20;
        this.glowAdd(x, y, 16, '#ffb04a', 0.8);
        this.W(); g.fillStyle = '#2a2a38'; g.strokeStyle = '#1a1030'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 8, 0, TAU); g.fill(); g.stroke();
      } else if (b.kind === 'explode' && b.e) {
        const pulse = 0.5 + Math.sin(t * (30 - b.t * 20)) * 0.5;
        this.glowAdd(b.x, b.y - 12, 30 + pulse * 20, '#ff7a3a', 0.8);
      }
    }
  }

  // ---------- Effets ----------
  drawFx(g) {
    const run = this.run, t = this.t, dt = this.dt;
    g.globalCompositeOperation = 'lighter';
    for (const f of run.fx) {
      if (!this.inView(f.x, f.y, (f.r || f.len || 60) + 40)) continue;
      const k = 1 - f.life / f.max;
      if (f.type === 'slash') {
        const sweep = Math.min(1, k * 2.2), a0 = f.a - 1.3, a1 = a0 + 2.6 * sweep, R = f.r;
        this.W(); g.save(); g.translate(f.x, f.y - 10);
        g.globalAlpha = (1 - k) * 0.95;
        g.fillStyle = '#ffffff';
        g.beginPath(); g.arc(0, 0, R, a0, a1); g.arc(0, 0, R * 0.58, a1, a0, true); g.closePath(); g.fill();
        g.globalAlpha = (1 - k) * 0.6; g.fillStyle = '#9ad8ff';
        g.beginPath(); g.arc(0, 0, R * 1.08, a0, a1); g.arc(0, 0, R * 0.92, a1, a0, true); g.closePath(); g.fill();
        g.restore(); g.globalAlpha = 1;
      } else if (f.type === 'beam') {
        const w = f.w * (1 - k * 0.7);
        this.M(f.x, f.y - 20, 1, 1, f.a);
        g.globalAlpha = 1 - k * 0.6;
        g.drawImage(glowTex('#ffe48a'), -w, -w * 1.4, f.len + w * 2, w * 2.8);
        g.fillStyle = '#fff6c0'; g.fillRect(0, -w * 0.32, f.len, w * 0.64);
        g.fillStyle = '#ffffff'; g.fillRect(0, -w * 0.12, f.len, w * 0.24);
        g.globalAlpha = 1;
        if (!f.g_sp) { f.g_sp = 1; for (let i = 0; i < 6; i++) { const d = Math.random() * f.len; this.sparkle(f.x + Math.cos(f.a) * d, f.y - 20 + Math.sin(f.a) * d, '#fff0a0'); } }
      } else if (f.type === 'bolt') {
        if (!f.g_pts) {
          f.g_pts = []; let x = f.x + rand(-40, 40), y = f.y - 420;
          for (let i = 0; i <= 8; i++) { f.g_pts.push([x, y]); x += (f.x - x) / (8 - i + 1) + rand(-18, 18); y += (f.y - y) / (8 - i + 1); }
          f.g_pts.push([f.x, f.y]);
          this.decal(f.x, f.y, 18, '#1a1020', 0.3);
          this.puff(f.x, f.y, 4, 14, 0.5);
        }
        this.W();
        const a = 1 - k;
        for (const [w, col] of [[12, `rgba(255,240,120,${0.35 * a})`], [5, `rgba(255,250,200,${0.9 * a})`], [2, `rgba(255,255,255,${a})`]]) {
          g.strokeStyle = col; g.lineWidth = w; g.beginPath(); f.g_pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
        }
        g.globalAlpha = a; g.drawImage(glowTex('#fff7a0'), f.x - 50, f.y - 32, 100, 64); g.globalAlpha = 1;
      } else if (f.type === 'ring' && !f.warn) {
        const R = f.r * (0.25 + 0.75 * (1 - (1 - k) ** 3));
        this.W(); g.strokeStyle = hexA(f.color, (1 - k) * 0.9); g.lineWidth = 8 * (1 - k) + 2;
        g.beginPath(); g.arc(f.x, f.y, R, 0, TAU); g.stroke();
        g.strokeStyle = `rgba(255,255,255,${(1 - k) * 0.6})`; g.lineWidth = 2;
        g.beginPath(); g.arc(f.x, f.y, R * 0.96, 0, TAU); g.stroke();
      }
    }
    // explosions de lumière (évolution, coffres, ultimes…)
    for (const b of this.bursts) {
      b.t += dt;
      const k = b.t / b.max;
      if (k >= 1) continue;
      const R = b.r * (0.3 + 0.7 * (1 - (1 - k) ** 2));
      this.W(); g.globalAlpha = (1 - k) * 0.85;
      g.drawImage(glowTex(b.c), b.x - R, b.y - R * 0.8, R * 2, R * 1.6);
      g.strokeStyle = b.c; g.lineWidth = 6 * (1 - k);
      g.beginPath(); g.arc(b.x, b.y + 14, R * 0.7, 0, TAU); g.stroke();
      g.globalAlpha = 1;
    }
    this.bursts = this.bursts.filter(b => b.t < b.max);
    // étincelles
    this.W();
    for (const s of this.sparks) {
      s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt;
      if (s.g) s.vy += s.g * dt; else { s.vx *= 0.9; s.vy *= 0.9; }
      const a = clamp(s.life / s.max, 0, 1);
      if (s.conf != null) continue;
      g.globalAlpha = a; g.strokeStyle = s.c; g.lineWidth = s.w;
      if (s.star) { const r = (5 * a + 1.2) * (s.big || 1); g.fillStyle = s.c; g.beginPath(); g.moveTo(s.x, s.y - r); g.quadraticCurveTo(s.x, s.y, s.x + r, s.y); g.quadraticCurveTo(s.x, s.y, s.x, s.y + r); g.quadraticCurveTo(s.x, s.y, s.x - r, s.y); g.quadraticCurveTo(s.x, s.y, s.x, s.y - r); g.fill(); }
      else { g.beginPath(); g.moveTo(s.x, s.y); g.lineTo(s.x - s.vx * 0.04, s.y - s.vy * 0.04); g.stroke(); }
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    // confettis (opaques)
    for (const s of this.sparks) if (s.conf != null) {
      s.conf += dt * 10;
      g.globalAlpha = clamp(s.life / 0.4, 0, 1); g.fillStyle = s.c;
      this.M(s.x, s.y, Math.cos(s.conf), 1, s.conf * 0.3); g.fillRect(-3, -2, 6, 4);
    }
    g.globalAlpha = 1;
    this.sparks = this.sparks.filter(s => s.life > 0);
    // morts : silhouette blanche qui gonfle et disparaît
    for (const d of this.pops) {
      d.t += dt;
      const k = d.t / d.max;
      if (k >= 1) continue;
      g.globalAlpha = 0.75 * (1 - k);
      this.spr(d.s, d.x, d.y, d.sc * d.flip * (1 + k * 0.3), d.sc * (1 - k * 0.25), 0, d.s.white);
    }
    g.globalAlpha = 1;
    this.pops = this.pops.filter(d => d.t < d.max);
    // fumée
    this.W();
    for (const q of this.puffs) {
      q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.92; q.vy *= 0.92;
      const k = 1 - q.life / q.max, r = q.s * (0.6 + k * 0.8);
      g.globalAlpha = q.a * (1 - k);
      g.drawImage(q.col ? glowTex(q.col) : this.puffTex, q.x - r, q.y - r, r * 2, r * 2);
    }
    g.globalAlpha = 1;
    this.puffs = this.puffs.filter(q => q.life > 0);
    // particules du jeu (éclats colorés)
    for (const q of run.parts) {
      if (!this.inView(q.x, q.y, 20)) continue;
      const s = 2.6 * q.s, a = clamp(q.life * 2, 0, 1);
      g.globalAlpha = a; g.fillStyle = q.c;
      g.fillRect(q.x - s / 2, q.y - q.z * 0.85 - s / 2, s, s);
    }
    g.globalAlpha = 1;
    this.fxWorld(g);
  }

  // ---------- Ambiance : obscurité, vignette ----------
  drawLight(g) {
    const run = this.run, p = run.p, T = this.T, dpr = this.dpr, vw = this.vw, vh = this.vh;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const hx = (p.x - this.cam.x) * this.zoom + vw / 2, hy = (p.y - 20 - this.cam.y) * this.zoom + vh / 2;
    if (T.dark) {
      const R = Math.max(vw, vh) * 0.75;
      const gr = g.createRadialGradient(hx, hy, R * 0.18, hx, hy, R);
      gr.addColorStop(0, 'rgba(8,2,20,0)'); gr.addColorStop(1, `rgba(8,2,20,${T.dark})`);
      g.fillStyle = gr; g.fillRect(0, 0, vw, vh);
      // lumières du décor
      g.globalCompositeOperation = 'lighter';
      for (const pr of this.props) if (pr.light) {
        const L = pr.light, x = pr.x + (L.x || 0) * pr.s * (pr.flip ? -1 : 1), y = pr.y + L.y * pr.s, fl = 1 + Math.sin(this.t * 3 + pr.ph) * 0.08;
        this.glow(x, y, L.r * pr.s * fl, L.c, L.a ?? 0.45);
      }
      g.globalCompositeOperation = 'source-over';
    } else {
      g.globalCompositeOperation = 'lighter';
      for (const pr of this.props) if (pr.light) { const L = pr.light; this.glow(pr.x + (L.x || 0) * pr.s * (pr.flip ? -1 : 1), pr.y + L.y * pr.s, L.r * pr.s * 0.7, L.c, (L.a ?? 0.45) * 0.6); }
      g.globalCompositeOperation = 'source-over';
    }
  }

  drawAmbient(g, dt) {
    const T = this.T, A = this.amb, vw = this.vw, vh = this.vh, kind = T.ambient, z = this.zoom;
    const want = kind === 'mist' ? 7 : kind === 'snow' ? 46 : 22;
    while (A.length < want) A.push({ x: Math.random() * vw, y: Math.random() * vh, ph: Math.random() * TAU, s: rand(0.6, 1.4), v: rand(0.6, 1.2) });
    const dx = this.camPrev ? (this.cam.x - this.camPrev.x) * z : 0, dy = this.camPrev ? (this.cam.y - this.camPrev.y) * z : 0;
    this.camPrev = { x: this.cam.x, y: this.cam.y };
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const t = this.t;
    if (kind === 'firefly' || kind === 'void' || kind === 'bubble') g.globalCompositeOperation = 'lighter';
    for (const q of A) {
      q.x -= dx; q.y -= dy;
      if (kind === 'snow') { q.y += 40 * q.v * dt; q.x += Math.sin(t + q.ph) * 12 * dt; }
      else if (kind === 'leaf') { q.y += 22 * q.v * dt; q.x += (14 + Math.sin(t * 1.5 + q.ph) * 20) * dt; }
      else if (kind === 'firefly' || kind === 'bubble') { q.x += Math.sin(t * 0.7 + q.ph) * 14 * dt; q.y += Math.cos(t * 0.9 + q.ph) * 10 * dt - (kind === 'bubble' ? 10 * dt : 0); }
      else if (kind === 'void') q.y -= 18 * q.v * dt;
      else if (kind === 'mist') q.x += 8 * q.v * dt;
      const m = kind === 'mist' ? 200 : 20;
      if (q.x < -m) q.x += vw + m * 2; if (q.x > vw + m) q.x -= vw + m * 2;
      if (q.y < -m) q.y += vh + m * 2; if (q.y > vh + m) q.y -= vh + m * 2;
      if (kind === 'snow') { g.globalAlpha = 0.85; g.fillStyle = '#ffffff'; g.beginPath(); g.arc(q.x, q.y, 1.6 * q.s, 0, TAU); g.fill(); }
      else if (kind === 'leaf') {
        g.globalAlpha = 0.8; g.fillStyle = q.s > 1 ? '#8acb62' : '#5a9a3a';
        g.save(); g.translate(q.x, q.y); g.rotate(t * 2 * q.v + q.ph); g.scale(Math.cos(t * 3 + q.ph), 1);
        g.beginPath(); g.ellipse(0, 0, 4 * q.s, 2 * q.s, 0, 0, TAU); g.fill(); g.restore();
      } else if (kind === 'firefly') { g.globalAlpha = 0.5 + Math.sin(t * 3 + q.ph) * 0.4; g.drawImage(glowTex('#d8ff6a'), q.x - 7, q.y - 7, 14, 14); }
      else if (kind === 'bubble') { g.globalAlpha = 0.25 + Math.sin(t * 2 + q.ph) * 0.2; g.drawImage(glowTex('#ffffff'), q.x - 4, q.y - 4, 8, 8); }
      else if (kind === 'void') { g.globalAlpha = 0.45 + Math.sin(t * 4 + q.ph) * 0.3; g.drawImage(glowTex('#e070ff'), q.x - 6 * q.s, q.y - 6 * q.s, 12 * q.s, 12 * q.s); }
      else if (kind === 'mist') { g.globalAlpha = 0.12; g.drawImage(glowTex('#9affe0'), q.x - 160 * q.s, q.y - 70 * q.s, 320 * q.s, 140 * q.s); }
    }
    g.globalAlpha = 1;
    // chrono écoulé : des braises montent de partout
    const E = this.embers;
    if (this.run.overtime > 0) {
      const lv = this.run.otLevel || 1;
      while (E.length < Math.min(40, 12 + lv * 4)) E.push({ x: Math.random() * vw, y: vh + Math.random() * 40, v: rand(40, 110), ph: Math.random() * TAU, s: rand(0.6, 1.4) });
      g.globalCompositeOperation = 'lighter';
      for (const q of E) {
        q.x -= dx; q.y -= dy + q.v * dt; q.x += Math.sin(t * 2 + q.ph) * 20 * dt;
        if (q.y < -20) { q.y = vh + 10; q.x = Math.random() * vw; }
        if (q.x < -20) q.x += vw + 40; if (q.x > vw + 20) q.x -= vw + 40;
        g.globalAlpha = 0.5 + Math.sin(t * 6 + q.ph) * 0.3;
        g.drawImage(glowTex(q.s > 1 ? '#ff7a2a' : '#ff3a1a'), q.x - 5 * q.s, q.y - 5 * q.s, 10 * q.s, 10 * q.s);
      }
    } else E.length = 0;
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  }

  // ---------- Interface dessinée (chiffres, barres, flèches, mini-carte, joystick) ----------
  ws(x, y) { return [(x - this.cam.x) * this.zoom + this.vw / 2, (y - this.cam.y) * this.zoom + this.vh / 2]; }

  drawUi(g) {
    const run = this.run, p = run.p, vw = this.vw, vh = this.vh, t = this.t, dt = this.dt, z = this.zoom;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    // vignette douce permanente
    if (!this.vign || this.vign.w !== vw || this.vign.h !== vh) {
      const c = document.createElement('canvas'); c.width = Math.ceil(vw / 2); c.height = Math.ceil(vh / 2);
      const q = c.getContext('2d'), gr = q.createRadialGradient(c.width / 2, c.height / 2, Math.min(c.width, c.height) * 0.35, c.width / 2, c.height / 2, Math.hypot(c.width, c.height) * 0.6);
      gr.addColorStop(0, 'rgba(10,4,24,0)'); gr.addColorStop(1, 'rgba(10,4,24,.5)');
      q.fillStyle = gr; q.fillRect(0, 0, c.width, c.height);
      this.vign = { c, w: vw, h: vh };
    }
    g.drawImage(this.vign.c, 0, 0, vw, vh);
    // chrono écoulé : ambiance rouge qui pulse, de plus en plus forte
    if (run.overtime > 0) {
      const lv = run.otLevel || 1, pulse = 0.5 + Math.sin(t * (3 + Math.min(4, lv * 0.4))) * 0.5;
      this.otPulse = Math.max(0, this.otPulse - dt * 1.4);
      g.fillStyle = `rgba(255,30,20,${0.05 + Math.min(0.07, lv * 0.01) + pulse * 0.025})`; g.fillRect(0, 0, vw, vh);
      this.edge(g, '255,20,30', 0.2 + Math.min(0.2, lv * 0.025) + pulse * 0.1 + this.otPulse * 0.3, 0.28);
    }
    // barre de vie du héros
    const [hx, hy] = this.ws(p.x, p.y);
    const ratio = clamp(p.hp / p.maxHp, 0, 1);
    if (!run.dying) {
      const bw = 40;
      rbar(g, hx - bw / 2, hy + 8, bw, 6, ratio, ratio < 0.3 ? '#ff5a4a' : '#5ae87a');
    }
    // barres des élites
    for (const e of run.enemies) if (e.elite && !e.dead && this.inView(e.x, e.y)) {
      const [x, y] = this.ws(e.x, e.y - e.r * 2.4 - e.fly);
      rbar(g, x - 24, y - 4, 48, 6, clamp(e.hp / e.maxHp, 0, 1), '#c06aff');
    }
    // cible principale des armes (réticule rouge qui tourne)
    const tg = run.target;
    if (tg && !tg.dead && !run.dying && this.inView(tg.x, tg.y)) {
      const [x, y] = this.ws(tg.x, tg.y - tg.r * 1.1 - (tg.fly || 0) * 0.9), R = clamp((tg.r * 1.3 + 8) * z, 16, 90);
      g.save(); g.translate(x, y); g.rotate(t * 1.6); g.lineCap = 'round';
      for (let i = 0; i < 4; i++) {
        g.rotate(TAU / 4);
        g.strokeStyle = INK2; g.lineWidth = 6; g.beginPath(); g.arc(0, 0, R, -0.35, 0.35); g.stroke();
        g.strokeStyle = '#ff4a3a'; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, R, -0.35, 0.35); g.stroke();
      }
      g.restore();
    }
    // prix des coffres
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    for (const c of run.chests) if (!c.open && Math.hypot(c.x - p.x, c.y - p.y) < 300) {
      const [x, y] = this.ws(c.x, c.y - 52);
      const ok = run.gold >= run.chestCost;
      g.font = tf(13);
      const txt = `${run.chestCost} or`, w = g.measureText(txt).width + 18;
      g.fillStyle = INK2; rr(g, x - w / 2 - 1.5, y - 11.5, w + 3, 24, 12); g.fill();
      g.fillStyle = ok ? '#3a2a6a' : '#4a1a2a'; rr(g, x - w / 2, y - 10, w, 20, 10); g.fill();
      this.outText(g, txt, x, y + 1, ok ? '#ffd54a' : '#ff9a8a', 3);
    }
    // chiffres de dégâts (les coups rapprochés sur un même monstre s'additionnent)
    for (const n of this.nums) {
      n.t += dt; n.life -= dt; n.pop = Math.max(0, n.pop - dt * 7);
      if (!n.e.dead) { n.x += (n.e.x - n.x) * 0.3; n.y += (n.e.y - n.y) * 0.3; }
      const [x, y] = this.ws(n.x + n.dx * n.t, n.y);
      const rise = n.h * z + 10 + n.t * 46;
      const size = (n.crit ? 20 : 14) * (1 + n.pop * 0.45) * clamp(0.75 + Math.log10(n.v + 1) * 0.12, 0.8, 1.35);
      g.globalAlpha = clamp(n.life * 4, 0, 1);
      g.font = tf(size.toFixed(1));
      const txt = fmt(n.v) + (n.crit ? '!' : '');
      g.save(); g.translate(x, y - rise); if (n.crit) g.rotate(-0.08);
      this.outText(g, txt, 0, 0, n.crit ? '#ffd54a' : n.color || '#ffffff', n.crit ? 4.5 : 3.6);
      g.restore();
    }
    g.globalAlpha = 1;
    this.nums = this.nums.filter(n => n.life > 0);
    for (const [e, n] of this.numBy) if (n.life <= 0) this.numBy.delete(e);
    // soins, dégâts reçus, « Esquive ! »… (les dégâts infligés sont déjà affichés au-dessus)
    for (const tx of run.texts) {
      if (/^[\d\s.,  kM]+$/.test(tx.txt)) continue;
      const [x, y] = this.ws(tx.x, tx.y - tx.z);
      g.globalAlpha = Math.min(1, tx.life * 3);
      g.font = tf(Math.round(16 * tx.size));
      this.outText(g, tx.txt, x, y, tx.color, 3.6);
    }
    g.globalAlpha = 1;
    this.markers(g);
    this.guide(g, hx, hy);
    this.arrows(g);
    this.minimap(g);
    this.flyLootUi(g);
    // alertes plein écran
    if (ratio < 0.3 && !run.dying) this.edge(g, '255,30,50', (0.25 + Math.sin(t * 6) * 0.12) * (1 - ratio / 0.3));
    if (this.flashHurt > 0) { this.flashHurt -= dt; this.edge(g, '255,40,60', Math.min(0.3, this.flashHurt * 0.9), 0.45); }
    if (this.edgeA > 0) { this.edge(g, this.edgeC, this.edgeA, 0.32); this.edgeA -= dt * 1.1; }
    if (run.ultFlash > 0) { g.fillStyle = `rgba(255,244,210,${run.ultFlash * 0.7})`; g.fillRect(0, 0, vw, vh); }
    if (run.evoFlash > 0.6) { g.fillStyle = `rgba(255,250,220,${(run.evoFlash - 0.6) * 1.2})`; g.fillRect(0, 0, vw, vh); }
    if (run.entering > 0) { g.fillStyle = `rgba(235,225,255,${clamp(1 - run.entering / 0.6, 0, 1) * 0.85})`; g.fillRect(0, 0, vw, vh); }
    if (this.flashA > 0) { g.fillStyle = `rgba(${this.flashC},${Math.min(0.85, this.flashA)})`; g.fillRect(0, 0, vw, vh); this.flashA -= dt * 1.5; }
    if (run.joy) {
      const j = run.joy, r = this.cv.getBoundingClientRect();
      const ox = j.ox - r.left, oy = j.oy - r.top, js = clamp(+save.settings?.joySize || 1, 0.7, 1.4), R = 50 * js; // réglage : taille du joystick
      let kx = j.x - j.ox, ky = j.y - j.oy; const d = Math.hypot(kx, ky); if (d > R) { kx *= R / d; ky *= R / d; }
      g.fillStyle = 'rgba(255,255,255,.10)'; g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2;
      g.beginPath(); g.arc(ox, oy, R + 4, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.arc(ox + kx, oy + ky, 22 * js, 0, TAU); g.fill();
    }
  }

  // texte cerné de sombre avec une petite ombre dessous (façon Clash Royale)
  outText(g, txt, x, y, col, w = 3.6) {
    g.lineJoin = 'round'; g.lineWidth = w; g.strokeStyle = INK2;
    g.strokeText(txt, x, y + w * 0.45);
    g.strokeText(txt, x, y);
    g.fillStyle = col; g.fillText(txt, x, y);
  }

  edge(g, rgb, a, inner = 0.3) {
    if (a <= 0) return;
    const vw = this.vw, vh = this.vh, gr = g.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * inner, vw / 2, vh / 2, Math.hypot(vw, vh) * 0.55);
    gr.addColorStop(0, `rgba(${rgb},0)`); gr.addColorStop(1, `rgba(${rgb},${Math.min(0.85, a)})`);
    g.fillStyle = gr; g.fillRect(0, 0, vw, vh);
  }

  // repères au-dessus du portail et de l'autel quand ils sont à l'écran
  markers(g) {
    const run = this.run, t = this.t, p = run.p, Po = run.portal, Al = run.altar;
    const on = (x, y) => x > -40 && x < this.vw + 40 && y > -40 && y < this.vh + 40;
    if (Po && Po.t > 0.6) {
      const [x, y] = this.ws(Po.x, Po.y - 150);
      if (on(x, y) && y > 236) this.pin(g, x, y + Math.sin(t * 5) * 6, '#8a3aff', '#7ae8ff', 'PORTAIL', 1.1);
    } else if (Al && !Al.used && !run.arena && Math.hypot(Al.x - p.x, Al.y - p.y) > 220) {
      const [x, y] = this.ws(Al.x, Al.y - 108);
      if (on(x, y) && y > 236) this.pin(g, x, y + Math.sin(t * 4) * 5, '#d81e2e', '#ff8a5a', 'BOSS', 0.9);
    }
  }
  pin(g, x, y, c1, c2, label, s = 1) {
    g.save(); g.translate(x, y); g.scale(s, s);
    // flèche vers le bas
    const ar = new Path2D(); ar.moveTo(0, 18); ar.lineTo(-14, 2); ar.lineTo(-6, 2); ar.lineTo(-6, -8); ar.lineTo(6, -8); ar.lineTo(6, 2); ar.lineTo(14, 2); ar.closePath();
    g.lineJoin = 'round'; g.strokeStyle = INK2; g.lineWidth = 6; g.stroke(ar);
    const gr = g.createLinearGradient(0, -8, 0, 18); gr.addColorStop(0, c2); gr.addColorStop(1, c1); g.fillStyle = gr; g.fill(ar);
    g.font = tf(15); g.textAlign = 'center'; g.textBaseline = 'middle';
    const w = g.measureText(label).width + 18;
    g.fillStyle = INK2; rr(g, -w / 2 - 2, -36, w + 4, 26, 13); g.fill();
    const gb = g.createLinearGradient(0, -34, 0, -12); gb.addColorStop(0, c2); gb.addColorStop(1, c1);
    g.fillStyle = gb; rr(g, -w / 2, -34, w, 22, 11); g.fill();
    g.fillStyle = 'rgba(255,255,255,.3)'; rr(g, -w / 2 + 5, -32, w - 10, 6, 3); g.fill();
    this.outText(g, label, 0, -22.5, '#ffffff', 3.4);
    g.restore();
  }

  // chevrons qui tournent autour du héros et montrent le portail (ou l'autel du boss)
  guide(g, hx, hy) {
    const run = this.run, p = run.p, t = this.t, z = this.zoom;
    let tg = null, c1, c2, al = 1;
    if (run.portal && run.portal.t > 0.5) { tg = run.portal; c1 = '#b06aff'; c2 = '#bff8ff'; }
    else if (run.altar && !run.altar.used && !run.arena) { tg = run.altar; c1 = '#ff4a3a'; c2 = '#ffd0a0'; al = 0.8; }
    if (!tg || run.dying) return;
    const dx = tg.x - p.x, dy = tg.y - p.y, d = Math.hypot(dx, dy);
    if (d < 120) return;
    const a = Math.atan2(dy, dx), R = 44 * z + 12 + Math.sin(t * 6) * 4, cx = hx, cy = hy - 20 * z;
    g.save(); g.translate(cx + Math.cos(a) * R, cy + Math.sin(a) * R); g.rotate(a); g.scale(1.25, 1.25);
    g.lineJoin = 'round'; g.lineCap = 'round';
    for (let i = 0; i < 2; i++) {
      const x = i * 10 - 4;
      g.globalAlpha = al * (0.55 + 0.45 * Math.max(0, Math.sin(t * 8 - i * 1.4)));
      g.strokeStyle = INK2; g.lineWidth = 8; g.beginPath(); g.moveTo(x - 6, -9); g.lineTo(x + 4, 0); g.lineTo(x - 6, 9); g.stroke();
      g.strokeStyle = i ? c2 : c1; g.lineWidth = 4.4; g.beginPath(); g.moveTo(x - 6, -9); g.lineTo(x + 4, 0); g.lineTo(x - 6, 9); g.stroke();
    }
    g.restore(); g.globalAlpha = 1;
  }

  // flèches au bord de l'écran vers ce qui est hors champ (grande flèche « PORTAIL » / « BOSS » avec la distance)
  arrows(g) {
    const run = this.run, p = run.p, vw = this.vw, vh = this.vh, t = this.t;
    const m = 28, top = 228, bot = vh - 132, cx = vw / 2, cy = (top + bot) / 2;
    const toEdge = (x, y, mm = m) => {
      const dx = x - cx, dy = y - cy, s = Math.min(Math.abs((vw / 2 - mm) / (dx || 1e-6)), Math.abs(((bot - top) / 2) / (dy || 1e-6)));
      return [cx + dx * s, cy + dy * s, Math.atan2(dy, dx)];
    };
    const pts = [];
    if (run.boss && !run.boss.dead) pts.push([run.boss, '#ff2a4a', 15]);
    for (const c of run.dropChests) if (!c.open) pts.push([c, '#c06aff', 11]);
    for (const e of run.enemies) if (e.elite && !e.dead) pts.push([e, '#c06aff', 10]);
    for (const s of run.shrines) if (!s.used && Math.hypot(s.x - p.x, s.y - p.y) < 1000) pts.push([s, '#4fd0ff', 9]);
    for (const T of run.totems || []) if (!T.used && Math.hypot(T.x - p.x, T.y - p.y) < 900) pts.push([T, TOTEMS[T.kind]?.color || '#ffffff', 9]);
    for (const c of run.chests) if (!c.open && Math.hypot(c.x - p.x, c.y - p.y) < 800) pts.push([c, '#ffcf40', 8]);
    for (const it of run.pickups) if (it.type === 'loot' && !it.hidden && Math.hypot(it.x - p.x, it.y - p.y) < 900) pts.push([it, LOOT_GLOW[it.tier] || '#ffffff', 9]);
    g.lineJoin = 'round';
    for (const [o, col, size] of pts) {
      const [x, y] = this.ws(o.x, o.y - 20);
      if (x > 0 && x < vw && y > top - 40 && y < vh) continue;
      const [ax0, ay0, a] = toEdge(x, y), b = Math.sin(t * 6) * 2;
      g.save(); g.translate(ax0 - Math.cos(a) * b, ay0 - Math.sin(a) * b); g.rotate(a);
      g.fillStyle = INK2; g.beginPath(); g.moveTo(size + 4, 0); g.lineTo(-size * 0.7 - 3, -size * 0.8 - 3); g.lineTo(-size * 0.7 - 3, size * 0.8 + 3); g.closePath(); g.fill();
      g.fillStyle = col; g.beginPath(); g.moveTo(size, 0); g.lineTo(-size * 0.7, -size * 0.8); g.lineTo(-size * 0.7, size * 0.8); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.moveTo(size * 0.6, -size * 0.1); g.lineTo(-size * 0.5, -size * 0.65); g.lineTo(-size * 0.5, -size * 0.2); g.closePath(); g.fill();
      g.restore();
    }
    // grande flèche vers le portail (ou l'autel du boss avant l'invocation)
    let tg = null, c1, c2, label;
    if (run.portal && run.portal.t > 0.5) { tg = run.portal; c1 = '#8a3aff'; c2 = '#7ae8ff'; label = 'PORTAIL'; }
    else if (run.altar && !run.altar.used && !run.arena) { tg = run.altar; c1 = '#d81e2e'; c2 = '#ff9a5a'; label = 'BOSS'; }
    if (!tg) return;
    const [x, y] = this.ws(tg.x, tg.y - 40);
    if (x > 20 && x < vw - 20 && y > top - 60 && y < vh - 60) return;
    const big = label === 'PORTAIL', s = (big ? 1.3 : 0.9) * (1 + Math.sin(t * 7) * 0.08), bb = Math.sin(t * 7) * 4;
    let ax, ay, a;
    if (big) { // le portail : grosse flèche près du héros (jamais cachée par les boutons du bas)
      const [hx, hy] = this.ws(p.x, p.y - 22);
      a = Math.atan2(y - hy, x - hx);
      ax = clamp(hx + Math.cos(a) * 96, 40, vw - 40); ay = clamp(hy + Math.sin(a) * 96, top, vh - 200);
    } else [ax, ay, a] = toEdge(x, y, 34);
    g.save(); g.translate(ax + Math.cos(a) * bb, ay + Math.sin(a) * bb); g.rotate(a); g.scale(s, s);
    g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.55 + Math.sin(t * 7) * 0.2; g.drawImage(glowTex(c1), -40, -40, 80, 80);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    const ar = new Path2D(); ar.moveTo(26, 0); ar.lineTo(2, -22); ar.lineTo(2, -10); ar.lineTo(-18, -10); ar.lineTo(-18, 10); ar.lineTo(2, 10); ar.lineTo(2, 22); ar.closePath();
    g.strokeStyle = INK2; g.lineWidth = 7; g.stroke(ar);
    const gr = g.createLinearGradient(0, -22, 0, 22); gr.addColorStop(0, c2); gr.addColorStop(1, c1); g.fillStyle = gr; g.fill(ar);
    g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(-14, -6); g.lineTo(5, -6); g.lineTo(5, -14); g.stroke();
    g.restore();
    // étiquette avec la distance, côté intérieur
    const d = Math.round(Math.hypot(tg.x - p.x, tg.y - p.y) / 10) + ' m';
    g.font = tf(big ? 15 : 13); const w1 = g.measureText(label).width;
    g.font = tf(12); const w2 = g.measureText(d).width;
    const W = Math.max(w1, w2) + 20, H = 38;
    const lo = big ? -56 : 58, lx = clamp(ax - Math.cos(a) * lo, W / 2 + 6, vw - W / 2 - 6), ly = clamp(ay - Math.sin(a) * (big ? -48 : 46), top - 30, big ? vh - 190 : bot + 10);
    g.fillStyle = INK2; rr(g, lx - W / 2 - 2, ly - H / 2 - 2, W + 4, H + 4, 11); g.fill();
    const gb = g.createLinearGradient(0, ly - H / 2, 0, ly + H / 2); gb.addColorStop(0, shadeHex(c1, 0.15)); gb.addColorStop(1, shadeHex(c1, -0.35));
    g.fillStyle = gb; rr(g, lx - W / 2, ly - H / 2, W, H, 9); g.fill();
    g.fillStyle = 'rgba(255,255,255,.22)'; rr(g, lx - W / 2 + 4, ly - H / 2 + 3, W - 8, 8, 4); g.fill();
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = tf(big ? 15 : 13); this.outText(g, label, lx, ly - 7, '#ffffff', 3.4);
    g.font = tf(12); this.outText(g, d, lx, ly + 10, '#fff2a0', 3);
  }

  minimap(g) {
    const run = this.run, p = run.p, R = 44, cx = this.vw - R - 12, cy = 158, range = 900, t = this.t;
    const mp = (x, y) => [cx + (x - p.x) / range * R, cy + (y - p.y) / range * R];
    g.save();
    g.beginPath(); g.arc(cx, cy, R, 0, TAU);
    g.fillStyle = 'rgba(10,6,20,.6)'; g.fill();
    g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 2; g.stroke();
    g.clip();
    const dot = (x, y, col, r) => { const [mx, my] = mp(x, y); g.fillStyle = col; g.beginPath(); g.arc(mx, my, r, 0, TAU); g.fill(); };
    // bords de la carte
    g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 1;
    g.strokeRect(cx + (-HALF - p.x) / range * R, cy + (-HALF - p.y) / range * R, HALF * 2 / range * R, HALF * 2 / range * R);
    if (run.arena) { const [mx, my] = mp(run.arena.x, run.arena.y); g.strokeStyle = 'rgba(255,70,50,.9)'; g.lineWidth = 2; g.beginPath(); g.arc(mx, my, run.arena.R / range * R, 0, TAU); g.stroke(); }
    for (const e of run.enemies) if (!e.boss && Math.abs(e.x - p.x) < range && Math.abs(e.y - p.y) < range) dot(e.x, e.y, e.elite ? '#d08aff' : e.mad ? 'rgba(255,60,40,.85)' : 'rgba(255,90,90,.6)', e.elite ? 2.4 : 1.3);
    for (const ch of run.chests) if (!ch.open) dot(ch.x, ch.y, '#ffc83a', 3);
    for (const ch of run.dropChests) if (!ch.open) dot(ch.x, ch.y, '#d08aff', 3.2);
    for (const sh of run.shrines) if (!sh.used) dot(sh.x, sh.y, '#4fd0ff', 3.2);
    for (const it of run.pickups) if (it.type === 'loot' && Math.abs(it.x - p.x) < range && Math.abs(it.y - p.y) < range) { const [mx, my] = mp(it.x, it.y); g.fillStyle = INK2; g.fillRect(mx - 3, my - 3, 6, 6); g.fillStyle = LOOT_GLOW[it.tier] || '#fff'; g.fillRect(mx - 2, my - 2, 4, 4); }
    for (const T of run.totems || []) {
      const [mx, my] = mp(T.x, T.y);
      g.fillStyle = INK2; g.beginPath(); g.moveTo(mx, my - 5); g.lineTo(mx + 4.5, my); g.lineTo(mx, my + 5); g.lineTo(mx - 4.5, my); g.closePath(); g.fill();
      g.fillStyle = T.used ? '#6a6a7a' : TOTEMS[T.kind]?.color || '#fff'; g.beginPath(); g.moveTo(mx, my - 3.5); g.lineTo(mx + 3, my); g.lineTo(mx, my + 3.5); g.lineTo(mx - 3, my); g.closePath(); g.fill();
    }
    if (run.boss && !run.boss.dead) dot(run.boss.x, run.boss.y, '#ff2a4a', 4.5);
    g.restore();
    // autel et portail : toujours visibles, collés au bord quand ils sont loin
    const pinned = (x, y) => { let [mx, my] = mp(x, y); const dx = mx - cx, dy = my - cy, d = Math.hypot(dx, dy); if (d > R - 4) { mx = cx + dx / d * (R - 4); my = cy + dy / d * (R - 4); } return [mx, my]; };
    if (run.altar && !run.altar.used && !run.arena) {
      const [mx, my] = pinned(run.altar.x, run.altar.y);
      g.fillStyle = INK2; g.beginPath(); g.arc(mx, my, 7, 0, TAU); g.fill();
      g.fillStyle = '#e8283a'; g.beginPath(); g.arc(mx, my, 5.6, 0, TAU); g.fill();
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(mx, my - 0.8, 3, 0, TAU); g.fill(); g.fillRect(mx - 1.8, my + 1, 3.6, 2.2);
      g.fillStyle = '#e8283a'; g.fillRect(mx - 1.6, my - 1.4, 1.2, 1.4); g.fillRect(mx + 0.4, my - 1.4, 1.2, 1.4);
    }
    if (run.portal) {
      const [mx, my] = pinned(run.portal.x, run.portal.y), k = (t * 1.2) % 1;
      g.strokeStyle = `rgba(190,140,255,${1 - k})`; g.lineWidth = 2; g.beginPath(); g.arc(mx, my, 6 + k * 10, 0, TAU); g.stroke();
      g.fillStyle = INK2; g.beginPath(); g.arc(mx, my, 7.5, 0, TAU); g.fill();
      const gr = g.createRadialGradient(mx, my, 0, mx, my, 6); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.45, '#7ae8ff'); gr.addColorStop(1, '#8a3aff');
      g.fillStyle = gr; g.beginPath(); g.arc(mx, my, 6, 0, TAU); g.fill();
    }
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(cx, cy, 3.2, 0, TAU); g.fill();
    g.strokeStyle = INK2; g.lineWidth = 1.2; g.stroke();
  }

  // coffre de butin ramassé : il s'envole vers son compteur en haut de l'écran
  flyLootUi(g) {
    if (!this.flyLoot.length) return;
    const el = this._lootEl && this._lootEl.isConnected ? this._lootEl : (this._lootEl = document.getElementById('lootPill'));
    let tx = 40, ty = 70;
    if (el) { const r = el.getBoundingClientRect(), c = this.cv.getBoundingClientRect(); if (r.width) { tx = r.left - c.left + r.width * 0.3; ty = r.top - c.top + r.height / 2; } }
    for (const f of this.flyLoot) {
      f.t += this.dt;
      const k = clamp(f.t / 0.7, 0, 1), e = k * k * (3 - 2 * k);
      if (k < 1) {
        const x = f.x + (tx - f.x) * e, y = f.y + (ty - f.y) * e - Math.sin(k * Math.PI) * 90, s = (1.7 - k * 1.1) * this.zoom, spr = this.items.loot[f.tier];
        g.save(); g.translate(x, y); g.scale(s, s); g.rotate(Math.sin(k * 12) * 0.18);
        g.drawImage(spr.c, -spr.ax, -spr.ay + 14, spr.w, spr.h); g.restore();
      } else {
        const q = clamp((f.t - 0.7) / 0.3, 0, 1);
        g.globalCompositeOperation = 'lighter'; g.globalAlpha = 1 - q; g.drawImage(glowTex(LOOT_GLOW[f.tier] || '#ffffff'), tx - 20 - q * 20, ty - 20 - q * 20, 40 + q * 40, 40 + q * 40);
        g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      }
    }
    this.flyLoot = this.flyLoot.filter(f => f.t < 1);
  }

  dispose() {
    this.mons.clear();
    this.world.chunks.clear();
    this.cv.width = this.cv.height = 1;
  }
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
function hexRGB(hex) { const n = parseInt(hex.slice(1), 16); return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`; }

// ligne brisée d'un éclair entre deux points
function zigzag(x0, y0, x1, y1, n, amp) {
  const pts = [[x0, y0]], dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
  for (let i = 1; i < n; i++) { const k = i / n, o = (Math.random() - 0.5) * 2 * amp; pts.push([x0 + dx * k + nx * o, y0 + dy * k + ny * o]); }
  pts.push([x1, y1]);
  return pts;
}

function rr(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

function rbar(g, x, y, w, h, k, col) {
  g.fillStyle = 'rgba(16,8,30,.8)'; rr(g, x - 1.5, y - 1.5, w + 3, h + 3, (h + 3) / 2); g.fill();
  if (k > 0) { g.fillStyle = col; rr(g, x, y, Math.max(h, w * k), h, h / 2); g.fill(); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x + h / 2, y + 1, Math.max(0, w * k - h), 1.4); }
}
