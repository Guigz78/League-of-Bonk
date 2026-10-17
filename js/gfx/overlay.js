// Calque 2D par-dessus la 3D : barres de vie, prix des coffres, chiffres de dégâts, mini-carte, flashs, joystick.
// Lit l'état du jeu (run) et ne le modifie jamais.
import { S } from '../world3d.js';

const TAU = Math.PI * 2;
const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

export class Overlay {
  constructor(gfx, canvas) {
    this.gfx = gfx;
    this.run = gfx.run;
    this.cv = canvas;
    this.g = canvas.getContext('2d');
  }

  resize(vw, vh, dpr) {
    this.vw = vw; this.vh = vh; this.dpr = dpr;
    this.cv.width = Math.round(vw * dpr); this.cv.height = Math.round(vh * dpr);
  }

  project(x, y, z) {
    const gfx = this.gfx;
    const v = gfx.tv.set(x * S, gfx.gh(x, y) + z * S, y * S).project(gfx.camera);
    if (v.z > 1 || v.z < -1) return null;
    return [(v.x + 1) / 2 * this.vw, (1 - v.y) / 2 * this.vh];
  }

  render() {
    const g = this.g, run = this.run, p = run.p, vw = this.vw, vh = this.vh;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, vw, vh);
    // barre de vie sous le héros
    const hp = this.project(p.x, p.y, p.h - 6);
    if (hp) {
      const bw = 50, ratio = Math.max(0, p.hp / p.maxHp);
      g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(hp[0] - bw / 2 - 1, hp[1] + 4, bw + 2, 7);
      g.fillStyle = ratio < 0.3 ? '#ff7a4a' : '#5ae87a'; g.fillRect(hp[0] - bw / 2, hp[1] + 5, bw * ratio, 5);
    }
    for (const e of run.enemies) if (e.elite && !e.dead) {
      const s = this.project(e.x, e.y, e.r * 2.6 + e.fly); if (!s) continue;
      g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(s[0] - 26, s[1], 52, 6);
      g.fillStyle = '#c06aff'; g.fillRect(s[0] - 25, s[1] + 1, 50 * Math.max(0, e.hp / e.maxHp), 4);
    }
    g.textAlign = 'center';
    for (const c of run.chests) if (!c.open && dist2(c, p) < 340 * 340) {
      const s = this.project(c.x, c.y, 55); if (!s) continue;
      g.font = '800 13px ui-rounded, system-ui, sans-serif';
      g.fillStyle = 'rgba(10,6,20,.8)'; g.fillRect(s[0] - 30, s[1] - 14, 60, 20);
      g.fillStyle = run.gold >= run.chestCost ? '#ffd54a' : '#ff9a8a'; g.fillText(`${run.chestCost} or`, s[0], s[1] + 1);
    }
    for (const tx of run.texts) {
      const s = this.project(tx.x, tx.y, tx.z); if (!s) continue;
      g.globalAlpha = Math.min(1, tx.life * 3);
      g.font = `900 ${Math.round(15 * tx.size)}px ui-rounded, system-ui, sans-serif`;
      g.lineWidth = 3; g.strokeStyle = '#000'; g.strokeText(tx.txt, s[0], s[1]);
      g.fillStyle = tx.color; g.fillText(tx.txt, s[0], s[1]);
    }
    g.globalAlpha = 1;
    this.minimap(g, vw);
    if (run.ultFlash > 0) { g.fillStyle = `rgba(255,240,200,${run.ultFlash})`; g.fillRect(0, 0, vw, vh); }
    if (run.evoFlash > 0.6) { g.fillStyle = `rgba(255,250,220,${(run.evoFlash - 0.6) * 1.2})`; g.fillRect(0, 0, vw, vh); }
    if (run.hurtFlash > 0) { g.fillStyle = `rgba(255,40,60,${run.hurtFlash})`; g.fillRect(0, 0, vw, vh); }
    if (run.joy) {
      const j = run.joy, r = this.cv.getBoundingClientRect();
      const ox = j.ox - r.left, oy = j.oy - r.top;
      let kx = j.x - j.ox, ky = j.y - j.oy; const d = Math.hypot(kx, ky); if (d > 50) { kx *= 50 / d; ky *= 50 / d; }
      g.fillStyle = 'rgba(255,255,255,.12)'; g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2;
      g.beginPath(); g.arc(ox, oy, 54, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.arc(ox + kx, oy + ky, 24, 0, TAU); g.fill();
    }
  }

  minimap(g, vw) {
    const run = this.run, p = run.p, R = 44, cx = vw - R - 12, cy = 158, range = 900;
    g.save();
    g.beginPath(); g.arc(cx, cy, R, 0, TAU);
    g.fillStyle = 'rgba(10,6,20,.6)'; g.fill();
    g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 2; g.stroke();
    g.clip();
    // le haut de la mini-carte = la direction regardée par la caméra
    const c = Math.cos(run.yaw), s = Math.sin(run.yaw);
    const dot = (x, y, col, r) => {
      const dx = (x - p.x) / range * R, dy = (y - p.y) / range * R;
      g.fillStyle = col; g.beginPath(); g.arc(cx + dx * c - dy * s, cy + dx * s + dy * c, r, 0, TAU); g.fill();
    };
    for (const e of run.enemies) if (!e.boss && dist2(e, p) < range * range) dot(e.x, e.y, 'rgba(255,90,90,.6)', 1.3);
    for (const ch of run.chests) if (!ch.open) dot(ch.x, ch.y, '#ffc83a', 3);
    for (const ch of run.dropChests) if (!ch.open) dot(ch.x, ch.y, '#ffc83a', 3);
    for (const sh of run.shrines) if (!sh.used) dot(sh.x, sh.y, '#4fd0ff', 3.2);
    if (run.boss && !run.boss.dead) dot(run.boss.x, run.boss.y, '#ff2a4a', 4.5);
    g.restore();
    g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(cx, cy - 5); g.lineTo(cx + 4, cy + 4); g.lineTo(cx - 4, cy + 4); g.fill();
  }
}
