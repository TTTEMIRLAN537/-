export type LngLat = [number, number];
export type ZoneCategory = 'park' | 'forest' | 'problem' | 'zone';
export type ItemKind = 'tree' | 'shrub' | 'bench' | 'bin' | 'other';

export interface PlacedItem {
  id: string;
  type: string;
  kind: ItemKind;
  name: string;
  lat: number;
  lng: number;
  icon: string;
  color: string;
}

/** Модель объекта в палитре (то, что можно расставлять по карте). */
export interface ToolModel {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: string;
  kind: ItemKind;
}

export interface ZoneDetails {
  trees: number;
  benches: number;
  bins: number;
  ph?: string;
  soilType?: string;
  salinity?: number;
  isIndustrial?: boolean;
  nearSensitive?: boolean;
  attractions?: string[];
  area?: string;
  desc?: string;
}

export interface ZoneData {
  id: string;
  name: string;
  category: ZoneCategory;
  coordinates: LngLat[];
  color: string;
  details: ZoneDetails;
}
