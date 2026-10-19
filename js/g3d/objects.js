// Objets de l'expédition en 3D : cristaux d'expérience, pièces, cœurs, aimants, coffres d'amélioration et de
// butin (4 rangs), autels de bénédiction, totems de défi (4 looks), autel du boss, arène, portail tourbillonnant.
// Lit l'état de la partie, ne le modifie jamais.
import { THREE, S, TAU, clamp, rand, easeOut, backOut, col, shade, Build, G, T, lowpoly, Pool, TX, ADD } from './kit.js';
import { TOTEMS } from '../data.js';
import { LOOT_GLOW, swirlTex, rune } from '../g2d/items.js';

const GEM = ['#4fb8ff', '#5ae87a', '#c06aff', '#ff4a6a'];
const LOOT = [
  { body: '#a8682e', dark: '#6a3a1a', band: '#5a4a3a', trim: '#d8a060' },   // bois
  { body: '#b8c8e0', dark: '#6a7a98', band: '#e8f0ff', trim: '#ffffff' },   // argent
  { body: '#e8b020', dark: '#9a6a10', band: '#fff0a0', trim: '#ffffff' },   // or
  { body: '#c040c8', dark: '#6a1a78', band: '#ffb0f0', trim: '#ffe0ff' },   // mythique
];

function canvasTex(c) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
// couronne de runes (autel, portail) dessinée une fois
function runeRing(c1, c2, n = 18) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.translate(128, 128);
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.strokeStyle = c1; g.lineWidth = 5; g.beginPath(); g.arc(0, 0, 118, 0, TAU); g.stroke();
  g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 80, 0, TAU); g.stroke();
  for (let i = 0; i < n; i++) {
    const a = i / n * TAU;
    g.save(); g.rotate(a); g.translate(0, -99);
    g.strokeStyle = c1; g.lineWidth = 6; rune(g, i, 9);
    g.strokeStyle = c2; g.lineWidth = 2.4; rune(g, i, 9);
    g.restore();
  }
  return canvasTex(c);
}

export class Objects {
  constructor(gfx) {
    this.gfx = gfx; this.run = gfx.run; this.fx = gfx.fx;
    const sc = this.root = new THREE.Group();
    gfx.scene.add(sc);
    this.mats = [];
    const mk = (f, cap, mat = lowpoly(), o = {}) => { const b = new Build(5); f(b); return new Pool(sc, b.geo(), mat, cap, o); };
    const glowy = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: col('#2a2a2a') }); this.mats.push(glowy);
    // ---- ramassables ----
    this.gem = mk(b => { b.add(G.oct(0.5), (x, y) => (y > 0.05 ? '#ffffff' : '#c8d4e8'), T(0, 0, 0, 0.62, 1.15, 0.62), 0.12); }, 900, glowy, { color: true });
    this.coin = mk(b => { b.add(G.cyl(0.42, 0.42, 0.12, 10), '#ffc83a', T(0, 0, 0, 1, 1, 1, Math.PI / 2), 0.05); b.add(G.cyl(0.25, 0.25, 0.14, 8), '#fff0a0', T(0, 0, 0, 1, 1, 1, Math.PI / 2)); }, 300, glowy);
    this.heart = mk(b => { b.add(G.ico(0.3, 1), '#ff4a6a', T(-0.2, 0.12, 0)); b.add(G.ico(0.3, 1), '#ff4a6a', T(0.2, 0.12, 0)); b.add(G.cone(0.42, 0.55, 4), '#e8324e', T(0, -0.22, 0, 1.1, 1, 0.75, Math.PI, Math.PI / 4)); b.add(G.ico(0.09, 0), '#ffffff', T(-0.26, 0.3, 0.2)); }, 40, glowy);
    this.magnet = mk(b => { b.add(G.tor(0.38, 0.13, 5, 10, Math.PI), '#e8324e', T(0, 0.1, 0, 1, 1, 1, 0, 0, 0)); for (const s of [-1, 1]) b.add(G.box(0.27, 0.3, 0.27), '#e8eef8', T(s * 0.38, -0.12, 0)); }, 20, glowy);
    // ---- coffres d'amélioration (bleu à pièce d'or) et d'élite (violet à étoile) ----
    const chest = (b, C, emblem, open) => {
      b.add(G.box(1.5, 0.85, 1.05), C[0], T(0, 0.42, 0), 0.05);
      b.add(G.box(1.56, 0.12, 1.1), C[2], T(0, 0.82, 0));
      for (const s of [-1, 1]) b.add(G.box(0.14, 0.9, 1.12), C[2], T(s * 0.55, 0.45, 0));
      const lid = open ? T(0, 0.95, -0.55, 1, 1, 1, -1.9) : T(0, 0.88, 0);
      const lb = new Build(1); lb.add(G.cyl(0.53, 0.53, 1.5, 8, 1, false, 0, Math.PI), C[1], T(0, 0, 0, 1, 1, 1, 0, 0, Math.PI / 2), 0.05);
      for (const s of [-1, 1]) lb.add(G.cyl(0.56, 0.56, 0.14, 8, 1, false, 0, Math.PI), C[2], T(s * 0.55, 0, 0, 1, 1, 1, 0, 0, Math.PI / 2));
      const g = lb.geo(); g.translate(0, 0, open ? 0.53 : 0); g.applyMatrix4(lid);
      b.pos.push(...g.attributes.position.array); b.col.push(...g.attributes.color.array); g.dispose();
      if (!open) {
        if (emblem === 'coin') { b.add(G.cyl(0.24, 0.24, 0.08, 10), '#ffd54a', T(0, 0.75, 0.56, 1, 1, 1, Math.PI / 2)); b.add(G.box(0.1, 0.16, 0.04), '#c8860c', T(0, 0.75, 0.61)); }
        else { b.add(G.oct(0.26), '#ffe48a', T(0, 0.78, 0.56, 1, 1, 0.4)); }
      } else b.add(G.box(1.2, 0.08, 0.8), '#ffe48a', T(0, 0.8, 0));
    };
    const CB = ['#3a7ae8', '#5aa0ff', '#ffd54a'], CP = ['#8a3ad8', '#b06aff', '#ffd54a'];
    this.chestB = mk(b => chest(b, CB, 'coin', false), 12); this.chestBo = mk(b => chest(b, CB, 'coin', true), 12);
    this.chestP = mk(b => chest(b, CP, 'star', false), 12); this.chestPo = mk(b => chest(b, CP, 'star', true), 12);
    // ---- coffres de butin (4 rangs) ----
    this.loot = LOOT.map((C, i) => mk(b => {
      b.add(G.box(1.7, 1.0, 1.2), C.body, T(0, 0.5, 0), 0.05);
      b.add(G.cyl(0.6, 0.6, 1.7, 8, 1, false, 0, Math.PI), C.body, T(0, 1.0, 0, 1, 1, 1, 0, 0, Math.PI / 2), 0.05);
      for (const s of [-1, 0, 1]) { b.add(G.box(0.16, 1.05, 1.26), C.band, T(s * 0.62, 0.5, 0)); b.add(G.cyl(0.63, 0.63, 0.16, 8, 1, false, 0, Math.PI), C.band, T(s * 0.62, 1.0, 0, 1, 1, 1, 0, 0, Math.PI / 2)); }
      b.add(G.box(1.74, 0.1, 1.24), C.dark, T(0, 1.0, 0));
      b.add(G.box(0.36, 0.42, 0.1), C.trim, T(0, 0.9, 0.63));
      if (i >= 2) b.add(G.oct(0.22), i === 3 ? '#ffffff' : '#ff4a4a', T(0, 1.45, 0.45, 1, 1, 0.5));
      if (i === 3) for (const s of [-1, 1]) b.add(G.cone(0.16, 0.5, 4), '#ffe0ff', T(s * 0.75, 1.55, 0, 1, 1, 1, 0, 0, -s * 0.4));
    }, 12));
    // ---- autels de bénédiction ----
    this.shrine = mk(b => {
      b.add(G.cyl(1.05, 1.25, 0.3, 8), '#8a9ab0', T(0, 0.15, 0), 0.06);
      b.add(G.cyl(0.7, 0.9, 0.3, 8), '#a8b8cc', T(0, 0.45, 0), 0.06);
      b.add(G.cyl(0.35, 0.45, 0.9, 6), '#c8d4e4', T(0, 1.05, 0), 0.06);
      b.add(G.cyl(0.6, 0.45, 0.2, 6), '#a8b8cc', T(0, 1.55, 0));
      for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + 0.4; b.add(G.box(0.18, 0.9, 0.18), '#9aaac0', T(Math.cos(a) * 1.0, 0.75, Math.sin(a) * 1.0)); b.add(G.oct(0.12), '#4fd0ff', T(Math.cos(a) * 1.0, 1.3, Math.sin(a) * 1.0)); }
    }, 8);
    this.crystal = mk(b => { b.add(G.oct(0.5), (x, y) => (y > 0 ? '#bff0ff' : '#4fb8ff'), T(0, 0, 0, 0.7, 1.4, 0.7), 0.1); }, 8, glowy, { color: true });
    // ---- totems de défi ----
    this.totem = {};
    const wood = '#7a5030', dk = '#3a2418';
    this.totem.horde = mk(b => { // poteau de bois couvert de crânes, bannière orange
      b.add(G.cyl(0.32, 0.42, 3.4, 6), wood, T(0, 1.7, 0)); b.add(G.cyl(0.9, 1.1, 0.35, 7), '#6a6a72', T(0, 0.17, 0));
      for (let i = 0; i < 3; i++) { const y = 1.2 + i * 0.85; b.add(G.ico(0.38, 1), '#f2e8d2', T(0, y, 0.3)); b.add(G.box(0.12, 0.14, 0.06), dk, T(0.13, y, 0.64)); b.add(G.box(0.12, 0.14, 0.06), dk, T(-0.13, y, 0.64)); }
      b.add(G.box(1.6, 0.12, 0.12), wood, T(0, 3.2, 0)); b.add(G.box(1.2, 1.1, 0.06), '#ff8a3a', T(0.1, 2.6, -0.2));
      for (const s of [-1, 1]) b.add(G.cone(0.14, 0.6, 4), '#f2e8d2', T(s * 0.85, 3.4, 0, 1, 1, 1, 0, 0, -s * 0.5));
    }, 2, lowpoly(), { color: true });
    this.totem.fureur = mk(b => { // obélisque sombre à cornes rouges
      b.add(G.cyl(0.9, 1.1, 0.4, 6), '#4a3a44', T(0, 0.2, 0));
      b.add(G.cyl(0.3, 0.6, 3.2, 4), '#3a2a34', T(0, 2.0, 0, 1, 1, 1, 0, Math.PI / 4), 0.08);
      b.add(G.oct(0.4), '#ff3a5a', T(0, 2.6, 0.32, 1, 1.4, 0.6));
      for (const s of [-1, 1]) { b.add(G.cone(0.22, 1.2, 5), '#e8dcc8', T(s * 0.55, 3.6, 0, 1, 1, 1, 0, 0, -s * 0.7)); }
      b.add(G.cone(0.35, 0.8, 4), '#ff3a5a', T(0, 3.9, 0));
    }, 2, lowpoly(), { color: true });
    this.totem.elite = mk(b => { // pilier de cristal violet couronné d'or
      b.add(G.cyl(0.95, 1.15, 0.4, 8), '#6a5a8a', T(0, 0.2, 0));
      b.add(G.cyl(0.4, 0.55, 2.6, 6), '#8a6ac8', T(0, 1.7, 0), 0.06);
      b.add(G.oct(0.55), '#d0a0ff', T(0, 3.3, 0, 1, 1.5, 1));
      b.add(G.cyl(0.55, 0.45, 0.3, 8), '#ffd54a', T(0, 3.95, 0));
      for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; b.add(G.cone(0.12, 0.4, 4), '#ffd54a', T(Math.cos(a) * 0.45, 4.25, Math.sin(a) * 0.45)); b.add(G.oct(0.06), '#ff4a6a', T(Math.cos(a) * 0.5, 3.95, Math.sin(a) * 0.5)); }
    }, 2, lowpoly(), { color: true });
    this.totem.maudit = mk(b => { // chaudron maudit et totem tordu, vapeur verte
      b.add(G.cyl(0.95, 0.75, 0.9, 8), '#2a3a38', T(0, 0.5, 0), 0.08);
      b.add(G.cyl(0.85, 0.85, 0.12, 8), '#5ae8b8', T(0, 0.92, 0));
      b.add(G.cyl(0.12, 0.18, 3.0, 5), '#4a3a2a', T(-0.75, 1.6, -0.4, 1, 1, 1, 0.1, 0, 0.15));
      b.add(G.ico(0.4, 1), '#c8ffe0', T(-0.95, 3.2, -0.35)); b.add(G.box(0.1, 0.12, 0.05), '#1a2a28', T(-0.83, 3.25, 0.0)); b.add(G.box(0.1, 0.12, 0.05), '#1a2a28', T(-1.05, 3.25, 0.0));
      for (let i = 0; i < 3; i++) { const a = i / 3 * TAU; b.add(G.box(0.18, 0.4, 0.18), '#2a3a38', T(Math.cos(a) * 0.65, 0.12, Math.sin(a) * 0.65)); }
    }, 2, lowpoly(), { color: true });
    // ---- autel du boss : dalle, pilier, crâne aux yeux rouges ----
    this.altarBase = mk(b => {
      b.add(G.cyl(3.3, 3.6, 0.35, 8), '#5a5060', T(0, 0.17, 0), 0.06);
      b.add(G.cyl(2.3, 2.6, 0.35, 8), '#6e6474', T(0, 0.5, 0), 0.06);
      for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + Math.PI / 4; b.add(G.box(0.5, 2.2, 0.5), '#4a4250', T(Math.cos(a) * 2.6, 1.1, Math.sin(a) * 2.6)); b.add(G.cone(0.4, 0.5, 4), '#ff3a2a', T(Math.cos(a) * 2.6, 2.45, Math.sin(a) * 2.6, 1, 1, 1, 0, Math.PI / 4)); }
      b.add(G.cyl(0.8, 1.0, 1.4, 6), '#7a707e', T(0, 1.35, 0), 0.06);
    }, 1);
    this.skull = mk(b => {
      b.add(G.ico(1.05, 1), '#f2e8d2', T(0, 0.95, 0, 1, 0.92, 1), 0.06);
      b.add(G.box(1.1, 0.5, 0.9), '#e8dcc4', T(0, 0.25, 0.25));
      for (const s of [-1, 1]) { b.add(G.box(0.36, 0.36, 0.2), '#1a0a10', T(s * 0.38, 0.95, 0.86)); b.add(G.cone(0.2, 0.9, 5), '#e8dcc4', T(s * 0.95, 1.6, 0, 1, 1, 1, 0, 0, -s * 0.9)); }
      b.add(G.box(0.18, 0.24, 0.12), '#1a0a10', T(0, 0.6, 0.94));
      for (let i = -2; i <= 2; i++) b.add(G.box(0.14, 0.18, 0.06), '#ffffff', T(i * 0.18, 0.3, 0.72));
    }, 1, lowpoly(), { color: true });
    // ---- portail : dalles, arche de pierre ----
    this.portalBase = mk(b => {
      b.add(G.cyl(3.6, 3.9, 0.3, 10), '#4a4a5e', T(0, 0.15, 0), 0.06);
      b.add(G.cyl(2.8, 3.0, 0.3, 10), '#5e5e78', T(0, 0.42, 0), 0.06);
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; b.add(G.box(0.6, 0.12, 0.6), '#7ae8ff', T(Math.cos(a) * 3.3, 0.33, Math.sin(a) * 3.3, 1, 1, 1, 0, -a)); }
    }, 1);
    this.arch = mk(b => {
      for (const s of [-1, 1]) {
        b.add(G.box(0.85, 4.4, 0.85), '#6a6a86', T(s * 2.45, 2.4, 0), 0.06);
        b.add(G.box(1.15, 0.4, 1.15), '#4a4a5e', T(s * 2.45, 0.4, 0));
        for (let k = 0; k < 3; k++) b.add(G.box(0.3, 0.3, 0.1), '#7ae8ff', T(s * 2.45, 1.3 + k * 1.1, 0.45));
      }
      for (let i = 0; i <= 8; i++) { const a = Math.PI * i / 8, x = Math.cos(a) * 2.45, y = 4.6 + Math.sin(a) * 1.3; b.add(G.box(0.9, 0.7, 0.9), i % 2 ? '#6a6a86' : '#5a5a74', T(x, y, 0, 1, 1, 1, 0, 0, a - Math.PI / 2), 0.06); }
      b.add(G.oct(0.45), '#7ae8ff', T(0, 6.3, 0.2, 1, 1.3, 0.6));
    }, 1);
    // tourbillons du portail et de l'arrivée (disques verticaux tournés vers la caméra)
    const sw = (c0, c1, c2, add) => {
      const m = new THREE.MeshBasicMaterial({ map: canvasTex(swirlTex(c0, c1, c2)), transparent: true, depthWrite: false, fog: false, blending: add ? ADD : THREE.NormalBlending, side: THREE.DoubleSide });
      this.mats.push(m);
      const me = new THREE.Mesh(new THREE.CircleGeometry(1, 28), m); me.visible = false; me.renderOrder = 4; sc.add(me); return me;
    };
    this.sw1 = sw('#2a0a6a', '#8a3aff', '#f0e0ff', false); this.sw2 = sw('#1a3aaa', '#5ae8ff', '#ffffff', true);
    this.ar1 = sw('#3a1a8a', '#a05aff', '#ffffff', true); this.ar2 = sw('#1a3aaa', '#5ae8ff', '#ffffff', true);
    // couronnes de runes au sol (autel rouge, portail cyan)
    const rr = (tex, add) => { const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, blending: add ? ADD : THREE.NormalBlending }); this.mats.push(m); const g = new THREE.PlaneGeometry(2, 2); g.rotateX(-Math.PI / 2); const me = new THREE.Mesh(g, m); me.visible = false; me.renderOrder = 2; sc.add(me); return me; };
    this.altarRunes = rr(runeRing('#ff3a2a', '#ffd0b0'), true);
    this.portalRunes = rr(runeRing('#7ae8ff', '#ffffff', 16), true);
    this.portalSwirlG = rr(canvasTex(swirlTex('#3a1a8a', '#a05aff', '#e8f4ff')), true);
    this.altarSwirl = rr(canvasTex(swirlTex('#6a0a14', '#ff3a2a', '#ffd8a0')), true);
    this.pools = [this.gem, this.coin, this.heart, this.magnet, this.chestB, this.chestBo, this.chestP, this.chestPo, ...this.loot, this.shrine, this.crystal, ...Object.values(this.totem), this.altarBase, this.skull, this.portalBase, this.arch];
    this.suck = [];
    this.arrival = 1.6;
    this.arenaT = 0; this.arenaPrev = null; this.arenaFall = null;
  }

  onEvent(ev) {
    if (ev.type === 'worldStart') this.arrival = Math.max(this.arrival, 1.4);
    else if (ev.type === 'arena') this.arenaT = 0;
  }

  update(dt) {
    const run = this.run, p = run.p, t = this.gfx.t, fx = this.fx, cx = this.gfx.cam.x, cy = this.gfx.cam.y;
    for (const P of this.pools) P.begin();
    const near = (x, y, m = 0) => x > cx - 480 - m && x < cx + 480 + m && y > cy - 1050 - m && y < cy + 700 + m;
    // ---- ramassables ----
    for (const it of run.pickups) {
      if (it.type === 'loot') { if (near(it.x, it.y, 200) || it.hidden) this.drawLoot(it); continue; }
      if (!near(it.x, it.y)) continue;
      const bob = Math.sin(t * 4 + it.x * 0.05) * 0.12, X = it.x * S, Z = it.y * S;
      if (it.type === 'xp') {
        const v = it.v, k = v >= 30 ? 3 : v >= 10 ? 2 : v >= 3 ? 1 : 0, s = 0.75 + k * 0.22;
        const i = this.gem.put(X, 0.55 + bob + k * 0.08, Z, t * 2 + (it.spin || 0), s);
        this.gem.tint(i, col(GEM[k]));
        if (k >= 1 || it.pull) fx.glow3(X, 0.6 + k * 0.08, Z, 1.2 + k * 0.5, GEM[k], k >= 2 ? 0.55 : 0.35);
        fx.shadow(it.x, it.y, 12 + k * 3, 0.22);
      } else if (it.type === 'gold') {
        this.coin.put(X, 0.6 + bob, Z, t * 5 + (it.spin || it.x), 0.9);
        fx.shadow(it.x, it.y, 13, 0.22);
      } else if (it.type === 'heart') {
        const s = 1.05 + Math.sin(t * 8) * 0.08;
        this.heart.put(X, 0.85 + bob, Z, Math.sin(t * 2) * 0.5, s);
        fx.glow3(X, 0.85, Z, 2.4, '#ff4a6a', 0.45); fx.shadow(it.x, it.y, 18, 0.25);
      } else if (it.type === 'magnet') {
        this.magnet.put(X, 0.9 + bob, Z, t * 2, 1.2);
        fx.glow3(X, 0.9, Z, 2.4, '#4fb8ff', 0.5); fx.shadow(it.x, it.y, 18, 0.25);
      }
    }
    // ---- coffres d'amélioration et d'élite ----
    for (const [arr, gold] of [[run.chests, false], [run.dropChests, true]]) for (const c of arr) {
      if (!near(c.x, c.y, 60)) continue;
      const P = gold ? (c.open ? this.chestPo : this.chestP) : (c.open ? this.chestBo : this.chestB);
      if (!c.open) {
        const d = Math.hypot(c.x - p.x, c.y - p.y), hop = d < 140 ? Math.abs(Math.sin(t * 6)) * 0.25 : 0;
        P.put(c.x * S, hop, c.y * S, 0.25, 1.35 * (1 + hop * 0.1), 1.35 * (1 - hop * 0.12), 1.35 * (1 + hop * 0.1));
        fx.glow3(c.x * S, 0.8, c.y * S, gold ? 4.2 : 3.2, gold ? '#c06aff' : '#5aa8ff', gold ? 0.55 : 0.35 + Math.sin(t * 3) * 0.08);
        fx.ringAt(c.x, c.y, 34, gold ? '#c06aff' : '#ffd54a', 0.5, 0.08, 0.08, 1, t * 0.3, 10, 0.4, 0.4);
        if (Math.sin(t * 2.3 + c.x) > 0.93) fx.sparkle(c.x + rand(-14, 14), c.y, 30, '#fff4b0');
      } else P.put(c.x * S, 0, c.y * S, 0.25, 1.35);
      fx.shadow(c.x, c.y, 40, 0.3);
    }
    // ---- autels de bénédiction ----
    for (const s of run.shrines) {
      if (!near(s.x, s.y, 80)) continue;
      this.shrine.put(s.x * S, 0, s.y * S, 0.3, 1);
      const bob = Math.sin(t * 2.4 + s.x) * 0.18, i = this.crystal.put(s.x * S, 2.5 + bob, s.y * S, s.used ? 0 : t * 1.5, 1.2);
      this.crystal.tint(i, col(s.used ? '#6a6a7a' : '#ffffff'));
      fx.shadow(s.x, s.y, 56, 0.3);
      fx.ringAt(s.x, s.y, 58, s.used ? '#a0a0b4' : '#4fd0ff', s.used ? 0.25 : 0.6, 0.045, 0, 1, -t * 0.25, 18, 0.5, 0.3);
      if (!s.used) {
        fx.glow3(s.x * S, 2.5 + bob, s.y * S, 2.6 + s.charge * 2.6, '#4fd0ff', 0.32 + s.charge * 0.4);
        if (s.charge > 0) { fx.ringAt(s.x, s.y, 58, '#4fd0ff', 0.22, 0.001, 1, 1, 0, 0, 0, 0, false, 0.06); fx.ringAt(s.x, s.y, 58 * s.charge, '#4fd0ff', 0.22, 0.001, 1, 1); this.chargeArc(s.x, s.y, 58, s.charge, '#4fd0ff'); }
      }
    }
    // ---- totems de défi ----
    for (const T0 of run.totems || []) {
      if (!near(T0.x, T0.y, 120)) continue;
      const c = TOTEMS[T0.kind]?.color || '#ffffff', P = this.totem[T0.kind] || this.totem.horde;
      const ch = T0.charge, w = ch > 0 && !T0.used ? Math.sin(t * 30) * 0.03 * ch : 0;
      const i = P.put(T0.x * S, 0, T0.y * S, 0.2, 1.25 * (1 + w), 1.25 * (1 - w), 1.25 * (1 + w));
      P.tint(i, col(T0.used ? '#7a7a8a' : '#ffffff'));
      fx.shadow(T0.x, T0.y, 50, 0.3);
      if (T0.used) { fx.ringAt(T0.x, T0.y, 55, '#9696aa', 0.3, 0.04); continue; }
      fx.glow3(T0.x * S, 2.4, T0.y * S, 5.5 + ch * 3, c, 0.28 + ch * 0.4 + Math.sin(t * 2.5 + T0.x) * 0.06);
      fx.ringAt(T0.x, T0.y, 55, c, 0.13, 0.001, 1, 1, 0, 0, 0, 0, false, 0.06);
      fx.ringAt(T0.x, T0.y, 55, c, 0.8, 0.05, 0, 1, -t * 0.25, 16, 0.5, 0.3);
      if (ch > 0) { fx.ringAt(T0.x, T0.y, 55 * ch, c, 0.25, 0.001, 1, 1); this.chargeArc(T0.x, T0.y, 55, ch, c); }
      if (Math.random() < 0.06 + ch * 0.5) fx.stars.push({ x: T0.x + rand(-40, 40), y: T0.y + rand(-20, 20), z: rand(0, 40), vx: 0, vy: 0, vz: rand(30, 60), life: rand(0.6, 1), max: 1, c, s: 1 });
    }
    this.drawAltar(dt);
    this.drawPortal(dt);
    this.drawArena(dt);
    this.drawArrival(dt);
    for (const P of this.pools) P.end();
  }

  // anneau de charge (autel, portail, totems) : arc épais qui fait le tour
  chargeArc(x, y, R, k, c) {
    const fx = this.fx;
    fx.ringAt(x, y, R + 1, '#14081e', 0.5, 0.16, 0, k, -Math.PI / 2, 0, 0, 0, false, 0.08);
    fx.ringAt(x, y, R, c, 1, 0.12, 0, k, -Math.PI / 2, 0, 0, 0.8, false, 0.09);
    const a1 = -Math.PI / 2 + k * TAU;
    fx.glow(x + Math.cos(a1) * R, y + Math.sin(a1) * R, 4, 16, c, 0.9);
  }

  drawLoot(it) {
    const run = this.run, t = this.gfx.t, fx = this.fx, tier = clamp(it.tier | 0, 0, 3), c = LOOT_GLOW[tier];
    const age = it.t0 != null && it.t0 > 0 ? run.time - it.t0 : 9;
    let up = 0, sx = 1, sy = 1;
    if (age >= 0 && age < 0.6) { const k = age / 0.6; up = Math.sin(k * Math.PI) * 70 * (1 - k * 0.3); sx = sy = 0.5 + 0.5 * easeOut(k); }
    else if (age >= 0.6 && age < 0.8) { const k = Math.sin((age - 0.6) / 0.2 * Math.PI); sx = 1 + k * 0.22; sy = 1 - k * 0.18; }
    else { const ph = (t * 1.2 + it.x * 0.013) % 2.4; if (ph < 0.4) { const k = Math.sin(ph / 0.4 * Math.PI); up = k * 6; sx = 1 - k * 0.05; sy = 1 + k * 0.07; } }
    const X = it.x * S, Z = it.y * S, s = 1.05;
    this.loot[tier].put(X, up * S, Z, 0.3 + Math.sin(t * 0.8 + it.x) * 0.15, s * sx, s * sy, s * sx);
    fx.shadow(it.x, it.y, 46 * sx, 0.32);
    fx.glow3(X, 1 + up * S, Z, 3.5 + tier * 0.9, c, 0.35 + 0.12 * tier + Math.sin(t * 3 + it.x) * 0.08);
    if (tier >= 2) fx.spin(fx.ry, X, 1 + up * S, Z + 0.3, 5 + tier * 1.2, t * 0.7, tier === 3 ? '#ffb0f0' : '#fff0a0', 0.45 + 0.08 * tier);
    if (tier >= 2 || it.hidden) fx.beam(it.x, it.y, 26 + tier * 6, 160 + tier * 50, c, 0.4 + 0.08 * tier);
    if (Math.random() < 0.035 + 0.05 * tier) fx.sparkle(it.x + rand(-18, 18), it.y, 14 + up + rand(-6, 20), Math.random() < 0.5 ? '#ffffff' : c);
  }

  drawAltar(dt) {
    const run = this.run, A = run.altar, t = this.gfx.t, fx = this.fx, p = run.p, Po = run.portal;
    const R1 = this.altarRunes, SW = this.altarSwirl;
    R1.visible = SW.visible = false;
    if (!A || (Po && Math.hypot(Po.x - A.x, Po.y - A.y) < 40)) return;
    const X = A.x * S, Z = A.y * S;
    if (Math.abs(A.x - this.gfx.cam.x) > 700 || Math.abs(A.y - this.gfx.cam.y) > 1200) return;
    this.altarBase.put(X, 0, Z, Math.PI / 8, 1);
    fx.shadow(A.x, A.y, 150, 0.3);
    if (A.used) { const i = this.skull.put(X, 1.6, Z + 0.3, 0.4, 0.8, 0.5, 0.8); this.skull.tint(i, col('#8a8278')); return; }
    const ch = A.charge, d = Math.hypot(p.x - A.x, p.y - A.y), nr = clamp(1 - (d - 100) / 450, 0, 1);
    const sh = ch > 0.05 ? Math.sin(t * 50) * ch * 0.08 : 0;
    const i = this.skull.put(X + sh, 2.05 + Math.sin(t * 2) * 0.06, Z, 0, 1.15);
    this.skull.tint(i, col('#ffffff'));
    // yeux rouges, lueur, runes, tourbillon de charge
    for (const s of [-1, 1]) fx.glow3(X + sh + s * 0.44, 3.15, Z + 1.05, 0.9 + ch * 0.8 + nr * 0.3, '#ff3a1a', 0.7 + nr * 0.3 + ch * 0.3);
    fx.glow3(X, 3, Z, 6 + ch * 4, '#ff2a1a', 0.2 + nr * 0.2 + ch * 0.35);
    R1.visible = true; R1.position.set(X, 0.75, Z); R1.scale.setScalar(4.6); R1.rotation.y = -t * 0.12;
    R1.material.opacity = clamp(0.3 + nr * 0.35 + ch * 0.35 + Math.sin(t * 3) * 0.08, 0, 1);
    if (ch > 0) { SW.visible = true; SW.position.set(X, 0.78, Z); SW.scale.setScalar(2.8 * (0.45 + ch * 0.55)); SW.rotation.y = t * (2 + ch * 7); SW.material.opacity = 0.45 + ch * 0.55; }
    fx.ringAt(A.x, A.y, A.R + 16, '#ff5a46', 0.35 + nr * 0.45, 0.035, 0, 1, -t * 0.3, 20, 0.5, 0.3);
    if (ch > 0) this.chargeArc(A.x, A.y, A.R + 16, ch, '#ff4a3a');
    if (Math.random() < 0.12 + nr * 0.15 + ch * 0.6) fx.stars.push({ x: A.x + rand(-70, 70), y: A.y + rand(-40, 40), z: rand(10, 40), vx: rand(-10, 10), vy: 0, vz: rand(30, 70), life: rand(0.6, 1.1), max: 1.1, c: Math.random() < 0.5 ? '#ff5a3a' : '#ffb04a', s: 1 });
  }

  drawPortal(dt) {
    const run = this.run, P = run.portal, t = this.gfx.t, fx = this.fx;
    this.sw1.visible = this.sw2.visible = this.portalRunes.visible = this.portalSwirlG.visible = false;
    if (!P) { this.suck.length = 0; return; }
    const s = backOut(clamp(P.t / 0.9, 0, 1)), ch = P.charge, X = P.x * S, Z = P.y * S;
    if (Math.abs(P.x - this.gfx.cam.x) > 900 || Math.abs(P.y - this.gfx.cam.y) > 1500) return;
    this.portalBase.put(X, 0, Z, 0, s);
    this.arch.put(X, 0, Z - 0.6, 0, 1, s, 1);
    fx.shadow(P.x, P.y, 160, 0.25);
    // tourbillons
    const cy = 3.6 * s, sp = 1 + ch * 3;
    for (const [m, r, v, o] of [[this.sw1, 2.15, -2.2, 0.98], [this.sw2, 1.6, 3.1, 0.75]]) {
      m.visible = s > 0.02; m.position.set(X, cy, Z - 0.55); m.scale.set(r * s, r * 1.3 * s, 1); m.rotation.set(0, 0, t * v * sp); m.material.opacity = o;
    }
    fx.glow3(X, cy, Z - 0.3, 9 * s + ch * 3, '#a05aff', 0.5 + ch * 0.3);
    fx.glow3(X, cy, Z - 0.2, 2.6 * s, '#ffffff', 0.5 + Math.sin(t * 6) * 0.2);
    fx.glow3(X, 6.3 * s, Z - 0.4, 1.6 + Math.sin(t * 4) * 0.3, '#5ae8ff', 0.85);
    // sol : tourbillon, runes, anneau pointillé, charge
    const G1 = this.portalSwirlG, R1 = this.portalRunes;
    G1.visible = R1.visible = true;
    G1.position.set(X, 0.6, Z); G1.scale.setScalar(3 * s); G1.rotation.y = t * (1.6 + ch * 6); G1.material.opacity = 0.75;
    R1.position.set(X, 0.62, Z); R1.scale.setScalar(4.2 * s); R1.rotation.y = -t * 0.25; R1.material.opacity = 0.6 + Math.sin(t * 3) * 0.25;
    fx.ringAt(P.x, P.y, (P.R + 22) * s, '#c8f0ff', 0.45 + Math.sin(t * 5) * 0.2, 0.04, 0, 1, t * 0.4, 20, -0.6, 0.4);
    if (ch > 0) this.chargeArc(P.x, P.y, P.R + 22, ch, '#7ae8ff');
    // grande colonne de lumière visible de loin
    const pulse = Math.sin(t * 2.5) * 0.08, k = clamp(P.t / 0.9, 0, 1);
    fx.beam(P.x, P.y, 150, 1100, '#b06aff', (0.35 + pulse) * k);
    fx.beam(P.x, P.y, 50, 900, '#7ae8ff', (0.5 + pulse) * k);
    // étincelles aspirées
    while (this.suck.length < 30) this.suck.push({ a: Math.random() * TAU, d: rand(60, 170), v: rand(30, 70), c: Math.random() < 0.4 ? '#7ae8ff' : Math.random() < 0.5 ? '#c08aff' : '#ffffff', s: rand(4, 9) });
    for (const q of this.suck) {
      q.d -= q.v * dt * (1 + (1 - q.d / 170) * 2.5) * (1 + ch * 2); q.a += dt * (1.5 + 50 / Math.max(10, q.d));
      if (q.d < 6) { q.d = rand(110, 170); q.a = Math.random() * TAU; }
      const a = clamp(q.d / 30, 0, 1) * clamp((170 - q.d) / 30, 0, 1);
      fx.glow3(X + Math.cos(q.a) * q.d * S, cy + Math.sin(q.a) * q.d * S * 0.8, Z - 0.3, q.s * 2 * S * 2, q.c, a);
    }
  }

  // arène du boss : l'extérieur s'assombrit, mur de lumière rouge et runes tout autour
  drawArena(dt) {
    const run = this.run, A = run.arena, t = this.gfx.t, fx = this.fx;
    if (A) {
      this.arenaT += dt;
      this.arenaPrev = { x: A.x, y: A.y, R: A.R };
      const k = backOut(clamp(this.arenaT / 0.5, 0, 1)), R = A.R * (1 + 0.5 * (1 - k));
      // obscurité au-delà du mur (grand anneau plein)
      const Rout = 2600;
      fx.rg.ring(A.x * S, 0.11, A.y * S, Rout * S, col('#1e0614'), 0.36 * clamp(this.arenaT * 3, 0, 1), 1, 0.001, 1, 0, 0, 0, 0, R / Rout);
      fx.ringAt(A.x, A.y, R + 6, '#1e0c18', 0.6, clamp(26 / R, 0.01, 0.2), 0, 1, 0, 0, 0, 0, false, 0.12);
      fx.ringAt(A.x, A.y, R, '#ff3a28', 0.5 + Math.sin(t * 4) * 0.15, clamp(16 / R, 0.01, 0.2), 0, 1, 0, 0, 0, 0.8, true, 0.13);
      fx.ringAt(A.x, A.y, R - 10, '#ffe0c8', 0.8, clamp(7 / R, 0.005, 0.1), 0, 1, t * 0.07, 44, 0.15, 0.6, true, 0.14);
      this.wall(A, k, 0.42);
      if (Math.random() < 0.5) { const an = Math.random() * TAU; fx.stars.push({ x: A.x + Math.cos(an) * A.R, y: A.y + Math.sin(an) * A.R, z: 4, vx: 0, vy: 0, vz: rand(40, 90), life: 0.8, max: 0.8, c: '#ffb08a', s: 1 }); }
    } else if (this.arenaPrev) { // boss vaincu : le mur s'effondre
      const F = this.arenaFall = { ...this.arenaPrev, t: 0 };
      for (let i = 0; i < 40; i++) { const a = i / 40 * TAU; fx.stars.push({ x: F.x + Math.cos(a) * F.R, y: F.y + Math.sin(a) * F.R, z: 20, vx: Math.cos(a) * 160, vy: Math.sin(a) * 110, vz: 120, g: 200, life: 0.7, max: 0.7, c: '#ff8a5a', s: 1.6 }); }
      this.arenaPrev = null;
    }
    const F = this.arenaFall;
    if (F) { F.t += dt; const k = F.t / 0.7; if (k >= 1) this.arenaFall = null; else this.wall(F, 1 - easeOut(k), 0.42 * (1 - k)); }
  }
  wall(W, hk, a) {
    const fx = this.fx, t = this.gfx.t, n = 64, w = TAU * W.R / n * 1.35, cx = this.gfx.cam.x, cy = this.gfx.cam.y;
    for (let i = 0; i < n; i++) {
      const an = i / n * TAU, x = W.x + Math.cos(an) * W.R, y = W.y + Math.sin(an) * W.R;
      if (Math.abs(x - cx) > 520 || y - cy > 700 || cy - y > 1100) continue;
      const h = (60 + Math.sin(t * 3 + i * 0.7) * 14) * hk;
      fx.beam(x, y, w, h, '#ff3a2a', a * (0.75 + Math.sin(t * 5 + i * 2.1) * 0.25));
    }
  }

  // arrivée dans un monde : le tourbillon se referme derrière le héros
  drawArrival(dt) {
    const p = this.run.p, t = this.gfx.t;
    this.ar1.visible = this.ar2.visible = false;
    if (this.arrival <= 0) return;
    this.arrival -= dt;
    const k = clamp(this.arrival / 1.3, 0, 1), s = k < 0.85 ? easeOut(k / 0.85) : 1;
    if (s < 0.01) return;
    const X = p.x * S, Y = 2, Z = p.y * S - 0.3;
    for (const [m, r, v, o] of [[this.ar1, 3, -5, 0.6], [this.ar2, 2.2, 7, 0.45]]) { m.visible = true; m.position.set(X, Y, Z); m.scale.set(r * s, r * 1.3 * s, 1); m.rotation.set(0, 0, t * v); m.material.opacity = o * s; }
    this.fx.beam(p.x, p.y, 120 * s, 560, '#c08aff', 0.5 * s);
  }

  dispose() {
    for (const P of this.pools) P.dispose();
    this.root.traverse(o => o.geometry?.dispose());
    this.root.parent?.remove(this.root);
    for (const m of this.mats) { m.map?.dispose(); m.dispose(); }
  }
}
