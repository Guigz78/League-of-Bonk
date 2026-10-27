// Effets 3D : tirs du héros et des monstres, coups d'épée, rayons, éclairs, ondes de choc, alertes au sol,
// bombes et météores, particules (étincelles, étoiles, fumée, éclats, confettis), colonnes de lumière,
// ombres. Tout est instancié (quelques appels de dessin pour des centaines d'objets) ; rien n'est alloué
// par objet et par image. Ne modifie jamais la partie.
import { THREE, S, TAU, PITCH, clamp, rand, easeOut, backOut, col, shade, Build, G, T, lowpoly, Pool, RingPool, LanePool, alphaMat, ADD, TX, billboardGeo, pillarGeo, flatGeo } from './kit.js';
import { TOTEMS } from '../data.js';
import { LOOT_GLOW } from './tex2d.js';
import { initC1, eventC1, frameC1 } from './fx-c1.js'; // champions C1 (Nyx, Sora, Ragnar)

const SWEEP_ARC = 3.5;
const PRISM = ['#ff7ad8', '#7ae8ff', '#ffe45a', '#9aff8a']; // prisme solaire : une couleur par rayon
const VX = 0, VY = -Math.sin(PITCH), VZ = -Math.cos(PITCH); // direction du regard de la caméra (fixe)
const UPX = 0, UPY = Math.cos(PITCH), UPZ = -Math.sin(PITCH); // « haut » de l'écran dans le monde
const W = '#ffffff';

export class Fx {
  constructor(gfx) {
    this.gfx = gfx; this.run = gfx.run;
    const sc = this.root = new THREE.Group();
    gfx.scene.add(sc);
    this.mats = [];
    const basic = o => { const m = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, fog: false, ...o }); this.mats.push(m); return m; };
    const amat = o => { const m = alphaMat(o); this.mats.push(m); return m; };
    // ---- formes partagées ----
    this.sh = new Pool(sc, flatGeo(), amat({ map: TX.shadow(), color: 0x000000 }), 900, { alpha: true, order: -1 });
    this.dec = new Pool(sc, flatGeo(), amat({ map: TX.soft() }), 100, { alpha: true, color: true, order: -1 });
    this.rg = new RingPool(sc, 360, THREE.NormalBlending, 1);
    this.ra = new RingPool(sc, 260, ADD, 3);
    this.ln = new LanePool(sc, 60, 1);
    this.gl = new Pool(sc, billboardGeo(), basic({ map: TX.glow(), blending: ADD }), 1100, { color: true, order: 6 });
    this.st = new Pool(sc, billboardGeo(), basic({ map: TX.star(), blending: ADD }), 500, { color: true, order: 7 });
    this.pf = new Pool(sc, billboardGeo(), amat({ map: TX.puff() }), 260, { color: true, alpha: true, order: 5 });
    this.bm = new Pool(sc, pillarGeo(), basic({ map: TX.beam(), blending: ADD, side: THREE.DoubleSide }), 160, { color: true, order: 6 });
    const lg = new THREE.PlaneGeometry(1, 1); lg.translate(0.5, 0, 0);
    this.sk = new Pool(sc, lg, basic({ map: TX.streak(), blending: ADD, side: THREE.DoubleSide }), 700, { color: true, order: 7 });
    this.ry = new Pool(sc, new THREE.PlaneGeometry(1, 1), basic({ map: TX.rays(), blending: ADD, side: THREE.DoubleSide }), 12, { color: true, order: 4 });
    const cube = new THREE.BoxGeometry(1, 1, 1);
    const lam = new THREE.MeshLambertMaterial({ color: 0xffffff }); this.mats.push(lam);
    this.cu = new Pool(sc, cube, lam, 900, { color: true });
    const unlit = new THREE.MeshBasicMaterial({ color: 0xffffff }); this.mats.push(unlit);
    this.cuB = new Pool(sc, cube, unlit, 300, { color: true });
    // ---- projectiles ----
    const mk = (f, cap, mat = lowpoly(), o = {}) => { const b = new Build(3); f(b); return new Pool(sc, b.geo(), mat, cap, o); };
    this.arrow = mk(b => { b.add(G.box(1.5, 0.09, 0.09), '#c8a070', T(0, 0, 0)); b.add(G.cone(0.16, 0.42, 4), '#e8f0ff', T(0.9, 0, 0, 1, 1, 1, 0, 0, -Math.PI / 2)); b.add(G.box(0.36, 0.04, 0.26), '#ff6a5a', T(-0.62, 0, 0)); b.add(G.box(0.36, 0.26, 0.04), '#ffffff', T(-0.62, 0, 0)); }, 240);
    this.dagger = mk(b => { b.add(G.box(0.85, 0.06, 0.24), '#e8eef8', T(0.25, 0, 0)); b.add(G.cone(0.13, 0.32, 4), '#ffffff', T(0.82, 0, 0, 1, 1, 0.4, 0, 0, -Math.PI / 2)); b.add(G.box(0.1, 0.1, 0.5), '#e6b422', T(-0.2, 0, 0)); b.add(G.box(0.34, 0.1, 0.1), '#6a3a2a', T(-0.42, 0, 0)); }, 240);
    this.boom = mk(b => { for (let i = 0; i < 3; i++) { const a = i / 3 * TAU; b.add(G.box(1.1, 0.1, 0.32), i ? '#f4f0e0' : '#e6b422', T(Math.cos(a) * 0.45, 0, Math.sin(a) * 0.45, 1, 1, 1, 0, -a + 0.3)); } b.add(G.cyl(0.22, 0.22, 0.16, 6), '#e6b422', T()); }, 40);
    this.snow = mk(b => { b.add(G.ico(0.6, 1), '#ffffff', T(), 0.05); b.add(G.ico(0.35, 0), '#e0f0ff', T(0.25, 0.3, 0.1), 0.05); }, 40);
    this.crys = mk(b => { b.add(G.oct(1), '#bfeaff', T(0, 0, 0, 2.2, 0.8, 0.8), 0.15); b.add(G.oct(0.6), '#ffffff', T(0.5, 0, 0, 2, 0.6, 0.6)); }, 8, basic({ vertexColors: true, transparent: true, opacity: 0.92, depthWrite: true }));
    this.orb = mk(b => { b.add(G.ico(0.42, 1), '#f0e0ff', T(), 0.05); }, 24, basic({ vertexColors: true, transparent: false, depthWrite: true }));
    this.eball = mk(b => { b.add(G.ico(0.5, 1), '#ff2a5a', T(), 0.04); }, 340, basic({ vertexColors: true, transparent: false, depthWrite: true }));
    this.ecore = mk(b => { b.add(G.ico(0.3, 0), '#ffe0ea', T(-0.08, 0.12, 0.12)); }, 340, basic({ vertexColors: true, transparent: false, depthWrite: true }));
    this.shroom = mk(b => { b.add(G.cyl(0.18, 0.24, 0.45, 6), '#f4ead8', T(0, 0.22, 0)); b.add(G.sph(0.5, 7, 3), '#ffffff', T(0, 0.45, 0, 1, 0.75, 1), 0.04); for (let k = 0; k < 5; k++) { const a = k * 1.3; b.add(G.ico(0.08, 0), '#ffffff', T(Math.cos(a) * 0.32, 0.72, Math.sin(a) * 0.32)); } }, 60, lowpoly(), { color: true });
    this.rock = mk(b => { b.add(G.dode(0.8), '#5a3a2a', T(), 0.15, 0.18); b.add(G.dode(0.35), '#8a6a4a', T(-0.3, 0.45, 0.3), 0.1, 0.1); }, 30);
    this.mball = mk(b => { b.add(G.ico(0.45, 1), '#2a2a38', T(), 0.08); b.add(G.cyl(0.08, 0.08, 0.25, 5), '#8a6a3a', T(0, 0.48, 0)); }, 30);
    this.mnd = mk(b => { b.add(G.sph(1, 8, 3), '#7a5a3a', T(0, 0, 0, 1, 0.5, 1), 0.15, 0.1); for (let k = 0; k < 5; k++) { const a = k * 1.25; b.add(G.dode(0.22), '#5a4028', T(Math.cos(a) * 0.9, 0.08, Math.sin(a) * 0.9), 0.1, 0.2); } }, 40, lowpoly(), { color: true });
    // éclats de glace qui jaillissent du sol (givre, blizzard), teintés par instance
    this.shard = mk(b => {
      b.add(G.oct(0.5), (x, y) => (y > 0.75 ? '#f4fcff' : y > 0.35 ? '#a8e2ff' : '#6ec0f0'), T(0, 0.7, 0, 0.6, 1.9, 0.6), 0.22);
      b.add(G.oct(0.4), (x, y) => (y > 0.4 ? '#e8f8ff' : '#7ac8f4'), T(0.3, 0.35, 0.1, 0.5, 1.3, 0.5, 0, 0, -0.55), 0.1);
      b.add(G.oct(0.3), '#bfeaff', T(-0.25, 0.25, -0.08, 0.45, 0.9, 0.45, 0, 0, 0.6), 0.1);
    }, 120, basic({ vertexColors: true, transparent: false, depthWrite: true }), { color: true }); // non éclairés : la glace reste vive
    // mur des ondes de choc : anneau vertical (dégradé terre → lumière)
    const wg = new THREE.CylinderGeometry(1, 1, 1, 48, 1, true); wg.translate(0, 0.5, 0);
    this.wave = new Pool(sc, wg, basic({ map: waveTex(), side: THREE.DoubleSide, blending: THREE.NormalBlending }), 24, { order: 4 });
    // bulle de protection
    this.bubble = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), basic({ color: col('#a8d8ff'), blending: ADD, opacity: 0.25 }));
    this.bubble.visible = false; sc.add(this.bubble);
    this.pools = [this.sh, this.dec, this.rg, this.ra, this.ln, this.gl, this.st, this.pf, this.bm, this.sk, this.ry, this.cu, this.cuB, this.arrow, this.dagger, this.boom, this.snow, this.crys, this.orb, this.eball, this.ecore, this.shroom, this.rock, this.mball, this.mnd, this.wave, this.shard];
    // particules propres au rendu
    this.sparks = []; this.stars = []; this.puffs = []; this.debris = []; this.rings = []; this.pillars = []; this.bursts = []; this.bolts = []; this.rays = []; this.decals = []; this.teles = []; this.embers = [];
    this.halos = []; this.shards = []; this.orbPrev = []; this.evoW = {}; this.hitN = 0;
    // orbes de sang du vol de vie : réserve fixe réutilisée en boucle (aucune allocation pendant la partie)
    this.blood = Array.from({ length: 24 }, () => ({ on: 0, t: 0, max: 0.45, ax: 0, ay: 0, az: 0, cx: 0, cy: 0, cz: 0 }));
    this.bloodI = 0; this.bloodHit = 0;
    this.lvl = 0; this.evo = 0;
    this.tc = new THREE.Color();
    // arrivée dans le monde par le portail
    const p = this.run.p;
    for (let i = 0; i < 3; i++) this.rings.push({ x: p.x, y: p.y, r0: 10, r1: 150 + i * 70, t: -i * 0.12, max: 0.7, c: i ? '#c06aff' : '#7ae8ff', w: 7 });
    this.c1 = initC1(this); // champions C1 : ultimes, haches de Ragnar, fureur, danse des ombres (fx-c1.js)
  }

  // ---------- Petits outils ----------
  shadow(x, y, w, a = 0.35, h = 0.06) { const i = this.sh.put(x * S, h, y * S, 0, w * S, 1, w * S * 0.82); this.sh.alpha(i, a); }
  // anneau au sol (px) : rayon R, couleur, opacité, épaisseur w (0..1), remplissage, arc, départ, tirets, vitesse, cœur blanc
  ringAt(x, y, R, c, a = 1, w = 0.12, fill = 0, arc = 1, a0 = 0, dash = 0, speed = 0, core = 0.6, add = false, h = 0.07) {
    (add ? this.ra : this.rg).ring(x * S, h, y * S, R * S, col(c), a, fill, w, arc, a0, dash, speed, core);
  }
  glow(x, y, h, r, c, a = 1) { const i = this.gl.put(x * S, h * S, y * S, 0, r * 2 * S); this.gl.tint(i, col(c), a); }
  glow3(X, Y, Z, s, c, a = 1) { const i = this.gl.put(X, Y, Z, 0, s); this.gl.tint(i, col(c), a); }
  star(x, y, h, r, c, a = 1) { const i = this.st.put(x * S, h * S, y * S, 0, r * 2 * S); this.st.tint(i, col(c), a); }
  beam(x, y, w, h, c, a = 1, base = 0) { const i = this.bm.put(x * S, base * S, y * S + 0.2, 0, w * S, h * S, 1); this.bm.tint(i, col(c), a); }
  // trait lumineux entre deux points 3D (unités), largeur w, toujours face à la caméra
  line(ax, ay, az, bx, by, bz, w, c, a = 1) {
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    let ux = dy * VZ - dz * VY, uy = dz * VX - dx * VZ, uz = dx * VY - dy * VX;
    const ul = Math.hypot(ux, uy, uz) || 1; ux *= w / ul; uy *= w / ul; uz *= w / ul;
    const i = this.sk.putB(ax, ay, az, dx, dy, dz, ux, uy, uz, -VX, -VY, -VZ);
    this.sk.tint(i, col(c), a);
  }
  // quad face caméra tourné dans le plan de l'écran (rayons, confettis…)
  spin(P, X, Y, Z, s, r, c, a = 1, sy = s) {
    const cr = Math.cos(r), sr = Math.sin(r);
    const i = P.putB(X, Y, Z, cr * s, sr * s * UPY, sr * s * UPZ, -sr * sy, cr * sy * UPY, cr * sy * UPZ, -VX, -VY, -VZ);
    P.tint(i, col(c), a);
    return i;
  }
  puff(x, y, n, r, a = 0.7, c = null) {
    for (let i = 0; i < n && this.puffs.length < 220; i++) {
      const an = Math.random() * TAU, v = rand(20, 70) + r;
      this.puffs.push({ x: x + Math.cos(an) * r * 0.3, y: y + Math.sin(an) * r * 0.2, z: rand(2, 10), vx: Math.cos(an) * v, vy: Math.sin(an) * v * 0.5, vz: rand(10, 40), s: rand(0.45, 0.8) * Math.max(6, r * 0.5), life: rand(0.3, 0.5), max: 0.5, a: a * 0.6, c: c || '#ffffff' });
    }
  }
  sparkle(x, y, h, c) { if (this.stars.length < 300) this.stars.push({ x, y, z: h, vx: 0, vy: 0, vz: 30, life: 0.35, max: 0.35, c, s: 1 }); }
  burstStars(x, y, h, n, c, v = 260) {
    for (let i = 0; i < n && this.stars.length < 320; i++) {
      const a = Math.random() * TAU, s = rand(0.3, 1) * v;
      this.stars.push({ x, y, z: h, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.7, vz: rand(40, 200), g: 300, life: rand(0.4, 0.8), max: 0.8, c: Math.random() < 0.3 ? W : c, s: rand(1.2, 2.2) });
    }
  }
  rockBurst(x, y, n, c, v = 200) {
    for (let i = 0; i < n && this.debris.length < 160; i++) {
      const a = Math.random() * TAU, s = rand(0.3, 1) * v;
      this.debris.push({ x, y, z: rand(4, 20), vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6, vz: rand(180, 420), r: rand(3, 7), c: col(c), rot: Math.random() * TAU, vr: rand(-12, 12), life: rand(0.9, 1.4) });
    }
  }
  // éclats colorés d'un monstre qui meurt (petits cubes façon voxel)
  chunks(e) {
    const n = e.boss ? 26 : e.elite ? 14 : 6, pal = e.def.pal, h = e.r * 1.2 + e.fly;
    for (let i = 0; i < n && this.debris.length < 200; i++) {
      const a = Math.random() * TAU, s = rand(60, 200) * (e.boss ? 1.6 : 1);
      this.debris.push({ x: e.x, y: e.y, z: h * rand(0.4, 1), vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.7, vz: rand(150, 380), r: rand(2.5, 5) * (e.boss ? 2 : e.elite ? 1.4 : 1), c: col(pal[i % 3]), rot: Math.random() * TAU, vr: rand(-14, 14), life: rand(0.5, 0.9) });
    }
  }
  confetti() {
    const p = this.run.p, cols = ['#ffd54a', '#ff6ad8', '#5ae87a', '#4fb8ff', '#ff7a4a', W];
    const an = Math.random() * TAU, v = rand(150, 480);
    this.debris.push({ x: p.x, y: p.y, z: 40, vx: Math.cos(an) * v, vy: Math.sin(an) * v * 0.7, vz: rand(250, 600), r: 4, c: col(cols[(Math.random() * cols.length) | 0]), rot: Math.random() * TAU, vr: rand(-16, 16), life: rand(1.2, 2), conf: 1, g: 500 });
  }
  decal(x, y, r, c, a) { if (this.decals.length > 90) this.decals.shift(); this.decals.push({ x, y, r, c: col(c), a, life: 9 }); }
  ring(x, y, r0, r1, c, w = 8, max = 0.5, t = 0, h = 0) { this.rings.push({ x, y, r0, r1, t, max, c, w, h }); }

  // ---------- Événements ----------
  onEvent(ev) {
    const run = this.run, p = run.p;
    if (this.c1 && eventC1(this, ev)) return; // champions C1
    switch (ev.type) {
      case 'hit': {
        const e = ev.e, h = e.r * 1.2 + e.fly;
        if (this.sparks.length < 200) for (let i = 0; i < (ev.crit ? 7 : 3); i++) {
          const a = Math.random() * TAU, v = rand(140, 320) * (ev.crit ? 1.4 : 1);
          this.sparks.push({ x: e.x, y: e.y, z: h, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6, vz: rand(-60, 200), life: rand(0.12, 0.25), max: 0.25, c: ev.crit ? '#ffd54a' : ev.color || W, w: ev.crit ? 3 : 2 });
        }
        // éclair d'impact blanc (bref) sur le monstre touché ; coup critique : étoile jaune, onde et éclats
        if (this.hitN < 14 && this.stars.length < 300 && !ev.quiet) { this.hitN++; this.stars.push({ x: e.x + rand(-4, 4), y: e.y + 2, z: h * 0.8, vx: 0, vy: 0, vz: 0, life: 0.1, max: 0.1, c: W, s: 1.1 + Math.min(1, e.r / 30) }); }
        if (ev.crit) {
          this.stars.push({ x: e.x, y: e.y, z: h + 6, vx: 0, vy: 0, vz: 40, life: 0.28, max: 0.28, c: '#fff6a0', s: 3.6 });
          this.glowPulse(e.x, e.y, h, 34, '#ffe48a');
        }
        break;
      }
      case 'weaponEvolve': this.weaponEvoFx(ev); break;
      case 'combo': this.comboFx(ev); break;
      case 'miniBoss': this.miniFx(ev.e); break;
      case 'miniDeath': this.miniDeathFx(ev); break;
      case 'swarm': for (let i = 0; i < 2; i++) this.ring(p.x, p.y, 520, 160, i ? '#ffffff' : '#ff4a3a', i ? 5 : 8, 0.7, -i * 0.12); break;
      case 'kill': {
        const e = ev.e;
        this.decal(e.x, e.y, e.r * (e.boss ? 1.6 : 1.1), shade(e.def.pal[1], -0.3), 0.45);
        this.puff(e.x, e.y, e.boss ? 14 : e.elite ? 8 : 4, e.r * 0.7, 0.7);
        this.chunks(e);
        if (e.elite || e.boss) this.bursts.push({ x: e.x, y: e.y, h: e.r, r: e.r * (e.boss ? 5 : 3), t: 0, max: e.boss ? 0.8 : 0.45, c: e.boss ? '#ffe48a' : '#d08aff' });
        else this.ring(e.x, e.y, e.r * 0.4, e.r * 1.8, '#ffffff', 5, 0.25);
        break;
      }
      case 'jump': this.puff(p.x, p.y, 4, 8, 0.5); break;
      case 'land': this.puff(p.x, p.y, 6, 10, 0.5); this.ring(p.x, p.y, 8, 40, '#ffffff', 4, 0.25); break;
      case 'levelup': this.lvl = 1; this.bursts.push({ x: p.x, y: p.y, h: 20, r: 70, t: 0, max: 0.5, c: '#ffe48a' }); this.burstStars(p.x, p.y, 30, 14, '#ffe48a', 200); this.ring(p.x, p.y, 10, 120, '#ffe48a', 8, 0.5); this.halo('#ffe48a', 3); break;
      case 'evolve': this.evolveFx(ev); break;
      case 'pickup':
        if (ev.kind === 'loot') { this.lootFx(ev); break; }
        if (ev.kind !== 'xp' || Math.random() < 0.4) this.sparkle(p.x + rand(-8, 8), p.y + rand(-4, 4), 22 + rand(-6, 6), ev.kind === 'gold' ? '#ffd54a' : ev.kind === 'heart' ? '#ff6a8a' : '#8ad8ff');
        break;
      case 'bossSummon': this.summonFx(ev); break;
      case 'arena': this.ring(ev.x, ev.y, ev.R * 1.5, ev.R, '#ff4a3a', 12, 0.45); break;
      case 'bossPhase': {
        const e = ev.e, c = ev.phase >= 3 ? '#ff2a2a' : '#ff9a3a';
        for (let i = 0; i < 3; i++) this.ring(e.x, e.y, e.r, 260 + i * 90, c, 10, 0.6, -i * 0.14);
        this.pillars.push({ x: e.x, y: e.y, w: e.r * 3, h: 420, t: 0, max: 0.9, c });
        this.burstStars(e.x, e.y, e.r, 18, c, 340);
        break;
      }
      case 'bossDeath':
        for (let i = 0; i < 4; i++) this.ring(ev.x, ev.y, 20, 300 + i * 120, i % 2 ? W : '#ffd54a', 12, 0.8, -i * 0.1);
        this.pillars.push({ x: ev.x, y: ev.y, w: 200, h: 900, t: 0, max: 1.4, c: '#ffe48a' });
        this.burstStars(ev.x, ev.y, 40, 40, '#ffd54a', 520);
        this.rockBurst(ev.x, ev.y, 18, '#8a7a6a', 260);
        break;
      case 'portalOpen':
        this.ring(ev.x, ev.y, 10, 240, '#c06aff', 10, 0.7); this.ring(ev.x, ev.y, 10, 160, '#7ae8ff', 8, 0.6, -0.2);
        this.pillars.push({ x: ev.x, y: ev.y, w: 140, h: 900, t: 0, max: 1.6, c: '#b06aff' });
        this.burstStars(ev.x, ev.y, 50, 30, '#c8a0ff', 380);
        break;
      case 'portalEnter': { const P = run.portal; if (P) { this.ring(P.x, P.y, 140, 10, W, 8, 0.55); this.burstStars(P.x, P.y, 56, 26, '#bff8ff', 260); } break; }
      case 'totem': {
        const c = TOTEMS[ev.kind]?.color || W;
        for (let i = 0; i < 3; i++) this.ring(ev.x, ev.y, 20, 150 + i * 70, i === 1 ? W : c, 9, 0.6, -i * 0.12);
        this.pillars.push({ x: ev.x, y: ev.y, w: 90, h: 520, t: 0, max: 1, c });
        this.burstStars(ev.x, ev.y, 60, 24, c, 300);
        break;
      }
      case 'lootDrop': this.puff(ev.x, ev.y, 5, 12, 0.6); this.ring(ev.x, ev.y, 6, 60, LOOT_GLOW[ev.tier] || W, 5, 0.4, -0.5); break;
      case 'overtime': for (let i = 0; i < 3; i++) this.ring(p.x, p.y, 30, 360 + i * 120, '#ff3a2a', 12, 0.8, -i * 0.15); break;
      case 'legend': this.legendFx(ev); break;
      case 'lifesteal': this.bloodOrbs(ev); break;
      case 'block': this.ring(p.x, p.y, 20, 46, '#a8d8ff', 5, 0.3, 0, 20); break;
      case 'dodge': this.puff(p.x, p.y, 4, 10, 0.4, '#d8f0ff'); break;
      case 'chest': this.bursts.push({ x: ev.x, y: ev.y, h: 16, r: 120, t: 0, max: 0.7, c: '#ffd54a' }); this.burstStars(ev.x, ev.y, 20, 16, '#ffd54a', 220); break;
      case 'shrine': this.bursts.push({ x: ev.x, y: ev.y, h: 20, r: 160, t: 0, max: 0.9, c: '#4fd0ff' }); this.pillars.push({ x: ev.x, y: ev.y, w: 70, h: 360, t: 0, max: 0.9, c: '#4fd0ff' }); break;
      case 'impact': case 'explode':
        this.decal(ev.x, ev.y, ev.R * 0.75, '#1a1020', 0.4);
        this.puff(ev.x, ev.y, ev.type === 'explode' ? 12 : 7, ev.R * 0.5, 0.8, ev.type === 'explode' ? '#ffd0a0' : null);
        this.bursts.push({ x: ev.x, y: ev.y, h: 4, r: ev.R * 1.3, t: 0, max: 0.35, c: ev.type === 'explode' ? '#ff9a4a' : '#ffd0a0' });
        this.rockBurst(ev.x, ev.y, ev.type === 'explode' ? 6 : 4, '#6a5a52', 160);
        break;
      case 'emerge': this.decal(ev.x, ev.y, ev.R * 0.6, '#2a1a10', 0.4); this.puff(ev.x, ev.y, 10, ev.R * 0.5, 0.8, '#c8a888'); this.rockBurst(ev.x, ev.y, 8, '#7a5a3a', 200); break;
      case 'burrow': this.puff(ev.x, ev.y, 6, 20, 0.7, '#c8a888'); break;
      case 'blink': this.puff(ev.fromX, ev.fromY, 6, 18, 0.6, '#c8a0ff'); this.puff(ev.x, ev.y, 6, 18, 0.6, '#c8a0ff'); break;
      case 'enemyStomp': case 'bossStomp': this.decal(ev.x, ev.y, ev.e.r * 1.4, '#1a1020', 0.3); this.puff(ev.x, ev.y, 10, ev.e.r, 0.8, '#d8c8b0'); this.rockBurst(ev.x, ev.y, 6, '#7a6a5a', 180); break;
      case 'enemyTelegraph':
        if (['dash', 'strafe', 'charge', 'stomp', 'mortar'].includes(ev.kind)) this.teles.push({ ...ev, t: 0 });
        break;
      case 'ult':
        this.bursts.push({ x: p.x, y: p.y, h: 20, r: ev.kind === 'nova' ? 320 : 260, t: 0, max: 0.6, c: ev.kind === 'crystal' ? '#9ad8ff' : '#ffe48a' });
        for (let i = 0; i < 2; i++) this.ring(p.x, p.y, 20, ev.kind === 'nova' ? 340 : 260, i ? W : ev.kind === 'crystal' ? '#9ad8ff' : '#ffd54a', 12, 0.6, -i * 0.1);
        this.pillars.push({ x: p.x, y: p.y, w: 120, h: 600, t: 0, max: 0.8, c: ev.kind === 'crystal' ? '#9ad8ff' : '#ffe48a' });
        break;
      case 'revive': this.bursts.push({ x: p.x, y: p.y, h: 20, r: 280, t: 0, max: 0.7, c: '#5ae87a' }); this.pillars.push({ x: p.x, y: p.y, w: 120, h: 600, t: 0, max: 1, c: '#5ae87a' }); break;
      case 'win': for (let i = 0; i < 90; i++) this.confetti(); break;
      case 'split': this.puff(ev.x, ev.y, 4, 12, 0.5); break;
    }
  }
  glowPulse(x, y, h, r, c) { this.bursts.push({ x, y, h, r, t: 0, max: 0.18, c, noRing: true }); }

  summonFx(ev) {
    const run = this.run, A = run.altar;
    this.pillars.push({ x: ev.x, y: ev.y, w: 150, h: 700, t: 0, max: 1.3, c: '#ff3a2a' });
    for (let i = 0; i < 3; i++) this.ring(ev.x, ev.y, 20, 220 + i * 110, i === 1 ? '#ffb04a' : '#ff3a2a', 12, 0.7, -i * 0.13);
    this.decal(ev.x, ev.y, 70, '#1a0810', 0.5);
    this.puff(ev.x, ev.y, 16, 50, 0.9, '#5a2a3a');
    this.rockBurst(ev.x, ev.y, 20, '#6a5a52', 260);
    if (A && !ev.auto && Math.hypot(A.x - ev.x, A.y - ev.y) < 400) {
      this.rockBurst(A.x, A.y, 12, '#f2e8d2', 200);
      this.bolts.push({ pts: zigzag(A.x * S, 2.7, A.y * S, ev.x * S, 3, ev.y * S, 9, 1.3), t: 0, max: 0.5, c: '#ff4a3a', w: 0.5 });
    }
  }
  lootFx(ev) {
    const c = LOOT_GLOW[ev.v] || W;
    this.ring(ev.x, ev.y, 10, 90 + ev.v * 20, c, 7, 0.45);
    this.burstStars(ev.x, ev.y, 16, 14 + ev.v * 6, c, 240);
    this.pillars.push({ x: ev.x, y: ev.y, w: 50 + ev.v * 14, h: 260 + ev.v * 80, t: 0, max: 0.6, c });
  }
  evolveFx(ev) {
    const p = this.run.p, k = clamp((ev.evo || 1) / 4, 0, 1), c = ev.aura || '#ffe48a';
    this.evo = 1.4 + k * 0.8; this.evoC = c;
    this.bursts.push({ x: p.x, y: p.y, h: 20, r: 120 + 110 * k, t: 0, max: 0.8, c: '#ffe48a' });
    for (let i = 0; i < 2 + (ev.evo || 1); i++) this.ring(p.x, p.y, 20, 160 + 90 * i * (0.6 + k), i % 2 ? W : c, 8 + 4 * k, 0.7, -i * 0.12);
    this.pillars.push({ x: p.x, y: p.y, w: 60 + 60 * k, h: 400 + 500 * k, t: 0, max: 1 + k * 0.6, c });
    this.burstStars(p.x, p.y, 24, 16 + 30 * k, c, 260 + 200 * k);
    this.halo(c, 3 + Math.round(k * 2));
    if (ev.final) {
      this.rays.push({ t: 0, max: 1.8, c, s: 26 });
      for (let i = 0; i < 70; i++) this.confetti();
      for (let i = 0; i < 2; i++) this.ring(p.x, p.y, 40, 620, '#ffd54a', 16, 0.9, -0.3 - i * 0.2);
      this.rockBurst(p.x, p.y, 16, '#8a7a6a', 300);
      this.decal(p.x, p.y, 90, '#2a1a08', 0.45);
    }
  }
  // anneaux de lumière qui montent le long du héros (niveau, évolutions)
  halo(c, n = 3) { for (let i = 0; i < n; i++) this.halos.push({ t: -i * 0.12, max: 0.75, c }); }
  // couronne d'éclats de glace qui jaillissent du sol (givre)
  shardRing(x, y, R, n, c = '#ffffff', life = 0.9) {
    for (let i = 0; i < n && this.shards.length < 110; i++) {
      const a = i / n * TAU + rand(-0.15, 0.15), d = R * rand(0.75, 1.02);
      this.shards.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.95, a: rand(0, TAU), tilt: a, s: rand(0.7, 1.25) * clamp(R / 140, 0.7, 1.5), t: -i / n * 0.12, life, c: col(c) });
    }
  }
  // évolution d'arme : colonne dorée, ondes, étoiles, rayons brefs, anneaux qui montent
  weaponEvoFx(ev) {
    const p = this.run.p;
    this.bursts.push({ x: p.x, y: p.y, h: 20, r: 150, t: 0, max: 0.7, c: '#ffd54a' });
    for (let i = 0; i < 3; i++) this.ring(p.x, p.y, 20, 220 + i * 110, i === 1 ? W : '#ffb02a', 12, 0.7, -i * 0.12);
    this.pillars.push({ x: p.x, y: p.y, w: 110, h: 800, t: 0, max: 1.2, c: '#ffd54a' });
    this.burstStars(p.x, p.y, 30, 34, '#ffd54a', 420);
    this.rays.push({ t: 0, max: 1.1, c: '#ffd54a', s: 16 });
    this.halo('#ffd54a', 4);
    if (ev.id === 'frost') this.shardRing(p.x, p.y, 150, 18);
  }
  // paliers de combo : onde dorée autour du héros, de plus en plus grosse
  comboFx(ev) {
    const p = this.run.p, k = clamp(Math.log2(Math.max(1, ev.n / 25)) / 4, 0, 1), c = ev.n >= 200 ? '#ff7a2a' : ev.n >= 100 ? '#ffb02a' : '#ffd54a';
    this.ring(p.x, p.y, 20, 160 + 220 * k, c, 9 + 6 * k, 0.5);
    this.ring(p.x, p.y, 20, 110 + 160 * k, W, 6, 0.45, -0.08);
    this.burstStars(p.x, p.y, 40, 10 + Math.round(20 * k), c, 260 + 200 * k);
    if (ev.n >= 100) { this.pillars.push({ x: p.x, y: p.y, w: 70 + 50 * k, h: 500, t: 0, max: 0.8, c }); this.halo(c, 2); }
  }
  // champion de la horde : il tombe du ciel dans une colonne violette (le rendu le fait chuter) et fend le sol
  miniFx(e) {
    if (!e) return;
    e.g_mini = 1;
    this.pillars.push({ x: e.x, y: e.y, w: e.r * 4, h: 700, t: 0, max: 1.1, c: '#c06aff' });
    this.ring(e.x, e.y, e.r * 3, e.r, '#d08aff', 8, 0.45);
  }
  miniLand(e) {
    for (let i = 0; i < 3; i++) this.ring(e.x, e.y, e.r, 200 + i * 90, i === 1 ? '#ffd54a' : '#c06aff', 11, 0.65, -i * 0.12);
    this.decal(e.x, e.y, e.r * 2.2, '#1a0820', 0.5);
    this.puff(e.x, e.y, 12, e.r, 0.8, '#b8a0c8');
    this.rockBurst(e.x, e.y, 14, '#6a5a6a', 240);
    this.burstStars(e.x, e.y, e.r, 16, '#d08aff', 300);
    this.gfx.kick = Math.max(this.gfx.kick || 0, 7); // secousse propre au rendu (la partie n'est pas touchée)
  }
  miniDeathFx(ev) {
    const c = '#ffd54a';
    for (let i = 0; i < 3; i++) this.ring(ev.x, ev.y, 20, 240 + i * 100, i % 2 ? W : c, 12, 0.75, -i * 0.1);
    this.pillars.push({ x: ev.x, y: ev.y, w: 150, h: 700, t: 0, max: 1.2, c: '#e0a0ff' });
    this.bursts.push({ x: ev.x, y: ev.y, h: 30, r: 220, t: 0, max: 0.7, c });
    this.burstStars(ev.x, ev.y, 40, 32, c, 460);
    this.rockBurst(ev.x, ev.y, 14, '#8a7a6a', 260);
    for (let i = 0; i < 18 && this.debris.length < 220; i++) {
      const a = Math.random() * TAU, v = rand(120, 360);
      this.debris.push({ x: ev.x, y: ev.y, z: 30, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.7, vz: rand(300, 560), r: 4.5, c: col(i % 3 ? '#ffd54a' : '#fff0a0'), rot: Math.random() * TAU, vr: rand(-16, 16), life: rand(1, 1.5), conf: 1, g: 700 });
    }
  }
  legendFx(ev) {
    if (ev.kind === 'chain' && ev.pts) {
      const pts = [];
      ev.pts.forEach((q, i) => { if (i) { const a = ev.pts[i - 1], z = zigzag(a[0] * S, 0.9, a[1] * S, q[0] * S, 0.9, q[1] * S, 4, 0.5); pts.push(...(i > 1 ? z.slice(1) : z)); } });
      if (pts.length) this.bolts.push({ pts, t: 0, max: 0.28, c: '#7ae8ff', w: 0.35 });
    } else if (ev.kind === 'frost') { this.burstStars(ev.x, ev.y, 16, 6, '#bfeaff', 120); this.ring(ev.x, ev.y, 6, 40, '#9ad8ff', 5, 0.35); }
    else if (ev.kind === 'boom') { this.puff(ev.x, ev.y, 6, ev.R * 0.4, 0.7, '#ffd0a0'); this.ring(ev.x, ev.y, 10, ev.R, '#ffb04a', 8, 0.3); }
    else if (ev.kind === 'bubble') this.ring(ev.x, ev.y, 10, 34, '#a8d8ff', 5, 0.4, 0, 20);
  }

  // ---------- Décor des monstres (appelé par le rendu des monstres) ----------
  mound(e) {
    const w = Math.sin(this.gfx.t * 30) * 0.06, k = e.r / 16;
    const i = this.mnd.put(e.x * S, 0, e.y * S, e.bob, k * 0.9 * (1 + w), k * 0.9 * (1 - w), k * 0.9 * (1 + w));
    this.mnd.tint(i, col(this.gfx.world.T.pave[0]));
    if (Math.random() < 0.3) this.puff(e.x + rand(-10, 10) * k, e.y, 1, 6 * k, 0.4, '#b89a7a');
  }
  enemyDeco(e, up) {
    const t = this.gfx.t, run = this.run;
    const k = 1 - Math.min(0.5, (Math.max(0, e.jumpH) + e.fly) / 300);
    this.shadow(e.x, e.y, e.r * 2.3 * k, 0.32);
    if (e.boss || e.elite) {
      const R = e.r * (e.boss ? 1.25 : 1.15);
      this.ringAt(e.x, e.y, R, e.boss ? '#ff3a3a' : '#c06aff', 0.9, 0.14, 0.16, 1, 0, 0, 0, 0.5);
      if (e.elite || e.enraged) this.glow(e.x, e.y, e.r * 0.9 + up, e.r * 2.2 * (1 + Math.sin(t * 5) * 0.08), e.enraged ? '#ff3a3a' : '#d08aff', e.enraged ? 0.55 : 0.4);
      // champion : couronne d'or qui tourne au sol, lueur dorée au-dessus de la tête
      if (e.mini) {
        this.ringAt(e.x, e.y, e.r * 1.75, '#ffd54a', 0.9, 0.05, 0, 1, t * 0.7, 12, 0.6, 0.6, true);
        this.glow(e.x, e.y, e.r * 2.5 + up, e.r * 1.4 * (1 + Math.sin(t * 6) * 0.1), '#ffd54a', 0.55);
        if (Math.random() < 0.12) this.sparkle(e.x + rand(-e.r, e.r), e.y, e.r * 2 + up, '#ffe48a');
      }
    }
    const a = e.act;
    if (a && a.stage === 0 && (a.kind === 'shoot' || a.kind === 'volley')) {
      const kk = clamp(1 - a.t / a.dur, 0, 1);
      this.glow(e.x + a.dx * e.r * 1.1, e.y + a.dy * e.r * 1.1, e.r + up, 8 + kk * 16, '#ff3a6a', 0.9);
    }
    if (e.boss) {
      if (e.phase === 'intro' || e.phase === 'roar') {
        e.g_roar = (e.g_roar || 0) - this.gfx.dt;
        if (e.g_roar <= 0) { e.g_roar = 0.22; this.ring(e.x, e.y, e.r * 0.8, e.r * 3.2, e.phase === 'intro' ? '#ff4a3a' : e.enraged ? '#ff2a2a' : '#ff9a3a', 6, 0.45); }
        this.glow(e.x, e.y, e.r + up, e.r * 2.6, e.phase === 'intro' ? '#ff2a1a' : '#ff8a2a', 0.45 + Math.sin(t * 20) * 0.12);
        if (e.phase === 'intro' && Math.random() < 0.5) this.puff(e.x + rand(-e.r, e.r), e.y, 1, e.r * 0.5, 0.6, '#4a1a2a');
      }
      if (e.phase === 'ringW' || (e.phase === 'spiral' && e.spinUp > 0) || e.phase === 'summonW')
        this.glow(e.x, e.y, e.r + up, e.r * (2 + Math.sin(t * 30) * 0.3), e.phase === 'summonW' ? '#c06aff' : '#ff3a6a', 0.75);
    }
    if (e.freeze > 0 && Math.random() < 0.05) this.sparkle(e.x + rand(-e.r, e.r), e.y, e.r + up, '#bfeaff');
    if ((e.mad || (run.overtime > 0 && !e.boss)) && Math.random() < 0.02) this.sparks.push({ x: e.x, y: e.y, z: e.r * 2 + up, vx: 0, vy: 0, vz: 80, life: 0.5, max: 0.5, c: '#ff5a2a', w: 2 });
  }

  begin() { for (const P of this.pools) P.begin(); }
  end() {
    const t = this.gfx.t;
    this.rg.mat.uniforms.uT.value = t; this.ra.mat.uniforms.uT.value = t; this.ln.mat.uniforms.uT.value = t;
    for (const P of this.pools) P.end();
  }

  // ---------- Image ----------
  update(dt) {
    const run = this.run, p = run.p, t = this.gfx.t, g = this.gfx;
    this.hitN = 0;
    for (const k in this.evoW) this.evoW[k] = false;
    for (const w of p.weapons) this.evoW[w.id] = !!w.evo; // armes évoluées : effets plus riches
    this.shots(dt);
    this.gameFx(dt);
    // cible principale : marque rouge au sol (4 tirets qui tournent), le réticule est dessiné par le calque 2D
    const tg = run.target;
    if (tg && !tg.dead && !tg.burrowed && !run.dying) this.ringAt(tg.x, tg.y, tg.r * 1.45 + 6, '#ff3a3a', 0.85, 0.09, 0.05, 1, t * 1.4, 4, 0, 0.45);
    this.alerts(dt);
    this.heroFx(dt);
    frameC1(this, dt); // champions C1
    this.bloodFx(dt);
    this.particles(dt);
    // particules du jeu (éclats colorés)
    for (const q of run.parts) {
      const s = 2.6 * q.s * Math.min(1, q.life * 2) * S;
      const i = this.cu.put(q.x * S, Math.max(0.05, q.z * S), q.y * S, q.life * 9, s);
      this.cu.tint(i, col(q.c));
    }
  }

  shots(dt) {
    const run = this.run, t = this.gfx.t, p = run.p;
    // orbes qui tournent autour du héros (évolués : galaxie, anneau intérieur cyan, traînées de comète)
    const EW = this.evoW, OP = this.orbPrev;
    for (const w of p.weapons) if (w.id === 'orbs' && w.orbs) {
      const ev = w.evo, nIn = ev ? 4 : 0;
      w.orbs.forEach(([x, y], i) => {
        const inner = i < nIn, c = inner ? '#7ae8ff' : '#c08aff';
        this.orb.put(x * S, 1.3, y * S, t * 3, ev ? 1.15 : 1);
        this.glow(x, y, 26, ev ? 34 : 26, c, 0.85);
        this.shadow(x, y, 16, 0.25);
        const q = OP[i];
        if (q && Math.hypot(x - q[0], y - q[1]) < 60) { const dx = x - q[0], dy = y - q[1], l = Math.hypot(dx, dy) || 1, L = ev ? 46 : 26; this.line(x * S, 1.3, y * S, (x - dx / l * L) * S, 1.3, (y - dy / l * L) * S, ev ? 0.9 : 0.6, c, 0.55); }
        if (q) { q[0] = x; q[1] = y; } else OP[i] = [x, y];
      });
    }
    for (const s of run.shots) {
      const a = Math.atan2(s.vy || 0, s.vx || 0), y = (s.z || 26) * S;
      if (s.type === 'arrow') { this.arrow.put(s.x * S, y, s.y * S, -a, 1.1); this.line(s.x * S, y, s.y * S, (s.x - Math.cos(a) * (EW.arrows ? 60 : 40)) * S, y, (s.y - Math.sin(a) * (EW.arrows ? 60 : 40)) * S, EW.arrows ? 0.3 : 0.22, EW.arrows ? '#7ae8ff' : '#a0dcff', 0.6); }
      else if (s.type === 'dagger') { const ev = EW.daggers, L = ev ? 54 : 30; this.dagger.put(s.x * S, y, s.y * S, -a, ev ? 1.25 : 1.1); this.line(s.x * S, y, s.y * S, (s.x - Math.cos(a) * L) * S, y, (s.y - Math.sin(a) * L) * S, ev ? 0.3 : 0.18, ev ? '#ff4d6d' : W, ev ? 0.6 : 0.45); } // Mille lames : traînée de sang
      else if (s.type === 'boom' && !this.c1?.axe) { // Ragnar : haches (fx-c1.js)
        const k = (s.r || 15) / 15, ev = EW.boomerang;
        this.boom.put(s.x * S, 0.9, s.y * S, -(s.spin || 0), k * 1.1); this.glow(s.x, s.y, 18, 22 * k, '#ffd54a', 0.5); this.shadow(s.x, s.y, 26 * k, 0.25);
        // flou de rotation : disque lumineux sous la lame (tornade de lames : plus large, deux couleurs)
        this.ra.ring(s.x * S, 0.88, s.y * S, k * 1.15, col(ev ? '#ffe48a' : '#fff0c0'), ev ? 0.55 : 0.3, 0, 0.35, 0.75, -(s.spin || 0) * 1.0, 0, 0, 0.7);
        if (ev) this.ra.ring(s.x * S, 0.9, s.y * S, k * 1.3, col('#ff9a3a'), 0.4, 0, 0.12, 0.5, -(s.spin || 0) + 2, 0, 0, 0.5);
      }
      else if (s.type === 'snow') { const k = s.R / 56; this.snow.put(s.x * S, Math.max(0.3, s.z * S * 0.9 + 0.5), s.y * S, s.t * 8, 1.1 * k + 0.4); this.shadow(s.x, s.y, 28, 0.3); if (s.t > s.dur * 0.6) this.ringAt(s.tx, s.ty, s.R, '#e8f4ff', 0.35 * (s.t / s.dur), 0.1, 0.15); }
      else if (s.type === 'crystal') {
        this.crys.put(s.x * S, 1.4, s.y * S, -a, 1.3);
        this.glow(s.x, s.y, 28, 80, '#7ac8ff', 0.75);
        this.line(s.x * S, 1.4, s.y * S, (s.x - Math.cos(a) * 160) * S, 1.4, (s.y - Math.sin(a) * 160) * S, 1.4, '#9ad8ff', 0.55);
        if (Math.random() < 0.6) this.stars.push({ x: s.x + rand(-20, 20), y: s.y + rand(-14, 14), z: 28 + rand(-10, 10), vx: -s.vx * 0.1, vy: -s.vy * 0.1, vz: 0, life: 0.4, max: 0.4, c: '#bfeaff', s: 1 });
      } else if (s.type === 'pet') { this.glow(s.x, s.y, 24, 16, '#c08aff', 1); this.glow(s.x, s.y, 24, 7, W, 1); }
    }
    // tirs ennemis : boules rose vif à cœur blanc, halo et ombre (lisibles sur tous les sols)
    for (const s of run.eshots) {
      const k = (s.r || 8) / 8 * (1 + Math.sin(t * 20 + s.x) * 0.08), y = Math.max(0.5, (s.z || 20) * S * 0.6);
      this.eball.put(s.x * S, y, s.y * S, 0, k * 0.85);
      this.ecore.put(s.x * S, y, s.y * S, 0, k * 0.85);
      this.glow3(s.x * S, y, s.y * S, 2.2 * k, '#ff2a5a', 0.8);
      this.shadow(s.x, s.y, 16 * k, 0.3);
      const v = Math.hypot(s.vx, s.vy) || 1;
      this.line(s.x * S, y, s.y * S, (s.x - s.vx / v * 22) * S, y, (s.y - s.vy / v * 22) * S, 0.35 * k, '#ff4a7a', 0.5);
    }
    // champignons piégés
    for (const m of run.mines) {
      const pulse = m.arm > 0 ? 0.6 : 1 + Math.sin(t * 6 + m.x) * 0.06;
      const i = this.shroom.put(m.x * S, 0, m.y * S, m.x, pulse);
      this.shroom.tint(i, col(m.arm > 0 ? '#9aa87a' : '#e84a3a'));
      if (m.arm <= 0 && Math.sin(t * 6 + m.x) > 0.6) this.glow(m.x, m.y, 10, 16, '#8aff5a', 0.5);
    }
    // bombes : météores, obus de mortier en cloche, élites explosives
    for (const b of run.bombs) {
      if (b.kind === 'meteor' && b.t < 0.7) {
        const h = b.t / 0.7 * 420, k = 0.6 + (1 - b.t / 0.7) * 0.6, x = b.x + h * 0.25;
        this.rock.put(x * S, (h + 10) * S, b.y * S, t * 5, k);
        this.glow(x, b.y, h + 10, 34 * k, '#ff8a3a', 0.9);
        this.line(x * S, (h + 10) * S, b.y * S, (x + 60) * S, (h + 250) * S, b.y * S, 1.4 * k, '#ff7a2a', 0.8);
      } else if (b.kind === 'mortar' && b.e && !b.e.dead) {
        const k = clamp(1 - b.t / 1.1, 0, 1), x = b.e.x + (b.x - b.e.x) * k, y = b.e.y + (b.y - b.e.y) * k, h = Math.sin(k * Math.PI) * 220 + 20;
        this.mball.put(x * S, h * S, y * S, t * 6, 1);
        this.glow(x, y, h, 18, '#ffb04a', 0.7);
        this.shadow(x, y, 18, 0.3);
      } else if (b.kind === 'explode' && b.e) {
        const pulse = 0.5 + Math.sin(t * (30 - b.t * 20)) * 0.5;
        this.glow(b.x, b.y, 14, 34 + pulse * 22, '#ff7a3a', 0.8);
      }
    }
  }

  gameFx(dt) {
    const run = this.run, t = this.gfx.t, EW = this.evoW;
    for (const f of run.fx) {
      const k = 1 - f.life / f.max;
      if (f.type === 'slash') {
        // grand croissant lumineux (blanc et bleu) qui balaie devant le héros ; tourbillon du Titan : or et feu
        // couleurs imposées par l'effet (c1 cœur, c2 bord, c3 sol) : faux de Nyx, danse de Sora (champions C1)
        const ev = f.c1 ? f.evo : EW.sword, sweep = Math.min(1, k * 2.2), a0 = f.a - 1.3, R = f.r, al = 1 - k;
        this.ra.ring(f.x * S, 0.9, f.y * S, R * S, col(f.c1 || (ev ? '#ffc04a' : '#ffe9a8')), al * 0.95, 0, ev ? 0.5 : 0.42, 2.6 * sweep / TAU, a0, 0, 0, 0.9);
        this.ra.ring(f.x * S, 0.92, f.y * S, R * 1.08 * S, col(f.c2 || (ev ? '#ff7a2a' : '#9ad8ff')), al * 0.7, 0, 0.12, 2.6 * sweep / TAU, a0, 0, 0, 0.3);
        this.rg.ring(f.x * S, 0.07, f.y * S, R * S, col(f.c3 || (ev ? '#ffd54a' : '#ffffff')), al * (ev ? 0.35 : 0.25), 0, 0.4, 2.6 * sweep / TAU, a0, 0, 0, 0);
        if (!f.g_sp) {
          f.g_sp = 1;
          for (let i = 0; i < (ev ? 8 : 5); i++) { const an = a0 + Math.random() * 2.6; this.sparks.push({ x: f.x + Math.cos(an) * R * 0.9, y: f.y + Math.sin(an) * R * 0.9, z: 18, vx: Math.cos(an) * 160, vy: Math.sin(an) * 160, vz: 60, life: 0.25, max: 0.25, c: f.c1 || (ev ? '#ffb02a' : '#ffe48a'), w: 2.4 }); }
          if (ev) this.puff(f.x + Math.cos(f.a) * R * 0.6, f.y + Math.sin(f.a) * R * 0.6, 2, 14, 0.4, '#e8d8b8');
        }
      } else if (f.type === 'beam') {
        // prisme solaire (évolué) : rayons arc-en-ciel, cœur blanc
        const ev = EW.beam, w = f.w * (1 - k * 0.7), ca = Math.cos(f.a), sa = Math.sin(f.a), y = 1.1;
        const ax = f.x * S, az = f.y * S, bx = (f.x + ca * f.len) * S, bz = (f.y + sa * f.len) * S;
        const c1 = ev ? PRISM[((f.a * 2 / Math.PI + 4.2) | 0) % 4] : '#ffd54a';
        this.line(ax, y, az, bx, y, bz, w * 2.6 * S, c1, (1 - k * 0.6) * 0.8);
        this.line(ax, y, az, bx, y, bz, w * 1.1 * S, ev ? '#ffffff' : '#fff6c0', 1 - k * 0.5);
        this.line(ax, y, az, bx, y, bz, w * 0.4 * S, W, 1);
        this.ln.lane(ax, 0.08, az, f.a, f.len * S, w * 2.2 * S, col(ev ? c1 : '#ffe48a'), (1 - k) * 0.5, 0, 0.5, 0, 1, 0, 0);
        this.glow(f.x, f.y, 22, w * 1.6, ev ? '#ffffff' : '#fff0a0', 1 - k);
        if (ev) this.glow(f.x + ca * f.len, f.y + sa * f.len, 16, w * 1.4, c1, (1 - k) * 0.8);
        if (!f.g_sp) { f.g_sp = 1; for (let i = 0; i < 6; i++) { const d = Math.random() * f.len; this.sparkle(f.x + ca * d, f.y + sa * d, 22, ev ? c1 : '#fff0a0'); } }
      } else if (f.type === 'bolt') {
        // tempête divine (évoluée) : éclairs plus épais, bleutés, onde au sol
        const ev = EW.lightning;
        if (!f.g_pts) {
          f.g_pts = zigzag((f.x + rand(-40, 40)) * S, 22, f.y * S, f.x * S, 0.2, f.y * S, 8, ev ? 1.2 : 0.9);
          this.decal(f.x, f.y, ev ? 26 : 18, '#1a1020', 0.35); this.puff(f.x, f.y, 4, 14, 0.5);
          this.ring(f.x, f.y, 8, ev ? 80 : 50, ev ? '#bfe8ff' : '#fff7a0', 6, 0.25);
          if (ev && this.sparks.length < 200) for (let i = 0; i < 5; i++) { const an = Math.random() * TAU; this.sparks.push({ x: f.x, y: f.y, z: 4, vx: Math.cos(an) * 260, vy: Math.sin(an) * 180, vz: rand(80, 260), life: 0.3, max: 0.3, c: '#bfe8ff', w: 2.6 }); }
        }
        const a = 1 - k, P = f.g_pts, wk = ev ? 1.5 : 1;
        for (let i = 1; i < P.length; i++) { const [x0, y0, z0] = P[i - 1], [x1, y1, z1] = P[i]; this.line(x0, y0, z0, x1, y1, z1, 0.9 * wk, ev ? '#8ad0ff' : '#fff07a', a * 0.5); this.line(x0, y0, z0, x1, y1, z1, 0.3 * wk, W, a); }
        this.glow(f.x, f.y, 6, ev ? 70 : 50, ev ? '#bfe8ff' : '#fff7a0', a);
      } else if (f.type === 'ring') {
        // givre : couronne d'éclats de glace ; champignons : nuage toxique
        if (!f.g_sp && !f.warn) {
          f.g_sp = 1;
          if (f.color === '#9ad8ff' && f.r > 60) this.shardRing(f.x, f.y, f.r * 0.92, Math.min(22, Math.round(f.r / (EW.frost ? 11 : 16))), '#ffffff', EW.frost ? 1.1 : 0.75);
          else if (f.color === '#8aff5a') this.puff(f.x, f.y, EW.shrooms ? 8 : 5, f.r * 0.5, 0.55, '#b8f08a');
        }
        if (f.warn) {
          const kk = clamp(1 - f.life / f.max, 0, 1), blink = 0.75 + Math.sin(t * 30) * 0.25 * kk;
          this.ringAt(f.x, f.y, f.r, f.color, 0.95, 0.05, 0.16, 1, 0, 0, 0, 0.3);
          this.ringAt(f.x, f.y, f.r * kk, f.color, 0.32 * blink, 0.001, 1, 1, 0, 0, 0, 0, false, 0.075);
        } else {
          const R = f.r * (0.25 + 0.75 * (1 - (1 - k) ** 3));
          this.ringAt(f.x, f.y, R, f.color, (1 - k) * 0.9, clamp((8 * (1 - k) + 2) / R, 0.02, 0.5), 0, 1, 0, 0, 0, 0.7, true, 0.12);
          this.ringAt(f.x, f.y, R, f.color, (1 - k) * 0.18, 0.001, 1, 1, 0, 0, 0, 0, true, 0.1);
        }
      }
    }
    // cape solaire (aura)
    const aura = run.p.weapons.find(w => w.id === 'aura');
    if (aura && aura.R) {
      // disque de chaleur discret (le héros reste lisible au centre), bord pointillé qui tourne ;
      // cœur de soleil (évolué) : second anneau, langues de feu qui montent du bord
      const p = run.p, ev = aura.evo, R = aura.R * (1 + Math.sin(t * 5) * 0.03);
      this.ringAt(p.x, p.y, R, '#ff8a2a', ev ? 0.16 : 0.12, 0.001, 1, 1, 0, 0, 0, 0, true, 0.09);
      this.ringAt(p.x, p.y, R, '#ffb04a', 0.85, 0.035, 0, 1, t * 0.5, 14, 0.6, 0.5, true, 0.11);
      if (ev) this.ringAt(p.x, p.y, R * 0.62, '#ffe48a', 0.6, 0.05, 0, 1, -t * 0.8, 10, -0.8, 0.6, true, 0.11);
      if (Math.random() < (ev ? 0.9 : 0.3)) { const an = Math.random() * TAU, d = ev ? R * rand(0.85, 1) : Math.random() * R; this.sparks.push({ x: p.x + Math.cos(an) * d, y: p.y + Math.sin(an) * d, z: 2, vx: 0, vy: 0, vz: rand(40, 90) * (ev ? 1.6 : 1), life: 0.5, max: 0.5, c: Math.random() < 0.5 ? '#ffb04a' : '#ff6a2a', w: ev ? 3 : 2 }); }
      if (ev && Math.random() < 0.25 && this.puffs.length < 200) { const an = Math.random() * TAU; this.puffs.push({ x: p.x + Math.cos(an) * R * 0.95, y: p.y + Math.sin(an) * R * 0.95, z: 4, vx: 0, vy: 0, vz: 70, s: rand(7, 11), life: 0.45, max: 0.45, a: 0.45, c: '#ffb04a' }); }
    }
    // ondes de choc (à sauter) : muret de terre et de lumière qui avance
    for (const w of run.waves) {
      const a = 0.35 + 0.65 * clamp(1 - w.r / w.max, 0, 1);
      this.wave.put(w.x * S, 0, w.y * S, 0, w.r * S, 0.75 + a * 0.35, w.r * S);
      this.ringAt(w.x, w.y, w.r, '#ff9a3a', a, clamp(16 / w.r, 0.02, 0.4), 0, 1, 0, 0, 0, 0.8, true, 0.1);
      this.ringAt(w.x, w.y, w.r + 6, '#2a1408', 0.4 * a, clamp(22 / w.r, 0.02, 0.4), 0, 1, 0, 0, 0, 0, false, 0.08);
      if (Math.random() < 0.5 && this.puffs.length < 180) {
        const p = run.p, an = Math.atan2(p.y - w.y, p.x - w.x) + rand(-0.8, 0.8);
        this.puffs.push({ x: w.x + Math.cos(an) * w.r, y: w.y + Math.sin(an) * w.r, z: 4, vx: Math.cos(an) * 60, vy: Math.sin(an) * 40, vz: 30, s: rand(6, 10), life: 0.4, max: 0.4, a: 0.4, c: '#d8c0a0' });
      }
    }
    // rayon tournant du boss
    const B = run.boss;
    if (B && !B.dead && (B.phase === 'sweepW' || B.phase === 'sweep') && B.sweepLen) {
      const L = B.sweepLen, dir = B.sweepDir || 1, w = B.sweepW || 34, warn = B.phase === 'sweepW';
      const left = warn ? SWEEP_ARC : SWEEP_ARC * clamp(B.phaseT / (B.sweepDur || 2.4), 0, 1);
      const a0 = dir > 0 ? B.sweepA : B.sweepA - left, blink = warn ? 0.5 + Math.sin(t * 24) * 0.5 : 0;
      this.ringAt(B.x, B.y, L, '#ff3a2a', 1, 0.012, 0.14 + blink * 0.12, left / TAU, a0, 0, 0, 0, false, 0.07);
      this.ringAt(B.x, B.y, L, '#ff5a3c', 0.7, 0.012, 0, left / TAU, a0, 40, -2 * dir, 0.3, false, 0.075);
      if (warn) this.ln.lane(B.x * S, 0.09, B.y * S, B.sweepA, L * S, w * S, col('#ff2a1e'), 0.85, 0, 0.22 + blink * 0.3, 1, 5, 1.5, 1);
      else {
        const w2 = w * (1 + Math.sin(t * 40) * 0.06), y = 0.8, ca = Math.cos(B.sweepA), sa = Math.sin(B.sweepA);
        const ax = B.x * S, az = B.y * S, bx = (B.x + ca * L) * S, bz = (B.y + sa * L) * S;
        for (let i = 3; i >= 1; i--) { const an = B.sweepA - dir * i * 0.06; this.line(ax, y, az, (B.x + Math.cos(an) * L) * S, y, (B.y + Math.sin(an) * L) * S, w2 * 0.8 * S, '#ff5a2a', 0.25 / i); }
        this.line(ax, y, az, bx, y, bz, w2 * 2.2 * S, '#ff3a1a', 0.7);
        this.line(ax, y, az, bx, y, bz, w2 * 0.9 * S, '#ffb08a', 1);
        this.line(ax, y, az, bx, y, bz, w2 * 0.3 * S, W, 1);
        this.ln.lane(ax, 0.09, az, B.sweepA, L * S, w2 * 1.4 * S, col('#ff5a2a'), 0.5, 0, 0.4, 0, 1, 0, 0);
        this.glow(B.x, B.y, 16, w2 * 2.6, '#ff8a3a', 0.9);
        const ex = B.x + ca * L, ey = B.y + sa * L;
        this.glow(ex, ey, 14, w2 * 1.6, '#ffb04a', 1);
        if (Math.random() < 0.7) this.sparks.push({ x: ex, y: ey, z: 14, vx: rand(-200, 200), vy: rand(-200, 200), vz: rand(50, 250), life: 0.35, max: 0.35, c: '#ffd08a', w: 2.6 });
        if (Math.random() < 0.25) this.decal(B.x + ca * L * rand(0.3, 1), B.y + sa * L * rand(0.3, 1), 14, '#2a0a08', 0.3);
      }
    }
  }

  // alertes au sol : charges, piétinements, mortiers, alerte de saut
  alerts(dt) {
    const run = this.run, t = this.gfx.t, p = run.p;
    for (let i = this.teles.length - 1; i >= 0; i--) {
      const T0 = this.teles[i];
      T0.t += dt;
      if (T0.t > T0.dur + 0.05 || T0.e?.dead) { this.teles.splice(i, 1); continue; }
      const e = T0.e, k = clamp(T0.t / T0.dur, 0, 1);
      if (T0.kind === 'dash' || T0.kind === 'strafe' || T0.kind === 'charge') {
        if (!e) continue;
        if (e.act && e.act.stage !== 0 && T0.kind !== 'charge') continue;
        if (T0.kind === 'charge' && e.phase !== 'aim') continue;
        const w = e.r * (T0.kind === 'charge' ? 1.5 : 1.25), dx = T0.kind === 'charge' ? e.dashX : T0.dx, dy = T0.kind === 'charge' ? e.dashY : T0.dy;
        this.ln.lane(e.x * S, 0.09, e.y * S, Math.atan2(dy, dx), T0.R * S, w * S, col('#ff3a3a'), 0.95, k, 0.16, 1, 4, 1.4, 1);
      } else if (T0.kind === 'stomp' && e) {
        const R = T0.R, pulse = 0.5 + Math.sin(t * 22) * 0.5, r = Math.min(R, e.r + (R - e.r) * k);
        this.ringAt(e.x, e.y, r, '#ffaa46', 0.55 + pulse * 0.45, clamp(8 / r, 0.02, 0.3), 0.1 + pulse * 0.08, 1, 0, 0, 0, 0.5);
        this.ringAt(e.x, e.y, R, '#ff7a2a', 0.5, 0.02, 0, 1, t * 0.4, 24, 0.5, 0, false, 0.065);
      } else if (T0.kind === 'mortar') {
        const r = 14 + (1 - k) * 18;
        this.ringAt(T0.x, T0.y, r, '#ff5050', 0.95, 0.18, 0.15, 1, 0, 0, 0, 0.4);
        this.ln.lane((T0.x - r - 8) * S, 0.1, T0.y * S, 0, (r * 2 + 16) * S, 3 * S, col('#ff5050'), 0.9, 1, 0.8, 0, 1, 0, 0);
        this.ln.lane(T0.x * S, 0.1, (T0.y - r - 8) * S, Math.PI / 2, (r * 2 + 16) * S, 3 * S, col('#ff5050'), 0.9, 1, 0.8, 0, 1, 0, 0);
      }
    }
  }

  // héros : colonne du niveau, rayons de l'évolution, invincibilité, bulle
  heroFx(dt) {
    const run = this.run, p = run.p, t = this.gfx.t;
    if (this.lvl > 0) { this.lvl -= dt * 1.6; const a = Math.max(0, this.lvl); this.beam(p.x, p.y, 44 + (1 - a) * 20, 160, '#ffe48a', a * 0.9); }
    // rayons derrière le héros (évolution) : assez petits pour qu'on le voie encore au milieu
    if (this.evo > 0) {
      this.evo -= dt;
      const a = Math.min(1, this.evo), evo = p.evo | 0;
      this.spin(this.ry, p.x * S, 1.2, p.y * S + 0.5, (7 + evo * 1.5), t * 1.5, evo >= 4 && run.cls.id === 'archer' ? '#96f0ff' : '#ffe48a', 0.45 * a);
    }
    for (const r of this.rays) { r.t += dt; const k = r.t / r.max, a = Math.max(0, k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85); this.spin(this.ry, p.x * S, 1.2, p.y * S + 0.6, r.s || 22, t * 0.8, '#ffe680', 0.5 * a); this.glow(p.x, p.y, 24, (r.s || 22) * 3, r.c, 0.35 * a); }
    this.rays = this.rays.filter(r => r.t < r.max);
    // anneaux de lumière qui montent le long du héros
    let n = 0;
    for (const h of this.halos) {
      h.t += dt; if (h.t >= h.max) continue;
      this.halos[n++] = h;
      if (h.t < 0) continue;
      const k = h.t / h.max, e = easeOut(k);
      this.ra.ring(p.x * S, 0.15 + e * 3.6 + p.h * S, p.y * S, (1.7 - e * 0.9), col(h.c), (1 - k) * 0.95, 0, 0.16, 1, 0, 0, 0, 0.8);
    }
    this.halos.length = n;
    if (p.inv > 0.5 && !run.dying) this.glow(p.x, p.y, 22 + p.h, 40, '#fff0b0', 0.35 + Math.sin(t * 12) * 0.15);
    const B = this.bubble;
    B.visible = !!p.shieldHit && !run.dying;
    if (B.visible) { B.position.set(p.x * S, 1.2 + p.h * S, p.y * S); B.scale.setScalar(1.55 + Math.sin(t * 4) * 0.05); B.material.opacity = 0.2 + Math.sin(t * 4) * 0.06; }
  }

  // vol de vie : 2 orbes (filets de gouttes de sang) partent du monstre touché et filent en cloche vers le héros (même s'il bouge)
  bloodOrbs(ev) {
    for (let k = 0; k < 2; k++) {
      const o = this.blood[this.bloodI], a = Math.random() * TAU, r = rand(18, 46);
      this.bloodI = (this.bloodI + 1) % this.blood.length;
      o.on = 1; o.t = -k * 0.07; o.max = rand(0.36, 0.48);
      o.ax = ev.x; o.ay = ev.y; o.az = ev.h || 20; o.cx = Math.cos(a) * r; o.cy = Math.sin(a) * r * 0.7; o.cz = rand(70, 110);
    }
  }
  // courbe de Bézier : monstre -> point de contrôle (au-dessus, décalé) -> poitrine du héros ; s = avancement (0..1)
  bloodAt(o, s, hx, hy, hz, out) {
    const u = 1 - s, mx = (o.ax + hx) / 2 + o.cx, my = (o.ay + hy) / 2 + o.cy, mz = Math.max(o.az, hz) + o.cz;
    out[0] = u * u * o.ax + 2 * u * s * mx + s * s * hx; out[1] = u * u * o.ay + 2 * u * s * my + s * s * hy; out[2] = u * u * o.az + 2 * u * s * mz + s * s * hz;
  }
  bloodFx(dt) {
    const p = this.run.p, hx = p.x, hy = p.y, hz = 24 + Math.max(0, p.h), P = BP;
    for (const o of this.blood) {
      if (!o.on) continue;
      o.t += dt; if (o.t < 0) continue;
      const k = o.t / o.max;
      if (k >= 1) { o.on = 0; this.bloodHit = 0.28; continue; }
      const s = k * (0.35 + 0.65 * k); // part vite du monstre, accélère vers le héros
      // filet de gouttes de sang (petits cubes cramoisis non éclairés, façon voxel, qui tournent) avec un léger halo :
      // rien à voir avec les grosses boules roses des tirs ennemis
      for (let j = 0; j < 3; j++) {
        this.bloodAt(o, Math.max(0, s - j * 0.07), hx, hy, hz, P);
        const i = this.cuB.put(P[0] * S, P[2] * S, P[1] * S, o.t * 14 + j, (7 - j * 1.8) * S);
        this.cuB.tint(i, col(j ? '#a8001c' : '#e8102e'));
      }
      this.bloodAt(o, s, hx, hy, hz, P);
      this.glow(P[0], P[1], P[2], 9, '#ff1f3a', 0.5);
    }
    // arrivée : petit anneau cramoisi qui s'ouvre aux pieds du héros et lueur sur sa poitrine
    if (this.bloodHit > 0) {
      this.bloodHit -= dt;
      const a = clamp(this.bloodHit / 0.28, 0, 1);
      this.ringAt(hx, hy, 16 + (1 - a) * 18, '#ff3a5a', a * 0.85, 0.18, 0, 1, 0, 0, 0, 0.6, true, 0.1);
      this.glow(hx, hy, hz, 22, '#ff2a4a', a * 0.4);
    }
  }

  // particules propres au rendu
  particles(dt) {
    const g = this.gfx, t = g.t;
    // plafonds : on oublie les plus anciens (une avalanche d'événements ne doit jamais faire ramer)
    const lite = g.lite ? 0.5 : 1, cap = (a, n) => { n = Math.round(n * lite); if (a.length > n) a.splice(0, a.length - n); };
    cap(this.rings, 140); cap(this.pillars, 24); cap(this.bursts, 60); cap(this.bolts, 60); cap(this.halos, 24); cap(this.sparks, 200); cap(this.stars, 300); cap(this.puffs, 200); cap(this.debris, 200);
    // étincelles : petits traits
    let n = 0;
    for (const s of this.sparks) {
      s.life -= dt; if (s.life <= 0) continue;
      s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt; s.vz -= 500 * dt; s.vx *= 0.9; s.vy *= 0.9;
      const a = clamp(s.life / s.max, 0, 1), X = s.x * S, Y = Math.max(0.05, s.z * S), Z = s.y * S;
      this.line(X, Y, Z, X - s.vx * 0.03 * S, Y - s.vz * 0.03 * S, Z - s.vy * 0.03 * S, s.w * 0.12, s.c, a);
      this.sparks[n++] = s;
    }
    this.sparks.length = n; n = 0;
    for (const s of this.stars) {
      s.life -= dt; if (s.life <= 0) continue;
      s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt; if (s.g) s.vz -= s.g * dt; s.vx *= 0.93; s.vy *= 0.93;
      if (s.z < 2) { s.z = 2; s.vz = Math.abs(s.vz) * 0.3; }
      const a = clamp(s.life / s.max, 0, 1);
      this.star(s.x, s.y, s.z, (5 * a + 2) * (s.s || 1), s.c, a);
      this.stars[n++] = s;
    }
    this.stars.length = n; n = 0;
    for (const q of this.puffs) {
      q.life -= dt; if (q.life <= 0) continue;
      q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; q.vx *= 0.92; q.vy *= 0.92; q.vz *= 0.95;
      const k = 1 - q.life / q.max, r = q.s * (0.6 + k * 0.8);
      const i = this.pf.put(q.x * S, q.z * S, q.y * S, 0, r * 2 * S);
      this.pf.tint(i, col(q.c)); this.pf.alpha(i, q.a * (1 - k));
      this.puffs[n++] = q;
    }
    this.puffs.length = n; n = 0;
    for (const d of this.debris) {
      d.life -= dt; if (d.life <= 0) continue;
      d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt; d.vz -= (d.g || 900) * dt; d.rot += d.vr * dt;
      if (d.conf) { d.vx *= 0.98; d.vy *= 0.98; if (d.vz < -120) d.vz = -120; }
      if (d.z < 0) { d.z = 0; d.vz *= -0.35; d.vx *= 0.6; d.vy *= 0.6; d.vr *= 0.5; }
      const s = d.r * S * 2 * Math.min(1, d.life * 3);
      const i = d.conf ? this.cuB.put(d.x * S, d.z * S + 0.05, d.y * S, d.rot, s * 1.4, s * 0.25, s) : this.cu.put(d.x * S, d.z * S + s * 0.5, d.y * S, d.rot, s);
      (d.conf ? this.cuB : this.cu).tint(i, d.c);
      this.debris[n++] = d;
    }
    this.debris.length = n; n = 0;
    // anneaux qui s'étendent (ondes de choc cartoon)
    for (const r of this.rings) {
      r.t += dt; if (r.t >= r.max) continue;
      this.rings[n++] = r;
      if (r.t < 0) continue;
      const k = r.t / r.max, R = Math.max(1, r.r0 + (r.r1 - r.r0) * easeOut(k)), w = r.w * (1 - k) + 1.5;
      this.ringAt(r.x, r.y, R, r.c, 1 - k * k, clamp(w * 1.4 / R, 0.01, 0.6), 0, 1, 0, 0, 0, 0.75, true, 0.13 + (r.h || 0) * S);
      this.ringAt(r.x, r.y, R + 2, '#1a1030', (1 - k) * 0.25, clamp((w + 3) * 1.4 / R, 0.01, 0.6), 0, 1, 0, 0, 0, 0, false, 0.1);
    }
    this.rings.length = n; n = 0;
    // colonnes de lumière
    for (const c of this.pillars) {
      c.t += dt; const k = c.t / c.max; if (k >= 1) continue;
      const grow = easeOut(clamp(k * 4, 0, 1)), w = c.w * (k < 0.25 ? grow : 1 - (k - 0.25) * 0.6);
      this.beam(c.x, c.y, w, c.h * grow, c.c, 1 - k);
      this.pillars[n++] = c;
    }
    this.pillars.length = n; n = 0;
    // explosions de lumière
    for (const b of this.bursts) {
      b.t += dt; const k = b.t / b.max; if (k >= 1) continue;
      const R = b.r * (0.3 + 0.7 * (1 - (1 - k) ** 2));
      this.glow(b.x, b.y, b.h || 0, R, b.c, (1 - k) * 0.65);
      if (!b.noRing) this.ringAt(b.x, b.y, R * 0.7, b.c, (1 - k) * 0.9, clamp(6 * (1 - k) / (R * 0.7), 0.01, 0.4), 0, 1, 0, 0, 0, 0.6, true, 0.12);
      this.bursts[n++] = b;
    }
    this.bursts.length = n; n = 0;
    // éclairs (crâne → boss, foudre en chaîne)
    for (const b of this.bolts) {
      b.t += dt; if (b.t >= b.max) continue;
      const a = clamp(1 - b.t / b.max, 0, 1), P = b.pts;
      for (let i = 1; i < P.length; i++) { const [x0, y0, z0] = P[i - 1], [x1, y1, z1] = P[i]; this.line(x0, y0, z0, x1, y1, z1, b.w * 2.5, b.c, a * 0.45); this.line(x0, y0, z0, x1, y1, z1, b.w * 0.7, W, a); }
      this.bolts[n++] = b;
    }
    this.bolts.length = n; n = 0;
    // taches au sol
    for (const d of this.decals) {
      d.life -= dt; if (d.life <= 0) continue;
      const i = this.dec.put(d.x * S, 0.05, d.y * S, 0, d.r * 2.2 * S, 1, d.r * 1.6 * S);
      this.dec.tint(i, d.c); this.dec.alpha(i, d.a * clamp(d.life / 3, 0, 1));
      this.decals[n++] = d;
    }
    this.decals.length = n; n = 0;
    // éclats de glace : jaillissent, restent un instant, rentrent dans le sol
    for (const q of this.shards) {
      q.t += dt; if (q.t >= q.life) continue;
      this.shards[n++] = q;
      if (q.t < 0) continue;
      const k = q.t / q.life, up = k < 0.15 ? backOut(k / 0.15) : k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1, s = q.s * Math.max(0.01, up);
      const i = this.shard.put(q.x * S, -0.2 * (1 - up), q.y * S, q.a, s, s * 1.15, s);
      this.shard.tint(i, q.c);
      if (q.t < dt * 1.5) this.sparkle(q.x, q.y, 20, '#e8f8ff');
    }
    this.shards.length = n;
    // chrono écoulé : des braises montent autour du héros
    const run = this.run, E = this.embers;
    if (run.overtime > 0) {
      const lv = run.otLevel || 1, cx = g.cam.x, cy = g.cam.y;
      while (E.length < Math.min(60, 20 + lv * 6)) E.push({ x: cx + rand(-300, 300), y: cy + rand(-700, 500), z: rand(0, 200), v: rand(40, 110), ph: Math.random() * TAU, s: rand(0.6, 1.4) });
      for (const q of E) {
        q.z += q.v * dt; q.x += Math.sin(t * 2 + q.ph) * 20 * dt;
        if (q.z > 260 || Math.abs(q.x - cx) > 320 || q.y - cy > 520 || cy - q.y > 720) { q.x = cx + rand(-300, 300); q.y = cy + rand(-700, 500); q.z = 0; }
        this.glow(q.x, q.y, q.z, 5 * q.s, q.s > 1 ? '#ff7a2a' : '#ff3a1a', 0.6 + Math.sin(t * 6 + q.ph) * 0.3);
      }
    } else E.length = 0;
  }

  dispose() {
    for (const P of this.pools) P.dispose();
    this.root.traverse(o => o.geometry?.dispose());
    this.root.parent?.remove(this.root);
    for (const m of this.mats) m.dispose();
  }
}

const BP = [0, 0, 0]; // position d'une goutte de sang (réutilisée)

// ligne brisée d'un éclair (points 3D en unités)
export function zigzag(x0, y0, z0, x1, y1, z1, n, amp) {
  const pts = [[x0, y0, z0]], dx = x1 - x0, dz = z1 - z0, l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l;
  for (let i = 1; i < n; i++) { const k = i / n, o = (Math.random() - 0.5) * 2 * amp; pts.push([x0 + dx * k + nx * o + (Math.random() - 0.5) * amp * 0.5, y0 + (y1 - y0) * k, z0 + dz * k + nz * o]); }
  pts.push([x1, y1, z1]);
  return pts;
}

// texture du muret des ondes de choc : terre en bas, lave puis lumière blanche en haut
function waveTex() {
  const c = document.createElement('canvas'); c.width = 4; c.height = 64;
  const g = c.getContext('2d'), gr = g.createLinearGradient(0, 64, 0, 0);
  gr.addColorStop(0, 'rgba(60,30,14,.95)'); gr.addColorStop(0.35, 'rgba(160,80,30,.95)'); gr.addColorStop(0.6, 'rgba(255,150,50,.95)'); gr.addColorStop(0.8, 'rgba(255,230,140,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 4, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
