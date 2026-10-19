// Personnages 3D low-poly façon Megabonk : point d'entrée pour le moteur (renderer.js) et les menus.
//
// Contrat :
//  heroModel(clsId, evo) → { root, setEvo(evo), update(dt, pose), dispose(), height }
//    Le moteur place root.position au sol (X = x·S, Y = 0, Z = y·S, S = 1/20). update() gère tout le reste :
//    orientation vers pose.dirA (ou pose.atkA pendant une attaque), hauteur de saut (pose.air en px), animation.
//    pose = { t, moving, speed01, air, vy, atk (1 = tir à l'instant, décroît), atkA, dirA, hurt (0..1), inv, dead }
//  new MonsterPool(scene, def, variant 'n'|'e'|'b', max) : begin() ; add(e, s) ; end() ; dispose() ; .height
//    s = { x, y, z (unités 3D, y vers le haut), rot (angle au sol), scale, flash, freeze, mad, anim, sq, alpha }
//    Le modèle est construit pour un rayon de 16 px : scale = e.r / 16. .height = haut de la tête à scale 1.
//  petModel(petId) → { root, update(dt, pose), dispose(), height } (pose : { t, moving, dirA })
export { heroModel, heroColors, HERO_HEIGHT } from './models-heroes.js';
export { MonsterPool, petModel, monsterHeight, MON_R } from './models-monsters.js';
import './models-bosses.js'; // enregistre les boss uniques dans le MonsterPool (variante 'b')
export { S } from './models-kit.js';
