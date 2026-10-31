"""Геометрия без внешних зависимостей. Координаты везде (долгота, широта)."""
import math
from typing import List, Sequence, Tuple

EARTH_RADIUS_M = 6371008.8
Point = Tuple[float, float]


def validate_ring(ring: Sequence[Sequence[float]]) -> None:
    if len(ring) < 4:
        raise ValueError("Контур должен содержать минимум 3 вершины и быть замкнутым")
    if tuple(ring[0]) != tuple(ring[-1]):
        raise ValueError("Контур не замкнут: первая и последняя точки должны совпадать")
    for lng, lat in ring:
        if not (-180 <= lng <= 180 and -90 <= lat <= 90):
            raise ValueError("Координаты вне допустимого диапазона")


def centroid(ring: Sequence[Point]) -> Point:
    pts = ring[:-1] if tuple(ring[0]) == tuple(ring[-1]) else ring
    return (sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts))


def polygon_area_sqm(ring: Sequence[Point]) -> float:
    """Площадь контура в м². Локальная равнопромежуточная проекция вокруг центра —
    для городских масштабов погрешность пренебрежимо мала."""
    validate_ring(ring)
    lng0, lat0 = centroid(ring)
    ky = EARTH_RADIUS_M * math.pi / 180.0
    kx = ky * math.cos(math.radians(lat0))
    pts = [((lng - lng0) * kx, (lat - lat0) * ky) for lng, lat in ring]
    s = 0.0
    for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
        s += x1 * y2 - x2 * y1
    return abs(s) / 2.0


def point_in_polygon(lng: float, lat: float, ring: Sequence[Point]) -> bool:
    """Алгоритм луча. Точки точно на границе могут попасть в любую сторону."""
    inside = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if (yi > lat) != (yj > lat) and lng < (xj - xi) * (lat - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def _to_xy(ring: Sequence[Point], lng0: float, lat0: float) -> List[Point]:
    ky = EARTH_RADIUS_M * math.pi / 180.0
    kx = ky * math.cos(math.radians(lat0))
    return [((lng - lng0) * kx, (lat - lat0) * ky) for lng, lat in ring]


def _orient(a: Point, b: Point, c: Point) -> float:
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])


def _segments_cross(p1: Point, p2: Point, p3: Point, p4: Point) -> bool:
    d1, d2 = _orient(p3, p4, p1), _orient(p3, p4, p2)
    d3, d4 = _orient(p1, p2, p3), _orient(p1, p2, p4)
    return ((d1 > 0) != (d2 > 0)) and ((d3 > 0) != (d4 > 0)) and d1 * d2 != 0 and d3 * d4 != 0


def _point_segment_dist(p: Point, a: Point, b: Point) -> float:
    dx, dy = b[0] - a[0], b[1] - a[1]
    seg2 = dx * dx + dy * dy
    t = 0.0 if seg2 == 0 else max(0.0, min(1.0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / seg2))
    return math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy))


def polygon_distance_m(a: Sequence[Point], b: Sequence[Point]) -> float:
    """Кратчайшее расстояние между двумя контурами в метрах (0, если пересекаются, касаются
    или один лежит внутри другого)."""
    validate_ring(a)
    validate_ring(b)
    both = list(a) + list(b)
    lng0 = sum(p[0] for p in both) / len(both)
    lat0 = sum(p[1] for p in both) / len(both)
    pa, pb = _to_xy(a, lng0, lat0), _to_xy(b, lng0, lat0)

    if any(point_in_polygon(x, y, pb) for x, y in pa) or any(point_in_polygon(x, y, pa) for x, y in pb):
        return 0.0
    best = math.inf
    for i in range(len(pa) - 1):
        for j in range(len(pb) - 1):
            if _segments_cross(pa[i], pa[i + 1], pb[j], pb[j + 1]):
                return 0.0
    for p in pa:
        for j in range(len(pb) - 1):
            best = min(best, _point_segment_dist(p, pb[j], pb[j + 1]))
    for p in pb:
        for i in range(len(pa) - 1):
            best = min(best, _point_segment_dist(p, pa[i], pa[i + 1]))
    return best
