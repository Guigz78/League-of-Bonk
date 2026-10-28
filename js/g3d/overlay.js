// Calque 2D net par-dessus la 3D : chiffres de dégâts (regroupés par monstre), barres de vie, prix des coffres,
// repères et flèches hors champ (grande flèche « PORTAIL » avec la distance), chevrons autour du héros,
// mini-carte, bulle « SAUTEZ ! », joystick, vignettes et flashs. Positions projetées avec la caméra 3D.
import { HALF, TOTEMS } from '../data.js';
import { save } from '../save.js';
import { fmt } from '../ui.js';
import { iconURL } from '../art.js';
import { LOOT_GLOW, glowTex, shade as shadeHex } from './tex2d.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rand = (a, b) => a + Math.random() * (b - a);
const FONT = 'ui-rounded, "SF Pro Rounded", "Nunito", system-ui, sans-serif';
const INK = '#14081e';
// couleurs du système de design (interface carrée et sobre) : fond, filets, accent ambre, cyan
const BG = 'rgba(10,13,20,.86)', LINE = 'rgba(255,255,255,.16)', ACC = '#f5b400', CY = '#3fd0ff';
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
} catch (e) { /* police du système */ }
function hexRGB(hex) { const n = parseInt(hex.slice(1), 16); return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`; }

export class Overlay {
  constructor(gfx, canvas) {
    this.gfx = gfx; this.run = gfx.run; this.cv = canvas;
    this.g = canvas.getContext('2d');
    this.nums = []; this.numBy = new Map(); this.flyLoot = [];
    this.flashA = 0.55; this.flashC = '235,225,255'; this.edgeA = 0; this.edgeC = '255,40,40'; this.otPulse = 0; this.flashHurt = 0;
    this.icons = {};
    for (const k in TOTEMS) { const im = new Image(); im.src = iconURL(TOTEMS[k].icon); this.icons[k] = im; }
    // pictogrammes des flèches de bord d'écran (on sait ce qu'il y a au bout de chaque flèche)
    this.ico = {}; for (const k of ['crown', 'chest', 'skull', 'star']) { const im = new Image(); im.src = iconURL(k); this.ico[k] = im; }
    this.vign = null;
  }

  resize(vw, vh) {
    const dpr = this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.vw = vw; this.vh = vh;
    this.cv.width = Math.round(vw * dpr); this.cv.height = Math.round(vh * dpr);
    this.vign = null;
  }

  onEvent(ev) {
    const run = this.run;
    switch (ev.type) {
      case 'hit': {
        const e = ev.e, mode = save.settings?.numbers || 'all';
        if (mode === 'none' || (mode === 'crit' && !ev.crit)) break;
        if (ev.quiet && !ev.crit) break;
        const n = this.numBy.get(e);
        if (n && n.t < 0.45 && n.life > 0.2) { n.v += ev.dmg; n.pop = 1; n.crit = n.crit || ev.crit; n.t = Math.min(n.t, 0.2); n.life = 0.75; }
        else if (this.nums.length < (ev.crit ? 52 : 34)) {
          const m = { e, x: e.x + rand(-6, 6), y: e.y, h: e.r * 2.3 + e.fly, v: ev.dmg, crit: ev.crit, color: ev.color, t: 0, life: 0.75, pop: 1, dx: rand(-14, 14) };
          this.nums.push(m); this.numBy.set(e, m);
        }
        break;
      }
      case 'kill': this.numBy.delete(ev.e); break;
      case 'hurt': this.flashHurt = 0.35; break;
      case 'pickup':
        if (ev.kind === 'loot') {
          if (this.flyLoot.length < 6) { const [x, y] = this.gfx.ws(ev.x, ev.y, 20); this.flyLoot.push({ tier: ev.v, x, y, t: 0 }); }
          if (ev.v >= 2) { this.flashA = Math.max(this.flashA, 0.18); this.flashC = ev.v === 3 ? '255,140,240' : '255,230,140'; }
          if (Math.hypot(ev.x - run.p.x, ev.y - run.p.y) > 400) this.flyLoot.length = 0;
        }
        break;
      case 'bossSummon': this.flashA = 0.6; this.flashC = '60,0,16'; this.edgeA = 0.6; this.edgeC = '255,30,30'; break;
      case 'bossPhase': this.edgeA = 0.55; this.edgeC = ev.phase >= 3 ? '255,30,30' : '255,140,40'; break;
      case 'bossDeath': this.flashA = 0.6; this.flashC = '255,246,214'; break;
      // giga boss : arrivée (voile sombre, bords rouge et or), armure qui éclate, victoire (éclair doré)
      case 'gigaSummon': this.flashA = 0.6; this.flashC = '40,0,10'; this.edgeA = 0.9; this.edgeC = '255,150,30'; break;
      case 'gigaPhase': this.flashA = 0.45; this.flashC = '255,170,90'; this.edgeA = 0.8; this.edgeC = ev.phase >= 3 ? '255,60,20' : '255,170,40'; break;
      case 'gigaDeath': this.flashA = 0.9; this.flashC = '255,236,170'; this.edgeA = 0.7; this.edgeC = '255,210,80'; break;
      case 'gigaBonk': if (ev.hit) { this.flashA = Math.max(this.flashA, 0.3); this.flashC = '255,120,40'; } break;
      case 'portalEnter': this.flashA = 0.8; this.flashC = '230,220,255'; break;
      case 'totem': this.edgeA = 0.35; this.edgeC = hexRGB(TOTEMS[ev.kind]?.color || '#ffffff'); break;
      case 'overtime': this.flashA = 0.5; this.flashC = '255,40,30'; this.otPulse = 1; break;
      case 'overtimeStep': this.otPulse = 1; this.flashA = Math.max(this.flashA, 0.22); this.flashC = '255,40,30'; break;
      case 'evolve': if (ev.final) { this.flashA = 0.75; this.flashC = '255,240,190'; } else { this.flashA = Math.max(this.flashA, 0.25 + 0.2 * clamp((ev.evo || 1) / 4, 0, 1)); this.flashC = '255,248,220'; } break;
    }
  }

  render(dt) {
    const g = this.g, gfx = this.gfx, run = this.run, p = run.p, vw = this.vw, vh = this.vh, t = gfx.t;
    this.dt = dt;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.cv.width, this.cv.height);
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    // vignette douce permanente
    if (!this.vign || this.vign.w !== vw || this.vign.h !== vh) {
      const c = document.createElement('canvas'); c.width = Math.ceil(vw / 2); c.height = Math.ceil(vh / 2);
      const q = c.getContext('2d'), gr = q.createRadialGradient(c.width / 2, c.height / 2, Math.min(c.width, c.height) * 0.38, c.width / 2, c.height / 2, Math.hypot(c.width, c.height) * 0.6);
      gr.addColorStop(0, 'rgba(10,4,24,0)'); gr.addColorStop(1, 'rgba(10,4,24,.42)');
      q.fillStyle = gr; q.fillRect(0, 0, c.width, c.height);
      this.vign = { c, w: vw, h: vh };
    }
    g.drawImage(this.vign.c, 0, 0, vw, vh);
    // chrono écoulé : ambiance rouge qui pulse, de plus en plus forte
    if (run.overtime > 0) {
      const lv = run.otLevel || 1, pulse = 0.5 + Math.sin(t * (3 + Math.min(4, lv * 0.4))) * 0.5;
      this.otPulse = Math.max(0, this.otPulse - dt * 1.4);
      g.fillStyle = `rgba(255,30,20,${0.04 + Math.min(0.06, lv * 0.01) + pulse * 0.025})`; g.fillRect(0, 0, vw, vh);
      this.edge(g, '255,20,30', 0.2 + Math.min(0.2, lv * 0.025) + pulse * 0.1 + this.otPulse * 0.3, 0.28);
    }
    const [hx, hy] = gfx.ws(p.x, p.y, Math.max(0, p.h));
    const ratio = clamp(p.hp / p.maxHp, 0, 1);
    // barre de vie du héros (sous ses pieds)
    if (!run.dying) rbar(g, hx - 20, hy + 10, 40, 4, ratio, ratio < 0.3 ? '#ff4d5e' : '#3ddc84');
    // barres des élites
    for (const e of run.enemies) if (e.elite && !e.dead && !e.boss) {
      const [x, y, ok] = gfx.ws(e.x, e.y, e.r * 2.6 + e.fly);
      if (ok && x > -30 && x < vw + 30 && y > -30 && y < vh + 30) rbar(g, x - 22, y - 4, 44, 4, clamp(e.hp / e.maxHp, 0, 1), e.mini ? ACC : '#a855f7');
    }
    // cible principale (réticule)
    const tg = run.target;
    if (tg && !tg.dead && !run.dying) {
      const [x, y, ok] = gfx.ws(tg.x, tg.y, tg.r * 1.1 + (tg.fly || 0));
      if (ok) this.reticle(g, x, y, (tg.r * 1.3 + 8) * gfx.ppu(), t, tg);
    }
    // prix des coffres
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    for (const c of run.chests) if (!c.open && Math.hypot(c.x - p.x, c.y - p.y) < 300) {
      const [x, y] = gfx.ws(c.x, c.y, 62);
      const ok = run.gold >= run.chestCost;
      g.font = tf(13);
      const txt = `${run.chestCost} OR`, w = g.measureText(txt).width + 16;
      panel(g, x - w / 2, y - 10, w, 20, 'rgba(10,13,20,.88)', ok ? 'rgba(245,180,0,.7)' : 'rgba(255,77,94,.6)', 5);
      g.fillStyle = ok ? ACC : '#ff8a96'; g.fillText(txt, x, y + 1);
    }
    // chiffres de dégâts (les coups rapprochés sur un même monstre s'additionnent) : gros, blancs, cernés de noir
    const ppu = gfx.ppu();
    for (const n of this.nums) {
      n.t += dt; n.life -= dt; n.pop = Math.max(0, n.pop - dt * 7);
      if (!n.e.dead) { n.x += (n.e.x - n.x) * 0.3; n.y += (n.e.y - n.y) * 0.3; }
      const [x, y] = gfx.ws(n.x + n.dx * n.t, n.y, n.h);
      const rise = 6 + n.t * 48;
      const size = (n.crit ? 24 : 17) * (1 + n.pop * 0.45) * clamp(0.78 + Math.log10(n.v + 1) * 0.12, 0.85, 1.4);
      g.globalAlpha = clamp(n.life * 4, 0, 1);
      g.font = tf(size.toFixed(1));
      const txt = fmt(n.v) + (n.crit ? '!' : '');
      g.save(); g.translate(x, y - rise); if (n.crit) g.rotate(-0.08);
      this.outText(g, txt, 0, 0, n.crit ? '#ffd54a' : n.color || '#ffffff', n.crit ? 5 : 4.2);
      g.restore();
    }
    g.globalAlpha = 1;
    let k = 0;
    for (const n of this.nums) if (n.life > 0) this.nums[k++] = n;
    this.nums.length = k;
    for (const [e, n] of this.numBy) if (n.life <= 0) this.numBy.delete(e);
    // soins, dégâts reçus, « Esquive ! »… (les dégâts infligés sont déjà affichés au-dessus)
    for (const tx of run.texts) {
      if (/^[\d\s.,  kM]+$/.test(tx.txt)) continue;
      const [x, y] = gfx.ws(tx.x, tx.y, tx.z);
      g.globalAlpha = Math.min(1, tx.life * 3);
      g.font = tf(Math.round(17 * tx.size));
      this.outText(g, tx.txt, x, y, tx.color, 4);
    }
    g.globalAlpha = 1;
    this.totemBadges(g);
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
    if (run.joy) this.joystick(g, run.joy);
  }

  // joystick flottant : socle translucide et bouton (taille selon le réglage)
  joystick(g, j) {
    const r = this.cv.getBoundingClientRect(), js = clamp(+save.settings?.joySize || 1, 0.7, 1.4), R = 50 * js;
    const ox = j.ox - r.left, oy = j.oy - r.top;
    let kx = j.x - j.ox, ky = j.y - j.oy; const d = Math.hypot(kx, ky); if (d > R) { kx *= R / d; ky *= R / d; }
    g.fillStyle = 'rgba(10,8,30,.22)'; g.beginPath(); g.arc(ox, oy + 3, R + 4, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,.12)'; g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = 3;
    g.beginPath(); g.arc(ox, oy, R + 4, 0, TAU); g.fill(); g.stroke();
    if (d > 4) { const a = Math.atan2(ky, kx); g.strokeStyle = 'rgba(255,213,74,.85)'; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.arc(ox, oy, R + 4, a - 0.45, a + 0.45); g.stroke(); }
    const gr = g.createRadialGradient(ox + kx - 6, oy + ky - 8, 2, ox + kx, oy + ky, 24 * js);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, 'rgba(220,228,255,.85)');
    g.fillStyle = 'rgba(10,8,30,.35)'; g.beginPath(); g.arc(ox + kx, oy + ky + 3, 23 * js, 0, TAU); g.fill();
    g.fillStyle = gr; g.beginPath(); g.arc(ox + kx, oy + ky, 23 * js, 0, TAU); g.fill();
  }

  // réticule carré (coins en équerre) : se resserre d'un coup quand la cible change (verrouillage)
  reticle(g, x, y, R, t, tg) {
    if (tg !== this.tgLast) { this.tgLast = tg; this.tgT = 0; }
    this.tgT = Math.min(1, (this.tgT || 0) + this.dt / 0.16);
    const lock = 1 - this.tgT, big = tg.boss || tg.elite;
    R = clamp(R, 16, 90) * (1 + lock * 0.6) * (1 + Math.sin(t * 6) * 0.03);
    const L = Math.max(6, R * 0.42);
    g.save(); g.translate(x, y); g.globalAlpha = 0.55 + 0.45 * this.tgT;
    g.lineCap = 'square'; g.lineJoin = 'miter';
    const corners = w => { g.lineWidth = w; g.beginPath(); for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { g.moveTo(sx * R, sy * (R - L)); g.lineTo(sx * R, sy * R); g.lineTo(sx * (R - L), sy * R); } g.stroke(); };
    g.strokeStyle = 'rgba(10,6,20,.8)'; corners(5.5);
    g.strokeStyle = big ? '#ffd54a' : '#ff4a3a'; corners(2.6);
    g.restore(); g.globalAlpha = 1;
  }

  // pastilles des totems (icône dans un rond de leur couleur) au-dessus de chacun
  totemBadges(g) {
    const run = this.run, t = this.gfx.t;
    for (const T0 of run.totems || []) {
      if (T0.used) continue;
      const [x, y, ok] = this.gfx.ws(T0.x, T0.y, 108 + Math.sin(t * 2.6 + T0.x) * 4);
      if (!ok || x < -30 || x > this.vw + 30 || y < -30 || y > this.vh + 30) continue;
      this.badge(g, x, y, 14, TOTEMS[T0.kind]?.color || '#ffffff', this.icons[T0.kind]);
    }
  }
  // pastille carrée : fond sombre, cadre de la couleur du totem, icône au trait
  badge(g, x, y, r, c, img) {
    panel(g, x - r, y - r, r * 2, r * 2, BG, null, 4);
    g.strokeStyle = c; g.lineWidth = 1.5; chamfer(g, x - r + 0.75, y - r + 0.75, r * 2 - 1.5, r * 2 - 1.5, 4); g.stroke();
    if (img && img.complete && img.naturalWidth) g.drawImage(img, x - r * 0.72, y - r * 0.72, r * 1.44, r * 1.44);
  }

  // texte cerné de noir avec une petite ombre dessous
  outText(g, txt, x, y, c, w = 3.6) {
    g.lineJoin = 'round'; g.lineWidth = w; g.strokeStyle = INK;
    g.strokeText(txt, x, y + w * 0.45);
    g.strokeText(txt, x, y);
    g.fillStyle = c; g.fillText(txt, x, y);
  }

  edge(g, rgb, a, inner = 0.3) {
    if (a <= 0) return;
    const vw = this.vw, vh = this.vh, gr = g.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * inner, vw / 2, vh / 2, Math.hypot(vw, vh) * 0.55);
    gr.addColorStop(0, `rgba(${rgb},0)`); gr.addColorStop(1, `rgba(${rgb},${Math.min(0.85, a)})`);
    g.fillStyle = gr; g.fillRect(0, 0, vw, vh);
  }

  // repères au-dessus du portail et de l'autel quand ils sont à l'écran
  markers(g) {
    const run = this.run, t = this.gfx.t, p = run.p, Po = run.portal, Al = run.altar;
    const on = (x, y) => x > -40 && x < this.vw + 40 && y > -40 && y < this.vh + 40;
    if (Po && Po.t > 0.6) {
      const [x, y] = this.gfx.ws(Po.x, Po.y, 175);
      if (on(x, y) && y > 236) this.pin(g, x, y + Math.sin(t * 5) * 6, '#8a3aff', '#7ae8ff', 'PORTAIL', 1.1);
    } else if (Al && !Al.used && !run.arena && Math.hypot(Al.x - p.x, Al.y - p.y) > 220) {
      const [x, y] = this.gfx.ws(Al.x, Al.y, 120);
      if (on(x, y) && y > 236) this.pin(g, x, y + Math.sin(t * 4) * 5, '#d81e2e', '#ff8a5a', 'AUTEL DU BOSS', 0.9);
    }
  }
  // repère carré : étiquette sombre à angles coupés, liseré de couleur à gauche, flèche pleine vers le bas
  pin(g, x, y, c1, c2, label, s = 1) {
    g.save(); g.translate(x, y); g.scale(s, s);
    g.lineJoin = 'miter';
    g.beginPath(); g.moveTo(0, 14); g.lineTo(-10, 2); g.lineTo(10, 2); g.closePath();
    g.lineWidth = 3; g.strokeStyle = 'rgba(6,8,13,.85)'; g.stroke(); g.fillStyle = c2; g.fill();
    g.font = tf(14); g.textAlign = 'center'; g.textBaseline = 'middle';
    const w = g.measureText(label).width + 22;
    panel(g, -w / 2, -26, w, 22, BG, LINE, 6);
    g.fillStyle = c1; g.fillRect(-w / 2, -26 + 6, 3, 16);
    g.fillStyle = '#ffffff'; g.fillText(label, 2, -14.5);
    g.restore();
  }

  // chevrons qui tournent autour du héros et montrent le portail (ou l'autel du boss)
  guide(g, hx, hy) {
    const run = this.run, p = run.p, t = this.gfx.t;
    let tg = null, c1, c2, al = 1;
    if (run.portal && run.portal.t > 0.5) { tg = run.portal; c1 = '#b06aff'; c2 = '#bff8ff'; }
    else if (run.altar && !run.altar.used && !run.arena) { tg = run.altar; c1 = '#ff4a3a'; c2 = '#ffd0a0'; al = 0.8; }
    if (!tg || run.dying) return;
    const dx = tg.x - p.x, dy = tg.y - p.y, d = Math.hypot(dx, dy);
    if (d < 120) return;
    // direction à l'écran (la perspective déforme un peu les angles)
    const [tx, ty] = this.gfx.ws(p.x + dx / d * 60, p.y + dy / d * 60, 0), [ox, oy] = this.gfx.ws(p.x, p.y, 0);
    const a = Math.atan2(ty - oy, tx - ox), R = 48 + Math.sin(t * 6) * 4, cx = hx, cy = hy - 18;
    g.save(); g.translate(cx + Math.cos(a) * R, cy + Math.sin(a) * R); g.rotate(a); g.scale(1.25, 1.25);
    g.lineJoin = 'round'; g.lineCap = 'round';
    for (let i = 0; i < 2; i++) {
      const x = i * 10 - 4;
      g.globalAlpha = al * (0.55 + 0.45 * Math.max(0, Math.sin(t * 8 - i * 1.4)));
      g.strokeStyle = INK; g.lineWidth = 8; g.beginPath(); g.moveTo(x - 6, -9); g.lineTo(x + 4, 0); g.lineTo(x - 6, 9); g.stroke();
      g.strokeStyle = i ? c2 : c1; g.lineWidth = 4.4; g.beginPath(); g.moveTo(x - 6, -9); g.lineTo(x + 4, 0); g.lineTo(x - 6, 9); g.stroke();
    }
    g.restore(); g.globalAlpha = 1;
  }

  // flèches au bord de l'écran vers ce qui est hors champ (grande flèche « PORTAIL » / « BOSS » avec la distance)
  arrows(g) {
    const run = this.run, p = run.p, vw = this.vw, vh = this.vh, t = this.gfx.t;
    const m = 28, top = 228, bot = vh - 132, cx = vw / 2, cy = (top + bot) / 2;
    const [hx, hy] = this.gfx.ws(p.x, p.y, 0);
    // direction depuis le héros, mesurée à l'écran (point projeté à 80 px vers la cible)
    const dirTo = o => { const dx = o.x - p.x, dy = o.y - p.y, d = Math.hypot(dx, dy) || 1, [x, y] = this.gfx.ws(p.x + dx / d * 80, p.y + dy / d * 80, 0); return Math.atan2(y - hy, x - hx); };
    const toEdge = (a, mm = m) => {
      const dx = Math.cos(a), dy = Math.sin(a), s = Math.min(Math.abs((vw / 2 - mm) / (dx || 1e-6)), Math.abs(((bot - top) / 2) / (dy || 1e-6)));
      return [cx + dx * s, cy + dy * s];
    };
    const off = o => { const [x, y, ok] = this.gfx.ws(o.x, o.y, 20); return !ok || x < 0 || x > vw || y < top - 40 || y > vh; };
    const pts = [];
    // [cible, couleur, taille, pictogramme] : boss, coffres d'élite, élites, autels de bonus, totems, coffres, butin
    if (run.boss && !run.boss.dead) pts.push([run.boss, '#ff2a4a', 15, this.ico.crown]);
    for (const c of run.dropChests) if (!c.open) pts.push([c, '#c06aff', 11, this.ico.chest]);
    for (const e of run.enemies) if (e.elite && !e.dead && !e.boss) pts.push([e, '#c06aff', 10, this.ico.skull]);
    for (const s of run.shrines) if (!s.used && Math.hypot(s.x - p.x, s.y - p.y) < 1000) pts.push([s, '#4fd0ff', 9, this.ico.star]);
    for (const T0 of run.totems || []) if (!T0.used && Math.hypot(T0.x - p.x, T0.y - p.y) < 900) pts.push([T0, TOTEMS[T0.kind]?.color || '#ffffff', 9, this.icons[T0.kind]]);
    for (const c of run.chests) if (!c.open && Math.hypot(c.x - p.x, c.y - p.y) < 800) pts.push([c, '#ffcf40', 8, this.ico.chest]);
    for (const it of run.pickups) if (it.type === 'loot' && !it.hidden && Math.hypot(it.x - p.x, it.y - p.y) < 900) pts.push([it, LOOT_GLOW[it.tier] || '#ffffff', 9, this.ico.chest]);
    // au plus 6 flèches (les plus proches, le boss d'abord) : l'écran reste lisible
    const d2p = o => (o.x - p.x) ** 2 + (o.y - p.y) ** 2;
    const shown = pts.filter(([o]) => off(o)).sort((a, b) => (b[0] === run.boss) - (a[0] === run.boss) || d2p(a[0]) - d2p(b[0])).slice(0, 6);
    g.lineJoin = 'round';
    for (const [o, c, size, ic] of shown) {
      const a = dirTo(o), [ax0, ay0] = toEdge(a), b = Math.sin(t * 6) * 2;
      g.save(); g.translate(ax0 - Math.cos(a) * b, ay0 - Math.sin(a) * b); g.rotate(a);
      g.fillStyle = 'rgba(6,8,13,.85)'; g.beginPath(); g.moveTo(size + 3.5, 0); g.lineTo(-size * 0.7 - 2.5, -size * 0.8 - 2.5); g.lineTo(-size * 0.7 - 2.5, size * 0.8 + 2.5); g.closePath(); g.fill();
      g.fillStyle = c; g.beginPath(); g.moveTo(size, 0); g.lineTo(-size * 0.7, -size * 0.8); g.lineTo(-size * 0.7, size * 0.8); g.closePath(); g.fill();
      g.restore();
      // pictogramme posé juste derrière la flèche (vers le centre de l'écran)
      if (ic?.complete && ic.naturalWidth) {
        const S = 18, ix = ax0 - Math.cos(a) * (size + 16), iy = ay0 - Math.sin(a) * (size + 16);
        g.fillStyle = 'rgba(6,8,13,.78)'; g.fillRect(ix - S / 2 - 3, iy - S / 2 - 3, S + 6, S + 6);
        g.drawImage(ic, ix - S / 2, iy - S / 2, S, S);
      }
    }
    // grande flèche vers le portail (ou l'autel du boss avant l'invocation)
    let tg = null, c1, c2, label;
    if (run.portal && run.portal.t > 0.5) { tg = run.portal; c1 = '#8a3aff'; c2 = '#7ae8ff'; label = 'PORTAIL'; }
    else if (run.altar && !run.altar.used && !run.arena) { tg = run.altar; c1 = '#d81e2e'; c2 = '#ff9a5a'; label = 'AUTEL DU BOSS'; }
    if (!tg) return;
    const [x, y, ok] = this.gfx.ws(tg.x, tg.y, 40);
    if (ok && x > 20 && x < vw - 20 && y > top - 60 && y < vh - 60) return;
    const a = dirTo(tg), big = label === 'PORTAIL', s = (big ? 1.3 : 0.9) * (1 + Math.sin(t * 7) * 0.08), bb = Math.sin(t * 7) * 4;
    if (big) { // chemin de chevrons au sol jusqu'au portail
      const dx = tg.x - p.x, dy = tg.y - p.y, dd = Math.hypot(dx, dy), ux = dx / dd, uy = dy / dd, L = Math.min(dd - 40, 460), o0 = (t * 110) % 44;
      g.lineJoin = 'round'; g.lineCap = 'round';
      for (let k = 36 + o0; k < L; k += 44) {
        const [sx, sy, ok1] = this.gfx.ws(p.x + ux * k, p.y + uy * k, 0), [sx2, sy2] = this.gfx.ws(p.x + ux * (k + 10), p.y + uy * (k + 10), 0);
        if (!ok1) continue;
        g.save(); g.translate(sx, sy); g.rotate(Math.atan2(sy2 - sy, sx2 - sx)); g.globalAlpha = 0.25 + 0.75 * clamp(1 - k / L, 0, 1);
        g.strokeStyle = 'rgba(30,8,60,.75)'; g.lineWidth = 9; g.beginPath(); g.moveTo(-7, -10); g.lineTo(5, 0); g.lineTo(-7, 10); g.stroke();
        g.strokeStyle = '#d4a8ff'; g.lineWidth = 5; g.beginPath(); g.moveTo(-7, -10); g.lineTo(5, 0); g.lineTo(-7, 10); g.stroke();
        g.restore();
      }
      g.globalAlpha = 1;
    }
    // le portail : grosse flèche près du héros (jamais cachée par les boutons du bas)
    const [ax, ay] = big ? [clamp(hx + Math.cos(a) * 96, 40, vw - 40), clamp(hy - 20 + Math.sin(a) * 96, top, vh - 200)] : toEdge(a, 34);
    g.save(); g.translate(ax + Math.cos(a) * bb, ay + Math.sin(a) * bb); g.rotate(a); g.scale(s, s);
    g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.55 + Math.sin(t * 7) * 0.2; g.drawImage(glowTex(c1), -40, -40, 80, 80);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    // flèche pleine à arêtes vives, liseré sombre, bande claire au centre (lisible sur tous les sols)
    const ar = new Path2D(); ar.moveTo(26, 0); ar.lineTo(2, -22); ar.lineTo(2, -10); ar.lineTo(-18, -10); ar.lineTo(-18, 10); ar.lineTo(2, 10); ar.lineTo(2, 22); ar.closePath();
    g.lineJoin = 'miter'; g.strokeStyle = 'rgba(6,8,13,.9)'; g.lineWidth = 5; g.stroke(ar);
    g.fillStyle = c1; g.fill(ar);
    g.fillStyle = c2; g.beginPath(); g.moveTo(20, 0); g.lineTo(6, -13); g.lineTo(6, -4); g.lineTo(-14, -4); g.lineTo(-14, 4); g.lineTo(6, 4); g.lineTo(6, 13); g.closePath(); g.fill();
    g.restore();
    // étiquette avec la distance, côté intérieur : panneau sombre à angles coupés, liseré de couleur
    const d = Math.round(Math.hypot(tg.x - p.x, tg.y - p.y) / 10) + ' m';
    g.font = tf(big ? 15 : 13); const w1 = g.measureText(label).width;
    g.font = tf(13); const w2 = g.measureText(d).width;
    const W = Math.max(w1, w2) + 24, H = 38;
    const lo = big ? -56 : 58, lx = clamp(ax - Math.cos(a) * lo, W / 2 + 6, vw - W / 2 - 6), ly = clamp(ay - Math.sin(a) * (big ? -48 : 46), top - 30, big ? vh - 190 : bot + 10);
    panel(g, lx - W / 2, ly - H / 2, W, H, BG, LINE, 7);
    g.fillStyle = c2; g.fillRect(lx - W / 2, ly - H / 2 + 7, 3, H - 7);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = tf(big ? 15 : 13); g.fillStyle = '#ffffff'; g.fillText(label, lx + 1, ly - 7);
    g.font = tf(13); g.fillStyle = ACC; g.fillText(d, lx + 1, ly + 10);
  }

  minimap(g) {
    const run = this.run, p = run.p, R = 44, cx = this.vw - R - 12, cy = 158, range = 900, t = this.gfx.t;
    const mp = (x, y) => [cx + (x - p.x) / range * R, cy + (y - p.y) / range * R];
    // mini-carte carrée : fond sombre, filet d'un pixel, coins en équerre
    g.save();
    g.fillStyle = 'rgba(10,13,20,.72)'; g.fillRect(cx - R, cy - R, R * 2, R * 2);
    g.strokeStyle = LINE; g.lineWidth = 1; g.strokeRect(cx - R + 0.5, cy - R + 0.5, R * 2 - 1, R * 2 - 1);
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1.5; g.beginPath();
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const x0 = cx + sx * R, y0 = cy + sy * R; g.moveTo(x0, y0 - sy * 7); g.lineTo(x0, y0); g.lineTo(x0 - sx * 7, y0); }
    g.stroke();
    g.beginPath(); g.rect(cx - R + 1, cy - R + 1, R * 2 - 2, R * 2 - 2);
    g.clip();
    const dot = (x, y, c, r) => { const [mx, my] = mp(x, y); g.fillStyle = c; g.beginPath(); g.arc(mx, my, r, 0, TAU); g.fill(); };
    g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 1;
    g.strokeRect(cx + (-HALF - p.x) / range * R, cy + (-HALF - p.y) / range * R, HALF * 2 / range * R, HALF * 2 / range * R);
    if (run.arena) { const [mx, my] = mp(run.arena.x, run.arena.y); g.strokeStyle = 'rgba(255,70,50,.9)'; g.lineWidth = 2; g.beginPath(); g.arc(mx, my, run.arena.R / range * R, 0, TAU); g.stroke(); }
    for (const e of run.enemies) if (!e.boss && !e.dead && Math.abs(e.x - p.x) < range && Math.abs(e.y - p.y) < range) dot(e.x, e.y, e.elite ? '#d08aff' : e.mad ? 'rgba(255,60,40,.85)' : 'rgba(255,90,90,.6)', e.elite ? 2.4 : 1.3);
    for (const ch of run.chests) if (!ch.open) dot(ch.x, ch.y, '#ffc83a', 3);
    for (const ch of run.dropChests) if (!ch.open) dot(ch.x, ch.y, '#d08aff', 3.2);
    for (const sh of run.shrines) if (!sh.used) dot(sh.x, sh.y, '#4fd0ff', 3.2);
    for (const it of run.pickups) if (it.type === 'loot' && Math.abs(it.x - p.x) < range && Math.abs(it.y - p.y) < range) { const [mx, my] = mp(it.x, it.y); g.fillStyle = INK; g.fillRect(mx - 3, my - 3, 6, 6); g.fillStyle = LOOT_GLOW[it.tier] || '#fff'; g.fillRect(mx - 2, my - 2, 4, 4); }
    for (const T0 of run.totems || []) {
      const [mx, my] = mp(T0.x, T0.y);
      g.fillStyle = INK; g.beginPath(); g.moveTo(mx, my - 5); g.lineTo(mx + 4.5, my); g.lineTo(mx, my + 5); g.lineTo(mx - 4.5, my); g.closePath(); g.fill();
      g.fillStyle = T0.used ? '#6a6a7a' : TOTEMS[T0.kind]?.color || '#fff'; g.beginPath(); g.moveTo(mx, my - 3.5); g.lineTo(mx + 3, my); g.lineTo(mx, my + 3.5); g.lineTo(mx - 3, my); g.closePath(); g.fill();
    }
    if (run.boss && !run.boss.dead) dot(run.boss.x, run.boss.y, '#ff2a4a', 4.5);
    g.restore();
    // autel et portail : toujours visibles, collés au bord quand ils sont loin
    const pinned = (x, y) => { let [mx, my] = mp(x, y); const dx = mx - cx, dy = my - cy, m = Math.max(Math.abs(dx), Math.abs(dy)); if (m > R - 6) { mx = cx + dx / m * (R - 6); my = cy + dy / m * (R - 6); } return [mx, my]; };
    if (run.altar && !run.altar.used && !run.arena) {
      const [mx, my] = pinned(run.altar.x, run.altar.y);
      g.fillStyle = INK; g.beginPath(); g.arc(mx, my, 7, 0, TAU); g.fill();
      g.fillStyle = '#e8283a'; g.beginPath(); g.arc(mx, my, 5.6, 0, TAU); g.fill();
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(mx, my - 0.8, 3, 0, TAU); g.fill(); g.fillRect(mx - 1.8, my + 1, 3.6, 2.2);
      g.fillStyle = '#e8283a'; g.fillRect(mx - 1.6, my - 1.4, 1.2, 1.4); g.fillRect(mx + 0.4, my - 1.4, 1.2, 1.4);
    }
    if (run.portal) {
      const [mx, my] = pinned(run.portal.x, run.portal.y), k = (t * 1.2) % 1;
      g.strokeStyle = `rgba(190,140,255,${1 - k})`; g.lineWidth = 2; g.beginPath(); g.arc(mx, my, 6 + k * 10, 0, TAU); g.stroke();
      g.fillStyle = INK; g.beginPath(); g.arc(mx, my, 7.5, 0, TAU); g.fill();
      const gr = g.createRadialGradient(mx, my, 0, mx, my, 6); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.45, '#7ae8ff'); gr.addColorStop(1, '#8a3aff');
      g.fillStyle = gr; g.beginPath(); g.arc(mx, my, 6, 0, TAU); g.fill();
    }
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(cx, cy, 3.2, 0, TAU); g.fill();
    g.strokeStyle = INK; g.lineWidth = 1.2; g.stroke();
  }

  // coffre de butin ramassé : une étoile de sa couleur file vers son compteur en haut de l'écran
  flyLootUi(g) {
    if (!this.flyLoot.length) return;
    const el = this._lootEl && this._lootEl.isConnected ? this._lootEl : (this._lootEl = document.getElementById('lootPill'));
    let tx = 40, ty = 70;
    if (el) { const r = el.getBoundingClientRect(), c = this.cv.getBoundingClientRect(); if (r.width) { tx = r.left - c.left + r.width * 0.3; ty = r.top - c.top + r.height / 2; } }
    for (const f of this.flyLoot) {
      f.t += this.dt;
      const k = clamp(f.t / 0.7, 0, 1), e = k * k * (3 - 2 * k), c = LOOT_GLOW[f.tier] || '#ffffff';
      g.globalCompositeOperation = 'lighter';
      if (k < 1) {
        const x = f.x + (tx - f.x) * e, y = f.y + (ty - f.y) * e - Math.sin(k * Math.PI) * 90, s = 1.7 - k * 0.9;
        g.drawImage(glowTex(c), x - 26 * s, y - 26 * s, 52 * s, 52 * s);
        g.globalCompositeOperation = 'source-over';
        chestIcon(g, x, y, 15 * s, f.tier, Math.sin(k * 12) * 0.18);
      } else {
        const q = clamp((f.t - 0.7) / 0.3, 0, 1);
        g.globalAlpha = 1 - q; g.drawImage(glowTex(c), tx - 20 - q * 20, ty - 20 - q * 20, 40 + q * 40, 40 + q * 40);
        g.globalAlpha = 1;
      }
      g.globalCompositeOperation = 'source-over';
    }
    let k = 0;
    for (const f of this.flyLoot) if (f.t < 1) this.flyLoot[k++] = f;
    this.flyLoot.length = k;
  }

  dispose() { try { this.g.setTransform(1, 0, 0, 1, 0, 0); this.g.clearRect(0, 0, this.cv.width, this.cv.height); } catch (e) { /* rien */ } }
}

// petit coffre dessiné (animation du butin ramassé)
const CHEST_C = [['#a8682e', '#5a4a3a'], ['#b8c8e0', '#e8f0ff'], ['#e8b020', '#fff0a0'], ['#c040c8', '#ffb0f0']];
function chestIcon(g, x, y, s, tier, rot) {
  const [b, band] = CHEST_C[clamp(tier | 0, 0, 3)];
  g.save(); g.translate(x, y); g.rotate(rot);
  g.lineJoin = 'round'; g.lineWidth = s * 0.22; g.strokeStyle = INK;
  rr(g, -s, -s * 0.3, s * 2, s * 1.1, s * 0.2); g.fillStyle = b; g.fill(); g.stroke();
  g.beginPath(); g.moveTo(-s, -s * 0.3); g.quadraticCurveTo(-s, -s * 1.05, 0, -s * 1.05); g.quadraticCurveTo(s, -s * 1.05, s, -s * 0.3); g.closePath(); g.fillStyle = shadeHex(b, 0.2); g.fill(); g.stroke();
  g.fillStyle = band; g.fillRect(-s * 0.2, -s * 1.0, s * 0.4, s * 1.8);
  g.restore();
}

function rr(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
// barre fine et carrée (vie du héros, des élites) : fond sombre, remplissage plein, reflet d'un pixel
function rbar(g, x, y, w, h, k, c) {
  g.fillStyle = 'rgba(6,8,13,.82)'; g.fillRect(x - 1.5, y - 1.5, w + 3, h + 3);
  if (k > 0) { g.fillStyle = c; g.fillRect(x, y, w * k, h); g.fillStyle = 'rgba(255,255,255,.3)'; g.fillRect(x, y, w * k, 1); }
}
// panneau à angles coupés (haut gauche, bas droit) avec filet d'un pixel, comme l'interface
function chamfer(g, x, y, w, h, c) {
  g.beginPath(); g.moveTo(x + c, y); g.lineTo(x + w, y); g.lineTo(x + w, y + h - c); g.lineTo(x + w - c, y + h); g.lineTo(x, y + h); g.lineTo(x, y + c); g.closePath();
}
function panel(g, x, y, w, h, fill, edge, c = 6) {
  chamfer(g, x, y, w, h, c); g.fillStyle = fill; g.fill();
  if (edge) { g.lineWidth = 1; g.strokeStyle = edge; chamfer(g, x + 0.5, y + 0.5, w - 1, h - 1, c); g.stroke(); }
}
