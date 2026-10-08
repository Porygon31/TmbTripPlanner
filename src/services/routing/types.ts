import type { LatLon, RoutePoint } from '../../core/types';

/**
 * Contrat commun des moteurs de routage. Pour ajouter un fournisseur, il suffit
 * d'implémenter cette interface et de l'enregistrer dans `registry.ts`.
 */
export interface RoutingProvider {
  id: string;
  label: string;
  /** Mention à afficher quand ce fournisseur a calculé une partie de l'itinéraire. */
  attribution: string;
  providesElevation: boolean;
  /** Calcule un trajet pédestre entre deux points en suivant les chemins existants. */
  route(from: LatLon, to: LatLon, signal?: AbortSignal): Promise<RoutedLeg>;
}

export interface RoutedLeg {
  points: RoutePoint[];
  provider: string;
}

export type RoutingErrorKind = 'no-path' | 'network' | 'quota' | 'config' | 'server';

export class RoutingError extends Error {
  constructor(
    message: string,
    public kind: RoutingErrorKind,
  ) {
    super(message);
  }
}

export type RoutingProviderId = 'brouter' | 'graphhopper' | 'openrouteservice';

export interface RoutingSettings {
  providerId: RoutingProviderId;
  brouterUrl: string;
  brouterProfile: string;
  graphhopperKey: string;
  orsKey: string;
}

export const DEFAULT_ROUTING_SETTINGS: RoutingSettings = {
  providerId: 'brouter',
  brouterUrl: 'https://brouter.de/brouter',
  brouterProfile: 'hiking-mountain',
  graphhopperKey: '',
  orsKey: '',
};

export async function fetchOrNetworkError(input: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new RoutingError('Service de calcul injoignable (connexion ?).', 'network');
  }
}
