import type { LatLon } from '../../core/types';
import type { RoutedLeg, RoutingProvider } from './types';

const CACHE_SIZE = 400;

/** Clé de cache : fournisseur + coordonnées arrondies à ~1 m. */
export function legKey(providerKey: string, from: LatLon, to: LatLon): string {
  const r = (v: number) => v.toFixed(5);
  return `${providerKey}|${r(from.lat)},${r(from.lon)}|${r(to.lat)},${r(to.lon)}`;
}

interface Job {
  key: string;
  from: LatLon;
  to: LatLon;
  provider: RoutingProvider;
  signal: AbortSignal;
  resolve: (leg: RoutedLeg) => void;
  reject: (e: unknown) => void;
}

/**
 * File de calcul : limite le nombre de requêtes simultanées (respect des services publics),
 * mutualise les requêtes identiques et garde un cache LRU des tronçons déjà calculés
 * (annuler/rétablir ou revenir à une position précédente ne relance pas de calcul).
 */
export class RoutingQueue {
  private cache = new Map<string, RoutedLeg>();
  private inflight = new Map<string, Promise<RoutedLeg>>();
  private waiting: Job[] = [];
  private running = 0;
  /** Nombre de requêtes réellement envoyées (utile pour les tests). */
  requestCount = 0;

  constructor(private concurrency = 2) {}

  cached(key: string): RoutedLeg | undefined {
    const hit = this.cache.get(key);
    if (hit) {
      this.cache.delete(key);
      this.cache.set(key, hit);
    }
    return hit;
  }

  request(provider: RoutingProvider, providerKey: string, from: LatLon, to: LatLon, signal: AbortSignal): Promise<RoutedLeg> {
    const key = legKey(providerKey, from, to);
    const hit = this.cached(key);
    if (hit) return Promise.resolve(hit);
    const pending = this.inflight.get(key);
    if (pending) return pending;
    const promise = new Promise<RoutedLeg>((resolve, reject) => {
      this.waiting.push({ key, from, to, provider, signal, resolve, reject });
      this.pump();
    }).finally(() => this.inflight.delete(key));
    this.inflight.set(key, promise);
    return promise;
  }

  private pump() {
    while (this.running < this.concurrency && this.waiting.length > 0) {
      const job = this.waiting.shift()!;
      if (job.signal.aborted) {
        job.reject(new DOMException('Annulé', 'AbortError'));
        continue;
      }
      this.running++;
      this.requestCount++;
      job.provider
        .route(job.from, job.to, job.signal)
        .then((leg) => {
          this.cache.set(job.key, leg);
          if (this.cache.size > CACHE_SIZE) this.cache.delete(this.cache.keys().next().value!);
          job.resolve(leg);
        }, job.reject)
        .finally(() => {
          this.running--;
          this.pump();
        });
    }
  }
}
