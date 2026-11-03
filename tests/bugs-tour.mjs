// Chasse aux bugs : tous les écrans et fenêtres de l'accueil, puis une partie par champion (niveaux, ultime, boss, portail).
// Relève : erreurs JS, erreurs de console, textes « NaN » / « undefined » / « [object », débordements horizontaux.
import { chromium, devices } from 'playwright';
import fs from 'fs';
const OUT = process.env.OUT; fs.mkdirSync(OUT, { recursive: true });
const VP = process.env.VP || '13', ONLY = (process.env.CLS || '').split(',').filter(Boolean);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const dev = VP === 'se' ? { ...devices['iPhone SE'], viewport: { width: 320, height: 568 } } : { ...devices['iPhone 13'] };
const p = await (await b.newContext(dev)).newPage();
const issues = []; let where = 'début';
p.on('pageerror', e => issues.push(`[${where}] PAGEERR ${e.message} ${(e.stack || '').split('\n')[1] || ''}`));
p.on('console', m => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) issues.push(`[${where}] CONSOLE ${m.text().slice(0, 200)}`); });
const wait = ms => p.waitForTimeout(ms);
const check = async (n, shotIt = false) => {
  where = n;
  const r = await p.evaluate(() => {
    const txt = document.body.innerText;
    const bad = (txt.match(/[^\n]{0,40}(NaN|undefined|\[object|Infinity)[^\n]{0,40}/g) || []).slice(0, 3);
    return { ov: document.documentElement.scrollWidth - window.innerWidth, bad };
  });
  if (r.ov > 0) issues.push(`[${n}] DÉBORDEMENT ${r.ov}px`);
  for (const x of r.bad) issues.push(`[${n}] TEXTE « ${x.trim()} »`);
  if (shotIt) await p.screenshot({ path: `${OUT}/${VP}-${n}.png` });
};
const closeAll = async () => { for (let i = 0; i < 4; i++) { const n = await p.evaluate(() => { const w = [...document.querySelectorAll('.modal-wrap')]; w.forEach(m => (m.querySelector('.modal-btns .btn.ghost') || m.querySelector('.modal-btns .btn'))?.click()); return w.length; }); if (!n) break; await wait(500); } };
const click = async sel => { await p.evaluate(s => document.querySelector(s)?.click(), sel); await wait(900); };
await p.goto(`http://localhost:${process.env.PORT}/`);
// joueur bien avancé : tout débloqué, de l'or, des pièces, des objets, des coffres, des quêtes finies
await p.evaluate(async () => {
  localStorage.clear(); const S = await import('/js/save.js'), D = await import('/js/data.js'); const s = S.save; Object.assign(s, S.freshSave());
  s.cls = 'mage'; s.tutorialDone = true; s.story = 3; s.gold = 25000; s.unlockedZone = 5; s.zoneCleared = [true, true, true, true, true, false]; s.diffCleared = [3, 2, 1, 1, 1, 0];
  s.stats.runs = 60; s.stats.kills = 50000; s.stats.wins = 20; s.parts = { weapon: [20, 10, 4, 1], armor: [20, 10, 4, 1], trinket: [20, 10, 4, 1] };
  for (const id of Object.keys(D.CLASSES)) s.unlocks['cls:' + id] = true;
  s.pets = ['poro', 'herald', 'wisp']; s.pet = 'poro'; s.boosts = { rage: 2, phenix: 1, trefle: 1 };
  s.pendingChests = [{ tier: 0, zone: 1 }, { tier: 2, zone: 3 }];
  const r = S.makeItem ? null : null;
  S.persist();
});
await p.reload(); await wait(2500); await closeAll(); await check('accueil', true);
// objectifs
for (const a of ['season', 'quests', 'defis', 'trophies', 'chests', 'login']) {
  await closeAll(); await click('[data-act=tab][data-tab=adventure]'); await click(`[data-act=${a}]`); await wait(600); await check('objectif-' + a, true);
  await p.evaluate(() => document.querySelector('[data-act=back]')?.click()); await wait(400);
  for (let i = 0; i < 20 && await p.$('.chest-stage, .chest-screen'); i++) { await p.evaluate(() => { const st = document.querySelector('.chest-stage'); if (st) { const ok = st.querySelector('.cst-ok'); if (st.classList.contains('done') && ok) ok.click(); else (st.querySelector('.cst-skip') || st.querySelector('.cst-chest'))?.click(); } else (document.querySelector('[data-act=later]') || document.querySelector('[data-act=back]'))?.click(); }); await wait(900); }
  await closeAll();
}
// monde, fiche de monde, histoire, réglages, statistiques, champions
await click('[data-act=tab][data-tab=adventure]'); await click('[data-act=worlds]'); await check('mondes', true);
await p.evaluate(() => document.querySelector('.wp-row[data-z="2"]')?.click()); await wait(1300); await check('fiche-monde', true); await closeAll();
await click('[data-act=tab][data-tab=adventure]'); await click('[data-act=story]'); await check('histoire', true); await click('[data-act=back]');
await click('[data-act=settings]'); await check('options', true); await closeAll();
await click('[data-act=tab][data-tab=gear]'); await check('heros', true);
await click('[data-act=allStats]'); await check('stats', true); await closeAll();
await click('[data-act=changeClass]'); await check('champions', true);
for (const c of ['engineer', 'monk', 'pirate']) { await click(`.cs-tab[data-c=${c}]`); await check('champion-' + c); }
await click('[data-act=back]');
await click('[data-act=tab][data-tab=forge]'); await check('forge', true);
await click('[data-act=craft]'); await wait(1500); await check('forge-fabrique', true);
for (let i = 0; i < 5 && await p.$('.chest-stage, .modal-wrap'); i++) { await p.evaluate(() => (document.querySelector('.cst-skip') || document.querySelector('.cst-ok') || document.querySelector('.modal-btns .btn.primary') || document.querySelector('.modal-btns .btn'))?.click()); await wait(700); }
await click('[data-act=tab][data-tab=shop]'); await check('boutique', true);
await click('[data-act=buy]'); await wait(800); await check('boutique-achat'); await closeAll();
await click('[data-act=tab][data-tab=gear]'); await click('.itile[data-act=item]'); await wait(800); await check('objet', true); await closeAll();
// une partie par champion
const D = await p.evaluate(async () => Object.keys((await import('/js/data.js')).CLASSES));
for (const cls of D) {
  if (ONLY.length && !ONLY.includes(cls)) continue;
  where = 'partie-' + cls;
  await p.evaluate(async c => { const S = await import('/js/save.js'); S.save.cls = c; S.persist(); }, cls);
  await click('[data-act=tab][data-tab=adventure]'); await closeAll();
  await click('[data-act=play]');
  const ok = await p.waitForFunction(() => window.__lobRun && !window.__lobRun.over, null, { timeout: 15000 }).then(() => true).catch(() => false);
  if (!ok) { issues.push(`[${cls}] la partie ne démarre pas : écran ${await p.evaluate(() => document.querySelector('#app')?.firstElementChild?.className)} ; fenêtres ${await p.evaluate(() => [...document.querySelectorAll('.modal-wrap, .overlay, .chest-stage')].map(m => m.className + ':' + m.innerText.slice(0, 40).replace(/\s+/g, ' ')).join(' | '))}`); await p.screenshot({ path: `${OUT}/${VP}-pas-de-partie-${cls}.png` }); break; }
  await p.evaluate(() => { const r = window.__lobRun; r.hurtPlayer = () => {}; r.onLevelUp = (t, o, d) => d(o[0]); r.onChest = (c, g, d) => d(); });
  // 14 niveaux, toutes les armes de l'arsenal montent, ultime, puis le boss et le portail
  for (let i = 0; i < 14; i++) await p.evaluate(() => { const r = window.__lobRun; r.gainXp(r.p.xpNext * 1.01); for (let k = 0; k < 8 && !r.over; k++) r.update(1 / 30); });
  await p.evaluate(() => { const r = window.__lobRun; for (let k = 0; k < 150 && !r.over; k++) r.update(1 / 30); r.p.ult = 100; r.useUlt(); for (let k = 0; k < 120 && !r.over; k++) r.update(1 / 30); });
  await wait(600); await check('partie-' + cls, cls === 'pirate' || cls === 'mage');
  await p.evaluate(() => { const r = window.__lobRun; r.p.x = r.altar.x; r.p.y = r.altar.y; for (let k = 0; k < 150 && !r.bossSpawned; k++) r.update(1 / 30); const B = r.boss; if (B) { B.invuln = 0; B.hp = 1; r.hitEnemy(B, 1e9, {}); } for (let k = 0; k < 90 && !r.over; k++) r.update(1 / 30); if (r.portal) { r.portal.t = 5; r.p.x = r.portal.x; r.p.y = r.portal.y; } for (let k = 0; k < 150 && !r.over && !r.paused; k++) r.update(1 / 30); });
  await wait(1200);
  if (await p.$('.portal-menu')) { await check('portail-' + cls); await p.evaluate(() => document.querySelector('.pm-home')?.click()); await wait(1500); }
  for (let i = 0; i < 10 && !(await p.$('.reward-screen')); i++) { await p.evaluate(() => document.querySelector('[data-act=later]')?.click()); await wait(600); if (i === 4) await p.evaluate(() => window.__lobRun && !window.__lobRun.over && window.__lobRun.finish(true)); }
  await check('bilan-' + cls, cls === 'monk');
  await p.evaluate(() => { const d = document.querySelector('.rs-more'); if (d) d.open = true; }); await check('bilan-detail-' + cls);
  await click('.end-btns [data-act=home]');
}
console.log(issues.length ? [...new Set(issues)].join('\n') : 'aucun problème'); await b.close();
