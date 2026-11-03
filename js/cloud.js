// Compte (Google ou e-mail) + synchronisation de la sauvegarde.
// Principe « hors ligne d'abord » : la partie est toujours enregistrée sur l'appareil ;
// quand on est connecté et qu'il y a du réseau, elle est envoyée dans le cloud.
// Navigateur (PWA) : la page de Google (ou le lien reçu par e-mail) revient sur l'adresse du jeu.
// App iOS : la page s'ouvre dans une fenêtre Safari (module Browser) et revient dans l'app par son lien
// com.guigz78.leagueofbonk://login (module App, déclaré dans Info.plist) ; le code reçu est échangé contre la session
// (flux PKCE). Ce lien doit figurer dans Supabase → Authentication → URL Configuration → Redirect URLs.
import { SUPABASE_URL, SUPABASE_KEY, SAVE_TABLE } from './config.js';
import { save, onSave, replaceSave } from './save.js';
import { isNative, nativePlugin } from './native.js';

const APP_LINK = 'com.guigz78.leagueofbonk://login';
const back = () => (isNative ? APP_LINK : location.origin + location.pathname);
const errTxt = e => (e?.message || String(e || '')).slice(0, 160);

const listeners = new Set();
let sb = null;
let pushTimer = null;
let onRemote = () => {};
let onConflict = null; // (local, remote) => Promise<'local' | 'remote'> : demandé au joueur (game.js)
// dernière synchronisation réussie sur cet appareil (par compte) : sert à repérer un vrai conflit
const SYNC_KEY = 'lob_synced';
const lastSync = () => { try { const o = JSON.parse(localStorage.getItem(SYNC_KEY) || 'null'); return o && o.uid === cloud.user?.id ? +o.at || 0 : 0; } catch (e) { return 0; } };
const markSync = at => { try { localStorage.setItem(SYNC_KEY, JSON.stringify({ uid: cloud.user?.id, at })); } catch (e) { /* stockage indisponible */ } };

export const cloud = {
  available: false,
  user: null,
  status: 'off', // off | synced | syncing | pending | error
  lastError: '', // dernier échec de connexion (retour de Google ou du lien e-mail dans l'app)
  onChange(fn) { listeners.add(fn); },
  setRemoteHandler(fn) { onRemote = fn; },
  setConflictHandler(fn) { onConflict = fn; },
  // provider : 'google' ; renvoie { error } si la connexion n'a pas pu démarrer
  async signIn(provider = 'google') {
    if (!sb) return { error: 'indisponible' };
    try {
      if (isNative) { // fenêtre Safari dans l'app, retour par le lien de l'app
        const { data, error } = await sb.auth.signInWithOAuth({ provider, options: { redirectTo: APP_LINK, skipBrowserRedirect: true } });
        if (error || !data?.url) return { error: errTxt(error) || 'indisponible' };
        await nativePlugin('Browser').open({ url: data.url, presentationStyle: 'popover' });
        return {};
      }
      const { error } = await sb.auth.signInWithOAuth({ provider, options: { redirectTo: back() } });
      return error ? { error: errTxt(error) } : {};
    } catch (e) { return { error: errTxt(e) }; }
  },
  // lien de connexion envoyé par e-mail (compte créé au premier envoi)
  async signInEmail(email) {
    if (!sb) return { error: 'indisponible' };
    try {
      const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: back(), shouldCreateUser: true } });
      return error ? { error: errTxt(error) } : {};
    } catch (e) { return { error: errTxt(e) }; }
  },
  async signOut() {
    if (!sb) return;
    await pushNow();
    await sb.auth.signOut();
    setUser(null);
  },
  syncNow: () => pushNow(),
};

function emit() { for (const fn of listeners) { try { fn(cloud); } catch (e) { /* */ } } }
function setStatus(s) { if (cloud.status !== s) { cloud.status = s; emit(); } }

function setUser(session) {
  const u = session?.user;
  cloud.user = u ? {
    id: u.id,
    email: u.email,
    name: u.user_metadata?.full_name || u.user_metadata?.name || '',
    avatar: u.user_metadata?.avatar_url || u.user_metadata?.picture || '',
  } : null;
  if (cloud.user) {
    try { localStorage.setItem('lob_user', JSON.stringify(cloud.user)); } catch (e) { /* */ }
  } else {
    try { localStorage.removeItem('lob_user'); } catch (e) { /* */ }
    setStatus('off');
  }
  emit();
}

const progressScore = s => (s?.stats?.wins || 0) + (s?.zoneCleared || []).filter(Boolean).length * 50;

async function pull() {
  if (!cloud.user || !navigator.onLine) { if (cloud.user) setStatus('pending'); return; }
  setStatus('syncing');
  const { data, error } = await sb.from(SAVE_TABLE).select('data, updated_at').eq('user_id', cloud.user.id).maybeSingle();
  if (error) { setStatus('error'); return; }
  const remote = data?.data;
  if (!remote) return pushNow();
  const local = save;
  const localFresh = progressScore(local) === 0;
  const remoteNewer = (remote.updatedAt || 0) > (local.updatedAt || 0);
  // vrai conflit : les deux ont une progression et ont changé chacune depuis la dernière synchronisation de cet
  // appareil (ou première connexion ici) → on demande au joueur laquelle garder
  const since = lastSync(), lu = local.updatedAt || 0, ru = remote.updatedAt || 0;
  if (onConflict && !localFresh && progressScore(remote) > 0 && lu !== ru && lu > since && ru > since) {
    setStatus('pending');
    const pick = await onConflict(local, remote);
    if (pick === 'remote') { replaceSave(remote); markSync(remote.updatedAt || 0); setStatus('synced'); onRemote(); }
    else await pushNow();
    return;
  }
  // sinon la partie la plus récente gagne ; une partie vierge ne remplace jamais une vraie progression
  if (localFresh || (remoteNewer && progressScore(remote) > 0)) {
    // on ne coupe pas une expédition en cours sur cet appareil
    if (local.run && !remote.run && !localFresh) { await pushNow(); return; }
    replaceSave(remote);
    markSync(remote.updatedAt || 0);
    setStatus('synced');
    onRemote();
  } else if ((local.updatedAt || 0) > (remote.updatedAt || 0)) {
    await pushNow();
  } else {
    markSync(remote.updatedAt || 0);
    setStatus('synced');
  }
}

async function pushNow() {
  clearTimeout(pushTimer);
  if (!sb || !cloud.user) return;
  if (!navigator.onLine) { setStatus('pending'); return; }
  setStatus('syncing');
  const { error } = await sb.from(SAVE_TABLE).upsert({
    user_id: cloud.user.id,
    data: save,
    updated_at: new Date(save.updatedAt || Date.now()).toISOString(),
  });
  setStatus(error ? 'error' : 'synced');
  if (error) pushTimer = setTimeout(pushNow, 15000);
  else markSync(save.updatedAt || 0);
}

function schedulePush() {
  if (!cloud.user) return;
  setStatus(navigator.onLine ? 'syncing' : 'pending');
  clearTimeout(pushTimer);
  pushTimer = setTimeout(pushNow, 2500);
}

export async function initCloud() {
  if (!SUPABASE_URL || !SUPABASE_KEY || !window.supabase) return;
  // app iOS : il faut les modules Browser et App (versions de l'app d'avant : connexion indisponible)
  if (isNative && !(nativePlugin('Browser') && nativePlugin('App'))) return;
  cloud.available = true;
  // affichage immédiat du compte, même hors ligne
  try { cloud.user = JSON.parse(localStorage.getItem('lob_user') || 'null'); } catch (e) { /* */ }
  if (cloud.user) cloud.status = navigator.onLine ? 'syncing' : 'pending';

  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: !isNative, storageKey: 'lob_auth', ...(isNative ? { flowType: 'pkce' } : {}) },
  });
  // app iOS : retour de Google ou du lien e-mail par le lien de l'app → session
  if (isNative) nativePlugin('App').addListener('appUrlOpen', async ({ url }) => {
    if (!url || !url.startsWith('com.guigz78.leagueofbonk://')) return;
    try { await nativePlugin('Browser').close(); } catch (e) { /* déjà fermée */ }
    const u = new URL(url.replace('com.guigz78.leagueofbonk://', 'https://app/')), q = u.searchParams, h = new URLSearchParams(u.hash.slice(1));
    const code = q.get('code');
    if (code) { const { error } = await sb.auth.exchangeCodeForSession(code); if (error) cloud.lastError = errTxt(error); }
    else if (h.get('access_token')) await sb.auth.setSession({ access_token: h.get('access_token'), refresh_token: h.get('refresh_token') });
    else if (q.get('error_description') || h.get('error_description')) cloud.lastError = q.get('error_description') || h.get('error_description');
    emit();
  });
  sb.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') return setUser(null);
    if (session) {
      const changed = cloud.user?.id !== session.user.id;
      setUser(session);
      if (event === 'SIGNED_IN' || changed || event === 'INITIAL_SESSION') pull();
    } else if (event === 'INITIAL_SESSION' && navigator.onLine) {
      // session expirée et pas de réseau = on garde l'affichage ; avec réseau = déconnecté
      setUser(null);
    }
  });
  // nettoie l'adresse après le retour de Google
  if (location.hash.includes('access_token') || location.search.includes('code=')) {
    setTimeout(() => history.replaceState(null, '', location.pathname), 1500);
  }
  onSave(() => schedulePush());
  window.addEventListener('online', () => { if (cloud.user) pull(); });
  window.addEventListener('offline', () => { if (cloud.user) setStatus('pending'); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && cloud.user) pushNow(); });
  emit();
}
