// Monde 3D low-poly façon Megabonk : sol à facettes colorées + texture pixel, chemins, rivières, lacs gelés,
// brume, failles du Néant, décor instancié (arbres, rochers, buissons, tours…), touffes d'herbe et fleurs,
// collines au-delà du bord de la carte, particules d'ambiance. Tracé identique au rendu 2D (mêmes graines).
import { THREE, S, TAU, Build, G, T, lowpoly, col, shade, clamp, tex, TX, billboardGeo, flatGeo, ADD, Pool } from './kit.js';
import { HALF } from '../data.js';
import { rng } from '../pixel.js';
import { THEMES, World2D } from '../g2d/world.js';

// ambiance 3D par thème : fond/brouillard, ciel et sol de la lumière d'ambiance, soleil
export const LOOK = {
  lane:   { fog: '#9ad8ff', fogK: 1, sky: '#fff6e0', grd: '#5a7a3a', hemi: 1.9, sun: '#fff0d0', sunI: 2.1, edge: '#3e6a2c', hill: '#4a8a34' },
  jungle: { fog: '#6ab88a', fogK: 0.9, sky: '#f0ffe0', grd: '#2a4a20', hemi: 1.7, sun: '#ffe8b0', sunI: 1.9, edge: '#1e4a1a', hill: '#2e6a28' },
  river:  { fog: '#a8e4ff', fogK: 1, sky: '#f4fbff', grd: '#4a7a5a', hemi: 1.95, sun: '#fff4dc', sunI: 2.1, edge: '#3a7050', hill: '#5a9a48' },
  ice:    { fog: '#cfe6ff', fogK: 0.95, sky: '#ffffff', grd: '#8aa8c8', hemi: 1.75, sun: '#fff8f0', sunI: 1.8, edge: '#8aa8c8', hill: '#d6e6f6' },
  shadow: { fog: '#1e3a36', fogK: 0.7, sky: '#9affe0', grd: '#14261f', hemi: 1.15, sun: '#b8d8ff', sunI: 0.9, edge: '#18302a', hill: '#22403a', dark: 1 },
  void:   { fog: '#24103a', fogK: 0.7, sky: '#e0a8ff', grd: '#1a0a2a', hemi: 1.1, sun: '#ffb8f0', sunI: 0.95, edge: '#1a0c2a', hill: '#2a1640', dark: 1 },
};

const PCELL = 256, EDGE = 640; // décor par cellules de 256 px ; collines jusqu'à 640 px au-delà du bord
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function hash2(x, y) { const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return h - Math.floor(h); }
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
// hauteur du sol (unités 3D) : plat dans l'arène de jeu, collines au-delà du bord
export function heightAt(x, y) {
  const e = Math.max(Math.abs(x), Math.abs(y)) - HALF + 40;
  if (e <= 0) return 0;
  return smooth(0, 300, e) * (2.2 + vnoise(x * 0.004, y * 0.004) * 3.2) + smooth(250, EDGE, e) * 3;
}

// ---------- Textures pixel du sol ----------
function grassTex(key, base, dark, light) {
  return tex('grass' + key, 32, 32, (g) => {
    const r = rng('grass' + key);
    g.fillStyle = base; g.fillRect(0, 0, 32, 32);
    for (let i = 0; i < 150; i++) { g.fillStyle = r() < 0.55 ? dark : light; g.globalAlpha = 0.25 + r() * 0.35; const x = (r() * 32) | 0, y = (r() * 32) | 0; g.fillRect(x, y, 1, r() < 0.4 ? 2 : 1); }
    g.globalAlpha = 1;
  }, { nearest: true, repeat: true });
}
function paveTex(key, C, kind) {
  return tex('pave' + key + kind, 32, 32, (g) => {
    const r = rng('pave' + key);
    g.fillStyle = C[3]; g.fillRect(0, 0, 32, 32);
    if (kind === 'dirt' || kind === 'void') {
      g.fillStyle = C[0]; g.fillRect(0, 0, 32, 32);
      for (let i = 0; i < 90; i++) { g.fillStyle = r() < 0.5 ? C[2] : C[1]; g.globalAlpha = 0.3 + r() * 0.4; g.fillRect((r() * 32) | 0, (r() * 32) | 0, r() < 0.3 ? 2 : 1, 1); }
      g.globalAlpha = 1;
      if (kind === 'void') { g.fillStyle = C[1]; g.globalAlpha = 0.6; g.fillRect(0, 0, 32, 1); g.fillRect(0, 16, 32, 1); g.fillRect(0, 0, 1, 16); g.fillRect(16, 16, 1, 16); g.globalAlpha = 1; }
      return;
    }
    // pavés : rangées décalées, reflet en haut à gauche
    const n = kind === 'stones' ? 2 : 4, cs = 32 / n;
    for (let j = 0; j < n; j++) for (let i = -1; i <= n; i++) {
      const x = i * cs + (j & 1) * cs * 0.5, y = j * cs, w = cs - 1, h = cs - 1;
      g.fillStyle = r() < 0.3 ? shade(C[0], -0.06) : r() > 0.8 ? shade(C[0], 0.06) : C[0];
      g.fillRect(Math.round(x) + 1, y + 1, w - 1, h - 1);
      g.fillStyle = C[1]; g.fillRect(Math.round(x) + 1, y + 1, w - 2, 1); g.fillRect(Math.round(x) + 1, y + 1, 1, h - 2);
      g.fillStyle = C[2]; g.fillRect(Math.round(x) + 1, y + h - 1, w - 1, 1);
    }
  }, { nearest: true, repeat: true });
}
function waterTex(key, c1, c2, foam) {
  return tex('water' + key, 32, 32, (g) => {
    const r = rng('water' + key);
    g.fillStyle = c1; g.fillRect(0, 0, 32, 32);
    for (let i = 0; i < 26; i++) { g.fillStyle = r() < 0.6 ? c2 : foam; g.globalAlpha = r() < 0.6 ? 0.5 : 0.75; g.fillRect((r() * 32) | 0, (r() * 32) | 0, 3 + ((r() * 4) | 0), 1); }
    g.globalAlpha = 1;
  }, { nearest: true, repeat: true });
}

// ---------- Décor (modèles low-poly) ----------
const PROP = {
  tree(b, T0, r) {
    const L = T0.leaf, tk = T0.trunk;
    switch (T0.tree) {
      case 'pine':
        b.add(G.cyl(0.18, 0.26, 1.2, 5), tk, T(0, 0.6, 0));
        for (let i = 0; i < 3; i++) { const y = 1.1 + i * 1.05, w = 1.45 - i * 0.36; b.add(G.cone(w, 1.6, 7), i & 1 ? L[0] : L[1], T(0, y + 0.7, 0, 1, 1, 1, 0, r() * 2), 0.08); b.add(G.cone(w * 0.62, 0.7, 7), '#ffffff', T(0, y + 1.2, 0, 1, 1, 1, 0, r() * 2), 0.04); }
        return 4.6;
      case 'dead': {
        b.add(G.cyl(0.14, 0.32, 2.6, 5), tk, T(0, 1.3, 0, 1, 1, 1, 0.08, 0, 0.06));
        for (let i = 0; i < 4; i++) { const a = i * 1.7 + r(), y = 1.6 + i * 0.35; b.add(G.cyl(0.05, 0.11, 1.2, 4), tk, T(Math.cos(a) * 0.45, y + 0.3, Math.sin(a) * 0.45, 1, 1, 1, Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9)); }
        b.add(G.ico(0.35, 0), L[0], T(0.1, 2.7, 0.1), 0.1, 0.2);
        return 3.2;
      }
      case 'crystal':
        b.add(G.cyl(0.16, 0.3, 1.6, 5), tk, T(0, 0.8, 0));
        for (let i = 0; i < 5; i++) { const a = i * 1.26 + r() * 0.5; b.add(G.oct(0.5), i % 2 ? L[0] : L[2], T(Math.cos(a) * 0.55, 2.0 + r() * 0.6, Math.sin(a) * 0.55, 0.7, 2.0, 0.7, Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4), 0.12); }
        b.add(G.oct(0.6), L[2], T(0, 2.8, 0, 0.8, 2.2, 0.8), 0.08);
        return 3.8;
      case 'palm': {
        let x = 0, y = 0;
        for (let i = 0; i < 5; i++) { b.add(G.cyl(0.17, 0.22, 0.75, 6), i % 2 ? tk : shade(tk, -0.15), T(x, y + 0.37, 0, 1, 1, 1, 0, 0, -0.12)); x += 0.1; y += 0.72; }
        for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + r() * 0.3; b.add(G.box(1.7, 0.08, 0.5), i % 2 ? L[0] : L[1], T(x + Math.cos(a) * 0.75, y - 0.1, Math.sin(a) * 0.75, 1, 1, 1, 0, -a, -0.45)); }
        b.add(G.ico(0.18, 0), '#7a5a2a', T(x + 0.15, y - 0.25, 0.1)); b.add(G.ico(0.18, 0), '#7a5a2a', T(x - 0.1, y - 0.28, -0.12));
        return 4.2;
      }
      case 'jungle':
        b.add(G.cyl(0.22, 0.4, 2.4, 6), tk, T(0, 1.2, 0));
        b.add(G.ico(1.5, 0), L[1], T(0, 2.8, 0, 1.2, 0.7, 1.2), 0.1, 0.12);
        b.add(G.ico(1.15, 0), L[0], T(0.5, 3.4, 0.3, 1, 0.75, 1), 0.1, 0.12);
        b.add(G.ico(0.9, 0), L[2], T(-0.4, 3.75, -0.2, 1, 0.8, 1), 0.1, 0.12);
        for (let i = 0; i < 3; i++) b.add(G.box(0.06, 1.1, 0.06), L[1], T(-0.9 + i * 0.8, 2.2, 0.8));
        return 4.4;
      default: // arbre rond et touffu
        b.add(G.cyl(0.2, 0.32, 1.5, 6), tk, T(0, 0.75, 0));
        b.add(G.ico(1.2, 1), L[1], T(0, 2.2, 0, 1.1, 0.95, 1.1), 0.1, 0.1);
        b.add(G.ico(0.95, 1), L[0], T(0.45, 2.75, 0.25), 0.1, 0.1);
        b.add(G.ico(0.8, 1), L[2], T(-0.35, 3.05, -0.1), 0.1, 0.1);
        return 3.8;
    }
  },
  bush(b, T0, r) {
    const L = T0.leaf;
    b.add(G.ico(0.7, 0), L[1], T(0, 0.45, 0, 1.2, 0.8, 1.1), 0.1, 0.15);
    b.add(G.ico(0.55, 0), L[0], T(0.45, 0.55, 0.2), 0.1, 0.15);
    b.add(G.ico(0.45, 0), L[2], T(-0.35, 0.7, -0.1), 0.1, 0.15);
    if (T0.flowers && r() < 0.7) for (let i = 0; i < 4; i++) b.add(G.oct(0.12), T0.flowers[i % T0.flowers.length], T(Math.cos(i * 1.6) * 0.6, 0.95 + r() * 0.2, Math.sin(i * 1.6) * 0.5));
    return 1.2;
  },
  rock(b, T0, r) {
    const R = T0.rock;
    b.add(G.dode(0.75), R[0], T(0, 0.45, 0, 1.25, 0.8, 1.05), 0.1, 0.16);
    if (r() < 0.6) b.add(G.dode(0.42), R[1], T(0.75, 0.25, 0.3, 1, 0.8, 1), 0.1, 0.18);
    b.add(G.dode(0.45), T0.moss, T(-0.05, 0.92, 0, 1.4, 0.35, 1.1), 0.08, 0.1);
    return 1.1;
  },
  tower(b, T0) {
    const st = T0.border, R = T0.roof;
    b.add(G.cyl(0.95, 1.1, 3.2, 8), st[0], T(0, 1.6, 0), 0.08);
    b.add(G.cyl(1.15, 1.15, 0.35, 8), st[1], T(0, 3.3, 0));
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; b.add(G.box(0.36, 0.4, 0.36), st[1], T(Math.cos(a) * 1.0, 3.65, Math.sin(a) * 1.0, 1, 1, 1, 0, -a)); }
    b.add(G.cone(1.25, 1.7, 8), R[0], T(0, 4.5, 0), 0.06);
    b.add(G.box(0.4, 0.6, 0.1), '#2a1a10', T(0, 0.3, 1.05));
    b.add(G.box(0.25, 0.35, 0.1), '#ffd54a', T(0, 2.2, 1.0));
    b.add(G.cyl(0.04, 0.04, 1.2, 4), '#6a4a2a', T(0, 5.7, 0));
    b.add(G.box(0.7, 0.42, 0.04), T0.flag, T(0.37, 6.05, 0));
    return 6.2;
  },
  banner(b, T0) {
    b.add(G.cyl(0.07, 0.09, 3, 5), '#6a4a2a', T(0, 1.5, 0));
    b.add(G.oct(0.14), '#ffd54a', T(0, 3.1, 0));
    b.add(G.box(1.1, 0.08, 0.08), '#6a4a2a', T(0, 2.85, 0));
    b.add(G.box(0.95, 1.5, 0.05), T0.flag, T(0, 2.05, 0.05));
    b.add(G.cone(0.48, 0.4, 3), T0.flag, T(0, 1.15, 0.05, 1, 1, 0.12, Math.PI));
    b.add(G.box(0.4, 0.4, 0.06), '#ffd54a', T(0, 2.25, 0.09, 1, 1, 1, 0, 0, Math.PI / 4));
    b.add(G.box(0.5, 0.25, 0.5), T0.border[0], T(0, 0.12, 0));
    return 3.2;
  },
  mushroom(b, T0, r) {
    for (let i = 0; i < 2; i++) {
      const x = i ? 0.55 : 0, s = i ? 0.6 : 1;
      b.add(G.cyl(0.18 * s, 0.24 * s, 0.9 * s, 6), '#f4ead8', T(x, 0.45 * s, i * 0.3));
      b.add(G.sph(0.65 * s, 7, 3), '#e84a3a', T(x, 0.9 * s, i * 0.3, 1, 0.7, 1), 0.06);
      for (let k = 0; k < 4; k++) { const a = k * 1.7 + r(); b.add(G.ico(0.09 * s, 0), '#ffffff', T(x + Math.cos(a) * 0.38 * s, 1.18 * s, i * 0.3 + Math.sin(a) * 0.38 * s)); }
    }
    return 1.4;
  },
  reeds(b, T0, r) {
    for (let i = 0; i < 7; i++) { const a = r() * TAU, d = r() * 0.5, h = 1.1 + r() * 0.9; b.add(G.cone(0.07, h, 4), i % 3 ? T0.leaf[0] : T0.leaf[1], T(Math.cos(a) * d, h / 2, Math.sin(a) * d, 1, 1, 1, (r() - 0.5) * 0.3, 0, (r() - 0.5) * 0.3)); if (i % 3 === 0) b.add(G.cyl(0.08, 0.08, 0.3, 5), '#7a4a2a', T(Math.cos(a) * d, h * 0.8, Math.sin(a) * d)); }
    return 1.6;
  },
  icecrystal(b, T0, r) {
    for (let i = 0; i < 4; i++) { const a = i * 1.6 + r(); b.add(G.oct(0.45), i % 2 ? '#a8e0fa' : '#e0f6ff', T(Math.cos(a) * 0.35 * (i > 0), 0.7 + (i ? 0 : 0.3), Math.sin(a) * 0.35 * (i > 0), 0.6, i ? 1.6 : 2.4, 0.6, Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35), 0.1); }
    b.add(G.dode(0.4), '#b8cce4', T(0, 0.1, 0, 1.4, 0.5, 1.4));
    return 2;
  },
  grave(b, T0, r) {
    const R = T0.rock;
    if (r() < 0.5) { b.add(G.box(0.85, 1.1, 0.25), R[0], T(0, 0.55, 0, 1, 1, 1, 0, 0, (r() - 0.5) * 0.2)); b.add(G.cyl(0.42, 0.42, 0.25, 8, 1), R[0], T(0, 1.1, 0, 1, 1, 1, Math.PI / 2)); }
    else { b.add(G.box(0.22, 1.4, 0.2), R[1], T(0, 0.7, 0)); b.add(G.box(0.9, 0.22, 0.2), R[1], T(0, 1.05, 0)); }
    b.add(G.box(1.0, 0.12, 1.4), shade(T0.g0, -0.25), T(0, 0.05, 0.5));
    return 1.4;
  },
  lantern(b) {
    b.add(G.cyl(0.07, 0.1, 2.2, 5), '#3a3a44', T(0, 1.1, 0));
    b.add(G.box(0.7, 0.07, 0.07), '#3a3a44', T(0.3, 2.15, 0));
    b.add(G.box(0.36, 0.45, 0.36), '#c8ffd8', T(0.6, 1.8, 0));
    b.add(G.cone(0.3, 0.25, 4), '#2a2a34', T(0.6, 2.15, 0, 1, 1, 1, 0, Math.PI / 4));
    return 2.4;
  },
  tentacle(b, T0, r) {
    const L = T0.leaf, bend = (r() - 0.5) * 0.8;
    let x = 0, y = 0, a = 0;
    for (let i = 0; i < 7; i++) { const s = 0.42 - i * 0.05; b.add(G.ico(s, 0), i % 2 ? L[0] : L[1], T(x, y + s, 0)); a += 0.22 + bend * 0.2; x += Math.sin(a) * 0.4; y += Math.cos(a) * 0.48; if (i < 5) b.add(G.ico(0.08, 0), L[2], T(x + 0.25, y, 0.15)); }
    return 3.2;
  },
  vcrystal(b, T0, r) {
    const L = T0.leaf;
    for (let i = 0; i < 5; i++) { const a = i * 1.25 + r(); b.add(G.oct(0.55), i % 2 ? L[0] : L[2], T(Math.cos(a) * 0.4 * (i > 0), 0.9 + (i ? 0 : 0.5), Math.sin(a) * 0.4 * (i > 0), 0.55, i ? 1.7 : 2.6, 0.55, Math.sin(a) * 0.45, 0, -Math.cos(a) * 0.45), 0.12); }
    b.add(G.dode(0.5), T0.rock[1], T(0, 0.1, 0, 1.4, 0.5, 1.4));
    return 2.6;
  },
};
const PROP_LIGHT = { lantern: [0.6, 1.8, 0, '#a8ffc8', 3.2], vcrystal: [0, 1.4, 0, '#d070ff', 4], tree_crystal: [0, 2.6, 0, '#c070ff', 4.5] };

// ---------- Monde ----------
export class World3D {
  constructor(scene, zone, avoid = [], { banner = null } = {}) {
    this.zone = zone;
    this.T = THEMES[zone.bg] || THEMES.lane;
    this.L = LOOK[zone.bg] || LOOK.lane;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.r = rng('w2d' + zone.id);
    this.features = banner || World2D.prototype.makeFeatures.call(this);
    this.avoid = avoid;
    this.mats = [];
    this.t = 0;
    this.lights = [];
    this.lim = banner ? banner.lim : HALF + EDGE;
    this.buildGround();
    this.buildFeatures();
    this.buildProps(banner);
    this.buildDetails();
    if (!banner) this.buildAmbient();
    else this.refresh(banner.cx, banner.cy, banner.wx, banner.up, banner.down);
  }

  onFeature(x, y, pad = 0) { return World2D.prototype.onFeature.call(this, x, y, pad); }

  // sol : grande grille à facettes, couleurs de l'herbe nuancées par un bruit, collines au-delà du bord
  buildGround() {
    const T0 = this.T, L = this.L, lim = this.lim, step = 64, n = Math.ceil(lim * 2 / step);
    const g = new THREE.PlaneGeometry(n * step * S, n * step * S, n, n);
    g.rotateX(-Math.PI / 2);
    const P = g.attributes.position.array;
    for (let i = 0; i < P.length; i += 3) {
      const x = P[i] / S, y = P[i + 2] / S;
      const inside = Math.max(Math.abs(x), Math.abs(y)) < HALF - 60;
      if (!inside) P[i + 1] = heightAt(x, y);
      else { P[i] += (hash2(x, y) - 0.5) * 0.5; P[i + 2] += (hash2(y, x) - 0.5) * 0.5; } // facettes irrégulières
    }
    const gi = g.toNonIndexed(); g.dispose();
    const Q = gi.attributes.position.array, C = new Float32Array(Q.length);
    const c0 = col(T0.g0), c1 = col(T0.g1), c2 = col(T0.g2), ce = col(L.hill), tmp = new THREE.Color();
    for (let i = 0; i < Q.length; i += 9) {
      const x = (Q[i] + Q[i + 3] + Q[i + 6]) / 3 / S, y = (Q[i + 2] + Q[i + 5] + Q[i + 8]) / 3 / S, h = (Q[i + 1] + Q[i + 4] + Q[i + 7]) / 3;
      const nz = vnoise(x * 0.0045, y * 0.0045), nz2 = vnoise(x * 0.02 + 7, y * 0.02);
      tmp.copy(nz < 0.42 ? c1 : nz > 0.62 ? c2 : c0).lerp(nz2 > 0.5 ? c2 : c1, 0.18 + (hash2(x, y) - 0.5) * 0.12);
      const v = 0.94 + hash2(y + 3, x) * 0.1;
      if (h > 0.05) tmp.lerp(ce, smooth(0, 4, h) * 0.7);
      for (let k = 0; k < 9; k += 3) { C[i + k] = tmp.r * v; C[i + k + 1] = tmp.g * v; C[i + k + 2] = tmp.b * v; }
    }
    gi.setAttribute('color', new THREE.BufferAttribute(C, 3));
    gi.computeVertexNormals();
    const map = grassTex(this.zone.bg, '#ffffff', '#c8d0c0', '#ffffff');
    const g0 = map.clone(); g0.needsUpdate = true; g0.repeat.set(n * step * S / 4, n * step * S / 4);
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, map: g0 });
    this.mats.push(mat); this.ground = new THREE.Mesh(gi, mat);
    // l'UV de PlaneGeometry couvre 0..1 : la répétition fait le reste
    this.group.add(this.ground);
  }

  // ruban le long d'une polyligne (chemins, rivières, failles), UV : u le long, v en travers
  ribbon(pts, w, y, uScale = 4) {
    const pos = [], uv = [], idx = [];
    let d = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
      const nx = -dy / l * w / 2, ny = dx / l * w / 2, [x, z] = pts[i];
      if (i) d += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      pos.push((x + nx) * S, y + heightAt(x + nx, z + ny), (z + ny) * S, (x - nx) * S, y + heightAt(x - nx, z - ny), (z - ny) * S);
      uv.push(d * S / uScale, 0, d * S / uScale, w * S / uScale);
      if (i) { const o = (i - 1) * 2; idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }
  // polyligne plus dense (virages lisses)
  dense(pts, step = 30) {
    const out = [];
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step));
      for (let k = 0; k < n; k++) out.push([ax + (bx - ax) * k / n, ay + (by - ay) * k / n]);
    }
    out.push(pts[pts.length - 1]);
    return out;
  }

  buildFeatures() {
    const T0 = this.T, F = this.features, grp = this.group, bg = this.zone.bg;
    this.water = [];
    const lam = o => { const m = new THREE.MeshLambertMaterial(o); this.mats.push(m); return m; };
    const stones = [];
    for (const Ln of F.lines) {
      const pts = this.dense(Ln.pts);
      if (Ln.kind === 'path') {
        const kind = T0.path;
        const edge = new THREE.Mesh(this.ribbon(pts, Ln.w + 18, 0.03), lam({ color: col(shade(T0.pave[3], -0.15)) }));
        const t = paveTex(bg, T0.pave, kind).clone(); t.needsUpdate = true;
        const main = new THREE.Mesh(this.ribbon(pts, Ln.w, 0.06, kind === 'stones' ? 3 : 2.4), lam({ map: t }));
        edge.renderOrder = -2; main.renderOrder = -1;
        grp.add(edge, main);
        // pierres de bordure
        if (kind !== 'void') for (let i = 0; i < pts.length; i++) if (i % 2 === 0) for (const sd of [-1, 1]) stones.push(this.side(pts, i, (Ln.w / 2 + 8) * sd, kind === 'dirt' ? 0.5 : 0.75));
      } else if (Ln.kind === 'water') {
        const foam = new THREE.Mesh(this.ribbon(pts, Ln.w + 26, 0.035), lam({ color: col(T0.foam || '#e8fbff') }));
        const wt = waterTex(bg, T0.water, T0.water2, T0.foam || '#e8fbff').clone(); wt.needsUpdate = true;
        const wm = new THREE.MeshBasicMaterial({ map: wt, color: col('#ffffff') }); this.mats.push(wm);
        const main = new THREE.Mesh(this.ribbon(pts, Ln.w, 0.07, 3), wm);
        const deep = new THREE.Mesh(this.ribbon(pts, Ln.w * 0.45, 0.08, 3), new THREE.MeshBasicMaterial({ color: col(T0.water2), transparent: true, opacity: 0.35, depthWrite: false }));
        this.mats.push(deep.material);
        foam.renderOrder = -2; main.renderOrder = -1; deep.renderOrder = 0;
        grp.add(foam, main, deep);
        this.water.push(wt);
        for (let i = 0; i < pts.length; i++) for (const sd of [-1, 1]) if ((i + (sd > 0)) % 2 === 0) stones.push(this.side(pts, i, (Ln.w / 2 + 14) * sd, 0.9));
      } else if (Ln.kind === 'crack') {
        const m1 = new THREE.MeshBasicMaterial({ color: col(T0.crack), transparent: true, opacity: 0.55, blending: ADD, depthWrite: false });
        const m2 = new THREE.MeshBasicMaterial({ color: col('#ffe0ff') });
        this.mats.push(m1, m2);
        const glow = new THREE.Mesh(this.ribbon(pts, 34, 0.05), m1), core = new THREE.Mesh(this.ribbon(pts, 9, 0.07), m2);
        grp.add(glow, core); this.crackMat = m1;
      }
    }
    // ponts de bois
    const bb = new Build(11);
    for (const B of F.bridges) {
      const n = Math.max(3, Math.round(B.len / 16)), ca = Math.cos(B.a), sa = Math.sin(B.a), w = B.w * S;
      for (let i = 0; i < n; i++) {
        const k = (i / (n - 1) - 0.5) * B.len, x = (B.x + ca * k) * S, z = (B.y + sa * k) * S, arch = Math.cos((i / (n - 1) - 0.5) * Math.PI) * 0.35;
        bb.add(G.box(0.62, 0.16, w), i % 2 ? '#b07a44' : '#9a6a3a', T(x, 0.22 + arch, z, 1, 1, 1, 0, -B.a));
      }
      for (const sd of [-1, 1]) for (let i = 0; i < n; i += 2) {
        const k = (i / (n - 1) - 0.5) * B.len, ox = -sa * sd * B.w * 0.5, oy = ca * sd * B.w * 0.5, arch = Math.cos((i / (n - 1) - 0.5) * Math.PI) * 0.35;
        bb.add(G.box(0.14, 0.7, 0.14), '#6a4424', T((B.x + ca * k + ox) * S, 0.5 + arch, (B.y + sa * k + oy) * S));
      }
      for (const sd of [-1, 1]) {
        const ox = -sa * sd * B.w * 0.5, oy = ca * sd * B.w * 0.5;
        bb.add(G.box(B.len * S, 0.1, 0.12), '#7a5030', T((B.x + ox) * S, 0.95, (B.y + oy) * S, 1, 1, 1, 0, -B.a));
      }
    }
    if (F.bridges.length) grp.add(new THREE.Mesh(bb.geo(), lowpoly()));
    // lacs gelés, mares de brume
    for (const b of F.blobs) {
      const g = new THREE.CircleGeometry(1, 20); g.rotateX(-Math.PI / 2);
      const mk = (k, c, y, o = 1) => { const m = new THREE.Mesh(g, o < 1 ? new THREE.MeshBasicMaterial({ color: col(c), transparent: true, opacity: o, depthWrite: false }) : lam({ color: col(c) })); if (o < 1) this.mats.push(m.material); m.position.set(b.x * S, y, b.y * S); m.scale.set((b.rx + k) * S, 1, (b.ry + k) * S); m.rotation.y = -b.rot; m.renderOrder = -1; grp.add(m); };
      if (b.kind === 'ice') { mk(14, '#f4fbff', 0.04); mk(0, T0.ice, 0.07); mk(-b.rx * 0.45, T0.ice2, 0.09, 0.45); }
      else if (b.kind === 'mist') { mk(18, shade(T0.g0, -0.25), 0.04, 0.6); mk(0, T0.mist, 0.06, 0.22); }
    }
    // pierres des bords (rangées par cellules : seules celles autour de la caméra sont dessinées)
    this.scells = new Map();
    if (stones.length) {
      const R = this.T.border, b = new Build(4);
      b.add(G.ico(0.5, 0), R[0], T(0, 0.15, 0, 1, 0.55, 0.85), 0.12, 0.15);
      b.add(G.ico(0.32, 0), R[1], T(0.1, 0.32, -0.05, 1, 0.5, 0.9), 0.1, 0.1);
      this.stonePool = new Pool(this.group, b.geo(), lowpoly(), stones.length, {});
      for (const st of stones) {
        const k = Math.floor(st[0] / PCELL) + ',' + Math.floor(st[1] / PCELL);
        let c = this.scells.get(k); if (!c) this.scells.set(k, c = []);
        c.push(st[0] * S, heightAt(st[0], st[1]), st[1] * S, st[3], st[2]);
      }
    }
  }
  side(pts, i, off, s) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, r = hash2(i, off);
    return [pts[i][0] - dy / l * off + (r - 0.5) * 8, pts[i][1] + dx / l * off + (hash2(off, i) - 0.5) * 8, s * (0.8 + r * 0.5), r * 6];
  }

  // grand décor : mêmes règles de placement que le rendu 2D (cellules de 256, évite les points d'intérêt).
  // Tout est généré au départ, mais seules les cellules autour de la caméra remplissent les instances.
  buildProps(banner) {
    const T0 = this.T, kinds = T0.props.map(p => p[0]), tot = T0.props.reduce((s, p) => s + p[1], 0);
    this.pcells = new Map();
    const all = [];
    const cellOf = (x, y) => Math.floor(x / PCELL) + ',' + Math.floor(y / PCELL);
    const push = p => { const k = cellOf(p.x, p.y); let c = this.pcells.get(k); if (!c) this.pcells.set(k, c = []); c.push(p); all.push(p); };
    if (banner) banner.props.forEach(push);
    else {
      const lim = HALF + EDGE - 100;
      for (let gx = Math.floor(-lim / PCELL); gx <= Math.floor(lim / PCELL); gx++) for (let gy = Math.floor(-lim / PCELL); gy <= Math.floor(lim / PCELL); gy++) {
        const r = rng(`p${this.zone.id}:${gx}:${gy}`), cx = gx * PCELL, cy = gy * PCELL;
        const out = Math.max(Math.abs(cx + PCELL / 2), Math.abs(cy + PCELL / 2));
        const edge = out > HALF - 200, far = out > HALF + 100;
        const n = far ? 5 : edge ? 7 : (r() * 3.2) | 0;
        for (let i = 0; i < n; i++) {
          const x = cx + r() * PCELL, y = cy + r() * PCELL, o2 = Math.max(Math.abs(x), Math.abs(y));
          if (o2 > lim) continue;
          if (!edge && Math.hypot(x, y) < 230) continue;
          if (this.avoid.some(a => Math.hypot(a.x - x, a.y - y) < (a.r || 80))) continue;
          let kind = 'tree';
          if (!edge) { let q = r() * tot; for (const [k, w] of T0.props) { q -= w; if (q <= 0) { kind = k; break; } } }
          else if (r() < 0.3) kind = kinds.includes('rock') ? 'rock' : 'tree';
          if (kind !== 'reeds' && this.onFeature(x, y, 16)) continue;
          if (kind === 'reeds' && !this.onFeature(x, y, 30) && r() < 0.7) continue;
          push({ x, y, kind, v: (r() * 3) | 0, s: (0.85 + r() * 0.35) * (edge ? 1.25 : 1) * (far ? 1.2 : 1), a: r() * TAU });
        }
      }
    }
    this.props = all;
    // un groupe d'instances par sorte et variante
    const count = new Map();
    for (const p of all) count.set(p.kind + p.v, (count.get(p.kind + p.v) || 0) + 1);
    this.propPool = new Map();
    let lights = 0;
    for (const [key, n] of count) {
      const p0 = all.find(p => p.kind + p.v === key), kind = p0.kind, b = new Build(31 + p0.v * 7), r = rng('prop' + this.zone.id + kind + p0.v);
      const h = PROP[kind](b, T0, r);
      const pool = new Pool(this.group, b.geo(), lowpoly(), n);
      pool.h = h; pool.light = PROP_LIGHT[kind === 'tree' ? 'tree_' + T0.tree : kind];
      if (pool.light) lights += n;
      this.propPool.set(key, pool);
    }
    for (const p of all) { p.gy = heightAt(p.x, p.y); p.pool = this.propPool.get(p.kind + p.v); p.h = p.pool.h * p.s; }
    // ombres douces sous le décor
    const sm = new THREE.MeshBasicMaterial({ map: TX.shadow(), color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false });
    this.mats.push(sm);
    this.shadowPool = new Pool(this.group, flatGeo(), sm, Math.max(1, all.length), { order: -1 });
    // halos des lanternes et cristaux
    if (lights) {
      const gm = new THREE.MeshBasicMaterial({ map: TX.glow(), transparent: true, blending: ADD, depthWrite: false, fog: false });
      this.mats.push(gm);
      this.glowPool = new Pool(this.group, billboardGeo(), gm, lights, { color: true, order: 5 });
    }
  }

  // petits détails d'une cellule (touffes, fleurs, cailloux…), générés à la demande
  detailCell(gx, gy) {
    const k = gx + ',' + gy;
    let c = this.dcells.get(k);
    if (c) return c;
    c = [];
    const r = rng(`d${this.zone.id}:${gx}:${gy}`), D = this.dtypes;
    for (let t = 0; t < D.length; t++) {
      const d = D[t], n = Math.floor(d.n + r());
      for (let i = 0; i < n; i++) {
        const x = (gx + r()) * PCELL, y = (gy + r()) * PCELL, s = d.s[0] + r() * (d.s[1] - d.s[0]), a = r() * TAU;
        if (Math.max(Math.abs(x), Math.abs(y)) > HALF + 160) continue;
        if (d.free && this.onFeature(x, y, 4)) continue;
        c.push(t, x * S, heightAt(x, y), y * S, a, s);
      }
    }
    this.dcells.set(k, c);
    return c;
  }

  buildDetails() {
    const T0 = this.T, bg = this.zone.bg, D = this.dtypes = [];
    this.dcells = new Map();
    const add = (b, perCell, free = true, s = [0.8, 1.3]) => D.push({ g: b.geo(), n: perCell, free, s });
    // touffes d'herbe (ou neige)
    const tuft = new Build(5);
    if (bg === 'ice') { tuft.add(G.ico(0.32, 0), '#ffffff', T(0, 0.05, 0, 1.4, 0.45, 1.1), 0.05); tuft.add(G.ico(0.2, 0), '#e4f0fa', T(0.3, 0.04, 0.1, 1.2, 0.5, 1)); }
    else for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + 0.4; tuft.add(new THREE.ConeGeometry(0.09, 0.5 + (i % 2) * 0.22, 3, 1, true), i % 2 ? T0.tuft : T0.tuft2, T(Math.cos(a) * 0.12, 0.25, Math.sin(a) * 0.12, 1, 1, 1, Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35), 0.1); }
    add(tuft, 34);
    // fleurs
    const fl = T0.flowers || [];
    for (let v = 0; v < Math.min(3, fl.length); v++) {
      const b = new Build(8 + v);
      b.add(new THREE.ConeGeometry(0.2, 0.32, 3, 1, true), '#3a8a2a', T(0, 0.16, 0, 1, 1, 1, Math.PI));
      for (let i = 0; i < 3; i++) { const a = i * 2.1, d = i ? 0.2 : 0; b.add(G.oct(0.12), fl[(v + i) % fl.length], T(Math.cos(a) * d, 0.3 + (i ? 0 : 0.06), Math.sin(a) * d, 1, 0.6, 1)); }
      add(b, 4);
    }
    // cailloux
    const pb = new Build(12); pb.add(G.ico(0.22, 0), T0.rock[0], T(0, 0.06, 0, 1.2, 0.55, 1), 0.12, 0.2); pb.add(G.oct(0.13), T0.rock[1], T(0.25, 0.04, 0.12, 1, 0.6, 1), 0.1, 0.2);
    add(pb, 3.5, false);
    // touche du thème
    if (bg === 'jungle' || bg === 'lane' || bg === 'river') { const b = new Build(2); b.add(new THREE.CylinderGeometry(0.05, 0.07, 0.3, 4, 1, true), '#f4ead8', T(0, 0.15, 0)); b.add(G.sph(0.18, 6, 2), '#ff5a3a', T(0, 0.3, 0, 1, 0.6, 1)); add(b, bg === 'jungle' ? 4 : 1.2); }
    if (bg === 'ice') { const b = new Build(2); b.add(G.oct(0.2), '#bfeaff', T(0, 0.25, 0, 0.6, 1.8, 0.6), 0.1); b.add(G.oct(0.14), '#ffffff', T(0.15, 0.15, 0.05, 0.6, 1.4, 0.6, 0, 0, 0.4)); add(b, 4.5); }
    if (bg === 'shadow') { const b = new Build(2); b.add(G.box(0.08, 0.06, 0.5), '#e8e0d0', T(0, 0.04, 0, 1, 1, 1, 0, 0.4)); b.add(G.ico(0.13, 0), '#e8e0d0', T(0.1, 0.1, 0.3)); add(b, 3); }
    if (bg === 'void') { const b = new Build(2); b.add(G.oct(0.18), '#e070ff', T(0, 0.2, 0, 0.7, 1.8, 0.7), 0.1); add(b, 4.5); }
    this.dpools = D.map(d => new Pool(this.group, d.g, lowpoly(), Math.ceil((d.n + 1) * 1.2 * 7 * 9)));
  }

  // remplit les instances du décor et des détails autour d'un point (px) : appelé quand la caméra change de cellule
  refresh(x, y, wx = 600, up = 1150, down = 760) {
    const gx0 = Math.floor((x - wx) / PCELL), gx1 = Math.floor((x + wx) / PCELL), gy0 = Math.floor((y - up) / PCELL), gy1 = Math.floor((y + down) / PCELL);
    for (const p of this.propPool.values()) p.begin();
    this.shadowPool.begin(); this.glowPool?.begin();
    for (const p of this.dpools) p.begin();
    const SP = this.stonePool; SP?.begin();
    const sh = this.shadowPool, gl = this.glowPool, dark = this.L.dark ? 0.75 : 0.45;
    for (let gx = gx0; gx <= gx1; gx++) for (let gy = gy0; gy <= gy1; gy++) {
      const sc = SP && this.scells.get(gx + ',' + gy);
      if (sc) for (let i = 0; i < sc.length; i += 5) SP.put(sc[i], sc[i + 1], sc[i + 2], sc[i + 3], sc[i + 4], sc[i + 4] * 0.9, sc[i + 4]);
      const list = this.pcells.get(gx + ',' + gy);
      if (list) for (const p of list) {
        const P = p.pool, noRot = p.kind === 'tower' || p.kind === 'banner';
        P.put(p.x * S, p.gy, p.y * S, noRot ? 0 : p.a, p.s);
        const w = (p.kind === 'tree' ? 3.6 : p.kind === 'tower' ? 3 : p.kind === 'bush' ? 2 : 1.8) * p.s;
        sh.put(p.x * S + 0.25 * p.s, p.gy + 0.08, p.y * S + 0.2 * p.s, 0, w, 1, w * 0.8);
        if (P.light && gl) { const Lt = P.light, i = gl.put(p.x * S + Lt[0] * p.s, p.gy + Lt[1] * p.s, p.y * S, 0, Lt[4] * p.s); gl.tint(i, col(Lt[3]), dark); }
      }
      if (Math.max(Math.abs(gx * PCELL + PCELL / 2), Math.abs(gy * PCELL + PCELL / 2)) > HALF + 300) continue;
      const c = this.detailCell(gx, gy), DP = this.dpools;
      for (let i = 0; i < c.length; i += 6) DP[c[i]].put(c[i + 1], c[i + 2], c[i + 3], c[i + 4], c[i + 5]);
    }
    for (const p of this.propPool.values()) p.end();
    this.shadowPool.end(); this.glowPool?.end();
    for (const p of this.dpools) p.end();
    SP?.end();
    this.rx = x; this.ry = y;
  }
  // à chaque image : on ne recalcule que si la caméra s'est assez déplacée
  follow(x, y) { if (this.rx == null || Math.abs(x - this.rx) > 180 || Math.abs(y - this.ry) > 180) this.refresh(x, y); }

  // particules d'ambiance autour de la caméra (feuilles, lucioles, bulles, neige, brume, Néant)
  buildAmbient() {
    const kind = this.T.ambient, n = kind === 'mist' ? 14 : kind === 'snow' ? 140 : 60;
    const add = kind === 'firefly' || kind === 'void' || kind === 'bubble';
    const m = new THREE.MeshBasicMaterial({ map: kind === 'mist' ? TX.soft() : kind === 'leaf' ? null : TX.glow(), transparent: true, depthWrite: false, blending: add ? ADD : THREE.NormalBlending, fog: false, opacity: kind === 'mist' ? 0.12 : 1 });
    this.mats.push(m);
    const g = kind === 'leaf' ? new THREE.PlaneGeometry(0.3, 0.16) : billboardGeo();
    this.amb = { kind, pool: new Pool(this.group, g, m, n, { color: true, order: 8 }), q: [] };
    if (kind === 'leaf') m.side = THREE.DoubleSide;
    const c = { leaf: ['#8acb62', '#5a9a3a'], firefly: ['#d8ff6a'], bubble: ['#ffffff'], snow: ['#ffffff'], mist: ['#9affe0'], void: ['#e070ff', '#ffb0ff'] }[kind] || ['#ffffff'];
    for (let i = 0; i < n; i++) this.amb.q.push({ x: (Math.random() - 0.5) * 34, y: Math.random() * 8, z: (Math.random() - 0.5) * 60, ph: Math.random() * TAU, s: 0.6 + Math.random() * 0.8, v: 0.6 + Math.random() * 0.6, c: col(c[i % c.length]) });
  }

  update(dt, t, cx, cz) {
    this.t = t;
    for (const w of this.water) { w.offset.x -= dt * 0.05; }
    if (this.crackMat) this.crackMat.opacity = 0.45 + Math.sin(t * 2.4) * 0.2;
    const A = this.amb;
    if (!A) return;
    const P = A.pool, k = A.kind;
    P.begin();
    for (const q of A.q) {
      if (k === 'snow') { q.y -= 2.2 * q.v * dt; q.x += Math.sin(t + q.ph) * 0.6 * dt; }
      else if (k === 'leaf') { q.y -= 1.0 * q.v * dt; q.x += (0.7 + Math.sin(t * 1.5 + q.ph)) * dt; }
      else if (k === 'firefly' || k === 'bubble') { q.x += Math.sin(t * 0.7 + q.ph) * 0.7 * dt; q.z += Math.cos(t * 0.9 + q.ph) * 0.5 * dt; q.y += (k === 'bubble' ? 0.6 : Math.sin(t + q.ph) * 0.3) * dt; }
      else if (k === 'void') q.y += 0.9 * q.v * dt;
      else if (k === 'mist') q.x += 0.4 * q.v * dt;
      if (q.y < 0) q.y += 8; if (q.y > 8) q.y -= 8;
      // enroulement autour de la caméra
      let x = q.x, z = q.z;
      x = ((x - cx) % 34 + 51) % 34 - 17 + cx; z = ((z - cz) % 60 + 90) % 60 - 30 + cz;
      q.x = x; q.z = z;
      let i;
      if (k === 'leaf') { i = P.putM(leafM(x, q.y + 1, z, t * 2 * q.v + q.ph, q.s)); P.tint(i, q.c); }
      else if (k === 'mist') { i = P.put(x, 0.8 + q.y * 0.15, z, 0, 9 * q.s, 4 * q.s, 1); P.tint(i, q.c); }
      else {
        const s = k === 'snow' ? 0.22 * q.s : k === 'bubble' ? 0.3 * q.s : 0.55 * q.s;
        i = P.put(x, q.y + 0.3, z, 0, s);
        const a = k === 'firefly' ? 0.5 + Math.sin(t * 3 + q.ph) * 0.45 : k === 'void' ? 0.5 + Math.sin(t * 4 + q.ph) * 0.3 : k === 'bubble' ? 0.35 : 0.9;
        P.tint(i, q.c, a);
      }
    }
    P.end();
  }

  dispose() {
    this.group.parent?.remove(this.group);
    this.group.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.isInstancedMesh) o.dispose(); });
    for (const m of this.mats) { m.map?.dispose?.(); m.dispose(); }
  }
}
const _lm = new Float32Array(16);
function leafM(x, y, z, a, s) {
  const c = Math.cos(a), sn = Math.sin(a), f = Math.cos(a * 1.7);
  _lm[0] = c * s; _lm[1] = sn * s; _lm[2] = 0; _lm[3] = 0;
  _lm[4] = -sn * s * f; _lm[5] = c * s * f; _lm[6] = 0.3 * s; _lm[7] = 0;
  _lm[8] = 0; _lm[9] = -0.3 * s; _lm[10] = s; _lm[11] = 0;
  _lm[12] = x; _lm[13] = y; _lm[14] = z; _lm[15] = 1;
  return _lm;
}

// ---------- Bandeau d'une zone : petit diorama 3D rendu une fois (URL d'image en cache) ----------
const banners = new Map();
let bannerR = null, bannerKill = 0;
export function zoneBannerURL(zone) {
  if (banners.has(zone.id)) return banners.get(zone.id);
  let url = '';
  try {
    const W = 360, H = 120, res = 2;
    if (!bannerR) { bannerR = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: false }); bannerR.setPixelRatio(1); }
    bannerR.setSize(W * res, H * res, false);
    clearTimeout(bannerKill);
    bannerKill = setTimeout(() => { bannerR?.dispose(); bannerR?.forceContextLoss?.(); bannerR = null; }, 4000);
    const L = LOOK[zone.bg] || LOOK.lane, T0 = THEMES[zone.bg] || THEMES.lane;
    const scene = new THREE.Scene();
    scene.background = col(L.fog);
    scene.add(new THREE.HemisphereLight(col(L.sky), col(L.grd), L.hemi + (L.dark ? 0.6 : 0)));
    const sun = new THREE.DirectionalLight(col(L.sun), L.sunI + (L.dark ? 0.5 : 0)); sun.position.set(-4, 8, 5); scene.add(sun);
    // décor : chemin en diagonale à gauche (sous le texte), décor typique à droite
    const x0 = -60, y0 = -40, bf = { lines: [], blobs: [], bridges: [], lim: 760, props: [], cx: 160, cy: -30, wx: 420, up: 320, down: 320 };
    bf.lines.push({ pts: [[x0 - 80, y0 + 260], [x0 + 60, y0 + 90], [x0 + 150, y0 + 10], [x0 + 260, y0 - 130]], w: 70, kind: 'path' });
    if (zone.bg === 'river') { bf.lines.push({ pts: [[200, -260], [260, -20], [300, 260]], w: 90, kind: 'water' }); bf.bridges.push({ x: 250, y: -60, a: -0.9, len: 150, w: 56 }); }
    if (zone.bg === 'ice') bf.blobs.push({ x: 300, y: 40, rx: 90, ry: 50, rot: 0.1, kind: 'ice' });
    if (zone.bg === 'shadow') bf.blobs.push({ x: 260, y: 50, rx: 80, ry: 40, rot: 0.1, kind: 'mist' });
    if (zone.bg === 'void') bf.lines.push({ pts: [[100, 120], [170, 60], [250, 80], [320, 20], [400, 40]], w: 8, kind: 'crack' });
    const kinds = T0.props.map(p => p[0]).filter(k => k !== 'tower' && k !== 'banner' && k !== 'reeds');
    const r = rng('banner' + zone.id);
    const spots = [[120, -120, 0.9], [200, 70, 1], [300, -110, 1.1, 'tree'], [400, 60, 1.2, 'tree'], [470, -90, 1.15, 'tree'], [520, 90, 1.1], [360, -20, 0.8]];
    if (T0.props.some(p => p[0] === 'tower')) spots.push([250, -50, 0.75, 'tower']); else if (T0.props.some(p => p[0] === 'banner')) spots.push([250, -40, 0.9, 'banner']);
    for (const [x, y, s, k] of spots) bf.props.push({ x, y, kind: k || kinds[(r() * kinds.length) | 0], v: (r() * 3) | 0, s, a: r() * TAU });
    const w = new World3D(scene, zone, [], { banner: bf });
    const cam = new THREE.PerspectiveCamera(30, W / H, 1, 400);
    const tx = 170 * S, tz = -10 * S, D = 26;
    cam.position.set(tx, Math.sin(PITCH_B) * D, tz + Math.cos(PITCH_B) * D); cam.lookAt(tx, 0, tz);
    if (L.dark) scene.fog = null;
    bannerR.render(scene, cam);
    // lumière douce en haut à gauche, comme une arène au soleil
    const c = document.createElement('canvas'); c.width = W * res; c.height = H * res;
    const g = c.getContext('2d');
    g.drawImage(bannerR.domElement, 0, 0);
    const sunG = g.createLinearGradient(0, 0, c.width, c.height); sunG.addColorStop(0, 'rgba(255,250,220,.16)'); sunG.addColorStop(0.6, 'rgba(255,250,220,0)'); sunG.addColorStop(1, 'rgba(0,0,40,.14)');
    g.fillStyle = sunG; g.fillRect(0, 0, c.width, c.height);
    url = c.toDataURL('image/jpeg', 0.86);
    w.dispose();
  } catch (e) { url = ''; }
  if (url) banners.set(zone.id, url);
  return url;
}
const PITCH_B = 0.8;
