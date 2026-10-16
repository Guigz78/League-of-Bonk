// Effets sonores synthétisés (aucun fichier audio, fonctionne hors ligne).
import { save } from './save.js';

let ctx = null;
function ac() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone({ f = 440, f2 = null, d = 0.12, type = 'square', v = 0.12, delay = 0 }) {
  const a = ac(); if (!a) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
  g.gain.setValueAtTime(v, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + d);
  o.connect(g).connect(a.destination);
  o.start(t); o.stop(t + d + 0.02);
}

function noise(d = 0.15, v = 0.15, delay = 0) {
  const a = ac(); if (!a) return;
  const t = a.currentTime + delay;
  const buf = a.createBuffer(1, a.sampleRate * d, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const s = a.createBufferSource(), g = a.createGain();
  s.buffer = buf; g.gain.value = v;
  s.connect(g).connect(a.destination); s.start(t);
}

const SFX = {
  tap: () => tone({ f: 660, d: 0.05, v: 0.06 }),
  bonk: () => { tone({ f: 220, f2: 80, d: 0.14, v: 0.2 }); noise(0.08, 0.12); },
  perfect: () => { tone({ f: 880, d: 0.08, v: 0.1 }); tone({ f: 1320, d: 0.12, v: 0.1, delay: 0.06 }); noise(0.1, 0.14); },
  miss: () => tone({ f: 200, f2: 120, d: 0.18, type: 'triangle', v: 0.12 }),
  hurt: () => { tone({ f: 160, f2: 60, d: 0.2, type: 'sawtooth', v: 0.14 }); noise(0.12, 0.1); },
  block: () => { tone({ f: 520, d: 0.06, v: 0.1 }); tone({ f: 780, d: 0.1, v: 0.08, delay: 0.05 }); },
  heal: () => [523, 659, 784].forEach((f, i) => tone({ f, d: 0.12, type: 'triangle', v: 0.1, delay: i * 0.07 })),
  ult: () => { [392, 523, 659, 784, 1046].forEach((f, i) => tone({ f, d: 0.16, v: 0.1, delay: i * 0.06 })); noise(0.4, 0.12, 0.3); },
  win: () => [523, 659, 784, 1046].forEach((f, i) => tone({ f, d: 0.2, type: 'triangle', v: 0.12, delay: i * 0.1 })),
  lose: () => [392, 330, 262, 196].forEach((f, i) => tone({ f, d: 0.25, type: 'triangle', v: 0.12, delay: i * 0.15 })),
  coin: () => { tone({ f: 988, d: 0.06, v: 0.08 }); tone({ f: 1318, d: 0.14, v: 0.08, delay: 0.06 }); },
  loot: () => [659, 880, 1175].forEach((f, i) => tone({ f, d: 0.12, v: 0.08, delay: i * 0.08 })),
};

export function sfx(name) {
  if (!save.settings.sound) return;
  try { SFX[name]?.(); } catch (e) { /* audio indisponible */ }
}

export function buzz(ms = 15) {
  if (save.settings.vibrate && navigator.vibrate) navigator.vibrate(ms);
}
