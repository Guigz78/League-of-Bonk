// Petites textures dessinées au canevas 2D pour la 3D et le calque : halo coloré, tourbillon (portail, autel),
// runes (couronnes de l'autel et du portail), couleurs des coffres de butin. Gardées en cache par couleur.

const TAU = Math.PI * 2;

// éclaircit (amt > 0) ou assombrit (amt < 0) une couleur #rrggbb
export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = amt < 0 ? 0 : 255, p = Math.abs(amt);
  r = Math.round((f - r) * p + r); g = Math.round((f - g) * p + g); b = Math.round((f - b) * p + b);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}
function cnv(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
  return c;
}

// lueur des coffres de butin : bois, argent, or, mythique
export const LOOT_GLOW = ['#ffb070', '#cfe4ff', '#ffd84a', '#ff6ad8'];

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
