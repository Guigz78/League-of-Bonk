// Sound design cartoon : tout est synthétisé (aucun fichier, fonctionne hors ligne).
// Kazoo, sifflet à coulisse, coin-coin, boing, trombone triste… + musique entraînante par zone.
import { save } from './save.js';

let ctx = null, master = null, sfxBus = null, musicBus = null;
const now = () => ctx.currentTime;

function ac() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.15;
    master = ctx.createGain(); master.gain.value = 0.9;
    sfxBus = ctx.createGain(); sfxBus.gain.value = 1;
    musicBus = ctx.createGain(); musicBus.gain.value = 0.55;
    sfxBus.connect(comp); musicBus.connect(comp); comp.connect(master); master.connect(ctx.destination);
    // iOS : le son ne démarre qu'après un geste de l'utilisateur
    const unlock = () => { ctx.resume(); };
    window.addEventListener('pointerdown', unlock, { passive: true });
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// ---------- Briques de base ----------
let voices = 0;
function osc({ type = 'square', f = 440, to = null, curve = 'exp', d = 0.15, v = 0.15, at = 0, attack = 0.005, vib = 0, vibRate = 7, filter = null, q = 1, bus = sfxBus, slideAt = 0 }) {
  if (voices > 24) return;
  const t = now() + at;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t + slideAt);
  if (to) {
    if (curve === 'exp') o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + d);
    else o.frequency.linearRampToValueAtTime(to, t + d);
  }
  if (vib) {
    const l = ctx.createOscillator(), lg = ctx.createGain();
    l.frequency.value = vibRate; lg.gain.value = vib;
    l.connect(lg).connect(o.frequency); l.start(t); l.stop(t + d + 0.05);
  }
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + attack);
  g.gain.setValueAtTime(v, t + Math.max(attack, d * 0.6));
  g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  let node = o;
  if (filter) {
    const fl = ctx.createBiquadFilter();
    fl.type = filter[0]; fl.frequency.value = filter[1]; fl.Q.value = q;
    node.connect(fl); node = fl;
  }
  node.connect(g).connect(bus);
  o.start(t); o.stop(t + d + 0.05);
  voices++; o.onended = () => voices--;
}

let noiseBuf = null;
function noise({ d = 0.1, v = 0.15, at = 0, filter = ['bandpass', 1200], q = 1, sweepTo = null, bus = sfxBus }) {
  if (voices > 24) return;
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const t = now() + at;
  const s = ctx.createBufferSource(), g = ctx.createGain(), fl = ctx.createBiquadFilter();
  s.buffer = noiseBuf;
  fl.type = filter[0]; fl.frequency.setValueAtTime(filter[1], t); fl.Q.value = q;
  if (sweepTo) fl.frequency.exponentialRampToValueAtTime(sweepTo, t + d);
  g.gain.setValueAtTime(v, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  s.connect(fl).connect(g).connect(bus);
  s.start(t, Math.random() * 0.5); s.stop(t + d + 0.02);
  voices++; s.onended = () => voices--;
}

// Kazoo : dent de scie filtrée qui « bzzz » avec un vibrato
const kazoo = (f, d, at = 0, v = 0.09, to = null) => {
  osc({ type: 'sawtooth', f, to, curve: 'lin', d, v, at, attack: 0.02, vib: f * 0.025, vibRate: 6, filter: ['bandpass', 1300], q: 2.2 });
  osc({ type: 'square', f: f * 2, to: to ? to * 2 : null, curve: 'lin', d, v: v * 0.25, at, attack: 0.02, filter: ['bandpass', 2400], q: 4 });
};
// Sifflet à coulisse
const whistle = (f, to, d, at = 0, v = 0.1) => osc({ type: 'sine', f, to, curve: 'exp', d, v, at, attack: 0.01, vib: 8, vibRate: 9 });
// Coin-coin de canard (canard en plastique)
const quack = (f, at = 0, v = 0.12) => {
  osc({ type: 'square', f, to: f * 0.62, d: 0.12, v, at, filter: ['bandpass', 1100], q: 3 });
  osc({ type: 'sawtooth', f: f * 1.5, to: f * 0.9, d: 0.1, v: v * 0.4, at, filter: ['bandpass', 2200], q: 5 });
};
// Boing de ressort
const boing = (f, d = 0.35, at = 0, v = 0.12) => osc({ type: 'sine', f, to: f * 2.2, curve: 'exp', d, v, at, vib: f * 0.35, vibRate: 22 });
// Bloc de bois « tok »
const wood = (f = 800, at = 0, v = 0.16) => { osc({ type: 'sine', f, to: f * 0.7, d: 0.07, v, at }); noise({ d: 0.03, v: v * 0.5, at, filter: ['bandpass', f * 2], q: 6 }); };
// Pouet de klaxon
const honk = (f, d = 0.18, at = 0, v = 0.1) => {
  osc({ type: 'sawtooth', f, d, v, at, attack: 0.01, filter: ['lowpass', 1600], q: 6 });
  osc({ type: 'sawtooth', f: f * 1.26, d, v: v * 0.8, at, attack: 0.01, filter: ['lowpass', 1600], q: 6 });
};
const pop = (f = 600, at = 0, v = 0.14) => osc({ type: 'sine', f, to: f * 3, d: 0.06, v, at });

// ---------- Effets ----------
let combo = 0, comboT = 0;
const r = (a, b) => a + Math.random() * (b - a);

const SFX = {
  tap: () => pop(r(700, 900), 0, 0.09),
  // voix du mode histoire (bulles de dialogue) : champion, Pompon (aiguë), boss (grave)
  talk: () => { pop(r(420, 520), 0, 0.06); pop(r(520, 620), 0.07, 0.05); },
  talkHi: () => { pop(r(1000, 1200), 0, 0.05); pop(r(1200, 1400), 0.06, 0.05); },
  talkLow: () => { wood(r(180, 230), 0, 0.12); wood(r(150, 190), 0.09, 0.1); },
  pick: () => { pop(700); pop(1050, 0.05); },
  jump: () => whistle(320, 980, 0.22, 0, 0.09),
  hit: () => wood(r(650, 1000), 0, 0.07),
  crit: () => { wood(1200, 0, 0.12); boing(380, 0.22, 0.02, 0.07); },
  kill: () => {
    const k = Math.random();
    if (k < 0.45) quack(r(520, 760), 0, 0.07);
    else if (k < 0.8) pop(r(400, 700), 0, 0.09);
    else osc({ type: 'triangle', f: r(900, 1300), to: r(200, 300), d: 0.12, v: 0.07 }); // petit « piou »
  },
  gem: () => {
    // plus on enchaîne les gemmes, plus le « bling » monte
    const t = performance.now();
    combo = t - comboT < 400 ? Math.min(combo + 1, 14) : 0; comboT = t;
    const f = 880 * Math.pow(2, combo / 12);
    osc({ type: 'sine', f, d: 0.06, v: 0.05 }); osc({ type: 'sine', f: f * 1.5, d: 0.08, v: 0.03, at: 0.03 });
  },
  coin: () => { osc({ type: 'square', f: 988, d: 0.06, v: 0.06, filter: ['lowpass', 3000] }); osc({ type: 'square', f: 1319, d: 0.18, v: 0.06, at: 0.06, filter: ['lowpass', 3000] }); },
  bonk: () => { wood(420, 0, 0.18); boing(160, 0.3, 0.03, 0.09); },
  swish: () => noise({ d: 0.14, v: 0.12, filter: ['bandpass', 900], q: 2, sweepTo: 3200 }),
  zap: () => { osc({ type: 'sawtooth', f: 1600, to: 220, d: 0.18, v: 0.05, filter: ['lowpass', 3000] }); osc({ type: 'square', f: 2400, to: 400, d: 0.12, v: 0.03 }); },
  pew: () => osc({ type: 'square', f: r(1300, 1600), to: 300, d: 0.09, v: 0.035, filter: ['lowpass', 2500] }),
  thunder: () => { noise({ d: 0.35, v: 0.18, filter: ['lowpass', 900], sweepTo: 120 }); osc({ type: 'sawtooth', f: 90, to: 40, d: 0.3, v: 0.08 }); },
  splat: () => { noise({ d: 0.18, v: 0.16, filter: ['lowpass', 1400], sweepTo: 200 }); pop(300, 0.02, 0.1); },
  boom: () => { noise({ d: 0.3, v: 0.2, filter: ['lowpass', 1200], sweepTo: 100 }); osc({ type: 'sine', f: 120, to: 40, d: 0.3, v: 0.2 }); },
  freeze: () => { for (let i = 0; i < 4; i++) osc({ type: 'sine', f: 2000 + i * 400, d: 0.12, v: 0.03, at: i * 0.03 }); },
  hurt: () => {
    // « ouille ! » : trombone qui dégringole + couinement
    osc({ type: 'sawtooth', f: 330, to: 140, curve: 'lin', d: 0.22, v: 0.1, filter: ['lowpass', 1200], q: 4, vib: 12, vibRate: 14 });
    osc({ type: 'square', f: 1400, to: 900, d: 0.08, v: 0.04, at: 0.01 });
  },
  block: () => boing(500, 0.25, 0, 0.1),
  heal: () => { whistle(500, 1400, 0.3, 0, 0.07); [1568, 2093].forEach((f, i) => osc({ type: 'sine', f, d: 0.12, v: 0.04, at: 0.15 + i * 0.06 })); },
  levelup: () => { kazoo(523, 0.1); kazoo(659, 0.1, 0.11); kazoo(784, 0.1, 0.22); kazoo(1047, 0.3, 0.33); },
  loot: () => [784, 988, 1175, 1568].forEach((f, i) => osc({ type: 'triangle', f, d: 0.1, v: 0.06, at: i * 0.05 })),
  chest: () => { wood(500); wood(650, 0.08); [523, 659, 784, 1047].forEach((f, i) => kazoo(f, i === 3 ? 0.35 : 0.09, 0.18 + i * 0.09, 0.08)); },
  shrine: () => { [523, 784, 1047, 1568].forEach((f, i) => osc({ type: 'sine', f, d: 0.6, v: 0.05, at: i * 0.07 })); whistle(400, 1600, 0.6, 0, 0.05); },
  evolve: () => { whistle(200, 1600, 0.9, 0, 0.08); [523, 659, 784, 1047, 1319].forEach((f, i) => kazoo(f, i === 4 ? 0.6 : 0.12, 0.9 + i * 0.1, 0.09)); boing(300, 0.5, 0.9, 0.06); },
  ult: () => { boing(120, 0.5, 0, 0.14); noise({ d: 0.5, v: 0.18, filter: ['bandpass', 400], q: 1, sweepTo: 4000 }); honk(392, 0.25, 0.1, 0.08); },
  honk: () => { honk(330, 0.14); honk(330, 0.2, 0.18); },
  alarm: () => { for (let i = 0; i < 3; i++) whistle(900, 500, 0.18, i * 0.2, 0.07); },
  boss: () => {
    // grognement rigolo : grave qui « wobble » + coup de gong
    osc({ type: 'sawtooth', f: 70, to: 45, curve: 'lin', d: 1.1, v: 0.16, filter: ['lowpass', 500], q: 8, vib: 18, vibRate: 7 });
    noise({ d: 1, v: 0.1, filter: ['lowpass', 300] });
    osc({ type: 'sine', f: 196, d: 1.4, v: 0.1, at: 0.05 });
  },
  charge: () => osc({ type: 'sawtooth', f: 120, to: 420, curve: 'lin', d: 0.55, v: 0.08, filter: ['lowpass', 900], q: 5 }),
  stomp: () => { osc({ type: 'sine', f: 90, to: 30, d: 0.45, v: 0.25 }); noise({ d: 0.35, v: 0.2, filter: ['lowpass', 500] }); boing(90, 0.5, 0.05, 0.08); },
  revive: () => { whistle(300, 1200, 0.4, 0, 0.08); [784, 988, 1175, 1568].forEach((f, i) => kazoo(f, 0.12, 0.35 + i * 0.1)); },
  // trombone triste « wah wah wah waaah »
  lose: () => {
    const notes = [[392, 0.32], [370, 0.32], [349, 0.32], [330, 1.1]];
    let at = 0;
    for (const [f, d] of notes) {
      osc({ type: 'sawtooth', f, to: d > 1 ? f * 0.96 : null, curve: 'lin', d, v: 0.11, at, attack: 0.04, filter: ['lowpass', 900], q: 3, vib: d > 1 ? 9 : 2, vibRate: 5 });
      at += d * 0.95;
    }
  },
  win: () => {
    // fanfare au kazoo « ta-ta-ta-taaa ! »
    const m = [[523, 0.1], [523, 0.1], [523, 0.1], [698, 0.35], [880, 0.14], [784, 0.14], [1047, 0.6]];
    let at = 0;
    for (const [f, d] of m) { kazoo(f, d, at, 0.09); at += d + 0.02; }
    for (let i = 0; i < 4; i++) wood(700 + i * 120, at - 0.6 + i * 0.12, 0.08);
  },
  boing: () => boing(260, 0.4, 0, 0.1),
  // expédition : autel du boss, totems, portail, chrono écoulé, butin, forge
  summon: () => { osc({ type: 'sawtooth', f: 60, to: 180, d: 1.2, v: 0.12, filter: ['lowpass', 700], q: 6 }); noise({ d: 1, v: 0.12, filter: ['bandpass', 300], q: 1, sweepTo: 1800 }); honk(196, 0.5, 0.9, 0.1); },
  totem: () => { wood(300); honk(262, 0.18, 0.05, 0.08); honk(247, 0.35, 0.22, 0.08); boing(140, 0.4, 0.3, 0.07); },
  portal: () => { whistle(200, 2000, 1, 0, 0.07); [392, 523, 659, 784, 1047].forEach((f, i) => osc({ type: 'sine', f, d: 0.5, v: 0.05, at: 0.3 + i * 0.08 })); },
  overtime: () => { for (let i = 0; i < 4; i++) honk(i % 2 ? 233 : 277, 0.16, i * 0.18, 0.1); noise({ d: 0.8, v: 0.1, filter: ['lowpass', 600], at: 0.7 }); },
  lootPick: () => { wood(700); [659, 880, 1175].forEach((f, i) => osc({ type: 'triangle', f, d: 0.12, v: 0.07, at: 0.05 + i * 0.06 })); },
  chestShake: () => { wood(r(380, 520), 0, 0.12); wood(r(380, 520), 0.09, 0.1); },
  chestOpen: () => { boing(200, 0.35, 0, 0.1); [523, 659, 784, 1047, 1319].forEach((f, i) => kazoo(f, i === 4 ? 0.4 : 0.08, 0.1 + i * 0.07, 0.08)); },
  forge: () => { for (let i = 0; i < 3; i++) { wood(1400, i * 0.16, 0.14); osc({ type: 'square', f: 2600, to: 1800, d: 0.06, v: 0.03, at: i * 0.16 }); } kazoo(784, 0.3, 0.5, 0.08); },
  // giga boss : rugissement (grave, long, gong), bond écrasant « BONK », armure qui éclate, fanfare de victoire
  gigaRoar: () => {
    osc({ type: 'sawtooth', f: 55, to: 32, curve: 'lin', d: 1.8, v: 0.2, filter: ['lowpass', 420], q: 9, vib: 14, vibRate: 5 });
    osc({ type: 'square', f: 82, to: 41, curve: 'lin', d: 1.5, v: 0.08, filter: ['lowpass', 300], q: 4, at: 0.1 });
    noise({ d: 1.6, v: 0.14, filter: ['lowpass', 260] });
    osc({ type: 'sine', f: 98, d: 2.2, v: 0.12, at: 0.1 }); osc({ type: 'sine', f: 147, d: 1.8, v: 0.06, at: 0.12 });
  },
  gigaBonk: () => { wood(260, 0, 0.22); osc({ type: 'sine', f: 70, to: 28, d: 0.6, v: 0.3 }); noise({ d: 0.45, v: 0.22, filter: ['lowpass', 700], sweepTo: 90 }); boing(110, 0.6, 0.05, 0.1); },
  gigaBreak: () => { for (let i = 0; i < 5; i++) wood(r(900, 1500), i * 0.04, 0.12); noise({ d: 0.5, v: 0.2, filter: ['highpass', 2500] }); osc({ type: 'sine', f: 90, to: 35, d: 0.5, v: 0.22 }); },
  gigaWin: () => {
    const m = [[392, 0.12], [523, 0.12], [659, 0.12], [784, 0.3], [659, 0.12], [784, 0.12], [1047, 0.9]];
    let at = 0;
    for (const [f, d] of m) { kazoo(f, d, at, 0.1); kazoo(f / 2, d, at, 0.05); at += d + 0.02; }
    for (let i = 0; i < 8; i++) wood(600 + i * 90, at - 0.9 + i * 0.1, 0.08);
    osc({ type: 'sine', f: 131, d: 2.4, v: 0.1, at: at - 0.9 });
  },
  // compatibilité avec les anciens noms
  perfect: () => SFX.zap(),
  miss: () => SFX.hurt(),
};

const last = {};
const MIN_GAP = { hit: 0.05, kill: 0.045, gem: 0.03, pew: 0.06, coin: 0.04, swish: 0.05, zap: 0.08, splat: 0.06, boom: 0.08, thunder: 0.1, crit: 0.06 };

export function sfx(name) {
  if (!save.settings.sound) return;
  if (!ac()) return;
  const t = now(), gap = MIN_GAP[name] || 0;
  if (gap && last[name] && t - last[name] < gap) return;
  last[name] = t;
  try { SFX[name]?.(); } catch (e) { /* audio indisponible */ }
}

export function buzz(ms = 15) {
  if (save.settings.vibrate && navigator.vibrate) navigator.vibrate(ms);
}

// ---------- Musique ----------
// Petit séquenceur : basse « oom-pah », batterie, mélodie sautillante. Un thème par zone.
const SCALES = { major: [0, 2, 4, 7, 9], minor: [0, 3, 5, 7, 10] };
const THEMES = {
  menu:  { bpm: 104, root: 60, scale: 'major', prog: [0, 5, 3, 4], lead: 'marimba', seed: 3 },
  zone0: { bpm: 128, root: 60, scale: 'major', prog: [0, 4, 5, 3], lead: 'square', seed: 11 },
  zone1: { bpm: 122, root: 57, scale: 'major', prog: [0, 3, 4, 0], lead: 'marimba', seed: 21 },
  zone2: { bpm: 132, root: 62, scale: 'major', prog: [0, 5, 3, 4], lead: 'whistle', seed: 31 },
  zone3: { bpm: 118, root: 64, scale: 'major', prog: [0, 3, 5, 4], lead: 'marimba', seed: 41 },
  zone4: { bpm: 112, root: 57, scale: 'minor', prog: [0, 5, 3, 4], lead: 'square', seed: 51 },
  zone5: { bpm: 126, root: 55, scale: 'minor', prog: [0, 3, 5, 4], lead: 'kazoo', seed: 61 },
  boss:  { bpm: 150, root: 52, scale: 'minor', prog: [0, 0, 5, 4], lead: 'kazoo', seed: 77 },
  // giga boss : plus rapide, plus grave, grosse caisse doublée et nappe de bourdon (heavy)
  giga:  { bpm: 164, root: 50, scale: 'minor', prog: [0, 5, 3, 4], lead: 'square', seed: 99, heavy: true },
};
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
// accords (degrés de la gamme majeure, en demi-tons)
const DEG = [0, 2, 4, 5, 7, 9, 11];

let seq = null;

function makePattern(th) {
  let s = th.seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const sc = SCALES[th.scale];
  // 2 phrases de 16 doubles-croches, rejouées avec variations
  const phrases = [0, 1].map(() => Array.from({ length: 16 }, (_, i) => {
    const play = i % 2 === 0 ? rnd() < 0.8 : rnd() < 0.25;
    if (!play) return null;
    const oct = rnd() < 0.2 ? 12 : 0;
    return sc[Math.floor(rnd() * sc.length)] + oct + (rnd() < 0.15 ? -12 : 0);
  }));
  return phrases;
}

function lead(kind, f, t, d) {
  const at = t - now();
  if (kind === 'kazoo') kazooAt(f, d, at);
  else if (kind === 'whistle') osc({ type: 'sine', f, d, v: 0.06, at, attack: 0.01, vib: 6, vibRate: 8, bus: musicBus });
  else if (kind === 'marimba') { osc({ type: 'sine', f, d: 0.18, v: 0.08, at, attack: 0.002, bus: musicBus }); osc({ type: 'sine', f: f * 4, d: 0.05, v: 0.02, at, attack: 0.002, bus: musicBus }); }
  else osc({ type: 'square', f, d: Math.min(d, 0.14), v: 0.035, at, attack: 0.004, filter: ['lowpass', 2200], bus: musicBus });
}
function kazooAt(f, d, at) {
  osc({ type: 'sawtooth', f, d, v: 0.05, at, attack: 0.02, vib: f * 0.02, vibRate: 6, filter: ['bandpass', 1300], q: 2, bus: musicBus });
}

function tick() {
  if (!seq || !ctx) return;
  const th = seq.th, stepDur = 60 / th.bpm / 4;
  while (seq.next < now() + 0.2) {
    const t = seq.next, i = seq.step % 16, bar = Math.floor(seq.step / 16);
    const chordDeg = th.prog[bar % th.prog.length];
    const chordRoot = th.root - 12 + DEG[chordDeg % 7];
    const at = t - now();
    // batterie
    if (i % 8 === 0) { osc({ type: 'sine', f: 150, to: 45, d: 0.16, v: 0.22, at, bus: musicBus }); }
    if (i % 8 === 4) noise({ d: 0.09, v: 0.08, at, filter: ['bandpass', 1800], q: 0.8, bus: musicBus });
    if (i % 2 === 1) noise({ d: 0.025, v: 0.025, at, filter: ['highpass', 7000], bus: musicBus });
    if (i === 14 && bar % 2 === 1) wood(900, at, 0.06);
    if (th.heavy) { // giga boss : grosse caisse sur chaque temps, bourdon grave en début de mesure
      if (i % 4 === 2) osc({ type: 'sine', f: 120, to: 40, d: 0.14, v: 0.18, at, bus: musicBus });
      if (i === 0) osc({ type: 'sawtooth', f: mtof(chordRoot - 12), d: stepDur * 15, v: 0.05, at, attack: 0.08, filter: ['lowpass', 380], q: 3, bus: musicBus });
    }
    // basse « oom-pah »
    if (i % 4 === 0) osc({ type: 'triangle', f: mtof(chordRoot + (i % 8 === 4 ? 7 : 0) - 12), d: stepDur * 1.8, v: 0.14, at, attack: 0.005, bus: musicBus });
    if (i % 4 === 2) osc({ type: 'triangle', f: mtof(chordRoot + 7), d: stepDur * 0.9, v: 0.06, at, bus: musicBus });
    // mélodie (la 2e phrase une mesure sur deux, la 4e mesure respire)
    const ph = seq.phrases[bar % 2];
    const n = ph[i];
    if (n !== null && !(bar % 4 === 3 && i > 10)) {
      const len = ph[(i + 1) % 16] === null ? stepDur * 1.8 : stepDur * 0.9;
      lead(th.lead, mtof(th.root + n + (bar % 4 === 2 ? DEG[chordDeg % 7] % 5 : 0)), t, len);
    }
    seq.next += stepDur;
    seq.step++;
  }
}

export function music(theme) {
  if (!ac()) return;
  if (seq?.name === theme) return;
  stopMusic();
  if (!theme || save.settings.music === false) return;
  const th = THEMES[theme] || THEMES.zone0;
  seq = { name: theme, th, step: 0, next: now() + 0.1, phrases: makePattern(th) };
  musicBus.gain.cancelScheduledValues(now());
  musicBus.gain.setValueAtTime(0.0001, now());
  musicBus.gain.exponentialRampToValueAtTime(theme === 'menu' ? 0.35 : 0.55, now() + 0.8);
  seq.iv = setInterval(tick, 50);
}

export function stopMusic() {
  if (!seq) return;
  clearInterval(seq.iv);
  seq = null;
}

// baisse la musique (pause, menus de niveau)
export function duckMusic(on) {
  if (!ctx || !musicBus) return;
  musicBus.gain.cancelScheduledValues(now());
  musicBus.gain.setTargetAtTime(on ? 0.12 : 0.55, now(), 0.1);
}

// ---------- Champions C1 : faux de Nyx, festin de sang, danse des ombres de Sora, fureur de Ragnar ----------
Object.assign(SFX, {
  // faux : souffle grave qui siffle + petit tintement métallique
  scythe: () => { noise({ d: 0.2, v: 0.13, filter: ['bandpass', 500], q: 1.5, sweepTo: 2400 }); osc({ type: 'triangle', f: r(1800, 2100), to: 1200, d: 0.12, v: 0.03, at: 0.06 }); },
  // festin : aspiration (bruit qui monte) puis battement de cœur grave et accord mineur
  feast: () => {
    noise({ d: 0.55, v: 0.16, filter: ['bandpass', 300], q: 1.2, sweepTo: 2600 });
    osc({ type: 'sine', f: 70, to: 45, d: 0.18, v: 0.22, at: 0.5 }); osc({ type: 'sine', f: 70, to: 45, d: 0.18, v: 0.18, at: 0.72 });
    [294, 349, 440].forEach((f, i) => osc({ type: 'sawtooth', f, d: 0.5, v: 0.035, at: 0.45 + i * 0.04, filter: ['lowpass', 1400], vib: 5, vibRate: 6 }));
  },
  // danse des ombres : coup de vent descendant et carillon étouffé
  shadow: () => { whistle(1800, 300, 0.35, 0, 0.06); noise({ d: 0.4, v: 0.12, filter: ['highpass', 2000], sweepTo: 600 }); [659, 831, 988].forEach((f, i) => osc({ type: 'sine', f, d: 0.25, v: 0.04, at: 0.1 + i * 0.05 })); },
  // bond de l'ombre : « fsst » très court
  dash: () => noise({ d: 0.09, v: 0.1, filter: ['bandpass', 2600], q: 2, sweepTo: 800 }),
  // fureur : cri de guerre (kazoo grave qui monte) + gros coup de tambour
  fury: () => { kazoo(147, 0.45, 0, 0.11, 220); osc({ type: 'sine', f: 110, to: 35, d: 0.5, v: 0.26 }); noise({ d: 0.45, v: 0.2, filter: ['lowpass', 700], sweepTo: 90 }); boing(80, 0.5, 0.05, 0.07); },
});
Object.assign(MIN_GAP, { scythe: 0.08, dash: 0.06 });

// ---------- Champions C2 : hiver éternel de Frida, colère de la forêt de Gaïa ----------
Object.assign(SFX, {
  // hiver éternel : bourrasque qui siffle, craquement de glace puis carillon cristallin qui descend
  winter: () => {
    noise({ d: 0.7, v: 0.16, filter: ['bandpass', 3200], q: 0.8, sweepTo: 700 }); whistle(2400, 900, 0.6, 0, 0.05);
    noise({ d: 0.12, v: 0.2, filter: ['highpass', 2500], at: 0.08 }); noise({ d: 0.08, v: 0.14, filter: ['highpass', 3500], at: 0.2 });
    [2637, 2093, 1760, 1319, 1047].forEach((f, i) => osc({ type: 'sine', f, d: 0.35, v: 0.045, at: 0.22 + i * 0.07 }));
  },
  // éclatement de la glace : verre qui se brise (grappe de tintements aigus et souffle)
  shatter: () => { noise({ d: 0.3, v: 0.2, filter: ['highpass', 3000], sweepTo: 1200 }); for (let i = 0; i < 6; i++) osc({ type: 'triangle', f: r(2400, 4200), to: r(1500, 2400), d: 0.14, v: 0.035, at: i * 0.025 }); },
  // colère de la forêt : grondement de terre qui monte, craquements de bois, accord majeur doux (soin)
  forest: () => {
    noise({ d: 0.6, v: 0.2, filter: ['lowpass', 500], sweepTo: 1600 }); osc({ type: 'sine', f: 55, to: 110, d: 0.5, v: 0.22 });
    wood(260, 0.15, 0.18); wood(180, 0.28, 0.16); wood(320, 0.4, 0.12);
    [392, 494, 587, 784].forEach((f, i) => osc({ type: 'triangle', f, d: 0.5, v: 0.04, at: 0.35 + i * 0.06, vib: 4, vibRate: 5 }));
  },
  // coup d'épines : petit « tchak » de ronces
  thorns: () => { noise({ d: 0.07, v: 0.1, filter: ['bandpass', 1800], q: 3, sweepTo: 900 }); wood(r(500, 700), 0, 0.06); },
});
Object.assign(MIN_GAP, { thorns: 0.12, shatter: 0.2 });

// ---------- Arsenal W1 : étoiles de Lumi, flèche explosive et pièges de Kira, bouclier et marteau de Brok, glace de Frida ----------
Object.assign(SFX, {
  // salve d'étoiles : petit arpège céleste ; impact : tintement aigu qui retombe + souffle ; comète : grondement et carillon
  starcast: () => [1568, 2093, 2637].forEach((f, i) => osc({ type: 'sine', f, d: 0.16, v: 0.025, at: i * 0.05 })),
  star: () => { osc({ type: 'sine', f: r(1900, 2300), to: 900, d: 0.16, v: 0.04 }); noise({ d: 0.12, v: 0.08, filter: ['highpass', 2800], sweepTo: 1200 }); osc({ type: 'sine', f: 180, to: 70, d: 0.14, v: 0.08 }); },
  comet: () => { noise({ d: 0.4, v: 0.2, filter: ['lowpass', 1600], sweepTo: 140 }); osc({ type: 'sine', f: 200, to: 50, d: 0.35, v: 0.18 }); [1319, 1760, 2349].forEach((f, i) => osc({ type: 'sine', f, d: 0.3, v: 0.03, at: 0.05 + i * 0.05 })); },
  // flèche explosive : corde lourde au tir, explosion sèche (bruit grave + carré qui tombe)
  bowheavy: () => { osc({ type: 'triangle', f: 320, to: 110, d: 0.14, v: 0.08 }); noise({ d: 0.12, v: 0.07, filter: ['bandpass', 700], q: 2, sweepTo: 2000 }); },
  blast: () => { noise({ d: 0.28, v: 0.2, filter: ['lowpass', 1800], sweepTo: 130 }); osc({ type: 'square', f: 150, to: 45, d: 0.22, v: 0.08, filter: ['lowpass', 700] }); pop(480, 0, 0.05); },
  // pièges : cliquetis en posant, « clac » métallique quand les mâchoires se referment
  trapset: () => { wood(1500, 0, 0.05); wood(1100, 0.05, 0.04); },
  snap: () => { noise({ d: 0.05, v: 0.2, filter: ['highpass', 2600] }); osc({ type: 'square', f: 950, to: 280, d: 0.07, v: 0.06, filter: ['bandpass', 1500], q: 3 }); wood(480, 0.02, 0.1); },
  // bouclier : souffle au lancer, « bong » métallique à chaque rebond
  shieldthrow: () => noise({ d: 0.2, v: 0.1, filter: ['bandpass', 700], q: 1.5, sweepTo: 1800 }),
  shield: () => { osc({ type: 'triangle', f: r(680, 780), to: 480, d: 0.18, v: 0.07 }); osc({ type: 'sine', f: r(1400, 1600), d: 0.25, v: 0.03, vib: 20, vibRate: 30 }); },
  // marteau du jugement : chœur qui monte à l'appel, coup sourd + accord sacré à l'impact
  hammercall: () => whistle(400, 1200, 0.4, 0, 0.04),
  hammer: () => { osc({ type: 'sine', f: 110, to: 34, d: 0.45, v: 0.26 }); noise({ d: 0.4, v: 0.22, filter: ['lowpass', 900], sweepTo: 90 }); [523, 784, 1047].forEach((f, i) => osc({ type: 'triangle', f, d: 0.5, v: 0.03, at: 0.04 + i * 0.03 })); },
  // stalactites : éclats de verre qui sifflent ; grêle : petits « tic » et bourrasque à la formation de l'orage
  icicle: () => { for (let i = 0; i < 3; i++) osc({ type: 'triangle', f: r(2400, 3400), to: r(1600, 2200), d: 0.08, v: 0.025, at: i * 0.02 }); noise({ d: 0.1, v: 0.06, filter: ['highpass', 3500] }); },
  hail: () => wood(r(1800, 2600), 0, 0.035),
  hailstorm: () => noise({ d: 0.8, v: 0.1, filter: ['bandpass', 2500], q: 0.7, sweepTo: 900 }),
});
Object.assign(MIN_GAP, { star: 0.06, comet: 0.2, blast: 0.08, snap: 0.07, shield: 0.06, hammer: 0.15, icicle: 0.08, hail: 0.035 });
// ---------- Arsenal W2 : armes de Nyx (chauves-souris, lance de sang, cercle maudit) et de Sora (shurikens, fumigènes, clone) ----------
Object.assign(SFX, {
  // chauve-souris : petit cri aigu qui descend et froissement d'ailes
  bat: () => { osc({ type: 'sine', f: r(2600, 3300), to: 1700, d: 0.06, v: 0.03 }); noise({ d: 0.06, v: 0.05, filter: ['bandpass', 1400], q: 2, at: 0.02 }); },
  // lance de sang : souffle qui monte et tintement grave
  lance: () => { noise({ d: 0.16, v: 0.1, filter: ['bandpass', 700], q: 1.5, sweepTo: 2600 }); osc({ type: 'triangle', f: 520, to: 260, d: 0.14, v: 0.05, at: 0.03 }); },
  // pieux de sang qui jaillissent : craquements secs en cascade
  spikes: () => { for (let i = 0; i < 4; i++) wood(r(300, 460), i * 0.04, 0.08); noise({ d: 0.18, v: 0.1, filter: ['lowpass', 900], sweepTo: 200 }); },
  // cercle maudit : accord grave et voilé qui ondule
  curse: () => { [147, 175].forEach((f, i) => osc({ type: 'sawtooth', f, to: f * 0.94, d: 0.4, v: 0.035, at: i * 0.03, filter: ['lowpass', 700], vib: 4, vibRate: 5 })); noise({ d: 0.3, v: 0.06, filter: ['bandpass', 400], q: 2 }); },
  // shuriken : sifflement métallique qui tourne
  shuriken: () => { osc({ type: 'triangle', f: r(2200, 2500), to: 3200, d: 0.08, v: 0.03, vib: 300, vibRate: 40 }); noise({ d: 0.08, v: 0.07, filter: ['highpass', 3000] }); },
  // lancer (bombe fumigène) puis « pouf » de fumée
  throw: () => noise({ d: 0.1, v: 0.08, filter: ['bandpass', 1200], q: 1.5, sweepTo: 2400 }),
  smoke: () => { noise({ d: 0.35, v: 0.13, filter: ['lowpass', 1100], sweepTo: 250 }); pop(240, 0, 0.08); },
  // clone d'ombre : « fsst » qui descend et carillon sourd ; entaille : coup de lame bref
  clone: () => { whistle(1500, 400, 0.22, 0, 0.05); noise({ d: 0.18, v: 0.08, filter: ['highpass', 2200], sweepTo: 700 }); },
  cut: () => noise({ d: 0.07, v: 0.09, filter: ['bandpass', 3000], q: 2, sweepTo: 1200 }),
});
Object.assign(MIN_GAP, { bat: 0.1, lance: 0.1, spikes: 0.15, curse: 0.25, shuriken: 0.08, throw: 0.1, smoke: 0.12, clone: 0.2, cut: 0.08 });
// ---------- Arsenal W3 : armes de Ragnar (haches, cri de guerre, séisme, tourbillon) et de Gaïa (ronces, esprits, pétales) ----------
Object.assign(SFX, {
  // hache lancée : lourd « vrou-vrou » qui tournoie ; hache plantée : « tchonk » sourd et cailloux
  w3axe: () => { noise({ d: 0.22, v: 0.11, filter: ['bandpass', 520], q: 2, sweepTo: 1300 }); osc({ type: 'triangle', f: 160, to: 230, d: 0.18, v: 0.05, vib: 40, vibRate: 18 }); },
  w3chop: () => { wood(r(150, 190), 0, 0.16); noise({ d: 0.12, v: 0.12, filter: ['lowpass', 900], sweepTo: 200 }); },
  // foudre des haches du Tonnerre : craquement sec puis grondement
  w3thunder: () => { noise({ d: 0.08, v: 0.2, filter: ['highpass', 2500] }); noise({ d: 0.5, v: 0.14, filter: ['lowpass', 400], at: 0.05, sweepTo: 80 }); },
  // cri de guerre : rugissement grave qui monte (deux voix) et souffle
  w3cry: () => { kazoo(110, 0.42, 0, 0.1, 165); kazoo(147, 0.38, 0.02, 0.07, 196); noise({ d: 0.4, v: 0.12, filter: ['bandpass', 600], q: 0.8, sweepTo: 1500 }); },
  // séisme : coup de massue au sol et grondement qui roule
  w3quake: () => { osc({ type: 'sine', f: 90, to: 32, d: 0.4, v: 0.24 }); noise({ d: 0.55, v: 0.15, filter: ['lowpass', 380], sweepTo: 90 }); wood(120, 0.06, 0.1); wood(95, 0.14, 0.08); },
  // tourbillon : souffle qui tourne (filtre qui balaie)
  w3whirl: () => { noise({ d: 0.26, v: 0.1, filter: ['bandpass', 800], q: 1.4, sweepTo: 2200 }); noise({ d: 0.18, v: 0.06, filter: ['bandpass', 2400], q: 2, at: 0.1, sweepTo: 900 }); },
  // fouet de ronces : claquement vif et bruissement de feuilles
  w3whip: () => { noise({ d: 0.05, v: 0.16, filter: ['highpass', 2600] }); noise({ d: 0.16, v: 0.07, filter: ['bandpass', 3400], q: 1.5, at: 0.03, sweepTo: 1800 }); wood(r(620, 760), 0.02, 0.05); },
  // esprit qui fonce : petite cloche aérienne ; éclat : « pop » cristallin et accord doux
  w3wisp: () => osc({ type: 'sine', f: r(1300, 1500), to: 2100, d: 0.14, v: 0.03, vib: 30, vibRate: 12 }),
  w3pop: () => { pop(r(700, 820), 0, 0.08); [784, 988].forEach((f, i) => osc({ type: 'triangle', f, d: 0.18, v: 0.03, at: 0.02 + i * 0.04 })); },
  // pétales : bruissement léger
  w3petal: () => noise({ d: 0.22, v: 0.05, filter: ['bandpass', 4200], q: 1.2, sweepTo: 2600 }),
});
Object.assign(MIN_GAP, { w3axe: 0.08, w3chop: 0.07, w3thunder: 0.15, w3cry: 0.3, w3quake: 0.2, w3whirl: 0.15, w3whip: 0.08, w3wisp: 0.1, w3pop: 0.07, w3petal: 0.3 });
// ---------- Tess l'ingénieure : tourelle, drones, lance-flammes, mines électriques, frappe orbitale ----------
Object.assign(SFX, {
  // tourelle posée : clang métallique puis servo qui monte ; tir : petit « tac » sec ; missile : souffle et boum sourd
  turret: () => { wood(300, 0, 0.12); noise({ d: 0.06, v: 0.12, filter: ['highpass', 2500] }); osc({ type: 'square', f: 220, to: 660, d: 0.18, v: 0.03, at: 0.06, filter: ['lowpass', 1500] }); },
  tshot: () => { osc({ type: 'square', f: r(900, 1100), to: 300, d: 0.05, v: 0.025, filter: ['lowpass', 2200] }); noise({ d: 0.03, v: 0.05, filter: ['highpass', 3000] }); },
  missile: () => { noise({ d: 0.25, v: 0.14, filter: ['lowpass', 1500], sweepTo: 150 }); osc({ type: 'sine', f: 150, to: 50, d: 0.22, v: 0.14 }); },
  // drone qui décolle : bourdonnement d'hélices qui monte ; tir de drone : « piou » aigu
  drone: () => osc({ type: 'sawtooth', f: 180, to: 420, d: 0.3, v: 0.03, vib: 30, vibRate: 40, filter: ['lowpass', 1800] }),
  dshot: () => osc({ type: 'square', f: r(2000, 2300), to: 900, d: 0.07, v: 0.022, filter: ['lowpass', 3500] }),
  // lance-flammes : allumage « fwoomp » puis grondement du jet
  flameon: () => { noise({ d: 0.25, v: 0.16, filter: ['lowpass', 600], sweepTo: 2200 }); pop(160, 0, 0.08); },
  flame: () => noise({ d: 0.16, v: 0.07, filter: ['bandpass', 900], q: 0.7, sweepTo: 600 }),
  // mines : lancer (sifflet et cliquetis), pose (bip d'armement), décharge (grésillement électrique), arcs de la grille
  minethrow: () => { whistle(900, 1500, 0.12, 0, 0.03); wood(r(700, 900), 0.02, 0.06); },
  mineland: () => { wood(r(380, 460), 0, 0.08); osc({ type: 'sine', f: 1800, d: 0.05, v: 0.02, at: 0.05 }); },
  shock: () => { osc({ type: 'sawtooth', f: 120, to: 60, d: 0.2, v: 0.08, vib: 40, vibRate: 60 }); noise({ d: 0.18, v: 0.14, filter: ['highpass', 2200], sweepTo: 5000 }); osc({ type: 'square', f: 1800, to: 400, d: 0.12, v: 0.03, at: 0.02 }); },
  arc: () => osc({ type: 'sawtooth', f: 100, d: 0.12, v: 0.03, vib: 25, vibRate: 50, filter: ['bandpass', 1400], q: 2 }),
  // frappe orbitale : bips du satellite et sifflement de charge ; impact énorme ; ronflement du laser qui balaie
  orbital: () => { [0, 0.1].forEach(at => osc({ type: 'square', f: 1760, d: 0.05, v: 0.03, at, filter: ['lowpass', 3000] })); osc({ type: 'sine', f: 300, to: 2400, d: 0.5, v: 0.06, at: 0.05 }); noise({ d: 0.45, v: 0.06, filter: ['bandpass', 1500], q: 2, sweepTo: 5000 }); },
  orbhit: () => { noise({ d: 0.8, v: 0.25, filter: ['lowpass', 1600], sweepTo: 120 }); osc({ type: 'sine', f: 90, to: 30, d: 0.7, v: 0.28 }); osc({ type: 'sawtooth', f: 220, to: 110, d: 0.6, v: 0.06, filter: ['lowpass', 900] }); },
  laser: () => { osc({ type: 'sawtooth', f: r(95, 105), d: 0.22, v: 0.05, filter: ['lowpass', 700] }); noise({ d: 0.2, v: 0.06, filter: ['bandpass', 2500], q: 1 }); },
});
Object.assign(MIN_GAP, { turret: 0.15, tshot: 0.07, missile: 0.1, drone: 0.2, dshot: 0.06, flameon: 0.2, flame: 0.11, minethrow: 0.15, mineland: 0.06, shock: 0.08, arc: 0.3, laser: 0.2 });
