// Aperçu 3D d'un champion qui tourne sur un socle (menus).
import * as THREE from '../vendor/three.module.min.js';
import { CLASSES, EVOLUTIONS } from './data.js';
import { heroGrid } from './art.js';
import { voxelGeometry } from './voxel.js';

let shared = null; // un seul contexte WebGL pour tous les aperçus

export function mountPreview(canvas, clsId, evo = 0) {
  if (!canvas) return;
  const cls = CLASSES[clsId];
  const ev = EVOLUTIONS[clsId][evo];
  const { grid, colors } = heroGrid(clsId, { ...cls.colors, ...(ev.colors || {}) });
  if (!shared) {
    try {
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      shared = { renderer };
    } catch (e) { return; }
  }
  const { renderer } = shared;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#ffffff', '#3a2a6a', 2.4));
  const sun = new THREE.DirectionalLight('#fff0d0', 2); sun.position.set(3, 5, 4); scene.add(sun);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  cam.position.set(0, 2.2, 7.5); cam.lookAt(0, 1.25, 0);
  const geo = voxelGeometry(grid, colors, { size: 0.14 * (1 + evo * 0.1), maxDepth: 7 });
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 0.25, 8), new THREE.MeshLambertMaterial({ color: '#3a3170', flatShading: true }));
  base.position.y = -0.13;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.05, 6, 32), new THREE.MeshBasicMaterial({ color: '#f0c35a' }));
  ring.rotation.x = Math.PI / 2;
  scene.add(mesh, base, ring);
  const ctx = canvas.getContext('2d');
  const W = canvas.clientWidth || 120, H = canvas.clientHeight || 130, dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = W * dpr; canvas.height = H * dpr;
  cam.aspect = W / H; cam.updateProjectionMatrix();
  let t0 = performance.now();
  const loop = now => {
    if (!canvas.isConnected) { geo.dispose(); return; }
    const t = (now - t0) / 1000;
    mesh.rotation.y = Math.sin(t * 0.9) * 0.9;
    mesh.position.y = Math.abs(Math.sin(t * 2.2)) * 0.08;
    renderer.setPixelRatio(dpr);
    renderer.setSize(W, H, false);
    renderer.render(scene, cam);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(renderer.domElement, 0, 0, canvas.width, canvas.height);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
