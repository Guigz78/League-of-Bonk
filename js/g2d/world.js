// Monde 2D vu de dessus, façon arène de Clash Royale : herbe peinte en grands carreaux, chemins pavés
// bordés de pierres, rivières aux berges de pierre et ponts de bois, arbres ronds et touffus, rochers,
// massifs de fleurs, petites tours et bannières. Le sol est peint par morceaux (cuits à la demande),
// le décor en relief est trié en profondeur avec les personnages.
import { HALF } from '../data.js';
import { rng } from '../pixel.js';
import { bake, P, ell, rrect, poly, blob, glowDot, cnv, shade, vg, rg } from './items.js';

const TAU = Math.PI * 2;
const CH = 512;      // taille d'un morceau de sol (unités du monde)
const CELL = 128;    // cellule de petits détails au sol
const PCELL = 256;   // cellule de décor en relief
const TILE = 64;     // grands carreaux de la pelouse
const PAVE = 96;     // motif des pavés (se répète)

// ---------- Thèmes ----------
// g0 : herbe, tile : carreaux plus clairs, pave : pavés [base, clair, sombre, joints], edge : bordure en pierres
export const THEMES = {
  lane: {
    g0: '#6cbf4a', g1: '#5eae3e', g2: '#84d05e', tile: 'rgba(255,255,140,.07)', tuft: '#4a9a34', tuft2: '#9ade6a', edge: '#2a4a22',
    path: 'cobble', pave: ['#e8d6a8', '#fff2cc', '#b89c6c', '#a08458'], border: ['#a8a090', '#d4ccbc', '#6e665a', '#4e463c'],
    flowers: ['#ffe45a', '#ff8ab0', '#ffffff', '#9ad0ff'],
    tree: 'round', leaf: ['#4caa3a', '#2c7a2a', '#8ada5e'], trunk: '#8a5a32', rock: ['#b4b8c8', '#7a7e92', '#e2e6f0'],
    roof: ['#4a8af0', '#a8d0ff', '#2448a8'], flag: '#3a7ae8', moss: '#7ac84a',
    props: [['tree', 3], ['bush', 2.4], ['rock', 2], ['tower', 0.35], ['banner', 0.45]], ambient: 'leaf', dark: 0,
  },
  jungle: {
    g0: '#4a9a3a', g1: '#3e8832', g2: '#62b04c', tile: 'rgba(200,255,120,.06)', tuft: '#2e7026', tuft2: '#7cc85a', edge: '#14300f',
    path: 'dirt', pave: ['#b08a5a', '#d8b484', '#7e5c36', '#6a4a2a'], border: ['#8a9a7a', '#bccaa8', '#56664a', '#3a4632'],
    flowers: ['#ff5a7a', '#ffd04a', '#c06aff'],
    tree: 'jungle', leaf: ['#2f9a44', '#1a6a2c', '#6ccc5a'], trunk: '#7a4e2a', rock: ['#9aaa8a', '#66745a', '#c8d8b0'],
    roof: ['#d8503a', '#ffa08a', '#8a2416'], flag: '#e8483a', moss: '#5ab84a',
    props: [['tree', 4], ['bush', 3], ['mushroom', 1.4], ['rock', 1], ['banner', 0.3]], ambient: 'firefly', dark: 0.1,
  },
  river: {
    g0: '#7ccc5a', g1: '#6cbc4c', g2: '#9ade72', tile: 'rgba(255,255,160,.07)', tuft: '#4e9a3c', tuft2: '#b4ea8a', edge: '#24566a',
    path: 'cobble', pave: ['#e0dcd0', '#fffaf0', '#a8a294', '#8a8478'], border: ['#a8a090', '#d8d0c0', '#6a6256', '#4a443a'],
    water: '#3aaaf0', water2: '#1f7ad0', foam: '#e8fbff', flowers: ['#ffffff', '#ffe45a', '#ff9ad0'],
    tree: 'palm', leaf: ['#4aaa4a', '#2a7a34', '#8ada64'], trunk: '#b08050', rock: ['#bcb4a4', '#867e70', '#e6dece'],
    roof: ['#3a9ae8', '#a8e0ff', '#1a5aa8'], flag: '#2a8ae0', moss: '#7ac84a',
    props: [['tree', 2.4], ['reeds', 2.4], ['rock', 2], ['bush', 1.4], ['tower', 0.3], ['banner', 0.3]], ambient: 'bubble', dark: 0,
  },
  ice: {
    g0: '#e6f1fb', g1: '#d2e4f4', g2: '#fafdff', tile: 'rgba(150,190,230,.10)', tuft: '#b4cce4', tuft2: '#ffffff', edge: '#4a6a8a',
    path: 'cobble', pave: ['#bcd0e4', '#eaf4ff', '#8aa0bc', '#7088a6'], border: ['#90a4bc', '#c8d8ea', '#5e7290', '#465872'],
    ice: '#a8e0fa', ice2: '#6ac0ec', flowers: ['#9ad8ff', '#ffffff'],
    tree: 'pine', leaf: ['#3e8a7a', '#245a52', '#6ab89c'], trunk: '#7a5440', rock: ['#a4b8d0', '#6a809e', '#e0ecf8'],
    roof: ['#3a7ae8', '#a8ccff', '#1a48a8'], flag: '#3a8ae8', moss: '#ffffff',
    props: [['tree', 3], ['rock', 2], ['icecrystal', 1.6], ['bush', 0.6], ['tower', 0.3], ['banner', 0.25]], ambient: 'snow', dark: 0,
  },
  shadow: {
    g0: '#3c6058', g1: '#30524a', g2: '#4a7468', tile: 'rgba(120,255,210,.05)', tuft: '#24443c', tuft2: '#5e9282', edge: '#08140f',
    path: 'stones', pave: ['#7e8e8a', '#b0c0bc', '#4e5c58', '#3a4644'], border: ['#5e6c6a', '#8a9a98', '#3a4644', '#28302e'],
    mist: '#5ae8b8', flowers: ['#5ae8b8', '#a0fff0'],
    tree: 'dead', leaf: ['#4a4a5a', '#2a2a36', '#6e6e80'], trunk: '#44444e', rock: ['#6a7a78', '#45524f', '#98aaa6'],
    roof: ['#3a8a7a', '#8ae8c8', '#1a4a40'], flag: '#3ab890', moss: '#5ab890',
    props: [['tree', 3], ['grave', 2.4], ['lantern', 1], ['rock', 1.4]], ambient: 'mist', dark: 0.42,
  },
  void: {
    g0: '#3a2058', g1: '#2e1848', g2: '#4a2c70', tile: 'rgba(220,140,255,.06)', tuft: '#24103a', tuft2: '#7a4ab0', edge: '#06020c',
    path: 'void', pave: ['#4e3a72', '#7a62a8', '#2e2048', '#22163a'], border: ['#3a2a58', '#6a58a0', '#22163a', '#160e28'],
    crack: '#e070ff', flowers: ['#e070ff', '#7ad0ff'],
    tree: 'crystal', leaf: ['#b05aff', '#7428c8', '#f0b8ff'], trunk: '#2a1440', rock: ['#5a4a7a', '#362a50', '#8a7ab0'],
    roof: ['#a04ae8', '#e0a8ff', '#5a1a98'], flag: '#c050ff', moss: '#e070ff',
    props: [['tree', 2.4], ['tentacle', 1.6], ['rock', 2], ['vcrystal', 1.2]], ambient: 'void', dark: 0.5,
  },
};

// ---------- Motifs : pavés et pierres de bordure (se répètent tous les PAVE) ----------
function paveTex(res, C, big) {
  const S = Math.max(1, Math.round(PAVE * res)), c = cnv(S, S), g = c.getContext('2d');
  g.scale(S / PAVE, S / PAVE);
  g.fillStyle = C[3]; g.fillRect(0, 0, PAVE, PAVE);
  const r = rng('pave' + C[0] + big), n = big ? 4 : 6, cs = PAVE / n;
  const stones = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const off = (j & 1) * cs * 0.5;
    stones.push([i * cs + off + cs / 2 + (r() - 0.5) * cs * 0.12, j * cs + cs / 2 + (r() - 0.5) * cs * 0.12, cs * (0.42 + r() * 0.05), cs * (0.38 + r() * 0.05), r()]);
  }
  for (const [x0, y0, rx, ry, v] of stones) for (const dx of [-PAVE, 0, PAVE]) for (const dy of [-PAVE, 0, PAVE]) {
    const x = x0 + dx, y = y0 + dy;
    if (x + rx < 0 || x - rx > PAVE || y + ry < 0 || y - ry > PAVE) continue;
    const p = rrect(x - rx, y - ry, rx * 2, ry * 2, Math.min(rx, ry) * 0.7);
    g.fillStyle = C[2]; g.save(); g.translate(0.8, 1.4); g.fill(p); g.restore();
    g.fillStyle = v < 0.33 ? shade(C[0], -0.05) : v > 0.75 ? shade(C[0], 0.06) : C[0]; g.fill(p);
    g.save(); g.clip(p); g.fillStyle = C[1]; g.globalAlpha = 0.7; g.fill(ell(x - rx * 0.25, y - ry * 0.35, rx * 0.6, ry * 0.4)); g.restore();
  }
  return c;
}

// polyligne décalée sur le côté (berges, reflets)
function offsetLine(pts, d) {
  return pts.map(([x, y], i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    return [x - dy / l * d, y + dx / l * d];
  });
}

// ---------- Décor en relief ----------
// feuillage touffu : boules qui se chevauchent, lumière en haut à gauche, creux sombres entre les boules
function fluffy(g, blobs, C) {
  const p = P();
  let top = 1e9, bot = -1e9;
  for (const [x, y, r] of blobs) { p.moveTo(x + r, y); p.arc(x, y, r, 0, TAU); top = Math.min(top, y - r); bot = Math.max(bot, y + r); }
  g.fillStyle = vg(g, top, bot, [C[2], C[0], C[1]]); g.fill(p);
  g.save(); g.clip(p);
  g.lineWidth = 2.2; g.strokeStyle = shade(C[1], -0.25); g.globalAlpha = 0.55;
  for (const [x, y, r] of blobs.slice(1)) { g.beginPath(); g.arc(x, y, r * 0.96, 0.25, 2.9); g.stroke(); }
  g.globalAlpha = 1;
  for (const [x, y, r] of blobs) { g.fillStyle = 'rgba(255,255,230,.22)'; g.fill(ell(x - r * 0.28, y - r * 0.34, r * 0.55, r * 0.42, -0.4)); }
  g.fillStyle = 'rgba(255,255,255,.35)';
  for (const [x, y, r] of blobs) g.fill(ell(x - r * 0.4, y - r * 0.5, r * 0.2, r * 0.13, -0.5));
  g.restore();
}

function stone(g, x, y, w, h, C, cap = null) {
  const p = P(); p.moveTo(x - w, y); p.bezierCurveTo(x - w * 1.05, y - h * 0.8, x - w * 0.5, y - h * 1.05, x + w * 0.05, y - h); p.bezierCurveTo(x + w * 0.7, y - h * 0.98, x + w * 1.05, y - h * 0.5, x + w, y); p.quadraticCurveTo(x, y + h * 0.18, x - w, y); p.closePath();
  blob(g, p, C[0], { light: C[2], dark: C[1], y0: y - h, y1: y, ink: shade(C[1], -0.5), hl: { x: x - w * 0.35, y: y - h * 0.7, rx: w * 0.3, ry: h * 0.14, rot: -0.3, a: 0.6 } });
  if (cap) { g.save(); g.clip(p); g.fillStyle = cap; g.fill(ell(x - w * 0.1, y - h * 1.02, w * 0.8, h * 0.32, -0.1)); g.fillStyle = 'rgba(255,255,255,.35)'; g.fill(ell(x - w * 0.3, y - h * 1.0, w * 0.35, h * 0.1, -0.1)); g.restore(); }
  return p;
}

const PROP_DRAW = {
  tree(g, T, r) {
    const C = T.leaf;
    if (T.tree === 'pine') {
      blob(g, rrect(-5, -18, 10, 18, 3), T.trunk, { y0: -18, y1: 0, ao: 0 });
      for (let i = 0; i < 3; i++) {
        const y = -12 - i * 21, w = 34 - i * 8;
        const tri = P(); tri.moveTo(-w, y); tri.quadraticCurveTo(-w * 0.4, y - 16, 0, y - 36); tri.quadraticCurveTo(w * 0.4, y - 16, w, y); tri.quadraticCurveTo(0, y + 6, -w, y); tri.closePath();
        blob(g, tri, C[0], { dark: C[1], light: C[2], y0: y - 36, y1: y + 4, hl: { x: -w * 0.35, y: y - 12, rx: w * 0.22, ry: 5, rot: -0.9, a: 0.35 } });
        const snow = P(); snow.moveTo(-w * 0.62, y - 13); snow.quadraticCurveTo(-w * 0.3, y - 22, 0, y - 36); snow.quadraticCurveTo(w * 0.3, y - 22, w * 0.62, y - 13);
        snow.quadraticCurveTo(w * 0.3, y - 18, w * 0.12, y - 14); snow.quadraticCurveTo(0, y - 19, -w * 0.15, y - 14); snow.quadraticCurveTo(-w * 0.35, y - 18, -w * 0.62, y - 13); snow.closePath();
        blob(g, snow, '#ffffff', { dark: '#cfe0f2', light: '#ffffff', y0: y - 36, y1: y - 12, ink: '#8aa8c8', ao: 0 });
      }
      return { h: 98, w: 70 };
    }
    if (T.tree === 'dead') {
      const tr = P(); tr.moveTo(-7, 0); tr.bezierCurveTo(-8, -22, -4, -36, 0, -54); tr.lineTo(5, -54); tr.bezierCurveTo(3, -36, 6, -20, 8, 0); tr.closePath();
      blob(g, tr, T.trunk, { light: '#6e6e80', dark: '#22222c', y0: -54, y1: 0, ao: 0 });
      g.lineCap = 'round';
      const br = [[1, -30, -24, -50], [2, -40, 22, -62], [3, -50, -10, -80], [-12, -44, -28, -46], [12, -54, 27, -56]];
      for (const [x0, y0, x1, y1] of br) {
        g.strokeStyle = '#1e1e28'; g.lineWidth = 6; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2, y1 + 6, x1, y1); g.stroke();
        g.strokeStyle = T.leaf[2]; g.lineWidth = 3.2; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2, y1 + 6, x1, y1); g.stroke();
      }
      for (const [x, y] of [[-24, -50], [22, -62]]) { g.fillStyle = '#5ae8b8'; g.globalAlpha = 0.8; g.fill(ell(x, y + 6, 2.4, 3.6)); g.globalAlpha = 1; }
      return { h: 84, w: 58 };
    }
    if (T.tree === 'crystal') {
      for (const [x, h, w, a] of [[-12, 46, 9, -0.25], [12, 40, 8, 0.3], [0, 70, 12, 0], [6, 28, 6, 0.6]]) {
        g.save(); g.translate(x, -4); g.rotate(a);
        blob(g, poly([[-w, 0], [-w, -h * 0.8], [0, -h], [w, -h * 0.8], [w, 0]]), C[0], { dark: C[1], light: C[2], y0: -h, y1: 0, hl: { x: -w * 0.45, y: -h * 0.5, rx: w * 0.25, ry: h * 0.3, a: 0.6 }, ao: 0 });
        g.restore();
      }
      return { h: 74, w: 50, light: { y: -40, r: 70, c: '#c070ff' } };
    }
    if (T.tree === 'palm') {
      const tr = P(); tr.moveTo(-5, 0); tr.quadraticCurveTo(8, -36, -4, -70); tr.lineTo(2, -70); tr.quadraticCurveTo(14, -36, 5, 0); tr.closePath();
      blob(g, tr, T.trunk, { y0: -70, y1: 0, ao: 0 });
      g.strokeStyle = shade(T.trunk, -0.35); g.lineWidth = 1.2;
      for (let i = 1; i < 7; i++) { const t = i / 7, x = 2 * (1 - t) * t * 10 + t * t * -2, y = -70 * t; g.beginPath(); g.moveTo(x - 3.6, y + 1); g.lineTo(x + 3.6, y - 1); g.stroke(); }
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI / 2 + (i - 3) * 0.55;
        g.save(); g.translate(-1, -70); g.rotate(a + Math.PI / 2);
        const fr = P(); fr.moveTo(0, 0); fr.quadraticCurveTo(16, -12, 34, 6); fr.quadraticCurveTo(16, 3, 0, 0); fr.closePath();
        blob(g, fr, C[0], { dark: C[1], light: C[2], y0: -10, y1: 6, ao: 0 });
        g.restore();
      }
      for (const x of [-4, 3]) blob(g, ell(x, -66, 4, 4), '#8a5a2a', { y0: -70, y1: -62, ao: 0 });
      return { h: 94, w: 74 };
    }
    // arbre rond et touffu (ou géant de la jungle, avec lianes)
    const big = T.tree === 'jungle', s = big ? 1.22 : 1;
    const trunk = P(); trunk.moveTo(-8, 0); trunk.quadraticCurveTo(-5, -14, -6, -30); trunk.lineTo(6, -30); trunk.quadraticCurveTo(5, -14, 8, 0); trunk.quadraticCurveTo(0, 3, -8, 0); trunk.closePath();
    blob(g, trunk, T.trunk, { y0: -30, y1: 0, hl: { x: -3, y: -16, rx: 1.6, ry: 7, a: 0.35 } });
    const v = r() < 0.5 ? 1 : -1;
    const blobs = [[0, -60 * s, 24 * s], [-19 * s, -46 * s, 18 * s], [19 * s, -46 * s, 18 * s], [-10 * s, -72 * s, 17 * s], [11 * s, -73 * s, 16 * s], [v * 3, -40 * s, 17 * s]];
    fluffy(g, blobs, C);
    if (big) {
      g.strokeStyle = '#2a6a2a'; g.lineWidth = 2.4; g.lineCap = 'round';
      for (const x of [-20, -5, 14]) { g.beginPath(); g.moveTo(x, -38); g.quadraticCurveTo(x + 4, -24, x - 1, -12 - r() * 8); g.stroke(); g.fillStyle = '#5ab84a'; g.fill(ell(x - 1, -12 - 2, 2.4, 1.6)); }
    } else if (r() < 0.55) {
      for (let i = 0; i < 5; i++) { const x = -16 + r() * 32, y = -74 + r() * 34; blob(g, ell(x, y, 2.8, 2.8), '#ff5a4a', { light: '#ffc0b0', dark: '#a82a2a', y0: y - 3, y1: y + 3, ao: 0, line: 0.8 }); }
    }
    return { h: big ? 108 : 92, w: big ? 90 : 76 };
  },
  bush(g, T, r) {
    const C = T.tree === 'pine' ? ['#eef6fc', '#bcd0e4', '#ffffff'] : T.tree === 'dead' || T.tree === 'crystal' ? [shade(T.g1, 0.14), shade(T.g1, -0.25), shade(T.g1, 0.35)] : [shade(T.leaf[0], 0.08), T.leaf[1], T.leaf[2]];
    fluffy(g, [[0, -13, 13], [-13, -9, 10], [13, -9, 10], [-5, -20, 9], [7, -21, 8]], C);
    if (T.flowers && r() < 0.6) {
      const col = T.flowers[(r() * T.flowers.length) | 0];
      for (let i = 0; i < 5; i++) { const x = -14 + r() * 28, y = -24 + r() * 14; for (let k = 0; k < 5; k++) { g.fillStyle = col; g.fill(ell(x + Math.cos(k * 1.256) * 1.7, y + Math.sin(k * 1.256) * 1.7, 1.4, 1.4)); } g.fillStyle = '#ffd040'; g.fill(ell(x, y, 0.9, 0.9)); }
    }
    return { h: 32, w: 46 };
  },
  rock(g, T, r) {
    const cap = T.tree === 'pine' ? '#ffffff' : T.tree === 'round' || T.tree === 'jungle' || T.tree === 'palm' ? T.moss : null;
    if (r() < 0.5) stone(g, 13, 0, 9, 13, T.rock, cap);
    stone(g, -2, 1, 17, 25, T.rock, cap);
    if (r() < 0.6) stone(g, -15, 2, 8, 10, T.rock);
    if (T.tree === 'crystal') glowDot(g, 2, -12, 2.4, '#e070ff');
    else if (T.tree === 'dead') { g.strokeStyle = 'rgba(90,232,184,.7)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-6, -4); g.lineTo(-2, -12); g.lineTo(-5, -18); g.stroke(); }
    return { h: 28, w: 46 };
  },
  // petite tour de pierre au toit pointu, drapeau au sommet
  tower(g, T, r) {
    const st = T.border;
    const body = rrect(-15, -62, 30, 62, 3);
    g.fillStyle = (() => { const gr = g.createLinearGradient(-15, 0, 15, 0); gr.addColorStop(0, st[2]); gr.addColorStop(0.3, st[1]); gr.addColorStop(0.6, st[0]); gr.addColorStop(1, st[2]); return gr; })();
    g.fill(body); g.lineWidth = 1.2; g.strokeStyle = st[3]; g.stroke(body);
    g.save(); g.clip(body); g.strokeStyle = 'rgba(40,30,20,.35)'; g.lineWidth = 1;
    for (let y = -54, k = 0; y < 0; y += 9, k++) { g.beginPath(); g.moveTo(-15, y); g.lineTo(15, y); g.stroke(); for (let x = -15 + (k & 1) * 6; x < 15; x += 12) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 9); g.stroke(); } }
    g.restore();
    const door = P(); door.moveTo(-6, 0); door.lineTo(-6, -11); door.arc(0, -11, 6, Math.PI, 0); door.lineTo(6, 0); door.closePath();
    blob(g, door, '#6a4426', { y0: -17, y1: 0, ao: 0 });
    g.fillStyle = '#2a1a30'; g.fill(rrect(-2.4, -42, 4.8, 10, 2.4)); g.fillStyle = '#ffd86a'; g.globalAlpha = 0.8; g.fill(rrect(-1.4, -41, 2.8, 4, 1.4)); g.globalAlpha = 1;
    blob(g, rrect(-18, -68, 36, 8, 2.4), st[0], { light: st[1], dark: st[2], y0: -68, y1: -60, ink: st[3], ao: 0 });
    const R = T.roof, roof = P(); roof.moveTo(-21, -64); roof.quadraticCurveTo(-6, -78, 0, -104); roof.quadraticCurveTo(6, -78, 21, -64); roof.quadraticCurveTo(0, -58, -21, -64); roof.closePath();
    blob(g, roof, R[0], { light: R[1], dark: R[2], y0: -104, y1: -60, hl: { x: -7, y: -80, rx: 3, ry: 10, rot: 0.3, a: 0.45 } });
    g.save(); g.clip(roof); g.strokeStyle = shade(R[2], -0.2); g.globalAlpha = 0.45; g.lineWidth = 1;
    for (const y of [-72, -82, -92]) { g.beginPath(); g.moveTo(-22, y + 4); g.quadraticCurveTo(0, y - 2, 22, y + 4); g.stroke(); }
    g.restore();
    g.strokeStyle = '#3a2a1a'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(0, -103); g.lineTo(0, -120); g.stroke();
    const fl = P(); fl.moveTo(0, -120); fl.quadraticCurveTo(8, -118, 15, -116); fl.lineTo(9, -113); fl.lineTo(15, -110); fl.quadraticCurveTo(7, -111, 0, -112); fl.closePath();
    blob(g, fl, T.flag, { y0: -120, y1: -110, ao: 0 });
    g.fillStyle = '#ffd54a'; g.fill(ell(0, -121, 1.8, 1.8));
    return { h: 122, w: 46 };
  },
  // bannière sur un mât, aux couleurs du monde
  banner(g, T, r) {
    blob(g, rrect(-2.4, -74, 4.8, 74, 2), '#8a5a32', { y0: -74, y1: 0, ao: 0 });
    blob(g, rrect(-12, -70, 24, 4, 2), '#7a4a26', { y0: -70, y1: -66, ao: 0 });
    const cl = P(); cl.moveTo(-10, -66); cl.lineTo(10, -66); cl.lineTo(10, -30); cl.lineTo(0, -36); cl.lineTo(-10, -30); cl.closePath();
    blob(g, cl, T.flag, { y0: -66, y1: -30, hl: { x: -5, y: -54, rx: 2, ry: 10, a: 0.3 } });
    g.fillStyle = '#ffd54a'; g.fillRect(-10, -66, 20, 2.6);
    const em = poly([[0, -60], [5, -52], [0, -43], [-5, -52]]);
    blob(g, em, '#ffd54a', { light: '#fff6b8', dark: '#c8860c', y0: -60, y1: -43, ao: 0 });
    blob(g, ell(0, -76, 3.4, 3.4), '#ffd54a', { light: '#fff6b8', dark: '#b8780c', y0: -80, y1: -72, ao: 0 });
    return { h: 80, w: 26 };
  },
  mushroom(g, T, r) {
    blob(g, rrect(-5, -22, 10, 22, 4), '#f4ead0', { dark: '#c8b898', y0: -22, y1: 0, ao: 0 });
    const cap = P(); cap.moveTo(-21, -18); cap.bezierCurveTo(-21, -46, 21, -46, 21, -18); cap.quadraticCurveTo(0, -11, -21, -18); cap.closePath();
    blob(g, cap, '#e84a3a', { dark: '#a02a2a', light: '#ffa080', y0: -40, y1: -14, hl: { x: -8, y: -33, rx: 6, ry: 3, rot: -0.4, a: 0.5 } });
    g.fillStyle = '#ffffff'; for (const [x, y, s] of [[-10, -26, 3], [3, -34, 3.4], [11, -24, 2.4], [-2, -23, 1.8]]) g.fill(ell(x, y, s, s * 0.8));
    return { h: 44, w: 44 };
  },
  reeds(g, T, r) {
    for (let i = 0; i < 5; i++) {
      const x = -10 + i * 5 + (r() - 0.5) * 3, h = 26 + r() * 18, bend = (r() - 0.5) * 8;
      g.strokeStyle = '#2a5a1a'; g.lineWidth = 3.4; g.beginPath(); g.moveTo(x, 0); g.quadraticCurveTo(x + bend, -h / 2, x + bend * 1.5, -h); g.stroke();
      g.strokeStyle = '#6aaa3a'; g.lineWidth = 1.8; g.beginPath(); g.moveTo(x, 0); g.quadraticCurveTo(x + bend, -h / 2, x + bend * 1.5, -h); g.stroke();
      if (i % 2 === 0) blob(g, rrect(x + bend * 1.5 - 2.2, -h - 8, 4.4, 10, 2.2), '#8a5a2a', { y0: -h - 8, y1: -h + 2, ao: 0, line: 0.8 });
    }
    return { h: 46, w: 34 };
  },
  icecrystal(g) {
    for (const [x, h, w, a] of [[-8, 30, 6, -0.35], [8, 26, 5.5, 0.35], [0, 42, 8, 0]]) {
      g.save(); g.translate(x, -2); g.rotate(a);
      blob(g, poly([[-w, 0], [-w, -h * 0.75], [0, -h], [w, -h * 0.75], [w, 0]]), '#bfe8ff', { dark: '#6ab0e0', light: '#ffffff', y0: -h, y1: 0, hl: { x: -w * 0.4, y: -h * 0.5, rx: w * 0.25, ry: h * 0.3, a: 0.9 }, ao: 0 });
      g.restore();
    }
    return { h: 44, w: 36, light: { y: -20, r: 36, c: '#9ad8ff', a: 0.25 } };
  },
  grave(g, T, r) {
    const C = ['#8a9a98', '#5a6a68', '#c0d0ce'];
    if (r() < 0.4) {
      blob(g, rrect(-3.5, -40, 7, 40, 1.6), C[0], { dark: C[1], light: C[2], y0: -40, y1: 0, ao: 0 });
      blob(g, rrect(-13, -32, 26, 7, 1.6), C[0], { dark: C[1], light: C[2], y0: -32, y1: -25, ao: 0 });
    } else {
      const st = P(); st.moveTo(-12, 0); st.lineTo(-12, -24); st.arc(0, -24, 12, Math.PI, 0); st.lineTo(12, 0); st.closePath();
      blob(g, st, C[0], { dark: C[1], light: C[2], y0: -36, y1: 0, hl: { x: -5, y: -28, rx: 3, ry: 6, a: 0.4 } });
      g.strokeStyle = '#4a5a58'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-5, -24); g.lineTo(5, -24); g.moveTo(-5, -18); g.lineTo(4, -18); g.stroke();
    }
    blob(g, ell(0, -1, 15, 4), '#3a4a40', { y0: -5, y1: 3, ao: 0, line: 0.8 });
    return { h: 40, w: 32 };
  },
  lantern(g) {
    g.strokeStyle = '#1e1e28'; g.lineWidth = 5; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -48); g.lineTo(10, -50); g.stroke();
    g.strokeStyle = '#4a4a5a'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -48); g.lineTo(10, -50); g.stroke();
    blob(g, rrect(5, -48, 10, 13, 3), '#2a3a38', { y0: -48, y1: -35, ao: 0 });
    glowDot(g, 10, -41, 3.6, '#5ae8b8');
    return { h: 52, w: 24, light: { x: 10, y: -41, r: 80, c: '#5ae8b8' } };
  },
  tentacle(g, T, r) {
    const sd = r() < 0.5 ? 1 : -1;
    const tp = P(); tp.moveTo(-9, 0); tp.bezierCurveTo(-12, -24, sd * 18, -30, sd * 8, -58); tp.bezierCurveTo(sd * 24, -34, 6, -18, 9, 0); tp.closePath();
    blob(g, tp, '#9a3ad8', { dark: '#5a1a8a', light: '#e0a0ff', y0: -58, y1: 0, hl: { x: -4, y: -22, rx: 2, ry: 8, a: 0.4 } });
    g.fillStyle = '#ffc0f0'; for (let i = 0; i < 4; i++) g.fill(ell(2 + sd * i * 1.6, -8 - i * 11, 2, 1.6));
    return { h: 60, w: 34 };
  },
  vcrystal(g) {
    for (const [x, h, w, a] of [[-6, 26, 6, -0.4], [6, 22, 5, 0.4], [0, 34, 7, 0]]) {
      g.save(); g.translate(x, -2); g.rotate(a);
      blob(g, poly([[-w, 0], [-w, -h * 0.75], [0, -h], [w, -h * 0.75], [w, 0]]), '#ff6ad8', { dark: '#a02a98', light: '#ffd0f4', y0: -h, y1: 0, hl: { x: -w * 0.4, y: -h * 0.5, rx: w * 0.25, ry: h * 0.3, a: 0.9 }, ao: 0 });
      g.restore();
    }
    return { h: 36, w: 30, light: { y: -18, r: 56, c: '#ff6ad8' } };
  },
};
// contour sombre de la teinte du décor (pas de noir pur)
const PROP_INK = { tree: T => shade(T.leaf[1], -0.55), bush: T => shade(T.leaf[1], -0.5), rock: T => shade(T.rock[1], -0.55), tower: T => shade(T.border[3], -0.3), banner: () => '#2a1810' };

// ---------- Monde ----------
export class World2D {
  constructor(zone, res, avoid = [], banner = null) {
    this.zone = zone;
    this.T = THEMES[zone.bg] || THEMES.lane;
    this.res = res;
    this.gres = Math.min(res, 1.6);
    this.r = rng('w2d' + zone.id);
    this.avoid = avoid;
    this.chunks = new Map();
    this.tick = 0;
    this.pcells = new Map();
    this.features = banner || this.makeFeatures();
    this.pave = paveTex(this.gres, this.T.pave, false);
    this.edgeStones = paveTex(this.gres, this.T.border, true);
    this.propSpr = {};
    for (const [kind] of this.T.props) {
      this.propSpr[kind] = [0, 1, 2].map(v => {
        let meta = { h: 40, w: 40 };
        const pr = rng('prop' + zone.id + kind + v);
        const spr = bake(130, 136, 65, 126, res, g => { meta = PROP_DRAW[kind](g, this.T, pr) || meta; }, { outline: 1.5, col: (PROP_INK[kind] || (() => '#1a1030'))(this.T) });
        spr.meta = meta;
        return spr;
      });
    }
  }

  // chemins, rivières, lacs… (coordonnées du monde), identiques d'une partie à l'autre
  makeFeatures() {
    const r = this.r, bg = this.zone.bg, f = { lines: [], blobs: [], bridges: [] };
    const wobbly = (x0, y0, x1, y1, amp, n = 28) => {
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
      f.lines.push({ pts: wobbly(-E, E, E, -E, 60), w: 110, kind: 'path' });
      f.lines.push({ pts: wobbly(-E, -E * 0.3, E, E * 0.25, 90), w: 84, kind: 'path' });
    } else if (bg === 'jungle') {
      f.lines.push({ pts: wobbly(-E, -200, E, 300, 220), w: 76, kind: 'path' });
      f.lines.push({ pts: wobbly(-300, -E, 200, E, 260), w: 66, kind: 'path' });
    } else if (bg === 'river') {
      f.lines.push({ pts: wobbly(-E, -500, E, -300, 260), w: 150, kind: 'water' });
      f.lines.push({ pts: wobbly(-600, E, 500, -E, 200), w: 110, kind: 'water' });
      f.lines.push({ pts: wobbly(-E, 420, E, 160, 160), w: 80, kind: 'path' });
      f.lines.push({ pts: wobbly(300, -E, -200, E, 220), w: 74, kind: 'path' });
    } else if (bg === 'ice') {
      for (let i = 0; i < 9; i++) { const a = r() * TAU, d = 380 + r() * 1000; f.blobs.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, rx: 120 + r() * 160, ry: 80 + r() * 110, rot: r() * 3, kind: 'ice' }); }
      f.lines.push({ pts: wobbly(-E, 120, E, -260, 200), w: 78, kind: 'path' });
    } else if (bg === 'shadow') {
      f.lines.push({ pts: wobbly(-E, E * 0.2, E, -E * 0.1, 200), w: 64, kind: 'path' });
      for (let i = 0; i < 10; i++) { const a = r() * TAU, d = 350 + r() * 1100; f.blobs.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, rx: 90 + r() * 120, ry: 60 + r() * 80, rot: r() * 3, kind: 'mist' }); }
    } else if (bg === 'void') {
      f.lines.push({ pts: wobbly(-E, -E * 0.5, E, E * 0.4, 260), w: 70, kind: 'path' });
      for (let i = 0; i < 7; i++) {
        const a = r() * TAU, d = 200 + r() * 1200, x0 = Math.cos(a) * d, y0 = Math.sin(a) * d, pts = [[x0, y0]];
        let x = x0, y = y0, dir = r() * TAU;
        for (let k = 0; k < 14; k++) { dir += (r() - 0.5) * 1.4; x += Math.cos(dir) * 60; y += Math.sin(dir) * 60; pts.push([x, y]); }
        f.lines.push({ pts, w: 8, kind: 'crack' });
      }
    }
    // ponts de bois là où un chemin traverse une rivière
    for (const A of f.lines) if (A.kind === 'path') for (const B of f.lines) if (B.kind === 'water') {
      for (let i = 1; i < A.pts.length; i++) for (let j = 1; j < B.pts.length; j++) {
        const q = segX(A.pts[i - 1], A.pts[i], B.pts[j - 1], B.pts[j]);
        if (q) f.bridges.push(bridge(A.pts[i - 1], A.pts[i], B.pts[j - 1], B.pts[j], q, A.w, B.w + 96));
      }
    }
    return f;
  }

  // distance au chemin / à l'eau le plus proche (pour ne pas planter d'arbre dans la rivière)
  onFeature(x, y, pad = 0) {
    for (const L of this.features.lines) {
      if (L.kind === 'crack') continue;
      const p = L.pts, extra = L.kind === 'water' ? 22 : 10;
      for (let i = 1; i < p.length; i++) {
        const [ax, ay] = p[i - 1], [bx, by] = p[i];
        const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2));
        if (Math.hypot(x - ax - dx * t, y - ay - dy * t) < L.w / 2 + extra + pad) return L;
      }
    }
    for (const b of this.features.blobs) {
      if (b.kind !== 'ice' && b.kind !== 'mist') continue;
      const c = Math.cos(-b.rot), s = Math.sin(-b.rot), lx = (x - b.x) * c - (y - b.y) * s, ly = (x - b.x) * s + (y - b.y) * c;
      if ((lx / (b.rx + 12 + pad)) ** 2 + (ly / (b.ry + 12 + pad)) ** 2 < 1) return b;
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
    // grands carreaux de pelouse, comme dans une arène
    g.fillStyle = T.tile;
    for (let gx = Math.floor(x0 / TILE); gx < (x0 + CH) / TILE; gx++) for (let gy = Math.floor(y0 / TILE); gy < (y0 + CH) / TILE; gy++) if ((gx + gy) & 1) g.fillRect(gx * TILE, gy * TILE, TILE, TILE);
    const cells = (size, fn) => {
      const m = 130;
      for (let gx = Math.floor((x0 - m) / size); gx <= Math.floor((x0 + CH + m) / size); gx++)
        for (let gy = Math.floor((y0 - m) / size); gy <= Math.floor((y0 + CH + m) / size); gy++) fn(rng(`c${this.zone.id}:${size}:${gx}:${gy}`), gx * size, gy * size);
    };
    // grandes taches de couleur douces (aspect peint)
    cells(CELL, (r, x, y) => {
      const px = x + r() * CELL, py = y + r() * CELL, rad = 50 + r() * 90, col = r() < 0.5 ? T.g1 : T.g2;
      const gr = g.createRadialGradient(px, py, 0, px, py, rad);
      gr.addColorStop(0, col + '90'); gr.addColorStop(1, col + '00');
      g.fillStyle = gr; g.fillRect(px - rad, py - rad, rad * 2, rad * 2);
    });
    this.drawFeatures(g, x0, y0);
    // brins d'herbe, massifs de fleurs, cailloux
    cells(CELL, (r, x, y) => {
      const n = 6 + (r() * 5 | 0);
      for (let i = 0; i < n; i++) {
        const px = x + r() * CELL, py = y + r() * CELL;
        if (this.onFeature(px, py, -4)) continue;
        const k = r();
        if (k < 0.74) { // touffe d'herbe : 3 brins courbes
          const s = 3.5 + r() * 4, lean = (r() - 0.5) * 2;
          g.fillStyle = r() < 0.65 ? T.tuft : T.tuft2;
          g.beginPath();
          for (const [dx, h] of [[-1, 0.75], [0.2, 1.15], [1.2, 0.8]]) {
            g.moveTo(px + dx * 1.6 - 0.9, py); g.quadraticCurveTo(px + dx * s * 0.35, py - h * s * 0.6, px + dx * s * 0.55 + lean, py - h * s);
            g.quadraticCurveTo(px + dx * s * 0.25 + 0.6, py - h * s * 0.5, px + dx * 1.6 + 0.9, py); g.closePath();
          }
          g.fill();
        } else if (k < 0.84 && T.flowers) { // massif de fleurs
          const col = T.flowers[(r() * T.flowers.length) | 0], m = 3 + (r() * 5 | 0), glowy = T === THEMES.void || T === THEMES.shadow;
          for (let j = 0; j < m; j++) {
            const fx = px + (r() - 0.5) * 22, fy = py + (r() - 0.5) * 14;
            if (glowy) { g.fillStyle = col; g.globalAlpha = 0.85; g.fill(ell(fx, fy, 1.7, 1.7)); g.globalAlpha = 1; continue; }
            g.fillStyle = shade(T.tuft, -0.1); g.fill(ell(fx + 0.6, fy + 1.4, 3, 1.4));
            g.fillStyle = col;
            for (let a = 0; a < 5; a++) g.fill(ell(fx + Math.cos(a * 1.256) * 2.1, fy + Math.sin(a * 1.256) * 2.1, 1.6, 1.6));
            g.fillStyle = '#ffd040'; g.fill(ell(fx, fy, 1.1, 1.1));
          }
        } else {
          const s = 2 + r() * 3.4;
          g.fillStyle = shade(T.rock[1], -0.1); g.fill(ell(px + 0.6, py + 0.9, s, s * 0.7));
          g.fillStyle = T.rock[0]; g.fill(ell(px, py, s, s * 0.7));
          g.fillStyle = T.rock[2]; g.fill(ell(px - s * 0.3, py - s * 0.25, s * 0.4, s * 0.25));
        }
      }
    });
    // bord de la carte : muret de pierres, puis falaise sombre
    const B = HALF - 30;
    g.fillStyle = T.edge;
    if (x0 < -B) g.fillRect(x0, y0, -B - x0, CH);
    if (x0 + CH > B) g.fillRect(B, y0, x0 + CH - B, CH);
    if (y0 < -B) g.fillRect(x0, y0, CH, -B - y0);
    if (y0 + CH > B) g.fillRect(x0, B, CH, y0 + CH - B);
    if (Math.abs(x0) > B - CH * 1.2 || Math.abs(x0 + CH) > B - CH * 0.2 || Math.abs(y0) > B - CH * 1.2 || Math.abs(y0 + CH) > B - CH * 0.2) {
      g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 22; g.strokeRect(-B + 14, -B + 14, B * 2 - 28, B * 2 - 28);
      g.strokeStyle = shade(T.border[3], -0.3); g.lineWidth = 30; g.strokeRect(-B, -B, B * 2, B * 2);
      g.strokeStyle = this.patt(g, this.edgeStones); g.lineWidth = 24; g.strokeRect(-B, -B, B * 2, B * 2);
    }
    c.used = this.tick;
    this.chunks.set(key, c);
    if (this.chunks.size > 22) { // on oublie le morceau le moins récemment vu
      let old = null, ou = Infinity;
      for (const [k, v] of this.chunks) if (v.used < ou) { ou = v.used; old = k; }
      this.chunks.delete(old);
    }
    return c;
  }

  // motif répété (pavés) aligné sur le monde
  patt(g, img) {
    const pt = g.createPattern(img, 'repeat');
    if (pt && pt.setTransform && typeof DOMMatrix === 'function') pt.setTransform(new DOMMatrix().scale(PAVE / img.width));
    return pt || this.T.pave[0];
  }

  drawFeatures(g, x0, y0) {
    const T = this.T, F = this.features, M = 220;
    const near = pts => pts.some(([x, y]) => x > x0 - M && x < x0 + CH + M && y > y0 - M && y < y0 + CH + M);
    const stroke = (pts, w, col) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); };
    for (const b of F.blobs) {
      if (Math.abs(b.x - x0 - CH / 2) > CH / 2 + 320 || Math.abs(b.y - y0 - CH / 2) > CH / 2 + 320) continue;
      g.save(); g.translate(b.x, b.y); g.rotate(b.rot);
      if (b.kind === 'ice') { // lac gelé bordé de pierres
        g.fillStyle = this.patt(g, this.edgeStones); g.fill(ell(0, 0, b.rx + 16, b.ry + 16));
        g.strokeStyle = shade(T.border[3], -0.2); g.lineWidth = 2; g.stroke(ell(0, 0, b.rx + 16, b.ry + 16));
        g.fillStyle = '#ffffff'; g.fill(ell(0, 0, b.rx + 3, b.ry + 3));
        g.fillStyle = rg(g, 0, 0, Math.max(b.rx, b.ry), [T.ice, T.ice, T.ice2]); g.fill(ell(0, 0, b.rx, b.ry));
        g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 2;
        const rr = rng('ice' + b.x);
        for (let i = 0; i < 5; i++) { g.beginPath(); let x = (rr() - 0.5) * b.rx, y = (rr() - 0.5) * b.ry; g.moveTo(x, y); for (let k = 0; k < 3; k++) { x += (rr() - 0.5) * 50; y += (rr() - 0.5) * 30; g.lineTo(x, y); } g.stroke(); }
        g.fillStyle = 'rgba(255,255,255,.6)'; g.fill(ell(-b.rx * 0.4, -b.ry * 0.4, b.rx * 0.32, b.ry * 0.11, -0.3)); g.fill(ell(-b.rx * 0.12, -b.ry * 0.55, b.rx * 0.1, b.ry * 0.05, -0.3));
      } else if (b.kind === 'mist') { // mare du marais : eau sombre, nénuphars, brume
        g.fillStyle = '#1e3a34'; g.fill(ell(0, 4, b.rx + 8, b.ry + 8));
        g.fillStyle = rg(g, 0, 0, b.rx, ['#2a5a4e', '#1e4a40', '#163830']); g.fill(ell(0, 0, b.rx, b.ry));
        g.strokeStyle = 'rgba(90,232,184,.35)'; g.lineWidth = 3; g.stroke(ell(0, 0, b.rx * 0.8, b.ry * 0.8));
        const rr = rng('mist' + b.x);
        for (let i = 0; i < 5; i++) {
          const a = rr() * TAU, d = rr() * 0.7, x = Math.cos(a) * b.rx * d, y = Math.sin(a) * b.ry * d, s = 7 + rr() * 6;
          g.fillStyle = '#3a8a4a'; g.beginPath(); g.moveTo(x, y); g.arc(x, y, s, a + 0.4, a + TAU - 0.2); g.closePath(); g.fill();
          g.fillStyle = '#5ab86a'; g.beginPath(); g.moveTo(x, y); g.arc(x, y, s * 0.7, a + 0.6, a + TAU - 0.4); g.closePath(); g.fill();
          if (rr() < 0.4) { g.fillStyle = '#ff9ad8'; g.fill(ell(x, y, 2.2, 2.2)); }
        }
      }
      g.restore();
    }
    // chemins pavés (bordure de pierres), puis l'eau par-dessus, puis les ponts
    for (const L of F.lines) {
      if (L.kind !== 'path' || !near(L.pts)) continue;
      const pts = L.pts, w = L.w;
      stroke(pts, w + 22, 'rgba(20,10,0,.16)');
      stroke(pts, w + 18, shade(T.border[3], -0.25));
      stroke(pts, w + 14, this.patt(g, this.edgeStones));
      if (T.path === 'dirt') {
        stroke(pts, w, T.pave[0]);
        g.save(); g.setLineDash([3, 19]); stroke(offsetLine(pts, w * 0.2), 4, T.pave[2]); stroke(offsetLine(pts, -w * 0.25), 3, T.pave[1]); g.restore();
      } else if (T.path === 'stones') {
        stroke(pts, w, shade(T.g0, -0.18));
        g.save(); g.setLineDash([22, 14]); stroke(pts, w * 0.75, this.patt(g, this.pave)); g.restore();
      } else stroke(pts, w, this.patt(g, this.pave));
      stroke(offsetLine(pts, -w * 0.5 + 3), 4, 'rgba(0,0,0,.12)');
      if (T.path === 'void') { g.save(); g.globalAlpha = 0.6; stroke(offsetLine(pts, w * 0.5 + 6), 2.4, T.crack); stroke(offsetLine(pts, -w * 0.5 - 6), 2.4, T.crack); g.restore(); }
    }
    for (const L of F.lines) {
      if (!near(L.pts)) continue;
      if (L.kind === 'water') {
        const pts = L.pts, w = L.w;
        stroke(pts, w + 46, shade(T.border[3], -0.25));
        stroke(pts, w + 42, this.patt(g, this.edgeStones));
        stroke(pts, w + 14, '#d8f2ff');
        stroke(pts, w + 8, T.water2);
        stroke(pts, w - 8, T.water);
        stroke(offsetLine(pts, w * 0.14), w * 0.36, shade(T.water, 0.12));
        g.save(); g.globalAlpha = 0.75; g.setLineDash([26, 40]); stroke(offsetLine(pts, -w * 0.28), 3, T.foam); stroke(offsetLine(pts, w * 0.3), 2.4, T.foam); g.restore();
        g.save(); g.globalAlpha = 0.9; g.setLineDash([10, 18]); stroke(offsetLine(pts, w * 0.5 + 2), 4, T.foam); stroke(offsetLine(pts, -w * 0.5 - 2), 4, T.foam); g.restore();
        stroke(offsetLine(pts, -w * 0.5 - 4), 3, 'rgba(10,40,90,.25)');
      } else if (L.kind === 'crack') {
        stroke(L.pts, 16, 'rgba(224,112,255,.18)');
        stroke(L.pts, 7, '#5a1a8a');
        stroke(L.pts, 3, T.crack);
        stroke(L.pts, 1.2, '#ffe0ff');
      }
    }
    for (const b of F.bridges) {
      if (Math.abs(b.x - x0 - CH / 2) > CH / 2 + 200 || Math.abs(b.y - y0 - CH / 2) > CH / 2 + 200) continue;
      g.save(); g.translate(b.x, b.y); g.rotate(b.a);
      const L = b.len, W = b.w;
      g.fillStyle = 'rgba(10,30,60,.35)'; g.fillRect(-L / 2 + 4, -W / 2 + 6, L, W);
      g.fillStyle = '#6a4224'; g.fillRect(-L / 2, -W / 2, L, W);
      for (let x = -L / 2 + 2; x < L / 2 - 2; x += 11) {
        const pl = rrect(x, -W / 2 + 2, 9.4, W - 4, 2);
        g.fillStyle = vg(g, -W / 2, W / 2, ['#d8a068', '#b07840', '#8a5a2e']); g.fill(pl);
        g.strokeStyle = '#4a2a14'; g.lineWidth = 1; g.stroke(pl);
        g.fillStyle = '#3a2210'; g.fill(ell(x + 4.7, -W / 2 + 6, 0.9, 0.9)); g.fill(ell(x + 4.7, W / 2 - 6, 0.9, 0.9));
      }
      for (const sd of [-1, 1]) {
        const rl = rrect(-L / 2 - 4, sd * W / 2 - 4, L + 8, 8, 3);
        g.fillStyle = vg(g, sd * W / 2 - 4, sd * W / 2 + 4, ['#c08850', '#7a4a24']); g.fill(rl); g.strokeStyle = '#3a2010'; g.lineWidth = 1.2; g.stroke(rl);
        for (const x of [-L / 2 - 2, -L / 6, L / 6, L / 2 + 2]) { const po = ell(x, sd * W / 2, 5.4, 5.4); g.fillStyle = '#8a5a30'; g.fill(po); g.strokeStyle = '#3a2010'; g.stroke(po); g.fillStyle = '#c89a68'; g.fill(ell(x - 1.4, sd * W / 2 - 1.4, 2, 2)); }
      }
      g.restore();
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
      if (this.avoid.some(a => Math.hypot(a.x - x, a.y - y) < (a.r || 80))) continue;
      let kind = 'tree';
      if (!edge) { let q = r() * tot; for (const [k, w] of T.props) { q -= w; if (q <= 0) { kind = k; break; } } }
      else if (r() < 0.35) kind = 'rock';
      if (kind !== 'reeds' && this.onFeature(x, y, 16)) continue;
      if (kind === 'reeds' && !this.onFeature(x, y, 30) && r() < 0.7) continue;
      const v = (r() * 3) | 0, spr = this.propSpr[kind]?.[v];
      if (!spr) continue;
      out.push({ x, y, spr, flip: kind !== 'tower' && kind !== 'banner' && r() < 0.5, s: 0.85 + r() * 0.35 + (edge ? 0.25 : 0), kind, tall: spr.meta.h > 50, light: spr.meta.light, ph: r() * TAU });
    }
    return out;
  }
}

// pont au croisement d'un chemin (a-b) et d'une rivière (c-d) : il enjambe l'eau et ses berges, quel que soit l'angle
function bridge(a, b, c, d, q, pw, span) {
  const ap = Math.atan2(b[1] - a[1], b[0] - a[0]), aw = Math.atan2(d[1] - c[1], d[0] - c[0]);
  return { x: q[0], y: q[1], a: ap, len: span / Math.max(0.45, Math.abs(Math.sin(ap - aw))), w: pw * 0.82 };
}

// intersection de deux segments (ou null)
function segX(a, b, c, d) {
  const r1x = b[0] - a[0], r1y = b[1] - a[1], r2x = d[0] - c[0], r2y = d[1] - c[1], den = r1x * r2y - r1y * r2x;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c[0] - a[0]) * r2y - (c[1] - a[1]) * r2x) / den, u = ((c[0] - a[0]) * r1y - (c[1] - a[1]) * r1x) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [a[0] + r1x * t, a[1] + r1y * t] : null;
}

export { CH };

// Bandeau d'une zone pour la carte des menus : un coin d'arène de ce monde (chemin ou rivière, décor, tour).
const banners = new Map();
export function zoneBannerURL(zone) {
  if (banners.has(zone.id)) return banners.get(zone.id);
  const W = 360, H = 120, res = 2, x0 = 60, y0 = 190;
  const T = THEMES[zone.bg] || THEMES.lane, bf = { lines: [], blobs: [], bridges: [] };
  // un chemin en diagonale à gauche (sous le texte), une rivière et son pont pour la Rivière
  const path = [[x0 - 40, y0 + H + 40], [x0 + 70, y0 + 60], [x0 + 150, y0 + 10], [x0 + 240, y0 - 60]];
  if (zone.bg === 'river') { bf.lines.push({ pts: [[x0 + 120, y0 - 60], [x0 + 190, y0 + 60], [x0 + 230, y0 + H + 60]], w: 64, kind: 'water' }); }
  if (zone.bg === 'ice') bf.blobs.push({ x: x0 + 250, y: y0 + 100, rx: 70, ry: 34, rot: 0.1, kind: 'ice' });
  if (zone.bg === 'shadow') bf.blobs.push({ x: x0 + 210, y: y0 + 96, rx: 60, ry: 26, rot: 0.1, kind: 'mist' });
  if (zone.bg === 'void') bf.lines.push({ pts: [[x0 + 150, y0 + 130], [x0 + 200, y0 + 80], [x0 + 260, y0 + 90], [x0 + 300, y0 + 40], [x0 + 340, y0 + 50]], w: 8, kind: 'crack' });
  bf.lines.push({ pts: path, w: 56, kind: 'path' });
  for (const A of bf.lines) if (A.kind === 'path') for (const B of bf.lines) if (B.kind === 'water')
    for (let i = 1; i < A.pts.length; i++) for (let j = 1; j < B.pts.length; j++) { const q = segX(A.pts[i - 1], A.pts[i], B.pts[j - 1], B.pts[j]); if (q) bf.bridges.push(bridge(A.pts[i - 1], A.pts[i], B.pts[j - 1], B.pts[j], q, A.w, B.w + 70)); }
  const w = new World2D(zone, res, [], bf);
  const c = cnv(W * res, H * res), g = c.getContext('2d');
  g.setTransform(res, 0, 0, res, -x0 * res, -y0 * res);
  g.drawImage(w.bakeChunk(0, 0), 0, 0, CH, CH);
  // petit diorama : le décor typique de la zone, surtout à droite (la gauche porte le texte)
  const r = rng('banner' + zone.id), kinds = T.props.map(p => p[0]).filter(k => k !== 'tower' && k !== 'banner' && k !== 'reeds');
  const spots = [[0.5, 0.42, 0.65], [0.6, 1.0, 0.85], [0.72, 0.5, 0.75, 'tree'], [0.83, 1.1, 1.05, 'tree'], [0.95, 0.55, 0.85, 'tree'], [1.02, 1.08, 0.9]];
  if (w.propSpr.tower) spots.splice(2, 0, [0.69, 0.78, 0.62, 'tower']);
  else if (w.propSpr.banner) spots.splice(2, 0, [0.68, 0.8, 0.8, 'banner']);
  for (let [sx, sy, sc, kind] of spots) {
    const k = kind || kinds[(r() * kinds.length) | 0], arr = w.propSpr[k] || w.propSpr.tree, s = arr[(r() * 3) | 0];
    // jamais dans la rivière, sur le lac ou dans la mare
    for (let i = 0; i < 4 && w.onFeature(x0 + sx * W, y0 + sy * H, 6); i++) sx += 0.08;
    const fx = k === 'tower' || k === 'banner' ? 1 : r() < 0.5 ? -1 : 1;
    g.setTransform(res * sc * fx, 0, 0, res * sc, sx * W * res, sy * H * res);
    g.globalAlpha = 0.28; g.fillStyle = '#000'; g.beginPath(); g.ellipse(0, 0, s.meta.w * 0.42, s.meta.w * 0.14, 0, 0, TAU); g.fill(); g.globalAlpha = 1;
    g.drawImage(s.c, -s.ax, -s.ay, s.w, s.h);
  }
  // lumière douce en haut à gauche, comme une arène au soleil
  g.setTransform(res, 0, 0, res, 0, 0);
  const sun = g.createLinearGradient(0, 0, W, H); sun.addColorStop(0, 'rgba(255,250,220,.18)'); sun.addColorStop(0.6, 'rgba(255,250,220,0)'); sun.addColorStop(1, 'rgba(0,0,40,.12)');
  g.fillStyle = sun; g.fillRect(0, 0, W, H);
  if (T.dark) { g.fillStyle = `rgba(8,2,20,${T.dark * 0.35})`; g.fillRect(0, 0, W, H); }
  const url = c.toDataURL('image/jpeg', 0.86);
  banners.set(zone.id, url);
  return url;
}
