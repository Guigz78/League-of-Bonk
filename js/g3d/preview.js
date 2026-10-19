// Aperçu animé d'un champion 3D sur son socle (menus). Un seul contexte WebGL partagé pour tous les aperçus :
// chaque aperçu est rendu dans un coin du canevas partagé puis recopié dans son propre canevas 2D.
// L'animation s'arrête d'elle-même quand le canevas quitte la page.
import { THREE, PI, TAU } from './models-kit.js';
import { heroModel } from './models.js';
import { sharedRenderer, lights } from './portraits.js';
import { glowTex } from './models-kit.js';

const live = new Set();
let raf = 0, last = 0;

function pedestal(evo) {
  const g = new THREE.Group();
  const stone = new THREE.MeshLambertMaterial({ color: '#3a4a7a', flatShading: true });
  const rimM = new THREE.MeshLambertMaterial({ color: evo >= 4 ? '#ffd54a' : evo ? '#f0c35a' : '#6a8ad8', flatShading: true, emissive: evo ? '#5a3a00' : '#0a1a4a' });
  const top = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.18, 0.32, 10), stone); top.position.y = -0.16; g.add(top);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.08, 0.07, 4, 20), rimM); rim.rotation.x = PI / 2; rim.position.y = 0.0; g.add(rim);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.35, 0.24, 10), stone); base.position.y = -0.44; g.add(base);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), new THREE.MeshBasicMaterial({ map: glowTex(), color: evo ? '#ffd54a' : '#4a8aff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.6 }));
  glow.rotation.x = -PI / 2; glow.position.y = 0.02; g.add(glow);
  g.userData.glow = glow;
  return g;
}

function loop(now) {
  raf = 0;
  const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016); last = now;
  const r = sharedRenderer();
  // taille du canevas partagé : le plus grand aperçu
  let MW = 1, MH = 1;
  for (const P of live) {
    if (!P.canvas.isConnected) { live.delete(P); P.dispose(); continue; }
    MW = Math.max(MW, P.w); MH = Math.max(MH, P.h);
  }
  if (!live.size) { last = 0; return; }
  const size = r.getSize(new THREE.Vector2());
  if (size.x < MW || size.y < MH) { r.setPixelRatio(1); r.setSize(Math.max(MW, size.x), Math.max(MH, size.y), false); }
  const H = r.getSize(new THREE.Vector2()).y;
  for (const P of live) {
    P.t += dt;
    P.step(dt);
    r.setViewport(0, 0, P.w, P.h); r.setScissor(0, 0, P.w, P.h); r.setScissorTest(true);
    r.clear(); r.render(P.scene, P.cam);
    r.setScissorTest(false);
    P.g.clearRect(0, 0, P.w, P.h);
    P.g.drawImage(r.domElement, 0, H - P.h, P.w, P.h, 0, 0, P.w, P.h);
  }
  raf = requestAnimationFrame(loop);
}

export function mountPreview(canvas, clsId, evo = 0) {
  if (!canvas) return;
  for (const P of live) if (P.canvas === canvas) { live.delete(P); P.dispose(); }
  const g = canvas.getContext('2d');
  if (!g) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cw = canvas.clientWidth || 120, ch = canvas.clientHeight || 130;
  const w = Math.round(cw * dpr), h = Math.round(ch * dpr);
  canvas.width = w; canvas.height = h;
  canvas.style.imageRendering = 'auto';
  let hero;
  try { hero = heroModel(clsId, evo); } catch (e) { console.warn('aperçu 3D', e); return; }
  const scene = new THREE.Scene(); lights(scene, 1.05);
  const ped = pedestal(evo); scene.add(ped); scene.add(hero.root);
  // caméra : trois quarts face, un peu d'en haut ; cadre le héros (plus grand en forme ultime : aura, cheveux)
  const tall = hero.height + (evo >= 3 ? 1.0 : 0.55), aspect = w / h;
  const cam = new THREE.PerspectiveCamera(26, aspect, 0.5, 100);
  const fitH = Math.max(tall + 0.6, 2.9 / aspect), dist = fitH / 2 / Math.tan(13 * PI / 180) * 1.02;
  const cy = tall / 2 - 0.25;
  cam.position.set(Math.sin(0.35) * dist * 0.96, cy + dist * 0.3, Math.cos(0.35) * dist * 0.96); cam.lookAt(0, cy, 0);
  // petite démo en boucle : respire, attaque deux fois, saute, se tourne
  const P = {
    canvas, g, w, h, scene, cam, t: 0,
    step(dt) {
      const t = P.t, ph = t % 5.2, side = Math.floor(t / 5.2) % 2 ? -1 : 1;
      let atk = 0, air = 0, vy = 0;
      if (ph > 1.3 && ph < 1.8) atk = 1 - (ph - 1.3) / 0.5;
      else if (ph > 2.1 && ph < 2.6) atk = 1 - (ph - 2.1) / 0.5;
      else if (ph > 3.4 && ph < 3.95) { const q = (ph - 3.4) / 0.55; air = Math.sin(q * PI) * 26; vy = q < 0.5 ? 1 : -1; }
      const dirA = PI / 2 + side * 0.45 + Math.sin(t * 0.7) * 0.12;
      hero.update(dt, { t, moving: false, air, vy, atk, atkA: PI / 2 + side * 0.25, dirA });
      ped.userData.glow.material.opacity = 0.45 + Math.sin(t * 2) * 0.15;
    },
    dispose() {
      hero.dispose();
      scene.traverse(o => { if (o.isMesh && o.parent === ped) { o.geometry.dispose(); o.material.dispose(); } });
    },
  };
  live.add(P);
  P.step(0.016);
  if (!raf) { last = 0; raf = requestAnimationFrame(loop); }
}
