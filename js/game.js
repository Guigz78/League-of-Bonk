// Écrans du jeu et déroulé d'une expédition.
import { CLASSES, WEAPONS, TOMES, ULTS, ZONE_TIME, EVOLUTIONS, BOONS, ZONES, PETS, PET_BY_ZONE, SLOTS, RARITY, BOSS_ITEMS, UPGRADES, ACHIEVEMENTS, MONSTER_COUNT, BOSS_COUNT, DIFFICULTIES, ELITE_MODS,
  LOOT_TIERS, RARITIES, PARTS, FORGE, BOOSTS, BOOST_SLOTS, HEAT_GOLD, AFFIXES, LEGEND_EFFECTS } from './data.js';
import * as DATA from './data.js';
import { save, persist, playerStats, upgradeCost, makeItem, makeBossItem, addItem, itemPower, sellValue, checkAchievements, resetSave, maxDiff,
  openChest, canCraft, craftItem, canFuse, fuseParts, itemUpgradeCost, canUpgrade, upgradeItem, statsAt, salvageValue, salvageItem,
  buyBoost, cleanBoostSel, consumeBoosts, rarityIdx } from './save.js';
import { iconImg, chestURL, anvilURL, hammerURL } from './art.js';
import { heroURL, creatureURL, mountPreview, zoneBannerURL, supported } from './visuals.js';
import { rng } from './pixel.js';
import { sfx, music, stopMusic } from './audio.js';
import { app, mount, $, $$, bind, modal, toast, fmt, pct, esc, wait, countUp } from './ui.js';
import { Run, LS } from './run.js';
import { showRewardedAd } from './ads.js';
import { cloud } from './cloud.js';
import { questList, claimQuest, loginState, claimLogin, dailyBadge, LOGIN_REWARDS, ensureDaily } from './daily.js';
// L2 : défis de déblocage, maîtrise des champions, Abysse
import { l2Home, endRunL2, l2Results, defisScreen, defisTile, clsLocked, clsLockPanel, auraPicker, pickAura, isFree, lockLine } from './unlocks.js';
import { masteryPanel, masteryChip, masteryLv } from './mastery.js';
import { runDiff, abyssTop, abyssBlock, abyssInfo, abyssRewards, abyssBadge, abyssPause } from './abyss.js';

const APP_VERSION = 'v20'; // affichée dans les options (même numéro que le cache hors ligne de sw.js)
let tab = 'adventure';
let battle = null;
let gearFilter = 'all';
let loginShown = '';

// ---------- Démarrage ----------
export function boot() {
  cloud.onChange(() => { if (!battle) refreshTopbar(); });
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
  setTimeout(() => { if (!battle && $('.hub') && !$('.modal-wrap')) loginSheet(); }, 450);
}

// ---------- Barre du haut ----------
const partsTotal = () => Object.values(save.parts).reduce((n, a) => n + a.reduce((x, y) => x + y, 0), 0);
function topbar() {
  const u = cloud.user;
  const st = cloud.status;
  const dot = !u ? '' : `<i class="sync ${st}"></i>`;
  return `<header class="topbar">
    <div class="tb-brand">League<span>of Bonk</span></div>
    <span class="cur" aria-label="Pièces de forge">${iconImg('part', 18)}<b id="partsN">${fmt(partsTotal())}</b></span>
    <span class="cur gold" aria-label="Or">${iconImg('gold', 18)}<b id="goldN">${fmt(save.gold)}</b></span>
    <button class="icon-btn account" data-act="settings" aria-label="Compte et options">
      ${u?.avatar ? `<img class="avatar" src="${esc(u.avatar)}" alt="" referrerpolicy="no-referrer">` : iconImg('gear', 22)}${dot}
    </button>
  </header>`;
}

function refreshTopbar() {
  const t = $('.topbar');
  if (t) t.outerHTML = topbar();
  const g = $('#goldN'); if (g) g.textContent = fmt(save.gold);
}

function nav() {
  const items = [
    ['adventure', 'Aventure', 'map'],
    ['gear', 'Équipement', 'armor'],
    ['forge', 'Forge', 'hammer'],
    ['shop', 'Boutique', 'bag'],
    ['trophies', 'Succès', 'trophy'],
  ];
  const nAdv = save.pendingChests.length + dailyBadge();
  const badge = { gear: save.inventory.some(i => i.isNew), trophies: false, shop: canAffordUpgrade(), forge: canForgeSomething() };
  return `<nav class="tabs">${items.map(([id, label, ic]) => `
    <button class="tab ${tab === id ? 'on' : ''}" data-act="tab" data-tab="${id}">
      ${iconImg(ic, 22)}<span>${label}</span>${id === 'adventure' && nAdv ? `<i class="badge count">${nAdv}</i>` : badge[id] ? '<i class="badge"></i>' : ''}
    </button>`).join('')}</nav>`;
}

// pastille de la forge : une fabrication est possible
function canForgeSomething() {
  return Object.keys(PARTS).some(k => RARITIES.some((_, r) => canCraft(k, r)));
}

function canAffordUpgrade() {
  return Object.keys(UPGRADES).some(k => save.upgrades[k] < UPGRADES[k].max && save.gold >= upgradeCost(k));
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
  mount(`<div class="hub">${topbar()}<main class="hub-main" id="hubMain">${body}</main>${nav()}</div>`);
  if (keep) $('#hubMain').scrollTop = keep;
  if (moved) $('#hubMain').classList.add('scr-in');
  bind($('.hub'), handlers);
  mountPreview($('.hc-3d'), save.cls);
}

const handlers = {
  tab: el => home(el.dataset.tab),
  settings: () => settings(),
  play: () => zoneSheet(playZone()),
  quests: () => questSheet(),
  login: () => loginSheet(),
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
  forgeSel: el => { forgeSel = { slot: el.dataset.slot, r: +el.dataset.r }; renderForge(); },
  craft: () => doCraft(),
  fuse: el => doFuse(el.dataset.all === '1'),
  buyBoost: el => doBuyBoost(el.dataset.id),
};

// ---------- Caractéristiques (objets et champion) ----------
// icône et libellé court de chaque caractéristique (listes compactes)
const AFX = {
  atk: ['fist', 'ATQ'], hp: ['heart', 'PV'], crit: ['target', 'crit.'], critDmg: ['critdmg', 'dégâts crit.'], lifesteal: ['lifesteal', 'vol de vie'],
  haste: ['haste', 'vit. d\'attaque'], speed: ['arrow', 'vitesse'], area: ['area', 'taille des attaques'], armor: ['shield', 'armure'],
  regen: ['potion', 'PV/s'], thorns: ['thorns', 'épines'], dodge: ['dodge', 'esquive'], xp: ['tome', 'XP'], magnet: ['ring', 'ramassage'],
  gold: ['gold', 'or'], ult: ['nova', 'ultime'],
};
const STAT_ORDER = Object.keys(AFX);
const nf = (v, d = 1) => (Math.round(v * 10 ** d) / 10 ** d).toLocaleString('fr-FR');
// valeur d'un bonus : « +12 », « +2,5 % », « +0,3 PV/s »
function affVal(k, v) {
  const f = AFFIXES[k]?.fmt;
  if (f === 'pct') { const p = v * 100; return `+${p >= 10 ? Math.round(p) : nf(p)} %`; }
  if (f === 'regen') return `+${nf(v / 10)} PV/s`;
  return `+${fmt(v)}`;
}
// « Vol de vie +2 % » ; épines : en % de l'ATQ
const affLine = (k, v) => `${AFFIXES[k]?.name || k} ${affVal(k, v)}${k === 'thorns' ? ' de l\'ATQ' : ''}`;
// version courte : « +12 ATQ », « +2 % vol de vie »
const affShort = (k, v) => (AFFIXES[k]?.fmt === 'regen' ? affVal(k, v) : `${affVal(k, v)} ${AFX[k]?.[1] || k}`);
const statKeys = it => { const ks = Object.keys(it.stat || {}); const m = it.main && ks.includes(it.main) ? it.main : ks[0]; return m ? [m, ...ks.filter(k => k !== m)] : []; };

// lignes de caractéristiques d'un objet (principale en premier), avec l'écart par rapport à cmp (objet équipé)
function statRows(it, { cmp = null, next = null } = {}) {
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
const effectBox = id => (LEGEND_EFFECTS[id] ? `<div class="fx-box"><b>${iconImg('star', 16)} ${esc(LEGEND_EFFECTS[id].name)}</b><small>${esc(LEGEND_EFFECTS[id].desc)}</small></div>` : '');

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
  st.lifesteal = Math.min(LS.max, (st.lifesteal || 0) + LS.base); // + talent de tous les champions (vol de vie de base)
  const shown = STAT_ORDER.filter(k => ['hp', 'atk', 'crit', 'critDmg', 'speed'].includes(k) || (k === 'magnet' || k === 'gold' ? st[k] > 1.0005 : st[k] > 0.0005));
  await modal({
    title: `Statistiques de ${esc(c.name)}`,
    cls: 'stats-modal',
    body: `<div class="hstats">${shown.map(k => `<div class="hs ${capped(k) ? 'cap' : ''}">${iconImg(AFX[k][0], 22)}<span>${esc(k === 'critDmg' ? 'Dégâts des critiques' : k === 'speed' ? 'Vitesse de course' : AFFIXES[k]?.name || k)}</span><b>${heroStat(k, st)}</b>${capped(k) ? '<em>max</em>' : ''}</div>`).join('')}</div>
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

function adventureTab() {
  const c = CLASSES[save.cls], st = playerStats();
  const done = save.zoneCleared.filter(Boolean).length;
  const pz = playZone(), Z = ZONES[pz], D = runDiff(Math.min(save.diffSel?.[pz] || 0, maxDiff(pz)), Math.min(save.abyssSel?.[pz] || 0, abyssTop(pz)));
  // tuiles rapides : quêtes du jour, connexion, coffres en attente
  const qs = questList(), qDone = qs.filter(q => q.prog >= q.n).length, qReady = qs.some(q => q.ready);
  const L = loginState(), pc = save.pendingChests;
  const quick = `<div class="quick">
    <button class="qt ${qReady ? 'hot' : ''}" data-act="quests">${iconImg('quest', 22)}<span class="eyebrow">Quêtes</span><b>${qDone}/${qs.length}</b><span class="pbar"><i style="width:${qDone / qs.length * 100}%"></i></span></button>
    <button class="qt ${L.ready ? 'hot' : ''}" data-act="login">${iconImg('calendar', 22)}<span class="eyebrow">Connexion</span><b>Jour ${L.ready ? L.day + 1 : L.day || 7}/7</b><span class="pbar cy"><i style="width:${(L.ready ? L.day : L.day || 7) / 7 * 100}%"></i></span></button>
    <button class="qt ${pc.length ? 'hot' : 'off'}" data-act="chests" ${pc.length ? '' : 'disabled'}>${iconImg('chest', 22)}<span class="eyebrow">Coffres</span><b>${pc.length ? `${pc.length} à ouvrir` : 'Aucun'}</b><span class="pbar"><i style="width:${pc.length ? 100 : 0}%"></i></span></button>
  </div>`;
  const zones = ZONES.map((z, i) => {
    const locked = i > save.unlockedZone;
    const cleared = save.zoneCleared[i];
    const stars = save.diffCleared[i] || 0;
    const first = i === 0 && !save.stats.runs && !cleared;
    return `<button class="zone ${locked ? 'locked' : ''} ${cleared ? 'cleared' : ''} ${i === pz ? 'cur' : ''}" data-act="zone" data-z="${i}" style="background-image:url(${zoneBannerURL(z)})">
      <div class="z-num">${String(i + 1).padStart(2, '0')}</div>
      <div class="z-txt">${first ? '<em class="start">Commencez ici</em>' : ''}<b>${esc(z.name)}</b><small>${locked ? `Terminez « ${esc(ZONES[i - 1].name)} »` : esc(z.sub)}</small>${zoneStars(stars)}${abyssBadge(i)}</div>
      <div class="z-art">${locked ? iconImg('lock', 22) : `<img class="px spr" src="${bossOf(z)}" alt="">`}</div>
    </button>`;
  }).join('');
  return `<section class="showcase">
      <div class="sc-stage"><canvas class="hc-3d"></canvas>
        ${save.pet ? `<img class="px spr hc-pet" src="${creatureURL('pet-' + save.pet, PETS[save.pet].body, PETS[save.pet].pal)}" alt="">` : ''}</div>
      <div class="sc-info">
        <span class="sc-role">${esc(c.role)}</span>
        <h2 class="sc-name">${esc(c.name)}</h2>
        <button class="sc-stats" data-act="allStats" aria-label="Toutes les statistiques">
          <span><small>PV</small><b>${fmt(st.hp)}</b></span><span><small>ATQ</small><b>${fmt(st.atk)}</b></span>
          <span><small>Critique</small><b>${pct(st.crit)}</b></span><span><small>Vitesse</small><b>${pct(st.speed)}</b></span>
        </button>
        <div class="sc-links"><button class="link" data-act="changeClass">Changer</button><button class="link" data-act="allStats">Détails</button></div>
      </div>
    </section>
    <button class="play-cta" data-act="play">
      <span class="pc-ic">${iconImg('play', 22)}</span>
      <span class="pc-txt"><b>Jouer <i class="pc-dtag" style="--dc:${D.color}">${esc(D.name)}</i></b><small>Monde ${pz + 1} · ${esc(Z.name)}</small></span>
      <img class="px spr pc-boss" src="${bossOf(Z)}" alt="">
    </button>
    ${quick}
    ${defisTile()}
    <h3 class="section-t">Mondes <small>${done}/${ZONES.length}</small></h3>
    <div class="zones">${zones}</div>`;
}

// cases de difficulté battues sous le nom du monde
function zoneStars(n) {
  const label = n >= DIFFICULTIES.length ? 'Zone maîtrisée' : n ? `${DIFFICULTIES[n - 1].name} battu` : 'Pas encore battu';
  return `<div class="z-done z-stars s${n}" aria-label="${esc(label)}">${DIFFICULTIES.map((d, k) =>
    `<i class="zs ${k < n ? 'on' : ''}" style="--dc:${d.color}"></i>`).join('')}</div>`;
}

// ---------- Quêtes du jour et connexion ----------
const chestName = t => LOOT_TIERS[t]?.name || 'Coffre';
async function questSheet() {
  const id = 'qs-' + Date.now();
  const body = () => {
    const qs = questList();
    return `<div class="quests">${qs.map(q => `<div class="quest ${q.claimed ? 'done' : ''} ${q.ready ? 'ready' : ''}">
        ${iconImg(q.icon, 22)}
        <div class="q-txt"><b>${esc(q.text)}</b>
          <div class="q-row"><span class="pbar ${q.prog >= q.n ? 'green' : ''}"><i style="width:${q.prog / q.n * 100}%"></i></span><em>${fmt(q.prog)}/${fmt(q.n)}</em></div>
          <span class="q-rw">${iconImg('chest', 14)} ${esc(chestName(q.tier))} · ${iconImg('gold', 14)} ${q.gold}</span></div>
        ${q.claimed ? `<span class="q-claimed">${iconImg('check', 14)} Reçu</span>` : q.ready ? `<button class="btn primary small" data-q="${q.i}">Réclamer</button>`
          : `<span class="q-chest" aria-hidden="true"><img src="${chestURL(q.tier)}" alt=""></span>`}
      </div>`).join('')}</div>
      <p class="q-reset">Nouvelles quêtes chaque jour à minuit</p>`;
  };
  const p = modal({ title: `${iconImg('quest', 22)} Quêtes du jour`, body: `<div id="${id}">${body()}</div>`, buttons: [{ label: 'Fermer', cls: 'ghost', value: true }], dismissable: true });
  const root = document.getElementById(id);
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-q]'); if (!b || b.disabled) return;
    const r = claimQuest(+b.dataset.q); if (!r) return;
    sfx('loot'); buzz(20);
    toast(`${iconImg('chest', 16)} <b>${esc(chestName(r.chest))}</b> et <b>+${r.gold} or</b>`);
    root.innerHTML = body();
    announceAchievements();
  });
  await p;
  if (!battle) home();
}

// « Coffre en argent » -> « Argent » (étiquette courte d'une case de connexion)
const chestShort = t => { const n = chestName(t).replace(/^Coffre\s+(en\s+)?/i, ''); return n.charAt(0).toUpperCase() + n.slice(1); };
function loginReward(R, size = 30) {
  if (R.chest != null) return `<span class="ld-ic"><img class="chest-i" src="${chestURL(R.chest)}" alt=""></span><b style="--tc:${LOOT_TIERS[R.chest]?.color || '#fff'}">${esc(chestShort(R.chest))}</b>${R.gold ? `<small>+${R.gold} or</small>` : '<small>Coffre</small>'}`;
  if (R.boost) return `<span class="ld-ic">${iconImg('potion', size)}</span><b>Bonus</b><small>au hasard</small>`;
  return `<span class="ld-ic">${iconImg('gold', size)}</span><b>${R.gold}</b><small>or</small>`;
}

async function loginSheet() {
  const id = 'lg-' + Date.now();
  const body = () => {
    const L = loginState(), cur = L.ready ? L.day : -1, got = L.ready ? L.day : (L.day || 7);
    return `<div class="login-track">${LOGIN_REWARDS.map((R, k) => `<div class="lday ${k < got ? 'got' : ''} ${k === cur ? 'today' : ''} ${k === 6 ? 'big' : ''}">
        <em>Jour ${k + 1}</em>${loginReward(R)}${k < got ? `<i class="ld-ok" aria-label="Reçu">${iconImg('check', 14)}</i>` : ''}</div>`).join('')}</div>
      <p class="login-note">${L.ready ? 'Revenez chaque jour : le 7e jour donne un <b>coffre en or</b>.' : 'Récompense du jour reçue. Revenez demain !'}</p>`;
  };
  const L0 = loginState();
  const v = await modal({ title: `${iconImg('calendar', 22)} Connexion`, body: `<div id="${id}">${body()}</div>`,
    buttons: L0.ready ? [{ label: 'Plus tard', cls: 'ghost', value: false }, { label: `Réclamer · jour ${L0.day + 1}`, cls: 'primary', value: true }] : [{ label: 'Fermer', cls: 'ghost', value: false }],
    dismissable: true });
  if (v) {
    const r = claimLogin();
    if (r) {
      sfx('loot'); buzz(25);
      const what = r.chest != null ? `<b>${esc(chestName(r.chest))}</b>${r.gold ? ` et <b>+${r.gold} or</b>` : ''}` : r.boostId ? `Bonus : <b>${esc(BOOSTS[r.boostId].name)}</b>` : `<b>+${r.gold} or</b>`;
      toast(`${iconImg('calendar', 16)} Jour ${r.day + 1} : ${what}`, 2800);
      announceAchievements();
    }
  }
  if (!battle) home();
}

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
        ${bi ? `<div class="rw">${iconImg(bi.icon, 18)} <b style="color:${RARITY.legendary.color}">${esc(bi.name)}</b></div>` : ''}
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
    <p>${iconImg('portal', 18)}<span>Battez-le : un <b>portail</b> s'ouvre ${next ? `vers <b>${esc(next.name)}</b>, plus dur et plus riche` : 'vers la victoire finale'}.</span></p>
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
      <div class="cs-tabs">${Object.values(CLASSES).map(k => `<button class="cs-tab ${k.id === sel ? 'on' : ''} ${clsLocked(k.id) ? 'locked' : ''} ${masteryLv(k.id) >= DATA.MASTERY.max ? 'm-gold' : ''}" data-act="pick" data-c="${k.id}"><img class="px spr" src="${heroURL(k.id, k.colors)}" alt=""><span>${k.role}</span>${clsLocked(k.id) ? `<i class="cs-lk">${iconImg('lock', 14)}</i>` : masteryChip(k.id)}</button>`).join('')}</div>
      <section class="cs-detail">
        <p class="cs-desc">${esc(c.desc)}</p>
        ${lk ? clsLockPanel(sel) : ''}
        <div class="stats wide">
          <span>${iconImg('heart', 16)}PV<b>${c.hp}</b></span>
          <span>${iconImg('fist', 16)}ATQ<b>${c.atk}</b></span>
          <span>${iconImg('target', 16)}Critique<b>${pct(c.crit)}</b></span>
          <span>${iconImg('arrow', 16)}Vitesse<b>${pct(c.speed)}</b></span>
        </div>
        <div class="cs-spells">
          <div class="cs-spell">${iconImg(WEAPONS[c.weapon].icon, 26)}<div><b>${esc(WEAPONS[c.weapon].name)}</b><small>Arme de départ · ${esc(WEAPONS[c.weapon].desc)}</small></div></div>
          <div class="cs-spell k-ult">${iconImg(ULTS[c.ult].icon, 26)}<div><b>${esc(ULTS[c.ult].name)}</b><small>Ultime · ${esc(ULTS[c.ult].desc)}</small></div></div>
        </div>
        <h4 class="evo-t">Évolutions pendant la partie</h4>
        <div class="evo-chain">${EVOLUTIONS[c.id].map((e, i) => `<span class="evo ${e.aura ? 'final' : ''}" style="--d:${(i * 0.05).toFixed(2)}s${e.aura ? `;--aura:${e.aura}` : ''}">
          <em>${i ? `Niv. ${e.lvl}` : 'Départ'}</em><span class="evo-img"><img class="px spr" src="${heroURL(c.id, null, i)}" alt=""></span>
          <b>${esc(i ? e.name.replace(c.name + ' ', '') : c.name)}</b></span>`).join('')}</div>
        ${lk ? '' : `<h4 class="evo-t">Maîtrise</h4>${masteryPanel(sel)}${auraPicker(sel)}`}
        ${first ? '<p class="cs-note">Vous pourrez changer de champion à tout moment. L\'équipement et les améliorations sont partagés.</p>' : ''}
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

// ---------- Partie ----------
let run = null;
let runBoosts = [];

function startRun(z, diff = 0, abyss = 0) {
  if (!supported()) return noWebGL(); // rien n'est dépensé (bonus, partie comptée)
  diff = Math.max(0, Math.min(diff, maxDiff(z)));
  abyss = Math.max(0, Math.min(abyss | 0, abyssTop(z))); // L2 : palier d'Abysse (en Cauchemar)
  save.stats.runs++;
  const boosts = runBoosts = consumeBoosts(); // enregistre aussi la partie commencée
  const zone = ZONES[z];
  run = new Run({
    zone,
    diff,
    abyss,
    boosts,
    onPause: resume => pauseMenu(resume),
    onLevelUp: (title, opts, done, sub, extra) => levelUpMenu(title, opts, done, sub, extra),
    onChest: (c, gold, done) => chestMenu(c, gold, done),
    onDefeat: canRevive => defeatMenu(canRevive),
    onPortal: (info, choose) => portalMenu(info, choose),
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
  if (!save.tutorialDone && save.stats.runs <= 1) tutorial(run);
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

// ---------- Tutoriel (premier lancement) : 4 étapes courtes, la partie attend ----------
const TUTO = [
  { t: 'Bouger', ill: '<i class="ti-joy"></i><i class="ti-hero"></i>', p: 'Posez le doigt <b>n\'importe où</b> et glissez : votre champion court. Il <b>attaque tout seul</b> les monstres proches.' },
  { t: 'Esquiver', ill: '<i class="ti-wave"></i><i class="ti-body"></i>', p: 'Un <b>cercle rouge</b> au sol ou un monstre qui <b>clignote</b> annonce une attaque : <b>écartez-vous</b> avant l\'impact. Les ondes de choc et les rayons des boss ont une portée limitée : éloignez-vous !' },
  { t: 'Monter de niveau', ill: '<i class="ti-xp"></i><div class="ti-cards"><i style="--d:0s"></i><i style="--d:.12s"></i><i style="--d:.24s"></i></div>', p: 'Ramassez les <b>cristaux bleus</b> pour gagner de l\'expérience. À chaque niveau, choisissez une <b>arme</b>, un <b>tome</b> ou une amélioration.' },
  { t: 'Autel, boss, portail', ill: `<div class="ti-path"><span>${iconImg('skull', 34)}Autel</span><span>${iconImg('crown', 34)}Boss</span><span>${iconImg('portal', 34)}Portail</span></div>`, p: 'Suivez la flèche jusqu\'à l\'<b>autel au crâne rouge</b> pour invoquer le boss. Battu, il ouvre un <b>portail au centre de la carte</b> vers le monde suivant.' },
];
function tutorial(r) {
  r.paused = true;
  let k = 0;
  const w = document.createElement('div');
  w.className = 'tuto';
  $('.run')?.appendChild(w);
  const draw = () => {
    const s = TUTO[k];
    w.innerHTML = `<div class="tu-card" key="${k}">
      <div class="tu-ill">${s.ill}</div>
      <span class="tu-step">Étape ${k + 1} / ${TUTO.length}</span><h3>${s.t}</h3><p>${s.p}</p>
      <div class="tu-foot"><span class="tu-dots">${TUTO.map((_, i) => `<i class="${i <= k ? 'on' : ''}"></i>`).join('')}</span>
        <button class="btn ghost small" data-t="skip">Passer</button><button class="btn primary" data-t="next">${k < TUTO.length - 1 ? 'Suivant' : 'C\'est parti'}</button></div>
    </div>`;
  };
  const end = () => {
    save.tutorialDone = true; persist({ touch: false });
    w.classList.add('out'); setTimeout(() => w.remove(), 200);
    if (!r.over) { r.paused = false; r.last = performance.now(); }
  };
  draw();
  w.addEventListener('pointerdown', e => e.stopPropagation());
  w.addEventListener('click', e => {
    const b = e.target.closest('[data-t]'); if (!b) return;
    sfx('tap');
    if (b.dataset.t === 'skip' || k >= TUTO.length - 1) return end();
    k++; draw();
  });
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
  const lines = (info?.lines || []).filter(l => l && l.label != null && l.to != null && (l.from == null || l.from === '' || val(l.from) !== val(l.to))).slice(0, 4);
  const hint = typeof info?.hint === 'string' && info.hint && c.kind !== 'evo' ? info.hint : '';
  const pips = f.lv && !(f.lv === 1 && (c.kind === 'weapon' || c.kind === 'tome')) ? `<span class="cu-pips" aria-label="Niveau ${f.lv}">${Array.from({ length: 5 }, (_, k) => `<i class="${k + 1 < f.lv ? 'on' : k + 1 === f.lv ? 'new' : ''}"></i>`).join('')}</span>` : '';
  const isNew = f.lv === 1 && (c.kind === 'weapon' || c.kind === 'tome');
  const ri = c.rarity ?? info?.rarity;
  const rar = ri != null && RARITIES[ri] ? RARITY[RARITIES[ri]] : null;
  return `<${tag} class="card-up ${f.cls} ${rar ? 'r' + ri : ''} ${isNew ? 'is-new' : ''}" data-i="${i}" style="--d:${(i * 0.06).toFixed(2)}s">
    ${isNew ? '<i class="cu-ribbon">Nouveau</i>' : c.kind === 'evo' ? '<i class="cu-ribbon">Évolution</i>' : ''}
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
  let cur = opts;
  // compteurs : valeur fournie par la partie (nombre, ou fonction / accesseur à jour), décomptés ici sinon
  const read = k => (extra ? Math.max(0, (typeof extra[k] === 'function' ? extra[k]() : extra[k]) | 0) : 0);
  let nR = read('rerolls'), nS = read('skips');
  const rr = () => nR, sk = () => nS;
  const foot = () => (extra && (typeof extra.reroll === 'function' || typeof extra.skip === 'function') ? `<div class="lu-foot">
      ${typeof extra.reroll === 'function' ? `<button class="btn ghost lu-act" data-x="reroll" ${rr() ? '' : 'disabled'}>${iconImg('reroll', 16)} Relancer <b>(${rr()})</b></button>` : ''}
      ${typeof extra.skip === 'function' ? `<button class="btn ghost lu-act" data-x="skip" ${sk() ? '' : 'disabled'}>${iconImg('skip', 16)} Passer <b>(${sk()})</b></button>` : ''}
    </div>` : '');
  const w = overlay(`<div class="lvlup">
    ${luHead(title, subtitle)}
    <div class="cards">${cur.map((c, i) => choiceCard(c, i)).join('')}</div>
    ${foot()}
  </div>`);
  w.classList.add('lvl-ov');
  if (cur.some(c => c.kind === 'evo')) sfx('levelup');
  let busy = false;
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

function portalMenu(info, choose) {
  const from = ZONES[info.from] || ZONES[0], to = info.to == null ? null : ZONES[info.to];
  // numéros de monde : ceux de la carte (comme le HUD), pas le rang dans l'expédition
  const nFrom = from.id + 1, cleared = info.cleared?.length ? info.cleared : [from.id];
  const stat = (ic, v, l) => `<div>${iconImg(ic, 18)}<b>${v}</b><small>${l}</small></div>`;
  const w = overlay(`<div class="portal-menu ${to ? '' : 'final'}">
    <div class="pm-vortex"><i></i><i></i><i></i><b>${iconImg(to ? 'portal' : 'crown', 34)}</b></div>
    <span class="eyebrow">${to ? `Monde ${nFrom} vaincu · ${esc(from.name)}` : 'Les six mondes sont vaincus'}</span>
    <h2>${to ? 'Portail ouvert' : 'Victoire finale'}</h2>
    <p class="pm-sub">${to ? 'Continuez l\'expédition ou rentrez avec votre butin.' : 'Le monde est sauvé. Bravo, champion !'}</p>
    <div class="pm-stats">${stat('clock', fmtTime(info.time || 0), 'Temps')}${stat('skull', fmt(info.kills || 0), 'Monstres')}${stat('gold', fmt(info.gold || 0), 'Or')}${stat('chest', info.loot || 0, 'Coffres')}</div>
    <div class="pm-bosses">${cleared.map(id => `<span class="pm-b" title="${esc(ZONES[id].name)}">${bossImg(ZONES[id])}<i>✓</i></span>`).join('')}</div>
    ${to ? `<button class="pm-next" data-v="next" style="background-image:url(${zoneBannerURL(to)})">
        <span class="pm-n">${String(to.id + 1).padStart(2, '0')}</span>
        <span class="pm-t"><small>Monde suivant</small><b>${esc(to.name)}</b><em>Plus dur, plus de butin</em></span>
        <span class="pm-boss">${bossImg(to)}</span><i class="pm-go">Entrer</i>
      </button>
      <button class="btn ghost pm-home" data-v="home">${iconImg('chest', 18)} Rentrer avec le butin</button>`
    : `<button class="btn primary big pm-home" data-v="home">${iconImg('crown', 20)} Rentrer en héros</button>`}
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
    title: `<span class="eyebrow">Monde ${(z?.id ?? 0) + 1}/${ZONES.length} · ${esc(z?.name || '')}</span><span class="h2-row">Pause${run.diffId ? ` <span class="diff-tag d${run.diffId}${run.abyss ? ' ab' : ''}">${esc(run.diff.name)}</span>` : ''}</span>`,
    cls: 'pause-modal',
    body: `<div class="pz-sum">
        <div><small>Temps</small><b>${fmtTime(run.runTime ?? run.time ?? 0)}</b></div><div><small>Niveau</small><b>${p.level}</b></div>
        <div><small>Monstres</small><b>${fmt(run.kills || 0)}</b></div><div><small>Or</small><b class="gold-t">${fmt(run.gold)}</b></div>
      </div>
      <div class="pz-hp ${hpK < 0.3 ? 'low' : ''}"><small>PV</small><span class="pbar"><i style="width:${(hpK * 100).toFixed(1)}%"></i></span><b>${fmt(Math.max(0, p.hp))} / ${fmt(p.maxHp)}</b></div>
      <div class="pz-sum pz-st">${pzStats(p)}</div>
      ${abyssPause(run.abyss)}
      <h4>Armes <small>${p.weapons.length}/${nW}</small></h4>
      <div class="cur-build">${p.weapons.map(wRow).join('')}${free(nW - p.weapons.length)}</div>
      <h4>Tomes <small>${tomes.length}/${nT}</small></h4>
      <div class="cur-build">${tomes.map(tRow).join('')}${free(nT - tomes.length)}</div>
      ${runBoosts.length ? `<h4>Bonus</h4><div class="cur-build boosts-on">${runBoosts.map(id => `<span class="bl">${iconImg(BOOSTS[id].icon, 20)}<span class="bl-t"><b>${esc(BOOSTS[id].name)}</b></span></span>`).join('')}</div>` : ''}
      <h4>Options</h4>
      <div class="set-list">${sw('pSound', 'sound', 'Son', save.settings.sound)}${sw('pMus', 'music', 'Musique', save.settings.music !== false)}${sw('pVib', 'vibrate', 'Vibrations', save.settings.vibrate)}</div>
      <details class="pz-help"><summary>${iconImg('info', 16)} Comment jouer</summary>
      <div class="howto">
        <p>${iconImg('arrow', 20)}<span><b>Se déplacer</b> : glissez le doigt n'importe où sur l'écran. Tout se joue avec un seul doigt.</span></p>
        <p>${iconImg('sword', 20)}<span><b>Attaquer</b> : c'est automatique ! Ramassez les gemmes pour monter de niveau et évoluer.</span></p>
        <p>${iconImg('i_heavy', 20)}<span><b>Esquiver</b> : un cercle rouge au sol ou un monstre qui clignote annonce une attaque. Écartez-vous ! Les ondes de choc et les rayons des boss ont une portée limitée : éloignez-vous du boss.</span></p>
        <p>${iconImg('skull', 20)}<span><b>Boss</b> : suivez la flèche jusqu'à l'<b>autel au crâne rouge</b> et restez dessus pour invoquer le boss. Le combat a lieu dans une arène fermée.</span></p>
        <p>${iconImg('portal', 20)}<span><b>Portail</b> : le boss vaincu ouvre un portail (suivez la flèche) vers le monde suivant, plus dur mais plus riche. Vous pouvez aussi rentrer avec votre butin.</span></p>
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
  const musOn = $('#pMus')?.checked ?? save.settings.music;
  if (musOn !== save.settings.music) { save.settings.music = musOn; if (!musOn) stopMusic(); else if (run) music('zone' + run.zone.id); }
  persist();
  if (v === 'quit') {
    const nLoot = run.loot?.length || 0;
    const ok = await modal({ title: 'Abandonner ?', body: `<p>La partie s'arrête ici. Vous gardez <b>${fmt(run.gold)} or</b>${nLoot ? ` et <b>${nLoot} coffre${nLoot > 1 ? 's' : ''} de butin</b>` : ''} ramassés.</p>`, buttons: [{ label: 'Continuer', cls: 'ghost', value: false }, { label: 'Abandonner', cls: 'danger', value: true }] });
    if (ok) { run.finish(false); return; }
  }
  resume();
}

async function defeatMenu(canRevive) {
  const t = fmtTime(run.runTime ?? run.time), nLoot = run.loot?.length || 0, z = run.zone;
  const kept = nLoot || run.cleared?.length ? `<p class="ko-kept">${iconImg('chest', 18)}<span>${nLoot ? `Vos <b>${nLoot} coffre${nLoot > 1 ? 's' : ''} de butin</b>` : 'Vos mondes vaincus'}${nLoot && run.cleared?.length ? ' et les mondes vaincus sont conservés' : ' sont conservés'}.</span></p>` : '';
  const v = await modal({
    title: `<span class="eyebrow">Monde ${(z?.id ?? 0) + 1} · ${esc(z?.name || '')}</span>K.O.`,
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
    if (ok) { run.revive(); return; }
  }
  run.finish(false);
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
  for (const c of loot) save.pendingChests.push({ tier: c.tier | 0, zone: Math.max(0, Math.min(ZONES.length - 1, (c.zone ?? start.id) | 0)) });
  persist();
  st.kills += sum.kills;
  const record = st.bestLevel > 0 && sum.level > st.bestLevel; // nouveau meilleur niveau atteint
  st.bestLevel = Math.max(st.bestLevel, sum.level);
  st.bestStage = Math.max(st.bestStage || 0, stage);
  st.totems = (st.totems || 0) + heat;
  st.portals = (st.portals || 0) + stage + (sum.win && cleared.length ? 1 : 0);
  if (!sum.win) st.deaths++;
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
    worlds.push({ z: wz, n: id - start.id + 1, lines });
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
  const got = checkAchievements();
  persist();
  const R = { start, k, D, sum, cleared, worlds, found, gold, heat, heatGold, stage, unlocked, newZone, got, record, l2,
    final: sum.final ?? (sum.win && cleared.includes(ZONES.length - 1)), reached: ZONES[Math.min(ZONES.length - 1, start.id + stage)] };
  sfx(cleared.length ? 'win' : 'coin');
  const show = opened => summaryScreen(R, opened);
  if (save.pendingChests.length) chestScreen(show, true); else show([]);
}

// ---------- Ouverture des coffres de butin ----------
// tuile d'une pièce d'équipement (couleur de sa rareté)
function partIcon(slot, r, size = 28) {
  return `<span class="part-ic r-${RARITIES[r]}">${iconImg(PARTS[slot].icon, size)}</span>`;
}

// regroupe le contenu de plusieurs coffres
function lootAgg(results) {
  const parts = {}, boosts = {}, items = [], upgs = [];
  let gold = 0;
  for (const res of results) {
    for (const p of res.parts) parts[p.slot + ':' + p.r] = (parts[p.slot + ':' + p.r] || 0) + p.n;
    if (res.boost) boosts[res.boost] = (boosts[res.boost] || 0) + 1;
    for (const it of res.items || []) items.push(it);
    if (res.upg) upgs.push({ key: res.upg, lv: res.upgLv });
    gold += res.gold;
  }
  return {
    parts: Object.entries(parts).map(([key, n]) => { const [slot, r] = key.split(':'); return { slot, r: +r, n }; }).sort((a, b) => b.r - a.r || b.n - a.n),
    boosts, items, upgs, gold,
  };
}

// cartes à révéler une par une, comme dans les jeux de cartes : le plus commun d'abord, le meilleur pour la fin
function lootSeq(results) {
  const A = lootAgg(results), out = [];
  if (A.gold) out.push({ k: 'gold', n: A.gold });
  for (const p of [...A.parts].sort((a, b) => a.r - b.r || a.n - b.n)) out.push({ k: 'part', ...p });
  for (const [id, n] of Object.entries(A.boosts)) out.push({ k: 'boost', id, n });
  for (const it of [...A.items].sort((a, b) => rarityIdx(a) - rarityIdx(b) || itemPower(a) - itemPower(b))) out.push({ k: 'item', it });
  for (const u of A.upgs) out.push({ k: 'upg', ...u });
  return out;
}
const isEq = it => save.equipped[it.slot] === it.id;

// grande carte d'un objet (coffre, forge) : rareté, toutes ses caractéristiques, effet légendaire
function itemCard(it, { ribbon = '' } = {}) {
  const R = RARITY[it.rarity];
  return `<div class="rcard icard r-${it.rarity}">
    ${ribbon ? `<i class="rc-ribbon">${ribbon}</i>` : ''}
    <span class="rc-rar">${R.name}</span>
    <span class="rc-ic">${iconImg(it.icon, 64)}${it.lv ? `<em class="lv-badge">+${it.lv}</em>` : ''}</span>
    <b class="rc-name">${esc(it.name)}</b>
    <span class="rc-sub">${SLOTS[it.slot]}${it.crafted ? ' · forgé' : ''}</span>
    <span class="rc-stats">${statRows(it)}</span>
    ${it.effect ? effectBox(it.effect) : ''}
    ${isEq(it) ? '<span class="rc-eq">Équipé !</span>' : ''}
  </div>`;
}

function bigCard(x) {
  if (x.k === 'item') return itemCard(x.it, { ribbon: 'Nouvel objet' });
  if (x.k === 'gold') return `<div class="rcard rc-gold"><span class="rc-ic">${iconImg('gold', 76)}</span><b class="rc-n">+${fmt(x.n)}</b><span class="rc-name">Pièces d'or</span></div>`;
  if (x.k === 'part') {
    const rk = RARITIES[x.r], P = PARTS[x.slot];
    return `<div class="rcard r-${rk}"><span class="rc-rar">${RARITY[rk].name}</span><span class="rc-ic">${partIcon(x.slot, x.r, 60)}</span>
      <b class="rc-n">×${x.n}</b><span class="rc-name">${esc(x.n > 1 ? P.plural : P.name)}</span><small class="rc-desc">Pour fabriquer et améliorer à la Forge</small></div>`;
  }
  if (x.k === 'boost') {
    const B = BOOSTS[x.id];
    return `<div class="rcard rc-boost"><i class="rc-ribbon">Bonus</i><span class="rc-ic">${iconImg(B.icon, 64)}</span>
      <b class="rc-n">×${x.n}</b><span class="rc-name">${esc(B.name)}</span><small class="rc-desc">${esc(B.desc)}</small></div>`;
  }
  return upgCard(x);
}
// niveau gratuit d'amélioration permanente
function upgCard(x) {
  const U = UPGRADES[x.key];
  return `<div class="rcard rc-upg"><i class="rc-ribbon">Amélioration gratuite !</i><span class="rc-ic">${iconImg(U.icon, 64)}</span>
    <b class="rc-name">${esc(U.name)}</b><span class="rc-lv"><s>Niv. ${x.lv - 1}</s><i>›</i><b>Niv. ${x.lv}</b></span><small class="rc-desc">${esc(U.desc)} · pour tous les champions</small></div>`;
}

// petite carte du récapitulatif
function miniCard(x, i) {
  const d = `style="--d:${(i * 0.06).toFixed(2)}s"`;
  if (x.k === 'gold') return `<div class="mcard rc-gold" ${d}>${iconImg('gold', 36)}<b>+${fmt(x.n)}</b><small>Or</small></div>`;
  if (x.k === 'part') return `<div class="mcard r-${RARITIES[x.r]}" ${d}>${partIcon(x.slot, x.r, 30)}<i class="mc-n">×${x.n}</i><small>${esc(PARTS[x.slot].name)}</small></div>`;
  if (x.k === 'boost') return `<div class="mcard rc-boost" ${d}>${iconImg(BOOSTS[x.id].icon, 36)}<i class="mc-n">×${x.n}</i><small>${esc(BOOSTS[x.id].name)}</small></div>`;
  if (x.k === 'item') return `<div class="mcard r-${x.it.rarity}" ${d}>${iconImg(x.it.icon, 36)}${isEq(x.it) ? '<i class="mc-eq">Équipé</i>' : ''}<small>${esc(x.it.name)}</small></div>`;
  return `<div class="mcard rc-upg" ${d}>${iconImg(UPGRADES[x.key].icon, 36)}<i class="mc-n">niv. ${x.lv}</i><small>${esc(UPGRADES[x.key].name)}</small></div>`;
}

// scène d'ouverture façon jeu de cartes : le coffre tombe et rebondit, tremble quand on le touche, éclate,
// puis son contenu sort carte par carte (touchez pour la suivante), avant un récapitulatif
function revealStage(results, tier, title, { quick = false } = {}) {
  return new Promise(resolve => {
    const seq = lootSeq(results);
    const w = document.createElement('div');
    w.className = `chest-stage t${tier}`;
    w.style.setProperty('--tc', LOOT_TIERS[tier].color);
    w.innerHTML = `<h2 class="cst-title">${title}</h2>
      <div class="cst-scene">
        <i class="cst-rays"></i>
        <div class="cst-card"></div>
        <div class="cst-recap"></div>
        <div class="cst-chest"><i class="cst-shadow"></i><i class="cst-dust"></i><img src="${chestURL(tier)}" alt=""><i class="cst-flash"></i>
          <b class="cst-left"></b><div class="cst-burst">${'<i></i>'.repeat(16)}</div></div>
      </div>
      <p class="cst-hint">Touchez le coffre !</p>
      <div class="cst-btns"><button class="btn small ghost cst-skip">Tout voir</button><button class="btn primary big cst-ok">Continuer</button></div>`;
    w.querySelectorAll('.cst-burst i').forEach((p, i) => {
      const a = i / 16 * Math.PI * 2 + Math.random() * 0.3, d = 110 + Math.random() * 110;
      p.style.cssText = `--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d - 40}px;--s:${0.6 + Math.random() * 0.9}`;
    });
    app.appendChild(w);
    const $w = s => w.querySelector(s), hint = $w('.cst-hint'), left = $w('.cst-left'), cardBox = $w('.cst-card');
    let state = 'drop', idx = -1, readyAt = 0;
    const T = [];
    const at = (ms, fn) => T.push(setTimeout(fn, ms));
    requestAnimationFrame(() => w.classList.add('in'));
    at(380, () => { sfx('boing'); buzz(15); });
    at(650, () => { state = 'ready'; w.classList.add('ready'); if (quick) shake(); });
    function shake() {
      state = 'shake';
      w.classList.remove('ready'); w.classList.add('shake');
      hint.textContent = '';
      sfx('chestShake'); buzz(20);
      at(260, () => sfx('chestShake'));
      at(520, burst);
    }
    function burst() {
      w.classList.remove('shake'); w.classList.add('open');
      $w('.cst-chest img').src = chestURL(tier, true);
      sfx('chestOpen'); buzz(50);
      at(380, () => next());
    }
    function next() {
      idx++;
      if (idx >= seq.length) return recap();
      const x = seq[idx], old = cardBox.firstElementChild;
      if (old) { old.classList.add('gone'); setTimeout(() => old.remove(), 300); }
      cardBox.insertAdjacentHTML('beforeend', `<div class="cst-slot">${bigCard(x)}</div>`);
      const n = seq.length - idx - 1;
      left.innerHTML = `<b>${n}</b><small>restant${n > 1 ? "s" : ""}</small>`; left.classList.toggle("none", !n);
      left.classList.remove('bump'); void left.offsetWidth; left.classList.add('bump');
      const legend = x.k === 'item' && x.it.rarity === 'legendary', epic = x.k === 'item' && x.it.rarity === 'epic';
      w.classList.toggle('legend', legend); w.classList.toggle('epic', epic);
      sfx(x.k === 'gold' ? 'coin' : x.k === 'part' ? (x.r >= 2 ? 'loot' : 'gem') : x.k === 'boost' ? 'pick' : x.k === 'upg' ? 'levelup' : legend || epic ? 'chest' : 'loot');
      buzz(legend ? 60 : 15);
      hint.textContent = n ? 'Touchez pour la carte suivante' : 'Touchez pour le récapitulatif';
      w.classList.add('cards');
      state = 'card'; readyAt = performance.now() + 380;
    }
    function recap() {
      state = 'recap';
      w.classList.remove('cards', 'legend', 'epic'); w.classList.add('recapping');
      cardBox.innerHTML = '';
      $w('.cst-recap').innerHTML = `<h3 class="cst-rt">Butin obtenu</h3><div class="cst-grid ${seq.length > 9 ? 'dense' : ''}">${seq.map(miniCard).join('')}</div>`;
      hint.textContent = '';
      sfx('win');
      at(350, () => { state = 'done'; w.classList.add('done'); });
    }
    w.addEventListener('click', e => {
      if (e.target.closest('.cst-skip')) { if (state === 'card') { sfx('tap'); recap(); } return; }
      if (e.target.closest('.cst-ok')) {
        if (state !== 'done') return;
        sfx('tap'); T.forEach(clearTimeout);
        w.classList.add('out');
        setTimeout(() => { w.remove(); resolve(); }, 220);
        return;
      }
      if (state === 'ready') shake();
      else if (state === 'card' && performance.now() >= readyAt) next();
    });
  });
}

const buzz = ms => { if (save.settings.vibrate && navigator.vibrate) try { navigator.vibrate(ms); } catch (e) { /* non supporté */ } };

// écran des coffres en attente : à la fin d'une partie, ou depuis l'accueil
function chestScreen(done, afterRun = false) {
  const list = [...save.pendingChests].sort((a, b) => b.tier - a.tier);
  const opened = [];
  let busy = false;
  mount(`<div class="chest-screen">
    <h2 class="rs-title">${afterRun ? 'Butin de l\'expédition' : 'Coffres de butin'}</h2>
    <p class="center muted cs-hint">Touchez un coffre pour l'ouvrir</p>
    <div class="chest-grid ${list.length <= 4 ? 'few' : ''} ${list.length === 3 ? 'n3' : ''}" style="--n:${list.length === 3 ? 3 : Math.min(2, list.length)}">${list.map((c, i) => `<button class="cg-card t${c.tier}" data-i="${i}" style="--tc:${LOOT_TIERS[c.tier].color};--d:${(i * 0.06).toFixed(2)}s">
        <span class="cg-glow"></span><img class="cg-img" src="${chestURL(c.tier)}" alt="">
        <b>${esc(LOOT_TIERS[c.tier].name)}</b><small>${esc(ZONES[c.zone]?.name || '')}</small>
      </button>`).join('')}</div>
    <div class="end-btns cs-btns"></div>
  </div>`);
  const root = $('.chest-screen'), btnBox = $('.cs-btns');
  const left = () => list.filter(c => save.pendingChests.includes(c)).length;
  const drawBtns = () => {
    const n = left();
    $('.cs-hint').textContent = n ? 'Touchez un coffre pour l\'ouvrir' : 'Tous les coffres sont ouverts !';
    btnBox.innerHTML = n
      ? `<button class="btn ghost" data-act="later">${afterRun ? 'Plus tard' : 'Retour'}</button><button class="btn primary" data-act="all">Tout ouvrir (${n})</button>`
      : `<button class="btn primary big" data-act="next">Continuer</button>`;
  };
  const markOpen = (i, res) => {
    const card = root.querySelector(`.cg-card[data-i="${i}"]`);
    card.classList.add('opened'); card.disabled = true;
    card.querySelector('.cg-img').src = chestURL(res.tier, true);
    card.querySelector('small').textContent = 'Ouvert';
  };
  const finish = () => { announceAchievements(); done(opened); };
  drawBtns();
  root.addEventListener('click', async e => {
    if (busy) return;
    const card = e.target.closest('.cg-card'), act = e.target.closest('[data-act]')?.dataset.act;
    if (card && !card.disabled) {
      const i = +card.dataset.i, idx = save.pendingChests.indexOf(list[i]);
      if (idx < 0) return;
      busy = true;
      const res = openChest(idx); // contenu enregistré tout de suite
      opened.push(res);
      card.classList.add('pick');
      await revealStage([res], res.tier, esc(LOOT_TIERS[res.tier].name));
      markOpen(i, res);
      busy = false; drawBtns();
      return;
    }
    if (act === 'later' || act === 'next') { sfx('tap'); finish(); return; }
    if (act === 'all') {
      busy = true; sfx('tap');
      const batch = [];
      const cards = list.map((c, i) => [c, i]).filter(([c]) => save.pendingChests.includes(c));
      for (const [c, i] of cards) {
        const card = root.querySelector(`.cg-card[data-i="${i}"]`);
        card.classList.add('quake'); sfx('chestShake');
        card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        await wait(cards.length > 8 ? 110 : 190);
        const res = openChest(save.pendingChests.indexOf(c));
        batch.push(res); opened.push(res); markOpen(i, res);
      }
      await wait(250);
      const top = batch.reduce((m, x) => Math.max(m, x.tier), 0);
      await revealStage(batch, top, batch.length > 1 ? `${batch.length} coffres ouverts !` : esc(LOOT_TIERS[top].name), { quick: true });
      busy = false; drawBtns();
    }
  });
}

// ---------- Bilan de l'expédition ----------
function summaryScreen(R, opened = []) {
  const { start, k, D, sum, cleared } = R;
  const won = cleared.length > 0;
  const route = R.stage ? `${esc(start.name)} <i class="rs-arrow">›</i> ${esc(R.reached.name)}` : esc(start.name);
  const A = lootAgg(opened), nParts = A.parts.reduce((n, p) => n + p.n, 0), nBoosts = Object.values(A.boosts).reduce((n, v) => n + v, 0);
  const pending = save.pendingChests.length;
  const chestLine = opened.length
    ? `<div class="rw loot-sum">${iconImg('chest', 22)}<span><b>${opened.length} coffre${opened.length > 1 ? 's' : ''} ouvert${opened.length > 1 ? 's' : ''}</b>
        <span class="ls-chips">${nParts ? `<span>${iconImg('hammer', 14)} ${nParts} pièce${nParts > 1 ? 's' : ''}</span>` : ''}${nBoosts ? `<span>${iconImg('potion', 14)} ${nBoosts} bonus</span>` : ''}${A.items.length ? `<span>${iconImg('sword', 14)} ${A.items.length} objet${A.items.length > 1 ? 's' : ''}</span>` : ''}${A.upgs.length ? `<span>${iconImg('upg', 14)} ${A.upgs.length} amélioration${A.upgs.length > 1 ? 's' : ''} gratuite${A.upgs.length > 1 ? 's' : ''}</span>` : ''}<span class="gold-t">${iconImg('gold', 14)} +${fmt(A.gold)}</span></span></span></div>`
    : '';
  const pendLine = pending ? `<div class="rw">${iconImg('chest', 22)}<span><b>${pending} coffre${pending > 1 ? 's' : ''}</b> à ouvrir plus tard, depuis l'onglet Aventure.</span></div>` : '';
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
        <span class="wr-boss">${bossImg(w.z)}</span>
        <span class="wr-t"><small>Monde ${w.z.id + 1}</small><b>${esc(w.z.name)}</b></span>
        <span class="wr-ok">${iconImg('check', 12)} Boss vaincu</span>
      </div>
      <div class="wr-lines">${w.lines.map(l => `<div class="rw">${l.replace(/^(<img[^>]*>)\s*([\s\S]*)$/, '$1<span>$2</span>')}</div>`).join('')}</div>
    </div>`).join('');
  const title = R.final ? 'Le monde est sauvé' : sum.win ? 'Victoire' : won ? 'Expédition terminée' : 'Défaite';
  const eyebrow = R.final ? 'Victoire finale' : won ? `${cleared.length} monde${cleared.length > 1 ? 's' : ''} vaincu${cleared.length > 1 ? 's' : ''}` : 'Fin de partie';
  // bouton principal : nouveau monde débloqué, niveau supérieur, ou rejouer
  const nextZ = R.newZone ?? start.id, nextK = R.newZone != null ? 0 : R.unlocked ?? k;
  const nextLabel = R.newZone != null ? `Partir : ${esc(ZONES[R.newZone].name)}` : R.unlocked ? `Tenter ${esc(DIFFICULTIES[R.unlocked].name)}` : 'Rejouer';
  mount(`<div class="reward-screen ${won ? 'complete' : 'lost'}">
    <span class="eyebrow rs-eyebrow">${eyebrow}</span>
    <h2 class="rs-title">${title}</h2>
    <p class="rs-zone">${route} <span class="diff-tag d${k}${D.abyss ? ' ab' : ''}">${esc(D.name)}</span></p>
    ${R.final ? `<p class="center finale">Le Ver-Roi du Néant est tombé. Vous avez vaincu les 6 boss. Bravo, champion !</p>` : ''}
    <div class="run-stats">
      <div><b>${fmtTime(sum.time)}</b><small>Durée</small></div>
      <div><b class="cu" data-n="${sum.kills}">${fmt(sum.kills)}</b><small>Monstres</small></div>
      <div class="${R.record ? 'rec' : ''}"><b>${sum.level}</b><small>${R.record ? 'Record' : 'Niveau'}</small></div>
      <div><b class="gold-t cu" data-n="${R.gold}">${fmt(R.gold)}</b><small>Or gagné</small></div>
    </div>
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
    ${sum.combo >= 10 || sum.evos?.length ? `<p class="build-sub">${sum.combo >= 10 ? `<span>Meilleur combo <b>${fmt(sum.combo)}</b></span>` : ''}${sum.evos?.length ? `<span>Évolution${sum.evos.length > 1 ? 's' : ''} <b>${sum.evos.map(id => esc(DATA.WEAPON_EVOS?.[id]?.name || WEAPONS[id]?.name || id)).join(', ')}</b></span>` : ''}</p>` : ''}
    ${!won ? `<p class="tip">${tipFor(sum, k)}</p>` : ''}
    <div class="end-btns">
      <button class="btn ghost" data-act="home">${iconImg('home', 16)} Accueil</button>
      <button class="btn primary" data-act="again">${nextLabel}</button>
    </div>
  </div>`);
  $$('.reward-screen .cu').forEach(el => countUp(el, +el.dataset.n || 0, 900));
  for (const it of R.found) delete it._eq;
  if (R.got?.length) sfx('loot');
  R.got = [];
  bind($('.reward-screen'), {
    home: () => home('adventure'),
    again: () => {
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

function announceAchievements() {
  for (const a of checkAchievements()) {
    toast(`${iconImg('crown', 18)} Succès : <b>${esc(a.name)}</b> (+${a.gold} or)`, 3200);
    sfx('loot');
  }
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
  return `<${tag} class="itile r-${it.rarity}" ${act ? `data-act="item" data-id="${it.id}"` : ''}>
    ${isNew ? '<i class="it-new">Nouveau</i>' : ''}
    <span class="it-ic">${iconImg(it.icon, 40)}${it.lv ? `<em class="lv-badge">+${it.lv}</em>` : ''}${better ? '<i class="it-better" aria-label="Meilleur">▲</i>' : ''}${it.crafted ? `<i class="it-forged">${iconImg('hammer', 12)}</i>` : ''}</span>
    <b class="it-name">${esc(it.name)}</b>
    ${m ? `<span class="it-main">${affShort(m, it.stat[m])}</span>` : ''}
    <span class="it-aff">${ks.slice(1).map(k => iconImg(AFX[k]?.[0] || 'star', 14)).join('')}${it.effect ? '<i class="it-fx">★</i>' : ''}</span>
  </${tag}>`;
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
    return `<button class="pet-card ${owned ? '' : 'locked'} ${save.pet === id ? 'on' : ''}" ${owned ? `data-act="pet" data-id="${id}"` : ''}>
      ${owned ? `<img class="px spr" src="${creatureURL('pet-' + id, p.body, p.pal)}" alt="">` : iconImg('lock', 24)}
      <b>${owned ? esc(p.name) : '???'}</b>
      <small>${owned ? esc(p.desc) : `Terminez « ${esc(ZONES[p.zone].name)} »`}</small>
      ${save.pet === id ? '<em>Actif</em>' : ''}
    </button>`;
  }).join('');
  const boosts = Object.keys(BOOSTS).filter(id => save.boosts[id] > 0);
  const nB = boosts.reduce((n, id) => n + save.boosts[id], 0);
  for (const i of save.inventory) delete i.isNew;
  persist({ touch: false });
  return `${heroCard()}
    <h3 class="section-t">Équipé</h3>
    <div class="slots">${slots}</div>
    <h3 class="section-t">Sac <small>${list.length} objet${list.length > 1 ? 's' : ''}</small></h3>
    <div class="filters">${[['all', 'Tout'], ...Object.entries(SLOTS)].map(([k, l]) => `<button class="chip-btn ${gearFilter === k ? 'on' : ''}" data-act="filter" data-f="${k}">${l}</button>`).join('')}
      ${list.some(i => i.rarity === 'common' && !i.lv) ? '<button class="chip-btn sell" data-act="sellJunk">Trier les communs</button>' : ''}</div>
    ${list.length ? `<div class="inv-grid">${list.map(it => itemTile(it, { cur: save.inventory.find(i => i.id === save.equipped[it.slot]) || null, isNew: fresh.has(it.id) })).join('')}</div>`
    : '<p class="muted center empty-note">Ouvrez des coffres de butin et battez des boss pour trouver de l\'équipement.</p>'}
    <h3 class="section-t">Familier <small>${save.pets.length}/6</small></h3>
    <div class="pets">${pets}</div>
    <h3 class="section-t">Bonus <small>${nB} en stock</small></h3>
    ${boosts.length ? `<div class="boost-inv">${boosts.map(id => `<div class="bi-chip">${iconImg(BOOSTS[id].icon, 28)}<span><b>${esc(BOOSTS[id].name)}</b><small>${esc(BOOSTS[id].desc)}</small></span><em>×${save.boosts[id]}</em></div>`).join('')}</div>
      <p class="muted bi-note">Choisissez-les dans la fiche d'une zone, juste avant de partir.</p>`
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
      <span class="is-ic">${iconImg(it.icon, 56)}${lv ? `<em class="lv-badge">+${lv}</em>` : ''}</span>
      <div class="is-head"><span class="rc-rar">${r.name}</span><span class="is-slot">${SLOTS[it.slot]}${it.crafted ? ' · <span class="forged-t">Forgé +10 %</span>' : ''}${equipped ? ' · <span class="eq-t">Équipé</span>' : ''}</span>
        <div class="lv-pips" aria-label="Niveau ${lv}">${pips}</div></div>
      <span class="is-pow"><small>Puissance</small><b>${fmt(itemPower(it))}</b>${cmp ? (() => { const d = Math.round(itemPower(it) - itemPower(cmp)); return d ? `<i class="sr-d ${d > 0 ? 'up' : 'down'}">${d > 0 ? '▲ +' : '▼ −'}${fmt(Math.abs(d))}</i>` : ''; })() : ''}</span>
    </div>
    <div class="is-stats">${statRows(it, { cmp })}</div>
    ${it.effect ? effectBox(it.effect) : ''}
    ${cmp ? `<p class="is-cmp"><i class="sr-d up">▲</i><i class="sr-d down">▼</i><span>par rapport à <b>${itemName(cmp)}</b>, équipé</span></p>` : ''}
    ${up}
    ${equipped ? '' : `<button class="btn small ghost it-salv" data-v="salvage">${iconImg('spin', 16)} Recycler : +${salvageValue(it)} ${esc(PARTS[it.slot].plural.toLowerCase())}</button>`}`;
}

async function itemSheet(id) {
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
  toast(`${iconImg(it.icon, 16)} ${esc(it.name)} équipé`);
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

// ---------- Forge ----------
let forgeSel = { slot: 'weapon', r: 0 };
const rTag = r => `<i class="rtag" style="--rc:${RARITY[RARITIES[r]].color}">${RARITY[RARITIES[r]].name}</i>`;

function forgeTab() {
  return `<section class="forge-hero">
      <div class="fh-art"><i class="fh-fire"></i><img class="fh-anvil" src="${anvilURL()}" alt=""><img class="fh-hammer" src="${hammerURL()}" alt=""></div>
      <div class="fh-txt"><b>La Forge</b><small>Fabriquez de l'équipement avec les pièces trouvées dans les coffres de butin.</small></div>
    </section>
    <div id="forgeBody">${forgeBody()}</div>`;
}

function forgeBody() {
  const total = Object.values(save.parts).reduce((n, a) => n + a.reduce((x, y) => x + y, 0), 0);
  const { slot, r } = forgeSel, have = save.parts[slot][r], R = RARITY[RARITIES[r]];
  const cost = FORGE.craft.gold[r], top = r >= RARITIES.length - 1;
  const grid = `<div class="parts-grid">
    <span></span>${RARITIES.map((_, k) => `<span class="pg-h" style="color:${RARITY[RARITIES[k]].color}">${RARITY[RARITIES[k]].name}</span>`).join('')}
    ${Object.keys(PARTS).map(s => `<span class="pg-row">${iconImg(PARTS[s].icon, 18)}${SLOTS[s]}</span>${RARITIES.map((_, k) => {
      const n = save.parts[s][k];
      return `<button class="pg-cell ${n ? '' : 'zero'} ${s === slot && k === r ? 'on' : ''} ${canCraft(s, k) ? 'ready' : ''}" data-act="forgeSel" data-slot="${s}" data-r="${k}" style="--rc:${RARITY[RARITIES[k]].color}">
        ${partIcon(s, k, 22)}<b>${n}</b></button>`;
    }).join('')}`).join('')}
  </div>`;
  const nFuse = Math.floor(have / FORGE.fuse);
  return `<h3 class="section-t">Pièces <small>${total} au total</small></h3>
    ${grid}
    <div class="forge-panel card">
      <div class="fp-head">${partIcon(slot, r, 30)}<div><b>${esc(PARTS[slot].plural)}</b><small>${rTag(r)} ${have} en stock</small></div></div>
      <div class="fp-act">
        <div class="fp-t"><b>${iconImg('hammer', 16)} Fabriquer</b><small>Un objet ${rTag(r)} (${SLOTS[slot].toLowerCase()}) de la puissance du monde ${save.unlockedZone + 1}, +10 %.</small></div>
        <div class="fp-go">
          <span class="iu-cost ${have >= FORGE.craft.parts ? '' : 'bad'}">${partIcon(slot, r, 16)} ${have}/${FORGE.craft.parts}</span>
          <span class="iu-cost ${save.gold >= cost ? '' : 'bad'}">${iconImg('gold', 14)} ${fmt(cost)}</span>
          <button class="btn primary small" data-act="craft" ${canCraft(slot, r) ? '' : 'disabled'}>Fabriquer</button>
        </div>
      </div>
      <div class="fp-act">
        <div class="fp-t"><b>${iconImg('upg', 16)} Fusionner</b><small>${top ? 'Rareté maximale : ces pièces servent à fabriquer et améliorer les objets légendaires.' : `${FORGE.fuse} pièces ${rTag(r)} → 1 pièce ${rTag(r + 1)}`}</small></div>
        ${top ? '' : `<div class="fp-go">
          <span class="iu-cost ${have >= FORGE.fuse ? '' : 'bad'}">${partIcon(slot, r, 16)} ${have}/${FORGE.fuse}</span>
          ${nFuse > 1 ? `<button class="btn ghost small" data-act="fuse" data-all="1">Tout (×${nFuse})</button>` : ''}
          <button class="btn small" data-act="fuse" ${canFuse(slot, r) ? '' : 'disabled'}>Fusionner</button>
        </div>`}
      </div>
    </div>
    <p class="muted forge-note">${iconImg('upg', 14)}<span>Améliorez (+1 à +${FORGE.upgrade.max}) ou recyclez vos objets depuis l'onglet <b>Équipement</b>.</span></p>`;
}

// met à jour la forge sur place (garde le défilement), l'or et les pastilles
function renderForge() {
  const b = $('#forgeBody');
  if (!b) return home();
  b.innerHTML = forgeBody();
  refreshTopbar();
  const t = $('.tabs'); if (t) t.outerHTML = nav();
}

// animation de forge : le marteau frappe trois fois l'enclume, puis l'objet apparaît
function forgeAnim(result, { title = 'Objet forgé', fuse = null } = {}) {
  return new Promise(resolve => {
    const w = document.createElement('div');
    w.className = 'forge-anim' + (fuse ? ' fusing' : '');
    w.innerHTML = `<div class="fa-stage">
        <i class="fa-glow"></i>
        ${fuse ? `<div class="fu-row">${Array.from({ length: Math.min(4, FORGE.fuse) }, (_, i) => `<span class="fu-p" style="--x:${(1.5 - i) * 62}px">${partIcon(fuse.slot, fuse.r, 30)}</span>`).join('')}</div>` : ''}
        <img class="fa-anvil" src="${anvilURL()}" alt=""><i class="fa-ingot"></i>
        <img class="fa-hammer" src="${hammerURL()}" alt=""><div class="fa-sparks"></div>
      </div>
      <p class="fa-wait eyebrow">${fuse ? 'Fusion en cours' : 'Forge en cours'}</p>
      <div class="fa-result" style="--rc:${result.color}"><i class="fa-rays"></i>
        <div class="fa-head"><span class="eyebrow">${fuse ? 'Forge · fusion' : 'Forge · fabrication'}</span><h2 class="fa-title">${title}</h2></div>
        <div class="fa-card ${result.bare ? 'bare' : ''}">${result.html}</div></div>
      <button class="btn primary big fa-ok" disabled>Continuer</button>`;
    app.appendChild(w);
    requestAnimationFrame(() => w.classList.add('in'));
    const sparks = w.querySelector('.fa-sparks'), ingot = w.querySelector('.fa-ingot');
    const hit = () => {
      buzz(20);
      ingot.classList.remove('hit'); void ingot.offsetWidth; ingot.classList.add('hit');
      for (let i = 0; i < 9; i++) {
        const s = document.createElement('i'), a = -Math.PI * (0.1 + Math.random() * 0.8), d = 40 + Math.random() * 70;
        s.style.cssText = `--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d}px`;
        sparks.appendChild(s); setTimeout(() => s.remove(), 600);
      }
    };
    const off = fuse ? 250 : 0; // la fusion commence par rassembler les pièces
    setTimeout(() => sfx('forge'), 380 + off);
    [380, 540, 700].forEach(t => setTimeout(hit, t + off));
    setTimeout(() => { w.classList.add('done'); sfx(result.big ? 'win' : 'loot'); }, 1050 + off);
    setTimeout(() => { w.querySelector('.fa-ok').disabled = false; }, 1450 + off);
    w.addEventListener('click', e => {
      const b = e.target.closest('.fa-ok'); if (!b || b.disabled) return;
      sfx('tap'); w.classList.add('out');
      setTimeout(() => { w.remove(); resolve(); }, 200);
    });
  });
}

async function doCraft() {
  const { slot, r } = forgeSel;
  const res = craftItem(slot, r);
  if (!res) return;
  const it = res.item, R = RARITY[it.rarity];
  renderForge();
  await forgeAnim({ color: R.color, big: r >= 3, bare: true, html: itemCard(it, { ribbon: 'Forgé !' }) });
  announceAchievements();
  renderForge();
}

async function doFuse(all = false) {
  const { slot, r } = forgeSel;
  let n = 0;
  while (canFuse(slot, r) && (all || !n)) { fuseParts(slot, r); n++; }
  if (!n) return;
  const R = RARITY[RARITIES[r + 1]];
  renderForge();
  await forgeAnim({ color: R.color, html: `${partIcon(slot, r + 1, 48)}<b>${esc(PARTS[slot].name)} ×${n}</b><small style="color:${R.color}">${R.name}</small>` }, { title: 'Fusion réussie', fuse: { slot, r } });
  renderForge();
}

// ---------- Boutique ----------
function shopTab() {
  return `<h3 class="section-t first">Améliorations permanentes</h3>
    <p class="muted shop-intro">Elles valent pour tous les champions.</p>
    <div class="upgrades">${Object.entries(UPGRADES).map(([k, u]) => {
      const lvl = save.upgrades[k], max = lvl >= u.max, cost = upgradeCost(k);
      return `<div class="upgrade">
        ${iconImg(u.icon, 36)}
        <div class="u-txt"><b>${u.name}</b><small>${u.desc}</small>
          <div class="lvl"><span>Niv. ${lvl}/${u.max}</span>${u.max <= 12 ? `<div class="seg-bar">${Array.from({ length: u.max }, (_, k) => `<i class="${k < lvl ? 'on' : ''}"></i>`).join('')}</div>` : `<div class="lbar"><i style="width:${lvl / u.max * 100}%"></i></div>`}</div></div>
        <button class="btn ${max ? 'ghost' : 'buy'} small" data-act="buy" data-k="${k}" ${max || save.gold < cost ? 'disabled' : ''}>
          ${max ? 'Max' : `${iconImg('gold', 14)} ${fmt(cost)}`}
        </button>
      </div>`;
    }).join('')}</div>
    <h3 class="section-t">Bonus <small>pour une seule partie</small></h3>
    <p class="muted shop-intro">Choisissez-en jusqu'à ${BOOST_SLOTS} dans la fiche d'une zone avant de partir.</p>
    <div class="upgrades boost-shop">${Object.entries(BOOSTS).map(([id, b]) => isFree('boost', id) ? `<div class="upgrade boost-card">
        <span class="bo-ic">${iconImg(b.icon, 32)}${save.boosts[id] ? `<i class="bo-n">×${save.boosts[id]}</i>` : ''}</span>
        <div class="u-txt"><b>${esc(b.name)}</b><small>${esc(b.desc)}</small></div>
        <button class="btn buy small" data-act="buyBoost" data-id="${id}" ${save.gold < b.price ? 'disabled' : ''}>${iconImg('gold', 14)} ${fmt(b.price)}</button>
      </div>` : `<div class="upgrade boost-card locked" data-act="defis">
        <span class="bo-ic">${iconImg(b.icon, 32)}${save.boosts[id] ? `<i class="bo-n">×${save.boosts[id]}</i>` : ''}</span>
        <div class="u-txt"><b>${esc(b.name)}</b><small>${esc(b.desc)}</small><small class="lk-l">${iconImg('lock', 12)} ${esc(lockLine('boost:' + id))}</small></div>
        <span class="lk-b">${iconImg('lock', 18)}</span>
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
  if (save.gold < cost || save.upgrades[k] >= UPGRADES[k].max) return;
  save.gold -= cost;
  save.upgrades[k]++;
  persist();
  sfx('coin');
  toast(`${iconImg(UPGRADES[k].icon, 16)} ${UPGRADES[k].name} niveau ${save.upgrades[k]}`);
  home();
}

// ---------- Succès ----------
function trophiesTab() {
  const n = Object.keys(save.achievements).length;
  const st = save.stats;
  const seen = Object.keys(st.seen).length;
  return `<div class="stat-grid">
      <div><b>${fmt(st.wins)}</b><small>Boss vaincus</small></div>
      <div><b>${seen}/${MONSTER_COUNT + BOSS_COUNT}</b><small>Bestiaire</small></div>
      <div><b>${fmt(st.kills || 0)}</b><small>Monstres vaincus</small></div>
      <div><b>${fmt(st.ults)}</b><small>Ultimes</small></div>
      <div><b>${st.runs ? (st.bestStage || 0) + 1 : 0}</b><small>Mondes d'affilée</small></div>
      <div><b>${fmt(st.totems || 0)}</b><small>Totems</small></div>
      <div><b>${fmt(st.chests || 0)}</b><small>Coffres ouverts</small></div>
      <div><b>${fmt(st.crafted || 0)}</b><small>Objets forgés</small></div>
    </div>
    <h3 class="section-t">Succès <small>${n}/${ACHIEVEMENTS.length}</small></h3>
    <div class="achs">${ACHIEVEMENTS.map(a => {
      const got = save.achievements[a.id];
      return `<div class="ach ${got ? 'got' : ''}">${iconImg(got ? 'crown' : 'lock', 26)}<div><b>${esc(a.name)}</b><small>${esc(a.desc)}</small></div><span>${iconImg('gold', 12)} ${a.gold}</span></div>`;
    }).join('')}</div>
    <h3 class="section-t">Bestiaire</h3>
    <div class="bestiary">${ZONES.map(z => zoneSteps(z).map((m, k) => {
      const known = st.seen[m.name];
      return `<div class="beast ${known ? '' : 'unknown'} ${m.boss ? 'boss' : ''}"><img class="px spr" src="${creatureURL(`${z.id}-${k}-${m.name}`, m.body, m.pal, { boss: m.boss })}" alt=""><small>${known ? esc(m.name) : '???'}</small></div>`;
    }).join('')).join('')}</div>`;
}

// ---------- Compte & options ----------
async function settings() {
  const u = cloud.user;
  const statusTxt = {
    synced: 'Sauvegarde synchronisée',
    syncing: 'Synchronisation…',
    pending: 'Hors ligne : sera synchronisé au retour du réseau',
    error: 'Erreur de synchronisation, nouvel essai bientôt',
    off: '',
  }[cloud.status] || '';
  const acct = !cloud.available
    ? `<p class="muted set-note">La connexion Google n'est pas encore configurée sur cette version. Votre progression est sauvegardée sur cet appareil.</p>`
    : u
      ? `<div class="acct">${u.avatar ? `<img class="avatar" src="${esc(u.avatar)}" alt="" referrerpolicy="no-referrer">` : ''}<div><b>${esc(u.name || u.email)}</b><small>${esc(u.email || '')}</small><small class="sync-t ${cloud.status}">${statusTxt}</small></div></div>`
      : `<p class="set-note">Connectez-vous pour <b>sauvegarder votre progression en ligne</b> et la retrouver sur un autre appareil. Le jeu reste jouable hors connexion.</p>
         <button class="btn google" data-v="login"><svg viewBox="0 0 48 48" width="18" height="18"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 6.9-10.3 6.9-17.7z"/><path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.2 1.5-5 2.3-8.2 2.3-6.2 0-11.5-4.1-13.4-9.8l-7.9 6.1C6.6 42.6 14.6 48 24 48z"/></svg> Se connecter avec Google</button>`;
  const wrapId = 'set-' + Date.now();
  const S = save.settings;
  const seg = (k, opts) => `<div class="seg" data-k="${k}">${opts.map(([v, l]) => `<button data-sv="${v}" class="${String(S[k]) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  const row = (ic, label, sub, ctrl, col = false) => `<div class="set-row ${col ? 'col' : ''}">${iconImg(ic, 20)}<span class="set-l">${label}${sub ? `<small>${sub}</small>` : ''}</span>${ctrl}</div>`;
  const sw = (id, on) => `<label class="sw"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}><i></i></label>`;
  const joyTxt = v => `${Math.round(v * 100)} %`;
  const p = modal({
    title: 'Options',
    cls: 'settings-modal',
    body: `<div id="${wrapId}">
      <h4 class="first">Jeu</h4>
      <div class="set-list">
        ${row('shake', 'Tremblements de l\'écran', '', seg('shake', [[0, 'Aucun'], [1, 'Faibles'], [2, 'Normaux']]), true)}
        ${row('numbers', 'Chiffres de dégâts', '', seg('numbers', [['all', 'Tous'], ['crit', 'Critiques'], ['none', 'Aucun']]), true)}
        ${row('joystick', 'Taille du joystick', '', `<span class="range"><input type="range" id="sJoy" min="0.8" max="1.3" step="0.05" value="${S.joySize}"><b id="sJoyV">${joyTxt(S.joySize)}</b></span>`)}
        ${row('hand', 'Mode gaucher', 'Bouton d\'ultime à gauche', sw('sLefty', S.lefty))}
      </div>
      <h4>Son</h4>
      <div class="set-list">
        ${row('sound', 'Effets sonores', '', sw('sSound', S.sound))}
        ${row('music', 'Musique', '', sw('sMus', S.music !== false))}
        ${row('vibrate', 'Vibrations', '', sw('sVib', S.vibrate))}
      </div>
      <h4>Compte</h4>${acct}
      <h4 class="web-only">Installer sur iPhone</h4>
      <p class="muted set-note web-only">Dans Safari, touchez <b>Partager</b> puis <b>« Sur l'écran d'accueil »</b>. Le jeu s'ouvrira en plein écran et fonctionnera hors connexion.</p>
      <div class="danger-zone">
        ${u ? '<button class="btn ghost small" data-v="logout">Se déconnecter</button>' : ''}
        <button class="btn ghost small danger" data-v="reset">Effacer la progression</button>
      </div>
      <p class="ver">League of Bonk · ${APP_VERSION}</p>
    </div>`,
    buttons: [{ label: 'Fermer', cls: 'primary', value: 'close' }],
    dismissable: true,
  });
  // boutons internes
  const wrap = document.getElementById(wrapId);
  const o = { shake: S.shake, numbers: S.numbers };
  let action = null;
  wrap.addEventListener('click', e => {
    const sv = e.target.closest('[data-sv]');
    if (sv) {
      const g = sv.closest('.seg'), k = g.dataset.k;
      o[k] = k === 'shake' ? +sv.dataset.sv : sv.dataset.sv;
      g.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === sv));
      sfx('tap'); return;
    }
    const b = e.target.closest('[data-v]');
    if (!b) return;
    action = b.dataset.v;
    wrap.closest('.modal-wrap').querySelector('.modal-btns .btn').click();
  });
  wrap.querySelector('#sJoy').addEventListener('input', e => { wrap.querySelector('#sJoyV').textContent = joyTxt(+e.target.value); });
  await p;
  S.sound = wrap.querySelector('#sSound').checked;
  S.vibrate = wrap.querySelector('#sVib').checked;
  S.lefty = wrap.querySelector('#sLefty').checked;
  S.joySize = Math.max(0.8, Math.min(1.3, +wrap.querySelector('#sJoy').value || 1));
  Object.assign(S, o);
  const mOn = wrap.querySelector('#sMus').checked;
  if (mOn !== S.music) { S.music = mOn; if (!mOn) stopMusic(); }
  persist({ touch: false });
  if (action === 'login') return cloud.signIn();
  if (action === 'logout') {
    const ok = await modal({ title: 'Se déconnecter ?', body: '<p>Votre progression reste sur cet appareil et dans votre compte.</p>', buttons: [{ label: 'Annuler', cls: 'ghost', value: false }, { label: 'Se déconnecter', cls: 'primary', value: true }] });
    if (ok) { await cloud.signOut(); home(); }
  }
  if (action === 'reset') {
    const ok = await modal({ title: 'Tout effacer ?', body: '<p>Votre or, vos objets, familiers et zones débloquées seront <b>définitivement</b> supprimés de cet appareil' + (u ? ' et de votre compte' : '') + '.</p>', buttons: [{ label: 'Annuler', cls: 'ghost', value: false }, { label: 'Tout effacer', cls: 'danger', value: true }] });
    if (ok) { resetSave(); boot(); }
  }
  if (!battle) home();
}

// rafraîchit l'écran quand la sauvegarde arrive du cloud
export function onRemoteSave() {
  if (battle) return;
  if (!save.cls) return classSelect(true);
  home();
  toast('Progression récupérée depuis votre compte');
}
