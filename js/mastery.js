// Maîtrise des champions (L2) : XP gagnée à chaque partie avec un champion (run.track), niveaux 1 à 30, petit bonus
// permanent par niveau (+1 % dégâts / +1 % PV en alternance, appliqué par save.js playerStats), paliers 5 / 10 / 20 / 30
// (aura, titre, relance de plus, cadre doré). Les clés des paliers (aura:m_<id>, title:m_<id>) sont données par unlocks.js.
import { CLASSES, MASTERY, masteryOf, masteryBonus } from './data.js';
import { save } from './save.js';
import { iconImg } from './art.js';
import { esc, fmt } from './ui.js';

export const masteryLv = cls => masteryOf(save.mastery?.[cls]).lv;
// ce que donne chaque palier
const MILE = {
  5: () => ({ icon: 'aura', txt: 'Aura de maîtrise' }),
  10: c => ({ icon: 'flag', txt: `Titre « Âme de ${c} »` }),
  20: () => ({ icon: 'reroll', txt: 'Une relance de plus par partie' }),
  30: () => ({ icon: 'medal', txt: 'Cadre doré' }),
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
  return { cls, xp, from: a.lv, to: b.lv, cur: b.cur, next: b.next, miles: MASTERY.miles.filter(m => m > a.lv && m <= b.lv) };
}

const bonusTxt = lv => { const b = masteryBonus(lv); return b.dmg || b.hp ? `+${Math.round(b.dmg * 100)} % dégâts · +${Math.round(b.hp * 100)} % PV` : 'Aucun bonus pour l\'instant'; };
const bar = (cur, next) => `<span class="pbar cy"><i style="width:${next ? Math.min(100, cur / next * 100).toFixed(1) : 100}%"></i></span>`;

// petite pastille du niveau (onglets de l'écran des champions)
export function masteryChip(cls) {
  const lv = masteryLv(cls);
  return `<i class="ms-chip ${lv >= MASTERY.max ? 'gold' : ''}" aria-label="Maîtrise ${lv}">${lv}</i>`;
}

// encadré de la fiche d'un champion : niveau, barre d'XP, bonus, paliers
export function masteryPanel(cls) {
  const M = masteryOf(save.mastery?.[cls]), name = CLASSES[cls]?.name || '';
  const next = MASTERY.miles.find(m => m > M.lv);
  const miles = MASTERY.miles.map(m => { const I = mileInfo(m, cls); return `<span class="ms-mile ${M.lv >= m ? 'on' : ''}">${iconImg(M.lv >= m ? I.icon : 'lock', 16)}<b>${m}</b><small>${esc(I.txt)}</small></span>`; }).join('');
  return `<div class="ms-panel ${M.lv >= MASTERY.max ? 'gold' : ''}">
      <span class="ms-lv"><small>Maîtrise</small><b>${M.lv}</b></span>
      <div class="ms-txt"><b>${esc(name)} · ${M.next ? `niveau ${M.lv}/${MASTERY.max}` : 'maîtrise maximale'}</b>
        <div class="ms-prog">${bar(M.cur, M.next)}<em>${M.next ? `${fmt(M.cur)}/${fmt(M.next)} XP` : 'Max'}</em></div>
        <small>${bonusTxt(M.lv)}${next ? ` · palier ${next} : ${esc(mileInfo(next, cls).txt.toLowerCase())}` : ''}</small></div>
    </div>
    <div class="ms-miles">${miles}</div>
    <p class="muted ms-note">XP à chaque partie avec ${esc(name)} : monstres, niveau atteint et mondes vaincus (plus en Difficile, Cauchemar et Abysse).</p>`;
}

// ligne du bilan de partie : « Maîtrise Lumi 7 → 8 »
export function masteryResult(ms) {
  if (!ms || !CLASSES[ms.cls]) return '';
  const name = CLASSES[ms.cls].name, up = ms.to > ms.from;
  const miles = ms.miles.map(m => `<div class="rw ms-mile-got">${iconImg(mileInfo(m, ms.cls).icon, 20)}<span>Palier ${m} : <b>${esc(mileInfo(m, ms.cls).txt)}</b></span></div>`).join('');
  return `<h3 class="section-t">Champion <small>+${fmt(ms.xp)} XP</small></h3>
    <div class="ms-res ${up ? 'up' : ''} ${ms.to >= MASTERY.max ? 'gold' : ''}">
      <span class="ms-lv"><small>Maîtrise</small><b>${ms.to}</b></span>
      <div class="ms-txt"><b>Maîtrise ${esc(name)} ${up ? `${ms.from} <i class="rs-arrow">→</i> ${ms.to}` : ms.to}</b>
        <div class="ms-prog">${bar(ms.cur, ms.next)}<em>${ms.next ? `${fmt(ms.cur)}/${fmt(ms.next)}` : 'Max'}</em></div>
        <small>${bonusTxt(ms.to)}</small></div>
    </div>${miles ? `<div class="summary">${miles}</div>` : ''}`;
}
