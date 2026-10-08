import { createBRouterProvider } from './brouter';
import { createGraphHopperProvider } from './graphhopper';
import { createOpenRouteServiceProvider } from './openrouteservice';
import type { RoutingProvider, RoutingProviderId, RoutingSettings } from './types';

export const ROUTING_PROVIDERS: { id: RoutingProviderId; label: string; needsKey: boolean; help: string }[] = [
  {
    id: 'brouter',
    label: 'BRouter — gratuit, sans clé (recommandé)',
    needsKey: false,
    help: 'Profil randonnée montagne : suit les sentiers OSM jusqu’à la cotation SAC T3, altitude incluse.',
  },
  { id: 'graphhopper', label: 'GraphHopper — clé personnelle', needsKey: true, help: 'Profil « hike ». Clé gratuite sur graphhopper.com.' },
  {
    id: 'openrouteservice',
    label: 'openrouteservice — clé personnelle',
    needsKey: true,
    help: 'Profil « foot-hiking ». Clé gratuite sur openrouteservice.org.',
  },
];

export function createRoutingProvider(settings: RoutingSettings): RoutingProvider {
  switch (settings.providerId) {
    case 'graphhopper':
      return createGraphHopperProvider(settings.graphhopperKey);
    case 'openrouteservice':
      return createOpenRouteServiceProvider(settings.orsKey);
    case 'brouter':
    default:
      return createBRouterProvider(settings.brouterUrl, settings.brouterProfile);
  }
}
