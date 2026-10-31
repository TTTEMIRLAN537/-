import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { LngLat, PlacedItem, ToolModel, ZoneCategory, ZoneData } from './types';

export type { PlacedItem, ZoneData } from './types';

interface MapProps {
  selectedTool: string | null;
  activeItemData: ToolModel | null;
  placedItems: PlacedItem[];
  onItemPlaced: (item: PlacedItem) => void;
  onItemDeleted: (itemId: string) => void;
  isDrawingMode: boolean;
  onPolygonCreated: (coords: LngLat[]) => void;
  flyToCoords: LngLat | null;
  allZones: ZoneData[];
  selectedZoneId: string | null;
  onZoneSelect: (zone: ZoneData) => void;
  activeCategory: 'all' | ZoneCategory;
  editingZoneId: string | null;
  onZoneCoordinatesUpdated: (zoneId: string, newCoords: LngLat[]) => void;
  height?: string;
}

const EMPTY: any = { type: 'FeatureCollection', features: [] };
/** Иконки объектов показываются и расставляются только начиная с этого масштаба — так на карте нет «каши». */
export const ITEMS_MIN_ZOOM = 16;

export const PavlodarMap: React.FC<MapProps> = (props) => {
  const {
    placedItems, onItemDeleted, isDrawingMode, onPolygonCreated, flyToCoords,
    allZones, selectedZoneId, activeCategory, editingZoneId, onZoneCoordinatesUpdated,
  } = props;

  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const vertexMarkersRef = useRef<maplibregl.Marker[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const drawMarkersRef = useRef<maplibregl.Marker[]>([]);
  const [drawingPoints, setDrawingPoints] = useState<LngLat[]>([]);
  const [itemsVisible, setItemsVisible] = useState(false);

  // Обработчики карты регистрируются один раз, а актуальные props читают отсюда.
  const latest = useRef(props);
  latest.current = props;

  // --- Создание карты и слоёв (один раз) ---
  useEffect(() => {
    if (!mapContainer.current) return;

    const m = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'osm-tiles': {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            maxzoom: 19,
            attribution: '© OpenStreetMap contributors',
          },
        },
        layers: [{ id: 'osm-layer', type: 'raster', source: 'osm-tiles' }],
      },
      center: [76.9674, 52.2873],
      zoom: 13,
      maxZoom: 19,
    });
    map.current = m;
    m.addControl(new maplibregl.NavigationControl(), 'top-right');
    // Кнопка «где я» — удобно при расстановке объектов на месте
    m.addControl(new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showAccuracyCircle: true,
      fitBoundsOptions: { maxZoom: 18 },
    }), 'top-right');
    const syncZoom = () => setItemsVisible(m.getZoom() >= ITEMS_MIN_ZOOM);
    m.on('zoom', syncZoom);
    syncZoom();

    m.on('load', () => {
      m.addSource('zones-src', { type: 'geojson', data: EMPTY });
      m.addLayer({
        id: 'zones-fill', type: 'fill', source: 'zones-src',
        paint: { 'fill-color': ['get', 'color'], 'fill-opacity': ['case', ['boolean', ['get', 'isSelected'], false], 0.65, 0.35] },
      });
      m.addLayer({
        id: 'zones-line', type: 'line', source: 'zones-src',
        paint: { 'line-color': ['get', 'color'], 'line-width': ['case', ['boolean', ['get', 'isSelected'], false], 4, 2] },
      });

      m.addSource('draw-src', { type: 'geojson', data: EMPTY });
      m.addLayer({
        id: 'draw-fill', type: 'fill', source: 'draw-src', filter: ['==', ['geometry-type'], 'Polygon'],
        paint: { 'fill-color': '#dc2626', 'fill-opacity': 0.25 },
      });
      m.addLayer({
        id: 'draw-line', type: 'line', source: 'draw-src',
        filter: ['any', ['==', ['geometry-type'], 'Polygon'], ['==', ['geometry-type'], 'LineString']],
        paint: { 'line-color': '#dc2626', 'line-width': 3 },
      });

      m.on('click', 'zones-fill', (e: any) => {
        const p = latest.current;
        if (p.isDrawingMode || p.selectedTool || p.editingZoneId) return;
        const id = e.features?.[0]?.properties?.id;
        const zone = p.allZones.find((z) => z.id === id);
        if (zone) p.onZoneSelect(zone);
      });
      m.on('mouseenter', 'zones-fill', () => { m.getCanvas().style.cursor = 'pointer'; });
      m.on('mouseleave', 'zones-fill', () => { m.getCanvas().style.cursor = ''; });

      setMapReady(true);
    });

    // Клик по карте: рисование контура или расстановка объекта
    m.on('click', (e: maplibregl.MapMouseEvent) => {
      const p = latest.current;
      if (p.isDrawingMode) {
        setDrawingPoints((prev) => [...prev, [e.lngLat.lng, e.lngLat.lat]]);
        return;
      }
      if (p.selectedTool && p.activeItemData) {
        if (m.getZoom() < ITEMS_MIN_ZOOM) return; // объекты ставятся только при сильном приближении
        const t = p.activeItemData;
        p.onItemPlaced({
          id: 'item_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
          type: t.type, kind: t.kind, name: t.name, icon: t.icon, color: t.color,
          lat: e.lngLat.lat, lng: e.lngLat.lng,
        });
      }
    });

    const resizeObserver = new ResizeObserver(() => m.resize());
    resizeObserver.observe(mapContainer.current);

    return () => {
      resizeObserver.disconnect();
      markersRef.current.forEach((mk) => mk.remove());
      vertexMarkersRef.current.forEach((mk) => mk.remove());
      drawMarkersRef.current.forEach((mk) => mk.remove());
      markersRef.current = [];
      vertexMarkersRef.current = [];
      drawMarkersRef.current = [];
      m.remove();
      map.current = null;
      setMapReady(false);
    };
  }, []);

  // --- Полигоны зон ---
  useEffect(() => {
    const src: any = map.current && mapReady ? map.current.getSource('zones-src') : null;
    if (!src) return;
    src.setData({
      type: 'FeatureCollection',
      features: allZones
        .filter((z) => activeCategory === 'all' || z.category === activeCategory)
        .map((z) => ({
          type: 'Feature',
          properties: { id: z.id, name: z.name, color: z.color, isSelected: z.id === selectedZoneId },
          geometry: { type: 'Polygon', coordinates: [z.coordinates] },
        })),
    });
  }, [mapReady, allZones, selectedZoneId, activeCategory]);

  // --- Предпросмотр рисуемого контура ---
  useEffect(() => {
    const src: any = map.current && mapReady ? map.current.getSource('draw-src') : null;
    if (!src) return;
    const features: any[] = [];
    if (drawingPoints.length >= 3) {
      features.push({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[...drawingPoints, drawingPoints[0]]] } });
    } else if (drawingPoints.length === 2) {
      features.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: drawingPoints } });
    }
    src.setData({ type: 'FeatureCollection', features });

    // Вершины — обычные DOM-маркеры с номерами: видны всегда и не зависят от выражений стиля
    drawMarkersRef.current.forEach((mk) => mk.remove());
    drawMarkersRef.current = drawingPoints.map((pt, i) => {
      const el = document.createElement('div');
      Object.assign(el.style, {
        width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#dc2626', color: '#fff',
        border: '2px solid #fff', boxShadow: '0 1px 4px rgba(0,0,0,0.5)', fontSize: '10px', fontWeight: 'bold',
        display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
      });
      el.textContent = String(i + 1);
      return new maplibregl.Marker({ element: el }).setLngLat(pt).addTo(map.current as maplibregl.Map);
    });
  }, [mapReady, drawingPoints]);

  // В режиме рисования: перекрестие вместо руки и без зума по двойному клику (иначе быстрые клики «двигают» карту)
  useEffect(() => {
    const m = map.current;
    if (!m || !mapReady) return;
    m.getCanvas().style.cursor = isDrawingMode ? 'crosshair' : '';
    if (isDrawingMode) m.doubleClickZoom.disable(); else m.doubleClickZoom.enable();
  }, [mapReady, isDrawingMode]);

  // Выключили режим рисования — недорисованный контур не должен «висеть»
  useEffect(() => {
    if (!isDrawingMode) setDrawingPoints([]);
  }, [isDrawingMode]);

  // --- Редактирование вершин ---
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    vertexMarkersRef.current.forEach((mk) => mk.remove());
    vertexMarkersRef.current = [];
    if (!editingZoneId) return;
    const zone = allZones.find((z) => z.id === editingZoneId);
    if (!zone) return;

    zone.coordinates.slice(0, -1).forEach((coord, index) => {
      const el = document.createElement('div');
      Object.assign(el.style, {
        width: '14px', height: '14px', backgroundColor: '#ef4444', border: '2px solid #ffffff',
        borderRadius: '50%', cursor: 'grab', boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
      });
      el.title = `Вершина ${index + 1} (перетащите для изменения границы)`;

      const marker = new maplibregl.Marker({ element: el, draggable: true }).setLngLat(coord).addTo(m);
      marker.on('dragend', () => {
        const ll = marker.getLngLat();
        const updated = [...zone.coordinates];
        updated[index] = [ll.lng, ll.lat];
        updated[updated.length - 1] = updated[0]; // замыкаем контур
        onZoneCoordinatesUpdated(zone.id, updated);
      });
      vertexMarkersRef.current.push(marker);
    });
  }, [editingZoneId, allZones, onZoneCoordinatesUpdated]);

  useEffect(() => {
    if (map.current && flyToCoords) map.current.flyTo({ center: flyToCoords, zoom: 15.5, speed: 1.2 });
  }, [flyToCoords]);

  // --- Расставленные объекты (DOM собираем без innerHTML: названия не должны исполняться как HTML) ---
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    markersRef.current.forEach((mk) => mk.remove());
    markersRef.current = [];
    if (!itemsVisible) return; // при отдалении иконки скрыты

    placedItems.forEach((item) => {
      const el = document.createElement('div');
      Object.assign(el.style, {
        backgroundColor: item.color || '#16a34a', width: '30px', height: '30px', borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)', border: '2px solid #ffffff', cursor: 'pointer',
      });
      el.title = item.name;
      el.textContent = item.icon;

      const node = document.createElement('div');
      Object.assign(node.style, { padding: '4px', textAlign: 'center' });
      const title = document.createElement('div');
      Object.assign(title.style, { fontWeight: 'bold', fontSize: '12px', marginBottom: '6px' });
      title.textContent = item.name;
      const del = document.createElement('button');
      Object.assign(del.style, {
        backgroundColor: '#ef4444', color: '#fff', border: 'none', padding: '4px 10px',
        borderRadius: '4px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold',
      });
      del.textContent = '🗑️ Удалить объект';
      del.onclick = () => onItemDeleted(item.id);
      node.append(title, del);

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([item.lng, item.lat])
        .setPopup(new maplibregl.Popup({ offset: 15 }).setDOMContent(node))
        .addTo(m);
      markersRef.current.push(marker);
    });
  }, [placedItems, onItemDeleted, itemsVisible, mapReady]);

  const handleFinishDrawing = () => {
    if (drawingPoints.length < 3) {
      alert('Поставьте минимум 3 точки на карте, чтобы сформировать зону.');
      return;
    }
    onPolygonCreated([...drawingPoints, drawingPoints[0]]);
    setDrawingPoints([]);
  };

  const panel: React.CSSProperties = {
    position: 'absolute', top: '16px', left: '16px', backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', zIndex: 10,
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: props.height || 'calc(100vh - 85px)', minHeight: '360px', borderRadius: '12px', overflow: 'hidden', border: '1px solid #cbd5e1' }}>
      <div ref={mapContainer} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />

      {isDrawingMode && (
        <div style={{ ...panel, padding: '12px 16px', borderLeft: '4px solid #dc2626' }}>
          <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#991b1b', marginBottom: '6px' }}>
            📐 Режим рисования: кликайте по карте, чтобы поставить вершины зоны
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '10px' }}>
            Поставлено вершин: <strong>{drawingPoints.length}</strong>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={handleFinishDrawing}
              disabled={drawingPoints.length < 3}
              style={{ backgroundColor: drawingPoints.length >= 3 ? '#16a34a' : '#94a3b8', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', cursor: drawingPoints.length >= 3 ? 'pointer' : 'not-allowed' }}
            >
              ✅ Зафиксировать зону
            </button>
            <button
              onClick={() => setDrawingPoints((p) => p.slice(0, -1))}
              disabled={drawingPoints.length === 0}
              style={{ backgroundColor: '#64748b', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}
            >
              ↩ Убрать точку
            </button>
            <button
              onClick={() => setDrawingPoints([])}
              style={{ backgroundColor: '#64748b', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}
            >
              🗑️ Сбросить
            </button>
          </div>
        </div>
      )}

      {!itemsVisible && (placedItems.length > 0 || props.selectedTool) && !isDrawingMode && (
        <div style={{ position: 'absolute', bottom: '16px', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'rgba(15,23,42,0.85)', color: '#fff', padding: '8px 14px', borderRadius: '20px', fontSize: '12px', zIndex: 10, pointerEvents: 'none' }}>
          🔍 {props.selectedTool ? 'Приблизьте карту, чтобы расставлять объекты' : `Объектов на карте: ${placedItems.length}. Приблизьте карту, чтобы их увидеть`}
        </div>
      )}

      {editingZoneId && (
        <div style={{ ...panel, padding: '10px 14px', borderLeft: '4px solid #0284c7' }}>
          <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#0369a1' }}>
            ✏️ Режим изменения границ: перетаскивайте красные точки на карте
          </div>
        </div>
      )}
    </div>
  );
};
