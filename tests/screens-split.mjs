// Écrans sortis de game.js (forge.js, chests.js, account.js, item-ui.js) : on les utilise vraiment, au doigt.
// Forge : choisir une case, fabriquer, fusionner. Coffres : tout ouvrir. Options : passer en Graphismes « Léger »,
// ouvrir le compte. Bande de connexion : « Plus tard ».
import { chromium, devices } from 'playwright';
import fs from 'fs';
const OUT = process.env.OUT; fs.mkdirSync(OUT, { recursive: true });
const VP = process.env.VP || '13', URL0 = `http://localhost:${process.env.PORT || 8765}/`;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const dev = VP === 'se' ? { ...devices['iPhone SE'], viewport: { width: 320, height: 568 } } : { ...devices['iPhone 13'] };
const ctx = await b.newContext(dev), p = await ctx.newPage();
const errs = [];
p.on('pageerror', e => errs.push('PAGEERR ' + e.message + ' ' + (e.stack || '').split('\n')[1]));
p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|supabase|ERR_/i.test(m.text())) errs.push('CONSOLE ' + m.text()); });
const wait = ms => p.waitForTimeout(ms);
const shot = n => p.screenshot({ path: `${OUT}/${VP}-${n}.png` });
const tap = async sel => { const el = await p.$(sel); if (!el) return false; await el.click(); await wait(500); return true; };
const dismiss = async () => { for (let i = 0; i < 4; i++) { if (!(await p.$('.modal-wrap'))) break; await p.evaluate(() => document.querySelector('.modal-wrap .btn.ghost, .modal-wrap .btn')?.click()); await wait(500); } };
const S = () => p.evaluate(() => JSON.parse(localStorage.getItem('lob_save_v1')));

await p.goto(URL0);
await p.evaluate(async () => {
  localStorage.clear(); const M = await import('/js/save.js'), s = M.save;
  s.cls = 'mage'; s.tutorialDone = true; s.stats.runs = 12; s.unlockedZone = 1; s.zoneCleared = [true, false, false, false, false, false]; s.gold = 5000;
  s.parts.weapon[0] = 9; s.parts.weapon[1] = 1;
  s.pendingChests.push({ tier: 0, zone: 0 }, { tier: 1, zone: 0 });
  M.persist();
});
await p.reload(); await wait(2500); await dismiss();

// --- forge
await tap('[data-act=tab][data-tab=forge]'); await shot('01-forge');
await tap('[data-act=forgeSel][data-slot=weapon][data-r="0"]');
const inv0 = (await S()).inventory.length;
await tap('[data-act=craft]'); await wait(1800); await shot('02-forge-objet');
await tap('.fa-ok'); await wait(500);
let s = await S();
console.log(`fabrication : objets ${inv0} → ${s.inventory.length} | pièces arme commune ${s.parts.weapon[0]} | animation fermée ${!(await p.$('.forge-anim'))}`);
await tap('[data-act=fuse]:not([data-all])'); await wait(1800); await shot('03-fusion');
await tap('.fa-ok'); await wait(500);
s = await S();
console.log(`fusion : pièces arme commune ${s.parts.weapon[0]}, peu commune ${s.parts.weapon[1]} | forge affichée ${!!(await p.$('#forgeBody'))}`);
await tap('[data-act=forgeSel][data-slot=weapon][data-r="1"]');
console.log('case choisie :', await p.evaluate(() => document.querySelector('.pg-cell.on')?.dataset.slot + ' ' + document.querySelector('.pg-cell.on')?.dataset.r));

// --- coffres
await tap('[data-act=tab][data-tab=adventure]'); await dismiss();
await p.evaluate(() => document.querySelector('[data-act=chests]')?.click()); await wait(1000); await shot('04-coffres');
await p.evaluate(() => document.querySelector('[data-act=all]')?.click()); await wait(1200);
for (let i = 0; i < 60; i++) {
  const st = await p.evaluate(() => document.querySelector('.chest-stage')?.className || '');
  if (!st) { if (await p.$('[data-act=next]')) { await p.evaluate(() => document.querySelector('[data-act=next]').click()); await wait(800); continue; } break; }
  if (i === 4) await shot('05-coffre-ouvert');
  if (st.includes('done')) { await p.click('.cst-ok', { force: true }); await wait(800); continue; }
  await p.mouse.click(dev.viewport.width / 2, dev.viewport.height * 0.6); await wait(450);
}
s = await S();
console.log(`coffres : restants ${s.pendingChests.length} | accueil ${!!(await p.$('.tabs'))}`);

// --- options et compte
await dismiss();
await tap('[data-act=settings]'); await shot('06-options');
await tap('.seg[data-k=quality] [data-sv=lite]');
await p.evaluate(() => document.querySelector('.modal-wrap .modal-btns .btn').click()); await wait(700);
console.log('graphismes :', (await S()).settings.quality);
await tap('[data-act=settings]');
await tap('.settings-modal [data-v=account]'); await wait(400); await shot('07-compte');
console.log('compte :', await p.evaluate(() => document.querySelector('.account-modal .ac-id b')?.textContent + ' | ' + document.querySelectorAll('.account-modal .ac-nums > div').length + ' chiffres'));
await p.evaluate(() => document.querySelector('.modal-wrap .modal-btns .btn').click()); await wait(700);

// --- bande de connexion : « Plus tard » (seulement si la connexion est disponible sur cette version)
const strip = !!(await p.$('.login-strip'));
if (strip) { await tap('[data-act=hideStrip]'); console.log('bande « Plus tard » : cachée', !(await p.$('.login-strip')), '| mémorisée', !!(await p.evaluate(() => localStorage.getItem('lob_login_hide')))); }
else console.log('bande « Plus tard » : pas de bande');
await shot('08-accueil');
console.log(errs.length ? errs.join('\n') : 'no errors');
await b.close();
