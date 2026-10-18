// Objets et projectiles 2D : gemmes, pièces, cœurs, coffres, autels, champignons, flèches, dagues…
import { bake, P, ell, rrect, poly, fillShaded, glowDot, OUT } from './sprites.js';

const TAU = Math.PI * 2;

export function itemSprites(res, T) {
  const S = {};
  const gem = (col, dark, light, s) => bake(14 * s, 18 * s, 7 * s, 17 * s, res, g => {
    g.scale(s, s);
    fillShaded(g, poly([[0, -17], [6.5, -9], [0, -1], [-6.5, -9]]), col, { dark, light, off: 1.6, line: 0.9, hl: { x: -2.4, y: -11, rx: 1.4, ry: 3.4, rot: 0.6, a: 0.95 } });
    g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(-6.5, -9); g.lineTo(6.5, -9); g.moveTo(0, -17); g.lineTo(0, -1); g.stroke();
  }, { outline: 1.4 });
  S.gem = [gem('#4fb8ff', '#2a6ad8', '#e0f6ff', 0.75), gem('#5ae87a', '#21904a', '#e0ffe8', 0.9), gem('#c06aff', '#7a2ad8', '#f4e0ff', 1.05), gem('#ff4a6a', '#b0203a', '#ffd8e0', 1.3)];
  S.coin = bake(14, 14, 7, 14, res, g => {
    fillShaded(g, ell(0, -7, 6.5, 6.5), '#ffd040', { dark: '#c8860c', light: '#fff6b8', off: 1.2, line: 1, hl: { x: -2, y: -9.6, rx: 2, ry: 1.4, a: 0.95 } });
    g.strokeStyle = '#c8860c'; g.lineWidth = 1.2; g.stroke(ell(0, -7, 4, 4));
    g.fillStyle = '#c8860c'; g.fillRect(-0.7, -9.5, 1.4, 5);
  }, { outline: 1.4 });
  S.heart = bake(20, 18, 10, 17, res, g => {
    const p = P(); p.moveTo(0, -1); p.bezierCurveTo(-11, -7.5, -9, -17.5, 0, -12.5); p.bezierCurveTo(9, -17.5, 11, -7.5, 0, -1); p.closePath();
    fillShaded(g, p, '#ff4a6a', { dark: '#b0203a', light: '#ffe0e6', off: 1.6, line: 1, hl: { x: -4, y: -12, rx: 2.2, ry: 1.5, rot: -0.5, a: 0.95 } });
  }, { outline: 1.6 });
  S.magnet = bake(22, 20, 11, 18, res, g => {
    g.lineCap = 'butt';
    g.strokeStyle = OUT; g.lineWidth = 8; g.beginPath(); g.arc(0, -10, 7, Math.PI, 0); g.lineTo(7, -2); g.moveTo(-7, -10); g.lineTo(-7, -2); g.stroke();
    g.strokeStyle = '#e8384a'; g.lineWidth = 5.4; g.beginPath(); g.arc(0, -10, 7, Math.PI, 0); g.lineTo(7, -5); g.moveTo(-7, -10); g.lineTo(-7, -5); g.stroke();
    g.strokeStyle = '#e8eef8'; g.beginPath(); g.moveTo(-7, -5); g.lineTo(-7, -2); g.moveTo(7, -5); g.lineTo(7, -2); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 1.4; g.beginPath(); g.arc(0, -10, 7, Math.PI * 1.1, Math.PI * 1.5); g.stroke();
  }, { outline: 1.4 });
  const chest = (open, gold) => bake(40, 40, 20, 36, res, g => {
    const wood = gold ? '#ffcf40' : '#b0682c', dark = gold ? '#c8860c' : '#6e3c18', light = gold ? '#fff2a8' : '#e09a5a', band = gold ? '#e83a5a' : '#f0c850';
    if (open) {
      fillShaded(g, rrect(-15, -33, 30, 9, 4), dark, { off: 0.6, line: 1 });
      g.fillStyle = '#2a1408'; g.fill(rrect(-13, -24, 26, 6, 2));
      glowDot(g, 0, -24, 5, '#ffe48a');
    }
    fillShaded(g, rrect(-15, -21, 30, 21, 3), wood, { dark, light, off: 2, hl: { x: -8, y: -17, rx: 4, ry: 1.6, a: 0.6 } });
    g.fillStyle = band; g.fillRect(-11, -21, 4, 21); g.fillRect(7, -21, 4, 21);
    g.lineWidth = 0.9; g.strokeStyle = OUT; g.strokeRect(-11, -21, 4, 21); g.strokeRect(7, -21, 4, 21);
    if (!open) {
      const lid = P(); lid.moveTo(-15, -20); lid.bezierCurveTo(-15, -32, 15, -32, 15, -20); lid.closePath();
      fillShaded(g, lid, wood, { dark, light, off: 1.6, hl: { x: -6, y: -27, rx: 5, ry: 1.6, a: 0.7 } });
      g.save(); g.clip(lid); g.fillStyle = band; g.fillRect(-11, -34, 4, 16); g.fillRect(7, -34, 4, 16); g.restore();
      fillShaded(g, rrect(-3.4, -24, 6.8, 8, 1.6), band === '#e83a5a' ? '#ffffff' : '#f0c850', { off: 0.6, line: 1 });
      g.fillStyle = OUT; g.fill(ell(0, -20.5, 1, 1.4));
    }
  }, { outline: 2 });
  S.chest = [chest(false, false), chest(true, false)];
  S.gchest = [chest(false, true), chest(true, true)];
  S.shrine = bake(40, 30, 20, 26, res, g => {
    fillShaded(g, rrect(-16, -8, 32, 8, 2), '#8a8aa0', { dark: '#5a5a70', light: '#c8c8da', off: 1 });
    fillShaded(g, rrect(-10, -22, 20, 15, 2), '#a8a8bc', { dark: '#6a6a80', light: '#e0e0ee', off: 1.6, hl: { x: -5, y: -17, rx: 1.6, ry: 4, a: 0.6 } });
    fillShaded(g, rrect(-14, -25, 28, 5, 2), '#8a8aa0', { dark: '#5a5a70', light: '#c8c8da', off: 0.8 });
    g.strokeStyle = '#4fd0ff'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-4, -18); g.lineTo(0, -12); g.lineTo(4, -18); g.stroke();
  }, { outline: 2 });
  const crys = (c, d, l) => bake(20, 30, 10, 28, res, g => {
    fillShaded(g, poly([[0, -28], [7, -16], [0, -2], [-7, -16]]), c, { dark: d, light: l, off: 1.6, line: 1, hl: { x: -2.4, y: -18, rx: 1.6, ry: 5, rot: 0.3, a: 0.95 } });
    g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(-7, -16); g.lineTo(7, -16); g.stroke();
  }, { outline: 1.6 });
  S.crystal = [crys('#4fd0ff', '#1f8ad8', '#e0faff'), crys('#9a9aae', '#6a6a80', '#d0d0de')];
  S.mine = bake(22, 18, 11, 16, res, g => {
    fillShaded(g, rrect(-3, -7, 6, 7, 2.4), '#f4ead0', { dark: '#c8b898', off: 0.6 });
    const cap = P(); cap.moveTo(-10, -5); cap.bezierCurveTo(-10, -17, 10, -17, 10, -5); cap.quadraticCurveTo(0, -2, -10, -5); cap.closePath();
    fillShaded(g, cap, '#6ae84a', { dark: '#2a9a2a', light: '#d0ffb0', off: 1.4, line: 1, hl: { x: -4, y: -11, rx: 3, ry: 1.4, rot: -0.4, a: 0.8 } });
    g.fillStyle = '#ffffff'; g.fill(ell(-4, -9, 1.6, 1.3)); g.fill(ell(3, -12, 1.8, 1.4)); g.fill(ell(5.5, -7.5, 1.2, 1));
  }, { outline: 1.4 });
  // projectiles (dessinés horizontalement, pointe vers la droite, ancrés au centre)
  S.arrow = bake(30, 10, 15, 5, res, g => {
    g.strokeStyle = '#c89a5a'; g.lineWidth = 2; g.beginPath(); g.moveTo(-12, 0); g.lineTo(9, 0); g.stroke();
    fillShaded(g, poly([[8, -3.4], [15, 0], [8, 3.4]]), '#e8f4ff', { dark: '#9ab0c8', off: 0.4, line: 0.8 });
    g.fillStyle = '#ffffff'; g.fill(poly([[-13, 0], [-9, -4], [-6, -4], [-9, 0]])); g.fill(poly([[-13, 0], [-9, 4], [-6, 4], [-9, 0]]));
  }, { outline: 1.2 });
  S.dagger = bake(22, 10, 11, 5, res, g => {
    fillShaded(g, poly([[-2, -2.6], [10, -1], [12, 0], [10, 1], [-2, 2.6]]), '#f0f4fc', { dark: '#a8b4c8', off: 0.5, line: 0.8 });
    fillShaded(g, rrect(-4, -4, 2.6, 8, 1), '#f0c850', { off: 0.3, line: 0.7 });
    fillShaded(g, rrect(-9, -1.4, 5.4, 2.8, 1), '#7a4a2a', { off: 0.3, line: 0.7 });
  }, { outline: 1.2 });
  S.boom = bake(30, 30, 15, 15, res, g => {
    const p = P(); p.moveTo(-12, -9); p.quadraticCurveTo(0, -4, 12, -9); p.quadraticCurveTo(8, -2, 2, 6); p.quadraticCurveTo(0, 0, -2, 6); p.quadraticCurveTo(-8, -2, -12, -9); p.closePath();
    fillShaded(g, p, '#f0c850', { dark: '#b0841a', light: '#fff4b8', off: 1.2, line: 1, hl: { x: -4, y: -6.5, rx: 4, ry: 1, a: 0.8 } });
    g.fillStyle = '#e83a5a'; g.fill(ell(0, -4.6, 2, 1.6));
  }, { outline: 1.4 });
  S.shard = bake(80, 40, 40, 20, res, g => {
    fillShaded(g, poly([[-30, 0], [-6, -14], [36, 0], [-6, 14]]), '#bfeaff', { dark: '#5aa8e0', light: '#ffffff', off: 3, line: 1.2, hl: { x: -4, y: -6, rx: 14, ry: 2.4, a: 0.95 } });
    g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-30, 0); g.lineTo(36, 0); g.stroke();
  }, { outline: 2, glow: { c: '#9ad8ff', r: 6, a: 0.8 } });
  S.snow = bake(30, 30, 15, 15, res, g => {
    fillShaded(g, ell(0, 0, 12, 12), '#ffffff', { dark: '#b8d0ea', light: '#ffffff', off: 3, line: 1 });
    g.fillStyle = '#dce8f6'; g.fill(ell(4, 4, 2.4, 2)); g.fill(ell(-5, 2, 1.8, 1.4));
  }, { outline: 1.6 });
  S.mound = bake(50, 26, 25, 20, res, g => {
    const c = T.rock;
    const p = P(); p.moveTo(-22, 0); p.bezierCurveTo(-18, -16, 18, -16, 22, 0); p.quadraticCurveTo(0, 4, -22, 0); p.closePath();
    fillShaded(g, p, c[1], { dark: c[1] === '#2e2244' ? '#1a1028' : '#4a3a2a', light: c[0], off: 2, line: 1, hl: { x: -6, y: -9, rx: 6, ry: 2, a: 0.6 } });
    g.fillStyle = c[0]; for (const [x, y] of [[-12, -4], [8, -7], [14, -3], [-3, -10]]) g.fill(ell(x, y, 2.4, 1.8));
  }, { outline: 1.8 });
  return S;
}

// halo coloré (dégradé radial) pour les lumières en mode additif
const glowCache = new Map();
export function glowTex(col) {
  let c = glowCache.get(col);
  if (c) return c;
  c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, col); gr.addColorStop(0.25, col + 'cc'); gr.addColorStop(0.6, col + '44'); gr.addColorStop(1, col + '00');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  glowCache.set(col, c);
  return c;
}

export function softTex() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.55, 'rgba(0,0,0,.7)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return c;
}

export function puffTex() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(28, 26, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.7, 'rgba(240,236,250,.9)'); gr.addColorStop(1, 'rgba(220,214,240,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(32, 32, 32, 0, TAU); g.fill();
  return c;
}
