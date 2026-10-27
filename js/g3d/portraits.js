// Portraits 3D des menus : héros, monstres, boss et familiers rendus une fois (contexte WebGL partagé hors écran)
// puis gardés en cache sous forme d'URL d'image (chaîne vide si le rendu échoue).
import { THREE, PI } from './models-kit.js';
import { heroModel, MonsterPool, petModel } from './models.js';
import { ZONES, PETS, GIGA_FORMS } from '../data.js';

// ---------- Contexte WebGL partagé (portraits + aperçus animés) ----------
let R = null;
export function sharedRenderer() {
  if (R) return R;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 8;
  R = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: true, preserveDrawingBuffer: true, powerPreference: 'low-power' });
  R.setClearColor(0x000000, 0);
  cv.addEventListener('webglcontextlost', e => { e.preventDefault(); R = null; }, false);
  return R;
}
export function lights(scene, k = 1) {
  scene.add(new THREE.HemisphereLight('#e8f4ff', '#5a6a3a', 2.3 * k));
  const sun = new THREE.DirectionalLight('#fff2dc', 2.6 * k); sun.position.set(-4, 9, 8); scene.add(sun);
  const rim = new THREE.DirectionalLight('#9ac8ff', 1.2 * k); rim.position.set(5, 4, -6); scene.add(rim);
}

const _b = new THREE.Box3(), _v = new THREE.Vector3();
// cadre la boîte dans une caméra orthographique (vue de 3/4 face, légèrement d'en haut) : pieds en bas, centrée
function frame(box, W, H, { el = 0.32, az = 0.42, pad = 0.08 } = {}) {
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  const c = box.getCenter(new THREE.Vector3());
  const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
  cam.position.copy(c).addScaledVector(dir, 60); cam.lookAt(c); cam.updateMatrixWorld();
  // étendue de la boîte vue par la caméra
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (let i = 0; i < 8; i++) {
    _v.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).applyMatrix4(cam.matrixWorldInverse);
    x0 = Math.min(x0, _v.x); x1 = Math.max(x1, _v.x); y0 = Math.min(y0, _v.y); y1 = Math.max(y1, _v.y);
  }
  const w = x1 - x0, h = y1 - y0, k = Math.max(w / W, h / H) * (1 + pad * 2);
  const cx = (x0 + x1) / 2, by = y0 - h * pad * 0.5;
  cam.left = cx - W * k / 2; cam.right = cx + W * k / 2; cam.bottom = by; cam.top = by + H * k;
  cam.updateProjectionMatrix();
  return cam;
}
function shoot(scene, cam, W, H) {
  const r = sharedRenderer();
  r.setPixelRatio(1); r.setSize(W, H, false);
  r.render(scene, cam);
  return r.domElement.toDataURL('image/png');
}
function boxOf(obj, skip) {
  _b.makeEmpty(); obj.updateMatrixWorld(true);
  obj.traverse(o => {
    if (!o.isMesh || (skip && skip(o))) return;
    const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox();
    if (o.isInstancedMesh) {
      const m = new THREE.Matrix4();
      for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, m); _b.union(g.boundingBox.clone().applyMatrix4(m).applyMatrix4(o.matrixWorld)); }
    } else _b.union(g.boundingBox.clone().applyMatrix4(o.matrixWorld));
  });
  return _b.clone();
}

const cache = new Map();
function cached(key, make) {
  if (!cache.has(key)) {
    let url = '';
    try { url = make(); } catch (e) { console.warn('portrait 3D', key, e); }
    if (!url) return url;
    cache.set(key, url);
  }
  return cache.get(key);
}

// héros : stade d'évolution evo, pose de repos tournée vers le joueur
export function heroURL(clsId, _colors, evo = 0) {
  return cached('h:' + clsId + ':' + evo, () => {
    const scene = new THREE.Scene(); lights(scene);
    const m = heroModel(clsId, evo); scene.add(m.root);
    for (let i = 0; i < 40; i++) m.update(1 / 60, { t: 0.8 + i / 60, dirA: PI / 2 });
    const box = boxOf(m.root, o => o.material?.isShaderMaterial || o.material?.blending === THREE.AdditiveBlending || o.parent?.name === 'float');
    if (evo >= 4) box.expandByScalar(0.25);
    const W = 150, H = 190, cam = frame(box, W, H, { el: 0.22, az: 0.38, pad: 0.04 });
    const url = shoot(scene, cam, W, H);
    m.dispose();
    return url;
  });
}

const DEFS = new Map();
for (const z of ZONES) { for (const d of z.monsters) DEFS.set(d.name, d); if (z.boss) DEFS.set(z.boss.name, z.boss); }
for (const d of GIGA_FORMS) DEFS.set(d.name, d); // giga boss (portail, bilan) : 'x-x-Gorgoth', 'x-x-Gorgoth:3'…
// monstres / boss / familiers : seed = 'zone-index-Nom' ou 'pet-id'
export function creatureURL(seed, body, pal, opts = {}) {
  const name = String(seed).replace(/^\d+-\d+-/, ''), boss = !!opts.boss;
  return cached('c:' + name + (boss ? ':b' : ''), () => {
    const scene = new THREE.Scene(); lights(scene);
    const W = boss ? 200 : 170, H = boss ? 200 : 170;
    let dispose, root;
    const pid = name.startsWith('pet-') ? name.slice(4) : null;
    if (pid && PETS[pid]) {
      const p = petModel(pid); p.update(0.016, { t: 0.4, dirA: PI / 2 + 0.35 }); root = p.root; dispose = () => p.dispose();
    } else {
      const d = DEFS.get(name) || { name, body: body || 'blob', pal: pal || ['#8a8aa8', '#5a5a78', '#c8c8e8'] };
      const v = boss ? 'b' : d.elite ? 'e' : 'n';
      const pool = new MonsterPool(scene, d, v, 1);
      pool.begin();
      pool.add(null, { x: 0, y: 0, z: 0, rot: PI / 2 + 0.35, scale: 1, flash: 0, freeze: false, mad: false, anim: 0.9, sq: 0, alpha: 1 });
      pool.end();
      root = pool.mesh; dispose = () => pool.dispose();
    }
    if (root.parent !== scene) scene.add(root);
    const box = boxOf(root);
    const cam = frame(box, W, H, { el: 0.3, az: 0.15, pad: 0.05 });
    const url = shoot(scene, cam, W, H);
    dispose();
    return url;
  });
}
