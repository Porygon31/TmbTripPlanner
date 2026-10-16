# Données GPX du catalogue

Ce dossier contient **les traces réelles** utilisées par l'application : le tracé de référence du Tour du Mont-Blanc et ses variantes. Le TMB et ses sept variantes sont inclus, prêts à être utilisés sans télécharger de données pendant le build.

À chaque `npm run dev` ou `npm run build`, le script `scripts/build-catalog.ts` lit ce dossier et produit `public/data/` : le catalogue, les points et une copie des GPX. Ce dossier `public/data/` est généré et n'est pas versionné.

## Données livrées et provenance

- TMB, Tricot, Fours, Tête Bernarda, Arpette et Grands : exports Waymarked Trails du 8 octobre 2026, enrichis avec les altitudes du modèle de terrain OpenRouteService/SRTM.
- Le Tour (relation 9678501) et Vallorcine (9678726) : géométries récupérées le 16 octobre 2026 depuis l’API actuelle de Waymarked Trails, transformées de Web Mercator en WGS84 et enrichies par le même service d’altimétrie. La génération GPX de Waymarked Trails se fait désormais dans le navigateur ; ces deux fichiers ont été générés localement depuis ses géométries ordonnées.
- [provenance.json](provenance.json) conserve les versions OSM, dates, empreintes des fichiers d’origine et des GPX livrés, transformations et sources par portion. Les fichiers d’origine et métadonnées sont dans `sources/`.
- Le tracé principal est une boucle orientée dans le sens antihoraire depuis Les Houches. Ses trois parties jointives d’origine sont fusionnées sans ajouter de géométrie. Les raccords pédestres déjà calculés avec OpenRouteService (Tricot, Arpette et Le Tour) forment des traces nommées distinctes dans leurs GPX ; leurs jonctions sont communes, sans trou.
- Les cotations SAC proviennent des chemins OSM et sont marquées « partiel » quand elles ne couvrent pas tous les chemins. Les descriptions du Tour et de Vallorcine restent non renseignées.
- Les altitudes sont des valeurs de modèle de terrain, pas des mesures sur le sentier. Les longs intervalles entre points sont signalés sans être assimilés à une rupture GPX. Aucune certification institutionnelle n’est revendiquée.

## Où déposer les fichiers

```
data/
├── catalog.config.json            métadonnées (nom, description, source, licence…)
└── gpx/
    ├── tmb-principal.gpx          tracé de référence (obligatoire)
    └── variantes/
        ├── col-de-tricot.gpx
        ├── col-des-fours.gpx
        ├── tete-bernarda.gpx
        ├── fenetre-d-arpette.gpx
        ├── les-grands.gpx
        ├── le-tour.gpx
        └── vallorcine.gpx
```

Les noms ci-dessus correspondent aux entrées déjà préparées dans `catalog.config.json`. Un GPX déposé dans `gpx/variantes/` sous un autre nom est aussi pris en compte : il apparaît alors avec le nom contenu dans le fichier, sans description. Un fichier déclaré mais absent est simplement ignoré, avec un avertissement dans la console.

## Source recommandée : OpenStreetMap (licence ODbL)

Le TMB et ses variantes sont cartographiés dans OpenStreetMap sous la super-relation [124456 « Tour du Mont Blanc »](https://www.openstreetmap.org/relation/124456). Elle contient l'itinéraire principal ([9678362](https://www.openstreetmap.org/relation/9678362)) et 7 variantes : Col de Tricot, Col des Fours, Tête Bernarda, Fenêtre d'Arpette, Les Grands ([9678437](https://www.openstreetmap.org/relation/9678437)), Le Tour et Vallorcine ([9678726](https://www.openstreetmap.org/relation/9678726)).

Pour télécharger le GPX d'une relation, deux possibilités :

- **À la main** : ouvrir `https://hiking.waymarkedtrails.org/#route?id=<numéro de relation>`, puis cliquer sur « GPX ».
- **Avec le script** (sur ta machine, il faut un accès Internet) :
  ```bash
  npm run fetch:osm
  ```
  Le script `scripts/fetch-osm-tmb.ts` récupère les membres de la relation 124456 via l'API Overpass, enchaîne la géométrie des chemins de chaque relation, ajoute l'altitude (Open-Meteo, MNT Copernicus 90 m) et renseigne la `source` de chaque entrée dans `catalog.config.json`.

> Les GPX issus d'OpenStreetMap ne contiennent pas d'altitude. Sans le script, l'application tente de la compléter en ligne au chargement. C'est plus lent, et ça ne fonctionne qu'avec une connexion.

**Licence** : les données OSM sont © les contributeurs OpenStreetMap, sous licence [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/). L'application affiche l'attribution, et l'export GPX la reprend.

## Champs de `catalog.config.json`

| Champ | Rôle |
| --- | --- |
| `file` | Chemin du GPX, relatif à `data/` (obligatoire). |
| `id` | Identifiant stable (par défaut : nom du fichier). |
| `name` | Nom affiché (par défaut : `<name>` du GPX). |
| `description` | Courte description. `null` s'affiche « non renseignée ». |
| `source` | Origine du **fichier GPX** : `{ "label", "url", "license", "licenseUrl", "retrieved" }`. À maintenir avec la vraie source de ton fichier. |
| `references` | Pages consultées pour la description (liens « En savoir plus »). |
| `difficulty` | Cotation issue d'une source (ex. `"T3"`, `"Difficile"`). Si `null`, la difficulté est **estimée automatiquement** à partir de l'altitude max, de la pente max sur 200 m et du D+, et elle est affichée comme telle. |
| `departureName`, `rejoinName` | Noms des points de départ et de jonction avec le TMB. Les positions, elles, sont toujours calculées à partir des traces. |
| `color` | Couleur imposée (sinon, prise dans la palette). |
| `main.direction` | `counterclockwise` (sens habituel, par défaut), `clockwise` ou `as-is`. Le tracé est retourné si besoin. |
| `main.startNear` | `{ "name", "lat", "lon" }` : fait commencer une boucle au point le plus proche (ex. Les Houches). |

Exemple de `source` pour une relation OSM :

```json
"source": {
  "label": "OpenStreetMap — relation 9678362 (via waymarkedtrails.org)",
  "url": "https://www.openstreetmap.org/relation/9678362",
  "license": "ODbL 1.0",
  "licenseUrl": "https://opendatacommons.org/licenses/odbl/1-0/",
  "retrieved": "2026-10-08"
}
```

## Ce que fait le script de catalogue

- Il oriente le tracé principal dans le sens demandé et oriente chaque variante dans le même sens.
- Il calcule, pour chaque variante, le point de départ et le point de jonction sur le TMB (en km), l'écart de distance et de D+ par rapport au tronçon classique, et indique si la variante peut être greffée automatiquement (extrémités à moins de 300 m du tracé).
- Il signale les intervalles entre points de plus de 100 m et les altitudes manquantes. Un long intervalle n’est pas à lui seul la preuve d’un trou.
- Il **n'invente rien** : un champ absent reste vide.

Pour toute mise à jour, actualiser les sources, versions et empreintes dans `provenance.json`, puis exécuter `npm test` et `npm run build`. Le test du catalogue contrôle les empreintes, la fermeture du tour, les raccordements et l’export/réimport.
