// Prépare le dossier www/ embarqué dans l'app iOS (Capacitor) : le jeu tel quel, sans étape de compilation.
// Usage : node tools/build-www.mjs   (puis npx cap sync ios)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'www');
const COPY = ['index.html', 'manifest.webmanifest', 'css', 'js', 'vendor', 'fonts', 'icons'];

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);
let n = 0;
for (const f of COPY) {
  const src = path.join(root, f);
  if (!fs.existsSync(src)) { console.error(`manquant : ${f}`); process.exit(1); }
  fs.cpSync(src, path.join(out, f), { recursive: true, filter: s => !/\.DS_Store$/.test(s) });
}
const walk = d => fs.readdirSync(d, { withFileTypes: true }).forEach(e => (e.isDirectory() ? walk(path.join(d, e.name)) : n++));
walk(out);
console.log(`www/ prêt : ${n} fichiers`);
