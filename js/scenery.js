// Décors pixel art générés pour chaque zone (128 x 80 pixels, agrandis sans flou).
import { rng, shade, cachedURL } from './pixel.js';

const W = 128, H = 80, HORIZON = 46;

function px(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(x | 0, y | 0, w | 0, h | 0); }

function sky(g, top, bottom) {
  for (let y = 0; y < HORIZON; y++) {
    const t = y / HORIZON;
    const a = parseInt(top.slice(1), 16), b = parseInt(bottom.slice(1), 16);
    const mix = s => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
    // bandes de 4 px pour un rendu « rétro »
    if (y % 4 === 0) g.fillStyle = `rgb(${mix(16)},${mix(8)},${mix(0)})`;
    g.fillRect(0, y, W, 1);
  }
}

function ground(g, c1, c2, r) {
  px(g, 0, HORIZON, W, H - HORIZON, c1);
  for (let y = HORIZON; y < H; y += 2) for (let x = 0; x < W; x += 1) if (r() < 0.06) px(g, x, y, 1, 1, c2);
  px(g, 0, HORIZON, W, 1, shade(c1, 0.15));
}

function hills(g, color, base, amp, r) {
  const ph = r() * 6;
  for (let x = 0; x < W; x++) {
    const h = Math.round(amp * (0.6 + 0.4 * Math.sin(x / 13 + ph)) + amp * 0.3 * Math.sin(x / 5 + ph * 2));
    px(g, x, base - h, 1, h, color);
  }
}

function tree(g, x, y, s, leaf, trunk) {
  px(g, x - 1, y - 6 * s, 2, 6 * s, trunk);
  for (let i = 0; i < 3; i++) {
    const w = (7 - i * 2) * s, yy = y - 6 * s - i * 3 * s;
    px(g, x - w / 2, yy - 3 * s, w, 3 * s, i === 0 ? shade(leaf, -0.2) : leaf);
    px(g, x - w / 2, yy - 3 * s, w, 1, shade(leaf, 0.2));
  }
}

function tower(g, x, y, c) {
  px(g, x - 3, y - 20, 6, 20, c);
  px(g, x - 4, y - 22, 8, 3, shade(c, 0.2));
  px(g, x - 2, y - 26, 4, 4, '#4fd0ff');
  px(g, x - 1, y - 25, 1, 1, '#e8fbff');
  px(g, x - 3, y - 20, 1, 20, shade(c, -0.25));
}

function rock(g, x, y, w, c) {
  px(g, x, y - 3, w, 3, c);
  px(g, x + 1, y - 4, w - 2, 1, shade(c, 0.2));
  px(g, x, y - 1, w, 1, shade(c, -0.3));
}

function crystal(g, x, y, h, c) {
  for (let i = 0; i < h; i++) {
    const w = Math.max(1, Math.round((h - i) / 3));
    px(g, x - w, y - i, w * 2, 1, i % 3 === 0 ? shade(c, 0.25) : c);
  }
}

function deadTree(g, x, y, c) {
  px(g, x, y - 14, 2, 14, c);
  px(g, x - 4, y - 12, 4, 1, c); px(g, x - 4, y - 14, 1, 2, c);
  px(g, x + 2, y - 9, 4, 1, c); px(g, x + 5, y - 12, 1, 3, c);
}

const DRAW = {
  lane(g, r, z) {
    hills(g, shade(z.sky[1], -0.25), HORIZON, 9, r);
    hills(g, shade(z.ground[0], -0.2), HORIZON, 5, r);
    tower(g, 14, HORIZON + 2, '#7a86a8');
    tower(g, 112, HORIZON + 2, '#a87a7a');
    ground(g, z.ground[0], shade(z.ground[0], 0.18), r);
    // chemin de la voie
    for (let y = HORIZON + 1; y < H; y++) { const w = 18 + (y - HORIZON) * 1.6; px(g, 64 - w / 2, y, w, 1, y % 3 ? '#9a8a6a' : '#8a7a5a'); }
    for (let i = 0; i < 6; i++) tree(g, 30 + i * 13 + r() * 6, HORIZON, 1, '#3a7a3a', '#5a3a1a');
  },
  jungle(g, r, z) {
    for (let i = 0; i < 9; i++) tree(g, i * 15 + r() * 6, HORIZON + 2, 2, shade('#2f6a3a', r() * 0.2 - 0.1), '#4a2f1a');
    ground(g, z.ground[0], shade(z.ground[0], 0.18), r);
    for (let i = 0; i < 14; i++) { const x = r() * W, y = HORIZON + 4 + r() * 30; px(g, x, y, 3, 2, '#3f8a3a'); px(g, x + 1, y - 1, 1, 1, '#7ac85a'); }
    for (let i = 0; i < 10; i++) px(g, r() * W, r() * HORIZON, 1, 1, '#d8ff8a');
  },
  river(g, r, z) {
    hills(g, shade(z.sky[1], -0.2), HORIZON, 8, r);
    ground(g, z.ground[0], shade(z.ground[0], 0.2), r);
    for (let y = HORIZON + 2; y < H; y += 3) for (let x = (y * 7) % 9; x < W; x += 9 + (y % 5)) px(g, x, y, 4, 1, '#bfefff');
    for (let i = 0; i < 5; i++) rock(g, r() * 120, HORIZON + 6 + r() * 30, 6 + r() * 6, '#6a7a8a');
    px(g, 0, HORIZON - 2, W, 3, '#5a8a4a');
  },
  ice(g, r, z) {
    hills(g, '#e8f4ff', HORIZON, 16, r);
    hills(g, '#b8d4f0', HORIZON, 8, r);
    ground(g, z.ground[0], '#ffffff', r);
    for (let i = 0; i < 6; i++) crystal(g, 8 + i * 22 + r() * 6, HORIZON + 1, 8 + r() * 8, '#8ac8f0');
    // pont
    px(g, 0, HORIZON + 16, W, 2, '#6a5a4a');
    for (let x = 0; x < W; x += 6) px(g, x, HORIZON + 14, 1, 4, '#4a3a2a');
    for (let i = 0; i < 40; i++) px(g, r() * W, r() * H, 1, 1, '#ffffff');
  },
  shadow(g, r, z) {
    hills(g, '#0f1f1c', HORIZON, 12, r);
    for (let i = 0; i < 7; i++) deadTree(g, 6 + i * 19 + r() * 6, HORIZON + 1, '#0a1412');
    ground(g, z.ground[0], shade(z.ground[0], 0.15), r);
    for (let y = HORIZON - 6; y < HORIZON + 6; y++) for (let x = 0; x < W; x++) if (r() < 0.12) px(g, x, y, 2, 1, 'rgba(90,232,184,.18)');
    for (let i = 0; i < 12; i++) px(g, r() * W, r() * HORIZON * 0.8, 1, 1, '#7affd0');
  },
  void(g, r, z) {
    for (let i = 0; i < 40; i++) px(g, r() * W, r() * HORIZON, 1, 1, r() < 0.5 ? '#ffffff' : '#d08aff');
    hills(g, '#2a0f40', HORIZON, 10, r);
    ground(g, z.ground[0], '#4a1a6a', r);
    for (let i = 0; i < 7; i++) crystal(g, 6 + i * 19 + r() * 8, HORIZON + 2 + r() * 4, 10 + r() * 12, r() < 0.5 ? '#a83ad8' : '#d83aa8');
    for (let i = 0; i < 4; i++) { const x = r() * W, y = HORIZON + 10 + r() * 20; px(g, x, y, 8, 2, '#140820'); px(g, x + 1, y, 6, 1, '#d83aa8'); }
  },
};

export function sceneryURL(zone) {
  return cachedURL('scn:' + zone.id, () => {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    const r = rng('scenery' + zone.id);
    sky(g, zone.sky[0], zone.sky[1]);
    (DRAW[zone.bg] || DRAW.lane)(g, r, zone);
    return c;
  });
}
