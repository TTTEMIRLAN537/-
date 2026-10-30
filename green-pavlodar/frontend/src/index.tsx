import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { PavlodarMap, PlacedItem, ZoneData } from './PavlodarMap';

const INITIAL_ZONES: ZoneData[] = [
  {
    id: 'p1',
    name: 'Парк Победы',
    category: 'park',
    color: '#22c55e',
    coordinates: [[76.945, 52.278], [76.955, 52.278], [76.955, 52.284], [76.945, 52.284], [76.945, 52.278]],
    details: { trees: 1200, benches: 48, bins: 32, attractions: 'Мемориал славы, фонтаны, аллея ветеранов', desc: 'Крупный парковый комплекс с благоустроенными аллеями.' }
  },
  {
    id: 'p2',
    name: 'Городской сад',
    category: 'park',
    color: '#22c55e',
    coordinates: [[76.954, 52.285], [76.962, 52.285], [76.962, 52.290], [76.954, 52.290], [76.954, 52.285]],
    details: { trees: 850, benches: 36, bins: 24, attractions: 'Колесо обозрения, семейные аттракционы', desc: 'Популярное место семейного досуга.' }
  },
  {
    id: 'p3',
    name: 'Парк Гагарина',
    category: 'park',
    color: '#22c55e',
    coordinates: [[76.968, 52.292], [76.976, 52.292], [76.976, 52.298], [76.968, 52.298], [76.968, 52.292]],
    details: { trees: 620, benches: 22, bins: 18, attractions: 'Спортивные площадки, воркаут-зоны', desc: 'Тихий ухоженный парк.' }
  },
  {
    id: 'f1',
    name: 'Пойма реки Иртыш',
    category: 'forest',
    color: '#15803d',
    coordinates: [[76.920, 52.250], [76.938, 52.250], [76.938, 52.270], [76.920, 52.270], [76.920, 52.250]],
    details: { trees: 5400, benches: 10, bins: 15, area: '1450 га', attractions: 'Ива белая, тополь черный, эко-маршруты', desc: 'Природный пойменный массив.' }
  },
  {
    id: 'f2',
    name: 'Усольский лесопарк',
    category: 'forest',
    color: '#15803d',
    coordinates: [[76.935, 52.240], [76.946, 52.240], [76.946, 52.250], [76.935, 52.250], [76.935, 52.240]],
    details: { trees: 3100, benches: 14, bins: 12, area: '320 га', attractions: 'Сосна обыкновенная, береза повислая', desc: 'Хвойный массив.' }
  },
  {
    id: 'pr1',
    name: 'Улица Катаева / Гагарина',
    category: 'problem',
    color: '#ef4444',
    coordinates: [[76.960, 52.270], [76.970, 52.270], [76.970, 52.275], [76.960, 52.275], [76.960, 52.270]],
    details: { trees: 45, benches: 4, bins: 2, missingTrees: 180, bestSpecies: 'Вяз приземистый, Акация жёлтая', cost: '2 450 000 ₸', desc: 'Дефицит зеленых полос.' }
  },
  {
    id: 'pr2',
    name: 'Промзона ТЭЦ-3 (Химгородки)',
    category: 'problem',
    color: '#ef4444',
    coordinates: [[76.980, 52.310], [76.995, 52.310], [76.995, 52.320], [76.980, 52.320], [76.980, 52.310]],
    details: { trees: 110, benches: 0, bins: 2, missingTrees: 450, bestSpecies: 'Тополь белый, Карагач', cost: '6 800 000 ₸', desc: 'Защитная полоса от выбросов.' }
  },
  {
    id: 'z1',
    name: 'Центральная зона Павлодара',
    category: 'zone',
    color: '#0284c7',
    coordinates: [[76.940, 52.270], [76.975, 52.270], [76.975, 52.300], [76.940, 52.300], [76.940, 52.270]],
    details: { trees: 2670, benches: 106, bins: 74, ph: '7.2 (Слабощелочная)', soilType: 'Темно-каштановая', desc: 'Административно-жилой центр.' }
  }
];

const DEFAULT_PALETTE = [
  { id: 't1', name: 'Вяз (Карагач)', icon: '🌳', color: '#15803d', type: 'tree' },
  { id: 't2', name: 'Сосна обыкновенная', icon: '🌲', color: '#047857', type: 'tree' },
  { id: 't3', name: 'Береза повислая', icon: '🌿', color: '#65a30d', type: 'tree' },
  { id: 'f1', name: 'Скамейка парковая', icon: '🪑', color: '#b45309', type: 'bench' },
  { id: 'f2', name: 'Урна уличная', icon: '🗑️', color: '#475569', type: 'bin' }
];

// ИИ-Биогенератор породосостава и объектов с автоматическим подбором свойства и визуализации
const generateAIBioModel = (name: string) => {
  const l = name.toLowerCase().trim();

  if (l.includes('сакур') || l.includes('вишн')) return { icon: '🌸', color: '#ec4899', type: 'sakura' };
  if (l.includes('дуб')) return { icon: '🌳', color: '#166534', type: 'oak' };
  if (l.includes('сосн')) return { icon: '🌲', color: '#047857', type: 'pine' };
  if (l.includes('ель') || l.includes('пихт')) return { icon: '🎄', color: '#064e3b', type: 'spruce' };
  if (l.includes('берез')) return { icon: '🌿', color: '#65a30d', type: 'birch' };
  if (l.includes('клен')) return { icon: '🍁', color: '#ea580c', type: 'maple' };
  if (l.includes('яблон') || l.includes('груш')) return { icon: '🍎', color: '#e11d48', type: 'fruit' };
  if (l.includes('ив')) return { icon: '🌾', color: '#4d7c0f', type: 'willow' };
  if (l.includes('рябин')) return { icon: '🔴', color: '#dc2626', type: 'rowan' };
  if (l.includes('топол')) return { icon: '🌴', color: '#15803d', type: 'poplar' };
  if (l.includes('туя') || l.includes('можжевел')) return { icon: '🪴', color: '#0f766e', type: 'thuja' };
  if (l.includes('куст') || l.includes('сирен') || l.includes('шиповн')) return { icon: '🌺', color: '#be185d', type: 'shrub' };
  if (l.includes('памятник') || l.includes('мемориал') || l.includes('скульптур')) return { icon: '🗿', color: '#475569', type: 'monument' };
  if (l.includes('фонтан') || l.includes('пруд')) return { icon: '⛲', color: '#0284c7', type: 'fountain' };
  if (l.includes('детск') || l.includes('площадк') || l.includes('горок')) return { icon: '🎡', color: '#8b5cf6', type: 'playground' };
  if (l.includes('скамейк') || l.includes('лавочк')) return { icon: '🪑', color: '#b45309', type: 'bench' };
  if (l.includes('урн') || l.includes('бак')) return { icon: '🗑️', color: '#334155', type: 'bin' };
  if (l.includes('фонарь') || l.includes('свет')) return { icon: '💡', color: '#eab308', type: 'light' };

  let hash = 0;
  for (let i = 0; i < l.length; i++) hash = l.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return { icon: '🌳', color: `hsl(${hue}, 70%, 35%)`, type: 'custom_ai' };
};

const App = () => {
  const [activeTab, setActiveTab] = useState<'main' | 'parks' | 'park_detail' | 'forests' | 'forest_detail' | 'problems' | 'problem_detail' | 'zones' | 'zone_detail'>('main');

  // Сохранение зон в localStorage
  const [zones, setZones] = useState<ZoneData[]>(() => {
    const saved = localStorage.getItem('green_pavlodar_zones_v2');
    return saved ? JSON.parse(saved) : INITIAL_ZONES;
  });

  useEffect(() => {
    localStorage.setItem('green_pavlodar_zones_v2', JSON.stringify(zones));
  }, [zones]);

  // Сохранение объектов в localStorage
  const [placedItems, setPlacedItems] = useState<PlacedItem[]>(() => {
    const saved = localStorage.getItem('green_pavlodar_placed_items_v2');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('green_pavlodar_placed_items_v2', JSON.stringify(placedItems));
  }, [placedItems]);

  // Сохранение палитры ИИ-моделей в localStorage
  const [treePalette, setTreePalette] = useState(() => {
    const saved = localStorage.getItem('green_pavlodar_palette_v2');
    return saved ? JSON.parse(saved) : DEFAULT_PALETTE;
  });

  useEffect(() => {
    localStorage.setItem('green_pavlodar_palette_v2', JSON.stringify(treePalette));
  }, [treePalette]);

  const [selectedZone, setSelectedZone] = useState<ZoneData | null>(null);
  const [flyCoords, setFlyCoords] = useState<[number, number] | null>(null);

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [newModelInput, setNewModelInput] = useState('');
  const [selectedToolId, setSelectedToolId] = useState<string | null>(null);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null);
  const [newZoneCategory, setNewZoneCategory] = useState<'park' | 'forest' | 'problem' | 'zone'>('park');
  const [aiScanStatus, setAiScanStatus] = useState<string | null>(null);

  // Модальные окна
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [pendingCoords, setPendingCoords] = useState<[number, number][] | null>(null);
  const [createForm, setCreateForm] = useState({ name: '', trees: 100, benches: 10, bins: 8, ph: '7.2', soilType: 'Каштановая', desc: '', attractions: '' });

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<any>(null);

  const getActiveCategory = (): 'all' | 'park' | 'forest' | 'problem' | 'zone' => {
    if (activeTab === 'parks' || activeTab === 'park_detail') return 'park';
    if (activeTab === 'forests' || activeTab === 'forest_detail') return 'forest';
    if (activeTab === 'problems' || activeTab === 'problem_detail') return 'problem';
    if (activeTab === 'zones' || activeTab === 'zone_detail') return 'zone';
    return 'all';
  };

  // ИИ-Сканирование карты и автоматический поиск проблемных зон
  const handleAIScanMap = () => {
    setAiScanStatus('🤖 ИИ производит нейросетевой анализ вегетационного индекса и почвы Павлодара...');

    setTimeout(() => {
      const aiZoneId = 'ai_prob_' + Date.now();
      const newAIProblemZone: ZoneData = {
        id: aiZoneId,
        name: '🤖 ИИ-Детекция: Двор ул. Лермонтова 84',
        category: 'problem',
        color: '#dc2626',
        coordinates: [[76.950, 52.288], [76.958, 52.288], [76.958, 52.293], [76.950, 52.293], [76.950, 52.288]],
        details: {
          trees: 18,
          benches: 2,
          bins: 1,
          missingTrees: 140,
          bestSpecies: 'Вяз приземистый, Сосна обыкновенная, Акация',
          cost: '1 850 000 ₸',
          desc: 'ИИ обнаружил критический дефицит тени (NDVI < 0.15) и засоление 3.8 дСм/м.',
          aiScore: 94.2
        }
      };

      setZones((prev) => [newAIProblemZone, ...prev]);
      setSelectedZone(newAIProblemZone);
      setFlyCoords([76.954, 52.290]);
      setActiveTab('problem_detail');
      setAiScanStatus('✅ ИИ автоматически выявил новую проблемную зону!');
      setTimeout(() => setAiScanStatus(null), 4000);
    }, 1200);
  };

  const handleCreateAIModel = () => {
    if (!newModelInput.trim()) return;
    const config = generateAIBioModel(newModelInput.trim());
    const newModel = {
      id: 'mod_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      name: newModelInput.trim(),
      icon: config.icon,
      color: config.color,
      type: config.type
    };
    setTreePalette([...treePalette, newModel]);
    setSelectedToolId(newModel.id);
    setNewModelInput('');
  };

  const activeToolData = treePalette.find((t) => t.id === selectedToolId) || null;

  const handlePolygonCreated = (coords: [number, number][]) => {
    setIsDrawingMode(false);
    setPendingCoords(coords);
    setCreateForm({
      name: newZoneCategory === 'park' ? 'Новый парк' : newZoneCategory === 'forest' ? 'Новый лесной массив' : 'Новая зона',
      trees: 120,
      benches: 12,
      bins: 8,
      ph: '7.0',
      soilType: 'Каштановая',
      desc: 'Зона успешно занесена в ГИС.',
      attractions: 'Парковые аллеи'
    });
    setIsCreateModalOpen(true);
  };

  const handleSaveNewZoneModal = () => {
    if (!pendingCoords) return;

    const centerLat = pendingCoords.reduce((acc, curr) => acc + curr[1], 0) / pendingCoords.length;
    const centerLng = pendingCoords.reduce((acc, curr) => acc + curr[0], 0) / pendingCoords.length;

    const colorMap = { park: '#22c55e', forest: '#15803d', problem: '#ef4444', zone: '#0284c7' };

    const newZone: ZoneData = {
      id: 'z_custom_' + Date.now(),
      name: createForm.name || 'Новая зона',
      category: newZoneCategory,
      color: colorMap[newZoneCategory],
      coordinates: pendingCoords,
      details: {
        trees: Number(createForm.trees) || 0,
        benches: Number(createForm.benches) || 0,
        bins: Number(createForm.bins) || 0,
        ph: createForm.ph,
        soilType: createForm.soilType,
        attractions: createForm.attractions,
        desc: createForm.desc
      }
    };

    setZones([...zones, newZone]);
    setSelectedZone(newZone);
    setFlyCoords([centerLng, centerLat]);
    setIsCreateModalOpen(false);
    setPendingCoords(null);

    if (newZoneCategory === 'park') setActiveTab('park_detail');
    else if (newZoneCategory === 'forest') setActiveTab('forest_detail');
    else if (newZoneCategory === 'problem') setActiveTab('problem_detail');
    else setActiveTab('zone_detail');
  };

  const handleSaveEditModal = () => {
    if (!editForm) return;

    setZones((prevZones) =>
      prevZones.map((z) => {
        if (z.id === editForm.id) {
          return {
            ...z,
            name: editForm.name,
            details: {
              ...z.details,
              trees: Number(editForm.trees),
              benches: Number(editForm.benches),
              bins: Number(editForm.bins),
              ph: editForm.ph,
              soilType: editForm.soilType,
              attractions: editForm.attractions,
              desc: editForm.desc
            }
          };
        }
        return z;
      })
    );

    if (selectedZone && selectedZone.id === editForm.id) {
      setSelectedZone({
        ...selectedZone,
        name: editForm.name,
        details: {
          ...selectedZone.details,
          trees: Number(editForm.trees),
          benches: Number(editForm.benches),
          bins: Number(editForm.bins),
          ph: editForm.ph,
          soilType: editForm.soilType,
          attractions: editForm.attractions,
          desc: editForm.desc
        }
      });
    }

    setIsEditModalOpen(false);
  };

  const handleZoneCoordinatesUpdated = (zoneId: string, newCoords: [number, number][]) => {
    setZones((prev) =>
      prev.map((z) => {
        if (z.id === zoneId) {
          return { ...z, coordinates: newCoords };
        }
        return z;
      })
    );
  };

  const placedTreesCount = placedItems.filter((i) => i.type !== 'bench' && i.type !== 'bin').length;
  const placedBenchesCount = placedItems.filter((i) => i.type === 'bench').length;
  const placedBinsCount = placedItems.filter((i) => i.type === 'bin').length;

  const handleDeleteItem = (itemId: string) => {
    setPlacedItems((prev) => prev.filter((i) => i.id !== itemId));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'Segoe UI, Arial, sans-serif', backgroundColor: '#f8fafc' }}>
      <header style={{ height: '56px', backgroundColor: '#ffffff', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '20px' }}>🌿</span>
          <h1 style={{ margin: 0, fontSize: '18px', color: '#0f172a', fontWeight: 'bold' }}>GreenPavlodar AI Engine</h1>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleAIScanMap}
            style={{ backgroundColor: '#8b5cf6', color: '#ffffff', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}
          >
            🤖 ИИ-Сканирование карты
          </button>
          <button
            onClick={() => {
              setIsEditorOpen(!isEditorOpen);
              setEditingZoneId(null);
            }}
            style={{ backgroundColor: isEditorOpen ? '#dc2626' : '#16a34a', color: '#ffffff', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}
          >
            {isEditorOpen ? '❌ Закрыть редактор' : '✏️ Изменить данные'}
          </button>
        </div>
      </header>

      {aiScanStatus && (
        <div style={{ backgroundColor: '#f3e8ff', color: '#6b21a8', padding: '10px 20px', fontWeight: 'bold', fontSize: '13px', borderBottom: '1px solid #d8b4fe' }}>
          {aiScanStatus}
        </div>
      )}

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ flex: 1, padding: '12px' }}>
          <PavlodarMap
            selectedTool={selectedToolId}
            activeItemData={activeToolData}
            placedItems={placedItems}
            onItemPlaced={(item) => setPlacedItems([...placedItems, item])}
            onItemDeleted={handleDeleteItem}
            isDrawingMode={isDrawingMode}
            onPolygonCreated={handlePolygonCreated}
            flyToCoords={flyCoords}
            allZones={zones}
            selectedZoneId={selectedZone?.id || null}
            onZoneSelect={(z) => {
              setSelectedZone(z);
              setFlyCoords(z.coordinates[0]);
              if (z.category === 'park') setActiveTab('park_detail');
              else if (z.category === 'forest') setActiveTab('forest_detail');
              else if (z.category === 'problem') setActiveTab('problem_detail');
              else setActiveTab('zone_detail');
            }}
            activeCategory={getActiveCategory()}
            editingZoneId={editingZoneId}
            onZoneCoordinatesUpdated={handleZoneCoordinatesUpdated}
          />
        </div>

        <div style={{ width: '370px', backgroundColor: '#ffffff', borderLeft: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          {isEditorOpen && (
            <div style={{ padding: '14px', backgroundColor: '#f0fdf4', borderBottom: '2px solid #bbf7d0' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#166534' }}>🛠️ Редактор и ИИ-генерация моделей</h3>

              <div style={{ marginBottom: '10px' }}>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#374151' }}>ИИ-создание модели (Сакура, Дуб, Фонтан...):</label>
                <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                  <input
                    type="text"
                    placeholder="Например: Сакура, Дуб, Детская площадка..."
                    value={newModelInput}
                    onChange={(e) => setNewModelInput(e.target.value)}
                    style={{ flex: 1, padding: '5px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                  />
                  <button onClick={handleCreateAIModel} style={{ backgroundColor: '#16a34a', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold' }}>Создать</button>
                </div>
              </div>

              <div style={{ marginBottom: '10px' }}>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#374151' }}>Выберите объект для клика по карте:</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                  {treePalette.map((tool) => (
                    <button
                      key={tool.id}
                      onClick={() => setSelectedToolId(selectedToolId === tool.id ? null : tool.id)}
                      style={{
                        padding: '5px 8px',
                        borderRadius: '4px',
                        border: selectedToolId === tool.id ? '2px solid #16a34a' : '1px solid #cbd5e1',
                        backgroundColor: selectedToolId === tool.id ? '#dcfce7' : '#ffffff',
                        fontSize: '11px',
                        cursor: 'pointer'
                      }}
                    >
                      {tool.icon} {tool.name}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: '8px', marginTop: '8px' }}>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#374151' }}>Создание новой зоны на карте:</label>
                <div style={{ display: 'flex', gap: '6px', margin: '4px 0' }}>
                  <select
                    value={newZoneCategory}
                    onChange={(e: any) => setNewZoneCategory(e.target.value)}
                    style={{ padding: '5px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '11px' }}
                  >
                    <option value="park">Тип: Парк</option>
                    <option value="forest">Тип: Лесной массив</option>
                    <option value="problem">Тип: Проблемная зона</option>
                    <option value="zone">Тип: Зона города</option>
                  </select>
                  <button
                    onClick={() => {
                      setSelectedToolId(null);
                      setEditingZoneId(null);
                      setIsDrawingMode(!isDrawingMode);
                    }}
                    style={{ flex: 1, backgroundColor: isDrawingMode ? '#e11d48' : '#0284c7', color: '#fff', border: 'none', padding: '6px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    {isDrawingMode ? 'Отмена' : '📐 Нарисовать зону'}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div style={{ padding: '16px' }}>
            {activeTab !== 'main' && (
              <button
                onClick={() => {
                  setActiveTab('main');
                  setSelectedZone(null);
                  setEditingZoneId(null);
                }}
                style={{ backgroundColor: '#f1f5f9', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', marginBottom: '12px', fontWeight: 'bold' }}
              >
                ← Назад в главное меню
              </button>
            )}

            {activeTab === 'main' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                  onClick={() => setActiveTab('parks')}
                  style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', fontWeight: 'bold', cursor: 'pointer', textAlign: 'left', color: '#0f172a' }}
                >
                  🌳 Парки
                </button>

                <button
                  onClick={() => setActiveTab('forests')}
                  style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', fontWeight: 'bold', cursor: 'pointer', textAlign: 'left', color: '#0f172a' }}
                >
                  🌲 Лесные массивы
                </button>

                <button
                  onClick={() => setActiveTab('problems')}
                  style={{ padding: '12px', backgroundColor: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca', fontWeight: 'bold', cursor: 'pointer', textAlign: 'left', color: '#991b1b' }}
                >
                  🚨 Проблемные зоны
                </button>

                <button
                  onClick={() => setActiveTab('zones')}
                  style={{ padding: '12px', backgroundColor: '#f0f9ff', borderRadius: '8px', border: '1px solid #bae6fd', fontWeight: 'bold', cursor: 'pointer', textAlign: 'left', color: '#075985' }}
                >
                  🗺️ Описание зон города
                </button>
              </div>
            )}

            {/* СПИСОК ПАРКОВ */}
            {activeTab === 'parks' && (
              <div>
                <h3 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>🌳 Парки Павлодара</h3>
                {zones.filter((z) => z.category === 'park').map((park) => (
                  <div
                    key={park.id}
                    onClick={() => {
                      setSelectedZone(park);
                      setFlyCoords(park.coordinates[0]);
                      setActiveTab('park_detail');
                    }}
                    style={{ padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0', marginBottom: '6px', cursor: 'pointer', backgroundColor: '#ffffff' }}
                  >
                    <div style={{ fontWeight: 'bold', fontSize: '13px' }}>{park.name}</div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>~{(park.details?.trees || 0) + placedTreesCount} деревьев</div>
                  </div>
                ))}
              </div>
            )}

            {/* ДЕТАЛИ ПАРКА */}
            {activeTab === 'park_detail' && selectedZone && (
              <div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
                  <h3 style={{ margin: 0, color: '#16a34a', fontSize: '16px' }}>🌳 {selectedZone.name}</h3>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => { setEditForm({ id: selectedZone.id, name: selectedZone.name, ...selectedZone.details }); setIsEditModalOpen(true); }} style={{ backgroundColor: '#0284c7', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}>
                      ✏️ Редактировать текст
                    </button>
                    <button
                      onClick={() => setEditingZoneId(editingZoneId === selectedZone.id ? null : selectedZone.id)}
                      style={{ backgroundColor: editingZoneId === selectedZone.id ? '#dc2626' : '#d97706', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                      {editingZoneId === selectedZone.id ? '❌ Готово' : '📐 Изменить границы на карте'}
                    </button>
                  </div>
                </div>
                <p style={{ fontSize: '12px', color: '#475569', marginBottom: '10px' }}>{selectedZone.details?.desc}</p>
                <div style={{ backgroundColor: '#f8fafc', padding: '10px', borderRadius: '6px', fontSize: '12px', lineHeight: '1.6' }}>
                  <div><strong>🌳 Деревьев в парке:</strong> {(selectedZone.details?.trees || 0) + placedTreesCount} шт.</div>
                  <div><strong>🎡 Достопримечательности:</strong> {selectedZone.details?.attractions || 'Отсутствуют'}</div>
                  <div><strong>🪑 Скамеек:</strong> {(selectedZone.details?.benches || 0) + placedBenchesCount} шт.</div>
                  <div><strong>🗑️ Урн:</strong> {(selectedZone.details?.bins || 0) + placedBinsCount} шт.</div>
                </div>
              </div>
            )}

            {/* СПИСОК ЛЕСНЫХ МАССИВОВ */}
            {activeTab === 'forests' && (
              <div>
                <h3 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>🌲 Лесные массивы</h3>
                {zones.filter((z) => z.category === 'forest').map((forest) => (
                  <div
                    key={forest.id}
                    onClick={() => {
                      setSelectedZone(forest);
                      setFlyCoords(forest.coordinates[0]);
                      setActiveTab('forest_detail');
                    }}
                    style={{ padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0', marginBottom: '6px', cursor: 'pointer' }}
                  >
                    <div style={{ fontWeight: 'bold', fontSize: '13px' }}>{forest.name}</div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Деревьев: ~{(forest.details?.trees || 0) + placedTreesCount} шт.</div>
                  </div>
                ))}
              </div>
            )}

            {/* ДЕТАЛИ ЛЕСНОГО МАССИВА */}
            {activeTab === 'forest_detail' && selectedZone && (
              <div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
                  <h3 style={{ margin: 0, color: '#047857', fontSize: '16px' }}>🌲 {selectedZone.name}</h3>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => { setEditForm({ id: selectedZone.id, name: selectedZone.name, ...selectedZone.details }); setIsEditModalOpen(true); }} style={{ backgroundColor: '#0284c7', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}>
                      ✏️ Редактировать текст
                    </button>
                    <button
                      onClick={() => setEditingZoneId(editingZoneId === selectedZone.id ? null : selectedZone.id)}
                      style={{ backgroundColor: editingZoneId === selectedZone.id ? '#dc2626' : '#d97706', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                      {editingZoneId === selectedZone.id ? '❌ Готово' : '📐 Изменить границы на карте'}
                    </button>
                  </div>
                </div>
                <p style={{ fontSize: '12px', color: '#475569', marginBottom: '10px' }}>{selectedZone.details?.desc}</p>
                <div style={{ backgroundColor: '#f8fafc', padding: '10px', borderRadius: '6px', fontSize: '12px', lineHeight: '1.6' }}>
                  <div><strong>🌲 Всего деревьев:</strong> {(selectedZone.details?.trees || 0) + placedTreesCount} шт.</div>
                  <div><strong>🌿 Породы:</strong> {selectedZone.details?.attractions || 'Хвойно-лиственные'}</div>
                  <div><strong>🪑 Скамеек:</strong> {(selectedZone.details?.benches || 0) + placedBenchesCount} шт.</div>
                  <div><strong>🗑️ Урн:</strong> {(selectedZone.details?.bins || 0) + placedBinsCount} шт.</div>
                </div>
              </div>
            )}

            {/* ПРОБЛЕМНЫЕ ЗОНЫ */}
            {activeTab === 'problems' && (
              <div>
                <h3 style={{ margin: '0 0 10px 0', color: '#dc2626', fontSize: '16px' }}>🚨 Проблемные зоны</h3>
                {zones.filter((z) => z.category === 'problem').map((prob) => (
                  <div
                    key={prob.id}
                    onClick={() => {
                      setSelectedZone(prob);
                      setFlyCoords(prob.coordinates[0]);
                      setActiveTab('problem_detail');
                    }}
                    style={{ padding: '10px', borderRadius: '6px', border: '1px solid #fecaca', backgroundColor: '#fef2f2', marginBottom: '6px', cursor: 'pointer' }}
                  >
                    <div style={{ fontWeight: 'bold', color: '#991b1b', fontSize: '13px' }}>{prob.name}</div>
                    <div style={{ fontSize: '11px', color: '#7f1d1d' }}>Дефицит: {prob.details?.missingTrees || 100} деревьев</div>
                  </div>
                ))}
              </div>
            )}

            {/* ДЕТАЛИ ПРОБЛЕМНОЙ ЗОНЫ */}
            {activeTab === 'problem_detail' && selectedZone && (
              <div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
                  <h3 style={{ margin: 0, color: '#dc2626', fontSize: '16px' }}>🚨 {selectedZone.name}</h3>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => { setEditForm({ id: selectedZone.id, name: selectedZone.name, ...selectedZone.details }); setIsEditModalOpen(true); }} style={{ backgroundColor: '#0284c7', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}>
                      ✏️ Редактировать текст
                    </button>
                    <button
                      onClick={() => setEditingZoneId(editingZoneId === selectedZone.id ? null : selectedZone.id)}
                      style={{ backgroundColor: editingZoneId === selectedZone.id ? '#dc2626' : '#d97706', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                      {editingZoneId === selectedZone.id ? '❌ Готово' : '📐 Изменить границы на карте'}
                    </button>
                  </div>
                </div>
                <p style={{ fontSize: '12px', color: '#475569', marginBottom: '10px' }}>{selectedZone.details?.desc}</p>
                <div style={{ backgroundColor: '#fff5f5', border: '1px solid #fed7d7', padding: '10px', borderRadius: '6px', fontSize: '12px', lineHeight: '1.6' }}>
                  <div><strong>🌳 Растёт деревьев:</strong> {(selectedZone.details?.trees || 0) + placedTreesCount} шт.</div>
                  <div><strong>⚠️ Не хватает:</strong> {selectedZone.details?.missingTrees || 150} шт.</div>
                  <div><strong>🌱 Подбор ИИ:</strong> {selectedZone.details?.bestSpecies || 'Вяз, Акация'}</div>
                  <div><strong>💰 Необходимый бюджет:</strong> <strong style={{ color: '#dc2626' }}>{selectedZone.details?.cost || '2 500 000 ₸'}</strong></div>
                </div>
              </div>
            )}

            {/* ОПИСАНИЕ ЗОН ГОРОДА */}
            {activeTab === 'zones' && (
              <div>
                <h3 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>🗺️ Описание зон города</h3>
                {zones.filter((z) => z.category === 'zone').map((z) => (
                  <div
                    key={z.id}
                    onClick={() => {
                      setSelectedZone(z);
                      setFlyCoords(z.coordinates[0]);
                      setActiveTab('zone_detail');
                    }}
                    style={{ padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0', marginBottom: '6px', cursor: 'pointer' }}
                  >
                    <div style={{ fontWeight: 'bold', fontSize: '13px' }}>{z.name}</div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Почва: {z.details?.soilType || 'Каштановая'}</div>
                  </div>
                ))}
              </div>
            )}

            {/* ДЕТАЛИ ЗОНЫ ГОРОДА */}
            {activeTab === 'zone_detail' && selectedZone && (
              <div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
                  <h3 style={{ margin: 0, fontSize: '16px' }}>🗺️ {selectedZone.name}</h3>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => { setEditForm({ id: selectedZone.id, name: selectedZone.name, ...selectedZone.details }); setIsEditModalOpen(true); }} style={{ backgroundColor: '#0284c7', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}>
                      ✏️ Редактировать текст
                    </button>
                    <button
                      onClick={() => setEditingZoneId(editingZoneId === selectedZone.id ? null : selectedZone.id)}
                      style={{ backgroundColor: editingZoneId === selectedZone.id ? '#dc2626' : '#d97706', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                      {editingZoneId === selectedZone.id ? '❌ Готово' : '📐 Изменить границы на карте'}
                    </button>
                  </div>
                </div>
                <div style={{ backgroundColor: '#f8fafc', padding: '10px', borderRadius: '6px', fontSize: '12px', lineHeight: '1.6' }}>
                  <div><strong>🧪 Кислотность (pH):</strong> {selectedZone.details?.ph || '7.2'}</div>
                  <div><strong>🌱 Тип почвы:</strong> {selectedZone.details?.soilType || 'Каштановая'}</div>
                  <div><strong>🌳 Деревьев в зоне:</strong> {(selectedZone.details?.trees || 0) + placedTreesCount} шт.</div>
                  <div><strong>🪑 Скамеек:</strong> {(selectedZone.details?.benches || 0) + placedBenchesCount} шт.</div>
                  <div><strong>🗑️ Урн:</strong> {(selectedZone.details?.bins || 0) + placedBinsCount} шт.</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Модальное окно СОЗДАНИЯ новой зоны */}
      {isCreateModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '8px', width: '420px', padding: '20px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <h3 style={{ marginTop: 0, color: '#0f172a' }}>📐 Ручной ввод параметров зоны</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
              <label><strong>Название:</strong></label>
              <input type="text" value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} style={{ padding: '6px', border: '1px solid #cbd5e1', borderRadius: '4px' }} />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                <div>
                  <label><strong>Деревьев:</strong></label>
                  <input type="number" value={createForm.trees} onChange={(e) => setCreateForm({ ...createForm, trees: Number(e.target.value) })} style={{ width: '100%', padding: '6px', border: '1px solid #cbd5e1', borderRadius: '4px' }} />
                </div>
                <div>
                  <label><strong>Скамеек:</strong></label>
                  <input type="number" value={createForm.benches} onChange={(e) => setCreateForm({ ...createForm, benches: Number(e.target.value) })} style={{ width: '100%', padding: '6px', border: '1px solid #cbd5e1', borderRadius: '4px' }} />
                </div>
                <div>
                  <label><strong>Урн:</strong></label>
                  <input type="number" value={createForm.bins} onChange={(e) => setCreateForm({ ...createForm, bins: Number(e.target.value) })} style={{ width: '100%', padding: '6px', border: '1px solid #cbd5e1', borderRadius: '4px' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label><strong>pH Почвы:</strong></label>
                  <input type="text" value={createForm.ph} onChange={(e) => setCreateForm({ ...createForm, ph: e.target.value })} style={{ width: '100%', padding: '6px', border: '1px solid #cbd5e1', borderRadius: '4px' }} />
                </div>
                <div>
                  <label><strong>Тип почвы:</strong></label>
                  <input type="text" value={createForm.soilType} onChange={(e) => setCreateForm({ ...createForm, soilType: e.target.value })} style={{ width: '100%', padding: '6px', border: '1px solid #cbd5e1', borderRadius: '4px' }} />
                </div>
              </div>

              <label><strong>Описание:</strong></label>
              <textarea value={createForm.desc} onChange={(e) => setCreateForm({ ...createForm, desc: e.target.value })} style={{ padding: '6px', border: '1px solid #cbd5e1', borderRadius: '4px', height: '60px' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <button onClick={() => setIsCreateModalOpen(false)} style={{ backgroundColor: '#64748b', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>Отмена</button>
              <button onClick={handleSaveNewZoneModal} style={{ backgroundColor: '#16a34a', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Сохранить в ГИС</button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно РЕДАКТИРОВАНИЯ существующей зоны */}
      {isEditModalOpen && editForm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '8px', width: '420px', padding: '20px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <h3 style={{ marginTop: 0, color: '#0f172a' }}>✏️ Редактирование параметров</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
              <label><strong>Наименование:</strong></label>
              <input type="text" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} style={{ padding: '6px', border: '1px solid #cbd5e1', borderRadius: '4px' }} />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                <div>
                  <label><strong>Деревьев:</strong></label>
                  <input type="number" value={editForm.trees} onChange={(e) => setEditForm({ ...editForm, trees: e.target.value })} style={{ width: '100%', padding: '6px', border: '1px solid #cbd5e1', borderRadius: '4px' }} />
                </div>
                <div>
                  <label><strong>Скамеек:</strong></label>
                  <input type="number" value={editForm.benches} onChange={(e) => setEditForm({ ...editForm, benches: e.target.value })} style={{ width: '100%', padding: '6px', border: '1px solid #cbd5e1', borderRadius: '4px' }} />
                </div>
                <div>
                  <label><strong>Урн:</strong></label>
                  <input type="number" value={editForm.bins} onChange={(e) => setEditForm({ ...editForm, bins: e.target.value })} style={{ width: '100%', padding: '6px', border: '1px solid #cbd5e1', borderRadius: '4px' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label><strong>pH Почвы:</strong></label>
                  <input type="text" value={editForm.ph} onChange={(e) => setEditForm({ ...editForm, ph: e.target.value })} style={{ width: '100%', padding: '6px', border: '1px solid #cbd5e1', borderRadius: '4px' }} />
                </div>
                <div>
                  <label><strong>Тип почвы:</strong></label>
                  <input type="text" value={editForm.soilType} onChange={(e) => setEditForm({ ...editForm, soilType: e.target.value })} style={{ width: '100%', padding: '6px', border: '1px solid #cbd5e1', borderRadius: '4px' }} />
                </div>
              </div>

              <label><strong>Описание:</strong></label>
              <textarea value={editForm.desc} onChange={(e) => setEditForm({ ...editForm, desc: e.target.value })} style={{ padding: '6px', border: '1px solid #cbd5e1', borderRadius: '4px', height: '60px' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <button onClick={() => setIsEditModalOpen(false)} style={{ backgroundColor: '#64748b', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>Отмена</button>
              <button onClick={handleSaveEditModal} style={{ backgroundColor: '#0284c7', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Сохранить изменения</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(<App />);