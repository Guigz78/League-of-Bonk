// Barre du haut : hauteurs identiques (pièces, or, compte, options), rien ne déborde (grands nombres), fiche Compte
// (invité puis connecté simulé), ligne Compte des Options.
import { chromium, devices } from 'playwright';
import fs from 'fs';
const OUT = process.env.OUT; fs.mkdirSync(OUT, { recursive: true });
const VP = process.env.VP || '13';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const dev = VP === 'se' ? { ...devices['iPhone SE'], viewport: { width: 320, height: 568 } } : { ...devices['iPhone 13'] };
const p = await (await b.newContext(dev)).newPage();
const errs = []; p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
const wait = ms => p.waitForTimeout(ms);
const shot = n => p.screenshot({ path: `${OUT}/${VP}-${n}.png` });
const dismiss = async () => { for (let i = 0; i < 4; i++) { const m = await p.$('.modal-wrap'); if (!m) break; await p.evaluate(() => document.querySelector('.modal-wrap .btn.ghost, .modal-wrap .btn')?.click()); await wait(500); } };
const measure = () => p.evaluate(() => {
  const t = document.querySelector('.topbar'), els = [...t.querySelectorAll('.cur, .icon-btn')];
  const r = els.map(e => { const b = e.getBoundingClientRect(); return `${e.className.replace(/\s+/g, '.')}:${Math.round(b.height)}h ${Math.round(b.left)}-${Math.round(b.right)}`; });
  const brand = document.querySelector('.tb-brand').getBoundingClientRect();
  return `brand ${Math.round(brand.left)}-${Math.round(brand.right)} | ${r.join(' | ')} | largeur ${innerWidth} | déborde ${t.scrollWidth > t.clientWidth}`;
});
await p.goto(`http://localhost:${process.env.PORT || 8765}/`);
await p.evaluate(async () => { localStorage.clear(); const S = await import('/js/save.js'); S.save.cls = 'mage'; S.save.tutorialDone = true; S.save.stats.runs = 12; S.save.stats.kills = 18450; S.save.gold = 1234567; S.save.parts.weapon = [9999, 999, 99, 9]; S.save.zoneCleared = [true, true, false, false, false, false]; S.save.storyCh = { c1: 7, c2: 3 }; S.persist(); });
await p.reload(); await wait(2500); await dismiss();
console.log('barre :', await measure());
await p.screenshot({ path: `${OUT}/${VP}-01-barre.png`, clip: { x: 0, y: 0, width: dev.viewport.width, height: 90 } });
await shot('01-accueil');
await p.click('[data-act=account]', { force: true }); await wait(800); await shot('02-compte-invite');
console.log('compte :', await p.evaluate(() => document.querySelector('.account-modal')?.innerText.replace(/\s+/g, ' ')));
await p.evaluate(() => document.querySelector('.modal-wrap .modal-btns .btn')?.click()); await wait(600);
await p.click('[data-act=settings]', { force: true }); await wait(800);
await p.evaluate(() => document.querySelector('.set-link')?.scrollIntoView({ block: 'center' })); await wait(300); await shot('03-options');
await p.evaluate(() => document.querySelector('.set-link')?.click()); await wait(1200);
console.log('options → compte :', await p.evaluate(() => !!document.querySelector('.account-modal')));
await p.evaluate(() => document.querySelector('.modal-wrap .modal-btns .btn')?.click()); await wait(600);
// connecté (simulé) : avatar, nom, synchronisation
await p.evaluate(async () => { const { cloud } = await import('/js/cloud.js'); cloud.available = true; cloud.user = { id: 'x', name: 'Guillaume', email: 'joueur@exemple.fr', avatar: '' }; cloud.status = 'synced'; });
await p.evaluate(() => document.querySelector('[data-act=tab][data-tab=gear]')?.click()); await wait(800);
console.log('barre connecté :', await measure());
await p.click('[data-act=account]', { force: true }); await wait(800); await shot('04-compte-connecte');
console.log('compte connecté :', await p.evaluate(() => document.querySelector('.account-modal')?.innerText.replace(/\s+/g, ' ')));
await p.evaluate(() => document.querySelector('.ac-title')?.click()); await wait(900);
console.log('titre → fiche des titres :', await p.evaluate(() => document.querySelector('.modal h2')?.innerText));
console.log(errs.length ? errs.join('\n') : 'no errors'); await b.close();
