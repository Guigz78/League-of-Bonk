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

// icône des menus : pictogramme au trait (ICON, plus bas), sinon pixel art
const svgCache = new Map();
export function iconURL(name) {
  if (ICON[name]) { if (!svgCache.has(name)) svgCache.set(name, svgIcon(name)); return svgCache.get(name); }
  const def = ICONS[name] || ICONS.star;
  return cachedURL('ic:' + name, () => gridToCanvas(def[0], { ...BASE, ...def[1] }, 1));
}

export function iconImg(name, size = 24, cls = '') {
  return `<img class="ic${ICON[name] ? ' vi' : ' px'} ${cls}" src="${iconURL(name)}" width="${size}" height="${size}" alt="" draggable="false">`;
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

// ---------- Coffres de butin, enclume et marteau : dessin à plat, géométrique (sans contour noir) ----------
const TAU = Math.PI * 2;
// faces : dessus clair, face avant, côté sombre ; bandes métalliques ; serrure ; lueur
const CHEST_PAL = [
  { top: '#c08452', face: '#9a6338', side: '#6e4426', band: '#5b6474', bandHi: '#8a94a6', lock: '#d9a441', glow: '#ffcf8a', gem: null },
  { top: '#e3e9f2', face: '#b8c3d3', side: '#7f8ba0', band: '#4a5568', bandHi: '#7c879c', lock: '#f5b400', glow: '#dfefff', gem: null },
  { top: '#ffd45a', face: '#f0b020', side: '#b37a0c', band: '#7a3f12', bandHi: '#a85d22', lock: '#fff1b8', glow: '#ffe27a', gem: null },
  { top: '#b77cff', face: '#8b45f0', side: '#5b23b0', band: '#f5b400', bandHi: '#ffd760', lock: '#3fd0ff', glow: '#d9b8ff', gem: '#3fd0ff' },
];
const poly = (g, pts, fill) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fillStyle = fill; g.fill(); };
function canvasS(W, H, S = 2.5) {
  const c = document.createElement('canvas'); c.width = W * S; c.height = H * S;
  const g = c.getContext('2d'); g.scale(S, S);
  return [c, g];
}

// coffre de butin (tier 0 bois … 3 mythique), fermé ou ouvert
export function chestURL(tier = 0, open = false) {
  return cachedURL(`chest2:${tier}:${open ? 1 : 0}`, () => drawChest(tier, open));
}

function drawChest(tier, open) {
  const P = CHEST_PAL[tier] || CHEST_PAL[0];
  const [c, g] = canvasS(120, 112);
  // ombre au sol (rectangle adouci)
  const sh = g.createRadialGradient(60, 103, 4, 60, 103, 52);
  sh.addColorStop(0, 'rgba(0,0,0,.45)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = sh; g.fillRect(4, 94, 112, 18);
  // corps : face avant + côté droit en perspective légère
  const bodyTop = 58, bodyBot = 100;
  poly(g, [[14, bodyTop], [98, bodyTop], [98, bodyBot], [14, bodyBot]], P.face);
  poly(g, [[98, bodyTop], [108, bodyTop - 6], [108, bodyBot - 6], [98, bodyBot]], P.side);
  g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(14, bodyBot - 7, 84, 7);
  if (tier === 0) { g.fillStyle = 'rgba(0,0,0,.16)'; for (const y of [72, 86]) g.fillRect(14, y, 84, 1.5); }
  // bandes verticales
  for (const x of [26, 78]) { g.fillStyle = P.band; g.fillRect(x, bodyTop, 9, bodyBot - bodyTop); g.fillStyle = P.bandHi; g.fillRect(x, bodyTop, 2, bodyBot - bodyTop); }
  if (open) {
    // couvercle ouvert vers l'arrière : on voit son intérieur sombre, lumière du trésor
    poly(g, [[14, bodyTop], [24, 22], [104, 16], [108, bodyTop - 6], [98, bodyTop]], P.side);
    poly(g, [[18, bodyTop - 2], [27, 26], [100, 21], [98, bodyTop - 2]], 'rgba(0,0,0,.35)');
    const col = g.createLinearGradient(0, bodyTop, 0, 0);
    col.addColorStop(0, P.glow); col.addColorStop(1, 'rgba(255,255,255,0)');
    g.globalAlpha = 0.75; poly(g, [[22, bodyTop], [10, 0], [110, 0], [96, bodyTop]], col); g.globalAlpha = 1;
    g.fillStyle = '#fff'; g.fillRect(20, bodyTop - 3, 78, 4);
    g.fillStyle = P.glow; g.fillRect(16, bodyTop - 1, 82, 3);
    // éclats
    g.fillStyle = '#fff';
    for (const [x, y, r] of [[42, 34, 3], [76, 26, 4], [60, 14, 2.5]]) poly(g, [[x, y - r * 2], [x + r * 0.6, y], [x, y + r * 2], [x - r * 0.6, y]], '#fff');
  } else {
    // couvercle : prisme (dessus clair, face avant, côté)
    poly(g, [[12, bodyTop], [12, 40], [24, 24], [96, 24], [100, 40], [100, bodyTop]], P.face);
    poly(g, [[24, 24], [96, 24], [104, 18], [32, 18]], P.top);
    poly(g, [[96, 24], [104, 18], [110, 34], [100, 40]], P.side);
    poly(g, [[100, 40], [110, 34], [110, bodyTop - 6], [100, bodyTop]], P.side);
    poly(g, [[12, 40], [24, 24], [96, 24], [100, 40]], P.top);
    g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(12, 40, 88, 2);
    for (const x of [26, 78]) { poly(g, [[x, bodyTop], [x, 40], [x + 3, 24], [x + 12, 24], [x + 9, 40], [x + 9, bodyTop]], P.band); g.fillStyle = P.bandHi; g.fillRect(x, 40, 2, bodyTop - 40); }
  }
  // rebord
  g.fillStyle = P.band; g.fillRect(10, bodyTop - 3, 92, 7);
  g.fillStyle = P.bandHi; g.fillRect(10, bodyTop - 3, 92, 1.5);
  // gemmes du coffre mythique, rivets sinon
  for (const x of [30.5, 82.5]) for (const y of [72, 90]) {
    if (P.gem) poly(g, [[x, y - 4], [x + 3, y], [x, y + 4], [x - 3, y]], y === 72 ? P.gem : '#ff6ad8');
    else { g.fillStyle = P.bandHi; g.fillRect(x - 1.5, y - 1.5, 3, 3); }
  }
  // serrure
  const ly = open ? bodyTop + 2 : 48;
  g.fillStyle = P.band; g.fillRect(46, ly - 1, 20, 24);
  g.fillStyle = P.lock; g.fillRect(48, ly + 1, 16, 20);
  g.fillStyle = 'rgba(255,255,255,.45)'; g.fillRect(48, ly + 1, 16, 3);
  g.fillStyle = '#141820'; g.fillRect(54.5, ly + 7, 3, 3); g.fillRect(55.25, ly + 9, 1.5, 6);
  return c;
}

// enclume de la forge (aplats acier)
export function anvilURL() {
  return cachedURL('anvil2', () => {
    const [c, g] = canvasS(150, 100);
    const sh = g.createRadialGradient(75, 92, 4, 75, 92, 64);
    sh.addColorStop(0, 'rgba(0,0,0,.5)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = sh; g.fillRect(5, 84, 140, 16);
    poly(g, [[34, 92], [46, 72], [106, 72], [118, 92]], '#3b4352');
    poly(g, [[46, 72], [106, 72], [110, 78], [42, 78]], '#4b5466');
    poly(g, [[58, 72], [62, 48], [94, 48], [98, 72]], '#4b5466');
    poly(g, [[94, 48], [98, 72], [104, 72], [100, 48]], '#363d4b');
    poly(g, [[44, 24], [134, 24], [134, 48], [58, 48], [8, 30]], '#6b7588');
    poly(g, [[44, 24], [134, 24], [134, 29], [44, 29], [10, 29]], '#aab4c6');
    poly(g, [[58, 48], [134, 48], [134, 43], [58, 43]], '#4b5466');
    return c;
  });
}

// marteau de forgeron (pivot en bas du manche)
export function hammerURL() {
  return cachedURL('hammer2', () => {
    const [c, g] = canvasS(90, 110);
    g.fillStyle = '#7a4a26'; g.fillRect(40, 34, 10, 72);
    g.fillStyle = '#9a6034'; g.fillRect(40, 34, 3, 72);
    g.fillStyle = '#3b4352'; g.fillRect(37, 34, 16, 8);
    poly(g, [[8, 10], [82, 10], [82, 38], [8, 38]], '#6b7588');
    g.fillStyle = '#aab4c6'; g.fillRect(8, 10, 74, 6);
    g.fillStyle = '#4b5466'; g.fillRect(8, 32, 74, 6);
    return c;
  });
}

// ---------- Icônes des menus : jeu de pictogrammes au trait (24 × 24), net à toutes les tailles ----------
// [couleur du trait, teinte de remplissage, éléments SVG] ; fill="T" = teinte translucide, fill="S" = couleur pleine
const IC = { w: '#e9edf3', gold: '#f5b400', red: '#ff4d5e', cyan: '#3fd0ff', blue: '#3b8cff', violet: '#a855f7', green: '#3ddc84', orange: '#ff7a2f', grey: '#9aa4b2' };
const SHIELD = 'M12 3l7.5 2.8v5.7c0 4.6-3.2 7.6-7.5 9.3-4.3-1.7-7.5-4.7-7.5-9.3V5.8z';
// roue dentée géométrique (8 dents)
const GEAR = (() => {
  let d = '';
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * TAU, w = 0.2, p = [[a - w * 1.6, 7], [a - w, 9.6], [a + w, 9.6], [a + w * 1.6, 7]];
    p.forEach(([b, r], k) => { d += `${!i && !k ? 'M' : 'L'}${(12 + Math.cos(b) * r).toFixed(2)} ${(12 + Math.sin(b) * r).toFixed(2)}`; });
  }
  return d + 'z';
})();
const ICON = {
  gold: [IC.gold, IC.gold, '<circle cx="12" cy="12" r="8.5" fill="T"/><path d="M12 7.2l3.3 4.8-3.3 4.8-3.3-4.8z" fill="S" stroke="none"/>'],
  heart: [IC.red, IC.red, '<path d="M12 19.5L4 11.8V7.6L7.4 4.5 12 8.3l4.6-3.8L20 7.6v4.2z" fill="T"/>'],
  fist: [IC.w, IC.red, '<path d="M4 4l11 11M20 4L9 15M12.5 17.5l5-5M6.5 12.5l5 5M15 15l4.5 4.5M9 15l-4.5 4.5"/>'],
  target: [IC.w, IC.red, '<circle cx="12" cy="12" r="7" fill="T"/><path d="M12 2.5v5M12 16.5v5M2.5 12h5M16.5 12h5"/><rect x="11" y="11" width="2" height="2" fill="S" stroke="none"/>'],
  arrow: [IC.w, IC.cyan, '<path d="M4.5 19.5l15-15M12 4.5h7.5V12M4.5 19.5v-4.5M4.5 19.5H9"/>'],
  star: [IC.gold, IC.gold, '<path d="M12 3.5l2.6 5.6 6 .7-4.5 4.1 1.2 6-5.3-3-5.3 3 1.2-6L3.4 9.8l6-.7z" fill="T"/>'],
  crown: [IC.gold, IC.gold, '<path d="M4.5 17.5L3 7.5l5 4 4-6 4 6 5-4-1.5 10z" fill="T"/><path d="M4.5 20.5h15"/>'],
  lock: [IC.grey, IC.grey, '<rect x="5.5" y="10.5" width="13" height="9.5" fill="T"/><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3M12 14v2.5"/>'],
  skull: [IC.w, IC.w, '<path d="M5.5 15V10a6.5 6.5 0 0 1 13 0v5h-2.5v4h-8v-4z" fill="T"/><rect x="8" y="10" width="2.8" height="2.8" fill="S" stroke="none"/><rect x="13.2" y="10" width="2.8" height="2.8" fill="S" stroke="none"/><path d="M10.5 19v-2.5M13.5 19v-2.5"/>'],
  chest: [IC.gold, IC.gold, '<path d="M3.5 10.5h17V20h-17z" fill="T"/><path d="M4.5 10.5L6 5h12l1.5 5.5"/><rect x="10" y="9" width="4" height="4.5" fill="S" stroke="none"/>'],
  hammer: [IC.w, IC.w, '<path d="M13 3.5l7.5 7.5-2.5 2.5L10.5 6z" fill="T"/><path d="M11.8 9.2L4 17l3 3 7.8-7.8"/>'],
  portal: [IC.violet, IC.violet, '<ellipse cx="12" cy="12" rx="7" ry="9" fill="T"/><path d="M12 7.5a3.6 4.5 0 1 1-3.6 4.5"/>'],
  upg: [IC.cyan, IC.cyan, '<path d="M6 12.5l6-6 6 6M6 18.5l6-6 6 6"/>'],
  sword: [IC.w, IC.w, '<path d="M19.5 4.5V8L10 17.5 6.5 14 16 4.5z" fill="T"/><path d="M5 12.5l6.5 6.5M8.2 15.8l-3.7 3.7"/>'],
  bow: [IC.w, IC.w, '<path d="M7.5 3.5c7.5 3.5 7.5 13.5 0 17M7.5 3.5v17"/><path d="M4 12h15.5M16.5 9l3 3-3 3"/>'],
  staff: [IC.w, IC.cyan, '<path d="M5 20l9.5-9.5"/><circle cx="17" cy="7" r="3.2" fill="T" stroke="#3fd0ff"/><path d="M17 1.5v1.2M22.5 7h-1.2" stroke="#3fd0ff"/>'],
  tome: [IC.cyan, IC.cyan, '<path d="M5 4.5h11.5L19 7v12.5H7.5A2.5 2.5 0 0 1 5 17z" fill="T"/><path d="M5 17a2.5 2.5 0 0 1 2.5-2.5H19M9 8.5h6"/>'],
  armor: [IC.w, IC.w, '<path d="M8 4l4 2 4-2 4.5 3-2 5H17v8H7v-8H5.5l-2-5z" fill="T"/><path d="M12 6v14"/>'],
  cloak: [IC.w, IC.violet, '<path d="M12 3.5c-3 0-4.5 2.5-4.5 5L4 20.5h16L16.5 8.5c0-2.5-1.5-5-4.5-5z" fill="T"/><path d="M9 10.5l3 2 3-2M12 12.5v8"/>'],
  gem: [IC.cyan, IC.cyan, '<path d="M7 4.5h10l4 4.5-9 11-9-11z" fill="T"/><path d="M3 9h18M10 4.5L8.5 9 12 20l3.5-11L14 4.5"/>'],
  glove: [IC.w, IC.w, '<path d="M7.5 20.5V14L5 10l1.6-1L9 11.5V4.5h2.5V10h1V3.5H15V10h1V5.5h2.5v9l-1.5 6z" fill="T"/>'],
  ring: [IC.gold, IC.cyan, '<circle cx="12" cy="14.5" r="5.5"/><path d="M12 3l2.8 2.8L12 9 9.2 5.8z" fill="T" stroke="#3fd0ff"/>'],
  potion: [IC.green, IC.green, '<path d="M9 3.5h6M10 3.5v6L4.5 20.5h15L14 9.5v-6"/><path d="M7.2 15h9.6l2.2 5H5z" fill="T" stroke="none"/>'],
  shield: [IC.w, IC.cyan, `<path d="${SHIELD}" fill="T"/><path d="M12 3v18"/>`],
  spin: [IC.w, IC.w, '<path d="M19.5 12a7.5 7.5 0 0 1-12.8 5.3M4.5 12a7.5 7.5 0 0 1 12.8-5.3"/><path d="M17.5 2.5v4.2h-4.2M6.5 21.5v-4.2h4.2"/>'],
  nova: [IC.gold, IC.gold, '<rect x="9" y="9" width="6" height="6" transform="rotate(45 12 12)" fill="T"/><path d="M12 1.5v4.5M12 18v4.5M1.5 12H6M18 12h4.5M4.6 4.6l3 3M16.4 16.4l3 3M4.6 19.4l3-3M16.4 7.6l3-3"/>'],
  crystal: [IC.cyan, IC.cyan, '<path d="M12 2.5l4.5 5v9l-4.5 5-4.5-5v-9z" fill="T"/><path d="M7.5 7.5h9M12 2.5v19" stroke-opacity=".55"/>'],
  justice: [IC.gold, IC.gold, '<path d="M10.2 8.5h3.6v10L12 21.5l-1.8-3z" fill="T"/><path d="M7 8.5h10M12 8.5V3M4.5 3.5l2.5 2.5M19.5 3.5L17 6"/>'],
  beam: [IC.cyan, IC.cyan, '<rect x="2.5" y="8.5" width="5" height="7" fill="T"/><path d="M7.5 10h14M7.5 14h14M7.5 12h10"/>'],
  bind: [IC.violet, IC.violet, '<circle cx="12" cy="12" r="8.5"/><path d="M12 6l6 6-6 6-6-6z" fill="T"/><path d="M12 3.5v2.5M12 18v2.5M3.5 12H6M18 12h2.5"/>'],
  volley: [IC.w, IC.w, '<path d="M4 14L14 4M7 17L17 7M10 20L20 10M9.5 4H14v4.5M12.5 7H17v4.5M15.5 10H20v4.5"/>'],
  frost: [IC.cyan, IC.cyan, '<path d="M12 2.5v19M3.8 7.2l16.4 9.6M3.8 16.8l16.4-9.6M9.5 4l2.5 2.5L14.5 4M9.5 20l2.5-2.5 2.5 2.5"/>'],
  mana: [IC.blue, IC.blue, '<path d="M12 3L18 12.5a6 6 0 0 1-12 0z" fill="T"/>'],
  i_burn: [IC.orange, IC.orange, '<path d="M12 21.5c-4 0-6.5-2.7-6.5-6.3 0-3.7 3.2-5.7 3.5-9.7 2 1.3 3 3.2 3 5 1-1 1.6-2.3 1.6-3.7 2.7 2 4.9 5 4.9 8.4 0 3.6-2.5 6.3-6.5 6.3z" fill="T"/>'],
  i_enrage: [IC.w, IC.red, '<path d="M13.5 2.5L5.5 13.5h6l-1 8 8-11h-6z" fill="T"/>'],
  i_poison: [IC.w, IC.green, '<path d="M11 4.5L16.5 13a5.5 5.5 0 0 1-11 0z" fill="T"/><rect x="17" y="3.5" width="3" height="3" fill="S" stroke="none"/><rect x="19.5" y="9" width="2" height="2" fill="S" stroke="none"/>'],
  i_heavy: [IC.w, IC.w, '<path d="M6.5 9.5h11l2.5 10.5H4z" fill="T"/><path d="M9 9.5V7a3 3 0 0 1 6 0v2.5"/>'],
  i_atk: [IC.red, IC.red, '<path d="M4.5 15.5L12 3.5M8.5 19.5L17 6M13.5 20.5L20 10"/>'],
  i_stun: [IC.gold, IC.gold, '<path d="M12 3.5l1.6 3.4 3.7.4-2.7 2.5.7 3.7L12 11.7l-3.3 1.8.7-3.7-2.7-2.5 3.7-.4z" fill="T"/><path d="M3.5 17c3.5 3 13.5 3 17 0"/>'],
  i_heal: [IC.green, IC.green, '<path d="M9.5 4h5v5.5H20v5h-5.5V20h-5v-5.5H4v-5h5.5z" fill="T"/>'],
  i_guard: [IC.cyan, IC.cyan, `<path d="${SHIELD}" fill="T"/><path d="M12 8.5v7M8.5 12h7"/>`],
  i_drain: [IC.red, IC.red, '<path d="M12 3L17.5 11.5a5.5 5.5 0 0 1-11 0z" fill="T"/><path d="M12 9.5v5M9.8 12.3L12 14.5l2.2-2.2"/>'],
  i_multi: [IC.w, IC.w, '<rect x="8.5" y="8.5" width="11" height="11" fill="T"/><path d="M5 15.5V4.5h11"/>'],
  critdmg: [IC.orange, IC.orange, '<circle cx="12" cy="12" r="6.5" fill="T"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5M10 10l4 4M14 10l-4 4"/>'],
  lifesteal: [IC.red, IC.red, '<path d="M12 3L18 12a6 6 0 0 1-12 0z" fill="T"/><path d="M12 10.5v5M9.5 13h5"/>'],
  haste: [IC.cyan, IC.cyan, '<path d="M5 5.5l6.5 6.5L5 18.5M12 5.5l6.5 6.5-6.5 6.5"/>'],
  area: [IC.w, IC.cyan, '<path d="M3.5 8.5v-5h5M15.5 3.5h5v5M20.5 15.5v5h-5M8.5 20.5h-5v-5"/><rect x="8.5" y="8.5" width="7" height="7" fill="T"/>'],
  thorns: [IC.green, IC.green, '<path d="M3 19.5h18M4 19.5l2.5-7 2.5 7M9.5 19.5L12 8l2.5 11.5M15 19.5l2.5-7 2.5 7"/>'],
  gear: [IC.w, IC.w, `<path d="${GEAR}" fill="T"/><circle cx="12" cy="12" r="2.8"/>`],
  dodge: [IC.w, IC.cyan, '<path d="M4 18.5c4.5 0 4.5-13 9.5-13h6.5M16.5 2.5l3.5 3-3.5 3"/><path d="M4 13h3.5M4 8.5h4.5" stroke-opacity=".5"/>'],
  // interface
  play: [IC.w, IC.w, '<path d="M7.5 4.5v15l12-7.5z" fill="S"/>'],
  quest: [IC.gold, IC.gold, '<rect x="5" y="3.5" width="14" height="17" fill="T"/><path d="M8.3 8.5l1.5 1.5 2.5-2.5M14 9h2.5M8.3 14.5l1.5 1.5 2.5-2.5M14 15h2.5"/>'],
  calendar: [IC.cyan, IC.cyan, '<rect x="4" y="5.5" width="16" height="14.5" fill="T"/><path d="M4 10h16M8 3v4.5M16 3v4.5"/><rect x="7.5" y="13" width="3" height="3" fill="S" stroke="none"/>'],
  check: [IC.green, IC.green, '<path d="M4.5 12.5l5 5L19.5 7"/>'],
  reroll: [IC.w, IC.w, '<path d="M19.5 9A8 8 0 0 0 5.4 7.4M4.5 15a8 8 0 0 0 14.1 1.6"/><path d="M5 3v4.5h4.5M19 21v-4.5h-4.5"/>'],
  skip: [IC.w, IC.w, '<path d="M5 5l8.5 7L5 19z" fill="T"/><path d="M18.5 5v14"/>'],
  close: [IC.w, IC.w, '<path d="M5.5 5.5l13 13M18.5 5.5l-13 13"/>'],
  map: [IC.w, IC.w, '<path d="M3.5 6l5.5-2 6 2 5.5-2v14l-5.5 2-6-2-5.5 2z" fill="T"/><path d="M9 4v14M15 6v14"/>'],
  bag: [IC.gold, IC.gold, '<path d="M4.5 8h15l-1.5 12.5H6z" fill="T"/><path d="M8.5 10.5V7a3.5 3.5 0 0 1 7 0v3.5"/>'],
  trophy: [IC.gold, IC.gold, '<path d="M7 3.5h10v6a5 5 0 0 1-10 0z" fill="T"/><path d="M7 5.5H3.5V8a3.5 3.5 0 0 0 3.6 3.5M17 5.5h3.5V8a3.5 3.5 0 0 1-3.6 3.5M12 14.5v4M8 20.5h8"/>'],
  gift: [IC.gold, IC.gold, '<rect x="4" y="9" width="16" height="11.5" fill="T"/><path d="M3 9h18M12 9v11.5M12 9L8 4.5 6.5 7.5 12 9l5.5-1.5L16 4.5z"/>'],
  sound: [IC.w, IC.w, '<path d="M3.5 9h4l5-4v14l-5-4h-4z" fill="T"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>'],
  music: [IC.w, IC.w, '<path d="M9 17.5V5.5l10-2V15.5"/><rect x="5" y="15.5" width="4" height="4" fill="S"/><rect x="15" y="13.5" width="4" height="4" fill="S"/>'],
  vibrate: [IC.w, IC.w, '<rect x="8" y="4" width="8" height="16" fill="T"/><path d="M4.5 8v8M19.5 8v8M1.8 10.5v3M22.2 10.5v3"/>'],
  shake: [IC.w, IC.w, '<path d="M2.5 12h3l2.5-6 3 12 3-14 3 11 2-3h2.5"/>'],
  hand: [IC.w, IC.w, '<path d="M9 11.5V4.5a1.5 1.5 0 0 1 3 0V10h.5V8.5a1.5 1.5 0 0 1 3 0V11h.5a1.5 1.5 0 0 1 3 0v4.5c0 3-2 5-5 5h-1.5c-2 0-3.2-.8-4.3-2.3L4.5 14a1.5 1.5 0 0 1 2.4-1.8L9 14.5z" fill="T"/>'],
  joystick: [IC.w, IC.w, '<circle cx="12" cy="12" r="8.5" fill="T"/><circle cx="12" cy="12" r="3.5" fill="S" stroke="none"/>'],
  numbers: [IC.w, IC.w, '<path d="M3.5 7.5l2-1.5V18M9 6.5h5v5.5H9V18h5M17 6.5h3.5V18H17M17 12h3.5"/>'],
  cube: [IC.w, IC.cyan, '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" fill="T"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>'],
  user: [IC.w, IC.w, '<circle cx="12" cy="8" r="4" fill="T"/><path d="M4 20.5c0-4 3.5-6.5 8-6.5s8 2.5 8 6.5"/>'],
  exit: [IC.w, IC.w, '<path d="M10 4H4.5v16H10M9 12h11.5M16.5 8l4 4-4 4"/>'],
  info: [IC.w, IC.w, '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v6M12 7v1.5"/>'],
  clock: [IC.w, IC.w, '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/>'],
  swap: [IC.w, IC.w, '<path d="M4 8h14M14.5 4.5L18 8l-3.5 3.5M20 16H6M9.5 12.5L6 16l3.5 3.5"/>'],
  bolt: [IC.gold, IC.gold, '<path d="M13.5 2.5L5.5 13.5h6l-1 8 8-11h-6z" fill="T"/>'],
  flag: [IC.w, IC.w, '<path d="M5.5 21V3.5"/><path d="M5.5 4.5h12L15 8.5l2.5 4h-12z" fill="T"/>'],
  plus: [IC.w, IC.w, '<path d="M12 5v14M5 12h14"/>'],
  home: [IC.w, IC.w, '<path d="M4 11l8-7 8 7v9.5H4z" fill="T"/><path d="M10 20.5v-6h4v6"/>'],
  back: [IC.w, IC.w, '<path d="M15 4.5L7.5 12l7.5 7.5"/>'],
  next: [IC.w, IC.w, '<path d="M9 4.5l7.5 7.5L9 19.5"/>'],
  part: [IC.cyan, IC.cyan, '<path d="M12 3l7.5 4.5v9L12 21l-7.5-4.5v-9z" fill="T"/><circle cx="12" cy="12" r="3"/>'],
  pet: [IC.w, IC.gold, '<path d="M5 9.5L7 4l3 3.5h4L17 4l2 5.5V14a7 7 0 0 1-14 0z" fill="T"/><rect x="8.6" y="11" width="2" height="2" fill="S" stroke="none"/><rect x="13.4" y="11" width="2" height="2" fill="S" stroke="none"/>'],
  eye: [IC.w, IC.w, '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" fill="T"/><circle cx="12" cy="12" r="3"/>'],
  // L2 : Abysse (gouffre en entonnoir), maîtrise (médaille), aura (flamme de la forme ultime)
  abyss: [IC.violet, IC.blue, '<path d="M3 5h18l-5 6.5H8z" fill="T"/><path d="M8 11.5l2.2 4.5h3.6l2.2-4.5M10.2 16l1.8 3.5 1.8-3.5"/>'],
  medal: [IC.gold, IC.gold, '<path d="M8 3l3 6.2M16 3l-3 6.2"/><circle cx="12" cy="15" r="5.5" fill="T"/><path d="M12 12.4l.9 1.8 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.3z" fill="S" stroke="none"/>'],
  key: [IC.gold, IC.gold, '<circle cx="8" cy="12" r="4.5" fill="T"/><path d="M12.5 12h8.5M17.5 12v3.5M20.5 12v2.5"/>'],
  aura: [IC.gold, IC.orange, '<path d="M12 21c-4 0-7-2.6-7-6.4 0-3.4 2.4-5 3-8.6 1.6 1.2 2.4 2.8 2.6 4.4.8-1.6 1.2-3.6.9-6.4 3.8 2.4 7.5 6.2 7.5 10.6 0 3.8-3 6.4-7 6.4z" fill="T"/><path d="M12 21c-1.8 0-3-1.2-3-3 0-1.6 1.4-2.6 2-4.2 1.4 1 4 2.4 4 4.4 0 1.6-1.2 2.8-3 2.8z"/>'],
};

// champions C1 : faux sanglante (Nyx), festin de sang, danse des ombres (Sora), fureur (Ragnar)
Object.assign(ICON, {
  scythe: [IC.w, IC.red, '<path d="M6.5 21L15 3.5"/><path d="M15 3.5c-3.5-1.4-8.5-.6-12 2.6 4.2-.8 8.1.3 10.6 2.6z" fill="T" stroke="#ff4d5e"/><path d="M9.5 15l2.5 1.2"/>'],
  feast: [IC.red, IC.red, '<path d="M12 3L18 12a6 6 0 0 1-12 0z" fill="T"/><path d="M9.6 12.5l1 3 1-3M12.4 12.5l1 3 1-3" stroke="#e9edf3"/>'],
  shadow: [IC.violet, IC.violet, '<path d="M15.5 3.5a8.5 8.5 0 1 0 5 15.2A7 7 0 0 1 15.5 3.5z" fill="T"/><path d="M3 21l5-5M7 21l3-3M3 17l3-3" stroke="#ff4d5e"/>'],
  fury: [IC.orange, IC.orange, '<path d="M6 14a6 6 0 0 1 12 0z" fill="T"/><path d="M6.5 11.5C3.8 10.6 2.6 7.8 3.2 4.5M17.5 11.5c2.7-.9 3.9-3.7 3.3-7M5 14h14v3.5H5zM12 8v6"/>'],
});
// champions C2 : morsure du givre et hiver éternel (Frida), sève vivante et colère de la forêt (Gaïa)
Object.assign(ICON, {
  chill: [IC.cyan, IC.cyan, '<circle cx="12" cy="12" r="9" fill="T"/><path d="M12 5.5v13M6.4 8.8l11.2 6.4M6.4 15.2l11.2-6.4M10.2 6.6L12 8.2l1.8-1.6M10.2 17.4l1.8-1.6 1.8 1.6"/>'],
  winter: [IC.cyan, IC.blue, '<path d="M12 2.5v12M6.8 5.5l10.4 6M6.8 11.5l10.4-6M10.4 3.6L12 5l1.6-1.4"/><path d="M3 21.5l3-6 3 6zM9.5 21.5l2.5-4.5 2.5 4.5zM15 21.5l3-6 3 6z" fill="T"/>'],
  leaf: [IC.green, IC.green, '<path d="M4.5 19.5C4.5 10.5 10 4.5 19.5 4.5c0 9.5-5.5 15-15 15z" fill="T"/><path d="M4.5 19.5L14 10M8.8 15.2h4M11.3 12.7V9.2"/>'],
  forest: [IC.green, IC.green, '<path d="M12 2.5l6 7.5h-3.2l4.2 6H5l4.2-6H6z" fill="T"/><path d="M12 16v3M7.5 21.5c1.4-1.8 2.9-2.6 4.5-2.6s3.1.8 4.5 2.6"/><path d="M2.8 14.2l2.4 1.3M21.2 14.2l-2.4 1.3M3.2 19.2l2.2-.5M20.8 19.2l-2.2-.5" stroke="#ff7ab8"/>'],
});

// Tess l'ingénieure : clé à molette (Bricoleuse), frappe orbitale, tourelle, drone d'appui, lance-flammes, mines électriques
Object.assign(ICON, {
  wrench: [IC.orange, IC.orange, '<path d="M13.4 11a4.6 4.6 0 0 1-.6-6.2 4.6 4.6 0 0 1 5.5-1.3l-2.9 2.9.5 2.2 2.2.5 2.9-2.9a4.6 4.6 0 0 1-1.3 5.5 4.6 4.6 0 0 1-6.3-.7z" fill="T"/><path d="M12.6 11.5L4.2 19.9"/>'],
  orbital: [IC.cyan, IC.cyan, '<rect x="10" y="2.5" width="4" height="3" fill="S" stroke="none"/><path d="M3.5 2.5h5v3h-5zM15.5 2.5h5v3h-5z"/><path d="M10.4 8.5h3.2l1.6 10h-6.4z" fill="T"/><path d="M4 20.5c2-1.3 4.7-2 8-2s6 .7 8 2" stroke="#ff7a2f"/>'],
  turret: [IC.w, IC.orange, '<path d="M6.5 9h8v6h-8z" fill="T"/><path d="M14.5 10.6h7M14.5 13.4h5"/><path d="M10.5 15v3M10.5 18l-5 3.5M10.5 18l5 3.5"/><circle cx="9.5" cy="12" r="1.4" fill="#3fd0ff" stroke="none"/>'],
  drone: [IC.w, IC.cyan, '<rect x="9" y="9" width="6" height="6" fill="T"/><path d="M9 9L7 7M15 9l2-2M9 15l-2 2M15 15l2 2"/><circle cx="5.2" cy="5.2" r="2.7"/><circle cx="18.8" cy="5.2" r="2.7"/><circle cx="5.2" cy="18.8" r="2.7"/><circle cx="18.8" cy="18.8" r="2.7"/><circle cx="12" cy="12" r="1.3" fill="S" stroke="none"/>'],
  flamer: [IC.w, IC.orange, '<path d="M2.5 10.5h6v3h-6z" fill="T"/><path d="M8.5 11.2h2.5v1.6H8.5"/><path d="M11.5 12c2.8-3.6 6.3-5.8 10-6-1.5 1.7-1.5 3.1-.5 4.3-1.1.7-1.1 1.9 0 2.6-1 .9-.9 2.4.4 3.3-3.7.1-7.1-1.4-9.9-4.2z" fill="T" stroke="#ff7a2f"/>'],
  shockmine: [IC.cyan, IC.cyan, '<ellipse cx="12" cy="16.5" rx="8" ry="3.5" fill="T"/><path d="M8 16.5a4 4 0 0 1 8 0M12 12.5V10"/><path d="M5 6.5l2 2-1.5 1 2 2M19 6.5l-2 2 1.5 1-2 2M12.6 2.5L11 5.5h2l-1.6 3" stroke="#ffd23a"/>'],
});

function svgIcon(name) {
  const [c, t, body] = ICON[name];
  const tint = t + '38';
  const inner = body.replace(/fill="T"/g, `fill="${tint}"`).replace(/fill="S"/g, `fill="${c}"`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.7" stroke-linejoin="miter" stroke-linecap="square" stroke-miterlimit="6">${inner}</svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
