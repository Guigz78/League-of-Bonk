// Groupe d'instances : dessine rapidement beaucoup d'objets identiques (un seul appel GPU).
import * as THREE from '../../vendor/three.module.min.js';

export class Pool {
  constructor(scene, geo, mat, cap) {
    this.mesh = new THREE.InstancedMesh(geo, mat, cap);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.cap = cap; this.i = 0;
    this.d = new THREE.Object3D();
    this.c = new THREE.Color();
    scene.add(this.mesh);
  }
  begin() { this.i = 0; }
  add(x, y, z, ry = 0, s = 1, color = null, rx = 0, sy = null) {
    if (this.i >= this.cap) return;
    const d = this.d;
    d.position.set(x, y, z); d.rotation.set(rx, ry, 0);
    d.scale.set(s, sy ?? s, s);
    d.updateMatrix();
    this.mesh.setMatrixAt(this.i, d.matrix);
    if (color !== null) this.mesh.setColorAt(this.i, typeof color === 'number' ? this.c.setScalar(color) : this.c.set(color));
    this.i++;
  }
  addMatrix(m, color = null) {
    if (this.i >= this.cap) return;
    this.mesh.setMatrixAt(this.i, m);
    if (color !== null) this.mesh.setColorAt(this.i, typeof color === 'number' ? this.c.setScalar(color) : this.c.set(color));
    this.i++;
  }
  end() {
    this.mesh.count = this.i;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
