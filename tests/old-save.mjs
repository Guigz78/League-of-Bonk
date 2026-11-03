// Ancienne sauvegarde (avant L1/L2, bestStage 5, pas de stats du giga) : chargement, accueil, défis, trophées
import { chromium, devices } from 'playwright';
import fs from 'fs';
const OUT = process.env.OUT || 'tests/out/' + (import.meta.url.split('/').pop().replace('.mjs', ''));
const old = JSON.parse(fs.readFileSync(new URL('./fixtures/old-save.json', import.meta.url), 'utf8'));
old.stats.bestStage = 5; delete old.stats.gigaKills;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await (await b.newContext({ ...devices['iPhone SE'] })).newPage();
const errs = []; p.on('pageerror', e => errs.push('PAGEERR ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('ERR ' + m.text()); });
await p.goto(`http://localhost:${process.env.PORT || 8791}/`);
await p.evaluate(s => { localStorage.clear(); localStorage.setItem('lob_save_v1', JSON.stringify(s)); }, old);
await p.reload(); await p.waitForTimeout(2500);
for (let i = 0; i < 6; i++) { const m = await p.$('.modal-wrap.in .btn'); if (!m) break; await m.click({ force: true }).catch(() => {}); await p.waitForTimeout(600); }
await p.screenshot({ path: `${OUT}/SE-old-hub.png` });
const st = await p.evaluate(async () => { const S = await import('/js/save.js'); return { bestStage: S.save.stats.bestStage, gigaKills: S.save.stats.gigaKills, gigaTop: S.save.stats.gigaTop, chal: Object.keys(S.save.chal || {}).length }; });
console.log(JSON.stringify(st));
// écran Défis, catégorie giga boss
await p.evaluate(async () => { const U = await import('/js/unlocks.js'); U.defisScreen(() => {}); });
await p.waitForTimeout(800);
await p.evaluate(() => document.querySelector('[data-act=cat][data-c=giga]')?.click());
await p.waitForTimeout(600);
await p.screenshot({ path: `${OUT}/SE-old-defis-giga.png` });
const ov = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
console.log('overflow', ov, errs.join('\n') || 'no errors');
await b.close();
