// Aperçu 3D d'un champion animé sur un socle (menus) : mêmes modèles que pendant la partie.
import * as THREE from '../vendor/three.module.min.js';
import { HeroModel } from './gfx/heroes.js';

let shared = null; // un seul contexte WebGL pour tous les aperçus

export function mountPreview(canvas, clsId, evo = 0) {
  if (!canvas) return;
  if (!shared) {
    try {
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      shared = { renderer };
    } catch (e) { return; }
  }
  const { renderer } = shared;
  const scene = new THREE.Scene();
  // lumière propre à l'aperçu (scène séparée du jeu)
  scene.add(new THREE.HemisphereLight('#ffffff', '#3a2a6a', 2.0));
  const sun = new THREE.DirectionalLight('#fff0d8', 2.6); sun.position.set(2.5, 5, 4); scene.add(sun);
  const back = new THREE.DirectionalLight('#9ab8ff', 1.4); back.position.set(-3, 2.5, -4); scene.add(back);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  cam.position.set(0, 2.0, 7.2); cam.lookAt(0, 1.3, 0);
  const hero = new HeroModel(clsId, evo);
  hero.root.scale.setScalar(1.05 + evo * 0.06);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 0.25, 8), new THREE.MeshLambertMaterial({ color: '#3a3170', flatShading: true }));
  base.position.y = -0.13;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.05, 6, 32), new THREE.MeshBasicMaterial({ color: '#f0c35a' }));
  ring.rotation.x = Math.PI / 2;
  scene.add(hero.root, base, ring);
  const ctx = canvas.getContext('2d');
  const W = canvas.clientWidth || 120, H = canvas.clientHeight || 130, dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = W * dpr; canvas.height = H * dpr;
  cam.aspect = W / H; cam.updateProjectionMatrix();
  const t0 = performance.now();
  let last = t0, nextAtk = 1.2, hop = -1;
  const loop = now => {
    if (!canvas.isConnected) {
      hero.dispose();
      base.geometry.dispose(); ring.geometry.dispose();
      base.material.dispose(); ring.material.dispose();
      return;
    }
    const t = (now - t0) / 1000, dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    // petite démo : il se tourne, respire, attaque, saute de temps en temps
    hero.root.rotation.y = 0.35 + Math.sin(t * 0.8) * 0.75;
    if (t > nextAtk) {
      nextAtk = t + 2.4;
      if (Math.floor(t / 2.4) % 3 === 2) { hop = 0; hero.jump(); } else hero.attack(Math.sin(t) * 0.4);
    }
    let air = 0;
    if (hop >= 0) {
      hop += dt / 0.55;
      air = Math.sin(Math.min(1, hop) * Math.PI) * 0.7;
      if (hop >= 1) { hop = -1; hero.land(); }
    }
    hero.root.position.y = air;
    hero.update(dt, { moving: false, speed: 0, air, turn: 0 });
    renderer.setPixelRatio(dpr);
    renderer.setSize(W, H, false);
    renderer.render(scene, cam);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(renderer.domElement, 0, 0, canvas.width, canvas.height);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
