import { sanitizeState } from './items';

test('данные старых версий чинятся: добавляются цвет, значок, вид', () => {
  const broken: any = {
    zones: [{ id: 'z', name: 'Z', category: 'park', coordinates: [[0, 0], [1, 0], [1, 1], [0, 0]], details: { trees: '100' } },
            { id: 'bad', name: 'B', category: 'park', coordinates: [[0, 0]], details: {} }],
    placed_items: [{ id: 'a', type: 'bench', lat: 52.2, lng: 76.9 }, { id: 'b', type: 'oak', lat: null, lng: 1 }],
    palette: [{ id: 't', name: 'Дуб', type: 'oak' }],
  };
  const r = sanitizeState(broken);
  expect(r.zones.length).toBe(1);
  expect(r.zones[0].color).toBe('#22c55e');
  expect(r.zones[0].details.trees).toBe(100);
  expect(r.placed_items.length).toBe(1);
  expect(r.placed_items[0]).toEqual({ id: 'a', type: 'bench', kind: 'bench', name: 'bench', icon: '📍', color: '#16a34a', lat: 52.2, lng: 76.9 });
  expect(r.palette[0].kind).toBe('tree');
  expect(r.palette[0].icon).toBe('📍');
});
