import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { PavlodarMap } from './PavlodarMap';
import { ZoneDetail } from './components/ZoneDetail';
import { ZoneFormModal, ZoneFormValues } from './components/ZoneFormModal';
import { ApiError, Health, ScanResponse, SpeciesResponse, StoredState, ZoneAnalysis, ZoneReportResponse, generateSpecies, getHealth, getState, putState, scanZones, zoneReport } from './api';
import { countPlacedInZone } from './geo';
import { DEFAULT_PALETTE, kindFromType, loadJSON, normalizeZones, offlineModel, saveJSON } from './items';
import { CATEGORY_META, INITIAL_ZONES } from './zones';
import { LngLat, PlacedItem, ToolModel, ZoneCategory, ZoneData } from './types';

type View = { name: 'main' } | { name: 'scan' } | { name: 'list'; category: ZoneCategory } | { name: 'detail' };

// Хранилище: v3 — со структурой kind; v2 читаем и мигрируем.
const K_ZONES = 'green_pavlodar_zones_v3';
const K_ITEMS = 'green_pavlodar_placed_items_v3';
const K_PALETTE = 'green_pavlodar_palette_v3';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const snapshot = (s: StoredState) => JSON.stringify(s);
const withKind = <T extends { type: string; kind?: string }>(x: T) => ({ ...x, kind: (x.kind as any) || kindFromType(x.type) });

const HARDINESS_TEXT: Record<SpeciesResponse['hardiness'], string> = {
  good: 'Зимостойкость в Павлодаре: хорошая',
  limited: 'Зимостойкость в Павлодаре: ограниченная',
  poor: 'Зимостойкость в Павлодаре: низкая',
  unknown: '',
};

const App = () => {
  const [view, setView] = useState<View>({ name: 'main' });

  const [zones, setZones] = useState<ZoneData[]>([]);
  const [placedItems, setPlacedItems] = useState<PlacedItem[]>([]);
  const [palette, setPalette] = useState<ToolModel[]>(DEFAULT_PALETTE);

  // --- Загрузка общих данных с сервера, вход редактора и автосохранение ---
  const [boot, setBoot] = useState<'loading' | 'ready' | 'error'>('loading');
  const [bootNote, setBootNote] = useState('');
  const [bootTry, setBootTry] = useState(0);
  const [health, setHealth] = useState<Health | null>(null);
  const [serverEmpty, setServerEmpty] = useState(false);
  const canEdit = health?.editing_enabled === true; // редактирование открыто всем, пока на сервере не выключено EDITING_ENABLED=false
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error' | 'conflict'>('idle');
  const [saveError, setSaveError] = useState('');
  const revRef = useRef(0);
  const lastSavedRef = useRef('');
  const conflictRef = useRef(false);
  const saveChain = useRef<Promise<void>>(Promise.resolve());
  const latest = useRef({ zones, placedItems, palette, canEdit });
  latest.current = { zones, placedItems, palette, canEdit };

  useEffect(() => {
    let cancelled = false;
    setBoot('loading');
    (async () => {
      const attempts = 6;
      for (let i = 0; i < attempts; i++) {
        try {
          const res = await getState();
          if (cancelled) return;
          let st: StoredState;
          if (res.data) {
            st = {
              zones: normalizeZones(res.data.zones),
              placed_items: res.data.placed_items.map(withKind),
              palette: res.data.palette.map(withKind),
            };
            setServerEmpty(false);
          } else {
            // На сервере пока пусто: берём локальные данные браузера (если были) или демо-данные
            st = {
              zones: normalizeZones(loadJSON([K_ZONES, 'green_pavlodar_zones_v2'], INITIAL_ZONES)),
              placed_items: loadJSON<any[]>([K_ITEMS, 'green_pavlodar_placed_items_v2'], []).map(withKind),
              palette: loadJSON<any[]>([K_PALETTE, 'green_pavlodar_palette_v2'], DEFAULT_PALETTE).map(withKind),
            };
            setServerEmpty(true);
          }
          revRef.current = res.rev;
          lastSavedRef.current = snapshot(st); // сохранение только после реальной правки; пустой сервер — кнопкой «Сохранить сейчас»
          setZones(st.zones);
          setPlacedItems(st.placed_items);
          setPalette(st.palette);
          const h = await getHealth().catch(() => null);
          if (cancelled) return;
          setHealth(h);
          setBoot('ready');
          return;
        } catch (e) {
          if (cancelled) return;
          if (i === attempts - 1) {
            setBootNote(e instanceof ApiError ? e.message : 'Не удалось загрузить данные');
            setBoot('error');
            return;
          }
          setBootNote('Сервер просыпается, это может занять до минуты…');
          await sleep(5000);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [bootTry]);

  const saveInner = useCallback(async (force: boolean) => {
    const cur = latest.current;
    if (!cur.canEdit || conflictRef.current) return;
    const data: StoredState = { zones: cur.zones, placed_items: cur.placedItems, palette: cur.palette };
    const snap = snapshot(data);
    if (!force && snap === lastSavedRef.current) return;
    setSaveState('saving');
    try {
      const r = await putState(revRef.current, data);
      revRef.current = r.rev;
      lastSavedRef.current = snap;
      setServerEmpty(false);
      setSaveState('saved');
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) { conflictRef.current = true; setSaveState('conflict'); }
      else if (e instanceof ApiError && e.status === 403) { setHealth((h) => (h ? { ...h, editing_enabled: false } : h)); setSaveState('idle'); }
      else { setSaveState('error'); setSaveError(e instanceof ApiError ? e.message : 'Не удалось сохранить'); }
    }
  }, []);
  // Сохранения идут строго по очереди, иначе вторая правка может уйти со старой ревизией и получить ложный конфликт
  const save = useCallback((force = false) => {
    saveChain.current = saveChain.current.then(() => saveInner(force));
    return saveChain.current;
  }, [saveInner]);

  useEffect(() => {
    if (boot !== 'ready' || !canEdit) return;
    saveJSON(K_ZONES, zones); saveJSON(K_ITEMS, placedItems); saveJSON(K_PALETTE, palette); // запасная копия в браузере
    const t = setTimeout(() => { save(false); }, 800);
    return () => clearTimeout(t);
  }, [zones, placedItems, palette, boot, canEdit, save]);

  // Адаптивность: на телефоне карта сверху, панель под ней
  const [narrow, setNarrow] = useState(typeof window !== 'undefined' && window.innerWidth < 900);
  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < 900);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const selectedZone = zones.find((z) => z.id === selectedZoneId) || null;
  const [flyCoords, setFlyCoords] = useState<LngLat | null>(null);

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [newModelInput, setNewModelInput] = useState('');
  const [modelBusy, setModelBusy] = useState(false);
  const [modelNote, setModelNote] = useState('');
  const [selectedToolId, setSelectedToolId] = useState<string | null>(null);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null);
  const [newZoneCategory, setNewZoneCategory] = useState<ZoneCategory>('park');

  const [pendingCoords, setPendingCoords] = useState<LngLat[] | null>(null);
  const [editFormZone, setEditFormZone] = useState<ZoneData | null>(null);

  // --- Расчёты на сервере ---
  const [analyses, setAnalyses] = useState<Record<string, ZoneAnalysis>>({});
  const [scanState, setScanState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [scanError, setScanError] = useState('');
  const scanSeq = useRef(0);

  const runScan = useCallback(async () => {
    if (boot !== 'ready') return;
    const id = ++scanSeq.current;
    setScanState('loading');
    try {
      const res: ScanResponse = await scanZones(zones, placedItems);
      if (id !== scanSeq.current) return; // пришёл устаревший ответ
      setAnalyses(Object.fromEntries(res.results.map((r) => [r.zone_id, r])));
      setScanState('idle');
    } catch (e) {
      if (id !== scanSeq.current) return;
      setScanState('error');
      setScanError(e instanceof ApiError ? e.message : 'Не удалось выполнить расчёт');
    }
  }, [boot, zones, placedItems]);

  useEffect(() => {
    const t = setTimeout(runScan, 500);
    return () => clearTimeout(t);
  }, [runScan]);

  // --- Заключение по зоне (ИИ) ---
  const [report, setReport] = useState<ZoneReportResponse | null>(null);
  const [reportBusy, setReportBusy] = useState(false);
  const [reportError, setReportError] = useState('');
  useEffect(() => { setReport(null); setReportError(''); }, [selectedZoneId]);

  const makeReport = async () => {
    if (!selectedZone) return;
    setReportBusy(true);
    setReportError('');
    try {
      setReport(await zoneReport(selectedZone, placedItems, zones));
    } catch (e) {
      setReportError(e instanceof ApiError ? e.message : 'Не удалось получить заключение');
    } finally {
      setReportBusy(false);
    }
  };

  // --- Навигация ---
  const openZone = (z: ZoneData) => {
    setSelectedZoneId(z.id);
    setFlyCoords(z.coordinates[0]);
    setView({ name: 'detail' });
  };
  const goBack = () => {
    setEditingZoneId(null);
    if (view.name === 'detail' && selectedZone) setView({ name: 'list', category: selectedZone.category });
    else {
      setSelectedZoneId(null);
      setView({ name: 'main' });
    }
  };
  const activeCategory: 'all' | ZoneCategory =
    view.name === 'list' ? view.category : view.name === 'detail' && selectedZone ? selectedZone.category : 'all';

  // --- ИИ-генерация модели объекта ---
  const handleCreateModel = async () => {
    const name = newModelInput.trim();
    if (!name || modelBusy) return;
    setModelBusy(true);
    setModelNote('');
    let cfg: Omit<ToolModel, 'id' | 'name'>;
    let note = '';
    try {
      const r = await generateSpecies(name);
      cfg = { icon: r.icon, color: r.color, type: r.type, kind: r.kind };
      note = [
        r.source === 'llm' ? `Подобрано ИИ (${r.model}).` : r.fallback_reason === 'no_key'
          ? 'ИИ не подключён (на сервере не задан ключ API) — использованы простые правила.'
          : `Запрос к ИИ не удался${r.fallback_detail ? ` (${r.fallback_detail})` : ''} — использованы простые правила.`,
        HARDINESS_TEXT[r.hardiness],
        r.note,
      ].filter(Boolean).join(' ');
    } catch (e) {
      cfg = offlineModel(name);
      note = (e instanceof ApiError ? e.message : 'Ошибка запроса') + ' Использован значок по умолчанию.';
    }
    const model: ToolModel = { id: 'mod_' + Date.now() + '_' + Math.floor(Math.random() * 1000), name, ...cfg };
    setPalette((p) => [...p, model]);
    setSelectedToolId(model.id);
    setNewModelInput('');
    setModelNote(note);
    setModelBusy(false);
  };

  const activeToolData = palette.find((t) => t.id === selectedToolId) || null;

  const deleteTool = (tool: ToolModel) => {
    if (!window.confirm(`Удалить «${tool.name}» из редактора?\nУже расставленные на карте объекты останутся.`)) return;
    setPalette((p) => p.filter((t) => t.id !== tool.id));
    if (selectedToolId === tool.id) setSelectedToolId(null);
  };
  const restoreDefaultTools = () =>
    setPalette((p) => [...DEFAULT_PALETTE.filter((d) => !p.some((t) => t.id === d.id)), ...p]);

  const deleteZone = (z: ZoneData) => {
    if (!window.confirm(`Удалить зону «${z.name}»? Это действие нельзя отменить.`)) return;
    setEditingZoneId(null);
    setZones((prev) => prev.filter((x) => x.id !== z.id));
    setSelectedZoneId(null);
    setView({ name: 'list', category: z.category });
  };

  // Зоны «проблемная», рядом с которыми есть парк/лес, на карте показываем серым — они не считаются проблемными
  const notProblem = (z: ZoneData) => z.category === 'problem' && analyses[z.id]?.is_problem === false;
  const mapZones = zones.map((z) => (notProblem(z) ? { ...z, color: '#94a3b8' } : z));

  // --- Зоны: создание / редактирование ---
  const handlePolygonCreated = (coords: LngLat[]) => {
    setIsDrawingMode(false);
    setPendingCoords(coords);
  };

  const createZone = (v: ZoneFormValues) => {
    if (!pendingCoords) return;
    const { name, ...details } = v;
    const z: ZoneData = {
      id: 'z_custom_' + Date.now(), name, category: newZoneCategory,
      color: CATEGORY_META[newZoneCategory].color, coordinates: pendingCoords, details,
    };
    setZones((prev) => [...prev, z]);
    setPendingCoords(null);
    openZone(z);
  };

  const saveEditedZone = (v: ZoneFormValues) => {
    if (!editFormZone) return;
    const { name, ...details } = v;
    setZones((prev) => prev.map((z) => (z.id === editFormZone.id ? { ...z, name, details: { ...z.details, ...details } } : z)));
    setEditFormZone(null);
  };

  const handleZoneCoordinatesUpdated = useCallback((zoneId: string, coords: LngLat[]) => {
    setZones((prev) => prev.map((z) => (z.id === zoneId ? { ...z, coordinates: coords } : z)));
  }, []);
  const handleItemPlaced = useCallback((item: PlacedItem) => setPlacedItems((prev) => [...prev, item]), []);
  const handleItemDeleted = useCallback((id: string) => setPlacedItems((prev) => prev.filter((i) => i.id !== id)), []);

  // --- Разметка ---
  const menuBtn = (bg: string, border: string, color: string): React.CSSProperties => ({
    padding: '12px', backgroundColor: bg, borderRadius: '8px', border: `1px solid ${border}`,
    fontWeight: 'bold', cursor: 'pointer', textAlign: 'left', color,
  });
  const deficitText = (z: ZoneData) => {
    const a = analyses[z.id];
    return a && a.deficit_trees !== null ? (a.deficit_trees > 0 ? `Не хватает ~${a.deficit_trees} деревьев` : 'Целевая плотность достигнута') : '';
  };

  // --- Резервные копии и GPS ---
  const [gpsNote, setGpsNote] = useState('');
  const importRef = useRef<HTMLInputElement>(null);

  const exportData = () => {
    const payload = { app: 'green-pavlodar', version: 1, exportedAt: new Date().toISOString(), zones, placed_items: placedItems, palette };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    a.download = `green-pavlodar-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importData = async (file: File) => {
    try {
      const obj = JSON.parse(await file.text());
      if (!Array.isArray(obj.zones) || !Array.isArray(obj.placed_items)) throw new Error('В файле нет зон или объектов');
      if (!window.confirm(`Заменить текущие данные данными из файла?\nЗон: ${obj.zones.length}, объектов: ${obj.placed_items.length}.`)) return;
      setZones(normalizeZones(obj.zones));
      setPlacedItems(obj.placed_items.map(withKind));
      if (Array.isArray(obj.palette)) setPalette(obj.palette.map(withKind));
    } catch (e) {
      window.alert('Не удалось прочитать файл: ' + (e instanceof Error ? e.message : 'неверный формат'));
    }
  };

  const placeAtMyLocation = () => {
    const t = activeToolData;
    if (!t) return;
    if (!navigator.geolocation) { setGpsNote('Геолокация недоступна в этом браузере.'); return; }
    setGpsNote('Определяю местоположение…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        handleItemPlaced({
          id: 'item_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
          type: t.type, kind: t.kind, name: t.name, icon: t.icon, color: t.color,
          lat: pos.coords.latitude, lng: pos.coords.longitude,
        });
        const acc = Math.round(pos.coords.accuracy);
        setGpsNote(`Поставлено в вашей точке (точность ±${acc} м).${acc > 20 ? ' Точность низкая — лучше поставить вручную на карте.' : ''}`);
      },
      (err) => setGpsNote('Не удалось определить местоположение: ' + err.message),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  };

  if (boot !== 'ready') {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', fontFamily: 'Segoe UI, Arial, sans-serif', color: '#334155', textAlign: 'center', padding: '20px' }}>
        <div style={{ fontSize: '40px' }}>🌿</div>
        <div style={{ fontWeight: 'bold' }}>GreenPavlodar AI</div>
        {boot === 'loading' ? (
          <div style={{ fontSize: '14px' }}>⏳ Загружаю данные… {bootNote}</div>
        ) : (
          <>
            <div style={{ fontSize: '14px', color: '#b91c1c' }}>⚠️ {bootNote}</div>
            <button onClick={() => setBootTry((n) => n + 1)} style={{ padding: '8px 16px', cursor: 'pointer' }}>Повторить</button>
          </>
        )}
      </div>
    );
  }

  const chip = (bg: string, color: string): React.CSSProperties => ({ backgroundColor: bg, color, padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' });
  const saveChip = () => {
    if (!canEdit) return null;
    if (saveState === 'saving') return <span style={chip('#e0f2fe', '#075985')}>⏳ Сохраняю…</span>;
    if (saveState === 'conflict') return <span style={chip('#fee2e2', '#991b1b')}>⚠️ Данные изменены в другом окне — обновите страницу, чтобы не потерять чужие правки</span>;
    if (saveState === 'error') return (
      <span style={chip('#fee2e2', '#991b1b')}>⚠️ Не сохранено: {saveError}{' '}
        <button onClick={() => save(true)} style={{ cursor: 'pointer' }}>Повторить</button></span>
    );
    if (serverEmpty && saveState !== 'saved') return (
      <span style={chip('#fef3c7', '#92400e')}>💾 На сервере ещё нет данных{' '}
        <button onClick={() => save(true)} style={{ cursor: 'pointer' }}>Сохранить сейчас</button></span>
    );
    return <span style={chip('#dcfce7', '#166534')}>✅ Сохранено на сервере</span>;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: narrow ? 'auto' : '100vh', minHeight: '100vh', fontFamily: 'Segoe UI, Arial, sans-serif', backgroundColor: '#f8fafc' }}>
      <header style={{ minHeight: '56px', backgroundColor: '#ffffff', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', padding: '8px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '20px' }}>🌿</span>
          <h1 style={{ margin: 0, fontSize: '18px', color: '#0f172a', fontWeight: 'bold' }}>GreenPavlodar AI</h1>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {saveChip()}
          <button
            onClick={() => { setView({ name: 'scan' }); runScan(); }}
            style={{ backgroundColor: '#8b5cf6', color: '#ffffff', border: 'none', padding: '8px 14px', borderRadius: '6px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}
          >
            📊 Анализ дефицита
          </button>
          {canEdit && (
            <button
              onClick={() => { setIsEditorOpen(!isEditorOpen); setEditingZoneId(null); }}
              style={{ backgroundColor: isEditorOpen ? '#dc2626' : '#16a34a', color: '#ffffff', border: 'none', padding: '8px 14px', borderRadius: '6px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}
            >
              {isEditorOpen ? '❌ Закрыть редактор' : '✏️ Изменить данные'}
            </button>
          )}
        </div>
      </header>

      {canEdit && health && !health.storage_persistent && (
        <div style={{ backgroundColor: '#fffbeb', color: '#92400e', padding: '8px 16px', fontSize: '12px', borderBottom: '1px solid #fde68a' }}>
          ⚠️ Данные хранятся в файле на сервере. На бесплатных хостингах такой файл пропадает при перезапуске — подключите базу данных (переменная DATABASE_URL, см. DEPLOY.md). Пока делайте резервные копии («⬇ Резервная копия» в редакторе).
        </div>
      )}
      {health && !health.editing_enabled && (
        <div style={{ backgroundColor: '#f1f5f9', color: '#475569', padding: '6px 16px', fontSize: '12px' }}>
          Сайт открыт только для просмотра.
        </div>
      )}

      {scanState === 'error' && (
        <div style={{ backgroundColor: '#fef2f2', color: '#991b1b', padding: '8px 20px', fontSize: '13px', borderBottom: '1px solid #fecaca' }}>
          ⚠️ {scanError}{' '}
          <button onClick={runScan} style={{ marginLeft: '8px', cursor: 'pointer' }}>Повторить</button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: narrow ? 'column' : 'row', flex: 1, overflow: narrow ? 'visible' : 'hidden' }}>
        <div style={{ flex: narrow ? 'none' : 1, padding: narrow ? '8px' : '12px' }}>
          <PavlodarMap
            selectedTool={selectedToolId}
            activeItemData={activeToolData}
            placedItems={placedItems}
            onItemPlaced={handleItemPlaced}
            onItemDeleted={handleItemDeleted}
            isDrawingMode={isDrawingMode}
            onPolygonCreated={handlePolygonCreated}
            flyToCoords={flyCoords}
            allZones={mapZones}
            selectedZoneId={selectedZoneId}
            onZoneSelect={openZone}
            activeCategory={activeCategory}
            editingZoneId={editingZoneId}
            onZoneCoordinatesUpdated={handleZoneCoordinatesUpdated}
            height={narrow ? '62vh' : undefined}
          />
        </div>

        <div style={{ width: narrow ? '100%' : '370px', backgroundColor: '#ffffff', borderLeft: narrow ? 'none' : '1px solid #e2e8f0', borderTop: narrow ? '1px solid #e2e8f0' : 'none', display: 'flex', flexDirection: 'column', overflowY: narrow ? 'visible' : 'auto' }}>
          {isEditorOpen && canEdit && (
            <div style={{ padding: '14px', backgroundColor: '#f0fdf4', borderBottom: '2px solid #bbf7d0' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#166534' }}>🛠️ Редактор</h3>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                <button onClick={() => save(true)} style={{ fontSize: '11px', padding: '5px 8px', cursor: 'pointer' }}>💾 Сохранить на сервере</button>
                <button onClick={exportData} style={{ fontSize: '11px', padding: '5px 8px', cursor: 'pointer' }}>⬇ Резервная копия</button>
                <button onClick={() => importRef.current?.click()} style={{ fontSize: '11px', padding: '5px 8px', cursor: 'pointer' }}>⬆ Загрузить из файла</button>
                <input ref={importRef} type="file" accept="application/json,.json" style={{ display: 'none' }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) importData(f); e.target.value = ''; }} />
              </div>

              <div style={{ marginBottom: '10px' }}>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#374151' }}>Новый объект (ИИ подберёт значок и оценит зимостойкость):</label>
                <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                  <input
                    type="text"
                    maxLength={60}
                    placeholder="Например: Облепиха, Сакура, Качели..."
                    value={newModelInput}
                    onChange={(e) => setNewModelInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCreateModel(); }}
                    style={{ flex: 1, padding: '5px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                  />
                  <button onClick={handleCreateModel} disabled={modelBusy} style={{ backgroundColor: '#16a34a', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold', opacity: modelBusy ? 0.6 : 1 }}>
                    {modelBusy ? '⏳' : 'Создать'}
                  </button>
                </div>
                {modelNote && <div style={{ fontSize: '11px', color: '#475569', marginTop: '6px' }}>{modelNote}</div>}
              </div>

              <div style={{ marginBottom: '10px' }}>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#374151' }}>Выберите объект и кликайте по карте:</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                  {palette.map((tool) => (
                    <span
                      key={tool.id}
                      style={{
                        display: 'inline-flex', alignItems: 'center', borderRadius: '4px',
                        border: selectedToolId === tool.id ? '2px solid #16a34a' : '1px solid #cbd5e1',
                        backgroundColor: selectedToolId === tool.id ? '#dcfce7' : '#ffffff',
                      }}
                    >
                      <button
                        onClick={() => { setIsDrawingMode(false); setSelectedToolId(selectedToolId === tool.id ? null : tool.id); }}
                        style={{ padding: '5px 6px 5px 8px', fontSize: '11px', cursor: 'pointer', border: 'none', background: 'transparent' }}
                      >
                        {tool.icon} {tool.name}
                      </button>
                      <button
                        title="Удалить из редактора"
                        onClick={() => deleteTool(tool)}
                        style={{ padding: '5px 7px 5px 3px', fontSize: '11px', cursor: 'pointer', border: 'none', background: 'transparent', color: '#dc2626', fontWeight: 'bold' }}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
                {DEFAULT_PALETTE.some((d) => !palette.some((t) => t.id === d.id)) && (
                  <button onClick={restoreDefaultTools} style={{ marginTop: '6px', fontSize: '11px', cursor: 'pointer', border: 'none', background: 'transparent', color: '#0369a1', textDecoration: 'underline' }}>
                    ↺ Вернуть стандартные объекты
                  </button>
                )}
                {activeToolData && (
                  <div style={{ marginTop: '8px' }}>
                    <button onClick={placeAtMyLocation} style={{ fontSize: '11px', padding: '5px 8px', cursor: 'pointer', backgroundColor: '#0284c7', color: '#fff', border: 'none', borderRadius: '4px' }}>
                      📍 Поставить «{activeToolData.name}» в моей точке (GPS)
                    </button>
                    {gpsNote && <div style={{ fontSize: '11px', color: '#475569', marginTop: '4px' }}>{gpsNote}</div>}
                  </div>
                )}
              </div>

              <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: '8px', marginTop: '8px' }}>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#374151' }}>Создание новой зоны на карте:</label>
                <div style={{ display: 'flex', gap: '6px', margin: '4px 0' }}>
                  <select
                    value={newZoneCategory}
                    onChange={(e) => setNewZoneCategory(e.target.value as ZoneCategory)}
                    style={{ padding: '5px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '11px' }}
                  >
                    <option value="park">Тип: Парк</option>
                    <option value="forest">Тип: Лесной массив</option>
                    <option value="problem">Тип: Проблемная зона</option>
                    <option value="zone">Тип: Зона города</option>
                  </select>
                  <button
                    onClick={() => { setSelectedToolId(null); setEditingZoneId(null); setIsDrawingMode(!isDrawingMode); }}
                    style={{ flex: 1, backgroundColor: isDrawingMode ? '#e11d48' : '#0284c7', color: '#fff', border: 'none', padding: '6px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    {isDrawingMode ? 'Отмена' : '📐 Нарисовать зону'}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div style={{ padding: '16px' }}>
            {view.name !== 'main' && (
              <button onClick={goBack} style={{ backgroundColor: '#f1f5f9', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', marginBottom: '12px', fontWeight: 'bold' }}>
                ← Назад
              </button>
            )}

            {view.name === 'main' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button onClick={() => setView({ name: 'list', category: 'park' })} style={menuBtn('#f8fafc', '#e2e8f0', '#0f172a')}>🌳 Парки</button>
                <button onClick={() => setView({ name: 'list', category: 'forest' })} style={menuBtn('#f8fafc', '#e2e8f0', '#0f172a')}>🌲 Лесные массивы</button>
                <button onClick={() => setView({ name: 'list', category: 'problem' })} style={menuBtn('#fef2f2', '#fecaca', '#991b1b')}>🚨 Проблемные зоны</button>
                <button onClick={() => setView({ name: 'list', category: 'zone' })} style={menuBtn('#f0f9ff', '#bae6fd', '#075985')}>🗺️ Описание зон города</button>
              </div>
            )}

            {view.name === 'list' && (
              <div>
                <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', color: CATEGORY_META[view.category].color }}>
                  {CATEGORY_META[view.category].icon} {CATEGORY_META[view.category].title}
                </h3>
                {zones.filter((z) => z.category === view.category).map((z) => {
                  const placed = countPlacedInZone(z, placedItems);
                  return (
                    <div key={z.id} onClick={() => openZone(z)} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0', marginBottom: '6px', cursor: 'pointer', backgroundColor: z.category === 'problem' ? '#fef2f2' : '#ffffff' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '13px' }}>{z.name}</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>
                        Деревьев: {(z.details.trees || 0) + placed.trees}
                        {notProblem(z) ? ' · ✅ не проблемная: рядом парк/лес' : deficitText(z) && ` · ${deficitText(z)}`}
                      </div>
                    </div>
                  );
                })}
                {zones.filter((z) => z.category === view.category).length === 0 && (
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Пока нет зон этой категории. Нарисуйте зону в редакторе.</div>
                )}
              </div>
            )}

            {view.name === 'scan' && (
              <div>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '16px' }}>📊 Дефицит озеленения</h3>
                <p style={{ fontSize: '11px', color: '#64748b', margin: '0 0 10px' }}>
                  Расчёт по площади контура и числу деревьев в сравнении с целевой плотностью. Это арифметика, а не анализ снимков:
                  спутниковые данные (NDVI) не используются.
                </p>
                {scanState === 'loading' && <div style={{ fontSize: '12px' }}>⏳ Считаю…</div>}
                {Object.values(analyses)
                  .filter((a) => a.deficit_trees !== null)
                  .map((a) => (
                    <div
                      key={a.zone_id}
                      onClick={() => { const z = zones.find((x) => x.id === a.zone_id); if (z) openZone(z); }}
                      style={{ padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0', marginBottom: '6px', cursor: 'pointer', backgroundColor: (a.deficit_trees || 0) > 0 ? '#fff5f5' : '#f0fdf4' }}
                    >
                      <div style={{ fontWeight: 'bold', fontSize: '13px' }}>{a.name}</div>
                      <div style={{ fontSize: '11px', color: '#475569' }}>
                        {(a.deficit_trees || 0) > 0
                          ? `Не хватает ${a.deficit_trees} деревьев (${Math.round((a.deficit_ratio || 0) * 100)}% от цели)`
                          : 'Целевая плотность достигнута'}
                        {a.estimate && ` · смета ≈ ${Math.round(a.estimate.summary_kzt).toLocaleString('ru-RU')} ₸`}
                      </div>
                    </div>
                  ))}
                {Object.values(analyses).some((a) => a.is_problem === false) && (
                  <div style={{ marginTop: '12px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '6px' }}>✅ Не считаются проблемными</div>
                    {Object.values(analyses).filter((a) => a.is_problem === false).map((a) => (
                      <div key={a.zone_id} onClick={() => { const z = zones.find((x) => x.id === a.zone_id); if (z) openZone(z); }}
                        style={{ padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0', marginBottom: '6px', cursor: 'pointer', backgroundColor: '#f8fafc' }}>
                        <div style={{ fontWeight: 'bold', fontSize: '13px' }}>{a.name}</div>
                        <div style={{ fontSize: '11px', color: '#475569' }}>
                          Рядом «{a.green_neighbor?.name}» (≈{a.green_neighbor?.distance_m} м, радиус {a.green_radius_m} м)
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {view.name === 'detail' && selectedZone && (
              <ZoneDetail
                zone={selectedZone}
                placed={countPlacedInZone(selectedZone, placedItems)}
                analysis={analyses[selectedZone.id] || null}
                report={report}
                reportBusy={reportBusy}
                reportError={reportError}
                editingBounds={editingZoneId === selectedZone.id}
                onEditText={() => setEditFormZone(selectedZone)}
                onToggleBounds={() => setEditingZoneId(editingZoneId === selectedZone.id ? null : selectedZone.id)}
                onMakeReport={makeReport}
                onDelete={() => deleteZone(selectedZone)}
                canEdit={canEdit}
              />
            )}
          </div>
        </div>
      </div>

      {pendingCoords && (
        <ZoneFormModal
          title="📐 Параметры новой зоны"
          submitLabel="Сохранить зону"
          submitColor="#16a34a"
          category={newZoneCategory}
          initial={{ name: newZoneCategory === 'park' ? 'Новый парк' : newZoneCategory === 'forest' ? 'Новый лесной массив' : 'Новая зона', trees: 0, benches: 0, bins: 0, attractions: [] }}
          onSubmit={createZone}
          onCancel={() => setPendingCoords(null)}
        />
      )}

      {editFormZone && (
        <ZoneFormModal
          title="✏️ Редактирование параметров"
          submitLabel="Сохранить изменения"
          submitColor="#0284c7"
          category={editFormZone.category}
          initial={{ name: editFormZone.name, ...editFormZone.details }}
          onSubmit={saveEditedZone}
          onCancel={() => setEditFormZone(null)}
        />
      )}
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(<App />);
