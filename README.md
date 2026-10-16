# League of Bonk

Roguelike d'action pixel art façon Megabonk / Vampire Survivors, dans un univers façon League of Legends (noms modifiés).
Version web installable sur iPhone (PWA) : fonctionne **hors connexion**, sauvegarde sur l'appareil, synchronisation optionnelle avec un compte Google.

## Jouer
- Ouvrir le site dans Safari → **Partager** → **Sur l'écran d'accueil**.
- 3 champions (Mage, Archère, Chevalier), chacun avec son arme de départ et son ultime.
- Glissez le doigt pour vous déplacer, les attaques sont automatiques. Survivez 3 à 5 minutes aux hordes puis battez le boss.
- À chaque niveau : choisissez 1 amélioration parmi 3 (11 armes, 9 tomes, 5 niveaux chacun). Les élites lâchent des coffres.
- 6 zones, 30 monstres, 5 boss, 6 familiers, équipement, boutique d'améliorations permanentes, succès, bestiaire.
- À la mort : une pub permet de revivre une fois par partie.

## Lancer en local
```
python3 -m http.server 8000
# puis http://localhost:8000
```

## Structure
- `js/data.js` : classes, sorts, zones, monstres, objets, familiers, succès
- `js/run.js` : moteur de jeu temps réel (déplacement, hordes, armes, boss)
- `js/game.js` : écrans (carte, équipement, boutique, succès, niveaux, bilan)
- `js/save.js` : sauvegarde locale et statistiques
- `js/cloud.js` + `js/config.js` : compte Google et synchronisation (Supabase)
- `js/pixel.js`, `js/art.js` : pixel art (héros dessinés, monstres générés)
- `js/ads.js` : pub récompensée (simulée dans le navigateur, AdMob une fois emballé en app)
- `sw.js` : fonctionnement hors ligne

## Compte Google (synchronisation)
Les sauvegardes sont stockées dans le projet Supabase « Pompelup », table `lob_saves` (voir `supabase/schema.sql`).
L'adresse du jeu doit figurer dans Supabase → Authentication → URL Configuration → Redirect URLs :
`https://guigz78.github.io/League-of-Bonk/**`

## Mise en ligne
GitHub → Settings → Pages → Source « Deploy from a branch » → `main` / `(root)`.
Le jeu est alors disponible sur https://guigz78.github.io/League-of-Bonk/
