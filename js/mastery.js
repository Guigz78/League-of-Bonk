// Niveau des champions : XP gagnée à chaque partie avec un champion (run.track), niveaux 1 à 10 (+1,5 % de dégâts et de PV
// par niveau, appliqué par save.js playerStats), paliers 3 / 5 / 7 / 10 (aura, relance de plus, titre, cadre doré et arme
// de départ niveau 2), puis améliorations à l'infini : une étoile (+0,5 % de dégâts et de PV) toutes les MASTERY.star XP.
// Les clés des paliers (aura:m_<id>, title:m_<id>) sont données par unlocks.js.
import { CLASSES, MASTERY, masteryOf, masteryBonus } from './data.js';
import { save } from './save.js';
import { iconImg } from './art.js';
import { esc, fmt } from './ui.js';

export const masteryLv = cls => masteryOf(save.mastery?.[cls]).lv;
// ce que donne chaque palier
const MILE = {
  [MASTERY.at.aura]: c => ({ icon: 'aura', txt: `Aura de ${c}` }),
  [MASTERY.at.reroll]: () => ({ icon: 'reroll', txt: 'Une relance de plus par partie' }),
  [MASTERY.at.title]: c => ({ icon: 'flag', txt: `Titre « Âme de ${c} »` }),
  [MASTERY.at.gold]: () => ({ icon: 'medal', txt: 'Cadre doré, arme de départ niveau 2' }),
};
export const mileInfo = (m, cls) => MILE[m]?.(CLASSES[cls]?.name || '') || { icon: 'star', txt: '' };

// XP d'une partie : monstres, niveau atteint, mondes vaincus (plus en Difficile / Cauchemar et en Abysse)
export function masteryXp(t = {}, cleared = 0, diff = 0, abyss = 0) {
  const M = MASTERY;
  return Math.max(0, Math.round((+t.kills || 0) * M.kills + (+t.level || 0) * M.level + cleared * (M.world + M.diff * diff) * (1 + M.abyss * abyss)));
}

// ajoute l'XP au champion ; renvoie l'avant / après pour le bilan
export function gainMastery(cls, xp) {
  save.mastery ||= {};
  const x0 = save.mastery[cls] || 0, a = masteryOf(x0), b = masteryOf(x0 + xp);
  save.mastery[cls] = x0 + xp;
  return { cls, xp, from: a.lv, to: b.lv, cur: b.cur, next: b.next, s0: a.stars, stars: b.stars,
    miles: MASTERY.miles.filter(m => m > a.lv && m <= b.lv) };
}

const low = t => t.charAt(0).toLowerCase() + t.slice(1);
const pc = v => `${(Math.round(v * 1000) / 10).toLocaleString('fr-FR')} %`;
const bonusTxt = (lv, st) => { const b = masteryBonus(lv, st); return b.dmg ? `+${pc(b.dmg)} de dégâts et de PV` : 'Aucun bonus pour l\'instant'; };
const bar = (cur, next) => `<span class="pbar cy"><i style="width:${next ? Math.min(100, cur / next * 100).toFixed(1) : 100}%"></i></span>`;
const starTag = n => (n ? ` <i class="ms-stars">★ ${n}</i>` : '');

// petite pastille du niveau (onglets de l'écran des champions)
export function masteryChip(cls) {
  const lv = masteryLv(cls);
  return `<i class="ms-chip ${lv >= MASTERY.max ? 'gold' : ''}" aria-label="Niveau ${lv}">${lv}</i>`;
}

// encadré de la fiche d'un champion : niveau, barre d'XP, bonus, paliers, étoiles à l'infini
export function masteryPanel(cls) {
  const M = masteryOf(save.mastery?.[cls]), name = CLASSES[cls]?.name || '', top = M.lv >= MASTERY.max;
  const next = MASTERY.miles.find(m => m > M.lv);
  const miles = MASTERY.miles.map(m => { const I = mileInfo(m, cls); return `<span class="ms-mile ${M.lv >= m ? 'on' : ''}">${iconImg(M.lv >= m ? I.icon : 'lock', 16)}<b>${m}</b><small>${esc(I.txt)}</small></span>`; }).join('');
  return `<div class="ms-panel ${top ? 'gold' : ''}">
      <span class="ms-lv"><small>Niveau</small><b>${M.lv}</b></span>
      <div class="ms-txt"><b>${esc(name)} · ${top ? `niveau max${starTag(M.stars)}` : `niveau ${M.lv}/${MASTERY.max}`}</b>
        <div class="ms-prog">${bar(M.cur, M.next)}<em>${fmt(M.cur)}/${fmt(M.next)} XP${top ? ' · ★' : ''}</em></div>
        <small>${bonusTxt(M.lv, M.stars)}${next ? ` · niveau ${next} : ${esc(low(mileInfo(next, cls).txt))}` : ''}</small></div>
    </div>
    <div class="ms-miles">${miles}</div>
    <p class="muted ms-note">XP à chaque partie avec ${esc(name)} : monstres, niveau atteint et mondes vaincus (plus en Difficile, Cauchemar et Abysse).
      ${top ? `Améliorations à l'infini : une étoile toutes les ${fmt(MASTERY.star)} XP, +${pc(MASTERY.starPer)} de dégâts et de PV chacune.` : `Au niveau ${MASTERY.max}, les améliorations continuent à l'infini (étoiles).`}</p>`;
}

// ligne du bilan de partie : « Niveau de Lumi 7 → 8 », puis les étoiles gagnées
export function masteryResult(ms) {
  if (!ms || !CLASSES[ms.cls]) return '';
  const name = CLASSES[ms.cls].name, up = ms.to > ms.from, st = (ms.stars || 0) - (ms.s0 || 0), top = ms.to >= MASTERY.max;
  const miles = ms.miles.map(m => `<div class="rw ms-mile-got">${iconImg(mileInfo(m, ms.cls).icon, 20)}<span>Niveau ${m} : <b>${esc(mileInfo(m, ms.cls).txt)}</b></span></div>`).join('')
    + (st > 0 ? `<div class="rw ms-mile-got">${iconImg('star', 20)}<span><b>+${st} étoile${st > 1 ? 's' : ''}</b> : +${pc(MASTERY.starPer * st)} de dégâts et de PV</span></div>` : '');
  return `<h3 class="section-t">Champion <small>+${fmt(ms.xp)} XP</small></h3>
    <div class="ms-res ${up || st > 0 ? 'up' : ''} ${top ? 'gold' : ''}">
      <span class="ms-lv"><small>Niveau</small><b>${ms.to}</b></span>
      <div class="ms-txt"><b>${esc(name)} ${up ? `niveau ${ms.from} <i class="rs-arrow">→</i> ${ms.to}` : `niveau ${ms.to}`}${starTag(ms.stars)}</b>
        <div class="ms-prog">${bar(ms.cur, ms.next)}<em>${fmt(ms.cur)}/${fmt(ms.next)}</em></div>
        <small>${bonusTxt(ms.to, ms.stars)}</small></div>
    </div>${miles ? `<div class="summary">${miles}</div>` : ''}`;
}
