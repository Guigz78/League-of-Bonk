// Options, compte (bouton en haut à droite), connexion (Google ou lien par e-mail) et choix entre deux sauvegardes.
import { CLASSES, ZONES } from './data.js';
import * as DATA from './data.js';
import { save, persist, resetSave } from './save.js';
import { iconImg } from './art.js';
import { heroURL } from './visuals.js';
import { sfx, stopMusic } from './audio.js';
import { $, modal, toast, fmt, esc } from './ui.js';
import { cloud } from './cloud.js';
import { achList, titleName } from './season.js';
import { titleSheet } from './season-ui.js';
import { totalStars } from './story.js';
import { APP_VERSION, afterSheet, boot, home, inBattle } from './game.js';

export async function settings() {
  const u = cloud.user;
  const statusTxt = {
    synced: 'Sauvegarde synchronisée',
    syncing: 'Synchronisation…',
    pending: 'Hors ligne : sera synchronisé au retour du réseau',
    error: 'Erreur de synchronisation, nouvel essai bientôt',
    off: '',
  }[cloud.status] || '';
  const wrapId = 'set-' + Date.now();
  const S = save.settings;
  const seg = (k, opts) => `<div class="seg" data-k="${k}">${opts.map(([v, l]) => `<button data-sv="${v}" class="${String(S[k]) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  const row = (ic, label, sub, ctrl, col = false) => `<div class="set-row ${col ? 'col' : ''}">${iconImg(ic, 20)}<span class="set-l">${label}${sub ? `<small>${sub}</small>` : ''}</span>${ctrl}</div>`;
  const sw = (id, on) => `<label class="sw"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}><i></i></label>`;
  const joyTxt = v => `${Math.round(v * 100)} %`;
  const p = modal({
    title: 'Options',
    cls: 'settings-modal',
    body: `<div id="${wrapId}">
      <h4 class="first">Jeu</h4>
      <div class="set-list">
        ${row('shake', 'Tremblements de l\'écran', '', seg('shake', [[0, 'Aucun'], [1, 'Faibles'], [2, 'Normaux']]), true)}
        ${row('numbers', 'Chiffres de dégâts', '', seg('numbers', [['all', 'Tous'], ['crit', 'Critiques'], ['none', 'Aucun']]), true)}
        ${row('joystick', 'Taille du joystick', '', `<span class="range"><input type="range" id="sJoy" min="0.8" max="1.3" step="0.05" value="${S.joySize}"><b id="sJoyV">${joyTxt(S.joySize)}</b></span>`)}
        ${row('upg', 'Choix automatique', 'Prend la meilleure amélioration à chaque niveau', sw('sAuto', S.autoPick))}
        ${row('hand', 'Mode gaucher', 'Bouton d\'ultime à gauche', sw('sLefty', S.lefty))}
        ${row('cube', 'Graphismes', 'Léger : plus fluide sur les vieux iPhone (image moins fine, moins d\'effets)', seg('quality', [['auto', 'Auto'], ['lite', 'Léger']]), true)}
      </div>
      <h4>Son</h4>
      <div class="set-list">
        ${row('sound', 'Effets sonores', '', sw('sSound', S.sound))}
        ${row('music', 'Musique', '', sw('sMus', S.music !== false))}
        ${row('vibrate', 'Vibrations', '', sw('sVib', S.vibrate))}
      </div>
      <h4>Compte</h4>
      <button class="set-row set-link" data-v="account">${u?.avatar ? `<img class="avatar" src="${esc(u.avatar)}" alt="" referrerpolicy="no-referrer">` : iconImg('user', 20)}<span class="set-l">${u ? esc(u.name || u.email) : 'Non connecté'}<small>${u ? esc(statusTxt || 'Sauvegarde en ligne') : 'Sauvegarde en ligne, profil, statistiques'}</small></span><i class="set-go">›</i></button>
      <h4 class="web-only">Installer sur iPhone</h4>
      <p class="muted set-note web-only">Dans Safari, touchez <b>Partager</b> puis <b>« Sur l'écran d'accueil »</b>. Le jeu s'ouvrira en plein écran et fonctionnera hors connexion.</p>
      <div class="danger-zone">
        <button class="btn ghost small danger" data-v="reset">Effacer la progression</button>
      </div>
      <p class="ver">League of Bonk · ${APP_VERSION}</p>
    </div>`,
    buttons: [{ label: 'Fermer', cls: 'primary', value: 'close' }],
    dismissable: true,
  });
  // boutons internes
  const wrap = document.getElementById(wrapId);
  const o = { shake: S.shake, numbers: S.numbers, quality: S.quality || 'auto' };
  let action = null;
  wrap.addEventListener('click', e => {
    const sv = e.target.closest('[data-sv]');
    if (sv) {
      const g = sv.closest('.seg'), k = g.dataset.k;
      o[k] = k === 'shake' ? +sv.dataset.sv : sv.dataset.sv;
      g.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === sv));
      sfx('tap'); return;
    }
    const b = e.target.closest('[data-v]');
    if (!b) return;
    action = b.dataset.v;
    wrap.closest('.modal-wrap').querySelector('.modal-btns .btn').click();
  });
  wrap.querySelector('#sJoy').addEventListener('input', e => { wrap.querySelector('#sJoyV').textContent = joyTxt(+e.target.value); });
  await p;
  S.sound = wrap.querySelector('#sSound').checked;
  S.vibrate = wrap.querySelector('#sVib').checked;
  S.lefty = wrap.querySelector('#sLefty').checked;
  S.autoPick = !!wrap.querySelector('#sAuto')?.checked;
  S.joySize = Math.max(0.8, Math.min(1.3, +wrap.querySelector('#sJoy').value || 1));
  Object.assign(S, o);
  const mOn = wrap.querySelector('#sMus').checked;
  if (mOn !== S.music) { S.music = mOn; if (!mOn) stopMusic(); }
  persist({ touch: false });
  if (action === 'account') return accountSheet();
  if (action === 'reset') {
    const ok = await modal({ title: 'Tout effacer ?', body: '<p>Votre or, vos objets, familiers et zones débloquées seront <b>définitivement</b> supprimés de cet appareil' + (u ? ' et de votre compte' : '') + '.</p>', buttons: [{ label: 'Annuler', cls: 'ghost', value: false }, { label: 'Tout effacer', cls: 'danger', value: true }] });
    if (ok) { resetSave(); boot(); }
  }
  if (!inBattle()) home();
}

// ---------- Connexion (Google ou e-mail) ----------
const G_LOGO = '<svg viewBox="0 0 48 48" width="18" height="18"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 6.9-10.3 6.9-17.7z"/><path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.2 1.5-5 2.3-8.2 2.3-6.2 0-11.5-4.1-13.4-9.8l-7.9 6.1C6.6 42.6 14.6 48 24 48z"/></svg>';
const STRIP_KEY = 'lob_login_hide'; // bande de connexion de l'accueil cachée jusqu'à cette date (3 jours, cet appareil)
const stripHidden = () => { try { return Date.now() < +(localStorage.getItem(STRIP_KEY) || 0); } catch (e) { return false; } };
// bande en haut de l'accueil : joueur pas connecté (après sa première partie) ; Google direct, ou e-mail
export function loginStrip() {
  if (!cloud.available || cloud.user || !save.stats.runs || stripHidden()) return '';
  return `<div class="login-strip">
    <span class="ls-ic">☁️</span>
    <span class="ls-t"><b>Sauvegarde en ligne</b><small>Gardez votre progression</small></span>
    <button class="ls-btn g" data-act="signGoogle" aria-label="Se connecter avec Google">${G_LOGO}<span>Google</span></button>
    <button class="ls-btn m" data-act="signIn" aria-label="Se connecter par e-mail">✉️</button>
    <button class="ls-x" data-act="hideStrip" aria-label="Plus tard">×</button>
  </div>`;
}
// « Plus tard » sur la bande de connexion : cachée 3 jours sur cet appareil
export function hideLoginStrip() {
  try { localStorage.setItem(STRIP_KEY, String(Date.now() + 3 * 864e5)); } catch (e) { /* stockage indisponible */ }
  $('.login-strip')?.remove();
}
export async function signGoogle() {
  const r = await cloud.signIn('google');
  if (r?.error) toast(`Connexion Google impossible : ${esc(r.error)}`, 5000);
}
// fiche de connexion : Google, ou un lien de connexion envoyé par e-mail
export async function signInSheet() {
  if (!cloud.available) return toast('La connexion n\'est pas disponible sur cette version.', 4000);
  const id = 'si-' + Date.now();
  let go = null;
  const p = modal({
    title: 'Se connecter',
    cls: 'signin-modal',
    body: `<div id="${id}">
      <p class="set-note">Votre progression est <b>sauvegardée en ligne</b> et vous la retrouvez sur un autre appareil. Le jeu reste jouable hors connexion.</p>
      <button class="btn google" data-v="google">${G_LOGO} Continuer avec Google</button>
      <div class="si-or"><span>ou</span></div>
      <label class="si-l" for="${id}-m">Recevoir un lien de connexion par e-mail</label>
      <div class="si-row"><input id="${id}-m" class="si-mail" type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" placeholder="vous@exemple.fr">
        <button class="btn primary small" data-v="mail">Envoyer</button></div>
      <p class="si-msg" aria-live="polite"></p>
    </div>`,
    buttons: [{ label: 'Plus tard', cls: 'ghost', value: null }],
    dismissable: true,
  });
  const box = document.getElementById(id), msg = box.querySelector('.si-msg'), input = box.querySelector('.si-mail');
  const send = async () => {
    const email = input.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg.className = 'si-msg bad'; msg.textContent = 'Adresse e-mail invalide.'; input.focus(); return; }
    msg.className = 'si-msg'; msg.textContent = 'Envoi…';
    const r = await cloud.signInEmail(email);
    if (r?.error) { msg.className = 'si-msg bad'; msg.textContent = `Envoi impossible : ${r.error}`; return; }
    msg.className = 'si-msg ok';
    msg.innerHTML = `📬 Lien envoyé à <b>${esc(email)}</b>. Ouvrez l'e-mail <b>sur cet appareil</b> et touchez le lien : vous serez connecté.`;
    sfx('loot');
  };
  box.addEventListener('click', e => {
    const b = e.target.closest('[data-v]'); if (!b) return;
    sfx('tap');
    if (b.dataset.v === 'mail') return void send();
    go = b.dataset.v; box.closest('.modal-wrap').querySelector('.modal-btns .btn').click();
  });
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); send(); } });
  await p;
  if (go === 'google') return signGoogle();
}

// ---------- Compte (bouton en haut à droite) ----------
// profil (avatar Google ou champion, nom, titre), quelques chiffres de la progression, sauvegarde en ligne (connexion,
// état de la synchronisation, déconnexion)
export async function accountSheet() {
  const u = cloud.user, c = CLASSES[save.cls] || Object.values(CLASSES)[0], st = save.stats;
  const syncTxt = { synced: 'Sauvegarde synchronisée', syncing: 'Synchronisation…', pending: 'Hors ligne : sera synchronisé au retour du réseau', error: 'Erreur de synchronisation, nouvel essai bientôt' }[cloud.status] || '';
  const pic = u?.avatar ? `<img class="ac-pic" src="${esc(u.avatar)}" alt="" referrerpolicy="no-referrer">` : `<img class="ac-pic px" src="${heroURL(c.id, c.colors, 0)}" alt="">`;
  const ach = achList(), nAch = ach.filter(a => a.got).length;
  const nums = [
    ['play', fmt(st.runs || 0), 'Parties'], ['skull', fmt(st.kills || 0), 'Monstres vaincus'],
    ['map', `${save.zoneCleared.filter(Boolean).length}/${ZONES.length}`, 'Mondes vaincus'], ['book', `★ ${totalStars()}`, 'Étoiles d\'histoire'],
    ['crown', `${nAch}/${ach.length}`, 'Succès'], ['star', `${(save.mythGot || []).length}/${DATA.MYTHIC_ITEMS.length}`, 'Objets mythiques'],
  ];
  const cloudBlock = !cloud.available
    ? `<p class="muted set-note">La connexion n'est pas disponible sur cette version : votre progression est sauvegardée sur cet appareil. Mettez l'app à jour pour vous connecter.</p>`
    : u ? `<p class="ac-sync ${cloud.status}"><i></i>${esc(syncTxt || 'Sauvegarde en ligne active')}</p>
        <button class="btn ghost small" data-v="logout">Se déconnecter</button>`
      : `<p class="set-note">Connectez-vous pour <b>sauvegarder votre progression en ligne</b> et la retrouver sur un autre appareil. Le jeu reste jouable hors connexion.</p>
        <button class="btn google" data-v="login">${G_LOGO} Continuer avec Google</button>
        <button class="btn ghost small ac-mail" data-v="mail">✉️ Autre : lien par e-mail</button>`;
  const id = 'ac-' + Date.now();
  let action = null;
  const p = modal({
    title: 'Compte',
    cls: 'account-modal',
    body: `<div id="${id}">
      <div class="ac-head">${pic}<div class="ac-id"><b>${esc(u ? u.name || u.email : 'Invité')}</b><small>${esc(u?.email || 'Progression sur cet appareil')}</small>
        <button class="ac-title" data-v="title">${iconImg('flag', 14)}<span>${esc(titleName() || DATA.TITLES.recrue.name)}</span><i>›</i></button></div></div>
      <div class="ac-nums">${nums.map(([ic, v, l]) => `<div>${iconImg(ic, 18)}<b>${v}</b><small>${l}</small></div>`).join('')}</div>
      <h4>Sauvegarde en ligne</h4>
      ${cloudBlock}
    </div>`,
    buttons: [{ label: 'Fermer', cls: 'primary', value: 'close' }],
    dismissable: true,
  });
  const box = document.getElementById(id);
  box.addEventListener('click', e => {
    const b = e.target.closest('[data-v]'); if (!b) return;
    action = b.dataset.v; sfx('tap');
    box.closest('.modal-wrap').querySelector('.modal-btns .btn').click();
  });
  await p;
  if (action === 'login') return signGoogle();
  if (action === 'mail') return signInSheet();
  if (action === 'title') return titleSheet().then(afterSheet);
  if (action === 'logout') {
    const ok = await modal({ title: 'Se déconnecter ?', body: '<p>Votre progression reste sur cet appareil et dans votre compte.</p>', buttons: [{ label: 'Annuler', cls: 'ghost', value: false }, { label: 'Se déconnecter', cls: 'primary', value: true }] });
    if (ok) await cloud.signOut();
  }
  if (!inBattle()) home();
}

// deux sauvegardes différentes (cet appareil / en ligne) qui ont chacune avancé : le joueur choisit laquelle garder
export function chooseSave(local, remote) {
  const when = t => (t ? new Date(t).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '?');
  const stars = s => Object.values(s.storyCh || {}).reduce((n, b) => n + (b & 1) + ((b >> 1) & 1) + ((b >> 2) & 1), 0);
  const card = (s, label, ic) => `<div class="sv-card">
      <span class="sv-h">${ic}<b>${label}</b><small>${esc(when(s.updatedAt))}</small></span>
      <span class="sv-l">${iconImg('gold', 14)}<b>${fmt(s.gold || 0)}</b> or</span>
      <span class="sv-l">${iconImg('map', 14)}<b>${(s.zoneCleared || []).filter(Boolean).length}/${ZONES.length}</b> mondes</span>
      <span class="sv-l">${iconImg('book', 14)}<b>★ ${stars(s)}</b> histoire</span>
      <span class="sv-l">${iconImg('play', 14)}<b>${fmt(s.stats?.runs || 0)}</b> parties</span>
    </div>`;
  return modal({
    title: 'Deux sauvegardes',
    cls: 'save-modal',
    body: `<p class="set-note">Votre progression a avancé <b>sur cet appareil</b> et <b>sur un autre</b>. Laquelle garder ? L'autre sera remplacée.</p>
      <div class="sv-cards">${card(local, 'Cet appareil', '📱')}${card(remote, 'En ligne', '☁️')}</div>`,
    buttons: [{ label: '📱 Cet appareil', cls: 'ghost', value: 'local' }, { label: '☁️ En ligne', cls: 'primary', value: 'remote' }],
  }).then(v => v || 'local');
}
