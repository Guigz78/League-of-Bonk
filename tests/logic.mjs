// L2 : tests de logique dans la page (sans rendu) : verrous du tirage, défis, records, maîtrise, Abysse, migration.
// Usage : PORT=8782 node logic.mjs
import { chromium } from 'playwright';
const PORT = process.env.PORT || 8782;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
const errs = [];
p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
p.on('console', m => { if (m.type() === 'error') errs.push('ERR ' + m.text()); });
await p.goto(`http://localhost:${PORT}/`);
await p.waitForTimeout(800);
const res = await p.evaluate(async () => {
  const out = [];
  const ok = (name, cond, extra = '') => out.push(`${cond ? 'OK  ' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
  const S = await import('/js/save.js'), D = await import('/js/data.js'), U = await import('/js/unlocks.js'), M = await import('/js/mastery.js'), A = await import('/js/abyss.js');
  const { Run } = await import('/js/run.js');
  const save = S.save;
  const reset = () => { Object.assign(save, S.freshSave()); save.cls = 'mage'; };
  const mk = (o = {}) => new Run({ zone: D.ZONES[0], diff: 0, onEnd() {}, onPause() {}, onLevelUp() {}, onChest() {}, onDefeat() {}, ...o });

  // 1) tirage : jamais d'arme ou de tome verrouillé (sauf l'arme de départ)
  reset();
  let seenW = new Set(), seenT = new Set();
  for (const cls of ['mage', 'archer', 'knight']) {
    save.cls = cls;
    for (let i = 0; i < 300; i++) { const r = mk(); r.p.weapons.length = 1; for (const c of r.choices(3)) { if (c.kind === 'weapon') seenW.add(c.id); if (c.kind === 'tome') seenT.add(c.id); } }
  }
  ok('tirage sans armes verrouillées', D.LOCKED.w.every(w => !seenW.has(w)), 'armes vues : ' + [...seenW].join(','));
  ok('tirage sans tomes verrouillés', D.LOCKED.t.every(t => !seenT.has(t)), 'tomes vus : ' + [...seenT].join(','));
  // arsenaux : chaque champion ne se voit proposer que ses 4 armes (départ comprise)
  const ars3 = new Set(['mage', 'archer', 'knight'].flatMap(c => D.ARSENAL[c]));
  ok('armes des arsenaux proposées', seenW.size === ars3.size && [...seenW].every(w => ars3.has(w)), seenW.size);
  save.unlocks['w:frost'] = true; save.unlocks['t:boots'] = true;
  seenW = new Set(); seenT = new Set();
  for (let i = 0; i < 400; i++) { const r = mk(); r.p.weapons.length = 1; for (const c of r.choices(3)) { if (c.kind === 'weapon') seenW.add(c.id); if (c.kind === 'tome') seenT.add(c.id); } }
  ok('seulement les armes de son arsenal', [...seenW].every(w => D.ARSENAL[save.cls].includes(w)) && seenW.size === D.ARSENAL[save.cls].length, [...seenW].join(','));
  ok('tome débloqué proposé', seenT.has('boots') && !seenT.has('wisdom'));
  // arme de départ verrouillée (champion de L3) : toujours ouverte pour lui
  ok('arme de départ toujours ouverte', U.canPickWeapon('snowball', 'mage') === false && (() => { D.CLASSES.mage.weapon = 'snowball'; const v = U.canPickWeapon('snowball', 'mage'); D.CLASSES.mage.weapon = 'beam'; return v; })());

  // 2) défis : clés, or, coffres ; récompenses données une seule fois
  reset();
  save.stats.kills = 1500; save.stats.wins = 1; save.gold = 0;
  let got = U.checkChallenges();
  ok('défis remplis validés', got.map(g => g.c.id).sort().join(',') === 'boss1,kills1k', got.map(g => g.c.id).join(','));
  ok('clés données', save.unlocks['t:boots'] && save.pendingChests.length === 1); // armes plus verrouillées : coffre à la place
  ok('or des défis', save.gold === 140, save.gold);
  ok('pas de double récompense', U.checkChallenges().length === 0 && save.gold === 140);
  save.stats.chests = 5; got = U.checkChallenges();
  ok('défi à clé', got.length === 1 && save.unlocks['boost:trefle'] && save.pendingChests.length === 1, 'Pilleur : bonus, pas de coffre en plus');
  save.stats.portals = 3; save.zoneCleared[1] = true; got = U.checkChallenges();
  ok('Voyageur + Jungle', got.length === 2 && save.unlocks['boost:sang'] && save.pendingChests.length === 2);
  // défi d'un champion absent (L3) masqué
  ok('défis des champions de L3 masqués sans eux', !U.challengeList().some(c => c.need && !D.CLASSES[c.need]), U.challengeList().length + ' défis');

  // 3) records d'une partie (run.track) et défis qui en dépendent
  reset();
  const t = { kills: 900, level: 26, maxCombo: 1100, evoWeapons: 3, elites: 20, lsHeal: 500, bossFast: 18.4, totemBoss: 1, weaponKills: { lightning: 6100, orbs: 2600 } };
  U.recordRun(t, 'mage');
  ok('records', save.rec.wk.lightning === 6100 && save.rec.lvl.mage === 26 && save.rec.combo === 1100 && save.rec.evoRun === 3 && save.rec.bossFast === 18 && save.rec.totemBoss === 1);
  got = U.checkChallenges().map(g => g.c.id).sort().join(',');
  ok('défis des records', got === 'bossfast,combo1000,combo300,evo3,lvl15,lvl25_mage,monk,totemboss,wk_lightning,wk_orbs'.split(',').filter(x => x !== 'lvl15').join(','), got);
  U.recordRun({ ...t, bossFast: 25, maxCombo: 50, weaponKills: { lightning: 10 } }, 'mage');
  ok('records : meilleur gardé, cumuls ajoutés', save.rec.bossFast === 18 && save.rec.combo === 1100 && save.rec.wk.lightning === 6110 && save.rec.elites === 40 && save.rec.heal === 1000);

  // 4) maîtrise
  reset();
  const xp = M.masteryXp({ kills: 4000, level: 30 }, 2, 0, 0);
  ok('XP de maîtrise (Normal, 2 mondes)', xp === 100 + 120 + 100, xp);
  ok('XP en Abysse V (Cauchemar)', M.masteryXp({ kills: 4000, level: 30 }, 1, 2, 5) === Math.round(100 + 120 + 100 * 1.75));
  let g = M.gainMastery('mage', 3150);
  ok('niveau du champion 1 → 6 et paliers', g.from === 1 && g.to === 6 && g.miles.join(',') === '2,3,4,5,6', JSON.stringify(g));
  U.checkChallenges();
  ok('aura (niveau 3) sans le titre (niveau 7)', save.unlocks['aura:m_mage'] && !save.unlocks['title:m_mage']);
  const st0 = S.playerStats('archer'), st1 = S.playerStats('mage');
  ok('bonus de maîtrise dans les stats', st1.hp === Math.round(D.CLASSES.mage.hp * 1.075) && st1.atk === Math.round(D.CLASSES.mage.atk * 1.075), `${st1.hp} PV ${st1.atk} ATQ (archère ${st0.hp}/${st0.atk})`);
  save.mastery.mage = 30000;
  ok('relance de plus au niveau 5', mk().rerolls === D.REROLLS + 1 && (save.cls = 'archer', mk().rerolls === D.REROLLS));
  save.cls = 'mage';
  ok('niveau 10 puis étoiles à l\'infini', Math.abs(D.masteryBonus(10).dmg - 0.135) < 1e-9 && Math.abs(D.masteryBonus(10, 4).hp - 0.155) < 1e-9 && D.masteryOf(30000).stars === 12);

  // 5) Abysse
  reset();
  ok('Abysse fermée sans Cauchemar', A.abyssTop(0) === 0);
  save.diffCleared[0] = 3; ok('Abysse fermée sans le défi', A.abyssTop(0) === 0);
  U.checkChallenges(); ok('Porte de l\'Abysse', save.unlocks.abyss && A.abyssTop(0) === 1);
  const R3 = A.runDiff(0, 3), N = D.DIFFICULTIES[2];
  ok('Abysse III sur la base de Cauchemar', R3.name === 'Abysse III' && Math.abs(R3.hp - N.hp * 1.4 ** 3) < 1e-9 && Math.abs(R3.dmg - N.dmg * 1.2 ** 3) < 1e-9 && R3.curses.size === 3);
  ok('malédictions cumulées', [...A.runDiff(2, 10).curses].length === 10 && A.runDiff(2, 10).mods === N.mods + 1 && A.runDiff(2, 10).heal === N.heal * 0.6);
  const run = mk({ diff: 0, abyss: 4 });
  ok('partie en Abysse IV', run.diffId === 2 && run.abyss === 4 && run.curse.has('short') && run.duration === Math.round(D.ZONE_TIME[0] * 0.8) && run.track.abyss === 4, `${run.diff.name} ${run.duration}s`);
  const run6 = mk({ abyss: 6 });
  ok('totem de la Horde imposé (palier 6)', run6.wm.spawn === 1.35 && run6.wm.gold === 1.25);
  save.abyss[0] = 0;
  const worlds = [{ z: D.ZONES[0], lines: [] }, { z: D.ZONES[1], lines: [] }];
  const W = A.abyssWin(1, [0, 1], worlds);
  ok('palier battu (et monde suivant par le portail)', save.abyss[0] === 1 && save.abyss[1] === 1 && W.gold === 300 && save.pendingChests.length === 2 && worlds[0].lines.length === 1, W.gold + ' or');
  const W2 = A.abyssWin(1, [0], [{ z: D.ZONES[0], lines: [] }]);
  ok('pas de 2e première victoire', W2.gold === 0 && save.pendingChests.length === 2);
  ok('palier suivant ouvert', A.abyssTop(0) === 2);
  save.abyss[0] = 10; ok('palier X au plus', A.abyssTop(0) === 10);

  // 6) fin de partie (endRunL2) : maîtrise, records, Abysse, défis
  reset(); save.diffCleared[0] = 3; save.unlocks.abyss = true;
  const L = U.endRunL2({ kills: 3000, level: 30, abyss: 1, track: { kills: 3000, level: 30, maxCombo: 320, weaponKills: { beam: 2000 }, elites: 10 } }, { cleared: [0], worlds: [{ z: D.ZONES[0], lines: [] }], k: 2 });
  ok('endRunL2', L.ms.xp > 0 && L.gold === 150 && save.abyss[0] === 1 && L.got.some(g => g.c.id === 'abyss1') && L.got.some(g => g.c.id === 'combo300'), `XP ${L.ms.xp}, défis ${L.got.map(g => g.c.id).join(',')}`);
  ok('bilan HTML', /Lumi niveau/.test(U.l2Results(L)) && /Premier plongeon/.test(U.l2Results(L)));

  // 7) migration d'une ancienne sauvegarde (sans champs L2)
  const old = S.freshSave();
  for (const k of ['unlocks', 'chal', 'rec', 'mastery', 'abyss', 'abyssSel', 'aura', 'l2']) delete old[k];
  Object.assign(old, { cls: 'knight', gold: 500, zoneCleared: [true, true, false, false, false, false], diffCleared: [3, 1, 0, 0, 0, 0], unlockedZone: 2, boosts: { phenix: 1, rage: 2 }, boostSel: ['phenix', 'rage'] });
  Object.assign(old.stats, { kills: 50000, wins: 12, bestLevel: 42, chests: 30, portals: 6, classWins: { mage: 1, archer: 1, knight: 9 }, bestStage: 1, runs: 20 });
  S.replaceSave(old);
  const s2 = S.save;
  ok('migration : champs L2 présents', s2.l2 === 1 && s2.l2New && s2.abyss.length === 6 && typeof s2.rec.wk === 'object' && s2.aura && !Array.isArray(s2.aura));
  ok('migration : bonus possédés débloqués', s2.unlocks['boost:phenix'] && !s2.unlocks['boost:rage'] && s2.boosts.phenix === 1 && s2.boostSel[0] === 'phenix');
  ok('migration : progression gardée', s2.gold === 500 && s2.stats.kills === 50000 && s2.diffCleared[0] === 3 && s2.cls === 'knight');
  const gold0 = s2.gold, got2 = U.checkChallenges().map(g => g.c.id);
  ok('migration : défis déjà remplis validés', ['kills1k', 'boss1', 'lvl15', 'chests5', 'portal1', 'world2', 'allcls', 'lvl40', 'night1'].every(id => got2.includes(id)) && !got2.includes('kills150k'), got2.join(','));
  ok('migration : récompenses payées', S.save.gold > gold0 && S.save.unlocks.abyss, `+${S.save.gold - gold0} or`);
  // sauvegarde corrompue / cloud
  S.replaceSave({ ...old, unlocks: 'x', chal: [1], rec: { wk: { beam: 'abc', orbs: -5 }, combo: 'NaN' }, mastery: { mage: -3, archer: 1e12 }, abyss: [99, -1], abyssSel: [5], aura: { mage: 'nope' }, l2: 1, cls: 'inconnu' });
  const s3 = S.save;
  ok('sauvegarde abîmée nettoyée', JSON.stringify(s3.unlocks) === '{}' && s3.rec.combo === 0 && !('beam' in s3.rec.wk) && s3.mastery.archer === 1e9 && !('mage' in s3.mastery) && s3.abyss[0] === 10 && s3.abyss[1] === 0 && s3.abyssSel[0] === 5 && JSON.stringify(s3.aura) === '{}' && s3.cls === null);
  // aura choisie : la couleur du dernier stade suit
  Object.assign(S.save, S.freshSave()); S.save.unlocks['aura:storm'] = true; // S.save : nouvel objet après replaceSave
  const c0 = D.EVOLUTIONS.mage.at(-1).aura;
  U.setAura('mage', 'storm');
  ok('aura choisie appliquée', D.EVOLUTIONS.mage.at(-1).aura === D.AURAS.storm.color && D.EVOLUTIONS.archer.at(-1).aura !== D.AURAS.storm.color);
  U.setAura('mage', 'prism'); ok('aura verrouillée refusée', D.EVOLUTIONS.mage.at(-1).aura === c0);
  return out;
});
for (const l of res) console.log(l);
console.log(`${res.filter(l => l.startsWith('OK')).length}/${res.length} OK`);
console.log(errs.length ? 'ERREURS :\n' + errs.join('\n') : 'no errors');
await b.close();
