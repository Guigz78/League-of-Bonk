// Points d'intérêt : coffres (du monde et des élites) et autels.
// Lit l'état du jeu (run) et ne le modifie jamais.
import * as THREE from '../../vendor/three.module.min.js';
import { S } from '../world3d.js';

const TAU = Math.PI * 2;

export class Poi {
  constructor(gfx) {
    this.gfx = gfx;
    this.run = gfx.run;
    this.scene = gfx.scene;
    this.meshes = new Map(); // objet du jeu (coffre/autel) -> mesh
    this.usedGemMat = new THREE.MeshBasicMaterial({ color: '#555566' });
  }

  makeChestMesh() {
    const g = new THREE.Group();
    const wood = new THREE.MeshLambertMaterial({ color: '#a0602a' }), gold = new THREE.MeshLambertMaterial({ color: '#ffc83a', emissive: '#5a3a00' });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 0.9), wood); body.position.y = 0.4;
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.35, 0.95), wood); lid.position.y = 0.95;
    const band = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 1), gold); band.position.y = 0.78;
    const lock = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.35, 0.1), gold); lock.position.set(0, 0.7, 0.48);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 14, 8, 1, true), new THREE.MeshBasicMaterial({ color: '#ffd54a', transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }));
    beam.position.y = 7;
    g.add(body, lid, band, lock, beam);
    g.userData = { lid, beam };
    return g;
  }

  makeShrineMesh() {
    const g = new THREE.Group();
    const stone = new THREE.MeshLambertMaterial({ color: '#8a8aa8', flatShading: true });
    for (let i = 0; i < 4; i++) {
      const a = i / 4 * TAU + 0.4;
      const pil = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.2, 0.5), stone);
      pil.position.set(Math.cos(a) * 2.4, 1.1, Math.sin(a) * 2.4);
      g.add(pil);
    }
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.6, 0), new THREE.MeshBasicMaterial({ color: '#4fd0ff' }));
    gem.position.y = 2.2;
    const disc = new THREE.Mesh(new THREE.RingGeometry(2.6, 3, 32), new THREE.MeshBasicMaterial({ color: '#4fd0ff', transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
    disc.rotation.x = -Math.PI / 2; disc.position.y = 0.1;
    const fill = new THREE.Mesh(new THREE.CircleGeometry(2.6, 32), new THREE.MeshBasicMaterial({ color: '#4fd0ff', transparent: true, opacity: 0.3, side: THREE.DoubleSide }));
    fill.rotation.x = -Math.PI / 2; fill.position.y = 0.08; fill.scale.setScalar(0.01);
    g.add(gem, disc, fill);
    g.userData = { gem, fill, disc };
    return g;
  }

  meshFor(obj, kind) {
    let m = this.meshes.get(obj);
    if (!m) {
      m = kind === 'shrine' ? this.makeShrineMesh() : this.makeChestMesh();
      m.position.set(obj.x * S, this.gfx.gh(obj.x, obj.y), obj.y * S);
      this.scene.add(m);
      this.meshes.set(obj, m);
    }
    return m;
  }

  update(dt) {
    const run = this.run, t = run.time;
    for (const c of run.chests.concat(run.dropChests)) {
      const m = this.meshFor(c, 'chest'), u = m.userData;
      if (!c.open) { u.beam.material.opacity = 0.12 + Math.sin(t * 3) * 0.06; m.rotation.y = Math.sin(t) * 0.15; }
      else if (u.beam.visible) { u.lid.rotation.x = -1.2; u.lid.position.z = -0.35; u.beam.visible = false; }
    }
    for (const s of run.shrines) {
      const u = this.meshFor(s, 'shrine').userData;
      u.gem.rotation.y = t * 2; u.gem.position.y = 2.2 + Math.sin(t * 2 + s.x) * 0.2;
      u.fill.scale.setScalar(Math.max(0.01, s.charge));
      if (s.used && u.disc.visible) { u.gem.material = this.usedGemMat; u.disc.visible = false; u.fill.visible = false; }
    }
  }
}
