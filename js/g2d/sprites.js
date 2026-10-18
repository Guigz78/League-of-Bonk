// Sprites 2D façon Clash Royale : personnages « jouets » en 3D douce (lumière chaude en haut à gauche, liseré froid
// en bas à droite, reflets brillants, contour fin de la couleur locale), peints une seule fois puis réutilisés.
// Repère de dessin : unités du monde, origine aux pieds, regard vers la droite.
import { CLASSES, EVOLUTIONS, PETS, ZONES } from '../data.js';
import { rng, hash, shade } from '../pixel.js';

const TAU = Math.PI * 2;
export const OUT = '#1a1030';
let LW = 1; // multiplicateur d'épaisseur des traits (plus fin pour les grands sprites)

function cnv(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
  return c;
}

// Cuisson d'un sprite : dessin + contour autour de la silhouette (+ variantes blanche, gelée, rouge, enragée).
// W×H : boîte en unités du monde, (ax, ay) : point d'ancrage (les pieds) dans la boîte. oc : couleur du contour.
export function bake(W, H, ax, ay, res, draw, { outline = 2.2, variants = false, glow = null, oc = OUT } = {}) {
  const pad = outline + 2 + (glow ? glow.r : 0);
  const cw = (W + pad * 2) * res, ch = (H + pad * 2) * res;
  const art = cnv(cw, ch), g = art.getContext('2d');
  g.setTransform(res, 0, 0, res, (ax + pad) * res, (ay + pad) * res);
  g.lineJoin = 'round'; g.lineCap = 'round';
  draw(g);
  const sil = col => {
    const c = cnv(cw, ch), q = c.getContext('2d');
    q.drawImage(art, 0, 0);
    q.globalCompositeOperation = 'source-in';
    q.fillStyle = col; q.fillRect(0, 0, cw, ch);
    return c;
  };
  const ringOf = (src, r) => {
    const c = cnv(cw, ch), o = c.getContext('2d'), n = r < 3.5 ? 8 : 16;
    for (let i = 0; i < n; i++) { const a = i / n * TAU; o.drawImage(src, Math.cos(a) * r, Math.sin(a) * r); }
    o.drawImage(src, 0, 0);
    return c;
  };
  const ring = outline > 0 ? ringOf(sil(oc), outline * res) : null;
  let halo = null;
  if (glow) { // halo flou (ombre portée décalée hors du canevas : marche aussi sur Safari)
    halo = cnv(cw, ch); const q = halo.getContext('2d'), sg = sil(glow.c);
    q.shadowColor = glow.c; q.shadowBlur = glow.r * res * 1.6; q.shadowOffsetX = cw * 3; q.globalAlpha = glow.a ?? 0.7;
    q.drawImage(sg, -cw * 3, 0); q.drawImage(sg, -cw * 3, 0);
  }
  const compose = top => {
    const c = cnv(cw, ch), q = c.getContext('2d');
    if (halo) q.drawImage(halo, 0, 0);
    if (ring) q.drawImage(ring, 0, 0);
    q.drawImage(top, 0, 0);
    return c;
  };
  const spr = { c: compose(art), w: cw / res, h: ch / res, ax: ax + pad, ay: ay + pad };
  if (variants) {
    // les variantes ne sont préparées qu'au premier usage (cuisson plus rapide)
    const lazy = (k, make) => Object.defineProperty(spr, k, {
      configurable: true, enumerable: true,
      get() { const v = make(); Object.defineProperty(spr, k, { value: v, writable: true, enumerable: true }); return v; },
    });
    const tint = col => {
      const c = cnv(cw, ch), q = c.getContext('2d');
      q.drawImage(art, 0, 0); q.globalCompositeOperation = 'source-atop'; q.fillStyle = col; q.fillRect(0, 0, cw, ch);
      return c;
    };
    lazy('white', () => compose(tint('rgba(255,255,255,.78)')));
    lazy('ice', () => compose(tint('rgba(150,220,255,.62)')));
    lazy('red', () => compose(sil('#ff3a4a')));
    // « enragée » (monstres devenus fous après le chrono) : contour rouge et teinte chaude
    lazy('rage', () => {
      const rg = ringOf(sil('#ff2a3a'), (outline + 0.9) * res), rq = rg.getContext('2d');
      if (ring) rq.drawImage(ring, 0, 0);
      rq.drawImage(tint('rgba(255,60,40,.22)'), 0, 0);
      return rg;
    });
  }
  return spr;
}

// ---------- Aides de dessin (partagées avec le décor) ----------
function P() { return new Path2D(); }
function ell(x, y, rx, ry, rot = 0) { const p = P(); p.ellipse(x, y, rx, ry, rot, 0, TAU); return p; }
function rrect(x, y, w, h, r) {
  const p = P(); r = Math.min(r, w / 2, h / 2);
  p.moveTo(x + r, y); p.arcTo(x + w, y, x + w, y + h, r); p.arcTo(x + w, y + h, x, y + h, r);
  p.arcTo(x, y + h, x, y, r); p.arcTo(x, y, x + w, y, r); p.closePath();
  return p;
}
function poly(pts) { const p = P(); pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y))); p.closePath(); return p; }

// remplissage ombré : teinte sombre en bas à droite, base décalée vers le haut-gauche, reflet clair
function fillShaded(g, path, base, { dark = shade(base, -0.28), light = shade(base, 0.35), off = 2.4, hl = null, line = 1.1 } = {}) {
  g.fillStyle = dark; g.fill(path);
  g.save(); g.clip(path);
  g.translate(-off * 0.6, -off); g.fillStyle = base; g.fill(path);
  g.restore();
  if (hl) {
    g.save(); g.clip(path); g.fillStyle = light; g.globalAlpha = hl.a ?? 0.85;
    g.fill(ell(hl.x, hl.y, hl.rx, hl.ry, hl.rot || 0)); g.restore();
  }
  if (line) { g.lineWidth = line; g.strokeStyle = OUT; g.stroke(path); }
}

function eye(g, x, y, rx, ry, { pupil = OUT, look = 0.35, iris = null, angry = 0 } = {}) {
  g.fillStyle = '#ffffff'; g.fill(ell(x, y, rx, ry));
  g.lineWidth = 0.9; g.strokeStyle = OUT; g.stroke(ell(x, y, rx, ry));
  if (iris) { g.fillStyle = iris; g.fill(ell(x + rx * look, y + ry * 0.1, rx * 0.68, ry * 0.72)); }
  g.fillStyle = pupil; g.fill(ell(x + rx * look * 1.2, y + ry * 0.12, rx * 0.45, ry * 0.52));
  g.fillStyle = '#ffffff'; g.fill(ell(x + rx * look * 0.4 - rx * 0.12, y - ry * 0.3, rx * 0.26, ry * 0.24));
  if (angry) {
    g.strokeStyle = OUT; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(x - rx * 1.1, y - ry * 1.25 - angry); g.lineTo(x + rx * 1.1, y - ry * 0.95 + angry * 0.4); g.stroke();
  }
}

function glowDot(g, x, y, r, col) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r * 2.4);
  gr.addColorStop(0, col); gr.addColorStop(0.35, col + 'aa'); gr.addColorStop(1, col + '00');
  g.fillStyle = gr; g.fillRect(x - r * 2.4, y - r * 2.4, r * 4.8, r * 4.8);
  g.fillStyle = '#ffffff'; g.fill(ell(x, y, r * 0.55, r * 0.55));
}

function crown(g, x, y, w, col = '#ffd54a', gems = '#ff4a6a') {
  const h = w * 0.62;
  const p = poly([[x - w / 2, y], [x - w / 2, y - h], [x - w / 4, y - h * 0.5], [x, y - h * 1.15], [x + w / 4, y - h * 0.5], [x + w / 2, y - h], [x + w / 2, y]]);
  fillShaded(g, p, col, { off: 1, line: 1 });
  g.fillStyle = gems; g.fill(ell(x, y - h * 0.35, w * 0.09, w * 0.09));
}

// ---------- Couleurs et volumes « 3D doux » ----------
function rgb(h) { const n = parseInt(h.slice(1, 7), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
export function mix(a, b, k) {
  const A = rgb(a), B = rgb(b), f = i => Math.round(A[i] + (B[i] - A[i]) * k);
  return '#' + ((1 << 24) | (f(0) << 16) | (f(1) << 8) | f(2)).toString(16).slice(1);
}
function rgba(h, a) { const [r, g, b] = rgb(h); return `rgba(${r},${g},${b},${a})`; }
const TONES = new Map();
// lumière chaude, ombre violacée, liseré bleuté, contour sombre de la même teinte
function tone(c) {
  let t = TONES.get(c);
  if (!t) TONES.set(c, t = { lt: mix(c, '#fff4da', 0.45), dk: mix(c, '#2a1446', 0.4), rim: mix(c, '#cfeaff', 0.5), ol: mix(c, '#140a22', 0.72) });
  return t;
}

// chemin SVG avec sa boîte (pour placer les dégradés) ; E / RR : ellipse et rectangle arrondi avec boîte
function sp(d) {
  const p = new Path2D(d), n = d.match(/-?\d*\.?\d+(?:e-?\d+)?/g).map(Number);
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (let i = 0; i + 1 < n.length; i += 2) { const x = n[i], y = n[i + 1]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  p.b = [x0, y0, x1, y1];
  return p;
}
function E(x, y, rx, ry, rot = 0) {
  const p = ell(x, y, rx, ry, rot), r = Math.max(rx, ry);
  p.b = rot ? [x - r, y - r, x + r, y + r] : [x - rx, y - ry, x + rx, y + ry];
  return p;
}
function RR(x, y, w, h, r) { const p = rrect(x, y, w, h, r); p.b = [x, y, x + w, y + h]; return p; }

// volume : dégradé radial (lumière chaude en haut à gauche → ombre propre), liseré froid en bas à droite,
// reflet brillant (gl), contour fin couleur locale (lw, ol)
function vol(g, p, col, o = {}) {
  const T = tone(col), [x0, y0, x1, y1] = o.b || p.b, w = x1 - x0, h = y1 - y0, R = Math.max(w, h);
  g.fillStyle = o.rim || T.rim; g.fill(p);
  g.save(); g.clip(p);
  const d = o.d ?? Math.min(1.8, 0.3 + R * 0.055);
  g.translate(-d * 0.5, -d);
  const lx = x0 + w * (o.lx ?? 0.3), ly = y0 + h * (o.ly ?? 0.22);
  const gr = g.createRadialGradient(lx, ly, 0, lx, ly, R * (o.sp ?? 1));
  gr.addColorStop(0, o.lt || T.lt); gr.addColorStop(o.mid ?? 0.42, col); gr.addColorStop(1, o.dk || T.dk);
  g.fillStyle = gr; g.fill(p);
  g.translate(d * 0.5, d);
  if (o.gl) { // reflet
    const s = o.gl, gx = x0 + w * (o.gx ?? 0.3), gy = y0 + h * (o.gy ?? 0.2), r = Math.min(w, h) * 0.3 * Math.min(1.6, s);
    const hg = g.createRadialGradient(gx, gy, 0, gx, gy, r);
    hg.addColorStop(0, `rgba(255,255,255,${Math.min(0.95, 0.55 + s * 0.3)})`); hg.addColorStop(0.45, 'rgba(255,255,255,.35)'); hg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = hg; g.fillRect(gx - r, gy - r, r * 2, r * 2);
  }
  g.restore();
  if (o.lw !== 0) { g.lineWidth = (o.lw || 0.7) * LW; g.strokeStyle = o.ol || T.ol; g.stroke(p); }
}
// trait épais coloré avec contour (cordes, manches d'arme, pattes fines)
function rod(g, path, col, w, ol = tone(col).ol) {
  g.lineWidth = w + 1.2 * LW; g.strokeStyle = ol; g.stroke(path);
  g.lineWidth = w; g.strokeStyle = col; g.stroke(path);
  g.lineWidth = w * 0.35; g.strokeStyle = rgba(tone(col).lt, 0.8); g.stroke(path);
}
function line(g, d, col, w) { g.lineWidth = w * LW; g.strokeStyle = col; g.stroke(typeof d === 'string' ? new Path2D(d) : d); }

// halos et flammes pour les effets lumineux (cuits une fois par couleur)
const GLOWS = new Map();
function glowSpr(col) {
  let c = GLOWS.get(col);
  if (c) return c;
  c = cnv(64, 64); const q = c.getContext('2d'), gr = q.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, rgba(col, 0.95)); gr.addColorStop(0.5, rgba(col, 0.32)); gr.addColorStop(1, rgba(col, 0));
  q.fillStyle = gr; q.fillRect(0, 0, 64, 64);
  GLOWS.set(col, c);
  return c;
}
function flameSpr(col) {
  const key = 'f' + col;
  let c = GLOWS.get(key);
  if (c) return c;
  c = cnv(40, 96); const q = c.getContext('2d');
  const tongue = (s, a, cc) => {
    const p = new Path2D(`M20 ${92 - 30 * s} Q${20 + 18 * s} ${92 - 6 * s} 20 92 Q${20 - 18 * s} ${92 - 6 * s} 20 ${92 - 30 * s} Z`);
    const p2 = new Path2D();
    p2.moveTo(20, 92 - 90 * s); p2.bezierCurveTo(20 + 6 * s, 92 - 60 * s, 20 + 19 * s, 92 - 30 * s, 20 + 15 * s, 92 - 12 * s);
    p2.quadraticCurveTo(20, 96, 20 - 15 * s, 92 - 12 * s); p2.bezierCurveTo(20 - 19 * s, 92 - 30 * s, 20 - 6 * s, 92 - 60 * s, 20, 92 - 90 * s);
    const gr = q.createLinearGradient(0, 92 - 90 * s, 0, 92);
    gr.addColorStop(0, rgba(cc, 0)); gr.addColorStop(0.45, rgba(cc, a * 0.7)); gr.addColorStop(1, rgba(cc, a));
    q.fillStyle = gr; q.fill(p2); void p;
  };
  tongue(1, 0.7, mix(col, col === '#7ae8ff' ? '#2a7aff' : '#ff7a00', 0.35)); tongue(0.75, 0.85, col); tongue(0.45, 0.9, mix(col, '#ffffff', 0.7));
  GLOWS.set(key, c);
  return c;
}

// coquille de flammes de l'aura ultime (60×86 unités, pieds en (30, 82)) : bord vif, intérieur translucide
function auraShell(col) {
  const key = 's' + col;
  let c = GLOWS.get(key);
  if (c) return c;
  const k = 4, W = 60, H = 86;
  c = cnv(W * k, H * k); const q = c.getContext('2d');
  const d = 'M0 4 C-17 4 -21 -14 -19.5 -30 Q-21 -43 -14 -51 L-17.5 -62 L-9.5 -55 L-9 -71 L-3 -60 L1 -81 L5 -60 L10.5 -72 L11 -55 L19 -63 L16.5 -50 Q23 -42 21.5 -30 C23 -14 18 4 0 4 Z';
  const p = new Path2D(d);
  q.setTransform(k, 0, 0, k, 30 * k, 82 * k);
  // halo doux (ombre portée décalée hors du canevas)
  q.save(); q.shadowColor = col; q.shadowBlur = 6 * k; q.shadowOffsetX = W * k * 3; q.translate(-W * 3, 0);
  q.fillStyle = rgba(col, 0.75); q.fill(p); q.restore();
  q.fillStyle = rgba(col, 0.45); q.fill(p);
  q.save(); q.translate(1, -24); q.scale(0.8, 0.84); q.translate(-1, 24); q.globalCompositeOperation = 'destination-out'; q.fillStyle = 'rgba(0,0,0,.55)'; q.fill(p); q.restore();
  q.lineJoin = 'round'; q.strokeStyle = rgba(mix(col, '#ffffff', 0.6), 0.8); q.lineWidth = 1.2; q.stroke(p);
  GLOWS.set(key, c);
  return c;
}

// ---------- Visages ----------
const INK = '#2a1430';
// œil façon CR : petit, brillant, avec reflet ; lid = paupière supérieure (air décidé), look = direction du regard
function eyeC(g, x, y, rx, ry, o = {}) {
  const ink = o.ink || INK;
  if (o.closed) { // paupière fermée (clin d'œil)
    g.strokeStyle = ink; g.lineWidth = 0.85 * LW; g.beginPath(); g.moveTo(x - rx, y + ry * 0.1); g.quadraticCurveTo(x, y + ry * 0.75, x + rx, y + ry * 0.1); g.stroke();
    return;
  }
  if (o.ko) { // yeux en croix
    g.strokeStyle = ink; g.lineWidth = 0.9 * LW; g.beginPath();
    g.moveTo(x - rx, y - ry * 0.8); g.lineTo(x + rx, y + ry * 0.8); g.moveTo(x + rx, y - ry * 0.8); g.lineTo(x - rx, y + ry * 0.8); g.stroke();
    return;
  }
  if (o.squeeze) { // yeux plissés « > <»
    const s = o.squeeze; g.strokeStyle = ink; g.lineWidth = 0.9 * LW; g.beginPath();
    g.moveTo(x - rx * s, y - ry * 0.7); g.lineTo(x + rx * s * 0.8, y); g.lineTo(x - rx * s, y + ry * 0.7); g.stroke();
    return;
  }
  const lk = o.look ?? 0.3, e = E(x, y, rx, ry);
  g.fillStyle = o.white || '#ffffff'; g.fill(e);
  g.save(); g.clip(e);
  // ombre de la paupière en haut
  g.fillStyle = 'rgba(80,60,120,.22)'; g.fill(E(x, y - ry * 0.95, rx * 1.3, ry * 0.55));
  if (o.iris) { g.fillStyle = o.iris; g.fill(E(x + rx * lk, y + ry * 0.12, rx * 0.74, ry * 0.76)); }
  g.fillStyle = o.pupil || ink; g.fill(E(x + rx * lk * 1.15, y + ry * 0.16, rx * (o.iris ? 0.42 : 0.56), ry * (o.iris ? 0.46 : 0.6)));
  g.fillStyle = '#ffffff'; g.fill(E(x + rx * lk * 0.5 - rx * 0.18, y - ry * 0.28, rx * 0.3, ry * 0.27));
  if (o.lid) { g.fillStyle = o.skin || '#ffd9b8'; g.fillRect(x - rx * 1.2, y - ry * 1.2, rx * 2.4, ry * 2.4 * o.lid * 0.5); }
  g.restore();
  g.lineWidth = 0.6 * LW; g.strokeStyle = ink; g.stroke(e);
  if (o.lid) { g.lineWidth = 0.9 * LW; g.beginPath(); g.moveTo(x - rx * 1.05, y - ry + ry * 2 * o.lid * 0.5 + ry * 0.1); g.lineTo(x + rx * 1.05, y - ry + ry * 2 * o.lid * 0.5 - ry * 0.05); g.stroke(); }
}
function brow(g, x0, y0, x1, y1, col, th, bend = 0) {
  g.strokeStyle = col; g.lineWidth = th * LW; g.lineCap = 'round';
  g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 - bend, x1, y1); g.stroke();
}
// bouches : sourire, grand sourire avec dents, cri, grimace
function mouth(g, kind, x, y, w, o = {}) {
  const ink = o.ink || INK;
  if (kind === 'smile') {
    g.strokeStyle = ink; g.lineWidth = 0.8 * LW; g.beginPath(); g.moveTo(x - w / 2, y - w * 0.12); g.quadraticCurveTo(x, y + w * 0.42, x + w / 2, y - w * 0.18); g.stroke();
  } else if (kind === 'smirk') {
    g.strokeStyle = ink; g.lineWidth = 0.8 * LW; g.beginPath(); g.moveTo(x - w / 2, y + w * 0.05); g.quadraticCurveTo(x + w * 0.1, y + w * 0.3, x + w / 2, y - w * 0.28); g.stroke();
  } else if (kind === 'grin' || kind === 'shout' || kind === 'ouch') {
    const h = kind === 'shout' ? w * 0.75 : kind === 'ouch' ? w * 0.45 : w * 0.5;
    const m = kind === 'grin'
      ? sp(`M${x - w / 2} ${y - h * 0.3} Q${x} ${y - h * 0.05} ${x + w / 2} ${y - h * 0.4} Q${x + w * 0.4} ${y + h * 0.9} ${x} ${y + h * 0.75} Q${x - w * 0.45} ${y + h * 0.6} ${x - w / 2} ${y - h * 0.3} Z`)
      : E(x, y + h * 0.15, w / 2, h / 2);
    g.fillStyle = '#5a1428'; g.fill(m);
    g.save(); g.clip(m);
    g.fillStyle = '#ff7088'; g.fill(E(x + w * 0.05, y + h * 0.75, w * 0.32, h * 0.38));
    if (kind !== 'ouch') { g.fillStyle = '#ffffff'; g.fillRect(x - w / 2, y - h, w, h * (kind === 'grin' ? 0.92 : 0.82)); }
    g.restore();
    g.lineWidth = 0.7 * LW; g.strokeStyle = ink; g.stroke(m);
  } else if (kind === 'wavy') {
    g.strokeStyle = ink; g.lineWidth = 0.8 * LW; g.beginPath(); g.moveTo(x - w / 2, y);
    g.quadraticCurveTo(x - w / 4, y - w * 0.25, x, y); g.quadraticCurveTo(x + w / 4, y + w * 0.25, x + w / 2, y); g.stroke();
  }
}

// ---------- Héros : marionnette animée ----------
// Chaque morceau (jambes, buste, bras, tête et ses expressions, cape, arme, ailes…) est peint une fois à la
// résolution d'affichage, puis assemblé à chaque image (marche, respiration, clignement, cape, saut, attaque, aura).
const SKIN = '#ffd9b8';

export function heroColors(clsId, evo = 0) {
  const base = CLASSES[clsId].colors, ev = EVOLUTIONS[clsId][evo] || {};
  return { s: SKIN, ...base, ...(ev.colors || {}) };
}

const SSJ_HAIR = { mage: '#ffe94a', archer: '#c8fbff', knight: '#ffe070' };
function heroPal(cls, evo) {
  const C = heroColors(cls, evo), ev = EVOLUTIONS[cls][evo] || {};
  C.cls = cls; C.evo = evo; C.aura = ev.aura || null;
  if (evo >= 4) C.h = SSJ_HAIR[cls];
  C.blue = '#3a7aff'; // couleur d'équipe
  if (cls === 'mage') {
    C.pants = mix(C.c, '#1a1030', 0.45); C.boot = mix(C.c, '#1a1030', 0.15); C.bootTrim = C.a;
    C.sleeve = C[1]; C.hand = C.s; C.iris = ['#4a8aff', '#ff5ad0', '#ffc23a', '#3ad0ff', '#ff9a2a'][evo];
  } else if (cls === 'archer') {
    C.pants = mix(C[2], '#1a1030', 0.35); C.boot = '#9a6236'; C.bootTrim = evo >= 1 ? '#f4fbff' : '#c88a4a';
    C.sleeve = C[1]; C.hand = evo >= 2 ? '#e8f4ff' : '#c88a4a'; C.iris = ['#3aa0ff', '#5ad0ff', '#7ab8ff', '#ff5ad8', '#5ae8ff'][evo];
  } else {
    C.pants = mix(C[2], '#1a1030', 0.3); C.boot = C[1]; C.bootTrim = evo >= 1 ? (C.a || '#e6b422') : null;
    C.sleeve = C[1]; C.hand = C[2]; C.iris = evo === 3 ? '#ff8a2a' : evo >= 4 ? '#fff0a0' : '#5a8aff';
  }
  C.wood = '#b0743a';
  return C;
}

// morceau de marionnette : petite toile centrée sur son pivot (x0..x1, y0..y1 en unités autour du pivot)
function piece(res, x0, y0, x1, y1, draw) {
  const pad = 1.2, c = cnv((x1 - x0 + pad * 2) * res, (y1 - y0 + pad * 2) * res), g = c.getContext('2d');
  g.setTransform(res, 0, 0, res, (pad - x0) * res, (pad - y0) * res);
  g.lineJoin = 'round'; g.lineCap = 'round';
  draw(g);
  return { c, x: x0 - pad, y: y0 - pad, w: c.width / res, h: c.height / res, wc: null };
}
function whiteOf(pc) {
  if (!pc.wc) {
    const c = cnv(pc.c.width, pc.c.height), q = c.getContext('2d');
    q.drawImage(pc.c, 0, 0); q.globalCompositeOperation = 'source-in'; q.fillStyle = '#ffffff'; q.fillRect(0, 0, c.width, c.height);
    pc.wc = c;
  }
  return pc.wc;
}

// ----- morceaux communs -----
function heroLeg(g, C, front) {
  const dim = c => (front ? c : mix(c, '#24123e', 0.18));
  vol(g, RR(-2.7, -1.6, 5.4, 7.2, 2.5), dim(C.pants), { lw: 0.6 });
  const b = sp('M-3.2 4.1 Q-3.7 8.7 -0.5 8.7 L4.6 8.7 Q6.9 8.7 6.2 6.3 Q5.5 4 2.5 3.6 Q-0.6 3.3 -3.2 4.1 Z');
  vol(g, b, dim(C.boot), { gl: 0.7, gx: 0.6, gy: 0.25 });
  if (C.bootTrim) vol(g, RR(-3.5, 2.9, 6.6, 2.1, 1), dim(C.bootTrim), { lw: 0.5, gl: 0.5 });
}

function heroArm(g, C, front) {
  const dim = c => (front ? c : mix(c, '#24123e', 0.2)), cls = C.cls, ev = C.evo;
  if (cls === 'mage') { // grande manche évasée
    vol(g, sp('M-2.6 -2.4 Q2.8 -3 2.9 0 L4.1 5.6 Q0 7.4 -4 5.6 L-2.9 0 Q-3 -2 -2.6 -2.4 Z'), dim(C.sleeve));
    vol(g, sp('M-4.2 4.6 Q0 6.6 4.3 4.6 L4.5 6.2 Q0 8.4 -4.4 6.2 Z'), dim(C.a), { lw: 0.5, gl: 0.6 });
  } else if (cls === 'archer') {
    vol(g, RR(-2.6, -2.2, 5.2, 8, 2.6), dim(C.sleeve));
    vol(g, RR(-3, 3.6, 6, 3, 1.3), dim(ev >= 2 ? C[3] : '#8a5a34'), { lw: 0.5, gl: 0.5 }); // brassard
  } else {
    vol(g, RR(-2.8, -2, 5.6, 8, 2.6), dim(C[2]));
    vol(g, RR(-3.2, 3.4, 6.4, 3.2, 1.4), dim(C[1]), { gl: 0.8, lw: 0.55 });
  }
  vol(g, E(0, 8.1, 3.4, 3.25), dim(C.hand), { gl: 0.55 });
  line(g, `M-1.6 6.9 Q-0.2 8.4 -1.4 9.6`, rgba(tone(dim(C.hand)).ol, 0.6), 0.5);
  // épaulière
  if (cls === 'knight') {
    const r = ev >= 1 ? 5.4 : 4.5;
    if (ev === 3) for (const a of [-2.4, -1.7, -1]) vol(g, sp(`M${Math.cos(a - 0.25) * r * 0.8} ${-1 + Math.sin(a - 0.25) * r * 0.7} L${Math.cos(a) * (r + 3.4)} ${-1 + Math.sin(a) * (r + 3)} L${Math.cos(a + 0.25) * r * 0.8} ${-1 + Math.sin(a + 0.25) * r * 0.7} Z`), dim('#d8d0c0'), { lw: 0.5 });
    vol(g, E(0, -1, r, r * 0.82), dim(C[1]), { gl: 1.1, gx: 0.32, gy: 0.28 });
    if (ev >= 1) line(g, new Path2D(`M${-r * 0.9} 0.6 Q0 ${r * 0.7} ${r * 0.9} 0.6`), dim(C.a), 1);
    g.fillStyle = dim(C.a); g.fill(E(r * 0.25, -1.6, 0.9, 0.9));
  } else if (cls === 'archer' && ev >= 1) {
    vol(g, sp('M-3.6 -1 L-1.8 -6 L0.2 -2.4 L2 -5.2 L3.6 -0.6 Q0 1.4 -3.6 -1 Z'), dim(ev >= 3 ? C[3] : '#bfeaff'), { gl: 1.2, lw: 0.5 });
  } else if (cls === 'mage' && ev >= 1) {
    vol(g, E(0, -1.4, 3.8, 2.6), dim(C.c), { gl: 0.6, lw: 0.5 });
  }
}

function heroCape(g, C) {
  const ev = C.evo, L = [11.5, 13, 14.5, 15.5, 17][ev], W0 = ev >= 2 ? 8 : 7;
  const p = sp(`M-5 0 Q${-W0 - 2} ${L * 0.45} ${-W0 - 2.5} ${L} Q${-1} ${L + 2.4} ${6} ${L - 0.6} Q5.2 ${L * 0.45} 5 0 Z`);
  vol(g, p, C.c, { lx: 0.65, ly: 0.1, sp: 1.2 });
  // plis
  line(g, `M-2.5 1.5 Q-4.5 ${L * 0.5} -4.5 ${L - 0.5}`, rgba(tone(C.c).dk, 0.55), 0.8);
  line(g, `M1.5 2 Q1 ${L * 0.5} 1.6 ${L + 0.2}`, rgba(tone(C.c).dk, 0.45), 0.7);
  if (ev >= 2) { // bordure dorée
    g.save(); g.clip(p); line(g, `M${-W0 - 3.5} ${L - 1.2} Q-1 ${L + 1.4} 7 ${L - 1.8}`, C.a || '#ffd54a', 1.4); g.restore();
  }
  if (ev === 3 && C.cls === 'archer') { // aurore
    g.save(); g.clip(p); const gr = g.createLinearGradient(-8, 0, 6, L);
    gr.addColorStop(0, 'rgba(90,255,200,.0)'); gr.addColorStop(0.5, 'rgba(90,255,200,.35)'); gr.addColorStop(1, 'rgba(255,106,216,.45)');
    g.fillStyle = gr; g.fill(p); g.restore();
  }
}

// aile (pointe vers la gauche/haut, pivot à la racine) : plumes, cristal ou énergie
function heroWing(g, C, kind) {
  const col = kind === 'crystal' ? (C.evo >= 4 ? '#d8f8ff' : C[3]) : kind === 'gold' ? '#ffe070' : '#ffffff';
  if (kind === 'crystal') {
    const S = C.evo >= 4 ? 1.25 : 1;
    for (let i = 0; i < 5; i++) {
      const a = -2.85 + i * 0.3, L = (27 - Math.abs(i - 1.2) * 4) * S, w = 3.6 * S;
      const tip = [Math.cos(a) * L, Math.sin(a) * L], n = [-Math.sin(a) * w, Math.cos(a) * w];
      const p = sp(`M${n[0] * 0.4} ${n[1] * 0.4} L${tip[0] * 0.55 + n[0]} ${tip[1] * 0.55 + n[1]} L${tip[0]} ${tip[1]} L${tip[0] * 0.6 - n[0]} ${tip[1] * 0.6 - n[1]} L${-n[0] * 0.4} ${-n[1] * 0.4} Z`);
      g.globalAlpha = 0.9; vol(g, p, mix(col, i % 2 ? (C.a || '#ffffff') : col, 0.35), { gl: 1.4, lw: 0.65, rim: '#ffffff', ol: mix(col, '#1a3a6a', 0.6) }); g.globalAlpha = 1;
      line(g, `M0 0 L${tip[0] * 0.8} ${tip[1] * 0.8}`, 'rgba(255,255,255,.6)', 0.5);
    }
    return;
  }
  const S = kind === 'gold' || C.cls === 'knight' ? 1.3 : 1.1, dk = kind === 'gold' ? '#e0901a' : '#aebee8';
  const feathers = [[-2.95, 21], [-2.68, 25], [-2.38, 26], [-2.08, 24], [-1.78, 20], [-1.5, 15]];
  for (const [a, L0] of feathers) {
    const L = L0 * S, tip = [Math.cos(a) * L, Math.sin(a) * L], n = [-Math.sin(a) * 3.4 * S, Math.cos(a) * 3.4 * S];
    const p = sp(`M0 0 Q${tip[0] * 0.5 + n[0]} ${tip[1] * 0.5 + n[1]} ${tip[0]} ${tip[1]} Q${tip[0] * 0.55 - n[0] * 0.6} ${tip[1] * 0.55 - n[1] * 0.6} 0 2 Z`);
    vol(g, p, col, { gl: 0.6, lw: 0.6, dk, ol: mix(dk, '#2a1a40', 0.55) });
  }
  // couverture (plumes du haut)
  const cov = sp(`M1.4 1.4 Q${-9 * S} ${-12 * S} ${-17 * S} ${-11 * S} Q${-12 * S} ${-5 * S} ${-14 * S} ${-1 * S} Q${-6 * S} ${0.8 * S} 1 3.4 Z`);
  vol(g, cov, kind === 'gold' ? '#fff2a8' : '#ffffff', { gl: 0.9, lw: 0.6, dk, ol: mix(dk, '#2a1a40', 0.55) });
  line(g, `M-1 0 Q${-8 * S} ${-8 * S} ${-15 * S} ${-9.6 * S}`, kind === 'gold' ? '#ffffff' : C.cls === 'knight' ? '#ffc23a' : C.a || '#ffd54a', 1);
}

// ----- Lumi (mage) -----
function mageTorso(g, C) {
  const ev = C.evo;
  const robe = sp('M-6.6 -12.6 L7.2 -12.6 Q9.9 -5.5 11.2 3.5 Q0.8 6.2 -10 3.5 Q-8.7 -5.5 -6.6 -12.6 Z');
  vol(g, robe, C[1], { gl: 0.5, sp: 1.15 });
  g.save(); g.clip(robe);
  line(g, 'M-10.2 1.8 Q0.8 4.6 11.4 1.8', C.a, 1.6); // ourlet
  if (ev >= 2) { g.fillStyle = rgba(C.a, 0.85); for (const [x, y, r] of [[-5, -1, 1], [6, 0.5, 1.2], [2, -9, 0.8], [-3, -8, 0.7], [8, -6, 0.8]]) star4(g, x, y, r); }
  g.restore();
  // pan central
  vol(g, sp('M0.2 -6 L3.6 -6 L4.6 4.4 Q2.6 4.9 -0.8 4.6 Z'), mix(C[1], C.c, 0.55), { lw: 0.5 });
  // ceinture + gemme
  vol(g, RR(-8, -6.8, 16.6, 2.8, 1.3), C.c, { gl: 0.5 });
  vol(g, E(2.2, -5.4, 1.7, 1.7), C.a, { gl: 1.4, lw: 0.5 });
  // col doré
  vol(g, sp('M-5 -13 Q1 -10 7 -13 Q7.5 -11 1 -9.2 Q-5.4 -11 -5 -13 Z'), C.a, { gl: 0.8, lw: 0.5 });
  if (ev >= 1) { // mantelet
    vol(g, sp('M-7.5 -13.5 Q1 -15.5 9.2 -13.4 Q10.6 -9.5 7.4 -8.4 Q1 -7.2 -5.6 -8.4 Q-9 -9.6 -7.5 -13.5 Z'), C.c, { gl: 0.6 });
    g.save(); g.clip(sp('M-7.5 -13.5 Q1 -15.5 9.2 -13.4 Q10.6 -9.5 7.4 -8.4 Q1 -7.2 -5.6 -8.4 Q-9 -9.6 -7.5 -13.5 Z'));
    line(g, 'M-7.4 -9.4 Q1 -7.8 9.6 -9.4', C.a, 1); g.restore();
    vol(g, E(1.2, -11, 1.6, 1.6), ev >= 3 ? C.a : '#ff6ad8', { gl: 1.5, lw: 0.5 });
  }
}
function star4(g, x, y, r) {
  g.beginPath(); g.moveTo(x, y - r * 2); g.quadraticCurveTo(x, y, x + r * 2, y); g.quadraticCurveTo(x, y, x, y + r * 2);
  g.quadraticCurveTo(x, y, x - r * 2, y); g.quadraticCurveTo(x, y, x, y - r * 2); g.fill();
}
function starPath(x, y, r, n = 5, k = 0.45) {
  let d = '';
  for (let i = 0; i < n * 2; i++) { const a = -Math.PI / 2 + i / (n * 2) * TAU, rr = i % 2 ? r * k : r; d += (i ? 'L' : 'M') + (x + Math.cos(a) * rr).toFixed(2) + ' ' + (y + Math.sin(a) * rr).toFixed(2) + ' '; }
  return sp(d + 'Z');
}

// tête de base (repère : centre de la tête) : visage, oreille, joues ; F = réglages du visage
function headBase(g, C) {
  const face = E(0, 0, 11.3, 10.7);
  vol(g, face, C.s, { lt: '#fff2e4', dk: '#e49a7e', rim: '#ffe4dc', ol: '#8a4a3a', lx: 0.42, ly: 0.2, gl: 0.35, gx: 0.45, gy: 0.18 });
  g.fillStyle = 'rgba(255,110,120,.33)'; g.fill(E(1.4, 4.6, 2.5, 1.5)); g.fill(E(9.6, 4.3, 1.6, 1.3));
}
// regard selon l'expression : v = idle | blink | shout | hurt | ko
function heroEyes(g, C, v, F) {
  const [nx, ny, nrx, nry] = F.near, [fx, fy, frx, fry] = F.far, ssj = C.evo >= 4;
  const iris = ssj ? (C.aura === '#7ae8ff' ? '#3ac8ff' : '#1ec8a8') : C.iris, base = { iris, skin: C.s, look: 0.35, lid: ssj ? 0.3 : F.lid || 0 };
  if (v === 'blink') { eyeC(g, nx, ny, nrx, nry, { closed: 1 }); eyeC(g, fx, fy, frx, fry, { closed: 1 }); }
  else if (v === 'hurt') { eyeC(g, nx, ny, nrx, nry, { squeeze: 1 }); eyeC(g, fx, fy, frx, fry, { squeeze: -0.9 }); }
  else if (v === 'ko') { eyeC(g, nx, ny, nrx * 0.9, nry * 0.8, { ko: 1 }); eyeC(g, fx, fy, frx * 0.9, fry * 0.8, { ko: 1 }); }
  else {
    const lid = v === 'shout' ? Math.max(base.lid, 0.35) : base.lid;
    eyeC(g, nx, ny, nrx, nry, { ...base, lid }); eyeC(g, fx, fy, frx, fry, { ...base, lid });
    if (F.lash) { g.strokeStyle = INK; g.lineWidth = 0.7 * LW; g.beginPath(); g.moveTo(nx - nrx * 0.9, ny - nry * 0.6); g.lineTo(nx - nrx * 1.5, ny - nry * 1.05); g.moveTo(fx + frx * 0.8, fy - fry * 0.7); g.lineTo(fx + frx * 1.3, fy - fry * 1.1); g.stroke(); }
  }
  // sourcils : plus froncés pendant l'attaque et en forme ultime
  const fierce = v === 'shout' || ssj ? 1 : 0, bt = F.browTh, bc = F.browCol;
  if (v === 'hurt' || v === 'ko') { brow(g, nx - nrx, ny - nry - 2.2, nx + nrx, ny - nry - 1.2, bc, bt, -0.4); brow(g, fx - frx, fy - fry - 1.2, fx + frx, fy - fry - 2, bc, bt * 0.9, -0.3); }
  else {
    const d = F.browDown + fierce * 1;
    brow(g, nx - nrx * 1.1, ny - nry - 1.9, nx + nrx * 1.05, ny - nry - 1.9 + d, bc, bt, F.browBend);
    brow(g, fx - frx * 0.9, fy - fry - 1.7 + d * 0.9, fx + frx * 1.1, fy - fry - 2, bc, bt * 0.9, F.browBend);
  }
}

function mageHead(g, C, v) {
  const ev = C.evo, ssj = ev >= 4;
  if (ssj) superHair(g, C, 'mage');
  headBase(g, C);
  heroEyes(g, C, v, MAGE_F);
  line(g, 'M6.4 3.4 Q7.3 4.4 6.3 4.8', '#c0705a', 0.6); // petit nez
  mouth(g, v === 'shout' ? 'shout' : v === 'hurt' || v === 'ko' ? 'ouch' : 'smile', 4.8, 6.6, v === 'shout' ? 3.6 : 3.2);
  if (ssj) { superFringe(g, C, 'mage'); diadem(g, C); return; }
  // frange + mèche devant l'oreille
  const fr = sp('M-11.6 1 Q-12.4 -10 -2 -11.6 Q9 -12.6 11.6 -3 Q8.2 -6.4 5.2 -4.6 Q3.4 -7.6 0 -5.2 Q-3 -7.4 -6.4 -4.4 Q-8.6 -3 -8.6 1.4 L-9 7.6 Q-11.4 6 -11.6 1 Z');
  vol(g, fr, C.h, { gl: 0.9, gx: 0.35, gy: 0.18, lx: 0.3, ly: 0.1 });
  wizardHat(g, C);
}
function wizardHat(g, C) {
  const ev = C.evo, hc = ev === 1 ? '#8a3ab8' : ev === 2 ? '#2a1a6a' : ev === 3 ? '#f4f8ff' : C.c;
  vol(g, E(0.6, -7.6, 15.6, 4.3, -0.05), hc, { gl: 0.5, ly: 0.1 });
  const cone = sp('M-9.4 -8.6 Q-4 -18 -4.6 -27.6 Q-9.6 -28.4 -13.6 -24.8 Q-8.6 -26 -2.6 -31.6 Q2.4 -19 10.4 -9 Q0.8 -5.8 -9.4 -8.6 Z');
  vol(g, cone, hc, { gl: 0.6, lx: 0.4, ly: 0.35 });
  // bande + boucle
  const band = sp('M-9.2 -8.8 Q0.8 -6 10.2 -9.2 L8.6 -12.6 Q0.4 -9.8 -8 -12.2 Z');
  vol(g, band, ev === 3 ? '#5ad8ff' : C.a, { gl: 0.9, lw: 0.55 });
  if (ev === 2) vol(g, sp('M-1 -24 Q-6 -20 -2 -15.6 Q-4.4 -20 -1 -24 Z'), '#ffd54a', { lw: 0.5, gl: 1 }); // croissant de lune
  vol(g, starPath(0.6, -10.6, 2.6), ev === 1 ? '#ff6ad8' : ev === 3 ? '#ffd54a' : '#ffe48a', { gl: 1.2, lw: 0.5 });
  if (ev >= 2) { g.fillStyle = '#ffffff'; star4(g, 4, -17, 0.55); star4(g, -6, -15, 0.45); }
}
const MAGE_F = { near: [2.8, 1.2, 2.35, 2.85], far: [8.3, 1.0, 1.85, 2.6], browCol: '#b07a3a', browTh: 0.8, browDown: 0, browBend: 0.5, lash: 1 };

// cheveux de super guerrier : grandes mèches en pointes dressées vers l'arrière
// grosses mèches en pointes, dressées et balayées vers l'arrière (derrière le visage)
const SSJ_PATH = 'M11.4 -2 Q12.2 -8.6 9.8 -10.6 L14.6 -19.6 L5.6 -13.6 L5.8 -26.6 L-0.6 -15 L-6.8 -25.8 L-6.2 -12.6 L-15.8 -20.2 L-10.2 -8.2 L-18.6 -9.4 L-11.6 -2 L-16.4 2.4 L-10 4.4 L0 0 Z';
function superHair(g, C, cls) {
  const col = C.h, k = cls === 'knight' ? 0.86 : 1;
  g.save(); g.scale(k, k);
  const p = sp(SSJ_PATH), dk = mix(col, C.aura === '#7ae8ff' ? '#3a8ad8' : '#ff8a00', 0.5);
  vol(g, p, col, { lt: '#ffffff', dk, rim: '#ffffff', gl: 1.3, gx: 0.42, gy: 0.3, lx: 0.45, ly: 0.3, ol: mix(dk, '#2a1000', 0.5), lw: 0.8 });
  // reflets le long des mèches
  g.save(); g.clip(p);
  line(g, 'M3 -9 L9.6 -16.4 M-1 -11 L3.6 -21 M-5 -10 L-6 -21 M-8 -7 L-13 -16', 'rgba(255,255,255,.75)', 0.9);
  g.restore();
  g.restore();
}
function superFringe(g, C, cls) {
  const col = C.h, dk = mix(col, C.aura === '#7ae8ff' ? '#3a8ad8' : '#ff8a00', 0.45);
  const fr = sp(cls === 'knight'
    ? 'M-10.6 -1 Q-10.4 -9.8 -1 -10.8 Q8.6 -11.2 11.6 -4 L8.4 -5.4 L8 -1.6 L4.8 -6 L2.8 -2.2 L0.6 -6.4 L-2.6 -3 L-4.4 -6.6 L-7.6 -1.6 Z'
    : 'M-11.4 2 Q-12 -9.4 -2 -11.4 Q8.6 -12.2 11.8 -3.2 L8.8 -4.8 L8.6 -0.8 L5.2 -5.6 L3.4 -1.2 L0.8 -6.2 L-2.2 -2 L-4.4 -6.4 L-7.4 -1.4 L-8.6 4.6 Z');
  vol(g, fr, col, { lt: '#ffffff', dk, rim: '#ffffff', gl: 1, ol: mix(dk, '#2a1000', 0.5) });
}
function diadem(g, C) {
  vol(g, sp('M-8.4 -7.4 Q1 -10.4 10.2 -6.6 L9.6 -5 Q1 -8.4 -8 -5.8 Z'), '#ffd54a', { gl: 1, lw: 0.5 });
  vol(g, sp('M0.6 -9.2 L2.4 -13.6 L4.2 -9 Q2.4 -8.2 0.6 -9.2 Z'), '#ffd54a', { gl: 1, lw: 0.5 });
  vol(g, E(2.4, -9.6, 1.3, 1.3), C.aura === '#7ae8ff' ? '#5ae8ff' : '#ff5a3a', { gl: 1.6, lw: 0.4 });
}
// cheveux longs derrière (dessinés derrière le corps)
function mageHairBack(g, C) {
  if (C.evo >= 4) return;
  const p = sp('M-10.6 -6 Q-15.4 4 -12.8 13 Q-10.6 16.6 -7 15.4 Q-3.6 14 -2.4 10 Q-4.6 4 -2 -2 Z');
  vol(g, p, C.h, { gl: 0.6, lx: 0.4, ly: 0.2 });
  line(g, 'M-11 0 Q-12.4 7 -9.6 13', rgba(tone(C.h).dk, 0.6), 0.6);
}

function staff(g, C) {
  const ev = C.evo, top = -17.5;
  const shaft = new Path2D(`M0.4 10.6 L-0.2 ${top + 2}`);
  rod(g, shaft, ev >= 2 ? '#ffd54a' : C.wood, 2.2);
  vol(g, RR(-1.6, 1.6, 3.2, 2.2, 0.8), C.a || '#ffd54a', { lw: 0.4, gl: 0.8 });
  if (ev === 0) { // croissant doré + étoile
    vol(g, sp(`M-4.4 ${top + 1.6} Q-5 ${top - 4.6} 0.2 ${top - 6.2} Q-3 ${top - 3.4} -2 ${top + 1} Q-0.4 ${top + 2.8} 2.6 ${top + 1.8} Q-1.2 ${top + 4.6} -4.4 ${top + 1.6} Z`), '#ffd54a', { gl: 1, lw: 0.5 });
    vol(g, starPath(1.2, top - 2.2, 3.4), C.a, { gl: 1.6, lw: 0.55, lt: '#ffffff' });
  } else if (ev === 1) { // prisme rose
    vol(g, sp(`M-0.2 ${top - 8} L3.4 ${top - 2} L-0.2 ${top + 2.6} L-3.8 ${top - 2} Z`), '#ff8ae0', { gl: 1.8, lw: 0.55, lt: '#ffffff', rim: '#ffe0ff' });
    line(g, `M-0.2 ${top - 8} L-0.2 ${top + 2.6}`, 'rgba(255,255,255,.6)', 0.5);
  } else if (ev === 2) { // lune et étoile
    vol(g, sp(`M-5 ${top} Q-4.6 ${top - 7.6} 2 ${top - 7.2} Q-2.4 ${top - 5} -2 ${top - 0.4} Q0.6 ${top + 3} 4.6 ${top + 0.6} Q0 ${top + 5.4} -5 ${top} Z`), '#ffe48a', { gl: 1.2, lw: 0.5 });
    vol(g, starPath(1.6, top - 2.6, 2.6), '#ffffff', { gl: 1.5, lw: 0.5, rim: '#cfe0ff' });
  } else { // orbe ailé (céleste) / soleil (supernova)
    const oc = ev >= 4 ? '#fff0a0' : '#8ae8ff';
    for (const sd of [-1, 1]) vol(g, sp(`M${sd * 1.6} ${top - 1} Q${sd * 7} ${top - 7} ${sd * 8.6} ${top - 3} Q${sd * 6} ${top - 2.6} ${sd * 5.4} ${top + 0.6} Q${sd * 3.6} ${top - 0.2} ${sd * 1.6} ${top + 1} Z`), ev >= 4 ? '#ffd54a' : '#ffffff', { lw: 0.5, gl: 0.8 });
    vol(g, E(0, top - 2, 3.6, 3.6), oc, { gl: 1.8, lt: '#ffffff', lw: 0.55 });
  }
}

// ----- Kira (archère) -----
function archerTorso(g, C) {
  const ev = C.evo;
  const tu = sp('M-6.6 -12.6 L7.2 -12.6 Q8.9 -5 9.3 1.8 Q0.6 3.8 -8.2 1.8 Q-8.2 -5 -6.6 -12.6 Z');
  vol(g, tu, C[1], { gl: 0.5, sp: 1.15 });
  g.save(); g.clip(tu);
  line(g, 'M-8.6 0.6 Q0.6 2.8 9.6 0.6', ev >= 1 ? '#ffffff' : C[3], 1.3);
  vol(g, sp('M0.6 -12.6 L3.2 -12.6 L2.6 -6 Z'), C[3], { lw: 0.4 });
  g.restore();
  // ceinture
  vol(g, RR(-8.3, -6.8, 17.4, 2.8, 1.3), '#7a4a26', { gl: 0.5 });
  vol(g, RR(1, -7.3, 3.6, 3.8, 0.8), ev >= 2 ? '#e8f8ff' : '#ffd54a', { gl: 1.2, lw: 0.5 });
  // bandoulière du carquois
  vol(g, sp('M-6.6 -12 L-4.4 -12.8 L8.2 -5.6 L7.2 -4 Z'), '#8a5a34', { lw: 0.5 });
  if (ev >= 4) { // capuche baissée sur les épaules
    vol(g, sp('M-8.6 -13.8 Q1 -16.6 9.6 -13.2 Q10 -9.6 6 -9.6 Q1 -10.8 -4 -9.6 Q-9.4 -10 -8.6 -13.8 Z'), mix(C[1], '#ffffff', 0.3), { gl: 0.8 });
    g.fillStyle = '#ffffff'; g.globalAlpha = 0.9; g.fill(E(1, -13.6, 8.4, 1.6)); g.globalAlpha = 1;
  } else if (ev >= 1) { // col de fourrure
    vol(g, sp('M-7.4 -14 Q1 -16.4 9 -13.8 Q9.4 -11.2 6 -11 Q1 -12.2 -4 -11 Q-8 -11.2 -7.4 -14 Z'), '#f4fbff', { gl: 0.6, dk: '#a8c4e8' });
  }
}
function quiver(g, C) {
  const ev = C.evo;
  for (let i = 0; i < 3; i++) {
    const x = -1.6 + i * 1.6;
    line(g, `M${x} -6 L${x + 0.3} -12`, '#e8d8b0', 0.7);
    vol(g, sp(`M${x - 1.2} -11 L${x + 0.3} -14.6 L${x + 1.6} -11 L${x + 0.3} -12 Z`), i % 2 ? (C.a || '#ffffff') : (ev >= 1 ? '#9ad8ff' : '#ff6a5a'), { lw: 0.4 });
  }
  vol(g, RR(-3, -7.6, 6, 15, 2.6), ev >= 2 ? '#3a5aa8' : '#8a5a34', { gl: 0.7 });
  vol(g, RR(-3.4, -8.4, 6.8, 2.6, 1.2), ev >= 2 ? '#e8f8ff' : '#c88a4a', { lw: 0.5, gl: 0.6 });
}
function archerHead(g, C, v) {
  const ev = C.evo, ssj = ev >= 4;
  const hood = ev === 1 ? '#5aa8e0' : C[1];
  if (ssj) superHair(g, C, 'archer');
  else { // capuche (dos) + pointe
    vol(g, sp('M-11.6 8.4 Q-14.4 -1 -12.2 -8.4 Q-14 -11.6 -17.6 -12.4 Q-12.8 -16.2 -5.4 -14.8 Q7.4 -16.4 12.6 -5 Q13.6 1.4 10.6 6 L-4 10 Z'), hood, { gl: 0.6, lx: 0.45, ly: 0.2 });
  }
  headBase(g, C);
  heroEyes(g, C, v, ARCHER_F);
  line(g, 'M6.6 3.2 Q7.6 4.3 6.5 4.8', '#c0705a', 0.6);
  mouth(g, v === 'shout' ? 'grin' : v === 'hurt' || v === 'ko' ? 'ouch' : 'smirk', 5, 6.8, v === 'shout' ? 3.6 : 3);
  if (ssj) { superFringe(g, C, 'archer'); iceCrown(g, C); return; }
  // mèches blanches sur le front
  const fr = sp('M-8.6 -3 Q-5 -10.4 3 -10.6 Q9.6 -10 11 -4.4 Q8.4 -6.6 6 -5 Q5 -7.6 1.6 -6.2 Q-1.6 -8 -4 -5.4 Q-6.4 -5.6 -8.6 -3 Z');
  vol(g, fr, C.h, { gl: 0.8, dk: '#b0bcd8' });
  // bord de la capuche autour du visage
  const rim = sp('M-9.6 7.6 Q-12.2 -4 -6 -10.4 Q2 -15.4 10.4 -9.2 Q13.4 -6 12.6 -2.2 L10.6 -4.6 Q7 -11.4 0 -10.8 Q-8.4 -9.6 -8.4 1 Q-8.2 5 -6.6 8.2 Z');
  vol(g, rim, ev >= 1 ? '#f4fbff' : mix(hood, '#ffffff', 0.2), { gl: 0.6, dk: ev >= 1 ? '#a8c4e8' : undefined });
  if (ev >= 2) { // diadème de glace
    vol(g, sp('M-1.6 -9.6 L0.6 -15 L2.8 -9.8 Q0.6 -8.6 -1.6 -9.6 Z'), '#bff4ff', { gl: 1.8, lw: 0.5, rim: '#ffffff' });
    vol(g, sp('M2.6 -9.8 L4.4 -13 L5.6 -9.4 Z'), '#bff4ff', { gl: 1.4, lw: 0.45 });
    vol(g, sp('M-3.8 -9.2 L-3.2 -12.4 L-1.4 -9.4 Z'), '#bff4ff', { gl: 1.4, lw: 0.45 });
  }
}
function iceCrown(g, C) {
  for (const [x, h, w] of [[-5, 4.5, 1.6], [-1.4, 7, 2], [2.6, 8.6, 2.2], [6.4, 6, 1.8], [9.4, 3.6, 1.4]])
    vol(g, sp(`M${x - w} -8 L${x} ${-8 - h} L${x + w} -8 Z`), '#c8f8ff', { gl: 1.6, lw: 0.45, rim: '#ffffff' });
  vol(g, sp('M-7.4 -7.2 Q2 -10.2 11 -6.6 L10.6 -5.2 Q2 -8.4 -7 -5.6 Z'), '#e8fbff', { gl: 1, lw: 0.45 });
}
const ARCHER_F = { near: [3.2, 1.6, 2.2, 2.55], far: [8.5, 1.4, 1.75, 2.35], browCol: '#7a8aa8', browTh: 0.95, browDown: 0.7, browBend: 0.2, lid: 0.32 };
// queue de cheval (pivot à l'arrière de la tête)
function ponytail(g, C) {
  const col = C.h;
  const p = sp('M1.6 -2.2 Q-5.4 -4.6 -10.4 -0.2 Q-14.2 4 -12.8 10.6 Q-12 13.8 -9 15 Q-10.4 9.6 -7.6 6 Q-4.6 3 1.6 2.6 Z');
  vol(g, p, col, { gl: 0.8, dk: mix(col, '#7a8aa8', 0.6) });
  line(g, 'M-1 -0.6 Q-8 -0.6 -10.4 6 M-3 1.4 Q-7.4 3 -8.8 9', rgba(mix(col, '#7a8aa8', 0.5), 0.7), 0.5);
  vol(g, E(0.2, 0.4, 2.2, 2.4), C.evo >= 1 ? '#5ad0ff' : '#3a6ad0', { gl: 1, lw: 0.5 });
}
function bow(g, C) {
  const ev = C.evo, col = ev === 0 ? '#b0743a' : ev === 3 ? '#5ae8c8' : '#9ad8ff';
  const limb = new Path2D('M-0.8 -13.4 Q5.4 -10 3.2 -2.6 Q2.4 0 3.2 2.6 Q5.4 10 -0.8 13.4');
  rod(g, limb, col, 2.4);
  if (ev >= 1) for (const sd of [-1, 1]) vol(g, sp(`M-1.6 ${sd * 13} L-0.6 ${sd * 17.4} L1.2 ${sd * 12.6} Z`), ev === 3 ? '#ff8ae0' : '#e8fbff', { gl: 1.5, lw: 0.45, rim: '#ffffff' });
  else for (const sd of [-1, 1]) vol(g, E(-0.6, sd * 13.4, 1.2, 1.2), '#ffd54a', { gl: 1, lw: 0.4 });
  vol(g, RR(1.4, -2.6, 2.8, 5.2, 1.2), ev >= 2 ? '#e8f8ff' : '#6a3a1a', { lw: 0.45 });
  if (ev >= 2) vol(g, sp('M3.6 -2.6 L6.6 0 L3.6 2.6 Z'), ev === 3 ? '#ff8ae0' : '#bff4ff', { gl: 1.6, lw: 0.45, rim: '#ffffff' });
}

// ----- Brok (chevalier) -----
function knightTorso(g, C) {
  const ev = C.evo;
  // pans de la tunique sous la cuirasse
  vol(g, sp('M-8 -2.6 L9 -2.6 L9.8 3.4 Q0.6 5 -8.8 3.4 Z'), ev === 2 ? '#f4f4f8' : C.c, { lw: 0.6 });
  line(g, 'M0.6 -2 L0.6 4.2', rgba(tone(ev === 2 ? '#f4f4f8' : C.c).dk, 0.6), 0.6);
  const plate = sp('M-7.6 -12.8 Q0.6 -14.8 8.8 -12.8 Q10.8 -6.4 8.8 -1.6 Q0.6 0.6 -7.6 -1.6 Q-9.8 -6.4 -7.6 -12.8 Z');
  vol(g, plate, C[1], { gl: 1.3, gx: 0.36, gy: 0.22, lt: mix(C[3], '#ffffff', 0.4), dk: C[2], rim: mix(C[3], '#9ad0ff', 0.5) });
  g.save(); g.clip(plate);
  if (ev === 2) { // tabard blanc à croix rouge
    vol(g, sp('M-3.6 -13 L5.6 -13 L6.4 0 L-4.4 0 Z'), '#f4f4f8', { lw: 0.5 });
    g.fillStyle = C.a; g.fillRect(0, -11.6, 2.2, 10); g.fillRect(-2.6, -8.6, 7.4, 2.2);
  } else {
    line(g, 'M0.8 -13.6 L0.8 -1.2', rgba(C[2], 0.8), 0.7);
    if (ev === 3) for (const [x, y] of [[-4, -9], [5, -9], [0.8, -5]]) { g.fillStyle = '#ff8a2a'; g.fill(E(x, y, 1, 1)); }
  }
  line(g, 'M-8 -2.8 Q0.6 -0.6 9.6 -2.8', ev >= 1 ? C.a : C[2], 1.2);
  g.restore();
  // ceinture + boucle
  vol(g, RR(-8.4, -3.8, 18, 2.8, 1.2), '#6a3e22', { gl: 0.4, lw: 0.55 });
  vol(g, RR(-0.6, -4.3, 3.6, 3.8, 0.9), C.a || '#ffd54a', { gl: 1.4, lw: 0.5 });
  if (ev >= 1 && ev !== 2) vol(g, ev >= 4 ? starPath(0.8, -8.6, 2.8) : E(0.8, -8.4, 2.1, 2.4), ev === 3 ? '#ff8a2a' : ev >= 4 ? '#ffffff' : '#ff4a4a', { gl: 1.6, lw: 0.5 });
}
function knightHead(g, C, v) {
  const ev = C.evo, ssj = ev >= 4;
  if (ssj) superHair(g, C, 'knight');
  headBase(g, C);
  heroEyes(g, C, v, KNIGHT_F);
  // gros nez
  vol(g, E(7.6, 3.4, 2.6, 2.2), '#ffc49c', { lt: '#ffe6d2', dk: '#e0866a', rim: '#ffd8c8', ol: '#8a4a3a', lw: 0.55, gl: 0.8 });
  // bouche sous la moustache
  mouth(g, v === 'shout' ? 'shout' : v === 'hurt' || v === 'ko' ? 'ouch' : 'grin', 5.2, 7.6, v === 'shout' ? 4.6 : 4.4);
  // grosse moustache
  const mc = C.h, ms = sp('M7.4 4.4 Q4.4 3.4 1.6 4.6 Q-1.4 6 -1.2 8.6 Q-0.2 6.8 2.2 7.2 Q4.4 7.4 7 5.8 Q9.4 7.6 12 7.4 Q14 7 14.2 9 Q15.6 5.6 12.4 4.2 Q9.8 3.2 7.4 4.4 Z');
  vol(g, ms, mc, { gl: 0.7, gx: 0.6, gy: 0.2, dk: mix(mc, '#1a0a00', 0.45) });
  line(g, 'M3 5.4 Q4.8 5 6.4 5.4 M9 5.4 Q10.6 5.2 12.2 5.8', rgba(tone(mc).lt, 0.7), 0.5);
  if (ssj) { superFringe(g, C, 'knight'); kingCrown(g, C); return; }
  helmet(g, C);
  // sourcils épais par-dessus le bord du casque
  const fierce = v === 'shout' ? 1 : 0;
  if (v !== 'hurt' && v !== 'ko') { brow(g, 0.6, -2.6, 5.4, -1.6 + fierce, mc, 1.7, 0.6); brow(g, 6.8, -1.6 + fierce * 0.8, 10.6, -2.2, mc, 1.5, 0.5); }
}
const KNIGHT_F = { near: [3.2, 1.5, 1.85, 2.15], far: [8.6, 1.4, 1.5, 1.95], browCol: '#5a3418', browTh: 1.6, browDown: 0.6, browBend: 0.5 };
function helmet(g, C) {
  const ev = C.evo, col = C[1];
  if (ev === 3) for (const sd of [-1, 1]) { // cornes du titan
    const hx = sd < 0 ? -8 : 7;
    vol(g, sp(`M${hx} -7 Q${hx + sd * 7} -10 ${hx + sd * 6.6} -20 Q${hx + sd * 3} -13 ${hx - sd * 1.4} -11.6 Z`), '#efe6d2', { gl: 0.8, lw: 0.55 });
  }
  const hm = sp('M-12.2 6.6 Q-14.2 -12.4 0.2 -13 Q12.6 -13 12.2 -3.4 L11.2 -1.6 Q4 -4.6 -2.4 -2.6 Q-5.6 -1.4 -6.4 3 Q-7.6 8 -12.2 6.6 Z');
  vol(g, hm, col, { gl: 1.4, gx: 0.38, gy: 0.18, lt: mix(C[3], '#ffffff', 0.45), dk: C[2], rim: mix(C[3], '#9ad0ff', 0.55), lx: 0.4, ly: 0.15 });
  // bordure du casque
  line(g, 'M11.6 -2.2 Q4 -5.2 -2.4 -3 Q-6 -1.6 -6.9 3 Q-8 7.4 -12 6.4', ev >= 1 ? C.a : C[2], 1.3);
  // rivets
  g.fillStyle = mix(C[3], '#ffffff', 0.5); for (const [x, y] of [[-9.4, 3], [-8.8, -2], [-6.4, -6.4]]) g.fill(E(x, y, 0.75, 0.75));
  if (ev === 2) { // crête dorée
    vol(g, sp('M-6 -11 Q1 -19 8 -11.4 Q1 -14.4 -6 -11 Z'), '#ffd54a', { gl: 1, lw: 0.5 });
    vol(g, E(1, -14.2, 1.4, 1.4), C.a, { gl: 1.6, lw: 0.45 });
  }
}
function kingCrown(g, C) {
  const p = sp('M-7.4 -7 L-8.6 -14 L-4.4 -10.4 L-1.4 -16 L1.6 -10.6 L5 -15.6 L6.6 -10 L10.6 -13 L10 -6 Q1 -9.4 -7.4 -7 Z');
  vol(g, p, '#ffd54a', { gl: 1.4, lw: 0.55, dk: '#d08a10' });
  for (const [x, y, c] of [[-1.4, -9.6, '#ff3a5a'], [4.4, -9.2, '#3aa0ff'], [-5.8, -9.2, '#3ae87a']]) vol(g, E(x, y, 1, 1), c, { gl: 1.6, lw: 0.35 });
}
// plumet (pivot au sommet du casque)
function plume(g, C) {
  const col = C.evo === 1 ? '#e83a3a' : C.evo === 2 ? '#3a6aff' : C.blue;
  const p = sp('M0.4 0.6 Q-1.4 -6.4 -6.4 -8.4 Q-11.4 -9.6 -15 -6.6 Q-10.6 -6.6 -9 -4.6 Q-13 -3.6 -14.4 -0.6 Q-9.4 -2.4 -5.4 -1 Q-2.4 0.4 0.4 2 Z');
  vol(g, p, col, { gl: 0.9, gx: 0.6, gy: 0.2 });
  line(g, 'M-1 0 Q-6 -4.4 -12.6 -6', rgba(tone(col).lt, 0.75), 0.6);
  vol(g, RR(-1.2, -0.8, 2.6, 3.2, 1), C.a || '#ffd54a', { lw: 0.4, gl: 1 });
}
function sword(g, C) {
  const ev = C.evo, L = [18.5, 19.5, 21, 22, 23][ev], wd = ev >= 2 ? 2.6 : 2.3;
  const blade = sp(`M${-wd} -1.8 L${-wd} ${-L + 3} L0 ${-L} L${wd} ${-L + 3} L${wd} -1.8 Z`);
  const bc = ev === 3 ? '#4a4a5e' : ev >= 4 ? '#fff4c8' : '#dfe8f4';
  vol(g, blade, bc, { gl: 1.1, gx: 0.3, gy: 0.3, lt: '#ffffff', dk: ev === 3 ? '#26263a' : '#7a8cb0', rim: '#bfe4ff', lx: 0.2, ly: 0.5 });
  line(g, `M-0.6 -3 L-0.6 ${-L + 3.4}`, ev === 3 ? 'rgba(255,138,42,.95)' : 'rgba(255,255,255,.75)', ev === 3 ? 1 : 0.7);
  vol(g, RR(-6, -2.6, 12, 2.8, 1.3), ev === 3 ? '#3a3a4a' : C.a || '#e6b422', { gl: 1.2, lw: 0.55 });
  vol(g, RR(-1.3, -0.2, 2.6, 4.6, 0.9), '#6a3e22', { lw: 0.5 });
  vol(g, E(0, 5.2, 1.8, 1.8), ev === 3 ? '#ff8a2a' : ev === 2 ? '#ff3a4a' : C.a || '#e6b422', { gl: 1.4, lw: 0.45 });
}
function shield(g, C) {
  const ev = C.evo, face = ev === 2 ? '#f4f4f8' : ev === 3 ? '#3a3a4a' : ev >= 1 ? '#c83a3a' : C.c;
  vol(g, E(0, 0, 7, 7.6), C.a || '#e6b422', { gl: 1.2, lw: 0.6 });
  vol(g, E(-0.3, -0.2, 5.6, 6.2), face, { gl: 0.7, lw: 0.5 });
  if (ev === 2) { g.fillStyle = '#ff3a4a'; g.fillRect(-1.1, -5, 2.2, 10); g.fillRect(-4.6, -1.6, 9.2, 2.2); }
  else vol(g, ev === 3 ? E(-0.3, -0.2, 2, 2.2) : starPath(-0.3, -0.2, 3), ev === 3 ? '#ff8a2a' : C.a || '#ffd54a', { gl: 1.4, lw: 0.45 });
}

// ----- planche de morceaux d'un héros (par stade et par résolution) -----
const HEAD_V = ['idle', 'blink', 'shout', 'hurt', 'ko'];
function heroSheet(C, res) {
  const cls = C.cls, ev = C.evo, S = { res };
  const torso = cls === 'mage' ? mageTorso : cls === 'archer' ? archerTorso : knightTorso;
  const head = cls === 'mage' ? mageHead : cls === 'archer' ? archerHead : knightHead;
  S.legB = piece(res, -4, -2.5, 7.5, 10, g => heroLeg(g, C, 0));
  S.legF = piece(res, -4, -2.5, 7.5, 10, g => heroLeg(g, C, 1));
  S.armB = piece(res, -7, -8, 7, 12.5, g => heroArm(g, C, 0));
  S.armF = piece(res, -7, -8, 7, 12.5, g => heroArm(g, C, 1));
  S.torso = piece(res, -12, -17.5, 13, 7, g => torso(g, C));
  S.cape = piece(res, -12, -1, 8, 21, g => heroCape(g, C));
  // tête : repère au cou, centre de la tête en (1, -10.5)
  const hb = cls === 'mage' && ev < 4 ? [-18, -44, 18, 4] : [-18, -36, 17, 4];
  S.head = {};
  for (const v of HEAD_V) S.head[v] = piece(res, ...hb, g => { g.translate(1, -10.5); head(g, C, v); });
  if (cls === 'mage') {
    S.hairB = piece(res, -18, -20, 2, 8, g => { g.translate(1, -10.5); mageHairBack(g, C); });
    S.weapon = piece(res, -10, -28, 10, 12, g => staff(g, C));
  } else if (cls === 'archer') {
    if (ev < 4) S.tail = piece(res, -15, -4, 3, 16, g => ponytail(g, C));
    S.quiver = piece(res, -6, -16, 6, 9, g => quiver(g, C));
    S.weapon = piece(res, -3, -19, 8, 19, g => bow(g, C));
  } else {
    if (ev < 4 && ev !== 3) S.tail = piece(res, -16, -11, 3, 4, g => plume(g, C));
    S.weapon = piece(res, -7, -24.5, 7, 8, g => sword(g, C));
    S.shield = piece(res, -9, -9, 9, 9, g => shield(g, C));
  }
  const wk = ev < 3 ? null : cls === 'archer' ? 'crystal' : cls === 'mage' ? (ev >= 4 ? null : 'feather') : ev >= 4 ? 'feather' : null;
  if (wk) S.wing = piece(res, -40, -40, 6, 8, g => heroWing(g, C, wk));
  return S;
}

// matrice 2D : M × translation(x, y) × rotation(r) × échelle(sx, sy)
function mat(M, x, y, r = 0, sx = 1, sy = 1) {
  const cs = Math.cos(r), sn = Math.sin(r), a = cs * sx, b = sn * sx, c = -sn * sy, d = cs * sy;
  return [M[0] * a + M[2] * b, M[1] * a + M[3] * b, M[0] * c + M[2] * d, M[1] * c + M[3] * d, M[0] * x + M[2] * y + M[4], M[1] * x + M[3] * y + M[5]];
}
const lerp = (a, b, k) => a + (b - a) * k;
const HIP = -8.5, LEGX = [-3.1, 3.5], SHB = [-5.6, -18.4], SHF = [6.6, -18.4], NECK = [0.8, -20.6], HAND = 8.1;

// pose = { t, moving, speed01, air, vy, atk (1 = coup qui part), atkA (angle local), hurt (0..1 flash blanc),
//          ouch (grimace), dead, alpha }
function drawRig(g, P, S, C) {
  const cls = C.cls, ev = C.evo, t = P.t || 0, m = g.getTransform(), B = [m.a, m.b, m.c, m.d, m.e, m.f];
  const dead = !!P.dead, air = !dead && (P.air || 0) > 0.5, mv = !!P.moving && !air && !dead, s01 = P.speed01 ?? 1;
  const ph = t * TAU * (1.6 + 1.1 * s01), s1 = mv ? Math.sin(ph) : 0, c1 = mv ? Math.cos(ph) : 0;
  const br = Math.sin(t * 2.6), atk = dead ? 0 : P.atk || 0, ea = Math.min(1, atk * 3), th = P.atkA || 0;
  // jambes : l'une avance pendant que l'autre pousse ; le bassin descend quand elles s'écartent
  let aF = -s1 * 0.62, aB = s1 * 0.62, lF = mv ? Math.max(0, c1) * 2.2 : 0, lB = mv ? Math.max(0, -c1) * 2.2 : 0;
  let dy = mv ? 8.5 * (1 - Math.cos(aF)) - (1 - Math.abs(s1)) * 0.8 : -Math.max(0, br) * 0.25;
  if (air) { aF = -0.95; aB = 0.55; lF = 2.6; lB = 1; dy = 0; }
  const lean = mv ? 0.1 + 0.04 * s01 : air ? -0.04 : 0;
  let R = mat(B, cls === 'knight' ? ea * 1.6 : 0, dy);
  R = mat(mat(R, 0, HIP, lean), 0, -HIP);
  // bras
  let armF, armB, wRel;
  const restF = { mage: -0.74, archer: -0.5, knight: -0.62 }[cls];
  armF = mv ? restF + s1 * 0.42 : restF + br * 0.03;
  armB = mv ? 0.28 - s1 * 0.5 : 0.24 - br * 0.03;
  if (air) { armF = -2.1; armB = 2.0; }
  if (dead) { armF = 0.2; armB = 0.5; }
  let wW = { mage: 0.2, archer: 0.18, knight: 0.55 }[cls]; // angle de l'arme dans le monde (0 = vers le haut)
  let pull = 0;
  if (ea > 0) {
    if (cls === 'mage') { armF = lerp(armF, th - Math.PI / 2, ea); wW = lerp(wW, Math.max(-1.2, Math.min(1.3, (th + Math.PI / 2) * 0.55)), ea); }
    else if (cls === 'archer') { armF = lerp(armF, th - Math.PI / 2, ea); wW = lerp(wW, th, ea); pull = Math.min(1, (1 - atk) * 1.6); }
    else { const s = 1 - atk, A = th - 1.45 + 2.9 * (1 - (1 - Math.min(1, s * 2.6)) ** 2); armF = lerp(armF, A - Math.PI / 2, ea); }
  }
  wRel = wW - armF;
  if (cls === 'knight' && ea > 0) wRel = lerp(wW - armF, Math.PI, ea);
  if (cls === 'archer' && !ea) wRel = wW - armF;
  const MF = mat(R, SHF[0], SHF[1], armF), handF = [SHF[0] - Math.sin(armF) * HAND, SHF[1] + Math.cos(armF) * HAND];
  if (cls === 'archer' && ea > 0) { // la main arrière tire la corde
    const nx = handF[0] - Math.cos(th) * (1.5 + pull * 6.5), ny = handF[1] - Math.sin(th) * (1.5 + pull * 6.5);
    armB = lerp(armB, Math.atan2(ny - SHB[1], nx - SHB[0]) - Math.PI / 2, ea);
  }
  // tête : suit le buste, léger retard pendant la course
  const hv = dead ? 'ko' : P.ouch > 0 ? 'hurt' : ea > 0.35 ? 'shout' : blinkAt(t) ? 'blink' : 'idle';
  const tilt = mv ? Math.sin(ph * 2) * 0.03 + 0.04 : air ? -0.08 : Math.sin(t * 1.3) * 0.025;
  const MH = mat(R, NECK[0], NECK[1] - br * 0.3 + (mv ? c1 * c1 * 0.5 : 0), tilt + (cls === 'knight' ? ea * 0.08 : 0));
  // cape, mèches, plumet : mouvement secondaire
  const capeR = air ? (P.vy > 0 ? 0.15 : 1.05) : mv ? 0.4 + 0.3 * s01 + Math.sin(t * 11) * 0.07 : 0.06 + Math.sin(t * 1.7) * 0.04;
  const tailR = air ? (P.vy > 0 ? -0.35 : 0.5) : mv ? 0.3 + Math.sin(ph - 1) * 0.16 : Math.sin(t * 2.2) * 0.07;
  const L = [];
  const al = P.alpha ?? 1;
  // aura arrière (forme ultime)
  if (C.aura) L.push([R, g2 => auraBack(g2, C, t)]);
  if (S.wing) {
    const fl = Math.sin(t * (mv ? 7 : 2.4)) * (mv ? 0.16 : 0.1) + (air ? -0.25 : 0);
    L.push([mat(R, 2.4, -18.2, -0.15 - fl, -0.78, 0.82), S.wing], [mat(R, -2.6, -18, 0.1 + fl), S.wing]);
  }
  L.push([mat(R, -2.4, -19.6, capeR, 1 + (mv ? Math.sin(t * 11 + 1) * 0.05 : 0), mv ? 0.96 : 1), S.cape]);
  if (S.hairB) L.push([mat(MH, 0, 0, mv ? 0.12 + Math.sin(ph - 1) * 0.06 : Math.sin(t * 2) * 0.03), S.hairB]);
  if (S.quiver) L.push([mat(R, -3.6, -13.6, -0.42), S.quiver]);
  if (S.tail && cls === 'archer') L.push([mat(MH, -8.2, -12.2, tailR), S.tail]);
  const MB = mat(R, SHB[0], SHB[1], armB);
  L.push([MB, S.armB]);
  if (S.shield) L.push([mat(MB, -0.6, HAND, -armB * 0.6 - 0.1), S.shield]);
  // jambes (non penchées), le buste par-dessus
  const leg = (x, a, lift) => mat(B, x + (cls === 'knight' ? ea * 1.6 : 0) + (air ? 0 : 0), HIP + dy - lift, a);
  L.push([leg(LEGX[0], aB, lB), S.legB], [leg(LEGX[1], aF, lF), S.legF]);
  L.push([mat(R, 0, HIP, 0, 1, 1 + br * 0.018), S.torso]);
  L.push([MH, S.head[hv]]);
  if (S.tail && cls === 'knight') L.push([mat(MH, -1.2, -22.6, tailR * 0.8), S.tail]);
  if (C.aura) L.push([MH, g2 => auraEyes(g2, C, t, hv)]);
  if (ev === 3 && cls === 'mage') L.push([MH, g2 => halo(g2, t)]);
  // arme + bras avant
  const MW = mat(MF, 0, HAND, wRel);
  L.push([MW, S.weapon]);
  if (cls === 'archer') L.push([MW, g2 => bowString(g2, C, ea > 0 ? pull : 0, ea)]);
  L.push([MF, S.armF]);
  if (cls === 'mage' || (cls === 'knight' && ev >= 3) || (cls === 'archer' && ev >= 2)) L.push([MW, g2 => weaponGlow(g2, C, t, ea)]);
  if (C.aura) L.push([R, g2 => auraFront(g2, C, t)]);
  // rendu ; s'il est transparent, on passe par un calque pour ne pas voir les morceaux se superposer
  let tg = g, x0 = 0, y0 = 0, lw = 0, lh = 0;
  if (al < 0.99) {
    let X0 = 1e9, Y0 = 1e9, X1 = -1e9, Y1 = -1e9;
    for (const [x, y] of [[-42, -74], [42, -74], [-42, 12], [42, 12]]) {
      const X = B[0] * x + B[2] * y + B[4], Y = B[1] * x + B[3] * y + B[5];
      X0 = Math.min(X0, X); X1 = Math.max(X1, X); Y0 = Math.min(Y0, Y); Y1 = Math.max(Y1, Y);
    }
    x0 = Math.floor(X0); y0 = Math.floor(Y0); lw = Math.min(1600, Math.ceil(X1 - x0)); lh = Math.min(1600, Math.ceil(Y1 - y0));
    if (!LAYER || LAYER.width < lw || LAYER.height < lh) LAYER = cnv(Math.max(lw, LAYER ? LAYER.width : 0), Math.max(lh, LAYER ? LAYER.height : 0));
    tg = LAYER.getContext('2d'); tg.setTransform(1, 0, 0, 1, 0, 0); tg.clearRect(0, 0, lw, lh); tg.globalAlpha = 1;
    for (const it of L) { const M = it[0]; it[0] = [M[0], M[1], M[2], M[3], M[4] - x0, M[5] - y0]; }
  }
  const run = white => {
    for (const [M, pc] of L) {
      tg.setTransform(M[0], M[1], M[2], M[3], M[4], M[5]);
      if (typeof pc === 'function') { if (!white) pc(tg); }
      else tg.drawImage(white ? whiteOf(pc) : pc.c, pc.x, pc.y, pc.w, pc.h);
    }
  };
  run(false);
  if (P.hurt > 0) { const a0 = tg.globalAlpha; tg.globalAlpha = a0 * Math.min(1, P.hurt) * 0.85; run(true); tg.globalAlpha = a0; }
  if (tg !== g) {
    g.setTransform(1, 0, 0, 1, 0, 0); const a0 = g.globalAlpha; g.globalAlpha = a0 * al;
    g.drawImage(LAYER, 0, 0, lw, lh, x0, y0, lw, lh); g.globalAlpha = a0;
  }
  g.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
}
let LAYER = null;
function blinkAt(t) { const b = (t + 0.7) % 3.6; return b < 0.12 || (Math.floor((t + 0.7) / 3.6) % 3 === 1 && b > 0.26 && b < 0.36); }

// corde de l'arc (+ flèche encochée pendant le tir)
function bowString(g, C, pull, ea) {
  const nx = -0.9 - pull * 6.8;
  g.strokeStyle = C.evo >= 1 ? '#e8fbff' : '#f4ead8'; g.lineWidth = 0.55;
  g.beginPath(); g.moveTo(-0.8, -13.4); g.lineTo(nx, 0); g.lineTo(-0.8, 13.4); g.stroke();
  if (ea > 0.3 && pull > 0.2) {
    g.strokeStyle = '#6a3a1a'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(nx, 0); g.lineTo(7, 0); g.stroke();
    g.strokeStyle = '#e8d8b0'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(nx, 0); g.lineTo(7, 0); g.stroke();
    g.fillStyle = C.evo >= 1 ? '#bff4ff' : '#dfe8f4'; g.beginPath(); g.moveTo(9.6, 0); g.lineTo(6.6, -1.6); g.lineTo(6.6, 1.6); g.fill();
    g.fillStyle = C.a || '#ffffff'; g.beginPath(); g.moveTo(nx + 0.4, 0); g.lineTo(nx - 1.8, -1.6); g.lineTo(nx + 2, 0); g.lineTo(nx - 1.8, 1.6); g.fill();
  }
}
// lueur de la gemme du bâton / de la lame
function weaponGlow(g, C, t, ea) {
  const cls = C.cls, ev = C.evo;
  g.globalCompositeOperation = 'lighter';
  if (cls === 'mage') {
    const col = ['#ffe48a', '#ff8ae0', '#ffe48a', '#8ae8ff', '#fff0a0'][ev], r = 6 + ev * 0.8 + ea * 6 + Math.sin(t * 5) * 0.8;
    g.globalAlpha = 0.65 + ea * 0.35; g.drawImage(glowSpr(col), -r, -19.6 - r, r * 2, r * 2);
  } else if (cls === 'knight') {
    const col = ev >= 4 ? '#ffd54a' : '#ff8a2a';
    g.globalAlpha = 0.35 + Math.sin(t * 6) * 0.12 + ea * 0.3;
    for (let i = 0; i < 4; i++) { const y = -5 - i * 5, r = 5 + ea * 3; g.drawImage(glowSpr(col), -r, y - r, r * 2, r * 2); }
  } else {
    const col = ev === 3 ? '#ff8ae0' : '#9ae8ff', r = 4 + ea * 4 + Math.sin(t * 4) * 0.6;
    g.globalAlpha = 0.5 + ea * 0.4; g.drawImage(glowSpr(col), 5 - r, -r, r * 2, r * 2);
  }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
}
function halo(g, t) {
  const y = -33 + Math.sin(t * 2.2) * 0.8;
  g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.55; g.drawImage(glowSpr('#ffe48a'), -10, y - 6, 22, 12); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  g.strokeStyle = '#a8761a'; g.lineWidth = 2.2; g.beginPath(); g.ellipse(1, y, 7.6, 2.3, -0.06, 0, TAU); g.stroke();
  g.strokeStyle = '#ffe98a'; g.lineWidth = 1.3; g.stroke();
}
// aura de super guerrier : flammes derrière, étincelles et éclairs devant
function auraBack(g, C, t) {
  const col = C.aura, fl = flameSpr(col), fi = flameSpr(mix(col, '#ffffff', 0.55));
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = 0.3 + Math.sin(t * 7) * 0.06;
  g.drawImage(glowSpr(col), -26, -56, 54, 64);
  g.globalCompositeOperation = 'source-over';
  // coquille de flammes qui enveloppe le corps (deux couches qui vacillent)
  const sh = auraShell(col);
  for (let j = 0; j < 2; j++) {
    const sx = 1 + 0.05 * Math.sin(t * 13 + j * 2) + j * 0.1, sy = 1 + 0.07 * Math.sin(t * 9.4 + j * 3) + j * 0.08;
    g.globalAlpha = j ? 0.35 : 0.8;
    g.drawImage(sh, 1 - 30 * sx, 4 - 86 * sy + (j ? -2 - Math.sin(t * 7) * 2 : 0), 60 * sx, 86 * sy);
  }
  // langues de flammes qui montent et vacillent
  for (let j = 0; j < 2; j++) for (let i = 0; i < 13; i++) {
    const k = i / 12, a = Math.PI * k, x = 1 - Math.cos(a) * (j ? 11 : 15), y = -4 - Math.sin(a) * (j ? 26 : 30);
    const h = (j ? 13 : 19) + (1 - Math.abs(k - 0.5)) * 10 + 6 * Math.sin(t * 9 + i * 1.9) + 4 * Math.sin(t * 15.3 + i * 4.1);
    const w = (j ? 7 : 10) + 2 * Math.sin(t * 7 + i), lean = (x - 1) / 15 * 0.5 + Math.sin(t * 6 + i * 2.3) * 0.1;
    g.save(); g.translate(x, y + h * 0.35); g.rotate(lean); g.globalAlpha = (j ? 0.75 : 0.6) + 0.2 * Math.sin(t * 11 + i * 3);
    g.drawImage(j ? fi : fl, -w / 2, -h, w, h * 1.05); g.restore();
  }
  g.globalAlpha = 1;
}
function auraFront(g, C, t) {
  const col = C.aura, lt = mix(col, '#ffffff', 0.45);
  g.globalCompositeOperation = 'lighter';
  // étincelles qui montent
  for (let i = 0; i < 14; i++) {
    const ph = (t * (0.7 + (i % 3) * 0.2) + i * 0.618) % 1, x = 1 + Math.sin(i * 12.99) * 15 + Math.sin(t * 3 + i) * 1.6, y = -2 - ph * 52;
    const r = 2.2 * (1 - ph) + 0.7; g.globalAlpha = Math.min(1, (1 - ph) * 1.6);
    g.drawImage(glowSpr(lt), x - r, y - r, r * 2, r * 2);
  }
  g.globalCompositeOperation = 'source-over';
  // éclairs qui crépitent sur les côtés
  const r = rng(Math.floor(t * 12) * 7 + 3);
  if (r() < 0.8) for (let k = 0; k < 2; k++) {
    const sd = k ? 1 : -1; let x = 1 + sd * (12 + r() * 4), y = -40 + r() * 30;
    g.beginPath(); g.moveTo(x, y);
    for (let i = 0; i < 4; i++) { x += sd * (1 + r() * 2.6); y += (r() - 0.55) * 8; g.lineTo(x, y); }
    g.globalAlpha = 0.95; g.strokeStyle = col; g.lineWidth = 1.7; g.stroke();
    g.strokeStyle = '#ffffff'; g.lineWidth = 0.7; g.stroke();
  }
  g.globalAlpha = 1;
}
function auraEyes(g, C, t, hv) {
  g.globalCompositeOperation = 'lighter';
  const a = 0.6 + Math.sin(t * 8) * 0.15;
  g.globalAlpha = a * 0.35; g.drawImage(glowSpr(C.h), -12, -42, 26, 20); // cheveux qui brillent
  if (hv !== 'blink' && hv !== 'ko') {
    g.globalAlpha = a; const F = C.cls === 'mage' ? MAGE_F : C.cls === 'archer' ? ARCHER_F : KNIGHT_F, ec = C.aura === '#7ae8ff' ? '#7ae8ff' : '#5affd8';
    for (const [x, y] of [F.near, F.far]) g.drawImage(glowSpr(ec), x + 1 - 3, y - 10.5 - 3, 6, 6);
  }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
}

// marionnette d'un héros ; les morceaux sont repeints si la résolution change beaucoup
export function heroRig(clsId, evo = 0) {
  const C = heroPal(clsId, Math.max(0, Math.min(4, evo)));
  let S = null;
  const sheet = K => {
    if (!S || K > S.res * 1.04 || K < S.res * 0.55) S = heroSheet(C, Math.min(8, Math.max(1, Math.ceil(K * 4) / 4)));
    return S;
  };
  return {
    cls: clsId, evo: C.evo, colors: C,
    prepare(K) { sheet(K); },
    draw(g, pose) { const m = g.getTransform(); drawRig(g, pose, sheet(Math.max(Math.hypot(m.a, m.b), Math.hypot(m.c, m.d))), C); },
  };
}

// images fixes du héros (compatibilité) : cuites seulement au premier usage
function lazySpr(make) {
  let s = null; const o = {};
  for (const k of ['c', 'w', 'h', 'ax', 'ay', 'white', 'ice', 'red', 'rage']) Object.defineProperty(o, k, { enumerable: true, get: () => (s || (s = make()))[k] });
  return o;
}
const HERO_BOX = [76, 74, 38, 66];
export function heroSprites(clsId, evo, res) {
  const rig = heroRig(clsId, evo);
  return [0, 1].map(f => lazySpr(() => bake(...HERO_BOX, res, g => rig.draw(g, { t: f ? 0.16 : 0.9, moving: !!f, speed01: 1 }), { variants: true, outline: 0 })));
}

// ---------- Monstres ----------
// Toutes les créatures sont dessinées pour un rayon de 16 (sprite d'environ 40 unités), puis mises à l'échelle.
function mPal(def) { const [m, d, l] = def.pal; return { m, d, l }; }

function horns(g, x, y, s, col) {
  for (const sd of [-1, 1]) {
    const p = P();
    p.moveTo(x + sd * s * 0.35, y); p.quadraticCurveTo(x + sd * s * 1.2, y - s * 0.3, x + sd * s * 1.05, y - s * 1.3);
    p.quadraticCurveTo(x + sd * s * 0.8, y - s * 0.55, x + sd * s * 0.05, y - s * 0.2); p.closePath();
    fillShaded(g, p, col, { off: 0.8, line: 1 });
  }
}

function drawBlob(g, C, f, o, r) {
  const sq = f ? 1.06 : 1;
  const body = P();
  body.moveTo(-18 * sq, -1); body.bezierCurveTo(-20 * sq, -22 / sq, -10, -31 / sq, 0, -31 / sq);
  body.bezierCurveTo(10, -31 / sq, 20 * sq, -22 / sq, 18 * sq, -1); body.quadraticCurveTo(0, 2, -18 * sq, -1); body.closePath();
  fillShaded(g, body, C.m, { dark: C.d, light: C.l, off: 3, hl: { x: -7, y: -22, rx: 5, ry: 3.4, rot: -0.5, a: 0.9 } });
  g.fillStyle = 'rgba(255,255,255,.9)'; g.fill(ell(-11, -16, 1.6, 1.6));
  if (r() < 0.5) { g.fillStyle = C.l; g.globalAlpha = 0.6; for (let i = 0; i < 3; i++) g.fill(ell(-10 + r() * 16, -6 - r() * 10, 1.6 + r() * 1.6, 1.4 + r() * 1.2)); g.globalAlpha = 1; }
  if (o.ranged) {
    eye(g, 4, -16, 8, 8.4, { iris: C.l, look: 0.4, angry: 1 });
  } else {
    eye(g, 1.5, -16, 3.4, 4.4, { look: 0.5, angry: o.pet ? 0 : 1.2 });
    eye(g, 10.5, -16, 3, 4.2, { look: 0.5, angry: o.pet ? 0 : 1.2 });
    g.fillStyle = OUT; g.beginPath(); g.ellipse(7, -8.4, 3.4, 2.2, 0, 0, Math.PI); g.fill();
    g.fillStyle = '#ff6a8a'; g.fill(ell(7.4, -7.6, 1.6, 0.9));
  }
  if (r() < 0.35) horns(g, 4, -27, 4.5, C.d);
  return { top: -32, hx: 3 };
}

function drawHumanoid(g, C, f, o, r, def) {
  const skull = /quelette/.test(def.name);
  const a = f ? 1.6 : -1.6;
  fillShaded(g, ell(-4.5, -2 + Math.min(0, a), 4.4, 3), C.d, { off: 1 });
  fillShaded(g, ell(4.5, -2 + Math.min(0, -a), 4.4, 3), C.d, { off: 1 });
  // arme
  if (o.ranged) {
    g.strokeStyle = OUT; g.lineWidth = 3.8; g.beginPath(); g.moveTo(12, -3); g.lineTo(14, -32); g.stroke();
    g.strokeStyle = '#8a5a2a'; g.lineWidth = 2; g.beginPath(); g.moveTo(12, -3); g.lineTo(14, -32); g.stroke();
    glowDot(g, 14, -34, 3.6, C.l);
  } else {
    g.save(); g.translate(13, -12); g.rotate(-0.5);
    const bl = poly([[-1.8, -2], [-1.8, -17], [0, -20], [1.8, -17], [1.8, -2]]);
    fillShaded(g, bl, '#e8eef8', { dark: '#9aa4b8', off: 0.6, line: 0.9 });
    fillShaded(g, rrect(-4.5, -2.6, 9, 2.4, 1), '#7a5a3a', { off: 0.3, line: 0.8 });
    g.restore();
  }
  // corps
  fillShaded(g, rrect(-9, -21, 18, 17, 6), C.m, { dark: C.d, light: C.l, off: 2, hl: { x: -4, y: -17, rx: 2.6, ry: 3.4, a: 0.6 } });
  fillShaded(g, rrect(-9, -10, 18, 2.6, 1), C.d, { off: 0.3, line: 0.8 });
  if (!o.ranged && r() < 0.5) {
    const sh = ell(-1, -13, 5.6, 6.6);
    fillShaded(g, sh, C.d, { light: C.l, off: 1, hl: { x: -2.5, y: -16, rx: 1.6, ry: 2, a: 0.6 } });
    g.lineWidth = 1.2; g.strokeStyle = C.l; g.stroke(ell(-1, -13, 4, 5));
  }
  fillShaded(g, ell(12, -13, 2.6, 2.6), C.d, { off: 0.5, line: 0.9 });
  // tête
  if (skull) {
    fillShaded(g, ell(1, -29, 10.5, 10), '#f4efe0', { dark: '#c8c0a8', off: 1.4, hl: { x: -3, y: -34, rx: 3, ry: 2, a: 0.8 } });
    g.fillStyle = OUT; g.fill(ell(2.6, -29, 2.8, 3.2)); g.fill(ell(8.8, -29, 2.4, 3)); g.fill(poly([[5.6, -25.5], [7, -23.5], [4.4, -23.5]]));
    g.fillStyle = C.l; g.fill(ell(3, -28.6, 1, 1)); g.fill(ell(9, -28.6, 0.9, 0.9));
    g.strokeStyle = OUT; g.lineWidth = 0.9; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(1 + i * 2.4, -21.5); g.lineTo(1 + i * 2.4, -19.6); g.stroke(); }
  } else {
    const hm = P(); hm.moveTo(-10.5, -23); hm.quadraticCurveTo(-11.5, -40, 0.5, -39.5); hm.quadraticCurveTo(12, -40, 11, -23); hm.quadraticCurveTo(0, -19.5, -10.5, -23); hm.closePath();
    fillShaded(g, hm, C.m, { dark: C.d, light: C.l, off: 1.6, hl: { x: -4, y: -34, rx: 3, ry: 2.4, a: 0.8 } });
    fillShaded(g, rrect(-1.5, -31, 13, 5, 2.2), '#1e1636', { off: 0, line: 0.9 });
    g.fillStyle = C.l; g.fill(ell(3.6, -28.6, 1.6, 1.3)); g.fill(ell(8.6, -28.6, 1.4, 1.3));
    g.fillStyle = '#ffffff'; g.fill(ell(3.4, -29, 0.6, 0.5)); g.fill(ell(8.4, -29, 0.5, 0.5));
    if (r() < 0.5) { const cr = poly([[-3, -39], [-1, -45], [2, -39]]); fillShaded(g, cr, C.l, { off: 0.5, line: 0.9 }); }
    else if (r() < 0.5) horns(g, 0, -36, 4.6, '#f4efe0');
  }
  return { top: -40, hx: 1 };
}

function drawGolem(g, C, f, o, r) {
  const a = f ? 1.2 : -1.2;
  fillShaded(g, rrect(-12, -6 + Math.min(0, a), 9, 6, 2.4), C.d, { off: 0.8 });
  fillShaded(g, rrect(3, -6 + Math.min(0, -a), 9, 6, 2.4), C.d, { off: 0.8 });
  const j = () => (r() - 0.5) * 3;
  const body = poly([[-17, -5], [-20 + j(), -17], [-14, -30 + j()], [-2 + j(), -35], [12, -32 + j()], [19 + j(), -19], [17, -5], [0, -2]]);
  fillShaded(g, body, C.m, { dark: C.d, light: C.l, off: 3.4, hl: { x: -8, y: -27, rx: 5, ry: 3, rot: -0.4, a: 0.55 } });
  // fissures
  g.strokeStyle = C.d; g.lineWidth = 1.3;
  for (let i = 0; i < 3; i++) { const x = -10 + r() * 20, y = -26 + r() * 16; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 8, y + 3 + r() * 4); g.lineTo(x + (r() - 0.5) * 8, y + 6 + r() * 4); g.stroke(); }
  if (r() < 0.5) { g.fillStyle = '#6fae3a'; g.globalAlpha = 0.85; g.fill(ell(-6, -32, 6, 2.4, -0.2)); g.fill(ell(6, -33, 3.5, 1.8, 0.2)); g.globalAlpha = 1; }
  // yeux lumineux
  glowDot(g, 2, -21, 2.6, C.l); glowDot(g, 10, -21, 2.3, C.l);
  g.strokeStyle = OUT; g.lineWidth = 1.8; g.beginPath(); g.moveTo(-1.5, -26); g.lineTo(5, -24.5); g.moveTo(7.5, -24.5); g.lineTo(13, -26); g.stroke();
  // bras
  fillShaded(g, ell(-20, -14, 6.5, 7), C.m, { dark: C.d, light: C.l, off: 1.4, hl: { x: -22, y: -17, rx: 2, ry: 1.6, a: 0.6 } });
  if (o.ranged) {
    g.save(); g.translate(14, -28); g.rotate(-0.55);
    fillShaded(g, rrect(-4, -4.5, 17, 9, 3), '#4a4a5a', { dark: '#2a2a38', light: '#8a8aa0', off: 1, hl: { x: 2, y: -2.5, rx: 5, ry: 1, a: 0.7 } });
    fillShaded(g, ell(13, 0, 3, 4.6), '#2a2a38', { off: 0.4, line: 1 });
    g.fillStyle = OUT; g.fill(ell(13.6, 0, 1.6, 2.8));
    g.restore();
  } else fillShaded(g, ell(20, -14, 6.5, 7), C.m, { dark: C.d, light: C.l, off: 1.4, hl: { x: 18, y: -17, rx: 2, ry: 1.6, a: 0.6 } });
  return { top: -35, hx: 2 };
}

function drawBeast(g, C, f, o, r) {
  const a = f ? 2 : -2;
  // queue
  g.strokeStyle = OUT; g.lineWidth = 6.4; g.beginPath(); g.moveTo(-14, -16); g.quadraticCurveTo(-24, -18, -24, -28); g.stroke();
  g.strokeStyle = C.m; g.lineWidth = 4; g.beginPath(); g.moveTo(-14, -16); g.quadraticCurveTo(-24, -18, -24, -28); g.stroke();
  // pattes
  for (const [x, ph] of [[-11, a], [-4, -a], [5, -a], [11, a]]) fillShaded(g, rrect(x - 2.6, -10 + Math.min(0, ph), 5.2, 10, 2.4), C.d, { off: 0.6, line: 0.9 });
  // corps
  const body = ell(-1, -15, 15.5, 9.5);
  fillShaded(g, body, C.m, { dark: C.d, light: C.l, off: 2.4, hl: { x: -5, y: -21, rx: 7, ry: 2, a: 0.6 } });
  g.fillStyle = C.l; g.globalAlpha = 0.55; g.fill(ell(1, -9.5, 10, 3.2)); g.globalAlpha = 1;
  if (r() < 0.6) for (let i = 0; i < 3; i++) { const sp = poly([[-10 + i * 6, -23], [-7 + i * 6, -30], [-4 + i * 6, -23.5]]); fillShaded(g, sp, C.d, { off: 0.5, line: 0.9 }); }
  // tête
  for (const ex of [9, 16]) { const ear = poly([[ex - 3, -26], [ex, -35], [ex + 3, -26]]); fillShaded(g, ear, C.d, { off: 0.8, line: 1 }); }
  fillShaded(g, ell(13, -22, 9, 8.4), C.m, { dark: C.d, light: C.l, off: 1.6, hl: { x: 10, y: -26.5, rx: 3, ry: 1.6, a: 0.6 } });
  fillShaded(g, ell(21, -19, 6, 4.4), C.l, { off: 0.8, line: 1 });
  g.fillStyle = OUT; g.fill(ell(25.6, -20.4, 1.8, 1.5));
  g.fillStyle = '#ffffff'; g.fill(poly([[19, -15.6], [20, -13], [21, -15.6]])); g.fill(poly([[22.4, -15.8], [23.2, -13.4], [24, -15.8]]));
  eye(g, 14.5, -24, 2.6, 2.8, { look: 0.5, angry: 1.4, iris: o.boss ? '#ff3a3a' : null });
  return { top: -33, hx: 13 };
}

function drawBird(g, C, f, o, r) {
  // queue
  for (let i = -1; i <= 1; i++) { const t = poly([[-10, -18], [-22, -22 + i * 5], [-20, -17 + i * 5]]); fillShaded(g, t, C.d, { off: 0.6, line: 0.9 }); }
  const body = ell(0, -19, 12.5, 11.5);
  fillShaded(g, body, C.m, { dark: C.d, light: C.l, off: 2.4, hl: { x: -4, y: -25, rx: 4, ry: 2.6, rot: -0.4, a: 0.7 } });
  g.fillStyle = C.l; g.globalAlpha = 0.7; g.fill(ell(3, -13, 7, 5)); g.globalAlpha = 1;
  // aile
  const w = P();
  if (f) { w.moveTo(-4, -20); w.quadraticCurveTo(-14, -40, -2, -40); w.quadraticCurveTo(4, -32, 2, -20); }
  else { w.moveTo(-4, -18); w.quadraticCurveTo(-18, -8, -8, -4); w.quadraticCurveTo(0, -8, 2, -18); }
  w.closePath();
  fillShaded(g, w, C.d, { dark: shade(C.d, -0.25), light: C.m, off: 1, hl: { x: -4, y: f ? -34 : -9, rx: 3, ry: 2, a: 0.5 } });
  // bec + crête
  const bk = poly([[10, -23], [20, -19.5], [10, -16]]);
  fillShaded(g, bk, '#ffb43a', { off: 0.6, line: 1 });
  for (let i = 0; i < 3; i++) { const c = poly([[-2 + i * 3, -29], [-4 + i * 3, -36 + i], [1 + i * 3, -30]]); fillShaded(g, c, C.l, { off: 0.4, line: 0.8 }); }
  eye(g, 6, -23, 3, 3.4, { look: 0.5, angry: o.pet ? 0 : 1.2 });
  return { top: -34, hx: 2 };
}

function drawCrab(g, C, f, o, r, def) {
  const spider = /raign/.test(def.name);
  const a = f ? 1.6 : -1.6;
  g.strokeStyle = OUT; g.lineWidth = 3.6;
  const legs = spider ? 4 : 3;
  for (const sd of [-1, 1]) for (let i = 0; i < legs; i++) {
    const x0 = sd * (5 + i * 3), ph = (i % 2 ? a : -a) * sd;
    g.strokeStyle = OUT; g.lineWidth = 3.6; g.beginPath(); g.moveTo(x0, -10); g.quadraticCurveTo(x0 + sd * (spider ? 12 : 8), -18 + ph, x0 + sd * (spider ? 15 : 10), -1 + ph * 0.5); g.stroke();
    g.strokeStyle = C.d; g.lineWidth = 1.8; g.beginPath(); g.moveTo(x0, -10); g.quadraticCurveTo(x0 + sd * (spider ? 12 : 8), -18 + ph, x0 + sd * (spider ? 15 : 10), -1 + ph * 0.5); g.stroke();
  }
  if (!spider) {
    for (const sd of [-1, 1]) {
      g.strokeStyle = OUT; g.lineWidth = 4; g.beginPath(); g.moveTo(sd * 12, -14); g.lineTo(sd * 18, -22); g.stroke();
      g.strokeStyle = C.m; g.lineWidth = 2.2; g.beginPath(); g.moveTo(sd * 12, -14); g.lineTo(sd * 18, -22); g.stroke();
      const cl = P(); cl.moveTo(sd * 18, -21); cl.arc(sd * 20, -27, 6.5, sd > 0 ? 1.9 : 1.25, sd > 0 ? 1.9 + 5.2 : 1.25 - 5.2, sd < 0); cl.lineTo(sd * 20, -27); cl.closePath();
      fillShaded(g, cl, C.m, { dark: C.d, light: C.l, off: 1, hl: { x: sd * 18.5, y: -30, rx: 2, ry: 1.4, a: 0.7 } });
    }
  }
  const sh = P(); sh.moveTo(-17, -9); sh.bezierCurveTo(-17, -27, 17, -27, 17, -9); sh.quadraticCurveTo(0, -4, -17, -9); sh.closePath();
  fillShaded(g, sh, C.m, { dark: C.d, light: C.l, off: 2.6, hl: { x: -6, y: -20, rx: 5, ry: 2.4, rot: -0.2, a: 0.75 } });
  g.fillStyle = C.l; g.globalAlpha = 0.5; for (let i = 0; i < 3; i++) g.fill(ell(-8 + i * 7, -15 + (i % 2) * 2, 1.6, 1.3)); g.globalAlpha = 1;
  if (spider) {
    for (let i = 0; i < 4; i++) glowDot(g, -3 + i * 3, -19 - (i % 2) * 1.6, 1.4, C.l);
    if (/carab/.test(def.name)) horns(g, 0, -22, 4, C.d);
  } else {
    for (const ex of [-4, 4]) {
      g.strokeStyle = OUT; g.lineWidth = 2.6; g.beginPath(); g.moveTo(ex, -20); g.lineTo(ex, -27); g.stroke();
      eye(g, ex, -29, 2.6, 3, { look: 0.3, angry: o.pet ? 0 : 0.8 });
    }
    g.strokeStyle = OUT; g.lineWidth = 1.1; g.beginPath(); g.arc(0, -13, 3, 0.2, Math.PI - 0.2); g.stroke();
  }
  return { top: -32, hx: 0 };
}

function drawGhost(g, C, f, o, r) {
  const body = P();
  body.moveTo(-13, -6); body.lineTo(-13, -24); body.arc(0, -24, 13, Math.PI, 0); body.lineTo(13, -6);
  const n = 4, ph = f ? 0.5 : 0;
  for (let i = n; i > 0; i--) {
    const x1 = -13 + (i - 0.5) / n * 26, x0 = -13 + (i - 1) / n * 26;
    body.quadraticCurveTo(x1, (i + ph) % 2 < 1 ? 1 : -9, x0, -5);
  }
  body.closePath();
  g.globalAlpha = 0.92;
  fillShaded(g, body, C.m, { dark: C.d, light: C.l, off: 2.4, hl: { x: -5, y: -31, rx: 4, ry: 3, rot: -0.5, a: 0.9 } });
  g.globalAlpha = 1;
  g.fillStyle = '#140a28'; g.fill(ell(1, -24, 3.4, 4.8)); g.fill(ell(9, -24, 3, 4.4));
  g.fillStyle = C.l; g.fill(ell(2, -23.4, 1.4, 1.6)); g.fill(ell(9.6, -23.4, 1.3, 1.5));
  g.fillStyle = '#140a28'; g.fill(ell(5.4, -15.5, 2.4, 3));
  // petits bras
  for (const sd of [-1, 1]) { const ar = ell(sd * 14, -15, 3.4, 2.4, sd * 0.6); fillShaded(g, ar, C.m, { dark: C.d, off: 0.5, line: 0.9 }); }
  if (o.ranged) glowDot(g, 17, -20, 3.4, C.l);
  return { top: -37, hx: 4 };
}

function drawWorm(g, C, f, o, r) {
  const u = f ? 1.5 : -1.5;
  const segs = [[-17, -8 + u, 6.5], [-9, -11 - u, 8.4], [1, -14 + u, 10]];
  for (const [x, y, rr] of segs) {
    fillShaded(g, ell(x, y, rr, rr * 0.92), C.m, { dark: C.d, light: C.l, off: 1.6, hl: { x: x - rr * 0.3, y: y - rr * 0.5, rx: rr * 0.4, ry: rr * 0.22, a: 0.6 } });
    g.strokeStyle = C.d; g.lineWidth = 1.4; g.beginPath(); g.arc(x, y, rr * 0.7, -2.2, -0.9); g.stroke();
  }
  // tête : grande gueule pleine de dents
  fillShaded(g, ell(11, -20, 11.5, 11), C.m, { dark: C.d, light: C.l, off: 2, hl: { x: 6, y: -27, rx: 4, ry: 2.4, rot: -0.4, a: 0.7 } });
  const mouth = P(); mouth.moveTo(13, -21); mouth.quadraticCurveTo(24, -28, 24, -18); mouth.quadraticCurveTo(24, -10, 13, -16); mouth.closePath();
  g.fillStyle = '#4a0a24'; g.fill(mouth); g.lineWidth = 1; g.strokeStyle = OUT; g.stroke(mouth);
  g.fillStyle = '#ffffff';
  for (let i = 0; i < 3; i++) { g.fill(poly([[15 + i * 3, -22.5 + i * 0.4], [16.5 + i * 3, -19.5], [18 + i * 3, -22.8 + i * 0.4]])); g.fill(poly([[15 + i * 3, -15.4], [16.5 + i * 3, -18], [18 + i * 3, -15]])); }
  glowDot(g, 8, -26, 2.2, C.l); glowDot(g, 13, -27.5, 1.8, C.l);
  for (let i = 0; i < 3; i++) { const sp = poly([[-12 + i * 9, -15 - i * 2], [-9 + i * 9, -24 - i * 2.6], [-6 + i * 9, -16 - i * 2]]); fillShaded(g, sp, C.l, { off: 0.4, line: 0.9 }); }
  return { top: -32, hx: 10 };
}

const BODY_DRAW = { blob: drawBlob, humanoid: drawHumanoid, golem: drawGolem, beast: drawBeast, bird: drawBird, crab: drawCrab, ghost: drawGhost, worm: drawWorm };

function drawMonster(g, def, f, o) {
  const C = mPal(def), r = rng('m2d:' + def.name);
  const top = (BODY_DRAW[def.body] || drawBlob)(g, C, f, o, r, def);
  if (o.boss) { horns(g, top.hx, top.top + 6, 7, '#f4efe0'); crown(g, top.hx, top.top + 1, 13); }
  else if (o.elite) crown(g, top.hx, top.top + 2, 9);
  return top;
}

// sprites d'un monstre : 2 images (pas), chacune avec ses variantes blanche / gelée / rouge.
// k = taille relative (rayon / 16)
export function monsterSprites(def, o, k, res) {
  const s = 2.2 * k;
  const glow = o.boss ? { c: def.pal[2], r: 4, a: 0.5 } : null;
  return [0, 1].map(f => bake(64 * k, 60 * k, 32 * k, 50 * k, res, g => { g.scale(k, k); drawMonster(g, def, f, o); }, { variants: true, outline: Math.min(4, 2 + s * 0.08), glow }));
}

export function petSprites(petId, res) {
  const p = PETS[petId];
  const def = { name: 'pet-' + petId, body: p.body, pal: p.pal };
  return [0, 1].map(f => bake(64 * 0.55, 60 * 0.55, 32 * 0.55, 50 * 0.55, res, g => { g.scale(0.55, 0.55); drawMonster(g, def, f, { pet: true }); }, { outline: 1.6 }));
}

// ---------- Images pour les menus ----------
const urlCache = new Map();
function toURL(key, make) {
  if (!urlCache.has(key)) { const spr = make(); urlCache.set(key, spr.c.toDataURL()); }
  return urlCache.get(key);
}
// même signature que l'ancien générateur de créatures pixelisées
export function creatureURL(seed, body, pal, opts = {}) {
  const name = String(seed).replace(/^\d+-\d+-/, '');
  return toURL('c:' + seed + (opts.boss ? ':b' : ''), () => {
    const def = { name, body, pal };
    return bake(64, 60, 32, 50, 2, g => drawMonster(g, def, 0, { boss: !!opts.boss, pet: /^pet-/.test(seed) }), { outline: 2.2 });
  });
}
export function heroURL(clsId, _colors, evo = 0) {
  return toURL('h:' + clsId + ':' + evo, () => {
    const rig = heroRig(clsId, evo);
    return bake(...(evo >= 3 ? HERO_BOX : [50, 70, 22, 64]), 2.5, g => rig.draw(g, { t: 0.9, moving: false }), { outline: 0.9, oc: '#140a22' });
  });
}

export { hash, P, ell, rrect, poly, fillShaded, glowDot, eye, crown, cnv };
