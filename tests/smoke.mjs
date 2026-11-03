import { chromium, devices } from 'playwright';
import fs from 'fs';
const OUT = process.env.OUT; fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ ...devices['iPhone 13'] });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', e => errs.push('PAGEERR ' + e.message + ' ' + (e.stack || '').split('\n')[1])); p.on('console', m => { if (m.type() === 'error') errs.push('ERR ' + m.text()); });
const shot = n => p.screenshot({ path: `${OUT}/${n}.png` });
await p.goto(`http://localhost:${process.env.PORT || 8765}/`);
await p.evaluate(async cls => { localStorage.clear(); const S = await import('/js/save.js'); S.save.cls = cls; S.save.stats.runs = 3; S.save.tutorialDone = true; S.save.unlockedZone = 5; S.persist(); }, process.env.CLS || 'knight');
await p.reload(); await p.waitForTimeout(1500); await shot('01-hub');
for (let i = 0; i < 4; i++) { const m = await p.$('.modal-wrap.in .btn'); if (!m) break; await m.click({ force: true }).catch(() => {}); await p.waitForTimeout(500); }
// accueil r17 : bouton « Monde » puis la ligne du monde (la fiche du monde s'ouvre ensuite)
if (await p.$('[data-act=worlds]')) { await p.evaluate(() => [...document.querySelectorAll('.modal-wrap .btn.ghost')].forEach(x => x.click())); await p.waitForTimeout(500); await p.click('[data-act=worlds]', { force: true }); await p.waitForTimeout(800); await p.click(`.wp-row[data-z="${process.env.Z || 0}"]`, { force: true }); await p.waitForTimeout(1200); }
else await p.click(`[data-act=zone][data-z="${process.env.Z || 0}"]`, { force: true });
await p.waitForTimeout(500); await shot('02-zone');
await p.click('.modal .btn.primary', { force: true }); await p.waitForTimeout(2500);
await p.evaluate(() => { const r = window.__lobRun; r.onLevelUp = (t, o, d) => d(o[0]); r.p.hp = r.p.maxHp = 1e5; });
await shot('03-start');
await p.evaluate(() => { const r = window.__lobRun; r.time = r.duration * 0.5; for (const w of ['orbs', 'lightning', 'daggers']) r.addWeapon(w); for (let i = 0; i < 70; i++) { const a = i / 70 * 6.283, d = 130 + (i % 4) * 60; r.addEnemy(r.zone.monsters[i % 4], i % 4, { x: r.p.x + Math.cos(a) * d, y: r.p.y + Math.sin(a) * d }); } r.addEnemy(r.zone.monsters[4], 4, { elite: true, x: r.p.x + 90, y: r.p.y - 140 }); });
await p.waitForTimeout(2500); await shot('04-horde');
await p.evaluate(() => { const r = window.__lobRun; r.enemies.forEach(e => e.dead = true); r.p.x = r.altar.x; r.p.y = r.altar.y + 10; });
await p.waitForTimeout(4500); await shot('05-boss'); await p.waitForTimeout(2500);
for (let i = 0; i < 25; i++) { await p.evaluate(() => { const r = window.__lobRun; if (r.boss && !r.boss.dead) { r.boss.hp = 1; r.hitEnemy(r.boss, 1e9, {}); } }); await p.waitForTimeout(400); }
await p.waitForTimeout(1500); await shot('06-portal-far');
await p.evaluate(() => { const r = window.__lobRun; r.p.x = 30; r.p.y = 220; });
await p.waitForTimeout(1500); await shot('07-portal-near');
const fps = await p.evaluate(() => new Promise(res => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else res(n / 2); }; requestAnimationFrame(f); }));
const info = await p.evaluate(() => { const g = window.__lobRun?.gfx; const ri = g?.renderer?.info; return { kind: g?.constructor?.name, calls: ri?.render?.calls, tris: ri?.render?.triangles }; });
console.log('fps', fps, JSON.stringify(info));
console.log(errs.length ? errs.slice(0, 12).join('\n') : 'no errors');
await b.close();
