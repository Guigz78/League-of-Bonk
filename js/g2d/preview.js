// Aperçu animé d'un champion sur son socle (menus) : même marionnette que pendant la partie.
import { heroRig } from './sprites.js';
import { glowTex } from './items.js';

export function mountPreview(canvas, clsId, evo = 0) {
  if (!canvas) return;
  const g = canvas.getContext('2d');
  const W = canvas.clientWidth || 120, H = canvas.clientHeight || 130, dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = W * dpr; canvas.height = H * dpr;
  canvas.style.imageRendering = 'auto';
  // le chapeau, les cheveux et l'aura dépassent : on garde de la marge en haut
  const k = Math.min(W / 62, (H - 16) / (evo >= 3 ? 70 : 62));
  const rig = heroRig(clsId, evo);
  const t0 = performance.now();
  const loop = now => {
    if (!canvas.isConnected) return;
    const t = (now - t0) / 1000;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    const cx = W / 2, cy = H - 12;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // socle
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.5 + Math.sin(t * 2) * 0.12;
    g.drawImage(glowTex(evo ? '#ffd54a' : '#4a8aff'), cx - 40 * k / 1.4, cy - 26 * k / 1.4, 80 * k / 1.4, 40 * k / 1.4);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#1e2a6a'; g.beginPath(); g.ellipse(cx, cy, 22 * k, 7 * k, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#f0c35a'; g.lineWidth = 2; g.stroke();
    // petite démo en boucle : respire, attaque, sautille, se retourne
    const ph = t % 4.8, face = Math.floor(t / 4.8) % 2 ? -1 : 1;
    let up = 0, sx = 1, sy = 1, air = 0, vy = 0, atk = 0;
    if (ph > 1.2 && ph < 1.6) atk = 1 - (ph - 1.2) / 0.4;
    else if (ph > 2 && ph < 2.4) atk = 1 - (ph - 2) / 0.4;
    else if (ph > 3.3 && ph < 3.85) { const q = (ph - 3.3) / 0.55; up = Math.sin(q * Math.PI) * 13; air = up + 1; vy = q < 0.5 ? 1 : -1; sy = 1.06; sx = 0.95; }
    else if (ph >= 3.85 && ph < 4) { sx = 1.12; sy = 0.9; }
    g.setTransform(dpr * k * sx * face, 0, 0, dpr * k * sy, dpr * cx, dpr * (cy - up * k));
    rig.draw(g, { t, moving: false, air, vy, atk, atkA: -0.25 });
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
