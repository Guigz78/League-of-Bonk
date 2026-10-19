// Choix du rendu : 3D low-poly façon Megabonk (caméra fixe) par défaut, 2D cartoon en secours
// (réglage « Graphismes » ou appareil sans WebGL). Le reste du jeu passe uniquement par ce module.
import { save } from './save.js';
import * as V2 from './g2d/index.js';
import * as V3 from './g3d/index.js';

export function use3D() { return save.settings.gfx !== '2d' && V3.supported(); }
const V = () => (use3D() ? V3 : V2);

export function createGfx(run, canvas) { return new (V().Gfx)(run, canvas); }
export function heroURL(...a) { return V().heroURL(...a); }
export function creatureURL(...a) { return V().creatureURL(...a); }
export function mountPreview(...a) { return V().mountPreview(...a); }
export function zoneBannerURL(...a) { return V().zoneBannerURL(...a); }
