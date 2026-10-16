// Combat au tour par tour avec frappe « bonk » en rythme et parade.
import { CLASSES, SPELLS, PETS } from './data.js';
import { save, playerStats } from './save.js';
import { heroURL, creatureURL, iconURL, iconImg } from './art.js';
import { sfx, buzz } from './audio.js';
import { mount, $, wait, fmt, esc } from './ui.js';
import { sceneryURL } from './scenery.js';

const INTENT_INFO = {
  atk:    { icon: 'i_atk', label: 'Attaque', mult: 1 },
  heavy:  { icon: 'i_heavy', label: 'Coup lourd', mult: 1.7 },
  multi:  { icon: 'i_multi', label: 'Rafale ×3', mult: 0.45, hits: 3 },
  burn:   { icon: 'i_burn', label: 'Brûlure', mult: 0.6, dot: 'burn' },
  poison: { icon: 'i_poison', label: 'Poison', mult: 0.5, dot: 'poison' },
  heal:   { icon: 'i_heal', label: 'Se soigne', mult: 0 },
  guard:  { icon: 'i_guard', label: 'Garde', mult: 0.5 },
  enrage: { icon: 'i_enrage', label: 'Rage', mult: 0 },
  drain:  { icon: 'i_drain', label: 'Vol de vie', mult: 0.9 },
};

const TIMING = { perfect: 1.5, good: 1, miss: 0.6 };

export class Battle {
  constructor({ zone, enemy, isBoss, step, total, onWin, onDefeat, onPause }) {
    const st = playerStats();
    const run = save.run;
    this.zone = zone;
    this.cls = CLASSES[save.cls];
    this.isBoss = isBoss;
    this.step = step; this.total = total;
    this.onWin = onWin; this.onDefeat = onDefeat; this.onPause = onPause;
    this.pet = save.pet ? PETS[save.pet] : null;
    this.p = {
      maxHp: st.hp, hp: Math.min(run.hp ?? st.hp, st.hp),
      atk: Math.round(st.atk * (1 + run.buffs.atk)), crit: st.crit,
      regen: st.regen + run.buffs.regen, mana: 40, maxMana: 100,
      ult: run.ult || 0, shield: 0, dots: [],
    };
    const tier = (save.zoneCleared[zone.id] ? 1.15 : 1); // rejouer une zone : un peu plus dur, plus d'or
    const hpMul = tier * (1.2 + zone.id * 0.35), atkMul = tier * (1.45 + zone.id * 0.3);
    this.e = {
      ...enemy, maxHp: Math.round(enemy.hp * hpMul), hp: Math.round(enemy.hp * hpMul),
      atk: Math.round(enemy.atk * atkMul), guard: false, stun: 0, weak: 0, burn: 0, rage: 0, intent: null, last: [],
    };
    this.turn = 0;
    this.cd = {};
    this.busy = true;
    this.over = false;
    this.seed = `${zone.id}-${step}-${enemy.name}`;
  }

  // ---------- Rendu ----------
  start() {
    const z = this.zone, e = this.e;
    mount(`
      <div class="battle bg-${z.bg}" style="--sky1:${z.sky[0]};--sky2:${z.sky[1]};--g1:${z.ground[0]};--g2:${z.ground[1]}">
        <header class="b-top">
          <button class="icon-btn" id="pauseBtn" aria-label="Pause"><i class="pause-ic"></i></button>
          <div class="b-progress">
            <div class="b-zone">${esc(z.name)}</div>
            <div class="dots">${Array.from({ length: this.total }, (_, i) => `<i class="${i < this.step ? 'done' : i === this.step ? 'cur' : ''} ${z.boss && i === this.total - 1 ? 'boss' : ''}"></i>`).join('')}</div>
          </div>
          <div class="b-potion"><button class="potion-btn" id="potionBtn">${iconImg('potion', 22)}<b id="potionN">${save.run.potions}</b></button></div>
        </header>

        <section class="arena">
          <div class="scenery" style="background-image:url(${sceneryURL(z)})"></div>
          <div class="fighter enemy ${this.isBoss ? 'is-boss' : ''} ${e.elite ? 'is-elite' : ''}" id="enemy">
            <div class="nameplate">
              <div class="nm">${this.isBoss ? '<span class="tag boss">BOSS</span>' : e.elite ? '<span class="tag elite">ÉLITE</span>' : ''}${esc(e.name)}</div>
              <div class="hpbar" id="eHp"><div class="fill"></div><div class="ghost"></div><span></span></div>
              <div class="chips" id="eChips"></div>
            </div>
            <div class="intent" id="intent"></div>
            <div class="sprite-wrap"><img class="px sprite" id="eSprite" src="${creatureURL(this.seed, e.body, e.pal, { boss: this.isBoss })}" alt=""></div>
            <div class="shadow"></div>
          </div>
          <div class="fighter hero" id="hero">
            ${this.pet ? `<img class="px pet" id="petSprite" src="${creatureURL('pet-' + save.pet, this.pet.body, this.pet.pal)}" alt="">` : ''}
            <div class="sprite-wrap"><img class="px sprite" id="hSprite" src="${heroURL(this.cls.id, this.cls.colors)}" alt=""></div>
            <div class="shadow"></div>
            <div class="parry" id="parry"><span>PARER !</span></div>
          </div>
          <div class="fx-layer" id="fx"></div>
          <div class="banner" id="banner"></div>
        </section>

        <section class="panel">
          <div class="hero-stats">
            <div class="who">${iconImg(this.cls.id === 'mage' ? 'staff' : this.cls.id === 'archer' ? 'bow' : 'sword', 18)} ${esc(this.cls.name)}</div>
            <div class="hpbar player" id="pHp"><div class="fill"></div><div class="ghost"></div><div class="shield"></div><span></span></div>
            <div class="row2">
              <div class="manabar" id="pMana"><div class="fill"></div><span></span></div>
              <div class="chips" id="pChips"></div>
            </div>
          </div>
          <div class="hint" id="hint">&nbsp;</div>
          <div class="timing" id="timing" hidden>
            <div class="t-label">Touchez n'importe où quand le curseur est sur l'<b>or</b> !</div>
            <div class="t-bar"><div class="t-good"></div><div class="t-perfect"></div><div class="t-cursor" id="tCursor"></div></div>
            <div class="t-legend"><span class="lg-p">Parfait ×1,5</span><span class="lg-g">Bien ×1</span><span class="lg-m">Raté ×0,6</span></div>
          </div>
          <div class="spells" id="spells">
            ${this.cls.spells.map(id => this.spellBtn(id)).join('')}
          </div>
        </section>
      </div>`);

    this.root = $('.battle');
    this.root.addEventListener('pointerdown', ev => this.onPointer(ev));
    $('#spells').addEventListener('click', ev => {
      const b = ev.target.closest('.spell');
      if (b) this.cast(b.dataset.id);
    });
    $('#potionBtn').addEventListener('click', () => this.drinkPotion());
    $('#pauseBtn').addEventListener('click', () => { if (!this.over) this.onPause(); });
    this.chooseIntent();
    this.refresh(true);
    this.intro();
  }

  spellBtn(id) {
    const s = SPELLS[id];
    const cost = s.kind === 'ult' ? `<em class="cost ult">ULTIME</em>` : s.cost ? `<em class="cost">${iconImg('mana', 12)}${s.cost}${s.cd ? ` · ${s.cd}t` : ''}</em>` : `<em class="cost free">Gratuit</em>`;
    return `<button class="spell k-${s.kind}" data-id="${id}">
      <span class="ic">${iconImg(s.icon, 30)}${s.kind === 'ult' ? '<svg class="ring" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16"/></svg>' : ''}</span>
      <span class="txt"><strong>${esc(s.name)}</strong><small>${esc(s.short)}</small></span>
      ${cost}
    </button>`;
  }

  async intro() {
    const z = this.zone;
    await this.banner(this.isBoss ? `<small>${esc(this.e.title || 'Boss')}</small>${esc(this.e.name)}` : `Combat ${this.step + 1}/${this.total}`, this.isBoss ? 1500 : 900, this.isBoss ? 'boss' : '');
    this.playerTurn(true);
  }

  async banner(html, ms = 900, cls = '') {
    const b = $('#banner');
    b.className = 'banner show ' + cls;
    b.innerHTML = `<div>${html}</div>`;
    await wait(ms);
    b.className = 'banner';
  }

  hint(t, cls = '') { const h = $('#hint'); if (h) { h.textContent = t; h.className = 'hint ' + cls; } }

  setBar(sel, cur, max, extra) {
    const el = $(sel); if (!el) return;
    const p = Math.max(0, Math.min(1, cur / max)) * 100;
    el.querySelector('.fill').style.width = p + '%';
    const g = el.querySelector('.ghost'); if (g) g.style.width = p + '%';
    el.querySelector('span').textContent = `${fmt(Math.max(0, cur))} / ${fmt(max)}` + (extra || '');
  }

  refresh() {
    const p = this.p, e = this.e;
    this.setBar('#pHp', p.hp, p.maxHp, p.shield > 0 ? `  +${fmt(p.shield)}` : '');
    $('#pHp .shield').style.width = Math.min(100, p.shield / p.maxHp * 100) + '%';
    $('#pHp').classList.toggle('low', p.hp / p.maxHp < 0.3);
    this.setBar('#pMana', p.mana, p.maxMana);
    this.setBar('#eHp', e.hp, e.maxHp);
    $('#potionN').textContent = save.run.potions;
    $('#potionBtn').classList.toggle('disabled', save.run.potions <= 0 || p.hp >= p.maxHp);

    // statuts
    const chip = (ic, n, t) => `<span class="chip" title="${t}">${iconImg(ic, 14)}${n != null ? `<b>${n}</b>` : ''}</span>`;
    $('#pChips').innerHTML = p.dots.map(d => chip(d.type === 'burn' ? 'i_burn' : 'i_poison', d.turns, d.type)).join('');
    $('#eChips').innerHTML = [
      e.stun ? chip('i_stun', e.stun, 'Étourdi') : '',
      e.weak ? chip('frost', e.weak, 'Affaibli') : '',
      e.guard ? chip('i_guard', null, 'Garde') : '',
      e.rage ? chip('i_enrage', '+' + e.rage * 25 + '%', 'Rage') : '',
      e.burn ? chip('i_burn', e.burn, 'Brûlure') : '',
    ].join('');

    // intention
    const it = $('#intent');
    if (e.stun) it.innerHTML = `${iconImg('i_stun', 18)}<span>Étourdi</span>`;
    else if (e.intent) {
      const info = INTENT_INFO[e.intent];
      const dmg = this.intentDamage(e.intent);
      it.innerHTML = `${iconImg(info.icon, 18)}<span>${info.label}${dmg ? ` <b>${dmg}</b>` : ''}</span>`;
      it.className = 'intent t-' + e.intent;
    }

    // sorts
    for (const b of this.root.querySelectorAll('.spell')) {
      const s = SPELLS[b.dataset.id];
      let ok = !this.busy;
      if (s.kind === 'skill') ok = ok && p.mana >= s.cost && !(this.cd[b.dataset.id] > 0);
      const cdv = this.cd[b.dataset.id] || 0;
      let cdEl = b.querySelector('.cd');
      if (cdv > 0) { if (!cdEl) { cdEl = document.createElement('span'); cdEl.className = 'cd'; b.querySelector('.ic').appendChild(cdEl); } cdEl.textContent = cdv; }
      else if (cdEl) cdEl.remove();
      if (s.kind === 'ult') {
        ok = ok && p.ult >= 100;
        const c = b.querySelector('.ring circle');
        c.style.strokeDashoffset = 100.5 * (1 - p.ult / 100);
        b.classList.toggle('ready', p.ult >= 100);
      }
      b.classList.toggle('disabled', !ok);
      b.classList.toggle('nomana', s.kind === 'skill' && p.mana < s.cost);
    }
  }

  intentDamage(kind) {
    const info = INTENT_INFO[kind];
    if (!info.mult) return 0;
    return Math.max(1, Math.round(this.enemyAtk() * info.mult));
  }

  enemyAtk() {
    const e = this.e;
    return e.atk * (1 + e.rage * 0.25) * (e.weak ? 0.7 : 1);
  }

  chooseIntent() {
    const e = this.e;
    let pool = e.moves.slice();
    if (e.hp >= e.maxHp * 0.85) pool = pool.filter(m => m !== 'heal');
    if (e.rage >= 2) pool = pool.filter(m => m !== 'enrage');
    // éviter de répéter deux fois la même action spéciale
    const last = e.last[e.last.length - 1];
    if (last && last !== 'atk' && pool.length > 1) pool = pool.filter(m => m !== last);
    if (!pool.length) pool = ['atk'];
    const r = Math.random();
    // les premières attaques sont simples pour laisser le temps de comprendre
    e.intent = this.turn === 0 && pool.includes('atk') ? 'atk' : pool[Math.floor(r * pool.length)];
  }

  // ---------- Tour du joueur ----------
  async playerTurn(first = false) {
    if (this.over) return;
    const p = this.p;
    if (!first) {
      p.mana = Math.min(p.maxMana, p.mana + p.regen);
      for (const k in this.cd) if (this.cd[k] > 0) this.cd[k]--;
      p.shield = 0; // le bouclier ne dure qu'un tour ennemi
      // effets sur la durée
      for (const d of p.dots) {
        await this.damagePlayer(d.dmg, { dot: d.type });
        d.turns--;
        if (this.over) return;
      }
      p.dots = p.dots.filter(d => d.turns > 0);
    }
    this.busy = false;
    const tut = !save.tutorialDone;
    this.hint(tut && first ? 'À vous ! Touchez une attaque en bas.' : 'À vous ! Choisissez une action.', 'you');
    this.refresh();
  }

  async cast(id) {
    if (this.busy || this.over) return;
    const s = SPELLS[id], p = this.p, e = this.e;
    if (s.kind === 'skill' && p.mana < s.cost) { this.hint('Pas assez de mana — utilisez une attaque gratuite.', 'warn'); buzz(30); return; }
    if (s.kind === 'ult' && p.ult < 100) { this.hint('Ultime pas encore chargé : frappez et encaissez pour le remplir.', 'warn'); return; }
    if (this.cd[id] > 0) { this.hint(`${s.name} sera prêt dans ${this.cd[id]} tour${this.cd[id] > 1 ? 's' : ''}.`, 'warn'); return; }
    this.busy = true;
    this.refresh();
    if (s.kind === 'skill') p.mana -= s.cost;
    if (s.cd) this.cd[id] = s.cd;
    if (s.kind === 'ult') { p.ult = 0; save.stats.ults++; sfx('ult'); this.flash('ult'); await this.banner(esc(s.name), 700, 'ult'); }
    else p.ult = Math.min(100, p.ult + this.ultGain(18));

    // soin / bouclier
    if (s.shield) {
      p.shield += Math.round(p.maxHp * s.shield);
      if (s.heal) this.healPlayer(Math.round(p.maxHp * s.heal));
      sfx('block');
      this.fxShield();
      this.float('#hero', `+${Math.round(p.maxHp * s.shield)}`, 'shield');
      this.refresh();
      await wait(500);
    }

    if (s.mult) {
      // frappe en rythme
      const t = await this.timing();
      const res = t === 'perfect' ? 'PARFAIT !' : t === 'good' ? 'Bien !' : 'Raté…';
      this.hint(res, t);
      if (t === 'perfect') { save.stats.perfects++; sfx('perfect'); } else if (t === 'miss') sfx('miss');
      const hits = s.hits || 1;
      $('#hero').classList.add('lunge');
      for (let i = 0; i < hits; i++) {
        this.projectile(s.fx);
        await wait(hits > 1 ? 170 : 240);
        let dmg = p.atk * s.mult * TIMING[t] * (0.92 + Math.random() * 0.16);
        if (s.execute) dmg += (e.maxHp - e.hp) * s.execute;
        const crit = Math.random() < p.crit + (t === 'perfect' ? 0.1 : 0);
        if (crit) dmg *= 1.75;
        if (e.guard) dmg *= 0.5;
        dmg = Math.max(1, Math.round(dmg));
        this.damageEnemy(dmg, crit);
        if (e.hp <= 0) break;
      }
      $('#hero').classList.remove('lunge');
      if (e.hp > 0) {
        if (s.stun) { e.stun = Math.max(e.stun, s.stun); this.float('#enemy', 'Étourdi !', 'status'); }
        if (s.weak) { e.weak = Math.max(e.weak, s.weak); this.float('#enemy', 'Affaibli !', 'status'); }
      }
      this.refresh();
      await wait(450);
    }
    if (e.hp <= 0) return this.win();

    // familier
    if (this.pet) await this.petAct();
    if (e.hp <= 0) return this.win();
    if (!save.tutorialDone && this.turn >= 1) { save.tutorialDone = true; }
    await this.enemyTurn();
  }

  ultGain(n) { return save.pet === 'voidy' ? n * 2 : n; }

  async petAct() {
    const p = this.p, e = this.e, id = save.pet;
    const ps = $('#petSprite'); ps?.classList.add('hop');
    await wait(250);
    if (id === 'poro') { const h = Math.round(p.maxHp * 0.03); if (p.hp < p.maxHp) this.healPlayer(h); }
    if (id === 'brambi') { e.burn = 3; this.float('#enemy', 'Brûlure', 'status'); }
    if (id === 'herald') { this.damageEnemy(Math.max(1, Math.round(p.atk * 0.4)), false); }
    if (id === 'phenix') { p.mana = Math.min(p.maxMana, p.mana + 8); this.float('#hero', '+8 mana', 'mana'); }
    if (id === 'wisp') { const s = Math.round(p.maxHp * 0.04); p.shield += s; this.float('#hero', `+${s}`, 'shield'); }
    if (id === 'voidy') { /* passif */ }
    this.refresh();
    ps?.classList.remove('hop');
    await wait(id === 'voidy' ? 0 : 300);
  }

  // Mini-jeu de timing : renvoie 'perfect' | 'good' | 'miss'
  timing() {
    return new Promise(resolve => {
      const box = $('#timing'), cur = $('#tCursor');
      box.hidden = false;
      this.hint('Maintenant… touchez !', 'go');
      const period = Math.max(900, 1300 - this.zone.id * 60);
      const t0 = performance.now();
      let done = false;
      const posAt = now => {
        const t = ((now - t0) % period) / period;
        return t < 0.5 ? t * 2 : 2 - t * 2; // aller-retour 0..1..0
      };
      const finish = res => {
        if (done) return;
        done = true;
        this.tapHandler = null;
        box.classList.add('res-' + res);
        setTimeout(() => { box.hidden = true; box.classList.remove('res-' + res); }, 380);
        resolve(res);
      };
      const loop = now => {
        if (done) return;
        cur.style.left = (posAt(now) * 100) + '%';
        if (now - t0 > period * 2.5) return finish('miss');
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
      // petite période de grâce pour éviter le tap accidentel du bouton
      setTimeout(() => {
        this.tapHandler = () => {
          const d = Math.abs(posAt(performance.now()) - 0.5);
          finish(d < 0.07 ? 'perfect' : d < 0.22 ? 'good' : 'miss');
        };
      }, 120);
    });
  }

  onPointer(ev) {
    if (this.tapHandler && !ev.target.closest('#pauseBtn')) { ev.preventDefault(); this.tapHandler(); }
  }

  // ---------- Tour ennemi ----------
  async enemyTurn() {
    if (this.over) return;
    const e = this.e, p = this.p;
    if (window.LOB_DEBUG) console.log('LOG eturn', e.name, e.intent, 'stun', e.stun, 'ehp', e.hp, '/', e.maxHp, 'atk', e.atk);
    this.turn++;
    e.guard = false;
    await wait(250);
    if (e.stun) {
      e.stun--;
      this.hint(`${e.name} est étourdi et passe son tour.`, '');
      this.float('#enemy', 'Étourdi', 'status');
      this.refresh();
      await wait(700);
    } else {
      const kind = e.intent, info = INTENT_INFO[kind];
      e.last.push(kind);
      const el = $('#enemy');
      if (kind === 'heal') {
        const h = Math.round(e.maxHp * 0.18);
        e.hp = Math.min(e.maxHp, e.hp + h);
        sfx('heal'); this.float('#enemy', `+${h}`, 'heal');
        this.hint(`${e.name} se soigne.`);
        this.refresh(); await wait(700);
      } else if (kind === 'enrage') {
        e.rage++;
        el.classList.add('rage'); setTimeout(() => el.classList.remove('rage'), 600);
        this.float('#enemy', 'Rage !', 'status');
        this.hint(`${e.name} enrage : ses attaques sont plus fortes !`, 'warn');
        this.refresh(); await wait(800);
      } else {
        const dmgEach = this.intentDamage(kind);
        const hits = info.hits || 1;
        this.hint('Attention ! Touchez PARER pour réduire les dégâts.', 'warn');
        const blocked = await this.parry(kind === 'heavy');
        let total = 0;
        for (let i = 0; i < hits; i++) {
          el.classList.add('attack');
          await wait(160);
          el.classList.remove('attack');
          let d = dmgEach;
          if (blocked) d = Math.round(d * 0.5);
          total += await this.damagePlayer(d, { blocked });
          if (this.over) return;
          await wait(hits > 1 ? 120 : 200);
        }
        if (info.dot) {
          const turns = 3;
          const dd = Math.max(1, Math.round(e.atk * (info.dot === 'burn' ? 0.25 : 0.3) * (blocked ? 0.5 : 1)));
          const ex = p.dots.find(x => x.type === info.dot);
          if (ex) { ex.turns = turns; ex.dmg = Math.max(ex.dmg, dd); } else p.dots.push({ type: info.dot, turns, dmg: dd });
          this.float('#hero', info.dot === 'burn' ? 'Brûlé !' : 'Empoisonné !', 'status');
        }
        if (kind === 'drain' && total > 0) { e.hp = Math.min(e.maxHp, e.hp + total); this.float('#enemy', `+${total}`, 'heal'); }
        if (kind === 'guard') { e.guard = true; this.float('#enemy', 'Garde', 'status'); }
        this.refresh();
        await wait(350);
      }
    }
    // brûlure du familier
    if (e.burn) {
      e.burn--;
      this.damageEnemy(Math.max(1, Math.round(p.atk * 0.18)), false, 'burn');
      await wait(300);
      if (e.hp <= 0) return this.win();
    }
    if (e.weak) e.weak--;
    this.chooseIntent();
    this.refresh();
    this.playerTurn();
  }

  // Mini-jeu de parade : renvoie true si paré
  parry(heavy) {
    return new Promise(resolve => {
      const el = $('#parry');
      let state = 'wait'; // wait -> open -> done
      const delay = 350 + Math.random() * 650;
      const windowMs = heavy ? 420 : 520;
      el.className = 'parry armed';
      this.tapHandler = () => {
        if (state === 'wait') { state = 'done'; el.className = 'parry early'; el.querySelector('span').textContent = 'Trop tôt !'; sfx('miss'); }
        else if (state === 'open') { state = 'done'; el.className = 'parry ok'; el.querySelector('span').textContent = 'Paré !'; sfx('block'); buzz(20); end(true); }
      };
      const end = ok => {
        this.tapHandler = null;
        setTimeout(() => { el.className = 'parry'; el.querySelector('span').textContent = 'PARER !'; }, 450);
        resolve(ok);
      };
      setTimeout(() => {
        if (state === 'done') { end(false); return; }
        state = 'open'; el.className = 'parry open';
        setTimeout(() => { if (state === 'open') { state = 'done'; end(false); } }, windowMs);
      }, delay);
    });
  }

  // ---------- Dégâts / soins ----------
  damageEnemy(dmg, crit, type) {
    const e = this.e;
    e.hp = Math.max(0, e.hp - dmg);
    const el = $('#enemy');
    el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit');
    sfx(crit ? 'perfect' : 'bonk'); buzz(crit ? 25 : 10);
    this.float('#enemy', (crit ? 'CRIT ' : '') + fmt(dmg), crit ? 'crit' : type || 'dmg');
    this.p.ult = Math.min(100, this.p.ult); // déjà géré au lancement
    this.refresh();
  }

  async damagePlayer(dmg, { blocked = false, dot = null } = {}) {
    const p = this.p;
    let left = dmg;
    if (p.shield > 0 && !dot) { const a = Math.min(p.shield, left); p.shield -= a; left -= a; }
    p.hp = Math.max(0, p.hp - left);
    if (window.LOB_DEBUG) console.log('LOG hit', this.e.name, 'dmg', dmg, 'left', left, 'hp', p.hp, blocked ? 'blocked' : '', dot || '');
    p.ult = Math.min(100, p.ult + this.ultGain(dot ? 0 : 12));
    const el = $('#hero');
    el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit');
    if (!dot) { sfx(blocked ? 'block' : 'hurt'); buzz(blocked ? 10 : 35); }
    this.float('#hero', left > 0 ? '-' + fmt(left) : 'Absorbé', dot || (blocked ? 'blocked' : 'hurt'));
    if (!dot) this.shake();
    this.refresh();
    if (p.hp <= 0) { await wait(500); await this.lose(); }
    return left;
  }

  healPlayer(n) {
    const p = this.p;
    const real = Math.min(n, p.maxHp - p.hp);
    p.hp += real;
    if (real > 0) { this.float('#hero', '+' + real, 'heal'); sfx('heal'); }
    this.refresh();
  }

  drinkPotion() {
    if (this.busy || this.over) return;
    if (save.run.potions <= 0) { this.hint('Plus de potion pour cette expédition.', 'warn'); return; }
    if (this.p.hp >= this.p.maxHp) { this.hint('Vos PV sont déjà au maximum.', ''); return; }
    save.run.potions--;
    this.healPlayer(Math.round(this.p.maxHp * 0.4));
    this.p.dots = [];
    this.hint('Potion bue : +40 % PV, effets retirés. Ça ne coûte pas votre tour.', 'you');
    this.refresh();
  }

  // ---------- Effets visuels ----------
  float(sel, txt, cls) {
    const host = $(sel); if (!host) return;
    const f = document.createElement('div');
    f.className = 'float ' + cls;
    f.textContent = txt;
    f.style.setProperty('--dx', (Math.random() * 40 - 20) + 'px');
    host.appendChild(f);
    setTimeout(() => f.remove(), 1000);
  }

  projectile(kind) {
    const fx = $('#fx');
    const d = document.createElement('div');
    d.className = 'proj p-' + kind;
    fx.appendChild(d);
    setTimeout(() => d.remove(), 420);
  }

  fxShield() {
    const s = document.createElement('div');
    s.className = 'bubble';
    $('#hero').appendChild(s);
    setTimeout(() => s.remove(), 800);
  }

  flash(kind) {
    const f = document.createElement('div');
    f.className = 'screen-flash ' + kind;
    this.root.appendChild(f);
    setTimeout(() => f.remove(), 700);
  }

  shake() { this.root.classList.remove('shake'); void this.root.offsetWidth; this.root.classList.add('shake'); }

  // ---------- Fin ----------
  async win() {
    if (this.over) return;
    this.over = true; this.busy = true;
    this.tapHandler = null;
    $('#enemy').classList.add('dead');
    this.hint('Victoire !', 'perfect');
    sfx('win');
    save.tutorialDone = true;
    await wait(900);
    this.onWin({ hp: this.p.hp, ult: this.p.ult });
  }

  async lose() {
    if (this.over) return;
    this.over = true; this.busy = true;
    this.tapHandler = null;
    $('#hero').classList.add('dead');
    sfx('lose');
    this.hint('K.O.', 'warn');
    await wait(700);
    this.onDefeat();
  }

  // appelée après la pub : on repart à pleine santé
  revive() {
    this.over = false;
    const p = this.p;
    p.hp = p.maxHp; p.dots = []; p.shield = 0; p.mana = p.maxMana;
    $('#hero').classList.remove('dead');
    this.healPlayer(0);
    this.float('#hero', 'Ressuscité !', 'heal');
    sfx('heal');
    this.chooseIntent();
    this.playerTurn(true);
  }

  resume() { this.refresh(); }
}
