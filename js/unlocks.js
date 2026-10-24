// Déblocages façon Megabonk (L2) : ce qui est verrouillé au départ (data.js LOCKED, CLASSES[id].locked, auras, titres,
// Abysse), défis qui le débloquent (UNLOCK_CHALLENGES, progression lue dans save.stats et les records save.rec tenus
// d'après run.track), fin de partie (records, maîtrise, Abysse, défis), écran « Défis » et choix de l'aura.
// Magasin de clés partagé : save.unlocks = { 'w:<arme>': true, 'cls:<champion>': true, … } (la Saison L1 y écrit aussi).
import { CLASSES, WEAPONS, TOMES, BOOSTS, EVOLUTIONS, ZONES, LOOT_TIERS, LOCKED, AURAS, UNLOCK_TITLES, CHALLENGE_CATS, UNLOCK_CHALLENGES,
  MASTERY, masteryOf } from './data.js';
import { save, persist } from './save.js';
import { iconImg, chestURL } from './art.js';
import { sfx } from './audio.js';
import { mount, $, esc, fmt, toast, bind } from './ui.js';
import { masteryXp, gainMastery, masteryResult } from './mastery.js';
import { abyssWin } from './abyss.js';

// ---------- Verrous ----------
const keys = () => (save.unlocks ||= {});
export const unlocked = key => !!keys()[key];
// arme ('w'), tome ('t') ou bonus ('boost') : libre s'il n'est pas verrouillé au départ, ou s'il a été débloqué
export const isFree = (kind, id) => !(LOCKED[kind] || []).includes(id) || unlocked(kind + ':' + id);
// l'arme de départ d'un champion lui reste toujours ouverte
export const canPickWeapon = (id, cls) => isFree('w', id) || CLASSES[cls]?.weapon === id;
export const canPickTome = id => isFree('t', id);
export const clsLocked = id => !!CLASSES[id]?.locked && !unlocked('cls:' + id);
export const unlockedBoostIds = () => Object.keys(BOOSTS).filter(id => isFree('boost', id));

// auras : celles de la table + une aura de maîtrise par champion ('m_<id>')
export function auraDef(id) {
  if (AURAS[id]) return AURAS[id];
  const c = typeof id === 'string' && id.startsWith('m_') ? CLASSES[id.slice(2)] : null;
  return c ? { name: `Maîtrise de ${c.name}`, color: MASTERY.aura[c.id] || '#ffd54a' } : null;
}
// titres des défis et de la maîtrise (« Âme de Lumi ») : la Saison (L1) peut les lister
export const l2Titles = () => ({ ...UNLOCK_TITLES, ...Object.fromEntries(Object.values(CLASSES).map(c => ['m_' + c.id, `Âme de ${c.name}`])) });
// couleur d'aura choisie pour la forme ultime d'un champion (null = celle d'origine)
export function auraColor(cls) {
  const id = save.aura?.[cls];
  return id && unlocked('aura:' + id) ? auraDef(id)?.color || null : null;
}
export function setAura(cls, id) {
  save.aura ||= {};
  if (id && unlocked('aura:' + id) && auraDef(id)) save.aura[cls] = id; else delete save.aura[cls];
  persist({ touch: false });
}
// l'aura choisie remplace celle du dernier stade partout (modèle 3D, effets d'évolution, fiches) sans toucher au rendu :
// la couleur du dernier stade de chaque champion est lue à travers un accesseur
const AURA0 = {}; // couleurs d'origine
for (const [cls, evs] of Object.entries(EVOLUTIONS)) {
  const last = evs?.[evs.length - 1];
  if (!last?.aura) continue;
  AURA0[cls] = last.aura;
  Object.defineProperty(last, 'aura', { enumerable: true, configurable: true, get: () => auraColor(cls) || AURA0[cls], set: v => { AURA0[cls] = v; } });
}

// nom, icône et genre d'une clé de déblocage
export function keyInfo(key) {
  const i = key.indexOf(':'), k = i < 0 ? key : key.slice(0, i), id = i < 0 ? '' : key.slice(i + 1);
  if (k === 'w' && WEAPONS[id]) return { icon: WEAPONS[id].icon, name: WEAPONS[id].name, kind: 'Arme' };
  if (k === 't' && TOMES[id]) return { icon: TOMES[id].icon, name: TOMES[id].name, kind: 'Tome' };
  if (k === 'boost' && BOOSTS[id]) return { icon: BOOSTS[id].icon, name: BOOSTS[id].name, kind: 'Bonus' };
  if (k === 'cls' && CLASSES[id]) return { icon: 'user', name: CLASSES[id].name, kind: 'Champion' };
  if (k === 'aura' && auraDef(id)) return { icon: 'aura', name: `Aura ${auraDef(id).name}`, kind: 'Aura', color: auraDef(id).color };
  if (k === 'title') return { icon: 'flag', name: `Titre « ${l2Titles()[id] || id} »`, kind: 'Titre' };
  if (k === 'abyss') return { icon: 'abyss', name: 'Abysse', kind: 'Mode' };
  return { icon: 'star', name: key, kind: '' };
}

// ---------- Défis ----------
// défis affichés (ceux d'un champion absent de cette version sont masqués)
export const challengeList = () => UNLOCK_CHALLENGES.filter(c => !c.need || CLASSES[c.need]);
const progOf = c => { try { return Math.max(0, +c.prog(save) || 0); } catch (e) { return 0; } };
export const challengeFor = key => challengeList().find(c => (c.rw.keys || [c.rw.key]).includes(key)) || null;
export function challengeState(c) {
  const p = Math.min(c.n, progOf(c)), done = !!save.chal?.[c.id];
  return { c, p, done, k: done ? 1 : p / c.n };
}
const chestFor = tier => ({ tier: Math.max(0, Math.min(LOOT_TIERS.length - 1, tier | 0)), zone: Math.min(ZONES.length - 1, save.unlockedZone || 0) });

// valide les défis remplis : clés, or et coffres de butin (à ouvrir depuis l'accueil). Renvoie [{ c, keys }].
export function checkChallenges() {
  const s = save, got = [];
  s.chal ||= {};
  const K = keys();
  for (const c of challengeList()) {
    if (s.chal[c.id] || progOf(c) < c.n) continue;
    s.chal[c.id] = Date.now();
    const ks = (c.rw.keys || (c.rw.key ? [c.rw.key] : [])).filter(k => !K[k]);
    for (const k of ks) K[k] = true;
    if (c.rw.gold) s.gold += c.rw.gold;
    if (c.rw.chest != null) s.pendingChests.push(chestFor(c.rw.chest));
    got.push({ c, keys: ks });
  }
  // paliers de maîtrise : aura (5) et titre (10) du champion
  for (const [cls, xp] of Object.entries(s.mastery || {})) {
    const lv = masteryOf(xp).lv;
    if (lv >= MASTERY.miles[0]) K['aura:m_' + cls] = true;
    if (lv >= MASTERY.miles[1]) K['title:m_' + cls] = true;
  }
  if (got.length) persist();
  return got;
}

// records de la partie (run.track) : victimes par arme, niveau par champion, combo, évolutions, élites, soins, boss
export function recordRun(t = {}, cls = save.cls) {
  const r = save.rec ||= {};
  r.wk ||= {}; r.lvl ||= {};
  for (const [w, n] of Object.entries(t.weaponKills || {})) r.wk[w] = (r.wk[w] || 0) + Math.max(0, n | 0);
  if (cls) r.lvl[cls] = Math.max(r.lvl[cls] || 0, t.level | 0);
  r.combo = Math.max(r.combo || 0, t.maxCombo | 0);
  r.evoRun = Math.max(r.evoRun || 0, t.evoWeapons | 0);
  r.elites = (r.elites || 0) + Math.max(0, t.elites | 0);
  r.heal = (r.heal || 0) + Math.max(0, Math.round(+t.lsHeal || 0));
  if (t.bossFast > 0) r.bossFast = r.bossFast ? Math.min(r.bossFast, Math.round(t.bossFast)) : Math.round(t.bossFast);
  if (t.totemBoss) r.totemBoss = 1;
}

// ---------- Points d'accroche de game.js ----------
// fin de partie (endRun, une seule fois) : records, maîtrise, paliers d'Abysse, défis. Renvoie l'or des paliers d'Abysse
// (ajouté à l'or du bilan) et de quoi remplir le bilan (l2Results).
export function endRunL2(sum = {}, { cleared = [], worlds = [], k = 0 } = {}) {
  const t = sum.track || { kills: sum.kills, level: sum.level, maxCombo: sum.combo, evoWeapons: (sum.evos || []).length };
  const cls = save.cls, ab = sum.abyss | 0;
  recordRun(t, cls);
  const ms = cls ? gainMastery(cls, masteryXp(t, cleared.length, k, ab)) : null;
  const A = abyssWin(ab, cleared, worlds);
  const got = checkChallenges();
  persist();
  return { ms, got, gold: A.gold, abyss: A.tiers };
}

// accueil : champion verrouillé (sauvegarde venue d'ailleurs) remplacé, défis remplis validés (sauvegardes d'avant : ce qui
// est déjà acquis est rendu d'un coup)
export function l2Home() {
  if (save.cls && clsLocked(save.cls)) { save.cls = 'mage'; persist({ touch: false }); }
  const fresh = !!save.l2New, got = checkChallenges();
  if (fresh) { delete save.l2New; persist({ touch: false }); }
  if (got.length || fresh) announce(got, fresh);
}
const s_ = n => (n > 1 ? 's' : '');
function announce(got, fresh = false) {
  const nk = got.reduce((n, g) => n + g.keys.length, 0);
  if (fresh || got.length > 2) {
    toast(`${iconImg('key', 18)} ${fresh ? 'Nouveau : <b>Défis de déblocage</b>' : `<b>${got.length} défis réussis</b>`}${got.length ? ` · ${got.length} déjà réussi${s_(got.length)}${nk ? `, ${nk} déblocage${s_(nk)}` : ''}` : ''}`, 3600);
  } else for (const g of got) toast(`${iconImg(g.c.icon, 18)} Défi réussi : <b>${esc(g.c.name)}</b>${g.keys.length ? ` · ${g.keys.map(k => esc(keyInfo(k).name)).join(', ')} débloqué${s_(g.keys.length)}` : ''}`, 3200);
  if (got.length) sfx('loot');
}

// bilan de partie : maîtrise et défis réussis (les coffres ouverts juste avant peuvent en avoir rempli d'autres)
export function l2Results(L) {
  if (!L) return '';
  L.got.push(...checkChallenges());
  const rows = L.got.map((g, i) => `<span class="df-got-r" style="--d:${(0.3 + i * 0.08).toFixed(2)}s">${iconImg(g.c.icon, 22)}<span><b>${esc(g.c.name)}</b>${rwChips(g.c.rw, true)}</span></span>`).join('');
  if (!L.toasted && L.got.some(g => g.keys.length)) {
    L.toasted = true;
    const ks = L.got.flatMap(g => g.keys);
    setTimeout(() => { toast(`${iconImg('lock', 18)} Débloqué : <b>${ks.map(k => esc(keyInfo(k).name)).join(', ')}</b>`, 3600); sfx('loot'); }, 700);
  }
  return masteryResult(L.ms) + (rows ? `<h3 class="section-t">Défis réussis <small>${L.got.length}</small></h3><div class="df-got">${rows}</div>` : '');
}

// ---------- Affichage ----------
// pastilles de récompense : déblocages, or, coffre
export function rwChips(rw, mini = false) {
  const ks = rw.keys || (rw.key ? [rw.key] : []);
  return `<span class="df-rw ${mini ? 'mini' : ''}">${ks.map(k => { const I = keyInfo(k); return `<span class="rk ${unlocked(k) ? 'have' : ''}" ${I.color ? `style="--kc:${I.color}"` : ''}>${iconImg(I.icon, 14)}${esc(I.name)}</span>`; }).join('')}${rw.gold ? `<span class="rk gold">${iconImg('gold', 14)}${fmt(rw.gold)}</span>` : ''}${rw.chest != null ? `<span class="rk chest"><img src="${chestURL(rw.chest)}" width="14" height="14" alt="">${esc(LOOT_TIERS[rw.chest]?.name || '')}</span>` : ''}</span>`;
}
const bar = (k, done) => `<span class="pbar ${done ? 'green' : ''}"><i style="width:${(Math.min(1, k) * 100).toFixed(1)}%"></i></span>`;
// « Défi Pilleur : Ouvrez 5 coffres de butin (3/5) » pour une clé verrouillée
export function lockLine(key) {
  const c = challengeFor(key);
  if (!c) return 'Se débloque avec la Saison';
  const S = challengeState(c);
  return `Défi « ${c.name} » : ${c.txt} (${fmt(S.p)}/${fmt(c.n)})`;
}

// encadré d'un champion verrouillé (écran des champions)
export function clsLockPanel(id) {
  const c = challengeFor('cls:' + id), S = c ? challengeState(c) : null;
  return `<div class="cs-lock">${iconImg('lock', 24)}
      <div><b>Champion verrouillé</b><small>${c ? esc(c.txt) : 'Se débloque avec la Saison'}</small>
      ${S ? `<div class="df-prog">${bar(S.k, false)}<em>${fmt(S.p)}/${fmt(c.n)}</em></div>` : ''}</div>
      <button class="btn ghost small" data-act="defis">Défis</button></div>`;
}

// tuile de l'accueil : défis réussis et le plus proche à finir
export function defisTile() {
  const L = challengeList().map(challengeState), done = L.filter(x => x.done).length;
  const next = L.filter(x => !x.done).sort((a, b) => b.k - a.k)[0];
  const rk = next && (next.c.rw.key || next.c.rw.keys?.[0]);
  return `<button class="df-tile" data-act="defis">
      <span class="df-t-ic">${iconImg('key', 22)}</span>
      <span class="df-t-txt"><span class="eyebrow">Défis de déblocage</span><b>${done}<small>/${L.length}</small></b>
        <small>${next ? `${esc(next.c.name)} · ${Math.floor(next.k * 100)} %` : 'Tous les défis sont réussis !'}</small>
        <span class="pbar"><i style="width:${(done / L.length * 100).toFixed(1)}%"></i></span></span>
      ${rk ? `<span class="df-t-rw" title="${esc(keyInfo(rk).name)}">${iconImg(keyInfo(rk).icon, 22)}</span>` : ''}
    </button>`;
}

// choix de l'aura de la forme ultime (écran des champions) : d'origine, puis toutes les auras (verrouillées grisées)
export function auraPicker(cls) {
  const cur = save.aura?.[cls] || '';
  if (!AURA0[cls]) return '';
  const ids = [...Object.keys(AURAS), 'm_' + cls];
  const sw = (id, color, name, ok) => `<button class="ap ${id === cur ? 'on' : ''} ${ok ? '' : 'locked'}" data-act="aura" data-aura="${id}" aria-label="${esc(name)}" title="${esc(name)}">
      <i style="--ac:${color}"></i>${ok ? '' : iconImg('lock', 12)}</button>`;
  const name = id => auraDef(id)?.name || 'Origine';
  const curName = cur && unlocked('aura:' + cur) ? name(cur) : 'Origine';
  return `<h4 class="evo-t">Aura de la forme ultime <small class="ap-cur">${esc(curName)}</small></h4>
    <div class="aura-pick">${sw('', AURA0[cls], 'Origine', true)}${ids.map(id => sw(id, auraDef(id).color, name(id), unlocked('aura:' + id))).join('')}</div>`;
}
// touche une aura : choisie si débloquée, sinon on dit comment l'obtenir
export function pickAura(cls, id) {
  if (id && !unlocked('aura:' + id)) {
    const m = id.startsWith('m_') ? `Atteignez la maîtrise ${MASTERY.miles[0]} avec ${CLASSES[id.slice(2)]?.name || 'ce champion'}` : lockLine('aura:' + id);
    toast(`${iconImg('lock', 16)} ${esc(m)}`, 3000);
    return false;
  }
  setAura(cls, id);
  return true;
}

// ---------- Écran « Défis » ----------
let dfCat = 'all';
export function defisScreen(back) {
  const draw = () => {
    const L = challengeList().map(challengeState), done = L.filter(x => x.done).length;
    const count = (ids, ok) => `${ids.filter(ok).length}/${ids.length}`;
    const auraIds = [...Object.keys(AURAS), ...Object.keys(CLASSES).map(c => 'm_' + c)];
    const kinds = [
      ['sword', 'Armes', count(Object.keys(WEAPONS), id => isFree('w', id))],
      ['tome', 'Tomes', count(Object.keys(TOMES), id => isFree('t', id))],
      ['potion', 'Bonus', count(Object.keys(BOOSTS), id => isFree('boost', id))],
      ['user', 'Champions', count(Object.keys(CLASSES), id => !clsLocked(id))],
      ['aura', 'Auras', count(auraIds, id => unlocked('aura:' + id))],
    ];
    const cats = [{ id: 'all', name: 'Tous' }, ...CHALLENGE_CATS].filter(C => C.id === 'all' || L.some(x => x.c.cat === C.id));
    const row = (S, i) => {
      const { c, p, done } = S;
      return `<div class="df-row ${done ? 'done' : S.k >= 1 ? 'ready' : ''}" style="--d:${Math.min(0.4, i * 0.03).toFixed(2)}s">
        <span class="df-ic">${iconImg(done ? 'check' : c.icon, 24)}</span>
        <div class="df-txt"><b>${esc(c.name)}</b><small>${esc(c.txt)}</small>
          <div class="df-prog">${bar(S.k, done)}<em>${done ? 'Réussi' : `${fmt(p)}/${fmt(c.n)}`}</em></div>
          ${rwChips(c.rw)}</div>
      </div>`;
    };
    const group = C => {
      const xs = L.filter(x => x.c.cat === C.id).sort((a, b) => a.done - b.done || (a.done ? 0 : b.k - a.k));
      if (!xs.length) return '';
      return `<h3 class="section-t">${esc(C.name)} <small>${xs.filter(x => x.done).length}/${xs.length}</small></h3><div class="df-list">${xs.map(row).join('')}</div>`;
    };
    mount(`<div class="defis scroll">
      <div class="cs-bar"><button class="icon-btn" data-act="back" aria-label="Retour">${iconImg('back', 20)}</button><h2 class="cs-title">Défis</h2><span class="df-count"><b>${done}</b>/${L.length}</span></div>
      <p class="df-intro muted">Réussissez des défis pour débloquer armes, tomes, bonus, champions, auras et l'Abysse. Les armes et tomes verrouillés n'apparaissent pas pendant les parties.</p>
      <div class="df-sum"><span class="pbar"><i style="width:${(done / L.length * 100).toFixed(1)}%"></i></span>
        <div class="df-kinds">${kinds.map(([ic, n, v]) => `<span>${iconImg(ic, 16)}<small>${n}</small><b>${v}</b></span>`).join('')}</div></div>
      <div class="df-cats" role="tablist">${cats.map(C => `<button class="df-cat ${C.id === dfCat ? 'on' : ''}" data-act="cat" data-c="${C.id}" role="tab" aria-selected="${C.id === dfCat}">${esc(C.name)}</button>`).join('')}</div>
      ${(dfCat === 'all' ? CHALLENGE_CATS : CHALLENGE_CATS.filter(C => C.id === dfCat)).map(group).join('')}
      <div class="df-foot"></div>
    </div>`);
    bind($('.defis'), { back: () => back?.(), cat: el => { dfCat = el.dataset.c; draw(); } });
  };
  if (!['all', ...CHALLENGE_CATS.map(C => C.id)].includes(dfCat)) dfCat = 'all';
  draw();
}
