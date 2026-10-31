import { ItemKind, PlacedItem, ToolModel, ZoneData } from './types';

// Пустая строка — тот же адрес, с которого открыт сайт (так работает единый продакшен-образ).
const BASE = (process.env.REACT_APP_API_URL ?? 'http://localhost:8000').replace(/\/$/, '');

export interface Estimate {
  summary_kzt: number;
  breakdown: {
    planting_materials_kzt: number;
    soil_preparation_kzt: number;
    planting_works_kzt: number;
    care_maintenance_kzt: number;
    risk_reserve_kzt: number;
  };
  ecological_effect_5yr: { co2_absorption_tons: number; dust_reduction_kg: number };
}

export interface GreenNeighbor {
  zone_id: string;
  name: string;
  category: string;
  distance_m: number;
}

export interface ZoneAnalysis {
  is_problem: boolean | null;
  green_neighbor: GreenNeighbor | null;
  green_radius_m: number;
  zone_id: string;
  name: string;
  category: string;
  area_sqm: number;
  area_ha: number;
  trees_registered: number;
  trees_placed: number;
  shrubs_placed: number;
  trees_total: number;
  density_per_ha: number;
  target_density_per_ha: number | null;
  deficit_trees: number | null;
  deficit_ratio: number | null;
  recommendations: { plant_id: number; name_ru: string; score: number; reasoning: string }[];
  planting_plan: { plant_id: number; name_ru: string; count: number }[];
  estimate: Estimate | null;
  assumptions: string[];
}

export interface ScanResponse {
  analyzed: number;
  results: ZoneAnalysis[];
  errors: { zone_id: string; error: string }[];
}

export interface SpeciesResponse {
  kind: ItemKind;
  type: string;
  icon: string;
  color: string;
  hardiness: 'good' | 'limited' | 'poor' | 'unknown';
  note: string;
  source: 'llm' | 'rules';
  model?: string;
  fallback_reason?: 'no_key' | 'llm_error';
  fallback_detail?: string;
}

export interface ZoneReportResponse {
  analysis: ZoneAnalysis;
  text: string;
  source: 'llm' | 'template';
  model?: string;
  fallback_reason?: 'no_key' | 'llm_error';
  fallback_detail?: string;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.status = status;
  }
}

export interface StoredState {
  zones: ZoneData[];
  placed_items: PlacedItem[];
  palette: ToolModel[];
}

export interface Health {
  status: string;
  ai_available: boolean;
  storage: 'postgres' | 'file';
  storage_persistent: boolean;
  editing_enabled: boolean;
}

async function request<T>(
  path: string,
  body?: unknown,
  timeoutMs = 15000,
  opts: { method?: string; headers?: Record<string, string> } = {},
): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(BASE + path, {
      method: opts.method || (body === undefined ? 'GET' : 'POST'),
      headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(opts.headers || {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      let msg = `Ошибка сервера (${res.status})`;
      try {
        const data = await res.json();
        if (typeof data.detail === 'string') msg = data.detail;
        else if (Array.isArray(data.detail) && data.detail.length) msg = 'Некорректные данные: ' + data.detail[0].msg;
      } catch {
        /* тело не JSON */
      }
      throw new ApiError(msg, res.status);
    }
    return (await res.json()) as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError('Сервер расчётов недоступен. Проверьте, что backend запущен.');
  } finally {
    clearTimeout(timer);
  }
}

const zonePayload = (z: ZoneData) => ({
  id: z.id,
  name: z.name,
  category: z.category,
  coordinates: z.coordinates,
  details: z.details,
});
const itemsPayload = (items: PlacedItem[]) => items.map(({ id, type, kind, lat, lng }) => ({ id, type, kind, lat, lng }));

export const scanZones = (zones: ZoneData[], items: PlacedItem[]) =>
  request<ScanResponse>('/api/v1/scan', { zones: zones.map(zonePayload), placed_items: itemsPayload(items) });

// ИИ-запросы могут занимать до ~25 с на стороне сервера
export const generateSpecies = (name: string) =>
  request<SpeciesResponse>('/api/v1/ai/species', { name }, 40000);

export const zoneReport = (zone: ZoneData, items: PlacedItem[], allZones: ZoneData[]) =>
  request<ZoneReportResponse>('/api/v1/ai/zone-report', {
    zone: zonePayload(zone),
    other_zones: allZones.filter((z) => z.id !== zone.id).map(zonePayload),
    placed_items: itemsPayload(items),
  }, 40000);

// --- Общее хранилище сайта ---
export const getHealth = () => request<Health>('/api/v1/health');
export const getState = () => request<{ rev: number; data: StoredState | null }>('/api/v1/state', undefined, 30000);
export const putState = (baseRev: number, data: StoredState) =>
  request<{ rev: number }>('/api/v1/state', { base_rev: baseRev, data }, 30000, { method: 'PUT' });
