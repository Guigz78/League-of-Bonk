// Personnages : héros, familier, monstres (instanciés par espèce) et ombres au sol.
// Lit l'état du jeu (run) et ne le modifie jamais.
import * as THREE from '../../vendor/three.module.min.js';
import { EVOLUTIONS, PETS } from '../data.js';
import { heroGrid } from '../art.js';
import { makeCreature } from '../pixel.js';
import { voxelGeometry } from '../voxel.js';
import { S } from '../world3d.js';
import { Pool } from './pool.js';

const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

export class Actors {
  constructor(gfx) {
    this.gfx = gfx;
    const run = gfx.run, scene = gfx.scene;
    this.run = run;
    this.scene = scene;
    this.vmat = new THREE.MeshLambertMaterial({ vertexColors: true });
    // héros
    this.heroMat = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: new THREE.Color('#000000') });
    this.evo = 0;
    this.hero = new THREE.Mesh(this.heroGeo(0), this.heroMat);
    scene.add(this.hero);
    // familier
    if (run.pet) {
      const pd = PETS[run.pet.id], cr = makeCreature('pet-' + run.pet.id, pd.body, pd.pal);
      this.petMesh = new THREE.Mesh(voxelGeometry(cr.grid, cr.colors, { size: 0.07, maxDepth: 4 }), this.vmat);
      scene.add(this.petMesh);
    }
    this.enemyPools = new Map();
    const shadowGeo = new THREE.CircleGeometry(1, 12); shadowGeo.rotateX(-Math.PI / 2);
    this.shadows = new Pool(scene, shadowGeo, new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.28, depthWrite: false }), 420);
  }

  heroGeo(evo) {
    const cls = this.run.cls;
    const ev = EVOLUTIONS[cls.id][evo];
    const { grid, colors } = heroGrid(cls.id, { ...cls.colors, ...(ev.colors || {}) });
    return voxelGeometry(grid, colors, { size: 0.14 * (1 + evo * 0.14), maxDepth: 7 });
  }

  // un groupe d'instances par espèce de monstre (créé à la première apparition)
  poolFor(e) {
    const key = e.def.name + (e.boss ? '!' : '');
    if (!this.enemyPools.has(key)) {
      const cr = makeCreature(`${this.run.zone.id}-${e.k}-${e.def.name}`, e.def.body, e.def.pal, { boss: e.boss });
      const pool = new Pool(this.scene, voxelGeometry(cr.grid, cr.colors, { size: 1, maxDepth: 6 }), this.vmat, e.boss ? 2 : 260);
      pool.mesh.setColorAt(0, new THREE.Color('#fff'));
      this.enemyPools.set(key, pool);
    }
    return this.enemyPools.get(key);
  }

  // view : { camX, camZ, camFx, camFz, camBack } (calculé par la caméra)
  update(dt, view) {
    const run = this.run, gfx = this.gfx, p = run.p, t = run.time;
    // évolution : nouveau modèle
    if (p.evo !== this.evo) {
      this.evo = p.evo;
      this.hero.geometry.dispose();
      this.hero.geometry = this.heroGeo(p.evo);
    }
    const px = p.x * S, pz = p.y * S, gy = gfx.gh(p.x, p.y), py = gy + p.h * S;
    const bob = p.moving && p.h === 0 ? Math.abs(Math.sin(t * 13)) * 0.12 : 0;
    this.hero.position.set(px, py + bob, pz);
    // le sprite voxel est vu de 3/4 : de profil, tourné vers la direction de course
    const sideX = p.face.x * Math.cos(run.yaw) - p.face.y * Math.sin(run.yaw);
    if (Math.abs(sideX) > 0.15) this.heroFlip = sideX < 0 ? -1 : 1;
    this.heroTurn = (this.heroTurn ?? 1) + ((this.heroFlip ?? 1) - (this.heroTurn ?? 1)) * Math.min(1, (dt || 0) * 12);
    this.hero.rotation.y = run.yaw + this.heroTurn * 0.75;
    this.hero.visible = !(p.inv > 0 && p.inv < 2.5 && !run.evoFlash && Math.floor(t * 20) % 2);
    this.heroMat.emissive.setRGB(run.hurtFlash * 3 + run.evoFlash * 0.8, run.evoFlash * 0.7, run.evoFlash * 0.2);
    const hs = 1 + Math.max(0, run.evoFlash - 0.6) * 0.8;
    this.hero.scale.set(hs * this.heroTurn, hs, hs);
    // familier
    if (this.petMesh) {
      const pt = run.pet;
      this.petMesh.position.set(pt.x * S, gfx.gh(pt.x, pt.y) + 0.6 + Math.abs(Math.sin(t * 9)) * 0.25, pt.y * S);
      this.petMesh.rotation.y = Math.atan2(p.x - pt.x, p.y - pt.y);
    }
    // monstres
    for (const pool of this.enemyPools.values()) pool.begin();
    this.shadows.begin();
    this.shadows.add(px, gy + 0.05, pz, 0, 0.9);
    const far = (run.SPAWN_R + 200) ** 2;
    for (const e of run.enemies) {
      if (e.dead || dist2(e, p) > far) continue;
      // les monstres entre l'objectif et le héros ne sont pas dessinés pour ne pas boucher la vue
      const rx = e.x * S - view.camX, rz = e.y * S - view.camZ;
      const along = rx * view.camFx + rz * view.camFz, lat = Math.abs(rx * -view.camFz + rz * view.camFx);
      if (along < 4.5 || (along < view.camBack - 0.6 && lat < 2 + e.scale * 0.25)) continue;
      const vs = e.scale * (e.boss ? 0.06 : 0.068);
      const egy = gfx.gh(e.x, e.y);
      const hop = e.fly ? e.fly * S + Math.sin(e.bob * 0.6) * 0.3 : Math.abs(Math.sin(e.bob)) * 0.06 * e.scale;
      const rise = Math.min(1, (t - e.born) / 0.45); // sort du sol à l'apparition
      const s = vs * (0.3 + rise * 0.7);
      this.poolFor(e).add(e.x * S, egy + hop + e.jumpH * S - (1 - rise) * 1.2, e.y * S, e.ang, s, e.flash > 0 ? 4 : e.freeze ? 1.7 : 1, 0, s * (e.flash > 0 ? 0.85 : 1));
      this.shadows.add(e.x * S, egy + 0.05, e.y * S, 0, e.r * S * 1.3);
    }
    for (const pool of this.enemyPools.values()) pool.end();
    this.shadows.end();
  }
}
