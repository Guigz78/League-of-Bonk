// Plan de chaque monde : couleurs du thème, chemins, rivières, lacs gelés, mares et failles (coordonnées du jeu),
// tirés d'une graine fixe : identiques d'une partie à l'autre. Lu par world.js (sol, décor, ponts).
import { HALF } from '../data.js';

const TAU = Math.PI * 2;

// ---------- Thèmes ----------
// g0/g1/g2 : herbe, tuft : brins, pave : pavés [base, clair, sombre, joints], border : pierres de bordure,
// props : décor en relief [sorte, poids] (world.js peut nuancer ces couleurs avec LOOK.t)
export const THEMES = {
  lane: {
    g0: '#6cbf4a', g1: '#5eae3e', g2: '#84d05e', tuft: '#4a9a34', tuft2: '#9ade6a',
    path: 'cobble', pave: ['#e8d6a8', '#fff2cc', '#b89c6c', '#a08458'], border: ['#a8a090', '#d4ccbc', '#6e665a', '#4e463c'],
    flowers: ['#ffe45a', '#ff8ab0', '#ffffff', '#9ad0ff'],
    tree: 'round', leaf: ['#4caa3a', '#2c7a2a', '#8ada5e'], trunk: '#8a5a32', rock: ['#b4b8c8', '#7a7e92', '#e2e6f0'],
    roof: ['#4a8af0', '#a8d0ff', '#2448a8'], flag: '#3a7ae8', moss: '#7ac84a',
    props: [['tree', 3], ['bush', 2.4], ['rock', 2], ['tower', 0.35], ['banner', 0.45]], ambient: 'leaf', dark: 0,
  },
  jungle: {
    g0: '#4a9a3a', g1: '#3e8832', g2: '#62b04c', tuft: '#2e7026', tuft2: '#7cc85a',
    path: 'dirt', pave: ['#b08a5a', '#d8b484', '#7e5c36', '#6a4a2a'], border: ['#8a9a7a', '#bccaa8', '#56664a', '#3a4632'],
    flowers: ['#ff5a7a', '#ffd04a', '#c06aff'],
    tree: 'jungle', leaf: ['#2f9a44', '#1a6a2c', '#6ccc5a'], trunk: '#7a4e2a', rock: ['#9aaa8a', '#66745a', '#c8d8b0'],
    roof: ['#d8503a', '#ffa08a', '#8a2416'], flag: '#e8483a', moss: '#5ab84a',
    props: [['tree', 4], ['bush', 3], ['mushroom', 1.4], ['rock', 1], ['banner', 0.3]], ambient: 'firefly', dark: 0.1,
  },
  river: {
    g0: '#7ccc5a', g1: '#6cbc4c', g2: '#9ade72', tuft: '#4e9a3c', tuft2: '#b4ea8a',
    path: 'cobble', pave: ['#e0dcd0', '#fffaf0', '#a8a294', '#8a8478'], border: ['#a8a090', '#d8d0c0', '#6a6256', '#4a443a'],
    water: '#3aaaf0', water2: '#1f7ad0', foam: '#e8fbff', flowers: ['#ffffff', '#ffe45a', '#ff9ad0'],
    tree: 'palm', leaf: ['#4aaa4a', '#2a7a34', '#8ada64'], trunk: '#b08050', rock: ['#bcb4a4', '#867e70', '#e6dece'],
    roof: ['#3a9ae8', '#a8e0ff', '#1a5aa8'], flag: '#2a8ae0', moss: '#7ac84a',
    props: [['tree', 2.4], ['reeds', 2.4], ['rock', 2], ['bush', 1.4], ['tower', 0.3], ['banner', 0.3]], ambient: 'bubble', dark: 0,
  },
  ice: {
    g0: '#e6f1fb', g1: '#d2e4f4', g2: '#fafdff', tuft: '#b4cce4', tuft2: '#ffffff',
    path: 'cobble', pave: ['#bcd0e4', '#eaf4ff', '#8aa0bc', '#7088a6'], border: ['#90a4bc', '#c8d8ea', '#5e7290', '#465872'],
    ice: '#a8e0fa', ice2: '#6ac0ec', flowers: ['#9ad8ff', '#ffffff'],
    tree: 'pine', leaf: ['#3e8a7a', '#245a52', '#6ab89c'], trunk: '#7a5440', rock: ['#a4b8d0', '#6a809e', '#e0ecf8'],
    roof: ['#3a7ae8', '#a8ccff', '#1a48a8'], flag: '#3a8ae8', moss: '#ffffff',
    props: [['tree', 3], ['rock', 2], ['icecrystal', 1.6], ['bush', 0.6], ['tower', 0.3], ['banner', 0.25]], ambient: 'snow', dark: 0,
  },
  shadow: {
    g0: '#3c6058', g1: '#30524a', g2: '#4a7468', tuft: '#24443c', tuft2: '#5e9282',
    path: 'stones', pave: ['#7e8e8a', '#b0c0bc', '#4e5c58', '#3a4644'], border: ['#5e6c6a', '#8a9a98', '#3a4644', '#28302e'],
    mist: '#5ae8b8', flowers: ['#5ae8b8', '#a0fff0'],
    tree: 'dead', leaf: ['#4a4a5a', '#2a2a36', '#6e6e80'], trunk: '#44444e', rock: ['#6a7a78', '#45524f', '#98aaa6'],
    roof: ['#3a8a7a', '#8ae8c8', '#1a4a40'], flag: '#3ab890', moss: '#5ab890',
    props: [['tree', 3], ['grave', 2.4], ['lantern', 1], ['rock', 1.4]], ambient: 'mist', dark: 0.42,
  },
  void: {
    g0: '#3a2058', g1: '#2e1848', g2: '#4a2c70', tuft: '#24103a', tuft2: '#7a4ab0',
    path: 'void', pave: ['#4e3a72', '#7a62a8', '#2e2048', '#22163a'], border: ['#3a2a58', '#6a58a0', '#22163a', '#160e28'],
    crack: '#e070ff', flowers: ['#e070ff', '#7ad0ff'],
    tree: 'crystal', leaf: ['#b05aff', '#7428c8', '#f0b8ff'], trunk: '#2a1440', rock: ['#5a4a7a', '#362a50', '#8a7ab0'],
    roof: ['#a04ae8', '#e0a8ff', '#5a1a98'], flag: '#c050ff', moss: '#e070ff',
    props: [['tree', 2.4], ['tentacle', 1.6], ['rock', 2], ['vcrystal', 1.2]], ambient: 'void', dark: 0.5,
  },
};

// ---------- Plan ----------
// chemins, rivières, lacs… du monde de thème bg ; r : générateur de la graine 'w2d' + id de zone (ne pas changer :
// le plan de chaque monde en dépend)
export function makeFeatures(bg, r) {
  const f = { lines: [], blobs: [], bridges: [] };
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

// chemin, eau, lac ou mare sous le point (x, y) à pad près, ou null (pour ne pas planter d'arbre dans la rivière)
export function onFeature(F, x, y, pad = 0) {
  for (const L of F.lines) {
    if (L.kind === 'crack') continue;
    const p = L.pts, extra = L.kind === 'water' ? 22 : 10;
    for (let i = 1; i < p.length; i++) {
      const [ax, ay] = p[i - 1], [bx, by] = p[i];
      const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2));
      if (Math.hypot(x - ax - dx * t, y - ay - dy * t) < L.w / 2 + extra + pad) return L;
    }
  }
  for (const b of F.blobs) {
    if (b.kind !== 'ice' && b.kind !== 'mist') continue;
    const c = Math.cos(-b.rot), s = Math.sin(-b.rot), lx = (x - b.x) * c - (y - b.y) * s, ly = (x - b.x) * s + (y - b.y) * c;
    if ((lx / (b.rx + 12 + pad)) ** 2 + (ly / (b.ry + 12 + pad)) ** 2 < 1) return b;
  }
  return null;
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
