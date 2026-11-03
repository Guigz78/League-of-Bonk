// Modes spéciaux : défi de la semaine (date décalée sur une semaine « Défendre la marmite » : liste des mondes, fiche,
// partie, marmite attaquée, réussite → récompense de la semaine, puis échec → défi raté) et mode infini (record).
import { chromium, devices } from 'playwright';
import fs from 'fs';
const OUT = process.env.OUT; fs.mkdirSync(OUT, { recursive: true });
const VP = process.env.VP || '13', URL0 = `http://localhost:${process.env.PORT || 8765}/`;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const dev = VP === 'se' ? { ...devices['iPhone SE'], viewport: { width: 320, height: 568 } } : { ...devices['iPhone 13'] };
const errs = [];
const wait = (p, ms) => p.waitForTimeout(ms);
const shot = (p, n) => p.screenshot({ path: `${OUT}/${VP}-${n}.png` });
const dismiss = async p => { for (let i = 0; i < 4; i++) { const m = await p.$('.modal-wrap'); if (!m) break; await p.evaluate(() => document.querySelector('.modal-wrap .btn.ghost, .modal-wrap .btn')?.click()); await wait(p, 500); } };
const SAVE = async p => p.evaluate(async () => {
  localStorage.clear(); const S = await import('/js/save.js');
  S.save.cls = 'mage'; S.save.tutorialDone = true; S.save.stats.runs = 12; S.save.unlockedZone = 2; S.save.zoneCleared = [true, true, false, false, false, false]; S.save.gold = 500;
  S.persist();
});
// 1) trouver une semaine dont le défi est « défendre » (décalage en jours)
let off = 0;
{
  const ctx = await b.newContext(dev), p = await ctx.newPage();
  await p.goto(URL0); await SAVE(p);
  off = await p.evaluate(async () => { const M = await import('/js/modes.js'); for (let d = 0; d < 400; d += 7) { const k = M.weekKey(new Date(Date.now() + d * 864e5)); if (M.weekly(k).mission.type === 'defend') return d; } return -1; });
  await ctx.close();
}
console.log('semaine « défendre » dans', off, 'jours');
const ctxW = await b.newContext(dev);
await ctxW.addInitScript(d => { const R = Date; class FD extends R { constructor(...a) { if (a.length) super(...a); else super(R.now() + d * 864e5); } static now() { return R.now() + d * 864e5; } } window.Date = FD; }, off);
const p = await ctxW.newPage();
p.on('pageerror', e => errs.push('PAGEERR ' + e.message + ' ' + (e.stack || '').split('\n')[1]));
await p.goto(URL0); await SAVE(p); await p.reload(); await wait(p, 2500); await dismiss(p);
console.log('badge ⚡ sur Monde :', !!(await p.$('[data-act=worlds] .hs-dot')));
await p.evaluate(() => document.querySelector('[data-act=worlds]').click()); await wait(p, 900); await shot(p, '01-modes');
console.log('liste :', await p.evaluate(() => [...document.querySelectorAll('.wp-mode')].map(m => m.innerText.replace(/\s+/g, ' ')).join(' || ')));
await p.evaluate(() => document.querySelector('.wp-mode.weekly').click()); await wait(p, 900); await shot(p, '02-fiche-defi');
console.log('fiche :', await p.evaluate(() => document.querySelector('.mode-modal')?.innerText.replace(/\s+/g, ' ').slice(0, 260)));
await p.evaluate(() => document.querySelector('.mode-modal .btn.primary').click());
await p.waitForFunction(() => window.__lobRun && !window.__lobRun.over, null, { timeout: 20000 }); await wait(p, 3500);
console.log('partie :', await p.evaluate(() => { const r = window.__lobRun; return JSON.stringify({ kind: r.special?.kind, type: r.mission?.type, pot: !!r.mission?.pot, curses: [...r.curse], altar: !!r.altar, tag: document.querySelector('#worldTag')?.innerText }); }));
await shot(p, '03-marmite');
// le héros reste à côté de la marmite pendant 60 s (invincible, il attaque tout seul) : la marmite doit tenir
console.log(await p.evaluate(() => {
  const r = window.__lobRun, M = r.mission, P = M.pot; r.onLevelUp = (t, o, d) => d(o[0]); r.onChest = (c, g, d) => d && d();
  // le héros tourne autour de la marmite dans le cercle de protection (rayon 140), comme un joueur qui la défend
  for (let i = 0; i < 30 * 200 && M.el < M.t - 1 && !M.failed && !r.over && !r.paused; i++) {
    const a = i / 30 * 0.9; r.p.inv = 9; r.p.hp = r.p.maxHp; r.p.x = P.x + Math.cos(a) * 140; r.p.y = P.y + Math.sin(a) * 140; r.update(1 / 30);
  }
  return `défense : marmite ${Math.round(P.hp)} % après ${Math.round(M.el)} s sur ${M.t} avec le héros à côté (niveau ${r.p.level}), assaillants en vie ${r.enemies.filter(e => e.siege && !e.dead).length}`;
}));
await wait(p, 400); await shot(p, '04-assaut');
console.log('HUD :', await p.evaluate(() => `${document.querySelector('#timer')?.innerText} | ${document.querySelector('#timerLbl')?.innerText}`));
// réussite : on arrive au bout du temps avec la marmite debout
await p.evaluate(() => { const r = window.__lobRun, M = r.mission; r.paused = false; document.querySelectorAll('.lvl-ov').forEach(x => x.remove()); M.pot.hp = Math.max(M.pot.hp, 40); M.el = M.t - 0.05; r.update(1 / 30); });
await p.waitForFunction(() => window.__lobRun?.portal, null, { timeout: 10000 }).catch(() => console.log('pas de portail'));
await p.evaluate(() => { const r = window.__lobRun; for (let i = 0; i < 40 && !r.over && !r.paused; i++) { r.p.inv = 9; r.p.x = r.portal.x; r.p.y = r.portal.y; r.update(1 / 30); } for (let i = 0; i < 120 && !r.over; i++) { r.p.x = r.portal.x; r.p.y = r.portal.y; r.update(1 / 30); } });
for (let i = 0; i < 30 && !(await p.$('.reward-screen')); i++) { const l = await p.$('[data-act=later]'); if (l) await l.click({ force: true }).catch(() => {}); if (await p.$('.chest-stage')) await p.mouse.click(dev.viewport.width / 2, dev.viewport.height * 0.6); await wait(p, 600); }
await wait(p, 800); await shot(p, '05-bilan-reussi');
console.log('bilan :', await p.evaluate(() => (document.querySelector('.rs-title')?.innerText || '') + ' | ' + (document.querySelector('.ms-res')?.innerText.replace(/\s+/g, ' ') || '')));
console.log('semaine :', await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('lob_save_v1')); return JSON.stringify({ weekChal: s.weekChal, quêtesSemaine: !!s.weekly?.quests, shards: s.mythShards }); }));
// échec : la marmite tombe
await p.evaluate(() => document.querySelector('.end-btns [data-act=special]')?.click());
await p.waitForFunction(() => window.__lobRun && !window.__lobRun.over && window.__lobRun.mission?.pot, null, { timeout: 20000 }); await wait(p, 1500);
// le héros abandonne la marmite : elle tombe (mesure du temps qu'elle tient seule), défi raté
console.log(await p.evaluate(() => {
  const r = window.__lobRun, M = r.mission, P = M.pot; r.onLevelUp = (t, o, d) => d(o[0]); r.onChest = (c, g, d) => d && d(); r.p.x = 420; r.p.y = 420;
  let i = 0; for (; i < 30 * 90 && !M.failed && !r.over; i++) { r.p.inv = 9; r.p.hp = r.p.maxHp; r.p.x = 420; r.p.y = 420; r.update(1 / 30); }
  return `abandon : marmite tombée après ${Math.round(i / 30)} s (${M.failed ? 'échec' : 'tient encore'})`;
}));
await wait(p, 2600);
for (let i = 0; i < 20 && !(await p.$('.reward-screen')); i++) { const l = await p.$('[data-act=later]'); if (l) await l.click({ force: true }).catch(() => {}); await wait(p, 500); }
console.log('échec :', await p.evaluate(() => (document.querySelector('.rs-title')?.innerText || '') + ' | ' + (document.querySelector('.ms-res')?.innerText.replace(/\s+/g, ' ') || '')));
await shot(p, '06-bilan-rate');
// 2) mode infini
await p.evaluate(() => document.querySelector('.end-btns [data-act=home]')?.click()); await wait(p, 1500); await dismiss(p);
await p.evaluate(() => document.querySelector('[data-act=worlds]').click()); await wait(p, 900);
await p.evaluate(() => document.querySelector('.wp-mode.endless').click()); await wait(p, 900); await shot(p, '07-fiche-infini');
await p.evaluate(() => document.querySelector('.mode-modal .btn.primary').click());
await p.waitForFunction(() => window.__lobRun && !window.__lobRun.over, null, { timeout: 20000 }); await wait(p, 2000);
console.log('infini :', await p.evaluate(() => { const r = window.__lobRun; for (let i = 0; i < 30 * 40 && !r.over && !r.paused; i++) { r.p.inv = 9; r.p.hp = r.p.maxHp; r.update(1 / 30); } return JSON.stringify({ type: r.mission?.type, altar: !!r.altar, boss: !!r.boss, t: Math.round(r.time), timer: document.querySelector('#timer')?.innerText, lbl: document.querySelector('#timerLbl')?.innerText }); }));
await shot(p, '08-infini');
await p.evaluate(() => { const r = window.__lobRun; r.p.inv = 0; r.p.shieldHit = 0; r.it.dodge = 0; r.p.hp = 1; r.hurtPlayer(1e9, null); });
await wait(p, 1500);
await p.evaluate(() => [...document.querySelectorAll('.modal-wrap .btn')].find(x => /Terminer|bilan/i.test(x.textContent))?.click()); await wait(p, 1500);
for (let i = 0; i < 20 && !(await p.$('.reward-screen')); i++) { const l = await p.$('[data-act=later]'); if (l) await l.click({ force: true }).catch(() => {}); await wait(p, 500); }
console.log('bilan infini :', await p.evaluate(() => (document.querySelector('.rs-title')?.innerText || '') + ' | ' + (document.querySelector('.ms-res')?.innerText.replace(/\s+/g, ' ') || '')), '| record', await p.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('lob_save_v1')).endless)));
await shot(p, '09-bilan-infini');
console.log(errs.length ? errs.join('\n') : 'no errors'); await b.close();
