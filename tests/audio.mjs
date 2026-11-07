// Son : quand la page est cachée (autre onglet, autre app, écran verrouillé), tout le son s'arrête ; au retour il
// reprend et la musique repart en mesure. Le séquenceur ne rejoue pas en rafale les notes manquées après un calage.
import { chromium, devices } from 'playwright';
import fs from 'fs';
const OUT = process.env.OUT; fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const p = await (await b.newContext({ ...devices['iPhone 13'] })).newPage();
const errs = []; p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
const wait = ms => p.waitForTimeout(ms);
await p.goto(`http://localhost:${process.env.PORT || 8765}/`);
await p.evaluate(async () => { localStorage.clear(); const S = await import('/js/save.js'); S.save.cls = 'mage'; S.save.tutorialDone = true; S.save.stats.runs = 3; S.persist(); });
await p.reload(); await wait(1500);
await p.mouse.click(195, 400); await wait(300);
const A = 'window.__A || (window.__A = await import("/js/audio.js"))';
const info = () => p.evaluate(async () => { const A = await import('/js/audio.js'); return A.audioInfo(); });
await p.evaluate(async () => { const A = await import('/js/audio.js'); A.music('zone0'); A.sfx('tap'); });
await wait(600);
const st0 = await info();
console.log('en jeu :', st0.state, st0.music);
// page cachée
await p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
await wait(400);
const hid = await info();
// un bruit demandé pendant que la page est cachée ne relance pas le son
await p.evaluate(async () => { const A = await import('/js/audio.js'); A.sfx('coin'); });
await wait(300);
console.log('page cachée :', hid.state, '| après un bruit :', (await info()).state);
// retour
await p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
await wait(500);
const back = await info();
console.log('retour :', back.state, back.music);
// calage de 1,5 s du jeu : pas de rafale de notes (le nombre de sons en cours reste bas)
await p.evaluate(() => { const t = performance.now(); while (performance.now() - t < 1500) { /* calage */ } });
await wait(120);
console.log('après un calage : sons en cours', (await info()).voices);
console.log(errs.length ? errs.join('\n') : 'no errors');
await b.close();
