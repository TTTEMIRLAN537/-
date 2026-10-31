"""Расчётный анализ озеленения зон: площадь, плотность, дефицит, план посадки и смета.

Это детерминированные расчёты по геометрии и справочнику — без «нейросетей».
Спутниковых данных (NDVI) здесь нет и они не имитируются.
"""
import math
import re
from typing import Dict, List, Optional

import config
import plants as plants_mod
from config import CostModel
from estimate import calculate_estimate
from geo import point_in_polygon, polygon_area_sqm, polygon_distance_m

_NON_TREE_KINDS = {
    "bench": "bench", "bin": "bin", "shrub": "shrub",
    "monument": "other", "fountain": "other", "playground": "other", "light": "other",
}


def kind_from_type(item_type: str) -> str:
    return _NON_TREE_KINDS.get(item_type, "tree")


def parse_ph(value) -> Optional[float]:
    """'7.2 (Слабощелочная)' -> 7.2. Нераспознанное или вне 0..14 -> None."""
    if value is None:
        return None
    m = re.search(r"\d+(?:[.,]\d+)?", str(value))
    if not m:
        return None
    ph = float(m.group(0).replace(",", "."))
    return ph if 0 <= ph <= 14 else None


def _placed_in_zone(ring, items: List[dict]) -> Dict[str, int]:
    counts = {"tree": 0, "shrub": 0, "bench": 0, "bin": 0, "other": 0}
    for it in items:
        if point_in_polygon(it["lng"], it["lat"], ring):
            counts[it.get("kind") or kind_from_type(it.get("type", ""))] += 1
    return counts


def nearest_green_zone(zone: dict, all_zones: List[dict], radius_m: float) -> Optional[dict]:
    """Ближайший парк или лесной массив не дальше radius_m от зоны (или None)."""
    ring = [tuple(p) for p in zone["coordinates"]]
    best = None
    for other in all_zones:
        if other["id"] == zone["id"] or other["category"] not in ("park", "forest"):
            continue
        try:
            d = polygon_distance_m(ring, [tuple(p) for p in other["coordinates"]])
        except ValueError:
            continue  # у соседней зоны некорректный контур — пропускаем её
        if d <= radius_m and (best is None or d < best["distance_m"]):
            best = {"zone_id": other["id"], "name": other["name"], "category": other["category"],
                    "distance_m": round(d)}
    return best


def analyze_zone(zone: dict, placed_items: List[dict], cost: Optional[CostModel] = None,
                 targets: Optional[dict] = None, all_zones: Optional[List[dict]] = None,
                 green_radius_m: Optional[float] = None) -> dict:
    cost = cost or CostModel.from_env()
    targets = targets if targets is not None else config.target_density_per_ha()
    radius = green_radius_m if green_radius_m is not None else config.problem_green_radius_m()
    ring = [tuple(p) for p in zone["coordinates"]]
    details = zone.get("details") or {}

    area_sqm = polygon_area_sqm(ring)
    area_ha = area_sqm / 10_000.0
    placed = _placed_in_zone(ring, placed_items)
    trees_registered = int(details.get("trees") or 0)
    trees_total = trees_registered + placed["tree"]
    density = trees_total / area_ha if area_ha > 0 else 0.0

    assumptions: List[str] = []
    target = targets.get(zone["category"])
    is_problem: Optional[bool] = None
    green_neighbor = None
    if zone["category"] == "problem" and all_zones is not None:
        green_neighbor = nearest_green_zone(zone, all_zones, radius)
        is_problem = green_neighbor is None
        if green_neighbor:
            target = None  # зона не считается проблемной — дефицит и смета не рассчитываются
    deficit = ratio = None
    recs: List[dict] = []
    plan: List[dict] = []
    estimate = None

    if target is not None:
        target_total = target * area_ha
        deficit = max(0, math.ceil(target_total - trees_total))
        ratio = round(deficit / target_total, 3) if target_total > 0 else 0.0
        assumptions.append(
            f"Целевая плотность {target:g} деревьев/га — рабочий параметр прототипа, а не официальный норматив."
        )

        ph = parse_ph(details.get("ph"))
        salinity = details.get("salinity")
        if ph is None:
            assumptions.append("pH не задан или не распознан — при подборе видов не учитывался.")
        if salinity is None:
            assumptions.append("Засоление почвы не задано — при подборе видов не учитывалось.")

        recs = plants_mod.recommend(
            ph, salinity,
            industrial=bool(details.get("isIndustrial")),
            near_sensitive=bool(details.get("nearSensitive")),
        )
        if deficit > 0:
            top = [r for r in recs if r["score"] >= 50][:2]
            if not top:
                assumptions.append("В справочнике нет видов, подходящих под условия зоны.")
            else:
                base, rest = divmod(deficit, len(top))
                for i, r in enumerate(top):
                    plan.append({"plant_id": r["plant_id"], "name_ru": r["name_ru"],
                                 "count": base + (1 if i < rest else 0)})
                planting_area = sum(p["count"] * next(r["crown_sqm"] for r in top if r["plant_id"] == p["plant_id"])
                                    for p in plan)
                estimate = calculate_estimate(planting_area, [(p["plant_id"], p["count"]) for p in plan], 3, cost)
                assumptions.append(
                    "Смета считается на площадь, занятую кронами посаженных деревьев; расценки — рабочие допущения."
                )

    return {
        "is_problem": is_problem,
        "green_neighbor": green_neighbor,
        "green_radius_m": radius,
        "zone_id": zone["id"],
        "name": zone["name"],
        "category": zone["category"],
        "area_sqm": round(area_sqm, 1),
        "area_ha": round(area_ha, 2),
        "trees_registered": trees_registered,
        "trees_placed": placed["tree"],
        "shrubs_placed": placed["shrub"],
        "trees_total": trees_total,
        "density_per_ha": round(density, 1),
        "target_density_per_ha": target,
        "deficit_trees": deficit,
        "deficit_ratio": ratio,
        "recommendations": [{k: r[k] for k in ("plant_id", "name_ru", "score", "reasoning")} for r in recs[:3]],
        "planting_plan": plan,
        "estimate": estimate,
        "assumptions": assumptions,
    }


def scan_zones(zones: List[dict], placed_items: List[dict], cost: Optional[CostModel] = None,
               targets: Optional[dict] = None) -> dict:
    """Анализ всех зон. Результаты: сначала зоны с дефицитом (по доле дефицита), затем остальные."""
    results, errors = [], []
    for z in zones:
        try:
            results.append(analyze_zone(z, placed_items, cost, targets, all_zones=zones))
        except ValueError as e:
            errors.append({"zone_id": z.get("id"), "error": str(e)})
    results.sort(key=lambda a: (-(a["deficit_ratio"] or 0), -(a["deficit_trees"] or 0), a["zone_id"]))
    return {"analyzed": len(results), "results": results, "errors": errors}
