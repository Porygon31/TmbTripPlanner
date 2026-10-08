/**
 * Conditions et fermetures de sentiers.
 *
 * Aucune source officielle ne publie aujourd'hui de flux ouvert et structuré pour le TMB :
 * l'application affiche donc uniquement des liens vers les sources officielles (vérifiés),
 * sans jamais présenter un sentier comme ouvert ou praticable.
 * Pour brancher un flux plus tard, implémenter `TrailConditionsProvider.getAlerts`.
 */

export interface TrailAlert {
  id: string;
  title: string;
  /** `closed` : fermé ; `warning` : prudence (neige, travaux…) ; `info`. */
  severity: 'closed' | 'warning' | 'info';
  description: string;
  source: { label: string; url: string };
  /** Date de publication par la source (ISO). */
  publishedAt: string;
  /** Zone concernée [ouest, sud, est, nord], si connue. */
  bbox?: [number, number, number, number];
}

export interface OfficialLink {
  label: string;
  url: string;
  description: string;
}

export interface TrailConditionsProvider {
  links: OfficialLink[];
  getAlerts(signal?: AbortSignal): Promise<TrailAlert[]>;
}

export const OFFICIAL_LINKS: OfficialLink[] = [
  {
    label: 'Autour du Mont-Blanc — état des sentiers du TMB',
    url: 'https://www.autourdumontblanc.com/en/information/trails-conditions',
    description: 'Bulletins de conditions publiés pendant la saison par le site du TMB.',
  },
  {
    label: 'La Chamoniarde — Office de Haute Montagne',
    url: 'https://www.chamoniarde.com',
    description: 'Conditions en montagne et informations de sécurité (Chamonix).',
  },
  {
    label: 'Office de Haute Montagne de Chamonix',
    url: 'https://en.chamonix.com/infos-et-services/offices-de-tourisme/office-de-haute-montagne',
    description: 'Renseignements sur place ou par téléphone pendant la saison.',
  },
  {
    label: 'Météo-France — montagne',
    url: 'https://meteofrance.com/meteo-montagne',
    description: 'Prévisions montagne (versant français).',
  },
  {
    label: 'MeteoSuisse',
    url: 'https://www.meteosuisse.admin.ch',
    description: 'Prévisions officielles suisses (Val Ferret suisse, Champex, Trient).',
  },
];

export const officialLinksProvider: TrailConditionsProvider = {
  links: OFFICIAL_LINKS,
  async getAlerts() {
    return [];
  },
};

export const EMERGENCY_NUMBER = '112';
