// Publicité récompensée.
// Dans le navigateur : écran de pub simulé (5 s). Une fois emballé en app (Capacitor + AdMob),
// window.LoBNative.showRewardedAd() sera appelé à la place.
import { wait } from './ui.js';

export async function showRewardedAd() {
  if (window.LoBNative?.showRewardedAd) {
    try { return !!(await window.LoBNative.showRewardedAd()); } catch (e) { return false; }
  }
  return new Promise(resolve => {
    const w = document.createElement('div');
    w.className = 'ad-screen';
    w.innerHTML = `
      <div class="ad-box">
        <div class="ad-tag">Publicité</div>
        <div class="ad-art">League of Bonk</div>
        <p>Merci de soutenir le jeu !</p>
        <div class="ad-timer"><div class="fill"></div></div>
        <button class="btn primary" disabled>Patientez <b>5</b> s</button>
      </div>`;
    document.body.appendChild(w);
    const btn = w.querySelector('button'), n = btn.querySelector('b');
    let left = 5;
    w.querySelector('.ad-timer .fill').style.animationDuration = '5s';
    const iv = setInterval(() => {
      left--;
      if (left > 0) n.textContent = left;
      else { clearInterval(iv); btn.disabled = false; btn.textContent = 'Récupérer ma récompense'; }
    }, 1000);
    btn.onclick = async () => { w.classList.add('out'); await wait(200); w.remove(); resolve(true); };
  });
}
