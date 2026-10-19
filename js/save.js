// Sauvegarde locale (toujours) + calcul des statistiques du joueur.
import { CLASSES, UPGRADES, ITEM_BASES, BOSS_ITEMS, ACHIEVEMENTS, DIFFICULTIES, PARTS, RARITIES, LOOT_TIERS, CHEST_LOOT, FORGE, BOOSTS, BOOST_SLOTS, RENAMED,
  AFFIXES, AFFIX_POOLS, LEGEND_EFFECTS } from './data.js';

const KEY = 'lob_save_v1';

export function freshSave() {
  return {
    v: 3,
    updatedAt: 0,
    gold: 0,
    cls: null,
    unlockedZone: 0,
    zoneCleared: [false, false, false, false, false, false],
    // progression par zone et par niveau de difficulté
    diffCleared: [0, 0, 0, 0, 0, 0],   // nombre de niveaux battus (0 = aucun, 1 = Normal, 2 = Difficile, 3 = Cauchemar)
    diffWins: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]], // victoires par niveau
    diffBest: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]], // meilleur temps de victoire (s, 0 = aucun)
    diffSel: [0, 0, 0, 0, 0, 0],       // dernier niveau choisi dans la fiche de zone
    pets: [],
    pet: null,
    upgrades: { hp: 0, atk: 0, crit: 0, regen: 0, speed: 0, magnet: 0, luck: 0 },
    inventory: [],
    equipped: { weapon: null, armor: null, trinket: null },
    stats: { wins: 0, kills: 0, ults: 0, deaths: 0, runs: 0, bestLevel: 0, classWins: {}, seen: {},
      worlds: 0, bestStage: 0, chests: 0, crafted: 0, totems: 0, portals: 0, mythic: 0, quests: 0, logins: 0 },
    // expédition : pièces d'équipement par rareté, bonus possédés et choisis, coffres pas encore ouverts
    parts: { weapon: [0, 0, 0, 0], armor: [0, 0, 0, 0], trinket: [0, 0, 0, 0] },
    boosts: {},
    boostSel: [null, null],
    pendingChests: [],
    achievements: {},
    // options : graphismes 3D/2D, tremblements (0 aucun, 1 faible, 2 normal), chiffres de dégâts (all, crit, none),
    // taille du joystick (0,8 à 1,3), gaucher (saut à droite)
    settings: { sound: true, music: true, vibrate: true, gfx: '3d', shake: 2, numbers: 'all', joySize: 1, lefty: false },
    tutorialDone: false,
    lastZone: null,     // dernier monde lancé (bouton JOUER de l'accueil)
    daily: null,        // quêtes du jour : { day, quests: [{ id, n, tier, gold, base, claimed }] }
    login: { day: 0, last: '' }, // récompenses de connexion : prochain jour (0 à 6), dernière date réclamée
    run: null,
    nextId: 1,
  };
}

export let save = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return migrate(JSON.parse(raw));
  } catch (e) { /* stockage indisponible */ }
  return freshSave();
}

function migrate(s) {
  const base = freshSave();
  const out = { ...base, ...s };
  out.v = base.v;
  out.upgrades = { ...base.upgrades, ...s.upgrades };
  delete out.upgrades.potion;
  if (typeof out.stats?.kills === 'object') out.stats = { ...base.stats };
  out.equipped = { ...base.equipped, ...s.equipped };
  out.stats = { ...base.stats, ...s.stats };
  out.settings = cleanSettings({ ...base.settings, ...s.settings });
  out.login = { day: Math.max(0, Math.min(6, (s.login?.day | 0))), last: typeof s.login?.last === 'string' ? s.login.last : '' };
  if (out.lastZone != null && !(out.lastZone >= 0 && out.lastZone <= 5)) out.lastZone = null;
  migrateDifficulty(out, base);
  migrateLoot(out, s);
  renameOld(out);
  return out;
}

// options toujours valides (sauvegardes anciennes ou venues du cloud)
function cleanSettings(o) {
  o.gfx = o.gfx === '2d' ? '2d' : '3d';
  o.shake = [0, 1, 2].includes(+o.shake) ? +o.shake : 2;
  o.numbers = ['all', 'crit', 'none'].includes(o.numbers) ? o.numbers : 'all';
  o.joySize = Math.max(0.8, Math.min(1.3, +o.joySize || 1));
  o.lefty = !!o.lefty;
  return o;
}

// l'univers a changé de noms : bestiaire et objets des anciennes sauvegardes suivent
function renameOld(out) {
  const seen = out.stats.seen || {};
  for (const [o, n] of Object.entries(RENAMED)) if (seen[o]) { seen[n] = (seen[n] || 0) + seen[o]; delete seen[o]; }
  for (const it of out.inventory || []) if (RENAMED[it.name]) it.name = RENAMED[it.name];
}

// v2 -> v3 : pièces, bonus, coffres en attente (toujours remis en forme, comme la difficulté)
function migrateLoot(out, s) {
  const int = (v, max) => Math.max(0, Math.min(max, Math.floor(+v || 0)));
  const obj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
  const parts = obj(out.parts), boosts = obj(out.boosts);
  out.parts = Object.fromEntries(Object.keys(PARTS).map(k => [k, RARITIES.map((_, r) => int((Array.isArray(parts[k]) ? parts[k] : [])[r], 1e6))]));
  out.boosts = {};
  for (const id of Object.keys(BOOSTS)) { const n = int(boosts[id], 999); if (n) out.boosts[id] = n; }
  const sel = Array.isArray(out.boostSel) ? out.boostSel : [];
  out.boostSel = Array.from({ length: BOOST_SLOTS }, (_, i) => (BOOSTS[sel[i]] && sel.indexOf(sel[i]) === i ? sel[i] : null));
  out.pendingChests = (Array.isArray(out.pendingChests) ? out.pendingChests : [])
    .filter(c => c && typeof c === 'object').map(c => ({ tier: int(c.tier, LOOT_TIERS.length - 1), zone: int(c.zone, 5) }));
  const st = out.stats;
  if ((s.v || 1) < 3) st.worlds = Math.max(st.worlds || 0, st.wins || 0);
  for (const k of ['worlds', 'bestStage', 'chests', 'crafted', 'totems', 'portals', 'mythic', 'quests', 'logins']) st[k] = int(st[k], 1e9);
  if (!Array.isArray(out.inventory)) out.inventory = [];
}

// v1 -> v2 : une zone terminée l'a été en Normal. Les tableaux sont toujours remis en forme (sauvegardes cloud anciennes).
function migrateDifficulty(out, base) {
  const nD = DIFFICULTIES.length, nZ = base.zoneCleared.length;
  const int = (v, max) => Math.max(0, Math.min(max, Math.floor(+v || 0)));
  out.zoneCleared = base.zoneCleared.map((_, i) => !!(out.zoneCleared || [])[i]);
  const dc = Array.isArray(out.diffCleared) ? out.diffCleared : [];
  out.diffCleared = out.zoneCleared.map((c, i) => Math.max(int(dc[i], nD), c ? 1 : 0));
  out.zoneCleared = out.diffCleared.map(n => n >= 1);
  const grid = (src, fill) => base.zoneCleared.map((_, i) => Array.from({ length: nD }, (_, d) => int(((Array.isArray(src) ? src : [])[i] || [])[d], 1e9) || fill(i, d)));
  out.diffWins = grid(out.diffWins, (i, d) => (d < out.diffCleared[i] ? 1 : 0));
  out.diffBest = grid(out.diffBest, () => 0);
  const sel = Array.isArray(out.diffSel) ? out.diffSel : [];
  out.diffSel = base.diffSel.map((_, i) => Math.min(int(sel[i], nD - 1), out.diffCleared[i]));
  out.unlockedZone = int(out.unlockedZone, nZ - 1);
}

// niveau de difficulté le plus élevé jouable sur une zone (0 = Normal seulement)
export function maxDiff(zone) {
  return Math.min(DIFFICULTIES.length - 1, save.diffCleared?.[zone] || 0);
}

const listeners = new Set();
export function onSave(fn) { listeners.add(fn); }

export function persist({ touch = true } = {}) {
  if (touch) save.updatedAt = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* plein ou privé */ }
  for (const fn of listeners) fn(save);
}

export function replaceSave(s) {
  save = migrate(s);
  persist({ touch: false });
}

export function resetSave() {
  save = freshSave();
  persist();
}

// ---------- Statistiques ----------
const r3 = v => Math.round(v * 1000) / 1000;
// champion + améliorations de la Boutique + objets équipés (caractéristique principale, bonus, niveau), plafonds appliqués.
// speed, magnet et gold sont des multiplicateurs (1 = normal) ; les autres bonus valent 0 par défaut.
export function playerStats(clsId = save.cls) {
  const c = CLASSES[clsId];
  const st = { hp: c.hp, atk: c.atk, crit: c.crit, regen: 0, speed: c.speed, magnet: 1, gold: 1,
    critDmg: 0, lifesteal: 0, haste: 0, area: 0, armor: 0, thorns: 0, dodge: 0, xp: 0, ult: 0, effects: [] };
  for (const [k, lvl] of Object.entries(save.upgrades)) {
    const per = UPGRADES[k]?.per;
    if (!per) continue;
    for (const [sk, v] of Object.entries(per)) st[sk] += v * lvl;
  }
  for (const id of Object.values(save.equipped)) {
    const it = save.inventory.find(i => i.id === id);
    if (!it) continue;
    for (const [sk, v] of Object.entries(it.stat || {})) if (typeof st[sk] === 'number') st[sk] += +v || 0;
    if (LEGEND_EFFECTS[it.effect] && !st.effects.includes(it.effect)) st.effects.push(it.effect);
  }
  // plafonds : la vitesse plafonne le bonus au-dessus de celle du champion
  for (const [k, A] of Object.entries(AFFIXES)) if (A.max != null) st[k] = k === 'speed' ? Math.min(st.speed, c.speed + A.max) : Math.min(st[k], A.max);
  for (const k of Object.keys(st)) if (k !== 'effects') st[k] = r3(st[k]);
  st.hp = Math.round(st.hp); st.atk = Math.round(st.atk);
  return st;
}

export function upgradeCost(k) {
  const u = UPGRADES[k];
  return Math.round(u.base * Math.pow(u.grow, save.upgrades[k]));
}

// ---------- Objets ----------
export function rollRarity(r, zone, boost = 0) {
  const x = r() - boost - zone * 0.02;
  if (x < 0.04) return 'legendary';
  if (x < 0.16) return 'epic';
  if (x < 0.42) return 'rare';
  return 'common';
}

// valeur d'un bonus : roll de la rareté × zone (les bonus en % montent plus doucement) × hasard ±15 %.
// Une régénération en caractéristique principale vaut double.
function affixValue(k, ri, zone, mult, r, main = false) {
  const A = AFFIXES[k];
  const v = A.roll[ri] * mult * (0.85 + r() * 0.3) * (main && k === 'regen' ? 2 : 1);
  if (A.fmt === 'pct') return Math.max(0.005, r3(v * (1 + zone * 0.12)));
  return Math.max(1, Math.round(v * (1 + zone * 0.45)));
}

// objet : caractéristique principale + 1 (commun) à 4 (légendaire) bonus, + un effet unique sur les légendaires.
// opts : slot, rarity, boost (rareté), mult (difficulté, forge), base (modèle imposé), crafted
export function makeItem(r, zone, opts = {}) {
  const slots = Object.keys(ITEM_BASES);
  const slot = opts.slot || slots[Math.floor(r() * slots.length)];
  const list = ITEM_BASES[slot];
  const B = opts.base || list[Math.floor(r() * list.length)];
  const rarity = opts.rarity || rollRarity(r, zone, opts.boost || 0);
  const ri = Math.max(0, RARITIES.indexOf(rarity)), m = opts.mult || 1;
  const stat = {};
  const add = (k, v) => { stat[k] = AFFIXES[k].fmt === 'pct' ? r3((stat[k] || 0) + v) : (stat[k] || 0) + v; };
  add(B.main, affixValue(B.main, ri, zone, m, r, true));
  // le bonus fétiche du modèle d'abord, puis des bonus au hasard (sans doublon ni caractéristique principale)
  const want = (B.affs || [B.aff]).filter(k => AFFIXES[k]).slice(0, ri + 1);
  const pool = AFFIX_POOLS[slot].filter(k => k !== B.main && !want.includes(k));
  while (want.length < ri + 1 && pool.length) want.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
  for (const k of want) add(k, affixValue(k, ri, zone, m, r));
  const it = { id: save.nextId++, slot, name: B.name, icon: B.icon, rarity, main: B.main, stat, base: { ...stat }, lv: 0, zone };
  if (ri === RARITIES.length - 1) { const ids = Object.keys(LEGEND_EFFECTS); it.effect = LEGEND_EFFECTS[B.effect] ? B.effect : ids[Math.floor(r() * ids.length)]; }
  if (opts.crafted) it.crafted = true;
  return it;
}

// objet unique du boss d'une zone (légendaire, bonus et effet fixés)
export function makeBossItem(zone) {
  const B = BOSS_ITEMS[zone];
  return B ? makeItem(Math.random, zone, { slot: B.slot, rarity: 'legendary', base: B, mult: 1.15 }) : null;
}

// puissance d'un objet (tri, comparaison, équipement automatique) : chaque bonus converti en « points »
const POWER = { atk: 3, hp: 0.6, crit: 200, critDmg: 50, lifesteal: 500, haste: 170, speed: 150, area: 90, armor: 350,
  regen: 2.5, thorns: 20, dodge: 350, xp: 50, magnet: 25, gold: 50, ult: 45 };
export function itemPower(it) {
  if (!it) return 0;
  let p = it.effect ? 30 : 0;
  for (const [k, v] of Object.entries(it.stat || {})) p += (POWER[k] || 0) * (+v || 0);
  return p;
}

export function sellValue(it) {
  return Math.round(5 + itemPower(it) * 0.5);
}

export function addItem(it) {
  save.inventory.push(it);
  // équipe automatiquement si l'emplacement est vide ou si l'objet est meilleur
  const cur = save.inventory.find(i => i.id === save.equipped[it.slot]);
  if (!cur || itemPower(it) > itemPower(cur)) { save.equipped[it.slot] = it.id; return true; }
  return false;
}

// ---------- Butin de l'expédition ----------
const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pickW = w => { let x = Math.random() * w.reduce((a, b) => a + b, 0); for (let i = 0; i < w.length; i++) if ((x -= w[i]) < 0) return i; return w.length - 1; };
export const rarityIdx = it => Math.max(0, RARITIES.indexOf(it.rarity));

// tire le contenu d'un coffre sans l'appliquer : pièces, bonus, objets avec leurs caractéristiques,
// parfois un niveau gratuit d'amélioration permanente, et un peu d'or
export function rollChest({ tier = 0, zone = 0 }) {
  const T = LOOT_TIERS[tier] || LOOT_TIERS[0], L = CHEST_LOOT[tier] || CHEST_LOOT[0], slots = Object.keys(PARTS), got = {};
  for (let n = rint(T.parts[0], T.parts[1]); n > 0; n--) { const k = slots[rint(0, slots.length - 1)] + ':' + pickW(T.rar); got[k] = (got[k] || 0) + 1; }
  const parts = Object.entries(got).map(([k, n]) => { const [slot, r] = k.split(':'); return { slot, r: +r, n }; }).sort((a, b) => b.r - a.r || b.n - a.n);
  const ids = Object.keys(BOOSTS);
  const boost = Math.random() < T.boost ? ids[rint(0, ids.length - 1)] : null;
  const items = [];
  for (let n = L.items + (Math.random() < L.extra ? 1 : 0); n > 0; n--) items.push(makeItem(Math.random, zone, { rarity: RARITIES[pickW(L.rar)] }));
  const ups = Object.keys(UPGRADES).filter(k => save.upgrades[k] < UPGRADES[k].max);
  const upg = ups.length && Math.random() < L.upg ? ups[rint(0, ups.length - 1)] : null;
  const gold = Math.round(rint(T.gold[0], T.gold[1]) * (1 + 0.4 * zone));
  return { tier, zone, parts, boost, items, upg, gold };
}

// ouvre le coffre en attente n° i : contenu ajouté à la sauvegarde et coffre retiré en même temps
export function openChest(i = 0) {
  const c = save.pendingChests[i];
  if (!c) return null;
  const res = rollChest(c);
  save.pendingChests.splice(i, 1);
  for (const p of res.parts) save.parts[p.slot][p.r] += p.n;
  if (res.boost) save.boosts[res.boost] = (save.boosts[res.boost] || 0) + 1;
  for (const it of res.items) { it.isNew = true; addItem(it); }
  res.eq = res.items.map(it => save.equipped[it.slot] === it.id); // équipés automatiquement (meilleurs)
  if (res.upg) res.upgLv = ++save.upgrades[res.upg];
  save.gold += res.gold;
  save.stats.chests++;
  if (res.tier >= 3) save.stats.mythic++;
  persist();
  return res;
}

// ---------- Forge ----------
export function canCraft(slot, r) {
  return save.parts[slot][r] >= FORGE.craft.parts && save.gold >= FORGE.craft.gold[r];
}

// fabrique un objet de l'emplacement et de la rareté choisis (puissance : meilleure zone atteinte, +10 %)
export function craftItem(slot, r) {
  if (!canCraft(slot, r)) return null;
  save.parts[slot][r] -= FORGE.craft.parts;
  save.gold -= FORGE.craft.gold[r];
  const it = makeItem(Math.random, save.unlockedZone, { slot, rarity: RARITIES[r], mult: 1.1, crafted: true });
  it.isNew = true;
  const equipped = addItem(it);
  save.stats.crafted++;
  persist();
  return { item: it, equipped };
}

export function canFuse(slot, r) { return r < RARITIES.length - 1 && save.parts[slot][r] >= FORGE.fuse; }
export function fuseParts(slot, r) {
  if (!canFuse(slot, r)) return false;
  save.parts[slot][r] -= FORGE.fuse;
  save.parts[slot][r + 1]++;
  persist();
  return true;
}

// coût du prochain niveau d'un objet (null au maximum)
export function itemUpgradeCost(it) {
  const lv = it.lv || 0, U = FORGE.upgrade;
  if (lv >= U.max) return null;
  return { parts: U.parts[lv], gold: U.gold[lv], slot: it.slot, r: rarityIdx(it), lv: lv + 1 };
}
export function canUpgrade(it) {
  const c = itemUpgradeCost(it);
  return !!c && save.parts[c.slot][c.r] >= c.parts && save.gold >= c.gold;
}
// stats d'un objet au niveau lv : base × (1 + per × lv) ; ATQ et PV gagnent au moins 1 par niveau, les % au moins 0,5 %
export function statsAt(base, lv) {
  const m = 1 + FORGE.upgrade.per * lv, out = {};
  for (const [k, v] of Object.entries(base)) {
    if (AFFIXES[k]?.fmt === 'pct') out[k] = r3(Math.max(v * m, v + 0.005 * lv));
    else out[k] = Math.max(Math.round(v * m), k === 'atk' || k === 'hp' ? v + lv : v);
  }
  return out;
}
export function upgradeItem(id) {
  const it = save.inventory.find(i => i.id === id);
  if (!it || !canUpgrade(it)) return false;
  const c = itemUpgradeCost(it);
  save.parts[c.slot][c.r] -= c.parts;
  save.gold -= c.gold;
  if (!it.base) it.base = { ...it.stat };
  it.lv = c.lv;
  it.stat = statsAt(it.base, it.lv);
  persist();
  return true;
}
// recyclage : pièces de l'emplacement et de la rareté de l'objet (+1 par niveau d'amélioration)
export function salvageValue(it) { return FORGE.salvage[rarityIdx(it)] + (it.lv || 0); }
export function salvageItem(id) {
  const it = save.inventory.find(i => i.id === id);
  if (!it || Object.values(save.equipped).includes(id)) return 0;
  const n = salvageValue(it);
  save.parts[it.slot][rarityIdx(it)] += n;
  save.inventory = save.inventory.filter(i => i !== it);
  persist();
  return n;
}

// ---------- Bonus ----------
export function buyBoost(id) {
  const b = BOOSTS[id];
  if (!b || save.gold < b.price) return false;
  save.gold -= b.price;
  save.boosts[id] = (save.boosts[id] || 0) + 1;
  persist();
  return true;
}
// vide les emplacements dont le bonus n'est plus possédé
export function cleanBoostSel() {
  save.boostSel = Array.from({ length: BOOST_SLOTS }, (_, i) => { const id = save.boostSel[i]; return id && save.boosts[id] > 0 && save.boostSel.indexOf(id) === i ? id : null; });
}
// consomme un exemplaire de chaque bonus choisi au départ d'une partie
export function consumeBoosts() {
  cleanBoostSel();
  const out = [];
  for (const id of save.boostSel) {
    if (!id) continue;
    if (!--save.boosts[id]) delete save.boosts[id];
    out.push(id);
  }
  persist();
  return out;
}

// ---------- Succès ----------
export function checkAchievements() {
  const s = save, st = s.stats, got = [];
  const cond = {
    first_win: st.kills >= 1,
    kills1000: st.kills >= 1000,
    zone1: s.zoneCleared[0],
    boss1: s.zoneCleared.some(Boolean),
    allclass: ['mage', 'archer', 'knight'].every(c => st.classWins[c]),
    rich: s.gold >= 1000,
    epic: s.inventory.some(i => i.rarity === 'epic' || i.rarity === 'legendary'),
    pets3: s.pets.length >= 3,
    ult20: st.ults >= 20,
    lvl20: st.bestLevel >= 20,
    nodeath: !!st.cleanZone,
    baron: s.zoneCleared[5],
    hard1: (s.diffCleared || []).some(n => n >= 2),
    nightmare1: (s.diffCleared || []).some(n => n >= 3),
    portal1: st.portals >= 1,
    stage3: st.bestStage >= 2,
    world6: st.bestStage >= 5,
    totems10: st.totems >= 10,
    forge1: st.crafted >= 1,
    upgrade5: s.inventory.some(i => (i.lv || 0) >= 5),
    mythic: st.mythic >= 1,
    chests50: st.chests >= 50,
    quests10: st.quests >= 10,
    login7: st.logins >= 7,
  };
  for (const a of ACHIEVEMENTS) {
    if (!s.achievements[a.id] && cond[a.id]) {
      s.achievements[a.id] = Date.now();
      s.gold += a.gold;
      got.push(a);
    }
  }
  return got;
}
