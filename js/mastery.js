// Niveau des champions : XP gagnée à chaque partie avec un champion (run.track), niveaux 1 à 10 (+1,5 % de dégâts et de PV
// par niveau, appliqué par save.js playerStats) et un bonus spécial à chaque niveau (MASTERY.perks : vitesse, aura,
// or, relance, garde, titre et ultime, expérience, coffres, arme de départ niveau 2), puis améliorations à l'infini : une
// étoile toutes les MASTERY.star XP (+0,5 % de dégâts et de PV et un petit bonus tournant, MASTERY.starCycle).
// Les clés des paliers (aura:m_<id>, title:m_<id>) sont données par unlocks.js.
import { CLASSES, MASTERY, masteryOf, masteryBonus } from './data.js';
import { save } from './save.js';
import { iconImg } from './art.js';
import { esc, fmt } from './ui.js';

export const masteryLv = cls => masteryOf(save.mastery?.[cls]).lv;
// bonus spécial d'un niveau : { icon, name, txt }
export function mileInfo(m, cls) {
  const P = MASTERY.perks[m], c = CLASSES[cls]?.name || '';
  return P ? { icon: P.icon, name: P.name, txt: P.desc.replace(/\{c\}/g, c) } : { icon: 'star', name: '', txt: '' };
}
// bonus tournant de la n-ième étoile (1, 2, 3…)
const starTxt = n => MASTERY.starCycle[(n - 1) % MASTERY.starCycle.length].txt;

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
  const miles = MASTERY.miles.map(m => { const I = mileInfo(m, cls); return `<span class="ms-mile ${M.lv >= m ? 'on' : ''} ${m === M.lv + 1 ? 'next' : ''}">${iconImg(M.lv >= m ? I.icon : 'lock', 16)}<b>Niv. ${m} · ${esc(I.name)}</b><small>${esc(I.txt)}</small></span>`; }).join('');
  return `<div class="ms-panel ${top ? 'gold' : ''}">
      <span class="ms-lv"><small>Niveau</small><b>${M.lv}</b></span>
      <div class="ms-txt"><b>${esc(name)} · ${top ? `niveau max${starTag(M.stars)}` : `niveau ${M.lv}/${MASTERY.max}`}</b>
        <div class="ms-prog">${bar(M.cur, M.next)}<em>${fmt(M.cur)}/${fmt(M.next)} XP${top ? ' · ★' : ''}</em></div>
        <small>${bonusTxt(M.lv, M.stars)}${next ? ` · niveau ${next} : ${esc(mileInfo(next, cls).name)}` : ` · prochaine étoile : ${esc(starTxt(M.stars + 1))}`}</small></div>
    </div>
    <div class="ms-miles">${miles}</div>
    <p class="muted ms-note">XP à chaque partie avec ${esc(name)} : monstres, niveau atteint et mondes vaincus (plus en Difficile, Cauchemar et Abysse).
      Chaque niveau donne +${pc(MASTERY.per)} de dégâts et de PV <b>et un bonus spécial</b>.
      ${top ? `Améliorations à l'infini : une étoile toutes les ${fmt(MASTERY.star)} XP, +${pc(MASTERY.starPer)} de dégâts et de PV et un bonus en plus (or, expérience, ramassage, vitesse).` : `Au niveau ${MASTERY.max}, les améliorations continuent à l'infini (étoiles).`}</p>`;
}

// ligne du bilan de partie : « Niveau de Lumi 7 → 8 », puis les étoiles gagnées
export function masteryResult(ms) {
  if (!ms || !CLASSES[ms.cls]) return '';
  const name = CLASSES[ms.cls].name, up = ms.to > ms.from, st = (ms.stars || 0) - (ms.s0 || 0), top = ms.to >= MASTERY.max;
  // passage de niveau : chaque bonus spécial gagné est mis en avant (carte animée)
  const miles = ms.miles.map(m => { const I = mileInfo(m, ms.cls); return `<div class="ms-up">${iconImg(I.icon, 30)}<span><small>Niveau ${m} · bonus spécial</small><b>${esc(I.name)}</b><em>${esc(I.txt)}</em></span></div>`; }).join('')
    + Array.from({ length: Math.min(st, 5) }, (_, i) => { const n = (ms.s0 || 0) + i + 1; return `<div class="ms-up star">${iconImg('star', 30)}<span><small>Étoile ${n} · amélioration infinie</small><b>+${pc(MASTERY.starPer)} de dégâts et de PV</b><em>${esc(starTxt(n))}</em></span></div>`; }).join('');
  return `<h3 class="section-t">Champion <small>+${fmt(ms.xp)} XP</small></h3>
    <div class="ms-res ${up || st > 0 ? 'up' : ''} ${top ? 'gold' : ''}">
      <span class="ms-lv"><small>Niveau</small><b>${ms.to}</b></span>
      <div class="ms-txt"><b>${esc(name)} ${up ? `niveau ${ms.from} <i class="rs-arrow">→</i> ${ms.to}` : `niveau ${ms.to}`}${starTag(ms.stars)}</b>
        <div class="ms-prog">${bar(ms.cur, ms.next)}<em>${fmt(ms.cur)}/${fmt(ms.next)}</em></div>
        <small>${bonusTxt(ms.to, ms.stars)}</small></div>
    </div>${miles ? `<div class="ms-ups">${miles}</div>` : ''}`;
}
