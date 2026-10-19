// Boîte à outils du rendu 3D : formes low-poly à couleurs par sommet (fusionnées en une géométrie),
// groupes d'instances sans allocation par image, textures générées, matériaux d'effets.
import * as THREE from '../../vendor/three.module.min.js';
export { THREE };

export const S = 1 / 20;             // 1 pixel du jeu = 1/20 d'unité 3D (x → X, y → Z)
export const TAU = Math.PI * 2;
export const PITCH = 0.94;           // inclinaison fixe de la caméra (≈ 54° vers le bas), jamais de rotation
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const rand = (a, b) => a + Math.random() * (b - a);
export const easeOut = t => 1 - (1 - t) ** 3;
export const backOut = t => { const c = 2.2; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; };

// couleurs (converties une fois en linéaire, comme les attend three.js)
const colCache = new Map();
export function col(hex) {
  let c = colCache.get(hex);
  if (!c) { c = new THREE.Color(hex); colCache.set(hex, c); }
  return c;
}
export function shade(hex, k) { // k > 0 éclaircit, k < 0 assombrit (couleur CSS en sortie)
  const n = parseInt(hex.slice(1), 16), f = v => Math.round(clamp(k > 0 ? v + (255 - v) * k : v * (1 + k), 0, 255));
  return '#' + ((1 << 24) | (f((n >> 16) & 255) << 16) | (f((n >> 8) & 255) << 8) | f(n & 255)).toString(16).slice(1);
}
export function mix(a, b, k) {
  const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16), f = s => Math.round(((A >> s) & 255) * (1 - k) + ((B >> s) & 255) * k);
  return '#' + ((1 << 24) | (f(16) << 16) | (f(8) << 8) | f(0)).toString(16).slice(1);
}

// ---------- Construction de modèles low-poly ----------
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
export function T(x = 0, y = 0, z = 0, sx = 1, sy = sx, sz = sx, rx = 0, ry = 0, rz = 0) {
  return new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
}
export const G = {
  box: (w = 1, h = 1, d = 1) => new THREE.BoxGeometry(w, h, d),
  cyl: (rt = 0.5, rb = 0.5, h = 1, n = 6, hs = 1, open = false, ts = 0, tl = TAU) => new THREE.CylinderGeometry(rt, rb, h, n, hs, open, ts, tl),
  cone: (r = 0.5, h = 1, n = 6) => new THREE.ConeGeometry(r, h, n),
  ico: (r = 0.5, d = 0) => new THREE.IcosahedronGeometry(r, d),
  dode: (r = 0.5) => new THREE.DodecahedronGeometry(r, 0),
  oct: (r = 0.5) => new THREE.OctahedronGeometry(r, 0),
  tet: (r = 0.5) => new THREE.TetrahedronGeometry(r, 0),
  sph: (r = 0.5, w = 7, h = 5) => new THREE.SphereGeometry(r, w, h),
  tor: (r = 0.5, t = 0.15, rs = 5, ts = 8, arc = TAU) => new THREE.TorusGeometry(r, t, rs, ts, arc),
  plane: (w = 1, h = 1) => new THREE.PlaneGeometry(w, h),
};

// Accumule des triangles colorés (non indexés : facettes nettes) puis produit une BufferGeometry.
export class Build {
  constructor(seed = 1) { this.pos = []; this.col = []; this.r = seed; }
  rnd() { this.r = (this.r * 16807) % 2147483647; return this.r / 2147483647; }
  // g : géométrie three, c : couleur CSS (ou fonction (x, y, z) → CSS), m : matrice, vary : nuance par facette,
  // jit : bosselage (rochers, feuillage) appliqué selon la position (les sommets partagés restent soudés)
  add(g, c, m = null, vary = 0.07, jit = 0) {
    const gi = g.index ? g.toNonIndexed() : g;
    if (jit) {
      const P = gi.attributes.position.array;
      for (let i = 0; i < P.length; i += 3) {
        const h = Math.sin(P[i] * 12.9898 + P[i + 1] * 78.233 + P[i + 2] * 37.719) * 43758.5453, k = (h - Math.floor(h) - 0.5) * 2 * jit;
        const h2 = Math.sin(P[i] * 93.9898 + P[i + 1] * 67.345 + P[i + 2] * 12.345) * 24634.6345, k2 = (h2 - Math.floor(h2) - 0.5) * 2 * jit;
        P[i] *= 1 + k; P[i + 1] *= 1 + k2 * 0.7; P[i + 2] *= 1 - k * 0.6 + k2 * 0.4;
      }
    }
    if (m) gi.applyMatrix4(m);
    const P = gi.attributes.position.array, fn = typeof c === 'function';
    let base = fn ? null : col(c);
    for (let i = 0; i < P.length; i += 9) {
      if (fn) base = col(c((P[i] + P[i + 3] + P[i + 6]) / 3, (P[i + 1] + P[i + 4] + P[i + 7]) / 3, (P[i + 2] + P[i + 5] + P[i + 8]) / 3));
      const v = 1 + (this.rnd() - 0.5) * 2 * vary;
      for (let k = 0; k < 9; k += 3) { this.pos.push(P[i + k], P[i + k + 1], P[i + k + 2]); this.col.push(base.r * v, base.g * v, base.b * v); }
    }
    if (gi !== g) gi.dispose();
    g.dispose();
    return this;
  }
  geo() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }
}

// matériau des modèles du décor : ombrage plat, couleurs par sommet
let lowMat = null;
export function lowpoly() { return lowMat || (lowMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })); }

// ---------- Groupes d'instances ----------
// begin() / put() / end() à chaque image, sans allocation. put() renvoie l'indice (ou -1 si plein).
export class Pool {
  constructor(parent, geo, mat, cap, { color = false, alpha = false, order = 0 } = {}) {
    if (alpha) { geo = geo.clone(); this.aA = new THREE.InstancedBufferAttribute(new Float32Array(cap).fill(1), 1); this.aA.setUsage(THREE.DynamicDrawUsage); geo.setAttribute('aA', this.aA); }
    const m = this.mesh = new THREE.InstancedMesh(geo, mat, cap);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false; m.count = 0; m.visible = false; m.renderOrder = order;
    if (color) { m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3); m.instanceColor.setUsage(THREE.DynamicDrawUsage); }
    this.M = m.instanceMatrix.array; this.C = color ? m.instanceColor.array : null; this.A = alpha ? this.aA.array : null;
    this.cap = cap; this.n = 0; this.ownGeo = alpha;
    parent.add(m);
  }
  begin() { this.n = 0; }
  // position, rotation autour de la verticale (yaw), échelle
  put(x, y, z, yaw = 0, sx = 1, sy = sx, sz = sx) {
    if (this.n >= this.cap) return -1;
    const i = this.n++, o = i * 16, M = this.M, c = Math.cos(yaw), s = Math.sin(yaw);
    M[o] = c * sx; M[o + 1] = 0; M[o + 2] = -s * sx; M[o + 3] = 0;
    M[o + 4] = 0; M[o + 5] = sy; M[o + 6] = 0; M[o + 7] = 0;
    M[o + 8] = s * sz; M[o + 9] = 0; M[o + 10] = c * sz; M[o + 11] = 0;
    M[o + 12] = x; M[o + 13] = y; M[o + 14] = z; M[o + 15] = 1;
    if (this.A) this.A[i] = 1;
    return i;
  }
  // matrice quelconque (12 premiers termes de la matrice 4×4, colonne par colonne)
  putM(e) {
    if (this.n >= this.cap) return -1;
    const i = this.n++, o = i * 16, M = this.M;
    for (let k = 0; k < 16; k++) M[o + k] = e[k];
    if (this.A) this.A[i] = 1;
    return i;
  }
  // base libre : axes X (ax), Y (ay), Z (az) déjà mis à l'échelle, et position
  putB(x, y, z, ax, ay, az, bx, by, bz, cx, cy, cz) {
    if (this.n >= this.cap) return -1;
    const i = this.n++, o = i * 16, M = this.M;
    M[o] = ax; M[o + 1] = ay; M[o + 2] = az; M[o + 3] = 0;
    M[o + 4] = bx; M[o + 5] = by; M[o + 6] = bz; M[o + 7] = 0;
    M[o + 8] = cx; M[o + 9] = cy; M[o + 10] = cz; M[o + 11] = 0;
    M[o + 12] = x; M[o + 13] = y; M[o + 14] = z; M[o + 15] = 1;
    if (this.A) this.A[i] = 1;
    return i;
  }
  rgb(i, r, g, b) { if (i < 0 || !this.C) return; const o = i * 3; this.C[o] = r; this.C[o + 1] = g; this.C[o + 2] = b; }
  tint(i, c, k = 1) { if (i < 0 || !this.C) return; const o = i * 3; this.C[o] = c.r * k; this.C[o + 1] = c.g * k; this.C[o + 2] = c.b * k; }
  alpha(i, a) { if (i >= 0 && this.A) this.A[i] = a; }
  end() {
    const m = this.mesh, n = this.n;
    m.count = n; m.visible = n > 0;
    if (!n) return;
    m.instanceMatrix.clearUpdateRanges(); m.instanceMatrix.addUpdateRange(0, n * 16); m.instanceMatrix.needsUpdate = true;
    if (this.C) { m.instanceColor.clearUpdateRanges(); m.instanceColor.addUpdateRange(0, n * 3); m.instanceColor.needsUpdate = true; }
    if (this.A) { this.aA.clearUpdateRanges(); this.aA.addUpdateRange(0, n); this.aA.needsUpdate = true; }
  }
  dispose() { this.mesh.parent?.remove(this.mesh); if (this.ownGeo) this.mesh.geometry.dispose(); this.mesh.dispose(); }
}

// ---------- Matériaux d'effets ----------
// MeshBasic avec transparence par instance (attribut aA)
export function alphaMat(o = {}) {
  const m = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, fog: false, ...o });
  m.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aA;\nvarying float vA;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvA = aA;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vA;').replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a *= vA;');
  };
  m.customProgramCacheKey = () => 'alphaMat';
  return m;
}
export const ADD = THREE.AdditiveBlending;

// Formes au sol dessinées par le shader (anneaux, disques, arcs, pointillés) : un seul appel pour toutes.
// Par instance : couleur, aA (opacité), aP = (remplissage, épaisseur du bord, arc 0..1, nb de tirets),
// aQ = (cœur blanc, vitesse des tirets, rayon intérieur du remplissage, douceur)
const RING_VS = `
attribute float aA; attribute vec4 aP; attribute vec4 aQ;
varying vec2 vUv; varying float vA; varying vec4 vP; varying vec4 vQ; varying vec3 vC;
void main() {
  vUv = uv; vA = aA; vP = aP; vQ = aQ;
  #ifdef USE_INSTANCING_COLOR
  vC = instanceColor;
  #else
  vC = vec3(1.0);
  #endif
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}`;
const RING_FS = `
uniform float uT;
varying vec2 vUv; varying float vA; varying vec4 vP; varying vec4 vQ; varying vec3 vC;
void main() {
  vec2 q = vUv * 2.0 - 1.0; q.y = -q.y;
  float d = length(q);
  if (d > 1.0) discard;
  float aa = max(fwidth(d) * 1.2, 0.004) + vQ.w;
  float a01 = fract(atan(q.y, q.x) / 6.2831853 + 1.0);
  float arc = vP.z >= 0.999 ? 1.0 : (1.0 - smoothstep(vP.z - 0.004, vP.z, a01));
  float w = vP.y, inner = 1.0 - w;
  float band = smoothstep(inner - aa, inner, d) * (1.0 - smoothstep(1.0 - aa, 1.0, d));
  float dash = vP.w > 0.5 ? step(0.45, fract(a01 * vP.w + uT * vQ.y)) : 1.0;
  float fill = vP.x * smoothstep(vQ.z - aa, vQ.z, d) * (1.0 - smoothstep(inner - aa, inner, d));
  float mid = 1.0 - abs((d - (inner + w * 0.5)) / max(w * 0.5, 0.001));
  vec3 c = mix(vC, vec3(1.0), clamp(vQ.x * mid * mid, 0.0, 1.0) * band);
  float a = (band * dash + fill) * arc * vA;
  if (a < 0.003) discard;
  gl_FragColor = vec4(c, a);
}`;
export function ringMat(blending = THREE.NormalBlending) {
  return new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 } }, vertexShader: RING_VS, fragmentShader: RING_FS,
    transparent: true, depthWrite: false, blending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
}
// pool de formes au sol (plan horizontal unité, rayon 1)
export class RingPool extends Pool {
  constructor(parent, cap, blending, order = 1) {
    const g = new THREE.PlaneGeometry(2, 2); g.rotateX(-Math.PI / 2);
    g.setAttribute('aP', new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aQ', new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage));
    const mat = ringMat(blending);
    super(parent, g, mat, cap, { color: true, alpha: true, order });
    this.mat = mat;
    this.P = this.mesh.geometry.attributes.aP; this.Q = this.mesh.geometry.attributes.aQ;
  }
  // x, z (unités 3D), y, rayon R, couleur, opacité, o = { fill, w (épaisseur 0..1), arc, a0 (angle de départ au sol), dash, speed, core, inner, soft }
  ring(x, y, z, R, c, a, fill = 0, w = 0.12, arc = 1, a0 = 0, dash = 0, speed = 0, core = 0.6, inner = 0, soft = 0) {
    const i = this.put(x, y, z, -a0, R, 1, R);
    if (i < 0) return;
    this.tint(i, c); this.A[i] = a;
    const P = this.P.array, Q = this.Q.array, o = i * 4;
    P[o] = fill; P[o + 1] = w; P[o + 2] = arc; P[o + 3] = dash;
    Q[o] = core; Q[o + 1] = speed; Q[o + 2] = inner; Q[o + 3] = soft;
  }
  end() {
    super.end();
    if (!this.n) return;
    for (const at of [this.P, this.Q]) { at.clearUpdateRanges(); at.addUpdateRange(0, this.n * 4); at.needsUpdate = true; }
  }
}

// couloir au sol (charges, rayon du boss) : rectangle de x = 0 à 1, y = −0,5 à 0,5 ;
// aP = (progression du remplissage, opacité du fond, chevrons, bord)
const LANE_FS = `
uniform float uT;
varying vec2 vUv; varying float vA; varying vec4 vP; varying vec4 vQ; varying vec3 vC;
void main() {
  float x = vUv.x, y = abs(vUv.y - 0.5) * 2.0;
  float ex = fwidth(x) * 2.0, ey = fwidth(y) * 2.0;
  float border = max(smoothstep(1.0 - ey * vP.w, 1.0, y), smoothstep(ex * vP.w, 0.0, x) + smoothstep(1.0 - ex * vP.w, 1.0, x));
  float fill = vP.y + (x < vP.x ? 0.28 : 0.0);
  float cx = fract(x * vQ.x - uT * vQ.y), chev = vP.z * step(abs(cx - 0.5 + y * 0.18), 0.09) * step(y, 0.55);
  vec3 c = mix(vC, vec3(1.0), clamp(chev + border * 0.35, 0.0, 1.0));
  float a = clamp(fill + border * 0.9 + chev * 0.8, 0.0, 1.0) * vA;
  gl_FragColor = vec4(c, a);
}`;
export class LanePool extends Pool {
  constructor(parent, cap, order = 1) {
    const g = new THREE.PlaneGeometry(1, 1); g.translate(0.5, 0, 0); g.rotateX(-Math.PI / 2);
    g.setAttribute('aP', new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aQ', new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 } }, vertexShader: RING_VS, fragmentShader: LANE_FS, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    super(parent, g, mat, cap, { color: true, alpha: true, order });
    this.mat = mat;
    this.P = this.mesh.geometry.attributes.aP; this.Q = this.mesh.geometry.attributes.aQ;
  }
  // départ (x, z), angle au sol a, longueur L, largeur W (unités 3D)
  lane(x, y, z, a, L, W, c, al, k = 0, base = 0.14, chev = 1, nChev = 4, speed = 1.2, border = 1) {
    const i = this.put(x, y, z, -a, L, 1, W);
    if (i < 0) return;
    this.tint(i, c); this.A[i] = al;
    const P = this.P.array, Q = this.Q.array, o = i * 4;
    P[o] = k; P[o + 1] = base; P[o + 2] = chev; P[o + 3] = border;
    Q[o] = nChev; Q[o + 1] = speed; Q[o + 2] = 0; Q[o + 3] = 0;
  }
  end() {
    super.end();
    if (!this.n) return;
    for (const at of [this.P, this.Q]) { at.clearUpdateRanges(); at.addUpdateRange(0, this.n * 4); at.needsUpdate = true; }
  }
}

// ---------- Textures générées ----------
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
const texCache = new Map();
export function tex(key, w, h, draw, { nearest = false, repeat = false } = {}) {
  let t = texCache.get(key);
  if (t) return t;
  const c = canvas(w, h);
  draw(c.getContext('2d'), w, h);
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (nearest) { t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestMipmapLinearFilter; }
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  texCache.set(key, t);
  return t;
}
export const TX = {
  glow: () => tex('glow', 64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, '#fff'); gr.addColorStop(0.22, 'rgba(255,255,255,.8)'); gr.addColorStop(0.55, 'rgba(255,255,255,.25)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }),
  soft: () => tex('soft', 64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }),
  star: () => tex('star', 64, 64, (g) => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 30); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(0.3, 'rgba(255,255,255,.25)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#fff'; g.beginPath(); g.moveTo(32, 2); g.quadraticCurveTo(32, 32, 62, 32); g.quadraticCurveTo(32, 32, 32, 62); g.quadraticCurveTo(32, 32, 2, 32); g.quadraticCurveTo(32, 32, 32, 2); g.fill();
  }),
  puff: () => tex('puff', 64, 64, (g) => {
    const gr = g.createRadialGradient(26, 24, 2, 32, 32, 31);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.6, 'rgba(236,232,244,1)'); gr.addColorStop(0.86, 'rgba(196,190,214,.9)'); gr.addColorStop(1, 'rgba(180,174,200,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(32, 32, 32, 0, TAU); g.fill();
  }),
  // colonne de lumière : cœur blanc, bords transparents, s'efface vers le haut
  beam: () => tex('beam', 64, 128, (g) => {
    const h = g.createLinearGradient(0, 0, 64, 0);
    h.addColorStop(0, 'rgba(255,255,255,0)'); h.addColorStop(0.3, 'rgba(255,255,255,.55)'); h.addColorStop(0.5, '#fff'); h.addColorStop(0.7, 'rgba(255,255,255,.55)'); h.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = h; g.fillRect(0, 0, 64, 128);
    g.globalCompositeOperation = 'destination-in';
    const v = g.createLinearGradient(0, 0, 0, 128); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(0.55, 'rgba(0,0,0,.75)'); v.addColorStop(1, '#000');
    g.fillStyle = v; g.fillRect(0, 0, 64, 128);
  }),
  // trait lumineux (rayons, éclairs, traînées) : dégradé sur la largeur
  streak: () => tex('streak', 8, 64, (g) => {
    const v = g.createLinearGradient(0, 0, 0, 64);
    v.addColorStop(0, 'rgba(255,255,255,0)'); v.addColorStop(0.32, 'rgba(255,255,255,.35)'); v.addColorStop(0.44, '#fff'); v.addColorStop(0.56, '#fff'); v.addColorStop(0.68, 'rgba(255,255,255,.35)'); v.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = v; g.fillRect(0, 0, 8, 64);
  }),
  rays: () => tex('rays', 128, 128, (g) => {
    g.translate(64, 64);
    for (let i = 0; i < 14; i++) {
      g.rotate(TAU / 14);
      const gr = g.createLinearGradient(0, 0, 64, 0); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(0, 0); g.lineTo(64, -7); g.lineTo(64, 7); g.closePath(); g.fill();
    }
  }),
  shadow: () => tex('shadow', 64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.55, 'rgba(0,0,0,.75)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }),
};

// quad tourné face à la caméra (elle ne tourne jamais : une seule orientation suffit)
export function billboardGeo(ox = 0, oy = 0) {
  const g = new THREE.PlaneGeometry(1, 1); g.translate(ox, oy, 0); g.rotateX(-PITCH);
  return g;
}
// quad vertical tourné vers la caméra (colonnes de lumière), base au sol
export function pillarGeo() { const g = new THREE.PlaneGeometry(1, 1); g.translate(0, 0.5, 0); return g; }
// quad horizontal (au sol), centré
export function flatGeo() { const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2); return g; }
