// Génère l'icône de l'app iOS (1024), les icônes de la PWA (512, 192, 180) et l'écran de lancement iOS (2732)
// à partir de tools/make-app-icon.html. Usage : serveur local sur le dossier du jeu, puis
//   PORT=8765 node tools/make-app-icon.mjs   (Playwright + Chromium requis)
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || 8765;
const OUT = [
  [1024, 'icon', 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png'],
  [512, 'icon', 'icons/icon-512.png'], [192, 'icon', 'icons/icon-192.png'], [180, 'icon', 'icons/apple-touch-icon.png'],
  ...[0, 1, 2].map(i => [2732, 'splash', `ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732${i ? '-' + i : ''}.png`]),
];
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage();
p.on('pageerror', e => { console.error(e); process.exitCode = 1; });
for (const [s, mode, file] of OUT) {
  await p.setViewportSize({ width: Math.min(s, 2732), height: Math.min(s, 2732) });
  await p.goto(`http://localhost:${PORT}/tools/make-app-icon.html?s=${s}&mode=${mode}`);
  await p.waitForFunction(() => document.title === 'ready', null, { timeout: 60000 });
  await p.locator('#c').screenshot({ path: path.join(root, file) });
  console.log('ok', file);
}
await b.close();
