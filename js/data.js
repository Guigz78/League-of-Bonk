// Toutes les données du jeu : classes, sorts, zones, monstres, boss, objets, familiers.

export const CLASSES = {
  mage: {
    id: 'mage', name: 'Lumi', role: 'Mage',
    desc: 'Fragile mais dévastatrice : son rayon transperce les rangs ennemis.',
    hp: 110, atk: 15, crit: 0.08, speed: 1,
    weapon: 'beam', ult: 'nova',
    colors: { 1: '#f4f1ff', 2: '#b9b1e8', 3: '#ffffff', a: '#ffd54a', h: '#ffe08a', s: '#ffd9b8', d: '#e9b48f', c: '#4a63d6' },
  },
  archer: {
    id: 'archer', name: 'Kira', role: 'Archère',
    desc: 'Rapide et précise : ses flèches partent en rafale et font souvent des critiques.',
    hp: 125, atk: 14, crit: 0.2, speed: 1.08,
    weapon: 'arrows', ult: 'crystal',
    colors: { 1: '#4f8fe6', 2: '#2f5fae', 3: '#9cc6ff', a: '#e8f6ff', h: '#f3f3f3', s: '#ffd9b8', d: '#e9b48f', c: '#2a3c78' },
  },
  knight: {
    id: 'knight', name: 'Brok', role: 'Chevalier',
    desc: 'Très résistant (−12 % de dégâts subis) : son épée balaie tout ce qui s\'approche.',
    hp: 135, atk: 12, crit: 0.06, speed: 0.95, armor: 0.12, // talent : armure de classe (run.js)
    weapon: 'sword', ult: 'justice',
    colors: { 1: '#c9ced8', 2: '#878fa0', 3: '#f2f4f8', a: '#e6b422', h: '#7a4a24', s: '#ffd9b8', d: '#e9b48f', c: '#2f55b8' },
  },
  // ---- champions C1 (à débloquer : défi et/ou Saison, clé 'cls:<id>') ; passive = talent montré sur l'écran des champions.
  // Talents lus par run.js : lifesteal / dodge (comme armor : ajoutés à l'équipement), rage = jusqu'à +x dégâts selon les PV manquants
  vampire: {
    id: 'vampire', name: 'Nyx', role: 'Vampire', locked: true,
    desc: 'Sa faux sanglante fauche tout autour d\'elle et chaque coup la soigne.',
    hp: 120, atk: 14, crit: 0.1, speed: 1.02, lifesteal: 0.06,
    weapon: 'scythe', ult: 'bloodfeast',
    passive: { name: 'Soif de sang', icon: 'lifesteal', desc: 'Vol de vie inné de 6 % : vos coups vous soignent.' },
    colors: { 1: '#2a1a30', 2: '#170c1c', 3: '#5a2a44', a: '#e0203e', h: '#c8cee0', s: '#f8e8ec', d: '#dcc2ca', c: '#7a1a30' },
  },
  assassin: {
    id: 'assassin', name: 'Sora', role: 'Ombre', locked: true,
    desc: 'Insaisissable : ses dagues partent dans tous les sens et les coups l\'évitent souvent.',
    hp: 110, atk: 14, crit: 0.22, speed: 1.1, dodge: 0.1, wpnMul: 1.5, // wpnMul : ses dagues frappent plus fort (run.wstats)
    weapon: 'daggers', ult: 'shadowdance',
    passive: { name: 'Pas de l\'ombre', icon: 'dodge', desc: '+15 % de chance de critique et 10 % d\'esquive.' },
    colors: { 1: '#3a2a6a', 2: '#241a44', 3: '#6e5eb0', a: '#ff3ab0', h: '#1e1830', s: '#ffd9b8', d: '#e9b48f', c: '#16101f' },
  },
  berserker: {
    id: 'berserker', name: 'Ragnar', role: 'Berserker', locked: true,
    desc: 'Increvable et furieux : plus il est blessé, plus sa hache frappe fort.',
    hp: 152, atk: 12, crit: 0.06, speed: 0.97, rage: 0.4,
    weapon: 'boomerang', ult: 'fury',
    passive: { name: 'Rage', icon: 'i_enrage', desc: 'Jusqu\'à +40 % de dégâts selon les PV manquants ; PV très élevés.' },
    colors: { 1: '#7a4a2a', 2: '#553018', 3: '#b08050', a: '#3a8ae0', h: '#e0662a', s: '#ffd2b0', d: '#e8a888', c: '#8a5a32' },
  },
  // ---- champions C2 (à débloquer : défi, clé 'cls:<id>'). Talents (js/champions-c2.js) : chill = ralentissement des
  // ennemis touchés (run.hitEnemy), regenPct = part des PV max rendue par seconde, pickup = ramassage en plus (save.playerStats) ;
  // wpnMul / wpnCd : dégâts et recharge de leur arme de départ (run.wstats), partagée avec les autres champions
  cryo: {
    id: 'cryo', name: 'Frida', role: 'Cryomancienne', locked: true,
    desc: 'Son onde de givre fige les hordes autour d\'elle ; tout ce qu\'elle touche ralentit.',
    hp: 115, atk: 14, crit: 0.08, speed: 1, chill: 0.2, wpnMul: 1.6, wpnCd: 0.7,
    weapon: 'frost', ult: 'winter',
    passive: { name: 'Morsure du givre', icon: 'chill', desc: 'Vos coups ralentissent les ennemis de 20 % (10 % les boss).' },
    colors: { 1: '#cce4f8', 2: '#78aee0', 3: '#ffffff', a: '#5ad8ff', h: '#f4f8ff', s: '#ffe2d4', d: '#ecbcae', c: '#2a5ab8' },
  },
  druid: {
    id: 'druid', name: 'Gaïa', role: 'Druidesse', locked: true,
    desc: 'Ses champignons explosent sous les pas des monstres ; la forêt la soigne sans cesse.',
    hp: 125, atk: 13, crit: 0.08, speed: 1, regenPct: 0.008, pickup: 0.2, wpnMul: 1.4,
    weapon: 'shrooms', ult: 'forest',
    passive: { name: 'Sève vivante', icon: 'leaf', desc: 'Régénère 0,8 % des PV par seconde ; ramassage +20 %.' },
    colors: { 1: '#5a8a3a', 2: '#3a6228', 3: '#9ad06a', a: '#ff7ab8', h: '#a0582a', s: '#ffd8b8', d: '#e8b090', c: '#6a4426' },
  },
};

// Évolutions : pendant la partie, au niveau indiqué (5 stades). La forme ultime a une aura de super guerrier (aura).
export const EVOLUTIONS = {
  mage: [
    { name: 'Lumi' },
    { name: 'Lumi Prisme', lvl: 5, colors: { 1: '#fff0c0', 2: '#e0b050', 3: '#fffbe8', a: '#ff6ad8', h: '#ffffff', c: '#b04ad6' } },
    { name: 'Lumi Astrale', lvl: 11, colors: { 1: '#4a3aa8', 2: '#2a1a7a', 3: '#8a7aff', a: '#ffd54a', h: '#ff9ae0', c: '#ffd54a' } },
    { name: 'Lumi Céleste', lvl: 19, colors: { 1: '#e8f4ff', 2: '#9ac8f0', 3: '#ffffff', a: '#5ad8ff', h: '#d0f4ff', c: '#ffd54a' } },
    { name: 'Lumi Supernova', lvl: 28, aura: '#ffd54a', colors: { 1: '#fff6d0', 2: '#ffc23a', 3: '#ffffff', a: '#ffffff', h: '#ffe94a', c: '#ff9a2a' } },
  ],
  archer: [
    { name: 'Kira' },
    { name: 'Kira Givrée', lvl: 5, colors: { 1: '#9ad8ff', 2: '#5aa8e0', 3: '#e8f8ff', a: '#ffffff', c: '#3a6ab8' } },
    { name: 'Kira Blizzard', lvl: 11, colors: { 1: '#2a5ab8', 2: '#1a3a80', 3: '#7ab0ff', a: '#e8f8ff', h: '#ffffff', c: '#9ad8ff' } },
    { name: 'Kira Boréale', lvl: 19, colors: { 1: '#3ad8b0', 2: '#1a8a78', 3: '#a8fff0', a: '#ff6ad8', h: '#e0fff8', c: '#7a5aff' } },
    { name: 'Kira Zéro Absolu', lvl: 28, aura: '#7ae8ff', colors: { 1: '#f0faff', 2: '#a8d8ff', 3: '#ffffff', a: '#5ae8ff', h: '#bff8ff', c: '#5ab8ff' } },
  ],
  knight: [
    { name: 'Brok' },
    { name: 'Brok Paladin', lvl: 5, colors: { 1: '#e6c85a', 2: '#b08a2a', 3: '#fff0b0', c: '#c83a3a' } },
    { name: 'Brok Croisé', lvl: 11, colors: { 1: '#c8d0e0', 2: '#7a8aa8', 3: '#ffffff', a: '#ff3a4a', c: '#3a5ad8' } },
    { name: 'Brok Titan', lvl: 19, colors: { 1: '#3a3a4a', 2: '#1a1a28', 3: '#7a7a9a', a: '#ff8a2a', c: '#c83a3a' } },
    { name: 'Brok Légende Dorée', lvl: 28, aura: '#ffd54a', colors: { 1: '#ffe070', 2: '#e0a020', 3: '#fffbe0', a: '#ffffff', c: '#ff5a3a' } },
  ],
  // ---- champions C1 ----
  vampire: [
    { name: 'Nyx' },
    { name: 'Nyx Écarlate', lvl: 5, colors: { 1: '#6a1428', 2: '#3a0a16', 3: '#a82a44', a: '#ff3a52', c: '#1a0e16' } },
    { name: 'Nyx Nocturne', lvl: 11, colors: { 1: '#2e1a4a', 2: '#180c2a', 3: '#5a3a8a', a: '#ff2a6a', h: '#d4d8ee', c: '#8a1a3a' } },
    { name: 'Nyx Reine du Sang', lvl: 19, colors: { 1: '#8a0e26', 2: '#4a0614', 3: '#d03a52', a: '#ffd54a', h: '#e4e4f2', c: '#1a0a12' } },
    { name: 'Nyx Lune de Sang', lvl: 28, aura: '#ff2a4a', colors: { 1: '#1a0a14', 2: '#0c0408', 3: '#ff4a64', a: '#ff2a4a', h: '#ffe0e6', c: '#c8102e' } },
  ],
  assassin: [
    { name: 'Sora' },
    { name: 'Sora Crépuscule', lvl: 5, colors: { 1: '#4a2a7a', 2: '#2a184a', 3: '#8a6ad0', a: '#ff5ac0', c: '#1a1028' } },
    { name: 'Sora Lame Fantôme', lvl: 11, colors: { 1: '#5a5a8a', 2: '#34345a', 3: '#a8b0e0', a: '#7af0ff', h: '#2a2a44', c: '#202038' } },
    { name: 'Sora Éclipse', lvl: 19, colors: { 1: '#1c1630', 2: '#0e0a1a', 3: '#4a3a7a', a: '#ffd54a', h: '#140e22', c: '#ff3ab0' } },
    { name: 'Sora Néant', lvl: 28, aura: '#b05aff', colors: { 1: '#2a1050', 2: '#140628', 3: '#9a5aff', a: '#ff4ad8', h: '#d8a8ff', c: '#0a0614' } },
  ],
  berserker: [
    { name: 'Ragnar' },
    { name: 'Ragnar Loup', lvl: 5, colors: { 3: '#c8c8d0', c: '#8a8a96', a: '#4a9aff' } },
    { name: 'Ragnar Ours', lvl: 11, colors: { 1: '#5a3418', 2: '#3a200e', 3: '#7a5232', c: '#4a2c16', a: '#3a7ae8' } },
    { name: 'Ragnar Tonnerre', lvl: 19, colors: { 1: '#3a3a48', 2: '#22222e', 3: '#7a8aa8', c: '#2a2a36', a: '#5ad8ff', h: '#f07a3a' } },
    { name: 'Ragnar Fureur du Nord', lvl: 28, aura: '#ff6a1a', colors: { 1: '#5a2a14', 2: '#3a160a', 3: '#e08a3a', c: '#3a1a0c', a: '#ffb02a', h: '#ff7a1a' } },
  ],
  // ---- champions C2 ----
  cryo: [
    { name: 'Frida' },
    { name: 'Frida Flocon', lvl: 5, colors: { 1: '#d8f0ff', 2: '#88c6f0', c: '#2a84d8', a: '#7ae8ff' } },
    { name: 'Frida Glacier', lvl: 11, colors: { 1: '#a6cef0', 2: '#4a78c0', c: '#1a3a8a', a: '#4ae0ff', h: '#e0f0ff' } },
    { name: 'Frida Reine des Glaces', lvl: 19, colors: { 1: '#e6e2ff', 2: '#9a8ae8', 3: '#f4f0ff', c: '#5a3ac8', a: '#c0f8ff' } },
    { name: 'Frida Hiver Éternel', lvl: 28, aura: '#5ad0ff', colors: { 1: '#e8f8ff', 2: '#6ab8f0', c: '#2a6ad8', a: '#ffffff', h: '#bff4ff' } },
  ],
  druid: [
    { name: 'Gaïa' },
    { name: 'Gaïa Fleurie', lvl: 5, colors: { 1: '#6a9a3a', 3: '#b0e47a', a: '#ff5aa8' } },
    { name: 'Gaïa Écorce', lvl: 11, colors: { 1: '#3a6a3a', 2: '#28482a', 3: '#7ab85a', c: '#5a3a1e', a: '#ffc23a' } },
    { name: 'Gaïa Cerf Doré', lvl: 19, colors: { 1: '#2a5a4a', 2: '#1a3a30', 3: '#5ae0a0', c: '#4a2e18', a: '#ff8ad8', h: '#e0a050' } },
    { name: 'Gaïa Mère Nature', lvl: 28, aura: '#7aff5a', colors: { 1: '#8ae05a', 2: '#4a9a3a', 3: '#e0ffb0', c: '#8a5a2a', a: '#ff9ad8', h: '#d8ff8a' } },
  ],
};

// Bénédictions des autels (pendant la partie)
export const BOONS = {
  dmg:    { name: 'Autel de puissance', icon: 'fist', desc: '+12 % dégâts' },
  hp:     { name: 'Autel de vitalité', icon: 'heart', desc: '+15 % PV max et soin complet' },
  speed:  { name: 'Autel du vent', icon: 'arrow', desc: '+8 % vitesse' },
  crit:   { name: 'Autel de précision', icon: 'target', desc: '+6 % de critique' },
  xp:     { name: 'Autel du savoir', icon: 'tome', desc: '+20 % d\'expérience' },
  magnet: { name: 'Autel d\'attraction', icon: 'ring', desc: '+30 % rayon de ramassage' },
  haste:  { name: 'Autel de hâte', icon: 'star', desc: 'Attaques 8 % plus fréquentes' },
  vamp:   { name: 'Autel du sang', icon: 'lifesteal', desc: '+3 % de vol de vie' },
};

// Ultimes : bouton à charger en tuant des monstres
export const ULTS = {
  nova:    { name: 'Éclat final', icon: 'nova', desc: 'Explosion de lumière : énormes dégâts autour de vous.' },
  crystal: { name: 'Flèche de cristal', icon: 'crystal', desc: 'Flèche géante qui transperce et gèle tout sur son passage.' },
  justice: { name: 'Justice', icon: 'justice', desc: 'Frappe tous les ennemis à l\'écran et vous rend invincible 3 s.' },
  // ---- champions C1 (js/champions-c1.js) ----
  bloodfeast:  { name: 'Festin de sang', icon: 'feast', desc: 'Draine tous les ennemis à l\'écran et vous soigne.' },
  shadowdance: { name: 'Danse des ombres', icon: 'shadow', desc: 'Intouchable 2,5 s : vous foncez de cible en cible en tranchant.' },
  fury:        { name: 'Fureur', icon: 'fury', desc: '6 s d\'attaques 60 % plus rapides et une onde de choc au sol.' },
  // ---- champions C2 (js/champions-c2.js) ----
  winter:      { name: 'Hiver éternel', icon: 'winter', desc: 'Gèle tout l\'écran 3 s et inflige des dégâts, puis la glace vole en éclats.' },
  forest:      { name: 'Colère de la forêt', icon: 'forest', desc: 'Soin de 30 % ; des racines immobilisent les ennemis et des épines vous entourent 5 s.' },
};

// Armes (attaques automatiques). lv = description de chaque niveau (1 à 5).
export const WEAPONS = {
  beam:      { name: 'Rayon lumineux', icon: 'beam', desc: 'Rayon qui transperce vers l\'ennemi le plus proche.', lv: ['', '+30 % dégâts', 'Rayon plus large', '2e rayon dans l\'autre sens', '+40 % dégâts, plus rapide'] },
  arrows:    { name: 'Flèches', icon: 'arrow', desc: 'Tire des flèches sur l\'ennemi le plus proche.', lv: ['', '+1 flèche', '+30 % dégâts', 'Les flèches transpercent', '+1 flèche, plus rapide'] },
  sword:     { name: 'Lame d\'acier', icon: 'sword', desc: 'Grand coup d\'épée devant vous, repousse les ennemis.', lv: ['', '+30 % dégâts', 'Plus grande portée', 'Frappe aussi derrière', '+40 % dégâts, plus rapide'] },
  orbs:      { name: 'Orbes spirituels', icon: 'bind', desc: 'Des orbes tournent autour de vous.', lv: ['', '+1 orbe', '+30 % dégâts', '+1 orbe, plus large', '+1 orbe, +30 % dégâts'] },
  aura:      { name: 'Cape solaire', icon: 'cloak', desc: 'Brûle en continu les ennemis proches.', lv: ['', '+25 % rayon', '+40 % dégâts', '+25 % rayon', '+50 % dégâts'] },
  lightning: { name: 'Foudre', icon: 'i_stun', desc: 'La foudre frappe des ennemis au hasard.', lv: ['', '+1 éclair', '+30 % dégâts', '+1 éclair, plus rapide', '+2 éclairs'] },
  boomerang: { name: 'Lame ricochet', icon: 'spin', desc: 'Lame qui part et revient en transperçant tout.', lv: ['', '+30 % dégâts', '+1 lame', 'Plus grande et plus rapide', '+1 lame, +30 % dégâts'] },
  shrooms:   { name: 'Champignons', icon: 'i_poison', desc: 'Pose des champignons qui explosent au contact.', lv: ['', '+1 champignon', '+40 % dégâts', 'Explosion plus large', '+1 champignon, plus rapide'] },
  frost:     { name: 'Nova de givre', icon: 'frost', desc: 'Onde glacée qui blesse et ralentit autour de vous.', lv: ['', '+30 % dégâts', 'Plus grande onde', 'Plus fréquente', 'Gèle 1 s'] },
  daggers:   { name: 'Dagues', icon: 'volley', desc: 'Lance des dagues dans plusieurs directions.', lv: ['', '+2 dagues', '+30 % dégâts', '+2 dagues', 'Transpercent, plus rapides'] },
  snowball:  { name: 'Boule de neige', icon: 'heart', desc: 'Lance une boule de neige qui éclate sur une zone.', lv: ['', '+30 % dégâts', 'Zone plus grande', '+1 boule', '+1 boule, plus rapide'] },
  // arme propre à Nyx (own : LOCKED.w sans défi, jamais proposée aux autres champions ni comptée dans les Défis)
  scythe:    { name: 'Faux sanglante', icon: 'scythe', own: 'vampire', desc: 'Grand arc de faux autour de vous ; ses coups volent la vie.', lv: ['', '+30 % dégâts', 'Plus grande portée', 'Fauche tout autour', '+40 % dégâts, plus rapide'] },
};

// Tomes : améliorations passives pour la partie
export const TOMES = {
  power:  { name: 'Tome de puissance', icon: 'fist', desc: '+15 % dégâts' },
  haste:  { name: 'Tome de hâte', icon: 'star', desc: 'Attaques 10 % plus fréquentes' },
  boots:  { name: 'Bottes de vitesse', icon: 'arrow', desc: '+10 % vitesse de déplacement' },
  vital:  { name: 'Cœur de géant', icon: 'heart', desc: '+20 % PV max (et soigne)' },
  magnet: { name: 'Aimant', icon: 'ring', desc: '+35 % rayon de ramassage' },
  crit:   { name: 'Lame aiguisée', icon: 'target', desc: '+7 % de critique' },
  armor:  { name: 'Armure à pointes', icon: 'armor', desc: '−6 % de dégâts subis' },
  wisdom: { name: 'Tome de sagesse', icon: 'tome', desc: '+15 % d\'expérience' },
  area:   { name: 'Chapeau de sorcier', icon: 'crown', desc: '+12 % taille des attaques' },
  vamp:   { name: 'Crocs du vampire', icon: 'lifesteal', desc: '+3 % de vol de vie : vos coups vous soignent' },
};
export const MAX_WEAPONS = 4, MAX_TOMES = 4, MAX_LEVEL = 5;

// ---------- Gameplay : évolutions d'armes, rareté des améliorations, combo, champion ----------
// Évolution d'arme : une arme au niveau 5 + son tome associé (n'importe quel niveau) -> la prochaine montée de niveau
// (ou le prochain coffre) propose l'évolution (carte { kind: 'evo', id }). L'arme garde sa place, en bien plus forte.
export const WEAPON_EVOS = {
  beam:      { tome: 'area',   name: 'Prisme solaire',   icon: 'beam',     desc: '4 rayons géants en croix, plus larges et plus longs.' },
  arrows:    { tome: 'crit',   name: 'Pluie de flèches', icon: 'arrow',    desc: 'Éventail de 7 flèches perçantes et une flèche de cristal géante.' },
  sword:     { tome: 'armor',  name: 'Tourbillon du Titan', icon: 'sword', desc: 'Frappe tout autour de vous, très loin, et repousse fort.' },
  orbs:      { tome: 'magnet', name: 'Galaxie spirituelle', icon: 'bind',  desc: '9 orbes sur deux anneaux qui tournent en sens contraire.' },
  aura:      { tome: 'vital',  name: 'Cœur de soleil',   icon: 'cloak',    desc: 'Immense brasier qui brûle plus fort et vous soigne.' },
  lightning: { tome: 'power',  name: 'Tempête divine',   icon: 'i_stun',   desc: '8 éclairs plus larges, qui rebondissent sur les voisins.' },
  boomerang: { tome: 'haste',  name: 'Tornade de lames', icon: 'spin',     desc: '6 grandes lames qui tournent tout autour de vous.' },
  shrooms:   { tome: 'wisdom', name: 'Bosquet explosif', icon: 'i_poison', desc: 'Champignons en série, explosions géantes.' },
  frost:     { tome: 'boots',  name: 'Blizzard éternel', icon: 'frost',    desc: 'Onde de givre géante et fréquente qui gèle tout.' },
  daggers:   { tome: 'vamp',   name: 'Mille lames',      icon: 'volley',   desc: '16 dagues rapides qui transpercent tout et volent la vie (+6 % par coup).' },
  snowball:  { tome: 'power',  name: 'Avalanche',        icon: 'heart',    desc: '5 énormes boules qui gèlent les ennemis touchés.' },
  scythe:    { tome: 'vamp',   name: 'Moisson écarlate', icon: 'scythe',   desc: 'Faux géante qui fauche tout autour, très loin, et vole la vie (+6 % par coup).' },
};
// Rareté des cartes d'amélioration (index = rarity de la carte, couleurs : RARITY[RARITIES[i]]).
// mult = force de l'effet (tome +15 % -> +22 % -> +30 % -> +40 %) ; w = poids de base du tirage ; luck = gain de poids par point de chance.
export const LEVEL_RARITY = [
  { name: 'Commun', mult: 1, w: 62, luck: 0 },
  { name: 'Rare', mult: 1.47, w: 27, luck: 1 },
  { name: 'Épique', mult: 2, w: 9, luck: 1.6 },
  { name: 'Légendaire', mult: 2.67, w: 2, luck: 2.4 },
];
// Bonus de dégâts propre à l'arme selon la rareté de la carte choisie (en plus du niveau)
export const WEAPON_RARITY_DMG = [0, 0.06, 0.12, 0.2];
export const REROLLS = 2, SKIPS = 1;       // relances et « passer » par partie
export const COMBO_WINDOW = 2;             // secondes pour enchaîner deux victimes
export const COMBO_STEPS = [25, 50, 100, 200, 300, 500, 750, 1000, 1500, 2000]; // paliers récompensés
export const HALF = 1600; // demi-taille de la carte (unités du monde)

// Niveaux de difficulté, par zone (façon Megabonk) : Difficile se débloque en battant Normal,
// Cauchemar en battant Difficile. Multiplicateurs appliqués aux monstres et aux récompenses.
// heal = soins (cœurs, familier, régénération), elite = intervalle entre deux élites, mods = pouvoirs par élite,
// rarity = bonus de rareté des objets, itemMult = puissance des objets trouvés.
export const DIFFICULTIES = [
  { id: 0, name: 'Normal', icon: 'star', color: '#5ae87a', desc: 'Le défi prévu pour découvrir la zone.',
    hp: 1, dmg: 1, speed: 1, spawn: 1, elite: 1, mods: 1, boss: 1, heal: 1, gold: 1, rarity: 0, itemMult: 1 },
  { id: 1, name: 'Difficile', icon: 'i_enrage', color: '#ffb03a', desc: 'Monstres plus coriaces, plus rapides et plus nombreux.',
    hp: 1.8, dmg: 1.55, speed: 1.08, spawn: 1.25, elite: 0.8, mods: 1, boss: 1.85, heal: 0.75, gold: 1.6, rarity: 0.08, itemMult: 1.25 },
  { id: 2, name: 'Cauchemar', icon: 'skull', color: '#ff4a6a', desc: 'Élites à deux pouvoirs, soins réduits de moitié.',
    hp: 2.5, dmg: 1.95, speed: 1.15, spawn: 1.45, elite: 0.68, mods: 2, boss: 2.6, heal: 0.5, gold: 2.4, rarity: 0.16, itemMult: 1.5 },
];

// Pouvoirs des élites (tirés au hasard, affichés dans leur nom). f = accord au féminin.
export const ELITE_MODS = {
  rapide:     { name: 'Rapide', f: 'Rapide', desc: 'Se déplace et charge bien plus vite.' },
  blinde:     { name: 'Blindé', f: 'Blindée', desc: 'Très résistant, impossible à repousser.' },
  vampirique: { name: 'Vampirique', f: 'Vampirique', desc: 'Se soigne à chaque coup porté.' },
  explosif:   { name: 'Explosif', f: 'Explosive', desc: 'Explose à sa mort : éloignez-vous !' },
  enrage:     { name: 'Enragé', f: 'Enragée', desc: 'Frappe plus fort, encore plus quand il est blessé.' },
  invocateur: { name: 'Invocateur', f: 'Invocatrice', desc: 'Appelle des renforts.' },
};

// Zones : chaque partie = survivre aux vagues, puis battre le boss.
export const ZONE_TIME = [180, 240, 240, 240, 270, 300]; // durée du chrono de chaque monde (après : les monstres deviennent fous)
export const ZONES = [
  {
    id: 0, name: 'Vallée des Gobelins', sub: 'Les gobelins attaquent !', bg: 'lane',
    sky: ['#3a6fb0', '#8fc3ea'], ground: ['#4c7a3a', '#3b6230'],
    monsters: [
      { name: 'Gobelin bagarreur', body: 'humanoid', pal: ['#4f7fd8', '#2d4f9a', '#9ec0ff'], hp: 38, atk: 6, moves: ['atk'] },
      { name: 'Gobelin lanceur', ranged: true, body: 'humanoid', pal: ['#a05ad8', '#6a3696', '#d6a8ff'], hp: 32, atk: 7, moves: ['atk', 'atk', 'heavy'] },
      { name: 'Boule de poils', body: 'blob', pal: ['#f2f2f2', '#b9c3cf', '#ffffff'], hp: 44, atk: 6, moves: ['atk', 'heal'] },
      { name: 'Canonnier gobelin', ranged: true, body: 'golem', pal: ['#d88a4f', '#9a5a2d', '#ffc79e'], hp: 58, atk: 8, moves: ['atk', 'guard', 'heavy'] },
      { name: 'Ogre cogneur', body: 'golem', pal: ['#e05050', '#962d2d', '#ff9e9e'], hp: 80, atk: 9, moves: ['atk', 'heavy', 'enrage'], elite: true },
    ],
    boss: { name: 'Roi Gobelin', title: 'Tyran de la Vallée', body: 'humanoid', pal: ['#e0b040', '#9a6a1a', '#fff0a0'], hp: 190, atk: 13, moves: ['heavy', 'atk', 'enrage'] },
  },
  {
    id: 1, name: 'Jungle Grondante', sub: 'Ça grouille dans les buissons…', bg: 'jungle',
    sky: ['#1f4a3a', '#4d8a62'], ground: ['#2f5a2a', '#244a20'],
    monsters: [
      { name: 'Piaf vorace', body: 'bird', pal: ['#d84f4f', '#8a2d2d', '#ffb08a'], hp: 62, atk: 10, moves: ['multi', 'atk'] },
      { name: 'Crapaud gluant', body: 'blob', pal: ['#6fae3a', '#3d6a1f', '#c2e88a'], hp: 80, atk: 10, moves: ['poison', 'atk'] },
      { name: 'Loup des ombres', body: 'beast', pal: ['#5a5f78', '#363a4f', '#a3a9c8'], hp: 74, atk: 12, moves: ['atk', 'multi', 'heavy'] },
      { name: 'Golem moussu', body: 'golem', pal: ['#8a7a64', '#5a4d3c', '#c8b89c'], hp: 100, atk: 11, moves: ['guard', 'heavy', 'atk'] },
      { name: 'Gardien de pierre bleue', body: 'golem', pal: ['#3a7ad8', '#24508f', '#8ac2ff'], hp: 112, atk: 12, moves: ['atk', 'heal', 'heavy'], elite: true },
    ],
    boss: { name: 'Ronce-Brûlante', title: 'Seigneur de la Jungle', body: 'golem', pal: ['#c83a2a', '#7a1f16', '#ff9a5a'], hp: 230, atk: 15, moves: ['burn', 'atk', 'heavy', 'enrage'] },
  },
  {
    id: 2, name: 'Rivière Scintillante', sub: 'Attention à ne pas glisser.', bg: 'river',
    sky: ['#2a5a8a', '#7ac2e0'], ground: ['#3a8aa8', '#2a6a88'],
    monsters: [
      { name: 'Crabe trotteur', body: 'crab', pal: ['#4fb8a8', '#2d7a70', '#a8f0e0'], hp: 105, atk: 13, moves: ['guard', 'atk'] },
      { name: 'Gloop des eaux', body: 'blob', pal: ['#3a8ad8', '#2456a0', '#9ad0ff'], hp: 112, atk: 13, moves: ['poison', 'heal', 'atk'] },
      { name: 'Mouette pirate', body: 'bird', pal: ['#e0a83a', '#9a6a1f', '#ffe08a'], hp: 100, atk: 15, moves: ['multi', 'multi', 'heavy'] },
      { name: 'Crabe géant', body: 'crab', pal: ['#d86a3a', '#8a3f1f', '#ffb08a'], hp: 140, atk: 14, moves: ['guard', 'heavy', 'atk'] },
      { name: 'Ombre aquatique', f: true, ranged: true, body: 'ghost', pal: ['#3ad8c8', '#1f8a80', '#b0fff5'], hp: 130, atk: 16, moves: ['drain', 'atk', 'heavy'], elite: true },
    ],
    boss: { name: 'Léviathan pourpre', title: 'Terreur de la rivière', body: 'beast', pal: ['#8a3ad8', '#541f8a', '#d0a0ff'], hp: 340, atk: 18, moves: ['heavy', 'atk', 'guard', 'enrage', 'multi'] },
  },
  {
    id: 3, name: 'Pics Gelés', sub: 'Le froid mord, les yétis aussi.', bg: 'ice',
    sky: ['#4a6a9a', '#c8e0f5'], ground: ['#d8eaf8', '#a8c8e8'],
    monsters: [
      { name: 'Boule de neige vivante', body: 'blob', pal: ['#e8f0ff', '#a8b8d8', '#ffffff'], hp: 145, atk: 16, moves: ['atk', 'heal', 'multi'] },
      { name: 'Yéti des glaces', body: 'beast', pal: ['#c8d8f0', '#8aa0c8', '#ffffff'], hp: 170, atk: 18, moves: ['heavy', 'atk', 'guard'] },
      { name: 'Esprit du givre', ranged: true, body: 'ghost', pal: ['#8ad0ff', '#4a8ad8', '#e0f5ff'], hp: 150, atk: 19, moves: ['drain', 'atk'] },
      { name: 'Golem de glace', body: 'golem', pal: ['#6ab8e8', '#3a78a8', '#c8f0ff'], hp: 200, atk: 17, moves: ['guard', 'heavy', 'atk'] },
      { name: 'Chevalier de givre', body: 'humanoid', pal: ['#5a7ab8', '#344c80', '#a8c0f0'], hp: 190, atk: 20, moves: ['atk', 'heavy', 'enrage'], elite: true },
    ],
    boss: { name: 'Cryophénix', title: 'Ailes de l\'hiver éternel', body: 'bird', pal: ['#5ab8ff', '#2a6ad8', '#e0f8ff'], hp: 460, atk: 22, moves: ['multi', 'heavy', 'heal', 'atk', 'guard'] },
  },
  {
    id: 4, name: 'Marais Hanté', sub: 'La brume noire dévore tout.', bg: 'shadow',
    sky: ['#14262a', '#2f5a52'], ground: ['#1f3a36', '#142a26'],
    monsters: [
      { name: 'Âme errante', ranged: true, body: 'ghost', pal: ['#5ae8b8', '#2a9a78', '#c0ffe8'], hp: 190, atk: 21, moves: ['drain', 'atk'] },
      { name: 'Squelette maudit', body: 'humanoid', pal: ['#d8d0b8', '#9a907a', '#fffaf0'], hp: 215, atk: 22, moves: ['atk', 'heavy', 'multi'] },
      { name: 'Araignée de brume', body: 'crab', pal: ['#3a4a48', '#1f2a28', '#7ae8b8'], hp: 205, atk: 23, moves: ['poison', 'multi', 'atk'] },
      { name: 'Revenant', body: 'ghost', pal: ['#8ab8a8', '#4a7a6a', '#d8fff0'], hp: 230, atk: 22, moves: ['drain', 'guard', 'heavy'] },
      { name: 'Chevalier déchu', body: 'humanoid', pal: ['#3a5a58', '#1f3836', '#7affd0'], hp: 260, atk: 25, moves: ['heavy', 'enrage', 'atk'], elite: true },
    ],
    boss: { name: 'Geôlier spectral', title: 'Collectionneur d\'âmes', body: 'ghost', pal: ['#3ae898', '#1f8a58', '#c8ffe0'], hp: 600, atk: 27, moves: ['drain', 'heavy', 'poison', 'guard', 'enrage'] },
  },
  {
    id: 5, name: 'Le Néant', sub: 'Au-delà, il n\'y a que la faim.', bg: 'void',
    sky: ['#1a0a2a', '#4a1a6a'], ground: ['#2a1040', '#1a0828'],
    monsters: [
      { name: 'Larve du Néant', body: 'worm', pal: ['#a83ad8', '#62208a', '#f0a0ff'], hp: 250, atk: 26, moves: ['multi', 'atk'] },
      { name: 'Rôdeur abyssal', body: 'beast', pal: ['#6a2ad8', '#3a148a', '#c0a0ff'], hp: 280, atk: 28, moves: ['heavy', 'atk', 'multi'] },
      { name: 'Œil du Néant', ranged: true, body: 'blob', pal: ['#d83aa8', '#8a1f6a', '#ffa0e0'], hp: 265, atk: 29, moves: ['drain', 'poison', 'atk'] },
      { name: 'Scarabée du Néant', body: 'crab', pal: ['#4a3ad8', '#2a1f8a', '#a8a0ff'], hp: 310, atk: 27, moves: ['guard', 'heavy', 'atk'] },
      { name: 'Dévoreur affamé', body: 'worm', pal: ['#d83a6a', '#8a1f3a', '#ffa0c0'], hp: 340, atk: 31, moves: ['heavy', 'enrage', 'drain'], elite: true },
    ],
    boss: { name: 'Ver-Roi du Néant', title: 'Celui qui dévore les mondes', body: 'worm', pal: ['#8a2ad8', '#4a1478', '#e8a0ff'], hp: 820, atk: 33, moves: ['heavy', 'poison', 'multi', 'enrage', 'guard', 'drain'] },
  },
];

export const MONSTER_COUNT = ZONES.reduce((n, z) => n + z.monsters.length, 0); // 30
export const BOSS_COUNT = ZONES.filter(z => z.boss).length; // 5

// ---------- Expédition en 3 niveaux, giga boss ----------
// Une expédition = EXPE_LEVELS niveaux : le monde choisi, puis le monde suivant (s'il n'existe pas ou a déjà été visité :
// un autre monde débloqué pas encore visité), chacun nettement plus dur (réglages LEVELS et GB en haut de run.js).
// Le dernier niveau se termine par le GIGA BOSS au lieu du boss du monde ; sa défaite = victoire de l'expédition.
export const EXPE_LEVELS = 3;
// pal : armure, ombre, magma (yeux, fissures, aura). PV et dégâts : relatifs au boss du monde (GB.hp, GB.dmg de run.js).
export const GIGA = { name: 'Gorgoth', title: 'Roi des Bonks', body: 'golem', pal: ['#5a5470', '#2a2638', '#ff8a2a'], hp: 1000, atk: 36,
  moves: ['heavy', 'enrage', 'guard', 'multi'], giga: true };
// formes 3D du giga boss, une par phase (armure intacte, armure brisée et fissures de magma, embrasé) : le rendu prend
// e.mdl (posé par giga.js au changement de phase) ; les modèles sont dans js/g3d/models-bosses.js
export const GIGA_FORMS = [GIGA, { ...GIGA, name: GIGA.name + ':2' }, { ...GIGA, name: GIGA.name + ':3' }];

// Familiers : obtenus en battant les boss. Agissent chaque tour.
export const PETS = {
  poro:   { name: 'Pompon', desc: 'Vous soigne de 1,5 % des PV toutes les 4 s.', pal: ['#f2f2f2', '#b9c3cf', '#ffffff'], body: 'blob', zone: 0 },
  brambi: { name: 'Ronchou', desc: 'Brûle les ennemis qui vous touchent.', pal: ['#c83a2a', '#7a1f16', '#ff9a5a'], body: 'golem', zone: 1 },
  herald: { name: 'Mini Léviathan', desc: 'Tire sur les ennemis proches.', pal: ['#8a3ad8', '#541f8a', '#d0a0ff'], body: 'beast', zone: 2 },
  phenix: { name: 'Phénixounet', desc: 'Attire l\'expérience de plus loin (+40 %).', pal: ['#5ab8ff', '#2a6ad8', '#e0f8ff'], body: 'bird', zone: 3 },
  wisp:   { name: 'Lanterne', desc: 'Bloque un coup toutes les 12 s.', pal: ['#3ae898', '#1f8a58', '#c8ffe0'], body: 'ghost', zone: 4 },
  voidy:  { name: 'Ver Jr', desc: 'Votre ultime se charge 2× plus vite.', pal: ['#8a2ad8', '#4a1478', '#e8a0ff'], body: 'worm', zone: 5 },
};
// zone d'obtention = boss de la zone
export const PET_BY_ZONE = ['poro', 'brambi', 'herald', 'phenix', 'wisp', 'voidy'];

// Équipement : 3 emplacements
export const SLOTS = { weapon: 'Arme', armor: 'Armure', trinket: 'Bijou' };
export const RARITY = {
  common:    { name: 'Commun',     color: '#9aa4b2', mult: 1 },
  rare:      { name: 'Rare',       color: '#3b8cff', mult: 1.6 },
  epic:      { name: 'Épique',     color: '#a855f7', mult: 2.4 },
  legendary: { name: 'Légendaire', color: '#f59e0b', mult: 3.4 },
};

// Modèles d'objets : main = caractéristique principale (arme : ATQ, armure : PV, bijou : au choix),
// aff = bonus fétiche, toujours présent (il donne son caractère à l'objet). Les autres bonus sont tirés dans AFFIX_POOLS.
export const ITEM_BASES = {
  weapon: [
    { name: 'Épée longue', icon: 'sword', main: 'atk', aff: 'critDmg' },
    { name: 'Grimoire runique', icon: 'tome', main: 'atk', aff: 'area' },
    { name: 'Arc courbé', icon: 'bow', main: 'atk', aff: 'crit' },
    { name: 'Lame du voyageur', icon: 'sword', main: 'atk', aff: 'lifesteal' },
    { name: 'Bâton de foudre', icon: 'staff', main: 'atk', aff: 'haste' },
  ],
  armor: [
    { name: 'Cotte de mailles', icon: 'armor', main: 'hp', aff: 'armor' },
    { name: 'Cape de brume', icon: 'cloak', main: 'hp', aff: 'dodge' },
    { name: 'Gilet d\'épines', icon: 'armor', main: 'hp', aff: 'thorns' },
    { name: 'Plastron du géant', icon: 'armor', main: 'hp', aff: 'regen' },
  ],
  trinket: [
    { name: 'Larme de fée', icon: 'gem', main: 'regen', aff: 'xp' },
    { name: 'Gant de cogneur', icon: 'glove', main: 'crit', aff: 'haste' },
    { name: 'Anneau du voyageur', icon: 'ring', main: 'atk', aff: 'gold' },
    { name: 'Talisman ancien', icon: 'gem', main: 'hp', aff: 'ult' },
  ],
};

// Objets légendaires uniques donnés par les boss (première victoire) : bonus choisis et effet unique fixés
export const BOSS_ITEMS = [
  { slot: 'trinket', name: 'Couronne du Roi Gobelin', icon: 'crown', main: 'atk', affs: ['gold', 'lifesteal', 'crit', 'xp'], effect: 'feast' },
  { slot: 'weapon', name: 'Lame de Ronce-Brûlante', icon: 'sword', main: 'atk', affs: ['critDmg', 'crit', 'lifesteal', 'area'], effect: 'boom' },
  { slot: 'armor', name: 'Carapace du Léviathan', icon: 'armor', main: 'hp', affs: ['regen', 'armor', 'dodge', 'speed'], effect: 'bubble' },
  { slot: 'trinket', name: 'Plume de Cryophénix', icon: 'gem', main: 'crit', affs: ['haste', 'speed', 'ult', 'magnet'], effect: 'frost' },
  { slot: 'weapon', name: 'Faux du Geôlier', icon: 'staff', main: 'atk', affs: ['lifesteal', 'haste', 'critDmg', 'area'], effect: 'blood' },
  { slot: 'armor', name: 'Écailles du Ver-Roi', icon: 'armor', main: 'hp', affs: ['armor', 'thorns', 'regen', 'dodge'], effect: 'fury' },
];

// Améliorations permanentes (boutique, payées en or). inf : à l'infini — au-delà de max, chaque niveau coûte 12 % du coût
// du niveau max de plus (les caractéristiques plafonnées, critique, vitesse et vol de vie, gardent leur maximum).
export const upgMax = k => (UPGRADES[k]?.inf ? Infinity : UPGRADES[k]?.max ?? 0);
export const UPGRADES = {
  hp:     { name: 'Vitalité', icon: 'heart', desc: '+8 PV max', per: { hp: 8 }, base: 40, grow: 1.32, max: 20, inf: true },
  atk:    { name: 'Puissance', icon: 'fist', desc: '+2 dégâts', per: { atk: 2 }, base: 50, grow: 1.35, max: 20, inf: true },
  crit:   { name: 'Précision', icon: 'target', desc: '+2 % de critique', per: { crit: 0.02 }, base: 60, grow: 1.42, max: 10 },
  regen:  { name: 'Régénération', icon: 'potion', desc: '+0,1 PV par seconde', per: { regen: 1 }, base: 60, grow: 1.42, max: 10, inf: true },
  speed:  { name: 'Agilité', icon: 'arrow', desc: '+4 % de vitesse', per: { speed: 0.04 }, base: 70, grow: 1.45, max: 8 },
  magnet: { name: 'Attraction', icon: 'ring', desc: '+12 % de rayon de ramassage', per: { magnet: 0.12 }, base: 50, grow: 1.4, max: 8, inf: true },
  luck:   { name: 'Fortune', icon: 'gold', desc: '+10 % d\'or gagné', per: { gold: 0.1 }, base: 80, grow: 1.5, max: 10, inf: true },
  vamp:   { name: 'Soif de sang', icon: 'lifesteal', desc: '+0,5 % de vol de vie', per: { lifesteal: 0.005 }, base: 120, grow: 1.5, max: 10 },
};

export const ACHIEVEMENTS = [
  { id: 'first_win', name: 'Premier sang', desc: 'Vaincre 1 monstre.', gold: 20 },
  { id: 'kills1000', name: 'Massacre', desc: 'Vaincre 1 000 monstres au total.', gold: 80 },
  { id: 'zone1', name: 'Hors de la vallée', desc: 'Terminer la Vallée des Gobelins.', gold: 50 },
  { id: 'boss1', name: 'Chasseur', desc: 'Vaincre un boss.', gold: 80 },
  { id: 'allclass', name: 'Polyvalent', desc: 'Terminer une partie avec chaque champion.', gold: 100 },
  { id: 'rich', name: 'Fortune de pirate', desc: 'Posséder 1 000 or.', gold: 100 },
  { id: 'epic', name: 'Collectionneur', desc: 'Obtenir un objet épique.', gold: 60 },
  { id: 'pets3', name: 'Ménagerie', desc: 'Posséder 3 familiers.', gold: 120 },
  { id: 'ult20', name: 'Déluge de pouvoir', desc: 'Lancer 20 ultimes.', gold: 80 },
  { id: 'lvl20', name: 'Niveau 20', desc: 'Atteindre le niveau 20 dans une partie.', gold: 80 },
  { id: 'nodeath', name: 'Intouchable', desc: 'Terminer une zone sans revivre.', gold: 100 },
  { id: 'baron', name: 'Dévoreur dévoré', desc: 'Vaincre le Ver-Roi du Néant.', gold: 500 },
  { id: 'hard1', name: 'Sueurs froides', desc: 'Terminer une zone en Difficile.', gold: 150 },
  { id: 'nightmare1', name: 'Cauchemar éveillé', desc: 'Terminer une zone en Cauchemar.', gold: 300 },
  { id: 'portal1', name: 'Au-delà du portail', desc: 'Franchir un portail après avoir vaincu un boss.', gold: 80 },
  { id: 'stage3', name: 'Grand voyageur', desc: 'Atteindre le niveau 3 d\'une expédition.', gold: 250 },
  { id: 'world6', name: 'Expédition légendaire', desc: 'Vaincre le giga boss au bout d\'une expédition.', gold: 1500 },
  { id: 'totems10', name: 'Tête brûlée', desc: 'Activer 10 totems de défi.', gold: 150 },
  { id: 'forge1', name: 'Forgeron', desc: 'Fabriquer un objet à la forge.', gold: 60 },
  { id: 'upgrade5', name: 'Chef-d\'œuvre', desc: 'Améliorer un objet jusqu\'à +5.', gold: 200 },
  { id: 'mythic', name: 'Trésor mythique', desc: 'Ouvrir un coffre mythique.', gold: 150 },
  { id: 'chests50', name: 'Pilleur de coffres', desc: 'Ouvrir 50 coffres de butin.', gold: 200 },
  { id: 'quests10', name: 'Toujours partant', desc: 'Réclamer 10 quêtes du jour.', gold: 150 },
  { id: 'login7', name: 'Fidèle au poste', desc: 'Réclamer 7 récompenses de connexion.', gold: 200 },
];

// ---------- Expédition : mondes enchaînés, totems de défi, butin, forge, bonus ----------
// Une partie traverse jusqu'à 3 niveaux (EXPE_LEVELS) : battre le boss d'un monde ouvre un portail vers le niveau suivant
// (monde suivant, plus difficile) ; le niveau 3 se termine par le giga boss.
// Quand le chrono d'un monde est écoulé, les monstres deviennent fous (de plus en plus).

// Totems de défi posés dans chaque monde : les activer rend la partie plus dure mais rapporte tout de suite.
export const TOTEMS = {
  horde:  { name: 'Totem de la Horde', icon: 'skull', color: '#ff8a3a', curse: '+35 % de monstres dans ce monde', reward: 'De l\'or tout de suite, et +25 % d\'or dans ce monde' },
  fureur: { name: 'Totem de Fureur', icon: 'i_enrage', color: '#ff3a5a', curse: 'Monstres +25 % dégâts et +12 % vitesse dans ce monde', reward: 'Un coffre de butin en argent (ou mieux)' },
  elite:  { name: 'Totem des Champions', icon: 'crown', color: '#c06aff', curse: 'Un élite surgit, puis les élites arrivent 2 fois plus souvent', reward: 'Une bénédiction au choix' },
  maudit: { name: 'Totem maudit', icon: 'i_poison', color: '#5ae8b8', curse: 'Monstres +20 % PV jusqu\'à la fin de la partie', reward: 'Une amélioration gratuite et des coffres de butin de meilleure qualité' },
};

// Coffres de butin : ramassés pendant la partie, ouverts après. Index = rang (0 bois … 3 mythique).
// parts = [min, max] pièces d'équipement ; rar = chances commun/rare/épique/légendaire de chaque pièce ;
// boost = chance d'un bonus ; item = chance d'un objet complet ; gold = [min, max] or (× (1 + 0,4 × zone)).
export const LOOT_TIERS = [
  { id: 'wood',   name: 'Coffre en bois',   color: '#c8874a', parts: [2, 3], rar: [0.85, 0.15, 0, 0],       boost: 0.25, item: 0,    gold: [10, 25] },
  { id: 'silver', name: 'Coffre en argent', color: '#d0dcf0', parts: [3, 4], rar: [0.5, 0.42, 0.08, 0],     boost: 0.45, item: 0.2,  gold: [30, 60] },
  { id: 'gold',   name: 'Coffre en or',     color: '#ffcf40', parts: [4, 5], rar: [0.15, 0.45, 0.33, 0.07], boost: 0.75, item: 0.35, gold: [80, 150] },
  { id: 'mythic', name: 'Coffre mythique',  color: '#ff6ad8', parts: [5, 6], rar: [0, 0.2, 0.5, 0.3],       boost: 1,    item: 0.6,  gold: [200, 320] },
];

// Pièces d'équipement (une sorte par emplacement), rangées par rareté : servent à fabriquer et améliorer à la forge.
export const RARITIES = ['common', 'rare', 'epic', 'legendary'];
export const PARTS = {
  weapon:  { name: 'Fragment de lame', plural: 'Fragments de lame', icon: 'sword' },
  armor:   { name: 'Plaque d\'armure', plural: 'Plaques d\'armure', icon: 'armor' },
  trinket: { name: 'Éclat de gemme', plural: 'Éclats de gemme', icon: 'gem' },
};
// craft : pièces + or pour fabriquer un objet de cette rareté ; fuse : pièces pour 1 pièce de la rareté au-dessus ;
// upgrade : améliorer un objet (+12 % de stats par niveau, 5 niveaux), payé en pièces de sa rareté et en or.
export const FORGE = {
  craft: { parts: 5, gold: [40, 120, 320, 800] },
  fuse: 4,
  upgrade: { max: 5, per: 0.12, parts: [2, 2, 3, 3, 4], gold: [30, 60, 110, 180, 280] },
  salvage: [2, 2, 3, 3],
};

// Bonus : consommables choisis avant une partie (2 au maximum), trouvés dans les coffres de butin ou achetés.
export const BOOST_SLOTS = 2;
export const BOOSTS = {
  vigueur: { name: 'Potion de vigueur', icon: 'potion', desc: '+25 % PV max pendant la partie', price: 120 },
  rage:    { name: 'Élixir de rage', icon: 'fist', desc: '+20 % de dégâts pendant la partie', price: 150 },
  sagesse: { name: 'Parchemin de sagesse', icon: 'tome', desc: '+30 % d\'expérience pendant la partie', price: 120 },
  fortune: { name: 'Bourse de fortune', icon: 'gold', desc: '+40 % d\'or et +30 % de rayon de ramassage', price: 100 },
  egide:   { name: 'Égide', icon: 'shield', desc: 'Bloque les 3 premiers coups reçus', price: 140 },
  depart:  { name: 'Départ éclair', icon: 'star', desc: 'Commence la partie au niveau 4', price: 180 },
  phenix:  { name: 'Plume de phénix', icon: 'heart', desc: 'Revient une fois à la vie, sans publicité', price: 250 },
  trefle:  { name: 'Trèfle à quatre feuilles', icon: 'crown', desc: 'Les coffres de butin trouvés sont de meilleure qualité', price: 160 },
  sang:    { name: 'Fiole de sang', icon: 'lifesteal', desc: '+8 % de vol de vie pendant la partie', price: 140 },
};

// Bilan d'une expédition : +10 % d'or par totem de défi activé.
export const HEAT_GOLD = 0.1;

// Anciens noms (avant le changement d'univers) -> nouveaux : pour mettre à jour les vieilles sauvegardes
export const RENAMED = {
  'Sbire mêlée': 'Gobelin bagarreur',
  'Sbire lanceur': 'Gobelin lanceur',
  'Porolet': 'Boule de poils',
  'Sbire canon': 'Canonnier gobelin',
  'Super Sbire': 'Ogre cogneur',
  'Sbire Titan': 'Roi Gobelin',
  'Raptix': 'Piaf vorace',
  'Grompf': 'Crapaud gluant',
  'Loup murmure': 'Loup des ombres',
  'Krog ancien': 'Golem moussu',
  'Sentinelle bleue': 'Gardien de pierre bleue',
  'Brambleback Rouge': 'Ronce-Brûlante',
  'Crabe scuttle': 'Crabe trotteur',
  'Raptix des rives': 'Mouette pirate',
  'Héraut de la Faille': 'Léviathan pourpre',
  'Poro sauvage': 'Boule de neige vivante',
  'Gardien du pont': 'Chevalier de givre',
  'Anivale': 'Cryophénix',
  'Thrash': 'Geôlier spectral',
  'Larve du Vide': 'Larve du Néant',
  'Œil du Vide': 'Œil du Néant',
  'Héraut affamé': 'Dévoreur affamé',
  'Baron Nashar': 'Ver-Roi du Néant',
  "Tome d'amplification": 'Grimoire runique',
  'Lame de Doran': 'Lame du voyageur',
  'Bâton du néant': 'Bâton de foudre',
  'Cape de négation': 'Cape de brume',
  'Plastron de Warmog': 'Plastron du géant',
  'Larme de la déesse': 'Larme de fée',
  'Anneau de Doran': 'Anneau du voyageur',
  'Bannière du Titan': 'Couronne du Roi Gobelin',
  'Lame du Brambleback': 'Lame de Ronce-Brûlante',
  'Carapace du Héraut': 'Carapace du Léviathan',
  'Faux de Thrash': 'Faux du Geôlier',
  'Écailles du Baron': 'Écailles du Ver-Roi',
};

// ---------- Caractéristiques des objets (demande du joueur : « des améliorations, du vol de vie… ») ----------
// Chaque objet a sa caractéristique principale (arme : ATQ, armure : PV, bijou : au choix) plus des bonus tirés au
// hasard : 1 (commun) à 4 (légendaire). roll = valeur par rareté [commun, rare, épique, légendaire] avant le bonus de zone.
// fmt : 'flat' (+12), 'pct' (+5 %), 'regen' (+0,3 PV/s, unités de 0,1). max = plafond total une fois tout additionné.
export const AFFIXES = {
  atk:       { name: 'Dégâts', fmt: 'flat', roll: [3, 6, 10, 16] },
  hp:        { name: 'PV max', fmt: 'flat', roll: [12, 24, 40, 64] },
  crit:      { name: 'Chance de critique', fmt: 'pct', roll: [0.03, 0.05, 0.08, 0.12], max: 0.75 },
  critDmg:   { name: 'Dégâts critiques', fmt: 'pct', roll: [0.15, 0.25, 0.4, 0.6] },
  lifesteal: { name: 'Vol de vie', fmt: 'pct', roll: [0.01, 0.02, 0.035, 0.05], max: 0.15 },
  haste:     { name: 'Vitesse d\'attaque', fmt: 'pct', roll: [0.04, 0.07, 0.1, 0.15], max: 0.6 },
  speed:     { name: 'Vitesse de course', fmt: 'pct', roll: [0.03, 0.05, 0.08, 0.12], max: 0.5 },
  area:      { name: 'Taille des attaques', fmt: 'pct', roll: [0.05, 0.08, 0.12, 0.18] },
  armor:     { name: 'Armure', fmt: 'pct', roll: [0.02, 0.04, 0.06, 0.09], max: 0.5 },
  regen:     { name: 'Régénération', fmt: 'regen', roll: [1, 2, 3, 5] },
  thorns:    { name: 'Épines', fmt: 'pct', roll: [0.3, 0.5, 0.8, 1.2] },
  dodge:     { name: 'Esquive', fmt: 'pct', roll: [0.02, 0.03, 0.05, 0.07], max: 0.3 },
  xp:        { name: 'Expérience', fmt: 'pct', roll: [0.05, 0.08, 0.12, 0.18] },
  magnet:    { name: 'Ramassage', fmt: 'pct', roll: [0.1, 0.15, 0.22, 0.3] },
  gold:      { name: 'Or gagné', fmt: 'pct', roll: [0.05, 0.08, 0.12, 0.18] },
  ult:       { name: 'Charge de l\'ultime', fmt: 'pct', roll: [0.08, 0.12, 0.18, 0.25] },
};
// bonus possibles selon l'emplacement (la caractéristique principale est à part)
export const AFFIX_POOLS = {
  weapon:  ['crit', 'critDmg', 'lifesteal', 'haste', 'area', 'atk'],
  armor:   ['armor', 'regen', 'thorns', 'dodge', 'hp', 'speed'],
  trinket: ['lifesteal', 'xp', 'magnet', 'gold', 'ult', 'crit', 'speed', 'haste'],
};
// Effets uniques des objets légendaires (un au hasard par légendaire), appliqués pendant la partie.
export const LEGEND_EFFECTS = {
  boom:    { name: 'Explosion', desc: '20 % de chances qu\'un ennemi vaincu explose et blesse ses voisins' },
  chain:   { name: 'Foudre en chaîne', desc: 'Un coup sur 8 déclenche un éclair qui rebondit sur 3 ennemis' },
  frost:   { name: 'Gel', desc: '8 % de chances de geler un ennemi touché pendant 1 s' },
  feast:   { name: 'Festin', desc: 'Chaque ennemi vaincu rend 0,5 % de vos PV max' },
  bubble:  { name: 'Bulle', desc: 'Un bouclier bloque un coup toutes les 10 s' },
  fury:    { name: 'Furie', desc: '+30 % de dégâts quand vous avez moins de 40 % de PV' },
  blood:   { name: 'Frénésie sanglante', desc: 'Sous 50 % de PV, votre vol de vie est doublé (au moins +4 %)' },
};

// ---------- Contenu des coffres de butin (en plus de LOOT_TIERS) ----------
// items = objets garantis, extra = chance d'un objet de plus, rar = chances commun/rare/épique/légendaire des objets,
// upg = chance d'un niveau gratuit d'amélioration permanente (Boutique).
export const CHEST_LOOT = [
  { items: 0, extra: 0.7, rar: [0.62, 0.33, 0.05, 0],   upg: 0.04 },
  { items: 1, extra: 0.3, rar: [0.25, 0.5, 0.22, 0.03], upg: 0.1 },
  { items: 1, extra: 0.6, rar: [0, 0.4, 0.45, 0.15],    upg: 0.22 },
  { items: 2, extra: 0.5, rar: [0, 0, 0.55, 0.45],      upg: 0.45 },
];


// ===== L2 : Déblocages, Abysse, maîtrise =====
// Clés de save.unlocks : 'w:<arme>', 't:<tome>', 'boost:<bonus>', 'cls:<champion>', 'aura:<id>', 'title:<id>', 'abyss'.
// Seuls les éléments listés ici sont verrouillés au départ (une arme ajoutée plus tard est libre) ; l'arme de départ d'un
// champion lui reste toujours ouverte. Champions : CLASSES[id].locked (+ clé 'cls:<id>'), les 3 de base toujours libres.
// Nouveau joueur : 8 armes sur 11 (sans champignons, nova de givre, boule de neige), 8 tomes sur 10 (sans bottes ni
// sagesse), 5 bonus sur 9 en Boutique, les 3 champions de base. Pourquoi pas moins : un tirage plus petit concentre les
// montées de niveau (armes au niveau 5, évolutions) et rend le Normal trop facile. Simulateur (bot qui prend la 1re carte,
// 24 parties, monde 1 → 2, Normal) : tout débloqué (= avant) 79 % / 29 % (88 % / 56 % avec 18 parties d'avant L2) ;
// 6 armes et 7 tomes libres 100 % / 100 % (2,2 évolutions par partie) ; 8 et 8 (retenu) 88 % / 63 % (1,5 évolution).
export const LOCKED = {
  w: ['shrooms', 'frost', 'snowball', 'scythe'],                  // faux sanglante : arme de Nyx seulement (aucun défi)
  t: ['boots', 'wisdom'],
  boost: ['trefle', 'depart', 'phenix', 'sang'],                 // libres en Boutique : vigueur, rage, sagesse, fortune, égide
};

// Auras de la forme ultime (cosmétiques, choisies sur l'écran des champions) : remplacent la couleur de l'aura du dernier
// stade. Les auras de champion ('m_<champion>', niveau 3 du champion) prennent la couleur de MASTERY.aura.
export const AURAS = {
  prism:  { name: 'Prisme', color: '#ff6ad8' },
  astral: { name: 'Astrale', color: '#8a7aff' },
  frost:  { name: 'Blizzard', color: '#8ae8ff' },
  ember:  { name: 'Braise', color: '#ff7a2a' },
  storm:  { name: 'Tempête', color: '#d8ff4a' },
  blood:  { name: 'Sang', color: '#ff2a4a' },
  jade:   { name: 'Jade', color: '#3ae8a0' },
  abyss:  { name: 'Abysse', color: '#4a6aff' },
  orbit:  { name: 'Orbite', color: '#b07aff' },
  steel:  { name: 'Acier', color: '#d8e4f0' },
  sun:    { name: 'Soleil', color: '#ffb030' },
  shadow: { name: 'Ombre', color: '#7a5ac8' },
  void:   { name: 'Néant', color: '#c03aff' },
  white:  { name: 'Lumière pure', color: '#ffffff' },
  gold:   { name: 'Or royal', color: '#ffe066' },
  magma:  { name: 'Magma', color: '#ff5a1a' },   // giga boss vaincu
  laser:  { name: 'Rayon', color: '#ff3a8a' },   // giga boss vaincu sans toucher son double rayon
};
// Titres donnés par les défis (clés 'title:<id>') ; ceux du niveau 7 du champion ('m_<champion>') : « Âme de <nom> ».
// La Saison (L1) les liste s'ils figurent dans sa table TITLES (ou lit ce tableau).
export const UNLOCK_TITLES = {
  armurier: 'Maître armurier', disciple: 'Disciple', ouragan: 'Ouragan', titan: 'Titan', abyssal: 'Abyssal', seigneur: 'Seigneur de l\'Abysse',
  regicide: 'Régicide', fleau_rois: 'Fléau des rois',
};

// Défis : prog(save) = progression, n = objectif, rw = récompense (key / keys : déblocages, gold : or, chest : rang d'un
// coffre de butin). need = champion requis (défi masqué si CLASSES ne le contient pas). Records des parties dans save.rec
// (unlocks.js, d'après run.track) : wk victimes par arme, lvl meilleur niveau par champion, combo, evoRun (évolutions
// d'armes dans une partie), elites, heal (PV rendus par le vol de vie), bossFast (combat de boss le plus court, s),
// totemBoss (boss battu après les 3 totems de son monde).
export const CHALLENGE_CATS = [
  { id: 'start', name: 'Premiers pas' }, { id: 'weapons', name: 'Armes' }, { id: 'champions', name: 'Champions' },
  { id: 'feats', name: 'Exploits' }, { id: 'abyss', name: 'Abysse' }, { id: 'giga', name: 'Giga boss' },
];
const st_ = k => s => +s.stats?.[k] || 0, rec_ = k => s => +s.rec?.[k] || 0;
const wk_ = id => s => +s.rec?.wk?.[id] || 0, lvl_ = c => s => +s.rec?.lvl?.[c] || 0;
const abyssMax_ = s => Math.max(0, ...(s.abyss || []).map(n => +n || 0));
export const UNLOCK_CHALLENGES = [
  // ---- premiers pas (premier jour) ----
  { id: 'kills1k', cat: 'start', icon: 'skull', name: 'Chasseur de monstres', txt: 'Battez 1 000 monstres', n: 1000, prog: st_('kills'), rw: { key: 't:boots', gold: 60 } },
  { id: 'boss1', cat: 'start', icon: 'crown', name: 'Premier trophée', txt: 'Battez votre premier boss', n: 1, prog: st_('wins'), rw: { key: 'w:shrooms', gold: 80 } },
  { id: 'lvl15', cat: 'start', icon: 'upg', name: 'Montée en puissance', txt: 'Atteignez le niveau 15 dans une partie', n: 15, prog: st_('bestLevel'), rw: { key: 'boost:depart', gold: 60 } },
  { id: 'evo1', cat: 'start', icon: 'star', name: 'Alchimiste', txt: 'Faites évoluer une arme (niveau 5 + son tome)', n: 1, prog: st_('weaponEvos'), rw: { key: 't:wisdom', gold: 100 } },
  { id: 'chests5', cat: 'start', icon: 'chest', name: 'Pilleur', txt: 'Ouvrez 5 coffres de butin', n: 5, prog: st_('chests'), rw: { key: 'boost:trefle', gold: 80 } },
  { id: 'portal1', cat: 'start', icon: 'portal', name: 'Voyageur', txt: 'Franchissez un portail vers le monde suivant', n: 1, prog: st_('portals'), rw: { key: 'boost:sang', gold: 100 } },
  { id: 'world2', cat: 'start', icon: 'map', name: 'Au cœur de la jungle', txt: 'Terminez la Jungle Grondante', n: 1, prog: s => (s.zoneCleared?.[1] ? 1 : 0), rw: { key: 'w:frost', gold: 150 } },
  // ---- armes : victimes cumulées avec une arme, évolutions ----
  { id: 'wk_lightning', cat: 'weapons', icon: 'i_stun', name: 'Maître des orages', txt: 'Battez 6 000 monstres avec la Foudre', n: 6000, prog: wk_('lightning'), rw: { key: 'w:snowball', gold: 150 } },
  { id: 'wk_orbs', cat: 'weapons', icon: 'bind', name: 'Gardien des orbes', txt: 'Battez 2 500 monstres avec les Orbes spirituels', n: 2500, prog: wk_('orbs'), rw: { key: 'aura:orbit', gold: 150 } },
  { id: 'wk_boomerang', cat: 'weapons', icon: 'spin', name: 'Retour à l\'envoyeur', txt: 'Battez 5 000 monstres avec la Lame ricochet', n: 5000, prog: wk_('boomerang'), rw: { key: 'aura:steel', gold: 150 } },
  { id: 'wk_aura', cat: 'weapons', icon: 'cloak', name: 'Cœur ardent', txt: 'Battez 3 000 monstres avec la Cape solaire', n: 3000, prog: wk_('aura'), rw: { key: 'aura:sun', gold: 150 } },
  { id: 'wk_daggers', cat: 'weapons', icon: 'volley', name: 'Mille entailles', txt: 'Battez 3 000 monstres avec les Dagues', n: 3000, prog: wk_('daggers'), rw: { key: 'aura:shadow', gold: 150 } },
  { id: 'evo3', cat: 'weapons', icon: 'star', name: 'Arsenal légendaire', txt: 'Faites évoluer 3 armes dans une même partie', n: 3, prog: rec_('evoRun'), rw: { key: 'aura:prism', chest: 2 } },
  { id: 'evos60', cat: 'weapons', icon: 'hammer', name: 'Maître armurier', txt: 'Faites évoluer 60 armes au total', n: 60, prog: st_('weaponEvos'), rw: { key: 'title:armurier', gold: 300 } },
  // ---- champions ----
  { id: 'lvl25_mage', cat: 'champions', icon: 'nova', name: 'Lumière éternelle', txt: 'Atteignez le niveau 25 avec Lumi', n: 25, prog: lvl_('mage'), rw: { key: 'aura:astral', gold: 200 } },
  { id: 'lvl25_archer', cat: 'champions', icon: 'crystal', name: 'Œil de faucon', txt: 'Atteignez le niveau 25 avec Kira', n: 25, prog: lvl_('archer'), rw: { key: 'aura:frost', gold: 200 } },
  { id: 'lvl25_knight', cat: 'champions', icon: 'justice', name: 'Rempart', txt: 'Atteignez le niveau 25 avec Brok', n: 25, prog: lvl_('knight'), rw: { key: 'aura:ember', gold: 200 } },
  { id: 'allcls', cat: 'champions', icon: 'user', name: 'Polyvalent', txt: 'Battez un boss avec Lumi, Kira et Brok', n: 3, prog: s => ['mage', 'archer', 'knight'].filter(c => s.stats?.classWins?.[c]).length, rw: { key: 'boost:phenix', gold: 200 } },
  { id: 'vampire', cat: 'champions', need: 'vampire', icon: 'lifesteal', name: 'Soif éternelle', txt: 'Rendez-vous 12 000 PV grâce au vol de vie', n: 12000, prog: rec_('heal'), rw: { key: 'cls:vampire', gold: 200 } },
  { id: 'assassin', cat: 'champions', need: 'assassin', icon: 'dodge', name: 'L\'ombre de la rivière', txt: 'Battez la Rivière Scintillante en Difficile', n: 1, prog: s => ((s.diffCleared?.[2] || 0) >= 2 ? 1 : 0), rw: { key: 'cls:assassin', gold: 200 } },
  // Ragnar, le berserker du Nord : il attend aux Pics Gelés (monde 4, vers le jour 4 au rythme visé)
  { id: 'berserker', cat: 'champions', need: 'berserker', icon: 'i_enrage', name: 'L\'appel du Nord', txt: 'Battez le boss des Pics Gelés', n: 1, prog: s => (s.zoneCleared?.[3] ? 1 : 0), rw: { key: 'cls:berserker', gold: 200 } },
  // Frida : la Nova de givre (débloquée par « Au cœur de la jungle ») ; Gaïa : la Jungle Grondante en Difficile
  { id: 'cryo', cat: 'champions', need: 'cryo', icon: 'frost', name: 'Cœur de glace', txt: 'Battez 2 500 monstres avec la Nova de givre', n: 2500, prog: wk_('frost'), rw: { key: 'cls:cryo', gold: 200 } },
  { id: 'druid', cat: 'champions', need: 'druid', icon: 'leaf', name: 'L\'appel de la forêt', txt: 'Battez la Jungle Grondante en Difficile', n: 1, prog: s => ((s.diffCleared?.[1] || 0) >= 2 ? 1 : 0), rw: { key: 'cls:druid', gold: 200 } },
  { id: 'mastery10', cat: 'champions', icon: 'medal', name: 'Disciple', txt: 'Atteignez le niveau 7 avec un champion', n: 7, prog: s => Math.max(1, ...Object.values(s.mastery || {}).map(x => masteryOf(x).lv)), rw: { key: 'title:disciple', chest: 2 } },
  { id: 'mastery20', cat: 'champions', icon: 'medal', name: 'Grand maître', txt: 'Atteignez le niveau 10 avec 3 champions', n: 3, prog: s => Object.values(s.mastery || {}).filter(x => masteryOf(x).lv >= MASTERY.max).length, rw: { key: 'aura:white', chest: 3 } },
  // ---- exploits ----
  { id: 'combo300', cat: 'feats', icon: 'bolt', name: 'Enchaînement', txt: 'Réussissez un combo de 300', n: 300, prog: rec_('combo'), rw: { gold: 120, chest: 1 } },
  { id: 'combo1000', cat: 'feats', icon: 'bolt', name: 'Tornade', txt: 'Réussissez un combo de 1 000', n: 1000, prog: rec_('combo'), rw: { key: 'aura:storm', gold: 200 } },
  { id: 'combo2500', cat: 'feats', icon: 'bolt', name: 'Ouragan', txt: 'Réussissez un combo de 2 500', n: 2500, prog: rec_('combo'), rw: { key: 'title:ouragan', chest: 3 } },
  { id: 'bossfast', cat: 'feats', icon: 'clock', name: 'Exécution', txt: 'Battez un boss en moins de 20 s de combat', n: 1, prog: s => (s.rec?.bossFast > 0 && s.rec.bossFast <= 20 ? 1 : 0), rw: { gold: 150, chest: 1 } },
  { id: 'totemboss', cat: 'feats', icon: 'i_burn', name: 'Tête brûlée', txt: 'Activez les 3 totems d\'un monde, puis battez son boss', n: 1, prog: rec_('totemBoss'), rw: { key: 'aura:blood', chest: 2 } },
  { id: 'elites', cat: 'feats', icon: 'i_enrage', name: 'Tueur d\'élites', txt: 'Battez 400 élites', n: 400, prog: rec_('elites'), rw: { gold: 250, chest: 2 } },
  { id: 'lvl40', cat: 'feats', icon: 'upg', name: 'Puissance absolue', txt: 'Atteignez le niveau 40 dans une partie', n: 40, prog: st_('bestLevel'), rw: { key: 'title:titan', gold: 300 } },
  { id: 'stage4', cat: 'feats', icon: 'portal', name: 'Grande expédition', txt: 'Atteignez le niveau 3 d\'une expédition', n: 3, prog: s => (s.stats?.runs ? Math.min(3, (+s.stats.bestStage || 0) + 1) : 0), rw: { gold: 400, chest: 2 } },
  { id: 'kills150k', cat: 'feats', icon: 'skull', name: 'Fléau des hordes', txt: 'Battez 150 000 monstres', n: 150000, prog: st_('kills'), rw: { key: 'aura:jade', gold: 400 } },
  // ---- Abysse ----
  { id: 'night1', cat: 'abyss', icon: 'skull', name: 'Porte de l\'Abysse', txt: 'Battez un monde en Cauchemar', n: 1, prog: s => ((s.diffCleared || []).some(n => n >= 3) ? 1 : 0), rw: { key: 'abyss', gold: 300 } },
  { id: 'abyss1', cat: 'abyss', icon: 'abyss', name: 'Premier plongeon', txt: 'Battez un monde en Abysse I', n: 1, prog: abyssMax_, rw: { key: 'aura:abyss', chest: 2 } },
  { id: 'abyss3w', cat: 'abyss', icon: 'abyss', name: 'Explorateur des profondeurs', txt: 'Battez 3 mondes différents en Abysse', n: 3, prog: s => (s.abyss || []).filter(n => n > 0).length, rw: { gold: 500, chest: 3 } },
  { id: 'abyss5', cat: 'abyss', icon: 'abyss', name: 'Abyssal', txt: 'Battez un monde en Abysse V', n: 5, prog: abyssMax_, rw: { key: 'title:abyssal', chest: 3 } },
  { id: 'void3', cat: 'abyss', icon: 'crown', name: 'Dévoreur dévoré', txt: 'Battez le Ver-Roi du Néant en Cauchemar', n: 1, prog: s => ((s.diffCleared?.[5] || 0) >= 3 ? 1 : 0), rw: { key: 'aura:gold', gold: 800 } },
  { id: 'abyss10', cat: 'abyss', icon: 'abyss', name: 'Seigneur de l\'Abysse', txt: 'Battez un monde en Abysse X', n: 10, prog: abyssMax_, rw: { keys: ['aura:void', 'title:seigneur'], gold: 1500, chest: 3 } },
  // ---- giga boss (save.stats : gigaKills victoires, gigaTop meilleur niveau de difficulté battu + 1, gigaDance victoires sans
  // être touché par son double rayon, gigaBest expédition victorieuse la plus rapide en s) ----
  { id: 'giga1', cat: 'giga', icon: 'crown', name: 'Tueur de géant', txt: `Battez ${GIGA.name}, le giga boss`, n: 1, prog: st_('gigaKills'), rw: { key: 'aura:magma', gold: 500, chest: 3 } },
  { id: 'giga_hard', cat: 'giga', icon: 'i_enrage', name: 'Le roi vacille', txt: 'Battez le giga boss en Difficile', n: 1, prog: s => (+s.stats?.gigaTop >= 2 ? 1 : 0), rw: { key: 'title:regicide', gold: 600, chest: 3 } },
  { id: 'giga_night', cat: 'giga', icon: 'skull', name: 'Cauchemar du roi', txt: 'Battez le giga boss en Cauchemar', n: 1, prog: s => (+s.stats?.gigaTop >= 3 ? 1 : 0), rw: { key: 'title:fleau_rois', gold: 1000, chest: 3 } },
  { id: 'giga_dance', cat: 'giga', icon: 'dodge', name: 'Danse des rayons', txt: 'Battez le giga boss sans être touché par son double rayon', n: 1, prog: st_('gigaDance'), rw: { key: 'aura:laser', gold: 400, chest: 2 } },
  { id: 'giga5', cat: 'giga', icon: 'medal', name: 'Briseur de couronnes', txt: 'Battez le giga boss 5 fois', n: 5, prog: st_('gigaKills'), rw: { gold: 800, chest: 3 } },
];

// Abysse : paliers I à X au-delà de Cauchemar, par monde. Le palier 1 s'ouvre quand le monde est battu en Cauchemar
// (défi « Porte de l'Abysse »), le palier t quand t − 1 est battu sur ce monde (un monde atteint par un portail pendant une
// partie en Abysse t compte aussi). Base Cauchemar, puis par palier (composé) : PV × (1 + hp)^t, dégâts × (1 + dmg)^t,
// PV du boss × (1 + boss)^t, apparitions × (1 + spawn × t) ; une malédiction de plus par palier (cumulées : Abysse V a
// les 5 premières de ABYSS_CURSES). Récompenses : or × (1 + gold × t), rareté + rarity × t, puissance des objets +
// itemMult × t, XP de maîtrise × (1 + MASTERY.abyss × t) (et run.track.abyss pour la Saison). Première victoire d'un palier
// sur un monde : first.gold × t or et un coffre de butin (rang first.chest[t − 1]).
// Équilibrage (simulateur, 12 parties par palier, un monde, une résurrection) : une progression linéaire (+15 % de PV par
// palier) laissait Abysse X du monde 1 à 100 % dès le milieu de partie ; d'où la progression composée. Joueur « milieu »
// (améliorations niv. 5, objets de boss des mondes 1–2 et 4 épiques +3, maîtrise 15) au monde 1 : III 100 %, V 100 %,
// VII 92 %, X 0 %. Joueur « avancé » (niv. 10, mondes 1–4, maîtrise 25) : monde 1 X 58 % ; monde 3 III 100 %, VII 17 %,
// X 0 % ; les paliers hauts des mondes 3 à 6 restent des défis de prestige.
export const ABYSS_TIERS = 10;
export const ABYSS_ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
export const ABYSS = { hp: 0.4, dmg: 0.2, boss: 0.4, spawn: 0.03, gold: 0.2, rarity: 0.015, itemMult: 0.05, color: '#5a6aff',
  first: { gold: 150, chest: [1, 1, 2, 2, 2, 2, 3, 3, 3, 3] } };
// malédictions dans l'ordre d'arrivée (palier I : la première, palier X : toutes)
export const ABYSS_CURSES = [
  { id: 'fast', name: 'Monstres rapides', icon: 'haste', desc: 'Monstres +10 % de vitesse' },
  { id: 'noheart', name: 'Sans cœurs', icon: 'heart', desc: 'Aucun cœur de soin ne tombe' },
  { id: 'elites', name: 'Élites ×2', icon: 'crown', desc: 'Les élites arrivent 2 fois plus souvent' },
  { id: 'short', name: 'Chrono court', icon: 'clock', desc: 'Chrono de chaque monde −20 %' },
  { id: 'bosshp', name: 'Boss colossal', icon: 'i_guard', desc: 'Boss +30 % de PV' },
  { id: 'horde', name: 'Totem imposé', icon: 'i_burn', desc: 'Totem de la Horde partout : +35 % de monstres (et +25 % d\'or)' },
  { id: 'fastboss', name: 'Boss furieux', icon: 'i_enrage', desc: 'Boss +20 % de vitesse, attaques plus rapprochées' },
  { id: 'lowheal', name: 'Soins maudits', icon: 'lifesteal', desc: 'Soins et vol de vie ×0,6' },
  { id: 'swarm', name: 'Grandes hordes', icon: 'i_multi', desc: 'Hordes 40 % plus denses' },
  { id: 'mods', name: 'Élites redoutables', icon: 'skull', desc: 'Les élites ont un pouvoir de plus' },
];

// Niveau des champions (demande du joueur : « 10 niveaux par personnage et des améliorations à l'infini ») : XP gagnée à
// chaque partie avec ce champion = monstres × kills + niveau atteint × level + mondes vaincus × (world + diff × difficulté)
// × (1 + abyss × palier). Niveaux 1 à 10 : niveau L → L + 1 coûte need[0] + need[1] × (L − 1) XP (8 100 XP pour le niveau
// 10, ≈ 30 parties). Chaque niveau au-delà du 1er : +1,5 % de dégâts et de PV (+13,5 % au niveau 10). Ensuite, à l'infini :
// une étoile toutes les star XP (≈ 6 parties), +0,5 % de dégâts et de PV chacune, sans plafond.
// Chaque niveau du 2 au 10 donne en plus un bonus spécial (perks, cumulés, appliqués par playerStats et run.js) ; chaque
// étoile ajoute aussi un petit bonus tournant (starCycle : or, expérience, ramassage, vitesse). at = paliers lus ailleurs
// (aura et titre : unlocks.js). Ancien barème (30 niveaux, plafond +10 %) : l'XP déjà gagnée est gardée telle quelle.
export const MASTERY = { max: 10, need: [200, 175], per: 0.015, star: 1800, starPer: 0.005,
  kills: 1 / 40, level: 4, world: 50, diff: 25, abyss: 0.15,
  at: { aura: 3, reroll: 5, title: 7, gold: 10 }, miles: [2, 3, 4, 5, 6, 7, 8, 9, 10],
  // bonus spéciaux des niveaux ({c} = nom du champion)
  perks: {
    2: { name: 'Pas léger', icon: 'arrow', desc: '+5 % de vitesse de course', speed: 0.05 },
    3: { name: 'Aura du champion', icon: 'aura', desc: 'Aura de {c} et +15 % de rayon de ramassage', magnet: 0.15 },
    4: { name: 'Bourse pleine', icon: 'gold', desc: '+10 % d\'or gagné', gold: 0.1 },
    5: { name: 'Seconde chance', icon: 'reroll', desc: 'Une relance de plus par partie', reroll: 1 },
    6: { name: 'Garde', icon: 'shield', desc: 'Un bouclier bloque le premier coup de chaque monde', shield: 1 },
    7: { name: 'Âme du champion', icon: 'flag', desc: 'Titre « Âme de {c} » et ultime chargé à moitié au départ', ult: 50 },
    8: { name: 'Savoir', icon: 'tome', desc: '+10 % d\'expérience en partie', xp: 0.1 },
    9: { name: 'Chasseur de trésors', icon: 'chest', desc: 'Coffres de butin de meilleure qualité', loot: 0.1 },
    10: { name: 'Légende', icon: 'medal', desc: 'Cadre doré et arme de départ au niveau 2', weapon: 1 },
  },
  starCycle: [{ gold: 0.02, txt: '+2 % d\'or' }, { xp: 0.02, txt: '+2 % d\'expérience' }, { magnet: 0.03, txt: '+3 % de ramassage' }, { speed: 0.01, txt: '+1 % de vitesse' }],
  aura: { mage: '#ffb0f0', archer: '#5affd8', knight: '#ff9a3a', vampire: '#ff1a3a', assassin: '#9a5aff', berserker: '#ff2a1a', cryo: '#7ad0ff', druid: '#8aff4a' } };
export const masteryNeed = lv => MASTERY.need[0] + MASTERY.need[1] * (lv - 1);
// niveau d'un total d'XP : { lv, cur (XP dans le niveau ou vers la prochaine étoile), next (XP à atteindre), stars }
export function masteryOf(xp) {
  let lv = 1, x = Math.max(0, +xp || 0);
  while (lv < MASTERY.max && x >= masteryNeed(lv)) { x -= masteryNeed(lv); lv++; }
  if (lv < MASTERY.max) return { lv, cur: Math.floor(x), next: masteryNeed(lv), stars: 0 };
  const stars = Math.floor(x / MASTERY.star);
  return { lv, cur: Math.floor(x - stars * MASTERY.star), next: MASTERY.star, stars };
}
// bonus spéciaux cumulés d'un niveau et d'un nombre d'étoiles (vitesse, ramassage, or, XP : multiplicateurs en plus ;
// relance, bouclier par monde, charge de l'ultime au départ, chance des coffres, arme de départ niveau 2)
export function masteryPerks(lv, stars = 0) {
  const o = { speed: 0, magnet: 0, gold: 0, xp: 0, reroll: 0, shield: 0, ult: 0, loot: 0, weapon: 0 }, C = MASTERY.starCycle;
  for (const [l, P] of Object.entries(MASTERY.perks)) if (lv >= +l) for (const k in o) o[k] += P[k] || 0;
  const n = Math.max(0, stars | 0);
  C.forEach((S, i) => { const times = Math.floor(n / C.length) + (i < n % C.length ? 1 : 0); for (const k in o) o[k] += (S[k] || 0) * times; });
  return o;
}
// bonus permanents : +1,5 % de dégâts et de PV par niveau au-delà du 1er, +0,5 % par étoile (sans plafond)
export const masteryBonus = (lv, stars = 0) => {
  const v = MASTERY.per * Math.max(0, Math.min(MASTERY.max, lv) - 1) + MASTERY.starPer * Math.max(0, stars);
  return { dmg: v, hp: v };
};

// ---------- Rythme visé (PACING_L2) ----------
// Joueur « normal » : 30 à 45 min par jour, ~5 parties de 6 à 9 min (1 à 2 mondes). Mesures du simulateur (bot, tirage
// de départ, Normal, monde 1 → 2, 24 parties) : ~4 000 monstres et niveau ~29 par partie, ~280 XP de maîtrise (×1,5 à 2
// plus tard : Difficile, Cauchemar, 3 mondes et plus), ~9 élites, ~830 PV rendus par le vol de vie, 1,25 évolution d'arme,
// combo maximal ~750 ; victimes d'une arme gardée toute la partie : foudre ~1 200, lame ricochet ~1 400, orbes ~300,
// cape solaire ~400, dagues ~250 ; un boss sur trois tombe en moins de 20 s.
// - Jour 1 (5 parties) : presque tous les « Premiers pas » (Bottes, Champignons, Départ éclair, Trèfle, Fiole de sang,
//   Tome de sagesse ; Nova de givre avec la Jungle), Combo 300 ; maîtrise 4–6 du champion principal (aura de maîtrise).
// - Jour 3 (15 parties) : tout l'arsenal ou presque (Boule de neige avec la Foudre), 2–3 auras d'armes, niveau 25 avec
//   1–2 champions, Polyvalent (Plume de phénix), maîtrise 10 (« Disciple »), Nyx (12 000 PV de vol de vie) pour qui joue
//   le vol de vie, premiers mondes en Difficile (la Rivière en Difficile ouvre Sora vers le jour 3–5).
// - Jour 7 (35 parties) : Combo 1 000, niveau 40, 4 mondes d'affilée, Arsenal légendaire, Tête brûlée, un premier monde
//   en Cauchemar : l'Abysse s'ouvre (paliers I–III) ; 150 000 monstres vers le jour 7–8 ; maîtrise 15–17.
// - Jour 14 (70 parties) : Tueur d'élites (400), 60 évolutions, Abysse V–VII au monde 1 et 2–3 mondes en Abysse, maîtrise
//   20 du principal (relance de plus), 2e champion vers 12–15, Combo 2 500 pour les meilleurs.
// - Jour 20 (100 parties) : Abysse X au monde 1 (~50 % pour un joueur avancé : « Seigneur de l'Abysse », le défi le plus
//   long), Ver-Roi en Cauchemar, maîtrise 30 du principal (cadre doré), maîtrise 20 avec 3 champions (~85 parties).
// Niveaux des champions (barème 1–10 + étoiles, voir MASTERY) : niveau 3–4 du principal au jour 1, 6–7 au jour 7, 10 vers
// le jour 12–14 (≈ 30 parties avec lui), puis une étoile toutes les ≈ 6 parties ; 3 champions au niveau 10 vers le jour 20.
//   Les paliers hauts des mondes 3 à 6 restent ouverts au-delà.
// ===== L1 : saison « Pass d'expédition », quêtes de la semaine, calendrier de 20 jours, succès, titres =====
// RYTHME (PACING) : calculé, pas deviné (à refaire si on touche aux valeurs ci-dessous).
// 1) Parties mesurées au simulateur d'équilibrage (bot, 3 champions, totems activés, 1 résurrection), moyennes par partie
//    et XP de saison qu'elles rapportent avec SEASON_XP :
//      monde 1 Normal (début)  :  8,8 min,  5 900 monstres, 1,4 boss,  6 coffres, 5 totems ->  91 XP (10,3 XP/min)
//      monde 2 Normal          :  9,9 min,  7 800 monstres, 1,5 boss,  9 coffres, 5 totems -> 112 XP (11,3 XP/min)
//      monde 3 Normal          : 10,2 min, 10 200 monstres, 1,3 boss, 10 coffres, 5 totems -> 122 XP (12,0 XP/min)
//      monde 4 Normal          :  8,9 min,  8 600 monstres, 1,2 boss, 11 coffres, 5 totems -> 119 XP (13,4 XP/min)
//      monde 1 Difficile       : 11,1 min, 11 200 monstres, 2,1 boss, 15 coffres, 8 totems -> 177 XP (15,9 XP/min)
//      monde 1 Cauchemar       :  9,3 min,  9 800 monstres, 1,8 boss, 13 coffres, 6 totems -> 165 XP (17,7 XP/min)
// 2) Joueur « normal » : 35 min de jeu par jour (3-4 parties), 90 % du rendement du bot, ses 3 quêtes du jour, la
//    connexion chaque jour, les quêtes de la semaine quand elles sont finies. Une journée : parties 500-950 XP (dont
//    Bonus du jour 175-315), quêtes du jour 210, connexion 50, quêtes de la semaine ~2 000 par semaine (finies en
//    4-5 jours). Total des 40 paliers : 23 420 XP.
// 3) Parcours de 20 jours simulé avec le vrai code (fausse date, parties nourries au crochet de fin de partie, voir
//    l'outil journey.mjs du banc de test ; les quêtes tirées changent avec la date) — progression supposée : mondes 1-2 au jour 1, monde 4 au jour 4, monde 5 au
//    jour 7, Difficile dès le jour 9, Cauchemar sur les mondes 1-2 au jour 14 :
//      jour 1  : palier 3  (756 XP)    — 17 succès sur 73, calendrier jour 1, 1re quête de la semaine en vue
//      jour 3  : palier 11-12 (3 250-3 700 XP) — 25 succès, titre « Éclaireur » et 1er coffre mythique (palier 10)
//      jour 4-5 : palier 15            — Nyx la Vampire (si elle est verrouillée, sinon coffre en or + 300 or)
//      jour 7  : palier 20-21 (8 100-8 300 XP) — 34 succès, 5/5 quêtes de la semaine, calendrier jour 7 (coffre en or + 2 bonus)
//      jour 13 : palier 31             — Sora l'Ombre (palier 30) et titre « Conquérant »
//      jour 14 : palier 32 (16 400 XP) — 44 succès, calendrier jour 14 (coffre mythique + 2 bonus)
//      jour 19 : palier 40             — 2 coffres mythiques, 1 000 or, titre « Légende de la saison »
//      jour 20 : palier 40 (25 600 XP) — 51 succès, calendrier jour 20 (titre « Assidu »), puis saison 2 le lendemain
// 4) Autres joueurs (modèle journalier, pacing.mjs) : 30 min/jour -> palier 39-40 au jour 20 ; 40 min/jour -> palier 40
//    au jour 18 ; 2 jours sans jouer -> palier 39 ; 2 h/jour -> palier 40 au jour 10 ; 15 min/jour -> palier 29.
//    Jouer chaque jour paie : 35 min × 7 jours ≈ 9 200 XP par semaine, les mêmes 4 h d'un coup ≈ 5 700 XP (un seul
//    Bonus du jour, une connexion, 3 quêtes du jour au lieu de 21).
export const SEASON_DAYS = 20, SEASON_TIERS = 40;
export const SEASON_XP = {
  boss: 20, bossZone: 5,          // par boss vaincu : 20 + 5 × n° du monde (0 à 5), × multiplicateur de difficulté
  diff: [1, 1.5, 2],              // Normal, Difficile, Cauchemar (au-delà, Abysse : +0,25 par niveau)
  kills: 300, chest: 2, totem: 2, min: 2, // 1 XP par 300 monstres, 2 par coffre trouvé, par totem activé, par minute
  bonus: 1200, bonusMul: 2,       // Bonus du jour : XP des parties ×2 sur les 20 premières minutes de jeu de chaque jour
  quest: 70,                      // quête du jour réclamée (les quêtes de la semaine ont leur XP dans WEEKLY)
  login: 50,                      // récompense du calendrier réclamée
  giga: 150,                      // giga boss vaincu (victoire de l'expédition) : en plus du boss, × multiplicateur de difficulté
};
// XP pour passer chaque palier (index 0 = palier 1) : 176, 197 … 995 (23 420 XP en tout)
export const SEASON_COST = Array.from({ length: SEASON_TIERS }, (_, i) => 155 + 21 * (i + 1));
// Récompenses des 40 paliers (gratuites). gold, chest (rang LOOT_TIERS, ou liste de rangs), parts [rareté, nombre],
// boost (nombre de bonus au hasard) ou boostId, upg (niveaux gratuits d'amélioration permanente), title (TITLES),
// cls (champion verrouillé à débloquer ; déjà jouable ou absent -> alt). big = grand palier (mis en avant).
export const SEASON_TRACK = [
  { gold: 150 }, { chest: 0 }, { parts: [1, 3] }, { boost: 1 }, { chest: 1 },
  { gold: 250 }, { upg: 1 }, { parts: [1, 4] }, { boost: 2 }, { chest: 3, title: 'eclaireur', big: true },
  { gold: 300 }, { chest: 1 }, { parts: [2, 2] }, { boostId: 'phenix' }, { cls: 'vampire', alt: { chest: 2, gold: 300 }, big: true },
  { gold: 350 }, { chest: 2 }, { upg: 1 }, { parts: [2, 3] }, { chest: 3, gold: 500, title: 'aventurier', big: true },
  { gold: 400 }, { chest: 1, boost: 1 }, { boost: 2 }, { upg: 1 }, { chest: 2, gold: 300 },
  { parts: [3, 1] }, { gold: 450 }, { chest: 2 }, { upg: 2 }, { cls: 'assassin', alt: { chest: 3, gold: 500 }, title: 'conquerant', big: true },
  { gold: 500 }, { chest: 2 }, { boost: 3 }, { upg: 2 }, { chest: 3 },
  { parts: [3, 2] }, { gold: 600 }, { chest: 2, boost: 1 }, { upg: 2 }, { chest: [3, 3], gold: 1000, title: 'legende', big: true },
];
// Quêtes de la semaine : 5 par semaine de saison (jours 1-7, 8-14, 15-20), tirées comme celles du jour (graine : date du
// début de la semaine). Progression = écart de la statistique (achValue de season.js) depuis le tirage. n = objectifs
// possibles, tier = coffre (rang LOOT_TIERS), xp = XP de saison, gold = or ; need = niveau de difficulté débloqué
// quelque part (1 : Difficile, 2 : Cauchemar). Volumes : un joueur à 35 min par jour fait ~25 parties par semaine.
export const WEEKLY = [
  { id: 'boss', stat: 'wins', icon: 'crown', n: [20, 25], tier: [1, 2], xp: [350, 450], gold: [200, 300], txt: n => `Battez ${n} boss` },
  { id: 'portals', stat: 'portals', icon: 'portal', n: [15, 20], tier: [1, 2], xp: [350, 450], gold: [200, 300], txt: n => `Franchissez ${n} portails` },
  { id: 'hard', stat: 'hard', icon: 'i_enrage', n: [6, 10], tier: [2, 2], xp: [400, 500], gold: [250, 350], need: 1, txt: n => `Battez ${n} boss en Difficile ou Cauchemar` },
  { id: 'night', stat: 'night', icon: 'skull', n: [3, 5], tier: [2, 3], xp: [450, 550], gold: [300, 400], need: 2, txt: n => `Battez ${n} boss en Cauchemar` },
  { id: 'combo', stat: 'c200', icon: 'bolt', n: [8, 12], tier: [1, 2], xp: [350, 450], gold: [200, 300], txt: n => `Atteignez un combo de 200 dans ${n} parties` },
  { id: 'totems', stat: 'totems', icon: 'i_burn', n: [40, 60], tier: [1, 2], xp: [350, 450], gold: [200, 300], txt: n => `Activez ${n} totems de défi` },
  { id: 'kills', stat: 'kills', icon: 'skull', n: [80000, 120000], tier: [1, 2], xp: [350, 450], gold: [200, 300], txt: n => `Battez ${n.toLocaleString('fr-FR')} monstres` },
  { id: 'chests', stat: 'chests', icon: 'chest', n: [100, 150], tier: [1, 2], xp: [350, 450], gold: [200, 300], txt: n => `Ouvrez ${n} coffres de butin` },
  { id: 'deep', stat: 'st3', icon: 'map', n: [4, 6], tier: [2, 2], xp: [400, 500], gold: [250, 350], txt: n => `Atteignez le niveau 3 d'une expédition ${n} fois` },
  { id: 'giga', stat: 'gigaKills', icon: 'crown', n: [1, 2], tier: [2, 3], xp: [450, 550], gold: [300, 400], need: 1, txt: n => (n > 1 ? `Battez ${n} fois le giga boss` : 'Battez le giga boss') },
  { id: 'daily', stat: 'quests', icon: 'quest', n: [12, 15], tier: [1, 2], xp: [350, 450], gold: [200, 300], txt: n => `Réclamez ${n} quêtes du jour` },
  { id: 'evos', stat: 'weaponEvos', icon: 'star', n: [15, 25], tier: [1, 2], xp: [350, 450], gold: [200, 300], txt: n => `Faites évoluer ${n} armes` },
];
// Calendrier de connexion de 20 jours (remplace celui de 7 jours, l'avancement est gardé) : un jour manqué ne remet
// rien à zéro, on reprend au jour suivant. Jours 7, 14 et 20 : grosses récompenses. Après le 20e, il recommence.
export const CAL_REWARDS = [
  { gold: 100 }, { chest: 0 }, { gold: 150 }, { parts: [1, 2] }, { boost: 1 }, { gold: 200 }, { chest: 2, boost: 2, big: true },
  { gold: 250 }, { chest: 1 }, { parts: [1, 3] }, { upg: 1 }, { gold: 300 }, { chest: 1 }, { chest: 3, boost: 2, big: true },
  { gold: 350 }, { parts: [2, 2] }, { chest: 2 }, { boostId: 'phenix' }, { gold: 400 }, { chest: 3, gold: 500, title: 'fidele', big: true },
];
// Titres affichés sous le nom du champion (accueil). Donnés par la saison, le calendrier et les succès ; L2 peut aussi
// en donner par les clés 'title:<id>' de save.unlocks.
export const TITLES = {
  recrue:      { name: 'Recrue', how: 'Titre de départ' },
  eclaireur:   { name: 'Éclaireur', how: 'Pass d\'expédition : palier 10' },
  aventurier:  { name: 'Aventurier', how: 'Pass d\'expédition : palier 20' },
  conquerant:  { name: 'Conquérant', how: 'Pass d\'expédition : palier 30' },
  legende:     { name: 'Légende de la saison', how: 'Pass d\'expédition : palier 40' },
  fidele:      { name: 'Assidu', how: 'Calendrier de connexion : 20e jour' },
  fleau:       { name: 'Fléau des monstres', how: 'Succès « Massacre III »' },
  virtuose:    { name: 'Virtuose du combo', how: 'Succès « Enchaînement III »' },
  insomniaque: { name: 'Insomniaque', how: 'Succès « Cauchemar éveillé III »' },
  maitre:      { name: 'Maître des mondes', how: 'Succès « Triple couronne »' },
  vampire:     { name: 'Seigneur vampire', how: 'Succès « Seigneur vampire »' },
  archiviste:  { name: 'Archiviste', how: 'Succès « Archiviste »' },
  pilier:      { name: 'Pilier de la guilde', how: 'Succès « Pilier de la guilde »' },
  roi:         { name: 'Tombeur de rois', how: 'Succès « Briseur de rois »' },
};
// titres des défis de déblocage (L2) et de la maîtrise 10 : choisis au même endroit que les autres
for (const [id, name] of Object.entries(UNLOCK_TITLES)) TITLES[id] ??= { name, how: 'Défi de déblocage' };
for (const c of Object.values(CLASSES)) TITLES['m_' + c.id] ??= { name: `Âme de ${c.name}`, how: `Niveau ${MASTERY.at.title} avec ${c.name}` };
// Catégories de l'écran Succès : nom et icône
export const ACH_CATS = {
  combat: { name: 'Combat', icon: 'skull' },
  champ:  { name: 'Champions', icon: 'user' },
  world:  { name: 'Mondes', icon: 'map' },
  diff:   { name: 'Difficulté', icon: 'i_enrage' },
  exped:  { name: 'Expédition', icon: 'portal' },
  evo:    { name: 'Évolutions', icon: 'star' },
  blood:  { name: 'Vol de vie', icon: 'lifesteal' },
  coll:   { name: 'Collection', icon: 'chest' },
  loyal:  { name: 'Fidélité', icon: 'calendar' },
};
// Succès d'origine (ACHIEVEMENTS) : [catégorie, statistique suivie (achValue de season.js), objectif] pour les barres
export const ACH_META = {
  first_win: ['combat', 'kills', 1], kills1000: ['combat', 'kills', 1000], ult20: ['combat', 'ults', 20], lvl20: ['combat', 'bestLevel', 20],
  allclass: ['champ', 'clsWon', 3], zone1: ['world', 'zone:0', 1], boss1: ['world', 'wins', 1], baron: ['world', 'zone:5', 1],
  hard1: ['diff', 'hardZones', 1], nightmare1: ['diff', 'nightZones', 1], nodeath: ['exped', 'clean', 1], portal1: ['exped', 'portals', 1],
  stage3: ['exped', 'stage', 3], world6: ['exped', 'gigaKills', 1], totems10: ['exped', 'totems', 10], rich: ['coll', 'gold', 1000],
  epic: ['coll', 'epic', 1], pets3: ['coll', 'pets', 3], forge1: ['coll', 'crafted', 1], upgrade5: ['coll', 'itemLv', 5],
  mythic: ['coll', 'mythic', 1], chests50: ['coll', 'chests', 50], quests10: ['loyal', 'quests', 10], login7: ['loyal', 'logins', 7],
};
// Nouveaux succès (paliers I/II/III, par champion, par monde…) : stat suivie (achValue), objectif, or, titre éventuel.
// Ceux par champion et par monde sont tirés de CLASSES et ZONES (un nouveau champion a les siens).
const ach = (id, cat, name, desc, stat, goal, gold, title) => ({ id, cat, name, desc, stat, goal, gold, ...(title ? { title } : {}) });
export const ACH_MORE = [
  ach('kills2', 'combat', 'Massacre II', 'Vaincre 25 000 monstres au total.', 'kills', 25000, 150),
  ach('kills3', 'combat', 'Massacre III', 'Vaincre 250 000 monstres au total.', 'kills', 250000, 500, 'fleau'),
  ach('combo1', 'combat', 'Enchaînement', 'Atteindre un combo de 100.', 'combo', 100, 60),
  ach('combo2', 'combat', 'Enchaînement II', 'Atteindre un combo de 500.', 'combo', 500, 150),
  ach('combo3', 'combat', 'Enchaînement III', 'Atteindre un combo de 2 000.', 'combo', 2000, 400, 'virtuose'),
  ach('ult2', 'combat', 'Déluge de pouvoir II', 'Lancer 300 ultimes.', 'ults', 300, 150),
  ach('lvl50', 'combat', 'Niveau 50', 'Atteindre le niveau 50 dans une partie.', 'bestLevel', 50, 200),
  ...Object.values(CLASSES).flatMap(c => [
    ach('boss_' + c.id, 'champ', `Chasseur : ${c.name}`, `Vaincre 15 boss avec ${c.name}.`, 'clsBoss:' + c.id, 15, 150),
    ach('form_' + c.id, 'champ', EVOLUTIONS[c.id]?.[4]?.name || `${c.name} ultime`, `Atteindre la 5e évolution de ${c.name} dans une partie.`, 'clsEvo:' + c.id, 4, 120),
  ]),
  ...ZONES.map((z, i) => ach('star_' + i, 'world', z.name, `Vaincre le boss du monde ${i + 1} en Cauchemar (3 étoiles).`, 'zone:' + i, 3, 150 + 50 * i)),
  ach('crown', 'world', 'Triple couronne', 'Obtenir les 3 étoiles dans les 6 mondes.', 'stars', ZONES.length, 1000, 'maitre'),
  ach('hard2', 'diff', 'Sueurs froides II', 'Vaincre 10 boss en Difficile ou plus.', 'hard', 10, 200),
  ach('hard3', 'diff', 'Sueurs froides III', 'Vaincre 40 boss en Difficile ou plus.', 'hard', 40, 400),
  ach('night2', 'diff', 'Cauchemar éveillé II', 'Vaincre 10 boss en Cauchemar.', 'night', 10, 300),
  ach('night3', 'diff', 'Cauchemar éveillé III', 'Vaincre 40 boss en Cauchemar.', 'night', 40, 600, 'insomniaque'),
  ach('portal2', 'exped', 'Au-delà du portail II', 'Franchir 25 portails.', 'portals', 25, 150),
  ach('totems2', 'exped', 'Tête brûlée II', 'Activer 50 totems de défi.', 'totems', 50, 200),
  ach('totems3', 'exped', 'Tête brûlée III', 'Activer 200 totems de défi.', 'totems', 200, 400),
  ach('worlds50', 'exped', 'Globe-trotteur', 'Vaincre 50 boss au total.', 'wins', 50, 200),
  ach('giga2', 'exped', 'Briseur de rois', `Vaincre ${GIGA.name}, le giga boss, 10 fois.`, 'gigaKills', 10, 600, 'roi'),
  ach('gigahard', 'diff', 'Le géant tremble', 'Vaincre le giga boss en Difficile ou plus.', 'gigaTop', 2, 400),
  ach('giganight', 'diff', 'Nuit des rois', 'Vaincre le giga boss en Cauchemar.', 'gigaTop', 3, 800),
  ach('gigadance', 'exped', 'Danse des rayons', 'Vaincre le giga boss sans être touché par son double rayon.', 'gigaDance', 1, 300),
  ach('evo1', 'evo', 'Première évolution', 'Faire évoluer une arme.', 'weaponEvos', 1, 60),
  ach('evo2', 'evo', 'Armurier', 'Faire évoluer 15 armes.', 'weaponEvos', 15, 150),
  ach('evo3', 'evo', 'Arsenal vivant', 'Faire évoluer 60 armes.', 'weaponEvos', 60, 400),
  ach('evorun', 'evo', 'Arsenal ultime', 'Avoir 3 armes évoluées dans une même partie.', 'evoRun', 3, 300),
  ach('form', 'evo', 'Forme ultime', 'Atteindre la 5e évolution d\'un champion.', 'formAny', 4, 100),
  ach('heal1', 'blood', 'Goût du sang', 'Rendre 2 000 PV grâce au vol de vie.', 'lsHeal', 2000, 60),
  ach('heal2', 'blood', 'Soif inextinguible', 'Rendre 25 000 PV grâce au vol de vie.', 'lsHeal', 25000, 200),
  ach('heal3', 'blood', 'Seigneur vampire', 'Rendre 150 000 PV grâce au vol de vie.', 'lsHeal', 150000, 500, 'vampire'),
  ach('legend1', 'coll', 'Trésor légendaire', 'Posséder un objet légendaire.', 'legendary', 1, 100),
  ach('legfx', 'coll', 'Archiviste', 'Obtenir les 7 effets d\'objets légendaires.', 'legFx', 7, 600, 'archiviste'),
  ach('pets6', 'coll', 'Ménagerie complète', 'Posséder les 6 familiers.', 'pets', 6, 400),
  ach('bestiary', 'coll', 'Bestiaire complet', `Rencontrer les ${MONSTER_COUNT + BOSS_COUNT} créatures du bestiaire.`, 'seen', MONSTER_COUNT + BOSS_COUNT, 400),
  ach('forge2', 'coll', 'Maître forgeron', 'Fabriquer 15 objets à la forge.', 'crafted', 15, 200),
  ach('chests2', 'coll', 'Pilleur de coffres II', 'Ouvrir 250 coffres de butin.', 'chests', 250, 300),
  ach('quests2', 'loyal', 'Toujours partant II', 'Réclamer 50 quêtes du jour.', 'quests', 50, 250),
  ach('weekly1', 'loyal', 'Semaine bien remplie', 'Réclamer 5 quêtes de la semaine.', 'weekly', 5, 150),
  ach('weekly2', 'loyal', 'Semaine bien remplie II', 'Réclamer 12 quêtes de la semaine.', 'weekly', 12, 400),
  ach('login20', 'loyal', 'Habitué', 'Réclamer 20 récompenses de connexion.', 'logins', 20, 300),
  ach('login50', 'loyal', 'Pilier de la guilde', 'Réclamer 50 récompenses de connexion.', 'logins', 50, 600, 'pilier'),
  ach('pass20', 'loyal', 'Pass d\'expédition', 'Atteindre le palier 20 d\'une saison.', 'tierBest', 20, 200),
  ach('pass40', 'loyal', 'Saison accomplie', 'Atteindre le palier 40 d\'une saison.', 'tierBest', 40, 500),
];
