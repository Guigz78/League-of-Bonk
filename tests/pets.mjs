// Familiers : les 6 nouveaux (défi de la semaine, mode infini, coffres, Abysse, histoire, giga boss) — progression affichée
// tant qu'ils sont verrouillés, déblocage annoncé quand l'objectif est atteint, puis chaque pouvoir essayé en partie.
import { chromium, devices } from 'playwright';
import fs from 'fs';
const OUT = process.env.OUT; fs.mkdirSync(OUT, { recursive: true });
const VP = process.env.VP || '13', URL0 = `http://localhost:${process.env.PORT || 8765}/`;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const dev = VP === 'se' ? { ...devices['iPhone SE'], viewport: { width: 320, height: 568 } } : { ...devices['iPhone 13'] };
const p = await (await b.newContext(dev)).newPage();
const errs = [];
p.on('pageerror', e => errs.push('PAGEERR ' + e.message + ' ' + (e.stack || '').split('\n')[1]));
const wait = ms => p.waitForTimeout(ms);
const shot = n => p.screenshot({ path: `${OUT}/${VP}-${n}.png` });
const dismiss = async () => { for (let i = 0; i < 4; i++) { if (!(await p.$('.modal-wrap'))) break; await p.evaluate(() => document.querySelector('.modal-wrap .btn.ghost, .modal-wrap .btn')?.click()); await wait(500); } };
const NEW = ['cocotte', 'givret', 'grigou', 'zip', 'plume', 'gorgothin'];

await p.goto(URL0);
await p.evaluate(async () => {
  localStorage.clear(); const S = await import('/js/save.js'), s = S.save;
  s.cls = 'knight'; s.tutorialDone = true; s.stats.runs = 12; s.unlockedZone = 1; s.zoneCleared = [true, false, false, false, false, false];
  s.pets = ['poro']; s.pet = 'poro'; s.stats.chests = 17; s.endless = { 0: 95 }; s.storyCh = { c1: 7, c2: 3 };
  S.persist();
});
await p.reload(); await wait(2500); await dismiss();
await p.evaluate(() => document.querySelector('[data-act=tab][data-tab=gear]')?.click()); await wait(900);
await p.evaluate(() => document.querySelector('.pets')?.scrollIntoView({ block: 'center' })); await wait(400); await shot('01-verrouilles');
console.log('verrouillés :', await p.evaluate(() => [...document.querySelectorAll('.pet-card.locked small')].map(x => x.innerText.replace(/\s+/g, ' ')).join(' | ')));
console.log('titre :', await p.evaluate(() => [...document.querySelectorAll('.section-t')].find(x => /Familier/.test(x.textContent))?.innerText.replace(/\s+/g, ' ')));

// objectifs atteints → annonce à la fin de la partie suivante (ici : appel direct, comme après un bilan)
await p.evaluate(async () => {
  const S = await import('/js/save.js'), s = S.save;
  s.stats.weeklyWins = 1; s.endless = { 0: 301 }; s.stats.chests = 40; s.abyss = [3, 0, 0, 0, 0, 0]; s.stats.gigaKills = 1;
  s.storyCh = { c1: 7, c2: 7, c3: 7, c4: 7, c5: 7, c6: 7, c7: 7, c8: 7 };
  const G = await import('/js/game.js'); G.announceAchievements();
});
await wait(600);
console.log('annonce :', await p.evaluate(() => [...document.querySelectorAll('.toast')].map(t => t.innerText.replace(/\s+/g, ' ')).find(t => /familier/i.test(t)) || '(aucune)'));
console.log('obtenus :', await p.evaluate(() => JSON.parse(localStorage.getItem('lob_save_v1')).pets.join(',')));
await p.evaluate(() => document.querySelector('[data-act=tab][data-tab=gear]')?.click()); await wait(1500);
await p.evaluate(() => document.querySelector('.pets')?.scrollIntoView({ block: 'center' })); await wait(1200); await shot('02-obtenus');
await p.evaluate(() => document.querySelector('.pet-card[data-id=cocotte]')?.click()); await wait(500);
console.log('actif :', await p.evaluate(() => JSON.parse(localStorage.getItem('lob_save_v1')).pet));

// en partie : chaque pouvoir sur une meute autour du héros
await p.evaluate(() => document.querySelector('[data-act=tab][data-tab=adventure]')?.click()); await wait(600); await dismiss();
await p.evaluate(() => document.querySelector('[data-act=play]')?.click()); await wait(900);
await p.evaluate(() => document.querySelector('.modal .btn.primary')?.click());
await p.waitForFunction(() => window.__lobRun && !window.__lobRun.over, null, { timeout: 20000 }); await wait(2500);
for (const id of NEW) {
  const res = await p.evaluate(async id => {
    const S = await import('/js/save.js'), r = window.__lobRun, P = r.p;
    S.save.pet = id; r.pet.id = id; r.petT = 0; r.recalc?.(); r.onLevelUp = (t, o, d) => d(o[0]); r.onChest = (c, g, d) => d && d();
    r.enemies.forEach(e => { e.dead = true; }); r.update(1 / 30);
    for (let i = 0; i < 14; i++) { const a = i / 14 * 6.283; r.addEnemy(r.zone.monsters[i % 4], i % 4, { x: P.x + Math.cos(a) * 110, y: P.y + Math.sin(a) * 110 }); }
    const boss = r.addEnemy(r.zone.monsters[4], 4, { elite: true, x: P.x + 60, y: P.y - 60 });
    const hp0 = r.enemies.filter(e => !e.dead).reduce((n, e) => n + e.hp, 0), gold0 = r.gold, xp0 = P.xpMul;
    let frozen = 0, bolts = 0; const cb = r.chainBolt; r.chainBolt = function (e) { bolts++; return cb.call(this, e); };
    for (let i = 0; i < 30 * 6; i++) {
      P.inv = 9; P.hp = P.maxHp;
      r.update(1 / 30);
      frozen = Math.max(frozen, r.enemies.filter(e => !e.dead && e.freeze > 0).length);
    }
    // or ramassé : une pièce de 10 posée sur le héros
    r.pickups.push({ type: 'gold', x: P.x, y: P.y, v: 10 }); const g1 = r.gold; for (let i = 0; i < 6; i++) r.update(1 / 30);
    // dégâts sur un élite (Gorgothin : +20 %)
    const e2 = r.addEnemy(r.zone.monsters[4], 4, { elite: true, x: P.x + 400, y: P.y + 400 }); e2.hp = e2.maxHp = 1e7;
    let sum = 0; const orig = Math.random; Math.random = () => 0.5; for (let i = 0; i < 20; i++) { const h = e2.hp; r.hitEnemy(e2, 100, { noCrit: true, quiet: true }); sum += h - e2.hp; } Math.random = orig; e2.dead = true;
    r.chainBolt = cb;
    const hp1 = r.enemies.filter(e => !e.dead && e !== e2).reduce((n, e) => n + e.hp, 0);
    return `${id} : dégâts ${Math.round(hp0 - hp1)} | gelés ${frozen} | éclairs ${bolts} | pièce de 10 → ${r.gold - g1} or | XP ×${xp0.toFixed(2)} | coup de 100 sur un élite → ${Math.round(sum / 20)}`;
  }, id);
  console.log(res);
  if (id === 'cocotte' || id === 'zip') { await wait(200); await shot(`03-partie-${id}`); }
}
console.log(errs.length ? errs.join('\n') : 'no errors');
await b.close();
