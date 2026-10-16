/**
 * Fonds de carte et surcouches. Pour changer de fournisseur, il suffit de modifier cette liste
 * (aucun autre fichier ne dépend des URL de tuiles). Tous sont utilisables sans clé d'API,
 * dans le respect de leurs conditions d'utilisation (usage modéré, attribution affichée).
 */
export interface TileSource {
  id: string;
  label: string;
  url: string;
  attribution: string;
  maxNativeZoom: number;
  subdomains?: string;
  opacity?: number;
  /** Zone couverte, à titre indicatif. */
  coverage?: string;
}

export const BASEMAPS: TileSource[] = [
  {
    id: 'topo',
    label: 'Topographique',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    subdomains: 'abc',
    maxNativeZoom: 17,
    attribution:
      'Carte : © <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA), données © <a href="https://www.openstreetmap.org/copyright">contributeurs OpenStreetMap</a>, SRTM',
  },
  {
    id: 'osm',
    label: 'Classique',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    maxNativeZoom: 19,
    attribution: '© <a href="https://www.openstreetmap.org/copyright">contributeurs OpenStreetMap</a>',
  },
  {
    id: 'terrain',
    label: 'Relief / terrain',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    maxNativeZoom: 19,
    attribution: 'Tuiles © Esri — Esri, HERE, Garmin, USGS, NGA, EPA, USDA, NPS et la communauté des utilisateurs SIG',
  },
  {
    id: 'satellite',
    label: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    maxNativeZoom: 19,
    attribution: 'Imagerie © Esri — Esri, Maxar, Earthstar Geographics et la communauté des utilisateurs SIG',
  },
  {
    id: 'ign',
    label: 'Plan IGN (France)',
    url: 'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/png&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
    maxNativeZoom: 19,
    attribution: '© <a href="https://www.ign.fr">IGN</a> — Géoplateforme',
    coverage: 'France',
  },
  {
    id: 'swisstopo',
    label: 'Swisstopo (Suisse)',
    url: 'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg',
    maxNativeZoom: 18,
    attribution: '© <a href="https://www.swisstopo.admin.ch">swisstopo</a>',
    coverage: 'Suisse et abords',
  },
];

export const OVERLAYS: TileSource[] = [
  {
    id: 'trails',
    label: 'Sentiers balisés',
    url: 'https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png',
    maxNativeZoom: 18,
    attribution: 'Sentiers : © <a href="https://hiking.waymarkedtrails.org">Waymarked Trails</a> (CC-BY-SA)',
  },
  {
    id: 'hillshade',
    label: 'Ombrage du relief',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}',
    maxNativeZoom: 16,
    opacity: 0.35,
    attribution: 'Ombrage © Esri',
  },
];

export const DEFAULT_BASEMAP = 'osm';

/** Centre du massif du Mont-Blanc et zoom initial. */
export const MASSIF_CENTER: [number, number] = [45.85, 6.95];
export const MASSIF_ZOOM = 10;
