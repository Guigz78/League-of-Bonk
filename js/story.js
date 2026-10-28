// Mode histoire « La Grande Marmite » : 7 chapitres courts et rigolos. Gorgoth, le Roi des Bonks, a volé la marmite de la
// soupe du dimanche ; le champion et Pompon (le poro) remontent sa piste de monde en monde. Un chapitre = un seul niveau
// (le monde du chapitre, en Normal) qui se termine au boss ; le dernier chapitre oppose le champion à Gorgoth.
// Avant le chapitre : 2 ou 3 bulles (on touche pour passer, « Passer » saute tout) ; à l'arrivée du boss : une réplique
// en jeu (sans pause) ; au portail : 3 ou 4 bulles de fin. Le chapitre 1 sert de tutoriel (partie facile, run.js EASY).
// Progression : save.story = nombre de chapitres terminés (dans l'ordre). Première victoire d'un chapitre : or + coffre
// de butin (+ un titre à la fin).
import { CLASSES, ZONES, GIGA, PETS, LOOT_TIERS, TITLES } from './data.js';
import { save, persist } from './save.js';
import { iconImg } from './art.js';
import { heroURL, creatureURL, zoneBannerURL } from './visuals.js';
import { sfx } from './audio.js';
import { $, esc, fmt } from './ui.js';
import { earnTitle } from './season.js';

// répliques : [qui, texte] ; qui = h (le champion), p (Pompon), b (le boss du chapitre). {h} = nom du champion.
export const STORY = {
  name: 'La Grande Marmite',
  pitch: 'Gorgoth a volé la marmite de la soupe du dimanche. Récupérez-la !',
  chapters: [
    {
      zone: 0, title: 'La louche du roi',
      intro: [['p', '{h} ! Debout ! Gorgoth, le Roi des Bonks, a volé la Grande Marmite !'],
        ['h', 'Quoi ?! La marmite de la soupe du dimanche ?'],
        ['p', 'Ses gobelins traînent dans la vallée. Va leur faire bonk !']],
      taunt: 'Halte ! Je suis le Gardien Officiel de la Louche !',
      outro: [['b', 'Aïe ! Ça va, ça va… Gorgoth m\'a juste laissé la louche.'],
        ['p', 'Une louche sans marmite… c\'est tellement triste.'],
        ['b', 'Il est parti dans la jungle. Il cherchait des carottes.']],
      reward: { gold: 150, chest: 1 },
    },
    {
      zone: 1, title: 'Ça pique !',
      intro: [['p', 'La jungle ! Attention, ici même les buissons mordent.'],
        ['h', 'Des carottes ? Mais il prépare quoi, ce Gorgoth ?']],
      taunt: 'Personne ne touche à MES carottes !',
      outro: [['b', 'Pfff… De toute façon, il m\'a déjà tout pris.'],
        ['b', 'Il a filé à la rivière pour remplir la marmite d\'eau.'],
        ['h', 'Attends… il fait VRAIMENT une soupe ?!']],
      reward: { gold: 250, chest: 1 },
    },
    {
      zone: 2, title: 'La sieste du Léviathan',
      intro: [['p', 'La rivière… Ça sent bizarrement le bouillon, non ?'],
        ['h', 'Quelqu\'un fait trempette dans notre marmite.']],
      taunt: 'Chut ! Je fais la sieste… euh, JE MONTE LA GARDE !',
      outro: [['b', 'Bon, j\'avoue : j\'ai dormi dans la marmite. Elle était toute tiède.'],
        ['p', 'Beurk ! On la lavera. Deux fois.'],
        ['b', 'Gorgoth l\'a emportée en montagne, pour garder la soupe au frais.']],
      reward: { gold: 350, chest: 2 },
    },
    {
      zone: 3, title: 'Soupe glacée',
      intro: [['h', 'Brrr… Pourquoi les méchants habitent toujours là où il fait froid ?'],
        ['p', 'Pour avoir l\'air cool, je crois.']],
      taunt: 'Ici, toutes les soupes finissent en sorbet !',
      outro: [['b', 'Le sorbet à la carotte… c\'était une très mauvaise idée.'],
        ['b', 'Gorgoth cherche une épice secrète. Il est parti au marais.'],
        ['h', 'Une épice secrète ? C\'est un concours de cuisine ou quoi ?']],
      reward: { gold: 450, chest: 2 },
    },
    {
      zone: 4, title: 'La recette de mamie',
      intro: [['p', 'Le Marais Hanté… J\'ai pas peur, hein. Ce sont mes poils qui tremblent.'],
        ['h', 'Reste derrière moi, Pompon.']],
      taunt: 'Je collectionne les âmes… et les recettes de grand-mère !',
      outro: [['b', 'D\'accord ! Je lui ai vendu la recette secrète de mamie Bonk.'],
        ['b', 'L\'ingrédient secret ? Une pincée de Néant. Il est allé en chercher.'],
        ['p', 'Ça n\'a pas l\'air très bon pour la santé.']],
      reward: { gold: 600, chest: 2 },
    },
    {
      zone: 5, title: 'Le ver trop gourmand',
      intro: [['p', 'Le Néant… Il n\'y a rien ici. Même pas un banc pour s\'asseoir.'],
        ['h', 'Gorgoth n\'est plus très loin. Je sens l\'odeur de la soupe.']],
      taunt: 'JE DÉVORE LES MONDES ! …Mais pas les légumes. Beurk.',
      outro: [['b', 'Burp. Pardon. J\'ai avalé une planète ce matin, je suis un peu lourd.'],
        ['b', 'Gorgoth est juste derrière. Sa soupe est presque prête.'],
        ['h', 'Pompon, sors les bols. On va récupérer cette marmite.']],
      reward: { gold: 800, chest: 3 },
    },
    {
      zone: 5, giga: true, title: 'Le Roi des Bonks',
      intro: [['b', 'QUI OSE DÉRANGER MA SOUPE ?! Je suis GORGOTH, ROI DES BONKS !'],
        ['h', 'Rends la Grande Marmite, Gorgoth !'],
        ['b', 'JAMAIS ! Viens la chercher, si tu l\'oses !']],
      taunt: 'Ma soupe ne refroidira pas pour toi !',
      outro: [['b', 'Snif… Personne ne m\'invite jamais au repas du dimanche…'],
        ['h', 'C\'est tout ? Il suffisait de demander !'],
        ['p', 'Tu peux venir. Mais c\'est toi qui fais la vaisselle.'],
        ['b', '…Je peux avoir deux bols ?']],
      end: 'Tout le monde a eu sa soupe. Même Gorgoth.',
      reward: { gold: 1500, chest: 3, title: 'soupe' },
    },
  ],
};
const CH = STORY.chapters;
export const storyLen = CH.length;
export const storyDone = () => Math.max(0, Math.min(CH.length, save.story | 0));
// prochain chapitre à jouer (le dernier une fois l'histoire finie : on peut tout rejouer)
export const storyNext = () => Math.min(storyDone(), CH.length - 1);
export const chapter = n => CH[n];

// ---------- Portraits ----------
const bossDef = c => (c.giga ? GIGA : ZONES[c.zone].boss);
function who(k, c) {
  const cls = CLASSES[save.cls] || Object.values(CLASSES)[0];
  if (k === 'h') return { name: cls.name, color: '#ffd54a', img: heroURL(cls.id, cls.colors, 0), side: 'l', voice: 'talk' };
  if (k === 'p') { const P = PETS.poro; return { name: P.name, color: '#7fe3ff', img: creatureURL('pet-poro', P.body, P.pal), side: 'l', pet: true, voice: 'talkHi' }; }
  const B = bossDef(c), z = ZONES[c.zone];
  const img = c.giga ? creatureURL(`9-9-${B.name}`, B.body, B.pal, { boss: true }) : creatureURL(`${z.id}-${z.monsters.length}-${B.name}`, B.body, B.pal, { boss: true });
  return { name: B.name, color: c.giga ? '#ff9a3a' : '#ff6a5a', img, side: 'r', voice: 'talkLow' };
}
// typographie française : espace insécable avant ! ? : ; et nom du champion
const say = (t, c) => esc(t.replace('{h}', (CLASSES[save.cls] || {}).name || 'Héros')).replace(/ ([!?:;»])/g, ' $1').replace(/([«]) /g, '$1 ');
export const bossImgOf = n => who('b', CH[n]).img;

// ---------- Scène de dialogue ----------
// part = 'intro' | 'outro' ; inRun : par-dessus la partie (fond sombre transparent) au lieu du décor du monde
export function cutscene(n, part = 'intro', { inRun = false } = {}) {
  const c = CH[n], lines = c[part] || [];
  if (!lines.length) return Promise.resolve();
  return new Promise(resolve => {
    const cast = { h: who('h', c), p: who('p', c), b: lines.some(l => l[0] === 'b') || part === 'outro' ? who('b', c) : null };
    const w = document.createElement('div');
    w.className = `story-sc ${inRun ? 'in-run' : ''} ${c.giga ? 'giga' : ''}`;
    w.innerHTML = `<div class="ss-bg" style="background-image:url(${zoneBannerURL(ZONES[c.zone])})"></div>
      <div class="ss-top"><span class="ss-ch"><small>Chapitre ${n + 1}/${CH.length}${part === 'outro' ? ' · fin' : ''}</small><b>${esc(c.title)}</b></span>
        <button class="ss-skip" type="button">Passer ${iconImg('next', 14)}</button></div>
      <div class="ss-cast">
        <img class="ss-p ss-h" src="${cast.h.img}" alt="">
        <img class="ss-p ss-pet" src="${cast.p.img}" alt="">
        ${cast.b ? `<img class="ss-p ss-b" src="${cast.b.img}" alt="">` : ''}
      </div>
      <div class="ss-bubble"><span class="ss-name"></span><p class="ss-txt"></p><i class="ss-more"></i></div>
      <div class="ss-end"><b>Fin !</b><span>${c.end ? say(c.end) : ''}</span><small>Touchez pour continuer</small></div>`;
    (inRun ? $('.run') || document.body : document.body).appendChild(w);
    const bub = w.querySelector('.ss-bubble'), nameEl = w.querySelector('.ss-name'), txt = w.querySelector('.ss-txt');
    const imgs = { h: w.querySelector('.ss-h'), p: w.querySelector('.ss-pet'), b: w.querySelector('.ss-b') };
    let i = -1, full = '', shown = 0, typing = 0, done = false, ending = false;
    const run = inRun ? $('.run') : null;
    run?.classList.add('story-on');
    const close = () => {
      if (done) return;
      done = true; cancelAnimationFrame(typing);
      run?.classList.remove('story-on');
      w.classList.add('out');
      setTimeout(() => { w.remove(); resolve(); }, 260);
    };
    const type = () => { // machine à écrire rapide (~60 lettres/s)
      const t0 = performance.now();
      const step = now => {
        shown = Math.min(full.length, Math.floor((now - t0) / 16.5));
        txt.innerHTML = full.slice(0, shown) + `<span class="ss-ghost">${full.slice(shown)}</span>`;
        if (shown < full.length) typing = requestAnimationFrame(step); else { typing = 0; bub.classList.add('ready'); }
      };
      typing = requestAnimationFrame(step);
    };
    const next = () => {
      if (typing) { cancelAnimationFrame(typing); typing = 0; shown = full.length; txt.textContent = ''; txt.innerHTML = full; bub.classList.add('ready'); return; }
      if (ending) return close();
      i++;
      if (i >= lines.length) {
        if (c.end && part === 'outro') { ending = true; w.classList.add('ending'); sfx('win'); return; }
        return close();
      }
      const [k, t] = lines[i], s = cast[k] || cast.h;
      full = say(t, c);
      nameEl.textContent = s.name; nameEl.style.setProperty('--nc', s.color);
      bub.className = `ss-bubble from-${k} side-${s.side}`;
      for (const [kk, el] of Object.entries(imgs)) if (el) { el.classList.toggle('on', kk === k); el.classList.toggle('off', kk !== k); }
      const el = imgs[k]; if (el) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
      txt.innerHTML = `<span class="ss-ghost">${full}</span>`; // place réservée tout de suite (la bulle ne saute pas)
      bub.classList.remove('ready');
      sfx(s.voice);
      type();
    };
    w.addEventListener('click', e => {
      if (e.target.closest('.ss-skip')) { sfx('tap'); close(); return; }
      next();
    });
    requestAnimationFrame(() => { w.classList.add('in'); setTimeout(next, inRun ? 150 : 350); });
  });
}

// réplique du boss à son arrivée (en jeu, sans pause) : portrait + bulle, quelques secondes
export function taunt(n) {
  const c = CH[n]; if (!c?.taunt) return;
  const s = who('b', c), hud = $('.run .hud'); if (!hud) return;
  const el = document.createElement('div');
  el.className = `taunt ${c.giga ? 'giga' : ''}`;
  el.innerHTML = `<img src="${s.img}" alt=""><span><b style="--nc:${s.color}">${esc(s.name)}</b>${say(c.taunt)}</span>`;
  hud.appendChild(el);
  const run = $('.run'); run?.classList.add('taunting'); // le guide de la première partie s'efface le temps de la réplique
  sfx(s.voice);
  requestAnimationFrame(() => el.classList.add('in'));
  setTimeout(() => el.classList.add('out'), 3600);
  setTimeout(() => { el.remove(); run?.classList.remove('taunting'); }, 4100);
}

// ---------- Fin d'un chapitre (bilan) ----------
// ok = boss du chapitre vaincu. Première victoire : chapitre suivant ouvert, or et coffre (ajouté aux coffres à ouvrir
// tout de suite après), titre au dernier chapitre.
export function storyEnd(n, ok) {
  const c = CH[n], first = ok && storyDone() === n, R = c.reward;
  const out = { n, ok, first, title: c.title, gold: 0, chest: null, earned: null, last: n === CH.length - 1, next: ok && n + 1 < CH.length ? n + 1 : null };
  if (!first) return out;
  save.story = n + 1;
  out.gold = R.gold; save.gold += R.gold;
  if (R.chest != null) { save.pendingChests.push({ tier: R.chest, zone: c.zone }); out.chest = R.chest; }
  if (R.title && TITLES[R.title]) { earnTitle(R.title); out.earned = R.title; }
  persist();
  return out;
}

// bloc du bilan : chapitre réussi (récompenses de première victoire) ou raté
export function storyBlock(S) {
  if (!S) return '';
  const rw = S.first ? `<span class="sr-rw"><em>${iconImg('gold', 14)} +${fmt(S.gold)}</em>${S.chest != null ? `<em>${iconImg('chest', 14)} ${esc(LOOT_TIERS[S.chest].name)}</em>` : ''}${S.earned ? `<em>${iconImg('flag', 14)} Titre « ${esc(TITLES[S.earned].name)} »</em>` : ''}</span>` : '';
  return `<div class="story-res ${S.ok ? 'ok' : 'ko'}"><span class="sr-img"><img class="px spr" src="${bossImgOf(S.n)}" alt=""></span>
    <span class="sr-t"><small>${iconImg('book', 13)} Histoire · chapitre ${S.n + 1}/${CH.length}</small><b>${esc(S.title)}</b>
    <span>${S.ok ? (S.last ? 'Histoire terminée : la soupe est sauvée !' : 'Chapitre terminé !') : 'Raté… mais Pompon croit en vous. Réessayez !'}</span>${rw}</span></div>`;
}

// ---------- Accueil et écran des chapitres ----------
export function storyTile() {
  const d = storyDone(), n = storyNext(), c = CH[n], all = d >= CH.length;
  return `<button class="story-tile ${all ? 'all' : ''}" data-act="story">
    <span class="st-ic">${iconImg('book', 22)}</span>
    <span class="st-t"><small>Histoire · ${all ? 'terminée' : `chapitre ${n + 1}/${CH.length}`}</small><b>${all ? esc(STORY.name) : esc(c.title)}</b>
      <span class="st-dots">${CH.map((_, i) => `<i class="${i < d ? 'on' : i === d ? 'cur' : ''}"></i>`).join('')}</span></span>
    <img class="px spr st-boss" src="${bossImgOf(n)}" alt="">
  </button>`;
}

export function storyScreenHTML() {
  const d = storyDone();
  const cards = CH.map((c, i) => {
    const st = i < d ? 'done' : i === d ? 'next' : 'locked', z = ZONES[c.zone], R = c.reward;
    return `<button class="ch-card ${st} ${c.giga ? 'giga' : ''}" data-act="chapter" data-n="${i}" ${st === 'locked' ? 'disabled' : ''} style="background-image:url(${zoneBannerURL(z)})">
      <span class="ch-n">${i + 1}</span>
      <span class="ch-t"><small>${c.giga ? 'Final' : esc(z.name)}</small><b>${esc(c.title)}</b>
        ${st === 'done' ? `<em class="ch-ok">${iconImg('check', 12)} Terminé · rejouer</em>` : st === 'locked' ? `<em>${iconImg('lock', 12)} Terminez le chapitre ${i}</em>`
    : `<em class="ch-rw">${iconImg('gold', 12)} ${fmt(R.gold)} · ${esc(LOOT_TIERS[R.chest].name)}${R.title ? ' · titre' : ''}</em>`}</span>
      <span class="ch-boss">${st === 'locked' ? iconImg('lock', 22) : `<img class="px spr" src="${bossImgOf(i)}" alt="">`}</span>
    </button>`;
  }).join('');
  return `<div class="story-screen">
    <div class="cs-bar"><button class="icon-btn" data-act="back" aria-label="Retour">${iconImg('back', 20)}</button><h2 class="cs-title">Histoire</h2></div>
    <div class="sts-head"><span class="sts-pot">${iconImg('book', 30)}</span><span><b>${esc(STORY.name)}</b><small>${esc(STORY.pitch)}</small></span></div>
    <div class="sts-prog"><span class="pbar"><i style="width:${(d / CH.length * 100).toFixed(1)}%"></i></span><b>${d}/${CH.length}</b></div>
    <div class="ch-list">${cards}</div>
  </div>`;
}
