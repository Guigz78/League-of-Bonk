// Giga boss du niveau 3 de l'expédition : Gorgoth, Roi des Bonks (data.js GIGA, modèle 3D js/g3d/models-bosses.js).
// Méthodes ajoutées à Run (run.js : Object.assign(Run.prototype, GIGA_METHODS)) ; réglages GB en haut de run.js.
// 3 phases (sous 66 % et 33 % de PV) : armure intacte → armure brisée et fissures de magma → embrasé (aura). Chaque
// changement : rugissement (invulnérable), nouvelle forme 3D (e.mdl, lue par le rendu), anneau de projectiles, élites.
// Attaques, toutes annoncées et toutes esquivables en se déplaçant (il n'y a pas de saut) :
//  - bonds écrasants (leap) : un cercle au sol marque l'atterrissage, 1 à 3 bonds de suite selon la phase ;
//  - ondes de choc à brèche (quake) : 2 à 3 ondes, chacune ouverte d'une brèche : s'y placer, ou s'éloigner (portée limitée) ;
//  - double rayon tournant (laser, phase 2+) : deux rayons opposés font le tour du boss : sortir de leur portée ;
//  - pluie de météores (rain) : cercles rouges sur toute l'arène ; spirales de projectiles (double et à contre-sens en
//    phase 3) ; charges et anneaux de projectiles (repris du boss du monde, run.js) ;
//  - phase 3 : des météores visent le joueur en continu (fire).
// Victoire : long ralenti, confettis et rayons, Giga coffre (coffre mythique amélioré, save.js rollChest), or, portail de
// retour au centre de l'arène ; suivi dans run.track (giga, gigaDance, gigaFight).
import { GIGA, GIGA_FORMS } from './data.js';
import { GB } from './run.js';
import { sfx, buzz, music, stopMusic } from './audio.js';
import { $, esc } from './ui.js';

const TAU = Math.PI * 2, PI = Math.PI;
const rand = (a, b) => a + Math.random() * (b - a);
const angD = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const NAME = esc(GIGA.name);

export const GIGA_METHODS = {
  // ---------- Arrivée : cinématique ----------
  // appelé par summonBoss (arène déjà en place, monstres repoussés) : invulnérable pendant l'intro, caméra sur le boss,
  // ralenti, carte « GIGA BOSS », barre de vie spéciale, musique dédiée
  gigaIntro(B, auto) {
    const p = this.p, A = this.arena;
    B.phase = 'intro'; B.phaseT = GB.intro; B.invuln = GB.intro + 0.2;
    B.mdl = GIGA_FORMS[0]; B.gph = 1; B.fireT = GB.fire;
    this.gigaT0 = this.time; this.gigaLaserHit = false;
    this.cine = B; this.cineT = 2.6; // caméra (rendu) et ralenti (frame)
    p.inv = Math.max(p.inv, GB.intro);
    const bb = $('#bossbar');
    if (bb) {
      bb.hidden = false; bb.classList.add('giga'); bb.classList.remove('p2', 'p3');
      $('#bossName').innerHTML = `<span class="tag giga">GIGA BOSS</span>${NAME}<em class="gb-ph" id="gbPh">Phase 1/3</em>`;
      const ph = bb.querySelectorAll('.hpbar .ph');
      if (ph[0]) ph[0].style.left = GB.ph2 * 100 + '%';
      if (ph[1]) ph[1].style.left = GB.ph3 * 100 + '%';
    }
    this.gigaCard(auto ? 'Le chrono est écoulé : il vient à vous !' : 'Niveau 3 · le combat final de l\'expédition');
    this.emit('gigaSummon', { e: B, x: B.x, y: B.y, R: A ? A.R : GB.arena });
    this.burst(B.x, B.y, 80, 0, '#ff8a2a', 8);
    if (A) this.fx.push({ type: 'ring', x: A.x, y: A.y, r: A.R, life: 1, max: 1, color: '#ffb02a' });
    this.shake = 22;
    stopMusic(); sfx('summon'); sfx('gigaRoar'); buzz(160);
    setTimeout(() => { if (!this.over && this.boss === B && !B.dead) music('giga'); }, 1300);
  },

  // carte géante « GIGA BOSS » + nom et titre (calque HTML du HUD, s'efface seule) ; win = version victoire
  gigaCard(sub, win = false) {
    const hud = $('.run .hud'); if (!hud) return;
    hud.querySelector('.giga-card')?.remove();
    const el = document.createElement('div');
    el.className = 'giga-card' + (win ? ' win' : '');
    el.innerHTML = win
      ? `<i class="gc-rays"></i><span class="gc-k">VICTOIRE</span><b class="gc-n">${NAME} est tombé</b><em class="gc-t">Expédition accomplie</em><small>${esc(sub)}</small>`
      : `<i class="gc-rays"></i><span class="gc-k">GIGA BOSS</span><b class="gc-n">${NAME}</b><em class="gc-t">${esc(GIGA.title)}</em><small>${esc(sub)}</small>`;
    hud.appendChild(el);
    setTimeout(() => el.remove(), win ? 4200 : 3700);
  },

  // ralenti de la cinématique (temps réel, appelé par frame) : très lent, puis retour progressif
  cineSlow(dt) {
    const t = this.cineT -= dt;
    this.slowmo = t > 1.2 ? 0.35 : t > 0 ? 0.35 + 0.65 * (1 - t / 1.2) : 1;
    if (t <= 0) { this.cineT = 0; this.cine = null; }
  },

  // ---------- IA ----------
  // phases propres au giga boss ; renvoie false pour les états repris du boss du monde (intro, charge, spirale, anneau,
  // pluie), traités ensuite par bossAI (run.js)
  gigaAI(e, dt, nx, ny, d, sp) {
    const mv = this.mv, p = this.p;
    if (e.phase === 'chase' && e.gph < 3 && e.hp < e.maxHp * (e.gph === 1 ? GB.ph2 : GB.ph3)) this.gigaPhase(e, e.gph + 1);
    switch (e.phase) {
      case 'chase':
        e.phaseT -= dt;
        mv.x = nx * sp; mv.y = ny * sp;
        if (e.phaseT <= 0) this.gigaPick(e, nx, ny, d);
        return true;
      case 'groar': // changement de phase : rugissement sur place, invulnérable
        e.phaseT -= dt; mv.x = 0; mv.y = 0;
        if ((e.phaseT * 8 | 0) % 2 === 0) e.flash = Math.max(e.flash, 0.05);
        if (e.phaseT <= 0) {
          this.bossRing(e, 0, 1.2); this.bossRing(e, 0.5, 0.8);
          this.gigaElites(e, GB.elites[e.gph - 1] || 0);
          this.shake = Math.max(this.shake, 10);
          e.phase = 'chase'; e.phaseT = 0.9;
        }
        return true;
      case 'leapW': // accroupi : la cible est déjà marquée au sol
        e.phaseT -= dt; mv.x = 0; mv.y = 0;
        e.jumpH = -14 * Math.min(1, 1 - e.phaseT / e.crouch);
        if (e.phaseT <= 0) { e.phase = 'leap'; e.phaseT = 0.95; e.air = true; e.lx0 = e.x; e.ly0 = e.y; sfx('swish'); }
        return true;
      case 'leap': { // en l'air : il rejoint le cercle (pas de contact), l'atterrissage frappe (bombe 'bonk', gigaImpact)
        e.phaseT -= dt; mv.x = 0; mv.y = 0; e.kx = 0; e.ky = 0;
        const k = Math.min(1, 1 - Math.max(0, e.phaseT) / 0.95), s = k * k * (3 - 2 * k);
        e.x = e.lx0 + (e.lx - e.lx0) * s; e.y = e.ly0 + (e.ly - e.ly0) * s;
        e.jumpH = Math.sin(k * PI) * 330;
        if (e.phaseT <= 0) {
          e.air = false; e.jumpH = 0; e.x = e.lx; e.y = e.ly;
          if (--e.leaps > 0) this.gigaLeap(e, 0.3);
          else { e.phase = 'chase'; e.phaseT = this.gigaCd(e, 1.1); }
        }
        return true;
      }
      case 'quakeW': { // il bondit sur place : les ondes partent à l'atterrissage
        e.phaseT -= dt; mv.x = 0; mv.y = 0;
        const k = 1 - Math.max(0, e.phaseT) / 1.1;
        e.jumpH = Math.sin(k * PI) * 170;
        if (e.phaseT <= 0) { e.jumpH = 0; e.phase = 'quake'; e.phaseT = 0; e.qi = 0; }
        return true;
      }
      case 'quake': // une onde à brèche toutes les GB.quakeDt s
        e.phaseT -= dt; mv.x = 0; mv.y = 0;
        if (e.phaseT <= 0 && e.qi < e.qGaps.length) {
          const gap = e.qGaps[e.qi++];
          this.waves.push({ x: e.x, y: e.y, r: e.r * 0.6, max: GB.quakeMax, speed: GB.quakeV, dmg: e.dmg * 0.75, hit: false, gap, gw: GB.quakeGap, giga: true });
          this.emit('bossStomp', { e, x: e.x, y: e.y });
          this.emit('gigaQuake', { e, x: e.x, y: e.y, gap, gw: GB.quakeGap });
          this.shake = Math.max(this.shake, 12); sfx('stomp'); buzz(50);
          e.phaseT = GB.quakeDt;
          if (e.qi >= e.qGaps.length) { e.phase = 'chase'; e.phaseT = this.gigaCd(e, 1.6); }
        }
        return true;
      case 'laserW': // les deux rayons se chargent (lignes de départ affichées)
        e.phaseT -= dt; mv.x = 0; mv.y = 0;
        if ((e.phaseT * 10 | 0) % 2 === 0) e.flash = Math.max(e.flash, 0.04);
        if (e.phaseT <= 0) { e.phase = 'laser'; e.phaseT = e.lzT; this.emit('gigaLaser', { e }); sfx('charge'); this.shake = Math.max(this.shake, 8); }
        return true;
      case 'laser': { // les rayons tournent : touché si l'on est dessus (portée limitée)
        e.phaseT -= dt; mv.x = 0; mv.y = 0;
        e.lzA += e.lzDir * e.lzSpin * dt;
        if (p.inv <= 0 && !this.dying && this.laserOn(e)) { this.gigaLaserHit = true; this.hurtPlayer(e.dmg * 0.75, e); }
        if (e.phaseT <= 0) { e.phase = 'chase'; e.phaseT = this.gigaCd(e, 1.4); }
        return true;
      }
      case 'gspiral': { // double spirale à contre-sens (phase 3)
        e.phaseT -= dt; mv.x = 0; mv.y = 0;
        if (e.spinUp > 0) { e.spinUp -= dt; if ((e.spinUp * 10 | 0) % 2 === 0) e.flash = Math.max(e.flash, 0.04); return true; }
        e.spT -= dt;
        while (e.spT <= 0) {
          e.spT += 0.12; e.spA += 0.29;
          for (let i = 0; i < 2 && this.eshots.length < 220; i++) for (const sg of [1, -1]) {
            const an = sg * e.spA + i * PI + (sg < 0 ? 0.4 : 0);
            this.eshots.push({ x: e.x, y: e.y, z: 50, vx: Math.cos(an) * 135, vy: Math.sin(an) * 135, r: 10, dmg: e.dmg * 0.5, life: 5.5 });
          }
        }
        if (e.phaseT <= 0) { e.phase = 'chase'; e.phaseT = this.gigaCd(e, 1.3); }
        return true;
      }
    }
    return false;
  },

  // délai avant l'attaque suivante (plus court à chaque phase ; Abysse « boss furieux » : e.bcd)
  gigaCd(e, k = 1) { return GB.cd[e.gph - 1] * k * rand(0.85, 1.2) * (e.bcd || 1); },

  // choix de la prochaine attaque (pondéré par la phase, sans répéter la même) ; force = attaque imposée (tests)
  gigaPick(e, nx, ny, d, force) {
    const ph = e.gph, p = this.p, W = this._gw || (this._gw = {});
    W.leap = 3; W.quake = 2.2; W.rain = 1.6; W.aim = d > 260 ? 1.6 : 0.8; W.ring = 0.9;
    W.spiral = ph >= 3 ? 0.6 : 1.4; W.gspiral = ph >= 3 ? 1.8 : 0;
    W.laser = ph >= 2 ? 2.8 : 0;
    if (e.last) W[e.last] *= 0.15;
    let tot = 0;
    for (const k in W) tot += W[k];
    let x = Math.random() * tot, pick = 'leap';
    for (const k in W) { x -= W[k]; if (x <= 0) { pick = k; break; } }
    if (force) pick = force;
    e.last = pick;
    switch (pick) {
      case 'leap':
        e.leaps = GB.bonks[ph - 1] || 1;
        this.gigaLeap(e, 0.45);
        this.msg(e.leaps > 1 ? `${GIGA.name} bondit ${e.leaps} fois : sortez des cercles !` : `${GIGA.name} bondit : sortez du cercle !`);
        break;
      case 'quake': {
        // brèches : la première à côté du joueur (jamais sur lui), les suivantes décalées du même côté
        const n = GB.quakes[ph - 1] || 2, side = Math.random() < 0.5 ? 1 : -1, a0 = Math.atan2(p.y - e.y, p.x - e.x) + side * rand(0.7, 1.1);
        e.qGaps = Array.from({ length: n }, (_, i) => a0 + side * i * rand(0.45, 0.7));
        e.phase = 'quakeW'; e.phaseT = 1.1;
        this.emit('bossJump', { e });
        this.emit('enemyTelegraph', { e, kind: 'quake', x: e.x, y: e.y, dx: Math.cos(a0), dy: Math.sin(a0), dur: 1.1, R: GB.quakeMax, gap: a0, gw: GB.quakeGap });
        this.msg('Ondes de choc : glissez-vous dans la brèche ou éloignez-vous !');
        break;
      }
      case 'laser': {
        // deux rayons opposés, partis de part et d'autre du joueur
        e.lzA = Math.atan2(p.y - e.y, p.x - e.x) + PI / 2 + rand(-0.3, 0.3); e.lzDir = Math.random() < 0.5 ? 1 : -1;
        e.lzN = 2; e.lzLen = GB.laserLen; e.lzW = GB.laserW;
        e.lzSpin = GB.laserSpin * (ph >= 3 ? 1.15 : 1); e.lzT = GB.laserT * (ph >= 3 ? 1.15 : 1);
        e.phase = 'laserW'; e.phaseT = ph >= 3 ? 1.0 : 1.25;
        this.emit('enemyTelegraph', { e, kind: 'glaser', x: e.x, y: e.y, dx: Math.cos(e.lzA), dy: Math.sin(e.lzA), dur: e.phaseT, R: e.lzLen });
        this.msg('Double rayon : sortez de sa portée !');
        sfx('charge');
        break;
      }
      case 'rain': {
        // pluie sur toute l'arène, un météore sur trois vise le joueur
        const n = GB.rain[ph - 1] || 14, A = this.arena;
        for (let i = 0; i < n; i++) {
          let x, y, R = 82;
          if (i % 3 === 0 || !A) { const lead = p.moving ? rand(40, 110) : 0, a = Math.random() * TAU, r = i ? rand(20, 90) : 0; x = p.x + p.face.x * lead + Math.cos(a) * r; y = p.y + p.face.y * lead + Math.sin(a) * r; R = 72; }
          else { const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * (A.R - 60); x = A.x + Math.cos(a) * r; y = A.y + Math.sin(a) * r; }
          this.addBomb({ x, y, R, t: 1.05 + i * (1.7 / n), dmg: e.dmg * 0.8, kind: 'meteor', e, giga: true });
        }
        e.phase = 'rainW'; e.phaseT = 2.2;
        this.msg('Pluie de météores : sortez des cercles rouges !');
        break;
      }
      case 'gspiral':
        e.phase = 'gspiral'; e.phaseT = 3.2; e.spinUp = 0.6; e.spA = Math.random() * TAU; e.spT = 0;
        this.emit('enemyTelegraph', { e, kind: 'spiral', x: e.x, y: e.y, dx: 0, dy: 0, dur: 0.6, R: 0 });
        break;
      case 'spiral': // états du boss du monde (run.js)
        e.phase = 'spiral'; e.phaseT = 2.6 + 0.3 * ph; e.spinUp = 0.55; e.spA = Math.random() * TAU; e.spT = 0;
        this.emit('enemyTelegraph', { e, kind: 'spiral', x: e.x, y: e.y, dx: 0, dy: 0, dur: 0.55, R: 0 });
        break;
      case 'aim':
        e.dashes = ph;
        this.bossAim(e, nx, ny, 0.9);
        break;
      case 'ring':
        e.phase = 'ringW'; e.phaseT = 0.6;
        this.emit('enemyTelegraph', { e, kind: 'ring', x: e.x, y: e.y, dx: 0, dy: 0, dur: 0.6, R: 0 });
        break;
    }
  },

  // bond écrasant : le cercle d'atterrissage (bombe 'bonk') est posé tout de suite, devant le joueur s'il court
  gigaLeap(e, crouch) {
    const p = this.p, A = this.arena, lead = p.moving ? 70 : 0;
    let tx = p.x + p.face.x * lead, ty = p.y + p.face.y * lead;
    if (A) { const dx = tx - A.x, dy = ty - A.y, dd = Math.hypot(dx, dy) || 1, m = A.R - e.r * 0.65; if (dd > m) { tx = A.x + dx / dd * m; ty = A.y + dy / dd * m; } }
    e.phase = 'leapW'; e.phaseT = e.crouch = crouch; e.lx = tx; e.ly = ty;
    this.addBomb({ x: tx, y: ty, R: GB.bonkR, t: crouch + 0.95, dmg: e.dmg * GB.bonkDmg, kind: 'bonk', e, giga: true });
    this.emit('bossJump', { e });
  },

  // impacts des attaques de zone du giga boss (run.js updateBombs) : atterrissage « BONK ! »
  gigaImpact(b, hit) {
    if (b.kind !== 'bonk') return;
    const e = b.e;
    this.emit('gigaBonk', { e, x: b.x, y: b.y, R: b.R, hit });
    this.text(b.x, b.y, 120, 'BONK !', '#ffd54a', 2);
    this.burst(b.x, b.y, 34, 0, GIGA.pal[2], 5);
    this.shake = Math.max(this.shake, 18); sfx('gigaBonk'); buzz(70);
    if (e && !e.dead && e.gph >= 3) { // phase 3 : l'atterrissage projette un anneau de braises
      for (let i = 0, n = 10, o = Math.random(); i < n && this.eshots.length < 220; i++) {
        const a = (i + o) / n * TAU;
        this.eshots.push({ x: b.x, y: b.y, z: 30, vx: Math.cos(a) * 140, vy: Math.sin(a) * 140, r: 9, dmg: e.dmg * 0.45, life: 4 });
      }
    }
  },

  // le joueur est-il sur l'un des rayons ?
  laserOn(e) {
    const p = this.p, dx = p.x - e.x, dy = p.y - e.y;
    for (let i = 0; i < e.lzN; i++) {
      const a = e.lzA + i * TAU / e.lzN, cx = Math.cos(a), cy = Math.sin(a), along = dx * cx + dy * cy;
      if (along > 0 && along < e.lzLen && Math.abs(dy * cx - dx * cy) < e.lzW / 2 + p.r * 0.6) return true;
    }
    return false;
  },

  // onde à brèche : le joueur est-il dans l'ouverture ?
  inGap(w, p) { return Math.abs(angD(Math.atan2(p.y - w.y, p.x - w.x), w.gap)) < w.gw / 2; },

  // changement de phase : rugissement (invulnérable), nouvelle forme 3D, plus rapide ; phase 3 : rage et pluie de feu
  gigaPhase(e, ph) {
    e.gph = ph; e.bossPhase = ph;
    e.phase = 'groar'; e.phaseT = GB.roar; e.invuln = GB.roar;
    e.act = null; e.jumpH = 0; e.air = false; e.burrowed = false;
    e.mdl = GIGA_FORMS[Math.min(GIGA_FORMS.length, ph) - 1];
    e.flash = 0.4;
    if (ph >= 3) { e.enraged = true; e.speed *= 1.25; e.fireT = 1.5; } else e.speed *= 1.1;
    this.eshots = []; // un court répit : les projectiles en vol disparaissent dans l'explosion de l'armure
    this.emit('bossPhase', { e, phase: ph });
    this.emit('gigaPhase', { e, phase: ph, x: e.x, y: e.y });
    const bb = $('#bossbar');
    if (bb) { bb.classList.toggle('p2', ph === 2); bb.classList.toggle('p3', ph >= 3); }
    const lbl = $('#gbPh'); if (lbl) lbl.textContent = `Phase ${ph}/3`;
    this.banner(ph >= 3 ? `<small>${NAME} · phase 3/3</small>Le Roi des Bonks s'embrase !` : `<small>${NAME} · phase 2/3</small>Son armure vole en éclats !`, 2200, 'boss giga');
    this.burst(e.x, e.y, 60, 60, ph >= 3 ? '#ff5a1a' : GIGA.pal[0], 7);
    this.shake = 20; this.hitStop = 0.12;
    sfx('gigaBreak'); sfx('gigaRoar'); buzz(120);
  },

  // renforts : élites du monde dans l'arène (+ quelques monstres)
  gigaElites(e, n) {
    if (!n) return;
    const mons = this.zone.monsters, A = this.arena;
    for (let i = 0; i < n + 4 && this.enemies.length < 245; i++) {
      const a = i / (n + 4) * TAU + Math.random() * 0.3, r = i < n ? 170 : 110;
      let x = e.x + Math.cos(a) * r, y = e.y + Math.sin(a) * r;
      if (A) { const dx = x - A.x, dy = y - A.y, dd = Math.hypot(dx, dy) || 1, m = A.R - 60; if (dd > m) { x = A.x + dx / dd * m; y = A.y + dy / dd * m; } }
      const el = i < n ? this.addEnemy(mons[4], 4, { elite: true, x, y, inArena: true }) : this.addEnemy(mons[i % 4], i % 4, { x, y, inArena: true });
      if (i < n) this.emit('elite', { e: el });
    }
    this.burst(e.x, e.y, 30, 30, '#c06aff', 5);
    this.msg(`${GIGA.name} appelle ses champions !`);
  },

  // à chaque image tant qu'il vit (run.js update) : phase 3, météores sur le joueur
  gigaTick(dt) {
    const e = this.boss, p = this.p;
    if (e.gph < 3 || e.phase === 'groar' || this.dying || this.entering) return;
    if ((e.fireT -= dt) > 0) return;
    e.fireT = GB.fire * rand(0.85, 1.15);
    const lead = p.moving ? rand(50, 110) : 0;
    this.addBomb({ x: p.x + p.face.x * lead + rand(-30, 30), y: p.y + p.face.y * lead + rand(-30, 30), R: 70, t: 1.15, dmg: e.dmg * 0.6, kind: 'meteor', e, giga: true });
  },

  // barre de vie (HUD, toutes les 3 images) : brille quand il est invulnérable
  gigaHud(b) {
    const inv = this.boss.invuln > 0;
    if (inv !== b._inv) { b._inv = inv; b.classList.toggle('inv', inv); }
  },

  // ---------- Victoire de l'expédition ----------
  gigaDown(e) {
    const A = this.arena || { x: e.x, y: e.y, R: GB.arena }, z = this.zone, p = this.p, T = this.track;
    if (!this.cleared.includes(z.id)) this.cleared.push(z.id);
    const fight = Math.max(0, this.time - (this.gigaT0 ?? this.time));
    T.bossKills++; T.giga = 1; T.gigaFight = Math.round(fight); T.gigaDance = this.gigaLaserHit ? 0 : 1;
    if (fight > 0 && (!T.bossFast || fight < T.bossFast)) T.bossFast = Math.round(fight * 10) / 10;
    if (this.totems?.length && this.totems.every(t => t.used)) T.totemBoss = 1;
    this.gigaWon = true;
    this.arena = null; this.cine = null; this.cineT = 0;
    this.celebT = 3.6; this.celebK = 0.2; this.hitStop = 0; // long ralenti (frame)
    // ses troupes tombent avec lui
    for (const o of this.enemies) if (!o.dead && o !== e) this.hitEnemy(o, 1e7, { quiet: true, noCrit: true });
    this.eshots = []; this.bombs = []; this.waves = [];
    // récompenses : Giga coffre (devant), coffres en or (+ un par niveau de difficulté), pluie d'or, énorme gemme
    this.pickups.push({ type: 'xp', x: e.x, y: e.y, v: 80 * (1 + z.id) * (1 + this.stage), spin: 0 });
    const g = Math.max(1, Math.round((6 + z.id * 3) * 2.5 * this.base.gold * this.diff.gold * this.wm.gold * (this.lv?.gold || 1)));
    for (let i = 0; i < 14; i++) { const a = i / 14 * TAU, r = 60 + (i % 2) * 40; this.pickups.push({ type: 'gold', x: A.x + Math.cos(a) * r, y: A.y + Math.sin(a) * r, v: g }); }
    this.dropLoot(A.x, A.y + 120, 3, { boss: true, giga: 1 });
    const tiers = [2, ...Array.from({ length: this.diffId }, () => (Math.random() < 0.5 ? 2 : 1))];
    tiers.forEach((t, i) => { const a = -PI / 2 + (i - (tiers.length - 1) / 2) * 0.6; this.dropLoot(A.x + Math.cos(a) * 130, A.y + Math.sin(a) * 130, t, { boss: true }); });
    // portail de retour au centre de l'arène, une fois la fête lancée (âge négatif = ouverture retardée)
    this.portal = { x: A.x, y: A.y, R: 70, charge: 0, t: -2.4, home: true };
    this.emit('bossDeath', { e, x: e.x, y: e.y });
    this.emit('gigaDeath', { e, x: e.x, y: e.y });
    this.emit('win', {});
    setTimeout(() => { if (!this.over && this.portal) { this.emit('portalOpen', { x: A.x, y: A.y }); sfx('portal'); } }, 2400);
    const bb = $('#bossbar'); if (bb) { bb.hidden = true; bb.classList.remove('giga', 'p2', 'p3', 'inv'); }
    this.gigaCard('Le Giga coffre vous attend · le portail s\'ouvre', true);
    this.shake = 24;
    p.inv = Math.max(p.inv, 4);
    p.hp = p.maxHp;
    stopMusic(); sfx('gigaWin'); buzz(220);
    setTimeout(() => { if (!this.over && this.gigaWon) music('menu'); }, 4200);
  },
};
