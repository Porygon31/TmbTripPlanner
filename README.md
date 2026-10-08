# TMB Trip Planner

Outil web de préparation d'un **Tour du Mont-Blanc personnalisé**. On part du tracé officiel, on affiche et on combine les variantes réelles, on crée ou on modifie son propre parcours sur une carte topographique en suivant les sentiers, puis on exporte le résultat en **GPX 1.1**.

> ⚠️ **Sécurité** : les itinéraires sont indicatifs et **jamais garantis praticables**. La météo, la neige et les fermetures de sentiers peuvent tout changer. Vérifiez toujours les conditions locales avant de partir (voir l'onglet *Projet → Sécurité et conditions*).

## Fonctionnalités

| | |
| --- | --- |
| **Carte** | Leaflet avec plusieurs fonds de carte, tous sans clé d'API : topographique (OpenTopoMap), classique (OSM), relief/terrain et satellite (Esri), Plan IGN (France), Swisstopo (Suisse). Surcouches : sentiers balisés (Waymarked Trails), ombrage du relief, refuges/cols/sommets/villages (OSM). Zoom, plein écran, géolocalisation, échelle. |
| **TMB et variantes** | Tracé de référence et variantes chargés depuis `data/`. Chaque fiche donne la distance, l'écart de distance et de D+ par rapport au tronçon classique, l'altitude max, la difficulté (fournie ou estimée), les points de départ et de jonction, la source et la licence. On peut afficher plusieurs variantes à la fois, chacune dans sa couleur. |
| **Créer mon itinéraire** | Chaque clic ajoute un point, et le tronçon est calculé **sur les sentiers** par un moteur de routage randonnée (BRouter `hiking-mountain` par défaut). Ce n'est jamais une ligne droite implicite. |
| **Édition** | Déplacer un point (seuls les tronçons voisins sont recalculés), en insérer un (clic sur le tracé ou glisser une poignée), supprimer, réordonner, inverser le sens, annuler/rétablir (Ctrl+Z / Ctrl+Y), tout effacer. Sur une longue trace figée (TMB, import), seule la zone modifiée (≈ 1,5 km) est recalculée. |
| **TMB personnalisé** | « Partir du TMB officiel », puis « Ajouter à mon itinéraire » sur une variante : le tronçon classique est remplacé par la variante, sans doublon, sans segment inversé et sans trou. Les chevauchements sont refusés avec un message explicite, et le retrait d'une variante restaure le tronçon classique. |
| **Import GPX** | Fichier `.gpx` affiché sur la carte avec son nom, la distance, D+, D−, altitudes min et max et le nombre de points. Si le fichier n'a pas d'altitude, elle est complétée en ligne. « Utiliser comme base » le transforme en itinéraire modifiable. |
| **Export GPX** | GPX 1.1 conforme au schéma officiel : coordonnées, ordre, altitude, nom, points de départ, d'arrivée et de fin d'étape. Au choix, une trace unique ou une trace par étape. Téléchargement direct depuis le navigateur. |
| **Profil altimétrique** | Graphique interactif (uPlot). Le survol du profil met en évidence le point sur la carte, et le survol de la carte surligne le tronçon correspondant sur le profil. |
| **Statistiques et étapes** | Distance, D+, D−, altitudes min et max, nombre de points et temps de marche indicatif (DIN 33466), recalculés en direct. Découpage en journées via les points « fin d'étape ». |
| **Sauvegarde locale** | Sauvegarde automatique (IndexedDB), sauvegardes nommées, « Nouveau parcours », « Restaurer le dernier parcours ». Aucun compte : rien ne quitte le navigateur. |
| **Mobile** | Carte presque plein écran, panneau inférieur à trois positions, boutons adaptés au tactile. |

## Démarrage

Prérequis : Node.js ≥ 20.19 (22 recommandé).

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # build statique dans dist/
npm run preview      # sert dist/ sur http://localhost:4173
```

`npm run dev` et `npm run build` régénèrent d'abord le catalogue (`public/data/`) à partir de `data/`.

### Données GPX (à fournir)

Le dépôt **ne contient pas** de tracé réel : il faut déposer les GPX dans `data/gpx/`. La procédure, les noms de fichiers attendus, les champs de `data/catalog.config.json` et la source recommandée (OpenStreetMap, super-relation [124456](https://www.openstreetmap.org/relation/124456), licence ODbL) sont décrits dans **[data/README.md](data/README.md)**.

Option pratique, sur une machine avec Internet :

```bash
npm run fetch:osm    # télécharge le TMB et ses 7 variantes depuis OSM, avec altitude
npm run build:data   # régénère le catalogue
```

Tant que `data/` est vide, l'application fonctionne quand même (création, import, export) et explique comment ajouter les traces.

## Déploiement

L'application est **100 % statique**. `npm run build` produit `dist/`, à publier tel quel sur n'importe quel hébergeur (GitHub Pages, Netlify, Vercel, Cloudflare Pages, serveur nginx…). La configuration `base: './'` permet de la servir aussi depuis un sous-dossier. À chaque push, la CI publie ce dossier en artefact `tmb-trip-planner-dist`.

## Architecture

```
src/
├── core/                 TypeScript pur (sans React ni navigateur) : testable, déplaçable en Web Worker
│   ├── types.ts          Route, RoutePoint, Waypoint, RouteSegment, TmbVariant, ElevationPoint, RouteStatistics…
│   ├── geo/              distances (haversine), projection sur une ligne, découpe, simplification (Turf.js)
│   ├── elevation/        D+/D− (hystérésis 5 m), min/max, pente, temps DIN 33466
│   ├── gpx/              parse.ts (@tmcw/togeojson), generate.ts (GPX 1.1), exportRoute.ts
│   ├── route/            operations (édition), compose (variantes), geometry, stats, history
│   └── variants/         orientation et jonctions, difficulté estimée, format de configuration
├── services/             chaque service est une interface avec des implémentations interchangeables
│   ├── routing/          RoutingProvider : BRouter (défaut), GraphHopper, openrouteservice ; file + cache
│   ├── elevation/        ElevationProvider : Open-Meteo (Copernicus GLO-90)
│   ├── pois/             PoiProvider : fichier statique ou Overpass (cache 30 jours)
│   ├── conditions/       TrailConditionsProvider : liens officiels, prêt pour de futurs flux de fermetures
│   ├── storage/          IndexedDB (projets) et localStorage (préférences)
│   └── map/basemaps.ts   fonds de carte et surcouches (changer de fournisseur = modifier cette liste)
├── state/                store zustand, résolution asynchrone des tronçons, sauvegarde auto, canal de survol
└── components/           carte (react-leaflet, rendu canvas), panneaux, profil (uPlot)
scripts/
├── build-catalog.ts      data/ → public/data/ (statistiques, orientation, jonctions, difficulté)
└── fetch-osm-tmb.ts      facultatif : récupère les GPX OSM du TMB
```

### Modèle d'itinéraire

Un itinéraire est une liste de waypoints. `segments[i]` relie `waypoints[i]` à `waypoints[i+1]` et peut être de trois types :

- `routed` : calculé par le moteur de routage ;
- `track` : tranche figée d'une trace (TMB, variante ou import), avec sa référence `{trackId, startDist, endDist}` ;
- `straight` : ligne droite, uniquement sur choix explicite ou pour boucher un trou de la trace d'origine, et toujours signalée.

Les opérations sont des fonctions pures qui renvoient un nouvel itinéraire. Elles partagent les tableaux de points, ce qui rend l'historique annuler/rétablir peu coûteux.

### Changer de moteur de routage

Il suffit d'implémenter `RoutingProvider` (`src/services/routing/types.ts`) et de l'ajouter dans `registry.ts`. Le choix du moteur se fait dans *Projet → Réglages*, avec l'adresse d'un serveur BRouter personnel ou une clé GraphHopper/openrouteservice.

### Performances

- Rendu canvas Leaflet, et simplification Douglas-Peucker (≈ 2 m) réservée à l'affichage. Les données complètes servent aux calculs et à l'export.
- Statistiques et géométrie mémoïsées (`WeakMap`) : seuls les tronçons modifiés sont recalculés.
- Le survol carte ↔ profil passe par un canal hors React, limité à une mise à jour par image.
- File de routage limitée à 2 requêtes simultanées, avec cache LRU et annulation des requêtes devenues inutiles.

## Tests

```bash
npm run lint
npm run typecheck
npm test               # tests unitaires (Vitest) : géo, dénivelé, GPX, édition, variantes, services
npm run test:e2e       # bout en bout (Playwright), réseau simulé, desktop + mobile
npm run test:e2e:live  # bout en bout avec les vrais services (Internet requis)
```

Les tests de bout en bout couvrent :

- le chargement de la carte, l'affichage des GPX et la fiche d'un tracé ;
- l'affichage et le masquage de plusieurs variantes ;
- la création d'un itinéraire, qui doit suivre un trajet routé et non une ligne droite ;
- le déplacement d'un point, en vérifiant que seuls les deux tronçons voisins sont recalculés ;
- l'insertion, la suppression et le réordonnancement de points, annuler/rétablir et l'effacement complet ;
- les étapes et la persistance après rechargement ;
- le TMB personnalisé avec deux variantes, sans trou ;
- l'import, puis l'export GPX validé par `xmllint` contre le schéma officiel GPX 1.1 (en CI), et la réouverture du fichier exporté ;
- la synchronisation entre profil et carte, et l'interface mobile.

Les données de test sont **synthétiques** (`tests/fixtures`, préfixe « FIXTURE ») et ne sont jamais livrées dans l'application.

## Sources et licences

- Fonds de carte : © contributeurs OpenStreetMap (ODbL), OpenTopoMap (CC-BY-SA), Esri, IGN, swisstopo, Waymarked Trails (CC-BY-SA). Les attributions sont affichées sur la carte.
- Calcul d'itinéraire : [BRouter](https://brouter.de), données OSM.
- Altitudes complémentaires : [Open-Meteo](https://open-meteo.com) (Copernicus GLO-90). Points d'intérêt : OSM via Overpass.
- Tracés du TMB et des variantes : voir `data/catalog.config.json`, où chaque entrée indique sa source et sa licence.
