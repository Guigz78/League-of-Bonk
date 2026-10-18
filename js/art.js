// Sprites dessinés à la main : héros et icônes.
import { gridToCanvas, cachedURL, creatureURL } from './pixel.js';

const BASE = { k: '#1a1424', b: '#8a5a2a', w: '#ffffff', e: '#ffffff' };

const HEROES = {
  mage: [
    '...kkkkkk.......',
    '..khhhhhhk...kk.',
    '.khhhhhhhhk.kaak',
    '.khhsssshhk.kaak',
    '.khskssskhk..kk.',
    '.khsssssshk..kb.',
    '..khsddshk...kb.',
    '...kk33kk....kb.',
    '..k3311133k.kbk.',
    '.k3111a1113ssbk.',
    '.k31111112k.kb..',
    '..k111a112k.kb..',
    '..k3111112k..b..',
    '.k311111112k.b..',
    '.k3111111112kb..',
    'k31111111112k...',
    'kkkkkkkkkkkkk...',
    '...kddk.kddk....',
  ],
  archer: [
    '...kkkkkk.......',
    '..k111111k..kk..',
    '.k11hhhh11k.kbk.',
    '.k1hsssshh1kkwbk',
    '.k1hskssks1k.wbk',
    '.k1hsssssh1k.wbk',
    '.k11sddsh11k.wbk',
    '..kk1ssss1kk.wbk',
    '..k1222221k..wbk',
    '.k12aaaa21sssbk.',
    '.k1222222kk.wbk.',
    '.k122a2221k.wbk.',
    '..k1222221k.wbk.',
    '..k2222222k.kbk.',
    '...kcc.cck...kk.',
    '...kcc.cck......',
    '...kddkddk......',
    '...kkk.kkk......',
  ],
  knight: [
    '....kkkkk....k..',
    '...k33333k..k3k.',
    '..k3311113k.k3k.',
    '..k31kkkk1k.k3k.',
    '..k1ksssk1k.k3k.',
    '..k11kkk11k.k3k.',
    '...k11111k..k3k.',
    '..kkcccccckkkak.',
    'kkkkcaaacck.sbs.',
    'kcck1cacc1kssbk.',
    'kcak1caac1kk.k..',
    'kcck1cccc1k.....',
    '.kck2cccc2k.....',
    '..kk222222k.....',
    '...k22.22k......',
    '...k22.22k......',
    '...k33k33k......',
    '...kkk.kkk......',
  ],
};

export function heroURL(cls, colors) {
  return cachedURL('hero:' + cls, () => gridToCanvas(HEROES[cls], { ...BASE, ...colors }, 1));
}

// Icônes 10x10 : [grille, palette]
const ICONS = {
  staff: [[
    '......kkk.', '.....k3a3k', '.....kaaak', '......kak.', '.....kbk..',
    '....kbk...', '...kbk....', '..kbk.....', '.kbk......', '.kk.......',
  ], { a: '#ffd54a', 3: '#fff6c0' }],
  beam: [[
    '..........', 'kk........', 'k3kkkkkkkk', 'k3333333aa', 'k3aaaaaaaa',
    'k3333333aa', 'k3kkkkkkkk', 'kk........', '..........', '..........',
  ], { 3: '#fff6c0', a: '#ffd54a' }],
  bind: [[
    '..kkkkkk..', '.k3aaaa3k.', 'k3a....a3k', 'ka..kk..ak', 'ka.k33k.ak',
    'ka.k33k.ak', 'ka..kk..ak', 'k3a....a3k', '.k3aaaa3k.', '..kkkkkk..',
  ], { 3: '#fff6c0', a: '#ffd54a' }],
  nova: [[
    '....kk....', '.k..k3..k.', '..k.a3.k..', '...ka3k...', 'kka3333akk',
    'kka3333akk', '...k3ak...', '..k.3a.k..', '.k..3k..k.', '....kk....',
  ], { 3: '#ffffff', a: '#ffd54a' }],
  arrow: [[
    '......kkk.', '......k3k.', '.....k33k.', '....k3k.k.', '...kbk....',
    '..kbk.....', '.kbk......', 'kwk.......', 'kwwk......', '.kk.......',
  ], { 3: '#e8f0ff', w: '#e05050' }],
  volley: [[
    '..kk...kk.', '..k3k.k3k.', '...kbk.kbk', '..kbk.kbk.', '.kbk.kbk..',
    '.kk..kk...', '....kk....', '....k3k...', '.....kbk..', '....kbk...',
  ], { 3: '#e8f0ff' }],
  frost: [[
    '....kk....', '.k..33..k.', '..k.33.k..', '...k33k...', 'k33333333k',
    'k33333333k', '...k33k...', '..k.33.k..', '.k..33..k.', '....kk....',
  ], { 3: '#9ad8ff' }],
  crystal: [[
    '....kk....', '...k33k...', '..k3a33k..', '..k3a33k..', '.k3aa333k.',
    '.k3a3333k.', '..k3333k..', '..k3333k..', '...k33k...', '....kk....',
  ], { 3: '#7ac8ff', a: '#e8f8ff' }],
  sword: [[
    '........kk', '.......k3k', '......k3k.', '.....k3k..', '..k.k3k...',
    '...kk3k...', '...kak....', '..kbkak...', '.kbk..k...', '.kk.......',
  ], { 3: '#e8eef8', a: '#e6b422' }],
  shield: [[
    '.kkkkkkkk.', 'k33a33a33k', 'k3aaaaaa3k', 'k3a3aa3a3k', 'k3aaaaaa3k',
    'k3a3aa3a3k', '.k3aaaa3k.', '.k33aa33k.', '..k3333k..', '...kkkk...',
  ], { 3: '#c9ced8', a: '#2f55b8' }],
  spin: [[
    '...kkkk...', '.kk3333kk.', 'k33k..k.3k', 'k3k....k.k', 'k3k.......',
    '.......k3k', 'k.k....k3k', 'k3.k..k33k', '.kk3333kk.', '...kkkk...',
  ], { 3: '#e8eef8' }],
  justice: [[
    '....kk....', '...k33k...', '...k33k...', '...k33k...', '...k33k...',
    '.kkkaakkk.', '.kaaaaaak.', '...kbbk...', '...kbbk...', '....kk....',
  ], { 3: '#ffffff', a: '#ffd54a' }],
  tome: [[
    '.kkkkkkkk.', 'k1111111ak', 'k1a3311aak', 'k1a3a31aak', 'k1a3311aak',
    'k1111111ak', 'k1111111ak', 'k2222222ak', 'kwwwwwwwk.', '.kkkkkkk..',
  ], { 1: '#8a3ad8', 2: '#541f8a', 3: '#ffd54a', a: '#e0c8a8' }],
  bow: [[
    '...kk.....', '..kbbk....', '.kbk.wk...', '.kbk..wk..', 'kbk....wk.',
    'kbk....wk.', '.kbk..wk..', '.kbk.wk...', '..kbbk....', '...kk.....',
  ], { w: '#e8e8e8' }],
  armor: [[
    '.kk....kk.', 'k33kkkk33k', 'k3311113k.', '.k311113k.', '.k31aa13k.',
    '.k311113k.', '.k311113k.', '.k211112k.', '.k222222k.', '..kkkkkk..',
  ], { 1: '#9aa4b8', 2: '#6a7488', 3: '#d8e0f0', a: '#e6b422' }],
  cloak: [[
    '...kkkk...', '..k3aa3k..', '.k311113k.', '.k311113k.', 'k31111113k',
    'k31111112k', 'k31111112k', 'k21111122k', 'k2k2k2k22k', '.k.k.k.kk.',
  ], { 1: '#a83a3a', 2: '#6a1f1f', 3: '#e07a6a', a: '#e6b422' }],
  gem: [[
    '..kkkkkk..', '.k333311k.', 'k33311112k', 'k3311112k.', '.k311112k.',
    '..k3112k..', '...k12k...', '....kk....', '..........', '..........',
  ], { 1: '#4fa8ff', 2: '#2a5ad8', 3: '#c8e8ff' }],
  glove: [[
    '..k.k.k...', '.k3k3k3k..', '.k3k3k3kk.', '.k33333k3k', '.k3333333k',
    '.k333333k.', '.k333333k.', '.kaaaaaak.', '.kaaaaaak.', '.kkkkkkkk.',
  ], { 3: '#c87a4a', a: '#e6b422' }],
  ring: [[
    '....kk....', '...k33k...', '..kk33kk..', '.kaakkaak.', 'kak....kak',
    'ka......ak', 'kak....kak', '.kaakkaak.', '..kkkkkk..', '..........',
  ], { 3: '#ff4a6a', a: '#e6b422' }],
  heart: [[
    '..........', '.kk...kk..', 'k33k.k11k.', 'k311k1111k', 'k31111111k',
    '.k1111112k', '..k11112k.', '...k112k..', '....kk....', '..........',
  ], { 1: '#ff4a5a', 2: '#b02a3a', 3: '#ffb0b8' }],
  fist: [[
    '..........', '..kkkkk...', '.k3k3k3k..', '.k3k3k3kk.', '.k333333k.',
    '.k3333332k', '.k333332k.', '..k22222k.', '...kkkkk..', '..........',
  ], { 3: '#ffb070', 2: '#c87a4a' }],
  target: [[
    '..kkkkkk..', '.k111111k.', 'k11kkkk11k', 'k1k1111k1k', 'k1k1kk1k1k',
    'k1k1kk1k1k', 'k1k1111k1k', 'k11kkkk11k', '.k111111k.', '..kkkkkk..',
  ], { 1: '#ff5a4a' }],
  mana: [[
    '....kk....', '...k33k...', '..k3111k..', '..k3111k..', '.k311111k.',
    '.k311111k.', 'k31111112k', 'k31111122k', '.k122222k.', '..kkkkkk..',
  ], { 1: '#3a8aff', 2: '#2456b8', 3: '#a8d0ff' }],
  potion: [[
    '...kkkk...', '...kbbk...', '....kk....', '...k33k...', '..k3111k..',
    '.k311111k.', '.k311111k.', '.k311112k.', '..k2222k..', '...kkkk...',
  ], { 1: '#ff4a6a', 2: '#b02a4a', 3: '#ffd0d8' }],
  gold: [[
    '..kkkkkk..', '.k333333k.', 'k33111113k', 'k3112k113k', 'k3112k112k',
    'k3112k112k', 'k3111k112k', 'k21111122k', '.k222222k.', '..kkkkkk..',
  ], { 1: '#ffc83a', 2: '#c88a1a', 3: '#fff0a0' }],
  star: [[
    '....kk....', '....k3k...', '...k33k...', 'kkkk331kkk', 'k3333111k.',
    '.k331111k.', '..k31111k.', '.k311k11k.', '.k1kk.k1k.', '.kk....kk.',
  ], { 1: '#ffc83a', 3: '#fff0a0' }],
  lock: [[
    '...kkkk...', '..k3..3k..', '..k....k..', '.kkkkkkkk.', '.k111111k.',
    '.k11kk11k.', '.k11kk11k.', '.k111111k.', '.k222222k.', '.kkkkkkkk.',
  ], { 1: '#e6b422', 2: '#a07a1a', 3: '#c8c8c8' }],
  skull: [[
    '..kkkkkk..', '.k333333k.', 'k33333333k', 'k3kk33kk3k', 'k3kk33kk3k',
    'k33333333k', '.k333k33k.', '..k3k3k3k.', '..kkkkkkk.', '..........',
  ], { 3: '#f0ece0' }],
  crown: [[
    '..........', 'k...kk...k', 'kk.k33k.kk', 'k3kk11kk3k', 'k3111111ak',
    'k11a11a11k', 'k11111111k', 'k22222222k', 'kkkkkkkkkk', '..........',
  ], { 1: '#ffc83a', 2: '#c88a1a', 3: '#fff0a0', a: '#ff4a6a' }],
  // Intentions ennemies
  i_atk: [[
    '........kk', '.......k3k', '......k3k.', '.....k3k..', '..k.k3k...',
    '...kk3k...', '...kak....', '..kbkak...', '.kbk..k...', '.kk.......',
  ], { 3: '#ffffff', a: '#ff6a4a' }],
  i_heavy: [[
    '.kkkkkk...', 'k333333k..', 'k311113k..', 'k311113k..', '.kkk33kkk.',
    '...kbbk...', '...kbbk...', '...kbbk...', '...kbbk...', '...kkkk...',
  ], { 1: '#9aa4b8', 3: '#e8eef8' }],
  i_burn: [[
    '....k.....', '...k3k....', '...k3k.k..', '..k331k3k.', '.k3311k3k.',
    '.k311113k.', 'k31a1a113k', 'k31aaa113k', '.k31a113k.', '..kkkkkk..',
  ], { 1: '#ff7a2a', 3: '#ffd84a', a: '#fff6c0' }],
  i_poison: [[
    '....kk....', '...k33k...', '..k3111k..', '..k3111k..', '.k311111k.',
    '.k311111k.', 'k31111111k', 'k31111111k', '.k111111k.', '..kkkkkk..',
  ], { 1: '#6ad83a', 3: '#c8ff9a' }],
  i_heal: [[
    '...kkkk...', '...k33k...', '...k33k...', 'kkkk33kkkk', 'k33333333k',
    'k33333333k', 'kkkk33kkkk', '...k33k...', '...k33k...', '...kkkk...',
  ], { 3: '#5ae87a' }],
  i_guard: [[
    '.kkkkkkkk.', 'k33333333k', 'k31111113k', 'k31111113k', 'k31111113k',
    'k31111113k', '.k311113k.', '.k311113k.', '..k3113k..', '...kkkk...',
  ], { 1: '#6a8ab8', 3: '#c8d8f0' }],
  i_enrage: [[
    '..........', '.k......k.', 'k3k....k3k', 'k31k..k13k', '.k31kk13k.',
    '..k3113k..', '.k3k11k3k.', 'k3k.kk.k3k', '.k......k.', '..........',
  ], { 1: '#ff2a2a', 3: '#ff8a8a' }],
  i_drain: [[
    '....kk....', '...k33k...', '..k3113k..', '.k311113k.', '.k311113k.',
    '..k3113k..', '...k11k..k', '....kk..k3', '........k3', '.........k',
  ], { 1: '#b02a4a', 3: '#ff6a8a' }],
  i_multi: [[
    'kk..kk..kk', 'k3k.k3k.k3', '.k3k.k3k.k', '..k3k.k3k.', '...kk..kk.',
    '..........', 'kk..kk..kk', 'k3k.k3k.k3', '.k3k.k3k.k', '..kk..kk..',
  ], { 3: '#ffffff' }],
  i_stun: [[
    '..........', '..k...k...', '.k3k.k3k..', 'k333k333k.', '.k3k.k3k..',
    '..k...k...', '.....k....', '....k3k...', '...k333k..', '....k3k...',
  ], { 3: '#ffe04a' }],
  // Expédition : forge, butin, portail
  hammer: [[
    '.kkkkkkkk.', 'k3333333ak', 'k3aaaaaa2k', '.kkkkbkkk.', '....kbk...',
    '....kbk...', '....kbk...', '....kbk...', '....kbk...', '....kkk...',
  ], { 3: '#e8eef8', a: '#9aa4b8', 2: '#5a6478', b: '#c8874a' }],
  chest: [[
    '..........', '.kkkkkkkk.', 'k33333333k', 'k31111113k', 'kkkkaakkkk',
    'k111ka111k', 'k1111k111k', 'k21111112k', 'k22222222k', '.kkkkkkkk.',
  ], { 1: '#c8874a', 2: '#8a5428', 3: '#f0b070', a: '#ffd54a' }],
  portal: [[
    '..kkkkkk..', '.k111111k.', 'k11333311k', 'k13111131k', 'k131ww131k',
    'k131ww131k', 'k13111131k', 'k11333311k', '.k111111k.', '..kkkkkk..',
  ], { 1: '#8a3ad8', 3: '#e0b0ff', w: '#ffffff' }],
  upg: [[
    '....kk....', '...k33k...', '..k3333k..', '.k333333k.', 'kkkk33kkkk',
    '...k33k...', '...k33k...', '...k22k...', '...k22k...', '...kkkk...',
  ], { 3: '#7af09a', 2: '#3ab85a' }],
  // caractéristiques des objets
  critdmg: [[
    '....kk....', '...k33k...', 'kk.k33k.kk', 'k3kk11kk3k', '.k311113k.',
    '.k311113k.', 'k3kk11kk3k', 'kk.k33k.kk', '...k33k...', '....kk....',
  ], { 1: '#ff4a3a', 3: '#ffd54a' }],
  lifesteal: [[
    '....kk....', '...k11k...', '..k1111k..', '.k113111k.', '.k131111k.',
    'k11111111k', 'k11111112k', '.k111122k.', '..k2222k..', '...kkkk...',
  ], { 1: '#ff3a5a', 2: '#a01a3a', 3: '#ffc0d0' }],
  haste: [[
    '.....kkk..', '....k33k..', '...k33k...', '..k333kkk.', '.k3333333k',
    '.kkk3333k.', '...k333k..', '..k33k....', '.k3k......', '.kk.......',
  ], { 3: '#ffe04a' }],
  area: [[
    '..kkkkkk..', '.k3....3k.', 'k3.kkkk.3k', 'k.k1111k.k', 'k.k1aa1k.k',
    'k.k1aa1k.k', 'k.k1111k.k', 'k3.kkkk.3k', '.k3....3k.', '..kkkkkk..',
  ], { 1: '#ff9a3a', a: '#fff0a0', 3: '#ffd54a' }],
  thorns: [[
    'k...kk...k', 'kk.k33k.kk', '.k3k33k3k.', '..k3333k..', 'kk333333kk',
    'kk333333kk', '..k3333k..', '.k3k33k3k.', 'kk.k33k.kk', 'k...kk...k',
  ], { 3: '#8ad84a' }],
  dodge: [[
    '..........', '...kkkkk..', '..k33333k.', '.kkkkk33k.', '......k3k.',
    '.kkkkkk3k.', 'k333333k..', '.kkkkkk...', '..k33k....', '...kk.....',
  ], { 3: '#c8f0ff' }],
};

export function iconURL(name) {
  const def = ICONS[name] || ICONS.star;
  return cachedURL('ic:' + name, () => gridToCanvas(def[0], { ...BASE, ...def[1] }, 1));
}

export function iconImg(name, size = 24, cls = '') {
  return `<img class="px ${cls}" src="${iconURL(name)}" width="${size}" height="${size}" alt="">`;
}

export { creatureURL };

// Canvas (pour le moteur temps réel)
export function heroCanvas(cls, colors) {
  return gridToCanvas(HEROES[cls], { ...BASE, ...colors }, 1);
}
export function iconCanvas(name) {
  const def = ICONS[name] || ICONS.star;
  return gridToCanvas(def[0], { ...BASE, ...def[1] }, 1);
}

// Grille + palette d'un héros (pour le modèle 3D). evo : 0, 1 ou 2 (évolutions).
export function heroGrid(cls, colors) {
  return { grid: HEROES[cls], colors: { ...BASE, ...colors } };
}

// ---------- Expédition : coffres de butin, enclume et marteau (dessin vectoriel, style cartoon) ----------
const TAU = Math.PI * 2, INK = '#1a1424';
const CHEST_PAL = [
  { hi: '#f6c088', a: '#d08a4a', b: '#7a4620', band: '#8a94a8', bandD: '#454d60', lock: '#ffd54a', lockD: '#a8700c', glow: '#ffd27a' },
  { hi: '#ffffff', a: '#dce6f6', b: '#7a8aa8', band: '#55658a', bandD: '#28324c', lock: '#ffd54a', lockD: '#a8700c', glow: '#d8ecff' },
  { hi: '#fff6c0', a: '#ffcc3a', b: '#b8740c', band: '#9a4a16', bandD: '#4e2406', lock: '#fff2b8', lockD: '#c08a18', glow: '#ffe066' },
  { hi: '#ffd6f8', a: '#e05ad2', b: '#5a168e', band: '#ffd54a', bandD: '#9a6a0a', lock: '#8af4ff', lockD: '#2a86b8', glow: '#ff9ae8' },
];

function rrect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function vgrad(g, y0, y1, stops) {
  const gr = g.createLinearGradient(0, y0, 0, y1);
  stops.forEach((c, i) => gr.addColorStop(i / (stops.length - 1), c));
  return gr;
}
function ink(g, w = 3.2) { g.strokeStyle = INK; g.lineWidth = w; g.stroke(); }
function sparkle(g, x, y, r, col) {
  g.fillStyle = col; g.beginPath();
  g.moveTo(x, y - r); g.quadraticCurveTo(x, y, x + r, y); g.quadraticCurveTo(x, y, x, y + r); g.quadraticCurveTo(x, y, x - r, y); g.quadraticCurveTo(x, y, x, y - r);
  g.fill();
}
function canvas2x(W, H, S = 2) {
  const c = document.createElement('canvas'); c.width = W * S; c.height = H * S;
  const g = c.getContext('2d'); g.scale(S, S); g.lineJoin = 'round'; g.lineCap = 'round';
  return [c, g];
}

// coffre de butin (tier 0 bois … 3 mythique), fermé ou ouvert
export function chestURL(tier = 0, open = false) {
  return cachedURL(`chest:${tier}:${open ? 1 : 0}`, () => drawChest(tier, open));
}

function drawChest(tier, open) {
  const P = CHEST_PAL[tier] || CHEST_PAL[0];
  const [c, g] = canvas2x(120, 112);
  g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(60, 104, 50, 7, 0, 0, TAU); g.fill();
  const straps = (y0, y1) => { for (const x of [22, 88]) { g.fillStyle = vgrad(g, y0, y1, [P.band, P.bandD]); g.fillRect(x, y0, 10, y1 - y0); g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(x + 2, y0, 2, y1 - y0); } };
  if (open) {
    // couvercle basculé vers l'arrière : on voit son intérieur
    const lid = () => { g.beginPath(); g.moveTo(12, 56); g.lineTo(18, 18); g.quadraticCurveTo(60, 2, 102, 18); g.lineTo(108, 56); g.closePath(); };
    lid(); g.fillStyle = vgrad(g, 8, 56, [P.b, P.a]); g.fill();
    g.save(); lid(); g.clip(); straps(0, 60); g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(0, 36, 120, 30); g.restore();
    lid(); ink(g);
    // lumière du trésor
    const gl = g.createRadialGradient(60, 58, 2, 60, 58, 48);
    gl.addColorStop(0, '#ffffff'); gl.addColorStop(0.35, P.glow); gl.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gl; g.beginPath(); g.ellipse(60, 58, 47, 12, 0, 0, TAU); g.fill();
  }
  // corps
  rrect(g, 12, 56, 96, 44, 7); g.fillStyle = vgrad(g, 56, 100, [P.a, P.b]); g.fill();
  g.save(); rrect(g, 12, 56, 96, 44, 7); g.clip();
  if (tier === 0) { g.strokeStyle = 'rgba(60,30,10,.45)'; g.lineWidth = 2; for (const y of [72, 86]) { g.beginPath(); g.moveTo(12, y); g.lineTo(108, y); g.stroke(); } }
  else { g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(12, 64, 96, 4); }
  straps(56, 100);
  g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(12, 92, 96, 8);
  g.restore();
  rrect(g, 12, 56, 96, 44, 7); ink(g);
  if (!open) {
    // couvercle bombé
    const lid = () => { g.beginPath(); g.moveTo(10, 60); g.lineTo(10, 40); g.bezierCurveTo(10, 18, 30, 12, 60, 12); g.bezierCurveTo(90, 12, 110, 18, 110, 40); g.lineTo(110, 60); g.closePath(); };
    lid(); g.fillStyle = vgrad(g, 12, 60, [P.hi, P.a, P.b]); g.fill();
    g.save(); lid(); g.clip(); straps(0, 62);
    if (tier === 0) { g.strokeStyle = 'rgba(60,30,10,.4)'; g.lineWidth = 2; g.beginPath(); g.moveTo(10, 34); g.quadraticCurveTo(60, 22, 110, 34); g.stroke(); }
    g.restore();
    lid(); ink(g);
    g.strokeStyle = 'rgba(255,255,255,.65)'; g.lineWidth = 3; g.beginPath(); g.moveTo(20, 36); g.quadraticCurveTo(26, 20, 48, 18); g.stroke();
  }
  // rebord du couvercle
  rrect(g, 8, 52, 104, 10, 4); g.fillStyle = vgrad(g, 52, 62, [P.band, P.bandD]); g.fill(); ink(g, 2.8);
  g.fillStyle = 'rgba(255,255,255,.3)'; g.fillRect(12, 54, 96, 2);
  // rivets / gemmes
  for (const x of [27, 93]) for (const y of [70, 90]) {
    if (tier === 3) { g.fillStyle = y === 70 ? '#8af4ff' : '#ff6ad8'; g.beginPath(); g.moveTo(x, y - 5); g.lineTo(x + 4, y); g.lineTo(x, y + 5); g.lineTo(x - 4, y); g.closePath(); g.fill(); ink(g, 1.6); }
    else { g.fillStyle = tier === 2 ? '#fff2b8' : '#d8e0f0'; g.beginPath(); g.arc(x, y, 2.4, 0, TAU); g.fill(); }
  }
  // serrure
  const ly = open ? 60 : 48;
  rrect(g, 49, ly, 22, 24, 6); g.fillStyle = vgrad(g, ly, ly + 24, [P.lock, P.lockD]); g.fill(); ink(g, 2.8);
  g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(53, ly + 3, 4, 8);
  g.fillStyle = INK; g.beginPath(); g.arc(60, ly + 10, 3.2, 0, TAU); g.fill(); g.fillRect(58.6, ly + 11, 2.8, 7);
  if (open) {
    // colonne de lumière qui s'échappe (s'estompe vers le haut)
    const col = g.createLinearGradient(0, 58, 0, 4);
    col.addColorStop(0, P.glow); col.addColorStop(1, 'rgba(255,255,255,0)');
    g.globalAlpha = 0.55; g.fillStyle = col;
    g.beginPath(); g.moveTo(30, 57); g.lineTo(14, 4); g.lineTo(106, 4); g.lineTo(90, 57); g.closePath(); g.fill();
    g.globalAlpha = 1;
    sparkle(g, 40, 40, 5, '#fff'); sparkle(g, 80, 34, 4, '#fff'); sparkle(g, 60, 24, 7, '#fff');
  } else if (tier >= 2) {
    sparkle(g, 100, 18, 6, '#fff'); sparkle(g, 18, 50, 4, tier === 3 ? '#8af4ff' : '#fff6c0');
  }
  return c;
}

// enclume de la forge
export function anvilURL() {
  return cachedURL('anvil', () => {
    const [c, g] = canvas2x(150, 100);
    g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(75, 92, 58, 7, 0, 0, TAU); g.fill();
    const steel = (y0, y1) => vgrad(g, y0, y1, ['#a8b2c6', '#5a6478', '#2e3446']);
    g.beginPath(); g.moveTo(34, 90); g.lineTo(46, 70); g.lineTo(106, 70); g.lineTo(118, 90); g.closePath(); g.fillStyle = steel(70, 90); g.fill(); ink(g);
    g.beginPath(); g.moveTo(56, 72); g.lineTo(62, 46); g.lineTo(96, 46); g.lineTo(100, 72); g.closePath(); g.fillStyle = steel(46, 72); g.fill(); ink(g);
    g.beginPath(); g.moveTo(42, 24); g.lineTo(128, 24); g.quadraticCurveTo(136, 24, 136, 32); g.lineTo(136, 42); g.quadraticCurveTo(136, 50, 128, 50);
    g.lineTo(58, 50); g.quadraticCurveTo(28, 50, 6, 30); g.quadraticCurveTo(26, 25, 42, 24); g.closePath();
    g.fillStyle = steel(24, 50); g.fill(); ink(g);
    g.fillStyle = '#d8e0ee'; g.fillRect(44, 26, 88, 4);
    g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 2; g.beginPath(); g.moveTo(14, 30); g.quadraticCurveTo(28, 28, 42, 28); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(64, 50, 6, 20);
    return c;
  });
}

// marteau de forgeron (pivot en bas du manche)
export function hammerURL() {
  return cachedURL('hammer-big', () => {
    const [c, g] = canvas2x(90, 110);
    rrect(g, 40, 34, 11, 72, 5); g.fillStyle = vgrad(g, 34, 106, ['#e0a060', '#8a5428']); g.fill(); ink(g, 3);
    g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(43, 40, 3, 60);
    rrect(g, 36, 34, 19, 9, 3); g.fillStyle = '#5a6478'; g.fill(); ink(g, 2.6);
    rrect(g, 8, 10, 74, 28, 7); g.fillStyle = vgrad(g, 10, 38, ['#e8eef8', '#9aa4b8', '#4a5266']); g.fill(); ink(g, 3.4);
    g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(14, 15, 56, 3);
    g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(8, 30, 6, 8); g.fillRect(76, 30, 6, 8);
    return c;
  });
}
