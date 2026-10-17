// Monstres 3D articulés et instanciés : un InstancedMesh par partie du corps et par espèce
// (corps, membres par paires, queue…), animés procéduralement selon le type de corps.
// 8 types (blob, humanoid, golem, beast, bird, crab, ghost, worm) + détails propres à chaque nom.
import * as THREE from '../../vendor/three.module.min.js';
import { Shape, M, compose, tint, mix } from './models.js';

const PI = Math.PI, TAU = PI * 2;
const DARK = '#1a1424';
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

// ---------- Détails par nom (ce qui rend chaque monstre reconnaissable) ----------
const FEATS = {
  // Voie du Milieu
  'Sbire mêlée': { helm: 'crest', R: 'sword', L: 'buckler', mouth: 'none', skin: '#ffd9b8' },
  'Sbire lanceur': { hat: 'wizard', R: 'staff', robe: true, mouth: 'o', skin: '#ffd9b8' },
  'Porolet': { horns: 'poro', mouth: 'tongue', fluffy: true, feet: true },
  'Sbire canon': { cannon: true, helm: 'cap', mouth: 'smile' },
  'Super Sbire': { horns: 'bull', spikes: true, angry: 1, mouth: 'grin', helm: 'cap' },
  // Jungle
  'Raptix': { crest: 'feather', beak: 'hook', angry: 1 },
  'Grompf': { frog: true, mouth: 'wide', spots: true, feet: true },
  'Loup murmure': { ears: 'pointy', snout: 'wolf', tail: 'bushy', mouth: 'fangs', angry: 1, glowEyes: '#8af0ff' },
  'Krog ancien': { moss: true, rocks: true, mouth: 'grin' },
  'Sentinelle bleue': { runes: '#7af0ff', horns: 'stone', crystals: '#8ac2ff', angry: 1 },
  'Brambleback Rouge': { thorns: true, horns: 'bull', flames: '#ffb03a', angry: 1, mouth: 'grin', runes: '#ffb03a' },
  // Rivière
  'Crabe scuttle': { mouth: 'smile' },
  'Gloop des eaux': { drop: true, bubbles: true, mouth: 'smile', feet: true },
  'Raptix des rives': { crest: 'tuft', beak: 'long' },
  'Crabe géant': { shellSpikes: true, bigClaws: true, angry: 1, mouth: 'fangs' },
  'Ombre aquatique': { fins: true, glowEyes: '#b0fff5', mouth: 'o' },
  'Héraut de la Faille': { eyeBack: true, horns: 'curl', plates: true, angry: 1, mouth: 'fangs', ears: 'none', tail: 'spike' },
  // Abîme glacial
  'Poro sauvage': { horns: 'poroBig', mouth: 'fangs', fluffy: true, angry: 1, feet: true },
  'Yéti des glaces': { horns: 'curl', fur: true, mouth: 'fangs', snout: 'flat', angry: 1, ears: 'none', tail: 'stub' },
  'Esprit du givre': { crystals: '#e0f5ff', glowEyes: '#e0f5ff', mouth: 'o' },
  'Golem de glace': { crystals: '#c8f0ff', runes: '#bff4ff', mouth: 'none' },
  'Gardien du pont': { helm: 'horned', R: 'spear', L: 'tower', angry: 1, mouth: 'none' },
  'Anivale': { crest: 'crystal', tailLong: true, beak: 'hook', angry: 1, crystals: '#e0f8ff' },
  // Îles ombreuses
  'Âme errante': { flame: true, hollow: true, mouth: 'o' },
  'Squelette maudit': { skull: true, ribs: true, R: 'bone', mouth: 'grin' },
  'Araignée de brume': { spider: true, eyes: 'many', glowEyes: '#7ae8b8', mouth: 'none' },
  'Revenant': { hood: true, hollow: true, chains: true, mouth: 'none' },
  'Chevalier déchu': { helm: 'dark', R: 'bigsword', cape: true, glowEyes: '#7affd0', hollow: true, mouth: 'none' },
  'Thrash': { hood: true, lantern: true, chains: true, glowEyes: '#c8ffe0', hollow: true, mouth: 'grin' },
  // Le Vide
  'Larve du Vide': { mandibles: true, segs: 5, glowEyes: '#ffa0ff' },
  'Rôdeur abyssal': { spikesBack: true, eyes: 'three', glowEyes: '#e0c0ff', mouth: 'fangs', ears: 'horn', tail: 'spike' },
  'Œil du Vide': { eyes: 'one', tentacles: true, mouth: 'none' },
  'Scarabée du Néant': { beetle: true, mouth: 'none' },
  'Héraut affamé': { mouth: 'teeth', spikes: true, segs: 6, eyes: 'two', angry: 1 },
  'Baron Nashar': { mouth: 'teeth', horns: 'demon', eyes: 'many', spikes: true, segs: 8, glowEyes: '#ff70ff' },
  // familiers (versions mignonnes)
  'pet:poro': { horns: 'poro', mouth: 'tongue', fluffy: true, feet: true },
  'pet:brambi': { thorns: true, horns: 'stone', mouth: 'smile', runes: '#ffb03a' },
  'pet:herald': { eyeBack: true, horns: 'curl', mouth: 'smile', ears: 'none', tail: 'spike' },
  'pet:phenix': { crest: 'crystal', tailLong: true, beak: 'hook' },
  'pet:wisp': { lantern: true, mouth: 'smile', flame: true },
  'pet:voidy': { horns: 'demon', mouth: 'smile', segs: 4, spikes: true },
};

// ---------- Aides de modelage ----------
// point sur la surface d'une tête ellipsoïde H (u : gauche/droite, v : bas/haut, avant = +z)
function surf(H, u, v, out = 1) {
  const w = Math.sqrt(Math.max(0, 1 - u * u - v * v));
  return [H.x + H.rx * u * out, H.y + H.ry * v * out, H.z + H.rz * w * out];
}

function face(S, H, f, pal, o, { eyeV = 0.14, eyeU = 0.38, eyeK = 1, mouthV = -0.38 } = {}) {
  const pet = !!o.pet, boss = !!o.boss;
  const r = Math.min(H.rx, H.ry) * 0.33 * eyeK * (pet ? 1.12 : 1);
  const glowCol = f.glowEyes;
  const pupil = boss ? '#ff2a3a' : glowCol || DARK;
  const glow = boss ? 0.9 : glowCol ? 0.9 : 0;
  const angry = pet ? 0 : (f.angry || (boss ? 1 : 0));
  const kind = f.eyes || 'two';
  const eyeAt = (u, v, rr, sd) => {
    const [x, y, z] = surf(H, u, v);
    S.eye(x, y, z - rr * 0.32, rr, { ry: Math.asin(clamp(u, -0.9, 0.9)) * 0.85, side: sd, angry, pupil, glow, tall: 1.25, spooky: !!glowCol && !pet });
  };
  if (f.hollow) {
    // orbites sombres + pupilles lumineuses
    for (const sd of [1, -1]) {
      const [x, y, z] = surf(H, eyeU * sd, eyeV);
      S.put('sph:8:6', '#0e0a16', x, y, z - r * 0.2, r * 2.2, r * 2.4, r * 1.1, 0, Math.asin(eyeU * sd) * 0.8, 0, { grad: 0 });
      S.put('sph:6:4', glowCol || '#ffffff', x, y, z + r * 0.2, r * 0.9, r * 1.1, r * 0.6, 0, 0, 0, { glow: 1.2, grad: 0 });
    }
  } else if (kind === 'one') {
    eyeAt(0, eyeV, r * 2.1, 1);
  } else if (kind === 'three') {
    eyeAt(-0.42, eyeV, r * 0.85, -1); eyeAt(0.42, eyeV, r * 0.85, 1); eyeAt(0, eyeV + 0.36, r * 0.75, 1);
  } else if (kind === 'many') {
    eyeAt(-0.3, eyeV, r * 0.95, -1); eyeAt(0.3, eyeV, r * 0.95, 1);
    for (const sd of [1, -1]) { eyeAt(0.55 * sd, eyeV + 0.28, r * 0.5, sd); eyeAt(0.2 * sd, eyeV + 0.42, r * 0.45, sd); }
  } else if (kind !== 'none') {
    for (const sd of [1, -1]) eyeAt(eyeU * sd, eyeV, r, sd);
  }
  // joues roses pour les familiers
  if (pet) for (const sd of [1, -1]) {
    const [x, y, z] = surf(H, 0.6 * sd, eyeV - 0.25);
    S.put('sph:6:4', '#ff8aa8', x, y, z, r * 0.9, r * 0.45, r * 0.3, 0, Math.asin(0.6 * sd), 0, { grad: 0 });
  }
  mouth(S, H, f.mouth || (pet ? 'smile' : 'smile'), r, mouthV, pal);
}

function mouth(S, H, kind, r, v, pal) {
  const [x, y, z] = surf(H, 0, v);
  switch (kind) {
    case 'none': return;
    case 'smile': S.put('arc:0.16:3.14', '#3a1424', x, y + r * 0.35, z - r * 0.1, r * 1.3, r * 1.1, r * 0.8, 0, 0, PI, { grad: 0 }); return;
    case 'o': S.put('sph:8:6', '#2a0e1e', x, y, z - r * 0.15, r * 0.7, r * 0.9, r * 0.5, 0, 0, 0, { grad: 0 }); return;
    case 'tongue':
      S.put('arc:0.16:3.14', '#3a1424', x, y + r * 0.35, z - r * 0.1, r * 1.5, r * 1.2, r * 0.8, 0, 0, PI, { grad: 0 });
      S.put('sph:8:6', '#ff6a8a', x + r * 0.15, y - r * 0.45, z - r * 0.05, r * 0.8, r * 0.9, r * 0.45, 0.3, 0, 0.2, { grad: 0 });
      return;
    case 'fangs':
      S.put('box', '#2a0e1e', x, y, z - r * 0.15, r * 2.2, r * 0.45, r * 0.4, 0, 0, 0, { grad: 0 });
      for (const sd of [1, -1]) S.put('cone:4', '#ffffff', x + sd * r * 0.7, y - r * 0.35, z, r * 0.45, r * 0.7, r * 0.35, PI, 0, 0, { grad: 0 });
      return;
    case 'grin':
      S.put('box', '#2a0e1e', x, y, z - r * 0.15, r * 2.6, r * 0.7, r * 0.4, 0, 0, 0, { grad: 0 });
      for (let i = -2; i <= 2; i++) S.put('box', '#f4f0e8', x + i * r * 0.48, y + r * 0.18, z + r * 0.02, r * 0.36, r * 0.32, r * 0.3, 0, 0, 0, { grad: 0 });
      return;
    case 'wide':
      S.put('box', '#2a0e1e', x, y, z - r * 0.3, r * 4.6, r * 0.32, r * 0.6, 0, 0, 0, { grad: 0 });
      return;
    case 'teeth': {
      S.put('sph:10:8', '#2a0618', x, y, z - r * 0.4, r * 3.4, r * 2.4, r * 1.2, 0, 0, 0, { grad: 0, glow: 0.15 });
      for (let i = 0; i < 5; i++) {
        const u = (i - 2) * r * 0.62;
        S.put('cone:4', '#fff4e8', x + u, y + r * 0.85, z + r * 0.1, r * 0.42, r * 0.8, r * 0.4, PI, 0, 0, { grad: 0 });
        S.put('cone:4', '#fff4e8', x + u + r * 0.3, y - r * 0.85, z + r * 0.1, r * 0.4, r * 0.7, r * 0.4, 0, 0, 0, { grad: 0 });
      }
      return;
    }
  }
}

// cornes / oreilles posées sur le haut de la tête (u : côté, v : hauteur)
function horns(S, H, kind, pal, o) {
  if (!kind) return;
  const big = o.boss ? 1.25 : 1;
  for (const sd of [1, -1]) {
    const [x, y, z] = surf(H, 0.5 * sd, 0.72);
    const k = (H.rx + H.ry) * 0.5 * big;
    switch (kind) {
      case 'poro': S.put('cone:6', '#f0dcae', x, y + k * 0.18, z - k * 0.1, k * 0.32, k * 0.5, k * 0.32, -0.2, 0, -0.45 * sd); break;
      case 'poroBig':
        S.put('cone:6', '#e8d0a0', x, y + k * 0.2, z - k * 0.1, k * 0.36, k * 0.6, k * 0.36, -0.2, 0, -0.6 * sd);
        S.put('cone:6', '#fff2d8', x + sd * k * 0.28, y + k * 0.55, z - k * 0.12, k * 0.2, k * 0.35, k * 0.2, -0.3, 0, -1.1 * sd);
        break;
      case 'bull':
        S.put('cone:6', '#f4ecd8', x + sd * k * 0.22, y + k * 0.05, z, k * 0.3, k * 0.6, k * 0.3, 0, 0, -1.2 * sd);
        S.put('cone:6', '#fffaf0', x + sd * k * 0.55, y + k * 0.32, z, k * 0.18, k * 0.42, k * 0.18, 0, 0, -0.3 * sd);
        break;
      case 'stone': S.put('cone:4', tint(pal[1], -0.2), x, y + k * 0.2, z, k * 0.32, k * 0.6, k * 0.32, 0, 0.6, -0.5 * sd); break;
      case 'curl':
        S.put('arc:0.2:4.2', mix(pal[2], '#f4ecd8', 0.6), x + sd * k * 0.1, y, z - k * 0.1, k * 0.7, k * 0.7, k * 0.9, 0, sd > 0 ? -PI / 2 : PI / 2, 0);
        break;
      case 'demon':
        S.put('cone:6', mix(pal[1], '#ffffff', 0.25), x + sd * k * 0.12, y + k * 0.3, z - k * 0.15, k * 0.3, k * 0.9, k * 0.3, -0.6, 0, -0.5 * sd);
        S.put('cone:6', '#f0a0ff', x + sd * k * 0.35, y + k * 0.8, z - k * 0.5, k * 0.14, k * 0.4, k * 0.14, -1.1, 0, -0.5 * sd, { glow: 0.6 });
        break;
    }
  }
}

function crest(S, H, kind, pal, o) {
  if (!kind) return;
  const [x, y, z] = surf(H, 0, 0.9);
  const k = (H.rx + H.ry) * 0.5;
  if (kind === 'feather') for (let i = 0; i < 3; i++) S.put('cone:5', i === 1 ? pal[2] : pal[1], x, y + k * 0.2, z - k * 0.12 - i * k * 0.22, k * 0.22, k * 0.8 - i * k * 0.15, k * 0.12, -0.5 - i * 0.3, 0, 0);
  else if (kind === 'tuft') for (let i = -1; i <= 1; i++) S.put('cone:5', pal[2], x + i * k * 0.12, y + k * 0.12, z - k * 0.05, k * 0.14, k * 0.42, k * 0.1, -0.3, 0, -i * 0.45);
  else if (kind === 'crystal') for (let i = -1; i <= 1; i++) S.put('oct', mix(pal[2], '#ffffff', 0.4), x + i * k * 0.3, y + k * 0.3 - Math.abs(i) * k * 0.12, z - k * 0.12, k * 0.24, k * (i ? 0.6 : 0.9), k * 0.24, -0.3, 0, -i * 0.45, { glow: 0.55 });
}

function spikesAlong(S, pts, col, size, o = {}) {
  for (const [x, y, z, rx = -0.5, rz = 0, sc = 1] of pts) S.put('cone:5', col, x, y, z, size * 0.5 * sc, size * sc, size * 0.5 * sc, rx, 0, rz, o);
}

function crystalsOn(S, pts, col, size) {
  for (const [x, y, z, rz = 0, sc = 1] of pts) S.put('oct', col, x, y, z, size * 0.5 * sc, size * 1.2 * sc, size * 0.5 * sc, 0, 0.4, rz, { glow: 0.5 });
}

// ---------- Corps par type ----------
// chaque type renvoie { parts: [{ geo, n }], top, stride, pose(P, s) }

function blob(f, pal, o) {
  const [base, dark, light] = pal;
  const S = new Shape({ low: !(o.boss || o.pet) });
  const H = { x: 0, y: 0.42, z: 0, rx: 0.5, ry: 0.42, rz: 0.46 };
  S.put('sph:14:10', base, 0, 0.42, 0, 1.0, 0.84, 0.92);
  S.put('sph:12:8', light, 0, 0.32, 0.13, 0.74, 0.54, 0.72, 0, 0, 0, { grad: 0.05 });
  S.put('sph:8:6', '#ffffff', -0.2, 0.7, 0.18, 0.18, 0.08, 0.12, 0, 0, 0.5, { grad: 0, glow: 0.3 });
  let top = 0.84;
  if (f.drop) { S.put('cone:12', base, 0, 0.92, -0.06, 0.6, 0.55, 0.6, -0.25); top = 1.18; }
  if (f.fluffy) {
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * TAU;
      S.put('sph:8:6', i % 2 ? light : base, Math.cos(a) * 0.46, 0.36 + Math.sin(i * 2.3) * 0.06, Math.sin(a) * 0.42 - 0.02, 0.24, 0.24, 0.24);
    }
    for (let i = -1; i <= 1; i++) S.put('sph:8:6', light, i * 0.12, 0.84 - Math.abs(i) * 0.04, -0.02 + Math.abs(i) * 0.03, 0.2, 0.26, 0.2, 0, 0, -i * 0.4);
  }
  if (f.spots) for (const [u, v, s] of [[0.5, 0.55, 0.13], [-0.45, 0.6, 0.11], [0.1, 0.85, 0.1], [-0.6, 0.15, 0.09], [0.65, 0.05, 0.1]]) {
    const [x, y, z] = surf({ ...H, z: 0 }, u, v); S.put('sph:6:4', tint(dark, -0.15), x, y, z - 0.03, s, s * 0.7, s * 0.5);
  }
  if (f.bubbles) for (const [x, y, z, s] of [[0.3, 0.65, 0.25, 0.1], [-0.35, 0.55, 0.3, 0.07], [0.15, 0.95, 0.05, 0.08]]) S.put('sph:6:4', mix(light, '#ffffff', 0.6), x, y, z, s, s, s, 0, 0, 0, { glow: 0.4 });
  if (f.tentacles) for (let i = 0; i < 6; i++) {
    const a = i / 6 * TAU + 0.5;
    S.put('cone:5', dark, Math.cos(a) * 0.46, 0.12, Math.sin(a) * 0.4, 0.14, 0.3, 0.14, PI - 0.6 * Math.sin(a), 0, 0.6 * Math.cos(a));
  }
  if (o.boss) { horns(S, H, f.horns || 'bull', pal, o); top += 0.2; }
  if (f.feet) for (const sd of [1, -1]) S.put('sph:8:6', tint(dark, -0.1), 0.2 * sd, 0.04, 0.16, 0.22, 0.1, 0.24, 0, 0, 0, { grad: 0 });
  if (!f.frog) face(S, H, f, pal, o, { eyeV: f.eyes === 'one' ? 0.18 : 0.16, eyeU: 0.34, eyeK: f.eyes === 'one' ? 1.05 : 1.12, mouthV: -0.3 });
  else mouth(S, H, 'wide', 0.12, 0.22, pal);
  const parts = [{ geo: S.build(), n: 1 }];
  // oreilles / cornes / yeux de grenouille : partie séparée qui ballotte
  let ears = null;
  if (f.frog || (f.horns && !o.boss)) {
    ears = new Shape({ low: !(o.boss || o.pet) });
    if (f.frog) {
      ears.put('sph:10:8', base, 0, 0.04, 0, 0.3, 0.26, 0.3);
      ears.eye(0, 0.07, 0.1, 0.11, { angry: 0, tall: 1.1 });
    } else if (f.horns === 'poro' || f.horns === 'poroBig') {
      const k = f.horns === 'poroBig' ? 1.25 : 1;
      ears.put('cone:6', '#f0dcae', 0, 0.12 * k, 0, 0.13 * k, 0.26 * k, 0.13 * k);
      if (k > 1) ears.put('cone:6', '#fff2d8', 0.05, 0.28, -0.02, 0.08, 0.16, 0.08, 0, 0, -0.6);
    } else {
      const Hs = { x: 0, y: -0.3, z: 0, rx: 0.3, ry: 0.3, rz: 0.3 };
      horns(ears, Hs, f.horns, pal, o);
    }
    parts.push({ geo: ears.build(), n: 2 });
  }
  const frog = !!f.frog;
  return {
    parts, top, stride: 7,
    pose(P, s) {
      const c = s.ph % PI, sn = Math.sin(c), k = Math.cos(2 * c);
      const amp = 0.25 + 0.75 * Math.min(1, s.spd);
      const hop = (0.02 + 0.2 * Math.min(1.2, s.spd)) * sn + s.tuck * 0.1;
      const sy = 1 - 0.14 * k * amp + s.breath * 0.03, sx = 1 + 0.09 * k * amp;
      const B = P.keep(0, P.part(0, P.R, 0, hop, 0, s.atkK * -0.25, 0, 0, sx, sy, sx));
      if (ears) for (const sd of [1, -1]) {
        const lag = -Math.cos(c) * 0.35 * amp;
        if (frog) P.part(1, B, 0.2 * sd, 0.74, 0.1, lag * 0.5, 0, -0.1 * sd, 1, 1, 1);
        else P.part(1, B, 0.24 * sd, 0.74, -0.02, lag - 0.15, sd > 0 ? 0 : PI, -0.35 + Math.sin(s.t * 3 + sd) * 0.05, 1, 1, 1);
      }
    },
  };
}

function humanoid(f, pal, o) {
  const [base, dark, light] = pal;
  const S = new Shape({ low: !(o.boss || o.pet) });
  const skin = f.skull ? '#f2ecda' : f.skin || mix(light, '#ffe0c8', 0.5);
  const H = { x: 0, y: 0.76, z: 0.03, rx: 0.28, ry: 0.26, rz: 0.27 };
  // buste
  S.put('rbox:0.3', base, 0, 0.44, 0, 0.44, 0.32, 0.3);
  S.put('rbox:0.3', light, 0, 0.47, 0.12, 0.3, 0.2, 0.1, 0, 0, 0, { grad: 0 });
  S.put('rbox:0.3', dark, 0, 0.3, 0, 0.46, 0.07, 0.32);
  if (f.robe) S.put('frust:0.2:0.3:10', base, 0, 0.2, 0, 1, 0.3, 0.9);
  if (f.ribs) for (let i = 0; i < 3; i++) S.put('box', '#2a2030', 0, 0.52 - i * 0.07, 0.155, 0.32 - i * 0.04, 0.025, 0.02, 0, 0, 0, { grad: 0 });
  if (f.cape) S.put('taper:0.22:0.34', dark, 0, 0.33, -0.18, 1, 0.56, 0.08, 0.15);
  // tête
  S.put('sph:12:9', f.helm === 'dark' ? dark : skin, 0, 0.76, 0.02, 0.56, 0.52, 0.54);
  let top = 1.04;
  if (f.helm === 'crest' || f.helm === 'horned' || f.helm === 'cap') {
    S.put('dome:12', f.helm === 'horned' ? base : dark, 0, 0.8, -0.01, 0.62, 0.58, 0.62);
    S.put('rbox:0.3', light, 0, 0.83, 0.24, 0.5, 0.06, 0.1, -0.15, 0, 0, { grad: 0 });
    if (f.helm === 'crest') { S.put('rbox:0.4', light, 0, 1.1, -0.04, 0.05, 0.16, 0.44); top = 1.2; }
    if (f.helm === 'horned') for (const sd of [1, -1]) S.put('cone:6', '#f4ecd8', 0.3 * sd, 1.02, -0.02, 0.1, 0.3, 0.1, 0, 0, -0.7 * sd);
  }
  if (f.helm === 'dark') {
    S.put('sph:12:9', dark, 0, 0.8, 0.0, 0.62, 0.6, 0.6);
    S.put('box', '#0e0a16', 0, 0.76, 0.26, 0.4, 0.09, 0.08, 0, 0, 0, { grad: 0 });
    for (const sd of [1, -1]) S.put('cone:6', tint(dark, -0.3), 0.27 * sd, 1.0, -0.05, 0.11, 0.34, 0.11, -0.3, 0, -0.5 * sd);
    S.put('rbox:0.4', base, 0, 1.08, -0.05, 0.06, 0.12, 0.4);
  }
  if (f.hat === 'wizard') {
    S.put('cyl:12', dark, 0, 0.92, 0.0, 0.7, 0.05, 0.7);
    S.put('cone:10', dark, 0, 1.15, -0.04, 0.46, 0.48, 0.46, -0.28);
    S.put('sph:6:4', light, 0, 1.35, -0.13, 0.1, 0.1, 0.1, 0, 0, 0, { glow: 0.8 });
    top = 1.35;
  }
  if (f.skull) {
    S.put('box', '#2a2030', 0, 0.63, 0.24, 0.2, 0.05, 0.05, 0, 0, 0, { grad: 0 });
    S.put('cone:3', '#2a2030', 0, 0.7, 0.28, 0.06, 0.06, 0.03, PI, 0, 0, { grad: 0 });
  }
  if (!f.helm || f.helm === 'dark' || f.helm === 'crest' || f.helm === 'horned' || f.helm === 'cap') {
    if (f.helm === 'dark') {
      for (const sd of [1, -1]) S.put('sph:6:4', f.glowEyes || '#ff3a3a', 0.1 * sd, 0.77, 0.29, 0.07, 0.05, 0.03, 0, 0, 0, { glow: 1.3, grad: 0 });
    } else face(S, H, f, pal, o, { eyeV: f.helm ? -0.02 : 0.08, eyeU: 0.36, eyeK: 1.05, mouthV: -0.45 });
  } else face(S, H, f, pal, o);
  if (o.boss) { horns(S, H, 'bull', pal, o); top += 0.15; }
  const legs = new Shape({ low: !(o.boss || o.pet) });
  legs.put('rbox:0.3', dark, 0, -0.11, 0, 0.13, 0.22, 0.15);
  legs.put('rbox:0.3', tint(dark, -0.25), 0, -0.235, 0.03, 0.15, 0.07, 0.2);
  // bras + armes (droite / gauche séparés)
  const arm = (wpn) => {
    const A = new Shape({ low: !(o.boss || o.pet) });
    A.put('rbox:0.35', base, 0, -0.1, 0, 0.11, 0.22, 0.12);
    A.put('sph:8:6', f.skull ? skin : light, 0, -0.23, 0.01, 0.12, 0.12, 0.12);
    const tilt = { sword: [0.5, 0.35], staff: [0.15, 0.12], spear: [0.3, 0.12], bone: [0.5, 0.3], bigsword: [0.55, 0.6] }[wpn] || [0.5, 0];
    const W = M(0, -0.23, 0.02, tilt[0], 0, tilt[1]);
    const w = (k, c, m, op) => A.add(k, c, W.clone().multiply(m), op);
    switch (wpn) {
      case 'sword':
        w('cyl:6', '#6a4a2a', M(0, 0, 0, 0, 0, 0, 0.04, 0.12, 0.04));
        w('rbox:0.3', '#e6b422', M(0, 0.07, 0, 0, 0, 0, 0.05, 0.04, 0.16));
        w('taper:0.03:0.05', '#e8ecf4', M(0, 0.27, 0, 0, 0, 0, 1, 0.38, 1.6), { glow: 0.1 });
        break;
      case 'staff':
        w('cyl:6', '#6a4a2a', M(0, 0.1, 0, 0, 0, 0, 0.04, 0.7, 0.04));
        w('sph:8:6', light, M(0, 0.48, 0, 0, 0, 0, 0.14, 0.14, 0.14), { glow: 1 });
        w('arc:0.15:3.6', '#e6b422', M(0, 0.48, 0, 0, PI / 2, -0.3, 0.22, 0.22, 0.22));
        break;
      case 'spear':
        w('cyl:6', '#8a6a4a', M(0, 0.2, 0, 0, 0, 0, 0.04, 1.0, 0.04));
        w('cone:4', '#e8ecf4', M(0, 0.76, 0, 0, 0, 0, 0.09, 0.22, 0.05), { glow: 0.15 });
        break;
      case 'bone':
        w('cyl:6', '#f2ecda', M(0, 0.12, 0, 0, 0, 0, 0.05, 0.36, 0.05));
        w('sph:6:4', '#f2ecda', M(0, 0.3, 0, 0, 0, 0, 0.12, 0.1, 0.1));
        break;
      case 'bigsword':
        w('cyl:6', '#2a2030', M(0, -0.02, 0, 0, 0, 0, 0.05, 0.16, 0.05));
        w('rbox:0.3', dark, M(0, 0.08, 0, 0, 0, 0, 0.06, 0.05, 0.24));
        w('taper:0.045:0.07', '#3a4a4a', M(0, 0.42, 0, 0, 0, 0, 1, 0.62, 1.7));
        w('box', f.glowEyes || light, M(0, 0.42, 0, 0, 0, 0, 0.02, 0.56, 0.1), { glow: 1, grad: 0 });
        break;
      case 'buckler':
        A.put('cyl:10', light, 0.06, -0.18, 0.02, 0.24, 0.04, 0.24, 0, 0, PI / 2);
        A.put('sph:6:4', dark, 0.09, -0.18, 0.02, 0.07, 0.07, 0.07);
        break;
      case 'tower':
        A.put('rbox:0.2', light, 0.08, -0.14, 0.06, 0.05, 0.42, 0.3, 0, 0, 0);
        A.put('box', '#e6b422', 0.11, -0.12, 0.06, 0.02, 0.3, 0.05, 0, 0, 0, { glow: 0.2, grad: 0 });
        break;
    }
    return A;
  };
  const parts = [{ geo: S.build(), n: 1 }, { geo: legs.build(), n: 2 }, { geo: arm(f.R).build(), n: 1 }, { geo: arm(f.L).build(), n: 1 }];
  const caster = f.R === 'staff';
  return {
    parts, top, stride: 9,
    pose(P, s) {
      const run = Math.min(1.2, s.spd), sw = Math.sin(s.ph), cw = Math.cos(s.ph);
      const bob = Math.abs(cw) * 0.035 * run + s.breath * 0.008;
      const B = P.keep(0, P.part(0, P.R, 0, bob, 0, 0.12 * run + s.atkK * 0.2, -sw * 0.12 * run, 0, 1, 1 + s.breath * 0.02, 1));
      for (const sd of [1, -1]) P.part(1, P.R, 0.1 * sd, 0.27 + bob * 0.5, 0, sd * sw * 0.85 * run - s.tuck * 0.6, 0, 0, 1, 1, 1);
      // bras droit : balance, attaque (frappe vers le bas), sort (bâton levé)
      let rx = -sw * 0.7 * run, rz = -0.1;
      if (s.atk >= 0) { const a = s.atk; rx = a < 0.4 ? -2.6 * (a / 0.4) : -2.6 + (a - 0.4) / 0.6 * 2.8; }
      if (caster) rx = rx * (1 - s.cast) - 2.2 * s.cast;
      rx -= s.aim * 1.6; rz -= s.aim * 0.5 + s.tuck * 0.8;
      P.part(2, B, -0.26, 0.53, 0, rx, 0, rz, 1, 1, 1);
      P.part(3, B, 0.26, 0.53, 0, sw * 0.7 * run - s.aim * 1.6 - (f.L ? 0.6 : 0) * (1 - run * 0.5), f.L ? -0.4 : 0, 0.1 + s.aim * 0.5 + s.tuck * 0.8, 1, 1, 1);
    },
  };
}

function golem(f, pal, o) {
  const [base, dark, light] = pal;
  const S = new Shape({ low: !(o.boss || o.pet) });
  const H = { x: 0, y: 0.95, z: 0.1, rx: 0.2, ry: 0.16, rz: 0.17 };
  S.put('rbox:0.3', base, 0, 0.56, 0, 0.8, 0.58, 0.56);
  S.put('rbox:0.35', light, 0, 0.6, 0.23, 0.56, 0.34, 0.12, 0, 0, 0, { grad: 0.05 });
  S.put('rbox:0.3', dark, 0, 0.3, 0, 0.66, 0.12, 0.5);
  for (const sd of [1, -1]) S.put('sph:10:7', dark, 0.4 * sd, 0.8, 0, 0.38, 0.32, 0.42);
  const hk = o.boss ? 1.25 : 1;
  if (o.boss) { H.rx *= hk; H.ry *= hk; H.rz *= hk; H.y = 0.98; H.z = 0.12; }
  S.put('rbox:0.35', base, 0, 0.95 + (hk - 1) * 0.12, 0.08 + (hk - 1) * 0.1, 0.4 * hk, 0.3 * hk, 0.34 * hk);
  let top = 1.12;
  if (o.boss) {
    for (let i = 0; i < 5; i++) { const a = (i / 4 - 0.5) * 2.2; S.put('cone:5', '#f4ecd8', Math.sin(a) * 0.2, 1.2 + Math.cos(a) * 0.05, 0.06 - Math.abs(Math.sin(a)) * 0.05, 0.1, 0.26 - Math.abs(i - 2) * 0.04, 0.1, -0.2, 0, -a * 0.6); }
    for (const sd of [1, -1]) spikesAlong(S, [[0.5 * sd, 0.98, 0.02, 0, -0.9 * sd, 1.3], [0.36 * sd, 1.05, -0.16, -0.4, -0.4 * sd, 1.1], [0.2 * sd, 0.9, -0.3, -1.1, -0.2 * sd]], '#f4ecd8', 0.22);
    top = 1.4;
  }
  if (f.helm === 'cap') { S.put('dome:10', dark, 0, 1.02, 0.07, 0.46, 0.34, 0.4); S.put('rbox:0.3', light, 0, 1.03, 0.25, 0.42, 0.05, 0.1, -0.2); }
  if (f.cannon) {
    S.put('cyl:10', '#3a3a4a', 0.28, 1.12, -0.02, 0.2, 0.62, 0.2, PI / 2 - 0.35, 0, 0);
    S.put('cyl:10', '#22222e', 0.28, 1.22, 0.27, 0.23, 0.08, 0.23, PI / 2 - 0.35, 0, 0);
    S.put('rbox:0.3', dark, 0.28, 0.98, -0.1, 0.26, 0.14, 0.3);
    top = 1.35;
  }
  if (f.moss) {
    S.put('dome:10', '#4a8a3a', 0, 0.84, -0.02, 0.82, 0.3, 0.58);
    S.put('dome:8', '#5aa84a', 0, 1.08, 0.06, 0.42, 0.18, 0.36);
    for (const [x, z] of [[0.3, -0.1], [-0.25, 0.05], [0.05, -0.2]]) S.put('cone:5', '#6ac85a', x, 1.0, z, 0.08, 0.16, 0.08);
  }
  if (f.rocks) for (const [x, y, z, s] of [[0.45, 0.95, -0.05, 0.22], [-0.42, 0.9, 0.1, 0.18], [0.1, 0.6, -0.3, 0.26]]) S.put('dod', tint(base, -0.15), x, y, z, s, s * 0.8, s);
  if (f.spikes) for (const sd of [1, -1]) spikesAlong(S, [[0.48 * sd, 0.98, 0, 0, -0.6 * sd], [0.38 * sd, 1.02, -0.14, -0.4, -0.3 * sd]], '#f4ecd8', 0.2);
  if (f.thorns) {
    const pts = [];
    for (let i = 0; i < 9; i++) pts.push([(i % 3 - 1) * 0.24, 0.62 + Math.floor(i / 3) * 0.16, -0.3 - (i % 2) * 0.02, -1.3 + Math.floor(i / 3) * 0.2, (i % 3 - 1) * -0.4, 1]);
    spikesAlong(S, pts, '#3a6a2a', o.pet ? 0.16 : 0.22);
  }
  if (f.flames) for (const sd of [1, -1]) {
    S.put('cone:6', f.flames, 0.42 * sd, 1.04, 0, 0.18, 0.34, 0.18, 0, 0, -0.2 * sd, { glow: 1 });
    S.put('cone:6', '#fff0a0', 0.42 * sd, 0.98, 0.02, 0.1, 0.2, 0.1, 0, 0, -0.2 * sd, { glow: 1 });
  }
  if (f.runes) {
    S.put('oct', f.runes, 0, 0.62, 0.29, 0.16, 0.24, 0.05, 0, 0, 0, { glow: 1.2, grad: 0 });
    for (const sd of [1, -1]) {
      S.put('box', f.runes, 0.15 * sd, 0.68, 0.29, 0.07, 0.03, 0.02, 0, 0, 0.5 * sd, { glow: 1.1, grad: 0 });
      S.put('box', f.runes, 0.15 * sd, 0.56, 0.29, 0.07, 0.03, 0.02, 0, 0, -0.5 * sd, { glow: 1.1, grad: 0 });
    }
  }
  if (f.crystals) crystalsOn(S, [[0.42, 1.05, -0.02, -0.4, 1], [-0.42, 1.05, -0.02, 0.4, 1], [0.15, 0.95, -0.22, -0.2, 0.8], [-0.12, 1.0, -0.24, 0.3, 0.9]], f.crystals, 0.24);
  horns(S, H, f.horns || (o.boss ? 'bull' : null), pal, o);
  if (f.horns || o.boss) top += 0.15;
  // yeux lumineux enfoncés
  for (const sd of [1, -1]) {
    const [x, y, z] = surf(H, 0.42 * sd, 0.05);
    if (f.runes || f.crystals || o.boss) {
      S.put('sph:6:4', '#0e0a16', x, y, z - 0.02, 0.14, 0.1, 0.05, 0, 0, 0, { grad: 0 });
      S.put('sph:6:4', o.boss ? '#ff4a2a' : f.runes || '#ffffff', x, y, z + 0.005, 0.1, 0.075, 0.04, 0, 0, 0, { glow: 1.3, grad: 0 });
    }
  }
  if (!(f.runes || f.crystals || o.boss)) face(S, H, f, pal, o, { eyeV: 0.1, eyeU: 0.44, eyeK: 1.55, mouthV: -0.55 });
  else mouth(S, H, f.mouth || 'none', 0.05, -0.5, pal);
  if (o.boss) S.put('sph:10:8', f.flames || '#ffcc66', 0, 0.6, 0.29, 0.18, 0.18, 0.08, 0, 0, 0, { glow: 1.2 });
  const arm = new Shape({ low: !(o.boss || o.pet) });
  arm.put('rbox:0.35', base, 0, -0.17, 0, 0.2, 0.36, 0.22);
  arm.put('rbox:0.4', dark, 0, -0.42, 0.04, 0.32, 0.3, 0.34);
  arm.put('rbox:0.3', light, 0, -0.42, 0.21, 0.22, 0.18, 0.02, 0, 0, 0, { grad: 0 });
  if (f.crystals) arm.put('oct', f.crystals, 0, -0.2, -0.12, 0.12, 0.26, 0.12, -0.6, 0, 0, { glow: 0.5 });
  if (o.boss) for (let i = -1; i <= 1; i++) arm.put('cone:4', '#f4ecd8', i * 0.1, -0.45, 0.24, 0.07, 0.14, 0.07, PI / 2, 0, 0);
  const leg = new Shape({ low: !(o.boss || o.pet) });
  leg.put('rbox:0.35', dark, 0, -0.13, 0, 0.26, 0.3, 0.3);
  return {
    parts: [{ geo: S.build(), n: 1 }, { geo: arm.build(), n: 2 }, { geo: leg.build(), n: 2 }], top, stride: 6,
    pose(P, s) {
      const run = Math.min(1.2, s.spd), sw = Math.sin(s.ph), cw = Math.cos(s.ph);
      const bob = Math.abs(cw) * 0.04 * run + s.breath * 0.01;
      const B = P.keep(0, P.part(0, P.R, 0, bob, 0, 0.1 * run + s.atkK * 0.25, 0, sw * 0.08 * run, 1, 1 + s.breath * 0.025, 1));
      for (const sd of [1, -1]) {
        let ax = sd * -sw * 0.5 * run, az = sd * (0.1 + s.breath * 0.03);
        if (s.atk >= 0) { const a = s.atk; ax = a < 0.45 ? -2.8 * (a / 0.45) : -2.8 + (a - 0.45) / 0.55 * 2.9; }
        ax -= s.aim * 2.4; az += sd * (s.aim * 0.4 + s.tuck * 0.9);
        P.part(1, B, 0.52 * sd, 0.78, 0, ax, 0, az, 1, 1, 1);
        P.part(2, P.R, 0.2 * sd, 0.28 + bob * 0.4, 0, sd * sw * 0.55 * run - s.tuck * 0.5, 0, 0, 1, 1, 1);
      }
    },
  };
}

function beast(f, pal, o) {
  const [base, dark, light] = pal;
  const S = new Shape({ low: !(o.boss || o.pet) });
  const H = { x: 0, y: 0.68, z: 0.4, rx: 0.27, ry: 0.25, rz: 0.25 };
  S.put('sph:12:9', base, 0, 0.47, -0.06, 0.66, 0.54, 0.92);
  S.put('sph:10:8', light, 0, 0.38, 0.02, 0.5, 0.34, 0.74, 0, 0, 0, { grad: 0.05 });
  S.put('sph:12:9', base, 0, 0.68, 0.4, 0.54, 0.5, 0.5);
  let top = 0.95;
  if (f.snout === 'flat') S.put('sph:10:8', light, 0, 0.58, 0.58, 0.3, 0.2, 0.16);
  else {
    S.put('rbox:0.4', light, 0, 0.59, 0.6, 0.24, 0.17, 0.22);
    S.put('sph:6:4', DARK, 0, 0.65, 0.71, 0.09, 0.06, 0.06, 0, 0, 0, { grad: 0 });
  }
  const ears = f.ears || 'pointy';
  if (ears === 'pointy') for (const sd of [1, -1]) {
    S.put('cone:4', base, 0.15 * sd, 0.92, 0.36, 0.14, 0.24, 0.1, -0.1, 0.4 * sd, -0.25 * sd);
    S.put('cone:4', '#ff9ab0', 0.15 * sd, 0.9, 0.39, 0.07, 0.14, 0.04, -0.1, 0.4 * sd, -0.25 * sd, { grad: 0 });
  }
  if (ears === 'horn') for (const sd of [1, -1]) S.put('cone:5', light, 0.16 * sd, 0.92, 0.3, 0.08, 0.3, 0.08, -0.6, 0, -0.35 * sd, { glow: 0.3 });
  if (f.fur) {
    for (let i = 0; i < 7; i++) { const a = i / 7 * PI; S.put('sph:8:6', mix(base, '#ffffff', 0.4), Math.cos(a) * 0.3, 0.6 + Math.sin(a) * 0.18, 0.18, 0.22, 0.22, 0.22); }
    for (let i = 0; i < 4; i++) S.put('sph:8:6', mix(base, '#ffffff', 0.3), (i % 2 - 0.5) * 0.3, 0.72 - i * 0.02, -0.2 - i * 0.12, 0.26, 0.2, 0.26);
  }
  if (f.spikesBack) spikesAlong(S, [[0, 0.82, 0.05, -0.4], [0, 0.82, -0.15, -0.6], [0, 0.78, -0.33, -0.8], [0, 0.72, -0.48, -1.0]], light, o.boss ? 0.28 : 0.22, { glow: 0.4 });
  if (f.plates) for (let i = 0; i < 3; i++) S.put('rbox:0.3', dark, 0, 0.74 - i * 0.03, 0.08 - i * 0.2, 0.48 - i * 0.06, 0.08, 0.2, 0.2);
  if (f.eyeBack) {
    const ek = o.boss ? 1.4 : 1;
    S.put('sph:12:8', '#ffffff', 0, 0.8 + 0.04 * ek, -0.18, 0.3 * ek, 0.26 * ek, 0.3 * ek, 0, 0, 0, { grad: 0 });
    S.put('sph:10:8', o.pet ? DARK : '#ff3ab0', 0, 0.88 + 0.06 * ek, -0.08 + 0.03 * ek, 0.16 * ek, 0.14 * ek, 0.1 * ek, 0.6, 0, 0, { glow: o.pet ? 0 : 0.8, grad: 0 });
    S.put('arc:0.12:3.2', dark, 0, 0.8 + 0.04 * ek, -0.18, 0.36 * ek, 0.36 * ek, 0.4 * ek, 0, PI / 2, 0);
  }
  if (o.boss) spikesAlong(S, [[0.22, 0.74, -0.3, -0.7, -0.6], [-0.22, 0.74, -0.3, -0.7, 0.6], [0, 0.7, -0.48, -1.0], [0.25, 0.62, 0.1, -0.2, -0.9], [-0.25, 0.62, 0.1, -0.2, 0.9]], light, 0.24, { glow: 0.4 });
  horns(S, H, f.horns, pal, o);
  if (f.horns) top += 0.12;
  if (o.boss && !f.horns) horns(S, H, 'demon', pal, o);
  face(S, H, f, pal, o, { eyeV: 0.28, eyeU: 0.4, eyeK: 1.05, mouthV: -0.62 });
  const leg = new Shape({ low: !(o.boss || o.pet) });
  leg.put('rbox:0.35', dark, 0, -0.15, 0, 0.15, 0.3, 0.17);
  leg.put('rbox:0.35', o.boss ? '#f4ecd8' : tint(dark, -0.2), 0, -0.28, 0.04, 0.18, 0.07, 0.22);
  if (o.boss) leg.put('cone:4', '#f4ecd8', 0, -0.28, 0.17, 0.1, 0.12, 0.06, PI / 2, 0, 0);
  const tail = new Shape({ low: !(o.boss || o.pet) });
  if (f.tail === 'spike') { tail.put('cone:6', base, 0, 0.02, -0.18, 0.16, 0.4, 0.16, -PI / 2 + 0.4); tail.put('cone:4', light, 0, 0.1, -0.38, 0.1, 0.18, 0.06, -PI / 2 + 0.6, 0, 0, { glow: 0.4 }); }
  else if (f.tail === 'stub') tail.put('sph:8:6', mix(base, '#ffffff', 0.4), 0, 0, -0.04, 0.2, 0.18, 0.16);
  else { tail.put('sph:10:7', base, 0, 0.1, -0.16, 0.2, 0.2, 0.44, 0.6); tail.put('sph:8:6', light, 0, 0.21, -0.33, 0.14, 0.14, 0.2, 0.6); }
  return {
    parts: [{ geo: S.build(), n: 1 }, { geo: leg.build(), n: 4 }, { geo: tail.build(), n: 1 }], top, stride: 8,
    pose(P, s) {
      const run = Math.min(1.3, s.spd), sw = Math.sin(s.ph);
      const bob = Math.abs(Math.cos(s.ph)) * 0.05 * run + s.breath * 0.01;
      const pitch = Math.sin(s.ph * 2) * 0.05 * run + s.atkK * 0.25 - s.aim * 0.3;
      const B = P.keep(0, P.part(0, P.R, 0, bob + s.tuck * 0.1, 0, pitch, 0, 0, 1, 1 + s.breath * 0.025, 1));
      const k = 0.65 * run, t = s.tuck;
      P.part(1, P.R, 0.2, 0.31 + bob * 0.5, 0.26, sw * k - t * 0.8 - s.aim * 0.5, 0, 0, 1, 1, 1);
      P.part(1, P.R, -0.2, 0.31 + bob * 0.5, 0.26, -sw * k - t * 0.8 - s.aim * 0.5, 0, 0, 1, 1, 1);
      P.part(1, P.R, 0.2, 0.31 + bob * 0.5, -0.33, -sw * k + t * 0.8, 0, 0, 1, 1, 1);
      P.part(1, P.R, -0.2, 0.31 + bob * 0.5, -0.33, sw * k + t * 0.8, 0, 0, 1, 1, 1);
      P.part(2, B, 0, 0.52, -0.5, 0.2 + Math.sin(s.t * 4) * 0.1, Math.sin(s.t * (6 + 6 * run)) * 0.5, 0, 1, 1, 1);
    },
  };
}

function bird(f, pal, o) {
  const [base, dark, light] = pal;
  const S = new Shape({ low: !(o.boss || o.pet) });
  const H = { x: 0, y: 0.52, z: 0.02, rx: 0.33, ry: 0.31, rz: 0.33 };
  S.put('sph:14:10', base, 0, 0.48, 0, 0.66, 0.62, 0.66);
  S.put('sph:10:8', light, 0, 0.38, 0.12, 0.46, 0.42, 0.44, 0, 0, 0, { grad: 0.05 });
  const beakC = f.crystals ? '#e0f8ff' : '#ffb03a';
  if (f.beak === 'long') {
    S.put('cone:6', beakC, 0, 0.47, 0.5, 0.1, 0.36, 0.08, PI / 2);
  } else {
    S.put('cone:6', beakC, 0, 0.5, 0.38, 0.17, 0.2, 0.12, PI / 2 + 0.2);
    S.put('cone:6', tint(beakC, -0.2), 0, 0.44, 0.36, 0.11, 0.12, 0.08, PI / 2 - 0.15);
  }
  crest(S, H, f.crest, pal, o);
  let top = f.crest ? 1.02 : 0.82;
  // queue
  if (f.tailLong) for (let i = -1; i <= 1; i++) S.put('cone:5', i ? light : mix(light, '#ffffff', 0.5), i * 0.1, 0.5, -0.5, 0.14, 0.7, 0.06, -PI / 2 - 0.5 + Math.abs(i) * 0.2, 0, i * 0.3, { glow: 0.5 });
  else for (let i = -1; i <= 1; i++) S.put('cone:5', i ? dark : base, i * 0.08, 0.46, -0.36, 0.13, 0.3, 0.05, -PI / 2 - 0.45, 0, i * 0.35);
  if (o.boss) crystalsOn(S, [[0, 0.82, -0.12, 0, 1.1], [0.16, 0.76, -0.1, -0.5, 0.8], [-0.16, 0.76, -0.1, 0.5, 0.8]], f.crystals || light, 0.2);
  face(S, H, { ...f, mouth: f.mouth || 'none' }, pal, o, { eyeV: 0.22, eyeU: 0.4, eyeK: 1.1, mouthV: -0.5 });
  const wing = new Shape({ low: !(o.boss || o.pet) });
  const wk = o.boss ? 1.6 : 1;
  wing.put('sph:10:7', base, 0.2 * wk, 0, -0.04, 0.46 * wk, 0.13, 0.36 * wk);
  for (let i = 0; i < 3; i++) wing.put('sph:6:4', i === 1 ? light : dark, (0.3 + i * 0.08) * wk, -0.01, (-0.14 - i * 0.03) * wk, 0.18 * wk, 0.08, 0.26 * wk, 0, -0.5 - i * 0.2, 0, f.tailLong ? { glow: 0.35 } : {});
  if (f.crystals) for (let i = 0; i < (o.boss ? 3 : 1); i++) wing.put('oct', f.crystals, (0.42 + i * 0.14) * wk, 0.03, (-0.02 - i * 0.08) * wk, 0.12, 0.07, 0.3 * wk, 0, 0.3 + i * 0.3, 0, { glow: 0.7 });
  const leg = new Shape({ low: !(o.boss || o.pet) });
  leg.put('cyl:5', '#ff9a3a', 0, -0.08, 0, 0.04, 0.16, 0.04);
  leg.put('cone:4', '#ff9a3a', 0, -0.17, 0.05, 0.08, 0.12, 0.04, PI / 2, 0, 0);
  return {
    parts: [{ geo: S.build(), n: 1 }, { geo: wing.build(), n: 2 }, { geo: leg.build(), n: 2 }], top, stride: 6, fly: true,
    pose(P, s) {
      const fl = s.t * (13 + 5 * Math.min(1, s.spd)) + s.seed;
      const flap = Math.sin(fl) * (0.75 + 0.2 * s.aim) + 0.15 + s.tuck * 0.8;
      const bob = -Math.sin(fl) * 0.035;
      const B = P.keep(0, P.part(0, P.R, 0, bob, 0, 0.2 * Math.min(1, s.spd) + s.atkK * 0.3, 0, 0, 1, 1, 1));
      P.part(1, B, 0.28, 0.54, -0.02, 0, -0.1, flap, 1, 1, 1);
      P.part(1, B, -0.28, 0.54, -0.02, 0, 0.1, PI - flap, 1, 1, 1);
      for (const sd of [1, -1]) P.part(2, B, 0.12 * sd, 0.2, 0.02, 0.5 + Math.sin(fl * 0.5 + sd) * 0.15, 0, 0, 1, 1, 1);
    },
  };
}

function crab(f, pal, o) {
  const [base, dark, light] = pal;
  const S = new Shape({ low: !(o.boss || o.pet) });
  const spider = !!f.spider, beetle = !!f.beetle;
  const H = { x: 0, y: 0.36, z: 0.02, rx: 0.43, ry: 0.23, rz: 0.35 };
  if (spider) {
    S.put('sph:12:9', tint(base, 0.12), 0, 0.42, -0.26, 0.74, 0.62, 0.74);
    for (let i = 0; i < 3; i++) S.put('torus:0.12:14', light, 0, 0.5 - i * 0.02, -0.18 - i * 0.12, 0.34 - i * 0.06, 0.34 - i * 0.06, 0.34 - i * 0.06, PI / 2 - 0.6, 0, 0, { glow: 0.8, grad: 0 });
    S.put('sph:8:6', light, 0, 0.62, -0.42, 0.14, 0.1, 0.14, 0, 0, 0, { glow: 0.9 });
    S.put('sph:12:9', dark, 0, 0.34, 0.16, 0.5, 0.36, 0.44);
  } else {
    S.put('sph:14:10', base, 0, 0.34, 0, 0.86, 0.46, 0.7);
    S.put('sph:10:8', light, 0, 0.42, -0.04, 0.56, 0.24, 0.46, 0, 0, 0, { grad: 0 });
    S.put('sph:12:8', dark, 0, 0.24, 0.02, 0.82, 0.18, 0.66);
  }
  let top = 0.82;
  if (beetle) {
    S.put('box', dark, 0, 0.5, -0.02, 0.02, 0.06, 0.6, 0, 0, 0, { grad: 0 });
    S.put('cone:6', light, 0, 0.52, 0.42, 0.14, 0.42, 0.14, 1.0, 0, 0, { glow: 0.3 });
    S.put('cone:5', light, 0, 0.66, 0.55, 0.06, 0.16, 0.06, 0.2, 0, 0);
  }
  if (f.shellSpikes || o.boss) spikesAlong(S, [[0.2, 0.52, -0.05, -0.2, -0.5], [-0.2, 0.52, -0.05, -0.2, 0.5], [0, 0.56, -0.12, -0.5, 0], [0.32, 0.46, -0.18, -0.4, -0.8], [-0.32, 0.46, -0.18, -0.4, 0.8]], tint(light, 0.2), 0.18);
  if (spider || beetle) {
    const Hs = spider ? { x: 0, y: 0.38, z: 0.2, rx: 0.25, ry: 0.18, rz: 0.22 } : H;
    face(S, Hs, { ...f, mouth: f.mouth || 'none' }, pal, o, { eyeV: spider ? 0.1 : 0.15, eyeU: 0.4, eyeK: spider ? 1.1 : 0.9, mouthV: -0.6 });
  } else {
    // yeux pédonculés
    for (const sd of [1, -1]) {
      S.put('cyl:5', dark, 0.13 * sd, 0.58, 0.2, 0.05, 0.22, 0.05);
      S.eye(0.13 * sd, 0.73, 0.2, 0.09, { side: sd, angry: o.pet ? 0 : (f.angry || (o.boss ? 1 : 0)), pupil: o.boss ? '#ff2a3a' : DARK, glow: o.boss ? 0.9 : 0, tall: 1.2 });
    }
    mouth(S, H, f.mouth || 'smile', 0.07, -0.25, pal);
  }
  // pince (base + mâchoire fixe) et mâchoire mobile
  const big = f.bigClaws || o.boss ? 1.3 : 1;
  const claw = new Shape({ low: !(o.boss || o.pet) }), pin = new Shape({ low: !(o.boss || o.pet) });
  if (spider) {
    claw.put('rbox:0.4', dark, 0, -0.04, 0.08, 0.07, 0.07, 0.16, 0.5, 0, 0);
    claw.put('cone:4', light, 0, -0.1, 0.17, 0.06, 0.12, 0.05, PI - 0.4, 0, 0, { glow: 0.4 });
    pin.put('sph:4:3', dark, 0, 0, 0, 0.02, 0.02, 0.02);
  } else {
    claw.put('rbox:0.4', dark, 0, 0, 0.1, 0.1, 0.1, 0.24);
    claw.put('sph:10:7', light, 0, 0, 0.3 * big, 0.24 * big, 0.2 * big, 0.28 * big);
    claw.put('cone:5', light, 0, -0.04 * big, 0.47 * big, 0.12 * big, 0.2 * big, 0.08 * big, PI / 2 + 0.15, 0, 0);
    pin.put('cone:5', tint(light, 0.15), 0, 0, 0.09 * big, 0.12 * big, 0.2 * big, 0.08 * big, PI / 2 - 0.1, 0, 0);
  }
  const leg = new Shape({ low: !(o.boss || o.pet) });
  if (spider) {
    leg.put('box', dark, 0.2, 0.12, 0, 0.4, 0.07, 0.07, 0, 0, 0.6);
    leg.put('oct', light, 0.37, 0.23, 0, 0.11, 0.11, 0.11, 0, 0, 0, { glow: 0.4 });
    leg.put('box', dark, 0.44, 0.0, 0, 0.07, 0.48, 0.07, 0, 0, 0.3);
  } else {
    leg.put('box', dark, 0.13, 0.06, 0, 0.26, 0.06, 0.06, 0, 0, 0.45);
    leg.put('box', dark, 0.28, -0.08, 0, 0.06, 0.3, 0.06, 0, 0, -0.25);
  }
  const legZ = spider ? [0.18, 0.04, -0.12, -0.28] : [0.06, -0.1, -0.26];
  const nLeg = legZ.length * 2;
  return {
    parts: [{ geo: S.build(), n: 1 }, { geo: claw.build(), n: 2 }, { geo: pin.build(), n: 2 }, { geo: leg.build(), n: nLeg }], top, stride: 10,
    pose(P, s) {
      const run = Math.min(1.3, s.spd);
      const sway = Math.sin(s.ph * 0.5) * 0.08 * run;
      const B = P.keep(0, P.part(0, P.R, sway * 0.3, 0.02 * Math.abs(Math.sin(s.ph)) * run + s.breath * 0.01 + s.tuck * 0.12, 0, s.atkK * 0.15 - s.aim * 0.2, 0, sway, 1, 1, 1));
      const snap = Math.max(0, Math.sin(s.t * (s.atk >= 0 ? 14 : 5) + s.seed)) * (s.atk >= 0 ? 1 : 0.6);
      for (const sd of [1, -1]) {
        const lift = 0.2 + Math.sin(s.t * 2 + sd) * 0.08 + s.atkK * 0.5 + s.aim * 0.8;
        const C = P.keep(1, P.part(1, B, (spider ? 0.12 : 0.36) * sd, spider ? 0.3 : 0.34, spider ? 0.32 : 0.18, -lift, sd * (spider ? 0.15 : 0.45), 0, 1, 1, 1));
        if (!spider) P.part(2, C, 0, 0.04 * big, 0.38 * big, -0.7 * (1 - snap), 0, 0, 1, 1, 1);
        else P.part(2, C, 0, 0, 0, 0, 0, 0, 1, 1, 1);
      }
      for (let i = 0; i < legZ.length; i++) for (const sd of [1, -1]) {
        const ph = s.ph + i * 1.6 + (sd > 0 ? 0 : PI);
        const up = Math.max(0, Math.sin(ph)) * 0.45 * run + s.tuck * 0.5;
        P.part(3, B, (spider ? 0.22 : 0.34) * sd, 0.27, legZ[i], 0, (sd > 0 ? 0 : PI) + Math.cos(ph) * 0.25 * run + sd * (spider ? (i - 1.5) * -0.35 : (i - 1) * -0.3), up, 1, 1, 1);
      }
    },
  };
}

function ghost(f, pal, o) {
  const [base, dark, light] = pal;
  const S = new Shape({ low: !(o.boss || o.pet) });
  const H = { x: 0, y: 0.58, z: 0.03, rx: 0.36, ry: 0.34, rz: 0.33 };
  S.put('sph:14:10', base, 0, 0.58, 0, 0.72, 0.68, 0.66);
  S.put('frust:0.35:0.38:12', base, 0, 0.36, 0, 1, 0.42, 0.94);
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; S.put('sph:5:4', i % 2 ? base : light, Math.cos(a) * 0.32, 0.16, Math.sin(a) * 0.3, 0.2, 0.2, 0.2); }
  S.put('sph:10:8', light, 0, 0.42, 0.14, 0.44, 0.34, 0.36, 0, 0, 0, { glow: 0.2, grad: 0 });
  let top = 0.95;
  if (f.hood) {
    S.put('sph:14:10', dark, 0, 0.66, -0.06, 0.82, 0.76, 0.74);
    S.put('cone:8', dark, 0, 1.0, -0.14, 0.4, 0.4, 0.4, -0.5);
    S.put('torus:0.14:16', tint(dark, -0.3), 0, 0.6, 0.22, 0.6, 0.56, 0.5);
    top = 1.15;
  }
  if (f.flame) {
    for (let i = -1; i <= 1; i++) S.put('cone:6', i ? base : light, i * 0.14, 0.98 - Math.abs(i) * 0.06, -0.06, 0.2, 0.42 - Math.abs(i) * 0.1, 0.2, -0.3, 0, -i * 0.4, { glow: 0.7 });
    top = 1.2;
  }
  if (f.fins) {
    S.put('cone:4', light, 0, 0.98, -0.06, 0.08, 0.34, 0.3, -0.3, 0, 0, { glow: 0.3 });
    for (const sd of [1, -1]) S.put('cone:4', light, 0.36 * sd, 0.66, -0.05, 0.06, 0.3, 0.22, 0, 0, -1.0 * sd, { glow: 0.3 });
    top = 1.1;
  }
  if (f.crystals) { crystalsOn(S, [[0, 1.0, -0.04, 0, 1.2], [0.2, 0.94, -0.04, -0.5, 0.9], [-0.2, 0.94, -0.04, 0.5, 0.9]], f.crystals, 0.2); top = 1.2; }
  if (f.chains) for (let i = 0; i < 4; i++) S.put('torus:0.2:10', '#6a7a78', -0.3 + i * 0.2, 0.3 + Math.sin(i) * 0.03, 0.3 - Math.abs(i - 1.5) * 0.06, 0.13, 0.13, 0.13, 0, i % 2 ? PI / 2 : 0, 0);
  if (o.boss && f.hood) {
    for (const sd of [1, -1]) spikesAlong(S, [[0.36 * sd, 0.82, -0.05, 0, -0.9 * sd, 1.2], [0.3 * sd, 0.96, -0.1, -0.2, -0.5 * sd]], '#c8ffe0', 0.2, { glow: 0.3 });
  }
  face(S, H, f, pal, o, { eyeV: 0.08, eyeU: 0.36, eyeK: 1.2, mouthV: -0.36 });
  const arm = new Shape({ low: !(o.boss || o.pet) });
  arm.put('sph:8:6', base, 0.06, -0.08, 0.04, 0.16, 0.26, 0.16, 0, 0, 0.5);
  arm.put('sph:6:4', light, 0.1, -0.18, 0.06, 0.12, 0.1, 0.12);
  const tail = new Shape({ low: !(o.boss || o.pet) });
  tail.put('cone:8', base, 0, -0.17, -0.08, 0.36, 0.4, 0.32, PI + 0.45);
  tail.put('sph:6:4', light, 0, -0.32, -0.17, 0.1, 0.1, 0.1, 0, 0, 0, { glow: 0.4 });
  const parts = [{ geo: S.build(), n: 1 }, { geo: arm.build(), n: 2 }, { geo: tail.build(), n: 1 }];
  let lantern = null;
  if (f.lantern) {
    lantern = new Shape({ low: !(o.boss || o.pet) });
    const lk = o.boss ? 1.5 : 1;
    lantern.put('cyl:4', '#5a6a68', 0, -0.12 * lk, 0, 0.02, 0.24 * lk, 0.02);
    lantern.put('rbox:0.3', '#2a3a38', 0, -0.26 * lk, 0, 0.18 * lk, 0.04 * lk, 0.18 * lk);
    lantern.put('sph:8:6', '#9affd0', 0, -0.36 * lk, 0, 0.18 * lk, 0.2 * lk, 0.18 * lk, 0, 0, 0, { glow: 1.4 });
    for (const sd of [1, -1]) lantern.put('box', '#2a3a38', 0.08 * lk * sd, -0.36 * lk, 0, 0.02, 0.2 * lk, 0.02, 0, 0, 0);
    lantern.put('cone:4', '#2a3a38', 0, -0.48 * lk, 0, 0.18 * lk, 0.08 * lk, 0.18 * lk, PI, PI / 4, 0);
    parts.push({ geo: lantern.build(), n: 1 });
  }
  return {
    parts, top, stride: 5, fly: true,
    pose(P, s) {
      const run = Math.min(1.2, s.spd);
      const float = Math.sin(s.t * 2.6 + s.seed) * 0.05;
      const sway = Math.sin(s.t * 1.7 + s.seed) * 0.12;
      const B = P.keep(0, P.part(0, P.R, 0, float + s.tuck * 0.1, 0, 0.22 * run + s.atkK * 0.25 - s.aim * 0.3, 0, sway, 1, 1 + s.breath * 0.03, 1));
      for (const sd of [1, -1]) {
        const wave = Math.sin(s.t * 4 + sd * 1.3 + s.seed) * 0.35 + s.cast * 1.2 + s.aim * 1.0;
        P.part(1, B, 0.32 * sd, 0.46, 0.04, -0.3 * run - s.cast * 1.2, sd > 0 ? 0 : PI, -wave * 0.6, 1, 1, 1);
      }
      P.part(2, B, 0, 0.2, -0.04, 0.35 * run + Math.sin(s.t * 3 + s.seed) * 0.2, 0, -sway * 1.6, 1, 1, 1);
      if (lantern) P.part(3, B, -0.42, 0.44, 0.12, Math.sin(s.t * 2.2) * 0.25 - 0.2 * run, 0, Math.sin(s.t * 1.8) * 0.15, 1, 1, 1);
    },
  };
}

function worm(f, pal, o) {
  const [base, dark, light] = pal;
  const S = new Shape({ low: !(o.boss || o.pet) });
  const H = { x: 0, y: 0.02, z: 0.02, rx: 0.28, ry: 0.26, rz: 0.31 };
  S.put('sph:14:10', base, 0, 0, 0, 0.56, 0.52, 0.62);
  S.put('sph:10:8', light, 0, -0.08, 0.06, 0.44, 0.34, 0.5, 0, 0, 0, { grad: 0 });
  if (f.mandibles) for (const sd of [1, -1]) {
    S.put('cone:5', light, 0.14 * sd, -0.12, 0.3, 0.07, 0.24, 0.07, 1.4, 0, -0.5 * sd);
  }
  if (f.spikes || o.boss) spikesAlong(S, [[0, 0.24, -0.08, -0.6], [0.14, 0.2, -0.12, -0.6, -0.5], [-0.14, 0.2, -0.12, -0.6, 0.5]], light, o.boss ? 0.22 : 0.16, { glow: 0.3 });
  horns(S, H, f.horns, pal, o);
  if (o.boss) for (let i = 0; i < 7; i++) {
    const a = (i / 6 - 0.5) * 2.6;
    S.put('cone:5', i % 2 ? light : pal[1], Math.sin(a) * 0.26, 0.06 + Math.cos(a) * 0.2, -0.16, 0.12, 0.36, 0.05, -0.5, 0, -a, { glow: i % 2 ? 0.5 : 0 });
  }
  face(S, H, f, pal, o, { eyeV: f.mouth === 'teeth' ? 0.42 : 0.24, eyeU: 0.38, eyeK: f.eyes === 'many' ? 0.95 : 1.1, mouthV: f.mouth === 'teeth' ? -0.25 : -0.4 });
  const seg = new Shape({ low: !(o.boss || o.pet) });
  seg.put('sph:10:8', base, 0, 0, 0, 0.5, 0.46, 0.5);
  seg.put('sph:8:6', light, 0, -0.07, 0.04, 0.4, 0.3, 0.42, 0, 0, 0, { grad: 0 });
  if (o.boss || o.pet) seg.put('torus:0.12:12', dark, 0, 0, 0, 0.44, 0.44, 0.44, 0, 0, 0);
  if (f.spikes || o.boss) seg.put('cone:5', light, 0, 0.25, 0, 0.12, 0.2, 0.12, -0.3, 0, 0, { glow: 0.3 });
  const N = f.segs || 5;
  const step = o.boss ? 0.23 : 0.25;
  return {
    parts: [{ geo: S.build(), n: 1 }, { geo: seg.build(), n: N }], top: 1.0, stride: 6,
    pose(P, s) {
      const run = Math.min(1.2, s.spd), t = s.t * 4.5 + s.seed;
      const hy = 0.66 + Math.sin(t * 0.5) * 0.05 + s.tuck * 0.15;
      const lunge = s.atkK * 0.25 + s.dash * 0.2 - s.aim * 0.2;
      for (let i = N; i >= 1; i--) {
        const k = i / N;
        const y = 0.16 + (hy - 0.16) * Math.pow(1 - k, 1.4) + Math.abs(Math.sin(s.ph - i * 0.9)) * 0.06 * run;
        const x = Math.sin(t - i * 0.85) * 0.1 * (0.4 + k);
        const sc = 1 - k * 0.42;
        P.part(1, P.R, x, y, 0.06 - i * step + lunge * (1 - k), 0, Math.cos(t - i * 0.85) * 0.3, 0, sc, sc, sc);
      }
      P.part(0, P.R, Math.sin(t) * 0.04, hy + 0.1, 0.12 + lunge, 0.15 - s.atkK * 0.4 + s.aim * 0.3, Math.sin(t + 0.6) * 0.18, Math.sin(t * 0.7) * 0.08, 1, 1, 1);
    },
  };
}

const BUILDERS = { blob, humanoid, golem, beast, bird, crab, ghost, worm };

// def : définition du monstre (data.js) ; o : { boss, pet }
export function buildRig(def, o = {}) {
  const f = { ...(FEATS[def.name] || {}) };
  return (BUILDERS[def.body] || blob)(f, def.pal, o);
}

// ---------- Une espèce = un InstancedMesh par partie ----------
const WHITE = new THREE.Color(1, 1, 1);
export class Kind {
  constructor(scene, mat, rig, cap) {
    this.rig = rig;
    this.cap = cap;
    this.idx = new Int32Array(rig.parts.length);
    this.capOf = rig.parts.map(p => cap * p.n);
    this.meshes = rig.parts.map((p, i) => {
      const m = new THREE.InstancedMesh(p.geo, mat, this.capOf[i]);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.setColorAt(0, WHITE);
      m.instanceColor.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false;
      m.count = 0;
      scene.add(m);
      return m;
    });
  }
  begin() { this.idx.fill(0); }
  end() {
    for (let i = 0; i < this.meshes.length; i++) {
      const m = this.meshes[i], n = this.idx[i];
      m.count = n; m.visible = n > 0;
      if (n) { m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }
    }
  }
  dispose() { for (const m of this.meshes) { m.geometry.dispose(); m.dispose?.(); } }
}

// ---------- Poseur : écrit les matrices des parties (aucune allocation) ----------
const L = new THREE.Matrix4(), O = new THREE.Matrix4();
export const Poser = {
  R: new THREE.Matrix4(),
  J: [new THREE.Matrix4(), new THREE.Matrix4(), new THREE.Matrix4(), new THREE.Matrix4()],
  kind: null,
  col: new THREE.Color(1, 1, 1),
  part(i, parent, tx, ty, tz, rx, ry, rz, sx, sy, sz) {
    compose(L, tx, ty, tz, rx, ry, rz, sx, sy, sz);
    O.multiplyMatrices(parent, L);
    const k = this.kind, n = k.idx[i];
    if (n < k.capOf[i]) {
      const m = k.meshes[i];
      O.toArray(m.instanceMatrix.array, n * 16);
      const ca = m.instanceColor.array, c = this.col;
      ca[n * 3] = c.r; ca[n * 3 + 1] = c.g; ca[n * 3 + 2] = c.b;
      k.idx[i] = n + 1;
    }
    return O;
  },
  keep(slot, m) { return this.J[slot].copy(m); },
};

// état d'animation d'un monstre (une seule allocation à sa première apparition)
export function animState(seed = Math.random()) {
  return { px: 0, py: 0, init: false, spd: 0, ph: seed * TAU, yaw: 0, turn: 0, t: seed * 10, seed: seed * 10, atk: -1, atkK: 0, cast: 0, shoot: 0, aim: 0, dash: 0, tuck: 0, impact: 0, breath: 0, hit: 0, roar: 0 };
}
