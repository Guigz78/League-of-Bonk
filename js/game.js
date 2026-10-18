// Écrans du jeu et déroulé d'une expédition.
import { CLASSES, WEAPONS, TOMES, ULTS, ZONE_TIME, EVOLUTIONS, BOONS, ZONES, PETS, PET_BY_ZONE, SLOTS, RARITY, BOSS_ITEMS, UPGRADES, ACHIEVEMENTS, MONSTER_COUNT, BOSS_COUNT, DIFFICULTIES, ELITE_MODS,
  LOOT_TIERS, RARITIES, PARTS, FORGE, BOOSTS, BOOST_SLOTS, HEAT_GOLD } from './data.js';
import { save, persist, playerStats, upgradeCost, makeItem, addItem, itemPower, sellValue, checkAchievements, resetSave, maxDiff,
  openChest, canCraft, craftItem, canFuse, fuseParts, itemUpgradeCost, canUpgrade, upgradeItem, statsAt, salvageValue, salvageItem,
  buyBoost, cleanBoostSel, consumeBoosts, rarityIdx } from './save.js';
import { iconImg, chestURL, anvilURL, hammerURL } from './art.js';
import { heroURL, creatureURL } from './g2d/sprites.js';
import { rng } from './pixel.js';
import { sfx, music, stopMusic } from './audio.js';
import { app, mount, $, $$, bind, modal, toast, fmt, pct, esc, wait } from './ui.js';
import { Run } from './run.js';
import { mountPreview } from './g2d/preview.js';
import { zoneBannerURL } from './g2d/world.js';
import { showRewardedAd } from './ads.js';
import { cloud } from './cloud.js';

let tab = 'adventure';
let battle = null;
let gearFilter = 'all';

// ---------- Démarrage ----------
export function boot() {
  cloud.onChange(() => { if (!battle) refreshTopbar(); });
  if (!save.cls) return classSelect(true);
  home();
}

// ---------- Barre du haut ----------
function topbar() {
  const u = cloud.user;
  const st = cloud.status;
  const dot = !u ? '' : `<i class="sync ${st}"></i>`;
  return `<header class="topbar">
    <div class="gold">${iconImg('gold', 20)}<b id="goldN">${fmt(save.gold)}</b></div>
    <div class="logo-sm">League <span>of</span> Bonk</div>
    <button class="icon-btn account" data-act="settings" aria-label="Compte et options">
      ${u?.avatar ? `<img class="avatar" src="${esc(u.avatar)}" alt="" referrerpolicy="no-referrer">` : iconImg('crown', 20)}${dot}
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
    ['adventure', 'Aventure', 'star'],
    ['gear', 'Équipement', 'armor'],
    ['forge', 'Forge', 'hammer'],
    ['shop', 'Boutique', 'gold'],
    ['trophies', 'Succès', 'crown'],
  ];
  const nChests = save.pendingChests.length;
  const badge = { gear: save.inventory.some(i => i.isNew), trophies: false, shop: canAffordUpgrade(), forge: canForgeSomething() };
  return `<nav class="tabs">${items.map(([id, label, ic]) => `
    <button class="tab ${tab === id ? 'on' : ''}" data-act="tab" data-tab="${id}">
      ${iconImg(ic, 22)}<span>${label}</span>${id === 'adventure' && nChests ? `<i class="badge count">${nChests}</i>` : badge[id] ? '<i class="badge"></i>' : ''}
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
  // même onglet : on garde la position de défilement (achats en bas de la boutique…)
  const keep = !t || t === tab ? $('#hubMain')?.scrollTop || 0 : 0;
  if (t) tab = t;
  const body = { adventure: adventureTab, gear: gearTab, forge: forgeTab, shop: shopTab, trophies: trophiesTab }[tab]();
  mount(`<div class="hub">${topbar()}<main class="hub-main" id="hubMain">${body}</main>${nav()}</div>`);
  if (keep) $('#hubMain').scrollTop = keep;
  bind($('.hub'), handlers);
  mountPreview($('.hc-3d'), save.cls);
}

const handlers = {
  tab: el => home(el.dataset.tab),
  settings: () => settings(),
  zone: el => zoneSheet(+el.dataset.z),
  changeClass: () => classSelect(false),
  equip: el => equipItem(+el.dataset.id),
  item: el => itemSheet(+el.dataset.id),
  filter: el => { gearFilter = el.dataset.f; home(); },
  pet: el => { save.pet = save.pet === el.dataset.id ? null : el.dataset.id; persist(); home(); },
  buy: el => buyUpgrade(el.dataset.k),
  sellJunk: () => sellJunk(),
  chests: () => chestScreen(() => home('adventure')),
  forgeSel: el => { forgeSel = { slot: el.dataset.slot, r: +el.dataset.r }; renderForge(); },
  craft: () => doCraft(),
  fuse: el => doFuse(el.dataset.all === '1'),
  buyBoost: el => doBuyBoost(el.dataset.id),
};

function heroCard() {
  const c = CLASSES[save.cls], st = playerStats();
  return `<section class="card hero-card">
    <div class="hc-sprite"><canvas class="hc-3d"></canvas>
      ${save.pet ? `<img class="px spr hc-pet" src="${creatureURL('pet-' + save.pet, PETS[save.pet].body, PETS[save.pet].pal)}" alt="">` : ''}
    </div>
    <div class="hc-info">
      <div class="hc-name">${esc(c.name)} <small>${c.role}</small></div>
      <div class="stats">
        <span>${iconImg('heart', 16)}<b>${st.hp}</b></span>
        <span>${iconImg('fist', 16)}<b>${st.atk}</b></span>
        <span>${iconImg('target', 16)}<b>${pct(st.crit)}</b></span>
        <span>${iconImg('arrow', 16)}<b>${pct(st.speed)}</b></span>
      </div>
      <button class="btn small ghost" data-act="changeClass">Changer de champion</button>
    </div>
  </section>`;
}

function adventureTab() {
  const done = save.zoneCleared.filter(Boolean).length;
  // coffres de butin pas encore ouverts (appli fermée en cours de route, ou « plus tard »)
  const pc = save.pendingChests, best = pc.reduce((m, c) => Math.max(m, c.tier), 0);
  const resume = pc.length ? `<button class="chest-cta" data-act="chests" style="--tc:${LOOT_TIERS[best].color}">
      <img class="cc-img" src="${chestURL(best)}" alt="">
      <div class="cc-txt"><b>${pc.length} coffre${pc.length > 1 ? 's' : ''} de butin</b><small>à ouvrir : pièces, bonus, objets et or !</small></div>
      <span class="btn primary small">Ouvrir</span>
    </button>` : '';
  const zones = ZONES.map((z, i) => {
    const locked = i > save.unlockedZone;
    const cleared = save.zoneCleared[i];
    const stars = save.diffCleared[i] || 0;
    const sprite = z.boss ? creatureURL(`${z.id}-${zoneSteps(z).length - 1}-${z.boss.name}`, z.boss.body, z.boss.pal, { boss: true })
      : creatureURL(`${z.id}-4-${z.monsters[4].name}`, z.monsters[4].body, z.monsters[4].pal);
    return `<button class="zone ${locked ? 'locked' : ''} ${cleared ? 'cleared' : ''} ${i === 0 && !save.stats.runs && !cleared ? 'cta' : ''}" data-act="zone" data-z="${i}" style="background-image:url(${zoneBannerURL(z)})">
      <div class="z-num">${i + 1}</div>
      <div class="z-txt"><b>${esc(z.name)}</b>${i === 0 && !save.stats.runs && !cleared ? '<em class="start">Commencez ici !</em>' : ''}<small>${locked ? `Terminez « ${esc(ZONES[i - 1].name)} »` : esc(z.sub)}</small></div>
      <div class="z-art">${locked ? iconImg('lock', 28) : `<img class="px spr" src="${sprite}" alt="">`}</div>
      ${cleared ? zoneStars(stars) : ''}
    </button>`;
  }).join('');
  return `${heroCard()}${resume}
    <h3 class="section-t">Carte de Runeterre <small>${done}/6 zones</small></h3>
    <div class="zones">${zones}</div>`;
}

// badge de la carte de zone : une icône par niveau de difficulté, allumée quand il est battu
function zoneStars(n) {
  const label = n >= DIFFICULTIES.length ? 'Zone maîtrisée' : `${DIFFICULTIES[n - 1].name} battu`;
  return `<div class="z-done z-stars s${n}" aria-label="${esc(label)}">${DIFFICULTIES.map((d, k) =>
    `<i class="zs ${k < n ? 'on' : ''}" style="--dc:${d.color}">${iconImg(d.icon, 13)}</i>`).join('')}</div>`;
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
      <div class="rw">${iconImg('gold', 18)} Or${k ? ` <b>${mul(D.gold)}</b>` : ''} et objets${k ? ' plus rares et plus puissants' : ''}</div>
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
  const id = 'zs-' + Date.now();
  const btn = k => {
    const D = DIFFICULTIES[k], locked = k > top, beaten = k < (save.diffCleared[i] || 0);
    return `<button class="diff-btn d${k} ${k === sel ? 'on' : ''} ${locked ? 'locked' : ''} ${beaten ? 'beaten' : ''}" data-d="${k}" role="radio" aria-checked="${k === sel}" style="--dc:${D.color}">
      <span class="db-ic">${iconImg(locked ? 'lock' : D.icon, 22)}</span><b>${esc(D.name)}</b>
      <small>${locked ? `Battez ${esc(DIFFICULTIES[k - 1].name)}` : beaten ? 'Battu' : 'À vaincre'}</small>
    </button>`;
  };
  const p = modal({
    title: esc(z.name),
    cls: 'zone-modal',
    body: `<div id="${id}"><p class="muted">${esc(z.sub)}</p>
      <div class="enemy-row">${steps.map((m, k) => `<div class="er ${m.boss ? 'boss' : ''}" title="${esc(m.name)}"><img class="px spr" src="${creatureURL(`${z.id}-${k}-${m.name}`, m.body, m.pal, { boss: m.boss })}" alt=""></div>`).join('')}</div>
      <h4>Difficulté</h4>
      <div class="diff-pick" role="radiogroup" aria-label="Niveau de difficulté">${DIFFICULTIES.map((_, k) => btn(k)).join('')}</div>
      <div class="diff-info d${sel}">${diffInfo(i, sel)}</div>
      <h4>Bonus pour la partie</h4>
      <div class="boost-box">${boostSlots()}</div>
      <h4>Objectif</h4>
      ${goalBox(i)}
      <div class="zone-rw">${zoneRewards(i, sel)}</div></div>`,
    buttons: [{ label: 'Retour', cls: 'ghost', value: false }, { label: 'Partir !', cls: 'primary', value: true }],
    dismissable: true,
  });
  const root = document.getElementById(id);
  let picking = -1;
  const drawBoosts = () => { root.querySelector('.boost-box').innerHTML = boostSlots(picking); };
  root?.addEventListener('click', e => {
    const slot = e.target.closest('.bslot'), opt = e.target.closest('.bp-opt');
    if (slot) { sfx('tap'); const k = +slot.dataset.s; picking = picking === k ? -1 : k; drawBoosts(); return; }
    if (opt && picking >= 0) {
      sfx(opt.dataset.id ? 'loot' : 'tap');
      save.boostSel[picking] = opt.dataset.id || null;
      picking = -1; persist({ touch: false }); drawBoosts();
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
    if (k === sel) return;
    sel = k;
    sfx('tap');
    root.querySelectorAll('.diff-btn').forEach(x => { const on = +x.dataset.d === k; x.classList.toggle('on', on); x.setAttribute('aria-checked', on); });
    const info = root.querySelector('.diff-info');
    info.className = `diff-info d${k}`; info.innerHTML = diffInfo(i, k);
    root.querySelector('.zone-rw').innerHTML = zoneRewards(i, k);
  });
  const ok = await p;
  if (save.diffSel[i] !== sel) { save.diffSel[i] = sel; persist({ touch: false }); }
  if (ok) startRun(i, sel);
}

// ---------- Choix de la classe ----------
function classSelect(first) {
  music('menu');
  let sel = save.cls || 'mage';
  const render = () => {
    const c = CLASSES[sel];
    mount(`<div class="class-select">
      ${first ? `<div class="title-logo"><div class="l1">League</div><div class="l2">of</div><div class="l3">Bonk</div></div>` : '<h2 class="cs-title">Choisissez votre champion</h2>'}
      ${first ? '<p class="cs-sub">Choisissez votre champion</p>' : ''}
      <div class="cs-tabs">${Object.values(CLASSES).map(k => `<button class="cs-tab ${k.id === sel ? 'on' : ''}" data-act="pick" data-c="${k.id}"><img class="px spr" src="${heroURL(k.id, k.colors)}" alt=""><span>${k.role}</span></button>`).join('')}</div>
      <section class="card cs-detail">
        <div class="cs-head"><canvas class="cs-3d"></canvas><div><h3>${esc(c.name)}</h3><div class="role">${c.role}</div><p>${esc(c.desc)}</p></div></div>
        <div class="evo-chain">${EVOLUTIONS[c.id].map((e, i) => `<span>${i ? `<em>niv. ${e.lvl}</em>` : '<em>départ</em>'}<b>${esc(e.name)}</b></span>`).join('<i>›</i>')}</div>
        <div class="stats wide">
          <span>${iconImg('heart', 16)} PV <b>${c.hp}</b></span>
          <span>${iconImg('fist', 16)} ATQ <b>${c.atk}</b></span>
          <span>${iconImg('target', 16)} Crit <b>${pct(c.crit)}</b></span>
          <span>${iconImg('arrow', 16)} Vitesse <b>${pct(c.speed)}</b></span>
        </div>
        <div class="cs-spells">
          <div class="cs-spell">${iconImg(WEAPONS[c.weapon].icon, 26)}<div><b>${esc(WEAPONS[c.weapon].name)}</b><small>Arme de départ · ${esc(WEAPONS[c.weapon].desc)}</small></div></div>
          <div class="cs-spell k-ult">${iconImg(ULTS[c.ult].icon, 26)}<div><b>${esc(ULTS[c.ult].name)}</b><small>Ultime · ${esc(ULTS[c.ult].desc)}</small></div></div>
        </div>
      </section>
      <button class="btn primary big" data-act="go">Jouer avec ${esc(c.name)}</button>
      ${first ? '' : '<button class="btn ghost" data-act="back">Retour</button>'}
      ${first ? '<p class="cs-note">Vous pourrez changer de champion à tout moment. L\'équipement et les améliorations sont partagés.</p>' : ''}
    </div>`);
    mountPreview($('.cs-3d'), sel);
    bind($('.class-select'), {
      pick: el => { sel = el.dataset.c; render(); },
      go: () => {
        save.cls = sel; persist();
        home('adventure');
      },
      back: () => home(),
    });
  };
  render();
}

// ---------- Partie ----------
let run = null;
let runBoosts = [];

function startRun(z, diff = 0) {
  diff = Math.max(0, Math.min(diff, maxDiff(z)));
  save.stats.runs++;
  const boosts = runBoosts = consumeBoosts(); // enregistre aussi la partie commencée
  const zone = ZONES[z];
  run = new Run({
    zone,
    diff,
    boosts,
    onPause: resume => pauseMenu(resume),
    onLevelUp: (title, opts, done, sub) => levelUpMenu(title, opts, done, sub),
    onChest: (c, gold, done) => chestMenu(c, gold, done),
    onDefeat: canRevive => defeatMenu(canRevive),
    onPortal: (info, choose) => portalMenu(info, choose),
    onEnd: sum => endRun(zone, sum),
  });
  run.onPortal ??= (info, choose) => portalMenu(info, choose);
  battle = run;
  window.__lobRun = run; // utile pour les tests automatisés
  run.start();
}

function choiceInfo(c) {
  if (c.kind === 'weapon') { const w = WEAPONS[c.id]; return { icon: w.icon, name: w.name, tag: c.lv === 1 ? 'Nouvelle arme' : `Arme · niv. ${c.lv}`, desc: c.lv === 1 ? w.desc : w.lv[c.lv - 1], cls: 'weapon' }; }
  if (c.kind === 'tome') { const t = TOMES[c.id]; return { icon: t.icon, name: t.name, tag: c.lv === 1 ? 'Nouveau tome' : `Tome · niv. ${c.lv}`, desc: t.desc, cls: 'tome' }; }
  if (c.kind === 'boon') { const b = BOONS[c.id]; return { icon: b.icon, name: b.name, tag: 'Bénédiction', desc: b.desc, cls: 'boon' }; }
  if (c.kind === 'heal') return { icon: 'heart', name: 'Soin', tag: 'Bonus', desc: 'Récupère 30 % de vos PV', cls: 'tome' };
  return { icon: 'gold', name: 'Bourse', tag: 'Bonus', desc: 'De l\'or en plus', cls: 'tome' };
}

function overlay(html) {
  const w = document.createElement('div');
  w.className = 'overlay';
  w.innerHTML = html;
  $('.run').appendChild(w);
  requestAnimationFrame(() => w.classList.add('in'));
  return w;
}

function levelUpMenu(title, opts, done, subtitle = 'Choisissez une amélioration') {
  const w = overlay(`<div class="lvlup">
    <h2>${esc(title)}</h2><p class="muted">${esc(subtitle)}</p>
    <div class="cards">${opts.map((c, i) => { const f = choiceInfo(c); return `<button class="card-up ${f.cls}" data-i="${i}">
      <span class="cu-ic">${iconImg(f.icon, 36)}</span>
      <span class="cu-txt"><em>${f.tag}</em><b>${esc(f.name)}</b><small>${esc(f.desc)}</small></span>
    </button>`; }).join('')}</div>
  </div>`);
  // petite pause pour éviter un choix accidentel pendant qu'on joue
  const btns = [...w.querySelectorAll('.card-up')];
  btns.forEach(b => b.disabled = true);
  setTimeout(() => btns.forEach(b => b.disabled = false), 450);
  w.addEventListener('click', e => {
    const b = e.target.closest('.card-up'); if (!b || b.disabled) return;
    sfx('tap');
    w.remove();
    done(opts[+b.dataset.i]);
  });
}

function chestMenu(c, gold, done) {
  const f = choiceInfo(c);
  const w = overlay(`<div class="lvlup chest">
    <h2>Coffre !</h2>
    <div class="cards"><div class="card-up ${f.cls} open"><span class="cu-ic">${iconImg(f.icon, 36)}</span><span class="cu-txt"><em>${f.tag}</em><b>${esc(f.name)}</b><small>${esc(f.desc)}</small></span></div></div>
    <p class="gold-t center">${iconImg('gold', 16)} +${fmt(gold)} or</p>
    <button class="btn primary big" disabled>Super !</button>
  </div>`);
  const b = w.querySelector('.btn');
  setTimeout(() => b.disabled = false, 450);
  b.addEventListener('click', () => { sfx('tap'); w.remove(); done(); });
}

// ---------- Portail entre deux mondes ----------
const bossImg = z => {
  const b = z.boss || z.monsters[4];
  return `<img class="px spr" src="${creatureURL(`${z.id}-${zoneSteps(z).length - 1}-${b.name}`, b.body, b.pal, { boss: !!z.boss })}" alt="">`;
};

function portalMenu(info, choose) {
  const from = ZONES[info.from] || ZONES[0], to = info.to == null ? null : ZONES[info.to];
  const nW = (info.stage || 0) + 1, cleared = info.cleared?.length ? info.cleared : [from.id];
  const stat = (ic, v, l) => `<div>${iconImg(ic, 18)}<b>${v}</b><small>${l}</small></div>`;
  const w = overlay(`<div class="portal-menu ${to ? '' : 'final'}">
    <div class="pm-vortex"><i></i><i></i><i></i><b>${iconImg(to ? 'portal' : 'crown', 34)}</b></div>
    <h2>${to ? 'Portail ouvert !' : 'Victoire finale !'}</h2>
    <p class="pm-sub">${to ? `Monde ${nW} vaincu : <b>${esc(from.name)}</b>` : 'Les six mondes sont vaincus. Runeterre est sauvée !'}</p>
    <div class="pm-stats">${stat('star', fmtTime(info.time || 0), 'Temps')}${stat('skull', fmt(info.kills || 0), 'Monstres')}${stat('gold', fmt(info.gold || 0), 'Or')}${stat('chest', info.loot || 0, 'Coffres')}</div>
    <div class="pm-bosses">${cleared.map(id => `<span class="pm-b" title="${esc(ZONES[id].name)}">${bossImg(ZONES[id])}<i>✓</i></span>`).join('')}</div>
    ${to ? `<button class="pm-next" data-v="next" style="background-image:url(${zoneBannerURL(to)})">
        <span class="pm-n">${nW + 1}</span>
        <span class="pm-t"><small>Monde suivant</small><b>${esc(to.name)}</b><em>Plus dur, plus de butin !</em></span>
        <span class="pm-boss">${bossImg(to)}</span>
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
    w.remove();
    choose(b.dataset.v);
  });
}

async function pauseMenu(resume) {
  const v = await modal({
    title: run.diffId ? `Pause <span class="diff-tag d${run.diffId}">${esc(run.diff.name)}</span>` : 'Pause',
    body: `<div class="toggles">
        <label class="toggle"><input type="checkbox" id="pSound" ${save.settings.sound ? 'checked' : ''}> Son</label>
        <label class="toggle"><input type="checkbox" id="pVib" ${save.settings.vibrate ? 'checked' : ''}> Vibrations</label>
        <label class="toggle"><input type="checkbox" id="pMus" ${save.settings.music !== false ? 'checked' : ''}> Musique</label>
      </div>
      <div class="howto">
        <p>${iconImg('arrow', 16)} <b>Se déplacer</b> : glissez le doigt n'importe où sur l'écran. Tout se joue avec un seul doigt.</p>
        <p>${iconImg('sword', 16)} <b>Attaquer</b> : c'est automatique ! Ramassez les gemmes pour monter de niveau et évoluer.</p>
        <p>${iconImg('i_heavy', 16)} <b>Sauter</b> : touchez brièvement l'écran pour passer par-dessus les monstres, les ondes de choc et les lasers des boss.</p>
        <p>${iconImg('skull', 16)} <b>Boss</b> : suivez la flèche jusqu'à l'<b>autel au crâne rouge</b> et restez dessus pour invoquer le boss. Le combat a lieu dans une arène fermée.</p>
        <p>${iconImg('portal', 16)} <b>Portail</b> : le boss vaincu ouvre un portail (suivez la flèche) vers le monde suivant, plus dur mais plus riche. Vous pouvez aussi rentrer avec votre butin.</p>
        <p>${iconImg('i_enrage', 16)} <b>Chrono</b> : quand il est écoulé, le boss arrive de lui-même et les monstres deviennent <b>fous</b>, de plus en plus. Ne traînez pas !</p>
        <p>${iconImg('i_burn', 16)} <b>Totems de défi</b> : restez près d'un totem pour l'activer. Le monde devient plus dur, mais vous gagnez de l'or, un coffre ou une bénédiction (et +${Math.round(HEAT_GOLD * 100)} % d'or au bilan).</p>
        <p>${iconImg('chest', 16)} <b>Coffres de butin</b> : ramassez-les, ils s'ouvrent à la fin de la partie. Leurs pièces servent à fabriquer de l'équipement à la Forge.</p>
        <p>${iconImg('gem', 16)} <b>Explorer</b> : les autels bleus donnent des bénédictions, les coffres dorés des améliorations.</p>
        <p>${iconImg('i_atk', 16)} <b>Attaques spéciales</b> : un monstre qui clignote ou un cercle rouge au sol annonce une attaque. Écartez-vous vite !</p>
        <p>${iconImg('crown', 16)} <b>Élites</b> : leur nom indique leur pouvoir (${Object.values(ELITE_MODS).map(m => esc(m.name)).join(', ')}). Fuyez les Explosifs quand ils tombent !</p>
        <p>${iconImg('nova', 16)} <b>Ultime</b> : se charge en battant des monstres et se lance tout seul quand des ennemis sont proches (ou touchez le bouton).</p>
      </div>
      ${runBoosts.length ? `<div class="cur-build boosts-on">${runBoosts.map(id => `<span>${iconImg(BOOSTS[id].icon, 18)} ${esc(BOOSTS[id].name)}</span>`).join('')}</div>` : ''}
      <div class="cur-build">${run.p.weapons.map(w => `<span>${iconImg(WEAPONS[w.id].icon, 18)} ${esc(WEAPONS[w.id].name)} <b>${w.lv}</b></span>`).join('')}${Object.entries(run.p.tomes).map(([id, lv]) => `<span>${iconImg(TOMES[id].icon, 18)} ${esc(TOMES[id].name)} <b>${lv}</b></span>`).join('')}</div>`,
    buttons: [{ label: 'Abandonner', cls: 'danger ghost', value: 'quit' }, { label: 'Reprendre', cls: 'primary', value: 'resume' }],
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
  const t = fmtTime(run.runTime ?? run.time), nLoot = run.loot?.length || 0;
  const kept = nLoot ? `<p class="muted">Vos <b>${nLoot} coffre${nLoot > 1 ? 's' : ''} de butin</b> et les mondes vaincus sont conservés.</p>` : '';
  const v = await modal({
    title: 'K.O. !',
    cls: 'ko-modal',
    body: canRevive
      ? `<p>Vous êtes tombé au combat après <b>${t}</b>.</p><p><b>Regardez une courte publicité</b> pour revenir avec tous vos PV. Les monstres autour de vous seront balayés.</p><p class="muted">Possible une fois par partie.</p>${kept}`
      : `<p>Vous êtes tombé au combat après <b>${t}</b>.</p>${kept}`,
    buttons: canRevive
      ? [{ label: 'Terminer', cls: 'ghost', value: 'quit' }, { label: `${iconImg('heart', 16)} Revivre (pub)`, cls: 'primary', value: 'ad' }]
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
  const k = sum.diff || 0, D = DIFFICULTIES[k];
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
      const bi = BOSS_ITEMS[id];
      if (bi) { const it = { ...bi, stat: { ...bi.stat }, id: save.nextId++, zone: id, isNew: true }; it._eq = addItem(it); found.push(it); }
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
  save.gold += gold;
  persist();
  const got = checkAchievements();
  persist();
  const R = { start, k, D, sum, cleared, worlds, found, gold, heat, heatGold, stage, unlocked, newZone, got,
    final: sum.final ?? (sum.win && cleared.includes(ZONES.length - 1)), reached: ZONES[Math.min(ZONES.length - 1, start.id + stage)] };
  sfx(cleared.length ? 'win' : 'coin');
  const show = opened => summaryScreen(R, opened);
  if (save.pendingChests.length) chestScreen(show, true); else show([]);
}

// ---------- Ouverture des coffres de butin ----------
// tuile d'une pièce d'équipement (couleur de sa rareté)
function partIcon(slot, r, size = 28) {
  return `<span class="part-ic" style="--rc:${RARITY[RARITIES[r]].color}">${iconImg(PARTS[slot].icon, size)}</span>`;
}

// regroupe le contenu de plusieurs coffres
function lootAgg(results) {
  const parts = {}, boosts = {}, items = [];
  let gold = 0;
  for (const res of results) {
    for (const p of res.parts) parts[p.slot + ':' + p.r] = (parts[p.slot + ':' + p.r] || 0) + p.n;
    if (res.boost) boosts[res.boost] = (boosts[res.boost] || 0) + 1;
    if (res.item) items.push({ it: res.item, eq: res.equipped });
    gold += res.gold;
  }
  return {
    parts: Object.entries(parts).map(([key, n]) => { const [slot, r] = key.split(':'); return { slot, r: +r, n }; }).sort((a, b) => b.r - a.r || b.n - a.n),
    boosts, items, gold,
  };
}

function lootCards(results) {
  const A = lootAgg(results), out = [];
  for (const { it, eq } of A.items) out.push(`<div class="lc lc-item" style="--rc:${RARITY[it.rarity].color}"><em class="lc-tag">Objet</em>${iconImg(it.icon, 44)}<b>${esc(it.name)}</b><small>${RARITY[it.rarity].name} · ${SLOTS[it.slot]}${eq ? ' · équipé !' : ''}</small><span class="lc-st">${statLine(it.stat)}</span></div>`);
  for (const [id, n] of Object.entries(A.boosts)) out.push(`<div class="lc lc-boost"><em class="lc-tag">Bonus</em>${iconImg(BOOSTS[id].icon, 34)}<b>${esc(BOOSTS[id].name)}</b>${n > 1 ? `<i class="lc-n">×${n}</i>` : ''}</div>`);
  for (const p of A.parts) out.push(`<div class="lc lc-part" style="--rc:${RARITY[RARITIES[p.r]].color}">${partIcon(p.slot, p.r, 30)}<b>${esc(PARTS[p.slot].name)}</b><small>${RARITY[RARITIES[p.r]].name}</small><i class="lc-n">×${p.n}</i></div>`);
  if (A.gold) out.push(`<div class="lc lc-gold">${iconImg('gold', 34)}<b>+${fmt(A.gold)}</b><small>Or</small></div>`);
  return out;
}

// scène plein écran : le coffre tremble, s'ouvre et son contenu jaillit
function revealStage(results, tier, title, { quick = false } = {}) {
  return new Promise(resolve => {
    const w = document.createElement('div');
    const cards = lootCards(results);
    w.className = `chest-stage t${tier}${cards.length > 6 ? ' many' : ''}`;
    w.style.setProperty('--tc', LOOT_TIERS[tier].color);
    w.innerHTML = `<h2 class="cst-title">${title}</h2>
      <div class="cst-chest"><i class="cst-rays"></i><img src="${chestURL(tier)}" alt=""><i class="cst-flash"></i><div class="cst-burst">${'<i></i>'.repeat(14)}</div></div>
      <div class="cst-loot"></div>
      <button class="btn primary big cst-ok" disabled>Super !</button>`;
    w.querySelectorAll('.cst-burst i').forEach((p, i) => {
      const a = i / 14 * Math.PI * 2 + Math.random() * 0.3, d = 90 + Math.random() * 90;
      p.style.cssText = `--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d - 30}px;--s:${0.6 + Math.random() * 0.8}`;
    });
    app.appendChild(w);
    const T = [];
    const at = (ms, fn) => T.push(setTimeout(fn, ms));
    let isOpen = false;
    const open = () => {
      if (isOpen) return;
      isOpen = true; T.forEach(clearTimeout);
      w.classList.remove('shake'); w.classList.add('open');
      w.querySelector('.cst-chest img').src = chestURL(tier, true);
      sfx('chestOpen'); buzz(40);
      const box = w.querySelector('.cst-loot');
      cards.forEach((html, i) => setTimeout(() => {
        box.insertAdjacentHTML('beforeend', html);
        const el = box.lastElementChild;
        if (el.classList.contains('lc-item') || el.classList.contains('lc-boost')) sfx('loot');
        else if (i % 2 === 0) sfx('coin');
      }, 350 + i * (quick ? 70 : 120)));
      setTimeout(() => { const b = w.querySelector('.cst-ok'); b.disabled = false; }, 450 + cards.length * (quick ? 70 : 120));
    };
    requestAnimationFrame(() => w.classList.add('in'));
    if (quick) at(250, open);
    else {
      at(300, () => { w.classList.add('shake'); sfx('chestShake'); });
      at(700, () => sfx('chestShake'));
      at(1050, () => { w.classList.add('shake2'); sfx('chestShake'); });
      at(1400, open);
    }
    // toucher l'écran accélère l'ouverture
    w.addEventListener('click', e => {
      if (!isOpen) { open(); return; }
      const b = e.target.closest('.cst-ok');
      if (!b || b.disabled) return;
      sfx('tap');
      w.classList.add('out');
      setTimeout(() => { w.remove(); resolve(); }, 220);
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
    <div class="chest-grid">${list.map((c, i) => `<button class="cg-card t${c.tier}" data-i="${i}" style="--tc:${LOOT_TIERS[c.tier].color};--d:${(i * 0.06).toFixed(2)}s">
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
    ? `<div class="rw loot-sum">${iconImg('chest', 22)} <b>${opened.length} coffre${opened.length > 1 ? 's' : ''} ouvert${opened.length > 1 ? 's' : ''}</b>
        <span class="ls-chips">${nParts ? `<span>${iconImg('hammer', 14)} ${nParts} pièce${nParts > 1 ? 's' : ''}</span>` : ''}${nBoosts ? `<span>${iconImg('potion', 14)} ${nBoosts} bonus</span>` : ''}${A.items.length ? `<span>${iconImg('sword', 14)} ${A.items.length} objet${A.items.length > 1 ? 's' : ''}</span>` : ''}<span class="gold-t">${iconImg('gold', 14)} +${fmt(A.gold)}</span></span></div>`
    : '';
  const pendLine = pending ? `<div class="rw">${iconImg('chest', 22)} <span><b>${pending} coffre${pending > 1 ? 's' : ''}</b> à ouvrir plus tard, depuis l'onglet Aventure.</span></div>` : '';
  const heatLine = R.heat ? `<div class="rw heat-line">${iconImg('i_burn', 22)} Totems de défi ×${R.heat} : <b>+${fmt(R.heatGold)} or</b> <small>+${Math.round(HEAT_GOLD * 100)} % d'or par totem activé</small></div>` : '';
  const worldCards = R.worlds.map((w, i) => `<div class="world-res" style="--d:${(0.15 + i * 0.12).toFixed(2)}s">
      <div class="wr-head" style="background-image:url(${zoneBannerURL(w.z)})">
        <span class="wr-boss">${bossImg(w.z)}</span>
        <span class="wr-t"><small>Monde ${w.n}</small><b>${esc(w.z.name)}</b></span>
        <span class="wr-ok">✓ Boss vaincu</span>
      </div>
      <div class="wr-lines">${w.lines.map(l => `<div class="rw">${l}</div>`).join('')}</div>
    </div>`).join('');
  const title = R.final ? 'La Faille est sauvée !' : sum.win ? 'Expédition réussie !' : won ? 'Fin de l\'expédition' : 'Fin de partie';
  // bouton principal : nouveau monde débloqué, niveau supérieur, ou rejouer
  const nextZ = R.newZone ?? start.id, nextK = R.newZone != null ? 0 : R.unlocked ?? k;
  const nextLabel = R.newZone != null ? `Partir : ${esc(ZONES[R.newZone].name)}` : R.unlocked ? `Tenter ${esc(DIFFICULTIES[R.unlocked].name)}` : 'Rejouer';
  mount(`<div class="reward-screen ${won ? 'complete' : 'lost'}">
    <h2 class="rs-title">${title}</h2>
    <p class="center muted rs-zone">${route} <span class="diff-tag d${k}">${iconImg(D.icon, 14)}${esc(D.name)}</span></p>
    ${R.final ? `<p class="center finale">Le Baron Nashar est tombé. Vous avez vaincu les 6 boss de Runeterre. Bravo, champion !</p>` : ''}
    <div class="run-stats card">
      <div><b>${fmtTime(sum.time)}</b><small>Durée</small></div>
      <div><b>${fmt(sum.kills)}</b><small>Monstres</small></div>
      <div><b>${sum.level}</b><small>Niveau</small></div>
      <div><b class="gold-t">${fmt(R.gold)}</b><small>Or gagné</small></div>
    </div>
    ${worldCards ? `<h3 class="section-t">Mondes vaincus <small>${cleared.length}</small></h3><div class="worlds-res">${worldCards}</div>` : ''}
    <div class="summary">
      ${heatLine}${chestLine}${pendLine}
      ${R.found.map(it => `<div class="rw r-${it.rarity} loot-row">${iconImg(it.icon, 22)} <b style="color:${RARITY[it.rarity].color}">${esc(it.name)}</b> <small>${RARITY[it.rarity].name} · ${statLine(it.stat)}${it._eq ? ' · équipé' : ''}</small></div>`).join('')}
    </div>
    ${sum.evo ? `<p class="center evo-reached">${iconImg('star', 16)} Évolution atteinte : <b>${esc(EVOLUTIONS[save.cls][sum.evo].name)}</b></p>` : ''}
    <div class="build">${sum.weapons.map(w => `<span>${iconImg(WEAPONS[w.id].icon, 20)}<b>${w.lv}</b></span>`).join('')}${Object.entries(sum.tomes).map(([id, lv]) => `<span>${iconImg(TOMES[id].icon, 20)}<b>${lv}</b></span>`).join('')}</div>
    ${!won ? `<p class="center muted tip">${tipFor(sum, k)}</p>` : ''}
    <div class="end-btns">
      <button class="btn ghost" data-act="home">Carte</button>
      <button class="btn primary" data-act="again">${nextLabel}</button>
    </div>
  </div>`);
  for (const it of R.found) delete it._eq;
  for (const a of R.got || []) toast(`${iconImg('crown', 18)} Succès : <b>${esc(a.name)}</b> (+${a.gold} or)`, 3200);
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
function statLine(s) {
  const p = [];
  if (s.atk) p.push(`+${s.atk} ATQ`);
  if (s.hp) p.push(`+${s.hp} PV`);
  if (s.crit) p.push(`+${Math.round(s.crit * 100)} % crit`);
  if (s.regen) p.push(`+${(s.regen / 10).toLocaleString('fr-FR')} PV/s`);
  return p.join(' · ');
}

// nom d'un objet avec son niveau d'amélioration (+N)
const itemName = it => `${esc(it.name)}${it.lv ? ` <em class="lvp">+${it.lv}</em>` : ''}`;

function gearTab() {
  const eqIds = Object.values(save.equipped);
  const slots = Object.entries(SLOTS).map(([k, label]) => {
    const it = save.inventory.find(i => i.id === save.equipped[k]);
    return `<button class="slot ${it ? 'r-' + it.rarity : 'empty'}" ${it ? `data-act="item" data-id="${it.id}"` : ''}>
      <small>${label}</small>
      ${it ? `${iconImg(it.icon, 32)}<b>${itemName(it)}</b><em>${statLine(it.stat)}</em>` : `<span class="muted">Vide</span>`}
    </button>`;
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
    <h3 class="section-t">Familier <small>${save.pets.length}/6</small></h3>
    <div class="pets">${pets}</div>
    <h3 class="section-t">Bonus <small>${nB} en stock</small></h3>
    ${boosts.length ? `<div class="boost-inv">${boosts.map(id => `<div class="bi-chip">${iconImg(BOOSTS[id].icon, 26)}<span><b>${esc(BOOSTS[id].name)}</b><small>${esc(BOOSTS[id].desc)}</small></span><em>×${save.boosts[id]}</em></div>`).join('')}</div>
      <p class="muted bi-note">Choisissez-les dans la fiche d'une zone, juste avant de partir.</p>`
    : `<p class="muted bi-note">Aucun bonus. Trouvez-en dans les <b>coffres de butin</b> ou achetez-en à la <b>Boutique</b>.</p>`}
    <h3 class="section-t">Sac <small>${list.length} objet${list.length > 1 ? 's' : ''}</small></h3>
    <div class="filters">${[['all', 'Tout'], ...Object.entries(SLOTS)].map(([k, l]) => `<button class="chip-btn ${gearFilter === k ? 'on' : ''}" data-act="filter" data-f="${k}">${l}</button>`).join('')}
      ${list.some(i => i.rarity === 'common') ? '<button class="chip-btn sell" data-act="sellJunk">Vendre les communs</button>' : ''}</div>
    <div class="inv">${list.length ? list.map(it => {
      const cur = save.inventory.find(i => i.id === save.equipped[it.slot]);
      const diff = itemPower(it) - itemPower(cur);
      return `<button class="inv-item r-${it.rarity}" data-act="item" data-id="${it.id}">
        ${iconImg(it.icon, 28)}
        <div><b>${itemName(it)}${it.crafted ? ` <i class="forged">${iconImg('hammer', 12)}</i>` : ''}</b><small>${statLine(it.stat)}</small></div>
        ${diff > 0 ? '<span class="up">▲</span>' : ''}
      </button>`;
    }).join('') : '<p class="muted center">Battez des monstres pour trouver de l\'équipement.</p>'}</div>`;
}

// fiche d'un objet : équiper, vendre, améliorer (+N) et recycler en pièces
function itemBody(it, equipped, cur) {
  const r = RARITY[it.rarity], lv = it.lv || 0, c = itemUpgradeCost(it);
  const pips = Array.from({ length: FORGE.upgrade.max }, (_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('');
  let up;
  if (c) {
    const have = save.parts[c.slot][c.r], next = statsAt(it.base || it.stat, c.lv);
    up = `<div class="it-up">
      <div class="iu-h">${iconImg('upg', 18)}<b>Améliorer</b><small>+${lv} → <b>+${c.lv}</b></small></div>
      <div class="iu-prev">${statLine(it.stat)} <i>›</i> <b>${statLine(next)}</b></div>
      <div class="iu-row">
        <span class="iu-cost ${have >= c.parts ? '' : 'bad'}">${partIcon(c.slot, c.r, 16)} ${have}/${c.parts}</span>
        <span class="iu-cost ${save.gold >= c.gold ? '' : 'bad'}">${iconImg('gold', 14)} ${fmt(c.gold)}</span>
        <button class="btn primary small" data-v="up" ${canUpgrade(it) ? '' : 'disabled'}>${iconImg('hammer', 16)} Améliorer</button>
      </div>
      ${have < c.parts ? `<small class="iu-hint">Il faut des ${esc(PARTS[c.slot].plural.toLowerCase())} (${r.name.toLowerCase()}) : ouvrez des coffres de butin ou recyclez des objets.</small>` : ''}
    </div>`;
  } else up = `<div class="it-up max">${iconImg('crown', 18)} <b>Amélioration maximale atteinte</b></div>`;
  return `<div class="item-detail"><span class="id-ic" style="--rc:${r.color}">${iconImg(it.icon, 48)}</span><div>
      <div style="color:${r.color}">${r.name} · ${SLOTS[it.slot]}${it.crafted ? ' · <span class="forged-t">Forgé</span>' : ''}</div>
      <div class="big-stats">${statLine(it.stat)}</div>
      <div class="lv-pips" aria-label="Niveau ${lv}">${pips}</div></div></div>
    ${!equipped && cur ? `<p class="muted">Actuellement équipé : ${itemName(cur)} (${statLine(cur.stat)})</p>` : ''}
    ${up}
    ${equipped ? '' : `<button class="btn ghost small it-salv" data-v="salvage">${iconImg('spin', 16)} Recycler : +${salvageValue(it)} ${esc(PARTS[it.slot].plural.toLowerCase())}</button>`}`;
}

async function itemSheet(id) {
  const it = save.inventory.find(i => i.id === id);
  if (!it) return;
  const equipped = save.equipped[it.slot] === id;
  const cur = save.inventory.find(i => i.id === save.equipped[it.slot]);
  const r = RARITY[it.rarity];
  const wid = 'it-' + Date.now();
  let action = null, changed = false;
  const p = modal({
    title: `<span class="it-title" style="color:${r.color}">${itemName(it)}</span>`,
    body: `<div id="${wid}" class="it-sheet">${itemBody(it, equipped, cur)}</div>`,
    buttons: equipped
      ? [{ label: 'Fermer', cls: 'primary', value: null }]
      : [{ label: `Vendre (${sellValue(it)} or)`, cls: 'ghost', value: 'sell' }, { label: 'Équiper', cls: 'primary', value: 'equip' }],
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
      if (sell) sell.textContent = `Vendre (${sellValue(it)} or)`;
      box.querySelector('.id-ic').classList.add('bang');
      box.querySelector('.big-stats').classList.add('bang');
      refreshTopbar();
      announceAchievements();
      return;
    }
    if (b.dataset.v === 'salvage') { sfx('tap'); action = 'salvage'; wrap.click(); }
  });
  const v = await p;
  if (v === 'equip') return equipItem(id);
  if (v === 'sell') {
    save.gold += sellValue(it);
    save.inventory = save.inventory.filter(i => i.id !== id);
    persist(); sfx('coin'); return home();
  }
  if (action === 'salvage') {
    const n = salvageValue(it), ri = rarityIdx(it);
    if (ri >= 2 || it.lv || it.crafted) {
      const ok = await modal({ title: 'Recycler ?', body: `<p><b style="color:${r.color}">${itemName(it)}</b> sera détruit et donnera <b>${n} ${esc(PARTS[it.slot].plural.toLowerCase())}</b> (${r.name.toLowerCase()}).</p>`, buttons: [{ label: 'Annuler', cls: 'ghost', value: false }, { label: 'Recycler', cls: 'danger', value: true }] });
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
  const total = junk.reduce((n, i) => n + sellValue(i), 0);
  const ok = await modal({ title: 'Vendre les objets communs ?', body: `<p>${junk.length} objet(s) pour <b>${fmt(total)} or</b>.</p><p class="muted">Les objets améliorés sont gardés. Vous pouvez aussi les recycler en pièces pour la Forge.</p>`, buttons: [{ label: 'Annuler', cls: 'ghost', value: false }, { label: 'Vendre', cls: 'primary', value: true }] });
  if (!ok) return;
  save.inventory = save.inventory.filter(i => !junk.includes(i));
  save.gold += total;
  persist(); sfx('coin'); announceAchievements(); home();
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
function forgeAnim(result, { title = 'Objet forgé !', fuse = null } = {}) {
  return new Promise(resolve => {
    const w = document.createElement('div');
    w.className = 'forge-anim' + (fuse ? ' fusing' : '');
    w.innerHTML = `<div class="fa-stage">
        <i class="fa-glow"></i>
        ${fuse ? `<div class="fu-row">${Array.from({ length: Math.min(4, FORGE.fuse) }, (_, i) => `<span class="fu-p" style="--x:${(1.5 - i) * 62}px">${partIcon(fuse.slot, fuse.r, 30)}</span>`).join('')}</div>` : ''}
        <img class="fa-anvil" src="${anvilURL()}" alt=""><i class="fa-ingot"></i>
        <img class="fa-hammer" src="${hammerURL()}" alt=""><div class="fa-sparks"></div>
      </div>
      <div class="fa-result" style="--rc:${result.color}"><i class="fa-rays"></i><div class="fa-card">${result.html}</div></div>
      <h2 class="fa-title">${title}</h2>
      <button class="btn primary big fa-ok" disabled>Super !</button>`;
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
  await forgeAnim({ color: R.color, big: r >= 3, html: `${iconImg(it.icon, 56)}<b>${esc(it.name)}</b><small style="color:${R.color}">${R.name} · ${SLOTS[it.slot]}</small><em>${statLine(it.stat)}</em>${res.equipped ? '<span class="fa-eq">Équipé !</span>' : ''}` });
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
  await forgeAnim({ color: R.color, html: `${partIcon(slot, r + 1, 48)}<b>${esc(PARTS[slot].name)} ×${n}</b><small style="color:${R.color}">${R.name}</small>` }, { title: 'Fusion réussie !', fuse: { slot, r } });
  renderForge();
}

// ---------- Boutique ----------
function shopTab() {
  return `<h3 class="section-t first">Améliorations permanentes</h3>
    <p class="muted shop-intro">Elles valent pour tous les champions.</p>
    <div class="upgrades">${Object.entries(UPGRADES).map(([k, u]) => {
      const lvl = save.upgrades[k], max = lvl >= u.max, cost = upgradeCost(k);
      return `<div class="upgrade card">
        ${iconImg(u.icon, 36)}
        <div class="u-txt"><b>${u.name}</b><small>${u.desc}</small>
          <div class="lvl"><span>Niv. ${lvl}/${u.max}</span><div class="lbar"><i style="width:${lvl / u.max * 100}%"></i></div></div></div>
        <button class="btn ${max ? 'ghost' : 'primary'} small" data-act="buy" data-k="${k}" ${max || save.gold < cost ? 'disabled' : ''}>
          ${max ? 'Max' : `${iconImg('gold', 14)} ${fmt(cost)}`}
        </button>
      </div>`;
    }).join('')}</div>
    <h3 class="section-t">Bonus <small>pour une seule partie</small></h3>
    <p class="muted shop-intro">Choisissez-en jusqu'à ${BOOST_SLOTS} dans la fiche d'une zone avant de partir.</p>
    <div class="upgrades boost-shop">${Object.entries(BOOSTS).map(([id, b]) => `<div class="upgrade card boost-card">
        <span class="bo-ic">${iconImg(b.icon, 32)}${save.boosts[id] ? `<i class="bo-n">×${save.boosts[id]}</i>` : ''}</span>
        <div class="u-txt"><b>${esc(b.name)}</b><small>${esc(b.desc)}</small></div>
        <button class="btn primary small" data-act="buyBoost" data-id="${id}" ${save.gold < b.price ? 'disabled' : ''}>${iconImg('gold', 14)} ${fmt(b.price)}</button>
      </div>`).join('')}</div>`;
}

function doBuyBoost(id) {
  if (!buyBoost(id)) return;
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
  return `<div class="stat-grid card">
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
    ? `<p class="muted">La connexion Google n'est pas encore configurée sur cette version. Votre progression est sauvegardée sur cet appareil.</p>`
    : u
      ? `<div class="acct">${u.avatar ? `<img class="avatar" src="${esc(u.avatar)}" alt="" referrerpolicy="no-referrer">` : ''}<div><b>${esc(u.name || u.email)}</b><small>${esc(u.email || '')}</small><small class="sync-t ${cloud.status}">${statusTxt}</small></div></div>`
      : `<p>Connectez-vous pour <b>sauvegarder votre progression en ligne</b> et la retrouver sur un autre appareil. Le jeu reste jouable hors connexion.</p>
         <button class="btn google" data-v="login"><svg viewBox="0 0 48 48" width="18" height="18"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 6.9-10.3 6.9-17.7z"/><path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.2 1.5-5 2.3-8.2 2.3-6.2 0-11.5-4.1-13.4-9.8l-7.9 6.1C6.6 42.6 14.6 48 24 48z"/></svg> Se connecter avec Google</button>`;
  const wrapId = 'set-' + Date.now();
  const p = modal({
    title: 'Compte & options',
    body: `<div id="${wrapId}">
      <h4>Compte</h4>${acct}
      <h4>Options</h4>
      <div class="toggles">
        <label class="toggle"><input type="checkbox" id="sSound" ${save.settings.sound ? 'checked' : ''}> Son</label>
        <label class="toggle"><input type="checkbox" id="sVib" ${save.settings.vibrate ? 'checked' : ''}> Vibrations</label>
        <label class="toggle"><input type="checkbox" id="sMus" ${save.settings.music !== false ? 'checked' : ''}> Musique</label>
      </div>
      <h4>Installer sur iPhone</h4>
      <p class="muted">Dans Safari, touchez <b>Partager</b> puis <b>« Sur l'écran d'accueil »</b>. Le jeu s'ouvrira en plein écran et fonctionnera hors connexion.</p>
      <div class="danger-zone">
        ${u ? '<button class="btn ghost small" data-v="logout">Se déconnecter</button>' : ''}
        <button class="btn ghost small danger" data-v="reset">Effacer la progression</button>
      </div>
    </div>`,
    buttons: [{ label: 'Fermer', cls: 'primary', value: 'close' }],
    dismissable: true,
  });
  // boutons internes
  const wrap = document.getElementById(wrapId);
  let action = null;
  wrap.addEventListener('click', e => {
    const b = e.target.closest('[data-v]');
    if (!b) return;
    action = b.dataset.v;
    wrap.closest('.modal-wrap').querySelector('.modal-btns .btn').click();
  });
  await p;
  save.settings.sound = wrap.querySelector('#sSound').checked;
  save.settings.vibrate = wrap.querySelector('#sVib').checked;
  const mOn = wrap.querySelector('#sMus').checked;
  if (mOn !== save.settings.music) { save.settings.music = mOn; if (!mOn) stopMusic(); }
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
