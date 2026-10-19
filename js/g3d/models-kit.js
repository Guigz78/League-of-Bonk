// Boîte à outils des personnages 3D low-poly : primitives à facettes, assembleur de géométrie
// (couleurs de sommets, lueur, paramètres d'animation par sommet) et matériau commun
// (Lambert à facettes + reflet de bord, flash blanc, gel, folie, lueur, animation des instances dans le shader).
// Tout est construit une seule fois : rien n'est alloué image par image.
import * as THREE from '../../vendor/three.module.min.js';
export { THREE };

export const S = 1 / 20; // 1 unité 3D = 20 px du jeu
export const PI = Math.PI, TAU = PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, k) => a + (b - a) * k;
export const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
export const smooth = k => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));
export const angDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
// angle au sol du jeu (0 = +x, π/2 = +y) → rotation Y d'un modèle qui regarde vers +Z
export const yawOf = a => PI / 2 - a;

const _c = new THREE.Color(), _c2 = new THREE.Color(), _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3();

// ---------- Couleurs ----------
export function shade(hex, k) { // k > 0 : vers le blanc, k < 0 : vers le noir
  _c.set(hex);
  if (k > 0) _c.lerp(_c2.set('#ffffff'), k); else _c.multiplyScalar(1 + k);
  return '#' + _c.getHexString();
}
export function mixC(a, b, k) { _c.set(a).lerp(_c2.set(b), k); return '#' + _c.getHexString(); }

// ---------- Primitives (unitaires, non indexées) ----------
const PRIM = new Map();
function roundBox(r, seg) { // boîte chanfreinée : aspect « jouet » à facettes
  const g = new THREE.BoxGeometry(1, 1, 1, seg, seg, seg), p = g.attributes.position, lim = 0.5 - r;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const cx = clamp(x, -lim, lim), cy = clamp(y, -lim, lim), cz = clamp(z, -lim, lim);
    _v.set(x - cx, y - cy, z - cz);
    if (_v.lengthSq() < 1e-9) continue;
    _v.normalize();
    p.setXYZ(i, cx + _v.x * r, cy + _v.y * r, cz + _v.z * r);
  }
  return g;
}
function wedge() { // prisme triangulaire (oreilles, dents, piquants plats) : arête en haut, base en bas
  const s = new THREE.Shape(); s.moveTo(-0.5, -0.5); s.lineTo(0.5, -0.5); s.lineTo(0, 0.5); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false }); g.translate(0, 0, -0.5);
  return g;
}
export function prim(key) {
  let g = PRIM.get(key);
  if (g) return g;
  const [k, a, b, c] = key.split(':'), A = +a, B = +b, C = +c;
  switch (k) {
    case 'box': g = new THREE.BoxGeometry(1, 1, 1); break;
    case 'rbox': g = roundBox(isNaN(A) ? 0.2 : A, 2); break;
    case 'sph': g = new THREE.SphereGeometry(0.5, A || 8, B || 6); break;
    case 'hemi': g = new THREE.SphereGeometry(0.5, A || 8, B || 4, 0, TAU, 0, PI / 2); break;
    case 'cone': g = new THREE.ConeGeometry(0.5, 1, A || 6); break;
    case 'cyl': g = new THREE.CylinderGeometry(0.5, 0.5, 1, A || 8); break;
    case 'frust': g = new THREE.CylinderGeometry(A, B, 1, C || 8); break;
    case 'tor': g = new THREE.TorusGeometry(0.5, A || 0.1, B || 4, C || 12); break;
    case 'arc': g = new THREE.TorusGeometry(0.5, A || 0.1, 4, C || 8, B || PI); break;
    case 'cap': g = new THREE.CapsuleGeometry(0.5, Math.max(0.01, A || 1), 2, B || 6); break;
    case 'oct': g = new THREE.OctahedronGeometry(0.5, 0); break;
    case 'ico': g = new THREE.IcosahedronGeometry(0.5, A || 0); break;
    case 'dod': g = new THREE.DodecahedronGeometry(0.5, 0); break;
    case 'tet': g = new THREE.TetrahedronGeometry(0.5, 0); break;
    case 'wedge': g = wedge(); break;
    default: throw new Error('primitive inconnue ' + key);
  }
  if (k === 'cap') { const s = 1 / (1 + Math.max(0.01, A || 1)); g.scale(1, s, 1); } // capsule de hauteur totale 1
  if (g.index) g = g.toNonIndexed();
  PRIM.set(key, g);
  return g;
}

// matrice de placement : position, rotation (XYZ), échelle
export function M(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  _e.set(rx, ry, rz); _q.setFromEuler(_e);
  return new THREE.Matrix4().compose(_v.set(x, y, z), _q, _s.set(sx, sy, sz));
}

// ---------- Assembleur ----------
// Chaque pièce ajoutée prend la « partie » courante : pivot + paramètres d'animation lus par le shader des monstres.
//  rx/rz/ry : amplitude de rotation (rad) autour du pivot, en sin(phase·f + off)
//  bob : > 0 → monte de bob·|sin| ; < 0 → soulève de −bob·max(0, sin) (pas)   sway : décalage latéral (x) en sin
//  body : 1 = suit le corps (rebond, roulis, écrasement de l'instance), 0 = jambes (restent au sol)
//  pose : [rx, rz, ry, lift] appliqués × poids de pose de l'instance (élan d'attaque, rugissement)
const NOPART = { px: 0, py: 0, pz: 0, rx: 0, rz: 0, ry: 0, off: 0, f: 1, bob: 0, sway: 0, body: 1, pose: [0, 0, 0, 0] };
export class Shape {
  constructor(anim = false) { this.anim = anim; this.P = []; this.C = []; this.A = []; this.B = []; this.Cc = []; this.D = []; this.cur = NOPART; this.tint = null; }
  part(pv, o = {}) {
    this.cur = pv ? { px: pv[0], py: pv[1], pz: pv[2], rx: o.rx || 0, rz: o.rz || 0, ry: o.ry || 0, off: o.off || 0, f: o.f ?? 1, bob: o.bob || 0, sway: o.sway || 0, body: o.body ?? 1, pose: o.pose || NOPART.pose } : NOPART;
    return this;
  }
  // ajoute une primitive : grad = assombrit le bas (volume), glow = émission (0..1+)
  add(key, color, m, o = {}) {
    const g = prim(key), P = g.attributes.position, grad = o.grad ?? 0.2, glow = o.glow || 0, cu = this.cur;
    _c.set(color);
    if (this.tint) _c.lerp(_c2.set(this.tint[0]), this.tint[1]);
    const v = new THREE.Vector3();
    for (let i = 0; i < P.count; i++) {
      v.set(P.getX(i), P.getY(i), P.getZ(i));
      const k = 1 - grad * (0.5 - clamp(v.y, -0.5, 0.5));
      v.applyMatrix4(m);
      this.P.push(v.x, v.y, v.z);
      this.C.push(_c.r * k, _c.g * k, _c.b * k);
      this.A.push(cu.px, cu.py, cu.pz, glow);
      if (this.anim) {
        this.B.push(cu.rx, cu.rz, cu.ry, cu.off);
        this.Cc.push(cu.f, cu.bob, cu.sway, cu.body);
        this.D.push(cu.pose[0], cu.pose[1], cu.pose[2], cu.pose[3]);
      }
    }
    return this;
  }
  // raccourci : primitive placée (x,y,z), mise à l'échelle (sx,sy,sz), tournée (rx,ry,rz)
  put(key, color, x, y, z, sx, sy = sx, sz = sx, rx = 0, ry = 0, rz = 0, o) { return this.add(key, color, M(x, y, z, rx, ry, rz, sx, sy, sz), o); }
  // pièce symétrique (x et -x, rotations ry/rz inversées)
  sym(key, color, x, y, z, sx, sy = sx, sz = sx, rx = 0, ry = 0, rz = 0, o) {
    this.put(key, color, x, y, z, sx, sy, sz, rx, ry, rz, o);
    return this.put(key, color, -x, y, z, sx, sy, sz, rx, -ry, -rz, o);
  }
  // segment épais entre deux points (os, bâtons, pattes)
  seg(key, color, a, b, w, d = w, o) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz) || 1e-4;
    _v.set(dx / L, dy / L, dz / L); _q.setFromUnitVectors(_s.set(0, 1, 0), _v);
    const m = new THREE.Matrix4().compose(_v.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), _q, _s.set(w, L, d));
    return this.add(key, color, m, o);
  }
  // œil de dessin animé tourné vers +z (ry pour l'orienter) : blanc, pupille, reflet
  eye(x, y, z, r, o = {}) {
    const { pupil = '#1a1020', white = '#ffffff', ry = 0, tall = 1.15, glow = 0, look = 0, pr = 0.62, flat = 0.55 } = o;
    const cy = Math.cos(ry), sy = Math.sin(ry), at = dz => [x + sy * dz, z + cy * dz];
    let [ax, az] = at(0);
    if (white) this.put('sph:8:6', white, ax, y, az, r * 2, r * 2 * tall, r * 2 * flat, 0, ry, 0, { grad: 0, glow: glow * 0.5 });
    [ax, az] = at(r * flat * 0.62);
    this.put('sph:6:4', pupil, ax + cy * look * r * 0.35, y - r * 0.06, az, r * 2 * pr, r * 2 * pr * tall, r * 0.5, 0, ry, 0, { grad: 0, glow });
    [ax, az] = at(r * flat * 0.9);
    if (!o.noHi) this.put('box', '#ffffff', ax - cy * r * 0.22, y + r * 0.3, az, r * 0.42, r * 0.42, r * 0.2, 0, ry, 0, { grad: 0, glow: 0.6 });
    return this;
  }
  get count() { return this.P.length / 3; }
  // géométrie finale ; off = pivot à soustraire (os d'une marionnette)
  geometry(off) {
    const g = new THREE.BufferGeometry(), P = new Float32Array(this.P);
    if (off) for (let i = 0; i < P.length; i += 3) { P[i] -= off[0]; P[i + 1] -= off[1]; P[i + 2] -= off[2]; }
    g.setAttribute('position', new THREE.BufferAttribute(P, 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.C), 3));
    const A = new Float32Array(this.A);
    if (off) for (let i = 0; i < A.length; i += 4) { A[i] -= off[0]; A[i + 1] -= off[1]; A[i + 2] -= off[2]; }
    g.setAttribute('aA', new THREE.BufferAttribute(A, 4));
    if (this.anim) {
      g.setAttribute('aB', new THREE.BufferAttribute(new Float32Array(this.B), 4));
      g.setAttribute('aC', new THREE.BufferAttribute(new Float32Array(this.Cc), 4));
      g.setAttribute('aD', new THREE.BufferAttribute(new Float32Array(this.D), 4));
    }
    g.computeBoundingSphere();
    return g;
  }
}

// ---------- Matériau commun ----------
// Lambert à facettes (flatShading) + couleurs de sommets ; en plus :
//  lueur par sommet (aA.w), reflet de bord (détache les personnages de l'herbe), flash blanc, gel, folie, transparence.
// LOB_ANIM (monstres instanciés) : chaque sommet est animé dans le shader à partir de la phase de marche de l'instance.
const VCOMMON = `#include <common>
attribute vec4 aA;
varying float vGlow;
varying vec4 vFx;
uniform vec4 uFx;
uniform float uGlow;
#ifdef LOB_ANIM
attribute vec4 aB; attribute vec4 aC; attribute vec4 aD; attribute vec4 iA; attribute vec4 iB;
uniform vec4 uBody;
vec3 lobRX(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(p.x, p.y * c - p.z * s, p.y * s + p.z * c); }
vec3 lobRZ(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(p.x * c - p.y * s, p.x * s + p.y * c, p.z); }
vec3 lobRY(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(p.x * c + p.z * s, p.y, -p.x * s + p.z * c); }
#endif`;
const VBEGIN = `vec3 transformed = vec3(position);
vGlow = aA.w * uGlow;
vFx = uFx;
#ifdef LOB_ANIM
{
  float ph = iA.x * aC.x + aB.w, sn = sin(ph), pw = iB.x;
  vec3 p = position - aA.xyz;
  p = lobRX(p, aB.x * sn + aD.x * pw);
  p = lobRZ(p, aB.y * sn + aD.y * pw);
  p = lobRY(p, aB.z * sn + aD.z * pw);
  p += aA.xyz;
  p.y += (aC.y >= 0.0 ? aC.y * abs(sn) : -aC.y * max(0.0, sn)) + aD.w * pw;
  p.x += aC.z * sn;
  if (aC.w > 0.5) {
    float b = iA.x, q = uBody.z * sin(b * 2.0);
    p.y *= 1.0 + q; p.xz *= 1.0 - q * 0.5;
    p.y += uBody.w > 0.5 ? uBody.x * (0.5 + 0.5 * sin(b)) : uBody.x * abs(sin(b));
    p = lobRZ(p, uBody.y * sin(b));
  }
  transformed = p;
  vGlow = aA.w * (1.0 + iA.w);
  vFx = vec4(iA.y, iB.y, iB.z, iA.z);
}
#endif`;
const FCOMMON = `#include <common>
varying float vGlow;
varying vec4 vFx;`;
const FCOLOR = `#include <color_fragment>
{
  vec3 c = diffuseColor.rgb;
  c = mix(c, c * vec3(0.55, 0.8, 1.15) + vec3(0.1, 0.22, 0.36), vFx.y * 0.85);
  c = mix(c, c * vec3(1.2, 0.5, 0.45) + vec3(0.12, 0.0, 0.0), vFx.z * 0.55);
  diffuseColor.rgb = mix(c, vec3(1.0), vFx.x * 0.55);
  diffuseColor.a *= vFx.w;
}`;
const FEMIS = `#include <emissivemap_fragment>
totalEmissiveRadiance += diffuseColor.rgb * vGlow + vec3(0.95, 0.95, 0.9) * vFx.x * 0.75 + vec3(0.25, 0.02, 0.0) * vFx.z * 0.35;`;
const FRIM = `{
  float lobR = 1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
  outgoingLight += diffuseColor.rgb * (lobR * lobR * lobR) * LOB_RIM;
}
#include <opaque_fragment>`;

export function charMaterial({ anim = false, alphaHash = false, rim = 0.55 } = {}) {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, alphaHash });
  const U = { uFx: { value: new THREE.Vector4(0, 0, 0, 1) }, uGlow: { value: 1 }, uBody: { value: new THREE.Vector4(0, 0, 0, 0) } };
  m.userData.U = U;
  m.defines = { LOB_RIM: rim.toFixed(3) };
  if (anim) m.defines.LOB_ANIM = '';
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', VCOMMON).replace('#include <begin_vertex>', VBEGIN);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', FCOMMON).replace('#include <color_fragment>', FCOLOR)
      .replace('#include <emissivemap_fragment>', FEMIS).replace('#include <opaque_fragment>', FRIM);
  };
  m.customProgramCacheKey = () => 'lobchar1';
  return m;
}

// ---------- Marionnette (héros, boss, familiers) ----------
// os : { nom: [parent, x, y, z] } (pivots dans l'espace du modèle, au repos). Chaque os reçoit un maillage
// fusionné de ses pièces (une seule géométrie par os, matériau partagé).
export class Rig {
  constructor(bones, mat) {
    this.mat = mat; this.root = new THREE.Group(); this.b = {}; this.piv = {}; this.mesh = {};
    for (const [n, [par, x, y, z]] of Object.entries(bones)) {
      const g = new THREE.Group(); g.name = n;
      const pp = par ? this.piv[par] : [0, 0, 0];
      g.position.set(x - pp[0], y - pp[1], z - pp[2]);
      this.piv[n] = [x, y, z]; this.b[n] = g;
      (par ? this.b[par] : this.root).add(g);
    }
  }
  // remplace les géométries des os (shapes : { os: Shape })
  setShapes(shapes) {
    for (const n in this.b) {
      const sh = shapes[n], old = this.mesh[n];
      if (old) { this.b[n].remove(old); old.geometry.dispose(); delete this.mesh[n]; }
      if (!sh || !sh.count) continue;
      const me = new THREE.Mesh(sh.geometry(this.piv[n]), this.mat);
      me.frustumCulled = false;
      this.b[n].add(me); this.mesh[n] = me;
    }
  }
  // remet tous les os au repos
  rest() {
    for (const n in this.b) { const g = this.b[n]; g.rotation.set(0, 0, 0); g.scale.set(1, 1, 1); }
  }
  dispose() { for (const n in this.mesh) this.mesh[n].geometry.dispose(); }
}
// un Shape par os, créés à la demande : sh('head').put(...)
export function shapeSet() {
  const o = {};
  return [o, n => o[n] || (o[n] = new Shape())];
}

// texture ronde douce (lueurs additives)
let glowT = null;
export function glowTex() {
  if (glowT) return glowT;
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  glowT = new THREE.CanvasTexture(cv); glowT.colorSpace = THREE.SRGBColorSpace;
  return glowT;
}
