// Forge : fabriquer un objet avec des pièces, fusionner les pièces vers la rareté au-dessus, forger un objet mythique.
import { FORGE, MYTHIC, MYTHIC_ITEMS, MYTHIC_POWERS, PARTS, RARITIES, RARITY, SLOTS } from './data.js';
import { save, canCraft, craftItem, canFuse, fuseParts, canForgeMythic, forgeMythic } from './save.js';
import { iconImg, anvilURL, hammerURL } from './art.js';
import { itemURL } from './visuals.js';
import { sfx } from './audio.js';
import { app, $, modal, esc, fmt } from './ui.js';
import { itemArt, mythBox, tapHint, buzz } from './item-ui.js';
import { partIcon, itemCard } from './chests.js';
import { announceAchievements, home, nav, refreshTopbar, itemSheet } from './game.js';

let forgeSel = { slot: 'weapon', r: 0 };
const rTag = r => `<i class="rtag" style="--rc:${RARITY[RARITIES[r]].color}">${RARITY[RARITIES[r]].name}</i>`;

export function forgeTab() {
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
    ${tapHint('Touchez une case pour choisir les pièces à utiliser')}
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
    <p class="muted forge-note">${iconImg('upg', 14)}<span>Améliorez (+1, +2… à l'infini) ou recyclez vos objets depuis l'onglet <b>Héros</b>.</span></p>
    ${mythForge()}`;
}

// objets mythiques : éclats, collection (silhouettes des objets pas encore obtenus), fabrication
function mythForge() {
  const n = save.mythShards | 0, got = save.mythGot || [], all = got.length >= MYTHIC_ITEMS.length;
  const cells = MYTHIC_ITEMS.map(M => {
    const it = got.includes(M.id) && save.inventory.find(i => i.mid === M.id), url = itemURL(M.name);
    return `<button class="mf-cell ${it ? 'got' : ''}" data-act="mythInfo" data-id="${M.id}">
      ${it ? itemArt(it, 54) : url ? `<img class="it-art sil" src="${url}" width="54" height="54" alt="">` : `<i class="mf-q">?</i>`}
      <small>${it ? esc(M.name) : '???'}</small><em>${MYTHIC_POWERS[M.power].icon}</em></button>`;
  }).join('');
  return `<section class="myth-forge">
    <div class="mf-head"><i class="shard-ic">✦</i><div><b>Objets mythiques <small>${got.length}/${MYTHIC_ITEMS.length}</small></b>
      <small>Uniques et surpuissants. Seul Gorgoth en laisse : battez-le au bout d'une expédition. Son Giga coffre donne des éclats (plus en Difficile et en Cauchemar) et parfois un objet mythique.</small></div></div>
    ${tapHint('Touchez un objet pour voir son pouvoir')}
    <div class="mf-col">${cells}</div>
    ${all ? '<p class="mf-done">✦ Collection complète : vous êtes une légende.</p>' : `<div class="mf-bar"><span class="pbar"><i style="width:${Math.min(100, n / MYTHIC.shards * 100).toFixed(1)}%"></i></span><b>${n}/${MYTHIC.shards}</b><small>éclats</small></div>
    <button class="btn myth-btn" data-act="forgeMyth" ${canForgeMythic() ? '' : 'disabled'}><i class="shard-ic">✦</i> Forger un objet mythique</button>`}
  </section>`;
}

// fiche d'un objet mythique de la collection : l'objet s'il est obtenu, sinon son pouvoir et comment l'avoir
export function mythInfo(id) {
  const M = MYTHIC_ITEMS.find(m => m.id === id); if (!M) return;
  const it = (save.mythGot || []).includes(id) && save.inventory.find(i => i.mid === id);
  if (it) return itemSheet(it.id);
  sfx('tap');
  modal({ title: `<span class="it-title r-mythic">???</span>`, cls: 'item-modal',
    body: `<div class="mi-sil">${itemURL(M.name) ? `<img class="it-art sil" src="${itemURL(M.name)}" width="110" height="110" alt="">` : ''}<span>${SLOTS[M.slot]} mythique</span></div>
      ${mythBox(M.power)}
      <p class="muted myth-note">Pas encore obtenu. Battez Gorgoth au bout d'une expédition : le Giga coffre donne des éclats mythiques (${MYTHIC.shards} = un objet mythique à la Forge) et parfois l'objet lui-même.</p>`,
    buttons: [{ label: 'Fermer', cls: 'primary', value: true }], dismissable: true });
}

export async function doForgeMyth() {
  const it = forgeMythic();
  if (!it) return;
  renderForge();
  await forgeAnim({ color: RARITY.mythic.color, big: true, bare: true, html: itemCard(it, { ribbon: 'Objet mythique !' }) }, { title: 'Objet mythique forgé' });
  announceAchievements();
  renderForge();
}

// met à jour la forge sur place (garde le défilement), l'or et les pastilles
export function renderForge() {
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

export async function doCraft() {
  const { slot, r } = forgeSel;
  const res = craftItem(slot, r);
  if (!res) return;
  const it = res.item, R = RARITY[it.rarity];
  renderForge();
  await forgeAnim({ color: R.color, big: r >= 3, bare: true, html: itemCard(it, { ribbon: 'Forgé !' }) });
  announceAchievements();
  renderForge();
}

export async function doFuse(all = false) {
  const { slot, r } = forgeSel;
  let n = 0;
  while (canFuse(slot, r) && (all || !n)) { fuseParts(slot, r); n++; }
  if (!n) return;
  const R = RARITY[RARITIES[r + 1]];
  renderForge();
  await forgeAnim({ color: R.color, html: `${partIcon(slot, r + 1, 48)}<b>${esc(PARTS[slot].name)} ×${n}</b><small style="color:${R.color}">${R.name}</small>` }, { title: 'Fusion réussie', fuse: { slot, r } });
  renderForge();
}

// touche une case de la grille des pièces : choisit l'emplacement et la rareté à forger
export function selectForge(slot, r) { forgeSel = { slot, r }; renderForge(); }
