// Inventaire de l'interface : capture de chaque écran + liste des éléments cliquables (data-act, boutons, onglets) et des
// éléments « qui ont l'air cliquables » sans l'être (cartes à bordure sans action). Mode SCROLL=1 : teste le défilement
// au doigt (CDP touch) sur chaque écran qui déborde.
import { chromium, devices } from 'playwright';
import fs from 'fs';
const OUT = process.env.OUT; fs.mkdirSync(OUT, { recursive: true });
const VP = process.env.VP || '13';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const dev = VP === 'se' ? { ...devices['iPhone SE'], viewport: { width: 320, height: 568 } } : { ...devices['iPhone 13'] };
const ctx = await b.newContext(dev), p = await ctx.newPage();
const errs = []; p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
const wait = ms => p.waitForTimeout(ms);
const shot = n => p.screenshot({ path: `${OUT}/${VP}-${n}.png` });
const cdp = await ctx.newCDPSession(p);
// glisser le doigt de (x, y) vers le haut de dy pixels (vrais événements tactiles)
const swipe = async (x, y, dy) => {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let i = 1; i <= 8; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - dy * i / 8 }] }); await wait(16); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await wait(400);
};
// zone qui défile sous le doigt (là où le glissé commence) : premier parent qui déborde avec overflow auto/scroll
const scrollState = (x, y) => p.evaluate(([x, y]) => {
  for (let n = document.elementFromPoint(x, y); n && n !== document.body; n = n.parentElement) {
    const s = getComputedStyle(n);
    if (/(auto|scroll)/.test(s.overflowY) && n.scrollHeight > n.clientHeight + 4) return { cls: n.className.toString().slice(0, 40), top: Math.round(n.scrollTop), max: n.scrollHeight - n.clientHeight };
  }
  return null;
}, [x, y]);
// un écran qui déborde doit défiler au doigt (sauf s'il est déjà tout en bas)
const testScroll = async (tag) => {
  if (!process.env.SCROLL) return;
  const W = dev.viewport.width, H = dev.viewport.height, x = W / 2, y = H * 0.7;
  const s0 = await scrollState(x, y); if (!s0) { console.log(`  [${tag}] défilement : rien ne déborde sous le doigt`); return; }
  if (s0.top >= s0.max - 2) { console.log(`  [${tag}] défilement ${s0.cls} : déjà en bas`); return; }
  await swipe(x, y, H * 0.35);
  const s1 = await scrollState(x, y);
  console.log(`  [${tag}] défilement ${s0.cls} : ${s0.top} → ${s1?.top} / ${s0.max} ${s1 && s1.top > s0.top ? 'OK' : 'BLOQUÉ'}`);
};
// cliquables et faux cliquables de l'écran
const audit = (tag) => p.evaluate(tag => {
  const vis = n => { const r = n.getBoundingClientRect(); return r.width > 4 && r.height > 4 && r.bottom > 0 && r.top < innerHeight; };
  const click = [...document.querySelectorAll('[data-act], button, [data-i], .tab, a, label')].filter(vis);
  const desc = n => `${n.tagName.toLowerCase()}.${n.className.toString().split(' ').filter(Boolean).slice(0, 2).join('.')}${n.dataset.act ? '[' + n.dataset.act + ']' : ''}`;
  const kinds = {}; for (const n of click) { const k = desc(n); kinds[k] = (kinds[k] || 0) + 1; }
  return `${tag} : ${Object.entries(kinds).map(([k, v]) => v > 1 ? `${k}×${v}` : k).join(', ')}`;
}, tag);
const visit = async (tag, fn) => { try { await fn(); await wait(900); await shot(tag); console.log(await audit(tag)); await testScroll(tag); } catch (e) { console.log(tag, 'ERREUR', e.message.split('\n')[0]); } };
const home = async (tab = 'adventure') => { await p.evaluate(t => document.querySelector(`[data-act=tab][data-tab=${t}]`)?.click(), tab); await wait(700); };
const closeModal = async () => { for (let i = 0; i < 3; i++) { const m = await p.$('.modal-wrap'); if (!m) break; await p.evaluate(() => { const bs = [...document.querySelectorAll('.modal-wrap .modal-btns .btn')]; const b = bs.find(x => /fermer|retour|ok|annuler|plus tard/i.test(x.textContent)) || bs.find(x => x.classList.contains('ghost')); if (b) b.click(); else document.querySelector('.modal-wrap')?.click(); }); await wait(500); } };

await p.goto(`http://localhost:${process.env.PORT || 8765}/`);
await p.evaluate(async () => {
  localStorage.clear(); const S = await import('/js/save.js'), D = await import('/js/data.js'); const { rng } = await import('/js/pixel.js');
  S.save.cls = 'knight'; S.save.tutorialDone = true; S.save.stats.runs = 25; S.save.unlockedZone = 3; S.save.zoneCleared = [true, true, true, false, false, false];
  S.save.gold = 4200; S.save.storyCh = { c1: 7, c2: 3, c3: 1 }; S.save.pets = ['poro', 'brambi'];
  const r = rng(5); for (let i = 0; i < 9; i++) S.addItem(S.makeItem(r, 2, {}));
  S.save.parts.weapon = [12, 5, 2, 0]; S.save.parts.armor = [8, 3, 0, 0]; S.save.pendingChests.push({ tier: 1, zone: 1 }, { tier: 2, zone: 2 }); S.save.mythShards = 4;
  S.persist();
});
await p.reload(); await wait(2500);
for (let i = 0; i < 4; i++) { const m = await p.$('.modal-wrap'); if (!m) break; await shot('00-modal-' + i); console.log(await audit('modal ouverture ' + i)); await p.evaluate(() => document.querySelector('.modal-wrap .btn.ghost, .modal-wrap .btn')?.click()); await wait(600); }
await visit('01-accueil', async () => {});
await visit('02-mondes', async () => { await p.evaluate(() => document.querySelector('[data-act=worlds]')?.click()); });
await closeModal(); await home();
await visit('03-fiche-monde', async () => { await p.evaluate(() => document.querySelector('[data-act=worlds]')?.click()); await wait(700); await p.evaluate(() => document.querySelector('.wp-row')?.click()); });
await closeModal(); await home();
await visit('04-histoire', async () => { await p.evaluate(() => document.querySelector('[data-act=story]')?.click()); });
await visit('05-fiche-chapitre', async () => { await p.evaluate(() => document.querySelector('.sm-ch[data-n="1"]')?.click()); });
await closeModal(); await p.evaluate(() => document.querySelector('[data-act=back]')?.click()); await wait(800);
await visit('06-quetes', async () => { await p.evaluate(() => document.querySelector('[data-act=quests]')?.click()); });
await closeModal();
await visit('07-defis', async () => { await p.evaluate(() => document.querySelector('[data-act=defis]')?.click()); });
await p.evaluate(() => document.querySelector('[data-act=back], .cs-bar .icon-btn')?.click()); await wait(800);
await visit('08-pass', async () => { await p.evaluate(() => document.querySelector('[data-act=season]')?.click()); });
await p.evaluate(() => document.querySelector('[data-act=back], .cs-bar .icon-btn')?.click()); await wait(800);
await visit('09-succes', async () => { await p.evaluate(() => document.querySelector('[data-act=trophies]')?.click()); });
await home();
await visit('10-coffres', async () => { await p.evaluate(() => document.querySelector('[data-act=chests]')?.click()); });
await p.goto(`http://localhost:${process.env.PORT || 8765}/`); await wait(2500); for (let i = 0; i < 4; i++) { const m = await p.$('.modal-wrap'); if (!m) break; await p.evaluate(() => document.querySelector('.modal-wrap .btn.ghost, .modal-wrap .btn')?.click()); await wait(500); }
await visit('11-heros', async () => { await home('gear'); });
await visit('11b-heros-bas', async () => { await p.evaluate(() => { const m = document.querySelector('.hub-main'); m.scrollTop = m.scrollHeight; }); });
await visit('12-fiche-objet', async () => { await p.evaluate(() => document.querySelector('[data-act=item]')?.click()); });
await closeModal();
await visit('13-stats', async () => { await p.evaluate(() => document.querySelector('[data-act=allStats]')?.click()); });
await closeModal();
await visit('14-forge', async () => { await home('forge'); });
await visit('14b-forge-bas', async () => { await p.evaluate(() => { const m = document.querySelector('.hub-main'); m.scrollTop = m.scrollHeight; }); });
await visit('15-boutique', async () => { await home('shop'); });
await visit('15b-boutique-bas', async () => { await p.evaluate(() => { const m = document.querySelector('.hub-main'); m.scrollTop = m.scrollHeight; }); });
await visit('16-reglages', async () => { await home('adventure'); await p.evaluate(() => document.querySelector('[data-act=settings]')?.click()); });
await closeModal();
await visit('17-champions', async () => { await p.evaluate(() => document.querySelector('[data-act=changeClass]')?.click()); });
console.log(errs.length ? errs.join('\n') : 'no errors'); await b.close();
