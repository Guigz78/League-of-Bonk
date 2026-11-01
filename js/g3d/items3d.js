// Images 3D de l'équipement : un petit modèle low-poly par objet (13 modèles d'objets + 6 objets de boss), dans le style
// des champions (Shape + matériau à facettes de models-kit.js). Chaque image est rendue une seule fois dans le contexte
// WebGL partagé des portraits puis gardée en cache (URL d'image). La rareté se lit au cadre de la tuile (CSS) ;
// les objets légendaires ont en plus des éclats lumineux.
import { THREE, PI, Shape, charMaterial, shade } from './models-kit.js';
import { lights, frame, shoot, boxOf, cached } from './portraits.js';

// palette commune
const STEEL = '#c9d2de', STEEL2 = '#7d8798', GOLD = '#f2b830', GOLD2 = '#b9801c', WOOD = '#9a6236', WOOD2 = '#5e3a1e',
  LEATHER = '#7c4a2a', LEATHER2 = '#4e2c18', CLOTH = '#e8dcc0', RED = '#e8364a', BLUE = '#3a8aff', CYAN = '#6ae8ff',
  GREEN = '#4cd26e', PURPLE = '#9a52e0', PINK = '#ff7ab8';
const G = (n = 1) => ({ glow: n, grad: 0 });

// chaque modèle : (s) => { construit ; renvoie la pose [rx, ry, rz] de présentation }
const MODELS = {
  // ---------- armes ----------
  'Épée longue': s => {
    s.put('box', STEEL, 0, 0.6, 0, 0.24, 1.7, 0.07);
    s.put('box', STEEL2, 0, 0.55, 0.02, 0.06, 1.5, 0.06);
    s.put('cone:4', STEEL, 0, 1.6, 0, 0.34, 0.34, 0.1, 0, PI / 4, 0);
    s.put('rbox:0.3', GOLD, 0, -0.33, 0, 0.86, 0.13, 0.18);
    s.put('sph:6:4', RED, 0, -0.33, 0.08, 0.13, 0.13, 0.1, 0, 0, 0, G(0.4));
    s.put('cyl:6', LEATHER, 0, -0.66, 0, 0.13, 0.5, 0.13);
    s.put('sph:8:6', GOLD, 0, -0.96, 0, 0.22);
    return [0, 0.3, -PI / 4];
  },
  'Lame du voyageur': s => { // sabre courbe, garde ronde, poignée bleue
    s.put('box', '#dfe6ee', 0.02, 0.3, 0, 0.22, 0.9, 0.06, 0, 0, -0.04);
    s.put('box', '#dfe6ee', 0.1, 1.0, 0, 0.2, 0.6, 0.06, 0, 0, -0.2);
    s.put('cone:4', '#dfe6ee', 0.22, 1.4, 0, 0.26, 0.36, 0.08, 0, PI / 4, -0.38);
    s.put('box', '#8fa0b4', -0.07, 0.6, 0.02, 0.04, 1.2, 0.06, 0, 0, -0.08);
    s.put('cyl:10', '#c9873a', 0, -0.2, 0, 0.5, 0.1, 0.5, PI / 2, 0, 0);
    s.put('cyl:6', '#2e6a9a', 0, -0.5, 0, 0.14, 0.5, 0.14);
    s.put('ico', RED, 0, -0.82, 0, 0.2, 0.2, 0.2, 0, 0, 0, G(0.5));
    return [0, 0.3, -PI / 4];
  },
  'Grimoire runique': s => {
    s.put('rbox:0.15', '#5a2a8a', 0, 0, 0, 1.15, 1.45, 0.34);
    s.put('box', CLOTH, 0.06, 0, 0, 1.0, 1.32, 0.26);
    s.put('box', '#3e1c62', -0.56, 0, 0, 0.1, 1.46, 0.36);
    for (const [x, y] of [[0.5, 0.66], [0.5, -0.66], [-0.5, 0.66], [-0.5, -0.66]]) s.put('box', GOLD, x, y, 0, 0.2, 0.2, 0.38);
    s.put('oct', CYAN, 0.04, 0.05, 0.19, 0.42, 0.56, 0.08, 0, 0, 0, G(1));
    s.put('tor:0.06:4:16', GOLD, 0.04, 0.05, 0.18, 0.78, 0.78, 0.4);
    s.put('box', GOLD2, 0.6, 0, 0.0, 0.12, 0.3, 0.4);
    return [0.1, 0.55, 0.12];
  },
  'Arc courbé': s => {
    s.put('arc:0.07:2.6:12', WOOD, 0, 0, 0, 2.2, 2.2, 2.2, 0, 0, 0.55 * PI);
    s.put('rbox:0.3', LEATHER, -1.1, 0, 0, 0.22, 0.42, 0.22);
    s.put('box', '#f4f0e6', -0.17, 0, 0, 0.03, 1.98, 0.03, 0, 0, 0, G(0.2));
    s.put('box', WOOD2, 0.4, 0, 0, 1.2, 0.05, 0.05, 0, 0, PI / 2 - PI / 2);
    s.put('cone:4', STEEL, 1.08, 0, 0, 0.16, 0.26, 0.1, 0, 0, -PI / 2);
    s.put('wedge', RED, -0.16, 0.07, 0, 0.22, 0.12, 0.03);
    s.put('wedge', RED, -0.16, -0.07, 0, 0.22, 0.12, 0.03, PI, 0, 0);
    return [0, 0.35, 0.5];
  },
  'Bâton de foudre': s => {
    s.put('cyl:6', WOOD, 0, 0, 0, 0.16, 2.5, 0.16);
    s.put('cyl:6', WOOD2, 0, -1.0, 0, 0.2, 0.3, 0.2);
    s.put('tor:0.12:4:10', GOLD, 0, 1.22, 0, 0.36, 0.36, 0.36, PI / 2, 0, 0);
    for (let i = 0; i < 3; i++) { const a = i / 3 * PI * 2; s.tip('cone:4', GOLD, Math.cos(a) * 0.14, 1.25, Math.sin(a) * 0.14, Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5, 0.08, 0.4); }
    s.put('oct', CYAN, 0, 1.62, 0, 0.42, 0.7, 0.42, 0, 0, 0, G(1.1));
    s.put('tet', '#ffe35a', 0.42, 1.9, 0, 0.18, 0.3, 0.12, 0, 0, 0.5, G(1));
    s.put('tet', '#ffe35a', -0.36, 1.45, 0.1, 0.14, 0.24, 0.1, 0, 0, -0.6, G(1));
    return [0, 0.3, -0.42];
  },
  // ---------- armures ----------
  'Cotte de mailles': s => {
    s.put('rbox:0.25', '#9aa6b6', 0, 0, 0, 1.3, 1.45, 0.62);
    s.sym('rbox:0.3', '#8d99aa', 0.78, 0.36, 0, 0.42, 0.72, 0.5, 0, 0, 0.35);
    for (let i = 0; i < 5; i++) s.put('box', '#6e7a8c', 0, 0.5 - i * 0.26, 0.31, 1.24, 0.05, 0.03);
    s.put('tor:0.12:4:12', '#5c6676', 0, 0.74, 0.02, 0.6, 0.6, 0.6, PI / 2, 0, 0);
    s.put('box', LEATHER2, 0, -0.6, 0.02, 1.34, 0.18, 0.66);
    s.put('rbox:0.3', GOLD, 0, -0.6, 0.34, 0.24, 0.18, 0.06);
    return [0, 0.45, 0];
  },
  'Cape de brume': s => {
    s.put('cone:8', '#7486b8', 0, -0.1, 0, 1.6, 1.9, 1.0);
    s.put('cone:8', '#3a4468', 0, -0.2, 0.18, 0.7, 1.5, 0.4);
    s.put('hemi:8:4', '#8a9ac8', 0, 0.78, -0.05, 0.86, 0.86, 0.86);
    s.put('sph:8:6', '#20263a', 0, 0.72, 0.18, 0.46, 0.52, 0.3);
    s.put('sph:6:4', GOLD, 0, 0.36, 0.42, 0.18, 0.18, 0.1);
    for (const [x, y, z] of [[0.7, -0.6, 0.3], [-0.6, -0.8, 0.4], [0.2, -1.0, 0.5]]) s.put('sph:6:4', '#cfe0ff', x, y, z, 0.32, 0.18, 0.18, 0, 0, 0, G(0.6));
    return [0, 0.4, 0];
  },
  'Gilet d\'épines': s => {
    s.put('rbox:0.25', '#4f7f38', 0, 0, 0, 1.25, 1.35, 0.58);
    s.put('box', '#3a5e28', 0, 0, 0.3, 0.12, 1.3, 0.04);
    s.put('box', LEATHER2, 0, -0.52, 0, 1.3, 0.16, 0.62);
    const sp = (x, y, z, rx, rz) => s.tip('cone:5', '#e8dcb8', x, y, z, rx, 0, rz, 0.16, 0.42);
    sp(0.5, 0.62, 0, 0, -0.5); sp(-0.5, 0.62, 0, 0, 0.5); sp(0.32, 0.25, 0.28, 1.2, -0.2); sp(-0.32, 0.25, 0.28, 1.2, 0.2);
    sp(0.36, -0.15, 0.28, 1.3, -0.1); sp(-0.36, -0.15, 0.28, 1.3, 0.1); sp(0.66, 0.1, 0, 0, -1.3); sp(-0.66, 0.1, 0, 0, 1.3);
    return [0, 0.45, 0];
  },
  'Plastron du géant': s => {
    s.put('rbox:0.3', STEEL, 0, 0, 0, 1.4, 1.5, 0.66);
    s.put('box', STEEL2, 0, 0.05, 0.33, 0.1, 1.3, 0.04);
    s.sym('sph:8:6', '#aab4c2', 0.78, 0.55, 0, 0.7, 0.5, 0.7);
    s.sym('tor:0.06:4:10', GOLD, 0.78, 0.55, 0, 0.6, 0.6, 0.6, PI / 2, 0, 0);
    s.put('box', GOLD, 0, -0.55, 0.02, 1.44, 0.16, 0.7);
    s.put('box', GOLD, 0, 0.72, 0.02, 0.9, 0.1, 0.6);
    s.put('oct', BLUE, 0, 0.2, 0.36, 0.26, 0.32, 0.12, 0, 0, 0, G(0.6));
    return [0, 0.45, 0];
  },
  // ---------- bijoux ----------
  'Larme de fée': s => {
    s.put('sph:10:8', PINK, 0, -0.2, 0, 0.8, 0.8, 0.8, 0, 0, 0, G(0.7));
    s.put('cone:10', PINK, 0, 0.42, 0, 0.78, 0.8, 0.78, 0, 0, 0, G(0.7));
    s.put('sph:8:6', '#ffffff', -0.16, -0.05, 0.3, 0.2, 0.26, 0.1, 0, 0, 0, G(1));
    s.put('cone:6', '#e8eef4', 0, 0.86, 0, 0.3, 0.2, 0.3, PI, 0, 0);
    s.put('tor:0.05:4:10', '#e8eef4', 0, 1.06, 0, 0.26, 0.26, 0.26);
    s.put('arc:0.04:3.14:10', '#d8dee8', 0, 1.06, 0, 0.8, 0.6, 0.8);
    return [0, 0.4, 0];
  },
  'Gant de cogneur': s => {
    s.put('rbox:0.3', LEATHER, 0, 0, 0, 0.9, 0.9, 0.46);
    for (let i = 0; i < 4; i++) s.put('rbox:0.35', LEATHER, -0.3 + i * 0.2, 0.62, 0.04, 0.18, 0.5, 0.36);
    s.put('rbox:0.35', LEATHER, 0.55, 0.12, 0.08, 0.2, 0.46, 0.3, 0, 0, -0.6);
    s.put('box', STEEL, 0, 0.52, 0.24, 0.86, 0.16, 0.1);
    for (let i = 0; i < 4; i++) s.put('cone:4', STEEL, -0.3 + i * 0.2, 0.52, 0.32, 0.1, 0.14, 0.1, PI / 2, 0, 0);
    s.put('cyl:8', LEATHER2, 0, -0.62, 0, 0.82, 0.42, 0.56);
    s.put('box', GOLD, 0, -0.45, 0.24, 0.6, 0.08, 0.06);
    return [0.2, 0.35, 0.1];
  },
  'Anneau du voyageur': s => {
    s.put('tor:0.2:6:18', GOLD, 0, 0, 0, 1.2, 1.2, 1.2);
    s.put('cyl:6', GOLD2, 0, 0.62, 0, 0.36, 0.14, 0.36);
    s.put('oct', GREEN, 0, 0.82, 0, 0.42, 0.42, 0.42, 0, PI / 4, 0, G(0.6));
    return [0.35, 0.4, 0];
  },
  'Talisman ancien': s => {
    s.put('cyl:10', '#8c8a7a', 0, 0, 0, 1.2, 0.2, 1.2, PI / 2, 0, 0);
    s.put('tor:0.07:4:16', GOLD, 0, 0, 0.1, 0.92, 0.92, 0.5);
    s.put('oct', RED, 0, 0, 0.12, 0.32, 0.32, 0.18, 0, 0, 0, G(0.8));
    for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2; s.put('box', GOLD2, Math.cos(a) * 0.38, Math.sin(a) * 0.38, 0.1, 0.08, 0.16, 0.04, 0, 0, a); }
    s.put('arc:0.035:3.14:10', LEATHER, 0, 0.55, 0, 0.9, 0.9, 0.9);
    return [0, 0.4, 0];
  },
  // ---------- objets des boss ----------
  'Couronne du Roi Gobelin': s => {
    s.put('cyl:12', GOLD, 0, 0, 0, 1.3, 0.42, 1.3);
    s.put('cyl:12', '#7a1a2a', 0, 0.02, 0, 1.18, 0.36, 1.18);
    for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2; s.tip('cone:4', GOLD, Math.cos(a) * 0.6, 0.18, Math.sin(a) * 0.6, 0, 0, 0, 0.28, 0.46); s.put('sph:6:4', i % 2 ? RED : GREEN, Math.cos(a) * 0.66, 0.02, Math.sin(a) * 0.66, 0.16, 0.16, 0.1, 0, -a + PI / 2, 0, G(0.5)); }
    return [0.35, 0.3, 0];
  },
  'Lame de Ronce-Brûlante': s => {
    s.put('box', '#7a1f16', 0, 0.6, 0, 0.3, 1.7, 0.08);
    s.put('box', '#ff8a3a', 0, 0.6, 0.03, 0.08, 1.6, 0.06, 0, 0, 0, G(1));
    s.put('cone:4', '#7a1f16', 0, 1.62, 0, 0.42, 0.4, 0.1, 0, PI / 4, 0);
    s.put('rbox:0.3', '#3a2a1a', 0, -0.32, 0, 0.9, 0.16, 0.2);
    for (const x of [-0.4, -0.2, 0.2, 0.4]) s.tip('cone:4', '#6aa03a', x, -0.3, 0, 0, 0, x > 0 ? -0.6 : 0.6, 0.1, 0.26);
    s.put('cyl:6', '#4a2a1a', 0, -0.66, 0, 0.14, 0.5, 0.14);
    s.put('sph:8:6', '#ff5a1a', 0, -0.96, 0, 0.24, 0.24, 0.24, 0, 0, 0, G(1));
    return [0, 0.3, -PI / 4];
  },
  'Carapace du Léviathan': s => {
    s.put('hemi:10:5', '#7a3ad8', 0, 0, 0, 1.7, 1.2, 1.5);
    s.put('cyl:10', '#d0a0ff', 0, 0, 0, 1.74, 0.1, 1.54);
    for (let i = 0; i < 5; i++) s.tip('cone:4', '#e8c8ff', 0, 0.3 + i * 0.05, -0.55 + i * 0.28, -0.3 + i * 0.15, 0, 0, 0.16, 0.36);
    for (const [x, z] of [[-0.45, 0.3], [0.45, 0.3], [-0.5, -0.2], [0.5, -0.2]]) s.put('hemi:6:3', '#5a20a8', x, 0.36, z, 0.42, 0.2, 0.42);
    return [0.5, 0.5, 0];
  },
  'Plume de Cryophénix': s => {
    s.seg('cyl:5', '#f0f8ff', [0, -1.1, 0], [0, 1.2, 0], 0.07);
    for (let i = 0; i < 5; i++) {
      const y = -0.5 + i * 0.36, w = 0.62 - Math.abs(i - 2) * 0.08;
      s.put('sph:8:4', i % 2 ? '#7ad4ff' : '#4aa8f0', 0.2, y, 0, w, 0.4, 0.08, 0, 0, -0.5, G(0.3));
      s.put('sph:8:4', i % 2 ? '#4aa8f0' : '#7ad4ff', -0.2, y, 0, w, 0.4, 0.08, 0, 0, 0.5, G(0.3));
    }
    s.put('sph:8:6', '#e0f8ff', 0, 1.25, 0, 0.3, 0.42, 0.08, 0, 0, 0, G(0.9));
    return [0, 0.25, -0.5];
  },
  'Faux du Geôlier': s => {
    s.put('cyl:6', '#3a3040', 0, 0, 0, 0.14, 2.6, 0.14);
    s.put('arc:0.16:2.1:12', '#5affb0', 0.62, 1.12, 0, 1.7, 1.3, 0.7, 0, 0, 0.36 * PI, G(0.8));
    s.put('arc:0.07:2.0:12', '#b8ffe0', 0.62, 1.12, 0.06, 1.42, 1.08, 0.5, 0, 0, 0.38 * PI, G(1));
    s.put('box', '#2a2a34', 0, 1.2, 0, 0.36, 0.22, 0.24);
    s.put('sph:8:6', '#e8e4d8', 0, 1.42, 0.05, 0.3, 0.28, 0.28);
    s.put('box', '#14141c', -0.06, 1.44, 0.18, 0.07, 0.08, 0.04); s.put('box', '#14141c', 0.06, 1.44, 0.18, 0.07, 0.08, 0.04);
    s.put('cyl:6', '#5a4a3a', 0, -1.2, 0, 0.2, 0.3, 0.2);
    return [0, 0.3, -0.35];
  },
  'Écailles du Ver-Roi': s => {
    s.put('rbox:0.25', '#5a2a8a', 0, 0, 0, 1.35, 1.45, 0.62);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      const x = -0.45 + c * 0.3 + (r % 2) * 0.15, y = 0.45 - r * 0.3;
      if (x > 0.6) continue;
      s.put('hemi:6:3', r % 2 ? '#a86ae8' : '#8a4ad8', x, y, 0.3, 0.34, 0.34, 0.16, PI / 2, 0, 0);
    }
    s.sym('rbox:0.3', '#6a32a0', 0.8, 0.4, 0, 0.44, 0.66, 0.52, 0, 0, 0.3);
    s.put('box', GOLD, 0, 0.72, 0.02, 0.92, 0.12, 0.64);
    s.put('oct', '#ff4ad8', 0, -0.5, 0.34, 0.24, 0.28, 0.12, 0, 0, 0, G(0.8));
    return [0, 0.45, 0];
  },
};
export const ITEM_MODELS = Object.keys(MODELS);

// image d'un objet (nom du modèle) : '' si le modèle n'existe pas ou si le rendu échoue (l'interface garde l'icône)
export function itemURL(name, legend = false) {
  const make = MODELS[name];
  if (!make) return '';
  return cached('it:' + name + (legend ? ':L' : ''), () => {
    const scene = new THREE.Scene(); lights(scene, 1.1);
    const s = new Shape(), [rx, ry, rz] = make(s);
    const mat = charMaterial({ rim: 0.7 }), mesh = new THREE.Mesh(s.geometry(), mat);
    mesh.rotation.set(rx, ry, rz);
    scene.add(mesh);
    const box = boxOf(mesh);
    let fx = null;
    if (legend) { // éclats autour de l'objet légendaire, dans son cadre (ils ne comptent pas dans le cadrage)
      const e = new Shape(), a = box.min, b = box.max, z = b.z + 0.2, w = (b.x - a.x) * 0.07 + 0.08;
      for (const [kx, ky, k] of [[0.92, 0.9, 1], [0.06, 0.62, 0.75], [0.86, 0.12, 0.6]]) e.put('oct', '#fff1b0', a.x + (b.x - a.x) * kx, a.y + (b.y - a.y) * ky, z, w * k, w * 1.9 * k, w * 0.4, 0, 0, 0, G(1.2));
      fx = new THREE.Mesh(e.geometry(), mat); scene.add(fx);
    }
    // cadrage carré centré (frame pose le bas de la boîte en bas de l'image : on recentre verticalement)
    const W = 160, H = 160, cam = frame(box, W, H, { el: 0.12, az: 0, pad: 0.1 });
    const c = (cam.top - cam.bottom), hy = box.getSize(new THREE.Vector3()).y;
    cam.bottom -= (c - hy) * 0.35; cam.top -= (c - hy) * 0.35; cam.updateProjectionMatrix();
    const url = shoot(scene, cam, W, H);
    mesh.geometry.dispose(); fx?.geometry.dispose(); mat.dispose();
    return url;
  });
}
