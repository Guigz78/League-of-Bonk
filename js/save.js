// Sauvegarde locale (toujours) + calcul des statistiques du joueur.
import { CLASSES, UPGRADES, ITEM_BASES, RARITY, ACHIEVEMENTS } from './data.js';

const KEY = 'lob_save_v1';

export function freshSave() {
  return {
    v: 1,
    updatedAt: 0,
    gold: 0,
    cls: null,
    unlockedZone: 0,
    zoneCleared: [false, false, false, false, false, false],
    pets: [],
    pet: null,
    upgrades: { hp: 0, atk: 0, crit: 0, regen: 0, speed: 0, magnet: 0, luck: 0 },
    inventory: [],
    equipped: { weapon: null, armor: null, trinket: null },
    stats: { wins: 0, kills: 0, ults: 0, deaths: 0, runs: 0, bestLevel: 0, classWins: {}, seen: {} },
    achievements: {},
    settings: { sound: true, vibrate: true },
    tutorialDone: false,
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
  out.upgrades = { ...base.upgrades, ...s.upgrades };
  delete out.upgrades.potion;
  if (typeof out.stats?.kills === 'object') out.stats = { ...base.stats };
  out.equipped = { ...base.equipped, ...s.equipped };
  out.stats = { ...base.stats, ...s.stats };
  out.settings = { ...base.settings, ...s.settings };
  return out;
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
export function playerStats(clsId = save.cls) {
  const c = CLASSES[clsId];
  const st = { hp: c.hp, atk: c.atk, crit: c.crit, regen: 0, speed: c.speed, magnet: 1, gold: 1 };
  for (const [k, lvl] of Object.entries(save.upgrades)) {
    const per = UPGRADES[k]?.per;
    if (!per) continue;
    for (const [sk, v] of Object.entries(per)) st[sk] += v * lvl;
  }
  for (const id of Object.values(save.equipped)) {
    const it = save.inventory.find(i => i.id === id);
    if (!it) continue;
    for (const [sk, v] of Object.entries(it.stat)) st[sk] = (st[sk] || 0) + v;
  }
  st.crit = Math.min(st.crit, 0.75);
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

export function makeItem(r, zone, opts = {}) {
  const slots = Object.keys(ITEM_BASES);
  const slot = opts.slot || slots[Math.floor(r() * slots.length)];
  const list = ITEM_BASES[slot];
  const base = list[Math.floor(r() * list.length)];
  const rarity = opts.rarity || rollRarity(r, zone, opts.boost || 0);
  const m = RARITY[rarity].mult * (1 + zone * 0.5);
  const stat = {};
  for (const [k, v] of Object.entries(base.stat)) {
    stat[k] = k === 'crit' ? Math.round(v * m * 100) / 100 : Math.max(1, Math.round(v * m));
  }
  return { id: save.nextId++, slot, name: base.name, icon: base.icon, rarity, stat, zone };
}

export function itemPower(it) {
  if (!it) return 0;
  const s = it.stat;
  return (s.atk || 0) * 3 + (s.hp || 0) * 0.6 + (s.crit || 0) * 200 + (s.regen || 0) * 2.5;
}

export function sellValue(it) {
  return Math.round(8 + itemPower(it) * 1.2);
}

export function addItem(it) {
  save.inventory.push(it);
  // équipe automatiquement si l'emplacement est vide ou si l'objet est meilleur
  const cur = save.inventory.find(i => i.id === save.equipped[it.slot]);
  if (!cur || itemPower(it) > itemPower(cur)) { save.equipped[it.slot] = it.id; return true; }
  return false;
}

// ---------- Succès ----------
export function checkAchievements() {
  const s = save, st = s.stats, got = [];
  const cond = {
    first_win: st.kills >= 1,
    kills1000: st.kills >= 1000,
    zone1: s.zoneCleared[0],
    boss1: s.zoneCleared.slice(1).some(Boolean),
    allclass: ['mage', 'archer', 'knight'].every(c => st.classWins[c]),
    rich: s.gold >= 1000,
    epic: s.inventory.some(i => i.rarity === 'epic' || i.rarity === 'legendary'),
    pets3: s.pets.length >= 3,
    ult20: st.ults >= 20,
    lvl20: st.bestLevel >= 20,
    nodeath: !!st.cleanZone,
    baron: s.zoneCleared[5],
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
