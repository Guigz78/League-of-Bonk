// Moteur façon Megabonk / PokéBonk (monde plat vu de dessus, rendu 3D par js/g3d) : monde ouvert, hordes, armes automatiques,
// évolutions du champion, autels, coffres, boss géants. Pas de saut : toute attaque s'évite en se déplaçant.
// Difficulté : niveaux Normal / Difficile / Cauchemar par zone, comportements par type de monstre
// (chaque attaque spéciale est annoncée par l'événement 'enemyTelegraph' avant d'agir), élites à pouvoirs,
// boss en 3 phases.
// Expédition : une partie enchaîne les mondes. Dans chaque monde, l'autel invoque le boss dans une arène ;
// sa mort ouvre un portail vers le monde suivant (plus dur). Chrono écoulé : les monstres deviennent fous.
// Totems de défi (plus dur contre des récompenses), coffres de butin ramassés pendant la partie, bonus de départ.
// L2 : armes et tomes verrouillés jamais proposés (unlocks.js), paliers d'Abysse (difficulté effective de abyss.js et
// malédictions : this.curse), suivi de la partie this.track (contrat L1/L2/L3, passé à onEnd dans sum.track).
import { CLASSES, WEAPONS, TOMES, ULTS, ZONE_TIME, ZONES, MAX_WEAPONS, MAX_TOMES, MAX_LEVEL, EVOLUTIONS, BOONS, DIFFICULTIES, ELITE_MODS, HALF, TOTEMS, LOOT_TIERS, BOOSTS, AFFIXES, LEGEND_EFFECTS,
  WEAPON_EVOS, LEVEL_RARITY, WEAPON_RARITY_DMG, REROLLS, SKIPS, COMBO_WINDOW, COMBO_STEPS, MASTERY, masteryOf } from './data.js';
import { save, playerStats } from './save.js';
import { canPickWeapon, canPickTome } from './unlocks.js';
import { runDiff, curseList, abyssName } from './abyss.js';
import { iconImg } from './art.js';
import { rng } from './pixel.js';
import { createGfx } from './visuals.js';
import { sfx, buzz, music, stopMusic, duckMusic } from './audio.js';
import { mount, $, esc, fmt } from './ui.js';

const TAU = Math.PI * 2;
const SPEED = { blob: 52, humanoid: 64, golem: 40, beast: 78, bird: 80, crab: 70, ghost: 64, worm: 56 };
const FLYERS = { bird: 34, ghost: 26 };
// Particularités par type de corps : PV, recul subi, dégâts au contact
// (les golems sont lents, très résistants et peu repoussés ; les volants frappent un peu moins fort)
const BODY = {
  golem: { hp: 1.6, knock: 0.25, dmg: 1 }, blob: { hp: 0.85, knock: 1.1, dmg: 1 }, bird: { hp: 0.85, knock: 1, dmg: 0.85 },
  crab: { hp: 0.95, knock: 0.8, dmg: 1 }, ghost: { hp: 0.9, knock: 1, dmg: 0.9 },
};
const BODY0 = { hp: 1, knock: 1, dmg: 1 };
const HARD_CAP = 250;   // monstres simultanés au maximum (rendu instancié)
// Réglages d'équilibre (exportés : le simulateur d'équilibrage peut les modifier)
// bossHp : PV du boss = PV de base × bossHp × zone × difficulté × monde traversé ;
// z* : renfort par zone (monde 1 à 6) ; st* : renfort par monde déjà traversé dans la partie ;
// carry* : renfort selon le temps total de la partie (s)
// WMUL : multiplicateur de dégâts par arme (équilibrage des classes : chaque champion commence avec la sienne)
export const WMUL = { arrows: 0.82, beam: 1.3, sword: 1.25 };
// hp / dmg : PV et dégâts de tous les monstres (compensent la puissance des évolutions d'armes, raretés et combos)
export const BAL = { comboXp: 0.1, hp: 1.3, dmg: 1.12, bossHp: 50, bossDmg: 1.4, zHp: 0.5, zDmg: 0.25, zBoss: 1.1, stHp: 1.15, stDmg: 1.0, stBoss: 2.35, carryHp: 300, carryDmg: 700 };
const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const SPAWN_R = 800, VIEW_R = 520;
const ARENA_R = 420;    // rayon de l'arène du boss
const OT_STEP = 15;     // secondes entre deux niveaux de folie après le chrono
const DOOM_LV = 7;      // à partir de ce niveau de folie (1 min 30 après le chrono), le monde s'effondre
const SWEEP_ARC = 3.5;  // le rayon tournant du boss balaie ~200°
const SWEEP_LEN = 270, BOSS_WAVE = 300; // portées limitées du rayon et des ondes du boss : on esquive en s'éloignant
const WORLD_SHORT = ['Vallée', 'Jungle', 'Rivière', 'Pics Gelés', 'Marais', 'Néant'];
// Vol de vie (exporté : le simulateur d'équilibrage peut le modifier). Soin par seconde plafonné à rate × vol de vie
// (en part des PV max, au plus cap = 6 %/s, atteint vers 30 %) : plus on en a, plus il soigne, même dans une horde.
// max = plafond du vol de vie, base = talent de tous les champions, dag = en plus sur les coups des dagues évoluées
// (Mille lames), sun = Cœur de soleil (aura évoluée, qui soigne en brûlant) : relève le plafond comme ce vol de vie.
// Équilibrage (simulateur, 312 parties) : boss du monde 1 vaincu 86 %, monde 2 51 % (sans ces ajouts : 85 % et 49 %) ;
// bot qui prend le vol de vie en priorité (~21 %) : 83 % et 44 %, il tient mieux mais tue moins vite.
export const LS = { cap: 0.06, rate: 0.2, max: 0.35, base: 0.01, dag: 0.06, sun: 0.2 };
const mmss = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
// nombres à la française pour les fiches de niveau (« 1,25 s », « +15 % »)
const NB = ' ';
const num = (v, d = 0) => { const k = 10 ** d; return (Math.round(v * k) / k).toLocaleString('fr-FR', { maximumFractionDigits: d }); };
const pctS = (v, sign = true) => (sign && v > 0.0005 ? '+' : v < -0.0005 ? '−' : '') + num(Math.abs(v) * 100) + NB + '%';
const secS = v => num(v, 2) + NB + 's';
const cnum = v => (v < 1e4 ? fmt(v) : v < 1e6 ? num(v / 1e3, v < 1e5 ? 1 : 0) + NB + 'k' : num(v / 1e6, 1) + NB + 'M'); // compteurs du HUD
// fiches de niveau des armes : [clé de wstats(), libellé, format], par ordre d'importance
const fI = v => fmt(v), fN = v => String(v), fP = v => (v ? `${v} ennemi${v > 1 ? 's' : ''}` : 'non'), fF = v => (v ? secS(v) : 'non');
const D_ = (l = 'Dégâts par coup') => ['dmg', l, fI], CD = (l = 'Recharge') => ['cd', l, secS];
const WLINES = {
  beam: [D_('Dégâts par rayon'), CD(), ['n', 'Rayons', fN], ['w', 'Largeur du rayon', fI]],
  arrows: [D_('Dégâts par flèche'), CD(), ['n', 'Flèches', fN], ['pierce', 'Transperce', fP]],
  sword: [D_(), CD(), ['R', 'Portée', fI], ['n', 'Frappe', v => (v > 1 ? 'devant et derrière' : 'devant')]],
  orbs: [D_('Dégâts par orbe'), ['n', 'Orbes', fN], ['R', 'Rayon', fI], CD('Frappe toutes les')],
  aura: [D_('Dégâts par brûlure'), ['R', 'Rayon', fI], CD('Brûle toutes les')],
  lightning: [D_('Dégâts par éclair'), CD(), ['n', 'Éclairs', fN], ['R', 'Zone', fI]],
  boomerang: [D_('Dégâts par lame'), CD(), ['n', 'Lames', fN], ['R', 'Taille', fI]],
  shrooms: [D_('Dégâts d\'explosion'), CD(), ['n', 'Champignons', fN], ['R', 'Explosion', fI]],
  frost: [D_('Dégâts de l\'onde'), CD(), ['R', 'Rayon', fI], ['freeze', 'Gel', fF]],
  daggers: [D_('Dégâts par dague'), ['ls', 'Vol de vie', v => (v ? pctS(v, false) : 'non')], CD(), ['n', 'Dagues', fN], ['pierce', 'Transperce', fP], ['v', 'Vitesse', fI]],
  snowball: [D_('Dégâts par boule'), CD(), ['n', 'Boules', fN], ['R', 'Zone', fI]],
};
// projectiles -> arme qui les tire (victimes par arme, run.track.weaponKills) ; la flèche de cristal évoluée vient des flèches
const SHOT_W = { arrow: 'arrows', boom: 'boomerang', dagger: 'daggers', snow: 'snowball' };
const WSIZE = { beam: 'w', sword: 'R', orbs: 'R', aura: 'R', lightning: 'R', boomerang: 'R', shrooms: 'R', frost: 'R', snowball: 'R' };
// tomes et bénédictions -> caractéristique de derive() ; DLINES : [libellé, format(valeur, valeur de base)]
const TOME_KEY = { power: 'dmgMul', haste: 'haste', boots: 'speed', vital: 'maxHp', magnet: 'magnet', crit: 'crit', armor: 'armor', wisdom: 'xpMul', area: 'area', vamp: 'lifesteal' };
const BOON_KEY = { dmg: 'dmgMul', hp: 'maxHp', speed: 'speed', crit: 'crit', xp: 'xpMul', magnet: 'magnet', haste: 'haste', vamp: 'lifesteal' };
const DLINES = {
  dmgMul: ['Dégâts', v => pctS(v - 1)],
  haste: ['Vitesse d\'attaque', v => pctS(1 / v - 1)],
  speed: ['Vitesse de course', (v, z) => pctS(v / z - 1)],
  maxHp: ['PV max', v => fmt(v)],
  magnet: ['Rayon de ramassage', (v, z) => pctS(v / z - 1)],
  crit: ['Chance de critique', v => pctS(v, false)],
  armor: ['Dégâts subis', v => (v > 0.0005 ? '−' + num(v * 100) + NB + '%' : '0' + NB + '%')],
  xpMul: ['Expérience', v => pctS(v - 1)],
  area: ['Taille des attaques', v => pctS(v - 1)],
  lifesteal: ['Vol de vie', v => num(v * 100, 1) + NB + '%'],
};

// ---------- Grille spatiale ----------
class Grid {
  constructor(size) { this.s = size; this.m = new Map(); }
  clear() { this.m.clear(); }
  add(e) { const k = ((e.x / this.s) | 0) * 73856093 ^ ((e.y / this.s) | 0) * 19349663; let a = this.m.get(k); if (!a) this.m.set(k, a = []); a.push(e); }
  query(x, y, r, out = []) {
    out.length = 0;
    const s = this.s, x0 = Math.floor((x - r) / s), x1 = Math.floor((x + r) / s), y0 = Math.floor((y - r) / s), y1 = Math.floor((y + r) / s);
    for (let gx = x0; gx <= x1; gx++) for (let gy = y0; gy <= y1; gy++) {
      const a = this.m.get(gx * 73856093 ^ gy * 19349663);
      if (a) for (const e of a) out.push(e);
    }
    return out;
  }
}

export class Run {
  constructor({ zone, diff = 0, abyss = 0, boosts = [], onEnd, onPause, onLevelUp, onChest, onDefeat, onPortal }) {
    this.zone = zone;
    this.startZone = zone.id;
    this.diffId = Math.max(0, Math.min(DIFFICULTIES.length - 1, diff | 0));
    // Abysse (palier 1 à 10, toujours sur la base de Cauchemar) : difficulté renforcée + malédictions cumulées
    this.diff = runDiff(this.diffId, abyss);
    this.abyss = this.diff.abyss || 0;
    if (this.abyss) this.diffId = DIFFICULTIES.length - 1;
    this.curse = this.diff.curses || new Set();
    this.cls = CLASSES[save.cls];
    this.onEnd = onEnd; this.onPause = onPause; this.onLevelUp = onLevelUp; this.onChest = onChest; this.onDefeat = onDefeat; this.onPortal = onPortal;
    // bonus choisis avant la partie (déjà consommés par l'interface)
    this.boosts = [...new Set(boosts || [])].filter(id => BOOSTS[id]);
    const has = id => this.boosts.includes(id);
    const st = { ...playerStats() };
    // caractéristiques de l'équipement (contrat : valeurs manquantes = 0, multiplicateurs de base = 1), plafonnées
    const n = k => Math.max(0, +st[k] || 0), cap = (k, v) => (AFFIXES[k]?.max ? Math.min(AFFIXES[k].max, v) : v);
    for (const k of ['hp', 'atk', 'crit', 'regen']) st[k] = n(k);
    for (const k of ['speed', 'magnet', 'gold']) st[k] = +st[k] > 0 ? +st[k] : 1;
    st.hp = Math.max(1, st.hp); st.atk = Math.max(1, st.atk);
    if (has('vigueur')) st.hp = Math.round(st.hp * 1.25);
    if (has('fortune')) { st.gold *= 1.4; st.magnet *= 1.3; }
    this.base = st;
    this.it = {};
    // + talents de classe (CLASSES : armor = dégâts subis en moins, lifesteal = vol de vie)
    for (const k of ['critDmg', 'lifesteal', 'haste', 'area', 'armor', 'thorns', 'dodge', 'xp', 'ult']) this.it[k] = cap(k, n(k) + (+this.cls[k] || 0));
    // effets uniques des objets légendaires (un même effet sur deux objets compte double)
    this.leg = {};
    for (const id of Array.isArray(st.effects) ? st.effects : []) if (LEGEND_EFFECTS[id]) this.leg[id] = (this.leg[id] || 0) + 1;
    this.bDmg = has('rage') ? 1.2 : 1; this.bXp = has('sagesse') ? 1.3 : 1; this.bLs = has('sang') ? 0.08 : 0;
    this.phoenix = has('phenix');
    this.p = {
      x: 0, y: 0, h: 0, vh: 0, r: 14, face: { x: 0, y: -1 },
      maxHp: st.hp, hp: st.hp, atk: st.atk, crit: st.crit, regen: st.regen * 0.1 * this.diff.heal,
      speed: 160 * st.speed, magnet: 95 * st.magnet * (save.pet === 'phenix' ? 1.4 : 1),
      armor: 0, xpMul: 1, area: 1, haste: 1, dmgMul: 1, critMul: 2,
      inv: 0, shieldHit: 0, aegis: has('egide') ? 3 : 0, level: 1, xp: 0, xpNext: 5, ult: 0,
      weapons: [], tomes: {}, boons: {}, evo: 0,
      tv: {}, bv: {}, tr: {}, // valeurs cumulées des tomes / bénédictions (selon la rareté des cartes), rareté max par tome
    };
    // rareté des cartes : chance (trèfle, fortune de l'équipement, totem maudit) ; relances et « passer »
    this.luck0 = (has('trefle') ? 0.35 : 0) + Math.max(0, st.gold - 1) * 0.5;
    this.rerolls = REROLLS + (masteryOf(save.mastery?.[this.cls.id]).lv >= MASTERY.miles[2] ? 1 : 0); this.skips = SKIPS; // maîtrise 20 : une relance de plus
    this.lsPool = 0; this.lsBudget = 0; this.chainN = 0; this.bubbleT = 0;
    this.lsShown = 0; this.lsT = 0; this.lsEvT = 0; this.lsGlow = 0; // vol de vie : soin à afficher, orbes (au plus ~8/s), barre de PV
    this.lsX = 0;             // vol de vie des armes évoluées qui soignent (relève le plafond de soin par seconde)
    this.addWeapon(this.cls.weapon);
    this.recalc();
    this.grid = new Grid(64);
    this.kills = 0; this.gold = 0;
    // combo : victimes enchaînées à moins de COMBO_WINDOW s d'écart ; paliers récompensés ; un coup reçu le brise
    this.combo = 0; this.comboT = 0; this.comboBest = 0; this.comboStep = 0;
    this.mv = { x: 0, y: 0 }; // vitesse calculée par l'IA d'un monstre (réutilisée, pas d'allocation)
    this.paused = false; this.over = false; this.revived = false;
    this.pending = 0;
    this.joy = null; this.look = null; this.yaw = 0;
    this.mvx = 0; this.mvy = 0;   // déplacement lissé (accélération / freinage)
    this.target = null;           // cible principale des armes (réticule du rendu)
    this.keys = new Set();
    this.shake = 0; this.hitSfxT = 0; this.msgT = 0;
    this.hurtFlash = 0; this.evoFlash = 0; this.ultFlash = 0;
    this.petT = 0; this.pet = save.pet ? { id: save.pet, x: -30, y: 10 } : null;
    this.slowmo = 1; this.hitStop = 0; this.celebT = 0;
    this.SPAWN_R = SPAWN_R;
    this.events = []; // événements pour le rendu (coups, morts, sauts...), vidés à chaque image par gfx
    // expédition : monde courant dans la partie, temps total, mondes nettoyés, butin, totems activés
    this.stage = 0; this.runTime = 0; this.cleared = []; this.loot = []; this.heat = 0;
    this.lootLuck = 0;        // chance d'améliorer le rang de chaque coffre de butin (totem maudit)
    this.runHp = 1;           // PV des monstres pour le reste de la partie (totem maudit)
    // suivi de la partie (contrat run.track) : lu à la fin par les défis, la maîtrise (L2) et la Saison (L1).
    // worlds = mondes vaincus (boss tués), maxWorld = dernier monde atteint, chests = coffres de butin ramassés,
    // totems = totems activés, won = au moins un boss vaincu ; en plus : abyss (palier), lsHeal (PV rendus par le vol de vie),
    // hearts (cœurs ramassés), bossFast (combat de boss le plus court, s), totemBoss (boss battu après les 3 totems du monde)
    this.track = { kills: 0, bossKills: 0, worlds: 0, maxWorld: zone.id, maxCombo: 0, level: 1, dmgTaken: 0, hits: 0, ults: 0, chests: 0, totems: 0,
      elites: 0, weaponKills: {}, evoWeapons: 0, time: 0, cls: this.cls.id, diff: this.diffId, abyss: this.abyss, zone: zone.id, won: false,
      lsHeal: 0, hearts: 0, bossFast: 0, totemBoss: 0 };
    this.curW = null;         // arme qui frappe en ce moment (victimes par arme)
    this.setupWorld();
    if (has('depart')) { // départ éclair : niveau 4, 3 améliorations à choisir tout de suite
      const p = this.p;
      p.level = 4; p.xpNext = Math.round(5 + 3 * 4 + Math.pow(4, 1.6)); this.pending = 3;
    }
  }

  // (re)met en place le monde courant : au départ et à chaque passage de portail
  setupWorld() {
    const z = this.zone, D = this.diff;
    this.duration = Math.round(ZONE_TIME[z.id] * (this.curse.has('short') ? 0.8 : 1)); // Abysse : chrono court
    this.time = 0;
    this.enemies = []; this.shots = []; this.eshots = []; this.fx = []; this.pickups = []; this.texts = []; this.mines = []; this.parts = []; this.waves = [];
    this.bombs = [];          // attaques de zone à retardement (explosions, météores) : { x, y, R, t, dmg, kind, e }
    this.dropChests = [];
    this.spawnAcc = 0;
    // élites plus fréquentes, 4 hordes de plus en plus denses, plafond de monstres selon la zone et le niveau
    this.nextElite = 35;
    this.eliteGap = (z.id ? 30 : 34) * D.elite;
    this.swarms = [0.25, 0.46, 0.66, 0.85].map(f => f * this.duration);
    this.swarmN = 0;
    // rythme des vagues (calme -> montée -> pic -> répit) et champion de mi-parcours (~55 % du chrono)
    this.phase = 'calm'; this.spikeT = 0; this.breathT = 0;
    this.miniAt = this.duration * 0.55; this.miniDone = false; this.mini = null;
    this.cap = Math.min(HARD_CAP - 10, Math.round((150 + z.id * 16 + this.stage * 12) * (1 + (D.spawn - 1) * 0.6)));
    this.pack = 0; this.packX = 0; this.packY = 0;
    this.acts = 0;            // attaques spéciales en cours (limitées pour rester lisibles)
    this.boss = null; this.bossSpawned = false;
    this.arena = null; this.portal = null; this.entering = 0;
    this.overtime = 0; this.otLevel = 0; this.doomT = 0;
    // modificateurs de ce monde (totems) : apparitions, or, dégâts, vitesse, intervalle des élites
    this.wm = { spawn: 1, gold: 1, dmg: 1, speed: 1, elite: 1 };
    if (this.curse.has('horde')) { this.wm.spawn = 1.35; this.wm.gold = 1.25; } // Abysse : totem de la Horde imposé
    // chaque monde traversé dans la même partie renforce nettement les monstres (le héros arrive avec son build)
    const st = this.stage, carry = this.runTime;
    this.sk = { hp: (1 + BAL.stHp * st) * (1 + carry / BAL.carryHp), dmg: (1 + BAL.stDmg * st) * (1 + carry / BAL.carryDmg), boss: 1 + BAL.stBoss * st };
    this.placeInterest();
  }

  // signale un événement aux effets visuels (n'a aucun effet sur la partie)
  emit(type, data = {}) { if (this.events.length < 400) this.events.push({ type, t: this.time, ...data }); }

  // ---------- Mise en place ----------
  start() {
    const u = ULTS[this.cls.ult];
    mount(`<div class="run">
      <canvas id="cv"></canvas>
      <div class="hud cr">
        <div class="hud-top">
          <div class="hud-left">
            <button class="icon-btn hud-pause" id="pauseBtn" aria-label="Pause"><i class="pause-ic"></i></button>
            <div class="hl-row"><span class="hr-loot" id="lootPill"><i class="hud-chest"></i><b id="lootN">0</b></span><span class="hr-heat" id="heatPill" hidden>${iconImg('i_burn', 15)}<b id="heatN">0</b></span></div>
          </div>
          <div class="timer"><span class="world-tag" id="worldTag"></span><span class="t-plate" id="tPlate"><b id="timer">0:00</b></span><small id="timerLbl">Survivez !</small>${this.diffId ? `<em class="diff-tag d${this.diffId}${this.abyss ? ' ab' : ''}">${esc(this.diff.name)}</em>` : ''}</div>
          <div class="hud-right">
            <span>${iconImg('skull', 15)}<b id="killsN">0</b></span><span class="hr-gold">${iconImg('gold', 15)}<b id="goldRun">0</b></span>
          </div>
        </div>
        <div class="xprow"><span class="lvl-badge"><small>Niv.</small><b id="lvl">1</b></span><div class="xpbar"><div class="fill" id="xpFill"></div></div></div>
        <div class="evo-line" id="evoLine"></div>
        <div class="loadout" id="loadout"></div>
        <div class="combo" id="combo" hidden><b id="comboN">0</b><small>combo</small><i class="combo-t"><i id="comboT"></i></i></div>
        <div class="bossbar" id="bossbar" hidden><div class="bn" id="bossName"></div><div class="hpbar"><div class="fill"></div><i class="ph" style="left:60%"></i><i class="ph" style="left:30%"></i><span></span></div></div>
        <div class="minibar" id="minibar" hidden><div class="mb-n" id="miniName"></div><div class="mb-bar"><i id="miniFill"></i></div></div>
        <div class="banner" id="banner"></div>
        <div class="hint-bubble" id="hintBubble">Glissez le doigt pour courir : votre champion attaque tout seul !<br>Sortez des <em>zones rouges</em> avant qu'elles n'explosent.</div>
        <button class="ult-btn" id="ultBtn" aria-label="${esc(u.name)}">${iconImg(u.icon, 32)}<svg class="ring" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16"/></svg><small>${esc(u.name)}</small></button>
      </div>
    </div>`);
    this.cv = $('#cv');
    this.gfx = createGfx(this, this.cv);
    this.resize = () => this.gfx.resize();
    this.resize();
    window.addEventListener('resize', this.resize);
    this.bindInput();
    $('.run .hud')?.classList.toggle('lefty', !!save.settings?.lefty); // gaucher : ultime à gauche
    this.onVis = () => { if (document.hidden && !this.paused && !this.over) this.pause(); };
    document.addEventListener('visibilitychange', this.onVis);
    this.renderLoadout();
    this.renderEvo();
    this.renderWorld();
    this.banner(`<small>Monde ${this.zone.id + 1} · ${esc(this.zone.name)}${this.diffId ? ' · ' + esc(this.diff.name) : ''}</small>Trouvez l'autel du boss !`, 2400, 'world');
    if (this.abyss) setTimeout(() => { if (!this.over) this.banner(`<small>${esc(abyssName(this.abyss))} · malédictions</small>${curseList(this.abyss, 'small')}`, 3200, 'small abyss'); }, 2500);
    music('zone' + this.zone.id);
    this.last = performance.now();
    this.raf = requestAnimationFrame(t => this.frame(t));
    setTimeout(() => $('#hintBubble')?.classList.add('out'), save.stats.runs > 2 ? 3000 : 7000);
  }

  placeInterest() {
    const r = rng('poi' + this.zone.id + ':' + save.stats.runs + ':' + this.stage);
    const spots = [];
    // point libre : à une distance du départ comprise entre minD et maxD (sinon n'importe où au-delà de minD)
    const pick = (minD, maxD = 0, gap = 260, lim = HALF - 220) => {
      for (let t = 0; t < 120; t++) {
        let x, y;
        if (maxD) { const a = r() * TAU, d = minD + r() * (maxD - minD); x = Math.cos(a) * d; y = Math.sin(a) * d; }
        else { x = (r() * 2 - 1) * lim; y = (r() * 2 - 1) * lim; }
        if (Math.abs(x) > lim || Math.abs(y) > lim || Math.hypot(x, y) < minD) continue;
        if (spots.some(s => Math.hypot(s.x - x, s.y - y) < Math.max(gap, s.gap))) continue;
        spots.push({ x, y, gap }); return { x, y };
      }
      const a = r() * TAU, d = maxD || minD + 200, s = { x: Math.cos(a) * d, y: Math.sin(a) * d, gap };
      spots.push(s); return { x: s.x, y: s.y };
    };
    // autel du boss : loin du départ, avec la place pour l'arène
    this.altar = { ...pick(900, 1250, 330, HALF - 500), R: 70, charge: 0, used: false };
    // trésor caché tout au bout de la carte
    const tr = pick(1100, 1450, 260, HALF - 150);
    this.pickups.push({ type: 'loot', x: tr.x, y: tr.y, tier: this.lootTier(r() < 0.35 ? 2 : 1), hidden: true, t0: 0 });
    // 3 totems de défi de sortes différentes
    const kinds = Object.keys(TOTEMS);
    for (let i = kinds.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [kinds[i], kinds[j]] = [kinds[j], kinds[i]]; }
    this.totems = kinds.slice(0, 3).map(kind => ({ ...pick(350, 1300, 280), kind, charge: 0, used: false }));
    this.chests = Array.from({ length: 9 }, () => ({ ...pick(260), open: false }));
    this.shrines = Array.from({ length: 5 }, () => ({ ...pick(320), charge: 0, used: false }));
    this.chestCost = Math.round(12 + this.zone.id * 8);
  }

  destroy() {
    this.over = true;
    stopMusic();
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
    document.removeEventListener('visibilitychange', this.onVis);
    window.removeEventListener('keydown', this.kd); window.removeEventListener('keyup', this.ku);
    this.gfx?.dispose();
  }

  bindInput() {
    const cv = this.cv;
    cv.addEventListener('pointerdown', e => {
      e.preventDefault();
      cv.setPointerCapture?.(e.pointerId);
      // un seul doigt : on glisse pour courir
      if (!this.joy) this.joy = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY, t0: performance.now(), moved: 0, yaw: this.yaw };
      $('#hintBubble')?.classList.add('out');
    });
    cv.addEventListener('pointermove', e => {
      const j = this.joy;
      if (j && e.pointerId === j.id) { j.moved = Math.max(j.moved, Math.hypot(e.clientX - j.ox, e.clientY - j.oy)); j.x = e.clientX; j.y = e.clientY; }
    });
    const up = e => { if (this.joy && e.pointerId === this.joy.id) this.joy = null; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    // boutons (ultime, pause) : réagissent dès qu'on les touche (pas au relâchement), avec un autre doigt
    // pendant que le premier tient le joystick (le joystick ne suit que son propre doigt)
    const press = (sel, fn) => {
      const b = $(sel); if (!b) return;
      b.addEventListener('pointerdown', e => {
        e.preventDefault(); e.stopPropagation();
        fn();
        b.classList.remove('press'); void b.offsetWidth; b.classList.add('press');
        $('#hintBubble')?.classList.add('out');
      });
      b.addEventListener('click', e => e.preventDefault());
      b.addEventListener('contextmenu', e => e.preventDefault());
    };
    press('#ultBtn', () => this.useUlt());
    press('#pauseBtn', () => this.pause());
    this.kd = e => { this.keys.add(e.key.toLowerCase()); if (e.key.toLowerCase() === 'e') this.useUlt(); if (e.key === 'Escape') this.pause(); };
    this.ku = e => this.keys.delete(e.key.toLowerCase());
    window.addEventListener('keydown', this.kd); window.addEventListener('keyup', this.ku);
  }

  banner(html, ms = 1500, cls = '') {
    const b = $('#banner'); if (!b) return;
    b.className = 'banner show ' + cls;
    b.innerHTML = `<div>${html}</div>`;
    b.style.animationDuration = ms + 'ms';
    clearTimeout(this.bannerT);
    this.bannerT = setTimeout(() => { b.className = 'banner'; }, ms);
  }

  pause() {
    if (this.paused || this.over) return;
    this.paused = true; this.joy = null; this.look = null;
    duckMusic(true);
    this.onPause(() => { this.paused = false; duckMusic(false); this.last = performance.now(); });
  }


  // il n'y a plus de saut : plus d'alerte de saut (les rendus lisent encore ce champ)

  // temps avant que le rayon tournant du boss atteigne le joueur (9 = jamais)
  sweepEta(e) {
    const p = this.p, dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy);
    if (d > e.sweepLen + p.r) return 9;
    const s = SWEEP_ARC / e.sweepDur, half = Math.asin(Math.min(1, (e.sweepW / 2 + p.r * 0.6) / Math.max(1, d))), toP = Math.atan2(dy, dx);
    const ahead = (from, dir) => { let a = (toP - from) * dir; a = Math.atan2(Math.sin(a), Math.cos(a)); return a; };
    if (e.phase === 'sweepW') { const a = ahead(e.sweepA, e.sweepDir); return a + half > 0 && a - half < SWEEP_ARC ? e.phaseT + Math.max(0.01, (a - half) / s) : 9; }
    const left = Math.max(0, e.phaseT), a = ahead(e.sweepA, e.sweepDir);
    if (a + half > 0 && a - half < s * left) return Math.max(0.01, (a - half) / s);
    if (e.sweeps > 1) { // il repart dans l'autre sens
      const end = e.sweepA + e.sweepDir * s * left, b = ahead(end, -e.sweepDir);
      if (b + half > 0 && b - half < SWEEP_ARC) return left + Math.max(0.01, (b - half) / s);
    }
    return 9;
  }

  // vol de vie effectif (Frénésie sanglante : doublé sous 50 % de PV, au moins +4 %), plafonné ; x = bonus de l'arme qui frappe
  lsNow(x = 0) {
    const p = this.p; let ls = p.lifesteal + x;
    if (this.leg.blood && p.hp < p.maxHp * 0.5) ls = Math.max(ls * (1 + this.leg.blood), ls + 0.04 * this.leg.blood); // deux objets : triplé
    return Math.min(LS.max, ls);
  }
  // soins de l'équipement : vol de vie (au plus LS.rate × vol de vie des PV max par seconde, plafond LS.cap, ×1,5 en Frénésie
  // sanglante) et bulle des légendaires. Retour visuel : « +N » cramoisi groupé (au plus toutes les 0,7 s) et éclat de la
  // barre de PV du HUD (lsGlow, lu par hud())
  updateHeal(dt) {
    const p = this.p, low = this.leg.blood && p.hp < p.maxHp * 0.5;
    const cap = p.maxHp * Math.min(LS.cap * (low ? 1.5 : 1), LS.rate * this.lsNow(this.lsX));
    this.lsBudget = Math.min(cap, this.lsBudget + cap * dt);
    if (this.lsPool > 0) {
      const h = Math.min(this.lsPool * this.diff.heal, this.lsBudget, p.maxHp - p.hp);
      if (h > 0 && !this.dying) { p.hp += h; this.lsBudget -= h; this.lsShown += h; this.track.lsHeal += h; }
      this.lsPool = 0;
    }
    this.lsT -= dt; this.lsGlow = Math.max(0, this.lsGlow - dt);
    if (this.lsT <= 0 && this.lsShown >= 1) { this.text(p.x + rand(-8, 8), p.y, 72, '+' + fmt(this.lsShown), '#ff4d6d', 1.15); this.lsShown = 0; this.lsT = 0.7; this.lsGlow = 0.32; }
    if (this.leg.bubble && !p.shieldHit) {
      this.bubbleT -= dt;
      if (this.bubbleT <= 0) { p.shieldHit = 1; this.bubbleT = 10 / this.leg.bubble; this.emit('legend', { kind: 'bubble', x: p.x, y: p.y }); }
    }
  }

  // ---------- Armes, tomes, autels ----------
  // r = rareté de la carte (0 à 3) : bonus de dégâts propre à l'arme ; rb = bonus cumulé, r = rareté max (bord du HUD)
  addWeapon(id, r = 0) {
    let w = this.p.weapons.find(x => x.id === id);
    if (w) w.lv = Math.min(MAX_LEVEL, w.lv + 1); else this.p.weapons.push(w = { id, lv: 1, t: 0.4, a: 0, rb: 0, r: 0, evo: false });
    w.rb = (w.rb || 0) + (WEAPON_RARITY_DMG[r] || 0); w.r = Math.max(w.r || 0, r);
    this.renderLoadout?.();
    this.evoTell?.();
  }

  addTome(id, r = 0) {
    const p = this.p;
    p.tomes[id] = (p.tomes[id] || 0) + 1; p.tv[id] = (p.tv[id] || 0) + LEVEL_RARITY[r].mult; p.tr[id] = Math.max(p.tr[id] || 0, r);
    this.recalc(); this.renderLoadout();
    this.evoTell();
  }
  addBoon(id, r = 0) {
    this.p.boons[id] = (this.p.boons[id] || 0) + 1; this.p.bv[id] = (this.p.bv[id] || 0) + LEVEL_RARITY[r].mult;
    this.recalc();
    if (id === 'hp') this.p.hp = this.p.maxHp;
  }

  // ---------- Évolutions d'armes ----------
  // armes prêtes à évoluer : niveau 5 + tome associé possédé
  evoReady() { return this.p.weapons.filter(w => !w.evo && w.lv >= MAX_LEVEL && WEAPON_EVOS[w.id] && this.p.tomes[WEAPON_EVOS[w.id].tome]); }
  // annonce (une fois par arme) qu'une évolution sera proposée à la prochaine montée de niveau ou au prochain coffre
  evoTell() {
    if (!this.cv) return;
    for (const w of this.evoReady()) {
      if (w.told) continue;
      w.told = true;
      this.banner(`<small>Évolution prête : au prochain niveau ou coffre</small>${esc(WEAPONS[w.id].name)} → ${esc(WEAPON_EVOS[w.id].name)}`, 2200, 'small evo-ready');
      sfx('shrine');
    }
  }
  // indice d'évolution pour les cartes : quelle arme / quel tome il manque
  evoHint(c) {
    const p = this.p;
    if (c.kind === 'weapon') {
      const E = WEAPON_EVOS[c.id]; if (!E) return '';
      return `Évolution : niv. 5 + ${TOMES[E.tome].name} → ${E.name}${p.tomes[E.tome] ? ' (tome possédé)' : canPickTome(E.tome) ? '' : ' (tome à débloquer dans les Défis)'}`;
    }
    if (c.kind === 'tome') {
      const w = p.weapons.find(x => !x.evo && WEAPON_EVOS[x.id]?.tome === c.id);
      return w ? `Évolution : ${WEAPONS[w.id].name} niv. 5 + ce tome → ${WEAPON_EVOS[w.id].name}` : '';
    }
    return '';
  }
  evoCard(w) {
    const E = WEAPON_EVOS[w.id];
    return { kind: 'evo', id: w.id, lv: MAX_LEVEL, rarity: 3, name: E.name, icon: E.icon, desc: E.desc, weapon: WEAPONS[w.id].name, tome: TOMES[E.tome].name };
  }
  evolveWeapon(id) {
    const p = this.p, w = p.weapons.find(x => x.id === id), E = WEAPON_EVOS[id];
    if (!w || w.evo || !E) return;
    w.evo = true; w.r = 3; w.t = Math.min(w.t, 0.3); w.orbs = null;
    if (id === 'daggers' || id === 'aura') this.lsX += id === 'daggers' ? LS.dag : LS.sun; // Mille lames, Cœur de soleil : comptent dans le soin par seconde
    this.evoFlash = Math.max(this.evoFlash, 0.9); p.inv = Math.max(p.inv, 1.5);
    this.burst(p.x, p.y, 40, 40, '#ffe48a', 4);
    this.fx.push({ type: 'ring', x: p.x, y: p.y, r: 260, life: 0.7, max: 0.7, color: '#ffd54a' });
    this.fx.push({ type: 'ring', x: p.x, y: p.y, r: 380, life: 0.9, max: 0.9, color: '#ffffff' });
    for (const e of this.grid.query(p.x, p.y, 260)) if (!e.boss) { e.kx += (e.x - p.x) * 3; e.ky += (e.y - p.y) * 3; }
    this.emit('weaponEvolve', { id, name: E.name, x: p.x, y: p.y });
    this.banner(`<small>Évolution d'arme ! · ${esc(WEAPONS[id].name)} + ${esc(TOMES[E.tome].name)}</small>${esc(E.name)}`, 2600, 'evo weapon');
    this.shake = Math.max(this.shake, 7);
    sfx('evolve'); buzz(90);
    save.stats.weaponEvos = (save.stats.weaponEvos || 0) + 1;
    this.track.evoWeapons++;
    this.renderLoadout();
  }

  // caractéristiques du héros pour un jeu de tomes / bénédictions / évolution donné (sans rien modifier :
  // sert aussi aux fiches de niveau). Chaque stade d'évolution : +12 % dégâts, +15 % PV, +3 % vitesse ; forme ultime +10 % dégâts.
  // t, b = valeurs des tomes / bénédictions (1 par carte commune, plus pour les cartes rares : LEVEL_RARITY.mult)
  derive(t = this.p.tv, b = this.p.bv, evo = this.p.evo) {
    const B = this.base, I = this.it, last = evo > 0 && evo >= EVOLUTIONS[this.cls.id].length - 1;
    return {
      dmgMul: (1 + 0.15 * (t.power || 0) + 0.12 * (b.dmg || 0)) * (1 + 0.12 * evo + (last ? 0.1 : 0)) * this.bDmg,
      // multiplicateur des recharges : tomes et autels (plancher 0,45), puis vitesse d'attaque de l'équipement
      haste: Math.max(0.45, 1 - 0.1 * (t.haste || 0) - 0.08 * (b.haste || 0)) / (1 + I.haste),
      speed: 160 * B.speed * (1 + 0.1 * (t.boots || 0) + 0.08 * (b.speed || 0) + 0.03 * evo),
      magnet: 95 * B.magnet * (1 + 0.35 * (t.magnet || 0) + 0.3 * (b.magnet || 0)) * (save.pet === 'phenix' ? 1.4 : 1),
      crit: Math.min(1, B.crit + 0.07 * (t.crit || 0) + 0.06 * (b.crit || 0)),
      armor: Math.min(0.6, 0.06 * (t.armor || 0) + I.armor),
      xpMul: (1 + 0.15 * (t.wisdom || 0) + 0.2 * (b.xp || 0)) * this.bXp * (1 + I.xp),
      area: (1 + 0.12 * (t.area || 0)) * (1 + I.area),
      maxHp: Math.round(B.hp * (1 + 0.2 * (t.vital || 0) + 0.15 * (b.hp || 0)) * (1 + 0.15 * evo)),
      // vol de vie : talent des champions + équipement et Boutique + tome, autels, fiole de sang (plafond LS.max)
      lifesteal: Math.min(LS.max, LS.base + I.lifesteal + 0.03 * (t.vamp || 0) + 0.03 * (b.vamp || 0) + this.bLs),
    };
  }

  recalc() {
    const p = this.p, d = this.derive(), old = p.maxHp;
    Object.assign(p, d);
    p.critMul = 2 + this.it.critDmg;
    if (p.maxHp > old) p.hp += p.maxHp - old;
  }

  // Caractéristiques d'une arme à un niveau donné : source unique pour les attaques ET les fiches de niveau
  // (dmg = dégâts par coup avant critique, cd = recharge en s, n = nombre de projectiles, R = taille…)
  // x = l'arme elle-même ({ rb : bonus de rareté, evo : évoluée }) quand on la connaît
  wstats(id, lv, p = this.p, x = null) {
    const A = p.atk * p.dmgMul * (1 + (x?.rb || 0)) * (WMUL[id] || 1), ar = p.area, h = p.haste, L = k => (lv >= k ? 1 : 0);
    if (x?.evo) switch (id) { // armes évoluées : bien plus fortes, et un comportement à part (updateWeapons)
      case 'beam': return { dmg: A * 1.9 * 1.3 * 1.4 * 1.5, cd: 0.75 * h, n: 4, w: 44 * ar, len: 430 * ar };
      case 'arrows': return { dmg: A * 1.3 * 1.5, cd: 0.36 * h, n: 7, pierce: 4, big: A * 6 };
      case 'sword': return { dmg: A * 1.7 * 1.3 * 1.4 * 1.5, cd: 0.8 * h, R: 150 * ar, n: 3 };
      case 'orbs': return { dmg: A * 0.8 * 1.3 * 1.3 * 1.5, cd: 0.35 * h, n: 9, R: 125 * ar };
      case 'aura': return { dmg: A * 0.55 * 1.4 * 1.5 * 1.6, cd: 0.4 * h, R: 150 * ar };
      case 'lightning': return { dmg: A * 2.3 * 1.3 * 1.4, cd: 1.25 * h, n: 8, R: 80 * ar };
      case 'boomerang': return { dmg: A * 1.3 * 1.3 * 1.3 * 1.4, cd: 1.25 * h, n: 6, R: 28 * ar };
      case 'shrooms': return { dmg: A * 3 * 1.4 * 1.5, cd: 1.5 * h, n: 4, R: 125 * ar };
      case 'frost': return { dmg: A * 1.2 * 1.3 * 1.6, cd: 1.7 * h, R: 230 * ar, freeze: 1.5 };
      case 'daggers': return { dmg: A * 0.9 * 1.3 * 1.4, cd: 0.75 * h, n: 16, pierce: 6, v: 620, ls: LS.dag };
      case 'snowball': return { dmg: A * 2.4 * 1.3 * 1.5, cd: 1.4 * h, n: 5, R: 110 * ar, freeze: 0.8 };
    }
    switch (id) {
      case 'beam': return { dmg: A * 1.9 * (L(2) ? 1.3 : 1) * (L(5) ? 1.4 : 1), cd: (L(5) ? 0.9 : 1.15) * h, n: 1 + L(4), w: (L(3) ? 30 : 18) * ar, len: 320 * ar };
      case 'arrows': return { dmg: A * (L(3) ? 1.3 : 1), cd: (L(5) ? 0.4 : 0.52) * h, n: 1 + L(2) + L(5), pierce: L(4) * 2 };
      case 'sword': return { dmg: A * 1.7 * (L(2) ? 1.3 : 1) * (L(5) ? 1.4 : 1), cd: (L(5) ? 0.85 : 1.1) * h, R: (L(3) ? 112 : 86) * ar, n: 1 + L(4) };
      case 'orbs': return { dmg: A * 0.8 * (L(3) ? 1.3 : 1) * (L(5) ? 1.3 : 1), cd: 0.45 * h, n: 2 + L(2) + L(4) + L(5), R: (L(4) ? 100 : 80) * ar };
      case 'aura': return { dmg: A * 0.55 * (L(3) ? 1.4 : 1) * (L(5) ? 1.5 : 1), cd: 0.5 * h, R: (64 + L(2) * 16 + L(4) * 20) * ar };
      case 'lightning': return { dmg: A * 2.3 * (L(3) ? 1.3 : 1), cd: (L(4) ? 1.4 : 1.8) * h, n: 1 + L(2) + L(4) + L(5) * 2, R: 46 * ar };
      case 'boomerang': return { dmg: A * 1.3 * (L(2) ? 1.3 : 1) * (L(5) ? 1.3 : 1), cd: (L(4) ? 1.6 : 2) * h, n: 1 + L(3) + L(5), R: (L(4) ? 20 : 15) * ar };
      case 'shrooms': return { dmg: A * 3 * (L(3) ? 1.4 : 1), cd: (L(5) ? 2 : 2.6) * h, n: 1 + L(2) + L(5), R: (L(4) ? 80 : 58) * ar };
      case 'frost': return { dmg: A * 1.2 * (L(2) ? 1.3 : 1), cd: (L(4) ? 2.4 : 3.2) * h, R: (L(3) ? 150 : 115) * ar, freeze: L(5) };
      case 'daggers': return { dmg: A * 0.9 * (L(3) ? 1.3 : 1), cd: (L(5) ? 0.95 : 1.3) * h, n: 4 + L(2) * 2 + L(4) * 2, pierce: L(5) * 3, v: L(5) ? 540 : 440, ls: 0 };
      case 'snowball': return { dmg: A * 2.4 * (L(2) ? 1.3 : 1), cd: (L(5) ? 1.7 : 2.2) * h, n: 1 + L(4) + L(5), R: (L(3) ? 76 : 56) * ar };
    }
    return { dmg: A, cd: 1 };
  }

  renderLoadout() {
    const el = $('#loadout'); if (!el) return;
    const p = this.p;
    // classes r0…r3 = meilleure rareté choisie pour cet emplacement, evo = arme évoluée, ready = prête à évoluer
    const ready = this.evoReady();
    el.innerHTML = p.weapons.map(w => `<span class="lo w r${w.r || 0}${w.evo ? ' evo' : ''}${ready.includes(w) ? ' ready' : ''}">${iconImg(WEAPONS[w.id].icon, 18)}<b>${w.evo ? '★' : w.lv}</b></span>`).join('') +
      Object.entries(p.tomes).map(([id, lv]) => `<span class="lo t r${p.tr[id] || 0}">${iconImg(TOMES[id].icon, 18)}<b>${lv}</b></span>`).join('') +
      // bonus de départ (l'égide affiche ses blocages restants, la plume de phénix s'éteint une fois utilisée)
      this.boosts.map(id => {
        const off = (id === 'egide' && !p.aegis) || (id === 'phenix' && !this.phoenix);
        return `<span class="lo bst ${off ? 'off' : ''}" title="${esc(BOOSTS[id].name)}">${iconImg(BOOSTS[id].icon, 14)}${id === 'egide' && p.aegis ? `<b>${p.aegis}</b>` : ''}</span>`;
      }).join('');
  }

  // monde courant dans le bandeau du haut : « Monde 2/6 · Jungle »
  renderWorld() {
    const el = $('#worldTag'); if (!el) return;
    el.innerHTML = `Monde <b>${this.zone.id + 1}/${ZONES.length}</b> · ${esc(WORLD_SHORT[this.zone.id] || this.zone.name)}`;
  }

  renderEvo() {
    const el = $('#evoLine'); if (!el) return;
    const evs = EVOLUTIONS[this.cls.id], next = evs[this.p.evo + 1];
    // pastilles : un point par stade d'évolution
    const pips = evs.map((_, i) => `<i class="${i <= this.p.evo ? 'on' : ''}"></i>`).join('');
    el.innerHTML = `<b>${esc(evs[this.p.evo].name)}</b><span class="evo-pips">${pips}</span>${next ? `<small>évolue au niv. ${next.lvl}</small>` : '<small class="max">forme ultime</small>'}`;
    el.classList.toggle('final', !next);
  }

  // rareté d'une carte (0 Commun … 3 Légendaire) : la chance augmente les poids des cartes rares
  rollRarity() {
    const L = this.luck0 + this.lootLuck + 0.04 * this.stage;
    let tot = 0;
    for (const R of LEVEL_RARITY) tot += R.w * (1 + R.luck * L);
    let x = Math.random() * tot;
    for (let i = 0; i < LEVEL_RARITY.length; i++) { const R = LEVEL_RARITY[i]; if ((x -= R.w * (1 + R.luck * L)) <= 0) return i; }
    return 0;
  }

  // n cartes d'amélioration ; une arme prête à évoluer est toujours proposée en premier
  choices(n = 3) {
    const p = this.p, cands = [], out = [];
    const ev = this.evoReady();
    if (ev.length) { out.push(this.evoCard(ev[Math.floor(Math.random() * ev.length)])); if (n === 1) return out; }
    for (const w of p.weapons) if (w.lv < MAX_LEVEL) cands.push({ kind: 'weapon', id: w.id, lv: w.lv + 1, wgt: 3 });
    // armes et tomes verrouillés (Défis) : jamais proposés ; l'arme de départ du champion reste toujours ouverte
    if (p.weapons.length < MAX_WEAPONS) for (const id of Object.keys(WEAPONS)) if (!p.weapons.find(w => w.id === id) && canPickWeapon(id, this.cls.id)) cands.push({ kind: 'weapon', id, lv: 1, wgt: 1.6 });
    for (const [id, lv] of Object.entries(p.tomes)) if (lv < MAX_LEVEL) cands.push({ kind: 'tome', id, lv: lv + 1, wgt: 2 });
    if (Object.keys(p.tomes).length < MAX_TOMES) for (const id of Object.keys(TOMES)) if (!p.tomes[id] && canPickTome(id)) cands.push({ kind: 'tome', id, lv: 1, wgt: 1.3 });
    while (out.length < n && cands.length) {
      const tot = cands.reduce((s, c) => s + c.wgt, 0);
      let x = Math.random() * tot, i = 0;
      while ((x -= cands[i].wgt) > 0) i++;
      const c = cands.splice(i, 1)[0];
      delete c.wgt; c.rarity = this.rollRarity();
      out.push(c);
    }
    if (!out.length) out.push({ kind: 'heal', id: 'heal', lv: 0, rarity: this.rollRarity() }, { kind: 'gold', id: 'gold', lv: 0, rarity: this.rollRarity() });
    return out;
  }

  // Fiche d'un choix (niveau, coffre, autel, totem) : ce qui change, avec les valeurs exactes avant → après.
  // { lines: [{ label, from, to }] } (from = null pour une nouvelle arme / un nouveau tome)
  choiceInfo(c) {
    const p = this.p, lines = [], L = (label, from, to) => lines.push({ label, from, to });
    if (!c) return { lines };
    const R = LEVEL_RARITY[c.rarity || 0], mul = R.mult;
    if (c.kind === 'evo') { // évolution : niveau 5 -> forme évoluée
      const w = p.weapons.find(x => x.id === c.id);
      if (!w) return { lines };
      const a = this.wstats(c.id, w.lv, p, w), b = this.wstats(c.id, w.lv, p, { ...w, evo: true });
      for (const [k, label, f] of WLINES[c.id] || []) if (b[k] != null && a[k] != null && Math.abs(a[k] - b[k]) > 1e-6) L(label, f(a[k]), f(b[k]));
      return { lines: lines.slice(0, 4), rarity: R.name, evo: true };
    }
    if (c.kind === 'weapon') {
      const w = p.weapons.find(x => x.id === c.id), lv0 = w ? w.lv : 0, lv1 = Math.min(MAX_LEVEL, lv0 + 1);
      const a = lv0 ? this.wstats(c.id, lv0, p, w) : null, b = this.wstats(c.id, lv1, p, { evo: false, rb: (w?.rb || 0) + (WEAPON_RARITY_DMG[c.rarity || 0] || 0) });
      for (const [k, label, f] of WLINES[c.id] || []) {
        if (b[k] == null) continue;
        // nouvelle arme : ses valeurs de départ (sans les « 0 ») ; amélioration : seulement ce qui change
        if (a ? Math.abs(a[k] - b[k]) < 1e-6 : !b[k] || (k === 'n' && b[k] < 2)) continue;
        L(label, a ? f(a[k]) : null, f(b[k]));
      }
      if (!lines.length) L(WLINES[c.id]?.[0][1] || 'Dégâts', fmt(a?.dmg || 0), fmt(b.dmg));
      return { lines: lines.slice(0, a ? 4 : 3), rarity: R.name, hint: this.evoHint(c) };
    }
    if (c.kind === 'tome' || c.kind === 'boon') {
      const tome = c.kind === 'tome', cur = tome ? p.tv : p.bv, v0 = cur[c.id] || 0;
      const nxt = { ...cur, [c.id]: v0 + mul };
      const a = this.derive(p.tv, p.bv, p.evo), b = tome ? this.derive(nxt, p.bv, p.evo) : this.derive(p.tv, nxt, p.evo);
      const z = this.derive({}, {}, 0), key = (tome ? TOME_KEY : BOON_KEY)[c.id], S = DLINES[key];
      if (S) L(S[0], S[1](a[key], z[key]), S[1](b[key], z[key]));
      // conséquence concrète sur l'arme principale (dégâts par coup, recharge)
      const w0 = p.weapons[0];
      if (w0 && (key === 'dmgMul' || key === 'haste' || key === 'area')) {
        const wa = this.wstats(w0.id, w0.lv, { ...p, ...a }, w0), wb = this.wstats(w0.id, w0.lv, { ...p, ...b }, w0);
        const k = key === 'dmgMul' ? 'dmg' : key === 'haste' ? 'cd' : WSIZE[w0.id];
        const f = (WLINES[w0.id] || []).find(x => x[0] === k);
        if (f && wa[k] != null) L(`${WEAPONS[w0.id].name} · ${f[1].toLowerCase()}`, f[2](wa[k]), f[2](wb[k]));
      }
      if (c.kind === 'boon' && c.id === 'hp') L('PV', fmt(p.hp), fmt(b.maxHp));
      return { lines, rarity: R.name, hint: tome ? this.evoHint(c) : '' };
    }
    if (c.kind === 'heal') { L('PV', fmt(p.hp), fmt(Math.min(p.maxHp, p.hp + p.maxHp * 0.3 * mul))); return { lines, rarity: R.name }; }
    if (c.kind === 'gold') { L('Or', fmt(this.gold), fmt(this.gold + this.bonusGold(mul))); return { lines, rarity: R.name }; }
    return { lines };
  }

  bonusGold(mul = 1) { return Math.round((25 + this.zone.id * 10) * this.diff.gold * mul); }

  boonChoices() {
    return Object.keys(BOONS).sort(() => Math.random() - 0.5).slice(0, 3).map(id => ({ kind: 'boon', id, lv: (this.p.boons[id] || 0) + 1, rarity: this.rollRarity() }));
  }

  applyChoice(c) {
    if (!c) return;
    const r = c.rarity || 0, mul = LEVEL_RARITY[r].mult;
    if (c.kind === 'weapon') this.addWeapon(c.id, r);
    else if (c.kind === 'tome') this.addTome(c.id, r);
    else if (c.kind === 'boon') this.addBoon(c.id, r);
    else if (c.kind === 'evo') this.evolveWeapon(c.id);
    else if (c.kind === 'heal') this.p.hp = Math.min(this.p.maxHp, this.p.hp + this.p.maxHp * 0.3 * mul);
    else if (c.kind === 'gold') this.gold += this.bonusGold(mul);
    if (c.kind !== 'evo') sfx('pick');
    if (c.kind === 'tome' || c.kind === 'weapon') this.renderLoadout();
  }

  // ---------- Boucle ----------
  frame(now) {
    if (this.over) return;
    // jamais négatif : l'horodatage de requestAnimationFrame peut précéder le performance.now() pris juste avant
    let dt = clamp((now - this.last) / 1000, 0, 0.05);
    this.last = now;
    if (!this.paused) {
      // court ralenti de célébration à la mort d'un boss
      if (this.celebT > 0) { this.celebT -= dt; this.slowmo = this.celebT > 0.4 ? 0.3 : 1 - 0.7 * Math.max(0, this.celebT) / 0.4; }
      dt *= this.slowmo;
      if (this.hitStop > 0) { this.hitStop -= dt; dt *= 0.06; } // arrêt sur image très bref (gros coups)
      this.update(dt);
      if (!this.over && !this.entering && !this.dying && !this.paused && this.p.ult >= 100 && this.autoUltReady()) this.useUlt();
      if (!this.over && !this.entering && !this.dying && !this.paused) {
        if (this.evolveReady()) this.evolve();
        else if (this.pending > 0 && this.evoFlash <= 0) this.levelUp();
      }
    }
    if (!this.over) this.render(this.paused ? 0 : dt);
    this.raf = requestAnimationFrame(t => this.frame(t));
  }

  // montée de niveau : 3 cartes (rareté), et en option relancer les cartes / passer (contre un peu d'or).
  // Contrat de l'interface : onLevelUp(titre, cartes, done(carte), sous-titre, { rerolls, skips, reroll() -> nouvelles cartes | null, skip() -> bool })
  levelUp() {
    this.paused = true; this.joy = null; this.look = null;
    this.pending--;
    let opts = this.choices(), closed = false;
    sfx('levelup'); buzz(20);
    const close = c => {
      if (closed) return false;
      closed = true;
      this.applyChoice(c);
      this.paused = false; this.last = performance.now();
      this.renderLoadout();
      return true;
    };
    const run = this;
    const extra = {
      get rerolls() { return run.rerolls; },
      get skips() { return run.skips; },
      skipGold: this.skipGold(),
      reroll() { if (closed || run.rerolls <= 0) return null; run.rerolls--; opts = run.choices(); return opts; },
      skip() {
        if (closed || run.skips <= 0) return false;
        run.skips--; const g = run.skipGold(); run.gold += g;
        run.text(run.p.x, run.p.y, 70, '+' + g + ' or', '#ffd54a', 1.2); sfx('coin');
        return close(null);
      },
    };
    this.onLevelUp(`Niveau ${this.p.level} !`, opts, c => close(c), undefined, extra);
  }

  skipGold() { return Math.round((12 + this.zone.id * 6) * this.diff.gold * this.base.gold); }

  evolveReady() {
    const next = EVOLUTIONS[this.cls.id][this.p.evo + 1];
    return next && this.p.level >= next.lvl;
  }

  // 5 stades : l'effet grandit à chaque stade, la forme ultime (aura de super guerrier) fait trembler l'écran
  evolve() {
    const p = this.p, evs = EVOLUTIONS[this.cls.id];
    p.evo = Math.min(evs.length - 1, p.evo + 1);
    const ev = evs[p.evo], final = p.evo === evs.length - 1, k = p.evo / (evs.length - 1), col = ev.aura || '#ffd54a';
    this.recalc();
    p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.5);
    p.ult = 100;
    this.addWeapon(this.cls.weapon);
    this.evoFlash = 1.2 + 0.4 * k;
    p.inv = 2 + k;
    const R = 220 + 160 * k;
    this.burst(p.x, p.y, 30 + 30 * k, 60, '#ffe48a', 2 + 2 * k);
    this.fx.push({ type: 'ring', x: p.x, y: p.y, r: R, life: 0.8, max: 0.8, color: col });
    if (final) this.fx.push({ type: 'ring', x: p.x, y: p.y, r: R * 1.4, life: 1.1, max: 1.1, color: '#ffffff' });
    for (const e of this.grid.query(p.x, p.y, R)) if (!e.boss) { e.kx += (e.x - p.x) * 4; e.ky += (e.y - p.y) * 4; }
    this.banner(final ? `<small>Forme ultime !</small>${esc(ev.name)}` : `<small>Votre champion évolue ! · stade ${p.evo + 1}/${evs.length}</small>${esc(ev.name)}`, final ? 3200 : 2600, final ? 'evo final' : 'evo');
    this.emit('evolve', { evo: p.evo, x: p.x, y: p.y, final, aura: ev.aura || null });
    this.renderEvo();
    this.shake = Math.max(this.shake, 3 + 4 * k);
    sfx('evolve'); buzz(final ? 140 : 80);
  }

  update(dt) {
    const p = this.p;
    this.time += dt; this.runTime += dt;
    this.hitSfxT -= dt; this.msgT -= dt;
    if (this.comboT > 0 && (this.comboT -= dt) <= 0) this.endCombo(false);
    this.evoFlash = Math.max(0, this.evoFlash - dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    this.ultFlash = Math.max(0, this.ultFlash - dt);
    // déplacement dans le sens du doigt (caméra fixe, le haut de l'écran est toujours le nord) :
    // zone morte de 8 px, vitesse analogique jusqu'à ~42 px (× taille du joystick), la base suit le doigt au-delà
    let jx = 0, jy = 0;
    if (this.joy) {
      const js = clamp(+save.settings?.joySize || 1, 0.7, 1.4), full = 42 * js, anchor = 54 * js;
      const dx = this.joy.x - this.joy.ox, dy = this.joy.y - this.joy.oy, d = Math.hypot(dx, dy);
      if (d > 8) { const k = Math.min(1, (d - 8) / (full - 8)); jx = dx / d * k; jy = dy / d * k; }
      if (d > anchor) { this.joy.ox = this.joy.x - dx / d * anchor; this.joy.oy = this.joy.y - dy / d * anchor; }
    }
    const K = this.keys;
    if (K.has('arrowleft') || K.has('a') || K.has('q')) jx -= 1;
    if (K.has('arrowright') || K.has('d')) jx += 1;
    if (K.has('arrowup') || K.has('w') || K.has('z')) jy -= 1;
    if (K.has('arrowdown') || K.has('s')) jy += 1;
    const iy = this.joy ? this.joy.yaw : this.yaw;
    const fwx = -Math.sin(iy), fwy = -Math.cos(iy), rgx = Math.cos(iy), rgy = -Math.sin(iy);
    let mx = rgx * jx - fwx * jy, my = rgy * jx - fwy * jy;
    let ml = Math.hypot(mx, my);
    if (ml > 1) { mx /= ml; my /= ml; }
    if (this.entering) { // aspiré par le portail : plus de contrôle, le héros glisse vers son centre
      const P = this.portal; mx = 0; my = 0; ml = 0; this.mvx = this.mvy = 0;
      if (P) { const k = Math.min(1, dt * 6); p.x += (P.x - p.x) * k; p.y += (P.y - p.y) * k; }
    }
    if (ml > 0.05) p.face = { x: mx / ml, y: my / ml };
    // vitesse lissée : accélère en ~0,07 s, freine en ~0,05 s (démarrages et arrêts nets mais pas secs)
    const cl = Math.hypot(this.mvx, this.mvy), sk = 1 - Math.exp(-dt / (ml >= cl ? 0.07 : 0.05));
    this.mvx += (mx - this.mvx) * sk; this.mvy += (my - this.mvy) * sk;
    mx = this.mvx; my = this.mvy; ml = Math.hypot(mx, my);
    p.speed01 = Math.min(1, ml);
    p.x = Math.max(-HALF + 80, Math.min(HALF - 80, p.x + mx * p.speed * dt));
    p.y = Math.max(-HALF + 80, Math.min(HALF - 80, p.y + my * p.speed * dt));
    const A = this.arena;
    if (A) { // mur de l'arène : on ne sort pas tant que le boss vit
      const ax = p.x - A.x, ay = p.y - A.y, ad = Math.hypot(ax, ay), m = A.R - p.r;
      if (ad > m) { p.x = A.x + ax / ad * m; p.y = A.y + ay / ad * m; }
    }
    p.moving = ml > 0.05;
    p.inv = Math.max(0, p.inv - dt);
    if (p.regen) p.hp = Math.min(p.maxHp, p.hp + p.regen * dt);
    this.updateHeal(dt);

    this.spawn(dt);
    this.grid.clear();
    for (const e of this.enemies) this.grid.add(e);
    this.updateEnemies(dt);
    this.updateTarget();
    this.updateWeapons(dt);
    this.updateShots(dt);
    this.updateWaves(dt);
    this.updateBombs(dt);
    this.updatePickups(dt);
    if (!this.entering) { this.updateInterest(dt); this.updateAltar(dt); this.updateTotems(dt); }
    this.updatePortal(dt);
    this.updatePet(dt);
    for (const f of this.fx) f.life -= dt;
    this.fx = this.fx.filter(f => f.life > 0);
    for (const t of this.texts) { t.life -= dt; t.z += 50 * dt; }
    this.texts = this.texts.filter(t => t.life > 0);
    for (const q of this.parts) { q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; q.vz -= 900 * dt; if (q.z < 0) { q.z = 0; q.vz *= -0.4; q.vx *= 0.7; q.vy *= 0.7; } }
    this.parts = this.parts.filter(q => q.life > 0);
    this.shake = Math.max(0, this.shake - dt * 30);
    this.enemies = this.enemies.filter(e => !e.dead);
    if (!this.over) this.hud();
  }

  // ---------- Apparition ----------
  spawnPoint() {
    const p = this.p, A = this.arena;
    for (let t = 0; t < 10; t++) {
      const a = Math.random() * TAU;
      const x = p.x + Math.cos(a) * SPAWN_R, y = p.y + Math.sin(a) * SPAWN_R;
      if (A && (x - A.x) ** 2 + (y - A.y) ** 2 < (A.R + 90) ** 2) continue; // jamais dans l'arène
      if (Math.abs(x) < HALF - 100 && Math.abs(y) < HALF - 100) return [x, y];
    }
    return [p.x - Math.sign(p.x || 1) * SPAWN_R, p.y];
  }

  spawn(dt) {
    const z = this.zone, t = this.time, mons = z.monsters, D = this.diff;
    if (t >= this.duration) this.updateOvertime(dt);
    const ot = this.otLevel, fight = this.boss && !this.boss.dead;
    // la cadence monte nettement avec le temps (zone 1 un peu plus douce), puis avec la folie après le chrono
    let rate = (0.9 + Math.min(t, this.duration) / 18) * (1 + z.id * 0.12) * (1 + this.stage * 0.1) * D.spawn * this.wm.spawn * (1 + 0.3 * ot) * this.director(dt);
    if (fight) rate *= this.boss.enraged ? 0.5 : 0.36;
    this.spawnAcc += rate * dt;
    const pool = Math.min(3, Math.floor(t / (this.duration / 4)));
    const cap = Math.min(HARD_CAP - 10, this.cap + ot * 12);
    while (this.spawnAcc >= 1) {
      this.spawnAcc--;
      if (this.enemies.length >= cap) { this.spawnAcc = Math.min(this.spawnAcc, 4); break; }
      const k = Math.floor(Math.random() * (pool + 1));
      const kk = Math.max(0, Math.min(3, k - (Math.random() < 0.3 ? 1 : 0)));
      // par petits groupes : les monstres arrivent en meutes
      if (this.pack > 0) { this.pack--; this.addEnemy(mons[kk], kk, { x: this.packX + rand(-40, 40), y: this.packY + rand(-40, 40) }); continue; }
      const e = this.addEnemy(mons[kk], kk);
      if (t > 30 && Math.random() < 0.45) { this.pack = 1 + Math.floor(Math.random() * (t > 100 ? 4 : 2)); this.packX = e.x; this.packY = e.y; }
    }
    if (t >= this.nextElite && !fight) {
      this.nextElite += this.eliteGap * this.wm.elite / (1 + 0.35 * ot);
      this.spawnElite();
    }
    if (!this.miniDone && t >= this.miniAt && !this.arena && !this.bossSpawned) this.spawnMini();
    if (this.swarms.length && t >= this.swarms[0] && !this.arena) {
      this.swarms.shift();
      const wave = ++this.swarmN;
      this.spikeT = 7; this.breathT = 0;
      this.emit('swarm', {});
      // hordes de plus en plus denses : un cercle (avec une brèche pour s'échapper), puis deux cercles de monstres différents
      const n = Math.round((10 + z.id * 2 + wave * 6) * (1 + (D.spawn - 1) * 0.8) * (this.curse.has('swarm') ? 1.4 : 1)), k = Math.min(pool, 3);
      const gap = Math.floor(Math.random() * n), gw = wave <= 2 ? 3 : 2;
      for (let i = 0; i < n && this.enemies.length < HARD_CAP; i++) {
        if ((i - gap + n) % n < gw) continue;
        const a = i / n * TAU, R = 430;
        this.addEnemy(mons[k], k, { x: this.p.x + Math.cos(a) * R, y: this.p.y + Math.sin(a) * R });
      }
      if (wave >= 3) {
        const n2 = Math.round(n * 0.6), k2 = Math.max(0, k - 1 - (wave & 1));
        for (let i = 0; i < n2 && this.enemies.length < HARD_CAP; i++) {
          const a = (i + 0.5) / n2 * TAU, R = 570;
          this.addEnemy(mons[k2], k2, { x: this.p.x + Math.cos(a) * R, y: this.p.y + Math.sin(a) * R });
        }
      }
      if (wave === 4 && (z.id > 0 || this.diffId > 0)) {
        const a = Math.random() * TAU, el = this.addEnemy(mons[4], 4, { elite: true, x: this.p.x + Math.cos(a) * 520, y: this.p.y + Math.sin(a) * 520 });
        this.emit('elite', { e: el });
      }
      this.banner(wave >= 3 ? 'Une énorme horde vous encercle !' : 'Une horde vous encercle !', 1500, 'warn');
      sfx('alarm');
    }
  }

  // Rythme des vagues, calé sur les hordes : calme, montée avant la horde, pic pendant 7 s, puis répit.
  // Renvoie le multiplicateur de la cadence d'apparition (≈ 1 en moyenne). Pas de rythme pendant le boss ni la folie.
  director(dt) {
    let ph = 'calm', k = 0.8;
    if (this.arena || this.time >= this.duration) ph = 'fight', k = 1;
    else if (this.spikeT > 0) { ph = 'spike'; k = 1.7; if ((this.spikeT -= dt) <= 0) this.breathT = 7; }
    else if (this.breathT > 0) { ph = 'breather'; k = 0.4; this.breathT -= dt; }
    else if (this.swarms.length && this.swarms[0] - this.time < 18) { ph = 'build'; k = 0.85 + 0.6 * (1 - (this.swarms[0] - this.time) / 18); }
    if (ph !== this.phase) { this.phase = ph; this.emit('director', { phase: ph }); }
    return k;
  }

  // champion de mi-parcours : un gros élite à 2 pouvoirs, avec sa barre de vie en haut de l'écran
  spawnMini() {
    this.miniDone = true;
    const p = this.p, mons = this.zone.monsters, a = Math.atan2(p.face.y, p.face.x) + rand(-0.9, 0.9), lim = HALF - 150;
    const e = this.mini = this.addEnemy(mons[4], 4, { elite: true, mini: true, x: clamp(p.x + Math.cos(a) * 440, -lim, lim), y: clamp(p.y + Math.sin(a) * 440, -lim, lim) });
    this.emit('elite', { e }); this.emit('miniBoss', { e });
    const mb = $('#minibar');
    if (mb) { mb.hidden = false; $('#miniName').innerHTML = `<em>Champion</em>${esc(e.name)}`; }
    this.banner(`<small>Un champion de la horde arrive !</small><span class="tag elite">CHAMPION</span>${esc(e.name)}`, 2200, 'boss mini');
    this.shake = Math.max(this.shake, 6);
    sfx('honk'); sfx('alarm'); buzz(40);
    return e;
  }

  spawnElite(o = {}) {
    const mons = this.zone.monsters, el = this.addEnemy(mons[4], 4, { elite: true, ...o });
    this.emit('elite', { e: el });
    this.banner(`<small>${o.why || 'Un ennemi élite approche !'}</small><span class="tag elite">ÉLITE</span>${esc(el.name)}`, 1900);
    sfx('honk');
    return el;
  }

  // ---------- Chrono écoulé : les monstres deviennent fous ----------
  updateOvertime(dt) {
    if (!this.otLevel) {
      // le boss n'a pas été invoqué : il surgit à côté du joueur, l'arène se referme sur lui
      if (!this.bossSpawned) { if (this.altar) this.altar.used = true; this.summonBoss(this.p.x, this.p.y, true); }
      this.otLevel = 1;
      for (const e of this.enemies) if (!e.boss && !e.dead) { e.mad = true; e.speed *= 1.12; e.dmg *= 1.15; }
      this.emit('overtime', {});
      this.banner('<small>Le chrono est écoulé</small>Les monstres deviennent fous !', 2400, 'boss ot');
      this.shake = 10; sfx('overtime'); buzz(80);
    }
    this.overtime = this.time - this.duration;
    const lv = 1 + Math.floor(this.overtime / OT_STEP);
    if (lv > this.otLevel) {
      this.otLevel = lv;
      this.emit('overtimeStep', { level: lv });
      if (this.boss && !this.boss.dead) this.boss.dmg *= 1.1;
      if (lv === DOOM_LV) this.banner('<small>Le monde s\'effondre !</small>Fuyez par le portail !', 2200, 'boss ot');
      else if (lv % 2 === 0) this.banner(`<small>Ils sont de plus en plus fous…</small>Folie niv. ${lv}`, 1500, 'warn ot');
      sfx('alarm');
    }
    // le monde s'effondre : des météores visent le joueur, de plus en plus vite (on ne peut pas rester indéfiniment)
    if (lv >= DOOM_LV && !this.entering && !this.dying) {
      this.doomT = (this.doomT ?? 0) - dt;
      if (this.doomT <= 0) {
        const k = lv - DOOM_LV, p = this.p;
        this.doomT = Math.max(0.25, 1.4 - k * 0.25);
        for (let i = 0; i < 1 + Math.ceil(k / 2); i++) {
          const lead = p.moving ? rand(30, 90) : 0, a = Math.random() * TAU, r = i ? rand(40, 140) : rand(0, 50);
          this.addBomb({ x: p.x + p.face.x * lead + Math.cos(a) * r, y: p.y + p.face.y * lead + Math.sin(a) * r, R: 72, t: 1.05, dmg: p.maxHp * (0.14 + 0.06 * k), kind: 'meteor', e: null, doom: true });
        }
      }
    }
  }

  addEnemy(def, k, o = {}) {
    const z = this.zone, t = Math.min(this.time, this.duration), D = this.diff, B = BODY[def.body] || BODY0, S = this.sk, ot = this.otLevel, W = this.wm;
    let x = o.x, y = o.y;
    if (x == null) [x, y] = this.spawnPoint();
    const zm = 1 + z.id * BAL.zHp;
    // progression dans le temps : PV, dégâts et vitesse montent nettement au fil du monde ;
    // en plus : mondes déjà traversés (S), totems (W, runHp), folie après le chrono (ot, exponentielle)
    let hp = def.hp * 0.3 * (1 + t / 110 + (t / 240) ** 2) * zm * D.hp * B.hp * S.hp * this.runHp * 1.2 ** ot * BAL.hp;
    let dmg = def.atk * 0.8 * (0.85 + t / 300 + (t / 260) ** 2) * (1 + z.id * BAL.zDmg) * D.dmg * B.dmg * S.dmg * W.dmg * 1.2 ** ot * BAL.dmg;
    let scale = 2.2, speed = (SPEED[def.body] || 60) * (1 + z.id * 0.04) * D.speed * (1 + Math.min(0.22, t / 800)) * W.speed * Math.min(1.35, 1 + 0.06 * ot) * rand(0.9, 1.1);
    if (o.elite) { hp *= 12; dmg *= 1.6; scale = 3.6; speed *= 0.9; }
    if (o.mini) { hp *= 3.4; dmg *= 1.15; scale = 4.7; speed *= 0.95; }
    if (o.boss) {
      hp = Math.max(def.hp, 165) * BAL.bossHp * (1 + z.id * BAL.zBoss) * D.boss * S.boss * this.runHp;
      dmg = def.atk * BAL.bossDmg * (1 + z.id * (0.05 + BAL.zDmg)) * D.dmg * S.dmg * W.dmg; scale = 8; speed = (SPEED[def.body] || 60) * (1 + z.id * 0.04) * D.speed;
    }
    if (o.gen) { hp *= 0.32; dmg *= 0.6; scale *= 0.62; speed *= 1.18; } // petit morceau d'un blob divisé
    const e = {
      def, k, x, y, hp, maxHp: hp, dmg, speed, scale, r: 7 * scale,
      elite: !!o.elite, boss: !!o.boss, ranged: def.ranged && !o.boss, shootT: rand(1.5, 3.5), fly: FLYERS[def.body] || 0,
      flash: 0, slow: 0, freeze: 0, kx: 0, ky: 0, hitT: {}, bob: Math.random() * TAU, dead: false, jumpH: 0,
      phase: 'chase', phaseT: 3, dashX: 0, dashY: 0, ang: 0, born: this.time,
      // difficulté : nom affiché (élites), pouvoirs, attaque spéciale en cours (act), recharge (cd)
      name: def.name, mods: null, knockMul: B.knock, act: null, cd: rand(1.5, 4.5), cdMul: 1, burrowed: false, gen: o.gen || 0,
      side: Math.random() < 0.5 ? 1 : -1, sideT: rand(0.5, 2), regen: 0, vamp: false, bomb: false, rage: 0, sumT: 0, enraged: false,
      // expédition : fou (après le chrono), enfermé dans l'arène (boss et ses renforts), phase du boss, invulnérable
      mad: ot > 0, inArena: !!o.inArena, bossPhase: o.boss ? 1 : 0, invuln: 0,
      mini: !!o.mini, ringT: o.mini ? rand(3, 4.5) : 0,
    };
    if (o.elite) this.makeElite(e);
    this.enemies.push(e);
    return e;
  }

  // élite : 1 pouvoir tiré au hasard (2 en Cauchemar), affiché dans son nom
  makeElite(e) {
    const keys = Object.keys(ELITE_MODS), mods = [];
    while (mods.length < Math.min(keys.length, this.diff.mods + (e.mini && this.diff.mods < 2 ? 1 : 0))) {
      const m = keys[Math.floor(Math.random() * keys.length)];
      if (!mods.includes(m)) mods.push(m);
    }
    e.mods = mods;
    e.name = e.def.name + ' ' + mods.map(m => (e.def.f ? ELITE_MODS[m].f : ELITE_MODS[m].name)).join(' et ');
    for (const m of mods) {
      if (m === 'rapide') { e.speed *= 1.55; e.cdMul = 0.6; }
      else if (m === 'blinde') { e.hp *= 1.8; e.maxHp = e.hp; e.knockMul = 0; e.scale *= 1.1; e.r = 7 * e.scale; }
      else if (m === 'vampirique') { e.vamp = true; e.regen = 0.012; }
      else if (m === 'explosif') e.bomb = true;
      else if (m === 'enrage') { e.dmg *= 1.35; e.rage = 1; }
      else if (m === 'invocateur') e.sumT = rand(2, 4);
    }
  }

  // ---------- Autel, arène et boss ----------
  updateAltar(dt) {
    const a = this.altar, p = this.p;
    if (!a || a.used) return;
    const inside = dist2(a, p) < a.R * a.R;
    a.charge = clamp(a.charge + (inside ? dt / 2.5 : -dt / 2), 0, 1);
    if (inside && !a.told) {
      a.told = true;
      const def = this.zone.boss || this.zone.monsters[4];
      this.banner(`<small>Autel du boss</small>Restez dessus pour invoquer ${esc(def.name)}`, 2200, 'small altar');
    }
    if (!inside) a.told = a.charge > 0 ? a.told : false;
    if (a.charge >= 1 && !this.paused) { a.used = true; a.charge = 1; this.summonBoss(a.x, a.y, false); }
  }

  // invoque le boss : l'arène se referme autour de l'autel (ou du joueur quand le chrono est écoulé)
  summonBoss(cx, cy, auto) {
    this.bossSpawned = true;
    const z = this.zone, def = z.boss || z.monsters[4], p = this.p, lim = HALF - 500;
    cx = clamp(cx, -lim, lim); cy = clamp(cy, -lim, lim);
    const A = this.arena = { x: cx, y: cy, R: ARENA_R };
    // le boss surgit de l'autre côté de l'autel
    let dx = cx - p.x, dy = cy - p.y, d = Math.hypot(dx, dy);
    if (d < 20) { const a = Math.random() * TAU; dx = Math.cos(a); dy = Math.sin(a); d = 1; }
    const B = this.boss = this.addEnemy(def, z.boss ? 5 : 4, { boss: true, inArena: true, x: cx + dx / d * 230, y: cy + dy / d * 230 });
    B.phase = 'intro'; B.phaseT = 1.5; B.invuln = 1.5;
    if (this.curse.has('fastboss')) { B.speed *= 1.2; B.bcd = 0.8; } // Abysse : boss furieux
    this.bossT0 = this.time;
    // les monstres présents sont repoussés hors du cercle
    for (const e of this.enemies) {
      if (e.inArena || e.dead) continue;
      const ex = e.x - A.x, ey = e.y - A.y, ed = Math.hypot(ex, ey) || 1;
      if (ed < A.R + e.r + 40) { const m = A.R + e.r * 0.8 + 10; e.x = A.x + ex / ed * m; e.y = A.y + ey / ed * m; e.kx = ex / ed * 300; e.ky = ey / ed * 300; e.act = null; e.burrowed = false; e.jumpH = 0; }
    }
    this.eshots = this.eshots.filter(s => (s.x - A.x) ** 2 + (s.y - A.y) ** 2 > A.R * A.R);
    this.bombs = this.bombs.filter(b => (b.x - A.x) ** 2 + (b.y - A.y) ** 2 > A.R * A.R);
    p.inv = Math.max(p.inv, 1.2);
    this.emit('bossSummon', { x: B.x, y: B.y, auto: !!auto });
    this.emit('arena', { x: A.x, y: A.y, R: A.R });
    this.emit('boss', { e: B });
    const bb = $('#bossbar');
    if (bb) { bb.hidden = false; $('#bossName').innerHTML = `<span class="tag boss">BOSS</span>${esc(def.name)}`; }
    this.banner(`<small>${auto ? 'Le chrono est écoulé : il vient à vous !' : 'Vous l\'avez invoqué…'}</small>${esc(def.name)}<em class="b-title">— ${esc(def.title || 'Le chef de la horde')} —</em>`, 2600, 'boss summon');
    this.burst(B.x, B.y, 50, 0, '#ff3a3a', 6);
    this.fx.push({ type: 'ring', x: A.x, y: A.y, r: A.R, life: 0.7, max: 0.7, color: '#ff4a3a' });
    this.shake = 14;
    sfx('summon'); sfx('boss'); music('boss'); buzz(80);
  }

  // ---------- Ennemis ----------
  updateEnemies(dt) {
    const p = this.p, near = this._near || (this._near = []), mv = this.mv, A = this.arena;
    let acts = 0;
    for (const e of this.enemies) if (e.act && !e.dead && e.act.kind !== 'shoot' && e.act.kind !== 'volley') acts++;
    this.acts = acts;
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.bob += dt * 8;
      e.flash = Math.max(0, e.flash - dt);
      e.slow = Math.max(0, e.slow - dt);
      e.freeze = Math.max(0, e.freeze - dt);
      if (e.invuln > 0) e.invuln -= dt;
      if (e.regen && e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * e.regen * dt);
      const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1, nx = dx / d, ny = dy / d;
      const fury = e.rage && e.hp < e.maxHp * 0.5 ? 1.3 : 1;
      const sp = e.speed * fury * (e.slow ? 0.5 : 1) * (e.freeze ? 0 : 1);
      if (e.boss) this.bossAI(e, dt, nx, ny, d, sp);
      else if (e.freeze) { mv.x = 0; mv.y = 0; }
      else this.enemyAI(e, dt, nx, ny, d, sp);
      let vx = mv.x, vy = mv.y;
      if (!e.burrowed) {
        this.grid.query(e.x, e.y, e.r * 2, near);
        for (const o of near) {
          if (o === e || o.burrowed) continue;
          const ox = e.x - o.x, oy = e.y - o.y, od = Math.hypot(ox, oy), min = (e.r + o.r) * 0.7;
          if (od > 0 && od < min) { const f = (min - od) / od * 0.5; vx += ox * f * 8; vy += oy * f * 8; }
        }
      }
      e.x += (vx + e.kx) * dt; e.y += (vy + e.ky) * dt;
      e.kx *= Math.pow(0.02, dt); e.ky *= Math.pow(0.02, dt);
      if (A) { // l'arène : le boss et ses renforts restent dedans, les autres monstres restent dehors
        const ax = e.x - A.x, ay = e.y - A.y, ad = Math.hypot(ax, ay) || 1;
        if (e.inArena) { const m = A.R - e.r * 0.6; if (ad > m) { e.x = A.x + ax / ad * m; e.y = A.y + ay / ad * m; } }
        else { const m = A.R + e.r * 0.8 + 6; if (ad < m) { e.x = A.x + ax / ad * m; e.y = A.y + ay / ad * m; } }
      }
      const a = e.act, dashing = !!a && a.stage === 1 && (a.kind === 'dash' || a.kind === 'strafe');
      if (!e.freeze) e.ang = dashing && a.kind === 'dash' ? Math.atan2(a.dx, a.dy) : Math.atan2(dx, dy);
      if (!e.boss && !a && d > SPAWN_R * 1.5) { const [nx2, ny2] = this.spawnPoint(); e.x = nx2; e.y = ny2; }
      // contact
      if (e.burrowed) continue;
      if (d < e.r * 0.7 + p.r) this.hurtPlayer(e.dmg * fury * (dashing ? 1.3 : 1), e);
    }
  }

  // annonce une attaque spéciale : les effets visuels peuvent l'afficher pendant `dur` secondes
  tele(e, kind, dur, x, y, dx, dy, R) {
    e.act = { kind, stage: 0, t: dur, dur, x, y, dx, dy, R, go: 0, v: 0 };
    this.emit('enemyTelegraph', { e, kind, x, y, dx, dy, dur, R });
    return e.act;
  }

  // cercle d'alerte au sol (rendu par les anneaux existants : il grandit jusqu'à l'impact)
  warnRing(x, y, R, dur, color = '#ff3a3a') {
    if (this.fx.length < 90) this.fx.push({ type: 'ring', x, y, r: R, life: dur, max: dur, color, warn: true });
  }

  endAct(e, cd) { e.act = null; e.cd = cd ?? rand(3.5, 6) * e.cdMul; }

  // comportements par type de corps
  enemyAI(e, dt, nx, ny, d, sp) {
    const mv = this.mv, p = this.p;
    if (e.act) return this.enemyAct(e, e.act, dt, nx, ny, d, sp);
    const body = e.def.body;
    if (e.mini && (e.ringT -= dt) <= 0 && d < 520) { // le champion lance une couronne de projectiles (annoncée)
      e.ringT = rand(5, 7);
      this.tele(e, 'ring', 0.7, e.x, e.y, 0, 0, 0);
      this.warnRing(e.x, e.y, e.r * 1.6, 0.7, '#c06aff');
      mv.x = 0; mv.y = 0;
      return;
    }
    let vx = nx * sp, vy = ny * sp;
    if (body === 'crab') { // les crabes filent de côté en zigzag
      e.sideT -= dt;
      if (e.sideT <= 0) { e.side = -e.side; e.sideT = rand(1.1, 2.2); }
      const lat = d < 420 ? 1 : 0.35;
      vx = (nx * 0.72 - ny * e.side * lat) * sp; vy = (ny * 0.72 + nx * e.side * lat) * sp;
    }
    if (e.ranged && d < 220) { vx = -nx * sp * 0.4; vy = -ny * sp * 0.4; }
    mv.x = vx; mv.y = vy;
    if (e.ranged) {
      e.shootT -= dt;
      if (e.shootT <= 0 && d < 430 && body === 'golem') { // obus de mortier : la zone d'impact est signalée
        if (this.acts >= 3 + this.zone.id + this.diffId * 2) { e.shootT = rand(0.4, 0.9); return; }
        this.tele(e, 'mortar', 0.5, p.x, p.y, nx, ny, 58);
        this.acts++;
        mv.x = 0; mv.y = 0;
        return;
      }
      if (e.shootT <= 0 && d < 430) {
        const volley = body === 'humanoid';
        this.tele(e, volley ? 'volley' : 'shoot', volley ? 0.55 : 0.4, e.x, e.y, nx, ny, 0);
        mv.x = 0; mv.y = 0;
        return;
      }
    }
    if (e.sumT) {
      e.sumT -= dt;
      if (e.sumT <= 0) {
        if (d < 650) { this.tele(e, 'summon', 0.7, e.x, e.y, 0, 0, 80); this.warnRing(e.x, e.y, 80, 0.7, '#c06aff'); return; }
        e.sumT = 1;
      }
    }
    e.cd -= dt;
    if (e.cd > 0) return;
    const maxActs = 3 + this.zone.id + this.diffId * 2 + (e.elite ? 2 : 0);
    if (this.acts >= maxActs) { e.cd = rand(0.3, 0.8); return; }
    switch (body) {
      case 'beast': case 'bird': { // élan : charge en ligne droite vers le joueur
        if (d < 100 || d > (body === 'bird' ? 340 : 310)) break;
        const len = d + 20, a = this.tele(e, 'dash', (body === 'bird' ? 0.55 : 0.65) * (e.cdMul < 1 ? 0.85 : 1), e.x, e.y, nx, ny, len);
        a.go = 0.42; a.v = Math.min(680, Math.max(300, len / a.go)) * (e.cdMul < 1 ? 1.15 : 1);
        this.acts++;
        return;
      }
      case 'humanoid': { // corps à corps : bond court (les élites chargent de plus loin)
        if (e.ranged) break;
        const max = e.elite ? 300 : 150;
        if (d < 50 || d > max) break;
        const len = d + 10, a = this.tele(e, 'dash', e.elite ? 0.65 : 0.5, e.x, e.y, nx, ny, len);
        a.go = e.elite ? 0.42 : 0.28; a.v = Math.min(620, Math.max(260, len / a.go));
        this.acts++;
        return;
      }
      case 'crab': { // pas chassé rapide sur le côté
        if (d < 60 || d > 260) break;
        let sx = -ny * e.side + nx * 0.5, sy = nx * e.side + ny * 0.5;
        const l = Math.hypot(sx, sy) || 1; sx /= l; sy /= l;
        const a = this.tele(e, 'strafe', 0.45, e.x, e.y, sx, sy, 130);
        a.go = 0.32; a.v = 400;
        this.acts++;
        return;
      }
      case 'ghost': { // se téléporte près du joueur (le point d'arrivée est signalé) ; pas à travers le mur de l'arène
        if (d < 230 || d > 760 || (this.arena && !e.inArena)) break;
        const ang = Math.atan2(p.face.y, p.face.x) + rand(-0.9, 0.9), R = e.ranged ? 230 : 75 + e.r;
        const lim = HALF - 120;
        const tx = Math.max(-lim, Math.min(lim, p.x + Math.cos(ang) * R)), ty = Math.max(-lim, Math.min(lim, p.y + Math.sin(ang) * R));
        this.tele(e, 'blink', 0.8, tx, ty, (p.x - tx) / R, (p.y - ty) / R, e.r * 1.4);
        this.warnRing(tx, ty, e.r * 1.6, 0.8, '#b07aff');
        this.acts++;
        return;
      }
      case 'worm': { // s'enfouit, file sous terre et ressurgit sous le joueur
        if (d < 100 || d > 650 || (this.arena && !e.inArena)) break;
        e.act = { kind: 'burrow', stage: 0, t: 0.35, dur: 0.35, x: e.x, y: e.y, dx: nx, dy: ny, R: 55 + e.r * 0.6, go: 0, v: 0 };
        e.burrowed = true;
        this.emit('burrow', { e, x: e.x, y: e.y });
        this.burst(e.x, e.y, 8, 0, e.def.pal[1], 2);
        this.acts++;
        return;
      }
      case 'golem': { // les golems d'élite frappent le sol : onde de choc à fuir (portée limitée)
        if (!e.elite || d > 125) break;
        this.tele(e, 'stomp', 1.1, e.x, e.y, 0, 0, 150 + e.r); // le temps de sortir du cercle
        this.warnRing(e.x, e.y, e.r * 1.6, 1, '#ff7a3a');
        this.acts++;
        return;
      }
    }
    e.cd = rand(0.3, 0.6);
  }

  enemyAct(e, a, dt, nx, ny, d, sp) {
    const mv = this.mv, p = this.p;
    a.t -= dt; mv.x = 0; mv.y = 0;
    if (a.stage === 0 && a.kind !== 'burrow' && (a.t * 10 | 0) % 2 === 0) e.flash = Math.max(e.flash, 0.04); // clignote pendant l'alerte
    switch (a.kind) {
      case 'dash': case 'strafe':
        if (a.stage === 0) { if (a.t <= 0) { a.stage = 1; a.t = a.go; this.emit('enemyDash', { e, dx: a.dx, dy: a.dy }); } }
        else if (a.stage === 1) { mv.x = a.dx * a.v; mv.y = a.dy * a.v; if (a.t <= 0) { a.stage = 2; a.t = a.kind === 'strafe' ? 0.3 : 0.6; } }
        else { mv.x = nx * sp * 0.25; mv.y = ny * sp * 0.25; if (a.t <= 0) this.endAct(e, a.kind === 'strafe' ? rand(2.8, 4.5) * e.cdMul : undefined); }
        return;
      case 'volley': case 'shoot':
        if (a.t <= 0) { this.enemyFire(e, a); this.endAct(e, e.cd); e.shootT = rand(2.6, 3.6); }
        return;
      case 'mortar':
        if (a.t <= 0) {
          const lead = p.moving ? 40 : 0;
          this.addBomb({ x: p.x + p.face.x * lead + rand(-20, 20), y: p.y + p.face.y * lead + rand(-20, 20), R: a.R, t: 1.1, dmg: e.dmg * 1.3, kind: 'mortar', e });
          this.burst(e.x, e.y, 6, 30, '#ffd0a0', 2);
          sfx('boom');
          this.endAct(e, e.cd); e.shootT = rand(3.2, 4.4);
        }
        return;
      case 'blink':
        if (a.stage === 0) {
          if (a.t <= 0) {
            const fx = e.x, fy = e.y;
            e.x = a.x; e.y = a.y; e.kx = 0; e.ky = 0;
            this.emit('blink', { e, fromX: fx, fromY: fy, x: a.x, y: a.y });
            this.burst(fx, fy, 8, e.fly, e.def.pal[2], 2); this.burst(a.x, a.y, 10, e.fly, e.def.pal[0], 2);
            a.stage = 1; a.t = 0.35;
          }
        } else if (a.t <= 0) this.endAct(e, rand(5.5, 8.5) * e.cdMul);
        return;
      case 'burrow':
        if (a.stage === 0) { e.jumpH = -170 * (1 - Math.max(0, a.t) / 0.35); if (a.t <= 0) { a.stage = 1; a.t = 0.7; } }
        else if (a.stage === 1) {
          e.jumpH = -170; mv.x = nx * 260; mv.y = ny * 260;
          if (a.t <= 0 && this.arena && !e.inArena) { e.burrowed = false; e.jumpH = 0; this.endAct(e); return; } // l'arène bloque
          if (a.t <= 0) {
            a.stage = 2; a.t = 1.1; a.x = p.x; a.y = p.y;
            this.emit('enemyTelegraph', { e, kind: 'emerge', x: a.x, y: a.y, dx: 0, dy: 0, dur: 1.1, R: a.R });
            this.warnRing(a.x, a.y, a.R, 1.1);
          }
        } else if (a.stage === 2) {
          e.jumpH = -170;
          const k = Math.min(1, dt * 6); e.x += (a.x - e.x) * k; e.y += (a.y - e.y) * k;
          if (a.t <= 0) {
            e.x = a.x; e.y = a.y; e.burrowed = false; e.jumpH = 0; e.born = this.time;
            const hit = Math.hypot(p.x - a.x, p.y - a.y) < a.R + p.r * 0.5;
            if (hit) this.hurtPlayer(e.dmg * 1.5, e);
            this.emit('emerge', { e, x: a.x, y: a.y, R: a.R, hit });
            this.burst(a.x, a.y, 16, 0, e.def.pal[1], 3);
            this.shake = Math.max(this.shake, 4);
            a.stage = 3; a.t = 0.5;
          }
        } else if (a.t <= 0) this.endAct(e, rand(6, 9) * e.cdMul);
        return;
      case 'stomp':
        if (a.t <= 0) {
          this.waves.push({ x: e.x, y: e.y, r: e.r, max: a.R, speed: 300, dmg: e.dmg * 0.9, hit: false });
          this.emit('enemyStomp', { e, x: e.x, y: e.y, R: a.R });
          this.burst(e.x, e.y, 16, 0, e.def.pal[1], 3);
          this.shake = Math.max(this.shake, 6); sfx('stomp');
          this.endAct(e, rand(4, 6) * e.cdMul);
        }
        return;
      case 'ring':
        if (a.t <= 0) {
          const n = 12 + this.zone.id * 2, off = Math.random();
          for (let i = 0; i < n && this.eshots.length < 220; i++) {
            const an = (i + off) / n * TAU;
            this.eshots.push({ x: e.x, y: e.y, z: 30, vx: Math.cos(an) * 150, vy: Math.sin(an) * 150, r: 9, dmg: e.dmg * 0.45, life: 4.5 });
          }
          this.burst(e.x, e.y, 14, 20, '#c06aff', 3);
          sfx('zap');
          this.endAct(e, e.cd);
        }
        return;
      case 'summon':
        if (a.t <= 0) {
          const mons = this.zone.monsters;
          for (let i = 0; i < 3 && this.enemies.length < HARD_CAP; i++) {
            const an = i / 3 * TAU + Math.random(), kk = Math.floor(Math.random() * 4);
            this.addEnemy(mons[kk], kk, { x: e.x + Math.cos(an) * 60, y: e.y + Math.sin(an) * 60, inArena: e.inArena });
          }
          this.burst(e.x, e.y, 16, 20, '#c06aff', 3);
          e.sumT = rand(6, 8);
          this.endAct(e, e.cd);
        }
        return;
    }
    this.endAct(e);
  }

  // tirs : salves en éventail pour les humanoïdes à distance, tirs simples pour les autres
  enemyFire(e, a) {
    const p = this.p, volley = a.kind === 'volley';
    const n = volley ? 3 + (e.elite ? 2 : 0) + (this.diffId >= 2 ? 1 : 0) : 1 + (e.elite ? 1 : 0);
    const base = Math.atan2(p.y - e.y, p.x - e.x), spread = volley ? 0.22 : 0.14;
    for (let i = 0; i < n && this.eshots.length < 220; i++) {
      const ang = base + (i - (n - 1) / 2) * spread;
      this.eshots.push({ x: e.x, y: e.y, z: 20 + e.fly, vx: Math.cos(ang) * 165, vy: Math.sin(ang) * 165, r: 8, dmg: e.dmg * (volley ? 0.6 : 0.8), life: 4 });
    }
  }

  // ---------- Boss ----------
  bossAI(e, dt, nx, ny, d, sp) {
    const mv = this.mv, p = this.p, rage = e.enraged, cdm = (rage ? 0.6 : e.bossPhase >= 2 ? 0.85 : 1) * (e.bcd || 1);
    e.phaseT -= dt;
    mv.x = nx * sp; mv.y = ny * sp;
    if (e.ring2 > 0) { e.ring2 -= dt; if (e.ring2 <= 0) this.bossRing(e, 0.5); }
    // phases : 2 sous 60 % de PV (rugissement), 3 sous 30 % (rage) ; seulement entre deux attaques
    if (e.phase === 'chase' || e.phase === 'rainW') {
      if (e.bossPhase < 2 && e.hp < e.maxHp * 0.6) return this.bossPhase2(e);
      if (e.bossPhase === 2 && e.hp < e.maxHp * 0.3) { this.enrage(e); }
    }
    switch (e.phase) {
      case 'chase':
        if (e.phaseT <= 0) this.bossPick(e, nx, ny, d);
        return;
      case 'intro': case 'roar': // apparition / changement de phase : il rugit sur place, invulnérable
        mv.x = 0; mv.y = 0;
        if ((e.phaseT * 8 | 0) % 2 === 0) e.flash = Math.max(e.flash, 0.04);
        if (e.phaseT <= 0) {
          const roar = e.phase === 'roar';
          if (roar) { this.bossRing(e, 0); this.shake = Math.max(this.shake, 8); }
          e.phase = 'chase'; e.phaseT = roar ? 0.6 : rand(0.8, 1.4);
        }
        return;
      case 'sweepW': // le rayon se charge : la ligne de départ est annoncée
        mv.x = 0; mv.y = 0;
        if ((e.phaseT * 10 | 0) % 2 === 0) e.flash = Math.max(e.flash, 0.04);
        if (e.phaseT <= 0) {
          e.phase = 'sweep'; e.phaseT = e.sweepDur;
          this.emit('bossSweep', { e });
          sfx('charge'); this.shake = Math.max(this.shake, 6);
        }
        return;
      case 'sweep': { // rayon tournant : on s'en sort en s'éloignant du boss (portée limitée)
        mv.x = 0; mv.y = 0;
        e.sweepA += e.sweepDir * SWEEP_ARC / e.sweepDur * dt;
        const cx = Math.cos(e.sweepA), cy = Math.sin(e.sweepA), dx = p.x - e.x, dy = p.y - e.y, along = dx * cx + dy * cy;
        if (along > 0 && along < e.sweepLen && Math.abs(dy * cx - dx * cy) < e.sweepW / 2 + p.r * 0.6) this.hurtPlayer(e.dmg * 0.7, e);
        if (e.phaseT <= 0) {
          if (--e.sweeps > 0) { e.sweepDir = -e.sweepDir; e.phaseT = e.sweepDur; this.emit('bossSweep', { e }); }
          else { e.phase = 'chase'; e.phaseT = rand(1.8, 2.8) * cdm; }
        }
        return;
      }
      case 'aim':
        mv.x = 0; mv.y = 0;
        if ((e.phaseT * 10 | 0) % 2 === 0) e.flash = Math.max(e.flash, 0.04);
        if (e.phaseT <= 0) { e.phase = 'dash'; e.phaseT = 0.6; sfx('charge'); this.emit('bossDash', { e }); }
        return;
      case 'dash': {
        const v = 560 * (rage ? 1.2 : 1);
        mv.x = e.dashX * v; mv.y = e.dashY * v;
        if (e.phaseT <= 0) {
          if (e.dashes > 1) { e.dashes--; this.bossAim(e, nx, ny, 0.5); }
          else { e.phase = 'chase'; e.phaseT = rand(2.2, 3.4) * cdm; }
        }
        return;
      }
      case 'stomp': {
        const k = 1 - Math.max(0, e.phaseT) / 1.05;
        e.jumpH = Math.sin(k * Math.PI) * 140;
        mv.x *= 0.6; mv.y *= 0.6;
        if (e.phaseT <= 0) {
          e.jumpH = 0; e.phase = 'chase'; e.phaseT = rand(2.5, 3.8) * cdm;
          this.waves.push({ x: e.x, y: e.y, r: e.r, max: BOSS_WAVE, speed: 300, dmg: e.dmg * 0.6, hit: false });
          if (rage) this.waves.push({ x: e.x, y: e.y, r: e.r * 0.5, max: BOSS_WAVE * 0.75, speed: 200, dmg: e.dmg * 0.6, hit: false }); // 2e onde, plus lente
          this.emit('bossStomp', { e, x: e.x, y: e.y });
          this.shake = 12; sfx('stomp'); buzz(50);
          this.burst(e.x, e.y, 30, 0, e.def.pal[1], 4);
        }
        return;
      }
      case 'ringW':
        mv.x = 0; mv.y = 0;
        if ((e.phaseT * 10 | 0) % 2 === 0) e.flash = Math.max(e.flash, 0.04);
        if (e.phaseT <= 0) { this.bossRing(e, 0); if (rage) e.ring2 = 0.45; e.phase = 'chase'; e.phaseT = rand(2.4, 3.6) * cdm; }
        return;
      case 'spiral': { // tourbillon de projectiles
        mv.x = 0; mv.y = 0;
        if (e.spinUp > 0) { e.spinUp -= dt; if ((e.spinUp * 10 | 0) % 2 === 0) e.flash = Math.max(e.flash, 0.04); return; }
        e.spT -= dt;
        while (e.spT <= 0) {
          e.spT += rage ? 0.075 : 0.1; e.spA += 0.33;
          const arms = rage ? 3 : 2;
          for (let i = 0; i < arms && this.eshots.length < 220; i++) {
            const an = e.spA + i / arms * TAU;
            this.eshots.push({ x: e.x, y: e.y, z: 40, vx: Math.cos(an) * 150, vy: Math.sin(an) * 150, r: 9, dmg: e.dmg * 0.55, life: 5 });
          }
        }
        if (e.phaseT <= 0) { e.phase = 'chase'; e.phaseT = rand(2.4, 3.4) * cdm; }
        return;
      }
      case 'rainW': // pluie de météores : le boss avance lentement pendant qu'ils tombent
        mv.x *= 0.5; mv.y *= 0.5;
        if (e.phaseT <= 0) { e.phase = 'chase'; e.phaseT = rand(1.8, 2.8) * cdm; }
        return;
      case 'blinkW':
        mv.x = 0; mv.y = 0;
        if (e.phaseT <= 0) {
          const fx = e.x, fy = e.y;
          e.x = e.bx; e.y = e.by; e.kx = 0; e.ky = 0;
          this.emit('blink', { e, fromX: fx, fromY: fy, x: e.x, y: e.y });
          this.burst(fx, fy, 24, 40, e.def.pal[2], 5); this.burst(e.x, e.y, 24, 40, e.def.pal[0], 5);
          this.bossRing(e, 0.25, 0.6);
          e.phase = 'chase'; e.phaseT = rand(2.2, 3.2) * cdm;
        }
        return;
      case 'burrow': { // le boss s'enfouit et ressurgit sous le joueur
        mv.x = 0; mv.y = 0;
        if (e.bst === 0) { e.jumpH = -260 * (1 - Math.max(0, e.phaseT) / 0.5); if (e.phaseT <= 0) { e.bst = 1; e.phaseT = 0.8; } }
        else if (e.bst === 1) {
          e.jumpH = -260; mv.x = nx * 380; mv.y = ny * 380;
          if (e.phaseT <= 0) {
            e.bst = 2; e.phaseT = 1.15; e.bx = p.x; e.by = p.y;
            this.emit('enemyTelegraph', { e, kind: 'emerge', x: e.bx, y: e.by, dx: 0, dy: 0, dur: 1.15, R: 125 });
            this.warnRing(e.bx, e.by, 125, 1.15);
          }
        } else {
          e.jumpH = -260;
          const k = Math.min(1, dt * 5); e.x += (e.bx - e.x) * k; e.y += (e.by - e.y) * k;
          if (e.phaseT <= 0) {
            e.x = e.bx; e.y = e.by; e.burrowed = false; e.jumpH = 0; e.born = this.time;
            const hit = Math.hypot(p.x - e.x, p.y - e.y) < 125 + p.r * 0.5;
            if (hit) this.hurtPlayer(e.dmg * 1.5, e);
            this.emit('emerge', { e, x: e.x, y: e.y, R: 125, hit });
            this.burst(e.x, e.y, 40, 0, e.def.pal[1], 6);
            this.shake = 12; sfx('stomp'); buzz(50);
            this.bossRing(e, 0, 0.7);
            e.phase = 'chase'; e.phaseT = rand(2.2, 3.2) * cdm;
          }
        }
        return;
      }
      case 'summonW':
        mv.x = 0; mv.y = 0;
        if (e.phaseT <= 0) { this.bossSummon(e); e.phase = 'chase'; e.phaseT = rand(3, 4.5) * cdm; }
        return;
    }
  }

  // choix de la prochaine attaque du boss (pondéré par son type, sans répéter la même)
  bossPick(e, nx, ny, d) {
    const B = e.def.body, easy = this.zone.id === 0 && this.diffId === 0, p = this.p;
    const W = this._bw || (this._bw = {});
    W.aim = 3; W.stomp = 2.4; W.ring = 2; W.summon = 1.2;
    W.rain = easy ? 0.8 : (B === 'golem' || B === 'worm' || B === 'beast') ? 2 : 1.1;
    W.spiral = easy ? 0 : (B === 'bird' || B === 'ghost' || B === 'worm') ? 2.2 : 0.8;
    W.blink = B === 'ghost' && d > 160 ? 2.6 : 0;
    W.burrow = B === 'worm' ? 2.6 : 0;
    W.sweep = e.bossPhase >= 2 ? (e.enraged ? 3 : 2.6) : 0; // rayon tournant : à partir de la phase 2
    if (e.last) W[e.last] *= 0.25;
    let tot = 0;
    for (const k in W) tot += W[k];
    let x = Math.random() * tot, pick = 'aim';
    for (const k in W) { x -= W[k]; if (x <= 0) { pick = k; break; } }
    e.last = pick;
    switch (pick) {
      case 'aim':
        e.dashes = e.enraged ? 3 : (B === 'beast' || B === 'bird') ? 2 : 1;
        this.bossAim(e, nx, ny, 0.9);
        break;
      case 'stomp':
        e.phase = 'stomp'; e.phaseT = 1.05;
        this.emit('bossJump', { e });
        this.emit('enemyTelegraph', { e, kind: 'stomp', x: e.x, y: e.y, dx: 0, dy: 0, dur: 1.05, R: BOSS_WAVE });
        this.msg('Onde de choc : éloignez-vous du boss !');
        break;
      case 'ring':
        e.phase = 'ringW'; e.phaseT = 0.6;
        this.emit('enemyTelegraph', { e, kind: 'ring', x: e.x, y: e.y, dx: 0, dy: 0, dur: 0.6, R: 0 });
        break;
      case 'spiral':
        e.phase = 'spiral'; e.phaseT = 2.6; e.spinUp = 0.55; e.spA = Math.random() * TAU; e.spT = 0;
        this.emit('enemyTelegraph', { e, kind: 'spiral', x: e.x, y: e.y, dx: 0, dy: 0, dur: 0.55, R: 0 });
        break;
      case 'rain': {
        e.phase = 'rainW'; e.phaseT = 1.7;
        const n = (e.enraged ? 8 : 5) + Math.min(3, this.zone.id), R = 62 + this.zone.id * 3;
        for (let i = 0; i < n; i++) {
          const r = i === 0 ? 0 : rand(60, 230), an = Math.random() * TAU;
          const lead = p.moving && i < 2 ? 80 : 0;
          this.addBomb({ x: p.x + p.face.x * lead + Math.cos(an) * r, y: p.y + p.face.y * lead + Math.sin(an) * r, R, t: 1.05 + i * 0.12, dmg: e.dmg * 0.9, kind: 'meteor', e });
        }
        this.msg('Des rochers tombent : sortez des cercles rouges !');
        break;
      }
      case 'blink': {
        const R = 130 + e.r, an = Math.atan2(-p.face.y, -p.face.x) + rand(-0.6, 0.6), lim = HALF - 150;
        e.bx = Math.max(-lim, Math.min(lim, p.x + Math.cos(an) * R)); e.by = Math.max(-lim, Math.min(lim, p.y + Math.sin(an) * R));
        e.phase = 'blinkW'; e.phaseT = 0.85;
        this.emit('enemyTelegraph', { e, kind: 'blink', x: e.bx, y: e.by, dx: 0, dy: 0, dur: 0.85, R: e.r });
        this.warnRing(e.bx, e.by, e.r * 1.3, 0.85, '#b07aff');
        break;
      }
      case 'burrow':
        e.phase = 'burrow'; e.bst = 0; e.phaseT = 0.5; e.burrowed = true;
        this.emit('burrow', { e, x: e.x, y: e.y });
        this.burst(e.x, e.y, 30, 0, e.def.pal[1], 5);
        break;
      case 'summon':
        e.phase = 'summonW'; e.phaseT = 0.6;
        this.emit('enemyTelegraph', { e, kind: 'summon', x: e.x, y: e.y, dx: 0, dy: 0, dur: 0.6, R: 90 });
        this.warnRing(e.x, e.y, 110, 0.6, '#c06aff');
        break;
      case 'sweep': {
        // rayon tournant de ~200° : il commence loin du joueur et passe sur lui à mi-course (2 passages en phase 3)
        const dir = Math.random() < 0.5 ? 1 : -1, toP = Math.atan2(p.y - e.y, p.x - e.x);
        e.sweepDir = dir; e.sweepA = toP - dir * SWEEP_ARC / 2;
        e.sweepLen = SWEEP_LEN; e.sweepW = 34 + this.zone.id * 2;
        e.sweeps = e.enraged ? 2 : 1; e.sweepDur = e.enraged ? 1.8 : 2.4;
        e.phase = 'sweepW'; e.phaseT = e.enraged ? 0.75 : 0.95;
        this.emit('enemyTelegraph', { e, kind: 'sweep', x: e.x, y: e.y, dx: Math.cos(e.sweepA), dy: Math.sin(e.sweepA), dur: e.phaseT, R: e.sweepLen });
        this.msg('Rayon tournant : éloignez-vous du boss !');
        break;
      }
    }
  }

  // phase 2 : rugissement (invulnérable 1 s), puis attaques plus fréquentes et rayon tournant
  bossPhase2(e) {
    e.bossPhase = 2;
    e.phase = 'roar'; e.phaseT = 1; e.invuln = 1;
    e.speed *= 1.1;
    e.act = null; e.jumpH = 0; e.burrowed = false;
    this.emit('bossPhase', { e, phase: 2 });
    this.banner(`<small>${esc(e.def.name)}</small>Phase 2 : il se déchaîne !`, 1800, 'boss');
    this.fx.push({ type: 'ring', x: e.x, y: e.y, r: 300, life: 0.7, max: 0.7, color: '#ff7a3a' });
    this.burst(e.x, e.y, 40, 40, e.def.pal[2], 5);
    this.shake = 12; sfx('boss'); buzz(60);
  }

  bossAim(e, nx, ny, dur) {
    e.phase = 'aim'; e.phaseT = dur; e.dashX = nx; e.dashY = ny;
    this.emit('bossAim', { e, dx: nx, dy: ny });
    this.emit('enemyTelegraph', { e, kind: 'charge', x: e.x, y: e.y, dx: nx, dy: ny, dur, R: 560 * 0.6 * (e.enraged ? 1.2 : 1) });
  }

  bossRing(e, off = 0, mul = 1) {
    const n = Math.round((14 + this.zone.id * 2) * (e.enraged ? 1.4 : 1) * mul), v = e.enraged ? 175 : 150;
    for (let i = 0; i < n && this.eshots.length < 220; i++) {
      const a = (i + off) / n * TAU;
      this.eshots.push({ x: e.x, y: e.y, z: 40, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: 9, dmg: e.dmg * 0.6, life: 5 });
    }
  }

  bossSummon(e) {
    const mons = this.zone.monsters, n = 5 + this.zone.id + (e.enraged ? 3 : 0);
    for (let i = 0; i < n && this.enemies.length < HARD_CAP; i++) {
      const a = i / n * TAU;
      this.addEnemy(mons[i % 4], i % 4, { x: e.x + Math.cos(a) * 90, y: e.y + Math.sin(a) * 90, inArena: true });
    }
    if (e.enraged && !e.summonedElite && (this.zone.id > 0 || this.diffId > 0 || this.stage > 0)) {
      e.summonedElite = true;
      const el = this.addEnemy(mons[4], 4, { elite: true, x: e.x + 120, y: e.y, inArena: true });
      this.emit('elite', { e: el });
    }
    this.burst(e.x, e.y, 20, 30, '#c06aff', 4);
  }

  // phase 3 (rage) sous 30 % de PV : plus rapide, attaques plus fréquentes et renforcées, rayon double
  enrage(e) {
    e.enraged = true; e.bossPhase = 3;
    e.speed *= 1.3;
    if (e.phase === 'chase') e.phaseT = Math.min(e.phaseT, 0.8);
    this.emit('bossPhase', { e, phase: 3 });
    this.emit('bossEnrage', { e });
    this.banner(`<small>${esc(e.def.name)}</small>entre en rage !`, 1800, 'boss');
    this.fx.push({ type: 'ring', x: e.x, y: e.y, r: 260, life: 0.6, max: 0.6, color: '#ff3a3a' });
    this.burst(e.x, e.y, 40, 40, '#ff3a3a', 5);
    this.shake = 14; sfx('boss'); buzz(60);
  }

  // attaques de zone à retardement : le cercle d'alerte grandit jusqu'à l'impact
  addBomb(b) {
    this.bombs.push(b);
    this.emit('enemyTelegraph', { e: b.e || null, kind: b.kind, x: b.x, y: b.y, dx: 0, dy: 0, dur: b.t, R: b.R });
    this.warnRing(b.x, b.y, b.R, b.t, b.kind === 'explode' ? '#ff7a3a' : '#ff3a3a');
  }

  updateBombs(dt) {
    if (!this.bombs.length) return;
    const p = this.p;
    for (const b of this.bombs) {
      b.t -= dt;
      if (b.t > 0) continue;
      b.done = true;
      const hit = Math.hypot(p.x - b.x, p.y - b.y) < b.R + p.r * 0.5;
      if (hit) this.hurtPlayer(b.dmg, null);
      this.emit(b.kind === 'explode' ? 'explode' : 'impact', { e: b.e || null, x: b.x, y: b.y, R: b.R, hit });
      this.fx.push({ type: 'ring', x: b.x, y: b.y, r: b.R * 1.1, life: 0.3, max: 0.3, color: '#ffc87a' });
      this.burst(b.x, b.y, b.kind === 'explode' ? 26 : 12, 10, b.kind === 'explode' ? '#ff7a3a' : '#ffd0a0', 3);
      this.shake = Math.max(this.shake, b.kind === 'explode' ? 8 : 4);
      sfx('boom');
    }
    this.bombs = this.bombs.filter(b => !b.done);
  }

  updateWaves(dt) {
    const p = this.p;
    for (const w of this.waves) {
      w.r += w.speed * dt;
      const d = Math.hypot(p.x - w.x, p.y - w.y);
      if (!w.hit && Math.abs(d - w.r) < 26) { w.hit = true; this.hurtPlayer(w.dmg); }
    }
    this.waves = this.waves.filter(w => w.r < w.max);
  }

  hurtPlayer(dmg, src) {
    const p = this.p;
    if (p.inv > 0 || this.over || this.dying) return;
    // Esquive (équipement) : le coup est ignoré
    if (this.it.dodge && Math.random() < this.it.dodge) {
      p.inv = 0.3;
      this.text(p.x, p.y, 62, 'Esquive !', '#9ae8ff', 1.15);
      this.emit('dodge', { x: p.x, y: p.y });
      sfx('swish');
      return;
    }
    if (src && !src.dead) {
      if (save.pet === 'brambi') this.hitEnemy(src, p.atk * 1.2, { noCrit: true, color: '#ff9a3a' });
      if (this.it.thorns && !src.dead) this.hitEnemy(src, p.atk * this.it.thorns, { noCrit: true, quiet: true, color: '#c8ff7a' }); // Épines
    }
    if (p.aegis > 0) { // bonus Égide : bloque les premiers coups
      p.aegis--; p.inv = 0.5;
      this.fx.push({ type: 'ring', x: p.x, y: p.y, r: 46, life: 0.45, max: 0.45, color: '#ffd54a' });
      this.emit('block', { x: p.x, y: p.y, aegis: p.aegis });
      sfx('block'); this.renderLoadout();
      if (!p.aegis) this.msg('L\'Égide est épuisée !');
      return;
    }
    if (p.shieldHit) { p.shieldHit = 0; p.inv = 0.5; this.fx.push({ type: 'ring', x: p.x, y: p.y, r: 40, life: 0.4, max: 0.4, color: '#a8d8ff' }); sfx('block'); return; }
    const d = Math.max(1, Math.round(dmg * (1 - p.armor)));
    p.hp -= d;
    this.track.hits++; this.track.dmgTaken += Math.min(d, p.hp + d);
    p.inv = 0.45;
    this.endCombo(true);
    if (src && src.vamp && !src.dead) { // élite vampirique : se soigne en frappant
      const h = Math.round(src.maxHp * 0.12);
      src.hp = Math.min(src.maxHp, src.hp + h);
      this.text(src.x, src.y, src.r * 2.4 + src.fly, '+' + fmt(h), '#5ae87a', 1.1);
    }
    this.emit('hurt', { x: p.x, y: p.y, dmg: d, src: src || null });
    if (d >= p.maxHp * 0.08) this.hitStop = Math.max(this.hitStop, 0.05);
    this.shake = 6;
    this.hurtFlash = 0.25;
    this.text(p.x, p.y, 60, '-' + d, '#ff6a6a', 1.1);
    sfx('hurt'); buzz(30);
    if (p.hp <= 0) { p.hp = 0; this.die(); }
  }

  // ---------- Armes ----------
  // Cible principale (visée automatique) : le boss à portée, sinon un élite proche, sinon la menace la plus proche,
  // avec un léger biais vers la direction de course ; on garde la cible actuelle tant qu'elle reste presque aussi bonne.
  updateTarget() {
    const p = this.p, B = this.boss, R = 470;
    if (B && !B.dead && !B.burrowed && dist2(B, p) < (R + B.r) ** 2) { this.target = B; return; }
    const mv = p.moving, fx = p.face.x, fy = p.face.y;
    const score = e => {
      const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy);
      if (d > R + e.r) return Infinity;
      let s = d;
      if (mv && d > 1) s *= 1 - 0.22 * (dx * fx + dy * fy) / d;
      if (e.elite) s = s * 0.4 - 80;                 // élites (et champion) prioritaires
      if (e.act && e.act.stage === 0) s -= 25;       // il prépare une attaque
      return s;
    };
    let best = null, bs = Infinity;
    for (const e of this.enemies) {
      if (e.dead || e.burrowed || e.boss) continue;
      const s = score(e);
      if (s < bs) { bs = s; best = e; }
    }
    const cur = this.target;
    if (cur && cur !== best && !cur.dead && !cur.burrowed && !cur.boss && score(cur) <= bs + 30) best = cur;
    this.target = best;
  }

  // cible d'une arme de portée maxD : la cible principale si elle est à portée, sinon le plus proche
  aim(maxD) {
    const t = this.target;
    if (t && !t.dead && !t.burrowed && dist2(t, this.p) < (maxD + t.r) ** 2) return t;
    return this.nearest(maxD);
  }

  nearest(maxD = 400, from = this.p) {
    const B = this.boss;
    if (B && !B.dead && !B.burrowed && dist2(B, from) < (maxD + B.r) ** 2) return B;
    let best = null, bd = maxD * maxD;
    for (const e of this.enemies) { if (e.dead || e.burrowed) continue; const d = dist2(e, from); if (d < bd) { bd = d; best = e; } }
    return best;
  }

  onScreen() {
    const p = this.p;
    return this.enemies.filter(e => !e.dead && !e.burrowed && dist2(e, p) < VIEW_R * VIEW_R);
  }

  updateWeapons(dt) {
    const p = this.p;
    for (const w of p.weapons) {
      this.curW = w.id;
      const S = this.wstats(w.id, w.lv, p, w), E = w.evo;
      w.t -= dt; w.a += dt;
      switch (w.id) {
        case 'beam': {
          if (w.t > 0) break;
          const t = this.aim(360); if (!t) { w.t = 0.2; break; }
          w.t = S.cd;
          const ang = Math.atan2(t.y - p.y, t.x - p.x);
          // évolué (Prisme solaire) : 4 rayons en croix
          for (let i = 0; i < S.n; i++) this.beam(p.x, p.y, ang + i * TAU / S.n, S.len, S.w, S.dmg);
          if (E) this.fx.push({ type: 'ring', x: p.x, y: p.y, r: 70, life: 0.25, max: 0.25, color: '#fff0a0' });
          sfx('zap');
          break;
        }
        case 'arrows': {
          if (w.t > 0) break;
          const t = this.aim(440); if (!t) { w.t = 0.2; break; }
          w.t = S.cd;
          const ang = Math.atan2(t.y - p.y, t.x - p.x);
          for (let i = 0; i < S.n; i++) {
            const a = ang + (i - (S.n - 1) / 2) * (E ? 0.12 : 0.16);
            if (i === 0) sfx('pew');
            this.shots.push({ type: 'arrow', x: p.x, y: p.y, z: 30, vx: Math.cos(a) * 560, vy: Math.sin(a) * 560, r: 8, dmg: S.dmg, pierce: S.pierce, life: 0.9, hit: new Set() });
          }
          // évoluée (Pluie de flèches) : une salve sur 3 tire aussi une flèche de cristal géante
          if (E && (w.vol = (w.vol || 0) + 1) % 3 === 0) this.shots.push({ type: 'crystal', x: p.x, y: p.y, z: 30, vx: Math.cos(ang) * 760, vy: Math.sin(ang) * 760, r: 24, dmg: S.big, pierce: 999, life: 0.85, hit: new Set(), evo: true });
          break;
        }
        case 'sword': {
          if (w.t > 0) break;
          const R = S.R;
          const tg = this.aim(R + 70);
          if (!tg) { w.t = 0.15; break; }
          w.t = S.cd;
          const base = Math.atan2(tg.y - p.y, tg.x - p.x);
          // évoluée (Tourbillon du Titan) : 3 coups qui couvrent tout le tour, une onde dorée, gros recul
          for (let i = 0; i < S.n; i++) {
            const a = base + i * TAU / S.n;
            this.fx.push({ type: 'slash', x: p.x, y: p.y, a, r: R, life: 0.22, max: 0.22 });
            for (const e of this.grid.query(p.x, p.y, R + 40)) {
              const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy);
              if (d > R + e.r) continue;
              let da = Math.atan2(dy, dx) - a; da = Math.atan2(Math.sin(da), Math.cos(da));
              if (Math.abs(da) < (E ? TAU / S.n / 2 + 0.02 : 1.25) || d < 26) this.hitEnemy(e, S.dmg, { knock: E ? 340 : 260, kx: dx / (d || 1), ky: dy / (d || 1) });
            }
          }
          if (E) this.fx.push({ type: 'ring', x: p.x, y: p.y, r: R, life: 0.3, max: 0.3, color: '#ffd54a' });
          sfx('swish');
          break;
        }
        case 'orbs': {
          const R = S.R;
          w.orbs = [];
          // évolués (Galaxie spirituelle) : 4 orbes sur un anneau intérieur, les autres dehors en sens contraire
          const nIn = E ? 4 : 0;
          for (let i = 0; i < S.n; i++) {
            const inner = i < nIn, k = inner ? i / nIn : (i - nIn) / (S.n - nIn), r = inner ? R * 0.55 : R;
            const a = (inner ? -w.a * 3.6 : w.a * 3) + k * TAU, ox = p.x + Math.cos(a) * r, oy = p.y + Math.sin(a) * r;
            w.orbs.push([ox, oy]);
            for (const e of this.grid.query(ox, oy, 40)) {
              if ((e.x - ox) ** 2 + (e.y - oy) ** 2 > (e.r + 12) ** 2) continue;
              if ((e.hitT.orb || 0) > this.time) continue;
              e.hitT.orb = this.time + S.cd;
              this.hitEnemy(e, S.dmg, { knock: 120, kx: (e.x - p.x) / r, ky: (e.y - p.y) / r });
            }
          }
          break;
        }
        case 'aura': {
          w.R = S.R;
          if (w.t > 0) break;
          w.t = S.cd;
          let burnt = 0;
          for (const e of this.grid.query(p.x, p.y, w.R + 30)) if (dist2(e, p) < (w.R + e.r * 0.6) ** 2) { this.hitEnemy(e, S.dmg, { quiet: true, color: '#ffb04a' }); burnt++; }
          // évoluée (Cœur de soleil) : chaque brûlure soigne un peu (plafond commun avec le vol de vie)
          if (E && burnt) this.lsPool += Math.min(12, burnt) * p.maxHp * 0.0025;
          break;
        }
        case 'lightning': {
          if (w.t > 0) break;
          w.t = S.cd;
          const targets = this.onScreen();
          for (let i = 0; i < S.n && targets.length; i++) {
            // la cible principale d'abord (boss, élite…), puis au hasard
            const ti = i === 0 && this.target && targets.includes(this.target) ? targets.indexOf(this.target) : Math.floor(Math.random() * targets.length);
            const t = targets.splice(ti, 1)[0];
            this.fx.push({ type: 'bolt', x: t.x, y: t.y, life: 0.25, max: 0.25 });
            for (const e of this.grid.query(t.x, t.y, S.R + 14)) if (dist2(e, t) < S.R ** 2) this.hitEnemy(e, S.dmg, {});
            if (E) { // évoluée (Tempête divine) : l'éclair rebondit sur 2 voisins
              let n = 0;
              for (const o of this.grid.query(t.x, t.y, 170)) {
                if (n >= 2 || o === t || o.dead || o.burrowed || dist2(o, t) < S.R ** 2) continue;
                n++; this.fx.push({ type: 'bolt', x: o.x, y: o.y, life: 0.22, max: 0.22 });
                this.hitEnemy(o, S.dmg * 0.6, { color: '#fff07a' });
              }
            }
          }
          sfx('thunder');
          break;
        }
        case 'boomerang': {
          if (w.t > 0) break;
          const t = this.aim(420);
          w.t = S.cd;
          const base = t ? Math.atan2(t.y - p.y, t.x - p.x) : Math.atan2(p.face.y, p.face.x);
          for (let i = 0; i < S.n; i++) {
            const a = base + i / S.n * TAU;
            this.shots.push({ type: 'boom', x: p.x, y: p.y, z: 26, vx: Math.cos(a) * 440, vy: Math.sin(a) * 440, r: S.R, dmg: S.dmg, pierce: 999, life: 2.2, t0: 0, rehit: 0.35, spin: 0, id: Math.random() });
          }
          break;
        }
        case 'shrooms': {
          if (w.t > 0) break;
          w.t = S.cd;
          for (let i = 0; i < S.n; i++) {
            if (this.mines.length > 14) this.mines.shift();
            const a = Math.random() * TAU, r = rand(20, 80);
            this.mines.push({ x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r, life: 12, arm: 0.5, R: S.R, dmg: S.dmg });
          }
          break;
        }
        case 'frost': {
          if (w.t > 0) break;
          sfx('freeze');
          w.t = S.cd;
          const R = S.R;
          this.fx.push({ type: 'ring', x: p.x, y: p.y, r: R, life: 0.45, max: 0.45, color: '#9ad8ff' });
          if (E) this.fx.push({ type: 'ring', x: p.x, y: p.y, r: R * 0.6, life: 0.6, max: 0.6, color: '#ffffff' });
          for (const e of this.grid.query(p.x, p.y, R + 30)) if (dist2(e, p) < (R + e.r * 0.5) ** 2) {
            this.hitEnemy(e, S.dmg, { color: '#9ad8ff' });
            e.slow = 2; if (S.freeze && !e.boss) e.freeze = S.freeze;
          }
          break;
        }
        case 'daggers': {
          if (w.t > 0) break;
          w.t = S.cd;
          w.rot = (w.rot || 0) + 0.4;
          sfx('swish');
          for (let i = 0; i < S.n; i++) {
            const a = w.rot + i / S.n * TAU;
            this.shots.push({ type: 'dagger', x: p.x, y: p.y, z: 26, vx: Math.cos(a) * S.v, vy: Math.sin(a) * S.v, r: 8, dmg: S.dmg, pierce: S.pierce, life: 0.75, hit: new Set(), ls: S.ls });
          }
          break;
        }
        case 'snowball': {
          if (w.t > 0) break;
          w.t = S.cd;
          const targets = this.onScreen();
          for (let i = 0; i < S.n; i++) {
            const t = targets.length ? targets[Math.floor(Math.random() * targets.length)] : null;
            const tx = t ? t.x : p.x + rand(-150, 150), ty = t ? t.y : p.y + rand(-150, 150);
            this.shots.push({ type: 'snow', x: p.x, y: p.y, sx: p.x, sy: p.y, tx, ty, t: 0, dur: 0.6, z: 0, r: 0, R: S.R, dmg: S.dmg, life: 1, freeze: S.freeze || 0 });
          }
          break;
        }
      }
    }
    this.curW = 'shrooms';
    for (const m of this.mines) {
      m.arm -= dt; m.life -= dt;
      if (m.arm > 0) continue;
      const hit = this.grid.query(m.x, m.y, 40).find(e => !e.dead && !e.burrowed && dist2(e, m) < (e.r + 12) ** 2);
      if (hit) {
        m.life = 0;
        this.fx.push({ type: 'ring', x: m.x, y: m.y, r: m.R, life: 0.35, max: 0.35, color: '#8aff5a' });
        this.burst(m.x, m.y, 14, 0, '#8aff5a');
        for (const e of this.grid.query(m.x, m.y, m.R + 30)) if (dist2(e, m) < (m.R + e.r * 0.5) ** 2) this.hitEnemy(e, m.dmg, { color: '#8aff5a' });
        sfx('boom');
      }
    }
    this.mines = this.mines.filter(m => m.life > 0);
    this.curW = null;
  }

  beam(x, y, a, len, width, dmg) {
    const cx = Math.cos(a), cy = Math.sin(a);
    this.fx.push({ type: 'beam', x, y, a, len, w: width, life: 0.22, max: 0.22 });
    const mx = x + cx * len / 2, my = y + cy * len / 2;
    for (const e of this.grid.query(mx, my, len / 2 + 40)) {
      const dx = e.x - x, dy = e.y - y, along = dx * cx + dy * cy;
      if (along < -10 || along > len) continue;
      if (Math.abs(-dx * cy + dy * cx) < width / 2 + e.r * 0.7) this.hitEnemy(e, dmg, { knock: 60, kx: cx, ky: cy });
    }
  }

  updateShots(dt) {
    const p = this.p, near = [];
    for (const s of this.shots) {
      s.life -= dt;
      this.curW = s.type === 'crystal' ? (s.evo ? 'arrows' : null) : SHOT_W[s.type] || null;
      if (s.type === 'snow') {
        s.t += dt;
        const k = Math.min(1, s.t / s.dur);
        s.x = s.sx + (s.tx - s.sx) * k; s.y = s.sy + (s.ty - s.sy) * k; s.z = 20 + Math.sin(k * Math.PI) * 110;
        if (k >= 1) {
          s.life = 0;
          this.fx.push({ type: 'ring', x: s.tx, y: s.ty, r: s.R, life: 0.35, max: 0.35, color: '#e8f4ff' });
          this.burst(s.tx, s.ty, 12, 0, '#ffffff');
          for (const e of this.grid.query(s.tx, s.ty, s.R + 30)) if ((e.x - s.tx) ** 2 + (e.y - s.ty) ** 2 < (s.R + e.r * 0.5) ** 2) { this.hitEnemy(e, s.dmg, {}); e.slow = 1.5; if (s.freeze && !e.boss) e.freeze = Math.max(e.freeze, s.freeze); }
          sfx('splat');
        }
        continue;
      }
      if (s.type === 'boom') {
        s.t0 += dt; s.spin += dt * 20;
        if (s.t0 > 0.55) {
          const dx = p.x - s.x, dy = p.y - s.y, d = Math.hypot(dx, dy) || 1;
          s.vx += dx / d * 1700 * dt; s.vy += dy / d * 1700 * dt;
          const v = Math.hypot(s.vx, s.vy); if (v > 540) { s.vx *= 540 / v; s.vy *= 540 / v; }
          if (d < 24) s.life = 0;
        }
      }
      s.x += s.vx * dt; s.y += s.vy * dt;
      for (const e of this.grid.query(s.x, s.y, s.r + 50, near)) {
        if (e.dead || e.burrowed) continue;
        if ((e.x - s.x) ** 2 + (e.y - s.y) ** 2 > (e.r + s.r) ** 2) continue;
        if (s.rehit) {
          const key = 'b' + s.id;
          if ((e.hitT[key] || 0) > this.time) continue;
          e.hitT[key] = this.time + s.rehit;
        } else {
          if (s.hit.has(e)) continue;
          s.hit.add(e);
        }
        const v = Math.hypot(s.vx, s.vy) || 1;
        this.hitEnemy(e, s.dmg, { knock: s.big ? 0 : 90, kx: s.vx / v, ky: s.vy / v, ls: s.ls });
        if (s.freeze && !e.boss) e.freeze = 2;
        if (s.pierce-- <= 0) { s.life = 0; break; }
      }
    }
    this.curW = null;
    this.shots = this.shots.filter(s => s.life > 0);
    for (const s of this.eshots) {
      s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt;
      if (dist2(s, p) < (s.r + p.r) ** 2) { s.life = 0; this.hurtPlayer(s.dmg); }
    }
    this.eshots = this.eshots.filter(s => s.life > 0);
  }

  hitEnemy(e, dmg, o = {}) {
    if (e.dead || e.burrowed) return;
    if (e.invuln > 0) { if (e.flash <= 0) e.flash = 0.05; return; } // boss qui rugit : invulnérable
    const p = this.p, L = this.leg, raw = dmg >= 1e6; // raw : balayages (mort du boss, résurrection), sans effets
    if (!raw && L.fury && p.hp < p.maxHp * 0.4) dmg *= 1 + 0.3 * L.fury; // Furie : +30 % sous 40 % de PV
    const crit = !o.noCrit && Math.random() < p.crit;
    const d = Math.max(1, Math.round(dmg * (crit ? p.critMul : 1) * rand(0.92, 1.08)));
    if (!raw) { // vol de vie : une part des dégâts réellement infligés
      const ls = this.lsNow(o.ls || 0);
      if (ls > 0) {
        this.lsPool += Math.min(d, Math.max(0, e.hp)) * ls;
        // orbes de sang vers le héros (rendu 3D), s'il y a des PV à rendre : d'autant plus fréquentes que le vol de vie est haut (au plus 8/s)
        if (this.runTime >= this.lsEvT && p.hp < p.maxHp - 1 && !this.dying) { this.lsEvT = this.runTime + clamp(0.0125 / ls, 0.125, 0.6); this.emit('lifesteal', { x: e.x, y: e.y, h: e.r * 1.2 + e.fly }); }
      }
    }
    e.hp -= d;
    e.flash = 0.09;
    this.emit('hit', { e, x: e.x, y: e.y, dmg: d, crit, color: o.color || null, quiet: !!o.quiet });
    if (o.knock && !e.boss) { const k = o.knock * e.knockMul * (e.elite ? 0.3 : 1); e.kx += (o.kx || 0) * k; e.ky += (o.ky || 0) * k; }
    if (this.texts.length < 60 && (!o.quiet || crit)) this.text(e.x + rand(-8, 8), e.y, e.r * 2.4 + e.fly, fmt(d), crit ? '#ffd54a' : (o.color || '#ffffff'), crit ? 1.4 : 1);
    if (!o.quiet) sfx(crit ? 'crit' : 'hit');
    if (!raw && !o.legend) {
      // Gel : l'ennemi touché est figé 1 s (les boss sont seulement ralentis)
      if (L.frost && e.hp > 0 && Math.random() < 0.08 * L.frost) {
        if (e.boss) e.slow = Math.max(e.slow, 1); else e.freeze = Math.max(e.freeze, 1);
        this.emit('legend', { kind: 'frost', x: e.x, y: e.y, e });
      }
      // Foudre en chaîne : un coup sur 8 rebondit sur 3 ennemis
      if (L.chain && ++this.chainN >= Math.ceil(8 / L.chain)) { this.chainN = 0; this.chainBolt(e); }
    }
    if (e.hp <= 0) this.kill(e, raw ? { raw: true } : o);
  }

  // ---------- Effets des objets légendaires ----------
  chainBolt(from) {
    const p = this.p, dmg = p.atk * p.dmgMul * 1.2, pts = [[from.x, from.y]], hit = new Set([from]);
    let cur = from;
    for (let i = 0; i < 3; i++) {
      let best = null, bd = 190 * 190;
      for (const e of this.grid.query(cur.x, cur.y, 190)) { if (e.dead || e.burrowed || hit.has(e)) continue; const d = dist2(e, cur); if (d < bd) { bd = d; best = e; } }
      if (!best) break;
      hit.add(best); pts.push([best.x, best.y]);
      this.fx.push({ type: 'bolt', x: best.x, y: best.y, life: 0.22, max: 0.22 });
      this.hitEnemy(best, dmg, { legend: true, color: '#9ae8ff' });
      cur = best;
    }
    if (pts.length > 1) { this.emit('legend', { kind: 'chain', x: from.x, y: from.y, pts }); sfx('zap'); }
  }

  // Explosion : l'ennemi vaincu blesse ses voisins (les morts de l'explosion n'explosent pas à leur tour)
  legendBoom(e) {
    const p = this.p, R = 70 + e.r * 0.8, dmg = p.atk * p.dmgMul * 1.6;
    this.fx.push({ type: 'ring', x: e.x, y: e.y, r: R, life: 0.3, max: 0.3, color: '#ffb04a' });
    this.burst(e.x, e.y, 10, 10, '#ffb04a', 3);
    this.emit('legend', { kind: 'boom', x: e.x, y: e.y, R });
    for (const o of this.grid.query(e.x, e.y, R + 30)) if (o !== e && !o.dead && dist2(o, e) < (R + o.r * 0.5) ** 2) this.hitEnemy(o, dmg, { legend: true, boom: true, quiet: true, color: '#ffb04a', knock: 160, kx: (o.x - e.x) / R, ky: (o.y - e.y) / R });
    if (this.hitSfxT <= 0) { sfx('boom'); this.hitSfxT = 0.12; }
  }

  kill(e, o = {}) {
    e.dead = true;
    this.emit('kill', { e, x: e.x, y: e.y });
    this.kills++;
    const T = this.track;
    if (this.curW && !o.raw) T.weaponKills[this.curW] = (T.weaponKills[this.curW] || 0) + 1;
    if (e.elite) T.elites++;
    if (!o.raw) this.addCombo();
    if (!e.boss) sfx('kill');
    const p = this.p, z = this.zone, L = this.leg;
    p.ult = Math.min(100, p.ult + (e.boss ? 0 : e.elite ? 8 : e.gen ? 0.25 : 0.5) * (save.pet === 'voidy' ? 2 : 1) * (1 + this.it.ult));
    if (L.feast && !this.dying && !o.raw) p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.005 * L.feast * this.diff.heal); // Festin
    if (L.boom && !e.boss && !o.boom && !o.raw && Math.random() < 0.2 * L.boom) this.legendBoom(e);
    save.stats.seen[e.def.name] = (save.stats.seen[e.def.name] || 0) + 1;
    this.burst(e.x, e.y, e.boss ? 70 : e.elite ? 26 : 7, e.fly + 10, e.def.pal[0], e.scale);
    if (e.boss) return this.bossDown(e);
    const xp = (1 + Math.floor(z.id / 2)) * (e.elite ? 15 : 1);
    this.pickups.push({ type: 'xp', x: e.x, y: e.y, v: xp, spin: Math.random() * 6 });
    const luck = this.base.gold * this.diff.gold * this.wm.gold;
    if (Math.random() < (e.elite ? 1 : 0.06)) this.pickups.push({ type: 'gold', x: e.x + rand(-10, 10), y: e.y + rand(-10, 10), v: Math.max(1, Math.round((1 + z.id * 0.5) * (e.elite ? 8 : 1) * luck)) });
    if (!this.curse.has('noheart') && Math.random() < 0.0045 * (e.elite ? 8 : 1)) this.pickups.push({ type: 'heart', x: e.x, y: e.y }); // Abysse : sans cœurs
    if (Math.random() < 0.003) this.pickups.push({ type: 'magnet', x: e.x, y: e.y });
    if (e.mini) this.miniDown(e);
    if (e.elite) {
      this.dropChest(e.x, e.y); sfx('honk'); this.hitStop = 0.08;
      // coffre de butin (à ouvrir après la partie) : surtout en bois, meilleur en Difficile / Cauchemar (le champion a le sien)
      if (!e.mini && Math.random() < 0.35) {
        const d = this.diffId, x = Math.random(), gold = 0.07 + 0.065 * d, silver = 0.28 + 0.085 * d;
        this.dropLoot(e.x + rand(-30, 30), e.y + rand(20, 40), x < gold ? 2 : x < gold + silver ? 1 : 0);
      }
    }
    if (e.bomb) this.addBomb({ x: e.x, y: e.y, R: 115 + e.r * 0.5, t: 1, dmg: e.dmg * 1.6, kind: 'explode', e });
    if (e.def.body === 'blob' && !e.gen && !e.boss && !e.elite && this.enemies.length < HARD_CAP - 2) this.split(e);
  }

  // le champion de mi-parcours est vaincu : butin garanti (coffre de butin en argent ou mieux), or, grosse gemme
  miniDown(e) {
    const z = this.zone, p = this.p;
    this.mini = null;
    const mb = $('#minibar'); if (mb) mb.hidden = true;
    this.pickups.push({ type: 'xp', x: e.x + 20, y: e.y, v: 25 * (1 + Math.floor(z.id / 2)) * (1 + this.stage * 0.5), spin: 0 });
    const g = Math.max(1, Math.round((3 + z.id * 1.5) * this.base.gold * this.diff.gold * this.wm.gold));
    for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; this.pickups.push({ type: 'gold', x: e.x + Math.cos(a) * 34, y: e.y + Math.sin(a) * 34, v: g }); }
    const x = Math.random(), gold = 0.1 + 0.06 * this.diffId; // un coffre de butin (le plus souvent en argent)
    this.dropLoot(e.x + rand(-30, 30), e.y + rand(30, 50), x < gold ? 2 : x < 0.6 + gold ? 1 : 0);
    this.fx.push({ type: 'ring', x: e.x, y: e.y, r: 260, life: 0.6, max: 0.6, color: '#c06aff' });
    this.emit('miniDeath', { e, x: e.x, y: e.y });
    this.banner(`<small>${esc(e.name)}</small>Champion vaincu !`, 1800, 'mini down');
    this.shake = Math.max(this.shake, 10); buzz(60);
    p.ult = Math.min(100, p.ult + 20);
  }

  // ---------- Combo ----------
  addCombo() {
    this.combo++; this.comboT = COMBO_WINDOW;
    if (this.combo > this.comboBest) this.comboBest = this.combo;
    const m = COMBO_STEPS[this.comboStep] ?? (Math.floor(this.combo / 1000) + 1) * 1000;
    if (this.combo < m) return;
    this.comboStep++;
    // palier : un peu d'or et d'expérience tout de suite (selon le palier et le monde)
    const z = this.zone.id, p = this.p;
    const g = Math.max(1, Math.round((2 + m / 100) * (1 + 0.5 * z) * this.diff.gold * this.base.gold * this.wm.gold));
    const xp = Math.round(m * BAL.comboXp * (1 + Math.floor(z / 2)));
    this.gold += g; this.gainXp(xp);
    const rr = m >= 500 && m % 500 === 0 && this.rerolls < 5; // les très longs combos rendent une relance
    if (rr) this.rerolls++;
    this.text(p.x, p.y, 92, `Combo ${m} ! +${g} or${rr ? ' · +1 relance' : ''}`, '#ffd54a', 1.35);
    this.emit('combo', { n: m, x: p.x, y: p.y, gold: g, xp, reroll: rr });
    sfx(m >= 100 ? 'loot' : 'coin'); if (m >= 100) buzz(25);
    this._comboPop = true;
  }

  // fin du combo : temps écoulé, ou brisé par un coup reçu
  endCombo(broken) {
    if (!this.combo) return;
    if (this.combo >= 10) this.emit('comboEnd', { n: this.combo, broken: !!broken });
    if (broken && this.combo >= 10) this.text(this.p.x, this.p.y, 84, 'Combo brisé', '#ff9a8a', 1);
    this.combo = 0; this.comboT = 0; this.comboStep = 0;
    this._comboBroken = !!broken;
  }

  // le boss est vaincu : court ralenti, butin, l'arène tombe et le portail s'ouvre en son centre
  bossDown(e) {
    const A = this.arena || { x: e.x, y: e.y, R: ARENA_R }, z = this.zone, p = this.p;
    if (!this.cleared.includes(z.id)) this.cleared.push(z.id);
    const T = this.track, fight = this.time - (this.bossT0 ?? this.time);
    T.bossKills++;
    if (fight > 0 && (!T.bossFast || fight < T.bossFast)) T.bossFast = Math.round(fight * 10) / 10;
    if (this.totems?.length && this.totems.every(t => t.used)) T.totemBoss = 1;
    this.arena = null;
    this.celebT = 1.5; this.hitStop = 0;
    this.fx.push({ type: 'ring', x: e.x, y: e.y, r: 520, life: 0.8, max: 0.8, color: '#ffe48a' });
    // l'onde de choc balaie les monstres autour de l'arène (le temps de rejoindre le portail)
    for (const o of this.enemies) if (!o.dead && o !== e && !o.elite && dist2(o, A) < (A.R + 260) ** 2) this.hitEnemy(o, 1e7, { quiet: true, noCrit: true });
    for (const o of this.enemies) if (!o.dead && o.inArena) o.inArena = false;
    this.eshots = []; this.bombs = []; this.waves = [];
    // récompenses : grosse gemme, or, coffres de butin (1 en or, parfois mythique, + 1 en argent par niveau de difficulté)
    this.pickups.push({ type: 'xp', x: e.x, y: e.y, v: 40 * (1 + z.id) * (1 + this.stage), spin: 0 });
    const g = Math.max(1, Math.round((6 + z.id * 3) * this.base.gold * this.diff.gold * this.wm.gold));
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; this.pickups.push({ type: 'gold', x: e.x + Math.cos(a) * 40, y: e.y + Math.sin(a) * 40, v: g }); }
    const tiers = [Math.random() < 0.12 + 0.08 * this.diffId + 0.03 * this.abyss ? 3 : 2];
    for (let i = 0; i < this.diffId; i++) tiers.push(1);
    tiers.forEach((t, i) => { const a = -Math.PI / 2 + (i - (tiers.length - 1) / 2) * 0.7; this.dropLoot(A.x + Math.cos(a) * 95, A.y + Math.sin(a) * 95, t, { boss: true }); });
    // portail vers le monde suivant : toujours au centre de la carte (là où la partie a commencé)
    this.portal = { x: 0, y: 0, R: 60, charge: 0, t: 0 };
    this.nextElite = Math.max(this.nextElite, this.time + 25);
    this.emit('bossDeath', { e, x: e.x, y: e.y });
    this.emit('portalOpen', { x: 0, y: 0 });
    const bb = $('#bossbar'); if (bb) bb.hidden = true;
    const last = !ZONES[z.id + 1];
    this.banner(`<small>${esc(e.def.name)} est vaincu !</small>${last ? 'Le dernier portail est ouvert au centre !' : 'Le portail s\'ouvre au centre de la carte !'}`, 2600, 'boss portal');
    this.shake = 16;
    p.inv = Math.max(p.inv, 1.5);
    stopMusic(); sfx('win'); sfx('portal'); buzz(100);
    setTimeout(() => { if (!this.over && this.portal && !this.entering) music('zone' + this.zone.id); }, 2200);
  }

  // un blob se divise en 2 petits à sa mort
  split(e) {
    this.emit('split', { e, x: e.x, y: e.y, n: 2 });
    const a0 = Math.random() * TAU;
    for (let i = 0; i < 2; i++) {
      const a = a0 + i * Math.PI;
      const c = this.addEnemy(e.def, e.k, { x: e.x + Math.cos(a) * 10, y: e.y + Math.sin(a) * 10, gen: 1, inArena: e.inArena });
      c.mad = e.mad;
      c.born = this.time - 0.3; c.kx = Math.cos(a) * 170; c.ky = Math.sin(a) * 170; c.flash = 0.1;
    }
  }

  dropChest(x, y) {
    this.dropChests.push({ x, y, open: false });
  }

  // ---------- Butin (coffres ouverts après la partie) ----------
  // le totem maudit et le trèfle peuvent faire monter le coffre d'un rang
  lootTier(t) {
    const up = Math.min(0.9, this.lootLuck + (this.boosts.includes('trefle') ? 0.35 : 0));
    return Math.min(LOOT_TIERS.length - 1, t + (up > 0 && Math.random() < up ? 1 : 0));
  }

  dropLoot(x, y, tier, o = {}) {
    const lim = HALF - 100;
    const it = { type: 'loot', x: clamp(x, -lim, lim), y: clamp(y, -lim, lim), tier: this.lootTier(tier), t0: this.time, ...o };
    this.pickups.push(it);
    this.emit('lootDrop', { x: it.x, y: it.y, tier: it.tier });
    return it;
  }

  takeLoot(it, quiet = false) {
    it.taken = true;
    this.loot.push({ tier: it.tier, zone: this.zone.id });
    this.track.chests++;
    this.emit('pickup', { kind: 'loot', x: it.x, y: it.y, v: it.tier });
    if (quiet) return;
    sfx('lootPick'); buzz(30);
    this.burst(it.x, it.y, 18, 20, LOOT_TIERS[it.tier].color, 3);
    this.banner(`<small>Butin · à ouvrir après la partie</small>${esc(LOOT_TIERS[it.tier].name)} ramassé !`, 1500, `small loot t${it.tier}`);
  }

  burst(x, y, n, z = 0, color = '#ffffff', scale = 2) {
    for (let i = 0; i < n && this.parts.length < 650; i++) {
      const a = Math.random() * TAU, v = rand(60, 220) * Math.sqrt(scale / 2);
      this.parts.push({ x, y, z: z + rand(5, 20) * scale / 2, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: rand(150, 420), life: rand(0.5, 0.9), c: color, s: rand(0.7, 1.3) * Math.min(3, scale / 2) });
    }
  }

  text(x, y, z, txt, color, size = 1) { this.texts.push({ x, y, z, txt, color, size, life: 0.75 }); }
  msg(t) { if (this.msgT > 0) return; this.msgT = 3; this.banner(t, 2000, 'small'); }

  // ---------- Objets au sol ----------
  updatePickups(dt) {
    const p = this.p, R = p.magnet;
    for (const it of this.pickups) {
      const dx = p.x - it.x, dy = p.y - it.y, d = Math.hypot(dx, dy) || 1;
      if (it.type === 'loot') { if (d < 30 && !this.dying) this.takeLoot(it); continue; } // pas attiré par l'aimant : il faut marcher dessus
      if (it.pull || d < R) {
        it.pull = true;
        const sp = 400 + (it.pt = (it.pt || 0) + dt) * 900;
        it.x += dx / d * sp * dt; it.y += dy / d * sp * dt;
        if (d < 18) {
          it.taken = true;
          this.emit('pickup', { kind: it.type, x: it.x, y: it.y, v: it.v || 0 });
          if (it.type === 'xp') { this.gainXp(it.v); sfx('gem'); }
          if (it.type === 'gold') { this.gold += it.v; sfx('coin'); }
          if (it.type === 'heart') { this.track.hearts++; const h = Math.round(p.maxHp * 0.25 * this.diff.heal); p.hp = Math.min(p.maxHp, p.hp + h); this.text(p.x, p.y, 70, '+' + h, '#5ae87a', 1.2); sfx('heal'); }
          if (it.type === 'magnet') { for (const o of this.pickups) if (o.type === 'xp') o.pull = true; sfx('boing'); sfx('loot'); }
        }
      }
    }
    this.pickups = this.pickups.filter(i => !i.taken);
    if (this.pickups.length > 600) {
      const far = this.pickups.filter(i => i.type === 'xp' && !i.pull).sort((a, b) => dist2(b, p) - dist2(a, p)).slice(0, 120);
      const sum = far.reduce((s, i) => s + i.v, 0);
      for (const f of far) f.taken = true;
      this.pickups = this.pickups.filter(i => !i.taken);
      if (far.length) this.pickups.push({ type: 'xp', x: far[0].x, y: far[0].y, v: sum, spin: 0 });
    }
  }

  updateInterest(dt) {
    const p = this.p;
    const tryOpen = (c, cost) => {
      if (c.open || dist2(c, p) > 46 * 46) return;
      if (cost && this.gold < cost) { this.msg(`Il faut ${cost} or pour ouvrir ce coffre.`); return; }
      if (cost) { this.gold -= cost; this.chestCost = Math.round(this.chestCost * 1.45); }
      c.open = true;
      this.openChest(c);
    };
    for (const c of this.chests) tryOpen(c, this.chestCost);
    for (const c of this.dropChests) tryOpen(c, 0);
    if (this.paused) return;
    for (const s of this.shrines) {
      if (s.used) continue;
      const inside = dist2(s, p) < 58 * 58;
      s.charge = Math.max(0, Math.min(1, s.charge + (inside ? dt / 2.2 : -dt / 3)));
      if (inside && !s.told) { s.told = true; this.msg('Restez dans le cercle pour activer l\'autel'); }
      if (s.charge >= 1 && !this.paused) {
        s.used = true;
        this.emit('shrine', { x: s.x, y: s.y });
        sfx('shrine'); buzz(40);
        this.burst(s.x, s.y, 30, 40, '#4fd0ff');
        this.paused = true; this.joy = null; this.look = null;
        this.onLevelUp('Autel activé !', this.boonChoices(), c => { this.applyChoice(c); this.paused = false; this.last = performance.now(); }, 'Choisissez une bénédiction');
      }
    }
  }

  // ---------- Totems de défi : plus dur, mais ça rapporte tout de suite ----------
  updateTotems(dt) {
    const p = this.p;
    for (const T of this.totems) {
      if (T.used) continue;
      const inside = dist2(T, p) < 55 * 55;
      T.charge = clamp(T.charge + (inside ? dt / 1.5 : -dt / 2.5), 0, 1);
      if (inside && !T.told) {
        T.told = true;
        const d = TOTEMS[T.kind];
        this.banner(`<small>${iconImg(d.icon, 14)} ${esc(d.name)}</small><span class="tt-curse">${esc(d.curse)}</span><span class="tt-reward">${esc(d.reward)}</span>`, 2800, 'small totem');
      }
      if (!inside && T.charge <= 0) T.told = false;
      if (T.charge >= 1 && !this.paused) this.activateTotem(T);
    }
  }

  activateTotem(T) {
    T.used = true; T.charge = 1;
    this.heat++; this.track.totems++;
    const d = TOTEMS[T.kind], z = this.zone, p = this.p;
    this.emit('totem', { kind: T.kind, x: T.x, y: T.y });
    this.fx.push({ type: 'ring', x: T.x, y: T.y, r: 220, life: 0.6, max: 0.6, color: d.color });
    this.burst(T.x, T.y, 34, 50, d.color, 4);
    this.shake = 8; sfx('totem'); buzz(50);
    const done = c => { this.applyChoice(c); this.paused = false; this.last = performance.now(); };
    switch (T.kind) {
      case 'horde': {
        this.wm.spawn *= 1.35; this.wm.gold *= 1.25;
        const g = Math.round((30 + 15 * z.id) * this.diff.gold * this.base.gold);
        this.gold += g;
        this.text(p.x, p.y, 70, '+' + g + ' or', '#ffd54a', 1.3);
        this.banner(`<small>${esc(d.name)} activé !</small>+${fmt(g)} or · la horde grossit`, 2000, 'totem');
        sfx('coin');
        break;
      }
      case 'fureur':
        this.wm.dmg *= 1.25; this.wm.speed *= 1.12;
        this.dropLoot(T.x + 60, T.y + 20, Math.random() < 0.3 ? 2 : 1);
        this.banner(`<small>${esc(d.name)} activé !</small>Les monstres enragent… un coffre apparaît !`, 2000, 'totem');
        break;
      case 'elite': {
        this.wm.elite *= 0.5;
        this.nextElite = Math.min(this.nextElite, this.time + this.eliteGap * this.wm.elite);
        const a = Math.random() * TAU;
        this.spawnElite({ x: p.x + Math.cos(a) * 420, y: p.y + Math.sin(a) * 420, why: 'Le totem appelle un champion !' });
        this.paused = true; this.joy = null; this.look = null;
        this.onLevelUp('Totem des Champions', this.boonChoices(), done, 'Choisissez une bénédiction');
        break;
      }
      case 'maudit':
        this.runHp *= 1.2; this.lootLuck += 0.15;
        this.paused = true; this.joy = null; this.look = null;
        this.onLevelUp('Totem maudit', this.choices(), done, 'Choisissez une amélioration gratuite');
        break;
    }
  }

  // ---------- Portail vers le monde suivant ----------
  updatePortal(dt) {
    const P = this.portal, p = this.p;
    if (!P) return;
    // âge en temps réel (le ralenti de la mort du boss ne retarde pas l'ouverture)
    const rt = dt / Math.max(0.3, this.slowmo);
    P.t += rt;
    if (this.entering) {
      p.inv = Math.max(p.inv, 0.5);
      if ((this.entering -= rt) <= 0) { this.entering = 0; this.portalReached(); }
      return;
    }
    // il s'ouvre en 1 s, puis il suffit d'y rester ~0,7 s
    const inside = P.t > 1 && dist2(P, p) < P.R * P.R;
    P.charge = clamp(P.charge + (inside ? rt / 0.7 : -rt / 1.5), 0, 1);
    if (P.charge >= 1 && !this.paused && !this.dying) {
      this.entering = 0.6;
      p.inv = Math.max(p.inv, 1);
      this.emit('portalEnter', {});
      sfx('portal'); buzz(60);
    }
  }

  // le héros est passé : on propose le monde suivant ou le retour avec le butin
  portalReached() {
    for (const it of this.pickups) if (it.type === 'loot' && it.boss && !it.taken) this.takeLoot(it, true); // le butin du boss suit
    this.paused = true; this.joy = null; this.look = null;
    const next = ZONES[this.zone.id + 1] || null;
    const info = { from: this.zone.id, to: next ? next.id : null, stage: this.stage, kills: this.kills, gold: this.gold, loot: this.loot.length, time: this.runTime, cleared: [...this.cleared] };
    let chosen = false;
    const choose = c => {
      if (chosen || this.over) return;
      chosen = true;
      if (c === 'next' && next) { this.paused = false; this.last = performance.now(); this.nextWorld(); }
      else this.finish(true);
    };
    if (this.onPortal) this.onPortal(info, choose); else choose(next ? 'next' : 'home');
  }

  nextWorld() {
    const next = ZONES[this.zone.id + 1];
    if (!next || this.over) return this.finish(true);
    // les gemmes restées au sol sont accordées
    let xp = 0;
    for (const it of this.pickups) if (it.type === 'xp' && !it.taken) xp += it.v;
    if (xp) this.gainXp(xp);
    this.stage++;
    this.zone = next;
    this.setupWorld();
    this.events.length = 0;
    const p = this.p;
    p.x = 0; p.y = 0; p.h = 0; p.vh = 0; p.inv = 2; p.face = { x: 0, y: -1 };
    p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.3);
    for (const w of p.weapons) w.orbs = null;
    if (this.pet) { this.pet.x = -30; this.pet.y = 10; }
    this.slowmo = 1; this.celebT = 0; this.hitStop = 0; this.shake = 0; this.joy = null; this.target = null; this.mvx = this.mvy = 0;
    // nouveau monde : nouveau décor (le rendu est recréé)
    if (this.cv) { this.gfx?.dispose(); this.gfx = createGfx(this, this.cv); this.gfx.resize(); }
    const bb = $('#bossbar'); if (bb) bb.hidden = true;
    const mb = $('#minibar'); if (mb) mb.hidden = true;
    $('#timer')?.classList.remove('boss', 'ot', 'low');
    this.renderWorld();
    music('zone' + next.id);
    this.banner(`<small>${esc(next.sub)}</small>Monde ${next.id + 1} · ${esc(next.name)}`, 2800, 'world');
    this.emit('worldStart', { zone: next.id, stage: this.stage });
    sfx('shrine'); buzz(60);
  }

  gainXp(v) {
    const p = this.p;
    p.xp += v * p.xpMul;
    while (p.xp >= p.xpNext) {
      p.xp -= p.xpNext;
      p.level++;
      p.xpNext = Math.round(5 + (p.level - 1) * 4 + Math.pow(p.level, 1.6));
      this.pending++;
      this.emit('levelup', { level: p.level });
    }
  }

  openChest(c) {
    this.emit('chest', { x: c.x, y: c.y });
    if (this.paused) { c.open = false; return; }
    this.paused = true; this.joy = null; this.look = null;
    const ch = this.choices(1)[0];
    const g = Math.round((10 + this.zone.id * 6) * this.base.gold * this.diff.gold);
    this.gold += g;
    sfx('chest');
    this.burst(c.x, c.y, 30, 20, '#ffd54a');
    this.onChest(ch, g, () => { this.applyChoice(ch); this.paused = false; this.last = performance.now(); });
  }

  // ---------- Familier ----------
  updatePet(dt) {
    if (!this.pet) return;
    const pet = this.pet, p = this.p;
    const tx = p.x - p.face.x * 40 + p.face.y * 20, ty = p.y - p.face.y * 40 - p.face.x * 20;
    pet.x += (tx - pet.x) * Math.min(1, dt * 5); pet.y += (ty - pet.y) * Math.min(1, dt * 5);
    this.petT -= dt;
    if (this.petT > 0) return;
    switch (pet.id) {
      case 'poro': this.petT = 4; if (p.hp < p.maxHp) { const h = Math.max(1, Math.round(p.maxHp * 0.015 * this.diff.heal)); p.hp = Math.min(p.maxHp, p.hp + h); this.text(p.x, p.y, 70, '+' + h, '#5ae87a'); } break;
      case 'herald': {
        this.petT = 1.1;
        const t = this.nearest(320, pet);
        if (t) { const a = Math.atan2(t.y - pet.y, t.x - pet.x); this.shots.push({ type: 'pet', x: pet.x, y: pet.y, z: 24, vx: Math.cos(a) * 400, vy: Math.sin(a) * 400, r: 8, dmg: p.atk * p.dmgMul * 0.9, pierce: 0, life: 1, hit: new Set() }); }
        break;
      }
      case 'wisp': this.petT = 12; p.shieldHit = 1; break;
      default: this.petT = 999;
    }
  }

  // ---------- Ultime ----------
  autoUltReady() {
    if (this.boss && !this.boss.dead && dist2(this.boss, this.p) < 300 * 300) return true;
    let n = 0;
    for (const e of this.enemies) if (!e.burrowed && dist2(e, this.p) < 240 * 240 && ++n >= 16) return true;
    return false;
  }

  useUlt() {
    const p = this.p;
    if (this.paused || this.over) return;
    if (p.ult < 100) { this.msg('Ultime en charge : battez des monstres pour le remplir.'); return; }
    p.ult = 0;
    save.stats.ults++; this.track.ults++;
    sfx('ult'); buzz(50);
    const A = p.atk * p.dmgMul * (1 + p.evo * 0.3);
    this.ultFlash = 0.5;
    if (this.cls.ult === 'nova') {
      const R = 300 * p.area;
      this.fx.push({ type: 'ring', x: p.x, y: p.y, r: R, life: 0.6, max: 0.6, color: '#ffd54a' });
      this.burst(p.x, p.y, 50, 20, '#ffe48a');
      for (const e of this.grid.query(p.x, p.y, R + 40)) if (dist2(e, p) < R * R) this.hitEnemy(e, A * 10, { knock: 400, kx: (e.x - p.x) / R, ky: (e.y - p.y) / R });
    } else if (this.cls.ult === 'crystal') {
      const t = this.aim(650);
      const a = t ? Math.atan2(t.y - p.y, t.x - p.x) : Math.atan2(p.face.y, p.face.x);
      this.shots.push({ type: 'crystal', x: p.x, y: p.y, z: 30, vx: Math.cos(a) * 720, vy: Math.sin(a) * 720, r: 40, dmg: A * 9, pierce: 999, life: 1.4, hit: new Set(), freeze: true, big: true });
    } else {
      for (const e of this.onScreen()) { this.hitEnemy(e, A * 7, { knock: 200, kx: Math.sign(e.x - p.x), ky: Math.sign(e.y - p.y) }); this.fx.push({ type: 'bolt', x: e.x, y: e.y, life: 0.3, max: 0.3 }); }
      p.inv = 3;
      this.fx.push({ type: 'ring', x: p.x, y: p.y, r: 240, life: 0.5, max: 0.5, color: '#ffffff' });
    }
    this.emit('ult', { kind: this.cls.ult, x: p.x, y: p.y });
    this.banner(esc(ULTS[this.cls.ult].name), 900, 'ult');
  }

  // ---------- Fin ----------
  die() {
    if (this.over || this.dying) return;
    this.dying = true;
    this.emit('die', { x: this.p.x, y: this.p.y });
    this.paused = true; this.joy = null; this.look = null;
    duckMusic(true);
    sfx('lose'); buzz(80);
    // plume de phénix : on revient tout seul, une fois (la pub pour revivre reste possible ensuite)
    if (this.phoenix) { this.phoenix = false; setTimeout(() => { if (!this.over) this.revive(true); }, 800); return; }
    setTimeout(() => this.onDefeat(!this.revived), 650);
  }

  revive(free = false) {
    const p = this.p;
    if (!free) this.revived = true;
    this.dying = false;
    this.emit('revive', { x: p.x, y: p.y, free });
    p.hp = p.maxHp; p.inv = 3;
    this.eshots = []; this.waves = []; this.bombs = [];
    duckMusic(false);
    for (const e of this.grid.query(p.x, p.y, 280)) if (!e.boss) this.hitEnemy(e, 1e7, { quiet: true, noCrit: true }); else { e.kx = (e.x - p.x) * 3; e.ky = (e.y - p.y) * 3; }
    this.fx.push({ type: 'ring', x: p.x, y: p.y, r: 280, life: 0.7, max: 0.7, color: free ? '#ffb03a' : '#5ae87a' });
    if (free) { this.banner('<small>Vous revenez à la vie</small>Plume de phénix !', 2000, 'evo'); this.renderLoadout(); }
    sfx('revive');
    this.paused = false; this.last = performance.now();
  }

  finish(win) {
    if (this.over) return;
    this.destroy();
    Object.assign(this.track, { kills: this.kills, worlds: this.cleared.length, maxWorld: this.zone.id, maxCombo: this.comboBest, level: this.p.level,
      time: Math.round(this.runTime), won: this.cleared.length > 0, dmgTaken: Math.round(this.track.dmgTaken), lsHeal: Math.round(this.track.lsHeal) });
    this.onEnd({
      win, final: !!win && !ZONES[this.zone.id + 1] && this.cleared.includes(this.zone.id),
      diff: this.diffId, time: this.runTime, kills: this.kills, level: this.p.level, gold: this.gold, evo: this.p.evo,
      weapons: this.p.weapons.map(w => ({ ...w })), tomes: { ...this.p.tomes }, revived: this.revived,
      startZone: this.startZone, cleared: [...this.cleared], stage: this.stage,
      loot: this.loot.map(l => ({ tier: l.tier, zone: l.zone })), heat: this.heat, boosts: [...this.boosts],
      combo: this.comboBest, evos: this.p.weapons.filter(w => w.evo).map(w => w.id),
      abyss: this.abyss, track: { ...this.track, weaponKills: { ...this.track.weaponKills } },
    });
  }

  // ---------- Interface ----------
  hud() {
    const p = this.p;
    this.hudT = (this.hudT || 0) + 1;
    if (this.hudT % 3) return;
    const tm = $('#timer'), lbl = $('#timerLbl');
    if (!tm) return;
    // chrono du monde, puis temps de folie en rouge (« +0:12 »)
    const left = this.duration - this.time, ot = left < 0, fight = this.boss && !this.boss.dead;
    tm.textContent = ot ? '+' + mmss(-left) : mmss(Math.ceil(left));
    tm.classList.toggle('ot', ot);
    tm.classList.toggle('low', !ot && left < 20 && !fight);
    tm.classList.toggle('boss', fight && !ot);
    lbl.textContent = this.entering ? 'En route !'
      : this.portal ? 'Au portail !'
      : fight ? 'Battez le boss !'
      : ot ? `Folie niv. ${this.otLevel}`
      : left < 30 ? 'Folie imminente !'
      : this.mini && !this.mini.dead ? 'Battez le champion !'
      : this.phase === 'build' && this.swarms.length && this.swarms[0] - this.time < 8 ? 'Une horde approche !'
      : this.phase === 'breather' ? 'Répit…'
      : this.time < 25 ? 'Survivez !' : 'Trouvez l\'autel';
    lbl.classList.toggle('hot', ot || left < 30 || !!this.portal || (this.phase === 'build' && this.swarms.length > 0 && this.swarms[0] - this.time < 8));
    $('#killsN').textContent = cnum(this.kills);
    $('#goldRun').textContent = cnum(this.gold);
    if (this.loot.length !== this._lootN) {
      const pill = $('#lootPill');
      $('#lootN').textContent = this.loot.length;
      if (this._lootN != null && pill) { pill.classList.remove('pop'); void pill.offsetWidth; pill.classList.add('pop'); }
      this._lootN = this.loot.length;
    }
    if (this.heat !== this._heatN) {
      const hp = $('#heatPill');
      if (hp) { hp.hidden = !this.heat; $('#heatN').textContent = this.heat; if (this._heatN != null) { hp.classList.remove('pop'); void hp.offsetWidth; hp.classList.add('pop'); } }
      this._heatN = this.heat;
    }
    $('#xpFill').style.width = (p.xp / p.xpNext * 100) + '%';
    // vol de vie : la barre de PV du haut (ajoutée par l'interface) s'illumine à chaque soin (style.css, « Vol de vie »)
    const hb = this._hpb?.isConnected ? this._hpb : (this._hpb = $('.hud .hp-top'));
    if (hb && (this.lsGlow > 0) !== hb._ls) { hb._ls = this.lsGlow > 0; hb.classList.toggle('ls', hb._ls); }
    this.hudCombo();
    if (p.level !== this._lvN) { $('#lvl').textContent = p.level; this._lvN = p.level; }
    const ub = $('#ultBtn');
    ub.querySelector('circle').style.strokeDashoffset = 100.5 * (1 - p.ult / 100);
    ub.classList.toggle('ready', p.ult >= 100);
    $('#tPlate')?.classList.toggle('ot', ot);
    $('#tPlate')?.classList.toggle('boss', fight && !ot);
    $('#tPlate')?.classList.toggle('low', !ot && left < 20 && !fight);
    const M = this.mini;
    if (M) {
      if (M.dead) { this.mini = null; const mb = $('#minibar'); if (mb) mb.hidden = true; }
      else $('#miniFill').style.width = Math.max(0, M.hp / M.maxHp * 100) + '%';
    }
    if (this.boss && !this.boss.dead) {
      const b = $('#bossbar');
      b.querySelector('.fill').style.width = Math.max(0, this.boss.hp / this.boss.maxHp * 100) + '%';
      b.querySelector('.hpbar span').textContent = fmt(Math.max(0, this.boss.hp));
    }
  }

  // compteur de combo (visible à partir de 5 victimes enchaînées) et sa jauge de temps
  hudCombo() {
    const el = this._cb || (this._cb = $('#combo'));
    if (!el) return;
    const show = this.combo >= 5;
    if (show !== !el.hidden) { el.hidden = !show; if (!show && this._comboBroken) { this._comboBroken = false; } }
    if (!show) return;
    if (this.combo !== this._cbN) {
      this._cbN = this.combo;
      $('#comboN').textContent = this.combo;
      el.classList.toggle('hot', this.combo >= 50); el.classList.toggle('max', this.combo >= 200);
    }
    if (this._comboPop) { this._comboPop = false; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
    $('#comboT').style.width = Math.max(0, this.comboT / COMBO_WINDOW * 100) + '%';
  }

  // ---------- Rendu ----------
  render(dt) { this.gfx.render(dt); }
}
