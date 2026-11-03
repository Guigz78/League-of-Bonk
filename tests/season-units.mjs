// Tests ciblés de season.js / daily.js dans la vraie page (fausse date) : récompenses (champion verrouillé, titres en
// double), titres de save.unlocks, XP en Abysse, Bonus du jour (épuisement et remise à zéro le lendemain), longue
// absence (une seule saison de plus), quêtes de la semaine finies données d'office, calendrier qui boucle, succès.
// Usage : PORT=8781 node units.mjs
import { chromium } from 'playwright';
const PORT = process.env.PORT || 8781;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addInitScript(() => {
  const R = Date; window.__off = 0;
  class FD extends R { constructor(...a) { if (a.length) super(...a); else super(R.now() + window.__off * 864e5); } static now() { return R.now() + window.__off * 864e5; } }
  window.Date = FD;
});
const p = await ctx.newPage();
const errs = []; p.on('pageerror', e => errs.push('PAGEERR ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('ERR ' + m.text()); });
await p.goto(`http://localhost:${PORT}/`);
await p.evaluate(() => localStorage.clear());
await p.reload(); await p.waitForTimeout(800);
const r = await p.evaluate(async () => {
  const S = await import('/js/save.js'), SE = await import('/js/season.js'), DA = await import('/js/daily.js'), D = await import('/js/data.js');
  const T = [], ok = (c, m) => T.push([!!c, m]);
  const save = S.save; Object.assign(save, S.freshSave()); save.cls = 'mage';
  // a. champion absent -> récompense de remplacement
  let g0 = save.gold, out = SE.grant({ cls: 'fantome', alt: { gold: 300 } });
  ok(save.gold === g0 + 300 && !save.unlocks?.['cls:fantome'] && !out.some(x => x.k === 'cls'), 'a. champion absent : remplacement (300 or)');
  // b. champion verrouillé -> clé d'unlock (contrat L2), puis remplacement la fois suivante
  D.CLASSES.fantome = { id: 'fantome', name: 'Fantôme', locked: true };
  out = SE.grant({ cls: 'fantome', alt: { gold: 300 } });
  ok(save.unlocks['cls:fantome'] === true && out[0].k === 'cls', 'b. champion verrouillé débloqué (save.unlocks["cls:fantome"])');
  g0 = save.gold; out = SE.grant({ cls: 'fantome', alt: { gold: 300 } });
  ok(save.gold === g0 + 300, 'b. déjà débloqué : remplacement');
  delete D.CLASSES.fantome;
  // c. titres : premier titre affiché d'office, doublon -> 250 or ; titres donnés par L2 (save.unlocks 'title:*')
  out = SE.grant({ title: 'eclaireur' });
  ok(save.titles.eclaireur && save.title === 'eclaireur', 'c. titre gagné et affiché');
  g0 = save.gold; SE.grant({ title: 'eclaireur' }); ok(save.gold === g0 + 250, 'c. titre en double : 250 or');
  save.unlocks['title:pilier'] = true;
  ok(SE.titleList().find(t => t.id === 'pilier').own, 'c. titre venu de save.unlocks listé');
  SE.setTitle('maitre'); ok(save.title === null, 'c. titre non possédé refusé');
  SE.setTitle('pilier'); ok(SE.titleName() === 'Pilier de la guilde', 'c. titre choisi');
  // d. coffres, pièces, bonus, améliorations
  const pc = save.pendingChests.length, up = Object.values(save.upgrades).reduce((a, b) => a + b, 0), bo = Object.values(save.boosts).reduce((a, b) => a + b, 0);
  SE.grant({ chest: [3, 3], parts: [2, 3], boost: 2, boostId: 'phenix', upg: 2 });
  ok(save.pendingChests.length === pc + 2 && save.pendingChests.slice(-2).every(c => c.tier === 3), 'd. 2 coffres mythiques en attente');
  ok(Object.values(save.upgrades).reduce((a, b) => a + b, 0) === up + 2, 'd. 2 niveaux de Boutique');
  ok(Object.values(save.boosts).reduce((a, b) => a + b, 0) === bo + 3 && save.boosts.phenix >= 1, 'd. 3 bonus dont la plume de phénix');
  ok(Object.values(save.parts).reduce((a, x) => a + x[2], 0) === 3, 'd. 3 pièces épiques');
  // e. XP : Abysse (diff 4) = ×2,5 ; Bonus du jour qui s'épuise puis revient le lendemain
  const S0 = SE.season(); S0.bUsed = 1200; S0.bDay = SE.dayKey(); // bonus déjà utilisé
  let x = SE.seasonRun({ diff: 4, cleared: [0], time: 60, kills: 0, loot: [], heat: 0, stage: 0 });
  ok(x.lines.find(l => l[0] === 'boss')[2] === 50 && x.bonus === 0, 'e. boss en Abysse II : 20 × 2,5 = 50 XP, pas de bonus');
  window.__off = 1; // lendemain
  x = SE.seasonRun({ diff: 0, cleared: [], time: 900, kills: 3000, loot: [{}, {}], heat: 1, stage: 0 });
  ok(x.base === 10 + 4 + 2 + 30 && x.bonus === x.base, `e. 1re partie du jour doublée (${x.base} + ${x.bonus})`);
  x = SE.seasonRun({ diff: 0, cleared: [], time: 600, kills: 0, loot: [], heat: 0, stage: 0 });
  ok(x.bonus === Math.round(x.base * 300 / 600) && x.left === 0, `e. 2e partie : 5 min sur 10 doublées (${x.base} + ${x.bonus})`);
  x = SE.seasonRun({ diff: 0, cleared: [], time: 600, kills: 0, loot: [], heat: 0, stage: 0 });
  ok(x.bonus === 0, 'e. bonus épuisé');
  window.__off = 2;
  ok(SE.bonusLeft() === 1200, 'e. bonus revenu le jour suivant');
  // f. quêtes de la semaine : finie pas réclamée -> donnée d'office à la semaine suivante
  const W = DA.ensureWeekly(), q = W.quests[0], Q = D.WEEKLY.find(z => z.id === q.id);
  const st = Q.stat.includes(':') ? null : Q.stat;
  if (['c200', 'st3'].includes(st)) save.feats[st] += q.n; else if (st === 'hard' || st === 'night') save.diffWins[0][st === 'hard' ? 1 : 2] += q.n; else save.stats[st] += q.n;
  ok(DA.weeklyList()[0].ready, `f. quête de la semaine « ${q.id} » prête`);
  g0 = save.gold; const fw = save.feats.weekly, ch = save.pendingChests.length;
  window.__off = 9; // semaine 2 de la saison
  DA.ensureWeekly();
  ok(save.weekly.auto === 1 && save.gold === g0 + q.gold && save.feats.weekly === fw + 1 && save.pendingChests.length === ch + 1, 'f. donnée d\'office (or, coffre, compteur)');
  ok(SE.seasonWeek().w === 1 && save.weekly.week === SE.seasonWeek().key, 'f. semaine 2 tirée');
  // g. calendrier : 20 jours puis on recommence, un jour manqué ne remet rien à zéro, titre au 20e
  save.login = { day: 18, last: '' }; save.title = null;
  let c = DA.claimLogin(); ok(c.day === 18 && save.login.day === 19, 'g. jour 19');
  ok(DA.claimLogin() === null, 'g. une seule récompense par jour');
  window.__off = 12; c = DA.claimLogin();
  ok(c.day === 19 && save.login.day === 0 && save.titles.fidele && c.got.some(g => g.k === 'title'), 'g. jour 20 (titre « Assidu ») puis retour au jour 1');
  save.login = { day: 57, last: 'x' }; ok(DA.loginState().day === 19, 'g. jour invalide ramené à 19');
  // h. longue absence : une seule saison de plus, qui commence le jour du retour ; paliers donnés d'office
  const s1 = SE.season(); s1.xp = 5000; s1.got = [1, 2];
  const t1 = SE.tierOf(5000); g0 = save.gold;
  window.__off = 75;
  const s2 = SE.season();
  ok(s2.n === s1.n + 1 && s2.start === SE.dayKey() && s2.xp === 0, `h. saison ${s2.n} commence au retour (${s2.start})`);
  ok(s2.prev.auto.length === t1 - 2 && s2.prev.tier === t1 && save.gold > g0, `h. ${t1 - 2} paliers donnés d'office`);
  ok(SE.seasonDay().day === 1 && SE.seasonDay().left === 20, 'h. jour 1/20');
  // i. succès : nombre, étoiles d'un monde, titre d'un succès
  ok(SE.achList().length >= 73, `i. ${SE.achList().length} succès (73 + champions et giga boss)`);
  save.diffCleared[0] = 3; save.stats.kills = 260000; save.title = null;
  const got = SE.checkAchievements().map(a => a.id);
  ok(got.includes('star_0') && got.includes('kills3') && save.titles.fleau && save.title === 'fleau', 'i. étoiles du monde 1, Massacre III et son titre');
  ok(SE.achList().every(a => a.val <= a.goal && a.val >= 0), 'i. progressions bornées');
  S.persist();
  return T;
});
let bad = 0;
for (const [o, m] of r) { console.log((o ? 'OK   ' : 'ÉCHEC') + ' ' + m); if (!o) bad++; }
// persistance : la sauvegarde rechargée garde tout
await p.reload(); await p.waitForTimeout(800);
const k = await p.evaluate(async () => { const S = await import('/js/save.js'); return { n: S.save.season.n, titles: Object.keys(S.save.titles), unlocks: S.save.unlocks, feats: S.save.feats.weekly }; });
console.log('après rechargement', JSON.stringify(k));
console.log(bad ? `${bad} échec(s)` : 'tous les tests passent');
console.log(errs.length ? errs.join('\n') : 'no errors');
await b.close();
