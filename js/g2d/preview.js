// Aperçu animé d'un champion sur son socle (menus) : mêmes sprites que pendant la partie.
import { heroSprites } from './sprites.js';
import { glowTex } from './items.js';

const cache = new Map();

export function mountPreview(canvas, clsId, evo = 0) {
  if (!canvas) return;
  const g = canvas.getContext('2d');
  const W = canvas.clientWidth || 120, H = canvas.clientHeight || 130, dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = W * dpr; canvas.height = H * dpr;
  canvas.style.imageRendering = 'auto';
  const k = Math.min(W / 60, H / 66);
  const key = clsId + ':' + evo + ':' + Math.round(k * dpr * 10);
  if (!cache.has(key)) cache.set(key, heroSprites(clsId, evo, k * dpr));
  const set = cache.get(key);
  const t0 = performance.now();
  let face = 1;
  const loop = now => {
    if (!canvas.isConnected) return;
    const t = (now - t0) / 1000;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    const cx = W / 2, cy = H - 14;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // socle
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.5 + Math.sin(t * 2) * 0.12;
    g.drawImage(glowTex(evo ? '#ffd54a' : '#7a6aff'), cx - 40 * k / 1.4, cy - 26 * k / 1.4, 80 * k / 1.4, 40 * k / 1.4);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#2a2050'; g.beginPath(); g.ellipse(cx, cy, 22 * k, 7 * k, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#f0c35a'; g.lineWidth = 2; g.stroke();
    // petite démo : respire, sautille, se retourne de temps en temps
    const ph = t % 3.2;
    let up = 0, sx = 1, sy = 1 + Math.sin(t * 3) * 0.025;
    if (ph > 2.3 && ph < 2.85) { const q = (ph - 2.3) / 0.55; up = Math.sin(q * Math.PI) * 14 * k; sy = 1.1; sx = 0.92; }
    else if (ph >= 2.85 && ph < 3.0) { sx = 1.15; sy = 0.86; }
    if (Math.floor(t / 3.2) % 2) face = -1; else face = 1;
    const s = set[(t * 2.5 | 0) & 1 && up ? 1 : 0];
    g.setTransform(dpr * k * sx * face, 0, 0, dpr * k * sy, dpr * cx, dpr * (cy - up));
    g.drawImage(s.c, -s.ax, -s.ay, s.w, s.h);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
