// Objets mythiques : valeurs, forge (éclats), Giga coffre (révélation), fiche, collection, et les 6 pouvoirs en partie.
import { chromium, devices } from 'playwright';
import fs from 'fs';
const OUT = process.env.OUT; fs.mkdirSync(OUT, { recursive: true });
const VP = process.env.VP || '13';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const dev = VP === 'se' ? { ...devices['iPhone SE'], viewport: { width: 320, height: 568 } } : { ...devices['iPhone 13'] };
const p = await (await b.newContext(dev)).newPage();
const errs = []; p.on('pageerror', e => errs.push('PAGEERR ' + e.message + ' ' + (e.stack || '').split('\n')[1]));
p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
const shot = n => p.screenshot({ path: `${OUT}/${VP}-${n}.png` });
const wait = ms => p.waitForTimeout(ms);
const dismiss = async () => { for (let i = 0; i < 4; i++) { const m = await p.$('.modal-wrap .btn.ghost'); if (!m) break; await m.click({ force: true }).catch(() => {}); await wait(500); } };
await p.goto(`http://localhost:${process.env.PORT || 8765}/`);
await p.evaluate(async () => {
  localStorage.clear(); const S = await import('/js/save.js');
  S.save.cls = 'mage'; S.save.tutorialDone = true; S.save.stats.runs = 9; S.save.unlockedZone = 5; S.save.zoneCleared = [true, true, true, true, true, true];
  S.save.mythShards = 13; S.persist();
});
await p.reload(); await wait(2500); await dismiss();
// 1) valeurs : mythique contre légendaire du dernier monde
console.log(await p.evaluate(async () => {
  const S = await import('/js/save.js'), D = await import('/js/data.js');
  const out = [];
  for (const M of D.MYTHIC_ITEMS) { const it = S.makeMythic(M.id); out.push(`${M.id}: ${Object.keys(it.stat).length} stats, puissance ${Math.round(S.itemPower(it))}, ${it.myth} ${JSON.stringify(it.stat)}`); }
  const L = S.makeItem(Math.random, 5, { slot: 'weapon', rarity: 'legendary' });
  out.push(`légendaire monde 6 : ${Object.keys(L.stat).length} stats, puissance ${Math.round(S.itemPower(L))}`);
  S.save.nextId -= 7; return out.join('\n');
}));
// 2) forge : panneau mythique, fabrication
await p.click('[data-act=tab][data-tab=forge]', { force: true }); await wait(900);
await p.evaluate(() => document.querySelector('.myth-forge')?.scrollIntoView({ block: 'center' })); await wait(400);
await shot('01-forge');
console.log('forge :', await p.evaluate(() => document.querySelector('.myth-forge')?.innerText.replace(/\s+/g, ' ')));
await p.click('[data-act=forgeMyth]', { force: true }); await wait(2600);
await shot('02-forge-anim');
console.log('forgé :', await p.evaluate(() => document.querySelector('.forge-anim .rc-name')?.innerText), '| éclats', await p.evaluate(() => JSON.parse(localStorage.getItem('lob_save_v1')).mythShards));
await p.click('.fa-ok', { force: true }); await wait(700);
await p.evaluate(() => document.querySelector('.myth-forge')?.scrollIntoView({ block: 'center' })); await wait(300);
await shot('03-forge-apres');
// 3) une case pas obtenue : silhouette et pouvoir
await p.evaluate(() => document.querySelector('.mf-cell:not(.got)')?.click()); await wait(700); await shot('04-silhouette');
console.log('silhouette :', await p.evaluate(() => document.querySelector('.item-modal')?.innerText.replace(/\s+/g, ' ').slice(0, 200)));
await p.evaluate(() => document.querySelector('.modal-wrap .btn.primary')?.click()); await wait(500);
// 4) Giga coffre en Cauchemar avec objet mythique forcé
await p.evaluate(async () => { const D = await import('/js/data.js'); D.MYTHIC.giga.splice(0, 3, 1, 1, 1); const S = await import('/js/save.js'); S.save.pendingChests.push({ tier: 3, zone: 5, giga: 1, diff: 2 }); S.persist(); });
await p.click('[data-act=tab][data-tab=adventure]', { force: true }); await wait(900);
await p.evaluate(() => document.querySelector('[data-act=chests]')?.click()); await wait(1200);
await p.evaluate(() => document.querySelector('.cg-card')?.click()); await wait(1500);
for (let i = 0; i < 40; i++) {
  const st = await p.evaluate(() => { const w = document.querySelector('.chest-stage'); return w ? w.className : ''; });
  if (!st) break;
  if (st.includes('mythic')) { await wait(700); await shot('05-coffre-mythique'); console.log('révélation :', await p.evaluate(() => document.querySelector('.cst-slot:last-child .rcard')?.innerText.replace(/\s+/g, ' ').slice(0, 160))); }
  if (await p.$('.chest-stage .rc-shard') && !(await p.evaluate(() => window.__shardShot))) { await p.evaluate(() => { window.__shardShot = 1; }); await wait(400); await shot('05b-eclats'); }
  if (st.includes('done')) { await shot('06-recap'); await p.click('.cst-ok', { force: true }); await wait(800); break; }
  await p.mouse.click(195, 420); await wait(450);
}
console.log('après coffre :', await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('lob_save_v1')); return JSON.stringify({ shards: s.mythShards, got: s.mythGot, eq: s.equipped }); }));
// 5) onglet Héros : tuile et fiche du mythique
await p.goto(`http://localhost:${process.env.PORT || 8765}/`); await wait(2500); await dismiss();
await p.click('[data-act=tab][data-tab=gear]', { force: true }); await wait(900); await shot('07-heros');
const myId = await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('lob_save_v1')); return s.inventory.find(i => i.rarity === 'mythic')?.id; });
await p.evaluate(id => document.querySelector(`[data-act=item][data-id="${id}"]`)?.click(), myId); await wait(900); await shot('08-fiche');
console.log('fiche :', await p.evaluate(() => document.querySelector('.item-modal')?.innerText.replace(/\s+/g, ' ').slice(0, 300)), '| boutons', await p.evaluate(() => [...document.querySelectorAll('.item-modal .modal-btns .btn')].map(b => b.innerText).join(',')));
await p.evaluate(() => document.querySelector('.modal-wrap .btn')?.click()); await wait(500);
// 6) pouvoirs en partie : on équipe deux jeux de mythiques
const play = async (ids) => {
  await p.evaluate(async ids => { const S = await import('/js/save.js'); S.save.inventory = S.save.inventory.filter(i => i.rarity !== 'mythic'); for (const id of ids) { const it = S.makeMythic(id); S.save.inventory.push(it); S.save.equipped[it.slot] = it.id; S.save.mythGot = [...new Set([...S.save.mythGot, id])]; } S.persist(); }, ids);
  await p.goto(`http://localhost:${process.env.PORT || 8765}/`); await wait(2500); await dismiss();
  await p.evaluate(() => document.querySelector('[data-act=play]').click());
  await p.waitForFunction(() => window.__lobRun && !window.__lobRun.over, null, { timeout: 20000 }); await wait(1500);
  await p.evaluate(() => { const r = window.__lobRun; r.onLevelUp = (t, o, d) => d(o[0]); });
};
await play(['faux', 'phenix', 'oeil']);
console.log('A :', await p.evaluate(() => JSON.stringify(window.__lobRun.myth)));
console.log(await p.evaluate(() => {
  const r = window.__lobRun, Z = r.zone, out = [];
  // Faucheuse
  const e = r.addEnemy(Z.monsters[0], 0, { x: r.p.x + 120, y: r.p.y }); e.hp = e.maxHp * 0.25; r.hitEnemy(e, e.maxHp * 0.06, { noCrit: true });
  out.push(`faucheuse : mort ${e.dead}, bonus ${r.reapK}`);
  // Écho : 400 coups sur un ennemi solide
  const t = r.addEnemy(Z.monsters[3], 3, { x: r.p.x + 200, y: r.p.y }); t.hp = t.maxHp = 1e9; let n = 0; const H = r.hitEnemy.bind(r);
  r.hitEnemy = (q, d, o = {}) => { if (q === t) n++; return H(q, d, o); };
  for (let i = 0; i < 400; i++) H(t, 1, { noCrit: true, quiet: true });
  r.hitEnemy = H; out.push(`écho : ${n - 400} frappes en plus sur 400 (≈25 %)`);
  // Renaissance
  r.p.inv = 0; r.p.shieldHit = 0; r.it.dodge = 0; r.p.hp = 5; r.hurtPlayer(1e5, null);
  out.push(`renaissance : PV ${Math.round(r.p.hp)}/${r.p.maxHp}, dying ${r.dying}, utilisée ${r.rebirthUsed}`);
  r.p.inv = 0; r.p.shieldHit = 0; r.p.hp = 5; r.hurtPlayer(1e5, null); out.push(`2e coup fatal : dying ${r.dying}`);
  return out.join('\n');
}));
await wait(300); await shot('09-renaissance');
await p.evaluate(() => { const r = window.__lobRun; r.dying = false; r.paused = false; r.p.hp = r.p.maxHp; document.querySelectorAll('.modal-wrap').forEach(m => m.remove()); r.finish(false); }); await wait(1500);
await play(['sceptre', 'titan', 'couronne']);
console.log('B :', await p.evaluate(() => JSON.stringify(window.__lobRun.myth)));
console.log(await p.evaluate(() => {
  const r = window.__lobRun, Z = r.zone, p = r.p, out = [];
  // Titan
  const a = r.addEnemy(Z.monsters[2], 2, { x: p.x + 40, y: p.y }); a.hp = a.maxHp = 1e7; const hp0 = p.hp; p.inv = 0; p.shieldHit = 0; r.it.dodge = 0;
  r.hurtPlayer(p.maxHp * 0.5, a); out.push(`titan : perdu ${Math.round(hp0 - p.hp)} PV (max ${Math.ceil(p.maxHp * 0.08)}), attaquant -${Math.round(1e7 - a.hp)}`);
  // Roi des Bonks : combo 100
  for (let i = 0; i < 6; i++) r.addEnemy(Z.monsters[0], 0, { x: p.x + 60 + i * 20, y: p.y + 60 });
  r.grid.clear(); for (const e of r.enemies) r.grid.add(e);
  r.combo = 99; const k0 = r.kills; r.addCombo(); out.push(`roi : combo ${r.combo}, bonus x${r.mythDmg().toFixed(2)}, tués par l'onde ${r.kills - k0}`);
  // Pluie d'étoiles : un groupe à 300
  for (let i = 0; i < 10; i++) { const e = r.addEnemy(Z.monsters[1], 1, { x: p.x + 300 + (i % 4) * 25, y: p.y - 120 + Math.floor(i / 4) * 25 }); e.speed = 0; }
  r.grid.clear(); for (const e of r.enemies) r.grid.add(e);
  r.metT = 0; const k1 = r.kills; r.updateMyth(0.01); const n = r.meteors.length; r.updateMyth(0.4);
  out.push(`étoile : lancée ${n}, ennemis tués ${r.kills - k1}`);
  return out.join('\n');
}));
await wait(150); await shot('10-etoile');
await p.evaluate(() => { const r = window.__lobRun; r.combo = 199; r.addCombo(); }); await wait(200); await shot('11-onde-royale');
// quelques secondes de vraie partie avec les pouvoirs
await p.evaluate(() => { const r = window.__lobRun; r.p.hp = r.p.maxHp = 1e6; });
await wait(5000); await shot('12-partie');
console.log(errs.length ? errs.join('\n') : 'no errors'); await b.close();
