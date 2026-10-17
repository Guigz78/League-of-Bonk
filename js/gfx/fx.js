// Effets : objets au sol (gemmes, or, cœurs), tirs, particules, anneaux, rayons, coups d'épée, éclairs, aura.
// Lit l'état du jeu (run) et ne le modifie jamais.
import * as THREE from '../../vendor/three.module.min.js';
import { S } from '../world3d.js';
import { Pool } from './pool.js';

const TAU = Math.PI * 2;
const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

export class Fx {
  constructor(gfx) {
    this.gfx = gfx;
    this.run = gfx.run;
    const scene = gfx.scene;
    // objets au sol
    const gemGeo = new THREE.OctahedronGeometry(0.28, 0); gemGeo.scale(0.8, 1.2, 0.8);
    this.gems = new Pool(scene, gemGeo, new THREE.MeshBasicMaterial({ color: '#ffffff' }), 900);
    this.gems.mesh.setColorAt(0, new THREE.Color('#fff'));
    const coinGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.08, 10); coinGeo.rotateX(Math.PI / 2);
    this.coins = new Pool(scene, coinGeo, new THREE.MeshLambertMaterial({ color: '#ffc83a', emissive: '#6a4a00' }), 200);
    this.hearts = new Pool(scene, new THREE.OctahedronGeometry(0.4, 0), new THREE.MeshLambertMaterial({ color: '#ff4a6a', emissive: '#6a0010' }), 40);
    this.magnets = new Pool(scene, new THREE.TorusGeometry(0.35, 0.1, 6, 12), new THREE.MeshLambertMaterial({ color: '#4fa8ff', emissive: '#002a6a' }), 10);
    // tirs
    const unlit = c => new THREE.MeshBasicMaterial({ color: c });
    this.pArrow = new Pool(scene, new THREE.BoxGeometry(0.9, 0.12, 0.12), unlit('#f0e0c0'), 300);
    this.pDagger = new Pool(scene, new THREE.BoxGeometry(0.6, 0.1, 0.22), unlit('#e8eef8'), 300);
    this.pBall = new Pool(scene, new THREE.SphereGeometry(0.22, 8, 6), unlit('#d0a0ff'), 120);
    this.pSnow = new Pool(scene, new THREE.SphereGeometry(0.45, 10, 8), new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#4a5a6a' }), 30);
    this.pBoom = new Pool(scene, new THREE.BoxGeometry(1.4, 0.12, 0.3), unlit('#f4f0e0'), 20);
    this.pBoom2 = new Pool(scene, new THREE.BoxGeometry(0.3, 0.12, 1.4), unlit('#e6b422'), 20);
    this.pCrystal = new Pool(scene, new THREE.OctahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ color: '#9ad8ff', transparent: true, opacity: 0.85 }), 4);
    this.pEnemyShot = new Pool(scene, new THREE.SphereGeometry(0.3, 8, 6), unlit('#ff3a5a'), 200);
    this.pOrb = new Pool(scene, new THREE.SphereGeometry(0.38, 10, 8), unlit('#e0c0ff'), 10);
    this.pShroom = new Pool(scene, new THREE.SphereGeometry(0.45, 8, 6, 0, TAU, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#ffffff' }), 20);
    this.pShroom.mesh.setColorAt(0, new THREE.Color('#fff'));
    // particules
    this.pPart = new Pool(scene, new THREE.BoxGeometry(0.16, 0.16, 0.16), new THREE.MeshBasicMaterial({ color: '#ffffff' }), 700);
    this.pPart.mesh.setColorAt(0, new THREE.Color('#fff'));
    // effets au sol
    const ringGeo = new THREE.RingGeometry(0.9, 1, 40); ringGeo.rotateX(-Math.PI / 2);
    this.pRing = new Pool(scene, ringGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }), 40);
    this.pRing.mesh.setColorAt(0, new THREE.Color('#fff'));
    const discGeo = new THREE.CircleGeometry(1, 32); discGeo.rotateX(-Math.PI / 2);
    this.aura = new THREE.Mesh(discGeo, new THREE.MeshBasicMaterial({ color: '#ffaa3a', transparent: true, opacity: 0.22, depthWrite: false }));
    this.aura.visible = false; scene.add(this.aura);
    this.pBeam = new Pool(scene, new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: '#fff6c0', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }), 8);
    const slashGeo = new THREE.RingGeometry(0.6, 1, 20, 1, -1.2, 2.4); slashGeo.rotateX(-Math.PI / 2);
    this.pSlash = new Pool(scene, slashGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }), 6);
    this.pBolt = new Pool(scene, new THREE.CylinderGeometry(0.14, 0.14, 1, 4), new THREE.MeshBasicMaterial({ color: '#fff7a0', blending: THREE.AdditiveBlending, transparent: true }), 16);
    this.pools = [this.pArrow, this.pDagger, this.pBall, this.pSnow, this.pBoom, this.pBoom2, this.pCrystal, this.pEnemyShot, this.pOrb, this.pShroom, this.pPart, this.pRing, this.pBeam, this.pSlash, this.pBolt];
  }

  update(dt) {
    const run = this.run, gfx = this.gfx, p = run.p, t = run.time;
    const gh = (x, y) => gfx.gh(x, y);
    // objets au sol
    this.gems.begin(); this.coins.begin(); this.hearts.begin(); this.magnets.begin();
    for (const it of run.pickups) {
      if (dist2(it, p) > 900 * 900) continue;
      const y = gh(it.x, it.y) + 0.45 + Math.sin(t * 4 + it.x) * 0.1;
      if (it.type === 'xp') this.gems.add(it.x * S, y, it.y * S, t * 3 + (it.spin || 0), it.v >= 15 ? 1.6 : it.v >= 3 ? 1.2 : 1, it.v >= 15 ? '#ff5a8a' : it.v >= 3 ? '#5ae87a' : '#4fc8ff');
      else if (it.type === 'gold') this.coins.add(it.x * S, y, it.y * S, t * 4);
      else if (it.type === 'heart') this.hearts.add(it.x * S, y + 0.2, it.y * S, t * 2);
      else if (it.type === 'magnet') this.magnets.add(it.x * S, y + 0.2, it.y * S, t * 2);
    }
    this.gems.end(); this.coins.end(); this.hearts.end(); this.magnets.end();
    // tirs et effets
    for (const pl of this.pools) pl.begin();
    for (const s of run.shots) {
      const y = gh(s.x, s.y) + (s.z || 26) * S;
      const a = Math.atan2(-s.vy, s.vx);
      if (s.type === 'arrow') this.pArrow.add(s.x * S, y, s.y * S, a);
      else if (s.type === 'dagger') this.pDagger.add(s.x * S, y, s.y * S, a);
      else if (s.type === 'boom') { this.pBoom.add(s.x * S, y, s.y * S, s.spin, s.r / 15); this.pBoom2.add(s.x * S, y, s.y * S, s.spin, s.r / 15); }
      else if (s.type === 'snow') this.pSnow.add(s.x * S, gh(s.x, s.y) + s.z * S, s.y * S);
      else if (s.type === 'crystal') this.pCrystal.add(s.x * S, y + 0.5, s.y * S, a, 1.6, null, 0, 1.6);
      else this.pBall.add(s.x * S, y, s.y * S);
    }
    for (const s of run.eshots) this.pEnemyShot.add(s.x * S, gh(s.x, s.y) + s.z * S, s.y * S, 0, s.r / 9);
    for (const w of p.weapons) if (w.orbs && w.id === 'orbs') for (const [ox, oy] of w.orbs) this.pOrb.add(ox * S, gh(ox, oy) + 1.2, oy * S);
    for (const m of run.mines) this.pShroom.add(m.x * S, gh(m.x, m.y), m.y * S, 0, 1, m.arm > 0 ? '#8aa86a' : '#e04a4a');
    for (const q of run.parts) this.pPart.add(q.x * S, gh(q.x, q.y) + q.z * S, q.y * S, q.life * 8, q.s * Math.min(1, q.life * 2), q.c);
    for (const f of run.fx) {
      const k = f.life / f.max, fgy = gh(f.x, f.y);
      if (f.type === 'ring') this.pRing.add(f.x * S, fgy + 0.15, f.y * S, 0, f.r * S * (1 - k * 0.75), f.color);
      else if (f.type === 'beam') {
        const cx2 = Math.cos(f.a), cy2 = Math.sin(f.a), mx = f.x + cx2 * f.len / 2, my = f.y + cy2 * f.len / 2;
        const d = this.pBeam.d;
        d.position.set(mx * S, fgy + 1.3, my * S); d.rotation.set(0, Math.atan2(-cy2, cx2), 0);
        d.scale.set(f.len * S, Math.max(0.05, f.w * S * k), Math.max(0.05, f.w * S * k)); d.updateMatrix();
        this.pBeam.addMatrix(d.matrix);
      } else if (f.type === 'slash') this.pSlash.add(f.x * S, fgy + 1, f.y * S, Math.atan2(-Math.sin(f.a), Math.cos(f.a)) + (1 - k) * 1.5 - 0.75, f.r * S);
      else if (f.type === 'bolt') this.pBolt.add(f.x * S, fgy + 6, f.y * S, 0, k * 1.5 + 0.5, null, 0, 12);
    }
    for (const w of run.waves) this.pRing.add(w.x * S, gh(w.x, w.y) + 0.2, w.y * S, 0, w.r * S, '#ff5a3a');
    for (const pl of this.pools) pl.end();
    // aura
    const aura = p.weapons.find(w => w.id === 'aura');
    this.aura.visible = !!aura?.R;
    if (aura?.R) { this.aura.position.set(p.x * S, gh(p.x, p.y) + 0.12, p.y * S); this.aura.scale.setScalar(aura.R * S); }
  }
}
