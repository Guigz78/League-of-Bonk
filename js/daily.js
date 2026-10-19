// Quêtes du jour (3 par jour, coffres en récompense) et récompenses de connexion sur 7 jours.
// La progression d'une quête = écart d'une statistique du joueur depuis le début de la journée : rien à brancher
// dans la partie, tout ce qui fait monter save.stats compte. Sauvegardé et synchronisé avec le reste.
import { save, persist } from './save.js';
import { BOOSTS, LOOT_TIERS, ZONES } from './data.js';

// modèles de quêtes : statistique suivie, objectifs possibles, coffre (rang) et or
export const QUESTS = [
  { id: 'kills', stat: 'kills', icon: 'skull', n: [150, 300, 500], tier: [0, 0, 1], gold: [60, 90, 140], txt: n => `Battez ${n} monstres` },
  { id: 'boss', stat: 'wins', icon: 'crown', n: [1, 2], tier: [1, 1], gold: [100, 160], txt: n => (n > 1 ? `Battez ${n} boss` : 'Battez un boss') },
  { id: 'chests', stat: 'chests', icon: 'chest', n: [2, 4], tier: [0, 1], gold: [60, 100], txt: n => `Ouvrez ${n} coffres de butin` },
  { id: 'runs', stat: 'runs', icon: 'map', n: [2, 3], tier: [0, 0], gold: [60, 90], txt: n => `Partez ${n} fois en expédition` },
  { id: 'totems', stat: 'totems', icon: 'i_burn', n: [1, 2], tier: [0, 1], gold: [70, 110], txt: n => (n > 1 ? `Activez ${n} totems de défi` : 'Activez un totem de défi') },
  { id: 'ults', stat: 'ults', icon: 'nova', n: [6, 12], tier: [0, 0], gold: [60, 90], txt: n => `Lancez ${n} fois votre ultime` },
  { id: 'portal', stat: 'portals', icon: 'portal', n: [1], tier: [1], gold: [120], txt: () => 'Traversez un portail' },
];
// récompenses de connexion : jour 1 à 7 (le 7e est le plus gros)
export const LOGIN_REWARDS = [
  { gold: 100 }, { chest: 0 }, { gold: 200 }, { chest: 1 }, { boost: true }, { gold: 300 }, { chest: 2, gold: 200 },
];

export const today = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
// petit générateur déterministe : mêmes quêtes pour une même date
function seeded(str) {
  let a = 2166136261;
  for (const c of str) a = Math.imul(a ^ c.charCodeAt(0), 16777619);
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// tire les quêtes du jour si besoin (nouveau jour, sauvegarde ancienne)
export function ensureDaily() {
  const d = today();
  if (save.daily?.day === d && Array.isArray(save.daily.quests) && save.daily.quests.length === 3) return save.daily;
  const r = seeded('lob' + d), pool = QUESTS.filter(q => q.id !== 'portal' || save.unlockedZone > 0);
  const picked = [];
  while (picked.length < 3 && pool.length) picked.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
  save.daily = {
    day: d,
    quests: picked.map(q => { const k = Math.floor(r() * q.n.length); return { id: q.id, n: q.n[k], tier: q.tier[k], gold: q.gold[k], base: save.stats[q.stat] || 0, claimed: false }; }),
  };
  persist({ touch: false });
  return save.daily;
}

// quêtes affichables : texte, progression, prête à réclamer
export function questList() {
  const D = ensureDaily();
  return D.quests.map((q, i) => {
    const Q = QUESTS.find(x => x.id === q.id) || QUESTS[0];
    const prog = Math.max(0, Math.min(q.n, (save.stats[Q.stat] || 0) - q.base));
    return { i, ...q, icon: Q.icon, text: Q.txt(q.n), prog, ready: prog >= q.n && !q.claimed };
  });
}

function giveChest(tier) {
  save.pendingChests.push({ tier: Math.max(0, Math.min(LOOT_TIERS.length - 1, tier)), zone: Math.min(ZONES.length - 1, save.unlockedZone || 0) });
}

export function claimQuest(i) {
  const q = questList()[i];
  if (!q || !q.ready) return null;
  save.daily.quests[i].claimed = true;
  save.gold += q.gold;
  save.stats.quests = (save.stats.quests || 0) + 1;
  giveChest(q.tier);
  persist();
  return { gold: q.gold, chest: q.tier };
}

// connexion : jour suivant à réclamer (0 à 6), dernier jour réclamé
export function loginState() {
  const L = save.login && typeof save.login === 'object' ? save.login : (save.login = { day: 0, last: '' });
  return { day: Math.max(0, Math.min(6, L.day | 0)), ready: L.last !== today(), last: L.last };
}

export function claimLogin() {
  const st = loginState();
  if (!st.ready) return null;
  const R = LOGIN_REWARDS[st.day], out = { day: st.day, ...R };
  if (R.gold) save.gold += R.gold;
  if (R.chest != null) giveChest(R.chest);
  if (R.boost) {
    const ids = Object.keys(BOOSTS), id = ids[Math.floor(Math.random() * ids.length)];
    save.boosts[id] = (save.boosts[id] || 0) + 1; out.boostId = id;
  }
  save.login = { day: (st.day + 1) % 7, last: today() };
  save.stats.logins = (save.stats.logins || 0) + 1;
  persist();
  return out;
}

// nombre de récompenses qui attendent (pastilles de l'accueil)
export function dailyBadge() {
  return questList().filter(q => q.ready).length + (loginState().ready ? 1 : 0);
}
