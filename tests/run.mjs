// Lance les tests du jeu dans un vrai Chromium (Playwright), téléphone iPhone 13 ou iPhone SE simulé.
// Chaque test est un script autonome : on le lance, on lit ce qu'il affiche et on vérifie les résultats attendus (ok) et
// l'absence de signes de problème (bad, plus les erreurs JavaScript). Captures et journaux : tests/out/.
// Usage : node tests/run.mjs            (tous les tests, ~20 à 40 min)
//         node tests/run.mjs --rapide   (les tests courts, ~5 min)
//         node tests/run.mjs story mythic   (seulement ceux dont le nom contient un de ces mots)
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { serve } from './server.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url)), OUT = path.join(DIR, 'out');
// name : nom affiché ; f : script ; env : variables (VP = 13 ou se) ; ok : à trouver ; bad : à ne pas trouver ; rapide : test court
const TESTS = [
  { name: 'données', f: 'data-audit.mjs', ok: [/données cohérentes/], rapide: true },
  { name: 'logique', f: 'logic.mjs', ok: [/(\d+)\/\1 OK/], rapide: true },
  { name: 'saison', f: 'season-units.mjs', ok: [/tous les tests passent/], rapide: true },
  { name: 'ancienne sauvegarde', f: 'old-save.mjs', ok: [/overflow 0/], rapide: true },
  { name: 'joystick tactile', f: 'joystick.mjs', ok: [/doigt posé : avance .* doigt levé : arrêté .* scroll page : 0/], rapide: true },
  { name: 'barre du haut 13', f: 'topbar.mjs', env: { VP: '13' }, ok: [/^barre : .*déborde false/m], bad: [/déborde true/, /:(?!40h)\d+h /], rapide: true },
  { name: 'barre du haut SE', f: 'topbar.mjs', env: { VP: 'se' }, ok: [/^barre : .*déborde false/m], bad: [/déborde true/, /:(?!40h)\d+h /], rapide: true },
  { name: 'connexion', f: 'login.mjs', env: { VP: '13' }, rapide: true,
    ok: [/Google \(web\) : \/auth\/v1\/authorize provider google/, /app Google : fenêtre ouverte true \| provider google \| retour com\.guigz78\.leagueofbonk:\/\/login \| PKCE true/, /app après retour : .*"status":"synced".*bande false \| bouton compte connecté true/,
      /conflit : fenêtre true .*Deux sauvegardes/i, /conflit : choix en ligne → or 77[0-9 ]{3} \| état (synced|syncing)/] },
  { name: 'forge, coffres, options', f: 'screens-split.mjs', env: { VP: 'se' }, rapide: true,
    ok: [/fabrication : objets (\d+) → (?!\1)\d+ \| pièces arme commune 4 \| animation fermée true/, /fusion : pièces arme commune 0, peu commune 2 \| forge affichée true/,
      /case choisie : weapon 1/, /coffres : restants 0 \| accueil true/, /graphismes : lite/, /compte : .+ \| 6 chiffres/, /bande « Plus tard » : (cachée true \| mémorisée true|pas de bande)/, /no errors/] },
  { name: 'hors connexion', f: 'offline.mjs', rapide: true,
    ok: [/cache : lob-v\d+ : \d+ fichiers/, /réseau coupé : oui/, /accueil hors ligne : true \| jouer : true/, /partie hors ligne : true \| 3D : true/, /no errors/] },
  { name: 'défilement 13', f: 'screens-scroll.mjs', env: { VP: '13', SCROLL: '1' }, ok: [/défilement story-screen/], bad: [/BLOQUÉ/, / ERREUR /] },
  { name: 'défilement SE', f: 'screens-scroll.mjs', env: { VP: 'se', SCROLL: '1' }, ok: [/défilement story-screen/], bad: [/BLOQUÉ/, / ERREUR /] },
  { name: 'objets mythiques', f: 'mythic.mjs', env: { VP: '13' },
    ok: [/faucheuse : mort true/, /renaissance : PV \d+\/\d+, dying undefined, utilisée true/, /2e coup fatal : dying true/, /titan : perdu \d+ PV/, /étoile : lancée 1/] },
  { name: 'histoire SE', f: 'story.mjs', env: { VP: 'se' }, ok: [/^titre soupe/m, /"c12":7/], bad: [/^\s*pas de (boss|portail|scène|garde)|\(pas de scène\)|non lancé/m] },
  { name: 'modes spéciaux', f: 'modes.mjs', env: { VP: '13' },
    ok: [/liste : .*DÉFI DE LA SEMAINE.*MODE INFINI/, /partie : \{"kind":"weekly","type":"defend","pot":true/, /défense : marmite [1-9]\d* % /, /bilan : DÉFI RÉUSSI\s!/,
      /semaine : \{"weekChal":\{"key":"\d{4}-W\d{2}","done":true\},"quêtesSemaine":true,"shards":1\}/, /abandon : marmite tombée après \d+ s \(échec\)/, /échec : DÉFI RATÉ/,
      /"type":"endless","altar":false,"boss":false/, /bilan infini : (NOUVEAU RECORD|MODE INFINI)/], bad: [/pas de portail/] },
  { name: 'familiers', f: 'pets.mjs', env: { VP: 'se' },
    ok: [/Tenez 5:00 en mode infini 1:35 \/ 5:00/, /Ouvrez 40 coffres de butin 17 \/ 40/, /titre : FAMILIER 1\/12/, /annonce : Nouveau familier : Cocotte, Givret, Grigou, Zip, Plume, Gorgothin/,
      /obtenus : poro,cocotte,givret,grigou,zip,plume,gorgothin/, /givret : .*gelés (1[0-9]|[5-9])/, /grigou : .*pièce de 10 → 12 or/, /zip : .*éclairs [1-9]/, /plume : .*XP ×1\.15/,
      /gorgothin : .*élite → 120/, /no errors/] },
  { name: 'partie 3D', f: 'smoke.mjs', ok: [/no errors/] },
  { name: 'expédition et giga boss', f: 'giga.mjs', ok: [/"gigaKills":1/] },
  { name: 'chasse aux bugs 13', f: 'bugs-tour.mjs', env: { VP: '13' }, ok: [/aucun problème/] },
  { name: 'chasse aux bugs SE', f: 'bugs-tour.mjs', env: { VP: 'se' }, ok: [/aucun problème/] },
];
const BAD = [/PAGEERR/, /^CONSOLE /m, /^\s*at .*\.mjs:\d+/m, /triggerUncaughtException/];

const args = process.argv.slice(2), rapide = args.includes('--rapide'), words = args.filter(a => !a.startsWith('--'));
const list = TESTS.filter(t => (!rapide || t.rapide) && (!words.length || words.some(w => (t.name + ' ' + t.f).includes(w))));
fs.mkdirSync(OUT, { recursive: true });
const { port, close } = await serve(0);
console.log(`${list.length} test${list.length > 1 ? 's' : ''} · jeu servi sur le port ${port}\n`);

const run = t => new Promise(resolve => {
  const slug = (t.f.replace('.mjs', '') + (t.env?.VP ? '-' + t.env.VP : '')), out = path.join(OUT, slug);
  const env = { ...process.env, PORT: String(port), OUT: out, ...(t.env || {}) };
  const t0 = Date.now(), ch = spawn(process.execPath, [path.join(DIR, t.f)], { env, cwd: path.resolve(DIR, '..') });
  let log = '';
  ch.stdout.on('data', d => { log += d; }); ch.stderr.on('data', d => { log += d; });
  const kill = setTimeout(() => { log += '\nDÉLAI DÉPASSÉ'; ch.kill('SIGKILL'); }, 25 * 60000);
  ch.on('close', code => {
    clearTimeout(kill);
    fs.writeFileSync(out + '.log', log);
    const missing = (t.ok || []).filter(r => !r.test(log)), found = [...(t.bad || []), ...BAD].filter(r => r.test(log));
    const pass = code === 0 && !missing.length && !found.length && !/DÉLAI DÉPASSÉ/.test(log);
    resolve({ t, pass, code, secs: Math.round((Date.now() - t0) / 1000), missing, found, log, slug });
  });
});

const results = [];
for (const t of list) {
  const tty = process.stdout.isTTY;
  if (tty) process.stdout.write(`… ${t.name}`);
  const r = await run(t); results.push(r);
  process.stdout.write(`${tty ? '\r' : ''}${r.pass ? '✔' : '✘'} ${t.name} (${r.secs} s)\n`);
  if (!r.pass) {
    if (r.code) console.log(`    sortie ${r.code}`);
    for (const m of r.missing) console.log(`    attendu, pas trouvé : ${m}`);
    for (const f of r.found) console.log(`    problème : ${(r.log.match(f) || [''])[0].slice(0, 160)}`);
    console.log(`    journal : tests/out/${r.slug}.log`);
    // sur GitHub, la fin du journal s'affiche directement (les captures sont dans l'artefact « tests-captures »)
    if (process.env.CI) console.log(r.log.trim().split('\n').slice(-15).map(l => '    | ' + l.slice(0, 220)).join('\n'));
  }
}
close();
const ko = results.filter(r => !r.pass);
console.log(`\n${results.length - ko.length}/${results.length} tests réussis${ko.length ? ` · échecs : ${ko.map(r => r.t.name).join(', ')}` : ''}`);
process.exit(ko.length ? 1 : 0);
