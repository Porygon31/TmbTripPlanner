# TMB Atelier — exploitation

Application publique en français, sans compte. Projet Sites : `appgprj_6ac76973030c8191ad60f95caad0e7fc`. Le navigateur de chaque visiteur conserve son propre brouillon et sa dernière sauvegarde explicite dans IndexedDB. Un autre appareil ou navigateur ne partage pas ces données.

## Lancer localement

Node 22.13 ou supérieur, npm. Depuis le dossier du projet :

```powershell
npm run install:ci
# Créer .env.local à partir de .env.example, puis renseigner ORS_API_KEY.
$env:CHOKIDAR_USEPOLLING = '1' # utile si Visual Studio verrouille son index .vs
npm run dev
```

La clé reste dans `.env.local` (ignoré par Git) et dans le secret de production Sites `ORS_API_KEY`. Ne jamais utiliser un préfixe `NEXT_PUBLIC_`, inclure la clé dans un GPX, ou la publier dans le dépôt. Après rotation, modifier le secret Sites puis redéployer une version sauvegardée pour appliquer la nouvelle révision d’environnement.

Les variables optionnelles `ORS_DIRECTIONS_URL` et `ORS_ELEVATION_URL` permettent de changer les adresses des services. Les adresses officielles actuelles figurent dans `.env.example` : `api.heigit.org/openrouteservice/v2/directions/foot-hiking/geojson` et `api.heigit.org/openelevationservice/v0/line`. L’ancien domaine `api.openrouteservice.org` est déprécié ; voir la [migration annoncée par HeiGIT](https://ask.openrouteservice.org/t/deprecating-api-openrouteservice-org-in-favour-of-api-heigit-org/7912). La clé existante reste valable. Le routage utilise `foot-hiking`, `preference: recommended`, `elevation: true`, avec accrochage aux sentiers à 100 mètres maximum. Un échec conserve le parcours précédent ; aucune droite de remplacement n’est créée.

Un HTTP 504 signifie qu’OpenRouteService n’a pas répondu dans le délai imparti : 60 secondes par tronçon pour le routage, 25 secondes pour l’altimétrie. La limite de routage tient compte d’un trajet réel près des Houches qui a demandé 44 secondes et échouait avec l’ancienne limite de 25 secondes. Un HTTP 502 indique une connexion échouée, une réponse illisible ou une indisponibilité renvoyée par le fournisseur. Consulter les journaux serveur (type de service et motif uniquement, sans clé ni coordonnées) et l’[état des services HeiGIT](https://status.heigit.org/). Un test qui réussit dans une autre région ne suffit pas : vérifier aussi un trajet près des Houches. Le service peut encore dépasser cette limite ou être indisponible ; le parcours précédent est alors conservé.

## Vérifications

### GitHub et publication

Le dépôt GitHub est `Porygon31/TmbTripPlanner`, branche principale `main`. Le workflow `.github/workflows/ci.yml` teste et compile cette branche puis publie le dossier `github-pages/`. Ce dossier redirige l’ancienne adresse `https://porygon31.github.io/TmbTripPlanner/` vers le site public `https://tmb-atelier.poorygon.chatgpt.site/`.

L’application complète utilise les routes serveur `/api/route` et `/api/elevation` ; GitHub Pages ne les exécute pas. Les déploiements Sites utilisent le projet existant dans `.openai/hosting.json` et son dépôt source géré. Après une modification de l’application, publier sur Sites la même révision que celle de `main` ; un push GitHub ne déclenche pas ce déploiement. Ne jamais placer `ORS_API_KEY` dans GitHub Pages ou les artefacts client.

L’ancien `main` est archivé sous `archive/main-before-sites-2026-10-18` (commit `6c4c824aaed4dc9839acfadb6e69bc6cb6e2eb3c`). Le dossier local `TmbTripPlanner` contient encore cette ancienne application : le dossier de travail du site actuel est `tmb-planner`.

### Commandes locales

```powershell
npm test
npx tsc --noEmit
npm run lint
./scripts/validate-gpx.ps1
node scripts/check-ors.mjs # Deux appels réels ; requiert la clé locale.
```

Les tests unitaires couvrent distance, altitudes absentes, filtrage, variantes inversées et chevauchantes, invariance des portions non modifiées, édition des segments adjacents, réponse tardive, échec de routage, GPX 1.0/1.1, limites de taille et de points, conservation des ruptures, étapes, stockage et erreurs/quota serveur. La validation XSD lit `outputs/roundtrip.gpx` produit par les tests et le schéma officiel archivé dans `tests/gpx.xsd`.

## Données et actualisation

Les six GPX originaux ont été téléchargés depuis le panneau **Download route → GPX → forwards → Get file** de Waymarked Trails. Relations : 9678362 (classique), 9678267 (Tricot), 9678296 (Fours), 9678375 (Tête Bernarda), 9678380 (Arpette), 9678437 (Grands).

- `public/data/sources/<relation>.gpx` : exports originaux, sans altitude.
- `*-metadata.json` : version, horodatage et métadonnées OSM de la relation.
- `*-ways.json` : géométries et tags des chemins, dont `sac_scale` quand disponible.
- `*-elevation.json` : coordonnées d’origine enrichies par le modèle de terrain OpenRouteService.
- `*-connector-*.json` : liaisons réellement calculées par ORS, conservées comme segments de provenance distincte.
- `catalog.json` : boucle orientée dans le sens antihoraire depuis Les Houches, variantes, statistiques, métadonnées, SHA-256 des GPX.
- `catalog-audit.json` : continuité, raccordements, orientation, couverture des cotations SAC et liaisons.
- `pois.json` : 160 POI OSM nommés, dont 32 hôtels (`tourism=hotel`) ; extrait non exhaustif autour du tracé et des variantes. Les petites zones d’extraction sont documentées par `scripts/fetch-pois-osm.ts`. `extractedAt` garde la date du plus ancien extrait utilisé et `preparedAt` la date de préparation du fichier. La catégorie Hôtels est désactivée au premier affichage, comme les autres catégories hors Les Houches.
- Les refuges et hôtels conservent le champ optionnel `website`, extrait de `website` puis de `contact:website`. Le filtre partagé `lib/tmb/poi-websites.js` accepte seulement les URL HTTP(S) absolues sans identifiants et les vérifie à nouveau à l’affichage. Sans adresse valide, aucun lien d’hébergement n’est présenté ; le lien de provenance OSM reste disponible. Les fiches POI conservent l’apparence Leaflet habituelle, avec une largeur plafonnée sur petit écran.

Pour actualiser, conserver une copie datée des sources ; télécharger à nouveau les six GPX avec les noms attendus ; retirer uniquement les fichiers dérivés correspondants (`*-ways.json`, `*-metadata.json`, `*-elevation.json`, `*-connector-*.json`) avant de lancer les scripts suivants. Ne pas utiliser une ancienne altitude pour de nouvelles coordonnées.

```powershell
node scripts/fetch-sources.mjs
node --import tsx scripts/prepare-catalog.ts
node --import tsx scripts/fetch-pois-osm.ts
npm test
```

`prepare-catalog.ts` refuse une discontinuité des sources. Il enrichit par lots de 1 999 points avec temporisation, puis réutilise les résultats enregistrés. En cas d’erreur ORS, reprendre le script ; les fichiers déjà terminés sont réutilisés. Pour renouveler les POI, retirer le cache local `work/poi-cache` après sauvegarde si nécessaire. Les serveurs Overpass n’étaient pas disponibles lors de l’extraction ; l’extrait intégré provient de l’API officielle OSM 0.6.

Deux liaisons font partie du catalogue : environ 12 m à la sortie de Tricot et la descente du Chalet du Glacier vers la jonction TMB/Grands, à Trient, après Arpette. Il est donc possible d’associer Arpette et les Grands, avec un retour vers cette jonction de référence. Les variantes ne constituent pas un avis sur leur praticabilité.

Les distances utilisent une géodésie sphérique Turf. D+/D− : rééchantillonnage des altitudes tous les 25 m, filtre médian sur cinq échantillons, puis seuil de variation de 5 m ; les lacunes interrompent le calcul. Les altitudes extrêmes restent celles des données disponibles. Les filtres peuvent faire varier légèrement le dénivelé avec la segmentation, particulièrement aux limites. Le temps indicatif est `distance_km/4 + D+/600`, hors pauses, affiché seulement lorsque les altitudes sont complètes. Le profil et les statistiques ne constituent pas une mesure altimétrique de terrain.

## Architecture

- `components/planner` : interface, React-Leaflet chargé uniquement dans le navigateur, profil SVG interactif.
- `lib/tmb` : types, géométrie, composition du catalogue, GPX, éditeur, routage, stockage, étapes et interface future des conditions de sentier.
- `hooks` : transactions d’édition avec AbortController et révision, historique, autosauvegarde, WebMCP.
- `workers` : analyse/simplification avec cache par identifiant de segment ; import XML hors du fil d’interface. Repli fonctionnel si le navigateur ne peut charger un Worker.
- `lib/tmb/sections.ts` : sélection des tronçons par identifiants de bornes (départ et arrivée distincts même aux mêmes coordonnées) et agrégation des statistiques mémorisées. La sélection dans le panneau est locale à l’affichage ; elle ne change ni le parcours ni le GPX. Une borne supprimée ou réordonnée hors de l’intervalle réaffiche le bilan global avec un message.
- `app/api/route` et `app/api/elevation` : proxy ORS avec validation, limite du corps à 160 ko, contrôle d’origine et gestion des erreurs. Pas de clé dans le client.

Les géométries complètes servent toujours à l’export. Le Worker ne simplifie que les lignes affichées. Chaque tronçon conserve ses bornes, sa provenance et ses coordonnées ; déplacer un point transforme les tronçons adjacents en segments personnalisés. Un point inséré sur un tronçon conserve sa géométrie. Une variante dont les raccordements ont été déplacés doit être rétablie avant de pouvoir être remplacée automatiquement.

Les calculs en ligne sont limités à 45,2–46,5° N et 6,1–7,8° E. Protection locale : 30 requêtes de routage ou 15 d’altimétrie par IP et par minute. Ce compteur en mémoire est propre à chaque instance et n’est pas une limite globale distribuée. ORS impose aussi son quota de compte. En cas de fréquentation importante, ajouter une limite distribuée à l’hébergement et surveiller le quota ORS. Aucun abonnement payant n’est configuré.

## Publication

Utiliser le plugin Sites avec l’identifiant existant dans `.openai/hosting.json`. Le pipeline Sites construit via `build-site.mjs`, pousse la source exacte, prépare une archive, sauvegarde la version puis la déploie en public. Conserver `sites()` dans `vite.config.ts`. Une modification des secrets doit être suivie d’un déploiement. Ne pas créer un nouveau Site pour une mise à jour.

L’accès public est configuré. Les visiteurs n’ont pas de compte applicatif à créer. Il n’y a ni téléchargement de cartes hors connexion ni synchronisation des parcours entre appareils.

## Crédits et vie privée

Données © contributeurs [OpenStreetMap](https://www.openstreetmap.org/copyright), [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/). Une base de données dérivée distribuée doit respecter les obligations d’attribution et de partage à l’identique. Conserver les sources et leurs empreintes avec la distribution. Fonds OpenTopoMap : © OSM, SRTM, OpenTopoMap (CC-BY-SA). Le fond OSM utilise le cache normal du navigateur et ne fait aucune prélecture massive ; respecter sa [politique de tuiles](https://operations.osmfoundation.org/policies/tiles/).

Routage et modèle de terrain : [OpenRouteService](https://openrouteservice.org). Les coordonnées nécessaires aux calculs lui sont transmises ; les fournisseurs de cartes reçoivent les demandes de tuiles. Les fichiers GPX et sauvegardes restent dans le navigateur. La géolocalisation est demandée uniquement après action de l’utilisateur.

L’avertissement météo/neige/fermetures reste visible dans le panneau. `TrailConditionsProvider` est une interface réservée à une future source officielle : aucune condition de sentier en temps réel n’est actuellement fournie.
