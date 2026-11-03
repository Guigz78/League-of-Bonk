// Ouverture des coffres de butin : cartes révélées une par une (le meilleur pour la fin), récapitulatif du contenu.
import { BOOSTS, LOOT_TIERS, MYTHIC, PARTS, RARITIES, RARITY, SLOTS, UPGRADES, ZONES } from './data.js';
import { save, openChest, itemPower, rarityIdx } from './save.js';
import { iconImg, chestURL } from './art.js';
import { sfx } from './audio.js';
import { app, mount, $, esc, fmt, wait } from './ui.js';
import { itemArt, itemFx, statRows, buzz } from './item-ui.js';
import { announceAchievements } from './game.js';

// tuile d'une pièce d'équipement (couleur de sa rareté)
export function partIcon(slot, r, size = 28) {
  return `<span class="part-ic r-${RARITIES[r]}">${iconImg(PARTS[slot].icon, size)}</span>`;
}

// regroupe le contenu de plusieurs coffres
export function lootAgg(results) {
  const parts = {}, boosts = {}, items = [], upgs = [];
  let gold = 0, shards = 0;
  for (const res of results) {
    for (const p of res.parts) parts[p.slot + ':' + p.r] = (parts[p.slot + ':' + p.r] || 0) + p.n;
    if (res.boost) boosts[res.boost] = (boosts[res.boost] || 0) + 1;
    for (const it of res.items || []) items.push(it);
    if (res.upg) upgs.push({ key: res.upg, lv: res.upgLv });
    gold += res.gold; shards += res.shards | 0;
  }
  return {
    parts: Object.entries(parts).map(([key, n]) => { const [slot, r] = key.split(':'); return { slot, r: +r, n }; }).sort((a, b) => b.r - a.r || b.n - a.n),
    boosts, items, upgs, gold, shards,
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
  if (A.shards) { const i = out.findIndex(x => x.k === 'item' && x.it.rarity === 'mythic'); out.splice(i < 0 ? out.length : i, 0, { k: 'shard', n: A.shards }); } // avant l'objet mythique
  return out;
}
export const isEq = it => save.equipped[it.slot] === it.id;

// grande carte d'un objet (coffre, forge) : rareté, toutes ses caractéristiques, effet légendaire
export function itemCard(it, { ribbon = '' } = {}) {
  const R = RARITY[it.rarity];
  return `<div class="rcard icard r-${it.rarity}">
    ${ribbon ? `<i class="rc-ribbon">${ribbon}</i>` : ''}
    <span class="rc-rar">${R.name}</span>
    <span class="rc-ic">${itemArt(it, 88)}${it.lv ? `<em class="lv-badge">+${it.lv}</em>` : ''}</span>
    <b class="rc-name">${esc(it.name)}</b>
    <span class="rc-sub">${SLOTS[it.slot]}${it.crafted ? ' · forgé' : ''}</span>
    <span class="rc-stats">${statRows(it)}</span>
    ${itemFx(it)}
    ${isEq(it) ? '<span class="rc-eq">Équipé !</span>' : ''}
  </div>`;
}

function bigCard(x) {
  if (x.k === 'item') return itemCard(x.it, { ribbon: x.it.rarity === 'mythic' ? 'Objet mythique !' : 'Nouvel objet' });
  if (x.k === 'shard') return `<div class="rcard r-mythic rc-shard"><span class="rc-rar">Mythique</span><span class="rc-ic"><i class="shard-ic big">✦</i></span>
      <b class="rc-n">×${x.n}</b><span class="rc-name">Éclat${x.n > 1 ? 's' : ''} mythique${x.n > 1 ? 's' : ''}</span><small class="rc-desc">${fmt(save.mythShards | 0)}/${MYTHIC.shards} : à ${MYTHIC.shards}, la Forge fabrique un objet mythique</small></div>`;
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
  if (x.k === 'item') return `<div class="mcard r-${x.it.rarity}" ${d}>${itemArt(x.it, 44)}${isEq(x.it) ? '<i class="mc-eq">Équipé</i>' : ''}<small>${esc(x.it.name)}</small></div>`;
  if (x.k === 'shard') return `<div class="mcard r-mythic" ${d}><i class="shard-ic">✦</i><i class="mc-n">×${x.n}</i><small>Éclat mythique</small></div>`;
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
      const myth = x.k === 'item' && x.it.rarity === 'mythic', legend = myth || (x.k === 'item' && x.it.rarity === 'legendary'), epic = x.k === 'item' && x.it.rarity === 'epic';
      w.classList.toggle('legend', legend); w.classList.toggle('epic', epic); w.classList.toggle('mythic', myth);
      sfx(x.k === 'gold' ? 'coin' : x.k === 'part' ? (x.r >= 2 ? 'loot' : 'gem') : x.k === 'boost' ? 'pick' : x.k === 'upg' ? 'levelup' : x.k === 'shard' ? 'shrine' : legend || epic ? 'chest' : 'loot');
      if (myth) { sfx('evolve'); setTimeout(() => sfx('win'), 350); }
      buzz(myth ? [80, 60, 160] : legend ? 60 : 15);
      hint.textContent = n ? 'Touchez pour la carte suivante' : 'Touchez pour le récapitulatif';
      w.classList.add('cards');
      state = 'card'; readyAt = performance.now() + 380;
    }
    function recap() {
      state = 'recap';
      w.classList.remove('cards', 'legend', 'epic', 'mythic'); w.classList.add('recapping');
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


// écran des coffres en attente : à la fin d'une partie, ou depuis l'accueil
// nom d'un coffre de butin (le Giga coffre du giga boss est un coffre mythique amélioré)
const chestName = c => (c.giga ? 'Giga coffre' : LOOT_TIERS[c.tier]?.name || '');

export function chestScreen(done, afterRun = false) {
  const list = [...save.pendingChests].sort((a, b) => b.tier + (b.giga ? 0.5 : 0) - a.tier - (a.giga ? 0.5 : 0));
  const opened = [];
  let busy = false;
  mount(`<div class="chest-screen">
    <h2 class="rs-title">${afterRun ? 'Butin de l\'expédition' : 'Coffres de butin'}</h2>
    <p class="center muted cs-hint">Touchez un coffre pour l'ouvrir</p>
    <div class="chest-grid ${list.length <= 4 ? 'few' : ''} ${list.length === 3 ? 'n3' : ''}" style="--n:${list.length === 3 ? 3 : Math.min(2, list.length)}">${list.map((c, i) => `<button class="cg-card t${c.tier}${c.giga ? ' giga' : ''}" data-i="${i}" style="--tc:${LOOT_TIERS[c.tier].color};--d:${(i * 0.06).toFixed(2)}s">
        <span class="cg-glow"></span><img class="cg-img" src="${chestURL(c.tier)}" alt="">
        <b>${esc(chestName(c))}</b><small>${esc(ZONES[c.zone]?.name || '')}</small>
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
      await revealStage([res], res.tier, esc(chestName(res)));
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
