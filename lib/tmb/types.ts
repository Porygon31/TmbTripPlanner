export type RoutePoint = { lat: number; lon: number; ele?: number };
export type Provenance = {
  kind: "osm" | "routing" | "import";
  label: string;
  url?: string;
  relationId?: number;
  version?: number;
  extractedAt?: string;
  license?: string;
  sha256?: string;
  elevation?: string;
};
export type Waypoint = RoutePoint & {
  id: string;
  name: string;
  stageEnd?: boolean;
};
export type RouteSegment = {
  id: string;
  points: RoutePoint[];
  source: Provenance;
  from: string;
  to: string;
  breakBefore?: boolean;
  variantId?: string;
  bounds?: [number, number];
};
export type Route = {
  id: string;
  name: string;
  mode: "tmb" | "free" | "import";
  waypoints: Waypoint[];
  segments: RouteSegment[];
  variantIds: string[];
  updatedAt: string;
};
export type ElevationPoint = RoutePoint & {
  distance: number;
  segmentId: string;
  pointIndex: number;
  breakBefore?: boolean;
};
export type RouteStatistics = {
  distance: number;
  ascent: number;
  descent: number;
  minElevation: number | null;
  maxElevation: number | null;
  pointCount: number;
  elevationCoverage: number;
  hours: number;
  gaps: number;
};
export type TmbVariant = {
  id: string;
  name: string;
  description: string;
  color: string;
  points: RoutePoint[];
  pieces?: { points: RoutePoint[]; source: Provenance }[];
  source: Provenance;
  difficulty: string;
  difficultyCoverage?: number;
  anchors: [number, number];
  reversed?: boolean;
  gaps?: number;
  delta: number;
  statistics: RouteStatistics;
};
export type Catalog = {
  main: {
    points: RoutePoint[];
    segments: RoutePoint[][];
    source: Provenance;
    difficulty: string;
  };
  variants: TmbVariant[];
  extractedAt: string;
  audit: unknown;
};
export interface MapProvider {
  id: string;
  label: string;
  url: string;
  attribution: string;
  maxZoom: number;
}
export interface RoutingProvider {
  route(
    from: RoutePoint,
    to: RoutePoint,
    signal?: AbortSignal,
  ): Promise<RoutePoint[]>;
  elevation(points: RoutePoint[], signal?: AbortSignal): Promise<RoutePoint[]>;
}
export interface TrailConditionsProvider {
  getConditions(
    bounds: [number, number, number, number],
  ): Promise<{ updatedAt: string; notices: string[] } | null>;
}
