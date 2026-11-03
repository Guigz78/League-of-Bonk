// Voix des personnages (générées avec ElevenLabs) : un fichier mp3 par réplique dans voices/, liste dans
// js/voices-list.js. Le champion a deux voix (homme, femme) selon le champion choisi. Une réplique sans fichier
// (ou option Voix coupée) garde le petit bruit de bulle habituel.
import { save } from './save.js';
import { playVoice, stopVoice, preloadVoices } from './audio.js';
import { VOICES } from './voices-list.js';

const FEM = new Set(['archer', 'mage', 'vampire', 'cryo', 'druid', 'engineer', 'pirate']); // championnes
const file = (id, k) => (k === 'h' ? `${id}-${FEM.has(save.cls) ? 'f' : 'm'}` : id);
const path = f => `voices/${f}.mp3`;
const on = () => save.settings.sound && save.settings.voice !== false;

// la réplique a-t-elle une voix ? (id : « c3-intro-2 », « c3-taunt », « pompon-done »… ; k : qui parle)
export const hasVoice = (id, k) => on() && VOICES.has(file(id, k));
// joue la voix de la réplique ; false si elle n'en a pas (l'appelant joue alors le bruit de bulle)
export function speak(id, k) {
  if (!hasVoice(id, k)) return false;
  playVoice(path(file(id, k)));
  return true;
}
export function preload(list) { if (on()) preloadVoices(list.filter(([id, k]) => VOICES.has(file(id, k))).map(([id, k]) => path(file(id, k)))); }
export const hush = () => stopVoice();
