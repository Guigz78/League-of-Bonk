// Saison de 20 jours « Pass d'expédition » : 40 paliers gratuits gagnés avec l'XP de saison (parties, quêtes du jour et
// de la semaine, calendrier de connexion). Bonus du jour : l'XP des parties compte double sur les 20 premières minutes
// de jeu de chaque journée (jouer un peu chaque jour rapporte plus que tout jouer d'un coup). Au bout de 20 jours la
// saison suivante commence (même parcours) et les paliers atteints mais pas réclamés sont donnés automatiquement.
// Aussi ici : distribution des récompenses (grant, partagée avec daily.js), succès à paliers (ACH_MORE) et titres.
// Rythme et calculs : bloc « L1 » à la fin de data.js.
import { save, persist, checkAchievements as checkBase } from './save.js';
import { SEASON_DAYS, SEASON_TIERS, SEASON_XP, SEASON_COST, SEASON_TRACK, TITLES, ACH_META, ACH_MORE, ACHIEVEMENTS,
  CLASSES, UPGRADES, BOOSTS, LOOT_TIERS, ZONES, PARTS, LEGEND_EFFECTS } from './data.js';

// ---------- Dates : jour local « AAAA-MM-JJ » ----------
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
// numéro de jour (différence en jours entre deux dates, sans souci d'heure d'été)
export const dayNum = k => { const [y, m, d] = String(k).split('-').map(Number); return Math.round(Date.UTC(y, (m || 1) - 1, d || 1) / 864e5); };
const okDay = k => typeof k === 'string' && /^\d{4}-\d\d-\d\d$/.test(k);
const rnd = n => Math.floor(Math.random() * n);

// ---------- Paliers ----------
// CUM[n] = XP totale pour atteindre le palier n
export const CUM = SEASON_COST.reduce((a, c) => (a.push(a[a.length - 1] + c), a), [0]);
export const tierOf = xp => { let n = 0; while (n < SEASON_TIERS && xp >= CUM[n + 1]) n++; return n; };

// numéro de jour -> « AAAA-MM-JJ » (inverse de dayNum)
export const keyOf = n => { const d = new Date(n * 864e5); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`; };

const blank = n => ({ n, start: dayKey(), xp: 0, got: [], bDay: '', bUsed: 0 });
export function feats() {
  return save.feats || (save.feats = { combo: 0, c200: 0, st3: 0, evoRun: 0, evo: {}, boss: {}, leg: [], weekly: 0, tierBest: 0, seasons: 0 });
}

// saison en cours : créée au besoin, remise en forme, et renouvelée au bout de 20 jours
export function season() {
  let S = save.season;
  if (!S || typeof S !== 'object' || !okDay(S.start)) { S = save.season = blank(Math.max(1, (S?.n | 0) || 1)); persist({ touch: false }); }
  S.n = Math.max(1, S.n | 0);
  S.xp = Math.max(0, Math.floor(+S.xp || 0));
  if (!Array.isArray(S.got)) S.got = [];
  if (dayNum(dayKey()) - dayNum(S.start) >= SEASON_DAYS) S = endSeason(S);
  return S;
}

// fin de saison : paliers atteints pas encore réclamés donnés d'office, puis saison suivante (même parcours)
function endSeason(S) {
  const tier = tierOf(S.xp), auto = [], got = [];
  for (let p = 1; p <= tier; p++) if (!S.got.includes(p)) { S.got.push(p); auto.push(p); grant(SEASON_TRACK[p - 1], got); }
  feats().seasons++;
  const N = save.season = blank(S.n + 1);
  N.prev = { n: S.n, tier, auto, got: sumUp(got), seen: false }; // bilan affiché une fois à l'accueil
  persist();
  return N;
}

// regroupe une liste de récompenses données (grant) : { gold, chests: [rangs], parts, boosts, upg, titles, cls }
export function sumUp(list) {
  const o = { gold: 0, chests: [], parts: 0, boosts: 0, upg: 0, titles: [], cls: [] };
  for (const g of list || []) {
    if (g.k === 'gold') o.gold += g.n;
    else if (g.k === 'chest') o.chests.push(g.t);
    else if (g.k === 'parts') o.parts += g.n;
    else if (g.k === 'boost') o.boosts++;
    else if (g.k === 'upg') o.upg++;
    else if (g.k === 'title') o.titles.push(g.id);
    else if (g.k === 'cls') o.cls.push(g.id);
  }
  return o;
}

// jour de la saison (1 à 20) et jours restants (aujourd'hui compris)
export function seasonDay() {
  const S = season(), d = Math.max(0, dayNum(dayKey()) - dayNum(S.start));
  return { day: Math.min(SEASON_DAYS, d + 1), left: Math.max(1, SEASON_DAYS - d) };
}
// semaine de saison (quêtes de la semaine) : n° 0 à 2 (jours 1-7, 8-14, 15-20), clé de tirage (date de son premier
// jour), jours restants avant les suivantes (aujourd'hui compris)
export function seasonWeek() {
  const S = season(), d = Math.max(0, dayNum(dayKey()) - dayNum(S.start)), w = Math.min(2, Math.floor(d / 7));
  const end = w < 2 ? (w + 1) * 7 : SEASON_DAYS;
  return { w, key: keyOf(dayNum(S.start) + 7 * w), left: Math.max(1, end - d), n: S.n };
}

// état affichable : palier atteint, XP dans le palier en cours, paliers à réclamer
export function seasonInfo() {
  const S = season(), tier = tierOf(S.xp), max = tier >= SEASON_TIERS;
  const cur = max ? SEASON_COST[SEASON_TIERS - 1] : S.xp - CUM[tier], need = SEASON_COST[Math.min(tier, SEASON_TIERS - 1)];
  return { S, n: S.n, xp: S.xp, tier, max, cur, need, ready: claimable(), next: max ? null : tier + 1, ...seasonDay(), bonus: bonusLeft() };
}
export function claimable() {
  const S = season(), t = tierOf(S.xp), out = [];
  for (let p = 1; p <= t; p++) if (!S.got.includes(p)) out.push(p);
  return out;
}

// réclame le palier p (récompenses ajoutées tout de suite à la sauvegarde)
export function claimTier(p) {
  const S = season();
  if (!(p >= 1 && p <= tierOf(S.xp)) || S.got.includes(p)) return null;
  S.got.push(p);
  const got = grant(SEASON_TRACK[p - 1]);
  persist();
  return got;
}
export function claimAll() {
  const all = [];
  for (const p of claimable()) all.push(...(claimTier(p) || []));
  return all;
}

// ---------- XP de saison ----------
export function addXp(n) {
  const S = season(), t0 = tierOf(S.xp);
  S.xp += Math.max(0, Math.round(+n || 0));
  const t1 = tierOf(S.xp), F = feats();
  F.tierBest = Math.max(F.tierBest | 0, t1);
  return { t0, t1, xp: S.xp };
}

// Bonus du jour : secondes de jeu encore comptées double aujourd'hui
export function bonusLeft() {
  const S = save.season && typeof save.season === 'object' ? save.season : season(), d = dayKey();
  if (S.bDay !== d) { S.bDay = d; S.bUsed = 0; }
  return Math.max(0, SEASON_XP.bonus - (+S.bUsed || 0));
}

// multiplicateur de difficulté de l'XP (Abysse au-delà de Cauchemar : +0,25 par niveau)
const diffMul = k => SEASON_XP.diff[k] ?? SEASON_XP.diff[SEASON_XP.diff.length - 1] + 0.25 * (k - SEASON_XP.diff.length + 1);

// Fin de partie (un seul appel, depuis endRun de game.js) : XP de saison de la partie et compteurs des succès.
// Lit run.track (contrat L2) s'il existe, sinon le bilan habituel de run.js.
export function seasonRun(sum) {
  const S = season(), X = SEASON_XP, T = sum.track || {}, F = feats();
  const k = Math.max(0, (T.diff ?? sum.diff) | 0);
  const cleared = (Array.isArray(sum.cleared) ? sum.cleared : []).filter(z => ZONES[z]);
  const time = Math.max(0, +(T.time ?? sum.time) || 0), kills = Math.max(0, (T.kills ?? sum.kills) | 0);
  const chests = Math.max(0, (T.chests ?? (Array.isArray(sum.loot) ? sum.loot.length : 0)) | 0), totems = Math.max(0, (T.totems ?? sum.heat) | 0);
  const lines = [
    ['boss', cleared.length, Math.round(cleared.reduce((n, z) => n + X.boss + X.bossZone * z, 0) * diffMul(k))],
    ['kills', kills, Math.floor(kills / X.kills)],
    ['chests', chests, chests * X.chest],
    ['totems', totems, totems * X.totem],
    ['time', time, Math.floor(time / 60 * X.min)],
  ].filter(l => l[2] > 0);
  const base = lines.reduce((n, l) => n + l[2], 0);
  const left = bonusLeft(), used = Math.min(left, time);
  const bonus = time > 0 ? Math.round(base * (X.bonusMul - 1) * used / time) : 0;
  S.bUsed = (+S.bUsed || 0) + used;
  // compteurs des succès et des quêtes de la semaine
  const combo = Math.max(0, (T.maxCombo ?? sum.combo) | 0), evos = Math.max(0, (T.evoWeapons ?? sum.evos?.length) | 0), cls = T.cls || save.cls;
  F.combo = Math.max(F.combo | 0, combo);
  if (combo >= 200) F.c200 = (F.c200 | 0) + 1;
  if ((sum.stage | 0) >= 2) F.st3 = (F.st3 | 0) + 1;
  F.evoRun = Math.max(F.evoRun | 0, evos);
  if (cls) { F.evo[cls] = Math.max(F.evo[cls] | 0, sum.evo | 0); F.boss[cls] = (F.boss[cls] | 0) + cleared.length; }
  const { t0, t1 } = addXp(base + bonus);
  persist();
  return { lines, base, bonus, xp: base + bonus, t0, t1, left: bonusLeft(), info: seasonInfo() };
}

// ---------- Récompenses (saison, calendrier, quêtes de la semaine) ----------
// Applique une récompense { gold, chest, parts, boost, boostId, upg, title, cls, alt } à la sauvegarde.
// Retourne ce qui a été donné, tirages compris : [{ k: 'gold'|'chest'|'parts'|'boost'|'upg'|'title'|'cls', … }]
export function grant(R, out = []) {
  if (!R) return out;
  const zone = Math.max(0, Math.min(ZONES.length - 1, save.unlockedZone || 0));
  if (R.cls) {
    const U = save.unlocks || (save.unlocks = {});
    if (CLASSES[R.cls]?.locked && !U['cls:' + R.cls]) { U['cls:' + R.cls] = true; out.push({ k: 'cls', id: R.cls }); }
    else grant(R.alt, out); // champion absent ou déjà jouable : récompense de remplacement
  }
  for (const t of [].concat(R.chest ?? [])) {
    const tier = Math.max(0, Math.min(LOOT_TIERS.length - 1, t | 0));
    save.pendingChests.push({ tier, zone });
    out.push({ k: 'chest', t: tier });
  }
  if (R.parts) {
    const [r, n] = R.parts, slots = Object.keys(PARTS);
    for (let i = 0; i < n; i++) save.parts[slots[rnd(slots.length)]][r]++;
    out.push({ k: 'parts', r, n });
  }
  const ids = Object.keys(BOOSTS);
  for (let i = 0; i < (R.boost | 0); i++) { const id = ids[rnd(ids.length)]; save.boosts[id] = (save.boosts[id] || 0) + 1; out.push({ k: 'boost', id }); }
  if (BOOSTS[R.boostId]) { save.boosts[R.boostId] = (save.boosts[R.boostId] || 0) + 1; out.push({ k: 'boost', id: R.boostId }); }
  for (let i = 0; i < (R.upg | 0); i++) {
    const ks = Object.keys(UPGRADES).filter(k => (save.upgrades[k] || 0) < UPGRADES[k].max);
    if (!ks.length) { save.gold += 300; out.push({ k: 'gold', n: 300 }); continue; } // Boutique au maximum : de l'or
    const k = ks[rnd(ks.length)];
    save.upgrades[k] = (save.upgrades[k] || 0) + 1;
    out.push({ k: 'upg', id: k, lv: save.upgrades[k] });
  }
  if (R.title && TITLES[R.title]) {
    if (hasTitle(R.title)) { save.gold += 250; out.push({ k: 'gold', n: 250 }); } // déjà gagné (saison suivante)
    else { earnTitle(R.title); out.push({ k: 'title', id: R.title }); }
  }
  if (R.gold) { save.gold += R.gold; out.push({ k: 'gold', n: R.gold }); }
  return out;
}

// ---------- Titres ----------
export const hasTitle = id => id === 'recrue' || !!save.titles?.[id] || !!save.unlocks?.['title:' + id];
export const titleList = () => Object.entries(TITLES).map(([id, T]) => ({ id, ...T, own: hasTitle(id), on: save.title === id }));
export const titleName = () => (save.title && TITLES[save.title] && hasTitle(save.title) ? TITLES[save.title].name : '');
// titre gagné : affiché tout de suite si le joueur n'en a pas encore choisi
export function earnTitle(id) {
  (save.titles || (save.titles = {}))[id] = Date.now();
  if (!save.title || save.title === 'recrue') save.title = id;
}
export function setTitle(id) {
  save.title = TITLES[id] && hasTitle(id) ? id : null;
  persist();
}

// ---------- Succès ----------
const BASE_CLS = ['mage', 'archer', 'knight'];
const BEAST = new Set(ZONES.flatMap(z => [...z.monsters.map(m => m.name), ...(z.boss ? [z.boss.name] : [])]));
const sumWins = from => (save.diffWins || []).reduce((n, a) => n + (Array.isArray(a) ? a.slice(from).reduce((x, y) => x + (y | 0), 0) : 0), 0);
const dc = () => save.diffCleared || [];
// valeur actuelle d'une statistique de succès ('kills', 'zone:3', 'clsBoss:mage'…)
export function achValue(stat) {
  const s = save, st = s.stats, F = feats(), [key, arg] = String(stat).split(':');
  switch (key) {
    case 'zone': return dc()[+arg] || 0;
    case 'clsBoss': return F.boss?.[arg] | 0;
    case 'clsEvo': return F.evo?.[arg] | 0;
    case 'formAny': return Math.max(0, ...Object.values(F.evo || {}).map(v => v | 0));
    case 'clsWon': return BASE_CLS.filter(c => st.classWins?.[c]).length;
    case 'hard': return sumWins(1);
    case 'night': return sumWins(2);
    case 'hardZones': return dc().filter(n => n >= 2).length;
    case 'nightZones': return dc().filter(n => n >= 3).length;
    case 'stars': return dc().filter(n => n >= 3).length;
    case 'stage': return st.runs ? (st.bestStage || 0) + 1 : 0;
    case 'clean': return st.cleanZone ? 1 : 0;
    case 'gold': return s.gold;
    case 'epic': return s.inventory.some(i => i.rarity === 'epic' || i.rarity === 'legendary') ? 1 : 0;
    case 'legendary': return s.inventory.some(i => i.rarity === 'legendary') ? 1 : 0;
    case 'itemLv': return Math.max(0, ...s.inventory.map(i => i.lv || 0));
    case 'pets': return s.pets.length;
    case 'legFx': return (F.leg || []).length;
    case 'seen': return Object.keys(st.seen || {}).filter(n => BEAST.has(n)).length;
    case 'combo': case 'c200': case 'st3': case 'evoRun': case 'weekly': case 'tierBest': return F[key] | 0;
    default: return +st[key] || 0;
  }
}

// tous les succès (d'origine puis nouveaux) avec catégorie, progression et état
export function achList() {
  const old = ACHIEVEMENTS.map(a => { const [cat, stat, goal] = ACH_META[a.id] || ['coll', '', 1]; return { ...a, cat, stat, goal }; });
  return [...old, ...ACH_MORE].map(a => {
    const got = !!save.achievements[a.id], v = a.stat ? achValue(a.stat) : 0;
    return { ...a, got, val: got ? a.goal : Math.min(a.goal, Math.max(0, v)) };
  });
}

// remplace checkAchievements de save.js (même usage) : succès d'origine + nouveaux, or et titres donnés
export function checkAchievements() {
  const F = feats();
  if (!Array.isArray(F.leg)) F.leg = [];
  for (const it of save.inventory) if (it.effect && LEGEND_EFFECTS[it.effect] && !F.leg.includes(it.effect)) F.leg.push(it.effect);
  const got = checkBase();
  for (const a of ACH_MORE) {
    if (save.achievements[a.id] || achValue(a.stat) < a.goal) continue;
    save.achievements[a.id] = Date.now();
    save.gold += a.gold;
    if (a.title && TITLES[a.title] && !hasTitle(a.title)) earnTitle(a.title);
    got.push(a);
  }
  return got;
}
