// Moteur de pixel art : grilles de caractères -> canvas, + générateur procédural de créatures.

export function rng(seed) {
  let s = typeof seed === 'string' ? hash(seed) : seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// grid: tableau de chaînes ; pal: { char: couleur }
export function gridToCanvas(grid, pal, scale = 1) {
  const h = grid.length, w = Math.max(...grid.map(r => r.length));
  const c = document.createElement('canvas');
  c.width = w * scale; c.height = h * scale;
  const g = c.getContext('2d');
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ch = grid[y][x];
    if (!ch || ch === '.' || ch === ' ') continue;
    const col = pal[ch];
    if (!col) continue;
    g.fillStyle = col;
    g.fillRect(x * scale, y * scale, scale, scale);
  }
  return c;
}

const cache = new Map();
export function cachedURL(key, make) {
  if (!cache.has(key)) cache.set(key, make().toDataURL());
  return cache.get(key);
}

export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = amt < 0 ? 0 : 255, p = Math.abs(amt);
  r = Math.round((f - r) * p + r); g = Math.round((f - g) * p + g); b = Math.round((f - b) * p + b);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

// ---------- Créatures procédurales ----------
// Masques de silhouette (demi-largeur, symétrie miroir). 2 = toujours, 1 = aléatoire, 0 = vide.
const BODIES = {
  blob: [
    '00000000', '00000000', '00000111', '00001222', '00012222', '00122222', '00122222', '01222222',
    '01222222', '01222222', '12222222', '12222222', '12222222', '01222222', '00122222', '00011111',
  ],
  humanoid: [
    '00000011', '00000122', '00000122', '00000122', '00000012', '00011222', '00122222', '01212222',
    '01102222', '01102222', '00002222', '00001222', '00001221', '00001201', '00001201', '00011011',
  ],
  golem: [
    '00000000', '00000111', '00001222', '00012222', '01122222', '12222222', '12222222', '12212222',
    '12212222', '11212222', '01212222', '00122222', '00122222', '00122122', '00122012', '00111011',
  ],
  beast: [
    '00000000', '01000000', '01100000', '01210111', '01222222', '00122222', '00122222', '01222222',
    '12222222', '12222222', '12222222', '01222222', '00122122', '00122012', '00122012', '00111011',
  ],
  bird: [
    '00000001', '00000012', '00000122', '00000122', '10001222', '21012222', '22122222', '12222222',
    '01222222', '00122222', '00012222', '00001222', '00000122', '00000121', '00000121', '00001101',
  ],
  crab: [
    '00000000', '11000000', '22100000', '12100000', '01210000', '00121111', '00122222', '01222222',
    '12222222', '12222222', '12222222', '01222222', '00121212', '01201021', '12010012', '10000001',
  ],
  ghost: [
    '00000111', '00011222', '00122222', '01222222', '01222222', '12222222', '12222222', '12222222',
    '12222222', '12222222', '12222222', '12222222', '12222222', '12212221', '12102120', '11001010',
  ],
  worm: [
    '00000000', '00011100', '00122210', '01222221', '01222222', '01222222', '00122222', '00012222',
    '00001222', '00001222', '00012222', '00122221', '01222210', '01222100', '00122210', '00011111',
  ],
};

// Génère une créature 16x16 (ou plus grande si boss) avec contour, ombrage, yeux.
export function makeCreature(seed, body, pal, { boss = false } = {}) {
  const r = rng(seed);
  const mask = BODIES[body] || BODIES.blob;
  const H = 16, W = 16;
  const cells = Array.from({ length: H }, () => new Array(W).fill(0));
  for (let y = 0; y < H; y++) for (let x = 0; x < 8; x++) {
    const m = +mask[y][x];
    const on = m === 2 ? 1 : m === 1 ? (r() > 0.45) : 0;
    if (on) { cells[y][x] = 1; cells[y][15 - x] = 1; }
  }
  // colonne centrale toujours pleine là où le masque est plein
  for (let y = 0; y < H; y++) if (mask[y][7] === '2') { cells[y][7] = 1; cells[y][8] = 1; }

  // couleurs : 1 base, 2 ombre, 3 lumière, k contour
  const [base, dark, light] = pal;
  const out = Array.from({ length: H + 2 }, () => new Array(W + 2).fill('.'));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (cells[y][x]) {
    let c = '1';
    const above = y > 0 && cells[y - 1][x], below = y < H - 1 && cells[y + 1][x];
    if (!above) c = '3';
    else if (!below || y > H * 0.72) c = '2';
    else if (x < W / 2 && !(x > 0 && cells[y][x - 1])) c = '3';
    else if (x >= W / 2 && !(x < W - 1 && cells[y][x + 1])) c = '2';
    out[y + 1][x + 1] = c;
  }
  // motif (taches) symétrique
  for (let y = 1; y <= H; y++) for (let x = 1; x <= 8; x++) {
    if (out[y][x] === '1' && out[y][W + 1 - x] === '1' && r() < 0.07) { out[y][x] = 'a'; out[y][W + 1 - x] = 'a'; }
  }
  // contour
  for (let y = 0; y < H + 2; y++) for (let x = 0; x < W + 2; x++) {
    if (out[y][x] !== '.') continue;
    const n = [[0, 1], [1, 0], [0, -1], [-1, 0]].some(([dx, dy]) => {
      const v = out[y + dy]?.[x + dx]; return v && v !== '.' && v !== 'k';
    });
    if (n) out[y][x] = 'k';
  }
  // yeux : première rangée où la largeur pleine >= 6 dans la moitié haute
  let eyeY = -1;
  for (let y = 2; y < 10; y++) {
    let w = 0; for (let x = 1; x <= W; x++) if ('123a'.includes(out[y][x])) w++;
    if (w >= 6) { eyeY = y + 1; break; }
  }
  if (eyeY > 0) {
    let left = 1; while (left <= W && !'123a'.includes(out[eyeY][left])) left++;
    const span = (W + 2 - left * 2);
    const ex = left + Math.max(1, Math.floor(span * 0.22));
    const ex2 = W + 1 - ex;
    const angry = boss || r() < 0.4;
    for (const xx of [ex, ex2]) {
      out[eyeY][xx] = 'e'; out[eyeY + 1][xx] = 'p';
      if (angry) out[eyeY - 1][xx] = 'k';
    }
    // bouche
    if (r() < 0.7 && out[eyeY + 3]) {
      const my = eyeY + 3;
      for (let x = 7; x <= 10; x++) if ('123a'.includes(out[my][x])) out[my][x] = 'm';
      if (r() < 0.6) { if (out[my + 1]?.[7] && '123a'.includes(out[my + 1][7])) out[my + 1][7] = 'w'; if (out[my + 1]?.[10] && '123a'.includes(out[my + 1][10])) out[my + 1][10] = 'w'; }
    }
  }
  const colors = {
    1: base, 2: dark, 3: light, a: shade(dark, -0.15), k: '#1a1424',
    e: '#ffffff', p: boss ? '#ff2a2a' : '#1a1424', m: '#2a1020', w: '#ffffff',
  };
  return { grid: out.map(r => r.join('')), colors };
}

export function creatureURL(seed, body, pal, opts) {
  return cachedURL(`cr:${seed}:${body}:${pal.join()}:${opts?.boss}`, () => {
    const { grid, colors } = makeCreature(seed, body, pal, opts);
    return gridToCanvas(grid, colors, 1);
  });
}

// Créature en canvas + version blanche (flash quand touchée)
export function creatureCanvases(seed, body, pal, opts) {
  const { grid, colors } = makeCreature(seed, body, pal, opts);
  const img = gridToCanvas(grid, colors, 1);
  const white = {}; for (const k of Object.keys(colors)) white[k] = '#ffffff';
  const flash = gridToCanvas(grid, white, 1);
  return { img, flash };
}
