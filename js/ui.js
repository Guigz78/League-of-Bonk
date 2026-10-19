// Petits utilitaires d'interface : rendu, modales, toasts.
import { sfx } from './audio.js';

export const app = document.getElementById('app');
export const wait = ms => new Promise(r => setTimeout(r, ms));
export const fmt = n => Math.round(n).toLocaleString('fr-FR');
export const pct = n => Math.round(n * 100) + ' %';

export function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// change d'écran ; fondu court quand on arrive sur un écran d'un autre type
let lastScreen = '';
export function mount(html) {
  app.innerHTML = html;
  app.scrollTop = 0;
  const root = app.firstElementChild, kind = root?.classList[0] || '';
  if (root && kind !== lastScreen) root.classList.add('scr-in');
  lastScreen = kind;
}

// nombre qui défile jusqu'à sa valeur (récompenses, bilan)
export function countUp(el, to, ms = 700, pre = '') {
  if (!el) return;
  const t0 = performance.now(), from = 0;
  const step = now => {
    const k = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - k, 3);
    el.textContent = pre + fmt(from + (to - from) * e);
    if (k < 1 && el.isConnected) requestAnimationFrame(step);
  };
  el.textContent = pre + fmt(from);
  requestAnimationFrame(step);
}

// verrouillage iOS : pas de zoom (double-tap, pincement), de menu contextuel, de sélection, de glisser d'image
// ni de rebond de la page ; seules les zones prévues pour défiler défilent
const SCROLLERS = '.hub-main, .modal-body, .class-select, .chest-screen, .reward-screen, .cst-recap, .lvl-ov .lvlup, .scroll';
const stop = e => e.preventDefault();
for (const ev of ['gesturestart', 'gesturechange', 'gestureend', 'dblclick', 'dragstart']) document.addEventListener(ev, stop, { passive: false });
document.addEventListener('contextmenu', stop);
document.addEventListener('selectstart', e => { if (!e.target.closest?.('input, textarea')) e.preventDefault(); });
document.addEventListener('touchmove', e => {
  if (e.touches.length > 1) { e.preventDefault(); return; }
  if (!e.target.closest?.(SCROLLERS)) e.preventDefault();
}, { passive: false });

export function $(sel, root = document) { return root.querySelector(sel); }
export function $$(sel, root = document) { return [...root.querySelectorAll(sel)]; }

// Délégation de clics : data-act="nom" -> handlers[nom](element, event)
export function bind(root, handlers) {
  root.onclick = e => {
    const t = e.target.closest('[data-act]');
    if (!t || t.disabled || t.classList.contains('disabled')) return;
    const fn = handlers[t.dataset.act];
    if (fn) { sfx('tap'); fn(t, e); }
  };
}

// notifications : 2 à la fois au plus, les suivantes attendent leur tour
let toastBox = null;
const toastQ = [];
export function toast(html, ms = 2200) {
  if (!toastBox) { toastBox = document.createElement('div'); toastBox.className = 'toasts'; document.body.appendChild(toastBox); }
  if (toastBox.children.length >= 2) { toastQ.push([html, ms]); return; }
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = html;
  toastBox.appendChild(t);
  setTimeout(() => t.classList.add('out'), ms);
  setTimeout(() => { t.remove(); if (toastQ.length) toast(...toastQ.shift()); }, ms + 400);
}

// buttons: [{ label, cls, value }]
export function modal({ title = '', body = '', buttons = [{ label: 'OK', cls: 'primary', value: true }], dismissable = false, cls = '' }) {
  return new Promise(resolve => {
    const wrap = document.createElement('div');
    wrap.className = 'modal-wrap';
    wrap.innerHTML = `
      <div class="modal ${cls}" role="dialog" aria-modal="true">
        ${title ? `<h2>${title}</h2>` : ''}
        <div class="modal-body">${body}</div>
        <div class="modal-btns">${buttons.map((b, i) => `<button class="btn ${b.cls || ''}" data-i="${i}">${b.label}</button>`).join('')}</div>
      </div>`;
    const close = v => {
      wrap.classList.add('out');
      setTimeout(() => wrap.remove(), 180);
      resolve(v);
    };
    wrap.addEventListener('click', e => {
      const b = e.target.closest('[data-i]');
      if (b) { sfx('tap'); close(buttons[+b.dataset.i].value); return; }
      if (dismissable && e.target === wrap) close(null);
    });
    document.body.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add('in'));
  });
}

export function bar(cur, max, cls = '') {
  const p = Math.max(0, Math.min(1, cur / max)) * 100;
  return `<div class="bar ${cls}"><div class="fill" style="width:${p}%"></div><span>${fmt(Math.max(0, cur))} / ${fmt(max)}</span></div>`;
}
