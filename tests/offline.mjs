// Hors connexion : le jeu est ouvert une fois avec le réseau (le service worker met tout en cache), puis le réseau est
// coupé : rechargement, accueil, lancement d'une partie, retour à l'accueil — sans aucune erreur.
import { chromium, devices } from 'playwright';
import fs from 'fs';
const OUT = process.env.OUT; fs.mkdirSync(OUT, { recursive: true });
const URL0 = `http://localhost:${process.env.PORT || 8765}/`;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ ...devices['iPhone 13'] }), p = await ctx.newPage();
const errs = []; p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
const wait = ms => p.waitForTimeout(ms);
await p.goto(URL0);
await p.evaluate(async () => { localStorage.clear(); const S = await import('/js/save.js'); S.save.cls = 'knight'; S.save.tutorialDone = true; S.save.stats.runs = 3; S.save.zoneCleared = [true, false, false, false, false, false]; S.persist(); });
// le service worker s'installe et met les fichiers en cache
const cached = await p.evaluate(async () => {
  const reg = await navigator.serviceWorker.ready;
  for (let i = 0; i < 60; i++) { const k = await caches.keys(); if (k.length) { const c = await caches.open(k[0]); const n = (await c.keys()).length; if (n > 80) return `${k[0]} : ${n} fichiers`; } await new Promise(r => setTimeout(r, 500)); }
  return 'cache incomplet';
});
console.log('cache :', cached);
await ctx.setOffline(true);
console.log('réseau coupé :', await p.evaluate(() => fetch('https://example.com').then(() => 'non', () => 'oui')));
await p.reload(); await wait(3000);
for (let i = 0; i < 4 && (await p.$('.modal-wrap')); i++) { await p.evaluate(() => document.querySelector('.modal-wrap .btn.ghost, .modal-wrap .btn')?.click()); await wait(500); }
console.log('accueil hors ligne :', !!(await p.$('.tabs')), '| jouer :', !!(await p.$('[data-act=play]')));
await p.screenshot({ path: `${OUT}/01-accueil-hors-ligne.png` });
await p.evaluate(() => document.querySelector('[data-act=play]')?.click()); await wait(900);
await p.evaluate(() => document.querySelector('.modal .btn.primary')?.click());
const ok = await p.waitForFunction(() => window.__lobRun && !window.__lobRun.over, null, { timeout: 20000 }).then(() => true, () => false);
await wait(2500);
console.log('partie hors ligne :', ok, '| 3D :', await p.evaluate(() => !!window.__lobRun?.gfx?.renderer));
await p.screenshot({ path: `${OUT}/02-partie-hors-ligne.png` });
console.log(errs.length ? errs.join('\n') : 'no errors');
await b.close();
