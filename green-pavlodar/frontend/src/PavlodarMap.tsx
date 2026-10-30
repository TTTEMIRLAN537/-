import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export interface PlacedItem {
  id: string;
  type: string;
  name: string;
  lat: number;
  lng: number;
  icon: string;
  color: string;
}

export interface ZoneData {
  id: string;
  name: string;
  category: 'park' | 'forest' | 'problem' | 'zone';
  coordinates: [number, number][];
  color: string;
  details: {
    trees: number;
    benches: number;
    bins: number;
    ph?: string;
    soilType?: string;
    attractions?: string;
    area?: string;
    desc?: string;
    missingTrees?: number;
    bestSpecies?: string;
    cost?: string;
    aiScore?: number;
  };
}

interface MapProps {
  selectedTool: string | null;
  activeItemData: { name: string; icon: string; color: string; type: string } | null;
  placedItems: PlacedItem[];
  onItemPlaced: (item: PlacedItem) => void;
  onItemDeleted: (itemId: string) => void;
  isDrawingMode: boolean;
  onPolygonCreated: (coords: [number, number][]) => void;
  flyToCoords: [number, number] | null;
  allZones: ZoneData[];
  selectedZoneId: string | null;
  onZoneSelect: (zone: ZoneData) => void;
  activeCategory: 'all' | 'park' | 'forest' | 'problem' | 'zone';
  editingZoneId: string | null;
  onZoneCoordinatesUpdated: (zoneId: string, newCoords: [number, number][]) => void;
}

export const PavlodarMap: React.FC<MapProps> = ({
  selectedTool,
  activeItemData,
  placedItems,
  onItemPlaced,
  onItemDeleted,
  isDrawingMode,
  onPolygonCreated,
  flyToCoords,
  allZones,
  selectedZoneId,
  onZoneSelect,
  activeCategory,
  editingZoneId,
  onZoneCoordinatesUpdated
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<{ [id: string]: maplibregl.Marker }>({});
  const vertexMarkersRef = useRef<maplibregl.Marker[]>([]);
  const [drawingPoints, setDrawingPoints] = useState<[number, number][]>([]);

  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    const mapInstance = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'osm-tiles': {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            maxzoom: 19,
            attribution: '© OpenStreetMap contributors'
          }
        },
        layers: [{ id: 'osm-layer', type: 'raster', source: 'osm-tiles' }]
      },
      center: [76.9674, 52.2873],
      zoom: 13,
      maxZoom: 19
    });

    map.current = mapInstance;
    mapInstance.addControl(new maplibregl.NavigationControl(), 'top-right');

    const forceResize = () => {
      if (map.current) map.current.resize();
    };

    mapInstance.on('load', () => {
      forceResize();
      setTimeout(forceResize, 300);
    });

    const resizeObserver = new ResizeObserver(() => forceResize());
    resizeObserver.observe(mapContainer.current);

    return () => resizeObserver.disconnect();
  }, []);

  // Клик по карте для расстановки элементов или рисования
  useEffect(() => {
    if (!map.current) return;
    const m = map.current;

    const handleClick = (e: maplibregl.MapMouseEvent) => {
      const pt: [number, number] = [e.lngLat.lng, e.lngLat.lat];

      if (isDrawingMode) {
        setDrawingPoints((prev) => [...prev, pt]);
        return;
      }

      if (selectedTool && activeItemData) {
        const newItem: PlacedItem = {
          id: 'item_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
          type: activeItemData.type,
          name: activeItemData.name,
          lat: e.lngLat.lat,
          lng: e.lngLat.lng,
          icon: activeItemData.icon,
          color: activeItemData.color
        };
        onItemPlaced(newItem);
      }
    };

    m.on('click', handleClick);
    return () => {
      m.off('click', handleClick);
    };
  }, [isDrawingMode, selectedTool, activeItemData, onItemPlaced]);

  // Отрисовка полигонов зон с фильтрацией по категориям
  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded()) return;

    const m = map.current;

    if (m.getLayer('all-zones-fill')) m.removeLayer('all-zones-fill');
    if (m.getLayer('all-zones-line')) m.removeLayer('all-zones-line');
    if (m.getLayer('draw-line')) m.removeLayer('draw-line');
    if (m.getLayer('draw-fill')) m.removeLayer('draw-fill');
    if (m.getSource('all-zones-src')) m.removeSource('all-zones-src');
    if (m.getSource('draw-src')) m.removeSource('draw-src');

    const filteredZones = allZones.filter((z) => {
      if (activeCategory === 'all') return true;
      return z.category === activeCategory;
    });

    const features = filteredZones.map((z) => ({
      type: 'Feature',
      properties: { id: z.id, name: z.name, color: z.color, isSelected: z.id === selectedZoneId },
      geometry: {
        type: 'Polygon',
        coordinates: [z.coordinates]
      }
    }));

    m.addSource('all-zones-src', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: features as any }
    });

    m.addLayer({
      id: 'all-zones-fill',
      type: 'fill',
      source: 'all-zones-src',
      paint: {
        'fill-color': ['get', 'color'],
        'fill-opacity': ['case', ['boolean', ['get', 'isSelected'], false], 0.65, 0.35]
      }
    });

    m.addLayer({
      id: 'all-zones-line',
      type: 'line',
      source: 'all-zones-src',
      paint: {
        'line-color': ['get', 'color'],
        'line-width': ['case', ['boolean', ['get', 'isSelected'], false], 4, 2]
      }
    });

    m.on('click', 'all-zones-fill', (e: any) => {
      if (isDrawingMode || selectedTool || editingZoneId) return;
      if (e.features && e.features[0]) {
        const id = e.features[0].properties.id;
        const found = allZones.find((z) => z.id === id);
        if (found) onZoneSelect(found);
      }
    });

    if (drawingPoints.length > 0) {
      const closedPoints = drawingPoints.length >= 3 ? [...drawingPoints, drawingPoints[0]] : drawingPoints;

      m.addSource('draw-src', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: drawingPoints.length >= 3
            ? { type: 'Polygon', coordinates: [closedPoints] }
            : { type: 'LineString', coordinates: drawingPoints }
        }
      });

      if (drawingPoints.length >= 3) {
        m.addLayer({
          id: 'draw-fill',
          type: 'fill',
          source: 'draw-src',
          paint: { 'fill-color': '#dc2626', 'fill-opacity': 0.25 }
        });
      }

      m.addLayer({
        id: 'draw-line',
        type: 'line',
        source: 'draw-src',
        paint: { 'line-color': '#dc2626', 'line-width': 3 }
      });
    }
  }, [allZones, selectedZoneId, drawingPoints, isDrawingMode, selectedTool, activeCategory, editingZoneId, onZoneSelect]);

  // Интерактивное редактирование вершин (Vertex Editing) для любых парков и зон
  useEffect(() => {
    if (!map.current) return;

    vertexMarkersRef.current.forEach((m) => m.remove());
    vertexMarkersRef.current = [];

    if (!editingZoneId) return;

    const targetZone = allZones.find((z) => z.id === editingZoneId);
    if (!targetZone) return;

    const currentCoords = [...targetZone.coordinates];

    currentCoords.slice(0, -1).forEach((coord, index) => {
      const el = document.createElement('div');
      el.style.width = '14px';
      el.style.height = '14px';
      el.style.backgroundColor = '#ef4444';
      el.style.border = '2px solid #ffffff';
      el.style.borderRadius = '50%';
      el.style.cursor = 'grab';
      el.style.boxShadow = '0 2px 6px rgba(0,0,0,0.4)';
      el.title = `Вершина ${index + 1} (Перетащите для изменения границы)`;

      const marker = new maplibregl.Marker({ element: el, draggable: true })
        .setLngLat(coord)
        .addTo(map.current!);

      marker.on('dragend', () => {
        const newLngLat = marker.getLngLat();
        const updated = [...currentCoords];
        updated[index] = [newLngLat.lng, newLngLat.lat];
        updated[updated.length - 1] = updated[0]; // Замыкаем контур
        onZoneCoordinatesUpdated(targetZone.id, updated);
      });

      vertexMarkersRef.current.push(marker);
    });
  }, [editingZoneId, allZones, onZoneCoordinatesUpdated]);

  useEffect(() => {
    if (map.current && flyToCoords) {
      map.current.flyTo({ center: flyToCoords, zoom: 15.2, speed: 1.2 });
    }
  }, [flyToCoords]);

  // Отрисовка расставленных объектов
  useEffect(() => {
    if (!map.current) return;

    Object.values(markersRef.current).forEach((m) => m.remove());
    markersRef.current = {};

    placedItems.forEach((item) => {
      const el = document.createElement('div');
      el.style.backgroundColor = item.color || '#16a34a';
      el.style.width = '30px';
      el.style.height = '30px';
      el.style.borderRadius = '50%';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.style.fontSize = '16px';
      el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
      el.style.border = '2px solid #ffffff';
      el.style.cursor = 'pointer';
      el.title = item.name;
      el.innerHTML = item.icon;

      const popupNode = document.createElement('div');
      popupNode.style.padding = '4px';
      popupNode.style.textAlign = 'center';
      popupNode.innerHTML = `
        <div style="font-weight:bold; font-size:12px; margin-bottom:6px;">${item.name}</div>
        <button id="del_btn_${item.id}" style="background-color:#ef4444; color:#fff; border:none; padding:4px 10px; border-radius:4px; font-size:11px; cursor:pointer; font-weight:bold;">
          🗑️ Удалить объект
        </button>
      `;

      const popup = new maplibregl.Popup({ offset: 15 }).setDOMContent(popupNode);

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([item.lng, item.lat])
        .setPopup(popup)
        .addTo(map.current!);

      popup.on('open', () => {
        const btn = document.getElementById(`del_btn_${item.id}`);
        if (btn) {
          btn.onclick = () => {
            onItemDeleted(item.id);
          };
        }
      });

      markersRef.current[item.id] = marker;
    });
  }, [placedItems, onItemDeleted]);

  const handleFinishDrawing = () => {
    if (drawingPoints.length >= 3) {
      const closed = [...drawingPoints, drawingPoints[0]];
      onPolygonCreated(closed);
      setDrawingPoints([]);
    } else {
      alert('Поставьте минимум 3 точки на карте кликами мыши, чтобы сформировать ровную зону.');
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: 'calc(100vh - 85px)', minHeight: '520px', borderRadius: '12px', overflow: 'hidden', border: '1px solid #cbd5e1' }}>
      <div ref={mapContainer} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' }} />

      {isDrawingMode && (
        <div style={{ position: 'absolute', top: '16px', left: '16px', backgroundColor: 'rgba(255, 255, 255, 0.95)', padding: '12px 16px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', zIndex: 10, borderLeft: '4px solid #dc2626' }}>
          <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#991b1b', marginBottom: '6px' }}>
            📐 Режим рисования: Кликайте мышью по карте для установки вершин зоны
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
              onClick={() => setDrawingPoints([])}
              style={{ backgroundColor: '#64748b', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}
            >
              🗑️ Сбросить
            </button>
          </div>
        </div>
      )}

      {editingZoneId && (
        <div style={{ position: 'absolute', top: '16px', left: '16px', backgroundColor: 'rgba(255, 255, 255, 0.95)', padding: '10px 14px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', zIndex: 10, borderLeft: '4px solid #0284c7' }}>
          <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#0369a1' }}>
            ✏️ Режим изменения границ: Перетаскивайте красные точки на карте мышью
          </div>
        </div>
      )}
    </div>
  );
};