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
