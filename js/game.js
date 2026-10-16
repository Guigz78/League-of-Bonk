// Écrans du jeu et déroulé d'une expédition.
import { CLASSES, SPELLS, ZONES, PETS, PET_BY_ZONE, SLOTS, RARITY, BOSS_ITEMS, UPGRADES, ACHIEVEMENTS, MONSTER_COUNT } from './data.js';
import { save, persist, playerStats, upgradeCost, makeItem, addItem, itemPower, sellValue, checkAchievements, resetSave } from './save.js';
import { heroURL, creatureURL, iconImg } from './art.js';
import { rng } from './pixel.js';
import { sfx } from './audio.js';
import { mount, $, $$, bind, modal, toast, fmt, pct, esc, wait } from './ui.js';
import { Battle } from './battle.js';
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
    ['shop', 'Boutique', 'gold'],
    ['trophies', 'Succès', 'crown'],
  ];
  const badge = { gear: save.inventory.some(i => i.isNew), trophies: false, shop: canAffordUpgrade() };
  return `<nav class="tabs">${items.map(([id, label, ic]) => `
    <button class="tab ${tab === id ? 'on' : ''}" data-act="tab" data-tab="${id}">
      ${iconImg(ic, 22)}<span>${label}</span>${badge[id] ? '<i class="badge"></i>' : ''}
    </button>`).join('')}</nav>`;
}

function canAffordUpgrade() {
  return Object.keys(UPGRADES).some(k => save.upgrades[k] < UPGRADES[k].max && save.gold >= upgradeCost(k));
}

// ---------- Accueil (onglets) ----------
export function home(t) {
  battle = null;
  if (t) tab = t;
  const body = { adventure: adventureTab, gear: gearTab, shop: shopTab, trophies: trophiesTab }[tab]();
  mount(`<div class="hub">${topbar()}<main class="hub-main" id="hubMain">${body}</main>${nav()}</div>`);
  bind($('.hub'), handlers);
}

const handlers = {
  tab: el => { tab = el.dataset.tab; home(); },
  settings: () => settings(),
  zone: el => zoneSheet(+el.dataset.z),
  resume: () => continueRun(),
  changeClass: () => classSelect(false),
  equip: el => equipItem(+el.dataset.id),
  item: el => itemSheet(+el.dataset.id),
  filter: el => { gearFilter = el.dataset.f; home(); },
  pet: el => { save.pet = save.pet === el.dataset.id ? null : el.dataset.id; persist(); home(); },
  buy: el => buyUpgrade(el.dataset.k),
  sellJunk: () => sellJunk(),
};

function heroCard() {
  const c = CLASSES[save.cls], st = playerStats();
  return `<section class="card hero-card">
    <div class="hc-sprite"><img class="px" src="${heroURL(c.id, c.colors)}" alt="">
      ${save.pet ? `<img class="px hc-pet" src="${creatureURL('pet-' + save.pet, PETS[save.pet].body, PETS[save.pet].pal)}" alt="">` : ''}
    </div>
    <div class="hc-info">
      <div class="hc-name">${esc(c.name)} <small>${c.role}</small></div>
      <div class="stats">
        <span>${iconImg('heart', 16)}<b>${st.hp}</b></span>
        <span>${iconImg('fist', 16)}<b>${st.atk}</b></span>
        <span>${iconImg('target', 16)}<b>${pct(st.crit)}</b></span>
        <span>${iconImg('mana', 16)}<b>+${st.regen}</b></span>
      </div>
      <button class="btn small ghost" data-act="changeClass">Changer de champion</button>
    </div>
  </section>`;
}

function adventureTab() {
  const run = save.run;
  const done = save.zoneCleared.filter(Boolean).length;
  const resume = run ? `<button class="card resume" data-act="resume">
      <div><b>Expédition en cours</b><small>${esc(ZONES[run.zone].name)} · combat ${run.step + 1}/${zoneSteps(ZONES[run.zone]).length}</small></div>
      <span class="btn primary small">Reprendre</span>
    </button>` : '';
  const zones = ZONES.map((z, i) => {
    const locked = i > save.unlockedZone;
    const cleared = save.zoneCleared[i];
    const sprite = z.boss ? creatureURL(`${z.id}-${zoneSteps(z).length - 1}-${z.boss.name}`, z.boss.body, z.boss.pal, { boss: true })
      : creatureURL(`${z.id}-4-${z.monsters[4].name}`, z.monsters[4].body, z.monsters[4].pal);
    return `<button class="zone ${locked ? 'locked' : ''} ${cleared ? 'cleared' : ''} ${i === 0 && !save.stats.wins ? 'cta' : ''}" data-act="zone" data-z="${i}" style="--sky1:${z.sky[0]};--sky2:${z.sky[1]};--g1:${z.ground[0]}">
      <div class="z-num">${i + 1}</div>
      <div class="z-txt"><b>${esc(z.name)}</b>${i === 0 && !save.stats.wins ? '<em class="start">Commencez ici !</em>' : ''}<small>${locked ? `Terminez « ${esc(ZONES[i - 1].name)} »` : esc(z.sub)}</small></div>
      <div class="z-art">${locked ? iconImg('lock', 28) : `<img class="px" src="${sprite}" alt="">`}</div>
      ${cleared ? `<div class="z-done">${iconImg('star', 14)} Terminée</div>` : ''}
    </button>`;
  }).join('');
  return `${heroCard()}${resume}
    <h3 class="section-t">Carte de Runeterre <small>${done}/6 zones</small></h3>
    <div class="zones">${zones}</div>`;
}

function zoneSteps(z) {
  const s = z.monsters.map(m => ({ ...m, boss: false }));
  if (z.boss) s.push({ ...z.boss, boss: true });
  return s;
}

async function zoneSheet(i) {
  const z = ZONES[i];
  if (i > save.unlockedZone) { toast(`${iconImg('lock', 16)} Terminez d'abord « ${esc(ZONES[i - 1].name)} »`); return; }
  if (save.run && save.run.zone !== i) {
    const ok = await modal({ title: 'Expédition en cours', body: `<p>Vous êtes déjà dans <b>${esc(ZONES[save.run.zone].name)}</b>. L'abandonner pour partir ici ?</p><p class="muted">L'or déjà gagné est conservé.</p>`, buttons: [{ label: 'Annuler', cls: 'ghost', value: false }, { label: 'Abandonner et partir', cls: 'danger', value: true }] });
    if (!ok) return;
    save.run = null; persist();
  }
  if (save.run?.zone === i) return continueRun();
  const steps = zoneSteps(z);
  const first = !save.zoneCleared[i];
  const pet = PETS[PET_BY_ZONE[i]];
  const bi = BOSS_ITEMS[i];
  const reward = first ? `
      <div class="rewards">
        <div class="rw">${iconImg('star', 18)} Zone suivante débloquée</div>
        <div class="rw"><img class="px" src="${creatureURL('pet-' + PET_BY_ZONE[i], pet.body, pet.pal)}" width="22" height="22" alt=""> Familier : <b>${esc(pet.name)}</b></div>
        ${bi ? `<div class="rw">${iconImg(bi.icon, 18)} <b style="color:${RARITY.legendary.color}">${esc(bi.name)}</b></div>` : ''}
      </div>` : `<p class="muted">Zone déjà terminée : les ennemis sont plus forts (+15 %) mais rapportent plus d'or.</p>`;
  const ok = await modal({
    title: esc(z.name),
    cls: 'zone-modal',
    body: `<p class="muted">${esc(z.sub)}</p>
      <div class="enemy-row">${steps.map((m, k) => `<div class="er ${m.boss ? 'boss' : ''}" title="${esc(m.name)}"><img class="px" src="${creatureURL(`${z.id}-${k}-${m.name}`, m.body, m.pal, { boss: m.boss })}" alt=""></div>`).join('')}</div>
      <p><b>${steps.length} combats</b>${z.boss ? ` dont le boss <b>${esc(z.boss.name)}</b>` : ''}. Vos PV ne remontent pas entre les combats : utilisez vos potions !</p>
      ${first ? '<h4>Récompenses de première victoire</h4>' : ''}${reward}`,
    buttons: [{ label: 'Retour', cls: 'ghost', value: false }, { label: 'Partir !', cls: 'primary', value: true }],
    dismissable: true,
  });
  if (ok) startRun(i);
}

// ---------- Choix de la classe ----------
function classSelect(first) {
  let sel = save.cls || 'mage';
  const render = () => {
    const c = CLASSES[sel];
    mount(`<div class="class-select">
      ${first ? `<div class="title-logo"><div class="l1">League</div><div class="l2">of</div><div class="l3">Bonk</div></div>` : '<h2 class="cs-title">Choisissez votre champion</h2>'}
      ${first ? '<p class="cs-sub">Choisissez votre champion</p>' : ''}
      <div class="cs-tabs">${Object.values(CLASSES).map(k => `<button class="cs-tab ${k.id === sel ? 'on' : ''}" data-act="pick" data-c="${k.id}"><img class="px" src="${heroURL(k.id, k.colors)}" alt=""><span>${k.role}</span></button>`).join('')}</div>
      <section class="card cs-detail">
        <div class="cs-head"><img class="px big" src="${heroURL(c.id, c.colors)}" alt=""><div><h3>${esc(c.name)}</h3><div class="role">${c.role}</div><p>${esc(c.desc)}</p></div></div>
        <div class="stats wide">
          <span>${iconImg('heart', 16)} PV <b>${c.hp}</b></span>
          <span>${iconImg('fist', 16)} ATQ <b>${c.atk}</b></span>
          <span>${iconImg('target', 16)} Crit <b>${pct(c.crit)}</b></span>
          <span>${iconImg('mana', 16)} Mana <b>+${c.regen}</b></span>
        </div>
        <div class="cs-spells">${c.spells.map(id => { const s = SPELLS[id]; return `<div class="cs-spell k-${s.kind}">${iconImg(s.icon, 26)}<div><b>${esc(s.name)}</b><small>${esc(s.short)}${s.kind === 'skill' ? ` · ${s.cost} mana${s.cd ? ` · recharge ${s.cd} tours` : ''}` : s.kind === 'ult' ? ' · Ultime' : ' · Gratuit'}</small></div></div>`; }).join('')}</div>
      </section>
      <button class="btn primary big" data-act="go">Jouer avec ${esc(c.name)}</button>
      ${first ? '' : '<button class="btn ghost" data-act="back">Retour</button>'}
      ${first ? '<p class="cs-note">Vous pourrez changer de champion à tout moment. L\'équipement et les améliorations sont partagés.</p>' : ''}
    </div>`);
    bind($('.class-select'), {
      pick: el => { sel = el.dataset.c; render(); },
      go: () => {
        if (save.run && save.cls !== sel) save.run = null;
        save.cls = sel; persist();
        home('adventure');
      },
      back: () => home(),
    });
  };
  render();
}

// ---------- Expédition ----------
function startRun(z) {
  const st = playerStats();
  save.run = {
    zone: z, step: 0, hp: st.hp, ult: 0, potions: st.potion,
    buffs: { atk: 0, regen: 0 }, gold: 0, items: [], revived: false, deaths: 0,
  };
  persist();
  continueRun();
}

function continueRun() {
  const run = save.run;
  if (!run) return home();
  const z = ZONES[run.zone];
  const steps = zoneSteps(z);
  const enemy = steps[run.step];
  battle = new Battle({
    zone: z, enemy, isBoss: enemy.boss, step: run.step, total: steps.length,
    onWin: res => afterWin(res, enemy),
    onDefeat: () => onDefeat(),
    onPause: () => pause(),
  });
  battle.start();
}

async function pause() {
  const v = await modal({
    title: 'Pause',
    body: `<div class="toggles">
        <label class="toggle"><input type="checkbox" id="pSound" ${save.settings.sound ? 'checked' : ''}> Son</label>
        <label class="toggle"><input type="checkbox" id="pVib" ${save.settings.vibrate ? 'checked' : ''}> Vibrations</label>
      </div>
      <div class="howto">
        <p>${iconImg('sword', 16)} <b>Attaquer</b> : touchez un sort, puis touchez l'écran quand le curseur est dans la zone <b class="gold-t">dorée</b>.</p>
        <p>${iconImg('i_guard', 16)} <b>Parer</b> : quand le bouton PARER s'allume, touchez vite l'écran (−50 % de dégâts).</p>
        <p>${iconImg('mana', 16)} <b>Mana</b> : se recharge à chaque tour. L'<b>ultime</b> se charge en frappant et en encaissant.</p>
      </div>`,
    buttons: [{ label: 'Quitter l\'expédition', cls: 'danger ghost', value: 'quit' }, { label: 'Reprendre', cls: 'primary', value: 'resume' }],
  });
  save.settings.sound = $('#pSound')?.checked ?? save.settings.sound;
  save.settings.vibrate = $('#pVib')?.checked ?? save.settings.vibrate;
  persist();
  if (v === 'quit') {
    const ok = await modal({ title: 'Quitter ?', body: `<p>L'expédition sera perdue, mais vous gardez <b>${fmt(save.run.gold)} or</b> et les objets trouvés.</p>`, buttons: [{ label: 'Continuer à jouer', cls: 'ghost', value: false }, { label: 'Quitter', cls: 'danger', value: true }] });
    if (ok) { save.run = null; persist(); home(); }
  }
}

function goldFor(enemy, z) {
  const base = 6 + z.id * 9;
  let g = base * (enemy.boss ? 6 : enemy.elite ? 2 : 1);
  if (save.zoneCleared[z.id]) g *= 1.3;
  return Math.round(g * (0.9 + Math.random() * 0.2));
}

async function afterWin(res, enemy) {
  const run = save.run, z = ZONES[run.zone];
  const steps = zoneSteps(z);
  run.hp = res.hp; run.ult = res.ult;
  save.stats.wins++;
  save.stats.classWins[save.cls] = (save.stats.classWins[save.cls] || 0) + 1;
  save.stats.kills[enemy.name] = (save.stats.kills[enemy.name] || 0) + 1;
  const gold = goldFor(enemy, z);
  save.gold += gold; run.gold += gold;
  const r = rng(Date.now());
  let item = null;
  const dropChance = enemy.boss ? 1 : enemy.elite ? 0.7 : 0.3;
  if (Math.random() < dropChance) {
    item = makeItem(r, z.id, { boost: enemy.boss ? 0.3 : enemy.elite ? 0.12 : 0 });
    item.isNew = true;
    const eq = addItem(item);
    run.items.push(item.id);
    item._equipped = eq;
  }
  run.step++;
  const last = run.step >= steps.length;
  persist();
  announceAchievements();

  if (last) return zoneComplete();

  // récompense : 1 bonus parmi 3
  const st = playerStats();
  const options = [
    { id: 'heal', icon: 'heart', name: 'Repos', desc: `Soigne ${Math.round(st.hp * 0.4)} PV`, apply: () => { run.hp = Math.min(st.hp, run.hp + Math.round(st.hp * 0.4)); } },
    { id: 'atk', icon: 'fist', name: 'Rage du combat', desc: '+12 % ATQ pour cette expédition', apply: () => { run.buffs.atk += 0.12; } },
    { id: 'mana', icon: 'mana', name: 'Méditation', desc: '+4 mana par tour pour cette expédition', apply: () => { run.buffs.regen += 4; } },
    { id: 'potion', icon: 'potion', name: 'Potion', desc: '+1 potion de soin', apply: () => { run.potions++; } },
    { id: 'gold', icon: 'gold', name: 'Butin', desc: `+${gold * 2} or`, apply: () => { save.gold += gold * 2; run.gold += gold * 2; } },
  ];
  // le soin est toujours proposé si les PV sont bas
  let pool = options.slice();
  const pick = [];
  if (run.hp < st.hp * 0.5) { pick.push(pool[0]); pool = pool.slice(1); }
  while (pick.length < 3) pick.push(...pool.splice(Math.floor(Math.random() * pool.length), 1));

  const next = steps[run.step];
  mount(`<div class="reward-screen">
    <h2 class="rs-title">Victoire !</h2>
    <div class="loot">
      <div class="loot-gold">${iconImg('gold', 24)} +${fmt(gold)} or</div>
      ${item ? `<button class="loot-item r-${item.rarity}" data-act="noop">${iconImg(item.icon, 32)}<div><b>${esc(item.name)}</b><small style="color:${RARITY[item.rarity].color}">${RARITY[item.rarity].name}</small><small>${statLine(item.stat)}</small>${item._equipped ? '<em>Équipé automatiquement</em>' : ''}</div></button>` : ''}
    </div>
    <div class="hp-now">${iconImg('heart', 16)} PV : <b>${fmt(Math.min(run.hp, st.hp))} / ${fmt(st.hp)}</b></div>
    <h3 class="section-t center">Choisissez un bonus</h3>
    <div class="choices">${pick.map((o, i) => `<button class="choice" data-act="choose" data-i="${i}">${iconImg(o.icon, 32)}<b>${o.name}</b><small>${o.desc}</small></button>`).join('')}</div>
    <p class="next-up">Prochain : <b>${esc(next.name)}</b>${next.boss ? ' <span class="tag boss">BOSS</span>' : next.elite ? ' <span class="tag elite">ÉLITE</span>' : ''}</p>
  </div>`);
  sfx('coin');
  bind($('.reward-screen'), {
    choose: el => {
      pick[+el.dataset.i].apply();
      persist();
      sfx('loot');
      continueRun();
    },
  });
}

function announceAchievements() {
  for (const a of checkAchievements()) {
    toast(`${iconImg('crown', 18)} Succès : <b>${esc(a.name)}</b> (+${a.gold} or)`, 3200);
    sfx('loot');
  }
  persist();
}

async function onDefeat() {
  const run = save.run;
  save.stats.deaths++;
  run.deaths++;
  persist();
  const canRevive = !run.revived;
  const v = await modal({
    title: 'K.O. !',
    cls: 'ko-modal',
    body: canRevive
      ? `<p>Vous êtes tombé au combat.</p><p><b>Regardez une courte publicité</b> pour revenir avec tous vos PV et votre mana.</p><p class="muted">Possible une fois par expédition.</p>`
      : `<p>Vous êtes tombé au combat.</p><p class="muted">Vous gardez <b>${fmt(run.gold)} or</b> et tous les objets trouvés. Améliorez-vous dans la boutique et réessayez !</p>`,
    buttons: canRevive
      ? [{ label: 'Abandonner', cls: 'ghost', value: 'quit' }, { label: `${iconImg('heart', 16)} Revivre (pub)`, cls: 'primary', value: 'ad' }]
      : [{ label: 'Retour à la carte', cls: 'primary', value: 'quit' }],
  });
  if (v === 'ad') {
    const ok = await showRewardedAd();
    if (ok) { run.revived = true; persist(); battle.revive(); return; }
  }
  const gold = run.gold;
  save.run = null; persist();
  home('adventure');
  toast(`Expédition terminée · ${fmt(gold)} or conservés`);
}

async function zoneComplete() {
  const run = save.run, z = ZONES[run.zone];
  const first = !save.zoneCleared[z.id];
  const lines = [];
  if (first) {
    save.zoneCleared[z.id] = true;
    if (z.id + 1 < ZONES.length) { save.unlockedZone = Math.max(save.unlockedZone, z.id + 1); lines.push(`${iconImg('star', 22)} Nouvelle zone : <b>${esc(ZONES[z.id + 1].name)}</b>`); }
    const petId = PET_BY_ZONE[z.id];
    if (!save.pets.includes(petId)) {
      save.pets.push(petId);
      if (!save.pet) save.pet = petId;
      const p = PETS[petId];
      lines.push(`<img class="px" src="${creatureURL('pet-' + petId, p.body, p.pal)}" width="28" height="28" alt=""> Familier : <b>${esc(p.name)}</b> <small>${esc(p.desc)}</small>`);
    }
    const bi = BOSS_ITEMS[z.id];
    if (bi) {
      const it = { ...bi, stat: { ...bi.stat }, id: save.nextId++, zone: z.id, isNew: true };
      const eq = addItem(it);
      lines.push(`${iconImg(bi.icon, 22)} <b style="color:${RARITY.legendary.color}">${esc(bi.name)}</b> <small>${statLine(bi.stat)}${eq ? ' · équipé' : ''}</small>`);
    }
  }
  if (run.deaths === 0) save.stats.cleanZone = true;
  const bonus = Math.round(run.gold * 0.25);
  save.gold += bonus;
  const total = run.gold + bonus;
  save.run = null;
  persist();
  announceAchievements();
  sfx('win');
  const finale = first && z.id === ZONES.length - 1;
  mount(`<div class="reward-screen complete">
    <h2 class="rs-title">${finale ? 'La Faille est sauvée !' : 'Zone terminée !'}</h2>
    <p class="center">${esc(z.name)}</p>
    ${finale ? `<p class="center finale">Le Baron Nashar est tombé. Vous avez vaincu les ${MONSTER_COUNT} monstres et les 5 boss de Runeterre. Bravo, champion !</p>` : ''}
    <div class="summary">
      <div class="rw">${iconImg('gold', 22)} <b>${fmt(total)} or</b> <small>dont ${fmt(bonus)} de bonus de zone</small></div>
      ${lines.map(l => `<div class="rw">${l}</div>`).join('')}
    </div>
    <button class="btn primary big" data-act="ok">Continuer</button>
  </div>`);
  bind($('.reward-screen'), { ok: () => home('adventure') });
}

// ---------- Équipement ----------
function statLine(s) {
  const p = [];
  if (s.atk) p.push(`+${s.atk} ATQ`);
  if (s.hp) p.push(`+${s.hp} PV`);
  if (s.crit) p.push(`+${Math.round(s.crit * 100)} % crit`);
  if (s.regen) p.push(`+${s.regen} mana/tour`);
  return p.join(' · ');
}

function gearTab() {
  const eqIds = Object.values(save.equipped);
  const slots = Object.entries(SLOTS).map(([k, label]) => {
    const it = save.inventory.find(i => i.id === save.equipped[k]);
    return `<button class="slot ${it ? 'r-' + it.rarity : 'empty'}" ${it ? `data-act="item" data-id="${it.id}"` : ''}>
      <small>${label}</small>
      ${it ? `${iconImg(it.icon, 32)}<b>${esc(it.name)}</b><em>${statLine(it.stat)}</em>` : `<span class="muted">Vide</span>`}
    </button>`;
  }).join('');
  const list = save.inventory
    .filter(i => !eqIds.includes(i.id))
    .filter(i => gearFilter === 'all' || i.slot === gearFilter)
    .sort((a, b) => itemPower(b) - itemPower(a));
  const pets = Object.entries(PETS).map(([id, p]) => {
    const owned = save.pets.includes(id);
    return `<button class="pet-card ${owned ? '' : 'locked'} ${save.pet === id ? 'on' : ''}" ${owned ? `data-act="pet" data-id="${id}"` : ''}>
      ${owned ? `<img class="px" src="${creatureURL('pet-' + id, p.body, p.pal)}" alt="">` : iconImg('lock', 24)}
      <b>${owned ? esc(p.name) : '???'}</b>
      <small>${owned ? esc(p.desc) : `Terminez « ${esc(ZONES[p.zone].name)} »`}</small>
      ${save.pet === id ? '<em>Actif</em>' : ''}
    </button>`;
  }).join('');
  for (const i of save.inventory) delete i.isNew;
  persist({ touch: false });
  return `${heroCard()}
    <h3 class="section-t">Équipé</h3>
    <div class="slots">${slots}</div>
    <h3 class="section-t">Familier <small>${save.pets.length}/6</small></h3>
    <div class="pets">${pets}</div>
    <h3 class="section-t">Sac <small>${list.length} objet${list.length > 1 ? 's' : ''}</small></h3>
    <div class="filters">${[['all', 'Tout'], ...Object.entries(SLOTS)].map(([k, l]) => `<button class="chip-btn ${gearFilter === k ? 'on' : ''}" data-act="filter" data-f="${k}">${l}</button>`).join('')}
      ${list.some(i => i.rarity === 'common') ? '<button class="chip-btn sell" data-act="sellJunk">Vendre les communs</button>' : ''}</div>
    <div class="inv">${list.length ? list.map(it => {
      const cur = save.inventory.find(i => i.id === save.equipped[it.slot]);
      const diff = itemPower(it) - itemPower(cur);
      return `<button class="inv-item r-${it.rarity}" data-act="item" data-id="${it.id}">
        ${iconImg(it.icon, 28)}
        <div><b>${esc(it.name)}</b><small>${statLine(it.stat)}</small></div>
        ${diff > 0 ? '<span class="up">▲</span>' : ''}
      </button>`;
    }).join('') : '<p class="muted center">Battez des monstres pour trouver de l\'équipement.</p>'}</div>`;
}

async function itemSheet(id) {
  const it = save.inventory.find(i => i.id === id);
  if (!it) return;
  const equipped = save.equipped[it.slot] === id;
  const cur = save.inventory.find(i => i.id === save.equipped[it.slot]);
  const r = RARITY[it.rarity];
  const v = await modal({
    title: `<span style="color:${r.color}">${esc(it.name)}</span>`,
    body: `<div class="item-detail">${iconImg(it.icon, 48)}<div><div style="color:${r.color}">${r.name} · ${SLOTS[it.slot]}</div><div class="big-stats">${statLine(it.stat)}</div></div></div>
      ${!equipped && cur ? `<p class="muted">Actuellement équipé : ${esc(cur.name)} (${statLine(cur.stat)})</p>` : ''}`,
    buttons: equipped
      ? [{ label: 'Fermer', cls: 'primary', value: null }]
      : [{ label: `Vendre (${sellValue(it)} or)`, cls: 'ghost', value: 'sell' }, { label: 'Équiper', cls: 'primary', value: 'equip' }],
    dismissable: true,
  });
  if (v === 'equip') equipItem(id);
  if (v === 'sell') {
    save.gold += sellValue(it);
    save.inventory = save.inventory.filter(i => i.id !== id);
    persist(); sfx('coin'); home();
  }
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
  const junk = save.inventory.filter(i => i.rarity === 'common' && !eq.includes(i.id));
  const total = junk.reduce((n, i) => n + sellValue(i), 0);
  const ok = await modal({ title: 'Vendre les objets communs ?', body: `<p>${junk.length} objet(s) pour <b>${fmt(total)} or</b>.</p>`, buttons: [{ label: 'Annuler', cls: 'ghost', value: false }, { label: 'Vendre', cls: 'primary', value: true }] });
  if (!ok) return;
  save.inventory = save.inventory.filter(i => !junk.includes(i));
  save.gold += total;
  persist(); sfx('coin'); announceAchievements(); home();
}

// ---------- Boutique ----------
function shopTab() {
  return `<p class="muted shop-intro">Les améliorations sont <b>permanentes</b> et valent pour tous les champions.</p>
    <div class="upgrades">${Object.entries(UPGRADES).map(([k, u]) => {
      const lvl = save.upgrades[k], max = lvl >= u.max, cost = upgradeCost(k);
      return `<div class="upgrade card">
        ${iconImg(u.icon, 36)}
        <div class="u-txt"><b>${u.name}</b><small>${u.desc}</small>
          <div class="pips">${Array.from({ length: u.max }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</div></div>
        <button class="btn ${max ? 'ghost' : 'primary'} small" data-act="buy" data-k="${k}" ${max || save.gold < cost ? 'disabled' : ''}>
          ${max ? 'Max' : `${iconImg('gold', 14)} ${fmt(cost)}`}
        </button>
      </div>`;
    }).join('')}</div>`;
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
  const seen = Object.keys(st.kills).length;
  return `<div class="stat-grid card">
      <div><b>${fmt(st.wins)}</b><small>Victoires</small></div>
      <div><b>${seen}/${MONSTER_COUNT + 5}</b><small>Bestiaire</small></div>
      <div><b>${fmt(st.perfects)}</b><small>Frappes parfaites</small></div>
      <div><b>${fmt(st.ults)}</b><small>Ultimes</small></div>
    </div>
    <h3 class="section-t">Succès <small>${n}/${ACHIEVEMENTS.length}</small></h3>
    <div class="achs">${ACHIEVEMENTS.map(a => {
      const got = save.achievements[a.id];
      return `<div class="ach ${got ? 'got' : ''}">${iconImg(got ? 'crown' : 'lock', 26)}<div><b>${esc(a.name)}</b><small>${esc(a.desc)}</small></div><span>${iconImg('gold', 12)} ${a.gold}</span></div>`;
    }).join('')}</div>
    <h3 class="section-t">Bestiaire</h3>
    <div class="bestiary">${ZONES.map(z => zoneSteps(z).map((m, k) => {
      const known = st.kills[m.name];
      return `<div class="beast ${known ? '' : 'unknown'} ${m.boss ? 'boss' : ''}"><img class="px" src="${creatureURL(`${z.id}-${k}-${m.name}`, m.body, m.pal, { boss: m.boss })}" alt=""><small>${known ? esc(m.name) : '???'}</small></div>`;
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
