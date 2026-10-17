// Boîte à outils des personnages 3D : primitives basse définition assemblées en code,
// couleurs de sommets, parties « lumineuses » et matériau toon partagé.
// Tout est construit une seule fois (création du modèle) : rien n'est alloué image par image.
import * as THREE from '../../vendor/three.module.min.js';

const TAU = Math.PI * 2;
const tmpC = new THREE.Color();
const tmpE = new THREE.Euler();
const tmpQ = new THREE.Quaternion();
const tmpV = new THREE.Vector3();
const tmpS = new THREE.Vector3();

// ---------- Matériau toon (dégradé en 3 tons, lueur par sommet, liseré de lumière) ----------
let gradTex = null;
export function gradientMap() {
  if (!gradTex) {
    gradTex = new THREE.DataTexture(new Uint8Array([120, 196, 255]), 3, 1, THREE.RedFormat);
    gradTex.minFilter = gradTex.magFilter = THREE.NearestFilter;
    gradTex.generateMipmaps = false;
    gradTex.needsUpdate = true;
  }
  return gradTex;
}

// glow : attribut par sommet (0..1+) ajouté en émission → orbes, runes et yeux qui brillent sans lumière.
// rim : petit liseré clair sur les bords pour détacher les personnages du décor.
export function toonMaterial(opts = {}) {
  const { rim = 0.32, ...rest } = opts;
  const m = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradientMap(), ...rest });
  m.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float glow;\nvarying float vGlow;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = glow;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vGlow;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * vGlow;')
      .replace('#include <opaque_fragment>', `float lobRim = 1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
outgoingLight += diffuseColor.rgb * (lobRim * lobRim * lobRim) * ${rim.toFixed(3)};
#include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'lob-toon-' + rim.toFixed(3);
  return m;
}

// ---------- Primitives (unitaires, non indexées, normales prêtes) ----------
const PRIM = new Map();

// boîte aux arêtes arrondies (look « jouet »), r = rayon d'arrondi relatif (0..0.5)
function roundedBox(r, seg) {
  const g = new THREE.BoxGeometry(1, 1, 1, seg, seg, seg);
  const p = g.attributes.position, n = g.attributes.normal;
  const lim = 0.5 - r;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const cx = Math.max(-lim, Math.min(lim, x)), cy = Math.max(-lim, Math.min(lim, y)), cz = Math.max(-lim, Math.min(lim, z));
    tmpV.set(x - cx, y - cy, z - cz);
    if (tmpV.lengthSq() < 1e-8) tmpV.set(n.getX(i), n.getY(i), n.getZ(i));
    tmpV.normalize();
    p.setXYZ(i, cx + tmpV.x * r, cy + tmpV.y * r, cz + tmpV.z * r);
    n.setXYZ(i, tmpV.x, tmpV.y, tmpV.z);
  }
  return g;
}

// prisme effilé à section carrée (cape, tabard, lames)
function taper(top, bot, seg = 4) {
  const g = new THREE.CylinderGeometry(top, bot, 1, seg, 1);
  if (seg === 4) g.rotateY(Math.PI / 4);
  return g;
}

export function prim(key) {
  let g = PRIM.get(key);
  if (g) return g;
  const [kind, a, b, c] = key.split(':');
  const A = +a, B = +b, C = +c;
  switch (kind) {
    case 'box': g = new THREE.BoxGeometry(1, 1, 1); break;
    case 'rbox': g = roundedBox(isNaN(A) ? 0.22 : A, 3); break;
    case 'rboxl': g = roundedBox(isNaN(A) ? 0.22 : A, 2); break;
    case 'sph': g = new THREE.SphereGeometry(0.5, isNaN(A) ? 12 : A, isNaN(B) ? 9 : B); break;
    case 'dome': g = new THREE.SphereGeometry(0.5, isNaN(A) ? 12 : A, 5, 0, TAU, 0, Math.PI / 2); break;
    case 'cone': g = new THREE.ConeGeometry(0.5, 1, isNaN(A) ? 8 : A); break;
    case 'cyl': g = new THREE.CylinderGeometry(0.5, 0.5, 1, isNaN(A) ? 10 : A); break;
    case 'frust': g = new THREE.CylinderGeometry(A, B, 1, isNaN(C) ? 10 : C); break;
    case 'taper': g = taper(A, B, isNaN(C) ? 4 : C); break;
    case 'torus': g = new THREE.TorusGeometry(0.5, isNaN(A) ? 0.1 : A, isNaN(C) ? 5 : C, isNaN(B) ? 16 : B); break;
    case 'arc': g = new THREE.TorusGeometry(0.5, A, 4, 10, B); break;
    case 'oct': g = new THREE.OctahedronGeometry(0.5, 0); break;
    case 'ico': g = new THREE.IcosahedronGeometry(0.5, 0); break;
    case 'dod': g = new THREE.DodecahedronGeometry(0.5, 0); break;
    case 'tet': g = new THREE.TetrahedronGeometry(0.5, 0); break;
    default: throw new Error('primitive inconnue ' + key);
  }
  if (g.index) g = g.toNonIndexed();
  if (kind === 'ico' || kind === 'dod' || kind === 'oct' || kind === 'tet') g.computeVertexNormals();
  PRIM.set(key, g);
  return g;
}

// matrice de placement : position, rotation (XYZ), échelle
export function M(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  tmpE.set(rx, ry, rz); tmpQ.setFromEuler(tmpE);
  return new THREE.Matrix4().compose(tmpV.set(x, y, z), tmpQ, tmpS.set(sx, sy, sz));
}

// ---------- Assembleur de géométrie ----------
// Chaque pièce : primitive + couleur + matrice (+ os pour les héros, + lueur).
// version allégée d'une primitive (monstres instanciés par centaines)
const LOW = new Map();
function lowKey(key) {
  let k = LOW.get(key);
  if (k) return k;
  const [kind, a, b, c] = key.split(':');
  const r = (n, f, min) => Math.max(min, Math.round(+n * f));
  switch (kind) {
    case 'sph': k = `sph:${r(a || 12, 0.6, 5)}:${r(b || 9, 0.6, 4)}`; break;
    case 'rbox': k = 'rboxl' + (a !== undefined ? ':' + a : ''); break;
    case 'cyl': k = `cyl:${r(a || 10, 0.6, 5)}`; break;
    case 'frust': k = `frust:${a}:${b}:${r(c || 10, 0.6, 6)}`; break;
    case 'dome': k = `dome:${r(a || 12, 0.6, 6)}`; break;
    case 'cone': k = `cone:${Math.min(+(a || 8), 6)}`; break;
    case 'torus': k = `torus:${a}:${r(b || 16, 0.55, 6)}:3`; break;
    default: k = key;
  }
  LOW.set(key, k);
  return k;
}

export class Shape {
  constructor({ low = false } = {}) { this.P = []; this.N = []; this.C = []; this.G = []; this.B = []; this.low = low; }

  // grad : assombrit le bas de la pièce (volume), glow : émission (0..1)
  add(key, color, m, { glow = 0, bone = 0, grad = 0.18, shade = 1 } = {}) {
    const src = prim(this.low ? lowKey(key) : key);
    const P = src.attributes.position, N = src.attributes.normal;
    tmpC.set(color).multiplyScalar(shade);
    const nm = new THREE.Matrix3().getNormalMatrix(m);
    const v = new THREE.Vector3(), n = new THREE.Vector3();
    for (let i = 0; i < P.count; i++) {
      v.set(P.getX(i), P.getY(i), P.getZ(i));
      const k = 1 - grad * (0.5 - Math.max(-0.5, Math.min(0.5, v.y)));
      v.applyMatrix4(m);
      n.set(N.getX(i), N.getY(i), N.getZ(i)).applyMatrix3(nm).normalize();
      this.P.push(v.x, v.y, v.z); this.N.push(n.x, n.y, n.z);
      this.C.push(tmpC.r * k, tmpC.g * k, tmpC.b * k);
      this.G.push(glow); this.B.push(bone);
    }
    return this;
  }

  // raccourci : primitive placée (x,y,z), tournée (rx,ry,rz), mise à l'échelle (sx,sy,sz)
  put(key, color, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0, o) {
    return this.add(key, color, M(x, y, z, rx, ry, rz, sx, sy ?? sx, sz ?? sx), o);
  }

  // œil expressif : blanc, pupille, reflet (+ sourcil en colère) ; regarde vers +z (tourné de ry)
  eye(x, y, z, r, { pupil = '#1a1424', white = '#ffffff', ry = 0, angry = 0, side = 1, glow = 0, bone = 0, brow = '#1a1424', tall = 1.2, look = 0, spooky = false } = {}) {
    if (spooky) white = '#160c22';
    const cy = Math.cos(ry), sy = Math.sin(ry);
    const at = (dz) => [x + sy * dz, z + cy * dz];
    let [ax, az] = at(0);
    this.put('sph:10:8', white, ax, y, az, r * 2, r * 2 * tall, r * 1.1, 0, ry, 0, { bone, grad: 0, glow: glow * 0.6 });
    [ax, az] = at(r * 0.42);
    this.put('sph:8:6', pupil, ax + cy * look * r * 0.25, y - r * 0.08, az, r * 1.25, r * 1.45 * tall, r * 0.7, 0, ry, 0, { bone, grad: 0, glow });
    [ax, az] = at(r * 0.72);
    this.put(this.low ? 'sph:4:3' : 'sph:6:4', '#ffffff', ax - cy * r * 0.3, y + r * 0.34, az, r * 0.5, r * 0.5, r * 0.3, 0, ry, 0, { bone, grad: 0, glow: 0.7 });
    if (angry) {
      [ax, az] = at(r * 0.3);
      this.put('box', brow, ax, y + r * 1.22 * tall, az + r * 0.1, r * 1.8, r * 0.42, r * 0.6, 0, ry, angry * side * 0.45, { bone, grad: 0 });
    }
    return this;
  }

  get count() { return this.P.length / 3; }

  build({ skin = false } = {}) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.N, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.C, 3));
    g.setAttribute('glow', new THREE.Float32BufferAttribute(this.G, 1));
    if (skin) {
      const n = this.count, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) { si[i * 4] = this.B[i]; sw[i * 4] = 1; }
      g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
      g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    }
    g.computeBoundingSphere();
    return g;
  }
}

// mélange / éclaircit une couleur hexadécimale (amt > 0 vers le blanc, < 0 vers le noir)
export function tint(hex, amt) {
  tmpC.set(hex);
  if (amt > 0) tmpC.lerp(new THREE.Color('#ffffff'), amt); else tmpC.multiplyScalar(1 + amt);
  return '#' + tmpC.getHexString();
}
export function mix(a, b, k) { return '#' + new THREE.Color(a).lerp(new THREE.Color(b), k).getHexString(); }

// ---------- Matrices rapides (sans allocation) pour l'animation des instances ----------
// Écrit dans te (Float32/64 array de 16) la matrice T * Rxyz * S.
export function compose(m, tx, ty, tz, rx, ry, rz, sx, sy, sz) {
  const te = m.elements;
  const a = Math.cos(rx), b = Math.sin(rx), c = Math.cos(ry), d = Math.sin(ry), e = Math.cos(rz), f = Math.sin(rz);
  const ae = a * e, af = a * f, be = b * e, bf = b * f;
  te[0] = c * e * sx; te[4] = -c * f * sy; te[8] = d * sz; te[12] = tx;
  te[1] = (af + be * d) * sx; te[5] = (ae - bf * d) * sy; te[9] = -b * c * sz; te[13] = ty;
  te[2] = (bf - ae * d) * sx; te[6] = (be + af * d) * sy; te[10] = a * c * sz; te[14] = tz;
  te[3] = 0; te[7] = 0; te[11] = 0; te[15] = 1;
  return m;
}

// idem, ordre YXZ (cap, puis tangage, puis roulis) : pratique pour la racine d'un modèle
export function composeYXZ(m, tx, ty, tz, rx, ry, rz, sx, sy, sz) {
  const te = m.elements;
  const a = Math.cos(rx), b = Math.sin(rx), c = Math.cos(ry), d = Math.sin(ry), e = Math.cos(rz), f = Math.sin(rz);
  const ce = c * e, cf = c * f, de = d * e, df = d * f;
  te[0] = (ce + df * b) * sx; te[4] = (de * b - cf) * sy; te[8] = a * d * sz; te[12] = tx;
  te[1] = a * f * sx; te[5] = a * e * sy; te[9] = -b * sz; te[13] = ty;
  te[2] = (cf * b - de) * sx; te[6] = (df + ce * b) * sy; te[10] = a * c * sz; te[14] = tz;
  te[3] = 0; te[7] = 0; te[11] = 0; te[15] = 1;
  return m;
}

// petite texture radiale (ombre douce, lueurs) générée en code
const radTex = new Map();
export function radialTexture(inner = 'rgba(0,0,0,1)', outer = 'rgba(0,0,0,0)', size = 64, stop = 0.15) {
  const key = inner + outer + size + stop;
  if (radTex.has(key)) return radTex.get(key);
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d');
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gr.addColorStop(0, inner); gr.addColorStop(stop, inner); gr.addColorStop(1, outer);
  g.fillStyle = gr; g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  radTex.set(key, t);
  return t;
}
