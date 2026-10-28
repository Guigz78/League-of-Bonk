// Effets 3D de l'arsenal W2 (js/arsenal-w2.js), branchés sur Fx (fx.js) par un seul appel chaque image (frameW2) :
// chauves-souris de Nyx (corps + ailes qui battent), lances et pieux de sang, cercles maudits ; shurikens de Sora, bombes
// et nuages de fumée, clones d'ombre (vrais modèles du héros, teintés et translucides). Les groupes d'instances sont créés
// au premier besoin et confiés à fx (begin / end / dispose) ; l'état des armes est lu dans W2S, les effets ponctuels dans
// run.fx (types 'w2…'). Ne modifie jamais la partie (seulement gfx.hs : geste d'attaque du héros quand il lance).
import { THREE, S, TAU, rand, clamp, backOut, col, Build, G, T, lowpoly, Pool, alphaMat, billboardGeo, TX } from './kit.js';
import { W2S } from '../arsenal-w2.js';

const IDS = new Set(['bats', 'bloodlance', 'cursering', 'shuriken', 'smoke', 'shadowclone']);
const W = '#ffffff', BLOOD = '#ff2a4a', DEEP = '#a8102e', PALE = '#ffd0d8', CURSE = '#c03aff';
const VIO = '#b06aff', MAG = '#ff3ab0', LAV = '#e0c8ff', SMOKE = '#5a4a78';
const PI = Math.PI;

function addPool(fx, build, cap, mat = lowpoly(), o = {}) { const b = new Build(11); build(b); const P = new Pool(fx.root, b.geo(), mat, cap, o); fx.pools.push(P); return P; }
function basicV(fx) { const m = new THREE.MeshBasicMaterial({ vertexColors: true }); fx.mats.push(m); return m; }
// modèles (créés au premier besoin)
const MK = {
  // chauve-souris (face à +X) : corps, tête, oreilles, yeux rouges ; les ailes sont à part (elles battent)
  bat: fx => addPool(fx, b => {
    b.add(G.sph(0.3, 6, 4), '#3a1628', T(0, 0, 0, 1.25, 0.95, 0.9));
    b.add(G.sph(0.2, 6, 4), '#4a1e34', T(0.36, 0.08, 0));
    for (const z of [-0.1, 0.1]) { b.add(G.cone(0.08, 0.24, 4), '#5a2440', T(0.36, 0.32, z)); b.add(G.box(0.07, 0.07, 0.07), '#ff3a52', T(0.55, 0.12, z * 0.8)); }
    b.add(G.cone(0.1, 0.3, 4), '#3a1628', T(-0.42, -0.02, 0, 1, 1, 1, 0, 0, PI / 2));
  }, 48),
  // ailes : silhouette de chauve-souris (doigts pointus, bord festonné), à plat ; elles battent par l'échelle (rendu)
  wing: fx => addPool(fx, b => {
    const P = [[0.16, 0.1], [0.4, 0.52], [0.1, 1.2], [-0.02, 0.86], [-0.3, 1.0], [-0.24, 0.64], [-0.52, 0.66], [-0.36, 0.36], [-0.22, 0.1]];
    const shapes = [1, -1].map(sg => new THREE.Shape(P.map(([x, y]) => new THREE.Vector2(x, y * sg))));
    const g = new THREE.ShapeGeometry(shapes); g.rotateX(-PI / 2);
    b.add(g, (x, y, z) => (Math.abs(z) > 0.75 ? '#5a0e26' : Math.abs(z) > 0.4 ? '#8a1a40' : '#a8284e'), null, 0.05);
    for (const sg of [1, -1]) b.add(G.box(1.05, 0.05, 0.05), '#2a0a18', T(0.18, 0.02, 0.62 * sg, 1, 1, 1, 0, -1.25 * sg, 0));
  }, 48),
  // lance de sang (face à +X) : hampe sombre, fer cramoisi, garde pâle à pointes
  lance: fx => addPool(fx, b => {
    b.add(G.box(1.8, 0.15, 0.15), '#5a0c1e', T(-0.25, 0, 0));
    b.add(G.cone(0.3, 0.95, 4), '#ff3a52', T(1.05, 0, 0, 0.45, 1, 1, 0, 0, -PI / 2), 0.1); // fer plat et large, vu d'en haut
    b.add(G.cone(0.15, 0.6, 4), '#ffd0d8', T(0.98, 0.07, 0, 0.3, 1, 1, 0, 0, -PI / 2));
    b.add(G.box(0.14, 0.14, 0.62), '#e8c0c8', T(0.56, 0, 0));
    for (const z of [-0.34, 0.34]) b.add(G.cone(0.08, 0.34, 4), '#e8c0c8', T(0.44, 0, z, 1, 1, 1, 0, 0, PI / 2));
    b.add(G.oct(0.2), '#ff3a52', T(-1.2, 0, 0));
  }, 24),
  // pieu de sang qui jaillit du sol (non éclairé : couleur vive)
  spike: fx => addPool(fx, b => {
    const c = (x, y) => (y > 0.6 ? '#ff9aaa' : y > 0.3 ? '#f0203e' : '#8a0c22');
    b.add(G.cone(0.22, 1.35, 5), c, T(0, 0.67, 0), 0.08);
    b.add(G.cone(0.13, 0.8, 5), c, T(0.2, 0.36, 0.08, 1, 1, 1, 0, 0, -0.45), 0.08);
  }, 140, basicV(fx)),
  // shuriken : étoile à 4 lames plates, moyeu violet percé
  star: fx => addPool(fx, b => {
    for (let i = 0; i < 4; i++) { const a = i * PI / 2; b.add(G.cone(0.2, 0.8, 4), '#e4e8f4', T(Math.cos(a) * 0.45, 0, -Math.sin(a) * 0.45, 0.3, 1, 1, 0, a, -PI / 2), 0.1); }
    b.add(G.cyl(0.24, 0.24, 0.1, 8), '#3a2a5a', T());
    b.add(G.cyl(0.09, 0.09, 0.12, 6), '#ff5ac0', T());
  }, 48),
  // bouffées de fumée (quads face caméra, transparence par instance)
  cloud: fx => { const m = alphaMat({ map: TX.puff() }); fx.mats.push(m); const P = new Pool(fx.root, billboardGeo(), m, 200, { color: true, alpha: true, order: 5 }); fx.pools.push(P); return P; },
};
const get = (st, fx, k) => st[k] || (st[k] = MK[k](fx));

// ---------- Armes en cours ----------
const DRAW = {
  bats(fx, st, w, s, t) {
    const B = get(st, fx, 'bat'), Wg = get(st, fx, 'wing'), E = w.evo, k = E ? 1.75 : 1.35;
    for (const b of s.list) {
      const a = Math.atan2(b.dy, b.dx), X = b.x * S, Y = b.z * S, Z = b.y * S, f = Math.sin(t * (b.m === 1 ? 30 : 20) + b.ph);
      B.put(X, Y, Z, -a, k);
      Wg.put(X, Y + f * 0.12 * k, Z, -a, k, k, k * (0.28 + 0.72 * Math.abs(f)));
      fx.glow(b.x, b.y, b.z, 15 * k, E ? '#ff2a4a' : '#d01a3a', 0.5); // halo cramoisi : lisible sur tous les sols
      fx.glow(b.x + Math.cos(a) * 9 * k, b.y + Math.sin(a) * 9 * k, b.z + 2, 5 * k, BLOOD, 0.9);
      fx.shadow(b.x, b.y, 16 * k, 0.2);
      if (b.m === 1) { // piqué : traînée de sang
        const L = E ? 48 : 30;
        fx.line(X, Y, Z, (b.x - b.dx * L) * S, Y + 0.3, (b.y - b.dy * L) * S, E ? 0.5 : 0.3, E ? '#ff5a7a' : DEEP, E ? 0.7 : 0.5);
      }
      if (E && Math.random() < 0.06) fx.sparkle(b.x, b.y, b.z, '#ff8aa0');
    }
  },
  bloodlance(fx, st, w, s, t) {
    const P = get(st, fx, 'lance'), E = w.evo, k = E ? 1.75 : 1.45;
    for (const l of s.list) {
      const X = l.x * S, Y = 1.4, Z = l.y * S, ca = Math.cos(l.a), sa = Math.sin(l.a), L = E ? 150 : 110;
      P.put(X, Y, Z, -l.a, k);
      // traînée de sang : large halo cramoisi, cœur pâle (lisible sur l'herbe comme sur la pierre)
      fx.line(X, Y, Z, (l.x - ca * L) * S, Y, (l.y - sa * L) * S, E ? 1.5 : 1.15, BLOOD, 0.5);
      fx.line(X, Y, Z, (l.x - ca * L * 0.6) * S, Y, (l.y - sa * L * 0.6) * S, E ? 0.45 : 0.35, PALE, 0.85);
      fx.glow(l.x + ca * 22 * k, l.y + sa * 22 * k, 28, E ? 34 : 26, BLOOD, 0.9);
      fx.shadow(l.x, l.y, 30 * k, 0.22);
      if (Math.random() < 0.35 && fx.sparks.length < 190) fx.sparks.push({ x: l.x - ca * 20, y: l.y - sa * 20, z: 26, vx: -ca * 40, vy: -sa * 40, vz: -40, life: 0.35, max: 0.35, c: DEEP, w: 2.4 }); // gouttes
    }
    // pieux annoncés (évoluée) : traînée sombre au sol sur le passage
    for (const q of s.aux) fx.ringAt(q.x + Math.cos(q.a) * q.len / 2, q.y + Math.sin(q.a) * q.len / 2, 10, BLOOD, 0.5, 0.3, 0.5);
  },
  cursering(fx, st, w, s, t) {
    const E = w.evo;
    for (const c of s.list) {
      const a = clamp(c.t / 0.25, 0, 1) * clamp((c.dur - c.t) / 0.4, 0, 1), R = c.R * (0.85 + 0.15 * backOut(clamp(c.t / 0.3, 0, 1)));
      if (!c.g_on) { c.g_on = 1; fx.ring(c.x, c.y, R * 1.4, R, BLOOD, 8, 0.35); fx.decal(c.x, c.y, R * 0.8, '#2a0010', 0.45); }
      // mare sombre, bord cramoisi en tirets qui tourne, anneau de runes violet en sens contraire
      fx.ringAt(c.x, c.y, R, '#2a0418', 0.4 * a, 0.001, 1, 1, 0, 0, 0, 0, false, 0.065);
      fx.ringAt(c.x, c.y, R, BLOOD, 0.95 * a, 0.07, 0.1, 1, t * 0.8, 12, 0.6, 0.55, true, 0.075);
      if (!E) fx.ringAt(c.x, c.y, R * 0.7, CURSE, 0.75 * a, 0.06, 0, 1, -t * 1.3, 6, -1.2, 0.4, true, 0.08);
      // étoile maudite (5 traits au sol) qui tourne lentement
      const r = R * 0.68, a0 = t * 0.5 + c.x;
      for (let i = 0; i < 5; i++) {
        const p0 = a0 + i * TAU / 5, p1 = a0 + (i + 2) * TAU / 5;
        fx.line((c.x + Math.cos(p0) * r) * S, 0.12, (c.y + Math.sin(p0) * r) * S, (c.x + Math.cos(p1) * r) * S, 0.12, (c.y + Math.sin(p1) * r) * S, 0.12, '#ff4a6a', 0.6 * a);
      }
      if (E) { // gouffre : spirales qui tournent vite vers le centre, cœur sombre
        for (let i = 0; i < 3; i++) fx.ringAt(c.x, c.y, R * (0.88 - i * 0.26), i % 2 ? CURSE : '#ff5a8a', 0.6 * a, 0.08, 0, 0.2, -t * (3 + i) + i * 2, 0, 0, 0.5, true, 0.085);
        fx.glow(c.x, c.y, 6, R * 0.5, '#5a0a3a', 0.5 * a);
      }
      // âmes drainées : lueurs qui montent du bord vers le centre
      if (Math.random() < (E ? 0.7 : 0.4) && fx.stars.length < 290) {
        const an = Math.random() * TAU, d = R * rand(0.5, 0.95);
        fx.stars.push({ x: c.x + Math.cos(an) * d, y: c.y + Math.sin(an) * d, z: 4, vx: -Math.cos(an) * d * 1.2, vy: -Math.sin(an) * d * 1.2, vz: 70, life: 0.55, max: 0.55, c: Math.random() < 0.3 ? PALE : '#ff3a5a', s: 0.8 });
      }
    }
  },
  shuriken(fx, st, w, s, t) {
    const P = get(st, fx, 'star'), E = w.evo, k = E ? 1.45 : 1;
    for (const q of s.list) {
      const fade = q.out > 0 ? clamp(q.out / 0.25, 0, 1) : 1, X = q.x * S, Y = 1.25, Z = q.y * S, v = Math.hypot(q.vx, q.vy) || 1;
      P.put(X, Y, Z, q.spin, k * (0.4 + 0.6 * fade));
      fx.ra.ring(X, Y - 0.02, Z, 0.85 * k, col(E ? '#ffd54a' : LAV), (E ? 0.45 : 0.28) * fade, 0, 0.3, 0.75, -q.spin, 0, 0, 0.6); // flou de rotation
      fx.line(X, Y, Z, (q.x - q.vx / v * (E ? 46 : 30)) * S, Y, (q.y - q.vy / v * (E ? 46 : 30)) * S, E ? 0.45 : 0.3, E ? MAG : VIO, 0.55 * fade);
      fx.glow(q.x, q.y, 25, (E ? 26 : 16) * fade, E ? MAG : VIO, 0.6);
      fx.shadow(q.x, q.y, 22 * k, 0.2 * fade);
    }
  },
  smoke(fx, st, w, s, t) {
    const P = get(st, fx, 'cloud'), E = w.evo;
    for (const b of s.list) { // bombes en vol : boule noire à mèche (comme les obus), étincelle de la mèche
      if (b.t < 0) continue;
      fx.mball.put(b.x * S, b.z * S, b.y * S, b.spin, 0.8);
      fx.glow(b.x, b.y, b.z + 12, 9, '#ffb04a', 0.9);
      fx.shadow(b.x, b.y, 16, 0.3);
    }
    for (const c of s.aux) { // nuages : bouffées qui tournent lentement et respirent, bord violet au sol
      const a = clamp(c.t / 0.2, 0, 1) * clamp((c.dur - c.t) / 0.6, 0, 1), R = c.R, n = E ? 11 : 8, ph = c.ph + t * 0.35;
      for (let i = 0; i < n; i++) {
        const inner = i >= n - 3, an = ph * (inner ? -1.4 : 1) + i * TAU / (inner ? 3 : n - 3), d = R * (inner ? 0.25 : 0.62), br = 1 + Math.sin(t * 2 + i * 1.7) * 0.08;
        const x = c.x + Math.cos(an) * d, y = c.y + Math.sin(an) * d * 0.8, h = (inner ? 30 : 16) + Math.sin(t * 1.5 + i) * 4;
        const j = P.put(x * S, h * S, y * S, 0, R * (inner ? 1.0 : 0.85) * br * S * 1.25);
        P.tint(j, col(i % 3 === 0 ? (E ? '#3a2a52' : '#7a6a98') : E ? '#241a36' : SMOKE));
        P.alpha(j, (E ? 0.72 : 0.6) * a);
      }
      fx.ringAt(c.x, c.y, R, E ? MAG : VIO, 0.5 * a, 0.035, 0.12, 1, t * 0.4, 16, 0.4, 0.3, true, 0.08);
      if (E && Math.random() < 0.25) fx.sparkle(c.x + rand(-R, R) * 0.7, c.y + rand(-R, R) * 0.5, rand(10, 40), MAG);
    }
  },
  shadowclone(fx, st, w, s, t, dt) {
    const g = fx.gfx, p = fx.run.p, C = s.list;
    if (!st.heroMod && !st.heroLoad) { // vrais modèles du héros, chargés à part (le rendu marche aussi sans eux)
      st.heroLoad = 1;
      import('./models-heroes.js').then(m => { st.heroMod = m.heroModel; }).catch(() => {});
    }
    for (let i = 0; i < C.length; i++) {
      const c = C[i], a = clamp(c.t / 0.18, 0, 1) * clamp((c.dur - c.t) / 0.3, 0, 1);
      const m = clone(fx, st, i);
      if (m) {
        m.root.visible = true;
        m.root.position.set(c.x * S, 0, c.y * S);
        m.update(dt, { t: g.t + i * 0.7, moving: !!c.m, speed01: 1, atk: c.atk, atkA: c.a, dirA: c.a });
        m.U.uFx.value.w = 0.68 * a; m.U.uFx.value.x = c.t < 0.12 ? 0.6 : 0;
      }
      fx.glow(c.x, c.y, 22, 40, c.evo ? MAG : VIO, 0.45 * a);
      fx.shadow(c.x, c.y, 30, 0.35 * a);
      fx.ringAt(c.x, c.y, 20, c.evo ? MAG : VIO, 0.8 * a, 0.18, 0.2, 1, -t * 2, 6, 0, 0.6, true, 0.09);
      if (c.m && Math.random() < 0.5 && fx.puffs.length < 200) fx.puffs.push({ x: c.x + rand(-6, 6), y: c.y + rand(-4, 4), z: rand(8, 30), vx: 0, vy: 0, vz: 12, s: rand(7, 11), life: 0.35, max: 0.35, a: 0.5, c: '#2a1a44' });
    }
    if (st.clones) for (let i = C.length; i < st.clones.length; i++) st.clones[i].root.visible = false;
  },
};
// clone n° i : modèle du héros teinté violet et translucide (au plus 4, gardés ; forme sans aura)
function clone(fx, st, i) {
  if (!st.heroMod) return null;
  const L = st.clones || (st.clones = []);
  let m = L[i];
  const evo = Math.min(3, fx.run.p.evo | 0);
  if (!m) {
    m = L[i] = st.heroMod(fx.run.cls.id === 'assassin' ? 'assassin' : 'assassin', evo); m.evo0 = evo;
    m.root.traverse(o => { if (o.isMesh && o.material && !o.material.userData.w2) { const M = o.material; M.userData.w2 = 1; M.transparent = true; M.color.set('#9a7ae8'); m.U = M.userData.U; } });
    m.root.renderOrder = 3;
    fx.root.add(m.root);
    if (!st.disp) { st.disp = 1; const d0 = fx.dispose.bind(fx); fx.dispose = () => { for (const c of st.clones || []) c.dispose(); d0(); }; }
  }
  if (m.evo0 !== evo) { m.setEvo(evo); m.evo0 = evo; m.root.traverse(o => { if (o.isMesh && o.material) o.material.transparent = true; }); }
  return m;
}

// ---------- Effets ponctuels (run.fx 'w2…') ----------
const FX = {
  w2throw(fx, f) { const hs = fx.gfx.hs; if (hs && hs.atk < 0.5) { hs.atk = 1; hs.atkA = f.a; } },
  w2bite(fx, f, k) {
    if (!f.g_w2) { f.g_w2 = 1; fx.burstStars(f.x, f.y, f.z, f.evo ? 4 : 2, BLOOD, 160); }
    fx.ringAt(f.x, f.y, 10 + k * 18, BLOOD, (1 - k) * 0.8, 0.25, 0, 1, 0, 0, 0, 0.5, true, 0.1);
    fx.glow(f.x, f.y, f.z, 18 * (1 - k) + 6, '#ff4d6d', (1 - k) * 0.8);
  },
  w2spikes(fx, f, k, st) {
    const P = get(st, fx, 'spike'), ca = Math.cos(f.a), sa = Math.sin(f.a), n = Math.max(3, Math.min(24, Math.round(f.len / 26)));
    if (!f.g_w2) { f.g_w2 = 1; for (let i = 0; i < n; i += 3) fx.decal(f.x + ca * f.len * (i + 0.5) / n, f.y + sa * f.len * (i + 0.5) / n, 22, '#3a0010', 0.45); fx.rockBurst(f.x + ca * f.len / 2, f.y + sa * f.len / 2, 4, '#8a1a2a', 160); }
    for (let i = 0; i < n; i++) {
      const kk = clamp((k * f.max - i / n * 0.15) / (f.max * 0.8), 0, 1);
      if (kk <= 0) continue;
      const up = kk < 0.2 ? backOut(kk / 0.2) : kk > 0.7 ? 1 - (kk - 0.7) / 0.3 : 1, side = (i % 2 ? 1 : -1) * 9, d = f.len * (i + 0.5) / n;
      const x = f.x + ca * d - sa * side, y = f.y + sa * d + ca * side, s = (0.85 + (i % 3) * 0.15) * Math.max(0.01, up);
      P.put(x * S, -0.25 * (1 - up), y * S, i * 1.7, s, s * 1.2, s);
      if (kk < 0.08) fx.sparkle(x, y, 18, '#ff8a9a');
    }
  },
  w2spark(fx, f, k) {
    if (!f.g_w2) { f.g_w2 = 1; fx.burstStars(f.x, f.y, f.z, f.evo ? 5 : 3, f.evo ? '#ffd54a' : '#ff7ad8', 200); }
    fx.star(f.x, f.y, f.z, (1 - k) * (f.evo ? 16 : 11) + 3, W, 1 - k);
  },
  w2pop(fx, f, k) {
    if (!f.g_w2) { f.g_w2 = 1; fx.puff(f.x, f.y, f.evo ? 10 : 7, f.r * 0.5, 0.75, f.evo ? '#3a2a52' : '#8a7aa8'); fx.ring(f.x, f.y, f.r * 0.3, f.r * 1.1, f.evo ? MAG : LAV, 7, 0.35); }
  },
  w2eat(fx, f, k) { if (!f.g_w2) { f.g_w2 = 1; fx.puff(f.x, f.y, 2, 6, 0.6, '#3a2a52'); fx.burstStars(f.x, f.y, 20, 2, MAG, 100); } },
  w2clone(fx, f, k, st) {
    if (!f.g_w2) { f.g_w2 = 1; fx.puff(f.x, f.y, 6, 16, 0.75, '#2a1a44'); fx.burstStars(f.x, f.y, 26, 6, f.evo ? MAG : '#ff5ac0', 200); fx.ring(f.x, f.y, 50, 12, VIO, 6, 0.3); }
    const a = 1 - k;
    fx.line(f.fromX * S, 1.1, f.fromY * S, f.x * S, 1.1, f.y * S, 1.2 * a, '#7a3aff', 0.5 * a);
    fx.line(f.fromX * S, 1.1, f.fromY * S, f.x * S, 1.1, f.y * S, 0.35 * a, '#ff7ad8', 0.9 * a);
  },
  w2poof(fx, f) { if (!f.g_w2) { f.g_w2 = 1; fx.puff(f.x, f.y, f.evo ? 10 : 7, 18, 0.8, '#2a1a44'); fx.burstStars(f.x, f.y, 24, f.evo ? 8 : 4, VIO, 220); } },
  // entaille du clone : croissant violet et rose (comme le coup d'épée), alterné gauche / droite
  w2cut(fx, f, k) {
    const sweep = Math.min(1, k * 2.4), al = 1 - k, R = f.r, a0 = f.a - 1.3 * f.side - (f.side < 0 ? 2.6 * sweep : 0);
    fx.ra.ring(f.x * S, 0.9, f.y * S, R * S, col(f.evo ? '#ff8ae0' : '#c08aff'), al * 0.95, 0, 0.42, 2.6 * sweep / TAU, a0, 0, 0, 0.9);
    fx.ra.ring(f.x * S, 0.92, f.y * S, R * 1.08 * S, col(f.evo ? MAG : '#7a3aff'), al * 0.7, 0, 0.12, 2.6 * sweep / TAU, a0, 0, 0, 0.3);
    fx.rg.ring(f.x * S, 0.07, f.y * S, R * S, col('#3a1a6a'), al * 0.4, 0, 0.4, 2.6 * sweep / TAU, a0, 0, 0, 0);
    if (!f.g_w2) { f.g_w2 = 1; for (let i = 0; i < 4; i++) { const an = f.a + rand(-1.3, 1.3); fx.sparks.push({ x: f.x + Math.cos(an) * R * 0.9, y: f.y + Math.sin(an) * R * 0.9, z: 18, vx: Math.cos(an) * 150, vy: Math.sin(an) * 150, vz: 60, life: 0.22, max: 0.22, c: f.evo ? '#ff8ae0' : '#c08aff', w: 2.4 }); } }
  },
};

export function frameW2(fx, dt) {
  const run = fx.run, p = run.p;
  let st = fx.w2;
  for (const w of p.weapons) {
    if (!IDS.has(w.id)) continue;
    const s = W2S.get(w);
    if (!s || s.stage !== run.stage) continue;
    st = st || (fx.w2 = {});
    DRAW[w.id](fx, st, w, s, fx.gfx.t, dt);
  }
  if (!st) return;
  for (const f of run.fx) {
    const d = f.type.charCodeAt(0) === 119 && f.type.charCodeAt(1) === 50 ? FX[f.type] : null; // 'w2…'
    if (d) d(fx, f, clamp(1 - f.life / f.max, 0, 1), st);
  }
}
