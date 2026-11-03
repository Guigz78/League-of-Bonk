// Histoire 2 (12 chapitres) : nouveau joueur → c1 (boss, carte de titre, bulles, réplique, bilan étoiles) → c2 (mission
// ramasser : marques overlay, Pompon) → carte des chapitres → fiche c4 (tenir 90 s) → c6 (gardes) → c12 (Gorgoth, banquet, FIN).
import { chromium, devices } from 'playwright';
import fs from 'fs';
const OUT = process.env.OUT; fs.mkdirSync(OUT, { recursive: true });
const VP = process.env.VP || '13';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const dev = VP === 'se' ? { ...devices['iPhone SE'], viewport: { width: 320, height: 568 } } : { ...devices['iPhone 13'] };
const p = await (await b.newContext(dev)).newPage();
const errs = []; p.on('pageerror', e => errs.push('PAGEERR ' + e.message + ' ' + (e.stack || '').split('\n')[1]));
p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
const shot = n => p.screenshot({ path: `${OUT}/${VP}-${n}.png` });
const wait = ms => p.waitForTimeout(ms);
const bubble = () => p.evaluate(() => { const s = document.querySelector('.story-sc'); if (!s) return '(pas de scène)'; if (!s.classList.contains('card-off') && s.querySelector('.ss-card')) return 'CARTE: ' + s.querySelector('.ss-card').innerText.replace(/\s+/g, ' '); const b = s.querySelector('.ss-bubble'); return `[${b.className.replace('ss-bubble ', '')}] ${s.querySelector('.ss-name')?.textContent}: ${s.querySelector('.ss-txt')?.textContent} ${s.querySelector('.ss-p.on .ss-emo')?.textContent || ''}`; });
const tapScene = async () => { await p.mouse.click(160, 300); await wait(300); };
const throughScene = async (tag, shots = [0, 1, 2]) => {
  for (let i = 0; i < 16; i++) {
    if (!(await p.$('.story-sc'))) break;
    await wait(1300); console.log(' ', tag, i, await bubble());
    if (shots.includes(i)) await shot(`${tag}-${i}`);
    if (await p.$('.story-sc.banquet') && !(await p.$('.story-sc.ending'))) await shot(`${tag}-banquet`);
    if (await p.$('.story-sc.ending')) await shot(`${tag}-fin`);
    await tapScene();
  }
};
const adv = async (sec) => { await p.evaluate(sec => { const r = window.__lobRun; for (let i = 0; i < sec * 30 && r && !r.over && !r.paused; i++) { if (window.__god) { r.p.inv = 9; r.p.hp = r.p.maxHp; } r.update(1 / 30); } }, sec); await wait(350); };
const god = () => p.evaluate(() => { window.__god = 1; const r = window.__lobRun; r.p.inv = 1e9; r.p.hp = r.p.maxHp = 1e6; r.p.atk = 5e4; r.onLevelUp = (t, o, d) => d(o[0]); r.onChest = (c, g, d) => d && d(); });
const killBoss = async () => {
  await god();
  await p.evaluate(() => { const r = window.__lobRun; r.p.x = r.altar.x; r.p.y = r.altar.y + 10; });
  await p.waitForFunction(() => window.__lobRun?.boss, null, { timeout: 40000 }).catch(() => console.log('pas de boss'));
};
const taunt = async (tag) => { for (let i = 0; i < 16; i++) { await wait(350); const t = await p.evaluate(() => document.querySelector('.taunt')?.innerText.replace(/\s+/g, ' ')); if (t) { console.log('  bulle en jeu :', t); await shot(tag); return; } } console.log('  bulle en jeu : (aucune)'); };
const toPortal = async (tag) => {
  await p.waitForFunction(() => window.__lobRun?.portal, null, { timeout: 40000 }).catch(() => console.log('pas de portail')); await wait(1500);
  console.log('  bannière :', await p.evaluate(() => document.querySelector('#banner')?.innerText.replace(/\s+/g, ' ')));
  await p.evaluate(() => { const r = window.__lobRun; r.p.x = r.portal.x; r.p.y = r.portal.y; }); await adv(4);
  await p.waitForSelector('.story-sc', { timeout: 30000 }).catch(async () => console.log('pas de scène de fin', await p.evaluate(() => { const r = window.__lobRun; return JSON.stringify({ portal: r?.portal, entering: r?.entering, paused: r?.paused, over: r?.over }); })));
  await throughScene(tag, [0, 1]);
};
const bilan = async (tag) => {
  for (let i = 0; i < 30 && !(await p.$('.reward-screen')); i++) { const l = await p.$('[data-act=later]'); if (l) await l.click({ force: true }).catch(() => {}); const ch = await p.$('.chest-stage, .chest-screen'); if (ch) { await p.mouse.click(160, 300); } await wait(600); }
  await wait(900); await shot(tag);
  console.log('  bilan :', await p.evaluate(() => (document.querySelector('.rs-title')?.innerText || '') + ' | ' + document.querySelector('.story-res')?.innerText.replace(/\s+/g, ' ')), '| bouton :', await p.evaluate(() => document.querySelector('.end-btns .primary')?.innerText));
  console.log('  storyCh', await p.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('lob_save_v1')).storyCh)));
};
const setCh = async (k) => { // k premiers chapitres terminés (1 étoile)
  await p.evaluate(k => { const s = JSON.parse(localStorage.getItem('lob_save_v1')); s.storyCh = {}; for (let i = 1; i <= k; i++) s.storyCh['c' + i] = 1; s.tutorialDone = true; s.stats.runs = 1; localStorage.setItem('lob_save_v1', JSON.stringify(s)); }, k);
  await p.reload(); await wait(2500);
  for (let i = 0; i < 4; i++) { const m = await p.$('.modal-wrap .btn.ghost'); if (!m) break; await m.click({ force: true }).catch(() => {}); await wait(600); }
};
const openChapter = async (n, tag) => {
  await p.click('[data-act=story]', { force: true }); await wait(1200);
  await p.evaluate(n => document.querySelector(`.sm-ch[data-n="${n}"]`)?.scrollIntoView({ block: 'center' }), n); await wait(300);
  if (tag) await shot(tag + '-carte');
  await p.click(`.sm-ch[data-n="${n}"]`, { force: true }); await wait(700);
  if (tag) await shot(tag + '-fiche');
  console.log('  fiche :', await p.evaluate(() => document.querySelector('.chapter-modal')?.innerText.replace(/\s+/g, ' ')));
  await p.click('.chapter-modal .btn.primary', { force: true }); await wait(500);
};
const start = async (tag) => {
  await p.waitForFunction(() => window.__lobRun && !window.__lobRun.over, null, { timeout: 20000 }); await wait(1500);
  console.log(tag, 'partie : story', await p.evaluate(() => JSON.stringify(window.__lobRun.story)), 'zone', await p.evaluate(() => window.__lobRun.zone.id), 'altar', await p.evaluate(() => !!window.__lobRun.altar));
};

// 1) nouveau joueur → chapitre 1
await p.goto(`http://localhost:${process.env.PORT || 8765}/`); await p.evaluate(() => localStorage.clear()); await p.reload(); await wait(3000);
await p.click('.class-select [data-act=go]', { force: true }); await wait(2500);
await shot('01-accueil');
await p.click('[data-act=play]', { force: true }); await wait(700);
await shot('02-carte-titre'); console.log('c1', await bubble());
await wait(2300); // la carte de titre passe toute seule
await throughScene('03-c1-intro', [0, 1, 3]);
await start('c1');
await shot('04-c1-partie');
await killBoss(); await taunt('05-c1-replique');
await wait(1500);
await p.evaluate(() => { const r = window.__lobRun, B = r.boss; if (B && !B.dead) { B.invuln = 0; B.phase = 'chase'; r.hitEnemy(B, 1e12, {}); } });
await toPortal('06-c1-outro');
await bilan('07-c1-bilan');

// 2) chapitre suivant : c2 mission « carottes »
await p.click('.end-btns .primary', { force: true }); await wait(900);
console.log('c2', await bubble()); await p.click('.ss-skip', { force: true }); await wait(400);
await start('c2');
await god(); await wait(3200); await taunt('08-c2-pompon');
const mis = await p.evaluate(() => { const M = window.__lobRun.mission; return { type: M.type, n: M.n, items: M.items.map(o => [Math.round(o.x), Math.round(o.y)]), hud: document.querySelector('#timerLbl')?.innerText }; });
console.log('  mission', JSON.stringify(mis));
await shot('09-c2-marques');
for (let i = 0; i < mis.n; i++) {
  await p.evaluate(i => { const r = window.__lobRun, o = r.mission.items[i]; r.p.x = o.x; r.p.y = o.y; }, i); await adv(0.5);
  if (i === 2) { await p.evaluate(() => window.__lobRun.pause()); await wait(900); await shot('10b-c2-pause'); console.log('  pause :', await p.evaluate(() => document.querySelector('.pz-goal')?.innerText.replace(/\s+/g, ' '))); await p.evaluate(() => [...document.querySelectorAll('.modal .btn.primary')].find(x => /reprendre/i.test(x.textContent))?.click()); await wait(900); }
  if (i === 1) { await wait(400); await shot('10-c2-ramasse'); console.log('  hud', await p.evaluate(() => document.querySelector('#timerLbl')?.innerText), '| bulle', await p.evaluate(() => document.querySelector('.taunt')?.innerText.replace(/\s+/g, ' '))); }
}
console.log('  mission done', await p.evaluate(() => window.__lobRun.mission.done), 'hud', await p.evaluate(() => document.querySelector('#timerLbl')?.innerText));
await wait(600); await shot('11-c2-portail');
await toPortal('12-c2-outro');
await bilan('13-c2-bilan');

// 3) carte, fiche c4 (tenir), mission survive
await p.click('.end-btns .ghost', { force: true }); await wait(1800);
await setCh(3);
await shot('14-accueil');
await openChapter(3, '15-c4');
await throughScene('16-c4-intro', [1]);
await start('c4'); await god();
console.log('  spawn', await p.evaluate(() => window.__lobRun.wm.spawn), 'hud', await p.evaluate(() => document.querySelector('#timerLbl')?.innerText));
await adv(52); await wait(400); await shot('17-c4-milieu'); console.log('  hud', await p.evaluate(() => document.querySelector('#timerLbl')?.innerText), '| bulle', await p.evaluate(() => document.querySelector('.taunt')?.innerText.replace(/\s+/g, ' ')));
await adv(52);
console.log('  mission done', await p.evaluate(() => window.__lobRun.mission?.done), 'boss?', await p.evaluate(() => !!window.__lobRun.boss));
await toPortal('18-c4-outro');
await bilan('19-c4-bilan');

// 4) c6 : gardes d'élite
await p.click('.end-btns .ghost', { force: true }); await wait(1800);
await setCh(5);
await openChapter(5, '20-c6');
await p.click('.ss-skip', { force: true }); await wait(400);
await start('c6'); await god();
for (let k = 0; k < 4; k++) {
  await p.waitForFunction(() => window.__lobRun.mission.cur, null, { timeout: 20000 }).catch(() => console.log('pas de garde'));
  if (k === 0) { await wait(500); await shot('21-c6-garde'); console.log('  garde', await p.evaluate(() => { const e = window.__lobRun.mission.cur; return e.name + ' elite ' + e.elite + ' hp ' + Math.round(e.hp); }), 'hud', await p.evaluate(() => document.querySelector('#timerLbl')?.innerText)); }
  await p.evaluate(() => { const r = window.__lobRun, e = r.mission.cur; r.hitEnemy(e, 1e12, {}); }); await adv(0.3);
  console.log('  garde', k + 1, 'k', await p.evaluate(() => window.__lobRun.mission.k));
  await adv(4);
}
await toPortal('22-c6-outro');
await bilan('23-c6-bilan');

// 5) final : c12
await p.click('.end-btns .ghost', { force: true }); await wait(1800);
await setCh(11);
await openChapter(11, '24-c12');
await throughScene('25-c12-intro', [1]);
await start('c12');
console.log('  gigaLevel', await p.evaluate(() => window.__lobRun.gigaLevel));
await killBoss(); await wait(2500); await taunt('26-gorgoth');
await p.evaluate(() => { const r = window.__lobRun, B = r.boss; B.invuln = 0; B.hp = 1; r.hitEnemy(B, 1e9, {}); });
await wait(1500); await adv(3);
await toPortal('27-c12-outro');
await bilan('28-c12-bilan');
console.log('titre', await p.evaluate(() => JSON.parse(localStorage.getItem('lob_save_v1')).title));
await p.click('.end-btns .primary', { force: true }); await wait(1800);
await p.click('[data-act=story]', { force: true }); await wait(1200); await shot('29-carte-finie');
console.log('carte', await p.evaluate(() => document.querySelector('.sts-prog')?.innerText.replace(/\s+/g, ' ') + ' | ' + document.querySelector('.sm-miles')?.innerText.replace(/\s+/g, ' ')));
console.log(errs.length ? errs.join('\n') : 'no errors'); await b.close();
