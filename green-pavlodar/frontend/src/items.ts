import { ItemKind, ToolModel, ZoneData } from './types';

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
