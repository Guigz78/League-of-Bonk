import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage();
for (const [s, name] of [[512, 'icon-512.png'], [192, 'icon-192.png'], [180, 'apple-touch-icon.png']]) {
  await p.setViewportSize({ width: s, height: s });
  await p.goto(`http://localhost:8765/tools/make-icons.html?s=${s}`);
  await p.waitForFunction(() => document.title === 'ready');
  await p.locator('#c').screenshot({ path: `/home/user/league-of-bonk/icons/${name}` });
}
await b.close();
