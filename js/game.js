// Écrans du jeu et déroulé d'une expédition.
import { CLASSES, WEAPONS, TOMES, ULTS, ZONE_TIME, ZONES, PETS, PET_BY_ZONE, SLOTS, RARITY, BOSS_ITEMS, UPGRADES, ACHIEVEMENTS, MONSTER_COUNT } from './data.js';
import { save, persist, playerStats, upgradeCost, makeItem, addItem, itemPower, sellValue, checkAchievements, resetSave } from './save.js';
import { heroURL, creatureURL, iconImg } from './art.js';
import { rng } from './pixel.js';
import { sfx } from './audio.js';
import { mount, $, $$, bind, modal, toast, fmt, pct, esc, wait } from './ui.js';
import { Run } from './run.js';
import { sceneryURL } from './scenery.js';
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
        <span>${iconImg('arrow', 16)}<b>${pct(st.speed)}</b></span>
      </div>
      <button class="btn small ghost" data-act="changeClass">Changer de champion</button>
    </div>
  </section>`;
}

function adventureTab() {
  const done = save.zoneCleared.filter(Boolean).length;
  const resume = '';
  const zones = ZONES.map((z, i) => {
    const locked = i > save.unlockedZone;
    const cleared = save.zoneCleared[i];
    const sprite = z.boss ? creatureURL(`${z.id}-${zoneSteps(z).length - 1}-${z.boss.name}`, z.boss.body, z.boss.pal, { boss: true })
      : creatureURL(`${z.id}-4-${z.monsters[4].name}`, z.monsters[4].body, z.monsters[4].pal);
    return `<button class="zone ${locked ? 'locked' : ''} ${cleared ? 'cleared' : ''} ${i === 0 && !save.stats.runs ? 'cta' : ''}" data-act="zone" data-z="${i}" style="background-image:url(${sceneryURL(z)})">
      <div class="z-num">${i + 1}</div>
      <div class="z-txt"><b>${esc(z.name)}</b>${i === 0 && !save.stats.runs ? '<em class="start">Commencez ici !</em>' : ''}<small>${locked ? `Terminez « ${esc(ZONES[i - 1].name)} »` : esc(z.sub)}</small></div>
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
  const steps = zoneSteps(z);
  const first = !save.zoneCleared[i];
  const pet = PETS[PET_BY_ZONE[i]];
  const bi = BOSS_ITEMS[i];
  const reward = first ? `
      <div class="rewards">
        <div class="rw">${iconImg('star', 18)} Zone suivante débloquée</div>
        <div class="rw"><img class="px" src="${creatureURL('pet-' + PET_BY_ZONE[i], pet.body, pet.pal)}" width="22" height="22" alt=""> Familier : <b>${esc(pet.name)}</b></div>
        ${bi ? `<div class="rw">${iconImg(bi.icon, 18)} <b style="color:${RARITY.legendary.color}">${esc(bi.name)}</b></div>` : ''}
      </div>` : `<p class="muted">Zone déjà terminée : rejouez-la pour gagner de l'or et des objets (ennemis +20 %).</p>`;
  const ok = await modal({
    title: esc(z.name),
    cls: 'zone-modal',
    body: `<p class="muted">${esc(z.sub)}</p>
      <div class="enemy-row">${steps.map((m, k) => `<div class="er ${m.boss ? 'boss' : ''}" title="${esc(m.name)}"><img class="px" src="${creatureURL(`${z.id}-${k}-${m.name}`, m.body, m.pal, { boss: m.boss })}" alt=""></div>`).join('')}</div>
      <div class="goal">${iconImg('star', 18)}<div>Survivez <b>${Math.round(ZONE_TIME[i] / 60)} minutes</b> aux hordes, puis battez <b>${esc((z.boss || z.monsters[4]).name)}</b>.</div></div>
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

function startRun(z) {
  save.stats.runs++;
  persist();
  const zone = ZONES[z];
  run = new Run({
    zone,
    onPause: resume => pauseMenu(resume),
    onLevelUp: (lvl, opts, done) => levelUpMenu(lvl, opts, done),
    onChest: (c, gold, done) => chestMenu(c, gold, done),
    onDefeat: canRevive => defeatMenu(canRevive),
    onEnd: sum => endRun(zone, sum),
  });
  battle = run;
  window.__lobRun = run; // utile pour les tests automatisés
  run.start();
}

function choiceInfo(c) {
  if (c.kind === 'weapon') { const w = WEAPONS[c.id]; return { icon: w.icon, name: w.name, tag: c.lv === 1 ? 'Nouvelle arme' : `Arme · niv. ${c.lv}`, desc: c.lv === 1 ? w.desc : w.lv[c.lv - 1], cls: 'weapon' }; }
  if (c.kind === 'tome') { const t = TOMES[c.id]; return { icon: t.icon, name: t.name, tag: c.lv === 1 ? 'Nouveau tome' : `Tome · niv. ${c.lv}`, desc: t.desc, cls: 'tome' }; }
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

function levelUpMenu(lvl, opts, done) {
  const w = overlay(`<div class="lvlup">
    <h2>Niveau ${lvl} !</h2><p class="muted">Choisissez une amélioration</p>
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

async function pauseMenu(resume) {
  const v = await modal({
    title: 'Pause',
    body: `<div class="toggles">
        <label class="toggle"><input type="checkbox" id="pSound" ${save.settings.sound ? 'checked' : ''}> Son</label>
        <label class="toggle"><input type="checkbox" id="pVib" ${save.settings.vibrate ? 'checked' : ''}> Vibrations</label>
      </div>
      <div class="howto">
        <p>${iconImg('arrow', 16)} <b>Se déplacer</b> : posez le doigt n'importe où et glissez.</p>
        <p>${iconImg('sword', 16)} <b>Attaquer</b> : c'est automatique ! Ramassez les gemmes pour monter de niveau.</p>
        <p>${iconImg('nova', 16)} <b>Ultime</b> : se charge en battant des monstres, touchez le bouton en bas à droite.</p>
        <p>${iconImg('crown', 16)} <b>Objectif</b> : survivez jusqu'à la fin du chrono puis battez le boss.</p>
      </div>
      <div class="cur-build">${run.p.weapons.map(w => `<span>${iconImg(WEAPONS[w.id].icon, 18)} ${esc(WEAPONS[w.id].name)} <b>${w.lv}</b></span>`).join('')}${Object.entries(run.p.tomes).map(([id, lv]) => `<span>${iconImg(TOMES[id].icon, 18)} ${esc(TOMES[id].name)} <b>${lv}</b></span>`).join('')}</div>`,
    buttons: [{ label: 'Abandonner', cls: 'danger ghost', value: 'quit' }, { label: 'Reprendre', cls: 'primary', value: 'resume' }],
  });
  save.settings.sound = $('#pSound')?.checked ?? save.settings.sound;
  save.settings.vibrate = $('#pVib')?.checked ?? save.settings.vibrate;
  persist();
  if (v === 'quit') {
    const ok = await modal({ title: 'Abandonner ?', body: `<p>La partie s'arrête ici. Vous gardez <b>${fmt(run.gold)} or</b> ramassés.</p>`, buttons: [{ label: 'Continuer', cls: 'ghost', value: false }, { label: 'Abandonner', cls: 'danger', value: true }] });
    if (ok) { run.finish(false); return; }
  }
  resume();
}

async function defeatMenu(canRevive) {
  const v = await modal({
    title: 'K.O. !',
    cls: 'ko-modal',
    body: canRevive
      ? `<p>Vous êtes tombé au combat après <b>${fmtTime(run.time)}</b>.</p><p><b>Regardez une courte publicité</b> pour revenir avec tous vos PV. Les monstres autour de vous seront balayés.</p><p class="muted">Possible une fois par partie.</p>`
      : `<p>Vous êtes tombé au combat après <b>${fmtTime(run.time)}</b>.</p>`,
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

function endRun(z, sum) {
  battle = null; run = null;
  const st = save.stats;
  st.kills += sum.kills;
  st.bestLevel = Math.max(st.bestLevel, sum.level);
  if (!sum.win) st.deaths++;
  const lines = [];
  let gold = Math.round(sum.gold);
  // butin d'objets
  const r = rng(Date.now());
  const found = [];
  const drops = sum.win ? 1 + (Math.random() < 0.5) : (sum.time > 90 && Math.random() < 0.4 ? 1 : 0);
  for (let i = 0; i < drops; i++) {
    const it = makeItem(r, z.id, { boost: sum.win ? 0.25 : 0 });
    it.isNew = true; it._eq = addItem(it); found.push(it);
  }
  const first = sum.win && !save.zoneCleared[z.id];
  if (sum.win) {
    st.wins++;
    st.classWins[save.cls] = (st.classWins[save.cls] || 0) + 1;
    if (!sum.revived) st.cleanZone = true;
    const bonus = Math.round((40 + z.id * 40) * (save.zoneCleared[z.id] ? 0.6 : 1));
    gold += bonus;
    lines.push(`${iconImg('crown', 22)} Bonus de victoire : <b>+${fmt(bonus)} or</b>`);
  }
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
      it._eq = addItem(it); found.push(it);
    }
  }
  save.gold += gold;
  persist();
  announceAchievements();
  const finale = first && z.id === ZONES.length - 1;
  mount(`<div class="reward-screen ${sum.win ? 'complete' : 'lost'}">
    <h2 class="rs-title">${finale ? 'La Faille est sauvée !' : sum.win ? 'Victoire !' : 'Fin de partie'}</h2>
    <p class="center muted">${esc(z.name)}</p>
    ${finale ? `<p class="center finale">Le Baron Nashar est tombé. Vous avez vaincu les 5 boss de Runeterre. Bravo, champion !</p>` : ''}
    <div class="run-stats card">
      <div><b>${fmtTime(sum.time)}</b><small>Survie</small></div>
      <div><b>${fmt(sum.kills)}</b><small>Monstres</small></div>
      <div><b>${sum.level}</b><small>Niveau</small></div>
      <div><b class="gold-t">${fmt(gold)}</b><small>Or gagné</small></div>
    </div>
    <div class="summary">
      ${lines.map(l => `<div class="rw">${l}</div>`).join('')}
      ${found.map(it => `<div class="rw r-${it.rarity} loot-row">${iconImg(it.icon, 22)} <b style="color:${RARITY[it.rarity].color}">${esc(it.name)}</b> <small>${RARITY[it.rarity].name} · ${statLine(it.stat)}${it._eq ? ' · équipé' : ''}</small></div>`).join('')}
    </div>
    <div class="build">${sum.weapons.map(w => `<span>${iconImg(WEAPONS[w.id].icon, 20)}<b>${w.lv}</b></span>`).join('')}${Object.entries(sum.tomes).map(([id, lv]) => `<span>${iconImg(TOMES[id].icon, 20)}<b>${lv}</b></span>`).join('')}</div>
    ${!sum.win ? `<p class="center muted tip">${tipFor(sum)}</p>` : ''}
    <div class="end-btns">
      <button class="btn ghost" data-act="home">Carte</button>
      <button class="btn primary" data-act="again">${sum.win && z.id + 1 < ZONES.length && first ? 'Zone suivante' : 'Rejouer'}</button>
    </div>
  </div>`);
  sfx(sum.win ? 'win' : 'coin');
  for (const it of found) delete it._eq;
  bind($('.reward-screen'), {
    home: () => home('adventure'),
    again: () => startRun(sum.win && first && z.id + 1 < ZONES.length ? z.id + 1 : z.id),
  });
}

function tipFor(sum) {
  if (canAffordUpgrade()) return 'Astuce : vous avez assez d\'or pour une amélioration permanente dans la Boutique !';
  if (sum.time < 60) return 'Astuce : restez en mouvement et tournez autour des monstres plutôt que de foncer dedans.';
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
  if (s.regen) p.push(`+${Math.round(s.regen * 2) / 10} PV/s`);
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
          <div class="lvl"><span>Niv. ${lvl}/${u.max}</span><div class="lbar"><i style="width:${lvl / u.max * 100}%"></i></div></div></div>
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
  const seen = Object.keys(st.seen).length;
  return `<div class="stat-grid card">
      <div><b>${fmt(st.wins)}</b><small>Zones gagnées</small></div>
      <div><b>${seen}/${MONSTER_COUNT + 5}</b><small>Bestiaire</small></div>
      <div><b>${fmt(st.kills)}</b><small>Monstres vaincus</small></div>
      <div><b>${fmt(st.ults)}</b><small>Ultimes</small></div>
    </div>
    <h3 class="section-t">Succès <small>${n}/${ACHIEVEMENTS.length}</small></h3>
    <div class="achs">${ACHIEVEMENTS.map(a => {
      const got = save.achievements[a.id];
      return `<div class="ach ${got ? 'got' : ''}">${iconImg(got ? 'crown' : 'lock', 26)}<div><b>${esc(a.name)}</b><small>${esc(a.desc)}</small></div><span>${iconImg('gold', 12)} ${a.gold}</span></div>`;
    }).join('')}</div>
    <h3 class="section-t">Bestiaire</h3>
    <div class="bestiary">${ZONES.map(z => zoneSteps(z).map((m, k) => {
      const known = st.seen[m.name];
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
