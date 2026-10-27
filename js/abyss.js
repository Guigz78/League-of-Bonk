// Abysse (L2) : 10 paliers par monde au-delà de Cauchemar, ouverts un par un. Chaque palier renforce les monstres et ajoute
// une malédiction (data.js ABYSS, ABYSS_CURSES), et les récompenses montent. La partie (run.js) reçoit la difficulté
// effective de runDiff() ; endRunL2 (unlocks.js) enregistre les paliers battus via abyssWin().
import { DIFFICULTIES, ABYSS, ABYSS_TIERS, ABYSS_ROMAN, ABYSS_CURSES, LOOT_TIERS, ZONES } from './data.js';
import { save } from './save.js';
import { iconImg, chestURL } from './art.js';
import { esc, fmt } from './ui.js';

const NIGHT = DIFFICULTIES.length - 1;
const clampT = t => Math.max(0, Math.min(ABYSS_TIERS, t | 0));
export const abyssName = t => 'Abysse ' + ABYSS_ROMAN[clampT(t)];
export const curses = t => ABYSS_CURSES.slice(0, clampT(t));
// l'Abysse d'un monde est ouverte : défi « Porte de l'Abysse » réussi et ce monde battu en Cauchemar
export const abyssOpen = z => !!save.unlocks?.abyss && (save.diffCleared?.[z] || 0) >= DIFFICULTIES.length;
export const abyssBeat = z => save.abyss?.[z] || 0;
// palier le plus haut jouable sur un monde (0 = aucun)
export const abyssTop = z => (abyssOpen(z) ? Math.min(ABYSS_TIERS, abyssBeat(z) + 1) : 0);

// difficulté effective d'une partie : niveau k, renforcé par le palier t (t > 0 : toujours sur la base de Cauchemar)
export function runDiff(k = 0, t = 0) {
  t = clampT(t);
  const D = DIFFICULTIES[Math.max(0, Math.min(NIGHT, t ? NIGHT : k | 0))];
  if (!t) return D;
  const A = ABYSS, C = new Set(curses(t).map(c => c.id)), has = id => C.has(id);
  return { ...D, name: abyssName(t), icon: 'abyss', color: A.color, abyss: t, curses: C,
    desc: `Palier ${t} sur ${ABYSS_TIERS} au-delà de Cauchemar.`,
    hp: D.hp * (1 + A.hp) ** t, dmg: D.dmg * (1 + A.dmg) ** t, boss: D.boss * (1 + A.boss) ** t * (has('bosshp') ? 1.3 : 1),
    spawn: D.spawn * (1 + A.spawn * t), speed: D.speed * (has('fast') ? 1.1 : 1), elite: D.elite * (has('elites') ? 0.5 : 1),
    mods: D.mods + (has('mods') ? 1 : 0), heal: D.heal * (has('lowheal') ? 0.6 : 1),
    gold: D.gold * (1 + A.gold * t), rarity: D.rarity + A.rarity * t, itemMult: D.itemMult + A.itemMult * t };
}

// fin de partie en Abysse t : chaque monde vaincu enregistre son palier ; première victoire = or et coffre de butin.
// worlds = cartes du bilan ({ z, lines }) ; renvoie l'or gagné (ajouté au bilan par game.js)
export function abyssWin(t, cleared = [], worlds = []) {
  const out = { gold: 0, tiers: [] };
  t = clampT(t);
  if (!t) return out;
  save.abyss ||= ZONES.map(() => 0);
  for (const id of cleared) {
    const w = worlds.find(x => x.z?.id === id), lines = w?.lines;
    if ((save.abyss[id] || 0) >= t) { lines?.push(`${iconImg('abyss', 20)} ${esc(abyssName(t))} vaincue`); continue; }
    save.abyss[id] = t;
    const g = ABYSS.first.gold * t, tier = ABYSS.first.chest[t - 1] ?? ABYSS.first.chest.at(-1);
    out.gold += g; out.tiers.push({ id, t });
    save.pendingChests.push({ tier, zone: id });
    if (save.abyssSel) save.abyssSel[id] = Math.min(ABYSS_TIERS, t + 1);
    lines?.push(`${iconImg('abyss', 20)} <b>${esc(abyssName(t))}</b> vaincue : <b>+${fmt(g)} or</b> et ${esc(LOOT_TIERS[tier].name.toLowerCase())}${t < ABYSS_TIERS ? ` · <b>${esc(abyssName(t + 1))}</b> ouverte` : ' · <b>Abysse terminée</b> !'}`);
  }
  return out;
}

// ---------- Fiche de monde ----------
const mul = v => '×' + String(Math.round(v * 100) / 100).replace('.', ',');
// liste des malédictions d'un palier (la dernière arrivée en tête)
export function curseList(t, cls = '') {
  return `<span class="ab-curses ${cls}">${curses(t).map((c, i) => `<span class="ab-c ${i === t - 1 ? 'new' : ''}">${iconImg(c.icon, 16)}<b>${esc(c.name)}</b><small>${esc(c.desc)}</small></span>`).reverse().join('')}</span>`;
}

// boutons des paliers (sous la difficulté) : « — » puis I à X ; sel = palier choisi (0 = pas d'Abysse)
export function abyssBlock(z, sel = 0) {
  const top = abyssTop(z), beat = abyssBeat(z), n = save.diffCleared?.[z] || 0;
  if (!abyssOpen(z)) {
    if (n < 2) return ''; // trop tôt : rien à montrer
    const why = n < DIFFICULTIES.length ? `Battez ce monde en <b>${esc(DIFFICULTIES[NIGHT].name)}</b>` : 'Réussissez le défi « Porte de l\'Abysse »';
    return `<div class="ab-teaser">${iconImg('lock', 18)}<span><b>Abysse</b> · 10 paliers au-delà de Cauchemar<small>${why} pour l'ouvrir.</small></span></div>`;
  }
  const btn = t => {
    const locked = t > top, won = t && t <= beat;
    return `<button class="ab-btn ${t === sel ? 'on' : ''} ${locked ? 'locked' : ''} ${won ? 'beaten' : ''}" data-ab="${t}" aria-label="${t ? esc(abyssName(t)) : 'Sans Abysse'}">${t ? (locked ? iconImg('lock', 14) : `<b>${ABYSS_ROMAN[t]}</b>`) : '<b>—</b>'}</button>`;
  };
  return `<h4 class="ab-h">${iconImg('abyss', 16)} Abysse <small>${beat ? `palier ${beat}/${ABYSS_TIERS} battu` : 'nouveau'}</small></h4>
    <div class="ab-pick" role="radiogroup" aria-label="Palier d'Abysse">${Array.from({ length: ABYSS_TIERS + 1 }, (_, t) => btn(t)).join('')}</div>`;
}

// détail d'un palier (remplace celui de la difficulté quand un palier est choisi)
export function abyssInfo(z, t) {
  const D = runDiff(NIGHT, t), N = DIFFICULTIES[NIGHT];
  return `<p class="di-desc"><b class="ab-name">${esc(abyssName(t))}</b> · palier ${t}/${ABYSS_TIERS} au-delà de ${esc(N.name)}${abyssBeat(z) >= t ? ' · <b class="ab-won">battu</b>' : ''}</p>
    <div class="di-row bad">${iconImg('skull', 16)}<span>Monstres : PV <b>${mul(D.hp)}</b> · dégâts <b>${mul(D.dmg)}</b> · boss <b>${mul(D.boss)}</b> · nombre <b>+${Math.round((D.spawn - 1) * 100)} %</b></span></div>
    ${curseList(t)}
    <div class="di-row good">${iconImg('gold', 16)}<span>Or <b>${mul(D.gold)}</b> · objets plus rares et plus puissants · XP du champion et de saison en plus</span></div>`;
}

// récompenses d'un palier (première victoire sur ce monde)
export function abyssRewards(z, t) {
  const first = abyssBeat(z) < t, tier = ABYSS.first.chest[t - 1] ?? ABYSS.first.chest.at(-1);
  return `<h4>Récompenses ${esc(abyssName(t))}</h4>
    <div class="rewards">
      ${first ? `<div class="rw">${iconImg('gold', 18)}<span>Première victoire : <b>+${fmt(ABYSS.first.gold * t)} or</b></span></div>
      <div class="rw"><img class="chest-i" src="${chestURL(tier)}" width="22" height="22" alt=""><span><b>${esc(LOOT_TIERS[tier].name)}</b></span></div>
      ${t < ABYSS_TIERS ? `<div class="rw">${iconImg('abyss', 18)}<span><b>${esc(abyssName(t + 1))}</b> débloquée</span></div>` : `<div class="rw">${iconImg('crown', 18)}<span>Défi « Seigneur de l'Abysse »</span></div>`}`
    : `<div class="rw">${iconImg('gold', 18)}<span>Or <b>${mul(runDiff(NIGHT, t).gold)}</b>, coffres et objets à bonus de plus en plus rares</span></div>`}
    </div>`;
}

// étiquette sur la tuile d'un monde (accueil) : meilleur palier battu
export const abyssBadge = z => (abyssBeat(z) ? `<em class="ab-badge">${iconImg('abyss', 12)}${ABYSS_ROMAN[abyssBeat(z)]}</em>` : '');
// malédictions de la partie en cours (écran de pause)
export const abyssPause = t => (t ? `<h4>${iconImg('abyss', 16)} ${esc(abyssName(t))} <small>${t} malédiction${t > 1 ? 's' : ''}</small></h4>${curseList(t, 'small')}` : '');
