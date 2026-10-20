// Vérifie la liste FILES de sw.js (jeu hors connexion) : node tools/check-sw.mjs
// - chaque import relatif des modules js/**/*.js (statique, export … from, import() dynamique) y figure ;
// - chaque ressource citée par index.html, css/*.css, manifest.webmanifest et les url(...) des modules y figure ;
// - chaque entrée existe sur le disque. Code de sortie 1 en cas d'oubli.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rel = f => path.relative(ROOT, f).split(path.sep).join('/');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

const sw = read('sw.js');
const list = /const FILES = \[([\s\S]*?)\];/.exec(sw);
if (!list) { console.error('FILES introuvable dans sw.js'); process.exit(1); }
const FILES = new Set([...list[1].matchAll(/'([^']*)'/g)].map(m => m[1]));

const need = new Map(); // ressource -> d'où elle est citée
const add = (f, from) => { if (!need.has(f)) need.set(f, from); };
const local = u => u && !/^(data:|https?:|blob:|#|mailto:)/.test(u);

// modules : on suit les imports depuis tous les fichiers de js/
const walk = d => fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).flatMap(e => (e.isDirectory() ? walk(d + '/' + e.name) : e.name.endsWith('.js') ? [d + '/' + e.name] : []));
const mods = walk('js');
for (const f of mods) {
  const src = read(f);
  const re = /(?:\bimport\s*(?:[\w*{}\s,]+\s*from\s*)?|\bexport\s*[\w*{}\s,]+\s*from\s*|\bimport\s*\(\s*)['"](\.{1,2}\/[^'"]+)['"]/g;
  for (const m of src.matchAll(re)) add(rel(path.resolve(path.dirname(path.join(ROOT, f)), m[1])), f);
  for (const m of src.matchAll(/url\((?!data:)['"]?([^)'"$]+)['"]?\)/g)) if (local(m[1])) add(m[1], f); // FontFace(…, 'url(fonts/…)') : relatif à la page
}
for (const f of mods) add(f, 'js/ (module jamais importé)');
// page, feuille de style, manifeste
add('index.html', 'page');
const html = read('index.html');
for (const m of html.matchAll(/\b(?:src|href)="([^"]+)"/g)) if (local(m[1])) add(m[1].replace(/^\.\//, ''), 'index.html');
for (const css of fs.readdirSync(path.join(ROOT, 'css')).filter(f => f.endsWith('.css')).map(f => 'css/' + f)) {
  add(css, 'css/');
  for (const m of read(css).matchAll(/url\(['"]?([^)'"]+)['"]?\)/g)) if (local(m[1])) add(rel(path.resolve(path.join(ROOT, 'css'), m[1])), css);
}
for (const ic of JSON.parse(read('manifest.webmanifest')).icons || []) add(ic.src, 'manifest.webmanifest');

let bad = 0;
for (const [f, from] of need) if (!FILES.has(f)) { console.log(`MANQUE dans FILES : ${f}   (cité par ${from})`); bad++; }
for (const f of FILES) if (f !== './' && !fs.existsSync(path.join(ROOT, f))) { console.log(`ABSENT du disque : ${f}`); bad++; }
const extra = [...FILES].filter(f => f !== './' && !need.has(f) && f !== 'manifest.webmanifest');
if (extra.length) console.log(`(info) dans FILES sans être cités : ${extra.join(', ')}`);
console.log(bad ? `${bad} problème(s)` : `sw.js OK : ${FILES.size} fichiers, ${need.size} ressources citées, tout est en cache`);
process.exit(bad ? 1 : 0);
