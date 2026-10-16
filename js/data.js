// Toutes les données du jeu : classes, sorts, zones, monstres, boss, objets, familiers.
// Univers inspiré de League of Legends, noms volontairement modifiés.

export const CLASSES = {
  mage: {
    id: 'mage', name: 'Luxanne', role: 'Mage',
    desc: 'Gros dégâts magiques. Fragile, mais étourdit ses ennemis.',
    hp: 90, atk: 15, crit: 0.08, regen: 20,
    colors: { 1: '#f4f1ff', 2: '#b9b1e8', 3: '#ffffff', a: '#ffd54a', h: '#ffe08a', s: '#ffd9b8', d: '#e9b48f', c: '#4a63d6' },
    spells: ['m_basic', 'm_beam', 'm_bind', 'm_ult'],
  },
  archer: {
    id: 'archer', name: 'Ashlyn', role: 'Archère',
    desc: 'Coups critiques fréquents et attaques multiples. Ralentit ses cibles.',
    hp: 105, atk: 12, crit: 0.22, regen: 16,
    colors: { 1: '#4f8fe6', 2: '#2f5fae', 3: '#9cc6ff', a: '#e8f6ff', h: '#f3f3f3', s: '#ffd9b8', d: '#e9b48f', c: '#2a3c78' },
    spells: ['a_basic', 'a_volley', 'a_frost', 'a_ult'],
  },
  knight: {
    id: 'knight', name: 'Garrus', role: 'Chevalier',
    desc: 'Très résistant. Se protège avec son bouclier et achève les ennemis blessés.',
    hp: 145, atk: 11, crit: 0.06, regen: 16,
    colors: { 1: '#c9ced8', 2: '#878fa0', 3: '#f2f4f8', a: '#e6b422', h: '#7a4a24', s: '#ffd9b8', d: '#e9b48f', c: '#2f55b8' },
    spells: ['k_basic', 'k_shield', 'k_spin', 'k_ult'],
  },
};

// kind: 'basic' (gratuit), 'skill', 'ult' (jauge pleine)
// Chaque sort a une phrase courte pour l'interface.
export const SPELLS = {
  m_basic: { name: 'Bâton', kind: 'basic', cost: 0, icon: 'staff', short: 'Dégâts ×1', mult: 1, fx: 'magic' },
  m_beam:  { name: 'Rayon', kind: 'skill', cost: 35, icon: 'beam', short: 'Dégâts ×2,2', mult: 2.2, fx: 'beam' },
  m_bind:  { name: 'Entrave', kind: 'skill', cost: 30, cd: 3, icon: 'bind', short: '×1 · Étourdit 1 tour', mult: 1, stun: 1, fx: 'magic' },
  m_ult:   { name: 'Éclat final', kind: 'ult', cost: 0, icon: 'nova', short: 'Dégâts ×4', mult: 4, fx: 'nova' },

  a_basic: { name: 'Flèche', kind: 'basic', cost: 0, icon: 'arrow', short: 'Dégâts ×1', mult: 1, fx: 'arrow' },
  a_volley:{ name: 'Salve', kind: 'skill', cost: 30, icon: 'volley', short: '3 flèches ×0,8', mult: 0.8, hits: 3, fx: 'arrow' },
  a_frost: { name: 'Givre', kind: 'skill', cost: 25, cd: 2, icon: 'frost', short: '×1,3 · Affaiblit (−30 %)', mult: 1.3, weak: 2, fx: 'frost' },
  a_ult:   { name: 'Flèche de cristal', kind: 'ult', cost: 0, icon: 'crystal', short: '×3 · Étourdit 2 tours', mult: 3, stun: 2, fx: 'frost' },

  k_basic: { name: 'Épée', kind: 'basic', cost: 0, icon: 'sword', short: 'Dégâts ×1', mult: 1, fx: 'slash' },
  k_shield:{ name: 'Bouclier', kind: 'skill', cost: 25, cd: 3, icon: 'shield', short: 'Bloque le prochain coup · Soin 10 %', shield: 0.35, heal: 0.1, fx: 'shield' },
  k_spin:  { name: 'Tourbillon', kind: 'skill', cost: 35, icon: 'spin', short: '4 coups ×0,65', mult: 0.65, hits: 4, fx: 'slash' },
  k_ult:   { name: 'Justice', kind: 'ult', cost: 0, icon: 'justice', short: '×2,5 · Achève les blessés', mult: 2.5, execute: 0.3, fx: 'nova' },
};

// Intentions des monstres (affichées au-dessus d'eux)
// type: 'atk' | 'heavy' | 'burn' | 'poison' | 'heal' | 'guard' | 'enrage' | 'drain' | 'multi'
export const ZONES = [
  {
    id: 0, name: 'Voie du Milieu', sub: 'Les sbires arrivent !', bg: 'lane',
    sky: ['#3a6fb0', '#8fc3ea'], ground: ['#4c7a3a', '#3b6230'],
    monsters: [
      { name: 'Sbire mêlée', body: 'humanoid', pal: ['#4f7fd8', '#2d4f9a', '#9ec0ff'], hp: 38, atk: 6, moves: ['atk'] },
      { name: 'Sbire lanceur', body: 'humanoid', pal: ['#a05ad8', '#6a3696', '#d6a8ff'], hp: 32, atk: 7, moves: ['atk', 'atk', 'heavy'] },
      { name: 'Porolet', body: 'blob', pal: ['#f2f2f2', '#b9c3cf', '#ffffff'], hp: 44, atk: 6, moves: ['atk', 'heal'] },
      { name: 'Sbire canon', body: 'golem', pal: ['#d88a4f', '#9a5a2d', '#ffc79e'], hp: 58, atk: 8, moves: ['atk', 'guard', 'heavy'] },
      { name: 'Super Sbire', body: 'golem', pal: ['#e05050', '#962d2d', '#ff9e9e'], hp: 80, atk: 9, moves: ['atk', 'heavy', 'enrage'], elite: true },
    ],
    boss: null,
  },
  {
    id: 1, name: 'Jungle de la Faille', sub: 'Ça grouille dans les buissons…', bg: 'jungle',
    sky: ['#1f4a3a', '#4d8a62'], ground: ['#2f5a2a', '#244a20'],
    monsters: [
      { name: 'Raptix', body: 'bird', pal: ['#d84f4f', '#8a2d2d', '#ffb08a'], hp: 62, atk: 10, moves: ['multi', 'atk'] },
      { name: 'Grompf', body: 'blob', pal: ['#6fae3a', '#3d6a1f', '#c2e88a'], hp: 80, atk: 10, moves: ['poison', 'atk'] },
      { name: 'Loup murmure', body: 'beast', pal: ['#5a5f78', '#363a4f', '#a3a9c8'], hp: 74, atk: 12, moves: ['atk', 'multi', 'heavy'] },
      { name: 'Krog ancien', body: 'golem', pal: ['#8a7a64', '#5a4d3c', '#c8b89c'], hp: 100, atk: 11, moves: ['guard', 'heavy', 'atk'] },
      { name: 'Sentinelle bleue', body: 'golem', pal: ['#3a7ad8', '#24508f', '#8ac2ff'], hp: 112, atk: 12, moves: ['atk', 'heal', 'heavy'], elite: true },
    ],
    boss: { name: 'Brambleback Rouge', title: 'Gardien de la Jungle', body: 'golem', pal: ['#c83a2a', '#7a1f16', '#ff9a5a'], hp: 230, atk: 15, moves: ['burn', 'atk', 'heavy', 'enrage'] },
  },
  {
    id: 2, name: 'Rivière Scintillante', sub: 'Attention à ne pas glisser.', bg: 'river',
    sky: ['#2a5a8a', '#7ac2e0'], ground: ['#3a8aa8', '#2a6a88'],
    monsters: [
      { name: 'Crabe scuttle', body: 'crab', pal: ['#4fb8a8', '#2d7a70', '#a8f0e0'], hp: 105, atk: 13, moves: ['guard', 'atk'] },
      { name: 'Gloop des eaux', body: 'blob', pal: ['#3a8ad8', '#2456a0', '#9ad0ff'], hp: 112, atk: 13, moves: ['poison', 'heal', 'atk'] },
      { name: 'Raptix des rives', body: 'bird', pal: ['#e0a83a', '#9a6a1f', '#ffe08a'], hp: 100, atk: 15, moves: ['multi', 'multi', 'heavy'] },
      { name: 'Crabe géant', body: 'crab', pal: ['#d86a3a', '#8a3f1f', '#ffb08a'], hp: 140, atk: 14, moves: ['guard', 'heavy', 'atk'] },
      { name: 'Ombre aquatique', body: 'ghost', pal: ['#3ad8c8', '#1f8a80', '#b0fff5'], hp: 130, atk: 16, moves: ['drain', 'atk', 'heavy'], elite: true },
    ],
    boss: { name: 'Héraut de la Faille', title: 'L\'œil du Vide', body: 'beast', pal: ['#8a3ad8', '#541f8a', '#d0a0ff'], hp: 340, atk: 18, moves: ['heavy', 'atk', 'guard', 'enrage', 'multi'] },
  },
  {
    id: 3, name: 'Abîme Glacial', sub: 'Un pont gelé, sans retour.', bg: 'ice',
    sky: ['#4a6a9a', '#c8e0f5'], ground: ['#d8eaf8', '#a8c8e8'],
    monsters: [
      { name: 'Poro sauvage', body: 'blob', pal: ['#e8f0ff', '#a8b8d8', '#ffffff'], hp: 145, atk: 16, moves: ['atk', 'heal', 'multi'] },
      { name: 'Yéti des glaces', body: 'beast', pal: ['#c8d8f0', '#8aa0c8', '#ffffff'], hp: 170, atk: 18, moves: ['heavy', 'atk', 'guard'] },
      { name: 'Esprit du givre', body: 'ghost', pal: ['#8ad0ff', '#4a8ad8', '#e0f5ff'], hp: 150, atk: 19, moves: ['drain', 'atk'] },
      { name: 'Golem de glace', body: 'golem', pal: ['#6ab8e8', '#3a78a8', '#c8f0ff'], hp: 200, atk: 17, moves: ['guard', 'heavy', 'atk'] },
      { name: 'Gardien du pont', body: 'humanoid', pal: ['#5a7ab8', '#344c80', '#a8c0f0'], hp: 190, atk: 20, moves: ['atk', 'heavy', 'enrage'], elite: true },
    ],
    boss: { name: 'Anivale', title: 'Cryophénix éternel', body: 'bird', pal: ['#5ab8ff', '#2a6ad8', '#e0f8ff'], hp: 460, atk: 22, moves: ['multi', 'heavy', 'heal', 'atk', 'guard'] },
  },
  {
    id: 4, name: 'Îles Ombreuses', sub: 'La Brume noire dévore tout.', bg: 'shadow',
    sky: ['#14262a', '#2f5a52'], ground: ['#1f3a36', '#142a26'],
    monsters: [
      { name: 'Âme errante', body: 'ghost', pal: ['#5ae8b8', '#2a9a78', '#c0ffe8'], hp: 190, atk: 21, moves: ['drain', 'atk'] },
      { name: 'Squelette maudit', body: 'humanoid', pal: ['#d8d0b8', '#9a907a', '#fffaf0'], hp: 215, atk: 22, moves: ['atk', 'heavy', 'multi'] },
      { name: 'Araignée de brume', body: 'crab', pal: ['#3a4a48', '#1f2a28', '#7ae8b8'], hp: 205, atk: 23, moves: ['poison', 'multi', 'atk'] },
      { name: 'Revenant', body: 'ghost', pal: ['#8ab8a8', '#4a7a6a', '#d8fff0'], hp: 230, atk: 22, moves: ['drain', 'guard', 'heavy'] },
      { name: 'Chevalier déchu', body: 'humanoid', pal: ['#3a5a58', '#1f3836', '#7affd0'], hp: 260, atk: 25, moves: ['heavy', 'enrage', 'atk'], elite: true },
    ],
    boss: { name: 'Thrash', title: 'Geôlier des âmes', body: 'ghost', pal: ['#3ae898', '#1f8a58', '#c8ffe0'], hp: 600, atk: 27, moves: ['drain', 'heavy', 'poison', 'guard', 'enrage'] },
  },
  {
    id: 5, name: 'Le Vide', sub: 'Au-delà, il n\'y a que la faim.', bg: 'void',
    sky: ['#1a0a2a', '#4a1a6a'], ground: ['#2a1040', '#1a0828'],
    monsters: [
      { name: 'Larve du Vide', body: 'worm', pal: ['#a83ad8', '#62208a', '#f0a0ff'], hp: 250, atk: 26, moves: ['multi', 'atk'] },
      { name: 'Rôdeur abyssal', body: 'beast', pal: ['#6a2ad8', '#3a148a', '#c0a0ff'], hp: 280, atk: 28, moves: ['heavy', 'atk', 'multi'] },
      { name: 'Œil du Vide', body: 'blob', pal: ['#d83aa8', '#8a1f6a', '#ffa0e0'], hp: 265, atk: 29, moves: ['drain', 'poison', 'atk'] },
      { name: 'Scarabée du Néant', body: 'crab', pal: ['#4a3ad8', '#2a1f8a', '#a8a0ff'], hp: 310, atk: 27, moves: ['guard', 'heavy', 'atk'] },
      { name: 'Héraut affamé', body: 'worm', pal: ['#d83a6a', '#8a1f3a', '#ffa0c0'], hp: 340, atk: 31, moves: ['heavy', 'enrage', 'drain'], elite: true },
    ],
    boss: { name: 'Baron Nashar', title: 'Seigneur du Vide', body: 'worm', pal: ['#8a2ad8', '#4a1478', '#e8a0ff'], hp: 820, atk: 33, moves: ['heavy', 'poison', 'multi', 'enrage', 'guard', 'drain'] },
  },
];

export const MONSTER_COUNT = ZONES.reduce((n, z) => n + z.monsters.length, 0); // 30
export const BOSS_COUNT = ZONES.filter(z => z.boss).length; // 5

// Familiers : obtenus en battant les boss. Agissent chaque tour.
export const PETS = {
  poro:   { name: 'Poro', desc: 'Soigne 3 % de vos PV chaque tour.', pal: ['#f2f2f2', '#b9c3cf', '#ffffff'], body: 'blob', zone: 0 },
  brambi: { name: 'Bramblichou', desc: 'Inflige 6 % de votre ATQ ×3 en brûlure.', pal: ['#c83a2a', '#7a1f16', '#ff9a5a'], body: 'golem', zone: 1 },
  herald: { name: 'Petit Héraut', desc: 'Frappe l\'ennemi chaque tour (40 % ATQ).', pal: ['#8a3ad8', '#541f8a', '#d0a0ff'], body: 'beast', zone: 2 },
  phenix: { name: 'Phénixounet', desc: '+8 mana par tour.', pal: ['#5ab8ff', '#2a6ad8', '#e0f8ff'], body: 'bird', zone: 3 },
  wisp:   { name: 'Lanterne', desc: 'Bouclier de 4 % PV chaque tour.', pal: ['#3ae898', '#1f8a58', '#c8ffe0'], body: 'ghost', zone: 4 },
  voidy:  { name: 'Nashar Jr', desc: 'Votre ultime se charge 2× plus vite.', pal: ['#8a2ad8', '#4a1478', '#e8a0ff'], body: 'worm', zone: 5 },
};
// zone d'obtention = boss de la zone (poro offert à la fin de la zone 0)
export const PET_BY_ZONE = ['poro', 'brambi', 'herald', 'phenix', 'wisp', 'voidy'];

// Équipement : 3 emplacements
export const SLOTS = { weapon: 'Arme', armor: 'Armure', trinket: 'Bijou' };
export const RARITY = {
  common:    { name: 'Commun',     color: '#b8c0cc', mult: 1 },
  rare:      { name: 'Rare',       color: '#4fa8ff', mult: 1.6 },
  epic:      { name: 'Épique',     color: '#c06aff', mult: 2.4 },
  legendary: { name: 'Légendaire', color: '#ffb52e', mult: 3.4 },
};

export const ITEM_BASES = {
  weapon: [
    { name: 'Épée longue', icon: 'sword', stat: { atk: 3 } },
    { name: 'Tome d\'amplification', icon: 'tome', stat: { atk: 3 } },
    { name: 'Arc courbé', icon: 'bow', stat: { atk: 2, crit: 0.03 } },
    { name: 'Lame de Doran', icon: 'sword', stat: { atk: 2, hp: 8 } },
    { name: 'Bâton du néant', icon: 'staff', stat: { atk: 4 } },
  ],
  armor: [
    { name: 'Cotte de mailles', icon: 'armor', stat: { hp: 16 } },
    { name: 'Cape de négation', icon: 'cloak', stat: { hp: 12, regen: 1 } },
    { name: 'Gilet d\'épines', icon: 'armor', stat: { hp: 14, atk: 1 } },
    { name: 'Plastron de Warmog', icon: 'armor', stat: { hp: 20 } },
  ],
  trinket: [
    { name: 'Larme de la déesse', icon: 'gem', stat: { regen: 2 } },
    { name: 'Gant de cogneur', icon: 'glove', stat: { crit: 0.05 } },
    { name: 'Anneau de Doran', icon: 'ring', stat: { regen: 1, atk: 1 } },
    { name: 'Talisman ancien', icon: 'gem', stat: { hp: 8, crit: 0.02 } },
  ],
};

// Objets légendaires uniques donnés par les boss
export const BOSS_ITEMS = [
  null,
  { slot: 'weapon', name: 'Lame du Brambleback', icon: 'sword', rarity: 'legendary', stat: { atk: 14, crit: 0.05 } },
  { slot: 'armor', name: 'Carapace du Héraut', icon: 'armor', rarity: 'legendary', stat: { hp: 80, regen: 3 } },
  { slot: 'trinket', name: 'Plume de Cryophénix', icon: 'gem', rarity: 'legendary', stat: { crit: 0.12, regen: 5 } },
  { slot: 'weapon', name: 'Faux de Thrash', icon: 'staff', rarity: 'legendary', stat: { atk: 26, hp: 30 } },
  { slot: 'armor', name: 'Écailles du Baron', icon: 'armor', rarity: 'legendary', stat: { hp: 160, atk: 10 } },
];

// Améliorations permanentes (boutique, payées en or)
export const UPGRADES = {
  hp:     { name: 'Vitalité', icon: 'heart', desc: '+8 PV max', per: { hp: 8 }, base: 40, grow: 1.35, max: 20 },
  atk:    { name: 'Puissance', icon: 'fist', desc: '+2 ATQ', per: { atk: 2 }, base: 50, grow: 1.38, max: 20 },
  crit:   { name: 'Précision', icon: 'target', desc: '+2 % de critique', per: { crit: 0.02 }, base: 60, grow: 1.45, max: 10 },
  regen:  { name: 'Clarté', icon: 'mana', desc: '+3 mana par tour', per: { regen: 3 }, base: 60, grow: 1.45, max: 8 },
  potion: { name: 'Sacoche', icon: 'potion', desc: '+1 potion par expédition', per: { potion: 1 }, base: 120, grow: 2, max: 3 },
};

export const ACHIEVEMENTS = [
  { id: 'first_win', name: 'Premier sang', desc: 'Gagner votre premier combat.', gold: 20 },
  { id: 'perfect10', name: 'Bonk parfait', desc: 'Réussir 10 frappes parfaites.', gold: 40 },
  { id: 'zone1', name: 'Sortie de voie', desc: 'Terminer la Voie du Milieu.', gold: 50 },
  { id: 'boss1', name: 'Chasseur', desc: 'Vaincre un boss.', gold: 80 },
  { id: 'allclass', name: 'Polyvalent', desc: 'Gagner un combat avec chaque classe.', gold: 100 },
  { id: 'rich', name: 'Fortune de Gangplank', desc: 'Posséder 1 000 or.', gold: 100 },
  { id: 'epic', name: 'Collectionneur', desc: 'Obtenir un objet épique.', gold: 60 },
  { id: 'pets3', name: 'Ménagerie', desc: 'Posséder 3 familiers.', gold: 120 },
  { id: 'ult20', name: 'Pentakill', desc: 'Lancer 20 ultimes.', gold: 80 },
  { id: 'nodeath', name: 'Intouchable', desc: 'Terminer une zone sans mourir.', gold: 100 },
  { id: 'baron', name: 'Baron sécurisé', desc: 'Vaincre le Baron Nashar.', gold: 500 },
];
