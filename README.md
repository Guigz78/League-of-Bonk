# League of Bonk

Jeu de combat pixel art au tour par tour, inspiré de PokéBonk, dans un univers façon League of Legends (noms modifiés).
Version web installable sur iPhone (PWA) : fonctionne **hors connexion**, sauvegarde sur l'appareil, synchronisation optionnelle avec un compte Google.

## Jouer
- Ouvrir le site dans Safari → **Partager** → **Sur l'écran d'accueil**.
- 3 champions (Mage, Archère, Chevalier), 12 sorts, 6 zones, 30 monstres, 5 boss, 6 familiers.
- Frappe en rythme : touchez quand le curseur est dans la zone dorée. Parade : touchez quand « PARER ! » s'allume.
- À la mort : une pub permet de revivre une fois par expédition.

## Lancer en local
```
python3 -m http.server 8000
# puis http://localhost:8000
```

## Structure
- `js/data.js` : classes, sorts, zones, monstres, objets, familiers, succès
- `js/battle.js` : combat
- `js/game.js` : écrans et déroulé des expéditions
- `js/save.js` : sauvegarde locale et statistiques
- `js/cloud.js` + `js/config.js` : compte Google et synchronisation (Supabase)
- `js/pixel.js`, `js/art.js` : pixel art (héros dessinés, monstres générés)
- `js/ads.js` : pub récompensée (simulée dans le navigateur, AdMob une fois emballé en app)
- `sw.js` : fonctionnement hors ligne

## Compte Google (synchronisation)
1. Renseigner `SUPABASE_URL` et `SUPABASE_KEY` dans `js/config.js`.
2. Créer la table avec `supabase/schema.sql`.
3. Activer le fournisseur Google dans Supabase et ajouter l'adresse du site aux URL de redirection autorisées.
