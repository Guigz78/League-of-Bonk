// Écrans de la saison (L1) : bandeau « objectifs » de l'accueil, Pass d'expédition (40 paliers), quêtes du jour et de la
// semaine, calendrier de connexion de 20 jours, succès par catégorie, titres, bilan de saison en fin de partie.
// game.js n'a que des points d'accroche (bouton, appel d'écran, fin de partie) ; la logique est dans season.js et daily.js.
import { CLASSES, BOOSTS, LOOT_TIERS, RARITIES, SEASON_TRACK, SEASON_TIERS, SEASON_XP, SEASON_DAYS, CAL_REWARDS, TITLES, ACH_CATS, WEEKLY } from './data.js';
import { save, persist } from './save.js';
import { iconImg, chestURL } from './art.js';
import { heroURL } from './visuals.js';
import { sfx, buzz } from './audio.js';
import { mount, $, bind, modal, toast, fmt, esc } from './ui.js';
import { seasonInfo, claimTier, claimAll, achList, titleList, setTitle, titleName, sumUp, seasonWeek, CUM } from './season.js';
import { questList, claimQuest, weeklyList, claimWeekly, loginState, claimLogin } from './daily.js';

const s = n => (n > 1 ? 's' : '');
const RAR_F = ['commune', 'rare', 'épique', 'légendaire']; // « pièce rare », « pièces épiques »
const chestShort = t => { const n = (LOOT_TIERS[t]?.name || 'Coffre').replace(/^Coffre\s+(en\s+)?/i, ''); return n.charAt(0).toUpperCase() + n.slice(1); };
const partIc = (r, size = 22) => `<span class="part-ic r-${RARITIES[r]}">${iconImg('part', size)}</span>`;
// champion verrouillé qu'une récompense peut débloquer (sinon : récompense de remplacement)
const clsOpen = id => !!CLASSES[id]?.locked && !save.unlocks?.['cls:' + id];

// contenu d'une récompense (palier, calendrier) : [{ html (icône), t (texte), c (couleur) }]
export function rwItems(R, out = []) {
  if (!R) return out;
  if (R.cls) {
    if (clsOpen(R.cls)) out.push({ html: `<img class="px spr st-hero" src="${heroURL(R.cls, null, 0)}" alt="">`, t: `Champion : ${CLASSES[R.cls].name}`, c: 'var(--acc)' });
    else rwItems(R.alt, out);
  }
  const chests = [].concat(R.chest ?? []);
  for (const t of [...new Set(chests)]) {
    const n = chests.filter(x => x === t).length;
    out.push({ html: `<img class="chest-i" src="${chestURL(t)}" alt="">`, t: `${n > 1 ? n + ' × ' : ''}${LOOT_TIERS[t].name}`, c: LOOT_TIERS[t].color });
  }
  if (R.parts) out.push({ html: partIc(R.parts[0]), t: `${R.parts[1]} pièce${s(R.parts[1])} ${RAR_F[R.parts[0]]}${s(R.parts[1])}` });
  if (R.boost) out.push({ html: iconImg('potion', 22), t: `${R.boost} bonus au hasard` });
  if (BOOSTS[R.boostId]) out.push({ html: iconImg(BOOSTS[R.boostId].icon, 22), t: BOOSTS[R.boostId].name });
  if (R.upg) out.push({ html: iconImg('upg', 22), t: R.upg > 1 ? `${R.upg} niveaux de Boutique offerts` : '1 niveau de Boutique offert' });
  if (R.title && TITLES[R.title]) out.push({ html: iconImg('flag', 22), t: `Titre « ${TITLES[R.title].name} »`, c: 'var(--cy)' });
  if (R.gold) out.push({ html: iconImg('gold', 22), t: `${fmt(R.gold)} or` });
  return out;
}

// texte court de ce qui a été donné (toasts, bilan de saison)
export function gotText(g) {
  const o = Array.isArray(g) ? sumUp(g) : g || {}, out = [];
  for (const id of o.cls || []) out.push(`champion <b>${esc(CLASSES[id]?.name || id)}</b>`);
  const ch = o.chests || [];
  for (const t of [...new Set(ch)].sort((a, b) => b - a)) { const n = ch.filter(x => x === t).length; out.push(`<b>${n > 1 ? n + ' × ' : ''}${esc(LOOT_TIERS[t].name)}</b>`); }
  if (o.parts) out.push(`${o.parts} pièce${s(o.parts)}`);
  if (o.boosts) out.push(`${o.boosts} bonus`);
  if (o.upg) out.push(`${o.upg} niveau${o.upg > 1 ? 'x' : ''} de Boutique`);
  for (const id of o.titles || []) out.push(`titre « ${esc(TITLES[id]?.name || id)} »`);
  if (o.gold) out.push(`<b>+${fmt(o.gold)} or</b>`);
  return out.join(', ') || 'rien';
}

// après une récompense : nouveau champion mis en scène, titres et coffres annoncés
async function celebrate(list) {
  const S = sumUp(list);
  for (const id of S.cls) {
    sfx('levelup'); buzz(60);
    await modal({
      title: `${iconImg('user', 22)} Nouveau champion`,
      body: `<div class="new-champ"><img class="px spr" src="${heroURL(id, null, 0)}" alt=""><b>${esc(CLASSES[id].name)}</b><small>${esc(CLASSES[id].role || '')}</small>
        <p>${esc(CLASSES[id].desc || '')}</p><p class="muted">Choisissez-le depuis l'accueil (« Changer »).</p></div>`,
      buttons: [{ label: 'Génial !', cls: 'primary', value: true }], dismissable: true,
    });
  }
  if (S.titles.length) toast(`${iconImg('flag', 16)} Nouveau titre : <b>${esc(TITLES[S.titles[0]].name)}</b>`, 2600);
  if (S.chests.length) toast(`${iconImg('chest', 16)} ${S.chests.length} coffre${s(S.chests.length)} à ouvrir depuis l'accueil`, 2400);
}

// ---------- Accueil : bandeau « objectifs » (pass + quêtes + connexion + coffres) ----------
export function hubStrip() {
  const I = seasonInfo(), qs = questList(), ws = weeklyList(), L = loginState(), pc = save.pendingChests;
  const qDone = qs.filter(q => q.prog >= q.n).length, wDone = ws.filter(q => q.prog >= q.n).length;
  const qHot = qs.some(q => q.ready) || ws.some(q => q.ready);
  const nx = I.max ? null : rwItems(SEASON_TRACK[I.tier])[0];
  const x2 = I.bonus > 0 ? `<b class="ps-x2">${iconImg('bolt', 12)}XP ×${SEASON_XP.bonusMul} · ${Math.ceil(I.bonus / 60)} min</b>` : '';
  const lDay = L.ready ? L.day + 1 : L.day || L.len;
  return `<button class="pass-strip ${I.ready.length ? 'hot' : ''}" data-act="season" aria-label="Pass d'expédition">
      <span class="ps-lv"><small>Palier</small><b>${I.tier}</b></span>
      <span class="ps-mid">
        <span class="ps-top"><span class="eyebrow">Pass d'expédition · S${I.n}</span><em>${I.left} j</em></span>
        <span class="pbar"><i style="width:${I.max ? 100 : (I.cur / I.need * 100).toFixed(1)}%"></i></span>
        <span class="ps-sub"><span>${I.max ? 'Palier maximum !' : `${fmt(I.cur)} / ${fmt(I.need)} XP`}</span>${x2}</span>
      </span>
      <span class="ps-next">${I.ready.length ? `<b class="ps-ready">${I.ready.length}</b><small>à réclamer</small>` : nx ? `<span class="ps-ic">${nx.html}</span><small>Palier ${I.tier + 1}</small>` : `<span class="ps-ic">${iconImg('crown', 26)}</span><small>Terminé</small>`}</span>
    </button>
    <div class="quick">
      <button class="qt ${qHot ? 'hot' : ''}" data-act="quests">${iconImg('quest', 22)}<span class="eyebrow">Quêtes</span><b>${qDone}/${qs.length}</b><small class="qt-sub">Semaine ${wDone}/${ws.length}</small><span class="pbar"><i style="width:${qDone / qs.length * 100}%"></i></span></button>
      <button class="qt ${L.ready ? 'hot' : ''}" data-act="login">${iconImg('calendar', 22)}<span class="eyebrow">Connexion</span><b>Jour ${lDay}/${L.len}</b><small class="qt-sub">${L.ready ? 'À réclamer' : 'Reçu · à demain'}</small><span class="pbar cy"><i style="width:${(L.ready ? L.day : lDay) / L.len * 100}%"></i></span></button>
      <button class="qt ${pc.length ? 'hot' : 'off'}" data-act="chests" ${pc.length ? '' : 'disabled'}>${iconImg('chest', 22)}<span class="eyebrow">Coffres</span><b>${pc.length ? `${pc.length}` : '0'}</b><small class="qt-sub">${pc.length ? 'À ouvrir' : 'Aucun'}</small><span class="pbar"><i style="width:${pc.length ? 100 : 0}%"></i></span></button>
    </div>`;
}

// titre affiché sous le nom du champion (accueil) : touche = choix du titre
export function heroTitle() {
  return `<button class="sc-title" data-act="title" aria-label="Choisir un titre">${iconImg('flag', 12)}<span>${esc(titleName() || TITLES.recrue.name)}</span></button>`;
}

// ---------- Pass d'expédition ----------
function trackRow(p, I) {
  const R = SEASON_TRACK[p - 1], got = I.S.got.includes(p), ready = !got && p <= I.tier, next = p === I.tier + 1;
  const state = got ? 'got' : ready ? 'ready' : next ? 'next' : 'lock';
  const items = rwItems(R);
  const act = got ? `<span class="q-claimed">${iconImg('check', 14)} Reçu</span>`
    : ready ? `<button class="btn primary small" data-act="claim" data-tier="${p}">Réclamer</button>`
    : next ? `<span class="st-xp"><b>${fmt(I.cur)}</b>/${fmt(I.need)} XP</span>`
    : `<span class="st-xp">${iconImg('lock', 12)} ${fmt(CUM[p] - I.xp)} XP</span>`;
  return `<div class="st-row ${state} ${R.big ? 'big' : ''}" id="st-${p}">
      <span class="st-node"><b>${p}</b></span>
      <div class="st-card">
        ${R.big ? '<em class="st-tag">Grande récompense</em>' : ''}
        <div class="st-rw">${items.map(it => `<span class="st-it" ${it.c ? `style="--tc:${it.c}"` : ''}><span class="st-ic">${it.html}</span><small>${esc(it.t)}</small></span>`).join('')}</div>
        ${next ? `<span class="pbar st-bar"><i style="width:${(I.cur / I.need * 100).toFixed(1)}%"></i></span>` : ''}
        <div class="st-act">${act}</div>
      </div>
    </div>`;
}

function seasonHTML() {
  const I = seasonInfo(), X = SEASON_XP;
  const bonus = I.bonus > 0
    ? `<p class="ss-bonus on">${iconImg('bolt', 16)}<span><b>Bonus du jour : XP des parties ×${X.bonusMul}</b> encore ${Math.ceil(I.bonus / 60)} min aujourd'hui</span></p>`
    : `<p class="ss-bonus">${iconImg('clock', 16)}<span>Bonus du jour utilisé : revenez demain pour <b>doubler l'XP</b> de vos premières parties.</span></p>`;
  const rows = Array.from({ length: SEASON_TIERS }, (_, i) => trackRow(i + 1, I)).join('');
  return `<div class="season-screen scroll">
    <header class="ss-head">
      <button class="icon-btn" data-act="back" aria-label="Retour">${iconImg('back', 20)}</button>
      <div class="ss-ttl"><span class="eyebrow">Saison ${I.n} · jour ${I.day}/${SEASON_DAYS}</span><h2>Pass d'expédition</h2></div>
      <span class="ss-left"><b>${I.left}</b><small>jour${s(I.left)}</small></span>
    </header>
    <section class="ss-sum">
      <span class="ss-lv"><small>Palier</small><b>${I.tier}</b><small>/ ${SEASON_TIERS}</small></span>
      <span class="ss-xp">
        <span class="ss-xpt">${I.max ? '<b>Saison accomplie !</b>' : `<b>${fmt(I.cur)}</b> / ${fmt(I.need)} XP <small>vers le palier ${I.tier + 1}</small>`}</span>
        <span class="pbar"><i style="width:${I.max ? 100 : (I.cur / I.need * 100).toFixed(1)}%"></i></span>
        <small class="ss-tot">${fmt(I.xp)} XP gagnés cette saison</small>
      </span>
    </section>
    ${bonus}
    ${I.ready.length ? `<button class="btn primary big ss-all" data-act="claimAll">Tout réclamer (${I.ready.length})</button>` : ''}
    <div class="ss-track">${rows}</div>
    <section class="ss-help">
      <h4>Gagner de l'XP de saison</h4>
      <ul>
        <li>${iconImg('crown', 16)}<span>Boss vaincu : <b>${X.boss} + ${X.bossZone} par monde</b> (×1,5 en Difficile, ×2 en Cauchemar)</span></li>
        <li>${iconImg('skull', 16)}<span>${X.kills} monstres : <b>1</b> · coffre trouvé : <b>${X.chest}</b> · totem : <b>${X.totem}</b> · minute de jeu : <b>${X.min}</b></span></li>
        <li>${iconImg('bolt', 16)}<span>Bonus du jour : XP des parties <b>×${X.bonusMul}</b> pendant les ${X.bonus / 60} premières minutes de jeu de chaque jour</span></li>
        <li>${iconImg('quest', 16)}<span>Quête du jour : <b>${X.quest}</b> · quête de la semaine : <b>${Math.min(...WEEKLY.flatMap(q => q.xp))} à ${Math.max(...WEEKLY.flatMap(q => q.xp))}</b> · connexion : <b>${X.login}</b></span></li>
        <li>${iconImg('calendar', 16)}<span>Au bout de ${SEASON_DAYS} jours, la saison suivante commence (mêmes paliers) : les récompenses atteintes et pas réclamées sont données d'office.</span></li>
      </ul>
    </section>
  </div>`;
}

// écran du pass ; done() au retour
export function seasonScreen(done) {
  let first = true;
  const draw = () => {
    const keep = first ? 0 : $('.season-screen')?.scrollTop || 0;
    mount(seasonHTML());
    const root = $('.season-screen');
    if (first) { // palier en cours au milieu de l'écran
      const I = seasonInfo(), p = I.ready[0] || Math.min(SEASON_TIERS, I.tier + 1), row = document.getElementById('st-' + p);
      if (row && p > 2) root.scrollTop = Math.max(0, row.offsetTop - root.clientHeight * 0.4);
    } else root.scrollTop = keep;
    first = false;
    bind(root, {
      back: () => done(),
      claim: async el => {
        const p = +el.dataset.tier, got = claimTier(p);
        if (!got) return;
        sfx('loot'); buzz(25);
        toast(`${iconImg('star', 16)} Palier ${p} : ${gotText(got)}`, 2600);
        draw();
        await celebrate(got);
      },
      claimAll: async () => {
        const got = claimAll();
        if (!got.length) return;
        sfx('loot'); buzz(40);
        toast(`${iconImg('star', 16)} Récompenses : ${gotText(got)}`, 3200);
        draw();
        await celebrate(got);
      },
    });
  };
  draw();
}

// ---------- Fin de partie : XP de saison gagnée (bilan) ----------
const LINE = { boss: 'Boss', kills: 'Monstres', chests: 'Coffres', totems: 'Totems', time: 'Temps de jeu' };
export function runPassBlock(P) {
  if (!P) return '';
  const I = P.info, up = P.t1 > P.t0;
  const from = up ? 0 : Math.max(0, (I.cur - P.xp) / I.need * 100), to = I.max ? 100 : I.cur / I.need * 100;
  const chips = P.lines.map(([k, , xp]) => `<span>${LINE[k] || k} <b>+${fmt(xp)}</b></span>`).join('')
    + (P.bonus ? `<span class="x2">${iconImg('bolt', 12)}Bonus du jour <b>+${fmt(P.bonus)}</b></span>` : '');
  const note = up ? `<span class="pr-up">${iconImg('star', 16)}Palier ${I.tier} atteint ! ${I.ready.length ? `${I.ready.length} récompense${s(I.ready.length)} à réclamer` : ''}</span>`
    : P.bonus && !P.left ? `<span class="pr-note">Bonus du jour épuisé : revenez demain pour doubler l'XP.</span>` : '';
  return `<button class="pass-res ${up ? 'up' : ''}" data-act="season">
      <span class="pr-head">${iconImg('flag', 20)}<b>Pass d'expédition</b><em>+${fmt(P.xp)} XP</em></span>
      ${chips ? `<span class="pr-chips">${chips}</span>` : ''}
      <span class="pr-bar"><span class="pr-lv">${I.tier}</span><span class="pbar"><i style="--from:${from.toFixed(1)}%;width:${to.toFixed(1)}%"></i></span><small>${I.max ? 'Max' : `${fmt(I.cur)}/${fmt(I.need)}`}</small></span>
      ${note}
    </button>`;
}

// ---------- Quêtes du jour et de la semaine ----------
let qTab = 'day';
export async function questSheet() {
  const id = 'qs-' + Date.now();
  const row = (q, k) => `<div class="quest ${q.claimed ? 'done' : ''} ${q.ready ? 'ready' : ''}">
      ${iconImg(q.icon, 22)}
      <div class="q-txt"><b>${esc(q.text)}</b>
        <div class="q-row"><span class="pbar ${q.prog >= q.n ? 'green' : ''}"><i style="width:${q.prog / q.n * 100}%"></i></span><em>${fmt(q.prog)}/${fmt(q.n)}</em></div>
        <span class="q-rw">${iconImg('chest', 14)} ${esc(chestShort(q.tier))} · ${iconImg('gold', 14)} ${q.gold} · <i class="q-xp">+${q.xp} XP</i></span></div>
      ${q.claimed ? `<span class="q-claimed">${iconImg('check', 14)} Reçu</span>` : q.ready ? `<button class="btn primary small" data-q="${q.i}" data-k="${k}">Réclamer</button>`
        : `<span class="q-chest" aria-hidden="true"><img src="${chestURL(q.tier)}" alt=""></span>`}
    </div>`;
  const body = () => {
    const qs = questList(), ws = weeklyList(), W = seasonWeek();
    const n = l => l.filter(q => q.prog >= q.n).length, hot = l => (l.some(q => q.ready) ? '<i class="q-dot"></i>' : '');
    const list = qTab === 'day' ? qs : ws;
    return `<div class="seg q-tabs">
        <button data-tab="day" class="${qTab === 'day' ? 'on' : ''}">Du jour <em>${n(qs)}/${qs.length}</em>${hot(qs)}</button>
        <button data-tab="week" class="${qTab === 'week' ? 'on' : ''}">De la semaine <em>${n(ws)}/${ws.length}</em>${hot(ws)}</button>
      </div>
      <div class="quests">${list.map(q => row(q, qTab)).join('')}</div>
      <p class="q-reset">${qTab === 'day' ? 'Nouvelles quêtes chaque jour à minuit'
        : `Semaine ${W.w + 1}/3 de la saison · nouvelles quêtes dans ${W.left} jour${s(W.left)}`}</p>`;
  };
  const p = modal({ title: `${iconImg('quest', 22)} Quêtes`, body: `<div id="${id}">${body()}</div>`, buttons: [{ label: 'Fermer', cls: 'ghost', value: true }], dismissable: true });
  const root = document.getElementById(id);
  root.addEventListener('click', e => {
    const t = e.target.closest('[data-tab]');
    if (t) { qTab = t.dataset.tab; sfx('tap'); root.innerHTML = body(); return; }
    const b = e.target.closest('[data-q]'); if (!b || b.disabled) return;
    const r = b.dataset.k === 'week' ? claimWeekly(+b.dataset.q) : claimQuest(+b.dataset.q);
    if (!r) return;
    sfx('loot'); buzz(20);
    toast(`${iconImg('chest', 16)} <b>${esc(LOOT_TIERS[r.chest]?.name || 'Coffre')}</b>, <b>+${r.gold} or</b> et <b>+${r.xp} XP</b> de saison`);
    if (r.t1 > r.t0) toast(`${iconImg('star', 16)} Pass d'expédition : <b>palier ${r.t1}</b> atteint !`);
    root.innerHTML = body();
  });
  await p;
}

// ---------- Calendrier de connexion (20 jours) ----------
function calCell(R) {
  const ch = [].concat(R.chest ?? []);
  if (ch.length) {
    const t = Math.max(...ch), extra = R.title ? '+ titre' : R.boost ? `+ ${R.boost} bonus` : R.gold ? `+ ${R.gold} or` : 'Coffre';
    return `<span class="ld-ic"><img class="chest-i" src="${chestURL(t)}" alt=""></span><b style="--tc:${LOOT_TIERS[t].color}">${esc(chestShort(t))}</b><small>${extra}</small>`;
  }
  if (R.parts) return `<span class="ld-ic">${partIc(R.parts[0], 24)}</span><b>×${R.parts[1]}</b><small>Pièce${s(R.parts[1])} ${RAR_F[R.parts[0]]}${s(R.parts[1])}</small>`;
  if (BOOSTS[R.boostId]) return `<span class="ld-ic">${iconImg(BOOSTS[R.boostId].icon, 30)}</span><b>Bonus</b><small>${esc(BOOSTS[R.boostId].name)}</small>`;
  if (R.boost) return `<span class="ld-ic">${iconImg('potion', 30)}</span><b>Bonus</b><small>au hasard</small>`;
  if (R.upg) return `<span class="ld-ic">${iconImg('upg', 30)}</span><b>+${R.upg} niv.</b><small>Boutique</small>`;
  return `<span class="ld-ic">${iconImg('gold', 30)}</span><b>${fmt(R.gold)}</b><small>or</small>`;
}

export async function loginSheet() {
  const id = 'lg-' + Date.now();
  const body = () => {
    const L = loginState(), cur = L.ready ? L.day : -1, got = L.ready ? L.day : (L.day || L.len);
    return `<div class="login-track cal">${CAL_REWARDS.map((R, k) => `<div class="lday ${k < got ? 'got' : ''} ${k === cur ? 'today' : ''} ${R.big ? 'big' : ''}" ${k === cur ? 'id="ldToday"' : ''}>
        <em>Jour ${k + 1}</em>${calCell(R)}${k < got ? `<i class="ld-ok" aria-label="Reçu">${iconImg('check', 14)}</i>` : ''}</div>`).join('')}</div>
      <p class="login-note">${L.ready ? `Chaque jour : une récompense et <b>+${SEASON_XP.login} XP</b> de saison. Les jours 7, 14 et 20 sont les plus gros.` : 'Récompense du jour reçue. Revenez demain !'}
        <br><small>Un jour manqué ne fait rien perdre : le calendrier reprend où vous en étiez.</small></p>`;
  };
  const L0 = loginState();
  const p = modal({ title: `${iconImg('calendar', 22)} Calendrier · ${L0.len} jours`, cls: 'cal-modal', body: `<div id="${id}">${body()}</div>`,
    buttons: L0.ready ? [{ label: 'Plus tard', cls: 'ghost', value: false }, { label: `Réclamer · jour ${L0.day + 1}`, cls: 'primary', value: true }] : [{ label: 'Fermer', cls: 'ghost', value: false }],
    dismissable: true });
  const today = document.getElementById('ldToday');
  if (today) { const mb = today.closest('.modal-body'); if (mb) mb.scrollTop = Math.max(0, today.offsetTop - mb.clientHeight * 0.35); }
  const v = await p;
  if (!v) return;
  const r = claimLogin();
  if (!r) return;
  sfx('loot'); buzz(25);
  toast(`${iconImg('calendar', 16)} Jour ${r.day + 1} : ${gotText(r.got)} · <b>+${r.xp} XP</b>`, 3000);
  if (r.t1 > r.t0) toast(`${iconImg('star', 16)} Pass d'expédition : <b>palier ${r.t1}</b> atteint !`);
  await celebrate(r.got);
}

// ---------- Succès (onglet) et titres ----------
const openCats = new Set(['combat']); // catégories dépliées (gardées d'un affichage à l'autre)
document.addEventListener('toggle', e => {
  const d = e.target;
  if (d?.classList?.contains('ach-cat')) { if (d.open) openCats.add(d.dataset.cat); else openCats.delete(d.dataset.cat); }
}, true);

const achRow = a => `<div class="ach ${a.got ? 'got' : ''}">${iconImg(a.got ? 'crown' : ACH_CATS[a.cat]?.icon || 'lock', 24)}
    <div><b>${esc(a.name)}</b><small>${esc(a.desc)}</small>${a.got || !(a.goal > 1) ? '' : `<span class="ach-p"><span class="pbar"><i style="width:${(a.val / a.goal * 100).toFixed(1)}%"></i></span><em>${fmt(a.val)}/${fmt(a.goal)}</em></span>`}</div>
    <span class="ach-rw">${a.title && TITLES[a.title] ? `<i class="ach-ti">${iconImg('flag', 12)}Titre</i>` : ''}<span>${iconImg('gold', 12)} ${a.gold}</span></span>
  </div>`;

export function achBlock() {
  const all = achList(), n = all.filter(a => a.got).length, T = titleList(), own = T.filter(t => t.own).length;
  const cats = Object.entries(ACH_CATS).map(([id, C]) => ({ id, ...C, list: all.filter(a => a.cat === id) })).filter(c => c.list.length);
  return `<button class="title-card" data-act="title">${iconImg('flag', 22)}<span class="tc-t"><small class="eyebrow">Titre affiché</small><b>${esc(titleName() || TITLES.recrue.name)}</b></span><em>${own}/${T.length} titres ›</em></button>
    <h3 class="section-t">Succès <small>${n}/${all.length}</small></h3>
    <div class="ach-all"><span class="pbar"><i style="width:${(n / all.length * 100).toFixed(1)}%"></i></span></div>
    <div class="ach-cats">${cats.map(c => {
      const g = c.list.filter(a => a.got).length;
      return `<details class="ach-cat ${g === c.list.length ? 'full' : ''}" data-cat="${c.id}" ${openCats.has(c.id) ? 'open' : ''}>
        <summary>${iconImg(c.icon, 22)}<span class="ac-t"><b>${esc(c.name)}</b><span class="pbar ${g === c.list.length ? 'green' : ''}"><i style="width:${(g / c.list.length * 100).toFixed(1)}%"></i></span></span><em>${g}/${c.list.length}</em><i class="ac-chev" aria-hidden="true">${iconImg('next', 14)}</i></summary>
        <div class="achs">${c.list.map(achRow).join('')}</div>
      </details>`;
    }).join('')}</div>`;
}

export async function titleSheet() {
  const id = 'tt-' + Date.now();
  const body = () => {
    const cur = titleName() || TITLES.recrue.name;
    return `<div class="titles">${titleList().map(t => {
      const on = t.own && t.name === cur;
      return `<button class="ttl ${t.own ? '' : 'locked'} ${on ? 'on' : ''}" data-t="${t.id}" ${t.own ? '' : 'disabled'}>
        ${iconImg(t.own ? 'flag' : 'lock', 18)}<span><b>${esc(t.name)}</b><small>${esc(t.how)}</small></span>${on ? iconImg('check', 16) : ''}</button>`;
    }).join('')}</div><p class="q-reset">Le titre s'affiche sous le nom de votre champion</p>`;
  };
  const p = modal({ title: `${iconImg('flag', 22)} Titres`, body: `<div id="${id}">${body()}</div>`, buttons: [{ label: 'Fermer', cls: 'primary', value: true }], dismissable: true });
  const root = document.getElementById(id);
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-t]'); if (!b || b.disabled) return;
    setTitle(b.dataset.t); sfx('tap'); root.innerHTML = body();
  });
  await p;
}

// ---------- Accueil : saison terminée, quêtes de la semaine données d'office ----------
// openPass() : ouvre le pass si le joueur le demande
export async function seasonNotice(openPass) {
  const I = seasonInfo(), P = I.S.prev;
  if (save.weekly?.auto) {
    const n = save.weekly.auto; save.weekly.auto = 0; persist({ touch: false });
    toast(`${iconImg('quest', 16)} ${n} quête${s(n)} de la semaine terminée${s(n)} : récompenses reçues`, 2800);
  }
  if (!P || P.seen) return;
  P.seen = true; persist({ touch: false });
  sfx('win');
  const v = await modal({
    title: `${iconImg('flag', 22)} Saison ${P.n} terminée`,
    body: `<div class="season-end"><span class="ss-lv"><small>Palier</small><b>${P.tier}</b><small>/ ${SEASON_TIERS}</small></span>
      <p>${P.tier >= SEASON_TIERS ? 'Saison accomplie : bravo !' : `Vous avez atteint le palier ${P.tier}.`}</p>
      ${P.auto?.length ? `<p>${P.auto.length} récompense${s(P.auto.length)} pas encore réclamée${s(P.auto.length)} vous ${P.auto.length > 1 ? 'ont' : 'a'} été donnée${s(P.auto.length)} : ${gotText(P.got)}.</p>` : ''}
      <p><b>Saison ${I.n}</b> : ${SEASON_DAYS} nouveaux jours pour refaire les ${SEASON_TIERS} paliers (titres déjà gagnés remplacés par de l'or).</p></div>`,
    buttons: [{ label: 'Plus tard', cls: 'ghost', value: false }, { label: 'Voir le pass', cls: 'primary', value: true }],
    dismissable: true,
  });
  if (v && openPass) openPass();
}
