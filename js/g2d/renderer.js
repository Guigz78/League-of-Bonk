// Rendu 2D d'une partie : caméra fixe vue de dessus (aucune rotation), sprites cartoon triés en profondeur,
// effets lumineux, chiffres de dégâts regroupés, alertes au sol, ambiance par zone.
// Le jeu (run.js) ne connaît que : new Gfx(run, canvas), gfx.resize(), gfx.render(dt), gfx.dispose().
import { HALF } from '../data.js';
import { save } from '../save.js';
import { fmt } from '../ui.js';
import { heroSprites, monsterSprites, petSprites } from './sprites.js';
import { World2D, CH } from './world.js';
import { itemSprites, glowTex, softTex, puffTex } from './items.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rand = (a, b) => a + Math.random() * (b - a);
const backOut = t => { const c = 2.2; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; };
const FONT = 'ui-rounded, "SF Pro Rounded", "Nunito", system-ui, sans-serif';
const HERO_SHOTS = { arrow: 'arrow', dagger: 'dagger', boom: 'boom' };

export class Gfx {
  constructor(run, canvas) {
    this.run = run;
    this.cv = canvas;
    this.g = canvas.getContext('2d', { alpha: false });
    this.t = 0;
    this.quality = 1;
    this.resize();
    const res = this.res = Math.min(3, this.dpr * this.zoomBase);
    this.world = new World2D(run.zone, res, [...run.chests, ...run.shrines, { x: 0, y: 0 }]);
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
    const shk = Math.min(5, (run.shake || 0) * 0.45);
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
        if (ev.quiet && !ev.crit) break;
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
      case 'evolve': hs.evo = 1.6; this.bursts.push({ x: p.x, y: p.y - 20, r: 240, t: 0, max: 0.9, c: '#ffe48a' }); break;
      case 'pickup':
        if (ev.kind !== 'xp' || Math.random() < 0.4) this.sparkle(p.x + rand(-8, 8), p.y - 22 + rand(-8, 8), ev.kind === 'gold' ? '#ffd54a' : ev.kind === 'heart' ? '#ff6a8a' : '#8ad8ff');
        break;
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
        const R = T.R, pulse = 0.5 + Math.sin(t * 22) * 0.5;
        g.strokeStyle = `rgba(255,150,60,${0.35 + pulse * 0.4})`; g.lineWidth = 4;
        g.beginPath(); g.arc(e.x, e.y, Math.min(R, e.r + (R - e.r) * k), 0, TAU); g.stroke();
        if (Math.hypot(p.x - e.x, p.y - e.y) < R + 30) this.jumpHint = 0.4;
      } else if (T.kind === 'mortar') {
        g.strokeStyle = 'rgba(255,80,80,.9)'; g.lineWidth = 2;
        const r = 14 + (1 - k) * 18;
        g.beginPath(); g.arc(T.x, T.y, r, 0, TAU); g.moveTo(T.x - r - 6, T.y); g.lineTo(T.x + r + 6, T.y); g.moveTo(T.x, T.y - r - 6); g.lineTo(T.x, T.y + r + 6); g.stroke();
      }
    }
    // ondes de choc (à sauter)
    for (const w of run.waves) {
      if (!this.inView(w.x, w.y, w.r + 20)) continue;
      const a = clamp(1 - w.r / w.max, 0, 1);
      g.strokeStyle = `rgba(60,30,20,${0.5 * a + 0.2})`; g.lineWidth = 14;
      g.beginPath(); g.arc(w.x, w.y + 3, w.r, 0, TAU); g.stroke();
      g.strokeStyle = `rgba(255,200,120,${0.6 * a + 0.3})`; g.lineWidth = 6;
      g.beginPath(); g.arc(w.x, w.y, w.r, 0, TAU); g.stroke();
      g.strokeStyle = `rgba(255,255,255,${0.6 * a})`; g.lineWidth = 2;
      g.beginPath(); g.arc(w.x, w.y - 2, Math.max(1, w.r - 3), 0, TAU); g.stroke();
      if (Math.abs(Math.hypot(p.x - w.x, p.y - w.y) - w.r) < 120) this.jumpHint = 0.3;
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
    if (!run.dying) this.shadow(p.x, p.y, 30 * (1 - Math.min(0.45, p.h / 200)), 11 * (1 - Math.min(0.45, p.h / 200)), 0.34);
    if (run.pet) this.shadow(run.pet.x, run.pet.y, 18, 7);
    // objets au sol (gemmes, pièces…)
    const I = this.items;
    for (const it of run.pickups) {
      if (!this.inView(it.x, it.y, 20)) continue;
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
    for (const e of run.enemies) if (!e.dead && this.inView(e.x, e.y, e.r * 3 + 40)) L.push({ y: e.y, k: 'enemy', o: e });
    if (run.pet) L.push({ y: run.pet.y, k: 'pet', o: run.pet });
    L.sort((a, b) => a.y - b.y);
    for (const it of L) {
      if (it.spr) this.drawProp(it);
      else if (it.k === 'enemy') this.drawEnemy(it.o);
      else if (it.k === 'chest' || it.k === 'gchest') this.drawChest(it.o, it.k === 'gchest');
      else if (it.k === 'shrine') this.drawShrine(it.o);
      else if (it.k === 'pet') this.drawPet(it.o);
    }
    // le héros toujours par-dessus la foule, avec un anneau au sol pour le repérer
    if (!run.dying) {
      this.W(); const g2 = this.g;
      g2.strokeStyle = 'rgba(255,213,74,.75)'; g2.lineWidth = 2.4;
      g2.beginPath(); g2.ellipse(p.x, p.y, 17, 7, 0, 0, TAU); g2.stroke();
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
      this.glowAdd(c.x, c.y - 14, gold ? 46 : 34, gold ? '#ffcf40' : '#ffb84a', gold ? 0.65 : 0.35 + Math.sin(t * 3) * 0.1);
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
    const f = ((e.bob * 0.55) | 0) & 1;
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
    const img = e.flash > 0 && !big ? s.white : e.freeze > 0 ? s.ice : s.c;
    if (body === 'ghost') g.globalAlpha = 0.88;
    this.spr(s, e.x, e.y - up, sc * e.g_face * sxs, sc * sys, rot, img);
    if (big && e.flash > 0) { g.globalAlpha = e.flash > 0.05 ? 0.4 : 0.25; this.spr(s, e.x, e.y - up, sc * e.g_face * sxs, sc * sys, rot, s.white); }
    g.globalAlpha = 1;
    if (e.g_new > 0) { e.g_new -= this.dt * 1.5; g.globalCompositeOperation = 'lighter'; g.globalAlpha = Math.max(0, e.g_new); this.spr(s, e.x, e.y - up, sc * e.g_face, sc, 0, s.white); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
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
    if (p.face.x > 0.15) hs.face = 1; else if (p.face.x < -0.15) hs.face = -1;
    if (p.moving) { hs.ft += dt; if (hs.ft > 0.12) { hs.ft = 0; hs.frame ^= 1; } } else hs.frame = 0;
    let sx = 1, sy = 1, up = p.h * 0.9, rot = 0, ox = 0;
    if (p.moving && p.h <= 0) { const b = Math.abs(Math.sin(t * 13)); up += b * 2.6; rot = Math.sin(t * 13) * 0.07; sy = 1 + b * 0.04; }
    else if (!p.moving && p.h <= 0) sy = 1 + Math.sin(t * 3) * 0.025;
    if (p.h > 0) { sy *= p.vh > 0 ? 1.12 : 1.04; sx *= p.vh > 0 ? 0.9 : 0.97; }
    if (hs.land > 0) { const k = hs.land; sx *= 1 + k * 0.18; sy *= 1 - k * 0.16; hs.land = Math.max(0, hs.land - dt * 6); }
    // attaque : petit élan vers la cible
    for (const f of run.fx) if (!f.g_seen) { f.g_seen = 1; if (f.type === 'slash' || f.type === 'beam') { hs.atk = 1; hs.atkA = f.a; } }
    for (const s of run.shots) if (!s.g_seen) { s.g_seen = 1; if (s.type === 'arrow' || s.type === 'crystal') { hs.atk = Math.max(hs.atk, 0.6); hs.atkA = Math.atan2(s.vy, s.vx); } }
    if (hs.atk > 0) { const k = Math.sin(hs.atk * Math.PI); ox = Math.cos(hs.atkA) * 4 * k; up += Math.max(0, -Math.sin(hs.atkA)) * 2 * k; sx *= 1 + k * 0.08; sy *= 1 - k * 0.06; if (Math.cos(hs.atkA) * hs.face < -0.3 && hs.atk > 0.9) hs.face = -hs.face; hs.atk = Math.max(0, hs.atk - dt * 6); }
    if (run.dying) { rot = 1.4 * hs.face; up = 0; }
    const evo = Math.min(2, p.evo), set = this.hero[evo], s = set[hs.frame];
    // évolution : rayons de lumière derrière
    if (hs.evo > 0) {
      hs.evo -= dt;
      g.globalCompositeOperation = 'lighter';
      this.M(p.x, p.y - 22, 1, 1, t * 1.5);
      const a = Math.min(1, hs.evo);
      for (let i = 0; i < 10; i++) { g.rotate(TAU / 10); g.fillStyle = `rgba(255,228,138,${0.35 * a})`; g.beginPath(); g.moveTo(0, 0); g.lineTo(140, -12); g.lineTo(140, 12); g.fill(); }
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
    // invincibilité : clignote après un coup, brille pendant les longues
    let img = s.c;
    if (hs.hurt > 0) { img = s.white; hs.hurt -= dt; }
    else if (p.inv > 0 && p.inv <= 0.5 && run.hurtFlash > 0 && Math.floor(t * 20) % 2) g.globalAlpha = 0.35;
    if (p.inv > 0.5 && !run.dying) this.glowAdd(p.x, p.y - 22 - up, 40, '#fff0b0', 0.35 + Math.sin(t * 12) * 0.15);
    if (p.shieldHit) { this.W(); g.strokeStyle = `rgba(168,216,255,${0.55 + Math.sin(t * 4) * 0.2})`; g.lineWidth = 2; g.beginPath(); g.arc(p.x, p.y - 22 - up, 27, 0, TAU); g.stroke(); }
    const sc = 1.05 + evo * 0.06;
    this.spr(s, p.x + ox, p.y - up, sc * sx * hs.face, sc * sy, rot, img);
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
      if (s.star) { const r = 5 * a + 1; g.beginPath(); g.moveTo(s.x - r, s.y); g.lineTo(s.x + r, s.y); g.moveTo(s.x, s.y - r); g.lineTo(s.x, s.y + r); g.stroke(); }
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
    // prix des coffres
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const c of run.chests) if (!c.open && Math.hypot(c.x - p.x, c.y - p.y) < 300) {
      const [x, y] = this.ws(c.x, c.y - 48);
      const ok = run.gold >= run.chestCost;
      g.font = `900 12px ${FONT}`;
      const txt = `${run.chestCost} or`, w = g.measureText(txt).width + 14;
      g.fillStyle = 'rgba(16,8,30,.82)'; rr(g, x - w / 2, y - 10, w, 20, 10); g.fill();
      g.fillStyle = ok ? '#ffd54a' : '#ff9a8a'; g.fillText(txt, x, y + 1);
    }
    // chiffres de dégâts (les coups rapprochés sur un même monstre s'additionnent)
    for (const n of this.nums) {
      n.t += dt; n.life -= dt; n.pop = Math.max(0, n.pop - dt * 7);
      if (!n.e.dead) { n.x += (n.e.x - n.x) * 0.3; n.y += (n.e.y - n.y) * 0.3; }
      const [x, y] = this.ws(n.x + n.dx * n.t, n.y);
      const rise = n.h * z + 10 + n.t * 46;
      const size = (n.crit ? 18 : 13) * (1 + n.pop * 0.4) * clamp(0.75 + Math.log10(n.v + 1) * 0.12, 0.8, 1.35);
      g.globalAlpha = clamp(n.life * 4, 0, 1);
      g.font = `900 ${size.toFixed(1)}px ${FONT}`;
      const txt = fmt(n.v) + (n.crit ? '!' : '');
      g.lineWidth = 4; g.strokeStyle = '#1a1030'; g.lineJoin = 'round';
      g.save(); g.translate(x, y - rise); if (n.crit) g.rotate(-0.08);
      g.strokeText(txt, 0, 0);
      g.fillStyle = n.crit ? '#ffd54a' : n.color || '#ffffff'; g.fillText(txt, 0, 0);
      g.restore();
    }
    g.globalAlpha = 1;
    this.nums = this.nums.filter(n => n.life > 0);
    for (const [e, n] of this.numBy) if (n.life <= 0) this.numBy.delete(e);
    // soins et dégâts reçus
    for (const tx of run.texts) {
      if (tx.txt[0] !== '+' && tx.txt[0] !== '-') continue;
      const [x, y] = this.ws(tx.x, tx.y - tx.z);
      g.globalAlpha = Math.min(1, tx.life * 3);
      g.font = `900 ${Math.round(16 * tx.size)}px ${FONT}`;
      g.lineWidth = 4; g.strokeStyle = '#1a1030'; g.strokeText(tx.txt, x, y);
      g.fillStyle = tx.color; g.fillText(tx.txt, x, y);
    }
    g.globalAlpha = 1;
    // « Sautez ! » quand une onde de choc arrive
    if (this.jumpHint > 0) {
      this.jumpHint -= dt;
      const b = Math.abs(Math.sin(t * 10)) * 4;
      g.font = `900 15px ${FONT}`;
      g.fillStyle = 'rgba(16,8,30,.85)'; rr(g, hx - 38, hy - 92 - b, 76, 24, 12); g.fill();
      g.fillStyle = '#ffd54a'; g.fillText('SAUTEZ !', hx, hy - 79 - b);
    }
    this.arrows(g);
    this.minimap(g);
    // alertes plein écran
    if (ratio < 0.3 && !run.dying) this.edge(g, '255,30,50', (0.25 + Math.sin(t * 6) * 0.12) * (1 - ratio / 0.3));
    if (this.flashHurt > 0) { this.flashHurt -= dt; this.edge(g, '255,40,60', Math.min(0.3, this.flashHurt * 0.9), 0.45); }
    if (run.ultFlash > 0) { g.fillStyle = `rgba(255,244,210,${run.ultFlash * 0.7})`; g.fillRect(0, 0, vw, vh); }
    if (run.evoFlash > 0.6) { g.fillStyle = `rgba(255,250,220,${(run.evoFlash - 0.6) * 1.2})`; g.fillRect(0, 0, vw, vh); }
    if (run.joy) {
      const j = run.joy, r = this.cv.getBoundingClientRect();
      const ox = j.ox - r.left, oy = j.oy - r.top;
      let kx = j.x - j.ox, ky = j.y - j.oy; const d = Math.hypot(kx, ky); if (d > 50) { kx *= 50 / d; ky *= 50 / d; }
      g.fillStyle = 'rgba(255,255,255,.10)'; g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2;
      g.beginPath(); g.arc(ox, oy, 54, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.arc(ox + kx, oy + ky, 22, 0, TAU); g.fill();
    }
  }

  edge(g, rgb, a, inner = 0.3) {
    if (a <= 0) return;
    const vw = this.vw, vh = this.vh, gr = g.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * inner, vw / 2, vh / 2, Math.hypot(vw, vh) * 0.55);
    gr.addColorStop(0, `rgba(${rgb},0)`); gr.addColorStop(1, `rgba(${rgb},${Math.min(0.85, a)})`);
    g.fillStyle = gr; g.fillRect(0, 0, vw, vh);
  }

  // flèches au bord de l'écran vers ce qui est hors champ
  arrows(g) {
    const run = this.run, p = run.p, vw = this.vw, vh = this.vh, t = this.t;
    const pts = [];
    if (run.boss && !run.boss.dead) pts.push([run.boss, '#ff2a4a', 15]);
    for (const c of run.dropChests) if (!c.open) pts.push([c, '#ffcf40', 11]);
    for (const e of run.enemies) if (e.elite && !e.dead) pts.push([e, '#c06aff', 10]);
    for (const s of run.shrines) if (!s.used && Math.hypot(s.x - p.x, s.y - p.y) < 1000) pts.push([s, '#4fd0ff', 9]);
    for (const c of run.chests) if (!c.open && Math.hypot(c.x - p.x, c.y - p.y) < 800) pts.push([c, '#ffb84a', 8]);
    const m = 26, top = 120, bot = vh - 90;
    for (const [o, col, size] of pts) {
      const [x, y] = this.ws(o.x, o.y - 20);
      if (x > 0 && x < vw && y > top - 40 && y < vh) continue;
      const cx = vw / 2, cy = (top + bot) / 2, dx = x - cx, dy = y - cy;
      const s = Math.min(Math.abs((vw / 2 - m) / (dx || 1e-6)), Math.abs(((bot - top) / 2) / (dy || 1e-6)));
      const ax = cx + dx * s, ay = cy + dy * s, a = Math.atan2(dy, dx), b = Math.sin(t * 6) * 2;
      g.save(); g.translate(ax - Math.cos(a) * b, ay - Math.sin(a) * b); g.rotate(a);
      g.fillStyle = '#1a1030'; g.beginPath(); g.moveTo(size + 3, 0); g.lineTo(-size * 0.7 - 2, -size * 0.8 - 2); g.lineTo(-size * 0.7 - 2, size * 0.8 + 2); g.closePath(); g.fill();
      g.fillStyle = col; g.beginPath(); g.moveTo(size, 0); g.lineTo(-size * 0.7, -size * 0.8); g.lineTo(-size * 0.7, size * 0.8); g.closePath(); g.fill();
      g.restore();
    }
  }

  minimap(g) {
    const run = this.run, p = run.p, R = 44, cx = this.vw - R - 12, cy = 158, range = 900;
    g.save();
    g.beginPath(); g.arc(cx, cy, R, 0, TAU);
    g.fillStyle = 'rgba(10,6,20,.6)'; g.fill();
    g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 2; g.stroke();
    g.clip();
    const dot = (x, y, col, r) => { g.fillStyle = col; g.beginPath(); g.arc(cx + (x - p.x) / range * R, cy + (y - p.y) / range * R, r, 0, TAU); g.fill(); };
    // bords de la carte
    g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 1;
    g.strokeRect(cx + (-HALF - p.x) / range * R, cy + (-HALF - p.y) / range * R, HALF * 2 / range * R, HALF * 2 / range * R);
    for (const e of run.enemies) if (!e.boss && Math.abs(e.x - p.x) < range && Math.abs(e.y - p.y) < range) dot(e.x, e.y, e.elite ? '#d08aff' : 'rgba(255,90,90,.6)', e.elite ? 2.4 : 1.3);
    for (const ch of run.chests) if (!ch.open) dot(ch.x, ch.y, '#ffc83a', 3);
    for (const ch of run.dropChests) if (!ch.open) dot(ch.x, ch.y, '#ffc83a', 3);
    for (const sh of run.shrines) if (!sh.used) dot(sh.x, sh.y, '#4fd0ff', 3.2);
    if (run.boss && !run.boss.dead) dot(run.boss.x, run.boss.y, '#ff2a4a', 4.5);
    g.restore();
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(cx, cy, 3.2, 0, TAU); g.fill();
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

function rr(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

function rbar(g, x, y, w, h, k, col) {
  g.fillStyle = 'rgba(16,8,30,.8)'; rr(g, x - 1.5, y - 1.5, w + 3, h + 3, (h + 3) / 2); g.fill();
  if (k > 0) { g.fillStyle = col; rr(g, x, y, Math.max(h, w * k), h, h / 2); g.fill(); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x + h / 2, y + 1, Math.max(0, w * k - h), 1.4); }
}
