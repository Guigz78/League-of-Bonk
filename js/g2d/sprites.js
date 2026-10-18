// Sprites 2D façon cartoon : dessinés en vectoriel une seule fois (contour épais, ombrage en aplats),
// puis réutilisés à chaque image. Repère de dessin : unités du monde, origine aux pieds, regard vers la droite.
import { CLASSES, EVOLUTIONS, PETS } from '../data.js';
import { rng, hash, shade } from '../pixel.js';

const TAU = Math.PI * 2;
export const OUT = '#1a1030';

function cnv(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
  return c;
}

// Cuisson d'un sprite : dessin + contour épais autour de la silhouette (+ variantes blanche et gelée).
// W×H : boîte en unités du monde, (ax, ay) : point d'ancrage (les pieds) dans la boîte.
export function bake(W, H, ax, ay, res, draw, { outline = 2.2, variants = false, glow = null } = {}) {
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
  const ring = cnv(cw, ch), o = ring.getContext('2d');
  if (outline > 0) {
    const dark = sil(OUT), r = outline * res;
    for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; o.drawImage(dark, Math.cos(a) * r, Math.sin(a) * r); }
    o.drawImage(dark, 0, 0);
  }
  const compose = top => {
    const c = cnv(cw, ch), q = c.getContext('2d');
    if (glow) { // halo flou (ombre portée décalée hors du canevas : marche aussi sur Safari)
      const sg = sil(glow.c);
      q.save(); q.shadowColor = glow.c; q.shadowBlur = glow.r * res * 1.6; q.shadowOffsetX = cw * 3; q.globalAlpha = glow.a ?? 0.7;
      q.drawImage(sg, -cw * 3, 0); q.drawImage(sg, -cw * 3, 0); q.restore();
    }
    q.drawImage(ring, 0, 0); q.drawImage(top, 0, 0);
    return c;
  };
  const spr = { c: compose(art), w: cw / res, h: ch / res, ax: ax + pad, ay: ay + pad };
  if (variants) {
    const wh = cnv(cw, ch), w2 = wh.getContext('2d');
    w2.drawImage(art, 0, 0); w2.globalCompositeOperation = 'source-atop';
    w2.fillStyle = 'rgba(255,255,255,.78)'; w2.fillRect(0, 0, cw, ch);
    spr.white = compose(wh);
    const ice = cnv(cw, ch), q = ice.getContext('2d');
    q.drawImage(art, 0, 0); q.globalCompositeOperation = 'source-atop';
    q.fillStyle = 'rgba(150,220,255,.62)'; q.fillRect(0, 0, cw, ch);
    spr.ice = compose(ice);
    spr.red = compose(sil('#ff3a4a'));
    // variante « enragée » (monstres devenus fous après le chrono) : contour rouge et teinte chaude
    const rg = cnv(cw, ch), rq = rg.getContext('2d'), redSil = sil('#ff2a3a'), rr = (outline + 0.8) * res;
    for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; rq.drawImage(redSil, Math.cos(a) * rr, Math.sin(a) * rr); }
    rq.drawImage(ring, 0, 0);
    const warm = cnv(cw, ch), wq = warm.getContext('2d');
    wq.drawImage(art, 0, 0); wq.globalCompositeOperation = 'source-atop'; wq.fillStyle = 'rgba(255,60,40,.22)'; wq.fillRect(0, 0, cw, ch);
    rq.drawImage(warm, 0, 0);
    spr.rage = rg;
  }
  return spr;
}

// ---------- Aides de dessin ----------
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

function horns(g, x, y, s, col) {
  for (const sd of [-1, 1]) {
    const p = P();
    p.moveTo(x + sd * s * 0.35, y); p.quadraticCurveTo(x + sd * s * 1.2, y - s * 0.3, x + sd * s * 1.05, y - s * 1.3);
    p.quadraticCurveTo(x + sd * s * 0.8, y - s * 0.55, x + sd * s * 0.05, y - s * 0.2); p.closePath();
    fillShaded(g, p, col, { off: 0.8, line: 1 });
  }
}

// ---------- Héros ----------
const SKIN = '#ffd9b8';

export function heroColors(clsId, evo = 0) {
  const base = CLASSES[clsId].colors, ev = EVOLUTIONS[clsId][evo] || {};
  return { s: SKIN, ...base, ...(ev.colors || {}) };
}

function heroFeet(g, f, col) {
  const a = f ? 1.6 : -1.6;
  fillShaded(g, ell(-4.5, -2 + Math.min(0, a), 4.2, 3), col, { off: 1 });
  fillShaded(g, ell(4.5, -2 + Math.min(0, -a), 4.2, 3), col, { off: 1 });
}

function heroHead(g, C, { hair = true } = {}) {
  fillShaded(g, ell(0, -29, 11.5, 11), C.s, { dark: shade(C.s, -0.12), off: 1.4, line: 1 });
  g.fillStyle = '#ff8aa0'; g.globalAlpha = 0.5;
  g.fill(ell(1.5, -24.5, 2.4, 1.4)); g.fill(ell(9.6, -24.8, 1.6, 1.3)); g.globalAlpha = 1;
  eye(g, 3.2, -28.5, 2.6, 3.4, { look: 0.45 });
  eye(g, 8.8, -28.4, 2.1, 3.2, { look: 0.45 });
  g.strokeStyle = OUT; g.lineWidth = 1; g.beginPath(); g.arc(6.5, -23.4, 1.5, 0.15, Math.PI - 0.15); g.stroke();
}

function drawMage(g, C, evo, f) {
  // cheveux longs derrière
  fillShaded(g, poly([[-11, -33], [-13, -14], [-6, -12], [-3, -20], [6, -34]]), C.h, { off: 1.2 });
  if (evo >= 1) fillShaded(g, poly([[-8, -20], [-16, -2], [-4, -4]]), C.c, { off: 1 });
  // bâton
  g.strokeStyle = OUT; g.lineWidth = 4.2; g.beginPath(); g.moveTo(13, -2); g.lineTo(15, -38); g.stroke();
  g.strokeStyle = '#a8743a'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(13, -2); g.lineTo(15, -38); g.stroke();
  heroFeet(g, f, C[2]);
  // robe
  const robe = P(); robe.moveTo(-6.5, -20); robe.lineTo(6.5, -20); robe.quadraticCurveTo(10, -10, 10.5, -4); robe.quadraticCurveTo(0, -1.5, -10.5, -4); robe.quadraticCurveTo(-10, -10, -6.5, -20); robe.closePath();
  fillShaded(g, robe, C[1], { off: 2, hl: { x: -4, y: -16, rx: 3, ry: 5, a: 0.5 }, light: C[3] });
  g.strokeStyle = C.a; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-9.6, -5.4); g.quadraticCurveTo(0, -3, 9.6, -5.4); g.stroke();
  fillShaded(g, rrect(-6.8, -15, 13.6, 2.6, 1.2), C.c, { off: 0.5, line: 0.8 });
  // bras + main sur le bâton
  fillShaded(g, rrect(7, -18, 5, 7, 2.4), C[1], { off: 0.8, line: 0.9 });
  fillShaded(g, ell(13.6, -13, 2.4, 2.4), C.s, { off: 0.5, line: 0.9 });
  heroHead(g, C);
  // frange + tiare
  const fr = P(); fr.moveTo(-11.6, -29); fr.quadraticCurveTo(-11, -42, 1, -41); fr.quadraticCurveTo(12, -41, 11.8, -31); fr.quadraticCurveTo(7, -36, 4, -33.5); fr.quadraticCurveTo(1, -36, -3, -33); fr.quadraticCurveTo(-7, -35, -11.6, -29); fr.closePath();
  fillShaded(g, fr, C.h, { off: 1.2, hl: { x: -3, y: -39, rx: 5, ry: 1.6, rot: -0.2 } });
  g.fillStyle = C.a; g.fill(poly([[2, -40.5], [4, -44.5], [6, -40.5]])); g.lineWidth = 0.8; g.strokeStyle = OUT; g.stroke(poly([[2, -40.5], [4, -44.5], [6, -40.5]]));
  // gemme étoile du bâton
  starGem(g, 15, -40, 5.4, C.a);
  if (evo >= 2) halo(g, 0, -45, C.a);
}

function starGem(g, x, y, r, col) {
  const pts = [];
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i / 10 * TAU, rr = i % 2 ? r * 0.45 : r; pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); }
  fillShaded(g, poly(pts), col, { off: 0.8, line: 1, light: '#ffffff', hl: { x: x - 1, y: y - 1.5, rx: 1.4, ry: 1.4 } });
}

function halo(g, x, y, col) {
  g.strokeStyle = OUT; g.lineWidth = 3.6; g.stroke(ell(x, y, 8, 2.6));
  g.strokeStyle = col; g.lineWidth = 2; g.stroke(ell(x, y, 8, 2.6));
}

function drawArcher(g, C, evo, f) {
  // carquois dans le dos
  g.save(); g.translate(-8, -18); g.rotate(-0.5);
  fillShaded(g, rrect(-2.5, -9, 5, 15, 2), '#8a5a2a', { off: 0.8, line: 0.9 });
  for (let i = 0; i < 3; i++) { g.fillStyle = i % 2 ? C.a : '#ffffff'; g.fill(poly([[-2 + i * 2, -9], [-1 + i * 2, -13], [i * 2, -9]])); }
  g.restore();
  // cape
  const cape = P(); cape.moveTo(-6, -22); cape.quadraticCurveTo(-14, -10, -12, -2); cape.lineTo(-3, -6); cape.closePath();
  fillShaded(g, cape, C.c, { off: 1 });
  heroFeet(g, f, '#5a3a24');
  // tunique
  const tu = P(); tu.moveTo(-6, -20); tu.lineTo(6, -20); tu.lineTo(8.5, -5); tu.quadraticCurveTo(0, -3, -8.5, -5); tu.closePath();
  fillShaded(g, tu, C[1], { off: 1.8, light: C[3], hl: { x: -3, y: -16, rx: 2.5, ry: 4, a: 0.5 } });
  fillShaded(g, rrect(-7, -12.5, 14, 2.4, 1), '#6a4426', { off: 0.4, line: 0.8 });
  // arc devant
  g.save(); g.translate(13, -15);
  g.strokeStyle = OUT; g.lineWidth = 4; g.beginPath(); g.arc(-6, 0, 12, -1.05, 1.05); g.stroke();
  g.strokeStyle = evo >= 1 ? C.a : '#b07a3a'; g.lineWidth = 2.2; g.beginPath(); g.arc(-6, 0, 12, -1.05, 1.05); g.stroke();
  g.strokeStyle = '#ffffff'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(0, -10.4); g.lineTo(0, 10.4); g.stroke();
  g.restore();
  fillShaded(g, ell(12.5, -15, 2.4, 2.4), C.s, { off: 0.5, line: 0.9 });
  heroHead(g, C);
  // capuche + cheveux blancs
  const hood = P(); hood.moveTo(-12.5, -26); hood.quadraticCurveTo(-13, -43, 1, -42); hood.quadraticCurveTo(13, -42, 12.5, -31); hood.quadraticCurveTo(9, -37, 2, -36); hood.quadraticCurveTo(-6, -35, -8, -27); hood.closePath();
  fillShaded(g, hood, C[1], { off: 1.4, light: C[3], hl: { x: -4, y: -39, rx: 5, ry: 1.8, rot: -0.2 } });
  const hr = P(); hr.moveTo(-1, -36.5); hr.quadraticCurveTo(5, -38, 11, -32); hr.quadraticCurveTo(6, -34, 3, -32.5); hr.quadraticCurveTo(1, -34.5, -1, -36.5); hr.closePath();
  fillShaded(g, hr, C.h, { off: 0.6, line: 0.8 });
  if (evo >= 2) crown(g, 1, -41, 10, C.a, '#9ad8ff');
}

function drawKnight(g, C, evo, f) {
  if (evo >= 2) { // ailes dorées derrière le dos
    for (const [sd, sc] of [[1, 0.7], [-1, 1]]) {
      g.save(); g.translate(sd > 0 ? 2 : -3, -20); g.scale(sd * sc, sc);
      const w = P(); w.moveTo(0, -2); w.quadraticCurveTo(10, -24, 26, -22); w.quadraticCurveTo(22, -18, 25, -14);
      w.quadraticCurveTo(19, -12, 21, -7); w.quadraticCurveTo(14, -6, 15, -1); w.quadraticCurveTo(7, 0, 0, 4); w.closePath();
      fillShaded(g, w, '#ffffff', { dark: '#cfd8f2', light: '#ffffff', off: 1.2, line: 1 });
      g.strokeStyle = C.a; g.lineWidth = 1; g.beginPath(); g.moveTo(4, -4); g.quadraticCurveTo(12, -16, 22, -18); g.stroke();
      g.restore();
    }
  }
  // cape
  const cape = P(); cape.moveTo(-6, -22); cape.quadraticCurveTo(-15, -11, -13, -1); cape.lineTo(-2, -5); cape.closePath();
  fillShaded(g, cape, C.c, { off: 1 });
  // épée (derrière la main)
  g.save(); g.translate(13, -14); g.rotate(-0.25);
  const blade = poly([[-2.4, -4], [-2.4, -27], [0, -31], [2.4, -27], [2.4, -4]]);
  fillShaded(g, blade, C[3], { dark: C[2], off: 0.9, line: 1 });
  g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(-0.8, -6); g.lineTo(-0.8, -27); g.stroke();
  fillShaded(g, rrect(-6, -5, 12, 3, 1.4), C.a, { off: 0.5, line: 0.9 });
  fillShaded(g, rrect(-1.6, -2.5, 3.2, 6, 1), '#6a4426', { off: 0.4, line: 0.8 });
  g.restore();
  heroFeet(g, f, C[2]);
  // armure
  const ar = rrect(-8.5, -21, 17, 16, 5);
  fillShaded(g, ar, C[1], { dark: C[2], light: C[3], off: 2, hl: { x: -3.5, y: -17, rx: 3, ry: 3.6, a: 0.8 } });
  fillShaded(g, rrect(-8.5, -9.5, 17, 2.6, 1), '#6a4426', { off: 0.4, line: 0.8 });
  fillShaded(g, ell(0, -8.2, 1.8, 1.6), C.a, { off: 0.3, line: 0.6 });
  if (evo >= 1) for (const sx of [-9, 9]) fillShaded(g, ell(sx, -19, 4.6, 3.6), C[1], { dark: C[2], light: C[3], off: 0.8, hl: { x: sx - 1, y: -20.5, rx: 1.6, ry: 1 } });
  // bouclier rond devant
  const sh = ell(4, -13, 6.2, 7.4);
  fillShaded(g, sh, C.c, { off: 1.2, hl: { x: 2.4, y: -16.5, rx: 1.8, ry: 2.2, a: 0.5 } });
  g.lineWidth = 1.4; g.strokeStyle = C.a; g.stroke(ell(4, -13, 4.8, 6));
  g.fillStyle = C.a; g.fill(poly([[4, -17], [6.2, -13], [4, -9], [1.8, -13]]));
  // main
  fillShaded(g, ell(12.4, -14.5, 2.5, 2.5), C[2], { off: 0.5, line: 0.9 });
  // casque
  const hm = P(); hm.moveTo(-11.5, -24); hm.quadraticCurveTo(-12.5, -42, 0, -41.5); hm.quadraticCurveTo(12.5, -42, 11.5, -24); hm.quadraticCurveTo(0, -20.5, -11.5, -24); hm.closePath();
  fillShaded(g, hm, C[1], { dark: C[2], light: C[3], off: 1.6, hl: { x: -4, y: -36, rx: 3.4, ry: 2.6, a: 0.9 } });
  fillShaded(g, rrect(-2, -31.5, 14, 4.2, 2), '#20183a', { off: 0, line: 0.9 });
  g.fillStyle = '#bfefff'; g.fill(ell(4, -29.4, 1.4, 1.1)); g.fill(ell(9, -29.4, 1.2, 1.1));
  // plumet
  const pl = P(); pl.moveTo(-2, -41); pl.quadraticCurveTo(-6, -50, -14, -46); pl.quadraticCurveTo(-8, -45, -4, -39); pl.closePath();
  fillShaded(g, pl, evo >= 1 ? C.c : '#d84a4a', { off: 0.8, line: 0.9 });
  if (evo >= 2) halo(g, 0, -46, C.a);
}

const HERO_DRAW = { mage: drawMage, archer: drawArcher, knight: drawKnight };

export function heroSprites(clsId, evo, res) {
  const C = heroColors(clsId, evo);
  const glow = evo >= 1 ? { c: C.a || '#ffd54a', r: 3 + evo * 1.5, a: 0.35 + evo * 0.15 } : null;
  return [0, 1].map(f => bake(58, 58, 29, 52, res, g => HERO_DRAW[clsId](g, C, evo, f), { variants: true, glow }));
}

// ---------- Monstres ----------
// Toutes les créatures sont dessinées pour un rayon de 16 (sprite d'environ 40 unités), puis mises à l'échelle.
function mPal(def) { const [m, d, l] = def.pal; return { m, d, l }; }

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
  return toURL('h:' + clsId + ':' + evo, () => bake(58, 58, 29, 52, 2, g => HERO_DRAW[clsId](g, heroColors(clsId, evo), evo, 0), { outline: 2.2 }));
}

export { hash, P, ell, rrect, poly, fillShaded, glowDot, eye, crown, cnv };
