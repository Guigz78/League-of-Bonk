// Écrans du jeu et déroulé d'une expédition.
import { CLASSES, WEAPONS, TOMES, ULTS, ZONE_TIME, EVOLUTIONS, BOONS, ZONES, PETS, PET_BY_ZONE, SLOTS, RARITY, BOSS_ITEMS, UPGRADES, MONSTER_COUNT, BOSS_COUNT, DIFFICULTIES, ELITE_MODS,
  LOOT_TIERS, RARITIES, PARTS, FORGE, BOOSTS, BOOST_SLOTS, HEAT_GOLD, AFFIXES } from './data.js';
import * as DATA from './data.js';
import { save, persist, playerStats, upgradeCost, makeItem, makeBossItem, addItem, itemPower, sellValue, maxDiff,
  canCraft, itemUpgradeCost, canUpgrade, upgradeItem, statsAt, salvageValue, salvageItem,
  buyBoost, cleanBoostSel, consumeBoosts, rarityIdx, canForgeMythic, checkPets } from './save.js';
import { iconImg } from './art.js';
import { heroURL, creatureURL, mountPreview, zoneBannerURL, supported } from './visuals.js';
import { rng } from './pixel.js';
import { sfx, music, stopMusic } from './audio.js';
import { mount, $, $$, bind, modal, toast, fmt, pct, esc, countUp } from './ui.js';
import { Run, LS, BOSS_LV, MSG_T } from './run.js';
import { showRewardedAd } from './ads.js';
import { cloud } from './cloud.js';
import { loginState, dailyBadge } from './daily.js';
// L1 : saison, quêtes de la semaine, calendrier de 20 jours, succès, titres
import { seasonRun, checkAchievements } from './season.js';
import { homeGoals, seasonScreen, runPassBlock, questSheet, loginSheet, achBlock, titleSheet, seasonNotice } from './season-ui.js';
// L2 : défis de déblocage, maîtrise des champions, Abysse
import { l2Home, endRunL2, l2Results, defisScreen, defisCount, clsLocked, clsLockPanel, auraPicker, pickAura, isFree, lockLine } from './unlocks.js';
import { masteryPanel, masteryChip, masteryLv } from './mastery.js';
import { runDiff, abyssTop, abyssBlock, abyssInfo, abyssRewards, abyssPause } from './abyss.js';
// mode histoire « La Grande Marmite » (chapitres, dialogues, récompenses)
import { chapter, storyDone, storyNext, storyLen, cutscene, taunt, chatter, missionChatter, storyEnd, storyBlock, storyScreenHTML, chapterSheet, unlocked, totalStars } from './story.js';
import { weekly, weeklyWin, weeklyDaysLeft, endlessBest, endlessEnd, WEEKLY_REWARD, mmss as mmssM } from './modes.js';
// écrans séparés : objets (item-ui.js), coffres (chests.js), forge (forge.js), options et compte (account.js)
import { AFX, STAT_ORDER, nf, affVal, itemArt, affShort, statKeys, statRows, effectBox, tapHint, mythBox, itemFx, buzz } from './item-ui.js';
import { chestScreen, lootAgg, partIcon } from './chests.js';
import { forgeTab, selectForge, doCraft, doForgeMyth, doFuse, mythInfo } from './forge.js';
import { settings, accountSheet, signGoogle, signInSheet, loginStrip, hideLoginStrip } from './account.js';

export const APP_VERSION = 'v49'; // affichée dans les options (même numéro que le cache hors ligne de sw.js)
let tab = 'adventure';
let battle = null;
let gearFilter = 'all';
let loginShown = '';
export const inBattle = () => !!battle; // une partie est en cours (les écrans de l'accueil ne se redessinent pas)

// ---------- Démarrage ----------
export function boot() {
  cloud.onChange(() => {
    if (battle) return;
    refreshTopbar();
    if (cloud.user) $('.login-strip')?.remove(); // connecté : la bande de connexion de l'accueil s'en va
    if (cloud.lastError) { toast(`Connexion impossible : ${esc(cloud.lastError)}`, 5000); cloud.lastError = ''; }
  });
  if (!supported()) setTimeout(() => toast(`${iconImg('cube', 16)} WebGL 2 indisponible : <b>mettez à jour iOS / Safari</b> pour jouer`, 6000), 600);
  if (!save.cls) return classSelect(true);
  home();
  autoLogin();
}

// appareil sans WebGL 2 (iOS trop ancien) : le jeu en 3D ne peut pas s'afficher, on le dit au lieu de planter
function noWebGL() {
  return modal({
    title: `${iconImg('cube', 22)} Affichage impossible`,
    body: `<p>Votre appareil ne peut pas afficher le jeu : <b>WebGL 2</b> est nécessaire.</p>
      <p class="muted set-note">Mettez à jour iOS / Safari (Réglages › Général › Mise à jour logicielle), puis relancez le jeu.</p>`,
    buttons: [{ label: 'Compris', cls: 'primary', value: true }],
    dismissable: true,
  });
}

// récompense de connexion : proposée une fois par jour à l'arrivée sur l'accueil
function autoLogin() {
  const st = loginState();
  if (!st.ready || loginShown === st.last + '|' + st.day || !save.stats.runs) return;
  loginShown = st.last + '|' + st.day;
  const tryOpen = (n = 0) => { if (battle || !$('.hub')) return; if ($('.modal-wrap')) { if (n < 40) setTimeout(() => tryOpen(n + 1), 600); return; } loginSheet().then(afterSheet); };
  setTimeout(tryOpen, 450);
}

// ---------- Barre du haut ----------
const partsTotal = () => Object.values(save.parts).reduce((n, a) => n + a.reduce((x, y) => x + y, 0), 0);
// montant court pour la barre du haut (la place est comptée sur iPhone SE) : 4 740, 11,1 k, 123 k, 1,23 M
const short = n => (n < 1e4 ? fmt(n) : n < 1e5 ? `${(Math.floor(n / 100) / 10).toLocaleString('fr-FR')} k` : n < 1e6 ? `${Math.floor(n / 1000)} k`
  : `${(Math.floor(n / 1e4) / 100).toLocaleString('fr-FR')} M`);
function topbar() {
  const u = cloud.user;
  const st = cloud.status;
  const dot = !u ? '' : `<i class="sync ${st}"></i>`;
  return `<header class="topbar">
    <div class="tb-brand">League<span>of Bonk</span></div>
    <button class="cur" data-act="cur" data-k="parts" aria-label="Pièces de forge">${iconImg('part', 18)}<span class="cur-v"><b id="partsN">${short(partsTotal())}</b><small>Pièces</small></span></button>
    <button class="cur gold" data-act="cur" data-k="gold" aria-label="Or">${iconImg('gold', 18)}<span class="cur-v"><b id="goldN">${short(save.gold)}</b><small>Or</small></span></button>
    <button class="icon-btn account ${u ? 'in' : ''}" data-act="account" aria-label="Compte">
      ${u?.avatar ? `<img class="avatar" src="${esc(u.avatar)}" alt="" referrerpolicy="no-referrer">` : iconImg('user', 22)}${dot}
    </button>
    <button class="icon-btn" data-act="settings" aria-label="Options">${iconImg('gear', 22)}</button>
  </header>`;
}

export function refreshTopbar() {
  const t = $('.topbar');
  if (t) t.outerHTML = topbar();
  const g = $('#goldN'); if (g) g.textContent = short(save.gold);
}

export function nav() {
  const items = [
    ['adventure', 'Jouer', 'play'],
    ['gear', 'Héros', 'user'],
    ['forge', 'Forge', 'hammer'],
    ['shop', 'Boutique', 'bag'],
  ];
  const nAdv = save.pendingChests.length + dailyBadge();
  const badge = { gear: save.inventory.some(i => i.isNew), trophies: false, shop: canAffordUpgrade(), forge: canForgeSomething() };
  return `<nav class="tabs">${items.map(([id, label, ic]) => `
    <button class="tab ${tab === id || (id === 'adventure' && tab === 'trophies') ? 'on' : ''}" data-act="tab" data-tab="${id}">
      ${iconImg(ic, 22)}<span>${label}</span>${id === 'adventure' && nAdv ? `<i class="badge count">${nAdv}</i>` : badge[id] ? '<i class="badge"></i>' : ''}
    </button>`).join('')}</nav>`;
}

// pastille de la forge : une fabrication est possible
function canForgeSomething() {
  return canForgeMythic() || Object.keys(PARTS).some(k => RARITIES.some((_, r) => canCraft(k, r)));
}

function canAffordUpgrade() {
  return Object.keys(UPGRADES).some(k => save.upgrades[k] < DATA.upgMax(k) && save.gold >= upgradeCost(k));
}

// ---------- Accueil (onglets) ----------
export function home(t) {
  music('menu');
  battle = null;
  l2Home(); // L2 : défis remplis validés avant l'affichage (toasts, coffres, tuile des défis)
  // même onglet : on garde la position de défilement (achats en bas de la boutique…)
  const keep = !t || t === tab ? $('#hubMain')?.scrollTop || 0 : 0;
  const moved = t && t !== tab;
  if (t) tab = t;
  const body = { adventure: adventureTab, gear: gearTab, forge: forgeTab, shop: shopTab, trophies: trophiesTab }[tab]();
  mount(`<div class="hub">${topbar()}<main class="hub-main ${tab === 'adventure' ? 'is-home' : ''}" id="hubMain">${body}</main>${nav()}</div>`);
  if (keep) $('#hubMain').scrollTop = keep;
  if (moved) $('#hubMain').classList.add('scr-in');
  bind($('.hub'), handlers);
  mountPreview($('.hc-3d'), save.cls);
  if (tab === 'adventure') seasonNotice(openPass);
}
const openPass = () => seasonScreen(() => { announceAchievements(); home(); });
export const afterSheet = () => { announceAchievements(); if (!battle) home(); };

const handlers = {
  tab: el => home(el.dataset.tab),
  settings: () => settings(),
  account: () => accountSheet(),
  signGoogle: () => signGoogle(),
  signIn: () => signInSheet(),
  hideStrip: () => hideLoginStrip(),
  // tant que le monde 1 n'est pas battu, JOUER lance le chapitre 1 de l'histoire (tutoriel, partie facile) ; sinon la fiche du monde
  play: () => (firstSteps() ? playChapter(0) : quickPlay()),
  worlds: () => worldPicker(),
  story: () => storyScreen(),
  trophies: () => home('trophies'),
  quests: () => questSheet().then(afterSheet),
  login: () => loginSheet().then(afterSheet),
  season: () => openPass(),
  title: () => titleSheet().then(afterSheet),
  zone: el => zoneSheet(+el.dataset.z),
  changeClass: () => classSelect(false),
  allStats: () => statsSheet(),
  equip: el => equipItem(+el.dataset.id),
  item: el => itemSheet(+el.dataset.id),
  filter: el => { gearFilter = el.dataset.f; home(); },
  pet: el => { save.pet = save.pet === el.dataset.id ? null : el.dataset.id; persist(); home(); },
  buy: el => buyUpgrade(el.dataset.k),
  sellJunk: () => sellJunk(),
  chests: () => chestScreen(() => home('adventure')),
  defis: () => defisScreen(() => home()),
  // touche une monnaie : à quoi elle sert et où l'obtenir
  cur: el => toast(el.dataset.k === 'gold'
    ? `${iconImg('gold', 16)} <b>${fmt(save.gold)} or</b> : améliorations de la Boutique, bonus et Forge. Gagné en partie et dans les coffres.`
    : `${iconImg('part', 16)} <b>${fmt(partsTotal())} pièces de forge</b> : fabriquer et améliorer l'équipement (Forge). Dans les coffres de butin ou en recyclant.`, 4200),
  forgeSel: el => selectForge(el.dataset.slot, +el.dataset.r),
  craft: () => doCraft(),
  forgeMyth: () => doForgeMyth(),
  mythInfo: el => mythInfo(el.dataset.id),
  fuse: el => doFuse(el.dataset.all === '1'),
  buyBoost: el => doBuyBoost(el.dataset.id),
};

// valeur d'une caractéristique du champion (fiche complète)
function heroStat(k, st) {
  const v = st[k] || 0;
  if (k === 'hp' || k === 'atk') return fmt(v);
  if (k === 'speed') return pct(v);
  if (k === 'magnet' || k === 'gold') return `+${Math.round((v - 1) * 100)} %`;
  if (k === 'critDmg') return `×${nf(2 + v, 2)}`;
  return affVal(k, v);
}

async function statsSheet() {
  const st = playerStats(), c = CLASSES[save.cls];
  // « max » : bonus de l'équipement et de la Boutique au plafond (le vol de vie affiché compte en plus le talent des champions)
  const capped = k => AFFIXES[k]?.max != null && (k === 'speed' ? st.speed >= c.speed + AFFIXES[k].max - 0.0005 : st[k] - (k === 'lifesteal' ? LS.base : 0) >= AFFIXES[k].max - 0.0005);
  for (const k of ['lifesteal', 'dodge', 'armor']) if (c[k]) st[k] = Math.min(AFFIXES[k].max, (st[k] || 0) + c[k]); // talents de classe (Nyx, Sora, Brok), plafonnés comme en partie
  st.lifesteal = Math.min(LS.max, (st.lifesteal || 0) + LS.base); // + talent de tous les champions (vol de vie de base)
  const shown = STAT_ORDER.filter(k => ['hp', 'atk', 'crit', 'critDmg', 'speed'].includes(k) || (k === 'magnet' || k === 'gold' ? st[k] > 1.0005 : st[k] > 0.0005));
  await modal({
    title: `Statistiques de ${esc(c.name)}`,
    cls: 'stats-modal',
    body: `<div class="hstats">${shown.map(k => `<div class="hs ${capped(k) ? 'cap' : ''}">${iconImg(AFX[k][0], 22)}<span>${esc(k === 'critDmg' ? 'Dégâts des critiques' : k === 'speed' ? 'Vitesse de course' : AFFIXES[k]?.name || k)}</span><b>${heroStat(k, st)}</b>${capped(k) ? '<em>max</em>' : ''}</div>`).join('')}</div>
      ${st.myth?.length ? `<h4>Pouvoirs mythiques</h4>${st.myth.map(mythBox).join('')}` : ''}
      ${st.effects.length ? `<h4>Effets légendaires</h4>${st.effects.map(effectBox).join('')}` : ''}
      <p class="muted hs-note">Champion, améliorations de la Boutique et équipement réunis.</p>`,
    buttons: [{ label: 'Fermer', cls: 'primary', value: true }],
    dismissable: true,
  });
}

// fiche compacte du champion (onglet Équipement)
function heroCard() {
  const c = CLASSES[save.cls], st = playerStats();
  const more = STAT_ORDER.filter(k => !['hp', 'atk', 'crit', 'speed'].includes(k) && (k === 'magnet' || k === 'gold' ? st[k] > 1.0005 : st[k] > 0.0005)).length + st.effects.length;
  return `<section class="panel hero-card">
    <div class="hc-sprite"><canvas class="hc-3d"></canvas>
      ${save.pet ? `<img class="px spr hc-pet" src="${creatureURL('pet-' + save.pet, PETS[save.pet].body, PETS[save.pet].pal)}" alt="">` : ''}
    </div>
    <div class="hc-info">
      <div class="hc-name">${esc(c.name)} <small>${c.role}</small></div>
      <button class="stats hc-stats" data-act="allStats" aria-label="Toutes les statistiques">
        <span>${iconImg('heart', 16)}<b>${fmt(st.hp)}</b></span>
        <span>${iconImg('fist', 16)}<b>${st.atk}</b></span>
        <span>${iconImg('target', 16)}<b>${pct(st.crit)}</b></span>
        <span>${iconImg('arrow', 16)}<b>${pct(st.speed)}</b></span>
        <em class="hc-more">${more ? `+${more} bonus · ` : ''}Toutes les statistiques ›</em>
      </button>
      <button class="btn ghost small hc-change" data-act="changeClass">${iconImg('swap', 14)} Changer de champion</button>
    </div>
  </section>`;
}

// monde proposé par le bouton JOUER : le dernier lancé, sinon le plus avancé débloqué
function playZone() {
  const last = save.lastZone;
  if (last != null && last <= save.unlockedZone) return last;
  return Math.min(save.unlockedZone, ZONES.length - 1);
}

const bossOf = z => (z.boss ? creatureURL(`${z.id}-${zoneSteps(z).length - 1}-${z.boss.name}`, z.boss.body, z.boss.pal, { boss: true })
  : creatureURL(`${z.id}-4-${z.monsters[4].name}`, z.monsters[4].body, z.monsters[4].pal));

// difficulté (et palier d'Abysse) choisis pour un monde
const zoneDiff = i => { const k = Math.min(save.diffSel?.[i] || 0, maxDiff(i)), ab = Math.min(save.abyssSel?.[i] || 0, abyssTop(i)); return { k: ab ? DIFFICULTIES.length - 1 : k, ab, D: runDiff(k, ab) }; };

// JOUER : la partie part tout de suite dans le monde choisi (fiche du monde : « Monde » sous le bouton)
function quickPlay() {
  const i = playZone(), { k, ab } = zoneDiff(i);
  cleanBoostSel();
  save.lastZone = i;
  startRun(i, k, ab);
}

// choix du monde : liste courte, puis la fiche du monde (difficulté, bonus, départ)
function worldPicker() {
  const cur = playZone();
  const rows = ZONES.map((z, i) => {
    const locked = i > save.unlockedZone, n = save.diffCleared[i] || 0;
    return `<button class="wp-row ${locked ? 'locked' : ''} ${i === cur ? 'cur' : ''}" data-z="${i}" style="background-image:url(${zoneBannerURL(z)})">
      <span class="wp-n">${i + 1}</span><span class="wp-t"><b>${esc(z.name)}</b>${locked ? `<small>${iconImg('lock', 12)} Terminez le monde ${i}</small>` : zoneStars(n)}</span>
      <span class="wp-boss">${locked ? iconImg('lock', 20) : `<img class="px spr" src="${bossOf(z)}" alt="">`}</span></button>`;
  }).join('');
  const W = weekly(), bestE = endlessBest(cur);
  const modes = `<h4 class="wp-h">Modes spéciaux</h4>
    <button class="wp-mode weekly ${W.done ? 'done' : ''}" data-mode="weekly"><i class="wm-ic">⚡</i>
      <span class="wm-t"><small>Défi de la semaine · ${W.done ? 'réussi ✔' : `encore ${weeklyDaysLeft()} j`}</small><b>${esc(W.mission.what)}</b>
      <em>${esc(ZONES[W.zone].name)} · ${esc(DIFFICULTIES[W.diff].name)} · ${W.curses.map(c => esc(c.name)).join(', ')}</em></span><i class="wm-go">›</i></button>
    <button class="wp-mode endless" data-mode="endless"><i class="wm-ic">∞</i>
      <span class="wm-t"><small>Mode infini · ${esc(ZONES[cur].name)}</small><b>Survivre le plus longtemps possible</b>
      <em>Record ici : ${bestE ? mmssM(bestE) : 'aucun'}</em></span><i class="wm-go">›</i></button>
    <h4 class="wp-h">Mondes</h4>`;
  const p = modal({ title: 'Choisir un monde', cls: 'world-modal', body: `${modes}<div class="wp-list">${rows}</div>`, buttons: [{ label: 'Fermer', cls: 'ghost', value: null }], dismissable: true });
  const box = document.querySelector('.world-modal');
  box?.addEventListener('click', e => {
    const m = e.target.closest('.wp-mode');
    if (m) { sfx('tap'); box.closest('.modal-wrap')?.querySelector('.modal-btns .btn')?.click(); setTimeout(() => modeSheet(m.dataset.mode), 200); return; }
    const r = e.target.closest('.wp-row'); if (!r) return;
    const i = +r.dataset.z;
    if (i > save.unlockedZone) { sfx('tap'); toast(`${iconImg('lock', 16)} Terminez d'abord « ${esc(ZONES[i - 1].name)} »`); return; }
    sfx('tap'); box.closest('.modal-wrap')?.querySelector('.modal-btns .btn')?.click();
    setTimeout(() => zoneSheet(i).then(() => { if (!battle) home(); }), 200);
  });
  return p;
}

// ---------- Modes spéciaux (js/modes.js) ----------
// partie spéciale prête à lancer : weekly (règles de la semaine) ou endless (monde choisi, sa difficulté)
function specialRun(kind) {
  if (kind === 'weekly') {
    const W = weekly();
    return { z: W.zone, k: W.diff, special: { kind, label: 'Défi de la semaine', W, mission: W.mission, curses: W.curses } };
  }
  const z = playZone(), { k } = zoneDiff(z);
  return { z, k, special: { kind, label: 'Mode infini', mission: { type: 'endless', icon: '∞', name: 'Mode infini', what: 'Survivez le plus longtemps possible', best: endlessBest(z) } } };
}
function playSpecial(kind) {
  const R = specialRun(kind);
  cleanBoostSel();
  startRun(R.z, R.k, 0, { special: R.special });
}
// fiche d'un mode : règles, récompense, record ; « Jouer » lance la partie
async function modeSheet(kind) {
  const R = specialRun(kind), Z = ZONES[R.z];
  let body;
  if (kind === 'weekly') {
    const W = R.special.W;
    body = `<div class="chs-hero" style="background-image:url(${zoneBannerURL(Z)})"><span class="ms-big">⚡</span></div>
      <p class="chs-goal">${esc(W.mission.icon)} ${esc(W.mission.what)}</p>
      <h4>Règles de la semaine</h4>
      <div class="ms-rules"><span>${iconImg('map', 16)} ${esc(Z.name)}</span><span style="color:${DIFFICULTIES[W.diff].color}">${iconImg(DIFFICULTIES[W.diff].icon, 16)} ${esc(DIFFICULTIES[W.diff].name)}</span>
        ${W.curses.map(c => `<span class="curse">${iconImg(c.icon, 16)} <b>${esc(c.name)}</b> <small>${esc(c.desc)}</small></span>`).join('')}</div>
      <h4>Récompense ${W.done ? '<small>(déjà obtenue cette semaine)</small>' : '<small>(une fois par semaine)</small>'}</h4>
      <div class="chs-rw"><em>${iconImg('gold', 16)} ${fmt(WEEKLY_REWARD.gold)} or</em><em>${iconImg('chest', 16)} ${esc(LOOT_TIERS[WEEKLY_REWARD.chest].name)}</em><em><i class="shard-ic">✦</i> ${WEEKLY_REWARD.shards} éclat mythique</em></div>
      <p class="muted ms-note">Nouveau défi chaque lundi · encore ${weeklyDaysLeft()} jour${weeklyDaysLeft() > 1 ? 's' : ''}.</p>`;
  } else {
    const best = endlessBest(R.z);
    body = `<div class="chs-hero" style="background-image:url(${zoneBannerURL(Z)})"><span class="ms-big">∞</span></div>
      <p class="chs-goal">Pas de boss ni de portail : survivez le plus longtemps possible. Après le chrono, les monstres deviennent fous, puis le monde s'effondre.</p>
      <h4>Record dans ce monde</h4>
      <p class="ms-best">${best ? `<b>${mmssM(best)}</b>` : 'Aucun pour l\'instant'}</p>
      <h4>Récompense</h4>
      <div class="chs-rw"><em>${iconImg('gold', 16)} + de l'or selon le temps tenu</em></div>
      <p class="muted ms-note">${esc(Z.name)} · ${esc(DIFFICULTIES[R.k].name)} (changez de monde ou de difficulté dans la liste des mondes).</p>`;
  }
  const go = await modal({ title: `<span class="eyebrow">Mode spécial</span>${kind === 'weekly' ? 'Défi de la semaine' : 'Mode infini'}`, cls: 'chapter-modal mode-modal', body,
    buttons: [{ label: 'Retour', cls: 'ghost', value: false }, { label: `${iconImg('play', 16)} Jouer`, cls: 'primary', value: true }], dismissable: true });
  if (go) playSpecial(kind); else if (!battle) home();
}
// bilan d'une partie spéciale
function specialBlock(X) {
  if (!X) return '';
  if (X.kind === 'weekly') return `<div class="story-res ms-res ${X.ok ? 'ok' : 'ko'}"><span class="sr-img ms-ic">⚡</span><span class="sr-t"><small>Défi de la semaine</small>
    <b>${esc(X.mission.what)}</b><span>${X.ok ? (X.first ? 'Réussi : récompense de la semaine gagnée !' : 'Réussi (récompense déjà obtenue cette semaine)') : 'Raté… nouvel essai quand vous voulez.'}</span></span>
    ${X.first ? `<span class="sr-rw"><em>${iconImg('gold', 14)} +${fmt(X.gold)}</em><em>${iconImg('chest', 14)} ${esc(X.chest)}</em><em><i class="shard-ic">✦</i> +${X.shards} éclat</em></span>` : ''}</div>`;
  return `<div class="story-res ms-res ok"><span class="sr-img ms-ic">∞</span><span class="sr-t"><small>Mode infini</small>
    <b>${mmssM(X.secs)} tenues</b><span>${X.record ? (X.before ? `Nouveau record ! (avant : ${mmssM(X.before)})` : 'Premier record !') : `Record : ${mmssM(X.best)}`}</span></span>
    <span class="sr-rw"><em>${iconImg('gold', 14)} +${fmt(X.gold)} or (temps tenu)</em></span></div>`;
}

// Accueil : tout tient sur un écran. En haut, les objectifs (boutons ronds) ; au centre, le champion (touche = changer) ;
// en bas (sous le pouce), JOUER et deux raccourcis : le monde et l'histoire.
function adventureTab() {
  const c = CLASSES[save.cls], first = firstSteps(), vet = save.stats.runs > 0;
  const pz = playZone(), Z = ZONES[pz], { D } = zoneDiff(pz);
  const sd = storyDone(), all = sd >= storyLen;
  cleanBoostSel();
  const boostsOn = save.boostSel.filter(Boolean); // bonus choisis : utilisés par la prochaine partie (JOUER)
  const cta = first
    ? `<button class="play-cta" data-act="play"><span class="pc-ic">${iconImg('play', 22)}</span>
        <span class="pc-txt"><b>Jouer</b><small>Chapitre 1 · ${esc(chapter(0).title)}</small></span><img class="px spr pc-boss" src="${bossOf(Z)}" alt=""></button>`
    : `<button class="play-cta" data-act="play"><span class="pc-ic">${iconImg('play', 22)}</span>
        <span class="pc-txt"><b>Jouer</b><small>${esc(Z.name)}</small>${boostsOn.length ? `<em class="pc-boosts">${boostsOn.map(id => iconImg(BOOSTS[id].icon, 14)).join('')} ${boostsOn.length} bonus utilisé${boostsOn.length > 1 ? 's' : ''}</em>` : ''}</span><img class="px spr pc-boss" src="${bossOf(Z)}" alt=""></button>`;
  return `<section class="home">
    ${loginStrip()}
    ${vet ? homeGoals(defisCount()) : ''}
    <button class="home-hero" data-act="changeClass" aria-label="Changer de champion">
      <canvas class="hc-3d"></canvas>
      ${save.pet ? `<img class="px spr hc-pet" src="${creatureURL('pet-' + save.pet, PETS[save.pet].body, PETS[save.pet].pal)}" alt="">` : ''}
      <span class="hh-id"><small>${esc(c.role)}</small><b>${esc(c.name)}</b><em>${iconImg('medal', 12)} Niveau ${masteryLv(save.cls)}</em></span>
      ${vet ? `<span class="hh-swap">${iconImg('swap', 14)} Changer</span>` : ''}
    </button>
    <div class="home-cta">
      ${cta}
      ${vet ? `<div class="home-sub">
        <button class="hs-btn" data-act="worlds">${iconImg('map', 20)}<span><small>Monde ${pz + 1}</small><b style="--dc:${D.color}">${esc(D.name)}</b></span><i>›</i>${weekly().done ? '' : '<em class="hs-dot" title="Défi de la semaine">⚡</em>'}</button>
        <button class="hs-btn story ${all ? '' : 'hot'}" data-act="story">${iconImg('book', 20)}<span><small>Histoire · ★ ${totalStars()}</small><b>${all ? 'Terminée' : `Chapitre ${storyNext() + 1}/${storyLen}`}</b></span><i>›</i></button>
      </div>` : ''}
    </div>
  </section>`;
}

// cases de difficulté battues sous le nom du monde
function zoneStars(n) {
  const label = n >= DIFFICULTIES.length ? 'Zone maîtrisée' : n ? `${DIFFICULTIES[n - 1].name} battu` : 'Pas encore battu';
  return `<div class="z-done z-stars s${n}" aria-label="${esc(label)}">${DIFFICULTIES.map((d, k) =>
    `<i class="zs ${k < n ? 'on' : ''}" style="--dc:${d.color}"></i>`).join('')}</div>`;
}

// ---------- Quêtes, connexion, saison : season-ui.js (L1) ----------

const mul = v => '×' + String(Math.round(v * 100) / 100).replace('.', ',');
const plus = v => '+' + Math.round((v - 1) * 100) + ' %';

// détail d'un niveau de difficulté dans la fiche de zone
function diffInfo(i, k) {
  const D = DIFFICULTIES[k], wins = save.diffWins[i]?.[k] || 0, best = save.diffBest[i]?.[k] || 0;
  const rec = wins ? `<div class="di-rec">${iconImg('crown', 14)} ${wins} victoire${wins > 1 ? 's' : ''}${best ? ` · meilleur temps ${fmtTime(best)}` : ''}</div>` : '';
  if (!k) return `<p class="di-desc">${esc(D.desc)}</p>${rec}`;
  return `<p class="di-desc">${esc(D.desc)}</p>
    <div class="di-row bad">${iconImg('skull', 16)}<span>Monstres : PV <b>${mul(D.hp)}</b> · dégâts <b>${mul(D.dmg)}</b> · vitesse <b>${plus(D.speed)}</b> · nombre <b>${plus(D.spawn)}</b>${D.mods > 1 ? ` · élites à <b>${D.mods} pouvoirs</b>` : ''}</span></div>
    <div class="di-row bad">${iconImg('heart', 16)}<span>Soins <b>${mul(D.heal)}</b> (cœurs, familier, régénération)</span></div>
    <div class="di-row good">${iconImg('gold', 16)}<span>Or <b>${mul(D.gold)}</b> · objets plus rares et plus puissants${k >= 2 ? ' · 1 objet de plus' : ''}</span></div>${rec}`;
}

// récompenses affichées selon le niveau choisi (celles de première victoire : en Normal uniquement)
function zoneRewards(i, k) {
  const first = !save.zoneCleared[i], top = save.diffCleared[i] || 0;
  const next = DIFFICULTIES[k + 1];
  const unlock = top <= k ? (next
    ? `<div class="rw">${iconImg(next.icon, 18)} Niveau <b style="color:${next.color}">${esc(next.name)}</b> débloqué</div>`
    : `<div class="rw">${iconImg('crown', 18)} Zone maîtrisée : <b>3 étoiles</b></div>`) : '';
  if (k === 0 && first) {
    const pet = PETS[PET_BY_ZONE[i]], bi = BOSS_ITEMS[i];
    return `<h4>Récompenses de première victoire</h4>
      <div class="rewards">
        <div class="rw">${iconImg('star', 18)} Zone suivante débloquée</div>
        <div class="rw"><img class="px spr" src="${creatureURL('pet-' + PET_BY_ZONE[i], pet.body, pet.pal)}" width="22" height="22" alt=""> Familier : <b>${esc(pet.name)}</b></div>
        ${bi ? `<div class="rw">${itemArt({ ...bi, rarity: 'legendary' }, 32)} <b style="color:${RARITY.legendary.color}">${esc(bi.name)}</b></div>` : ''}
        ${unlock}
      </div>`;
  }
  const D = DIFFICULTIES[k];
  return `<h4>Récompenses${k ? ' ' + esc(D.name) : ''}</h4>
    <div class="rewards">
      <div class="rw">${iconImg('gold', 18)}<span>Or${k ? ` <b>${mul(D.gold)}</b>` : ''}, coffres de butin et objets à bonus${k ? ', plus rares et plus puissants' : ''}</span></div>
      ${unlock}
    </div>
    <p class="muted di-note">${k ? 'Familier et objet de boss : seulement à la première victoire en Normal.' : 'Zone déjà terminée : rejouez-la pour gagner de l\'or et des objets.'}</p>`;
}

function zoneSteps(z) {
  const s = z.monsters.map(m => ({ ...m, boss: false }));
  if (z.boss) s.push({ ...z.boss, boss: true });
  return s;
}

// objectif d'un monde : autel du boss, portail, chrono, totems, butin
function goalBox(i) {
  const z = ZONES[i], next = ZONES[i + 1];
  return `<div class="goal goal-list">
    <p>${iconImg('skull', 18)}<span>Trouvez l'<b>autel au crâne rouge</b> et invoquez <b>${esc((z.boss || z.monsters[4]).name)}</b>.</span></p>
    <p>${iconImg('portal', 18)}<span>Battez-le : un <b>portail</b> mène au <b>niveau suivant</b>${next ? ` (<b>${esc(next.name)}</b>)` : ''}, plus dur et plus riche.</span></p>
    <p>${iconImg('crown', 18)}<span>Au <b>niveau 3</b>, le <b>giga boss ${esc(DATA.GIGA.name)}</b> garde l'autel : battez-le pour gagner l'expédition et le <b>Giga coffre</b>.</span></p>
    <p>${iconImg('i_enrage', 18)}<span>Au bout de <b>${fmtTime(ZONE_TIME[i])}</b>, les monstres deviennent <b>fous</b> !</span></p>
    <p>${iconImg('i_burn', 18)}<span><b>Totems de défi</b> : plus de danger, plus de récompenses.</span></p>
    <p>${iconImg('chest', 18)}<span>Les <b>coffres de butin</b> ramassés s'ouvrent à la fin.</span></p>
  </div>`;
}

// emplacements de bonus de la fiche de zone (+ liste de choix sous l'emplacement « picking »)
function boostSlots(picking = -1) {
  const owned = Object.keys(BOOSTS).filter(id => save.boosts[id] > 0);
  const slots = save.boostSel.map((id, k) => {
    const b = id && BOOSTS[id];
    return `<button class="bslot ${b ? 'full' : ''} ${picking === k ? 'on' : ''}" data-s="${k}" aria-label="Bonus ${k + 1}">
      <span class="bs-ic">${b ? iconImg(b.icon, 28) : '<i class="bs-plus">+</i>'}</span>
      <span class="bs-txt"><b>${b ? esc(b.name) : 'Aucun'}</b><small>${b ? `${save.boosts[id]} en stock` : 'Touchez pour choisir'}</small></span>
    </button>`;
  }).join('');
  let pick = '';
  if (picking >= 0) {
    const other = save.boostSel.filter((_, k) => k !== picking);
    const opts = owned.filter(id => !other.includes(id));
    pick = `<div class="boost-pick">
      ${opts.length ? '' : '<p class="muted bp-empty">Aucun bonus disponible. Trouvez-en dans les <b>coffres de butin</b> ou achetez-en à la <b>Boutique</b>.</p>'}
      ${opts.map(id => `<button class="bp-opt ${save.boostSel[picking] === id ? 'on' : ''}" data-id="${id}">
        <span class="bp-ic">${iconImg(BOOSTS[id].icon, 24)}</span><span class="bp-txt"><b>${esc(BOOSTS[id].name)}</b><small>${esc(BOOSTS[id].desc)}</small></span><em>×${save.boosts[id]}</em>
      </button>`).join('')}
      <button class="bp-opt none ${save.boostSel[picking] ? '' : 'on'}" data-id=""><span class="bp-ic"><i class="bs-plus">–</i></span><span class="bp-txt"><b>Aucun bonus</b></span></button>
    </div>`;
  }
  return `<div class="boost-slots">${slots}</div>${pick}
    <p class="bs-note muted">${owned.length ? 'Chaque bonus choisi est utilisé au départ de la partie.' : 'Pas encore de bonus : trouvez-en dans les coffres de butin ou achetez-en à la Boutique.'}</p>`;
}

async function zoneSheet(i) {
  const z = ZONES[i];
  if (i > save.unlockedZone) { toast(`${iconImg('lock', 16)} Terminez d'abord « ${esc(ZONES[i - 1].name)} »`); return; }
  cleanBoostSel();
  const steps = zoneSteps(z);
  const top = maxDiff(i);
  let sel = Math.min(save.diffSel?.[i] || 0, top);
  let ab = Math.min(save.abyssSel?.[i] || 0, abyssTop(i)); // L2 : palier d'Abysse choisi (0 = aucun), toujours en Cauchemar
  if (ab) sel = DIFFICULTIES.length - 1;
  const id = 'zs-' + Date.now();
  const btn = k => {
    const D = DIFFICULTIES[k], locked = k > top, beaten = k < (save.diffCleared[i] || 0);
    return `<button class="diff-btn d${k} ${k === sel ? 'on' : ''} ${locked ? 'locked' : ''} ${beaten ? 'beaten' : ''}" data-d="${k}" role="radio" aria-checked="${k === sel}" style="--dc:${D.color}">
      <span class="db-ic">${iconImg(locked ? 'lock' : D.icon, 22)}</span><b>${esc(D.name)}</b>
      <small>${locked ? `Battez ${esc(DIFFICULTIES[k - 1].name)}` : beaten ? 'Battu' : 'À vaincre'}</small>
    </button>`;
  };
  const p = modal({
    title: `<span class="eyebrow">Monde ${String(i + 1).padStart(2, '0')}</span>${esc(z.name)}`,
    cls: 'zone-modal',
    body: `<div id="${id}"><div class="zs-hero" style="background-image:url(${zoneBannerURL(z)})"><p>${esc(z.sub)}</p></div>
      <div class="enemy-row">${steps.map((m, k) => `<div class="er ${m.boss ? 'boss' : ''}" title="${esc(m.name)}"><img class="px spr" src="${creatureURL(`${z.id}-${k}-${m.name}`, m.body, m.pal, { boss: m.boss })}" alt=""></div>`).join('')}</div>
      <h4>Difficulté</h4>
      <div class="diff-pick" role="radiogroup" aria-label="Niveau de difficulté">${DIFFICULTIES.map((_, k) => btn(k)).join('')}</div>
      <div class="abyss-box">${abyssBlock(i, ab)}</div>
      <div class="diff-info d${sel} ${ab ? 'ab' : ''}">${ab ? abyssInfo(i, ab) : diffInfo(i, sel)}</div>
      <h4>Bonus pour la partie</h4>
      <div class="boost-box">${boostSlots()}</div>
      <h4>Objectif</h4>
      ${goalBox(i)}
      <div class="zone-rw">${ab ? abyssRewards(i, ab) : zoneRewards(i, sel)}</div></div>`,
    buttons: [{ label: 'Retour', cls: 'ghost', value: false }, { label: `${iconImg('play', 16)} Partir`, cls: 'primary', value: true }],
    dismissable: true,
  });
  const root = document.getElementById(id);
  let picking = -1;
  const drawBoosts = () => { root.querySelector('.boost-box').innerHTML = boostSlots(picking); };
  // difficulté et palier d'Abysse choisis : boutons, détail, récompenses
  const drawDiff = () => {
    root.querySelectorAll('.diff-btn').forEach(x => { const on = +x.dataset.d === sel; x.classList.toggle('on', on); x.setAttribute('aria-checked', on); });
    const info = root.querySelector('.diff-info');
    info.className = `diff-info d${sel} ${ab ? 'ab' : ''}`; info.innerHTML = ab ? abyssInfo(i, ab) : diffInfo(i, sel);
    root.querySelector('.abyss-box').innerHTML = abyssBlock(i, ab);
    root.querySelector('.zone-rw').innerHTML = ab ? abyssRewards(i, ab) : zoneRewards(i, sel);
  };
  root?.addEventListener('click', e => {
    const slot = e.target.closest('.bslot'), opt = e.target.closest('.bp-opt');
    if (slot) { sfx('tap'); const k = +slot.dataset.s; picking = picking === k ? -1 : k; drawBoosts(); return; }
    if (opt && picking >= 0) {
      sfx(opt.dataset.id ? 'loot' : 'tap');
      save.boostSel[picking] = opt.dataset.id || null;
      picking = -1; persist({ touch: false }); drawBoosts();
      return;
    }
    const a = e.target.closest('.ab-btn');
    if (a) {
      const t = +a.dataset.ab;
      sfx('tap');
      if (t > abyssTop(i)) {
        toast(`${iconImg('lock', 16)} Battez <b>Abysse ${DATA.ABYSS_ROMAN[abyssTop(i)]}</b> sur ce monde pour ouvrir les paliers suivants`);
        a.classList.remove('nope'); void a.offsetWidth; a.classList.add('nope');
        return;
      }
      if (t !== ab) { ab = t; if (ab) sel = DIFFICULTIES.length - 1; drawDiff(); }
      return;
    }
    const b = e.target.closest('.diff-btn');
    if (!b) return;
    const k = +b.dataset.d;
    if (k > top) {
      sfx('tap');
      toast(`${iconImg('lock', 16)} Battez cette zone en <b>${esc(DIFFICULTIES[k - 1].name)}</b> pour débloquer <b>${esc(DIFFICULTIES[k].name)}</b>`);
      b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope');
      return;
    }
    if (k === sel && !ab) return;
    sel = k; ab = 0;
    sfx('tap');
    drawDiff();
  });
  const ok = await p;
  if (save.diffSel[i] !== sel || (save.abyssSel?.[i] || 0) !== ab) { save.diffSel[i] = sel; if (save.abyssSel) save.abyssSel[i] = ab; persist({ touch: false }); }
  if (ok) { save.lastZone = i; startRun(i, sel, ab); }
}

// ---------- Choix de la classe ----------
function classSelect(first) {
  music('menu');
  let sel = save.cls || 'mage';
  const render = (keep = false) => {
    const c = CLASSES[sel], lk = clsLocked(sel), y = keep ? $('.class-select')?.scrollTop || 0 : 0;
    mount(`<div class="class-select">
      ${first ? `<div class="title-logo"><div class="l1">League of</div><div class="l3">B<em>o</em>nk</div></div><p class="cs-sub">Choisissez votre champion</p>`
        : `<div class="cs-bar"><button class="icon-btn" data-act="back" aria-label="Retour">${iconImg('back', 20)}</button><h2 class="cs-title">Champions</h2></div>`}
      <div class="cs-stage"><canvas class="cs-3d"></canvas><div class="cs-id"><span class="role">${esc(c.role)}</span><h3>${esc(c.name)}</h3></div></div>
      <div class="cs-tabs">${Object.values(CLASSES).filter(k => !first || !clsLocked(k.id)).map(k => `<button class="cs-tab ${k.id === sel ? 'on' : ''} ${clsLocked(k.id) ? 'locked' : ''} ${masteryLv(k.id) >= DATA.MASTERY.max ? 'm-gold' : ''}" data-act="pick" data-c="${k.id}"><img class="px spr" src="${heroURL(k.id, k.colors)}" alt=""><span>${k.tab || k.role}</span>${clsLocked(k.id) ? `<i class="cs-lk">${iconImg('lock', 14)}</i>` : masteryChip(k.id)}</button>`).join('')}</div>
      <section class="cs-detail">
        <p class="cs-desc">${esc(c.desc)}</p>
        ${lk ? clsLockPanel(sel) : ''}
        <div class="stats wide">
          <span>${iconImg('heart', 16)}PV<b>${c.hp}</b></span>
          <span>${iconImg('fist', 16)}ATQ<b>${c.atk}</b></span>
          <span>${iconImg('target', 16)}Critique<b>${pct(c.crit)}</b></span>
          <span>${iconImg('arrow', 16)}Vitesse<b>${pct(c.speed)}</b></span>
        </div>
        ${first ? `<div class="cs-spells"><div class="cs-spell">${iconImg(WEAPONS[c.weapon].icon, 26)}<div><b>${esc(WEAPONS[c.weapon].name)}</b><small>${esc(WEAPONS[c.weapon].desc)}</small></div></div></div>` : `<div class="cs-spells">
          <div class="cs-spell">${iconImg(WEAPONS[c.weapon].icon, 26)}<div><b>${esc(WEAPONS[c.weapon].name)}</b><small>Arme de départ · ${esc(WEAPONS[c.weapon].desc)}</small></div></div>
          ${(c.arsenal || []).filter(id => id !== c.weapon && WEAPONS[id]).length ? `<div class="cs-arsenal"><small>Arsenal de ${esc(c.name)} : armes à gagner en partie</small><div>${c.arsenal.filter(id => id !== c.weapon && WEAPONS[id]).map(id => `<span class="cs-arm" title="${esc(WEAPONS[id].desc)}">${iconImg(WEAPONS[id].icon, 20)}<b>${esc(WEAPONS[id].name)}</b></span>`).join('')}</div></div>` : ''}
          <div class="cs-spell k-ult">${iconImg(ULTS[c.ult].icon, 26)}<div><b>${esc(ULTS[c.ult].name)}</b><small>Ultime · ${esc(ULTS[c.ult].desc)}</small></div></div>
          ${c.passive ? `<div class="cs-spell k-pas">${iconImg(c.passive.icon, 26)}<div><b>${esc(c.passive.name)}</b><small>Passif · ${esc(c.passive.desc)}</small></div></div>` : ''}
        </div>
        <h4 class="evo-t">Évolutions pendant la partie</h4>
        <div class="evo-chain">${EVOLUTIONS[c.id].map((e, i) => `<span class="evo ${e.aura ? 'final' : ''}" style="--d:${(i * 0.05).toFixed(2)}s${e.aura ? `;--aura:${e.aura}` : ''}">
          <em>${i ? `Niv. ${e.lvl}` : 'Départ'}</em><span class="evo-img"><img class="px spr" src="${heroURL(c.id, null, i)}" alt=""></span>
          <b>${esc(i ? e.name.replace(c.name + ' ', '') : c.name)}</b></span>`).join('')}</div>
        ${lk ? '' : `<h4 class="evo-t">Niveau du champion</h4>${masteryPanel(sel)}${auraPicker(sel)}`}`}
        ${first ? '<p class="cs-note">Vous pourrez changer de champion à tout moment.</p>' : ''}
      </section>
      <div class="cs-foot"><button class="btn primary big" data-act="go" ${lk ? 'disabled' : ''}>${lk ? `${iconImg('lock', 16)} Verrouillé · ${esc(c.name)}` : `${first ? 'Commencer' : 'Choisir'} · ${esc(c.name)}`}</button></div>
    </div>`);
    if (y) $('.class-select').scrollTop = y;
    mountPreview($('.cs-3d'), sel);
    bind($('.class-select'), {
      pick: el => { sel = el.dataset.c; render(); },
      go: () => {
        if (clsLocked(sel)) return; // champion à débloquer (Défis, Saison)
        save.cls = sel; persist();
        home('adventure');
      },
      back: () => home(),
      aura: el => { if (pickAura(sel, el.dataset.aura)) { sfx('loot'); render(true); } },
      defis: () => defisScreen(() => classSelect(first)),
    });
  };
  render();
}

// pause d'un chapitre de l'histoire : titre et objectif (avec la progression de la mission)
function pauseGoal(r) {
  const c = chapter(r.story.n), M = r.mission;
  const goal = M ? (M.done ? 'Mission accomplie : entrez dans le portail !' : `${M.icon} ${esc(M.what)} · <b>${M.type === 'survive' ? `${Math.max(0, Math.ceil(M.t - M.el))} s` : `${M.k}/${M.n}`}</b>`)
    : r.portal ? 'Boss vaincu : entrez dans le portail !' : c.giga ? `👑 Battez ${esc(DATA.GIGA.name)} (autel du giga boss)` : `👹 Battez ${esc(r.zone.boss?.name || 'le boss')} (son autel est sur la carte)`;
  return `<div class="pz-goal"><small>${iconImg('book', 13)} ${esc(c.title)}</small><span>${goal}</span></div>`;
}

// ---------- Partie ----------
let run = null;
let runBoosts = [];
let storyCur = null; // chapitre de l'histoire en cours (null : expédition)
let specialCur = null; // partie spéciale en cours (défi de la semaine, mode infini ; js/modes.js)

// premiers pas : monde 1 jamais battu et chapitre 1 pas terminé (JOUER lance le chapitre 1, le tutoriel)
const firstSteps = () => !save.zoneCleared[0] && !storyDone();

// lance un chapitre : bulles d'introduction (sur le décor du monde) puis la partie (Normal, un seul niveau)
async function playChapter(n) {
  const ch = chapter(n); if (!ch || !supported()) return supported() ? undefined : noWebGL();
  music('menu');
  await cutscene(n, 'intro');
  startRun(ch.zone, 0, 0, { story: n });
}

// écran des chapitres
function storyScreen() {
  mount(storyScreenHTML());
  bind($('.story-screen'), {
    back: () => home('adventure'),
    chapter: el => { // fiche du chapitre (objectif, étoiles, récompense) puis la partie
      const n = +el.dataset.n; if (!unlocked(n)) return;
      sfx('tap'); chapterSheet(n).then(go => { if (go) playChapter(n); });
    },
  });
}

// story = n° du chapitre (mode histoire : un seul niveau, dialogues, pas de menu de portail)
function startRun(z, diff = 0, abyss = 0, { story = null, special = null } = {}) {
  if (!supported()) return noWebGL(); // rien n'est dépensé (bonus, partie comptée)
  diff = Math.max(0, Math.min(diff, special ? DIFFICULTIES.length - 1 : maxDiff(z))); // défi de la semaine : difficulté imposée
  abyss = Math.max(0, Math.min(abyss | 0, abyssTop(z))); // L2 : palier d'Abysse (en Cauchemar)
  save.stats.runs++;
  const boosts = runBoosts = consumeBoosts(); // enregistre aussi la partie commencée
  const zone = ZONES[z], ch = story == null ? null : chapter(story);
  storyCur = ch ? story : null;
  specialCur = special;
  run = new Run({
    zone,
    diff,
    abyss,
    boosts,
    story: ch ? { n: story, giga: !!ch.giga, mission: ch.mission || null } : null,
    special,
    onStory: ch ? (ev, d) => chatter(story, ev, d) : special ? (ev, d) => missionChatter(special.mission, ev, d) : null, // commentaires de Pompon
    easy: !save.tutorialDone, // toute première partie : monstres et boss plus faibles (le guide montre tout en jouant)
    onBoss: ch ? () => setTimeout(() => { if (run && !run.over) taunt(story); }, ch.giga ? 3600 : 700) : null,
    onPause: resume => pauseMenu(resume),
    onLevelUp: (title, opts, done, sub, extra) => levelUpMenu(title, opts, done, sub, extra),
    onChest: (c, gold, done) => chestMenu(c, gold, done),
    onDefeat: canRevive => defeatMenu(canRevive),
    // mode histoire : au portail, les bulles de fin du chapitre puis le bilan
    onPortal: ch ? (info, choose) => cutscene(story, 'outro', { inRun: true }).then(() => choose('home'))
      : special ? (info, choose) => choose('home') : (info, choose) => portalMenu(info, choose),
    onEnd: sum => endRun(zone, sum),
  });
  run.onPortal ??= (info, choose) => portalMenu(info, choose);
  battle = run;
  window.__lobRun = run; // utile pour les tests automatisés
  try { run.start(); } catch (e) { // WebGL 2 présent mais contexte 3D refusé (plus de 2D de secours) : partie et bonus rendus
    console.error(e);
    save.stats.runs--;
    for (const id of boosts) save.boosts[id] = (save.boosts[id] || 0) + 1;
    persist();
    run = window.__lobRun = null; home();
    return noWebGL();
  }
  $('.run')?.classList.toggle('lefty', !!save.settings.lefty);
  hpBar(run);
  if (!save.tutorialDone) tutorial(run); // guide en jeu tant qu'il n'a pas été suivi jusqu'au portail
}

// barre de PV du HUD (en haut, au-dessus de l'expérience) : suit les PV du champion à chaque image
function hpBar(r) {
  const row = $('.hud .xprow'), xp = row?.querySelector('.xpbar');
  if (!row || !xp || row.querySelector('.hp-top, #hpFill, .hpbar-p')) return;
  const el = document.createElement('div');
  el.className = 'hp-top';
  el.innerHTML = '<i class="lag"></i><i></i><b></b>';
  xp.before(el);
  const [lag, fill] = el.querySelectorAll('i'), txt = el.querySelector('b');
  let last = -1, lastMax = -1;
  const tick = () => {
    if (r.over || !el.isConnected) return;
    const hp = Math.max(0, Math.round(r.p?.hp || 0)), max = Math.max(1, Math.round(r.p?.maxHp || 1));
    if (hp !== last || max !== lastMax) {
      const w = `calc(${(hp / max * 100).toFixed(2)}% - 2px)`;
      fill.style.width = w; lag.style.width = w;
      txt.textContent = `${fmt(hp)} / ${fmt(max)}`;
      el.classList.toggle('low', hp / max < 0.3);
      last = hp; lastMax = max;
    }
    requestAnimationFrame(tick);
  };
  tick();
}

// ---------- Guide de la première partie : une seule consigne courte à la fois, en jouant ----------
// Pas de pause ni de texte à lire avant de jouer. Chaque consigne apparaît quand elle devient utile (when), reste MSG_T s
// (5 s de jeu) puis s'efface ; la suivante attend que celle-ci soit faite (done). skip : consigne devenue inutile, sautée.
const COACH = [
  { ic: 'arrow', t: 'Glissez le doigt pour bouger', done: (r, S) => S.moved > 160 },
  { ic: 'fist', t: 'Votre champion attaque tout seul' },
  { ic: 'upg', t: 'Ramassez les gemmes bleues', done: r => r.p.level > 1 || r.p.xp > 0 },
  { ic: 'star', t: 'Choisissez une amélioration à chaque niveau', when: r => r.p.level > 1, skip: () => !!save.settings.autoPick },
  { emo: '👹', t: `Niveau ${BOSS_LV} : suivez le 👹 jusqu'au boss`, when: r => r.bossCall?.(), skip: r => r.bossSpawned || !!r.portal, done: r => r.bossSpawned },
  { ic: 'skull', t: 'Battez le boss : écartez-vous des zones rouges', when: r => r.bossSpawned && !!r.boss, skip: r => !!r.portal, done: r => !!r.portal },
  { ic: 'portal', t: 'Entrez dans le portail', when: r => !!r.portal },
];
function tutorial(r) {
  const w = document.createElement('div');
  w.className = 'coach';
  r.coachOn = true; // moins de flèches de bord pendant le guide (overlay.js)
  $('.run')?.appendChild(w);
  const S = { k: 0, shown: false, age: 0, moved: 0, x: r.p.x, y: r.p.y, t: performance.now() };
  const end = () => { save.tutorialDone = true; r.coachOn = false; persist({ touch: false }); w.remove(); };
  const show = c => {
    w.innerHTML = c ? `<div class="co-card">${c.emo ? `<i class="co-emo">${c.emo}</i>` : iconImg(c.ic, 26)}<b>${c.t}</b></div>${S.k === 0 ? '<i class="co-finger"></i>' : ''}` : '';
    w.classList.toggle('on', !!c);
    if (c && S.k) sfx('tap');
  };
  const tick = () => {
    // partie finie : guide réussi si le boss est tombé (mode histoire : le portail mène directement au bilan)
    if (r.over) { if (r.portal || r.gigaWon) end(); else w.remove(); return; }
    if (!w.isConnected) return;
    const now = performance.now(), dt = Math.min(0.5, (now - S.t) / 1000); S.t = now; // temps réel (5 s même si l'image rame)
    if (!r.paused) {
      S.moved += Math.hypot(r.p.x - S.x, r.p.y - S.y); S.x = r.p.x; S.y = r.p.y;
      const c = COACH[S.k];
      if (!c) { end(); return; }
      if (!S.shown) { // en attente du bon moment
        if (c.skip?.(r)) S.k++;
        else if (!c.when || c.when(r)) { S.shown = true; S.age = 0; show(c); }
      } else {
        S.age += dt;
        if (S.age >= MSG_T && w.classList.contains('on')) w.classList.remove('on'); // 5 s puis elle s'efface
        if (S.age >= MSG_T && (!c.done || c.done(r, S))) { S.k++; S.shown = false; if (S.k >= COACH.length) { end(); return; } }
      }
    }
    w.classList.toggle('hide', r.paused);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// évolution d'arme : cherche sa fiche dans les tables de data.js (nom de table libre), sinon nom par défaut
let EVO_TABLES = null;
function evoDef(c, info) {
  EVO_TABLES ??= Object.entries(DATA).filter(([k, v]) => /EVO/i.test(k) && k !== 'EVOLUTIONS' && v && typeof v === 'object').map(([, v]) => v);
  let d = null;
  for (const T of EVO_TABLES) {
    d = Array.isArray(T) ? T.find(e => e && (e.id === c.id || e.weapon === c.id || e.from === c.id)) : T[c.id] || Object.values(T).find(e => e && (e.weapon === c.id || e.from === c.id));
    if (d) break;
  }
  const w = WEAPONS[c.weapon || c.from || c.id] || WEAPONS[d?.weapon] || null;
  return {
    name: info?.name || c.name || d?.name || (w ? `${w.name} ultime` : 'Évolution'),
    desc: info?.desc || c.desc || d?.desc || 'Votre arme atteint sa forme ultime : bien plus puissante.',
    icon: info?.icon || c.icon || d?.icon || w?.icon || 'star',
  };
}

// ---------- Choix automatique des améliorations (option) ----------
// Note de chaque carte : évolution d'arme d'abord, soin si les PV sont bas, puis améliorer ses armes (les plus avancées
// d'abord, vers l'évolution), nouvelle arme tant qu'il y a de la place, tome qui fait évoluer une arme possédée, autres
// tomes, bénédictions ; la rareté départage.
function bestChoice(opts) {
  const p = run?.p, W = p?.weapons || [], T = p?.tomes || {};
  const evoTomes = new Set(W.filter(w => !w.evo).map(w => DATA.WEAPON_EVOS?.[w.id]?.tome).filter(Boolean));
  const score = c => {
    const r = (c.rarity ?? 0) * 6;
    if (c.kind === 'evo') return 1000;
    if (c.kind === 'heal') return p && p.hp < p.maxHp * 0.4 ? 500 : 1;
    if (c.kind === 'weapon') { const own = W.find(w => w.id === c.id); return (own ? 120 + own.lv * 8 : W.length < 3 ? 130 : 105) + r; }
    if (c.kind === 'tome') return (evoTomes.has(c.id) ? 115 : 80) + (T[c.id] ? 8 : 0) + r;
    if (c.kind === 'boon') return 70 + r;
    if (c.kind === 'gold') return 5;
    return 20 + r;
  };
  return opts.reduce((a, b) => (score(b) > score(a) ? b : a));
}
// prend la meilleure carte sans ouvrir l'écran ; petite étiquette « Auto » en haut de l'écran (3 s)
function autoPick(opts, done, gold = 0) {
  const c = bestChoice(opts);
  let f = null;
  try { f = choiceMeta(c, run?.choiceInfo?.(c)); } catch (e) { f = null; }
  const hud = $('.run .hud');
  if (hud && f) {
    let el = hud.querySelector('.auto-pick');
    if (!el) { el = document.createElement('div'); el.className = 'auto-pick'; hud.appendChild(el); }
    el.innerHTML = `${iconImg(f.icon, 20)}<span><small>Auto${f.lv && f.lv > 1 ? ` · niv. ${f.lv}` : ''}</small><b>${esc(f.name)}</b></span>${gold ? `<em>${iconImg('gold', 14)} +${fmt(gold)}</em>` : ''}`;
    el.classList.remove('in'); void el.offsetWidth; el.classList.add('in');
    clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('in'), 3000);
  }
  sfx(c.kind === 'evo' ? 'levelup' : 'pick');
  setTimeout(() => done(c), 0);
}

// présentation d'un choix (montée de niveau, coffre, autel)
function choiceMeta(c, info) {
  if (c.kind === 'evo') { const e = evoDef(c, info); return { ...e, tag: 'Évolution d\'arme', cls: 'evo' }; }
  if (c.kind === 'weapon') { const w = WEAPONS[c.id]; return { icon: w.icon, name: w.name, tag: c.lv === 1 ? 'Nouvelle arme' : 'Arme', desc: c.lv === 1 ? w.desc : w.lv[c.lv - 1], cls: 'weapon', lv: c.lv }; }
  if (c.kind === 'tome') { const t = TOMES[c.id]; return { icon: t.icon, name: t.name, tag: c.lv === 1 ? 'Nouveau tome' : 'Tome', desc: t.desc, cls: 'tome', lv: c.lv }; }
  if (c.kind === 'boon') { const b = BOONS[c.id]; return { icon: b.icon, name: b.name, tag: 'Bénédiction', desc: b.desc, cls: 'boon' }; }
  if (c.kind === 'heal') return { icon: 'heart', name: 'Soin', tag: 'Bonus', desc: 'Récupère 30 % de vos PV', cls: 'heal' };
  if (c.kind === 'gold') return { icon: 'gold', name: 'Bourse', tag: 'Bonus', desc: 'De l\'or en plus', cls: 'gold' };
  return { icon: info?.icon || 'star', name: info?.name || c.name || 'Amélioration', tag: 'Bonus', desc: info?.desc || c.desc || '', cls: 'gold' };
}

// carte de choix : rareté (cadre), niveau, effet et caractéristiques « avant → après » (run.choiceInfo)
function choiceCard(c, i, tag = 'button') {
  let info = null;
  try { info = run?.choiceInfo?.(c); } catch (e) { info = null; }
  const f = choiceMeta(c, info);
  const val = v => esc(typeof v === 'number' ? v.toLocaleString('fr-FR') : String(v));
  // lignes « avant → après » (sans celles qui ne changent rien)
  const lines = (info?.lines || []).filter(l => l && l.label != null && l.to != null && (l.from == null || l.from === '' || val(l.from) !== val(l.to))).slice(0, 2);
  const hint = typeof info?.hint === 'string' && info.hint && c.kind === 'weapon' ? info.hint : ''; // carte plus courte : l'évolution se lit sur l'arme
  const pips = f.lv && !(f.lv === 1 && (c.kind === 'weapon' || c.kind === 'tome')) ? `<span class="cu-pips" aria-label="Niveau ${f.lv}">${Array.from({ length: 5 }, (_, k) => `<i class="${k + 1 < f.lv ? 'on' : k + 1 === f.lv ? 'new' : ''}"></i>`).join('')}</span>` : '';
  const isNew = f.lv === 1 && (c.kind === 'weapon' || c.kind === 'tome');
  const ri = c.rarity ?? info?.rarity;
  const rar = ri != null && RARITIES[ri] ? RARITY[RARITIES[ri]] : null;
  return `<${tag} class="card-up ${f.cls} ${rar ? 'r' + ri : ''} ${isNew ? 'is-new' : ''}" data-i="${i}" style="--d:${(i * 0.06).toFixed(2)}s">
    ${c.kind === 'evo' ? '<i class="cu-ribbon">Évolution</i>' : ''}
    <span class="cu-ic">${iconImg(f.icon, 44)}</span>
    <span class="cu-txt">
      <span class="cu-head"><em>${f.tag}${f.lv && !isNew ? ` · niv. ${f.lv}` : ''}${rar && c.kind !== 'evo' ? ` · <span class="cu-rar">${esc(rar.name)}</span>` : ''}</em>${pips}</span>
      <b>${esc(f.name)}</b>
      <small>${esc(f.desc)}</small>
      ${lines.length ? `<span class="cu-lines">${lines.map(l => `<span class="cu-l ${String(l.to).length > 9 ? 'long' : ''}"><span>${esc(l.label)}</span>${l.from != null && l.from !== '' ? `<s>${val(l.from)}</s><i>›</i>` : '<i class="nw">›</i>'}<b>${val(l.to)}</b></span>`).join('')}</span>` : ''}
      ${hint ? `<span class="cu-hint ${/possédé/.test(hint) ? 'ok' : ''}">${iconImg('star', 12)}<span><strong>Évolution</strong> ${esc(hint.replace(/^Évolution\s*:\s*/, ''))}</span></span>` : ''}
    </span>
  </${tag}>`;
}

function overlay(html) {
  const w = document.createElement('div');
  w.className = 'overlay';
  w.innerHTML = html;
  $('.run').appendChild(w);
  requestAnimationFrame(() => w.classList.add('in'));
  return w;
}
// fermeture d'une fenêtre de la partie : court fondu (elle ne compte plus comme ouverte dès maintenant)
function closeOv(w, then) {
  w.classList.add('closing'); w.classList.remove('in');
  setTimeout(() => w.remove(), 150);
  then?.();
}

// choix protégé contre les touches accidentelles : cartes inactives un court instant, et seul un appui
// commencé sur la carte après son activation compte (le doigt qui déplaçait le héros ne choisit rien)
function guardCards(w, sel, onPick, delay = 650) {
  const btns = [...w.querySelectorAll(sel)];
  let armed = null;
  btns.forEach(b => b.disabled = true);
  w.classList.add('locked');
  setTimeout(() => { btns.forEach(b => b.disabled = false); w.classList.remove('locked'); }, delay);
  w.addEventListener('pointerdown', e => { const b = e.target.closest(sel); armed = b && !b.disabled ? b : null; });
  w.addEventListener('click', e => {
    const b = e.target.closest(sel);
    if (!b || b.disabled || b !== armed) return;
    btns.forEach(x => x.disabled = true);
    onPick(b);
  });
}

// en-tête des fenêtres de choix : « NIVEAU 9 » devient sur-titre + grand chiffre
function luHead(title, sub, eyebrow) {
  const m = /^Niveau (\d+)/.exec(title);
  return `<div class="lu-head"><span class="eyebrow">${esc(eyebrow || (m ? 'Montée de niveau' : 'Récompense'))}</span>
    <h2 class="lu-title">${m ? `Niveau ${m[1]}` : esc(title.replace(/\s*!$/, ''))}</h2><p class="lu-sub">${esc(sub)}</p></div>`;
}

// montée de niveau : 3 cartes ; « Relancer (N) » et « Passer » si la partie les propose (extra)
function levelUpMenu(title, opts, done, subtitle = 'Choisissez une amélioration', extra = null) {
  if (save.settings.autoPick && opts?.length) return autoPick(opts, done); // option : la meilleure carte, sans s'arrêter
  let cur = opts;
  // compteurs : valeur fournie par la partie (nombre, ou fonction / accesseur à jour), décomptés ici sinon
  const read = k => (extra ? Math.max(0, (typeof extra[k] === 'function' ? extra[k]() : extra[k]) | 0) : 0);
  let nR = read('rerolls'), nS = read('skips');
  const rr = () => nR, sk = () => nS;
  const foot = () => `<div class="lu-foot">
      ${extra && typeof extra.reroll === 'function' ? `<button class="btn ghost lu-act" data-x="reroll" ${rr() ? '' : 'disabled'}>${iconImg('reroll', 16)} Relancer <b>(${rr()})</b></button>` : ''}
      ${extra && typeof extra.skip === 'function' ? `<button class="btn ghost lu-act" data-x="skip" ${sk() ? '' : 'disabled'}>${iconImg('skip', 16)} Passer <b>(${sk()})</b></button>` : ''}
    </div>
    <label class="lu-auto"><span class="sw"><input type="checkbox" class="lu-auto-cb"><i></i></span><span><b>Choix automatique</b><small>La meilleure carte à chaque niveau</small></span></label>`;
  const w = overlay(`<div class="lvlup">
    ${luHead(title, subtitle)}
    <div class="cards">${cur.map((c, i) => choiceCard(c, i)).join('')}</div>
    ${foot()}
  </div>`);
  w.classList.add('lvl-ov');
  if (cur.some(c => c.kind === 'evo')) sfx('levelup');
  let busy = false;
  // case « Choix automatique » : cochée, la meilleure carte est prise tout de suite, et à chaque niveau ensuite
  w.querySelector('.lu-auto-cb')?.addEventListener('change', e => {
    if (!e.target.checked || busy) return;
    busy = true; save.settings.autoPick = true; persist({ touch: false });
    sfx('pick'); closeOv(w, () => autoPick(cur, done));
  });
  guardCards(w, '.card-up', b => {
    if (busy) return;
    busy = true;
    w.querySelectorAll('.card-up, .lu-act').forEach(x => { x.disabled = true; });
    sfx('pick'); buzz(15);
    b.classList.add('picked');
    w.classList.add('picking');
    setTimeout(() => closeOv(w, () => done(cur[+b.dataset.i])), 200);
  });
  // relancer : nouvelles cartes ; passer : la partie reprend (un peu d'or en échange)
  w.addEventListener('click', e => {
    const x = e.target.closest('.lu-act'); if (!x || x.disabled || busy || w.classList.contains('locked')) return;
    if (x.dataset.x === 'reroll') {
      if (!rr()) return;
      let n = null;
      try { n = extra.reroll(); } catch (err) { n = null; }
      if (!Array.isArray(n) || !n.length) return;
      const after = read('rerolls'); nR = after < nR ? after : nR - 1;
      cur = n; sfx('chestShake'); buzz(10);
      const box = w.querySelector('.cards');
      box.innerHTML = cur.map((c, i) => choiceCard(c, i)).join('');
      box.querySelectorAll('.card-up').forEach(b2 => { b2.style.animationDelay = '0s'; });
      w.querySelector('.lu-foot').outerHTML = foot();
      return;
    }
    if (x.dataset.x === 'skip') {
      if (!sk()) return;
      busy = true; sfx('coin'); nS--;
      let res;
      try { res = extra.skip(); } catch (err) { res = false; }
      closeOv(w);
      // si la partie ne reprend pas d'elle-même, on la relance sans rien choisir
      if (res !== false && run && run.paused && !run.over && !$('.lvl-ov:not(.closing)')) done({ kind: 'skip', id: 'skip', lv: 0 });
    }
  });
}

function chestMenu(c, gold, done) {
  if (save.settings.autoPick) return autoPick([c], done, gold);
  const w = overlay(`<div class="lvlup chest">
    ${luHead(c.kind === 'evo' ? 'Évolution' : 'Coffre ouvert', c.kind === 'evo' ? 'Votre arme atteint sa forme ultime' : 'Amélioration gratuite', 'Coffre')}
    <div class="cards">${choiceCard(c, 0, 'div')}</div>
    <p class="lu-gold">${iconImg('gold', 20)} <b>+${fmt(gold)}</b> or</p>
    <button class="btn primary big lu-ok">Continuer</button>
  </div>`);
  w.classList.add('lvl-ov');
  if (c.kind === 'evo') sfx('levelup');
  guardCards(w, '.lu-ok', () => { sfx('tap'); closeOv(w, done); }, 500);
}

// ---------- Portail entre deux mondes ----------
const bossImg = z => {
  const b = z.boss || z.monsters[4];
  return `<img class="px spr" src="${creatureURL(`${z.id}-${zoneSteps(z).length - 1}-${b.name}`, b.body, b.pal, { boss: !!z.boss })}" alt="">`;
};

// giga boss : portrait (forme 1, ou forme embrasée une fois vaincu)
const gigaImg = (won = false) => { const G = DATA.GIGA; return `<img class="px spr" src="${creatureURL(`9-9-${G.name}${won ? ':3' : ''}`, G.body, G.pal, { boss: true })}" alt="">`; };

// portail : niveau suivant (plus dur ; le dernier est celui du giga boss) ou retour avec le butin ; après le giga boss,
// la victoire de l'expédition
function portalMenu(info, choose) {
  const from = ZONES[info.from] || ZONES[0], to = info.to == null ? null : ZONES[info.to], G = DATA.GIGA;
  const L = info.levels || DATA.EXPE_LEVELS || 3, lv = info.level || (info.stage | 0) + 1, won = !!info.giga, gNext = !!info.gigaNext && !!to;
  // numéros de monde : ceux de la carte (comme le HUD), pas le rang dans l'expédition
  const nFrom = from.id + 1, cleared = info.cleared?.length ? info.cleared : [from.id];
  const stat = (ic, v, l) => `<div>${iconImg(ic, 18)}<b>${v}</b><small>${l}</small></div>`;
  // niveaux de l'expédition : 1 · 2 · giga boss
  const steps = Array.from({ length: L }, (_, i) => {
    const g = i === L - 1, st = i < lv || won ? 'done' : i === lv && to ? 'next' : '';
    return `<span class="pm-lv ${g ? 'giga' : ''} ${st}">${g ? iconImg('crown', 13) : ''}${g ? 'Giga boss' : `Niveau ${i + 1}`}</span>`;
  }).join('<i></i>');
  const w = overlay(`<div class="portal-menu ${to ? '' : 'final'} ${won || gNext ? 'giga' : ''}">
    ${won ? `<div class="pm-giga">${gigaImg(true)}<em>Vaincu</em></div>` : `<div class="pm-vortex"><i></i><i></i><i></i><b>${iconImg(to ? 'portal' : 'crown', 34)}</b></div>`}
    <span class="eyebrow">${won ? `${esc(G.name)} · ${esc(G.title)}` : `Niveau ${lv}/${L} terminé · Monde ${nFrom}`}</span>
    <h2>${won ? 'Victoire de l\'expédition' : to ? 'Portail ouvert' : 'Expédition terminée'}</h2>
    <p class="pm-sub">${won ? `Le Roi des Bonks est tombé ! Le <b>Giga coffre</b> est à vous.` : to ? (gNext ? `<b>${esc(G.name)}</b>, le giga boss, vous attend au dernier niveau.` : 'Continuez l\'expédition (plus dur) ou rentrez avec votre butin.') : 'Rentrez avec votre butin.'}</p>
    <div class="pm-levels">${steps}</div>
    <div class="pm-stats">${stat('clock', fmtTime(info.time || 0), 'Temps')}${stat('skull', fmt(info.kills || 0), 'Monstres')}${stat('gold', fmt(info.gold || 0), 'Or')}${stat('chest', info.loot || 0, 'Coffres')}</div>
    <div class="pm-bosses">${cleared.map((id, i) => `<span class="pm-b" title="${esc(won && i === cleared.length - 1 ? G.name : ZONES[id].name)}">${won && i === cleared.length - 1 ? gigaImg(true) : bossImg(ZONES[id])}<i>✓</i></span>`).join('')}</div>
    ${to ? `<button class="pm-next ${gNext ? 'giga' : ''}" data-v="next" style="background-image:url(${zoneBannerURL(to)})">
        <span class="pm-n">${lv + 1}</span>
        <span class="pm-t"><small>${gNext ? 'Niveau suivant · giga boss' : 'Niveau suivant · plus dur'}</small><b>${esc(to.name)}</b><em>${gNext ? `${esc(G.name)}, ${esc(G.title)}` : 'Monstres plus coriaces, plus d\'élites, plus de butin'}</em></span>
        <span class="pm-boss">${gNext ? gigaImg() : bossImg(to)}</span><i class="pm-go">Entrer</i>
      </button>
      <button class="btn ghost pm-home" data-v="home">${iconImg('chest', 18)} Rentrer avec le butin</button>`
    : `<button class="btn primary big pm-home" data-v="home">${iconImg('crown', 20)} ${won ? 'Rentrer en héros' : 'Rentrer avec le butin'}</button>`}
  </div>`);
  w.classList.add('portal-ov');
  // petite pause : le doigt du joueur est peut-être encore sur l'écran
  const btns = [...w.querySelectorAll('[data-v]')];
  btns.forEach(b => b.disabled = true);
  setTimeout(() => btns.forEach(b => b.disabled = false), 700);
  w.addEventListener('click', e => {
    const b = e.target.closest('[data-v]'); if (!b || b.disabled) return;
    sfx('tap');
    closeOv(w);
    choose(b.dataset.v);
  });
}

// caractéristiques de la partie en cours (écran de pause) : dégâts, critique, vol de vie, armure
function pzStats(p) {
  const pc1 = v => `${(Math.round(v * 1000) / 10).toLocaleString('fr-FR')} %`;
  const cell = (ic, label, v, cls = '') => `<div class="${cls}"><small>${iconImg(ic, 12)}${label}</small><b>${v}</b></div>`;
  return cell('fist', 'Dégâts', `${p.dmgMul >= 1 ? '+' : '−'}${Math.round(Math.abs((p.dmgMul || 1) - 1) * 100)} %`)
    + cell('target', 'Critique', pct(p.crit || 0))
    + cell('lifesteal', 'Vol de vie', pc1(p.lifesteal || 0), (p.lifesteal || 0) > LS.base + 0.0005 ? 'ls-on' : '')
    + cell('shield', 'Armure', pct(p.armor || 0));
}

async function pauseMenu(resume) {
  const p = run.p, z = run.zone;
  const sw = (id, ic, label, on) => `<label class="set-row">${iconImg(ic, 20)}<span class="set-l">${label}</span><span class="sw"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}><i></i></span></label>`;
  // build : armes puis tomes, niveau en cases (1 à 5), bord de la rareté la plus haute obtenue
  const pips = lv => `<span class="bl-pips" aria-label="Niveau ${lv}">${Array.from({ length: DATA.MAX_LEVEL || 5 }, (_, k) => `<i class="${k < lv ? 'on' : ''}"></i>`).join('')}</span>`;
  const evoName = id => DATA.WEAPON_EVOS?.[id]?.name || WEAPONS[id].name;
  const wRow = w => `<span class="bl r${w.r || 0} ${w.evo ? 'evo' : ''}">${iconImg(w.evo ? DATA.WEAPON_EVOS?.[w.id]?.icon || WEAPONS[w.id].icon : WEAPONS[w.id].icon, 20)}<span class="bl-t"><b>${esc(w.evo ? evoName(w.id) : WEAPONS[w.id].name)}</b>${w.evo ? '<small>Évolution</small>' : pips(w.lv)}</span></span>`;
  const tRow = ([id, lv]) => `<span class="bl t r${p.tr?.[id] || 0}">${iconImg(TOMES[id].icon, 20)}<span class="bl-t"><b>${esc(TOMES[id].name)}</b>${pips(lv)}</span></span>`;
  const tomes = Object.entries(p.tomes || {}), nW = DATA.MAX_WEAPONS || 4, nT = DATA.MAX_TOMES || 4;
  const free = n => Array.from({ length: Math.max(0, n) }, () => '<span class="bl empty"><i>Emplacement libre</i></span>').join('');
  const hpK = Math.max(0, Math.min(1, p.hp / Math.max(1, p.maxHp)));
  const v = await modal({
    title: `<span class="eyebrow">${run.story ? `Chapitre ${run.story.n + 1}` : `Niveau ${(run.stage | 0) + 1}/${DATA.EXPE_LEVELS}`} · Monde ${(z?.id ?? 0) + 1} · ${esc(z?.name || '')}</span><span class="h2-row">Pause${run.diffId ? ` <span class="diff-tag d${run.diffId}${run.abyss ? ' ab' : ''}">${esc(run.diff.name)}</span>` : ''}</span>`,
    cls: 'pause-modal',
    body: `${run.story ? pauseGoal(run) : ''}<div class="pz-hp ${hpK < 0.3 ? 'low' : ''}"><small>PV</small><span class="pbar"><i style="width:${(hpK * 100).toFixed(1)}%"></i></span><b>${fmt(Math.max(0, p.hp))} / ${fmt(p.maxHp)}</b></div>
      <h4>Votre build <small>niveau ${p.level}</small></h4>
      <div class="pz-build">${p.weapons.map(w => `<span class="pzb r${w.r || 0} ${w.evo ? 'evo' : ''}" title="${esc(w.evo ? evoName(w.id) : WEAPONS[w.id].name)}">${iconImg(w.evo ? DATA.WEAPON_EVOS?.[w.id]?.icon || WEAPONS[w.id].icon : WEAPONS[w.id].icon, 24)}<b>${w.evo ? '★' : w.lv}</b></span>`).join('')}${Array.from({ length: Math.max(0, nW - p.weapons.length) }, () => '<span class="pzb empty"></span>').join('')}
      </div><div class="pz-build">${tomes.map(([id, lv]) => `<span class="pzb t r${p.tr?.[id] || 0}" title="${esc(TOMES[id].name)}">${iconImg(TOMES[id].icon, 22)}<b>${lv}</b></span>`).join('')}${Array.from({ length: Math.max(0, nT - tomes.length) }, () => '<span class="pzb t empty"></span>').join('')}</div>
      <h4>Options</h4>
      <div class="set-list">${sw('pAuto', 'upg', 'Choix automatique des améliorations', save.settings.autoPick)}${sw('pSound', 'sound', 'Son', save.settings.sound)}${sw('pMus', 'music', 'Musique', save.settings.music !== false)}${sw('pVib', 'vibrate', 'Vibrations', save.settings.vibrate)}</div>
      <details class="pz-help"><summary>${iconImg('fist', 16)} Statistiques de la partie</summary>
      <div class="pz-sum">
        <div><small>Temps</small><b>${fmtTime(run.runTime ?? run.time ?? 0)}</b></div><div><small>Niveau</small><b>${p.level}</b></div>
        <div><small>Monstres</small><b>${fmt(run.kills || 0)}</b></div><div><small>Or</small><b class="gold-t">${fmt(run.gold)}</b></div>
      </div>
      <div class="pz-sum pz-st">${pzStats(p)}</div>
      ${abyssPause(run.abyss)}
      ${p.weapons.length || tomes.length ? `<div class="cur-build">${p.weapons.map(wRow).join('')}${tomes.map(tRow).join('')}</div>` : ''}
      ${runBoosts.length ? `<div class="cur-build boosts-on">${runBoosts.map(id => `<span class="bl">${iconImg(BOOSTS[id].icon, 20)}<span class="bl-t"><b>${esc(BOOSTS[id].name)}</b></span></span>`).join('')}</div>` : ''}
      </details>
      <details class="pz-help"><summary>${iconImg('info', 16)} Comment jouer</summary>
      <div class="howto">
        <p>${iconImg('arrow', 20)}<span><b>Se déplacer</b> : glissez le doigt n'importe où sur l'écran. Tout se joue avec un seul doigt.</span></p>
        <p>${iconImg('sword', 20)}<span><b>Attaquer</b> : c'est automatique ! Ramassez les gemmes pour monter de niveau et évoluer.</span></p>
        <p>${iconImg('i_heavy', 20)}<span><b>Esquiver</b> : un cercle rouge au sol ou un monstre qui clignote annonce une attaque. Écartez-vous ! Les ondes de choc et les rayons des boss ont une portée limitée : éloignez-vous du boss.</span></p>
        <p>${iconImg('skull', 20)}<span><b>Boss</b> : au <b>niveau ${BOSS_LV}</b>, suivez le 👹 jusqu'à l'<b>autel au crâne rouge</b> et restez dessus pour invoquer le boss (sinon il vient de lui-même à la fin du chrono). Le combat a lieu dans une arène fermée.</span></p>
        <p>${iconImg('portal', 20)}<span><b>Portail</b> : le boss vaincu ouvre un portail (suivez la flèche) vers le niveau suivant, plus dur mais plus riche. Vous pouvez aussi rentrer avec votre butin.</span></p>
        <p>${iconImg('crown', 20)}<span><b>Giga boss</b> : une expédition compte 3 niveaux. Au niveau 3, <b>${esc(DATA.GIGA.name)}</b> remplace le boss : 3 phases, bonds écrasants, ondes à brèche, double rayon. Battez-le pour le <b>Giga coffre</b> !</span></p>
        <p>${iconImg('i_enrage', 20)}<span><b>Chrono</b> : quand il est écoulé, le boss arrive de lui-même et les monstres deviennent <b>fous</b>, de plus en plus. Ne traînez pas !</span></p>
        <p>${iconImg('i_burn', 20)}<span><b>Totems de défi</b> : restez près d'un totem pour l'activer. Le monde devient plus dur, mais vous gagnez de l'or, un coffre ou une bénédiction (et +${Math.round(HEAT_GOLD * 100)} % d'or au bilan).</span></p>
        <p>${iconImg('chest', 20)}<span><b>Coffres de butin</b> : ramassez-les, ils s'ouvrent à la fin de la partie. Leurs pièces servent à fabriquer de l'équipement à la Forge.</span></p>
        <p>${iconImg('gem', 20)}<span><b>Explorer</b> : les autels bleus donnent des bénédictions, les coffres dorés des améliorations.</span></p>
        <p>${iconImg('lifesteal', 20)}<span><b>Vol de vie</b> : vos coups vous soignent (des orbes de sang filent vers vous). Montez-le avec les <b>Crocs du vampire</b>, l'<b>Autel du sang</b>, la <b>Fiole de sang</b>, la <b>Soif de sang</b> de la Boutique et l'équipement.</span></p>
        <p>${iconImg('i_atk', 20)}<span><b>Attaques spéciales</b> : un monstre qui clignote ou un cercle rouge au sol annonce une attaque. Écartez-vous vite !</span></p>
        <p>${iconImg('crown', 20)}<span><b>Élites</b> : leur nom indique leur pouvoir (${Object.values(ELITE_MODS).map(m => esc(m.name)).join(', ')}). Fuyez les Explosifs quand ils tombent !</span></p>
        <p>${iconImg('nova', 20)}<span><b>Ultime</b> : se charge en battant des monstres et se lance tout seul quand des ennemis sont proches (ou touchez le bouton).</span></p>
      </div></details>`,
    buttons: [{ label: `${iconImg('exit', 16)} Abandonner`, cls: 'danger ghost', value: 'quit' }, { label: `${iconImg('play', 16)} Reprendre`, cls: 'primary', value: 'resume' }],
  });
  save.settings.sound = $('#pSound')?.checked ?? save.settings.sound;
  save.settings.vibrate = $('#pVib')?.checked ?? save.settings.vibrate;
  save.settings.autoPick = $('#pAuto')?.checked ?? save.settings.autoPick;
  const musOn = $('#pMus')?.checked ?? save.settings.music;
  if (musOn !== save.settings.music) { save.settings.music = musOn; if (!musOn) stopMusic(); else if (run) music('zone' + run.zone.id); }
  persist();
  if (v === 'quit') {
    const nLoot = run.loot?.length || 0;
    const ok = await modal({ title: 'Abandonner ?', body: `<p>La partie s'arrête ici. Vous gardez <b>${fmt(run.gold)} or</b>${nLoot ? ` et <b>${nLoot} coffre${nLoot > 1 ? 's' : ''} de butin</b>` : ''} ramassés.</p>`, buttons: [{ label: 'Continuer', cls: 'ghost', value: false }, { label: 'Abandonner', cls: 'danger', value: true }] });
    if (ok) { if (run && !run.over) run.finish(false); return; }
  }
  if (run && !run.over) resume();
}

async function defeatMenu(canRevive) {
  const r = run;
  const t = fmtTime(run.runTime ?? run.time), nLoot = run.loot?.length || 0, z = run.zone;
  const kept = nLoot || run.cleared?.length ? `<p class="ko-kept">${iconImg('chest', 18)}<span>${nLoot ? `Vos <b>${nLoot} coffre${nLoot > 1 ? 's' : ''} de butin</b>` : 'Vos mondes vaincus'}${nLoot && run.cleared?.length ? ' et les mondes vaincus sont conservés' : ' sont conservés'}.</span></p>` : '';
  const v = await modal({
    title: `<span class="eyebrow">${run.story ? `Chapitre ${run.story.n + 1}` : `Niveau ${(run.stage | 0) + 1}/${DATA.EXPE_LEVELS}`} · ${run.boss?.giga && !run.boss.dead ? esc(DATA.GIGA.name) : `Monde ${(z?.id ?? 0) + 1} · ${esc(z?.name || '')}`}</span>K.O.`,
    cls: 'ko-modal',
    body: `<div class="pz-sum">
        <div><small>Survie</small><b>${t}</b></div><div><small>Niveau</small><b>${run.p.level}</b></div>
        <div><small>Monstres</small><b>${fmt(run.kills || 0)}</b></div><div><small>Or</small><b class="gold-t">${fmt(run.gold || 0)}</b></div>
      </div>` + (canRevive
      ? `<div class="ko-offer"><span class="ko-ic">${iconImg('heart', 26)}</span><span><b>Deuxième chance</b><small>Regardez une courte publicité pour revenir avec <b>tous vos PV</b>. Les monstres autour de vous sont balayés. Une fois par partie.</small></span></div>${kept}`
      : kept),
    buttons: canRevive
      ? [{ label: 'Terminer', cls: 'ghost', value: 'quit' }, { label: `${iconImg('heart', 16)} Revivre`, cls: 'primary', value: 'ad' }]
      : [{ label: 'Voir le bilan', cls: 'primary', value: 'quit' }],
  });
  if (v === 'ad') {
    const ok = await showRewardedAd();
    if (ok) { if (r === run && !r.over) r.revive(); return; }
  }
  if (r === run && !r.over) r.finish(false); // la partie a pu se terminer pendant que la fenêtre était ouverte
}

const fmtTime = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

// ---------- Fin d'expédition ----------
function endRun(z, sum) {
  battle = null; run = null;
  const k = sum.diff || 0, D = runDiff(k, sum.abyss); // Abysse : or, rareté et puissance des objets en plus
  const st = save.stats;
  const start = ZONES[sum.startZone] || z;
  // champs de l'expédition (valeurs par défaut tant que le moteur ne les fournit pas)
  const cleared = (Array.isArray(sum.cleared) ? sum.cleared : sum.win ? [start.id] : []).filter(id => ZONES[id]);
  const loot = (Array.isArray(sum.loot) ? sum.loot : []).filter(c => c && LOOT_TIERS[c.tier]);
  const heat = Math.max(0, sum.heat | 0), stage = Math.max(0, sum.stage | 0);
  // 1. les coffres d'abord : ils ne doivent jamais être perdus, même si l'appli se ferme
  for (const c of loot) save.pendingChests.push({ tier: c.tier | 0, zone: Math.max(0, Math.min(ZONES.length - 1, (c.zone ?? start.id) | 0)), ...(c.giga ? { giga: 1, diff: k } : {}) }); // diff : objets mythiques
  persist();
  st.kills += sum.kills;
  const record = st.bestLevel > 0 && sum.level > st.bestLevel; // nouveau meilleur niveau atteint
  st.bestLevel = Math.max(st.bestLevel, sum.level);
  st.bestStage = Math.max(st.bestStage || 0, stage);
  st.totems = (st.totems || 0) + heat;
  st.portals = (st.portals || 0) + stage + (sum.win && cleared.length ? 1 : 0);
  if (!sum.win) st.deaths++;
  // giga boss vaincu : victoires, meilleur niveau de difficulté (+ palier d'Abysse), sans toucher son double rayon, record
  const route = (Array.isArray(sum.route) && sum.route.length ? sum.route : [start.id]).filter(id => ZONES[id]);
  let gigaRec = false;
  if (sum.giga) {
    st.gigaKills = (st.gigaKills || 0) + 1;
    st.gigaTop = Math.max(st.gigaTop || 0, k + 1 + (sum.abyss | 0));
    if (sum.track?.gigaDance) st.gigaDance = (st.gigaDance || 0) + 1;
    const t = Math.round(sum.time || 0);
    gigaRec = !!st.gigaBest && t > 0 && t < st.gigaBest;
    if (t > 0 && (!st.gigaBest || t < st.gigaBest)) st.gigaBest = t;
  }
  let gold = Math.round(sum.gold);
  const r = rng(Date.now());
  const found = [], worlds = [];
  let unlocked = null, newZone = null;
  // 2. progression de chaque monde vaincu (boss tué) pendant l'expédition
  for (const id of cleared) {
    const wz = ZONES[id], lines = [], first = !save.zoneCleared[id];
    st.wins++; st.worlds = (st.worlds || 0) + 1;
    const bonus = Math.round((40 + id * 40) * (!first && !k ? 0.6 : 1) * D.gold);
    gold += bonus;
    lines.push(`${iconImg('gold', 20)} Boss vaincu : <b>+${fmt(bonus)} or</b>`);
    save.diffWins[id][k]++;
    if (cleared.length === 1 && sum.time) { const best = save.diffBest[id][k], t = Math.round(sum.time); if (!best || t < best) save.diffBest[id][k] = t; }
    if ((save.diffCleared[id] || 0) < k + 1) {
      save.diffCleared[id] = k + 1;
      const next = DIFFICULTIES[k + 1];
      if (next) { if (id === start.id) unlocked = k + 1; lines.push(`${iconImg(next.icon, 20)} Niveau débloqué : <b style="color:${next.color}">${esc(next.name)}</b>`); }
      else lines.push(`${iconImg('crown', 20)} Monde maîtrisé : <b>3 étoiles</b> !`);
    }
    // récompenses de première victoire (quel que soit le niveau : on peut arriver ici par un portail)
    if (first) {
      save.zoneCleared[id] = true;
      if (id + 1 < ZONES.length && save.unlockedZone < id + 1) { save.unlockedZone = id + 1; newZone = id + 1; lines.push(`${iconImg('star', 20)} Nouveau monde : <b>${esc(ZONES[id + 1].name)}</b>`); }
      const petId = PET_BY_ZONE[id];
      if (!save.pets.includes(petId)) {
        save.pets.push(petId);
        if (!save.pet) save.pet = petId;
        const p = PETS[petId];
        lines.push(`<img class="px spr" src="${creatureURL('pet-' + petId, p.body, p.pal)}" width="26" height="26" alt=""> Familier : <b>${esc(p.name)}</b> <small>${esc(p.desc)}</small>`);
      }
      const bi = makeBossItem(id);
      if (bi) { bi.isNew = true; bi._eq = addItem(bi); found.push(bi); }
    }
    // butin d'objets du boss
    for (let n = 1 + (Math.random() < 0.35); n > 0; n--) {
      const it = makeItem(r, id, { boost: 0.25 + D.rarity, mult: D.itemMult });
      it.isNew = true; it._eq = addItem(it); found.push(it);
    }
    worlds.push({ z: wz, n: route.indexOf(id) + 1 || 1, giga: !!sum.giga && id === route[route.length - 1], lines });
  }
  if (!cleared.length && sum.time > 90 && Math.random() < 0.4) {
    const it = makeItem(r, start.id, { boost: D.rarity, mult: D.itemMult });
    it.isNew = true; it._eq = addItem(it); found.push(it);
  }
  if (cleared.length) {
    st.classWins[save.cls] = (st.classWins[save.cls] || 0) + 1;
    if (!sum.revived) st.cleanZone = true;
  }
  // totems de défi : +10 % d'or par totem activé
  const heatGold = heat ? Math.round(gold * HEAT_GOLD * heat) : 0;
  gold += heatGold;
  const l2 = endRunL2(sum, { cleared, worlds, k }); // L2 : records, maîtrise, paliers d'Abysse (or ci-dessous), défis
  gold += l2.gold;
  save.gold += gold;
  persist();
  const pass = seasonRun({ ...sum, cleared, loot, heat, stage }); // L1 : XP de saison et compteurs des succès
  const got = checkAchievements();
  persist();
  const sc = storyCur == null ? null : chapter(storyCur); // chapitre réussi : giga boss, mission ou boss du monde vaincu
  const story = sc ? storyEnd(storyCur, { ok: sc.giga ? !!sum.giga : sc.mission ? !!sum.mission : cleared.includes(sc.zone), revived: !!sum.revived, time: sum.time || 0, hp: sum.hp ?? 1 }) : null;
  storyCur = null;
  if (story?.ok) save.tutorialDone = true; // chapitre réussi : le guide de la première partie ne revient plus
  // modes spéciaux : défi de la semaine (récompense la 1re fois de la semaine), mode infini (record par monde)
  const sp = specialCur; specialCur = null;
  const special = !sp ? null : sp.kind === 'weekly' ? { ...sp, ok: !!sum.mission, ...(sum.mission ? weeklyWin(sp.W) : { first: false }) }
    : { ...sp, ...endlessEnd(start.id, sum.time) };
  const R = { start, k, D, sum, cleared, worlds, found, gold, heat, heatGold, stage, unlocked, newZone, got, record, l2, pass, route, gigaRec,
    final: !!sum.giga, reached: ZONES[route[route.length - 1]] || start, story, special };
  sfx(cleared.length ? 'win' : 'coin');
  const show = opened => summaryScreen(R, opened);
  if (save.pendingChests.length) chestScreen(show, true); else show([]);
}

// ---------- Bilan de l'expédition ----------
function summaryScreen(R, opened = []) {
  const { start, k, D, sum, cleared } = R;
  const won = cleared.length > 0;
  const route = R.stage ? `${esc(start.name)} <i class="rs-arrow">›</i> ${esc(R.reached.name)}` : esc(start.name);
  // victoire de l'expédition : bloc du giga boss (durée du combat, record, Giga coffre, sans toucher le double rayon)
  const G = DATA.GIGA, T = sum.track || {}, st = save.stats;
  const gigaBlock = R.final ? `<div class="giga-res"><span class="gr-img">${gigaImg(true)}</span><span class="gr-t"><small>Giga boss vaincu · niveau ${R.stage + 1}</small><b>${esc(G.name)}</b>
      <span>${esc(G.title)}${T.gigaFight ? ` · combat <b>${fmtTime(T.gigaFight)}</b>` : ''}</span>
      <span class="gr-chips"><em>Giga coffre</em>${R.gigaRec ? `<em class="rec">Record ${fmtTime(st.gigaBest)}</em>` : st.gigaBest ? `<em>Record ${fmtTime(st.gigaBest)}</em>` : ''}${T.gigaDance ? '<em class="rec">Sans toucher le rayon</em>' : ''}<em>Victoire n° ${fmt(st.gigaKills || 1)}</em></span></span></div>` : '';
  const A = lootAgg(opened), nParts = A.parts.reduce((n, p) => n + p.n, 0), nBoosts = Object.values(A.boosts).reduce((n, v) => n + v, 0);
  const pending = save.pendingChests.length;
  const chestLine = opened.length
    ? `<div class="rw loot-sum">${iconImg('chest', 22)}<span><b>${opened.length} coffre${opened.length > 1 ? 's' : ''} ouvert${opened.length > 1 ? 's' : ''}</b>
        <span class="ls-chips">${nParts ? `<span>${iconImg('hammer', 14)} ${nParts} pièce${nParts > 1 ? 's' : ''}</span>` : ''}${nBoosts ? `<span>${iconImg('potion', 14)} ${nBoosts} bonus</span>` : ''}${A.items.length ? `<span>${iconImg('sword', 14)} ${A.items.length} objet${A.items.length > 1 ? 's' : ''}</span>` : ''}${A.upgs.length ? `<span>${iconImg('upg', 14)} ${A.upgs.length} amélioration${A.upgs.length > 1 ? 's' : ''} gratuite${A.upgs.length > 1 ? 's' : ''}</span>` : ''}<span class="gold-t">${iconImg('gold', 14)} +${fmt(A.gold)}</span></span></span></div>`
    : '';
  const pendLine = pending ? `<div class="rw">${iconImg('chest', 22)}<span><b>${pending} coffre${pending > 1 ? 's' : ''}</b> à ouvrir plus tard depuis l'accueil (bouton <b>Coffres</b>).</span></div>` : '';
  const heatLine = R.heat ? `<div class="rw heat-line">${iconImg('i_burn', 22)}<span>Totems de défi ×${R.heat} : <b>+${fmt(R.heatGold)} or</b><small>+${Math.round(HEAT_GOLD * 100)} % d'or par totem activé</small></span></div>` : '';
  // progression : les 6 mondes (vaincus, vaincus pendant cette expédition, débloqué, verrouillés) et leurs niveaux battus
  const prog = `<div class="w-prog">${ZONES.map((z, i) => {
    const now = cleared.includes(i), done = save.zoneCleared[i], open = i <= save.unlockedZone, n = save.diffCleared[i] || 0;
    return `<span class="wp ${done ? 'done' : open ? 'open' : 'locked'} ${now ? 'now' : ''} ${R.newZone === i ? 'new' : ''}" title="${esc(z.name)}">
      ${R.newZone === i ? '<em>Nouveau</em>' : now ? '<em>Vaincu</em>' : ''}<b>${String(i + 1).padStart(2, '0')}</b>
      <i class="wp-st">${DIFFICULTIES.map((d, j) => `<i class="${j < n ? 'on' : ''}" style="--dc:${d.color}"></i>`).join('')}</i></span>`;
  }).join('')}</div>`;
  const nDone = save.zoneCleared.filter(Boolean).length;
  const worldCards = R.worlds.map((w, i) => `<div class="world-res" style="--d:${(0.15 + i * 0.12).toFixed(2)}s">
      <div class="wr-head" style="background-image:url(${zoneBannerURL(w.z)})">
        <span class="wr-boss">${w.giga ? gigaImg(true) : bossImg(w.z)}</span>
        <span class="wr-t"><small>Niveau ${w.n} <span class="wr-lv">· Monde ${w.z.id + 1}</span></small><b>${esc(w.z.name)}</b></span>
        <span class="wr-ok">${iconImg('check', 12)} ${w.giga ? 'Giga boss vaincu' : 'Boss vaincu'}</span>
      </div>
      <div class="wr-lines">${w.lines.map(l => `<div class="rw">${l.replace(/^(<img[^>]*>)\s*([\s\S]*)$/, '$1<span>$2</span>')}</div>`).join('')}</div>
    </div>`).join('');
  const S = R.story, X = R.special;
  const title = S ? (S.ok ? (S.last ? 'Fin de l\'histoire' : 'Chapitre terminé') : 'Défaite')
    : X ? (X.kind === 'weekly' ? (X.ok ? 'Défi réussi\u00a0!' : 'Défi raté') : X.record ? 'Nouveau record\u00a0!' : 'Mode infini')
    : R.final ? 'Victoire de l\'expédition' : sum.win ? 'Victoire' : won ? 'Expédition terminée' : 'Défaite';
  const eyebrow = S ? `Histoire · chapitre ${S.n + 1}/${storyLen}` : X ? `${esc(X.label)} · ${esc(start.name)}` : R.final ? `${esc(G.name)} est tombé` : won ? `${cleared.length} monde${cleared.length > 1 ? 's' : ''} vaincu${cleared.length > 1 ? 's' : ''} · niveau ${R.stage + 1}/${DATA.EXPE_LEVELS}` : 'Fin de partie';
  // bouton principal : nouveau monde débloqué, niveau supérieur, ou rejouer
  const nextZ = R.newZone ?? start.id, nextK = R.newZone != null ? 0 : R.unlocked ?? k;
  const nextLabel = R.newZone != null ? `Partir : ${esc(ZONES[R.newZone].name)}` : R.unlocked ? `Tenter ${esc(DIFFICULTIES[R.unlocked].name)}` : 'Rejouer';
  // bilan court : l'essentiel d'abord (titre, 4 chiffres, récompenses en pastilles, boutons), le détail se déplie
  const nItems = R.found.length, nAch = R.got?.length || 0, xpPass = R.pass?.xp || 0;
  const chip = (ic, txt, cls = '') => `<span class="rs-chip ${cls}">${iconImg(ic, 16)}${txt}</span>`;
  const chips = [
    chip('gold', `<b>+${fmt(R.gold)}</b> or`, 'gold'),
    opened.length ? chip('chest', `<b>${opened.length}</b> coffre${opened.length > 1 ? 's' : ''}`) : pending ? chip('chest', `<b>${pending}</b> à ouvrir`) : '',
    nItems ? chip('sword', `<b>${nItems}</b> objet${nItems > 1 ? 's' : ''}`) : '',
    xpPass ? chip('flag', `<b>+${fmt(xpPass)}</b> XP de pass`) : '',
    R.newZone != null ? chip('star', `Nouveau monde : <b>${esc(ZONES[R.newZone].name)}</b>`, 'new') : '',
    R.unlocked ? chip(DIFFICULTIES[R.unlocked].icon, `<b>${esc(DIFFICULTIES[R.unlocked].name)}</b> débloqué`, 'new') : '',
    nAch ? chip('crown', `<b>${nAch}</b> succès`, 'new') : '',
  ].filter(Boolean).join('');
  mount(`<div class="reward-screen rs-short ${won ? 'complete' : 'lost'}${R.final ? ' giga' : ''}">
    <span class="eyebrow rs-eyebrow">${eyebrow}</span>
    <h2 class="rs-title">${title}</h2>
    <p class="rs-zone">${route} <span class="diff-tag d${k}${D.abyss ? ' ab' : ''}">${esc(D.name)}</span></p>
    ${storyBlock(S)}
    ${specialBlock(X)}
    ${gigaBlock}
    <div class="run-stats">
      <div><b>${fmtTime(sum.time)}</b><small>Durée</small></div>
      <div><b class="cu" data-n="${sum.kills}">${fmt(sum.kills)}</b><small>Monstres</small></div>
      <div class="${R.record ? 'rec' : ''}"><b>${sum.level}</b><small>${R.record ? 'Record' : 'Niveau'}</small></div>
      <div><b class="gold-t cu" data-n="${R.gold}">${fmt(R.gold)}</b><small>Or gagné</small></div>
    </div>
    <div class="rs-chips">${chips}</div>
    ${!won ? `<p class="tip">${tipFor(sum, k)}</p>` : ''}
    <div class="end-btns rs-btns">
      <button class="btn ghost" data-act="home">${iconImg('home', 16)} Accueil</button>
      <button class="btn primary" data-act="${X ? 'special' : S && !S.last ? 'chapter' : S?.last && S.ok ? 'home' : 'again'}">${X ? 'Rejouer' : S ? (S.ok ? (S.last ? `${iconImg('home', 16)} Accueil` : 'Chapitre suivant') : 'Réessayer') : nextLabel}</button>
    </div>
    <details class="rs-more"><summary>Voir le détail de la partie</summary>
    ${runPassBlock(R.pass)}
    ${worldCards ? `<h3 class="section-t">Mondes vaincus <small>${cleared.length}</small></h3><div class="worlds-res">${worldCards}</div>` : ''}
    ${heatLine || chestLine || pendLine ? `<div class="summary">${heatLine}${chestLine}${pendLine}</div>` : ''}
    ${l2Results(R.l2)}
    <h3 class="section-t">Progression <small>${nDone}/${ZONES.length} mondes</small></h3>
    ${prog}
    ${R.found.length ? `<h3 class="section-t">Objets trouvés <small>${R.found.length}</small></h3><div class="inv-grid found">${R.found.map(it => itemTile(it, { act: false })).join('')}</div>` : ''}
    ${R.got?.length ? `<h3 class="section-t">Succès débloqués <small>+${fmt(R.got.reduce((n, a) => n + a.gold, 0))} or</small></h3>
      <div class="ach-got">${R.got.map((a, i) => `<span style="--d:${(0.3 + i * 0.08).toFixed(2)}s">${iconImg('crown', 22)}<b>${esc(a.name)}</b><em>${iconImg('gold', 14)} ${a.gold}</em></span>`).join('')}</div>` : ''}
    <h3 class="section-t">Build <small>${sum.evo ? esc(EVOLUTIONS[save.cls][sum.evo].name) : `niveau ${sum.level}`}</small></h3>
    <div class="build">${sum.weapons.map(w => `<span class="b-w r${w.r || 0} ${w.evo ? 'evo' : ''}">${iconImg(w.evo ? DATA.WEAPON_EVOS?.[w.id]?.icon || WEAPONS[w.id].icon : WEAPONS[w.id].icon, 22)}<b>${w.evo ? '★' : w.lv}</b></span>`).join('')}${Object.entries(sum.tomes).map(([id, lv]) => `<span class="b-t">${iconImg(TOMES[id].icon, 18)}<b>${lv}</b></span>`).join('')}</div>
    </details>
  </div>`);
  $$('.reward-screen .cu').forEach(el => countUp(el, +el.dataset.n || 0, 900));
  for (const it of R.found) delete it._eq;
  if (R.got?.length) sfx('loot');
  R.got = [];
  bind($('.reward-screen'), {
    home: () => home('adventure'),
    season: () => seasonScreen(() => home('adventure')),
    chapter: () => playChapter(S.ok ? S.next ?? S.n : S.n),
    special: () => playSpecial(X.kind),
    again: () => {
      if (S) return playChapter(S.n);
      save.diffSel[nextZ] = Math.min(nextK, maxDiff(nextZ));
      persist({ touch: false });
      home('adventure');
      zoneSheet(nextZ);
    },
  });
}

function tipFor(sum, k = 0) {
  if (canAffordUpgrade()) return 'Astuce : vous avez assez d\'or pour une amélioration permanente dans la Boutique !';
  if (k > 0 && Math.random() < 0.5) return 'Astuce : ce niveau est exigeant. Rejouez en Normal pour améliorer votre équipement.';
  if (sum.time < 60) return 'Astuce : restez en mouvement et tournez autour des monstres plutôt que de foncer dedans.';
  if (Math.random() < 0.4) return 'Astuce : quand un monstre clignote, il va charger. Écartez-vous de sa trajectoire !';
  return 'Astuce : prenez des tomes de PV et d\'armure si vous mourez souvent, et équipez vos meilleurs objets.';
}

export function announceAchievements() {
  // nouveaux familiers (défi de la semaine, mode infini, coffres, Abysse, histoire, giga boss)
  const pets = checkPets();
  if (pets.length) {
    const P = PETS[pets[0]];
    toast(`<img class="px spr" src="${creatureURL('pet-' + pets[0], P.body, P.pal)}" width="26" height="26" alt=""> Nouveau familier : <b>${esc(pets.map(id => PETS[id].name).join(', '))}</b> · à choisir dans Héros`, 4200);
    sfx('win');
  }
  const got = checkAchievements();
  if (!got.length) return persist();
  const gold = fmt(got.reduce((n, a) => n + a.gold, 0)), ti = got.find(a => a.title && DATA.TITLES?.[a.title]);
  // un seul message, même pour plusieurs succès d'un coup (avant : une pile de messages qui cachait l'écran)
  toast(got.length === 1
    ? `${iconImg('crown', 18)} Succès : <b>${esc(got[0].name)}</b> (+${gold} or)${ti ? ` · titre « ${esc(DATA.TITLES[ti.title].name)} »` : ''}`
    : `${iconImg('crown', 18)} <b>${got.length} succès</b> : ${got.slice(0, 2).map(a => esc(a.name)).join(', ')}${got.length > 2 ? '…' : ''} (+${gold} or)${ti ? ' · nouveau titre' : ''}`, got.length > 1 ? 3600 : 3000);
  sfx('loot');
  persist();
}

// ---------- Équipement ----------
// nom d'un objet avec son niveau d'amélioration (+N)
const itemName = it => `${esc(it.name)}${it.lv ? ` <em class="lvp">+${it.lv}</em>` : ''}`;
const SLOT_IC = { weapon: 'sword', armor: 'armor', trinket: 'gem' };

// carte d'objet (sac, emplacements, bilan) : rareté, caractéristique principale, icônes des bonus.
// cur = objet équipé au même emplacement (flèche ▲ si celui-ci est meilleur)
function itemTile(it, { act = true, cur, isNew = false } = {}) {
  const ks = statKeys(it), m = ks[0], tag = act ? 'button' : 'div';
  const better = cur !== undefined && cur !== it && (!cur || itemPower(it) > itemPower(cur));
  const eq = save.equipped[it.slot] === it.id;
  return `<${tag} class="itile r-${it.rarity} ${eq ? 'is-eq' : ''}" ${act ? `data-act="item" data-id="${it.id}"` : ''}>
    ${isNew ? '<i class="it-new">Nouveau</i>' : better ? '<i class="it-better">Mieux</i>' : ''}
    <span class="it-rar">${RARITY[it.rarity].name}</span>
    <span class="it-ic">${itemArt(it, 64)}${it.lv ? `<em class="lv-badge">+${it.lv}</em>` : ''}${it.crafted ? `<i class="it-forged">${iconImg('hammer', 12)}</i>` : ''}</span>
    <b class="it-name">${esc(it.name)}</b>
    ${m ? `<span class="it-main">${affShort(m, it.stat[m])}</span>` : ''}
    <span class="it-aff">${ks.slice(1).map(k => iconImg(AFX[k]?.[0] || 'star', 14)).join('')}${it.myth ? '<i class="it-fx myth">✦</i>' : it.effect ? '<i class="it-fx">★</i>' : ''}</span>
  </${tag}>`;
}

// familier pas encore obtenu : comment l'avoir (boss d'un monde, ou objectif avec la progression)
function petLock(p) {
  if (!p.unlock) return `Terminez « ${esc(ZONES[p.zone].name)} »`;
  const U = p.unlock; let v = 0; try { v = U.prog(save); } catch (e) { /* sauvegarde incomplète */ }
  const f = U.time ? fmtTime : fmt;
  return `${esc(U.txt)} <i class="pet-prog">${f(Math.min(v, U.n))} / ${f(U.n)}</i>`;
}
function gearTab() {
  const eqIds = Object.values(save.equipped);
  const fresh = new Set(save.inventory.filter(i => i.isNew).map(i => i.id));
  const slots = Object.entries(SLOTS).map(([k, label]) => {
    const it = save.inventory.find(i => i.id === save.equipped[k]);
    return `<div class="eq-slot"><span class="eq-l">${label}</span>${it ? itemTile(it, { isNew: fresh.has(it.id) })
      : `<div class="itile empty">${iconImg(SLOT_IC[k], 34)}<small>Vide</small></div>`}</div>`;
  }).join('');
  const list = save.inventory
    .filter(i => !eqIds.includes(i.id))
    .filter(i => gearFilter === 'all' || i.slot === gearFilter)
    .sort((a, b) => itemPower(b) - itemPower(a));
  const pets = Object.entries(PETS).map(([id, p]) => {
    const owned = save.pets.includes(id);
    // verrouillé : panneau plat et inactif (rien à toucher)
    return `<button class="pet-card ${owned ? '' : 'locked'} ${save.pet === id ? 'on' : ''}" ${owned ? `data-act="pet" data-id="${id}"` : 'disabled'}>
      ${owned ? `<img class="px spr" src="${creatureURL('pet-' + id, p.body, p.pal)}" alt="">` : iconImg('lock', 24)}
      <b>${owned ? esc(p.name) : '???'}</b>
      <small>${owned ? esc(p.desc) : petLock(p)}</small>
      ${save.pet === id ? '<em>Actif</em>' : ''}
    </button>`;
  }).join('');
  const boosts = Object.keys(BOOSTS).filter(id => save.boosts[id] > 0);
  const nB = boosts.reduce((n, id) => n + save.boosts[id], 0);
  for (const i of save.inventory) delete i.isNew;
  persist({ touch: false });
  return `${heroCard()}
    <h3 class="section-t">Équipé</h3>
    ${tapHint('Touchez un objet pour le voir, l\'améliorer ou en changer')}
    <div class="slots">${slots}</div>
    <h3 class="section-t">Sac <small>${list.length} objet${list.length > 1 ? 's' : ''}</small></h3>
    <div class="filters">${[['all', 'Tout'], ...Object.entries(SLOTS)].map(([k, l]) => `<button class="chip-btn ${gearFilter === k ? 'on' : ''}" data-act="filter" data-f="${k}">${l}</button>`).join('')}
      ${list.some(i => i.rarity === 'common' && !i.lv) ? '<button class="chip-btn sell" data-act="sellJunk">Trier les communs</button>' : ''}</div>
    ${list.length ? `<div class="inv-grid">${list.map(it => itemTile(it, { cur: save.inventory.find(i => i.id === save.equipped[it.slot]) || null, isNew: fresh.has(it.id) })).join('')}</div>`
    : '<p class="muted center empty-note">Ouvrez des coffres de butin et battez des boss pour trouver de l\'équipement.</p>'}
    <h3 class="section-t">Familier <small>${save.pets.length}/${Object.keys(PETS).length}</small></h3>
    ${save.pets.length ? tapHint('Touchez un familier pour l\'emmener (ou le laisser)') : ''}
    <div class="pets">${pets}</div>
    <h3 class="section-t">Bonus <small>${nB} en stock</small></h3>
    ${boosts.length ? `<div class="boost-inv">${boosts.map(id => `<div class="bi-chip">${iconImg(BOOSTS[id].icon, 28)}<span><b>${esc(BOOSTS[id].name)}</b><small>${esc(BOOSTS[id].desc)}</small></span><em>×${save.boosts[id]}</em></div>`).join('')}</div>
      <p class="muted bi-note">Choisissez-les dans la fiche d'un monde (bouton <b>Monde</b> de l'accueil) : ils servent ensuite à chaque partie lancée avec <b>Jouer</b>, tant qu'il vous en reste.</p>`
    : `<p class="muted bi-note">Aucun bonus. Trouvez-en dans les <b>coffres de butin</b> ou achetez-en à la <b>Boutique</b>.</p>`}`;
}

// fiche d'un objet : caractéristiques (comparées à l'objet équipé), améliorer (+N) et recycler en pièces
function itemBody(it, equipped, cur) {
  const r = RARITY[it.rarity], lv = it.lv || 0, c = itemUpgradeCost(it);
  const pips = Array.from({ length: FORGE.upgrade.max }, (_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('');
  const cmp = !equipped && cur ? cur : null;
  let up;
  if (c) {
    const have = save.parts[c.slot][c.r], next = statsAt(it.base || it.stat, c.lv);
    up = `<div class="it-up">
      <div class="iu-h">${iconImg('upg', 20)}<b>Améliorer</b><span class="iu-lv">+${lv} <i>›</i> <b>+${c.lv}</b></span></div>
      <div class="iu-prev">${statRows(it, { next })}</div>
      <div class="iu-row">
        <span class="iu-cost ${have >= c.parts ? '' : 'bad'}">${partIcon(c.slot, c.r, 16)} ${have}/${c.parts}</span>
        <span class="iu-cost ${save.gold >= c.gold ? '' : 'bad'}">${iconImg('gold', 16)} ${fmt(c.gold)}</span>
        <button class="btn green small" data-v="up" ${canUpgrade(it) ? '' : 'disabled'}>${iconImg('hammer', 16)} Améliorer</button>
      </div>
      ${have < c.parts ? `<small class="iu-hint">Il faut des ${esc(PARTS[c.slot].plural.toLowerCase())} (${r.name.toLowerCase()}) : ouvrez des coffres de butin ou recyclez des objets.</small>` : ''}
    </div>`;
  } else up = `<div class="it-up max">${iconImg('crown', 20)} <b>Amélioration maximale atteinte</b></div>`;
  return `<div class="is-card r-${it.rarity}">
      <span class="is-ic">${itemArt(it, 96)}${lv ? `<em class="lv-badge">+${lv}</em>` : ''}</span>
      <div class="is-head"><span class="rc-rar">${r.name}</span><span class="is-slot">${SLOTS[it.slot]}${it.crafted ? ' · <span class="forged-t">Forgé +10 %</span>' : ''}${equipped ? ' · <span class="eq-t">Équipé</span>' : ''}</span>
        <div class="lv-pips" aria-label="Niveau ${lv}">${pips}</div></div>
      <span class="is-pow"><small>Puissance</small><b>${fmt(itemPower(it))}</b>${cmp ? (() => { const d = Math.round(itemPower(it) - itemPower(cmp)); return d ? `<i class="sr-d ${d > 0 ? 'up' : 'down'}">${d > 0 ? '▲ +' : '▼ −'}${fmt(Math.abs(d))}</i>` : ''; })() : ''}</span>
    </div>
    ${cmp ? (() => { const d = Math.round(itemPower(it) - itemPower(cmp)); return `<p class="is-verdict ${d > 0 ? 'up' : d < 0 ? 'down' : ''}">${d > 0 ? '▲ Meilleur' : d < 0 ? '▼ Moins bon' : '= Équivalent'} que <b>${itemName(cmp)}</b> (équipé)</p>`; })() : ''}
    <div class="is-stats">${statRows(it, { cmp })}</div>
    ${itemFx(it)}
    ${up}
    ${it.myth ? '<p class="muted myth-note">✦ Objet mythique unique : il ne se vend pas et ne se recycle pas.</p>'
    : equipped ? '' : `<button class="btn small ghost it-salv" data-v="salvage">${iconImg('spin', 16)} Recycler : +${salvageValue(it)} ${esc(PARTS[it.slot].plural.toLowerCase())}</button>`}`;
}

export async function itemSheet(id) {
  const it = save.inventory.find(i => i.id === id);
  if (!it) return;
  const equipped = save.equipped[it.slot] === id;
  const cur = save.inventory.find(i => i.id === save.equipped[it.slot]);
  const wid = 'it-' + Date.now();
  let action = null, changed = false;
  const p = modal({
    title: `<span class="it-title r-${it.rarity}">${itemName(it)}</span>`,
    cls: 'item-modal',
    body: `<div id="${wid}" class="it-sheet">${itemBody(it, equipped, cur)}</div>`,
    buttons: equipped
      ? [{ label: 'Fermer', cls: 'primary', value: null }]
      : it.myth ? [{ label: 'Fermer', cls: 'ghost', value: null }, { label: 'Équiper', cls: 'primary', value: 'equip' }]
      : [{ label: `Vendre ${iconImg('gold', 16)} ${sellValue(it)}`, cls: 'ghost', value: 'sell' }, { label: 'Équiper', cls: 'primary', value: 'equip' }],
    dismissable: true,
  });
  const box = document.getElementById(wid), wrap = box.closest('.modal-wrap');
  box.addEventListener('click', e => {
    const b = e.target.closest('[data-v]');
    if (!b || b.disabled) return;
    if (b.dataset.v === 'up') {
      if (!upgradeItem(id)) return;
      changed = true;
      sfx('forge'); buzz(30);
      box.innerHTML = itemBody(it, equipped, cur);
      wrap.querySelector('.it-title').innerHTML = itemName(it);
      const sell = wrap.querySelector('.modal-btns .btn.ghost');
      if (sell) sell.innerHTML = `Vendre ${iconImg('gold', 16)} ${sellValue(it)}`;
      box.querySelector('.is-ic').classList.add('bang');
      box.querySelector('.is-stats').classList.add('bang');
      refreshTopbar();
      announceAchievements();
      return;
    }
    if (b.dataset.v === 'salvage') { sfx('tap'); action = 'salvage'; wrap.click(); }
  });
  const v = await p;
  const r = RARITY[it.rarity];
  if (v === 'equip') return equipItem(id);
  if (v === 'sell') {
    save.gold += sellValue(it);
    save.inventory = save.inventory.filter(i => i.id !== id);
    persist(); sfx('coin'); return home();
  }
  if (action === 'salvage') {
    const n = salvageValue(it), ri = rarityIdx(it);
    if (ri >= 2 || it.lv || it.crafted) {
      const ok = await modal({ title: 'Recycler ?', body: `<p><b class="r-${it.rarity} rtxt">${itemName(it)}</b> sera détruit et donnera <b>${n} ${esc(PARTS[it.slot].plural.toLowerCase())}</b> (${r.name.toLowerCase()}).</p>`, buttons: [{ label: 'Annuler', cls: 'ghost', value: false }, { label: 'Recycler', cls: 'danger', value: true }] });
      if (!ok) return home();
    }
    if (salvageItem(id)) {
      sfx('forge');
      toast(`${partIcon(it.slot, ri, 16)} +${n} ${esc(PARTS[it.slot].plural.toLowerCase())} (${r.name.toLowerCase()})`);
    }
    return home();
  }
  if (changed) home();
}

function equipItem(id) {
  const it = save.inventory.find(i => i.id === id);
  if (!it) return;
  save.equipped[it.slot] = id;
  persist();
  sfx('loot');
  toast(`${itemArt(it, 28)} ${esc(it.name)} équipé`);
  home();
}

async function sellJunk() {
  const eq = Object.values(save.equipped);
  const junk = save.inventory.filter(i => i.rarity === 'common' && !eq.includes(i.id) && !i.lv);
  const total = junk.reduce((n, i) => n + sellValue(i), 0), parts = junk.reduce((n, i) => n + salvageValue(i), 0);
  const v = await modal({ title: 'Objets communs', body: `<p><b>${junk.length} objet${junk.length > 1 ? 's' : ''}</b> commun${junk.length > 1 ? 's' : ''} dans le sac (les objets améliorés sont gardés).</p>
      <div class="rw">${iconImg('gold', 22)}<span>Vendre : <b class="gold-t">+${fmt(total)} or</b></span></div>
      <div class="rw">${iconImg('hammer', 22)}<span>Recycler : <b>+${parts} pièces</b> communes pour la Forge</span></div>`,
    buttons: [{ label: 'Annuler', cls: 'ghost', value: null }, { label: 'Recycler', cls: 'green', value: 'salvage' }, { label: 'Vendre', cls: 'primary', value: 'sell' }] });
  if (!v) return;
  if (v === 'salvage') { for (const it of junk) salvageItem(it.id); sfx('forge'); toast(`${iconImg('hammer', 16)} <b>+${parts}</b> pièces communes`); }
  else { save.inventory = save.inventory.filter(i => !junk.includes(i)); save.gold += total; sfx('coin'); }
  persist(); announceAchievements(); home();
}

// ---------- Boutique ----------
function shopTab() {
  return `<h3 class="section-t first">Améliorations permanentes</h3>
    <p class="muted shop-intro">Elles valent pour tous les champions. Celles marquées <b>∞</b> s'améliorent à l'infini.</p>
    <div class="upgrades">${Object.entries(UPGRADES).map(([k, u]) => {
      const lvl = save.upgrades[k], max = lvl >= DATA.upgMax(k), cost = upgradeCost(k);
      // améliorations infinies : la barre montre les niveaux jusqu'au max d'origine, puis « ∞ »
      return `<div class="upgrade ${u.inf ? 'inf' : ''}">
        ${iconImg(u.icon, 36)}
        <div class="u-txt"><b>${u.name}</b><small>${u.desc}</small>
          <div class="lvl"><span>Niv. ${lvl}${u.inf ? ' <i class="inf-tag" title="Amélioration à l\'infini">∞</i>' : `/${u.max}`}</span>${u.max <= 12 ? `<div class="seg-bar">${Array.from({ length: u.max }, (_, k) => `<i class="${k < lvl ? 'on' : ''}"></i>`).join('')}</div>` : `<div class="lbar"><i style="width:${Math.min(100, lvl / u.max * 100)}%"></i></div>`}</div></div>
        <button class="btn ${max ? 'ghost' : 'buy'} small" data-act="buy" data-k="${k}" ${max || save.gold < cost ? 'disabled' : ''}>
          ${max ? 'Max' : `${iconImg('gold', 14)} ${fmt(cost)}`}
        </button>
      </div>`;
    }).join('')}</div>
    <h3 class="section-t">Bonus <small>pour une seule partie</small></h3>
    <p class="muted shop-intro">Choisissez-en jusqu'à ${BOOST_SLOTS} dans la fiche d'un monde (bouton <b>Monde</b> de l'accueil) avant de partir.</p>
    <div class="upgrades boost-shop">${Object.entries(BOOSTS).map(([id, b]) => isFree('boost', id) ? `<div class="upgrade boost-card">
        <span class="bo-ic">${iconImg(b.icon, 32)}${save.boosts[id] ? `<i class="bo-n">×${save.boosts[id]}</i>` : ''}</span>
        <div class="u-txt"><b>${esc(b.name)}</b><small>${esc(b.desc)}</small></div>
        <button class="btn buy small" data-act="buyBoost" data-id="${id}" ${save.gold < b.price ? 'disabled' : ''}>${iconImg('gold', 14)} ${fmt(b.price)}</button>
      </div>` : `<div class="upgrade boost-card locked" data-act="defis">
        <span class="bo-ic">${iconImg(b.icon, 32)}${save.boosts[id] ? `<i class="bo-n">×${save.boosts[id]}</i>` : ''}</span>
        <div class="u-txt"><b>${esc(b.name)}</b><small>${esc(b.desc)}</small><small class="lk-l">${iconImg('lock', 12)} ${esc(lockLine('boost:' + id))}</small></div>
        <span class="lk-go">Défi<i>›</i></span>
      </div>`).join('')}</div>`;
}

function doBuyBoost(id) {
  if (!isFree('boost', id) || !buyBoost(id)) return; // L2 : bonus à débloquer
  sfx('coin');
  toast(`${iconImg(BOOSTS[id].icon, 16)} ${esc(BOOSTS[id].name)} ×${save.boosts[id]}`);
  home();
}

function buyUpgrade(k) {
  const cost = upgradeCost(k);
  if (save.gold < cost || save.upgrades[k] >= DATA.upgMax(k)) return;
  save.gold -= cost;
  save.upgrades[k]++;
  persist();
  sfx('coin');
  toast(`${iconImg(UPGRADES[k].icon, 16)} ${UPGRADES[k].name} niveau ${save.upgrades[k]}`);
  home();
}

// ---------- Succès ----------
function trophiesTab() {
  const st = save.stats;
  const seen = Object.keys(st.seen).length;
  return `<div class="cs-bar tr-bar"><button class="icon-btn" data-act="tab" data-tab="adventure" aria-label="Retour">${iconImg('back', 20)}</button><h2 class="cs-title">Succès</h2></div>
    <div class="stat-grid">
      <div><b>${fmt(st.wins)}</b><small>Boss vaincus</small></div>
      <div><b>${seen}/${MONSTER_COUNT + BOSS_COUNT}</b><small>Bestiaire</small></div>
      <div><b>${fmt(st.kills || 0)}</b><small>Monstres vaincus</small></div>
      <div><b>${fmt(st.ults)}</b><small>Ultimes</small></div>
      <div><b>${fmt(st.gigaKills || 0)}</b><small>Giga boss</small></div>
      <div><b>${fmt(st.totems || 0)}</b><small>Totems</small></div>
      <div><b>${fmt(st.chests || 0)}</b><small>Coffres ouverts</small></div>
      <div><b>${fmt(st.crafted || 0)}</b><small>Objets forgés</small></div>
    </div>
    ${achBlock()}
    <h3 class="section-t">Bestiaire</h3>
    <div class="bestiary">${ZONES.map(z => zoneSteps(z).map((m, k) => {
      const known = st.seen[m.name];
      return `<div class="beast ${known ? '' : 'unknown'} ${m.boss ? 'boss' : ''}"><img class="px spr" src="${creatureURL(`${z.id}-${k}-${m.name}`, m.body, m.pal, { boss: m.boss })}" alt=""><small>${known ? esc(m.name) : '???'}</small></div>`;
    }).join('')).join('')}</div>`;
}

// rafraîchit l'écran quand la sauvegarde arrive du cloud
export function onRemoteSave() {
  if (battle) return;
  if (!save.cls) return classSelect(true);
  home();
  toast('Progression récupérée depuis votre compte');
}
