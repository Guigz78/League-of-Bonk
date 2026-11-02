// App iOS (Capacitor) : ajustements propres à l'app native. Dans le navigateur (PWA), ce module ne fait rien.
const C = window.Capacitor;
export const isNative = !!C?.isNativePlatform?.();
// module natif de l'app (Haptics, Browser, App…) ; null dans le navigateur ou si l'app n'a pas encore ce module
export const nativePlugin = name => (isNative ? C.Plugins?.[name] || C.registerPlugin?.(name) || null : null);

if (isNative) {
  document.documentElement.classList.add('native');
  // vibrations : l'API web n'existe pas sur iPhone, on passe par le moteur haptique (durée -> force du retour)
  const H = nativePlugin('Haptics');
  if (H && !navigator.vibrate) {
    const vib = ms => {
      const d = Array.isArray(ms) ? Math.max(0, ...ms) : +ms || 0;
      if (d > 0) H.impact({ style: d >= 60 ? 'HEAVY' : d >= 25 ? 'MEDIUM' : 'LIGHT' }).catch(() => {});
      return true;
    };
    try { Object.defineProperty(navigator, 'vibrate', { value: vib, configurable: true }); } catch (e) { /* navigateur figé */ }
  }
}
