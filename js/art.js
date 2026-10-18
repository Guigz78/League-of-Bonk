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

// icône des menus : version vectorielle si elle existe (VI, plus bas), sinon pixel art
export function iconURL(name) {
  if (VI[name]) return cachedURL('vi:' + name, () => drawVI(name));
  const def = ICONS[name] || ICONS.star;
  return cachedURL('ic:' + name, () => gridToCanvas(def[0], { ...BASE, ...def[1] }, 1));
}

export function iconImg(name, size = 24, cls = '') {
  return `<img class="px${VI[name] ? ' vi' : ''} ${cls}" src="${iconURL(name)}" width="${size}" height="${size}" alt="">`;
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

// ---------- Icônes vectorielles des menus (style Clash Royale : contour foncé, dégradés, reflets) ----------
// Dessinées sur une grille de 64 unités, rendues en 160 px (nettes jusqu'à ~80 px à l'écran).
const VS = 2.5;
const vLG = (g, y0, y1, ...cs) => { const gr = g.createLinearGradient(0, y0, 0, y1); cs.forEach((c, i) => gr.addColorStop(i / (cs.length - 1), c)); return gr; };
const vXG = (g, x0, y0, x1, y1, ...cs) => { const gr = g.createLinearGradient(x0, y0, x1, y1); cs.forEach((c, i) => gr.addColorStop(i / (cs.length - 1), c)); return gr; };
const vRG = (g, x, y, r, ...cs) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); cs.forEach((c, i) => gr.addColorStop(i / (cs.length - 1), c)); return gr; };
const P = d => new Path2D(d);
const C = (x, y, r) => { const p = new Path2D(); p.arc(x, y, r, 0, TAU); return p; };
const E = (x, y, rx, ry, rot = 0) => { const p = new Path2D(); p.ellipse(x, y, rx, ry, rot, 0, TAU); return p; };
const R = (x, y, w, h, r) => { const p = new Path2D(); p.moveTo(x + r, y); p.arcTo(x + w, y, x + w, y + h, r); p.arcTo(x + w, y + h, x, y + h, r); p.arcTo(x, y + h, x, y, r); p.arcTo(x, y, x + w, y, r); p.closePath(); return p; };
const STAR = (x, y, ro, ri, n = 5, rot = -Math.PI / 2) => { const p = new Path2D(); for (let i = 0; i < n * 2; i++) { const a = rot + i * Math.PI / n, r = i % 2 ? ri : ro; if (i) p.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); else p.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } p.closePath(); return p; };
// forme remplie puis contour foncé
function F(g, p, fill, w = 3) { g.fillStyle = fill; g.fill(p); if (w) { g.lineWidth = w; g.strokeStyle = INK; g.stroke(p); } return p; }
// trait épais avec contour (arcs, cordes, manches)
function T(g, p, col, w) { g.lineWidth = w + 3.4; g.strokeStyle = INK; g.stroke(p); g.lineWidth = w; g.strokeStyle = col; g.stroke(p); }
// reflet blanc à l'intérieur de la forme p
function G(g, p, x, y, rx, ry, a = 0.5, rot = -0.6) { g.save(); g.clip(p); g.fillStyle = `rgba(255,255,255,${a})`; g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, TAU); g.fill(); g.restore(); }
// ombre propre en bas de la forme
function D(g, p, y, a = 0.22) { g.save(); g.clip(p); g.fillStyle = `rgba(0,0,0,${a})`; g.fillRect(0, y, 64, 64); g.restore(); }
const rot = (g, a, s = 1) => { g.translate(32, 32); g.rotate(a); g.scale(s, s); g.translate(-32, -32); };
const steel = (g, x0, x1) => vXG(g, x0, 0, x1, 0, '#ffffff', '#dfe8f5', '#a8b6cc', '#6e7c98');
const goldV = (g, y0, y1) => vLG(g, y0, y1, '#fff6b0', '#ffd23a', '#e89a12', '#b8640a');
const wood = (g, x0, x1) => vXG(g, x0, 0, x1, 0, '#f0b070', '#c8743a', '#8a4a1e');

function vSword(g, blade = null, grip = '#3a5ad8') {
  const b = F(g, P('M32 3 L38 12 L38 41 L26 41 L26 12 Z'), blade || steel(g, 26, 38));
  g.strokeStyle = 'rgba(80,96,128,.55)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(32, 9); g.lineTo(32, 38); g.stroke();
  G(g, b, 28.5, 18, 1.6, 12, 0.85, 0);
  F(g, R(28.5, 45, 7, 12, 2.5), vXG(g, 28, 0, 36, 0, '#7a9aff', grip, '#1f2f8a'));
  F(g, R(15, 39, 34, 8, 4), goldV(g, 39, 47));
  G(g, R(15, 39, 34, 8, 4), 24, 40.5, 8, 1.6, 0.7, 0);
  F(g, C(32, 59, 4.4), goldV(g, 55, 63));
}

const VI = {
  gold(g) {
    F(g, C(32, 36, 25), vLG(g, 11, 61, '#c87a0a', '#a85a06'), 3.2);
    const c = F(g, C(32, 32, 25), vRG(g, 26, 24, 32, '#fff8c0', '#ffd23a', '#f0a018', '#c8780a'), 3.2);
    g.lineWidth = 2.6; g.strokeStyle = 'rgba(160,90,10,.55)'; g.stroke(C(32, 32, 18));
    F(g, STAR(32, 33, 11, 5), vLG(g, 22, 44, '#fff6c0', '#ffb820'), 2);
    G(g, c, 22, 20, 10, 5, 0.55);
  },
  heart(g) {
    const p = F(g, P('M32 57 C 8 42 3 26 13 15 C 21 7 29 11 32 18 C 35 11 43 7 51 15 C 61 26 56 42 32 57 Z'), vLG(g, 8, 57, '#ff9aa8', '#ff3a52', '#c8102e'), 3.2);
    D(g, p, 44, 0.15); G(g, p, 20, 20, 7, 4.5, 0.65);
  },
  fist(g) {
    const skin = vLG(g, 12, 56, '#ffe0b8', '#ffb87a', '#d8783a');
    F(g, R(10, 25, 42, 31, 11), skin, 3);
    for (let i = 0; i < 4; i++) { const f = F(g, R(10.5 + i * 10.3, 12, 10.6, 21, 5.3), skin, 2.8); G(g, f, 14.5 + i * 10.3, 16, 2.2, 3.5, 0.55, 0); }
    F(g, R(13, 31, 27, 10, 5), vLG(g, 31, 41, '#ffd2a0', '#e8904e'), 2.8);
    F(g, R(8, 46, 46, 13, 5), vLG(g, 46, 59, '#ffe36a', '#e89a12'), 3);
  },
  target(g) {
    const o = F(g, C(32, 32, 27), vLG(g, 5, 59, '#ff8a6a', '#f2402e', '#b81e18'), 3.2);
    F(g, C(32, 32, 19.5), '#fff4ec', 0);
    F(g, C(32, 32, 13), vLG(g, 19, 45, '#ff7a5a', '#d82a20'), 0);
    F(g, C(32, 32, 6), '#fff4ec', 0);
    G(g, o, 20, 16, 9, 4, 0.5);
  },
  arrow(g) {
    rot(g, Math.PI / 4, 1.05);
    F(g, R(29.5, 14, 5, 40, 2.5), wood(g, 29, 35), 2.6);
    const h = F(g, P('M32 2 L42 17 L22 17 Z'), steel(g, 22, 42), 2.8); G(g, h, 28, 10, 2, 5, 0.8, 0.3);
    F(g, P('M29.5 44 L20 52 L20 62 L29.5 55 Z'), vLG(g, 44, 62, '#ff7a6a', '#d82a20'), 2.4);
    F(g, P('M34.5 44 L44 52 L44 62 L34.5 55 Z'), vLG(g, 44, 62, '#ffffff', '#c8d4e8'), 2.4);
  },
  star(g) {
    const s = F(g, STAR(32, 35, 29, 13.5), vLG(g, 6, 60, '#fff6b0', '#ffd23a', '#f0a018', '#c8700a'), 3.2);
    G(g, s, 25, 22, 6, 4, 0.7);
  },
  crown(g) {
    const p = F(g, P('M7 20 L20 33 L32 10 L44 33 L57 20 L52 52 L12 52 Z'), goldV(g, 10, 52), 3.2);
    G(g, p, 22, 30, 8, 5, 0.5);
    F(g, R(10, 44, 44, 11, 4), vLG(g, 44, 55, '#ffd23a', '#c8780a'), 3);
    F(g, C(32, 49.5, 4.2), vRG(g, 31, 48, 5, '#ffb0c0', '#e0203a'), 2);
    F(g, C(20, 49.5, 3), vRG(g, 19, 48, 4, '#b8e8ff', '#2a7ad8'), 1.8); F(g, C(44, 49.5, 3), vRG(g, 43, 48, 4, '#b8e8ff', '#2a7ad8'), 1.8);
    for (const [x, y] of [[7, 20], [32, 10], [57, 20]]) F(g, C(x, y, 4.2), goldV(g, y - 4, y + 4), 2.4);
  },
  lock(g) {
    T(g, P('M20 32 L20 22 A12 12 0 0 1 44 22 L44 32'), '#c8d4e8', 6);
    const b = F(g, R(11, 28, 42, 31, 8), goldV(g, 28, 59), 3.2);
    G(g, b, 20, 33, 8, 3, 0.55, 0);
    F(g, C(32, 41, 5), INK, 0); F(g, R(29.5, 42, 5, 10, 2), INK, 0);
  },
  skull(g) {
    const bone = vLG(g, 6, 58, '#ffffff', '#f0e8d4', '#c8b898');
    F(g, R(19, 36, 26, 20, 7), bone, 3);
    const h = F(g, C(32, 28, 22), bone, 3.2);
    F(g, R(19.5, 36, 25, 10, 3), bone, 0);
    F(g, E(23, 31, 6.5, 7.5), '#2a1a30', 0); F(g, E(41, 31, 6.5, 7.5), '#2a1a30', 0);
    F(g, C(24, 30, 2.2), '#ff5a4a', 0); F(g, C(42, 30, 2.2), '#ff5a4a', 0);
    F(g, P('M32 38 L35 44 L29 44 Z'), '#2a1a30', 0);
    g.strokeStyle = 'rgba(42,26,48,.8)'; g.lineWidth = 2; for (const x of [26, 32, 38]) { g.beginPath(); g.moveTo(x, 47); g.lineTo(x, 55); g.stroke(); }
    G(g, h, 22, 14, 8, 4, 0.7);
  },
  chest(g) { g.drawImage(drawChest(0, false), 1, 5, 62, 58); },
  hammer(g) {
    rot(g, -0.6, 1);
    F(g, R(28.5, 22, 7, 40, 3.5), wood(g, 28, 36), 3);
    const h = F(g, R(10, 7, 44, 18, 5), vLG(g, 7, 25, '#ffffff', '#c8d4e8', '#7a88a4', '#4a5670'), 3.2);
    G(g, h, 22, 10, 10, 2, 0.8, 0);
    F(g, R(26, 22, 12, 6, 2), '#5a6478', 2.4);
  },
  portal(g) {
    F(g, C(32, 32, 27), vRG(g, 32, 32, 27, '#ffffff', '#f0d0ff', '#b06aff', '#6a24c8', '#3a1078'), 3.2);
    g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,.75)';
    for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(32, 32, 9 + i * 6, i * 2.1, i * 2.1 + 2.4); g.stroke(); }
    F(g, C(32, 32, 5), '#fff', 0);
  },
  upg(g) {
    const p = F(g, P('M32 5 L57 32 L43 32 L43 58 L21 58 L21 32 L7 32 Z'), vLG(g, 5, 58, '#d8ffb0', '#7ae84a', '#3aae1e', '#1f7a0e'), 3.2);
    G(g, p, 26, 20, 5, 9, 0.55, 0.6);
  },
  sword(g) { rot(g, Math.PI / 4, 0.98); vSword(g); },
  bow(g) {
    rot(g, -0.35);
    T(g, P('M24 5 L24 59'), '#f4f0e0', 2);
    T(g, P('M24 5 Q 58 32 24 59'), '#c8743a', 6.5);
    g.lineWidth = 2; g.strokeStyle = 'rgba(255,220,170,.8)'; g.stroke(P('M27 10 Q 50 32 27 54'));
    F(g, R(37, 27, 8, 10, 3), goldV(g, 27, 37), 2.4);
  },
  staff(g) {
    rot(g, 0.55);
    F(g, R(29, 20, 6, 42, 3), wood(g, 29, 35), 2.8);
    F(g, P('M22 22 Q32 28 42 22 L40 17 Q32 21 24 17 Z'), goldV(g, 16, 26), 2.4);
    g.fillStyle = vRG(g, 32, 13, 16, 'rgba(255,240,150,.9)', 'rgba(255,200,60,0)'); g.beginPath(); g.arc(32, 13, 16, 0, TAU); g.fill();
    const o = F(g, C(32, 12, 9), vRG(g, 29, 9, 11, '#ffffff', '#9ae8ff', '#2a8ad8'), 2.8);
    G(g, o, 28.5, 8.5, 3, 2, 0.9);
  },
  tome(g) {
    F(g, R(14, 9, 40, 48, 5), vLG(g, 9, 57, '#fff4e0', '#e0c8a0'), 3);
    g.strokeStyle = 'rgba(140,110,70,.6)'; g.lineWidth = 1.4; for (const y of [16, 22, 28, 34, 40, 46]) { g.beginPath(); g.moveTo(48, y); g.lineTo(52, y); g.stroke(); }
    const c = F(g, R(9, 6, 40, 50, 5), vLG(g, 6, 56, '#b878ff', '#7a2ad8', '#4a1490'), 3.2);
    F(g, R(9, 6, 9, 50, 4), vLG(g, 6, 56, '#8a4ae8', '#3a0e78'), 2.4);
    for (const [x, y] of [[44, 11], [44, 51]]) F(g, C(x, y, 3.2), goldV(g, y - 3, y + 3), 1.8);
    F(g, P('M33 19 L41 31 L33 43 L25 31 Z'), vLG(g, 19, 43, '#fff6b0', '#ffd23a', '#e08a0a'), 2.4);
    G(g, c, 26, 12, 9, 3, 0.4, 0);
  },
  armor(g) {
    const p = F(g, P('M13 14 Q21 8 26 11 Q32 18 38 11 Q43 8 51 14 L56 27 L47 31 L47 52 Q32 61 17 52 L17 31 L8 27 Z'), vXG(g, 10, 0, 54, 0, '#ffffff', '#d8e2f0', '#a8b6cc', '#6e7c98'), 3.2);
    g.lineWidth = 3.2; g.strokeStyle = '#ffc72a'; g.stroke(P('M26 12 Q32 21 38 12'));
    g.lineWidth = 1.8; g.strokeStyle = 'rgba(70,80,110,.6)'; g.beginPath(); g.moveTo(32, 24); g.lineTo(32, 54); g.stroke();
    F(g, P('M32 28 L39 34 L32 42 L25 34 Z'), vLG(g, 28, 42, '#9ad8ff', '#2a6ad8'), 2.2);
    D(g, p, 46, 0.12); G(g, p, 22, 22, 4, 9, 0.6, 0.2);
  },
  cloak(g) {
    const p = F(g, P('M23 8 L41 8 Q45 15 47 23 L55 55 Q32 62 9 55 L17 23 Q19 15 23 8 Z'), vLG(g, 8, 60, '#ff8a7a', '#e03a3a', '#9a1a24'), 3.2);
    g.strokeStyle = 'rgba(110,10,20,.55)'; g.lineWidth = 2.4;
    for (const x of [24, 32, 40]) { g.beginPath(); g.moveTo(x, 22); g.quadraticCurveTo(x + (x - 32) * 0.3, 40, x + (x - 32) * 0.5, 56); g.stroke(); }
    G(g, p, 20, 28, 3.5, 12, 0.4, 0.25);
    F(g, C(32, 12, 6), goldV(g, 6, 18), 2.6);
  },
  gem(g) {
    const p = F(g, P('M11 24 L21 10 L43 10 L53 24 L32 57 Z'), vLG(g, 10, 57, '#c8f0ff', '#4fb8ff', '#1e5ad8'), 3.2);
    g.save(); g.clip(p);
    g.fillStyle = 'rgba(255,255,255,.55)'; g.fill(P('M21 10 L26 24 L11 24 Z')); g.fill(P('M26 24 L32 10 L38 24 Z'));
    g.fillStyle = 'rgba(10,40,120,.3)'; g.fill(P('M38 24 L53 24 L32 57 Z'));
    g.fillStyle = 'rgba(255,255,255,.2)'; g.fill(P('M11 24 L26 24 L32 57 Z'));
    g.restore();
    g.strokeStyle = 'rgba(20,50,130,.5)'; g.lineWidth = 1.4; g.stroke(P('M11 24 L53 24 M21 10 L26 24 L32 57 L38 24 L43 10 M32 10 L26 24 M32 10 L38 24'));
  },
  glove(g) {
    const lea = vLG(g, 8, 50, '#f0b070', '#c8743a', '#8a4a1e');
    F(g, P('M16 30 Q15 20 21 19 Q25 19 26 24 L26 13 Q27 8 31 8 Q35 8 35 13 L35 22 L36 12 Q37 7 41 8 Q45 9 44 14 L43 26 Q47 20 51 23 Q55 27 50 35 L44 47 L20 47 Q16 40 16 30 Z'), lea, 3.2);
    g.strokeStyle = 'rgba(90,40,10,.55)'; g.lineWidth = 1.8; g.stroke(P('M26 24 L26 34 M35 22 L35 34'));
    F(g, R(17, 44, 30, 14, 4), goldV(g, 44, 58), 3);
    G(g, R(17, 44, 30, 14, 4), 27, 47, 9, 2, 0.6, 0);
  },
  ring(g) {
    g.lineWidth = 12.4; g.strokeStyle = INK; g.beginPath(); g.ellipse(32, 39, 18, 16, 0, 0, TAU); g.stroke();
    g.lineWidth = 9; g.strokeStyle = goldV(g, 22, 56); g.stroke();
    g.lineWidth = 2.4; g.strokeStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.ellipse(32, 39, 18, 16, 0, 3.6, 4.6); g.stroke();
    F(g, R(23, 15, 18, 9, 3), goldV(g, 15, 24), 2.6);
    const gm = F(g, P('M32 3 L42 13 L32 24 L22 13 Z'), vLG(g, 3, 24, '#ffc0d0', '#ff3a5a', '#a8102e'), 2.8);
    G(g, gm, 29, 9, 3, 2.5, 0.8, 0);
  },
  potion(g) {
    F(g, R(25, 4, 14, 8, 3), vLG(g, 4, 12, '#e8b07a', '#9a5a2a'), 2.6);
    const body = new Path2D(); body.moveTo(27, 12); body.lineTo(37, 12); body.lineTo(37, 22); body.arc(32, 41, 20, -1.3, Math.PI + 1.3); body.closePath();
    F(g, body, 'rgba(225,240,255,.9)', 3.2);
    g.save(); g.clip(body);
    g.fillStyle = vLG(g, 30, 62, '#ff8aa0', '#ff2a52', '#b0102e'); g.beginPath(); g.moveTo(0, 34); g.quadraticCurveTo(16, 29, 32, 34); g.quadraticCurveTo(48, 39, 64, 33); g.lineTo(64, 64); g.lineTo(0, 64); g.fill();
    g.fillStyle = 'rgba(255,255,255,.75)'; for (const [x, y, r] of [[25, 44, 2.6], [36, 50, 1.8], [31, 40, 1.4]]) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
    g.restore();
    g.lineWidth = 3.2; g.strokeStyle = INK; g.stroke(body);
    G(g, body, 22, 34, 3, 9, 0.7, 0.3);
  },
  shield(g) {
    const p = F(g, P('M32 5 Q44 11 55 11 L55 30 Q55 49 32 60 Q9 49 9 30 L9 11 Q20 11 32 5 Z'), goldV(g, 5, 60), 3.2);
    const q = F(g, P('M32 11 Q42 16 49 16 L49 30 Q49 45 32 54 Q15 45 15 30 L15 16 Q22 16 32 11 Z'), vLG(g, 11, 54, '#7ab8ff', '#3a7aee', '#1f4ab8'), 2.2);
    F(g, STAR(32, 32, 11, 5), vLG(g, 21, 43, '#fff6b0', '#ffc72a'), 2);
    G(g, q, 23, 21, 4, 8, 0.45, 0.3);
  },
  spin(g) {
    g.lineCap = 'butt';
    for (let k = 0; k < 2; k++) {
      const a0 = k * Math.PI + 0.25, a1 = a0 + Math.PI - 0.7;
      const arc = new Path2D(); arc.arc(32, 32, 19, a0, a1); T(g, arc, '#5ae8a8', 6.5);
      const x = 32 + Math.cos(a1) * 19, y = 32 + Math.sin(a1) * 19, t = a1 + Math.PI / 2;
      const hd = new Path2D(); hd.moveTo(x + Math.cos(t) * 9, y + Math.sin(t) * 9); hd.lineTo(x + Math.cos(t + 2.2) * 8, y + Math.sin(t + 2.2) * 8); hd.lineTo(x + Math.cos(t - 2.2) * 8, y + Math.sin(t - 2.2) * 8); hd.closePath();
      F(g, hd, '#5ae8a8', 2.6);
    }
    g.lineCap = 'round';
  },
  nova(g) {
    g.fillStyle = vRG(g, 32, 32, 31, 'rgba(255,240,150,.8)', 'rgba(255,180,40,0)'); g.fillRect(0, 0, 64, 64);
    F(g, STAR(32, 32, 30, 13, 8, 0), vRG(g, 32, 32, 30, '#ffffff', '#fff2a0', '#ffc72a', '#f08a12'), 3);
    F(g, C(32, 32, 8), '#fff', 0);
  },
  crystal(g) {
    const p = F(g, P('M32 3 L47 22 L41 60 L23 60 L17 22 Z'), vLG(g, 3, 60, '#ffffff', '#a8f0ff', '#3ac0f0', '#1a78c8'), 3.2);
    g.save(); g.clip(p); g.fillStyle = 'rgba(255,255,255,.5)'; g.fill(P('M32 3 L32 60 L23 60 L17 22 Z')); g.fillStyle = 'rgba(10,60,140,.2)'; g.fill(P('M32 3 L47 22 L32 26 Z')); g.restore();
    g.strokeStyle = 'rgba(20,80,150,.45)'; g.lineWidth = 1.4; g.stroke(P('M17 22 L32 26 L47 22 M32 26 L32 60'));
  },
  justice(g) {
    g.fillStyle = vRG(g, 32, 30, 34, 'rgba(255,250,200,.95)', 'rgba(255,200,60,.5)', 'rgba(255,180,40,0)');
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + 0.2; g.beginPath(); g.moveTo(32, 30); g.lineTo(32 + Math.cos(a - 0.15) * 34, 30 + Math.sin(a - 0.15) * 34); g.lineTo(32 + Math.cos(a + 0.15) * 34, 30 + Math.sin(a + 0.15) * 34); g.fill(); }
    rot(g, Math.PI, 0.98); vSword(g, vXG(g, 26, 0, 38, 0, '#fffbe0', '#ffe36a', '#f0a018', '#b8700a'), '#c83a3a');
  },
  beam(g) {
    g.fillStyle = vRG(g, 16, 32, 20, 'rgba(255,240,150,.9)', 'rgba(255,200,60,0)'); g.fillRect(0, 0, 64, 64);
    F(g, P('M16 23 L60 26 L60 38 L16 41 Z'), vLG(g, 23, 41, '#fff6c0', '#ffffff', '#ffd23a'), 2.8);
    F(g, STAR(16, 32, 15, 7, 4, 0), vRG(g, 16, 32, 15, '#ffffff', '#fff2a0', '#ffc72a'), 2.8);
  },
  bind(g) {
    g.lineWidth = 3; g.strokeStyle = 'rgba(190,150,255,.65)'; g.beginPath(); g.ellipse(32, 32, 23, 23, 0, 0, TAU); g.stroke();
    for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + i * TAU / 3, x = 32 + Math.cos(a) * 21, y = 32 + Math.sin(a) * 21;
      const o = F(g, C(x, y, 9), vRG(g, x - 2, y - 3, 11, '#ffffff', '#d8b0ff', '#8a3ad8'), 2.8); G(g, o, x - 3, y - 3.5, 2.6, 1.8, 0.85); }
    F(g, C(32, 32, 5), '#fff6c0', 2.2);
  },
  volley(g) {
    for (const a of [-0.55, 0, 0.55]) { g.save(); g.translate(32, 50); g.rotate(a); g.translate(-32, -50);
      F(g, P('M32 6 L36.5 14 L36.5 34 L27.5 34 L27.5 14 Z'), steel(g, 27, 37), 2.6);
      F(g, R(23, 34, 18, 5, 2.5), goldV(g, 34, 39), 2.4); F(g, R(29.5, 39, 5, 10, 2), '#5a3a8a', 2.2);
      g.restore(); }
  },
  frost(g) {
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3, c = Math.cos(a), s = Math.sin(a);
      const p = new Path2D(); p.moveTo(32, 32); p.lineTo(32 + c * 26, 32 + s * 26);
      const bx = 32 + c * 16, by = 32 + s * 16; for (const d of [-0.8, 0.8]) { p.moveTo(bx, by); p.lineTo(bx + Math.cos(a + d) * 8, by + Math.sin(a + d) * 8); }
      T(g, p, '#bff0ff', 4.2); }
    F(g, STAR(32, 32, 8, 5, 6, 0), '#ffffff', 2.2);
  },
  mana(g) {
    const p = F(g, P('M32 5 C 41 18 51 29 51 40 A19 19 0 0 1 13 40 C 13 29 23 18 32 5 Z'), vLG(g, 5, 59, '#a8e0ff', '#3a8aff', '#1a4ab8'), 3.2);
    G(g, p, 24, 36, 4, 8, 0.6, 0.3);
  },
  i_burn(g) {
    F(g, P('M32 3 C 41 15 53 24 51 40 C 50 53 41 61 32 61 C 21 61 13 53 13 42 C 13 30 23 26 23 15 C 29 21 30 25 32 28 C 37 19 35 11 32 3 Z'), vLG(g, 3, 61, '#ffd84a', '#ff8a1a', '#e0401a'), 3.2);
    F(g, P('M32 30 C 37 37 43 42 42 49 C 41 56 36 59 32 59 C 26 59 22 55 22 49 C 22 43 27 41 28 35 C 30 38 31 40 32 41 C 34 37 33 34 32 30 Z'), vLG(g, 30, 59, '#ffffff', '#fff2a0', '#ffc72a'), 0);
  },
  i_enrage(g) {
    const f = F(g, C(32, 33, 26), vLG(g, 7, 59, '#ff8a6a', '#f2342a', '#a8141a'), 3.2);
    G(g, f, 22, 20, 8, 4.5, 0.45);
    g.lineWidth = 4; g.strokeStyle = INK; g.beginPath(); g.moveTo(15, 22); g.lineTo(28, 29); g.moveTo(49, 22); g.lineTo(36, 29); g.stroke();
    F(g, E(23, 34, 4.5, 5), '#fff', 2); F(g, E(41, 34, 4.5, 5), '#fff', 2);
    F(g, C(24, 35, 2.1), INK, 0); F(g, C(40, 35, 2.1), INK, 0);
    F(g, P('M22 50 Q32 42 42 50 Q32 46 22 50 Z'), INK, 2.6);
  },
  i_poison(g) {
    const p = F(g, P('M32 5 C 41 18 51 29 51 40 A19 19 0 0 1 13 40 C 13 29 23 18 32 5 Z'), vLG(g, 5, 59, '#d8ff9a', '#6ad83a', '#2a8a1a'), 3.2);
    F(g, C(26, 44, 4), 'rgba(255,255,255,.6)', 0); F(g, C(37, 49, 2.6), 'rgba(255,255,255,.5)', 0); F(g, C(36, 37, 2), 'rgba(255,255,255,.5)', 0);
    G(g, p, 24, 30, 3.5, 7, 0.55, 0.3);
  },
  i_heavy(g) {
    rot(g, -0.6, 1);
    F(g, R(28.5, 24, 7, 38, 3.5), wood(g, 28, 36), 3);
    const h = F(g, R(8, 6, 48, 22, 7), vLG(g, 6, 28, '#e8eef8', '#9aa8c0', '#5a6680', '#3a4258'), 3.2);
    G(g, h, 20, 10, 10, 2.4, 0.7, 0);
    F(g, R(8, 13, 48, 6, 2), '#ffc72a', 2);
  },
  i_atk(g) {
    g.save(); rot(g, Math.PI / 4, 0.92); vSword(g, vXG(g, 26, 0, 38, 0, '#ffffff', '#ffd0c8', '#ff6a5a', '#b82a2a'), '#5a2a2a'); g.restore();
    rot(g, -Math.PI / 4, 0.92); vSword(g);
  },
  i_stun(g) {
    const p = F(g, P('M37 3 L13 36 L29 36 L23 61 L51 24 L35 24 L44 3 Z'), vLG(g, 3, 61, '#fffbd0', '#ffe04a', '#f5a312'), 3.2);
    G(g, p, 30, 14, 3, 8, 0.7, 0.5);
  },
  i_heal(g) {
    const p = F(g, P('M23 7 H41 V23 H57 V41 H41 V57 H23 V41 H7 V23 H23 Z'), vLG(g, 7, 57, '#d8ffb0', '#6ae04a', '#2f9a1e'), 3.2);
    G(g, p, 28, 14, 3, 6, 0.6, 0);
  },
  i_guard(g) {
    const p = F(g, P('M32 5 Q44 11 55 11 L55 30 Q55 49 32 60 Q9 49 9 30 L9 11 Q20 11 32 5 Z'), vXG(g, 9, 0, 55, 0, '#ffffff', '#d8e2f0', '#a8b6cc', '#6e7c98'), 3.2);
    g.lineWidth = 2.4; g.strokeStyle = 'rgba(70,80,110,.6)'; g.stroke(P('M32 12 L32 54 M14 28 L50 28'));
    G(g, p, 21, 20, 4, 9, 0.6, 0.3);
  },
  i_drain(g) { VI.lifesteal(g); },
  i_multi(g) {
    for (const [x, y] of [[-12, 4], [0, 0], [12, -4]]) {
      const p = new Path2D(); p.moveTo(14 + x, 54 + y); p.quadraticCurveTo(26 + x, 30 + y, 50 + x, 10 + y); T(g, p, '#ffffff', 4.6);
    }
  },
  critdmg(g) {
    F(g, STAR(32, 32, 30, 16, 8, 0.2), vRG(g, 32, 32, 30, '#fff2a0', '#ff9a2a', '#e0301a'), 3);
    F(g, R(28.5, 15, 7, 21, 3.5), '#fff', 2.4); F(g, C(32, 44, 4), '#fff', 2.4);
  },
  lifesteal(g) {
    const p = F(g, P('M32 4 C 41 17 51 28 51 40 A19 19 0 0 1 13 40 C 13 28 23 17 32 4 Z'), vLG(g, 4, 59, '#ff8a9a', '#e0203a', '#8a0a1e'), 3.2);
    F(g, P('M32 52 C 21 45 19 38 23 34 C 26 31 30 33 32 36 C 34 33 38 31 41 34 C 45 38 43 45 32 52 Z'), '#fff', 2);
    G(g, p, 24, 24, 3, 7, 0.55, 0.4);
  },
  haste(g) {
    const c = F(g, C(32, 32, 27), vLG(g, 5, 59, '#ffb860', '#f07a18', '#c04a0a'), 3.2);
    G(g, c, 22, 17, 9, 4, 0.4);
    F(g, P('M35 9 L19 35 L30 35 L26 55 L45 28 L34 28 L40 9 Z'), vLG(g, 9, 55, '#ffffff', '#fff2a0', '#ffd23a'), 2.6);
  },
  area(g) {
    for (const [r, col] of [[27, '#ffc860'], [19, '#ff9a3a'], [11, '#ff6a2a']]) { const p = C(32, 32, r); T(g, p, col, 4); }
    F(g, C(32, 32, 5), '#fff6c0', 2.2);
  },
  thorns(g) {
    F(g, STAR(32, 32, 29, 17, 10, 0), vLG(g, 3, 61, '#c8ff8a', '#6ac83a', '#2a7a1a'), 3);
    const c = F(g, C(32, 32, 14), vLG(g, 18, 46, '#a8f06a', '#3a9a24'), 2.6);
    G(g, c, 27, 26, 4, 3, 0.5);
  },
  gear(g) {
    const p = new Path2D();
    for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8 - Math.PI / 16, r = i % 2 ? 22 : 28; p[i ? 'lineTo' : 'moveTo'](32 + Math.cos(a) * r, 32 + Math.sin(a) * r); }
    p.closePath();
    const o = F(g, p, vLG(g, 4, 60, '#ffffff', '#d8e2f0', '#9aa8c0', '#5a6680'), 3.2);
    G(g, o, 22, 18, 10, 5, 0.5);
    F(g, C(32, 32, 9), vLG(g, 23, 41, '#4a5670', '#1a2238'), 3);
  },
  dodge(g) {
    for (const [y, w, col] of [[18, 40, '#e8fbff'], [32, 50, '#9ae8ff'], [46, 36, '#e8fbff']]) {
      const p = new Path2D(); p.moveTo(56 - w, y + 4); p.quadraticCurveTo(56 - w / 2, y - 6, 58, y); T(g, p, col, 5);
    }
  },
};

function drawVI(name) {
  const c = document.createElement('canvas'); c.width = c.height = 64 * VS;
  const g = c.getContext('2d'); g.scale(VS, VS); g.lineJoin = 'round'; g.lineCap = 'round';
  VI[name](g);
  return c;
}
