// Rendu du jeu : 3D low-poly façon Megabonk (caméra fixe, js/g3d). Le reste du jeu passe uniquement par ce module.
// Sans WebGL 2 (iOS trop ancien) : game.js refuse la partie avec un message ; portraits et bandeaux sont alors une
// image vide et les aperçus animés ne font rien (jamais d'erreur dans les menus).
import * as V3 from './g3d/index.js';

export const supported = V3.supported;
const NONE = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'; // 1 px transparent

export function createGfx(run, canvas) { return new V3.Gfx(run, canvas); }
export function heroURL(...a) { return (supported() && V3.heroURL(...a)) || NONE; }
export function creatureURL(...a) { return (supported() && V3.creatureURL(...a)) || NONE; }
export function mountPreview(...a) { if (supported()) V3.mountPreview(...a); }
export function zoneBannerURL(...a) { return (supported() && V3.zoneBannerURL(...a)) || NONE; }
