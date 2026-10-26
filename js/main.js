import { boot, onRemoteSave } from './game.js';
import { initCloud, cloud } from './cloud.js';
import { isNative } from './native.js';

// empêche le zoom par double-tap et le menu contextuel sur iOS
document.addEventListener('dblclick', e => e.preventDefault(), { passive: false });
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('contextmenu', e => { if (e.target.closest('img, .spell')) e.preventDefault(); });

cloud.setRemoteHandler(onRemoteSave);
// connexion Google : pas dans l'app (Google refuse les vues web intégrées), la sauvegarde reste sur l'appareil
if (!isNative) initCloud().catch(() => {});
boot();

// service worker : seulement pour la PWA (l'app embarque déjà tous ses fichiers)
if (!isNative && 'serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
