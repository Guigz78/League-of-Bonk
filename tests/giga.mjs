// Parcours complet en 3D : niveau 1 → portail (menu) → niveau 2 → niveau 3 → giga boss (intro, attaques, phases)
// → victoire → portail → bilan → coffres. Usage : OUT=<dir> PORT=8791 DEV="iPhone 13" node giga.mjs
import { chromium, devices } from 'playwright';
import fs from 'fs';
const OUT = process.env.OUT || 'tests/out/' + (import.meta.url.split('/').pop().replace('.mjs', ''));
fs.mkdirSync(OUT, { recursive: true });
const DEV = process.env.DEV || 'iPhone 13';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ ...devices[DEV] });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', e => errs.push('PAGEERR ' + e.message + ' ' + (e.stack || '').split('\n')[1])); p.on('console', m => { if (m.type() === 'error') errs.push('ERR ' + m.text()); });
const tag = DEV.replace(/\W+/g, '');
const shot = async n => { await p.screenshot({ path: `${OUT}/${tag}-${n}.png` }); const ov = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); if (ov > 0) errs.push(`OVERFLOW ${n} ${ov}px`); };
const R = fn => p.evaluate(fn);
// avance le temps du jeu (pas de 1/30 s) sans attendre le rendu, puis laisse 2 images se dessiner
const adv = async (sec) => { await p.evaluate(sec => { const r = window.__lobRun; for (let i = 0; i < sec * 30 && r && !r.over && !r.paused; i++) r.update(1 / 30); }, sec); await p.waitForTimeout(350); };
const menu = async () => { await p.waitForSelector('.portal-menu', { timeout: 20000 }).catch(e => errs.push('pas de menu du portail')); await p.waitForTimeout(900); };
await p.goto(`http://localhost:${process.env.PORT || 8791}/`);
await p.evaluate(async cls => { localStorage.clear(); const S = await import('/js/save.js'); S.save.cls = cls; S.save.stats.runs = 3; S.save.tutorialDone = true; S.save.unlockedZone = 5; S.persist(); }, process.env.CLS || 'knight');
await p.reload(); await p.waitForTimeout(1500);
for (let i = 0; i < 4; i++) { const m = await p.$('.modal-wrap.in .btn'); if (!m) break; await m.click({ force: true }).catch(() => {}); await p.waitForTimeout(500); }
if (await p.$('[data-act=worlds]')) { await p.evaluate(() => [...document.querySelectorAll('.modal-wrap .btn.ghost')].forEach(x => x.click())); await p.waitForTimeout(500); await p.click('[data-act=worlds]', { force: true }); await p.waitForTimeout(800); await p.click('.wp-row[data-z="0"]', { force: true }); await p.waitForTimeout(1200); }
else await p.click('[data-act=zone][data-z="0"]', { force: true });
await p.waitForTimeout(600);
await shot('00-zone');
await p.click('.modal .btn.primary', { force: true }); await p.waitForTimeout(2500);
await R(() => { const r = window.__lobRun; r.onLevelUp = (t, o, d) => d(o[0]); const oh = r.hurtPlayer.bind(r); r.hurtPlayer = (d, s) => { r.p.hp = r.p.maxHp; oh(Math.min(d, r.p.maxHp * 0.3), s); }; for (const w of ['orbs', 'lightning', 'daggers']) r.addWeapon(w); });
await shot('01-level1');
// boss du niveau 1 : invoqué puis tué, portail
await R(() => { const r = window.__lobRun; r.enemies.forEach(e => e.dead = true); r.altar.used = true; r.summonBoss(r.altar.x, r.altar.y, false); });
await p.waitForTimeout(2500);
await adv(2);
await R(() => { const r = window.__lobRun; r.boss.invuln = 0; r.boss.hp = 1; r.hitEnemy(r.boss, 1e9, {}); });
await adv(3);
await R(() => { const r = window.__lobRun; r.p.x = r.portal.x; r.p.y = r.portal.y; });
await adv(3); await menu();
await shot('02-portal-menu-1');
await p.evaluate(() => document.querySelector('.pm-next')?.click());
await p.waitForTimeout(700);
await shot('03-level2-banner');
// niveau 2 → portail vers le niveau 3 (giga)
await R(() => { const r = window.__lobRun; r.p.hp = r.p.maxHp; r.enemies.forEach(e => e.dead = true); r.altar.used = true; r.summonBoss(r.altar.x, r.altar.y, false); });
await adv(2);
await R(() => { const r = window.__lobRun; r.boss.invuln = 0; r.boss.hp = 1; r.hitEnemy(r.boss, 1e9, {}); });
await adv(3);
await R(() => { const r = window.__lobRun; r.p.x = r.portal.x; r.p.y = r.portal.y; });
await adv(3); await menu();
await shot('04-portal-menu-giga');
await p.evaluate(() => document.querySelector('.pm-next')?.click());
await p.waitForTimeout(700);
await shot('05-level3-banner');
const info = await R(() => { const r = window.__lobRun; return { stage: r.stage, giga: r.gigaLevel, route: r.route, tag: document.querySelector('#worldTag')?.textContent }; });
console.log('niveau 3 :', JSON.stringify(info));
// giga boss : invocation (cinématique)
await R(() => { const r = window.__lobRun; r.enemies.forEach(e => e.dead = true); r.p.x = r.altar.x; r.p.y = r.altar.y + 10; });
await adv(2.6);
await p.waitForTimeout(900); await shot('06-giga-intro');
await p.waitForTimeout(1600); await shot('07-giga-intro2');
await adv(3.5); await shot('08-giga-fight');
const force = async (k, wait, n) => {
  await R(k => { const r = window.__lobRun, B = r.boss; if (!B || B.dead) return; B.phase = 'chase'; B.phaseT = 9; const dx = r.p.x - B.x, dy = r.p.y - B.y, d = Math.hypot(dx, dy) || 1; r.gigaPick(B, dx / d, dy / d, d, k); }, k);
  await adv(wait / 1000); await shot(n);
};
await R(() => { const r = window.__lobRun, B = r.boss; r.p.x = B.x + 220; r.p.y = B.y + 60; });
await force('leap', 700, '09-giga-leap-warn');
await adv(2.5);
await force('quake', 900, '10-giga-quake-warn');
await adv(1.2); await shot('11-giga-quake-waves');
await adv(2.5);
// phase 2 (armure brisée)
await R(() => { const r = window.__lobRun, B = r.boss; B.invuln = 0; B.hp = B.maxHp * 0.6; B.phase = 'chase'; B.phaseT = 9; });
await adv(0.6); await shot('12-giga-phase2');
await adv(2.5);
await force('laser', 1000, '13-giga-laser-warn');
await adv(1.4); await shot('14-giga-laser');
await adv(4);
await force('rain', 1200, '15-giga-rain');
await adv(3);
// phase 3 (embrasé)
await R(() => { const r = window.__lobRun, B = r.boss; B.invuln = 0; B.hp = B.maxHp * 0.3; B.phase = 'chase'; B.phaseT = 9; });
await adv(0.6); await shot('16-giga-phase3');
await adv(2.5);
await force('gspiral', 1800, '17-giga-gspiral');
await adv(2);
const st = await R(() => { const r = window.__lobRun, B = r.boss; return { gph: B.gph, mdl: B.mdl?.name, hp: Math.round(B.hp), max: Math.round(B.maxHp), r: B.r, bar: document.querySelector('#bossbar')?.className, ph: document.querySelector('#gbPh')?.textContent }; });
console.log('giga :', JSON.stringify(st));
// victoire
await R(() => { const r = window.__lobRun, B = r.boss; B.invuln = 0; B.hp = 1; r.hitEnemy(B, 1e9, {}); });
await p.waitForTimeout(1500); await shot('18-giga-victory');
await adv(3); await p.waitForTimeout(600); await shot('19-giga-victory-portal');
await R(() => { const r = window.__lobRun; r.p.x = r.portal.x; r.p.y = r.portal.y; });
await adv(4); await menu();
await shot('20-portal-victory');
await p.click('.pm-home', { force: true }).catch(e => errs.push('click home ' + e.message));
await p.waitForTimeout(2000);
await shot('21-chests');
const giga = await R(() => [...document.querySelectorAll('.cg-card')].map(c => c.className + ':' + c.querySelector('b')?.textContent).slice(0, 3));
console.log('coffres :', JSON.stringify(giga));
await p.click('.cg-card.giga', { force: true }).catch(e => errs.push('click giga chest ' + e.message));
await p.waitForTimeout(3500);
await shot('22-giga-chest');
for (let i = 0; i < 12; i++) {
  if (await p.$('.reward-screen')) break;
  const sk = await p.$('.cst-skip:not([hidden])'); if (sk && await sk.isVisible()) { await sk.click({ force: true }).catch(() => {}); await p.waitForTimeout(900); }
  const ok = await p.$('.cst-ok'); if (ok && await ok.isVisible()) { await ok.click({ force: true }).catch(() => {}); await p.waitForTimeout(900); continue; }
  const nx = await p.$('[data-act=later], [data-act=next]'); if (nx) { await nx.click({ force: true }).catch(() => {}); await p.waitForTimeout(1200); }
}
await p.waitForTimeout(5000);
await shot('23-results');
await p.evaluate(() => document.querySelector('.reward-screen')?.scrollTo(0, 400));
await p.waitForTimeout(500); await shot('24-results-2');
const stats = await R(async () => { const S = await import('/js/save.js'); const s = S.save.stats; return { gigaKills: s.gigaKills, gigaTop: s.gigaTop, gigaBest: s.gigaBest, gigaDance: s.gigaDance, bestStage: s.bestStage, ach: Object.keys(S.save.achievements), chal: Object.keys(S.save.chal || {}), season: S.save.season?.xp }; });
console.log('sauvegarde :', JSON.stringify(stats));
console.log(errs.length ? errs.slice(0, 20).join('\n') : 'no errors');
await b.close();
