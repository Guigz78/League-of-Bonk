// Modèles provisoires (même API que js/g3d/models.js) : servent tant que les vrais personnages ne sont pas là.
import { THREE, Build, G, T, TAU, lowpoly, Pool, col, shade } from './kit.js';
import { CLASSES, EVOLUTIONS } from '../data.js';

// ---------- Héros ----------
export function heroModel(clsId, evo = 0) {
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  const mat = lowpoly().clone();
  let parts = {};
  const build = e => {
    for (const k in parts) { body.remove(parts[k]); parts[k].geometry.dispose(); }
    const C = { ...CLASSES[clsId].colors, ...(EVOLUTIONS[clsId][e]?.colors || {}) };
    const mk = f => { const b = new Build(7); f(b); const m = new THREE.Mesh(b.geo(), mat); body.add(m); return m; };
    parts = {
      legL: mk(b => b.add(G.box(0.32, 0.6, 0.34), C[2], T(0, -0.3, 0))),
      legR: mk(b => b.add(G.box(0.32, 0.6, 0.34), C[2], T(0, -0.3, 0))),
      torso: mk(b => {
        b.add(G.box(0.95, 0.85, 0.7), C[1], T(0, 1.05, 0));
        b.add(G.box(1.0, 0.16, 0.74), C.a, T(0, 0.7, 0));
        b.add(G.box(0.4, 0.4, 0.2), C.c || '#2f55b8', T(0, 1.1, 0.36));
        b.add(G.box(1.02, 0.95, 1.0), C.s, T(0, 1.95, 0));
        b.add(G.box(1.1, 0.35, 1.08), C.h, T(0, 2.45, -0.04));
        b.add(G.box(0.16, 0.24, 0.06), '#1a1030', T(0.22, 1.98, 0.5));
        b.add(G.box(0.16, 0.24, 0.06), '#1a1030', T(-0.22, 1.98, 0.5));
        b.add(G.box(0.07, 0.08, 0.07), '#ffffff', T(0.25, 2.04, 0.53));
        b.add(G.box(0.07, 0.08, 0.07), '#ffffff', T(-0.19, 2.04, 0.53));
        if (clsId === 'knight') b.add(G.box(0.5, 0.12, 0.08), C.h, T(0, 1.72, 0.5));
      }),
      armL: mk(b => b.add(G.box(0.26, 0.7, 0.28), C[1], T(0, -0.3, 0))),
      armR: mk(b => {
        b.add(G.box(0.26, 0.7, 0.28), C[1], T(0, -0.3, 0));
        if (clsId === 'knight') { b.add(G.box(0.14, 1.5, 0.08), '#e8eef8', T(0, -0.6, 0.75, 1, 1, 1, Math.PI / 2)); b.add(G.box(0.5, 0.1, 0.16), C.a, T(0, -0.6, 0.05)); }
        else if (clsId === 'archer') b.add(G.tor(0.6, 0.06, 4, 10, Math.PI), '#8a5a32', T(0, -0.6, 0.2, 1, 1, 1, 0, Math.PI / 2, Math.PI / 2));
        else { b.add(G.cyl(0.06, 0.06, 1.8, 5), '#8a5a32', T(0, -0.3, 0.2)); b.add(G.oct(0.22), '#ffe48a', T(0, 0.65, 0.2)); }
      }),
    };
    parts.legL.position.set(0.22, 0.6, 0); parts.legR.position.set(-0.22, 0.6, 0);
    parts.armL.position.set(0.6, 1.4, 0); parts.armR.position.set(-0.6, 1.4, 0);
    const s = 0.95 + e * 0.05; body.scale.setScalar(s);
  };
  build(evo);
  let face = 0;
  return {
    root,
    setEvo(e) { build(e); },
    update(dt, q) {
      const t = q.t, sw = q.moving ? Math.sin(t * 13) * 0.7 * (q.speed01 ?? 1) : 0;
      parts.legL.rotation.x = sw; parts.legR.rotation.x = -sw;
      parts.armL.rotation.x = -sw * 0.8; parts.armR.rotation.x = sw * 0.8 - (q.atk || 0) * 1.6;
      // regarde dans sa direction (le modèle tourne, jamais la caméra)
      const want = q.atk > 0.5 ? q.atkA : q.dirA;
      if (want != null) { let d = (Math.PI / 2 - want) - face; d = Math.atan2(Math.sin(d), Math.cos(d)); face += d * Math.min(1, dt * 14); }
      body.rotation.y = face;
      const br = 1 + Math.sin(t * 3) * 0.02;
      body.scale.y = body.scale.x * (q.air > 0 ? (q.vy > 0 ? 1.1 : 1.03) : br);
      mat.emissive.setScalar(q.hurt > 0 ? q.hurt * 0.8 : 0);
      body.visible = true;
      root.rotation.z = q.dead ? 1.3 : 0;
    },
    dispose() { for (const k in parts) parts[k].geometry.dispose(); mat.dispose(); },
  };
}

// ---------- Monstres (instanciés par type) ----------
const BODY_H = { blob: 1.1, humanoid: 1.6, golem: 1.7, beast: 1.2, bird: 1.2, crab: 0.9, ghost: 1.4, worm: 1.1 };
function monsterGeo(body) {
  const b = new Build(3), w = '#ffffff', d = '#b8b8c8';
  switch (body) {
    case 'blob': b.add(G.ico(0.75, 1), y => (y < 0.35 ? d : w), T(0, 0.62, 0, 1, 0.8, 1)); break;
    case 'humanoid':
      b.add(G.box(0.7, 0.7, 0.5), w, T(0, 0.75, 0)); b.add(G.box(0.8, 0.7, 0.7), w, T(0, 1.4, 0));
      b.add(G.cone(0.18, 0.5, 4), w, T(0.5, 1.5, 0, 1, 1, 1, 0, 0, -1.2)); b.add(G.cone(0.18, 0.5, 4), w, T(-0.5, 1.5, 0, 1, 1, 1, 0, 0, 1.2));
      b.add(G.box(0.22, 0.45, 0.25), d, T(0.2, 0.22, 0)); b.add(G.box(0.22, 0.45, 0.25), d, T(-0.2, 0.22, 0)); break;
    case 'golem': b.add(G.dode(0.75), w, T(0, 0.95, 0, 1.1, 1, 0.9), 0.1, 0.12); b.add(G.box(0.45, 0.6, 0.4), d, T(0.75, 0.7, 0)); b.add(G.box(0.45, 0.6, 0.4), d, T(-0.75, 0.7, 0)); break;
    case 'beast': b.add(G.box(1.3, 0.7, 0.7), w, T(0, 0.7, 0)); b.add(G.box(0.6, 0.55, 0.6), w, T(0.75, 0.95, 0)); for (const [x, z] of [[0.45, 0.25], [0.45, -0.25], [-0.45, 0.25], [-0.45, -0.25]]) b.add(G.box(0.2, 0.4, 0.2), d, T(x, 0.2, z)); break;
    case 'bird': b.add(G.ico(0.5, 0), w, T(0, 0.6, 0)); b.add(G.box(0.1, 0.06, 1.4), d, T(0, 0.7, 0)); b.add(G.cone(0.12, 0.35, 4), '#ffc84a', T(0.55, 0.6, 0, 1, 1, 1, 0, 0, -Math.PI / 2)); break;
    case 'crab': b.add(G.cyl(0.6, 0.7, 0.4, 7), w, T(0, 0.45, 0)); b.add(G.box(0.35, 0.3, 0.3), d, T(0.5, 0.5, 0.6)); b.add(G.box(0.35, 0.3, 0.3), d, T(0.5, 0.5, -0.6)); break;
    case 'ghost': b.add(G.cone(0.65, 1.4, 7), w, T(0, 0.75, 0, 1, 1, 1, Math.PI)); b.add(G.sph(0.6, 7, 5), w, T(0, 1.3, 0)); break;
    case 'worm': for (let i = 0; i < 4; i++) b.add(G.ico(0.42 - i * 0.05, 0), i ? d : w, T(0.3 - i * 0.45, 0.4 + Math.sin(i) * 0.1, 0)); break;
    default: b.add(G.box(1, 1, 1), w, T(0, 0.5, 0));
  }
  return b.geo();
}
function faceGeo(body) {
  const b = new Build(5), h = { blob: 0.75, humanoid: 1.45, golem: 1.05, beast: 1.0, bird: 0.7, crab: 0.6, ghost: 1.3, worm: 0.5 }[body] || 0.8;
  const fx = { blob: 0.62, humanoid: 0.36, golem: 0.62, beast: 1.06, bird: 0.42, crab: 0.55, ghost: 0.5, worm: 0.68 }[body] || 0.5;
  for (const s of [-1, 1]) { b.add(G.box(0.08, 0.2, 0.16), '#ffffff', T(fx, h, s * 0.16)); b.add(G.box(0.09, 0.12, 0.08), '#1a1030', T(fx + 0.02, h - 0.02, s * 0.16)); }
  return b.geo();
}
export class MonsterPool {
  constructor(scene, def, variant = 'n', max = 120) {
    this.def = def; this.v = variant;
    const mat = lowpoly();
    this.body = new Pool(scene, monsterGeo(def.body), mat, max, { color: true });
    this.face = new Pool(scene, faceGeo(def.body), mat, max);
    this.c0 = col(def.pal[0]); this.c1 = col(variant === 'b' ? shade(def.pal[0], 0.1) : def.pal[0]);
    this.tmp = new THREE.Color();
    this.h = BODY_H[def.body] || 1;
  }
  begin() { this.body.begin(); this.face.begin(); }
  add(e, s) {
    const k = s.scale * (this.v === 'e' ? 1 : 1), sq = s.sq || 0;
    const sx = k * (1 + sq * 0.15), sy = k * (1 - sq * 0.12) * (1 + Math.abs(Math.sin(s.anim || 0)) * 0.06);
    const yaw = -s.rot;
    const i = this.body.put(s.x, s.y, s.z, yaw, sx, sy, sx);
    const c = this.tmp.copy(this.c1);
    if (s.mad) c.lerp(col('#ff3a2a'), 0.35);
    if (s.freeze) c.lerp(col('#bfeaff'), 0.6);
    if (s.flash > 0) c.lerp(col('#ffffff'), Math.min(1, s.flash * 1.6));
    this.body.tint(i, c);
    this.face.put(s.x, s.y, s.z, yaw, sx, sy, sx);
  }
  end() { this.body.end(); this.face.end(); }
  dispose() { this.body.dispose(); this.face.dispose(); this.body.mesh.geometry.dispose(); this.face.mesh.geometry.dispose(); }
}

// ---------- Familier ----------
export function petModel(petId, def) {
  const root = new THREE.Group(), b = new Build(9);
  const pal = def?.pal || ['#f2f2f2', '#b9c3cf', '#ffffff'];
  b.add(G.ico(0.42, 1), pal[0], T(0, 0.45, 0, 1, 0.85, 1));
  for (const s of [-1, 1]) { b.add(G.box(0.08, 0.14, 0.1), '#1a1030', T(0.36, 0.55, s * 0.13)); b.add(G.cone(0.1, 0.25, 4), pal[1], T(0, 0.85, s * 0.2)); }
  const m = new THREE.Mesh(b.geo(), lowpoly());
  root.add(m);
  let face = 0;
  return {
    root,
    update(dt, q) {
      const hop = Math.abs(Math.sin(q.t * 7)) * 0.18;
      m.position.y = hop; m.scale.set(1, 1 + Math.sin(q.t * 14) * 0.04, 1);
      if (q.dirA != null) { let d = (-q.dirA) - face; d = Math.atan2(Math.sin(d), Math.cos(d)); face += d * Math.min(1, dt * 8); }
      m.rotation.y = face;
    },
    dispose() { m.geometry.dispose(); },
  };
}
export const STANDIN = true;
