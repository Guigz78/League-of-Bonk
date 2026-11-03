// Affichage des objets et de leurs caractéristiques : lignes de stats, image, effet légendaire ou pouvoir mythique.
// Utilisé par les fiches (game.js), l'ouverture des coffres (chests.js) et la forge (forge.js).
import { AFFIXES, LEGEND_EFFECTS, MYTHIC_POWERS } from './data.js';
import { save } from './save.js';
import { iconImg } from './art.js';
import { itemURL } from './visuals.js';
import { esc, fmt } from './ui.js';

// icône et libellé court de chaque caractéristique (listes compactes)
export const AFX = {
  atk: ['fist', 'ATQ'], hp: ['heart', 'PV'], crit: ['target', 'crit.'], critDmg: ['critdmg', 'dégâts crit.'], lifesteal: ['lifesteal', 'vol de vie'],
  haste: ['haste', 'vit. d\'attaque'], speed: ['arrow', 'vitesse'], area: ['area', 'taille des attaques'], armor: ['shield', 'armure'],
  regen: ['potion', 'PV/s'], thorns: ['thorns', 'épines'], dodge: ['dodge', 'esquive'], xp: ['tome', 'XP'], magnet: ['ring', 'ramassage'],
  gold: ['gold', 'or'], ult: ['nova', 'ultime'],
};
export const STAT_ORDER = Object.keys(AFX);
export const nf = (v, d = 1) => (Math.round(v * 10 ** d) / 10 ** d).toLocaleString('fr-FR');
// valeur d'un bonus : « +12 », « +2,5 % », « +0,3 PV/s »
export function affVal(k, v) {
  const f = AFFIXES[k]?.fmt;
  if (f === 'pct') { const p = v * 100; return `+${p >= 10 ? Math.round(p) : nf(p)} %`; }
  if (f === 'regen') return `+${nf(v / 10)} PV/s`;
  return `+${fmt(v)}`;
}
// « Vol de vie +2 % » ; épines : en % de l'ATQ
// version courte : « +12 ATQ », « +2 % vol de vie »
// image 3D d'un objet (js/g3d/items3d.js), éclats pour les légendaires ; sans WebGL : l'icône
export const itemArt = (it, size = 64, cls = '') => {
  const url = itemURL(it.name, it.rarity === 'mythic' ? 'M' : it.rarity === 'legendary');
  return url ? `<img class="it-art ${cls}" src="${url}" width="${size}" height="${size}" alt="">` : iconImg(it.icon, size);
};
export const affShort = (k, v) => (AFFIXES[k]?.fmt === 'regen' ? affVal(k, v) : `${affVal(k, v)} ${AFX[k]?.[1] || k}`);
export const statKeys = it => { const ks = Object.keys(it.stat || {}); const m = it.main && ks.includes(it.main) ? it.main : ks[0]; return m ? [m, ...ks.filter(k => k !== m)] : []; };

// lignes de caractéristiques d'un objet (principale en premier), avec l'écart par rapport à cmp (objet équipé)
export function statRows(it, { cmp = null, next = null } = {}) {
  const ks = statKeys(it);
  const rows = ks.map((k, i) => {
    const v = it.stat[k];
    let tail = '';
    if (next) tail = `<i class="sr-arrow">›</i><b class="sr-next">${affVal(k, next[k] ?? v)}</b>`;
    else if (cmp) {
      const d = v - (cmp.stat?.[k] || 0), eps = AFFIXES[k]?.fmt === 'pct' ? 0.0005 : 0.5;
      if (Math.abs(d) > eps) tail = `<i class="sr-d ${d > 0 ? 'up' : 'down'}">${d > 0 ? '▲' : '▼'}</i>`;
    }
    return `<span class="srow ${i === 0 ? 'main' : ''}">${iconImg(AFX[k]?.[0] || 'star', 18)}<span class="sr-l">${esc(AFFIXES[k]?.name || k)}${k === 'thorns' ? ' <small>(ATQ)</small>' : ''}</span><b class="sr-v">${affVal(k, v)}</b>${tail}</span>`;
  });
  // ce que l'objet équipé a en plus
  if (cmp && !next) for (const k of statKeys(cmp)) if (!(k in it.stat)) rows.push(`<span class="srow lost">${iconImg(AFX[k]?.[0] || 'star', 18)}<span class="sr-l">${esc(AFFIXES[k]?.name || k)}</span><b class="sr-v">${affVal(k, cmp.stat[k]).replace('+', '−')}</b><i class="sr-d down">▼</i></span>`);
  return rows.join('');
}
// encadré de l'effet unique d'un objet légendaire
export const effectBox = id => (LEGEND_EFFECTS[id] ? `<div class="fx-box"><b>${iconImg('star', 16)} ${esc(LEGEND_EFFECTS[id].name)}</b><small>${esc(LEGEND_EFFECTS[id].desc)}</small></div>` : '');
// consigne « touchez… » au-dessus d'une liste d'éléments à toucher (tuiles en relief)
export const tapHint = t => `<p class="tap-hint"><i>👆</i>${t}</p>`;
// pouvoir d'un objet mythique (js/mythic.js)
export const mythBox = id => (MYTHIC_POWERS[id] ? `<div class="fx-box myth"><b><i class="mb-ic">${MYTHIC_POWERS[id].icon}</i><span><small>Pouvoir mythique</small>${esc(MYTHIC_POWERS[id].name)}</span></b><small>${esc(MYTHIC_POWERS[id].desc)}</small></div>` : '');
// effet légendaire ou pouvoir mythique d'un objet
export const itemFx = it => (it.myth ? mythBox(it.myth) : it.effect ? effectBox(it.effect) : '');

// petite vibration (option Vibrations)
export const buzz = ms => { if (save.settings.vibrate && navigator.vibrate) try { navigator.vibrate(ms); } catch (e) { /* non supporté */ } };
