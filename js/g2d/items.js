// Objets, décor du monde et textures d'effets 2D (façon Clash Royale : volumes peints, contour fin et sombre) :
// gemmes, pièces, cœurs, coffres, autels, autel du boss, portail, totems de défi, coffres de butin,
// projectiles, textures de lueur, de tourbillon et de rayon.
// Indépendant de sprites.js : ses propres aides de dessin (réutilisées par world.js).

const TAU = Math.PI * 2;
export const INK = '#1a1030';

// ---------- Aides de dessin ----------
export function cnv(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
  return c;
}
export const P = () => new Path2D();
export function ell(x, y, rx, ry, rot = 0) { const p = P(); p.ellipse(x, y, rx, ry, rot, 0, TAU); return p; }
export function rrect(x, y, w, h, r) {
  const p = P(); r = Math.min(r, w / 2, h / 2);
  p.moveTo(x + r, y); p.arcTo(x + w, y, x + w, y + h, r); p.arcTo(x + w, y + h, x, y + h, r);
  p.arcTo(x, y + h, x, y, r); p.arcTo(x, y, x + w, y, r); p.closePath();
  return p;
}
export function poly(pts) { const p = P(); pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y))); p.closePath(); return p; }
export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = amt < 0 ? 0 : 255, p = Math.abs(amt);
  r = Math.round((f - r) * p + r); g = Math.round((f - g) * p + g); b = Math.round((f - b) * p + b);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}
export function vg(g, y0, y1, cols) { const gr = g.createLinearGradient(0, y0, 0, y1); cols.forEach((c, i) => gr.addColorStop(i / (cols.length - 1), c)); return gr; }
export function rg(g, x, y, r, cols, x0 = x, y0 = y) { const gr = g.createRadialGradient(x0, y0, 0, x, y, r); cols.forEach((c, i) => gr.addColorStop(i / (cols.length - 1), c)); return gr; }
// volume doux : base en dégradé (lumière chaude en haut à gauche), ombre portée interne, reflet, contour sombre de la teinte
export function blob(g, path, base, { dark = shade(base, -0.32), light = shade(base, 0.38), y0 = -20, y1 = 0, hl = null, line = 1, ink = null, ao = 0.18 } = {}) {
  g.fillStyle = vg(g, y0, y1, [light, base, dark]); g.fill(path);
  if (ao) { g.save(); g.clip(path); g.translate(-1.6, -1.8); g.lineWidth = 3; g.strokeStyle = `rgba(20,8,30,${ao})`; g.stroke(path); g.restore(); }
  if (hl) { g.save(); g.clip(path); g.fillStyle = '#ffffff'; g.globalAlpha = hl.a ?? 0.55; g.fill(ell(hl.x, hl.y, hl.rx, hl.ry, hl.rot || 0)); g.restore(); }
  if (line) { g.lineWidth = line; g.strokeStyle = ink || shade(base, -0.62); g.stroke(path); }
}
// ancienne aide (ombrage en aplats), gardée pour les petits objets
export function fillShaded(g, path, base, { dark = shade(base, -0.28), light = shade(base, 0.35), off = 2.4, hl = null, line = 1.1 } = {}) {
  g.fillStyle = dark; g.fill(path);
  g.save(); g.clip(path); g.translate(-off * 0.6, -off); g.fillStyle = base; g.fill(path); g.restore();
  if (hl) { g.save(); g.clip(path); g.fillStyle = light; g.globalAlpha = hl.a ?? 0.85; g.fill(ell(hl.x, hl.y, hl.rx, hl.ry, hl.rot || 0)); g.restore(); }
  if (line) { g.lineWidth = line; g.strokeStyle = shade(base, -0.6); g.stroke(path); }
}
export function glowDot(g, x, y, r, col) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r * 2.4);
  gr.addColorStop(0, col); gr.addColorStop(0.35, col + 'aa'); gr.addColorStop(1, col + '00');
  g.fillStyle = gr; g.fillRect(x - r * 2.4, y - r * 2.4, r * 4.8, r * 4.8);
  g.fillStyle = '#ffffff'; g.fill(ell(x, y, r * 0.55, r * 0.55));
}
export function star4(g, x, y, r, col) {
  g.fillStyle = col; g.beginPath();
  g.moveTo(x, y - r); g.quadraticCurveTo(x, y, x + r, y); g.quadraticCurveTo(x, y, x, y + r); g.quadraticCurveTo(x, y, x - r, y); g.quadraticCurveTo(x, y, x, y - r);
  g.fill();
}

// Cuisson d'un sprite : dessin + fin contour sombre autour de la silhouette.
// W×H : boîte en unités du monde, (ax, ay) : point d'ancrage (les pieds) dans la boîte.
export function bake(W, H, ax, ay, res, draw, { outline = 1.4, col = INK, glow = null } = {}) {
  const pad = outline + 2 + (glow ? glow.r : 0);
  const cw = (W + pad * 2) * res, ch = (H + pad * 2) * res;
  const art = cnv(cw, ch), g = art.getContext('2d');
  g.setTransform(res, 0, 0, res, (ax + pad) * res, (ay + pad) * res);
  g.lineJoin = 'round'; g.lineCap = 'round';
  draw(g);
  const out = cnv(cw, ch), q = out.getContext('2d');
  if (outline > 0 || glow) {
    const sil = cnv(cw, ch), s = sil.getContext('2d');
    s.drawImage(art, 0, 0); s.globalCompositeOperation = 'source-in'; s.fillStyle = glow ? glow.c : col; s.fillRect(0, 0, cw, ch);
    if (glow) { q.save(); q.shadowColor = glow.c; q.shadowBlur = glow.r * res * 1.6; q.shadowOffsetX = cw * 3; q.globalAlpha = glow.a ?? 0.7; q.drawImage(sil, -cw * 3, 0); q.drawImage(sil, -cw * 3, 0); q.restore(); }
    if (outline > 0) {
      if (glow) { s.globalCompositeOperation = 'source-in'; s.fillStyle = col; s.fillRect(0, 0, cw, ch); }
      const r = outline * res;
      for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; q.drawImage(sil, Math.cos(a) * r, Math.sin(a) * r); }
    }
  }
  q.drawImage(art, 0, 0);
  return { c: out, w: cw / res, h: ch / res, ax: ax + pad, ay: ay + pad };
}
// variante éteinte (désaturée, plus sombre) d'un sprite déjà cuit
function dimmed(s) {
  const c = cnv(s.c.width, s.c.height), q = c.getContext('2d');
  q.drawImage(s.c, 0, 0);
  q.globalCompositeOperation = 'saturation'; q.fillStyle = '#808080'; q.fillRect(0, 0, c.width, c.height);
  q.globalCompositeOperation = 'multiply'; q.fillStyle = '#8a8898'; q.fillRect(0, 0, c.width, c.height);
  q.globalCompositeOperation = 'destination-in'; q.drawImage(s.c, 0, 0);
  return { ...s, c };
}

// ---------- Runes (autel, arène, portail) ----------
const RUNES = [
  [[[0, -1], [0, 1]], [[0, -0.3], [0.7, -1]], [[0, 0.15], [0.7, -0.55]]],
  [[[-0.5, 1], [-0.5, -1], [0.55, -0.3], [-0.5, 0.35]]],
  [[[-0.6, -1], [0.6, 1]], [[0.6, -1], [-0.6, 1]], [[-0.7, 0], [0.7, 0]]],
  [[[0, -1], [0, 1]], [[-0.65, -0.45], [0, 0.1], [0.65, -0.45]]],
  [[[-0.65, 1], [0, -1], [0.65, 1]], [[-0.35, 0.25], [0.35, 0.25]]],
  [[[0, -1], [0.65, -0.4], [0, 0.2], [0.65, 0.8]], [[0, -1], [0, 1]]],
  [[[-0.6, -0.55], [0, -1], [0.6, -0.55], [0.6, 0.55], [0, 1], [-0.6, 0.55], [-0.6, -0.55]], [[0, -0.4], [0, 0.4]]],
  [[[-0.6, -1], [-0.6, 1], [0.6, -1], [0.6, 1]]],
];
export function rune(g, k, s) {
  g.beginPath();
  for (const line of RUNES[k % RUNES.length]) line.forEach(([x, y], i) => (i ? g.lineTo(x * s, y * s) : g.moveTo(x * s, y * s)));
  g.stroke();
}
export const RUNE_N = RUNES.length;

// ---------- Objets ----------
// les sprites ne dépendent que de la résolution (sauf la butte de terre, couleur du monde) : gardés d'un monde à l'autre
const spriteCache = new Map();
export function itemSprites(res, T) {
  let base = spriteCache.get(res);
  if (!base) { if (spriteCache.size > 2) spriteCache.clear(); spriteCache.set(res, base = baseSprites(res)); }
  const S = { ...base };
  S.mound = bake(50, 26, 25, 20, res, g => {
    const c = T.rock;
    const p = P(); p.moveTo(-22, 0); p.bezierCurveTo(-18, -16, 18, -16, 22, 0); p.quadraticCurveTo(0, 4, -22, 0); p.closePath();
    blob(g, p, c[1], { dark: shade(c[1], -0.4), light: c[0], y0: -14, y1: 0, hl: { x: -6, y: -9, rx: 6, ry: 2, a: 0.5 } });
    g.fillStyle = c[0]; for (const [x, y] of [[-12, -4], [8, -7], [14, -3], [-3, -10]]) g.fill(ell(x, y, 2.4, 1.8));
  }, { outline: 1.4 });
  return S;
}

function baseSprites(res) {
  const S = {};
  const gem = (col, dark, light, s) => bake(14 * s, 18 * s, 7 * s, 17 * s, res, g => {
    g.scale(s, s);
    const p = poly([[0, -17], [6.5, -9], [0, -1], [-6.5, -9]]);
    blob(g, p, col, { dark, light, y0: -17, y1: -1, hl: { x: -2.4, y: -11, rx: 1.4, ry: 3.4, rot: 0.6, a: 0.95 }, line: 0.9, ao: 0 });
    g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(-6.5, -9); g.lineTo(6.5, -9); g.moveTo(0, -17); g.lineTo(0, -1); g.stroke();
  }, { outline: 1.2 });
  S.gem = [gem('#4fb8ff', '#2a6ad8', '#e0f6ff', 0.75), gem('#5ae87a', '#21904a', '#e0ffe8', 0.9), gem('#c06aff', '#7a2ad8', '#f4e0ff', 1.05), gem('#ff4a6a', '#b0203a', '#ffd8e0', 1.3)];
  S.coin = bake(14, 14, 7, 14, res, g => {
    blob(g, ell(0, -7, 6.5, 6.5), '#ffd040', { dark: '#c8860c', light: '#fff6b8', y0: -13, y1: -1, hl: { x: -2, y: -9.6, rx: 2, ry: 1.4, a: 0.95 }, line: 1, ao: 0 });
    g.strokeStyle = '#c8860c'; g.lineWidth = 1.2; g.stroke(ell(0, -7, 4, 4));
    g.fillStyle = '#c8860c'; g.fillRect(-0.7, -9.5, 1.4, 5);
  }, { outline: 1.2 });
  S.heart = bake(20, 18, 10, 17, res, g => {
    const p = P(); p.moveTo(0, -1); p.bezierCurveTo(-11, -7.5, -9, -17.5, 0, -12.5); p.bezierCurveTo(9, -17.5, 11, -7.5, 0, -1); p.closePath();
    blob(g, p, '#ff4a6a', { dark: '#b0203a', light: '#ffe0e6', y0: -16, y1: -1, hl: { x: -4, y: -12, rx: 2.2, ry: 1.5, rot: -0.5, a: 0.95 } });
  }, { outline: 1.4 });
  S.magnet = bake(22, 20, 11, 18, res, g => {
    g.lineCap = 'butt';
    g.strokeStyle = INK; g.lineWidth = 8; g.beginPath(); g.arc(0, -10, 7, Math.PI, 0); g.lineTo(7, -2); g.moveTo(-7, -10); g.lineTo(-7, -2); g.stroke();
    g.strokeStyle = '#e8384a'; g.lineWidth = 5.4; g.beginPath(); g.arc(0, -10, 7, Math.PI, 0); g.lineTo(7, -5); g.moveTo(-7, -10); g.lineTo(-7, -5); g.stroke();
    g.strokeStyle = '#e8eef8'; g.beginPath(); g.moveTo(-7, -5); g.lineTo(-7, -2); g.moveTo(7, -5); g.lineTo(7, -2); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 1.4; g.beginPath(); g.arc(0, -10, 7, Math.PI * 1.1, Math.PI * 1.5); g.stroke();
  }, { outline: 1.2 });
  // coffres d'amélioration de la partie (payants : bleus à pièce d'or ; d'élite : violets à étoile), à ne pas confondre avec le butin
  S.chest = [upChest(res, false, false), upChest(res, false, true)];
  S.gchest = [upChest(res, true, false), upChest(res, true, true)];
  // coffres de butin (bois, argent, or, mythique)
  S.loot = [0, 1, 2, 3].map(t => chestSpr(res, t, false, [0.95, 1, 1.08, 1.18][t]));
  S.shrine = bake(44, 34, 22, 30, res, g => {
    blob(g, rrect(-18, -9, 36, 9, 3), '#9a9ab4', { y0: -9, y1: 0 });
    blob(g, rrect(-11, -25, 22, 17, 3), '#b8b8cc', { y0: -25, y1: -8, hl: { x: -6, y: -19, rx: 2, ry: 5, a: 0.5 } });
    blob(g, rrect(-15, -28, 30, 5.5, 2.4), '#9a9ab4', { y0: -28, y1: -22 });
    g.strokeStyle = '#4fd0ff'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-4, -20); g.lineTo(0, -13); g.lineTo(4, -20); g.stroke();
  }, { outline: 1.4 });
  const crys = (c, d, l) => bake(20, 30, 10, 28, res, g => {
    blob(g, poly([[0, -28], [7, -16], [0, -2], [-7, -16]]), c, { dark: d, light: l, y0: -28, y1: -2, hl: { x: -2.4, y: -18, rx: 1.6, ry: 5, rot: 0.3, a: 0.95 }, ao: 0 });
    g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(-7, -16); g.lineTo(7, -16); g.stroke();
  }, { outline: 1.3 });
  S.crystal = [crys('#4fd0ff', '#1f8ad8', '#e0faff'), crys('#9a9aae', '#6a6a80', '#d0d0de')];
  S.mine = bake(22, 18, 11, 16, res, g => {
    blob(g, rrect(-3, -7, 6, 7, 2.4), '#f4ead0', { dark: '#c8b898', y0: -7, y1: 0, ao: 0 });
    const cap = P(); cap.moveTo(-10, -5); cap.bezierCurveTo(-10, -17, 10, -17, 10, -5); cap.quadraticCurveTo(0, -2, -10, -5); cap.closePath();
    blob(g, cap, '#6ae84a', { dark: '#2a9a2a', light: '#d0ffb0', y0: -15, y1: -3, hl: { x: -4, y: -11, rx: 3, ry: 1.4, rot: -0.4, a: 0.8 } });
    g.fillStyle = '#ffffff'; g.fill(ell(-4, -9, 1.6, 1.3)); g.fill(ell(3, -12, 1.8, 1.4)); g.fill(ell(5.5, -7.5, 1.2, 1));
  }, { outline: 1.2 });
  // projectiles (dessinés horizontalement, pointe vers la droite, ancrés au centre)
  S.arrow = bake(30, 10, 15, 5, res, g => {
    g.strokeStyle = '#c89a5a'; g.lineWidth = 2; g.beginPath(); g.moveTo(-12, 0); g.lineTo(9, 0); g.stroke();
    fillShaded(g, poly([[8, -3.4], [15, 0], [8, 3.4]]), '#e8f4ff', { dark: '#9ab0c8', off: 0.4, line: 0.8 });
    g.fillStyle = '#ffffff'; g.fill(poly([[-13, 0], [-9, -4], [-6, -4], [-9, 0]])); g.fill(poly([[-13, 0], [-9, 4], [-6, 4], [-9, 0]]));
  }, { outline: 1.1 });
  S.dagger = bake(22, 10, 11, 5, res, g => {
    fillShaded(g, poly([[-2, -2.6], [10, -1], [12, 0], [10, 1], [-2, 2.6]]), '#f0f4fc', { dark: '#a8b4c8', off: 0.5, line: 0.8 });
    fillShaded(g, rrect(-4, -4, 2.6, 8, 1), '#f0c850', { off: 0.3, line: 0.7 });
    fillShaded(g, rrect(-9, -1.4, 5.4, 2.8, 1), '#7a4a2a', { off: 0.3, line: 0.7 });
  }, { outline: 1.1 });
  S.boom = bake(30, 30, 15, 15, res, g => {
    const p = P(); p.moveTo(-12, -9); p.quadraticCurveTo(0, -4, 12, -9); p.quadraticCurveTo(8, -2, 2, 6); p.quadraticCurveTo(0, 0, -2, 6); p.quadraticCurveTo(-8, -2, -12, -9); p.closePath();
    fillShaded(g, p, '#f0c850', { dark: '#b0841a', light: '#fff4b8', off: 1.2, line: 1, hl: { x: -4, y: -6.5, rx: 4, ry: 1, a: 0.8 } });
    g.fillStyle = '#e83a5a'; g.fill(ell(0, -4.6, 2, 1.6));
  }, { outline: 1.2 });
  S.shard = bake(80, 40, 40, 20, res, g => {
    fillShaded(g, poly([[-30, 0], [-6, -14], [36, 0], [-6, 14]]), '#bfeaff', { dark: '#5aa8e0', light: '#ffffff', off: 3, line: 1.2, hl: { x: -4, y: -6, rx: 14, ry: 2.4, a: 0.95 } });
    g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-30, 0); g.lineTo(36, 0); g.stroke();
  }, { outline: 1.6, glow: { c: '#9ad8ff', r: 6, a: 0.8 } });
  S.snow = bake(30, 30, 15, 15, res, g => {
    blob(g, ell(0, 0, 12, 12), '#ffffff', { dark: '#b8d0ea', light: '#ffffff', y0: -12, y1: 12, ao: 0 });
    g.fillStyle = '#dce8f6'; g.fill(ell(4, 4, 2.4, 2)); g.fill(ell(-5, 2, 1.8, 1.4));
  }, { outline: 1.4 });
  Object.assign(S, landmarkSprites(res));
  return S;
}

// ---------- Coffres (bois, argent, or, mythique), comme ceux des menus ----------
const CHEST_PAL = [
  { hi: '#f6c088', a: '#d08a4a', b: '#7a4620', band: '#8a94a8', bandD: '#454d60', lock: '#ffd54a', lockD: '#a8700c', ink: '#3a1c08' },
  { hi: '#ffffff', a: '#dce6f6', b: '#7a8aa8', band: '#55658a', bandD: '#28324c', lock: '#ffd54a', lockD: '#a8700c', ink: '#1c2236' },
  { hi: '#fff6c0', a: '#ffcc3a', b: '#b8740c', band: '#9a4a16', bandD: '#4e2406', lock: '#fff2b8', lockD: '#c08a18', ink: '#4a2604' },
  { hi: '#ffd6f8', a: '#e05ad2', b: '#5a168e', band: '#ffd54a', bandD: '#9a6a0a', lock: '#8af4ff', lockD: '#2a86b8', ink: '#2a0a40' },
];
export const LOOT_GLOW = ['#ffb070', '#cfe4ff', '#ffd84a', '#ff6ad8'];
function chestSpr(res, tier, open, s = 1) {
  const C = CHEST_PAL[tier];
  return bake(36 * s, 34 * s, 18 * s, 30 * s, res, g => {
    g.scale(s, s);
    const straps = (y0, y1) => { for (const x of [-10.5, 7.5]) { g.fillStyle = vg(g, y0, y1, [C.band, C.bandD]); g.fillRect(x, y0, 3, y1 - y0); g.fillStyle = 'rgba(255,255,255,.3)'; g.fillRect(x + 0.6, y0, 0.7, y1 - y0); } };
    if (open) {
      const lid = poly([[-14, -14], [-12, -26], [12, -26], [14, -14]]);
      g.fillStyle = vg(g, -26, -14, [C.b, C.a]); g.fill(lid);
      g.save(); g.clip(lid); straps(-27, -13); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(-15, -19, 30, 6); g.restore();
      g.lineWidth = 1; g.strokeStyle = C.ink; g.stroke(lid);
      g.fillStyle = rg(g, 0, -14, 14, ['#ffffff', LOOT_GLOW[tier], LOOT_GLOW[tier] + '00']); g.fill(ell(0, -14, 14, 4));
    }
    // corps
    const body = rrect(-14, -14, 28, 14, 2.4);
    g.fillStyle = vg(g, -14, 0, [C.a, C.b]); g.fill(body);
    g.save(); g.clip(body);
    if (tier === 0) { g.strokeStyle = 'rgba(60,30,10,.45)'; g.lineWidth = 0.7; for (const y of [-9.5, -5]) { g.beginPath(); g.moveTo(-14, y); g.lineTo(14, y); g.stroke(); } }
    else { g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(-14, -11.5, 28, 1.2); }
    straps(-14, 0);
    g.fillStyle = 'rgba(0,0,0,.24)'; g.fillRect(-14, -2.4, 28, 2.4);
    g.restore();
    g.lineWidth = 1; g.strokeStyle = C.ink; g.stroke(body);
    if (!open) {
      const lid = P(); lid.moveTo(-15, -13); lid.lineTo(-15, -19); lid.bezierCurveTo(-15, -26, -9, -28, 0, -28); lid.bezierCurveTo(9, -28, 15, -26, 15, -19); lid.lineTo(15, -13); lid.closePath();
      g.fillStyle = vg(g, -28, -13, [C.hi, C.a, C.b]); g.fill(lid);
      g.save(); g.clip(lid); straps(-29, -12);
      if (tier === 0) { g.strokeStyle = 'rgba(60,30,10,.4)'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(-15, -20.5); g.quadraticCurveTo(0, -24, 15, -20.5); g.stroke(); }
      g.restore();
      g.lineWidth = 1; g.strokeStyle = C.ink; g.stroke(lid);
      g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1.1; g.beginPath(); g.moveTo(-12, -20); g.quadraticCurveTo(-10, -25.5, -3, -26.2); g.stroke();
    }
    // rebord, serrure, rivets ou gemmes
    const rim = rrect(-15.8, -15.6, 31.6, 3.4, 1.2);
    g.fillStyle = vg(g, -15.6, -12.2, [C.band, C.bandD]); g.fill(rim); g.lineWidth = 0.9; g.strokeStyle = C.ink; g.stroke(rim);
    for (const x of [-9, 9]) {
      if (tier === 3) { g.fillStyle = '#8af4ff'; g.fill(poly([[x, -9.5], [x + 1.6, -7.5], [x, -5.5], [x - 1.6, -7.5]])); g.lineWidth = 0.6; g.strokeStyle = C.ink; g.stroke(poly([[x, -9.5], [x + 1.6, -7.5], [x, -5.5], [x - 1.6, -7.5]])); }
      else { g.fillStyle = tier === 2 ? '#fff2b8' : '#d8e0f0'; g.fill(ell(x, -7.5, 0.9, 0.9)); }
    }
    const ly = open ? -15 : -19;
    const lock = rrect(-3.4, ly, 6.8, 7.4, 1.8);
    g.fillStyle = vg(g, ly, ly + 7.4, [C.lock, C.lockD]); g.fill(lock); g.lineWidth = 0.9; g.strokeStyle = C.ink; g.stroke(lock);
    g.fillStyle = C.ink; g.fill(ell(0, ly + 3, 1, 1)); g.fillRect(-0.45, ly + 3.3, 0.9, 2.2);
    g.fillStyle = 'rgba(255,255,255,.6)'; g.fillRect(-2.3, ly + 1, 1.1, 2.4);
    if (tier === 3 && !open) { g.fillStyle = '#ff9ae8'; g.fill(ell(0, -25.5, 1.8, 1.4)); }
  }, { outline: 1.2 });
}

// coffre d'amélioration (pendant la partie) : bois bleu cerclé d'or, emblème (pièce ou étoile) sur le couvercle
function upChest(res, elite, open) {
  const base = elite ? '#a04ae8' : '#3a7ae8', hi = elite ? '#e0a8ff' : '#9ac8ff', dk = elite ? '#5a1a98' : '#1a3a98', ink = elite ? '#2a0a4a' : '#0a1a4a';
  return bake(40, 40, 20, 34, res, g => {
    const trim = (p, y0, y1) => { g.fillStyle = vg(g, y0, y1, ['#fff2a8', '#ffc83a', '#b8780c']); g.fill(p); g.lineWidth = 0.9; g.strokeStyle = '#5a3a04'; g.stroke(p); };
    if (open) {
      const lid = poly([[-15, -16], [-13, -30], [13, -30], [15, -16]]);
      g.fillStyle = vg(g, -30, -16, [dk, base]); g.fill(lid); g.lineWidth = 1; g.strokeStyle = ink; g.stroke(lid);
      g.fillStyle = rg(g, 0, -16, 15, ['#ffffff', '#fff2a0', 'rgba(255,240,160,0)']); g.fill(ell(0, -16, 15, 4.4));
    }
    const body = rrect(-15, -16, 30, 16, 3);
    g.fillStyle = vg(g, -16, 0, [base, dk]); g.fill(body); g.lineWidth = 1; g.strokeStyle = ink; g.stroke(body);
    g.save(); g.clip(body); g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(-15, -13, 30, 1.4); g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(-15, -3, 30, 3); g.restore();
    for (const x of [-15, 11.5]) trim(rrect(x, -16, 3.5, 16, 1.2), -16, 0);
    if (!open) {
      const lid = P(); lid.moveTo(-16, -15); lid.lineTo(-16, -22); lid.bezierCurveTo(-16, -30, -9, -32, 0, -32); lid.bezierCurveTo(9, -32, 16, -30, 16, -22); lid.lineTo(16, -15); lid.closePath();
      g.fillStyle = vg(g, -32, -15, [hi, base, dk]); g.fill(lid); g.lineWidth = 1; g.strokeStyle = ink; g.stroke(lid);
      g.save(); g.clip(lid); for (const x of [-16, 12.5]) trim(rrect(x, -33, 3.5, 19, 1.2), -33, -14); g.restore();
      g.strokeStyle = 'rgba(255,255,255,.65)'; g.lineWidth = 1.1; g.beginPath(); g.moveTo(-12, -23); g.quadraticCurveTo(-10, -29, -3, -30); g.stroke();
      // emblème : pièce d'or (coffre payant) ou étoile (coffre d'élite)
      if (elite) { const st = P(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 2.6 : 6; if (i) st.lineTo(Math.cos(a) * r, -23.5 + Math.sin(a) * r); else st.moveTo(Math.cos(a) * r, -23.5 + Math.sin(a) * r); } st.closePath(); trim(st, -30, -18); }
      else { trim(ell(0, -23.5, 5.4, 5.4), -29, -18); g.strokeStyle = '#b8780c'; g.lineWidth = 0.9; g.stroke(ell(0, -23.5, 3.4, 3.4)); }
    }
    trim(rrect(-17, -17.6, 34, 3.6, 1.2), -17.6, -14);
    const ly = open ? -17 : -15;
    const lock = rrect(-3.2, ly, 6.4, 7, 1.8); trim(lock, ly, ly + 7);
    g.fillStyle = ink; g.fill(ell(0, ly + 2.8, 1, 1)); g.fillRect(-0.45, ly + 3.1, 0.9, 2.2);
  }, { outline: 1.2 });
}

// ---------- Grands éléments du monde : autel du boss, portail, totems ----------
const STONE = { base: '#9a9286', light: '#d0c8ba', dark: '#5e564c', ink: '#2e2620' };
function landmarkSprites(res) {
  const S = {};
  // dalle ronde de l'autel du boss (posée au sol, vue de dessus), sans ses runes lumineuses
  S.altarBase = bake(184, 184, 92, 92, res, g => {
    g.fillStyle = '#3e342c'; g.fill(ell(0, 6, 84, 84));
    g.fillStyle = rg(g, 0, 0, 84, ['#c4baa8', STONE.base, '#7a7266'], -30, -34); g.fill(ell(0, 0, 82, 82));
    // dalles du pourtour
    g.strokeStyle = STONE.ink; g.lineWidth = 1.4;
    for (let i = 0; i < 14; i++) {
      const a = i / 14 * TAU + 0.1;
      g.beginPath(); g.moveTo(Math.cos(a) * 58, Math.sin(a) * 58); g.lineTo(Math.cos(a) * 82, Math.sin(a) * 82); g.stroke();
      if (i % 3 === 0) { g.fillStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.arc(0, 0, 80, a, a + TAU / 14); g.arc(0, 0, 60, a + TAU / 14, a, true); g.fill(); }
      else if (i % 3 === 1) { g.fillStyle = 'rgba(0,0,0,.08)'; g.beginPath(); g.arc(0, 0, 80, a, a + TAU / 14); g.arc(0, 0, 60, a + TAU / 14, a, true); g.fill(); }
    }
    g.stroke(ell(0, 0, 82, 82));
    // creux central sombre, cercle de runes éteintes
    g.fillStyle = '#3a2a2c'; g.fill(ell(0, 1.5, 58, 58));
    g.fillStyle = rg(g, 0, 0, 56, ['#6a3434', '#4a2428', '#2e161c']); g.fill(ell(0, 0, 56, 56));
    g.lineWidth = 2.2; g.strokeStyle = '#2a1014'; g.stroke(ell(0, 0, 57, 57));
    g.strokeStyle = '#7a3a36'; g.lineWidth = 1.6; g.stroke(ell(0, 0, 44, 44)); g.stroke(ell(0, 0, 30, 30));
    g.lineWidth = 2;
    for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; g.save(); g.translate(Math.cos(a) * 70, Math.sin(a) * 70); g.rotate(a + Math.PI / 2); rune(g, i, 5); g.restore(); }
    // fissures et mousse
    g.strokeStyle = 'rgba(40,30,24,.55)'; g.lineWidth = 1.1;
    for (const [x, y, dx, dy] of [[-62, 30, 12, 8], [48, -50, -8, 14], [20, 68, 10, -6]]) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + dx, y + dy); g.lineTo(x + dx * 1.6, y + dy * 0.4); g.stroke(); }
    for (const [x, y, r] of [[-66, -36, 9], [-58, -46, 6], [70, 28, 7], [34, 72, 8], [-20, 78, 5]]) { g.fillStyle = '#5aa040'; g.fill(ell(x, y, r, r * 0.7)); g.fillStyle = '#8ad060'; g.fill(ell(x - r * 0.25, y - r * 0.25, r * 0.5, r * 0.3)); }
  }, { outline: 1.4 });
  // runes lumineuses de l'autel (texture additive tournante)
  S.altarRunes = runeRing(res, 92, [[70, 10, 5.5, 2.4], [44, 0, 0, 2], [30, 0, 0, 1.4]], '#ff4a3a');
  // socle au crâne cornu (debout), intact ou brisé
  S.altarTop = [false, true].map(broken => bake(80, 96, 40, 90, res, g => {
    // socle de pierre
    const base = poly([[-20, 0], [-17, -26], [17, -26], [20, 0]]);
    blob(g, base, STONE.base, { y0: -26, y1: 0, ink: STONE.ink, hl: { x: -10, y: -16, rx: 3, ry: 9, a: 0.35 } });
    g.strokeStyle = 'rgba(46,38,32,.6)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-18.5, -13); g.lineTo(18.5, -13); g.stroke();
    g.strokeStyle = broken ? '#5a2a2a' : '#ff5a3a'; g.lineWidth = 1.8; g.save(); g.translate(0, -12); rune(g, 3, 5); g.restore();
    if (broken) {
      const top = poly([[-19, -24], [-16, -32], [-9, -27], [-4, -35], [3, -28], [10, -34], [19, -25]]);
      blob(g, top, STONE.base, { y0: -35, y1: -24, ink: STONE.ink, ao: 0 });
      // morceaux de crâne au pied du socle
      g.fillStyle = vg(g, -12, 0, ['#fff8e8', '#d8ccb0', '#a89a7c']);
      const sk = P(); sk.moveTo(14, -2); sk.bezierCurveTo(14, -14, 30, -14, 31, -3); sk.closePath(); g.fill(sk); g.lineWidth = 1; g.strokeStyle = '#4a3a2a'; g.stroke(sk);
      g.fillStyle = '#2a0a10'; g.fill(ell(23, -6, 3, 3));
      for (const [x, y, r] of [[-24, -2, 4], [-17, 1, 2.6], [26, 2, 2.4]]) blob(g, ell(x, y, r, r * 0.75), STONE.base, { y0: y - r, y1: y + r, ink: STONE.ink, ao: 0 });
      return;
    }
    blob(g, rrect(-21, -31, 42, 7, 2.4), STONE.base, { y0: -31, y1: -24, ink: STONE.ink, ao: 0 });
    // cornes
    for (const sd of [-1, 1]) {
      const h = P(); h.moveTo(sd * 11, -60); h.bezierCurveTo(sd * 24, -62, sd * 30, -72, sd * 26, -86); h.bezierCurveTo(sd * 22, -76, sd * 17, -70, sd * 9, -68); h.closePath();
      blob(g, h, '#7a5440', { light: '#c8a07a', dark: '#3a2418', y0: -86, y1: -60, ink: '#2a160c', ao: 0 });
      g.strokeStyle = 'rgba(42,22,12,.5)'; g.lineWidth = 0.8;
      for (const k of [0.3, 0.55, 0.78]) { g.beginPath(); g.moveTo(sd * (12 + 14 * k), -61 - 18 * k); g.lineTo(sd * (10 + 12 * k), -66 - 12 * k); g.stroke(); }
    }
    // crâne : boîte crânienne ronde, grosses orbites, mâchoire à dents carrées
    const bone = '#f2e8d2', boneD = '#a8987a';
    const jaw = rrect(-11, -42, 22, 11, 3.6);
    blob(g, jaw, bone, { dark: boneD, light: '#ffffff', y0: -42, y1: -31, ink: '#4a3a2a', ao: 0.12 });
    g.strokeStyle = '#4a3a2a'; g.lineWidth = 0.9; for (const x of [-6, -2, 2, 6]) { g.beginPath(); g.moveTo(x, -42); g.lineTo(x, -35); g.stroke(); }
    g.beginPath(); g.moveTo(-10, -38.5); g.lineTo(10, -38.5); g.stroke();
    const head = P(); head.moveTo(-15, -44); head.bezierCurveTo(-22, -54, -18, -72, 0, -73); head.bezierCurveTo(18, -72, 22, -54, 15, -44); head.quadraticCurveTo(0, -38, -15, -44); head.closePath();
    blob(g, head, bone, { dark: boneD, light: '#ffffff', y0: -73, y1: -40, ink: '#4a3a2a', hl: { x: -7, y: -64, rx: 6, ry: 3.4, rot: -0.4, a: 0.7 } });
    // orbites (les yeux rouges brillent au rendu) et nez
    g.fillStyle = '#2a0a10';
    for (const sd of [-1, 1]) { const o = P(); o.moveTo(sd * 2, -55); o.quadraticCurveTo(sd * 12, -62, sd * 12, -53); o.quadraticCurveTo(sd * 9, -47, sd * 2, -50); o.closePath(); g.fill(o); }
    g.fill(poly([[0, -49], [-2.4, -44.5], [2.4, -44.5]]));
    g.strokeStyle = 'rgba(74,58,42,.6)'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(4, -72); g.lineTo(6, -66); g.lineTo(3, -63); g.stroke();
  }, { outline: 1.4 }));
  // arche de pierre du portail (le tourbillon est dessiné dedans, au rendu)
  S.portalArch = bake(140, 150, 70, 142, res, g => {
    const st = { base: '#8a94b8', light: '#d4dcf4', dark: '#4a5274', ink: '#1e2238' };
    const block = (path, y0, y1) => blob(g, path, st.base, { light: st.light, dark: st.dark, y0, y1, ink: st.ink, ao: 0.16 });
    // marches
    block(rrect(-62, -8, 30, 10, 3), -8, 2); block(rrect(32, -8, 30, 10, 3), -8, 2);
    // piliers
    for (const sd of [-1, 1]) {
      for (const [y, h] of [[-30, 24], [-52, 22], [-72, 20]]) {
        const x = sd < 0 ? -58 : 40;
        block(rrect(x + (y === -52 ? 1 : 0), y, 18, h + 1, 3.4), y, y + h);
      }
    }
    // claveaux de l'arc (demi-cercle au-dessus de y = -66)
    const cy = -66, R0 = 41, R1 = 59, n = 7;
    for (let i = 0; i < n; i++) {
      const a0 = Math.PI + i / n * Math.PI + 0.02, a1 = Math.PI + (i + 1) / n * Math.PI - 0.02;
      const p = P(); p.arc(0, cy, R1, a0, a1); p.arc(0, cy, R0, a1, a0, true); p.closePath();
      block(p, cy - R1, cy - R0 * 0.3);
    }
    // clé de voûte avec sa gemme
    const key = poly([[-11, -128], [11, -128], [8, -104], [-8, -104]]);
    blob(g, key, '#9aa6cc', { light: '#e8eeff', dark: '#4a5274', y0: -128, y1: -104, ink: st.ink });
    const gem = poly([[0, -125], [6, -117], [0, -108], [-6, -117]]);
    blob(g, gem, '#5ae8ff', { light: '#ffffff', dark: '#1a7ab8', y0: -125, y1: -108, ink: '#0a2a4a', hl: { x: -2, y: -119, rx: 1.4, ry: 3, a: 0.9 }, ao: 0 });
    // runes gravées qui luisent
    g.strokeStyle = '#a8f4ff'; g.lineWidth = 1.5;
    for (const [x, y, k] of [[-49, -18, 0], [49, -18, 4], [-49, -41, 5], [49, -41, 1], [-49, -62, 3], [49, -62, 6]]) { g.save(); g.translate(x, y); rune(g, k, 4); g.restore(); }
    for (let i = 1; i < n - 1; i++) { const a = Math.PI + (i + 0.5) / n * Math.PI; g.save(); g.translate(Math.cos(a) * 50, cy + Math.sin(a) * 50); g.rotate(a + Math.PI / 2); rune(g, i + 2, 3.4); g.restore(); }
    // lierre (touche de couleur)
    for (const [x, y, r] of [[-60, -30, 4], [-63, -24, 3], [-58, -18, 3.4], [58, -70, 3.6], [61, -64, 3]]) { g.fillStyle = '#4aa040'; g.fill(ell(x, y, r, r * 0.8)); g.fillStyle = '#86d060'; g.fill(ell(x - r * 0.3, y - r * 0.3, r * 0.45, r * 0.3)); }
  }, { outline: 1.4 });
  // dallage rond du portail (au sol)
  S.portalBase = bake(176, 176, 88, 88, res, g => {
    g.fillStyle = '#2a2a44'; g.fill(ell(0, 5, 80, 80));
    g.fillStyle = rg(g, 0, 0, 80, ['#c8d0ec', '#8a94b8', '#5a6488'], -28, -30); g.fill(ell(0, 0, 78, 78));
    g.strokeStyle = '#1e2238'; g.lineWidth = 1.4;
    for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; g.beginPath(); g.moveTo(Math.cos(a) * 62, Math.sin(a) * 62); g.lineTo(Math.cos(a) * 78, Math.sin(a) * 78); g.stroke(); }
    g.stroke(ell(0, 0, 78, 78));
    g.fillStyle = '#1a0e34'; g.fill(ell(0, 1.5, 62, 62));
    g.fillStyle = rg(g, 0, 0, 60, ['#5a2a9a', '#3a1a6a', '#1e0e40']); g.fill(ell(0, 0, 60, 60));
    g.lineWidth = 2; g.strokeStyle = '#0e0624'; g.stroke(ell(0, 0, 61, 61));
  }, { outline: 1.4 });
  S.portalRunes = runeRing(res, 88, [[70, 12, 4.4, 2], [52, 0, 0, 1.6]], '#7ae8ff');
  // totems de défi : une silhouette par sorte, et sa version éteinte
  S.totem = {};
  for (const k of ['horde', 'fureur', 'elite', 'maudit']) {
    const s = bake(64, 100, 32, 94, res, g => TOTEM_DRAW[k](g), { outline: 1.4 });
    S.totem[k] = [s, dimmed(s)];
  }
  return S;
}

// anneau de runes lumineuses (texture additive) : rings = [[rayon, nb de runes, taille, épaisseur]]
function runeRing(res, R, rings, col) {
  const c = cnv(R * 2 * res, R * 2 * res), g = c.getContext('2d');
  g.setTransform(res, 0, 0, res, R * res, R * res);
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const pass of [0, 1]) {
    g.shadowColor = col; g.shadowBlur = pass ? 0 : 6 * res;
    g.strokeStyle = pass ? '#fff4e8' : col;
    for (const [r, n, s, w] of rings) {
      g.lineWidth = pass ? w * 0.45 : w;
      if (!n) { g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke(); continue; }
      for (let i = 0; i < n; i++) { const a = i / n * TAU; g.save(); g.translate(Math.cos(a) * r, Math.sin(a) * r); g.rotate(a + Math.PI / 2); rune(g, i, s); g.restore(); }
    }
  }
  return { c, R };
}

const TOTEM_DRAW = {
  // mât de bois sculpté, peintures de guerre orange, crâne cornu au sommet
  horde(g) {
    const wood = '#b07040';
    blob(g, rrect(-12, -60, 24, 60, 4), wood, { light: '#e8a870', dark: '#6a3a1a', y0: -60, y1: 0, ink: '#3a1c08', hl: { x: -6, y: -40, rx: 2.4, ry: 14, a: 0.35 } });
    for (const y of [-14, -38]) { // visages sculptés
      g.fillStyle = '#ff8a3a'; g.fill(rrect(-12, y - 9, 24, 4, 1.4));
      g.fillStyle = '#3a1c08'; g.fill(ell(-5, y - 2, 2.6, 2)); g.fill(ell(5, y - 2, 2.6, 2));
      g.fill(rrect(-6, y + 4, 12, 4, 2)); g.fillStyle = '#fff4e0'; g.fillRect(-4.5, y + 4.4, 2, 1.6); g.fillRect(2.5, y + 4.4, 2, 1.6);
    }
    // ailes de planches
    for (const sd of [-1, 1]) { const w = poly([[sd * 11, -50], [sd * 30, -58], [sd * 28, -50], [sd * 22, -46], [sd * 11, -42]]); blob(g, w, '#c88850', { dark: '#7a4620', y0: -58, y1: -42, ink: '#3a1c08', ao: 0 }); g.fillStyle = '#ff8a3a'; g.fill(poly([[sd * 26, -55], [sd * 28, -51], [sd * 22, -48]])); }
    // crâne cornu
    for (const sd of [-1, 1]) { const h = P(); h.moveTo(sd * 6, -70); h.quadraticCurveTo(sd * 18, -72, sd * 17, -84); h.quadraticCurveTo(sd * 12, -76, sd * 4, -75); h.closePath(); blob(g, h, '#f4ecd8', { dark: '#b8a888', y0: -84, y1: -70, ink: '#4a3a2a', ao: 0 }); }
    const sk = P(); sk.moveTo(-9, -60); sk.bezierCurveTo(-13, -68, -10, -80, 0, -80); sk.bezierCurveTo(10, -80, 13, -68, 9, -60); sk.closePath();
    blob(g, sk, '#f4ecd8', { dark: '#b8a888', light: '#ffffff', y0: -80, y1: -60, ink: '#4a3a2a', hl: { x: -4, y: -74, rx: 3, ry: 2, a: 0.7 } });
    g.fillStyle = '#2a0a10'; g.fill(ell(-4, -69, 2.6, 2.8)); g.fill(ell(4, -69, 2.6, 2.8)); g.fill(poly([[0, -66], [-1.4, -63], [1.4, -63]]));
    g.fillStyle = '#ffb04a'; g.fill(ell(-4, -69, 1, 1)); g.fill(ell(4, -69, 1, 1));
  },
  // obélisque d'obsidienne, visage furieux, flamme au sommet
  fureur(g) {
    const ob = poly([[-15, 0], [-12, -54], [0, -64], [12, -54], [15, 0]]);
    blob(g, ob, '#4a3a52', { light: '#8a7aa0', dark: '#1e1626', y0: -64, y1: 0, ink: '#120a18', hl: { x: -7, y: -36, rx: 2.4, ry: 16, a: 0.3 } });
    g.strokeStyle = '#ff3a5a'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-9, -6); g.lineTo(-6, -20); g.lineTo(-9, -30); g.moveTo(8, -4); g.lineTo(5, -16); g.stroke();
    // sourcils, yeux, bouche
    g.fillStyle = '#120a18'; g.fill(poly([[-11, -46], [-1, -40], [-2, -37], [-11, -42]])); g.fill(poly([[11, -46], [1, -40], [2, -37], [11, -42]]));
    g.fillStyle = '#ff3a5a'; g.fill(ell(-5.5, -35, 3, 2.2)); g.fill(ell(5.5, -35, 3, 2.2));
    g.fillStyle = '#ffd0d8'; g.fill(ell(-5.5, -35.4, 1.2, 0.9)); g.fill(ell(5.5, -35.4, 1.2, 0.9));
    const m = P(); m.moveTo(-7, -24); m.quadraticCurveTo(0, -30, 7, -24); m.lineTo(5, -21); m.quadraticCurveTo(0, -24, -5, -21); m.closePath();
    g.fillStyle = '#120a18'; g.fill(m); g.fillStyle = '#fff'; g.fill(poly([[-4, -24.6], [-2.6, -22.6], [-1.4, -25.6]])); g.fill(poly([[4, -24.6], [2.6, -22.6], [1.4, -25.6]]));
    // cornes et flamme
    for (const sd of [-1, 1]) { const h = P(); h.moveTo(sd * 11, -52); h.quadraticCurveTo(sd * 24, -56, sd * 22, -70); h.quadraticCurveTo(sd * 17, -60, sd * 9, -58); h.closePath(); blob(g, h, '#e8dcc4', { dark: '#9a8a6a', y0: -70, y1: -52, ink: '#3a2a1a', ao: 0 }); }
    const f = P(); f.moveTo(-9, -60); f.bezierCurveTo(-14, -72, -4, -76, -3, -86); f.bezierCurveTo(2, -78, 6, -82, 5, -92); f.bezierCurveTo(14, -80, 12, -68, 9, -60); f.closePath();
    blob(g, f, '#ff5a2a', { light: '#ffe08a', dark: '#c8202a', y0: -92, y1: -60, ink: '#7a0a14', ao: 0 });
    const f2 = P(); f2.moveTo(-4, -61); f2.bezierCurveTo(-6, -68, 0, -70, 1, -77); f2.bezierCurveTo(5, -70, 6, -66, 4, -61); f2.closePath();
    g.fillStyle = '#fff2b0'; g.fill(f2);
  },
  // colonne de marbre cerclée d'or, couronne et gemme violette
  elite(g) {
    blob(g, rrect(-17, -8, 34, 8, 2), '#e8e4f4', { dark: '#9a94b4', y0: -8, y1: 0, ink: '#3a3458', ao: 0 });
    const col = rrect(-11, -52, 22, 45, 2);
    blob(g, col, '#e8e4f4', { light: '#ffffff', dark: '#9a94b4', y0: -52, y1: -7, ink: '#3a3458', hl: { x: -5, y: -32, rx: 2, ry: 14, a: 0.5 } });
    g.strokeStyle = 'rgba(80,72,120,.35)'; g.lineWidth = 1; for (const x of [-5.5, 0, 5.5]) { g.beginPath(); g.moveTo(x, -50); g.lineTo(x, -9); g.stroke(); }
    for (const y of [-14, -46]) blob(g, rrect(-13, y, 26, 4.4, 1.6), '#ffcf40', { light: '#fff6b8', dark: '#b8780c', y0: y, y1: y + 4.4, ink: '#5a3a04', ao: 0 });
    blob(g, rrect(-15, -58, 30, 7, 2), '#e8e4f4', { dark: '#9a94b4', y0: -58, y1: -51, ink: '#3a3458', ao: 0 });
    const gem = poly([[0, -38], [5.5, -31], [0, -22], [-5.5, -31]]);
    blob(g, gem, '#c06aff', { light: '#f4d8ff', dark: '#6a1ab8', y0: -38, y1: -22, ink: '#2a0a4a', hl: { x: -2, y: -33, rx: 1.4, ry: 3, a: 0.9 }, ao: 0 });
    // couronne
    const cr = poly([[-15, -58], [-17, -78], [-9, -68], [0, -84], [9, -68], [17, -78], [15, -58]]);
    blob(g, cr, '#ffcf40', { light: '#fff6b8', dark: '#c8860c', y0: -84, y1: -58, ink: '#5a3a04', hl: { x: -7, y: -66, rx: 3, ry: 2, a: 0.8 } });
    for (const [x, y, c] of [[-17, -79, '#ff4a6a'], [0, -85, '#c06aff'], [17, -79, '#4fb8ff']]) { g.fillStyle = c; g.fill(ell(x, y, 2.4, 2.4)); g.lineWidth = 0.8; g.strokeStyle = '#3a1a04'; g.stroke(ell(x, y, 2.4, 2.4)); }
    g.fillStyle = '#c06aff'; g.fill(ell(0, -64, 2.6, 2.6));
  },
  // bâton de bois mort tordu, crâne aux yeux verts et lanterne de poison
  maudit(g) {
    for (const [x, y, r] of [[-12, -3, 6], [10, -2, 5], [0, -1, 4]]) { const c = poly([[x - r * 0.6, y], [x - r * 0.3, y - r * 2.2], [x + r * 0.3, y - r * 2.6], [x + r * 0.6, y]]); blob(g, c, '#5ae8b8', { light: '#d8fff0', dark: '#1a8a6a', y0: y - r * 2.6, y1: y, ink: '#0a3a2a', ao: 0 }); }
    const st = P(); st.moveTo(-4, 0); st.bezierCurveTo(-8, -22, 6, -34, -2, -58); st.lineTo(4, -58); st.bezierCurveTo(12, -34, -2, -22, 4, 0); st.closePath();
    blob(g, st, '#6a5a50', { light: '#a8948a', dark: '#2e2420', y0: -58, y1: 0, ink: '#1a1210', ao: 0 });
    // branche et lanterne
    const br = P(); br.moveTo(2, -44); br.quadraticCurveTo(14, -50, 20, -46); br.lineTo(20, -43); br.quadraticCurveTo(13, -46, 3, -40); br.closePath();
    blob(g, br, '#6a5a50', { dark: '#2e2420', y0: -50, y1: -40, ink: '#1a1210', ao: 0 });
    g.strokeStyle = '#2a2a30'; g.lineWidth = 1; g.beginPath(); g.moveTo(19, -45); g.lineTo(19, -38); g.stroke();
    blob(g, rrect(14.5, -38, 9, 12, 3), '#3a4a48', { dark: '#1a2422', y0: -38, y1: -26, ink: '#0a1210', ao: 0 });
    g.fillStyle = rg(g, 19, -32, 4, ['#ffffff', '#7affd0', '#2ab890']); g.fill(rrect(16.2, -36, 5.6, 8, 2));
    // crâne
    const sk = P(); sk.moveTo(-10, -58); sk.bezierCurveTo(-14, -66, -10, -79, 1, -79); sk.bezierCurveTo(12, -79, 15, -66, 11, -58); sk.closePath();
    blob(g, sk, '#e8f0e0', { dark: '#98a890', light: '#ffffff', y0: -79, y1: -58, ink: '#2a3a2a', hl: { x: -3, y: -73, rx: 3, ry: 2, a: 0.7 } });
    blob(g, rrect(-6, -61, 13, 6, 2.4), '#e8f0e0', { dark: '#98a890', y0: -61, y1: -55, ink: '#2a3a2a', ao: 0 });
    g.fillStyle = '#0a2a20'; g.fill(ell(-3.6, -67, 3, 3.2)); g.fill(ell(5.6, -67, 3, 3.2));
    g.fillStyle = '#7affd0'; g.fill(ell(-3.6, -67, 1.3, 1.3)); g.fill(ell(5.6, -67, 1.3, 1.3));
    // haillons
    const cl = P(); cl.moveTo(-6, -50); cl.lineTo(8, -52); cl.lineTo(7, -38); cl.lineTo(4, -42); cl.lineTo(1, -36); cl.lineTo(-2, -42); cl.lineTo(-6, -38); cl.closePath();
    blob(g, cl, '#3ab890', { light: '#8af0c8', dark: '#1a6a50', y0: -52, y1: -36, ink: '#0a3a2a', ao: 0 });
  },
};

// ---------- Textures d'effets (cache par couleur) ----------
// halo coloré (dégradé radial) pour les lumières en mode additif
const glowCache = new Map();
export function glowTex(col) {
  let c = glowCache.get(col);
  if (c) return c;
  c = cnv(64, 64);
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, col); gr.addColorStop(0.25, col + 'cc'); gr.addColorStop(0.6, col + '44'); gr.addColorStop(1, col + '00');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  glowCache.set(col, c);
  return c;
}

// tourbillon (portail) : bras en spirale sur un disque dégradé, couleurs extérieure -> intérieure
const swirlCache = new Map();
export function swirlTex(c0, c1, c2 = '#ffffff') {
  const key = c0 + c1 + c2;
  let c = swirlCache.get(key);
  if (c) return c;
  c = cnv(128, 128);
  const g = c.getContext('2d');
  g.translate(64, 64);
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, 64);
  gr.addColorStop(0, c2); gr.addColorStop(0.18, c2); gr.addColorStop(0.42, c1); gr.addColorStop(0.85, c0); gr.addColorStop(1, c0 + '00');
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 64, 0, TAU); g.fill();
  g.lineCap = 'round';
  for (const [col, w, off] of [[shade(c0, -0.45) + 'aa', 9, 0.5], ['rgba(255,255,255,.55)', 6, 0]]) {
    for (let a = 0; a < 4; a++) {
      g.strokeStyle = col; g.beginPath();
      for (let i = 0; i <= 24; i++) { const t = i / 24, r = 8 + t * 54, an = (a + off) / 4 * TAU + t * 4.2; if (i) g.lineTo(Math.cos(an) * r, Math.sin(an) * r); else g.moveTo(Math.cos(an) * r, Math.sin(an) * r); }
      g.lineWidth = w; g.stroke();
    }
  }
  g.globalCompositeOperation = 'destination-in';
  const m = g.createRadialGradient(0, 0, 40, 0, 0, 64); m.addColorStop(0, '#000'); m.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = m; g.fillRect(-64, -64, 128, 128);
  swirlCache.set(key, c);
  return c;
}

// colonne de lumière verticale (s'estompe vers le haut et sur les bords)
const beamCache = new Map();
export function beamTex(col) {
  let c = beamCache.get(col);
  if (c) return c;
  c = cnv(64, 256);
  const g = c.getContext('2d'), h = g.createLinearGradient(0, 0, 64, 0);
  h.addColorStop(0, col + '00'); h.addColorStop(0.3, col + '99'); h.addColorStop(0.5, '#ffffff'); h.addColorStop(0.7, col + '99'); h.addColorStop(1, col + '00');
  g.fillStyle = h; g.fillRect(0, 0, 64, 256);
  g.globalCompositeOperation = 'destination-in';
  const v = g.createLinearGradient(0, 0, 0, 256); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(0.6, 'rgba(0,0,0,.7)'); v.addColorStop(1, '#000');
  g.fillStyle = v; g.fillRect(0, 0, 64, 256);
  beamCache.set(col, c);
  return c;
}

export function softTex() {
  const c = cnv(64, 64);
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.55, 'rgba(0,0,0,.7)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return c;
}

// bouffée de fumée cartoon : boule pleine ombrée, bord doux
export function puffTex() {
  const c = cnv(64, 64);
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(24, 22, 2, 32, 32, 31);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.55, 'rgba(240,236,248,1)'); gr.addColorStop(0.85, 'rgba(196,190,214,.95)'); gr.addColorStop(1, 'rgba(180,174,200,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(32, 32, 32, 0, TAU); g.fill();
  return c;
}
