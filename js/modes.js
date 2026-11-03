// Modes spéciaux (onglet Jouer → bouton Monde → « Modes spéciaux ») :
// - Défi de la semaine : mêmes règles pour tout le monde pendant une semaine (lundi → dimanche), tirées du numéro de la
//   semaine : un monde, une difficulté, une mission (dont « Défendre la marmite ») et 2 malédictions de l'Abysse.
//   Récompense une seule fois par semaine (or, coffre en or, éclat mythique).
// - Mode infini : pas de boss ni de portail, survivre le plus longtemps possible (après le chrono, les monstres deviennent
//   fous puis le monde s'effondre) ; record par monde, or en plus selon le temps tenu.
// Une partie spéciale = un seul niveau, comme un chapitre d'histoire (run.special, missions de js/story-mission.js).
import { ZONES, DIFFICULTIES, ABYSS_CURSES, LOOT_TIERS } from './data.js';
import { save, persist } from './save.js';

// semaine ISO : « 2026-W45 » (change le lundi)
export function weekKey(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = t.getUTCFullYear(), w = Math.ceil(((t - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7);
  return `${y}-W${String(w).padStart(2, '0')}`;
}
const hash = s => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };

// missions possibles du défi (k = difficulté : un peu plus longues en Difficile)
const MISSIONS = {
  defend: k => ({ type: 'defend', t: 90 + k * 15, icon: '🍲', name: 'Marmite', what: `Protégez la marmite pendant ${90 + k * 15} secondes` }),
  collect: () => ({ type: 'collect', n: 7, icon: '💎', name: 'Gemmes', what: 'Ramassez 7 gemmes géantes (chacune est gardée)' }),
  elites: () => ({ type: 'elites', n: 4, icon: '🎯', name: 'Gardes', what: 'Battez 4 gardes d\'élite' }),
  survive: k => ({ type: 'survive', t: 100 + k * 20, icon: '🔥', name: 'Tenez bon', what: `Tenez ${100 + k * 20} secondes` }),
};
const ORDER = ['defend', 'collect', 'elites', 'survive'];
// malédictions possibles (pas celles des boss : un défi n'a pas de boss)
const CURSE_POOL = ABYSS_CURSES.filter(c => !['bosshp', 'fastboss'].includes(c.id));
export const WEEKLY_REWARD = { gold: 600, chest: 2, shards: 1 };

// défi de la semaine en cours (monde ramené au dernier monde débloqué du joueur)
export function weekly(key = weekKey()) {
  const h = hash(key), pool = [...CURSE_POOL];
  const c1 = pool.splice(h % pool.length, 1)[0], c2 = pool.splice((h >>> 9) % pool.length, 1)[0];
  const diff = (h >>> 5) % 2, type = ORDER[(h >>> 13) % ORDER.length];
  return { key, zone: Math.min(save.unlockedZone || 0, (h >>> 17) % ZONES.length), diff, curses: [c1, c2], mission: MISSIONS[type](diff),
    done: save.weekChal?.key === key && !!save.weekChal.done };
}
// jours avant le prochain défi (lundi)
export const weeklyDaysLeft = (d = new Date()) => 8 - (d.getDay() || 7);

// difficulté d'une partie spéciale : celle du niveau k, plus les malédictions du défi (mêmes effets qu'en Abysse)
export function specialDiff(D, ids = []) {
  if (!ids.length) return D;
  const C = new Set(ids), has = id => C.has(id);
  return { ...D, curses: C, speed: D.speed * (has('fast') ? 1.1 : 1), elite: D.elite * (has('elites') ? 0.5 : 1),
    mods: D.mods + (has('mods') ? 1 : 0), heal: D.heal * (has('lowheal') ? 0.6 : 1) };
}

// défi réussi : la première fois de la semaine, or + coffre en or (à ouvrir) + éclat mythique
export function weeklyWin(W) {
  if (save.weekChal?.key === W.key && save.weekChal.done) return { first: false };
  save.weekChal = { key: W.key, done: true };
  save.gold += WEEKLY_REWARD.gold;
  save.pendingChests.push({ tier: WEEKLY_REWARD.chest, zone: W.zone });
  save.mythShards = (save.mythShards | 0) + WEEKLY_REWARD.shards;
  save.stats.weeklyWins = (save.stats.weeklyWins || 0) + 1;
  persist();
  return { first: true, gold: WEEKLY_REWARD.gold, chest: LOOT_TIERS[WEEKLY_REWARD.chest].name, shards: WEEKLY_REWARD.shards };
}

// mode infini : record par monde (secondes) et or en plus selon le temps tenu
export const endlessBest = z => (save.endless?.[z] | 0);
export function endlessEnd(z, secs) {
  secs = Math.max(0, Math.round(secs || 0));
  save.endless ||= {};
  const before = endlessBest(z), record = secs > before;
  if (record) save.endless[z] = secs;
  const gold = Math.round(secs / 60 * (25 + z * 15));
  save.gold += gold;
  persist();
  return { secs, before, record, gold, best: Math.max(before, secs) };
}

export const mmss = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
export const diffName = k => DIFFICULTIES[k]?.name || '';
