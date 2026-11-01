// Mode histoire « La Grande Marmite » : 12 chapitres. Gorgoth, le Roi des Bonks, a volé la marmite de la soupe du
// dimanche ; le champion et Pompon (le poro) remontent sa piste de monde en monde. Chaque monde a un chapitre « mission »
// (ramasser des objets, tenir face à la horde, battre des gardes d'élite : js/story-mission.js) puis un chapitre de boss ;
// le dernier oppose le champion à Gorgoth, suivi d'un banquet final. Un chapitre = un seul niveau, en Normal.
// Mise en scène : carte de titre du chapitre, bulles avec émotions (colère, joie, tristesse, surprise, réflexion),
// narration en encadré, Gorgoth en hologramme quand il n'est pas là ; en jeu : réplique du boss et commentaires de Pompon.
// Progression : save.storyCh = { id: étoiles (bits : 1 terminé, 2 sans résurrection, 4 rapide ou PV) } ; les chapitres
// s'ouvrent dans l'ordre. Première victoire : or + coffre ; paliers d'étoiles (12, 24, 36) : coffres et titre.
import { CLASSES, ZONES, GIGA, PETS, LOOT_TIERS, TITLES } from './data.js';
import { save, persist } from './save.js';
import { iconImg } from './art.js';
import { heroURL, creatureURL, zoneBannerURL } from './visuals.js';
import { sfx } from './audio.js';
import { $, esc, fmt, modal } from './ui.js';
import { earnTitle } from './season.js';

// répliques : [qui, texte, émotion] ; qui = h (champion), p (Pompon), b (boss du chapitre), m (chef des gardes du monde),
// g (Gorgoth en hologramme), n (narration). Émotions : angry, happy, sad, surprise, think. {h} = nom du champion.
// mission : collect (n objets icon), survive (t secondes), elites (n gardes) ; fast = 3e étoile (secondes) ;
// sans fast (survive) : 3e étoile = finir avec plus de la moitié des PV.
export const STORY = {
  name: 'La Grande Marmite',
  pitch: 'Gorgoth a volé la marmite de la soupe du dimanche. Récupérez-la, monde après monde !',
  chapters: [
    { id: 'c1', zone: 0, title: 'La louche du roi', fast: 210,
      intro: [['n', 'Dimanche matin. Ça sent bon la soupe dans toute la vallée… enfin, ça sentait.'],
        ['p', '{h} ! Debout ! Gorgoth, le Roi des Bonks, a volé la Grande Marmite !', 'surprise'],
        ['h', 'Quoi ?! La marmite de la soupe du dimanche ?', 'angry'],
        ['p', 'Ses gobelins traînent dans la vallée. Va leur faire bonk !', 'happy']],
      taunt: 'Halte ! Je suis le Gardien Officiel de la Louche !',
      outro: [['b', 'Aïe ! Ça va, ça va… Gorgoth m\'a juste laissé la louche.', 'sad'],
        ['p', 'Une louche sans marmite… c\'est tellement triste.', 'sad'],
        ['b', 'Il est parti dans la jungle. Il cherchait des carottes.'],
        ['h', 'Des carottes ? Pompon, on y va.', 'happy']],
      reward: { gold: 150, chest: 1 } },
    { id: 'c2', zone: 1, title: 'La chasse aux carottes', fast: 210,
      mission: { type: 'collect', n: 7, icon: '🥕', name: 'Carottes', what: 'Ramassez 7 carottes' },
      intro: [['n', 'La Jungle Grondante. Il fait chaud, ça pique, et ça grogne.'],
        ['p', 'Regarde ! Des carottes partout ! Gorgoth les a semées en courant.', 'surprise'],
        ['h', 'S\'il les veut, c\'est qu\'elles comptent pour sa soupe.', 'think'],
        ['p', 'Ramassons-les avant lui ! Sept carottes, pas une de moins !', 'happy'],
        ['h', 'Attention, ses gobelins les surveillent. Ça va secouer.', 'think']],
      outro: [['p', 'Sept carottes ! Gorgoth va être furieux.', 'happy'],
        ['g', 'QUI A PRIS MES CAROTTES ?! Ronce-Brûlante, ATTRAPE-LES !', 'angry'],
        ['h', 'Oups. On a été repérés.', 'surprise']],
      reward: { gold: 200, chest: 1 } },
    { id: 'c3', zone: 1, title: 'Ça pique !', fast: 270,
      intro: [['b', 'Ici c\'est MA jungle. Et ce sont MES carottes, maintenant.', 'angry'],
        ['p', 'Techniquement, c\'étaient celles de Gorgoth…', 'think'],
        ['h', 'Et avant ça, celles du potager de mamie !', 'angry']],
      taunt: 'Personne ne touche à MES carottes !',
      outro: [['b', 'Pfff… Garde-les, tes carottes. Gorgoth en a plein sa marmite.', 'sad'],
        ['b', 'Il est parti à la rivière pour la remplir d\'eau.'],
        ['h', 'Attends… il fait VRAIMENT une soupe ?!', 'surprise']],
      reward: { gold: 250, chest: 1 } },
    { id: 'c4', zone: 2, title: 'Les crabes en colère',
      mission: { type: 'survive', t: 100, icon: '🦀', name: 'Tenez bon', what: 'Tenez 100 secondes face aux crabes' },
      intro: [['n', 'La Rivière Scintillante. L\'eau est claire. Les crabes, beaucoup moins.'],
        ['p', 'Le Léviathan a envoyé toute son armée de crabes !', 'surprise'],
        ['h', 'On tient bon jusqu\'à ce qu\'ils se fatiguent.', 'angry'],
        ['p', 'Les crabes, ça se fatigue ? Bon… on va voir.', 'think']],
      outro: [['p', 'Ils repartent ! C\'était l\'heure de leur goûter, je crois.', 'happy'],
        ['g', 'Léviathan ! Garde ma marmite, je reviens dans cinq minutes !', 'angry'],
        ['h', 'Il est là-bas, au bord de l\'eau !', 'surprise']],
      reward: { gold: 300, chest: 2 } },
    { id: 'c5', zone: 2, title: 'La sieste du Léviathan', fast: 270,
      intro: [['p', 'Ça sent… le bouillon. Et un peu le poisson.', 'think'],
        ['h', 'Quelqu\'un fait trempette dans notre marmite.', 'angry']],
      taunt: 'Chut ! Je fais la sieste… euh, JE MONTE LA GARDE !',
      outro: [['b', 'Bon, j\'avoue : j\'ai dormi dans la marmite. Elle était toute tiède.', 'sad'],
        ['p', 'Beurk ! On la lavera. Deux fois.', 'angry'],
        ['b', 'Gorgoth l\'a emportée en montagne, pour garder la soupe au frais.']],
      reward: { gold: 350, chest: 2 } },
    { id: 'c6', zone: 3, title: 'La douane du col', fast: 240,
      mission: { type: 'elites', n: 4, icon: '🎯', name: 'Gardes', what: 'Battez les 4 gardes du col' },
      intro: [['n', 'Les Pics Gelés. Moins quarante degrés. Pompon a mis son écharpe.'],
        ['m', 'Halte ! Douane des Pics Gelés. Les marmites sont interdites !', 'angry'],
        ['h', 'On n\'a même pas de marmite, c\'est justement le problème !', 'angry'],
        ['p', 'Quatre gros gardes bloquent le col. Il faut les battre.', 'think']],
      outro: [['m', 'Bon… Passage autorisé. Mais essuyez vos pieds.', 'sad'],
        ['p', 'Je n\'ai pas de pieds. J\'ai des poils.', 'think'],
        ['h', 'On avance. Gorgoth n\'est plus très loin.', 'happy']],
      reward: { gold: 400, chest: 2 } },
    { id: 'c7', zone: 3, title: 'Soupe glacée', fast: 270,
      intro: [['h', 'Brrr… Pourquoi les méchants habitent toujours là où il fait froid ?', 'sad'],
        ['p', 'Pour avoir l\'air cool, je crois.', 'happy']],
      taunt: 'Ici, toutes les soupes finissent en sorbet !',
      outro: [['b', 'Le sorbet à la carotte… c\'était une très mauvaise idée.', 'sad'],
        ['b', 'Gorgoth cherche une épice secrète. Il est parti au marais.'],
        ['h', 'Une épice secrète ? C\'est un concours de cuisine ou quoi ?', 'surprise']],
      reward: { gold: 450, chest: 2 } },
    { id: 'c8', zone: 4, title: 'La recette perdue', fast: 240,
      mission: { type: 'collect', n: 7, icon: '📜', name: 'Pages', what: 'Retrouvez 7 pages de la recette' },
      intro: [['n', 'Le Marais Hanté. Même la brume a peur de la brume.'],
        ['p', 'Regarde ! Des pages déchirées… « Recette de mamie Bonk » !', 'surprise'],
        ['h', 'Gorgoth a dû les perdre en fuyant. Ramassons-les toutes !', 'happy']],
      outro: [['p', '« Ingrédient secret : une pincée de… » La dernière page manque !', 'surprise'],
        ['g', 'HA HA ! La dernière page, c\'est le Geôlier qui l\'a ! Bon courage !', 'happy'],
        ['h', 'Il est vraiment très mauvais pour garder des secrets.', 'think']],
      reward: { gold: 500, chest: 2 } },
    { id: 'c9', zone: 4, title: 'La recette de mamie', fast: 270,
      intro: [['p', 'J\'ai pas peur, hein. Ce sont mes poils qui tremblent tout seuls.', 'sad'],
        ['h', 'Reste derrière moi, Pompon.', 'think']],
      taunt: 'Je collectionne les âmes… et les recettes de grand-mère !',
      outro: [['b', 'D\'accord ! Voilà la dernière page. Mamie Bonk me faisait peur.', 'sad'],
        ['p', '« Ingrédient secret : une pincée de Néant. » Pardon ?', 'surprise'],
        ['h', 'Gorgoth est parti en chercher. Direction le Néant.', 'angry']],
      reward: { gold: 600, chest: 2 } },
    { id: 'c10', zone: 5, title: 'Les gardes du Néant', fast: 270,
      mission: { type: 'elites', n: 4, icon: '🎯', name: 'Gardes', what: 'Battez les 4 gardes de Gorgoth' },
      intro: [['n', 'Le Néant. Il n\'y a rien. Vraiment rien. Même pas un banc.'],
        ['g', 'Mes gardes d\'élite vont vous réduire en purée !', 'angry'],
        ['p', 'En purée ? Il ne pense vraiment qu\'à manger.', 'think'],
        ['h', 'Quatre gardes ? On en a vu d\'autres.', 'happy']],
      outro: [['g', 'Mes gardes ! Bon… Ver-Roi, à toi de jouer !', 'angry'],
        ['p', 'Le Ver-Roi ? Celui qui mange des mondes entiers ?!', 'surprise']],
      reward: { gold: 700, chest: 3 } },
    { id: 'c11', zone: 5, title: 'Le ver trop gourmand', fast: 300,
      intro: [['p', 'Il est ÉNORME. Et il a l\'air d\'avoir faim.', 'surprise'],
        ['h', 'Gorgoth n\'est plus très loin. Je sens l\'odeur de la soupe.', 'think']],
      taunt: 'JE DÉVORE LES MONDES ! …Mais pas les légumes. Beurk.',
      outro: [['b', 'Burp. Pardon. J\'ai avalé une planète ce matin, je suis un peu lourd.', 'sad'],
        ['b', 'Gorgoth est juste derrière. Sa soupe est presque prête.'],
        ['h', 'Pompon, sors les bols. On va récupérer cette marmite.', 'angry']],
      reward: { gold: 800, chest: 3 } },
    { id: 'c12', zone: 5, giga: true, title: 'Le Roi des Bonks', fast: 330,
      intro: [['n', 'Au cœur du Néant, une énorme marmite fume doucement.'],
        ['b', 'QUI OSE DÉRANGER MA SOUPE ?! Je suis GORGOTH, ROI DES BONKS !', 'angry'],
        ['h', 'Rends la Grande Marmite, Gorgoth !', 'angry'],
        ['b', 'JAMAIS ! Viens la chercher, si tu l\'oses !', 'angry']],
      taunt: 'Ma soupe ne refroidira pas pour toi !',
      outro: [['b', 'Snif… Personne ne m\'invite jamais au repas du dimanche…', 'sad'],
        ['h', 'C\'est tout ? Il suffisait de demander !', 'surprise'],
        ['p', 'Tu peux venir. Mais c\'est toi qui fais la vaisselle.', 'happy'],
        ['b', '…Je peux avoir deux bols ?', 'happy']],
      epilogue: [['n', 'Le dimanche suivant, toute la vallée est venue manger la soupe.'],
        ['n', 'Le Roi Gobelin a servi avec sa louche. Le Cryophénix a refroidi les bols.'],
        ['n', 'Le Ver-Roi en a repris trois fois. Gorgoth a fait la vaisselle. En chantant.'],
        ['p', 'Meilleure soupe de toute ma vie. Et j\'ai seulement six mois.', 'happy']],
      end: 'Tout le monde a eu sa soupe. Même Gorgoth.',
      reward: { gold: 1500, chest: 3, title: 'soupe' } },
  ],
  // paliers d'étoiles (36 au total) : récompenses données une fois
  stars: [{ n: 12, gold: 500, chest: 2 }, { n: 24, gold: 1000, chest: 3 }, { n: 36, chest: 3, title: 'chef', shards: 5 }], // shards : éclats mythiques
};
const CH = STORY.chapters;
export const storyLen = CH.length;
export const chapter = n => CH[n];
// anciennes sauvegardes (7 chapitres comptés) : chapitres déjà faits retrouvés dans la nouvelle histoire
const OLD7 = ['c1', 'c3', 'c5', 'c7', 'c9', 'c11', 'c12'];
function book() {
  if (!save.storyCh || typeof save.storyCh !== 'object') {
    save.storyCh = {};
    for (let i = 0; i < Math.min(OLD7.length, save.story | 0); i++) save.storyCh[OLD7[i]] = 1;
  }
  return save.storyCh;
}
const bits = i => book()[CH[i].id] | 0;
const nstars = b => (b & 1) + ((b >> 1) & 1) + ((b >> 2) & 1);
export const isDone = i => !!(bits(i) & 1);
export const starsOf = i => nstars(bits(i));
export const totalStars = () => CH.reduce((n, _, i) => n + starsOf(i), 0);
export const storyDone = () => CH.filter((_, i) => isDone(i)).length;
// prochain chapitre à jouer : le premier pas encore terminé (le dernier une fois tout fini)
export const storyNext = () => { const i = CH.findIndex((_, k) => !isDone(k)); return i < 0 ? CH.length - 1 : i; };
export const unlocked = i => isDone(i) || i <= storyNext();
// 3e étoile : rapide (fast secondes) ou, pour « tenez bon », finir avec plus de la moitié des PV
const star3 = c => (c.fast ? `Terminer en moins de ${Math.floor(c.fast / 60)}:${String(c.fast % 60).padStart(2, '0')}` : 'Finir avec plus de la moitié des PV');
const goalTxt = c => (c.mission ? `${c.mission.icon} ${c.mission.what}` : c.giga ? `👑 Battez ${GIGA.name}, le Roi des Bonks` : `👹 Battez ${ZONES[c.zone].boss.name}`);

// ---------- Personnages ----------
const bossDef = c => (c.giga ? GIGA : ZONES[c.zone].boss);
function who(k, c) {
  const cls = CLASSES[save.cls] || Object.values(CLASSES)[0];
  if (k === 'h') return { name: cls.name, color: '#ffd54a', img: heroURL(cls.id, cls.colors, 0), side: 'l', voice: 'talk' };
  if (k === 'p') { const P = PETS.poro; return { name: P.name, color: '#7fe3ff', img: creatureURL('pet-poro', P.body, P.pal), side: 'l', voice: 'talkHi' }; }
  if (k === 'n') return { name: '', side: 'n', voice: 'tap' };
  if (k === 'g' || (k === 'b' && c.giga)) return { name: GIGA.name, color: '#ff9a3a', img: creatureURL(`9-9-${GIGA.name}`, GIGA.body, GIGA.pal, { boss: true }), side: 'r', voice: 'talkLow', holo: k === 'g' };
  const z = ZONES[c.zone];
  if (k === 'm') { const M = z.monsters[4]; return { name: M.name, color: '#c08aff', img: creatureURL(`${z.id}-4-${M.name}`, M.body, M.pal), side: 'r', voice: 'talkLow' }; }
  const B = bossDef(c);
  return { name: B.name, color: '#ff6a5a', img: creatureURL(`${z.id}-${z.monsters.length}-${B.name}`, B.body, B.pal, { boss: true }), side: 'r', voice: 'talkLow' };
}
// typographie française : espace insécable avant ! ? : ; et nom du champion
const say = t => esc(t.replace('{h}', (CLASSES[save.cls] || {}).name || 'Héros')).replace(/ ([!?:;»])/g, ' $1').replace(/([«]) /g, '$1 ');
// portrait du chapitre (boss, gardes ou Gorgoth)
export const bossImgOf = n => { const c = CH[n]; return who(c.mission?.type === 'elites' ? 'm' : 'b', c).img; };
const MOOD = { angry: '💢', happy: '✨', sad: '💧', surprise: '❗', think: '💭' };

// ---------- Scène de dialogue ----------
// part = 'intro' | 'outro' ; intro : carte de titre du chapitre d'abord ; outro du chapitre final : banquet puis « Fin ».
// inRun : par-dessus la partie (fond sombre transparent) au lieu du décor du monde.
export function cutscene(n, part = 'intro', { inRun = false } = {}) {
  const c = CH[n], lines = [...(c[part] || [])], epi = part === 'outro' && c.epilogue ? c.epilogue : null;
  if (!lines.length) return Promise.resolve();
  return new Promise(resolve => {
    const right = lines.find(l => 'bmg'.includes(l[0]))?.[0];
    const cast = { h: who('h', c), p: who('p', c), n: who('n', c), b: who('b', c), m: who('m', c), g: who('g', c) };
    const w = document.createElement('div');
    w.className = `story-sc ${inRun ? 'in-run' : ''} ${c.giga ? 'giga' : ''} ${part === 'intro' ? 'with-card' : ''}`;
    const banquet = epi ? ['h', 'p', ...ZONES.map(z => z.boss).filter(Boolean)].map((x, i) => {
      const img = typeof x === 'string' ? cast[x].img : creatureURL(`${ZONES.findIndex(z => z.boss === x)}-5-${x.name}`, x.body, x.pal, { boss: true });
      return `<img class="sb-p" style="--i:${i}" src="${img}" alt="">`;
    }).join('') + `<img class="sb-p sb-g" style="--i:9" src="${cast.g.img}" alt="">` : '';
    w.innerHTML = `<div class="ss-bg" style="background-image:url(${zoneBannerURL(ZONES[c.zone])})"></div>
      <div class="ss-top"><span class="ss-ch"><small>Chapitre ${n + 1}/${CH.length}${part === 'outro' ? ' · fin' : ''}</small><b>${esc(c.title)}</b></span>
        <button class="ss-skip" type="button">Passer ${iconImg('next', 14)}</button></div>
      <div class="ss-cast">
        <span class="ss-p ss-h"><img src="${cast.h.img}" alt=""><i class="ss-emo"></i></span>
        <span class="ss-p ss-pet"><img src="${cast.p.img}" alt=""><i class="ss-emo"></i></span>
        <span class="ss-p ss-b ${right === 'g' ? 'holo' : ''}" ${right ? '' : 'hidden'}><img src="${right ? cast[right].img : ''}" alt=""><i class="ss-emo"></i></span>
      </div>
      ${epi ? `<div class="ss-banquet"><span class="sb-pot">🍲</span>${banquet}</div>` : ''}
      <div class="ss-bubble"><span class="ss-name"></span><p class="ss-txt"></p><i class="ss-more"></i></div>
      ${part === 'intro' ? `<div class="ss-card"><small>Chapitre ${n + 1}</small><b>${esc(c.title)}</b><span class="sc-world">${esc(ZONES[c.zone].name)}</span><em>${esc(goalTxt(c))}</em>${starsHTML(starsOf(n))}</div>` : ''}
      <div class="ss-end"><b>Fin !</b><span>${c.end ? say(c.end) : ''}</span><small>Merci d'avoir joué · touchez pour continuer</small></div>`;
    (inRun ? $('.run') || document.body : document.body).appendChild(w);
    const bub = w.querySelector('.ss-bubble'), nameEl = w.querySelector('.ss-name'), txt = w.querySelector('.ss-txt');
    const slot = { h: w.querySelector('.ss-h'), p: w.querySelector('.ss-pet'), r: w.querySelector('.ss-b') };
    let seq = lines, i = -1, full = '', shown = 0, typing = 0, done = false, ending = false, card = part === 'intro', rk = right;
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
      if (card) { card = false; w.classList.add('card-off'); sfx('tap'); return void setTimeout(next, 260); }
      if (typing) { cancelAnimationFrame(typing); typing = 0; shown = full.length; txt.innerHTML = full; bub.classList.add('ready'); return; }
      if (ending) return close();
      i++;
      if (i >= seq.length) {
        if (epi && seq !== epi) { seq = epi; i = 0; w.classList.add('banquet'); sfx('win'); } // banquet final
        else if (c.end && part === 'outro') { ending = true; w.classList.add('ending'); sfx('win'); return; }
        else return close();
      }
      const [k, t, mood] = seq[i], s = cast[k] || cast.h;
      // le personnage de droite change (boss, gardes, Gorgoth en hologramme) : il entre en glissant
      if ('bmg'.includes(k) && k !== rk) {
        rk = k; const r = slot.r; r.hidden = false; r.querySelector('img').src = s.img;
        r.classList.toggle('holo', !!s.holo); r.classList.remove('swap'); void r.offsetWidth; r.classList.add('swap');
      }
      full = say(t);
      nameEl.textContent = s.name; nameEl.style.setProperty('--nc', s.color || '#fff');
      bub.className = `ss-bubble from-${k} side-${s.side}`;
      const sk = k === 'h' ? 'h' : k === 'p' ? 'p' : 'bmg'.includes(k) ? 'r' : '';
      for (const [kk, el] of Object.entries(slot)) {
        el.classList.toggle('on', kk === sk); el.classList.toggle('off', kk !== sk);
        el.classList.remove('pop', 'm-angry', 'm-happy', 'm-sad', 'm-surprise', 'm-think');
      }
      const el = slot[sk];
      if (el) {
        void el.offsetWidth; el.classList.add('pop'); if (mood) el.classList.add('m-' + mood);
        el.querySelector('.ss-emo').textContent = MOOD[mood] || '';
      }
      txt.innerHTML = `<span class="ss-ghost">${full}</span>`; // place réservée tout de suite (la bulle ne saute pas)
      bub.classList.remove('ready');
      sfx(mood === 'angry' && k !== 'h' ? 'talkLow' : s.voice);
      type();
    };
    w.addEventListener('click', e => {
      if (e.target.closest('.ss-skip')) { sfx('tap'); if (epi && !ending) { ending = true; w.classList.add('ending'); return; } close(); return; }
      next();
    });
    requestAnimationFrame(() => {
      w.classList.add('in');
      if (card) { sfx('shrine'); setTimeout(() => { if (card) next(); }, 2200); } else setTimeout(next, inRun ? 150 : 350);
    });
  });
}

// réplique du boss à son arrivée (en jeu, sans pause) : portrait + bulle, 5 s
export function taunt(n) {
  const c = CH[n]; if (!c?.taunt) return;
  bubbleInRun(who('b', c), c.taunt, c.giga ? 'giga' : '');
}
// bulle en jeu (réplique ou commentaire de Pompon) : une à la fois, 5 s
let bubbleT = 0;
function bubbleInRun(s, text, cls = '', tries = 0) {
  const hud = $('.run .hud'); if (!hud || $('.run.story-on')) return;
  hud.querySelector('.taunt')?.remove(); // l'ancienne bulle s'efface tout de suite
  // une grande bannière est affichée (boss invoqué, mission accomplie) : la bulle attend qu'elle parte (4 s au plus)
  if ($('#banner.show') && tries < 16) return void setTimeout(() => bubbleInRun(s, text, cls, tries + 1), 250);
  const el = document.createElement('div');
  el.className = `taunt ${cls} ${s.side === 'l' ? 'left' : ''}`;
  el.innerHTML = `<img src="${s.img}" alt=""><span><b style="--nc:${s.color}">${esc(s.name)}</b>${say(text)}</span>`;
  hud.appendChild(el);
  const run = $('.run'); run?.classList.add('taunting'); // le guide de la première partie s'efface le temps de la bulle
  sfx(s.voice);
  requestAnimationFrame(() => el.classList.add('in'));
  clearTimeout(bubbleT);
  bubbleT = setTimeout(() => { el.classList.add('out'); setTimeout(() => { el.remove(); run?.classList.remove('taunting'); }, 500); }, 5000);
}

// commentaires de Pompon pendant le chapitre (événements de run.onStory) ; au plus un toutes les 9 s (sauf mission)
let lastChat = 0;
const said = new Set();
export function chatter(n, ev, d = {}) {
  const c = CH[n], m = c?.mission, now = performance.now();
  if (!c || ($('.run .coach') && ev !== 'done')) return; // pas pendant le guide de la première partie
  if (ev === 'start') said.clear();
  const key = ev + (ev === 'lowhp' ? Math.floor(now / 20000) : '');
  if (said.has(key) && ev !== 'item' && ev !== 'guard') return;
  const urgent = ev === 'item' || ev === 'guard' || ev === 'done' || ev === 'half';
  if (!urgent && now - lastChat < 9000) return;
  let t = '';
  if (ev === 'start') t = !m ? (c.giga ? 'C\'est lui, Gorgoth ! Monte de niveau avant d\'aller à son autel.' : 'L\'autel du boss est quelque part. Prends des niveaux d\'abord !')
    : m.type === 'collect' ? `Suis les flèches vers les ${m.icon} ! Chacun est gardé : sois prêt.` : m.type === 'survive' ? `Tiens ${m.t} secondes ! Une horde va arriver : bouge sans arrêt.` : 'Les gardes sont marqués d\'une 🎯. Va les chercher !';
  else if (ev === 'item') t = d.k >= d.n ? '' : d.n - d.k === 1 ? `Plus qu'un ${m.icon} ! Tu y es presque !` : d.k === 1 ? `Et d'un ! Encore ${d.n - d.k}.` : `${d.k}/${d.n} ! On tient le bon bout.`;
  else if (ev === 'guard') t = d.k >= d.n ? '' : `Un garde de moins ! Encore ${d.n - d.k}.`;
  else if (ev === 'half') t = 'À mi-chemin ! Courage, ils fatiguent !';
  else if (ev === 'lowhp') t = 'Aïe aïe aïe ! Fais attention, tu n\'as presque plus de PV !';
  else if (ev === 'bossHalf') t = 'Il faiblit ! Continue comme ça !';
  else if (ev === 'done') t = 'C\'est gagné ! Le portail s\'ouvre, file dedans !';
  if (!t) return;
  said.add(key); lastChat = now;
  bubbleInRun(who('p', c), t, 'pompon');
}

// ---------- Fin d'un chapitre (bilan) ----------
// r = { ok, revived, time, hp } ; étoiles : terminé, sans résurrection, rapide (ou PV). Nouvelles étoiles gardées ;
// première victoire : or et coffre (ouvert juste après), titre au dernier chapitre ; paliers d'étoiles.
export function storyEnd(n, r) {
  const c = CH[n], R = c.reward, B = book(), before = B[c.id] | 0, first = r.ok && !(before & 1);
  const got = r.ok ? 1 | (r.revived ? 0 : 2) | ((c.fast ? r.time <= c.fast : r.hp > 0.5) ? 4 : 0) : 0;
  const out = { n, ok: r.ok, first, title: c.title, gold: 0, chest: null, earned: null, last: n === CH.length - 1, next: r.ok && n + 1 < CH.length ? n + 1 : null,
    stars: got, had: before, crit: [c.mission ? 'Mission accomplie' : 'Chapitre terminé', 'Sans résurrection', star3(c)], mile: [] };
  if (!r.ok) return out;
  const t0 = totalStars();
  B[c.id] = before | got;
  save.story = Math.max(save.story | 0, storyDone()); // compatibilité (anciens écrans)
  if (first) {
    out.gold = R.gold; save.gold += R.gold;
    if (R.chest != null) { save.pendingChests.push({ tier: R.chest, zone: c.zone }); out.chest = R.chest; }
    if (R.title && TITLES[R.title]) { earnTitle(R.title); out.earned = R.title; }
  }
  const t1 = totalStars();
  for (const M of STORY.stars) if (t0 < M.n && t1 >= M.n) { // palier d'étoiles atteint
    if (M.gold) save.gold += M.gold;
    if (M.chest != null) save.pendingChests.push({ tier: M.chest, zone: 5 });
    if (M.title && TITLES[M.title]) earnTitle(M.title);
    if (M.shards) save.mythShards = (save.mythShards | 0) + M.shards;
    out.mile.push(M);
  }
  persist();
  return out;
}

// récompense d'un palier d'étoiles (court sur la carte, détaillé dans le bilan)
const mileTxt = (M, long = false) => [M.gold ? `${fmt(M.gold)} or` : '', M.chest != null ? esc(LOOT_TIERS[M.chest].name) : '',
  M.title && TITLES[M.title] ? (long ? `titre « ${esc(TITLES[M.title].name)} »` : 'Titre') : '', M.shards ? `${M.shards} éclats mythiques` : ''].filter(Boolean).join(' + ');
const starsHTML = (k, cls = '') => `<span class="st-stars ${cls}">${[0, 1, 2].map(i => `<i class="${i < k ? 'on' : ''}">★</i>`).join('')}</span>`;

// bloc du bilan : étoiles du chapitre (nouvelles en évidence), récompenses
export function storyBlock(S) {
  if (!S) return '';
  const rw = [
    S.first ? `<em>${iconImg('gold', 14)} +${fmt(S.gold)}</em>` : '', S.first && S.chest != null ? `<em>${iconImg('chest', 14)} ${esc(LOOT_TIERS[S.chest].name)}</em>` : '',
    S.earned ? `<em>${iconImg('flag', 14)} Titre « ${esc(TITLES[S.earned].name)} »</em>` : '',
    ...S.mile.map(M => `<em class="mile">★ ${M.n} étoiles : ${mileTxt(M, true)}</em>`),
  ].filter(Boolean).join('');
  const crit = S.ok ? `<span class="sr-crit">${S.crit.map((t, i) => { const b = 1 << i, has = S.stars & b, isNew = has && !(S.had & b); return `<span class="${has ? 'on' : ''} ${isNew ? 'new' : ''}"><i>★</i>${esc(t)}${isNew ? ' <b>nouvelle !</b>' : ''}</span>`; }).join('')}</span>` : '';
  return `<div class="story-res ${S.ok ? 'ok' : 'ko'}"><span class="sr-img"><img class="px spr" src="${bossImgOf(S.n)}" alt=""></span>
    <span class="sr-t"><small>${iconImg('book', 13)} Histoire · chapitre ${S.n + 1}/${CH.length}</small><b>${esc(S.title)}</b>
    <span>${S.ok ? (S.last ? 'Histoire terminée : la soupe est sauvée !' : 'Chapitre terminé !') : 'Raté… mais Pompon croit en vous. Réessayez !'}</span>
    </span>${crit}${rw ? `<span class="sr-rw">${rw}</span>` : ''}</div>`;
}

// ---------- Accueil, carte des chapitres, fiche d'un chapitre ----------
export function storyTile() { return ''; } // ancienne tuile d'accueil (remplacée par le bouton Histoire)

// carte : un monde par section (bandeau), ses chapitres reliés par un chemin ; étoiles et paliers en haut
export function storyScreenHTML() {
  const d = storyDone(), T = totalStars(), nx = storyNext();
  const miles = STORY.stars.map(M => `<span class="sm-mile ${T >= M.n ? 'on' : ''}"><b>★ ${M.n}</b><small>${mileTxt(M)}</small></span>`).join('');
  let html = '', zPrev = -1;
  CH.forEach((c, i) => {
    if (c.zone !== zPrev || c.giga) {
      if (zPrev >= 0) html += '</div>';
      zPrev = c.zone;
      html += `<div class="sm-world ${c.giga ? 'final' : ''}"><div class="sm-band" style="background-image:url(${zoneBannerURL(ZONES[c.zone])})"><b>${c.giga ? 'Final' : `Monde ${c.zone + 1}`}</b><span>${c.giga ? esc(GIGA.name) : esc(ZONES[c.zone].name)}</span></div>`;
    }
    const st = isDone(i) ? 'done' : unlocked(i) ? 'next' : 'locked', kind = c.mission ? c.mission.type : c.giga ? 'giga' : 'boss';
    html += `<button class="sm-ch ${st} k-${kind} ${i === nx && st !== 'done' ? 'cur' : ''}" data-act="chapter" data-n="${i}" ${st === 'locked' ? 'disabled' : ''}>
      <span class="sm-node">${st === 'done' ? iconImg('check', 16) : st === 'locked' ? iconImg('lock', 14) : i + 1}</span>
      <span class="sm-t"><small>Chapitre ${i + 1} · ${c.mission ? 'Mission' : c.giga ? 'Combat final' : 'Boss'}</small><b>${esc(c.title)}</b><em>${esc(goalTxt(c))}</em></span>
      <span class="sm-r">${st === 'locked' ? '' : `<img class="px spr" src="${bossImgOf(i)}" alt="">`}${starsHTML(starsOf(i))}</span>
    </button>`;
  });
  html += '</div>';
  return `<div class="story-screen">
    <div class="cs-bar"><button class="icon-btn" data-act="back" aria-label="Retour">${iconImg('back', 20)}</button><h2 class="cs-title">Histoire</h2></div>
    <div class="sts-head"><span class="sts-pot">🍲</span><span><b>${esc(STORY.name)}</b><small>${esc(STORY.pitch)}</small></span></div>
    <div class="sts-prog"><span class="pbar"><i style="width:${(d / CH.length * 100).toFixed(1)}%"></i></span><b>${d}/${CH.length}</b><span class="sts-st">★ ${T}/${CH.length * 3}</span></div>
    <div class="sm-miles">${miles}</div>
    <div class="sm-map">${html}</div>
  </div>`;
}

// fiche d'un chapitre avant de jouer : objectif, 3 étoiles à gagner, récompense ; renvoie true pour jouer
export function chapterSheet(n) {
  const c = CH[n], b = bits(n), R = c.reward, crit = [c.mission ? 'Mission accomplie' : 'Chapitre terminé', 'Sans résurrection', star3(c)];
  return modal({
    title: `<span class="eyebrow">Chapitre ${n + 1}/${CH.length} · ${c.giga ? 'Combat final' : esc(ZONES[c.zone].name)}</span>${esc(c.title)}`,
    cls: 'chapter-modal',
    body: `<div class="chs-hero" style="background-image:url(${zoneBannerURL(ZONES[c.zone])})"><img class="px spr" src="${bossImgOf(n)}" alt=""></div>
      <p class="chs-goal">${esc(goalTxt(c))}</p>
      <h4>Étoiles</h4>
      <div class="chs-crit">${crit.map((t, i) => `<span class="${b & (1 << i) ? 'on' : ''}"><i>★</i>${esc(t)}</span>`).join('')}</div>
      <h4>Première victoire</h4>
      <div class="chs-rw"><em>${iconImg('gold', 16)} ${fmt(R.gold)} or</em><em>${iconImg('chest', 16)} ${esc(LOOT_TIERS[R.chest].name)}</em>${R.title ? `<em>${iconImg('flag', 16)} Titre « ${esc(TITLES[R.title]?.name || '')} »</em>` : ''}${isDone(n) ? '<small>(déjà obtenue)</small>' : ''}</div>`,
    buttons: [{ label: 'Retour', cls: 'ghost', value: false }, { label: `${iconImg('play', 16)} ${isDone(n) ? 'Rejouer' : 'Jouer'}`, cls: 'primary', value: true }],
    dismissable: true,
  });
}
