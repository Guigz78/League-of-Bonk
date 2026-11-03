// Missions des chapitres « mission » du mode histoire (js/story.js) : ramasser des objets semés dans le monde, tenir face
// à une horde renforcée, battre des gardes d'élite marqués (un à la fois). Mélangé à Run (Object.assign) comme giga.js.
// Pas de boss ni d'autel : la mission réussie ouvre un portail près du héros (portail → bulles de fin → bilan).
// Ramasser : les objets forment une tournée tout autour de la carte (de plus en plus loin) ; seuls MIS.show sont visibles à la
// fois, et chacun est gardé : une embuscade surgit quand le héros approche (le dernier est gardé par un élite).
// Les objets visibles et le garde en cours sont dessinés par l'overlay (émoji flottant, flèche au bord de l'écran).
import { HALF } from './data.js';
import { sfx, buzz } from './audio.js';
import { esc } from './ui.js';

const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
// MIS : réglages (rayon de ramassage, distances des objets, objets visibles à la fois, rayon et taille des embuscades,
// délai entre deux gardes, renfort des apparitions pendant « tenez bon » : 1, la horde du monde à 60 s suffit)
export const MIS = { pick: 58, near: 480, far: 1320, show: 3, ambush: 380, pack: 4, guardGap: 3.5, guardDist: 560, surviveSpawn: 1,
  // défendre la marmite : position, PV, dégâts par seconde d'un monstre d'assaut au contact (élite ×3), vagues d'assaut
  potY: -170, potR: 46, potHp: 100, potDps: 0.7, potElite: 2, siegeEvery: 8, siegeMin: 4.5, siegePack: 2, siegeDist: 600,
  guardR: 230, guardK: 0.25 }; // héros à moins de guardR de la marmite : elle ne prend que guardK des dégâts

export const MISSION = {
  initMission() {
    const m = this.story?.mission || this.special?.mission; this.mission = null; // histoire, ou défi de la semaine / mode infini
    if (!m) return;
    const M = this.mission = { ...m, k: 0, el: 0, done: false, items: [], cur: null, next: 2.5, half: false };
    this.altar = null; // pas de boss dans un chapitre « mission »
    if (m.type === 'collect') { // tournée : angle d'or (chaque objet loin du précédent), de plus en plus loin du centre
      const lim = HALF - 240, a0 = Math.random() * Math.PI * 2;
      for (let i = 0; i < m.n; i++) {
        const a = a0 + i * 2.39996, d = MIS.near + (MIS.far - MIS.near) * (i / Math.max(1, m.n - 1)) * (0.88 + Math.random() * 0.12);
        M.items.push({ x: clamp(Math.cos(a) * d, -lim, lim), y: clamp(Math.sin(a) * d, -lim, lim), taken: false, amb: false, ph: i * 1.7 });
      }
    }
    if (m.type === 'survive') this.wm.spawn *= MIS.surviveSpawn;
    if (m.type === 'defend') { M.pot = { x: 0, y: MIS.potY, r: MIS.potR, hp: MIS.potHp, max: MIS.potHp, hitT: 0 }; M.siegeT = 4; }
  },

  updateMission(dt) {
    const M = this.mission, p = this.p;
    if (M.type === 'collect') {
      for (const o of this.missionShown()) {
        const d2 = dist2(o, p);
        if (!o.amb && d2 < MIS.ambush * MIS.ambush) this.missionAmbush(o);
        if (d2 > MIS.pick * MIS.pick) continue;
        o.taken = true; M.k++;
        this.burst(o.x, o.y, 24, 20, '#ffd54a');
        this.text(o.x, o.y, 60, `+1 ${M.icon}`, '#ffe08a', 1.3);
        sfx('lootPick'); buzz(25);
        this.onStory?.('item', { k: M.k, n: M.n });
        if (M.k >= M.n) return this.missionDone();
      }
    } else if (M.type === 'survive') {
      M.el += dt;
      if (!M.half && M.el >= M.t / 2) { M.half = true; this.onStory?.('half'); }
      if (M.el >= M.t) return this.missionDone();
    } else if (M.type === 'defend') {
      const P = M.pot;
      M.el += dt; P.hitT = Math.max(0, P.hitT - dt);
      P.guarded = Math.hypot(this.p.x - P.x, this.p.y - P.y) < MIS.guardR; // le héros la protège
      if (!M.half && M.el >= M.t / 2) { M.half = true; this.onStory?.('half'); }
      if (!M.low && P.hp < P.max * 0.35) { M.low = true; this.onStory?.('potLow'); }
      if (P.hp <= 0) return this.missionFail('<small>La marmite est renversée !</small>Mission ratée');
      if ((M.siegeT -= dt) <= 0) { M.siegeT = Math.max(MIS.siegeMin, MIS.siegeEvery - M.el / 40); this.missionSiege(); }
      if (M.el >= M.t) return this.missionDone();
    } else if (M.type === 'endless') {
      M.el += dt; // pas de fin : la folie monte après le chrono, puis le monde s'effondre (record = temps tenu)
    } else if (M.type === 'elites' && !M.cur && M.k < M.n && (M.next -= dt) <= 0) { // garde suivant
      const a = Math.random() * Math.PI * 2, lim = HALF - 200;
      const x = clamp(p.x + Math.cos(a) * MIS.guardDist, -lim, lim), y = clamp(p.y + Math.sin(a) * MIS.guardDist, -lim, lim);
      const e = this.addEnemy(this.zone.monsters[4], 4, { elite: true, x, y });
      e.storyMark = true; M.cur = e;
      this.emit('elite', { e });
      this.banner(`<small>Garde ${M.k + 1}/${M.n} · suivez la ${M.icon}</small><span class="tag elite">GARDE</span>${esc(e.name)}`, 2200);
      sfx('honk');
    }
  },

  // objets à ramasser visibles en ce moment (les MIS.show suivants de la tournée)
  missionShown() {
    const M = this.mission;
    return M?.type === 'collect' ? M.items.filter(o => !o.taken).slice(0, MIS.show) : [];
  },

  // embuscade : une meute du monde surgit derrière l'objet et fonce sur le héros (plus grosse au fil de la mission) ;
  // le dernier objet est en plus gardé par un élite
  missionAmbush(o) {
    const M = this.mission, p = this.p, mons = this.zone.monsters, k = Math.min(3, 1 + Math.floor(M.k / 3)), n = MIS.pack + Math.floor(M.k / 3);
    const lim = HALF - 120, a0 = Math.atan2(o.y - p.y, o.x - p.x); // côté opposé au héros
    o.amb = true;
    for (let i = 0; i < n; i++) {
      const a = a0 + (i / (n - 1 || 1) - 0.5) * 1.6, kk = Math.max(0, k - (i % 2));
      this.addEnemy(mons[kk], kk, { x: clamp(o.x + Math.cos(a) * 230, -lim, lim), y: clamp(o.y + Math.sin(a) * 230, -lim, lim) });
    }
    const last = M.items.filter(q => !q.taken).length === 1;
    if (last) { const e = this.addEnemy(mons[4], 4, { elite: true, x: o.x + 60, y: o.y }); this.emit('elite', { e }); }
    this.text(o.x, o.y, 90, last ? 'Le gardien !' : 'Embuscade !', '#ff8a5a', 1.4);
    sfx('honk'); buzz(30);
  },

  // vague d'assaut sur la marmite : une meute arrive d'un côté et ne vise que la marmite (plus grosse au fil du temps)
  missionSiege() {
    const M = this.mission, P = M.pot, mons = this.zone.monsters, lim = HALF - 120;
    const a0 = Math.random() * Math.PI * 2, n = MIS.siegePack + Math.floor(M.el / 45), k = Math.min(3, Math.floor(M.el / 35));
    for (let i = 0; i < n; i++) {
      const a = a0 + (i / n - 0.5) * 0.9, kk = Math.max(0, k - (i % 2));
      const e = this.addEnemy(mons[kk], kk, { x: clamp(P.x + Math.cos(a) * MIS.siegeDist, -lim, lim), y: clamp(P.y + Math.sin(a) * MIS.siegeDist, -lim, lim) });
      e.siege = true;
    }
    if (M.el > 50 && Math.random() < 0.25) { // de temps en temps, un élite mène l'assaut
      const e = this.addEnemy(mons[4], 4, { elite: true, x: clamp(P.x + Math.cos(a0) * (MIS.siegeDist + 60), -lim, lim), y: clamp(P.y + Math.sin(a0) * (MIS.siegeDist + 60), -lim, lim) });
      e.siege = true; this.emit('elite', { e });
    }
  },
  // un monstre d'assaut au contact de la marmite (run.updateEnemies)
  missionPotHit(e, dt) {
    const P = this.mission.pot;
    P.hp = Math.max(0, P.hp - MIS.potDps * (e.elite ? MIS.potElite : 1) * (P.guarded ? MIS.guardK : 1) * dt);
    if (P.hitT <= 0) { P.hitT = 0.35; this.emit('potHit', { x: P.x, y: P.y }); }
  },
  // mission ratée (marmite renversée) : fin de la partie
  missionFail(html) {
    const M = this.mission;
    if (M.failed) return;
    M.failed = true; M.done = true;
    this.banner(html, 2200, 'boss ot');
    this.shake = 12; sfx('lose'); buzz(120);
    this.emit('potBreak', { x: M.pot?.x || this.p.x, y: M.pot?.y || this.p.y });
    setTimeout(() => { if (!this.over) this.finish(false); }, 1800);
  },

  // un garde marqué est tombé
  missionKill(e) {
    const M = this.mission;
    if (!M || M.done || e !== M.cur) return;
    M.cur = null; M.k++; M.next = MIS.guardGap;
    this.onStory?.('guard', { k: M.k, n: M.n });
    if (M.k >= M.n) this.missionDone();
  },

  // mission accomplie : portail près du héros, place nette autour, PV un peu remontés
  missionDone() {
    const M = this.mission, p = this.p;
    if (M.done) return;
    M.done = true;
    const lim = HALF - 200, a = Math.atan2(-p.y, -p.x) || 0;
    const x = clamp(p.x + Math.cos(a) * 150, -lim, lim), y = clamp(p.y + Math.sin(a) * 150, -lim, lim);
    this.portal = { x, y, R: 60, charge: 0, t: 0 };
    for (const o of this.enemies) if (!o.dead && !o.boss && dist2(o, p) < 320 * 320) this.hitEnemy(o, 1e7, { quiet: true, noCrit: true });
    p.inv = Math.max(p.inv, 2); p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.25);
    this.emit('portalOpen', { x, y });
    this.banner('<small>Mission accomplie !</small>Le portail s\'ouvre : entrez dedans', 3000, 'boss portal');
    this.shake = 10; sfx('win'); sfx('portal'); buzz(100);
    this.onStory?.('done');
  },

  // texte sous le chrono : progression de la mission
  missionText() {
    const M = this.mission;
    if (M.failed) return 'Mission ratée';
    if (M.type === 'endless') return `∞ Record ${M.best ? `${Math.floor(M.best / 60)}:${String(M.best % 60).padStart(2, '0')}` : '—'}`;
    if (M.done) return 'Mission accomplie : au portail !';
    if (M.type === 'defend') return `${M.icon} Marmite ${Math.ceil(M.pot.hp)} %${M.pot.guarded ? ' · protégée' : ' · sans vous !'}`;
    if (M.type === 'collect') return `${M.icon} ${M.name} ${M.k}/${M.n}`;
    if (M.type === 'survive') return `${M.icon} Tenez bon !`; // le temps restant est dans le grand chrono (run.hud)
    return `${M.icon} ${M.name} ${M.k}/${M.n}`;
  },
};
