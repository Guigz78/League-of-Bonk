// Quêtes du jour (3 par jour), quêtes de la semaine (5 par semaine de saison) et calendrier de connexion de 20 jours.
// La progression d'une quête = écart d'une statistique du joueur depuis son tirage : rien à brancher dans la partie,
// tout ce qui fait monter save.stats (ou les compteurs de season.js) compte. Sauvegardé et synchronisé avec le reste.
// Toutes rapportent de l'XP de saison (Pass d'expédition, season.js).
import { save, persist } from './save.js';
import { LOOT_TIERS, ZONES, WEEKLY, CAL_REWARDS, SEASON_XP } from './data.js';
import { grant, addXp, achValue, seasonWeek, feats } from './season.js';

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
// calendrier de connexion (20 jours, data.js) ; ancien nom gardé
export const LOGIN_REWARDS = CAL_REWARDS;

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
    return { i, ...q, xp: SEASON_XP.quest, icon: Q.icon, text: Q.txt(q.n), prog, ready: prog >= q.n && !q.claimed };
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
  const xp = addXp(SEASON_XP.quest);
  persist();
  return { gold: q.gold, chest: q.tier, xp: SEASON_XP.quest, t0: xp.t0, t1: xp.t1 };
}

// ---------- Quêtes de la semaine ----------
// statistique d'un modèle (stats du joueur ou compteurs des succès)
const wStat = q => Math.max(0, +achValue(q.stat) || 0);
// tire les 5 quêtes de la semaine de saison si besoin ; les quêtes finies mais pas réclamées de la semaine passée
// sont données d'office (save.weekly.auto : nombre, annoncé une fois par l'accueil)
export function ensureWeekly() {
  const W = seasonWeek(), cur = save.weekly;
  if (cur?.week === W.key && Array.isArray(cur.quests) && cur.quests.length === 5) return cur;
  let auto = 0;
  if (cur && Array.isArray(cur.quests)) for (const q of cur.quests) {
    const Q = WEEKLY.find(x => x.id === q.id);
    if (!Q || q.claimed || wStat(Q) - (q.base || 0) < q.n) continue;
    q.claimed = true; auto++; rewardWeekly(q);
  }
  const r = seeded('lobw' + W.key), maxD = Math.max(0, ...(save.diffCleared || [0]));
  // need : Difficile (1) ou Cauchemar (2) débloqué quelque part (Normal battu = Difficile ouvert)
  const pool = WEEKLY.filter(q => !q.need || maxD >= q.need);
  const picked = [];
  while (picked.length < 5 && pool.length) picked.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
  save.weekly = {
    week: W.key, auto,
    quests: picked.map(q => { const k = Math.floor(r() * q.n.length); return { id: q.id, n: q.n[k], tier: q.tier[k], xp: q.xp[k], gold: q.gold[k], base: wStat(q), claimed: false }; }),
  };
  persist({ touch: false });
  return save.weekly;
}

export function weeklyList() {
  const W = ensureWeekly();
  return W.quests.map((q, i) => {
    const Q = WEEKLY.find(x => x.id === q.id) || WEEKLY[0];
    const prog = Math.max(0, Math.min(q.n, wStat(Q) - (q.base || 0)));
    return { i, ...q, icon: Q.icon, text: Q.txt(q.n), prog, ready: prog >= q.n && !q.claimed };
  });
}

function rewardWeekly(q) {
  save.gold += q.gold;
  giveChest(q.tier);
  const F = feats();
  F.weekly = (F.weekly | 0) + 1;
  return addXp(q.xp);
}

export function claimWeekly(i) {
  const q = weeklyList()[i];
  if (!q || !q.ready) return null;
  save.weekly.quests[i].claimed = true;
  const xp = rewardWeekly(q);
  persist();
  return { gold: q.gold, chest: q.tier, xp: q.xp, t0: xp.t0, t1: xp.t1 };
}

// ---------- Calendrier de connexion (20 jours) ----------
// jour suivant à réclamer (0 à 19), dernier jour réclamé. Un jour manqué ne fait rien perdre : on reprend où on en était.
export function loginState() {
  const L = save.login && typeof save.login === 'object' ? save.login : (save.login = { day: 0, last: '' });
  return { day: Math.max(0, Math.min(CAL_REWARDS.length - 1, L.day | 0)), ready: L.last !== today(), last: L.last, len: CAL_REWARDS.length };
}

export function claimLogin() {
  const st = loginState();
  if (!st.ready) return null;
  const R = CAL_REWARDS[st.day], got = grant(R);
  save.login = { day: (st.day + 1) % CAL_REWARDS.length, last: today() };
  save.stats.logins = (save.stats.logins || 0) + 1;
  const xp = addXp(SEASON_XP.login);
  persist();
  return { day: st.day, R, got, xp: SEASON_XP.login, t0: xp.t0, t1: xp.t1 };
}

// nombre de récompenses qui attendent (pastilles de l'accueil) : quêtes du jour et de la semaine, connexion
export function dailyBadge() {
  return questList().filter(q => q.ready).length + weeklyList().filter(q => q.ready).length + (loginState().ready ? 1 : 0);
}
