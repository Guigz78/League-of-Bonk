// Rendu 3D d'une partie : moteur WebGL, scène, caméra, et les sous-systèmes graphiques.
// Le jeu (run.js) ne connaît que : new Gfx(...), gfx.resize(), gfx.render(dt), gfx.dispose().
import * as THREE from '../../vendor/three.module.min.js';
import { buildWorld, S } from '../world3d.js';
import { Actors } from './actors.js';
import { Fx } from './fx.js';
import { Poi } from './poi.js';
import { Overlay } from './overlay.js';

export class Gfx {
  constructor(run, canvas3d, canvas2d) {
    this.run = run;
    this.renderer = new THREE.WebGLRenderer({ canvas: canvas3d, antialias: false, powerPreference: 'high-performance' });
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.3, 140);
    this.world = buildWorld(this.scene, run.zone);
    this.height = this.world.height;
    this.tv = new THREE.Vector3();
    this.actors = new Actors(this);
    this.fx = new Fx(this);
    this.poi = new Poi(this);
    this.overlay = new Overlay(this, canvas2d);
    this.view = { camX: 0, camZ: 0, camFx: 0, camFz: -1, camBack: 10 };
  }

  // hauteur du sol (unités 3D) à une position du jeu (pixels logiques)
  gh(x, y) { return this.height(x, y) * S; }

  resize() {
    const cv = this.overlay.cv;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const vw = cv.clientWidth, vh = cv.clientHeight;
    this.vw = vw; this.vh = vh;
    this.overlay.resize(vw, vh, dpr);
    this.renderer.setPixelRatio(Math.min(1.5, dpr));
    this.renderer.setSize(vw, vh, false);
    this.camera.aspect = vw / vh;
    this.camera.fov = vw / vh < 0.7 ? 68 : 55;
    this.camera.updateProjectionMatrix();
  }

  // caméra basse dans le dos du champion : on voit loin devant
  updateCamera(dt) {
    const run = this.run, p = run.p, cam = this.camera;
    const px = p.x * S, pz = p.y * S, gy = this.gh(p.x, p.y);
    const sy = Math.sin(run.yaw), cy = Math.cos(run.yaw);
    this.camY = (this.camY ?? gy) + (gy - (this.camY ?? gy)) * Math.min(1, (dt || 0.016) * 4); // lisse les marches du relief
    const zoomT = run.boss && !run.boss.dead ? 1.35 : 1;
    this.zoom = (this.zoom || 1) + (zoomT - (this.zoom || 1)) * Math.min(1, (dt || 0.016) * 1.5);
    const back = 10.5 * this.zoom, up = 7.2 * this.zoom;
    const cxp = px + sy * back, czp = pz + cy * back;
    let cyp = this.camY + up;
    const under = this.gh(cxp / S, czp / S) + 1.6; // ne jamais passer sous une colline
    if (cyp < under) cyp = under;
    const sh = run.shake ? (Math.random() - 0.5) * run.shake * 0.04 : 0;
    cam.position.set(cxp + sh, cyp + sh, czp);
    cam.lookAt(px - sy * 6, this.camY + 0.6, pz - cy * 6);
    Object.assign(this.view, { camX: cxp, camZ: czp, camFx: -sy, camFz: -cy, camBack: back });
  }

  render(dt) {
    // événements de jeu depuis la dernière image (coups, morts, sauts...) : à lire, jamais à modifier
    const events = this.run.events.splice(0);
    this.updateCamera(dt, events);
    this.actors.update(dt, this.view, events);
    this.fx.update(dt, events);
    this.poi.update(dt, events);
    this.world.update?.(dt, this.run, events);
    this.renderer.render(this.scene, this.camera);
    this.overlay.render(events);
  }

  dispose() {
    try {
      this.scene.traverse(o => { o.geometry?.dispose?.(); if (o.material) [].concat(o.material).forEach(m => m.dispose?.()); });
      this.renderer.dispose();
      this.renderer.forceContextLoss?.();
    } catch (e) { /* */ }
  }
}
