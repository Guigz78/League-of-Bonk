import { boot, onRemoteSave } from './game.js';
import { initCloud, cloud } from './cloud.js';

// empêche le zoom par double-tap et le menu contextuel sur iOS
document.addEventListener('dblclick', e => e.preventDefault(), { passive: false });
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('contextmenu', e => { if (e.target.closest('img, .spell')) e.preventDefault(); });

cloud.setRemoteHandler(onRemoteSave);
initCloud().catch(() => {});
boot();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
