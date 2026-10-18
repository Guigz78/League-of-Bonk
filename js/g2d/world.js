// Monde 2D vu de dessus : sol peint par morceaux (cuits à la demande), chemins / rivières / lacs,
// décor en relief (arbres, rochers…) trié en profondeur avec les personnages, lumières d'ambiance.
import { HALF } from '../data.js';
import { rng, shade } from '../pixel.js';
import { bake, P, ell, rrect, poly, fillShaded, glowDot, cnv, OUT } from './sprites.js';

const TAU = Math.PI * 2;
const CH = 512;      // taille d'un morceau de sol (unités du monde)
const CELL = 128;    // cellule de petits détails au sol
const PCELL = 256;   // cellule de décor en relief

// ---------- Thèmes ----------
export const THEMES = {
  lane: {
    g0: '#5d9a48', g1: '#4f8a3e', g2: '#78b45a', tuft: '#3d7430', tuft2: '#93cf68', edge: '#1f3a1a',
    path: '#cdb07a', path2: '#a88a58', flowers: ['#ffe45a', '#ff8ab0', '#ffffff', '#9ad0ff'],
    tree: 'round', leaf: ['#4a9a3e', '#2f6e2c', '#7cc85e'], trunk: '#7a5030', rock: ['#a9abbb', '#77798e', '#d6d8e2'],
    props: [['tree', 3], ['bush', 3], ['rock', 2], ['ruin', 0.5]], ambient: 'leaf', dark: 0,
  },
  jungle: {
    g0: '#3f7c36', g1: '#33692c', g2: '#58a04a', tuft: '#285a22', tuft2: '#72be55', edge: '#122a10',
    path: '#8a6a44', path2: '#6a5034', flowers: ['#ff5a7a', '#ffd04a', '#c06aff'],
    tree: 'jungle', leaf: ['#2f8a40', '#1c5a2a', '#62b852'], trunk: '#6a4426', rock: ['#8a9a7a', '#5e6c52', '#b8c8a0'],
    props: [['tree', 4], ['bush', 3], ['mushroom', 1.4], ['rock', 1]], ambient: 'firefly', dark: 0.12,
  },
  river: {
    g0: '#7cbc62', g1: '#6aa854', g2: '#98d076', tuft: '#4e8a40', tuft2: '#b0e08a', edge: '#2a5a6a',
    water: '#3a9ad8', water2: '#2a78b8', foam: '#d8f6ff', sand: '#ead79c', flowers: ['#ffffff', '#ffe45a'],
    tree: 'palm', leaf: ['#4aa04a', '#2e7034', '#86d064'], trunk: '#a07848', rock: ['#b0a898', '#7e7668', '#dcd4c4'],
    props: [['tree', 2.4], ['reeds', 2.4], ['rock', 2], ['bush', 1.4]], ambient: 'bubble', dark: 0,
  },
  ice: {
    g0: '#d6e6f4', g1: '#c2d6ea', g2: '#f2f8ff', tuft: '#a8c2dc', tuft2: '#ffffff', edge: '#5a7a9a',
    ice: '#a8dcf5', ice2: '#7ac0e8', flowers: ['#9ad8ff', '#ffffff'],
    tree: 'pine', leaf: ['#3e8072', '#285a52', '#62a890'], trunk: '#6a4a36', rock: ['#9ab0c8', '#6a809a', '#d6e4f2'],
    props: [['tree', 3], ['rock', 2], ['icecrystal', 1.6], ['bush', 0.6]], ambient: 'snow', dark: 0,
  },
  shadow: {
    g0: '#2c4c46', g1: '#22403a', g2: '#3c625a', tuft: '#1a302c', tuft2: '#4e8070', edge: '#081412',
    path: '#4a5a58', path2: '#3a4846', mist: '#5ae8b8', flowers: ['#5ae8b8', '#a0fff0'],
    tree: 'dead', leaf: ['#3e3e4a', '#26262e', '#5e5e6c'], trunk: '#3e3e4a', rock: ['#5e6c6a', '#3e4a48', '#8a9a98'],
    props: [['tree', 3], ['grave', 2.4], ['lantern', 1], ['rock', 1.4]], ambient: 'mist', dark: 0.5,
  },
  void: {
    g0: '#311a4c', g1: '#26123c', g2: '#43266a', tuft: '#1c0c2e', tuft2: '#6a3ea0', edge: '#06020c',
    crack: '#e070ff', flowers: ['#e070ff', '#7ad0ff'],
    tree: 'crystal', leaf: ['#b05aff', '#7428c8', '#f0b8ff'], trunk: '#2a1440', rock: ['#4a3a6a', '#2e2244', '#7a6aa0'],
    props: [['tree', 2.4], ['tentacle', 1.6], ['rock', 2], ['vcrystal', 1.2]], ambient: 'void', dark: 0.55,
  },
};

// ---------- Décor en relief ----------
function canopy(g, blobs, C, hl = true) {
  const p = P();
  for (const [x, y, r] of blobs) p.ellipse(x, y, r, r * 0.92, 0, 0, TAU);
  fillShaded(g, p, C[0], { dark: C[1], light: C[2], off: 5, line: 0 });
  if (hl) {
    g.save(); g.clip(p); g.fillStyle = C[2]; g.globalAlpha = 0.75;
    for (const [x, y, r] of blobs) g.fill(ell(x - r * 0.3, y - r * 0.42, r * 0.42, r * 0.26, -0.3));
    g.restore();
  }
  g.save(); g.clip(p);
  g.lineWidth = 1.2; g.strokeStyle = shade(C[1], -0.25);
  for (const [x, y, r] of blobs.slice(1)) { g.beginPath(); g.arc(x, y, r * 0.95, 0.4, 1.7); g.stroke(); }
  g.restore();
}

const PROP_DRAW = {
  tree(g, T, r) {
    const C = T.leaf;
    if (T.tree === 'pine') {
      fillShaded(g, rrect(-4, -16, 8, 16, 2), T.trunk, { off: 1 });
      for (let i = 0; i < 3; i++) {
        const y = -14 - i * 20, w = 34 - i * 8;
        const tri = poly([[-w, y], [0, y - 34], [w, y]]);
        fillShaded(g, tri, C[0], { dark: C[1], light: C[2], off: 4, line: 1, hl: { x: -w * 0.35, y: y - 12, rx: w * 0.25, ry: 6, rot: -0.9, a: 0.5 } });
        const snow = P(); snow.moveTo(-w * 0.55, y - 15); snow.lineTo(0, y - 34); snow.lineTo(w * 0.55, y - 15);
        snow.quadraticCurveTo(w * 0.25, y - 20, 0, y - 14); snow.quadraticCurveTo(-w * 0.25, y - 20, -w * 0.55, y - 15); snow.closePath();
        fillShaded(g, snow, '#ffffff', { dark: '#cfe2f2', off: 1, line: 0.8 });
      }
      return { h: 98, w: 70 };
    }
    if (T.tree === 'dead') {
      g.strokeStyle = OUT; g.lineWidth = 11; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-4, -30, 2, -52); g.stroke();
      g.strokeStyle = T.trunk; g.lineWidth = 8; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-4, -30, 2, -52); g.stroke();
      const br = [[0, -30, -24, -50], [1, -40, 22, -62], [2, -50, -10, -78], [-12, -42, -28, -44], [12, -52, 26, -54]];
      for (const [x0, y0, x1, y1] of br) {
        g.strokeStyle = OUT; g.lineWidth = 6; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2, y1 + 6, x1, y1); g.stroke();
        g.strokeStyle = T.leaf[2]; g.lineWidth = 3.4; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2, y1 + 6, x1, y1); g.stroke();
      }
      return { h: 80, w: 56 };
    }
    if (T.tree === 'crystal') {
      for (const [x, h, w, a] of [[-12, 46, 9, -0.25], [12, 40, 8, 0.3], [0, 70, 12, 0], [6, 28, 6, 0.6]]) {
        g.save(); g.translate(x, -4); g.rotate(a);
        const cr = poly([[-w, 0], [-w, -h * 0.8], [0, -h], [w, -h * 0.8], [w, 0]]);
        fillShaded(g, cr, C[0], { dark: C[1], light: C[2], off: 3, line: 1, hl: { x: -w * 0.45, y: -h * 0.5, rx: w * 0.25, ry: h * 0.3, a: 0.7 } });
        g.restore();
      }
      return { h: 74, w: 50, light: { y: -40, r: 70, c: '#c070ff' } };
    }
    if (T.tree === 'palm') {
      g.strokeStyle = OUT; g.lineWidth = 10; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(10, -36, -2, -70); g.stroke();
      g.strokeStyle = T.trunk; g.lineWidth = 7; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(10, -36, -2, -70); g.stroke();
      g.strokeStyle = shade(T.trunk, -0.3); g.lineWidth = 1.2;
      for (let i = 1; i < 7; i++) { const t = i / 7, x = 2 * (1 - t) * t * 10 + t * t * -2, y = -70 * t; g.beginPath(); g.moveTo(x - 3.4, y); g.lineTo(x + 3.4, y - 1.5); g.stroke(); }
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + (i - 2.5) * 0.62;
        g.save(); g.translate(-2, -70); g.rotate(a + Math.PI / 2);
        const fr = P(); fr.moveTo(0, 0); fr.quadraticCurveTo(14, -10, 30, 6); fr.quadraticCurveTo(14, 2, 0, 0); fr.closePath();
        fillShaded(g, fr, C[0], { dark: C[1], light: C[2], off: 1.4, line: 1 });
        g.restore();
      }
      fillShaded(g, ell(0, -68, 4, 4), '#7a5030', { off: 0.6, line: 0.9 });
      return { h: 92, w: 70 };
    }
    // arbre rond (ou touffu de la jungle)
    const big = T.tree === 'jungle';
    fillShaded(g, rrect(-6, -26, 12, 26, 3), T.trunk, { off: 1.4, hl: { x: -3, y: -16, rx: 1.4, ry: 6, a: 0.4 } });
    const s = big ? 1.25 : 1;
    const blobs = [[0, -48 * s, 24 * s], [-17 * s, -38 * s, 17 * s], [17 * s, -38 * s, 17 * s], [-8 * s, -62 * s, 16 * s], [10 * s, -60 * s, 15 * s]];
    canopy(g, blobs, C);
    if (big) {
      g.strokeStyle = '#2a6a2a'; g.lineWidth = 2.2;
      for (const x of [-18, -4, 14]) { g.beginPath(); g.moveTo(x, -34); g.quadraticCurveTo(x + 3, -20, x - 1, -12 - r() * 8); g.stroke(); }
    } else if (r() < 0.5) {
      g.fillStyle = '#ff5a5a'; for (let i = 0; i < 4; i++) { const p = ell(-14 + r() * 28, -60 + r() * 26, 2.4, 2.4); g.fill(p); g.lineWidth = 0.8; g.strokeStyle = OUT; g.stroke(p); }
    }
    return { h: big ? 100 : 86, w: big ? 84 : 70 };
  },
  bush(g, T, r) {
    const C = T.tree === 'pine' ? ['#e8f2fa', '#b8cce0', '#ffffff'] : T.tree === 'dead' || T.tree === 'crystal' ? [shade(T.g1, 0.12), shade(T.g1, -0.25), shade(T.g1, 0.35)] : [shade(T.leaf[0], 0.05), T.leaf[1], T.leaf[2]];
    canopy(g, [[0, -12, 13], [-12, -8, 9], [12, -8, 9]], C);
    if (r() < 0.5 && T.flowers) { g.fillStyle = T.flowers[(r() * T.flowers.length) | 0]; for (let i = 0; i < 4; i++) g.fill(ell(-12 + r() * 24, -16 + r() * 10, 1.8, 1.8)); }
    return { h: 26, w: 42 };
  },
  rock(g, T, r) {
    const j = () => (r() - 0.5) * 5;
    const rk = poly([[-17, 0], [-19 + j(), -10], [-10, -20 + j()], [4 + j(), -23], [16, -15 + j()], [18, -2], [0, 2]]);
    fillShaded(g, rk, T.rock[0], { dark: T.rock[1], light: T.rock[2], off: 3.4, line: 1, hl: { x: -5, y: -16, rx: 6, ry: 2.6, rot: -0.3, a: 0.7 } });
    if (T.tree === 'pine') fillShaded(g, poly([[-10, -19], [4, -23], [16, -15], [6, -16], [-2, -14]]), '#ffffff', { dark: '#d0e2f2', off: 0.6, line: 0.8 });
    else if (T.tree === 'jungle' || T.tree === 'round') { g.fillStyle = '#6fae3a'; g.globalAlpha = 0.8; g.fill(ell(-4, -20, 6, 2.2, -0.2)); g.globalAlpha = 1; }
    else if (T.tree === 'crystal') glowDot(g, 4, -12, 2.4, '#e070ff');
    return { h: 24, w: 40 };
  },
  ruin(g, T) {
    fillShaded(g, rrect(-14, -50, 28, 50, 4), '#b8b4c8', { dark: '#7a7690', light: '#e6e2f2', off: 3, hl: { x: -7, y: -30, rx: 3, ry: 14, a: 0.5 } });
    g.strokeStyle = '#7a7690'; g.lineWidth = 1.2;
    for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(-14, -50 + i * 12); g.lineTo(14, -50 + i * 12); g.stroke(); }
    fillShaded(g, poly([[-16, -50], [-10, -58], [-2, -52], [6, -60], [16, -50]]), '#9a96b0', { off: 1, line: 1 });
    const cr = poly([[0, -86], [7, -74], [0, -62], [-7, -74]]);
    fillShaded(g, cr, '#5ab8ff', { dark: '#2a78d8', light: '#d8f4ff', off: 1.4, line: 1, hl: { x: -2, y: -78, rx: 1.6, ry: 4, a: 0.9 } });
    return { h: 88, w: 36, light: { y: -74, r: 60, c: '#5ab8ff' } };
  },
  mushroom(g, T, r) {
    fillShaded(g, rrect(-5, -22, 10, 22, 4), '#f4ead0', { dark: '#c8b898', off: 1.2 });
    const cap = P(); cap.moveTo(-20, -18); cap.bezierCurveTo(-20, -44, 20, -44, 20, -18); cap.quadraticCurveTo(0, -12, -20, -18); cap.closePath();
    fillShaded(g, cap, '#e04a3a', { dark: '#a02a2a', light: '#ff9a7a', off: 3, line: 1, hl: { x: -8, y: -32, rx: 6, ry: 3, rot: -0.4, a: 0.6 } });
    g.fillStyle = '#ffffff'; for (const [x, y, s] of [[-10, -26, 3], [3, -34, 3.4], [11, -24, 2.4], [-2, -23, 1.8]]) { const p = ell(x, y, s, s * 0.8); g.fill(p); g.lineWidth = 0.7; g.strokeStyle = OUT; g.stroke(p); }
    return { h: 42, w: 42 };
  },
  reeds(g, T, r) {
    for (let i = 0; i < 5; i++) {
      const x = -10 + i * 5 + (r() - 0.5) * 3, h = 26 + r() * 18, bend = (r() - 0.5) * 8;
      g.strokeStyle = OUT; g.lineWidth = 3.4; g.beginPath(); g.moveTo(x, 0); g.quadraticCurveTo(x + bend, -h / 2, x + bend * 1.5, -h); g.stroke();
      g.strokeStyle = '#5a9a3a'; g.lineWidth = 1.8; g.beginPath(); g.moveTo(x, 0); g.quadraticCurveTo(x + bend, -h / 2, x + bend * 1.5, -h); g.stroke();
      if (i % 2 === 0) fillShaded(g, rrect(x + bend * 1.5 - 2.2, -h - 8, 4.4, 10, 2.2), '#8a5a2a', { off: 0.6, line: 0.9 });
    }
    return { h: 46, w: 34 };
  },
  icecrystal(g, T) {
    for (const [x, h, w, a] of [[-8, 30, 6, -0.35], [8, 26, 5.5, 0.35], [0, 42, 8, 0]]) {
      g.save(); g.translate(x, -2); g.rotate(a);
      fillShaded(g, poly([[-w, 0], [-w, -h * 0.75], [0, -h], [w, -h * 0.75], [w, 0]]), '#bfe8ff', { dark: '#7ac0e8', light: '#ffffff', off: 2, line: 1, hl: { x: -w * 0.4, y: -h * 0.5, rx: w * 0.25, ry: h * 0.3, a: 0.9 } });
      g.restore();
    }
    return { h: 44, w: 36, light: { y: -20, r: 36, c: '#9ad8ff', a: 0.25 } };
  },
  grave(g, T, r) {
    const cross = r() < 0.4;
    if (cross) {
      fillShaded(g, rrect(-3.5, -40, 7, 40, 1.6), '#8a9a98', { dark: '#5a6a68', light: '#c0d0ce', off: 1.4 });
      fillShaded(g, rrect(-13, -32, 26, 7, 1.6), '#8a9a98', { dark: '#5a6a68', light: '#c0d0ce', off: 1.4 });
    } else {
      const st = P(); st.moveTo(-12, 0); st.lineTo(-12, -24); st.arc(0, -24, 12, Math.PI, 0); st.lineTo(12, 0); st.closePath();
      fillShaded(g, st, '#8a9a98', { dark: '#5a6a68', light: '#c0d0ce', off: 2.4, line: 1, hl: { x: -5, y: -28, rx: 3, ry: 6, a: 0.5 } });
      g.strokeStyle = '#4a5a58'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-5, -24); g.lineTo(5, -24); g.moveTo(-5, -18); g.lineTo(4, -18); g.stroke();
    }
    fillShaded(g, ell(0, -1, 15, 4), '#3a4a40', { off: 0.6, line: 0.8 });
    return { h: 40, w: 32 };
  },
  lantern(g) {
    g.strokeStyle = OUT; g.lineWidth = 5; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -48); g.lineTo(10, -50); g.stroke();
    g.strokeStyle = '#4a4a5a'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -48); g.lineTo(10, -50); g.stroke();
    fillShaded(g, rrect(5, -48, 10, 13, 3), '#2a3a38', { off: 0.6, line: 1 });
    glowDot(g, 10, -41, 3.6, '#5ae8b8');
    return { h: 52, w: 24, light: { x: 10, y: -41, r: 80, c: '#5ae8b8' } };
  },
  tentacle(g, T, r) {
    const sd = r() < 0.5 ? 1 : -1;
    const tp = P(); tp.moveTo(-9, 0); tp.bezierCurveTo(-12, -24, sd * 18, -30, sd * 8, -58); tp.bezierCurveTo(sd * 24, -34, 6, -18, 9, 0); tp.closePath();
    fillShaded(g, tp, '#9a3ad8', { dark: '#5a1a8a', light: '#e0a0ff', off: 2.6, line: 1, hl: { x: -4, y: -22, rx: 2, ry: 8, a: 0.5 } });
    g.fillStyle = '#ffc0f0'; for (let i = 0; i < 4; i++) g.fill(ell(2 + sd * i * 1.6, -8 - i * 11, 2, 1.6));
    return { h: 60, w: 34 };
  },
  vcrystal(g) {
    for (const [x, h, w, a] of [[-6, 26, 6, -0.4], [6, 22, 5, 0.4], [0, 34, 7, 0]]) {
      g.save(); g.translate(x, -2); g.rotate(a);
      fillShaded(g, poly([[-w, 0], [-w, -h * 0.75], [0, -h], [w, -h * 0.75], [w, 0]]), '#ff6ad8', { dark: '#a02a98', light: '#ffd0f4', off: 2, line: 1, hl: { x: -w * 0.4, y: -h * 0.5, rx: w * 0.25, ry: h * 0.3, a: 0.9 } });
      g.restore();
    }
    return { h: 36, w: 30, light: { y: -18, r: 56, c: '#ff6ad8' } };
  },
};

// ---------- Monde ----------
export class World2D {
  constructor(zone, res, avoid = []) {
    this.zone = zone;
    this.T = THEMES[zone.bg] || THEMES.lane;
    this.res = res;
    this.gres = Math.min(res, 1.6);
    this.r = rng('w2d' + zone.id);
    this.avoid = avoid;
    this.chunks = new Map();
    this.tick = 0;
    this.pcells = new Map();
    this.features = this.makeFeatures();
    this.propSpr = {};
    const r = rng('props' + zone.id);
    for (const [kind] of this.T.props) {
      this.propSpr[kind] = [0, 1, 2].map(v => {
        let meta = { h: 40, w: 40 };
        const pr = rng('prop' + zone.id + kind + v);
        const spr = bake(120, 130, 60, 116, res, g => { meta = PROP_DRAW[kind](g, this.T, pr) || meta; }, { outline: 2.2 });
        spr.meta = meta;
        return spr;
      });
    }
    this.r2 = r;
  }

  // chemins, rivières, lacs… (coordonnées du monde), identiques d'une partie à l'autre
  makeFeatures() {
    const r = this.r, bg = this.zone.bg, f = { lines: [], blobs: [] };
    const wobbly = (x0, y0, x1, y1, amp, n = 24) => {
      const pts = [], ph = r() * TAU, ph2 = r() * TAU;
      const nx = -(y1 - y0), ny = x1 - x0, l = Math.hypot(nx, ny);
      for (let i = 0; i <= n; i++) {
        const t = i / n, w = Math.sin(t * 5 + ph) * amp + Math.sin(t * 11 + ph2) * amp * 0.35;
        pts.push([x0 + (x1 - x0) * t + nx / l * w, y0 + (y1 - y0) * t + ny / l * w]);
      }
      return pts;
    };
    const E = HALF + 200;
    if (bg === 'lane') {
      f.lines.push({ pts: [[-E, E], [0, 0], [E, -E]], w: 120, kind: 'path' });
      f.lines.push({ pts: wobbly(-E, -E * 0.3, E, E * 0.25, 90), w: 80, kind: 'path' });
    } else if (bg === 'jungle') {
      f.lines.push({ pts: wobbly(-E, -200, E, 300, 220), w: 70, kind: 'path' });
      f.lines.push({ pts: wobbly(-300, -E, 200, E, 260), w: 64, kind: 'path' });
    } else if (bg === 'river') {
      f.lines.push({ pts: wobbly(-E, -500, E, -300, 260), w: 150, kind: 'water' });
      f.lines.push({ pts: wobbly(-600, E, 500, -E, 200), w: 110, kind: 'water' });
    } else if (bg === 'ice') {
      for (let i = 0; i < 9; i++) { const a = r() * TAU, d = 380 + r() * 1000; f.blobs.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, rx: 120 + r() * 160, ry: 80 + r() * 110, rot: r() * 3, kind: 'ice' }); }
    } else if (bg === 'shadow') {
      f.lines.push({ pts: wobbly(-E, E * 0.2, E, -E * 0.1, 200), w: 60, kind: 'stones' });
      for (let i = 0; i < 10; i++) { const a = r() * TAU, d = 350 + r() * 1100; f.blobs.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, rx: 90 + r() * 120, ry: 60 + r() * 80, rot: r() * 3, kind: 'mist' }); }
    } else if (bg === 'void') {
      for (let i = 0; i < 7; i++) {
        const a = r() * TAU, d = 200 + r() * 1200, x0 = Math.cos(a) * d, y0 = Math.sin(a) * d, pts = [[x0, y0]];
        let x = x0, y = y0, dir = r() * TAU;
        for (let k = 0; k < 14; k++) { dir += (r() - 0.5) * 1.4; x += Math.cos(dir) * 60; y += Math.sin(dir) * 60; pts.push([x, y]); }
        f.lines.push({ pts, w: 8, kind: 'crack' });
      }
    }
    return f;
  }

  // distance au chemin / à l'eau le plus proche (pour ne pas planter d'arbre dans la rivière)
  onFeature(x, y, pad = 0) {
    for (const L of this.features.lines) {
      if (L.kind === 'crack') continue;
      const p = L.pts;
      for (let i = 1; i < p.length; i++) {
        const [ax, ay] = p[i - 1], [bx, by] = p[i];
        const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2));
        if (Math.hypot(x - ax - dx * t, y - ay - dy * t) < L.w / 2 + pad) return L;
      }
    }
    for (const b of this.features.blobs) {
      if (b.kind !== 'ice') continue;
      const c = Math.cos(-b.rot), s = Math.sin(-b.rot), lx = (x - b.x) * c - (y - b.y) * s, ly = (x - b.x) * s + (y - b.y) * c;
      if ((lx / (b.rx + pad)) ** 2 + (ly / (b.ry + pad)) ** 2 < 1) return b;
    }
    return null;
  }

  // ---------- Sol ----------
  chunk(cx, cy) {
    const key = cx + ',' + cy;
    let c = this.chunks.get(key);
    if (c) { c.used = this.tick; return c; }
    return null;
  }

  bakeChunk(cx, cy) {
    const key = cx + ',' + cy, res = this.gres, T = this.T;
    const c = cnv(CH * res, CH * res), g = c.getContext('2d');
    const x0 = cx * CH, y0 = cy * CH;
    g.setTransform(res, 0, 0, res, -x0 * res, -y0 * res);
    g.lineJoin = 'round'; g.lineCap = 'round';
    g.fillStyle = T.g0; g.fillRect(x0, y0, CH, CH);
    const cells = (size, fn) => {
      const m = 130;
      for (let gx = Math.floor((x0 - m) / size); gx <= Math.floor((x0 + CH + m) / size); gx++)
        for (let gy = Math.floor((y0 - m) / size); gy <= Math.floor((y0 + CH + m) / size); gy++) fn(rng(`c${this.zone.id}:${size}:${gx}:${gy}`), gx * size, gy * size);
    };
    // grandes taches de couleur douces
    cells(CELL, (r, x, y) => {
      const px = x + r() * CELL, py = y + r() * CELL, rad = 50 + r() * 90, col = r() < 0.5 ? T.g1 : T.g2;
      const gr = g.createRadialGradient(px, py, 0, px, py, rad);
      gr.addColorStop(0, col + 'b0'); gr.addColorStop(1, col + '00');
      g.fillStyle = gr; g.fillRect(px - rad, py - rad, rad * 2, rad * 2);
    });
    this.drawFeatures(g);
    // brins d'herbe, fleurs, cailloux
    cells(CELL, (r, x, y) => {
      const n = 7 + (r() * 6 | 0);
      for (let i = 0; i < n; i++) {
        const px = x + r() * CELL, py = y + r() * CELL;
        if (this.onFeature(px, py, -6)) continue;
        const k = r();
        if (k < 0.72) { // touffe d'herbe : 3 brins courbes
          const s = 3.5 + r() * 4, lean = (r() - 0.5) * 2;
          g.fillStyle = r() < 0.65 ? T.tuft : T.tuft2;
          g.beginPath();
          for (const [dx, h] of [[-1, 0.75], [0.2, 1.15], [1.2, 0.8]]) {
            g.moveTo(px + dx * 1.6 - 0.9, py); g.quadraticCurveTo(px + dx * s * 0.35, py - h * s * 0.6, px + dx * s * 0.55 + lean, py - h * s);
            g.quadraticCurveTo(px + dx * s * 0.25 + 0.6, py - h * s * 0.5, px + dx * 1.6 + 0.9, py); g.closePath();
          }
          g.fill();
        } else if (k < 0.86 && T.flowers) {
          const col = T.flowers[(r() * T.flowers.length) | 0];
          if (T === THEMES.void || T === THEMES.shadow) { g.fillStyle = col; g.globalAlpha = 0.8; g.fill(ell(px, py, 1.6, 1.6)); g.globalAlpha = 1; continue; }
          g.fillStyle = col;
          for (let a = 0; a < 5; a++) g.fill(ell(px + Math.cos(a * 1.256) * 2.2, py + Math.sin(a * 1.256) * 2.2, 1.7, 1.7));
          g.fillStyle = '#ffd040'; g.fill(ell(px, py, 1.2, 1.2));
        } else {
          const s = 2 + r() * 3.4;
          g.fillStyle = shade(T.rock[1], -0.1); g.fill(ell(px + 0.6, py + 0.8, s, s * 0.7));
          g.fillStyle = T.rock[0]; g.fill(ell(px, py, s, s * 0.7));
          g.fillStyle = T.rock[2]; g.fill(ell(px - s * 0.3, py - s * 0.25, s * 0.4, s * 0.25));
        }
      }
    });
    // bord de la carte : falaise sombre
    const B = HALF - 30;
    g.fillStyle = T.edge;
    if (x0 < -B) g.fillRect(x0, y0, -B - x0, CH);
    if (x0 + CH > B) g.fillRect(B, y0, x0 + CH - B, CH);
    if (y0 < -B) g.fillRect(x0, y0, CH, -B - y0);
    if (y0 + CH > B) g.fillRect(x0, B, CH, y0 + CH - B);
    g.strokeStyle = shade(T.edge, 0.25); g.lineWidth = 10; g.strokeRect(-B - 5, -B - 5, B * 2 + 10, B * 2 + 10);
    g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 18; g.strokeRect(-B + 9, -B + 9, B * 2 - 18, B * 2 - 18);
    c.used = this.tick;
    this.chunks.set(key, c);
    if (this.chunks.size > 22) { // on oublie le morceau le moins récemment vu
      let old = null, ou = Infinity;
      for (const [k, v] of this.chunks) if (v.used < ou) { ou = v.used; old = k; }
      this.chunks.delete(old);
    }
    return c;
  }

  drawFeatures(g) {
    const T = this.T, F = this.features;
    const stroke = (pts, w, col) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); };
    for (const b of F.blobs) {
      g.save(); g.translate(b.x, b.y); g.rotate(b.rot);
      if (b.kind === 'ice') {
        g.fillStyle = '#ffffff'; g.fill(ell(0, 0, b.rx + 10, b.ry + 10));
        g.fillStyle = T.ice2; g.fill(ell(0, 0, b.rx, b.ry));
        g.fillStyle = T.ice; g.fill(ell(-b.rx * 0.06, -b.ry * 0.08, b.rx * 0.92, b.ry * 0.86));
        g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2;
        const rr = rng('ice' + b.x);
        for (let i = 0; i < 5; i++) { g.beginPath(); let x = (rr() - 0.5) * b.rx, y = (rr() - 0.5) * b.ry; g.moveTo(x, y); for (let k = 0; k < 3; k++) { x += (rr() - 0.5) * 50; y += (rr() - 0.5) * 30; g.lineTo(x, y); } g.stroke(); }
        g.fillStyle = 'rgba(255,255,255,.55)'; g.fill(ell(-b.rx * 0.4, -b.ry * 0.4, b.rx * 0.3, b.ry * 0.12, -0.3));
      } else if (b.kind === 'mist') {
        const gr = g.createRadialGradient(0, 0, 0, 0, 0, b.rx);
        gr.addColorStop(0, 'rgba(10,30,26,.75)'); gr.addColorStop(0.7, 'rgba(10,30,26,.5)'); gr.addColorStop(1, 'rgba(90,232,184,0)');
        g.scale(1, b.ry / b.rx); g.fillStyle = gr; g.fill(ell(0, 0, b.rx, b.rx));
        g.strokeStyle = 'rgba(90,232,184,.25)'; g.lineWidth = 3; g.stroke(ell(0, 0, b.rx * 0.82, b.rx * 0.82));
      }
      g.restore();
    }
    for (const L of F.lines) {
      if (L.kind === 'path') {
        stroke(L.pts, L.w + 10, shade(T.path2, -0.15));
        stroke(L.pts, L.w, T.path2);
        stroke(L.pts, L.w - 12, T.path);
        g.save(); g.setLineDash([2, 26]); stroke(L.pts, L.w * 0.55, shade(T.path, 0.12)); g.restore();
      } else if (L.kind === 'water') {
        stroke(L.pts, L.w + 46, T.sand);
        stroke(L.pts, L.w + 12, '#cdb87a');
        stroke(L.pts, L.w, T.water2);
        stroke(L.pts, L.w - 20, T.water);
        g.save(); g.globalAlpha = 0.35; g.setLineDash([30, 50]); stroke(L.pts, L.w * 0.3, T.foam); g.restore();
        g.save(); g.globalAlpha = 0.6; g.setLineDash([8, 22]); stroke(L.pts, L.w - 8, T.foam); g.restore();
      } else if (L.kind === 'stones') {
        g.save(); g.setLineDash([16, 14]); stroke(L.pts, L.w * 0.7, T.path2); stroke(L.pts, L.w * 0.5, T.path); g.restore();
      } else if (L.kind === 'crack') {
        stroke(L.pts, 16, 'rgba(224,112,255,.18)');
        stroke(L.pts, 7, '#5a1a8a');
        stroke(L.pts, 3, T.crack);
        stroke(L.pts, 1.2, '#ffe0ff');
      }
    }
  }

  // ---------- Décor en relief (cellules de 256) ----------
  propsIn(x0, y0, x1, y1, out) {
    for (let gx = Math.floor(x0 / PCELL); gx <= Math.floor(x1 / PCELL); gx++)
      for (let gy = Math.floor(y0 / PCELL); gy <= Math.floor(y1 / PCELL); gy++) {
        const k = gx + ',' + gy;
        let list = this.pcells.get(k);
        if (!list) this.pcells.set(k, list = this.makeProps(gx, gy));
        for (const p of list) out.push(p);
      }
    return out;
  }

  makeProps(gx, gy) {
    const r = rng(`p${this.zone.id}:${gx}:${gy}`), T = this.T, out = [];
    const cx = gx * PCELL, cy = gy * PCELL;
    const edge = Math.max(Math.abs(cx + PCELL / 2), Math.abs(cy + PCELL / 2)) > HALF - 200;
    const n = edge ? 7 : (r() * 3.2) | 0;
    const tot = T.props.reduce((s, p) => s + p[1], 0);
    for (let i = 0; i < n; i++) {
      const x = cx + r() * PCELL, y = cy + r() * PCELL;
      const out2 = Math.max(Math.abs(x), Math.abs(y));
      if (out2 > HALF + 140) continue;
      if (!edge && Math.hypot(x, y) < 230) continue;
      if (this.avoid.some(a => Math.hypot(a.x - x, a.y - y) < 80)) continue;
      let kind = 'tree';
      if (!edge) { let q = r() * tot; for (const [k, w] of T.props) { q -= w; if (q <= 0) { kind = k; break; } } }
      else if (r() < 0.35) kind = 'rock';
      if (kind !== 'reeds' && this.onFeature(x, y, 16)) continue;
      if (kind === 'reeds' && !this.onFeature(x, y, 30) && r() < 0.7) continue;
      const v = (r() * 3) | 0, spr = this.propSpr[kind]?.[v];
      if (!spr) continue;
      out.push({ x, y, spr, flip: r() < 0.5, s: 0.85 + r() * 0.35 + (edge ? 0.25 : 0), kind, tall: spr.meta.h > 50, light: spr.meta.light, ph: r() * TAU });
    }
    return out;
  }
}

export { CH };

// Bandeau d'une zone pour la carte des menus : un coin de sol et de décor, vu comme en jeu.
const banners = new Map();
export function zoneBannerURL(zone) {
  if (banners.has(zone.id)) return banners.get(zone.id);
  const W = 360, H = 120, res = 2, x0 = 70, y0 = 200;
  const w = new World2D(zone, res, []);
  const c = cnv(W * res, H * res), g = c.getContext('2d');
  g.setTransform(res, 0, 0, res, -x0 * res, -y0 * res);
  g.drawImage(w.bakeChunk(0, 0), 0, 0, CH, CH);
  // petit diorama : le décor typique de la zone, surtout à droite (la gauche porte le texte)
  const r = rng('banner' + zone.id), kinds = w.T.props.map(p => p[0]);
  const spots = [[0.3, 0.75, 0.6], [0.44, 1.02, 0.85], [0.56, 0.55, 0.7, 'tree'], [0.68, 1.12, 1.05, 'tree'], [0.8, 0.62, 0.8], [0.9, 1.05, 0.95, 'tree'], [1.0, 0.5, 0.75]];
  for (const [sx, sy, sc, kind] of spots) {
    const k = kind || kinds[(r() * kinds.length) | 0], s = w.propSpr[k][(r() * 3) | 0];
    g.setTransform(res * sc * (r() < 0.5 ? -1 : 1), 0, 0, res * sc, sx * W * res, sy * H * res);
    g.globalAlpha = 0.3; g.fillStyle = '#000'; g.beginPath(); g.ellipse(0, 0, s.meta.w * 0.4, s.meta.w * 0.13, 0, 0, TAU); g.fill(); g.globalAlpha = 1;
    g.drawImage(s.c, -s.ax, -s.ay, s.w, s.h);
  }
  const url = c.toDataURL('image/jpeg', 0.85);
  banners.set(zone.id, url);
  return url;
}
