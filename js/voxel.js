// Transforme un sprite pixel art en modèle 3D en voxels « gonflés » (plus épais au centre).
import * as THREE from '../vendor/three.module.min.js';

const tmp = new THREE.Color();

// grid : tableau de chaînes ; colors : { char: '#rrggbb' }
// Renvoie une BufferGeometry dont les pieds sont en y = 0, centrée en x/z, face avant vers +z.
export function voxelGeometry(grid, colors, { size = 1, maxDepth = 5 } = {}) {
  const H = grid.length, W = Math.max(...grid.map(r => r.length));
  const filled = (x, y) => x >= 0 && y >= 0 && x < W && y < H && grid[y][x] && grid[y][x] !== '.' && grid[y][x] !== ' ' && colors[grid[y][x]];
  // distance au bord (BFS) pour l'épaisseur
  const dist = Array.from({ length: H }, () => new Array(W).fill(-1));
  const q = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!filled(x, y)) continue;
    const edge = !filled(x + 1, y) || !filled(x - 1, y) || !filled(x, y + 1) || !filled(x, y - 1);
    if (edge) { dist[y][x] = 0; q.push([x, y]); }
  }
  for (let i = 0; i < q.length; i++) {
    const [x, y] = q[i];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (filled(nx, ny) && dist[ny][nx] < 0) { dist[ny][nx] = dist[y][x] + 1; q.push([nx, ny]); }
    }
  }
  // profondeur en voxels (symétrique avant/arrière)
  const depth = (x, y) => filled(x, y) ? Math.min(maxDepth, 1 + dist[y][x]) : 0;

  const pos = [], col = [], nor = [];
  const quad = (a, b, c, d, n, color, shadeK) => {
    tmp.set(color).multiplyScalar(shadeK);
    for (const v of [a, b, c, a, c, d]) { pos.push(v[0], v[1], v[2]); col.push(tmp.r, tmp.g, tmp.b); nor.push(n[0], n[1], n[2]); }
  };
  const ox = -W / 2, oy = H; // pieds en y=0
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const d = depth(x, y);
    if (!d) continue;
    const c = colors[grid[y][x]];
    const x0 = x + ox, x1 = x0 + 1, y1 = oy - y, y0 = y1 - 1, z0 = -d / 2, z1 = d / 2;
    // avant / arrière
    quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], c, 1);
    quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], c, 0.8);
    // côtés : on dessine la partie qui dépasse du voisin
    const nb = [[1, 0, [1, 0, 0]], [-1, 0, [-1, 0, 0]], [0, -1, [0, 1, 0]], [0, 1, [0, -1, 0]]];
    for (const [dx, dy, n] of nb) {
      const nd = depth(x + dx, y + dy);
      if (nd >= d) continue;
      const k = n[1] > 0 ? 1.08 : n[1] < 0 ? 0.7 : 0.88;
      // bandes avant et arrière exposées
      const segs = nd === 0 ? [[z0, z1]] : [[nd / 2, z1], [z0, -nd / 2]];
      for (const [za, zb] of segs) {
        if (dx === 1) quad([x1, y0, zb], [x1, y0, za], [x1, y1, za], [x1, y1, zb], n, c, k);
        if (dx === -1) quad([x0, y0, za], [x0, y0, zb], [x0, y1, zb], [x0, y1, za], n, c, k);
        if (dy === -1) quad([x0, y1, zb], [x1, y1, zb], [x1, y1, za], [x0, y1, za], n, c, k);
        if (dy === 1) quad([x0, y0, za], [x1, y0, za], [x1, y0, zb], [x0, y0, zb], n, c, k);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos.map(v => v * size), 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeBoundingSphere();
  return g;
}
