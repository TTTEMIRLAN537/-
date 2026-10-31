import { countPlacedInZone, pointInPolygon } from './geo';
import { PlacedItem, ZoneData } from './types';

const square: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];
const zone: ZoneData = { id: 'a', name: 'A', category: 'park', color: '#000', coordinates: square, details: { trees: 5, benches: 0, bins: 0 } };
const item = (kind: PlacedItem['kind'], lng: number, lat: number): PlacedItem =>
  ({ id: kind + lng, type: kind, kind, name: kind, lat, lng, icon: '', color: '' });

test('pointInPolygon', () => {
  expect(pointInPolygon(5, 5, square)).toBe(true);
  expect(pointInPolygon(15, 5, square)).toBe(false);
});

test('объекты считаются только внутри своей зоны и по видам', () => {
  const items = [item('tree', 5, 5), item('tree', 50, 5), item('bench', 1, 1), item('other', 2, 2), item('shrub', 3, 3)];
  expect(countPlacedInZone(zone, items)).toEqual({ trees: 1, shrubs: 1, benches: 1, bins: 0 });
});
