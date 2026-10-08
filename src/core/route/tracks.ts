import { cumulativeDistances } from '../geo/distance';
import type { Track } from '../types';

/** Trace accompagnée de ses distances cumulées (calculées une seule fois). */
export interface IndexedTrack extends Track {
  cum: Float64Array;
  length: number;
}

export function indexTrack(track: Track): IndexedTrack {
  const cum = cumulativeDistances(track.points);
  return { ...track, cum, length: cum.length > 0 ? cum[cum.length - 1] : 0 };
}

export type TrackLookup = (id: string) => IndexedTrack | undefined;
