import { chromium, devices } from 'playwright';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ ...devices['iPhone 13'] }), p = await ctx.newPage(), cdp = await ctx.newCDPSession(p);
const wait = ms => p.waitForTimeout(ms);
await p.goto(`http://localhost:${process.env.PORT || 8765}/`);
await p.evaluate(async () => { localStorage.clear(); const S = await import('/js/save.js'); S.save.cls = 'knight'; S.save.tutorialDone = true; S.save.stats.runs = 9; S.save.zoneCleared[0] = true; S.save.unlockedZone = 1; S.persist(); });
await p.reload(); await wait(2500);
for (let i = 0; i < 4; i++) { const m = await p.$('.modal-wrap'); if (!m) break; await p.evaluate(() => document.querySelector('.modal-wrap .btn.ghost, .modal-wrap .btn')?.click()); await wait(500); }
await p.evaluate(() => document.querySelector('[data-act=play]').click());
await p.waitForFunction(() => window.__lobRun && !window.__lobRun.over, null, { timeout: 20000 }); await wait(2000);
await p.evaluate(() => { const r = window.__lobRun; r.hurtPlayer = () => {}; });
const X = () => p.evaluate(() => Math.round(window.__lobRun.p.x));
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 195, y: 560 }] });
for (let i = 1; i <= 6; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 195 + i * 12, y: 560 }] }); await wait(30); }
const x0 = await X(); await wait(1200); const x1 = await X();
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await wait(300);
const x2 = await X(); await wait(800); const x3 = await X();
console.log(`doigt posé : ${x1 - x0 > 20 ? 'avance' : 'BLOQUÉ'} (${x1 - x0}) ; doigt levé : ${Math.abs(x3 - x2) < 15 ? 'arrêté' : 'continue'} (${x3 - x2}) ; scroll page : ${await p.evaluate(() => Math.round(scrollY))}`);
await b.close();
