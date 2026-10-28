// Armes des arsenaux de champions (ajoutées par js/arsenal-*.js) : chaque champion a ses 4 armes (data.js ARSENAL) et
// seules les siennes lui sont proposées. Les nouvelles armes se branchent ici sans toucher au grand switch de run.js :
// WX[id] = {
//   stats(c) -> { dmg, cd, n, R, … }  (c = { A, ar, h, L, lv, E, p, run } : A = dégâts de base, ar = taille, h = recharge,
//                                       L(k) = 1 si niveau ≥ k, E = arme évoluée) ; même rôle que run.wstats
//   fire(run, w, S, E, dt)            (chaque image, comme un case de run.updateWeapons ; w.t = minuterie de l'arme)
//   lines: [[clé, libellé, format]…]  (lignes des cartes de niveau, comme WLINES de run.js)
//   size: 'R' | 'w' …                 (caractéristique de taille, comme WSIZE)
//   shots: ['type', …]                (types de projectiles tirés : victimes comptées pour l'arme)
// }
export const WX = {};
export const addWeapons = defs => Object.assign(WX, defs);
export const shotWeapon = type => { for (const [id, d] of Object.entries(WX)) if (d.shots?.includes(type)) return id; return null; };
