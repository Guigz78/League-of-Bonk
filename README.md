# League of Bonk

Roguelike d'action en **3D low-poly** façon Megabonk / PokéBonk, vu de dessus, dans un univers fantastique original.
Version web installable sur iPhone (PWA) : fonctionne **hors connexion**, sauvegarde sur l'appareil, synchronisation optionnelle avec un compte (Google ou lien par e-mail). Nécessite **WebGL 2** (iOS 15 ou plus récent).

## Jouer
- Ouvrir le site dans Safari → **Partager** → **Sur l'écran d'accueil**.
- 3 champions (Mage, Archère, Chevalier), chacun avec son arme de départ et son ultime.
- Monde ouvert en 3D vu de dessus, jouable à un seul doigt : glissez pour courir, l'ultime se lance tout seul. Caméra fixe qui suit le champion, sans aucune rotation. Les attaques sont automatiques. Survivez 3 à 5 minutes aux hordes puis battez le boss géant.
- Votre champion évolue pendant la partie (niveaux 8 et 18), façon Pokémon. Explorez la carte : autels (bonus) et coffres (améliorations).
- À chaque niveau : choisissez 1 amélioration parmi 3 (11 armes, 9 tomes, 5 niveaux chacun). Les élites lâchent des coffres.
- 6 zones, 30 monstres, 5 boss, 6 familiers, équipement, boutique d'améliorations permanentes, succès, bestiaire.
- À la mort : une pub permet de revivre une fois par partie.
- Modes spéciaux (bouton Monde) : **défi de la semaine** (mêmes règles pour tout le monde, change le lundi : monde, difficulté, mission comme « Défendre la marmite », 2 malédictions ; récompense une fois par semaine) et **mode infini** (pas de boss, record par monde).
- Options → Graphismes « Léger » pour les vieux iPhone.

## Lancer en local
```
python3 -m http.server 8000
# puis http://localhost:8000
```

## Structure
- `js/data.js` : classes, sorts, zones, monstres, objets, familiers, succès
- `js/run.js` : moteur de jeu (déplacement, hordes, armes, évolutions, autels, coffres, boss)
- `js/visuals.js` : accès au rendu pour le reste du jeu
- `js/g3d/` : rendu 3D low-poly (Three.js, `vendor/three.module.min.js`) : `renderer.js` caméra fixe ; `world.js` sol, décor et bandeaux des zones ; `layout.js` thèmes et tracés des mondes ; `objects.js` objets ; `fx.js` effets ; `overlay.js` calque 2D (chiffres, flèches, mini-carte) ; `models*.js` personnages ; `portraits.js` / `preview.js` portraits et aperçus des menus ; `tex2d.js` petites textures
- `js/game.js` : écrans (carte, équipement, boutique, succès, niveaux, bilan) ; `js/forge.js` forge ; `js/chests.js` ouverture des coffres ; `js/account.js` options, compte, connexion ; `js/item-ui.js` affichage des objets
- `js/modes.js` : défi de la semaine et mode infini ; `js/story.js` + `js/story-mission.js` : histoire et missions (dont « Défendre la marmite »)
- `js/save.js` : sauvegarde locale et statistiques
- `js/cloud.js` + `js/config.js` : compte Google et synchronisation (Supabase)
- `js/pixel.js`, `js/art.js` : pixel art (héros dessinés, monstres générés)
- `js/ads.js` : pub récompensée (simulée dans le navigateur, AdMob une fois emballé en app)
- `sw.js` : fonctionnement hors ligne (`node tools/check-sw.mjs` vérifie que la liste des fichiers en cache est complète)

## Compte (synchronisation)
Connexion avec **Google** ou par **lien envoyé par e-mail**, depuis la bande « Sauvegarde en ligne » en haut de
l'accueil ou le bouton Compte (en haut à droite). Les sauvegardes sont stockées dans le projet Supabase « Pompelup »,
table `lob_saves` (voir `supabase/schema.sql`). Dans Supabase → Authentication → URL Configuration → Redirect URLs,
il faut ces deux adresses :
- `https://guigz78.github.io/League-of-Bonk/**` (version web)
- `com.guigz78.leagueofbonk://**` (app iOS : retour de Google ou du lien e-mail dans l'app)

## Tests
Les tests jouent au jeu dans un vrai Chromium, en iPhone 13 et iPhone SE simulés (Playwright) : chasse aux bugs sur
tous les écrans et avec chaque champion, logique (déblocages, défis, saison, anciennes sauvegardes), histoire complète,
objets mythiques, défilement au doigt de chaque écran, joystick tactile, barre du haut, connexion (réponses de Supabase
simulées, choix entre deux sauvegardes), forge, coffres et options, défi de la semaine et mode infini, expédition
jusqu'au giga boss.
- `node tests/run.mjs` : tout (~20 à 40 min) ; `node tests/run.mjs --rapide` : les tests courts (~2 min) ;
  `node tests/run.mjs histoire mythiques` : seulement ceux-là. Il faut Playwright (`npm install --no-save playwright`
  puis `npx playwright install chromium`).
- Sur GitHub, l'action « Tests » les lance à chaque mise à jour : rapides sur les branches, complets sur `main`.
  Captures et journaux dans l'artefact « tests-captures ».

## Mise en ligne
GitHub → Settings → Pages → Source « Deploy from a branch » → `main` / `(root)`.
Le jeu est alors disponible sur https://guigz78.github.io/League-of-Bonk/

## App iOS

Le jeu est aussi emballé en vraie app iPhone avec [Capacitor](https://capacitorjs.com) (dossier `ios/`, réglages dans
`capacitor.config.json`). Le code du jeu est le même que la version web : `npm run www` le copie dans `www/`, puis
`npx cap sync ios` le met dans le projet Xcode. Dans l'app, les vibrations passent par le moteur haptique de l'iPhone,
l'écran est en portrait plein écran, et la connexion s'ouvre dans une fenêtre Safari (modules `@capacitor/browser` et
`@capacitor/app`) puis revient dans l'app par son lien `com.guigz78.leagueofbonk://login` (déclaré dans `Info.plist`).

**Compilation automatique (sans Mac)** : à chaque mise à jour du jeu sur `main`, l'action GitHub « App iOS »
(`.github/workflows/ios.yml`) compile l'app sur un Mac de GitHub. On peut aussi la lancer à la main
(onglet *Actions* → *App iOS* → *Run workflow*).

- **Installer sur son iPhone, gratuitement** : télécharger `LeagueOfBonk-non-signee.ipa` dans les *Artifacts* du
  dernier run, puis l'installer avec [Sideloadly](https://sideloadly.io) (ou AltStore) et un identifiant Apple
  gratuit. Avec un compte gratuit, l'app est à réinstaller tous les 7 jours.
- **TestFlight / App Store** (compte développeur Apple, 99 €/an) : créer l'app dans App Store Connect avec l'identifiant
  `com.guigz78.leagueofbonk`, créer une clé d'API App Store Connect (rôle *Admin*), puis ajouter dans les secrets du
  dépôt GitHub : `APPLE_TEAM_ID`, `APPSTORE_KEY_ID`, `APPSTORE_ISSUER_ID` et `APPSTORE_KEY_P8` (contenu du fichier
  `.p8`). Chaque run envoie alors une nouvelle version sur TestFlight.

Icônes et écran de lancement : `tools/make-app-icon.html` (rendu 3D), générés par `node tools/make-app-icon.mjs`.
