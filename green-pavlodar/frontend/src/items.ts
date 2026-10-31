import { ItemKind, PlacedItem, ToolModel, ZoneData } from './types';
import { CATEGORY_META } from './zones';
import type { StoredState } from './api';

const KIND_BY_TYPE: Record<string, ItemKind> = {
  bench: 'bench',
  bin: 'bin',
  shrub: 'shrub',
  monument: 'other',
  fountain: 'other',
  playground: 'other',
  light: 'other',
};

/** Вид объекта по типу — для данных, сохранённых до появления поля kind. */
export const kindFromType = (type: string): ItemKind => KIND_BY_TYPE[type] || 'tree';

/** Запасная модель, когда сервер недоступен: без ИИ и без догадок по ключевым словам. */
export const offlineModel = (name: string): Omit<ToolModel, 'id' | 'name'> => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return { icon: '🌳', color: `hsl(${Math.abs(hash) % 360}, 70%, 35%)`, type: 'custom', kind: 'tree' };
};

export const DEFAULT_PALETTE: ToolModel[] = [
  { id: 't1', name: 'Вяз (Карагач)', icon: '🌳', color: '#15803d', type: 'tree', kind: 'tree' },
  { id: 't2', name: 'Сосна обыкновенная', icon: '🌲', color: '#047857', type: 'pine', kind: 'tree' },
  { id: 't3', name: 'Береза повислая', icon: '🌿', color: '#65a30d', type: 'birch', kind: 'tree' },
  { id: 'f1', name: 'Скамейка парковая', icon: '🪑', color: '#b45309', type: 'bench', kind: 'bench' },
  { id: 'f2', name: 'Урна уличная', icon: '🗑️', color: '#475569', type: 'bin', kind: 'bin' },
];

export function loadJSON<T>(keys: string[], fallback: T): T {
  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw) as T;
    } catch {
      /* повреждённые данные — пробуем следующий ключ или значение по умолчанию */
    }
  }
  return fallback;
}

export function saveJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* переполнено хранилище или режим приватности — не роняем приложение */
  }
}

/** Достопримечательности раньше хранились одной строкой — приводим к списку. */
export function normalizeZones(zones: ZoneData[]): ZoneData[] {
  return zones.map((z) => {
    const a: unknown = z.details?.attractions;
    const list = Array.isArray(a)
      ? a.map((x) => String(x).trim()).filter(Boolean)
      : typeof a === 'string' ? a.split(',').map((x) => x.trim()).filter(Boolean) : [];
    return { ...z, details: { ...z.details, attractions: list } };
  });
}

const KINDS: ItemKind[] = ['tree', 'shrub', 'bench', 'bin', 'other'];
const str = (v: unknown, fallback: string, max: number) =>
  (typeof v === 'string' && v.trim() ? v : fallback).slice(0, max);
const count = (v: unknown) => Math.max(0, Math.round(Number(v) || 0));

/**
 * Приводит данные к виду, который принимает сервер: добавляет недостающие поля
 * (в старых версиях у объектов могло не быть цвета, значка или вида) и отбрасывает заведомо битые записи.
 */
export function sanitizeState(st: StoredState): StoredState {
  const zones: ZoneData[] = (st.zones || [])
    .filter((z) => z && typeof z.id === 'string' && z.category in CATEGORY_META
      && Array.isArray(z.coordinates) && z.coordinates.length >= 4
      && z.coordinates.every((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1])))
    .map((z) => ({
      ...z,
      id: str(z.id, 'zone', 64),
      name: str(z.name, 'Без названия', 200),
      color: str(z.color, CATEGORY_META[z.category].color, 40),
      details: {
        ...(z.details || {}),
        trees: count(z.details?.trees),
        benches: count(z.details?.benches),
        bins: count(z.details?.bins),
      },
    }));

  const items: PlacedItem[] = (st.placed_items || [])
    .filter((it) => it && Number.isFinite(it.lat) && Number.isFinite(it.lng))
    .map((it, n) => {
      const type = str(it.type, 'custom', 40);
      return {
        id: str(it.id, `item_restored_${n}`, 100),
        type,
        kind: KINDS.includes(it.kind) ? it.kind : kindFromType(type),
        name: str(it.name, type, 100),
        icon: str(it.icon, '📍', 16),
        color: str(it.color, '#16a34a', 40),
        lat: it.lat,
        lng: it.lng,
      };
    });

  const palette: ToolModel[] = (st.palette || []).filter(Boolean).map((t, n) => {
    const type = str(t.type, 'custom', 40);
    return {
      id: str(t.id, `tool_restored_${n}`, 100),
      name: str(t.name, type, 100),
      icon: str(t.icon, '📍', 16),
      color: str(t.color, '#16a34a', 40),
      type,
      kind: KINDS.includes(t.kind) ? t.kind : kindFromType(type),
    };
  });

  return { zones, placed_items: items, palette };
}
