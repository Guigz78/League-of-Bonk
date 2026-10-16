// Compte Google + synchronisation de la sauvegarde.
// Principe « hors ligne d'abord » : la partie est toujours enregistrée sur l'appareil ;
// quand on est connecté et qu'il y a du réseau, elle est envoyée dans le cloud.
import { SUPABASE_URL, SUPABASE_KEY, SAVE_TABLE } from './config.js';
import { save, onSave, replaceSave } from './save.js';

const listeners = new Set();
let sb = null;
let pushTimer = null;
let onRemote = () => {};

export const cloud = {
  available: false,
  user: null,
  status: 'off', // off | synced | syncing | pending | error
  onChange(fn) { listeners.add(fn); },
  setRemoteHandler(fn) { onRemote = fn; },
  async signIn() {
    if (!sb) return;
    await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: location.origin + location.pathname },
    });
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
  // la partie la plus récente gagne ; une partie vierge ne remplace jamais une vraie progression
  if (localFresh || (remoteNewer && progressScore(remote) > 0)) {
    // on ne coupe pas une expédition en cours sur cet appareil
    if (local.run && !remote.run && !localFresh) { await pushNow(); return; }
    replaceSave(remote);
    setStatus('synced');
    onRemote();
  } else if ((local.updatedAt || 0) > (remote.updatedAt || 0)) {
    await pushNow();
  } else {
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
}

function schedulePush() {
  if (!cloud.user) return;
  setStatus(navigator.onLine ? 'syncing' : 'pending');
  clearTimeout(pushTimer);
  pushTimer = setTimeout(pushNow, 2500);
}

export async function initCloud() {
  if (!SUPABASE_URL || !SUPABASE_KEY || !window.supabase) return;
  cloud.available = true;
  // affichage immédiat du compte, même hors ligne
  try { cloud.user = JSON.parse(localStorage.getItem('lob_user') || 'null'); } catch (e) { /* */ }
  if (cloud.user) cloud.status = navigator.onLine ? 'syncing' : 'pending';

  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'lob_auth' },
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
