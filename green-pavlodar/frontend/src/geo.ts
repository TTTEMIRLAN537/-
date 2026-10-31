import { LngLat, PlacedItem, ZoneData } from './types';

/** Алгоритм луча. Точки точно на границе могут попасть в любую сторону. */
export function pointInPolygon(lng: number, lat: number, ring: LngLat[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export interface PlacedCounts {
  trees: number;
  shrubs: number;
  benches: number;
  bins: number;
}

/** Сколько расставленных объектов лежит внутри контура именно этой зоны. */
export function countPlacedInZone(zone: ZoneData, items: PlacedItem[]): PlacedCounts {
  const c: PlacedCounts = { trees: 0, shrubs: 0, benches: 0, bins: 0 };
  for (const it of items) {
    if (!pointInPolygon(it.lng, it.lat, zone.coordinates)) continue;
    if (it.kind === 'tree') c.trees++;
    else if (it.kind === 'shrub') c.shrubs++;
    else if (it.kind === 'bench') c.benches++;
    else if (it.kind === 'bin') c.bins++;
  }
  return c;
}
