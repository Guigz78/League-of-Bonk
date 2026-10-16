// Petits utilitaires d'interface : rendu, modales, toasts.
import { sfx } from './audio.js';

export const app = document.getElementById('app');
export const wait = ms => new Promise(r => setTimeout(r, ms));
export const fmt = n => Math.round(n).toLocaleString('fr-FR');
export const pct = n => Math.round(n * 100) + ' %';

export function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function mount(html) {
  app.innerHTML = html;
  app.scrollTop = 0;
}

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

let toastBox = null;
export function toast(html, ms = 2200) {
  if (!toastBox) { toastBox = document.createElement('div'); toastBox.className = 'toasts'; document.body.appendChild(toastBox); }
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = html;
  toastBox.appendChild(t);
  setTimeout(() => t.classList.add('out'), ms);
  setTimeout(() => t.remove(), ms + 400);
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
