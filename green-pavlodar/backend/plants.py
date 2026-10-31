"""Справочник растений и расчёт пригодности вида для условий зоны."""
import json
import os
from dataclasses import dataclass
from typing import List, Optional, Tuple

DATA_PATH = os.path.join(os.path.dirname(__file__), "data", "plants.json")


@dataclass(frozen=True)
class Plant:
    id: int
    name_ru: str
    type: str
    min_ph: float
    max_ph: float
    max_salinity: float
    drought_res: int
    gas_res: int
    is_allergen: bool
    unit_cost: float
    co2_yr: float
    crown_sqm: float


def load_plants(path: str = DATA_PATH) -> List[Plant]:
    with open(path, encoding="utf-8") as f:
        raw = json.load(f)
    return [Plant(**p) for p in raw["plants"]]


PLANTS: List[Plant] = load_plants()


def get_plant(plant_id: int, plants: Optional[List[Plant]] = None) -> Optional[Plant]:
    return next((p for p in (plants or PLANTS) if p.id == plant_id), None)


def _clamp(x: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, x))


def score_plant(plant: Plant, ph: Optional[float], salinity: Optional[float],
                industrial: bool) -> Tuple[float, List[str]]:
    """Оценка 0–100: взвешенное среднее критериев, применимых к зоне.

    Критерии (0..1): запас по засолению (вес 3, если засоление известно), близость pH к середине
    допустимого диапазона (2, если pH известен), засухоустойчивость (2),
    газоустойчивость (3 для промзоны, иначе 1).
    """
    parts = []  # (вес, значение)
    reasons: List[str] = []

    if salinity is not None:
        margin = plant.max_salinity - salinity
        parts.append((3, _clamp(margin / 2.0)))
        if margin < 1.0:
            reasons.append("Почвы близки к пределу засоления для вида")

    if ph is not None:
        half = (plant.max_ph - plant.min_ph) / 2.0
        mid = plant.min_ph + half
        fit = _clamp(1.0 - abs(ph - mid) / half) if half > 0 else 1.0
        parts.append((2, fit))
        if fit < 0.25:
            reasons.append("pH у границы допустимого диапазона")

    parts.append((2, plant.drought_res / 5.0))
    if plant.drought_res >= 4:
        reasons.append("Засухоустойчив")

    parts.append((3 if industrial else 1, plant.gas_res / 5.0))
    if industrial and plant.gas_res >= 4:
        reasons.append("Высокая устойчивость к выбросам промпредприятий")
    elif industrial and plant.gas_res <= 2:
        reasons.append("Низкая газоустойчивость — для промзоны не лучший выбор")

    total_w = sum(w for w, _ in parts)
    score = 100.0 * sum(w * v for w, v in parts) / total_w
    return round(score, 1), reasons


def recommend(ph: Optional[float], salinity: Optional[float], industrial: bool = False,
              near_sensitive: bool = False, plants: Optional[List[Plant]] = None) -> List[dict]:
    """Виды, прошедшие жёсткие ограничения, по убыванию оценки."""
    out = []
    for p in (plants or PLANTS):
        if near_sensitive and p.is_allergen:
            continue
        if ph is not None and not (p.min_ph <= ph <= p.max_ph):
            continue
        if salinity is not None and salinity > p.max_salinity:
            continue
        score, reasons = score_plant(p, ph, salinity, industrial)
        out.append({
            "plant_id": p.id,
            "name_ru": p.name_ru,
            "score": score,
            "reasoning": "; ".join(reasons) if reasons else "Подходит под заданные условия",
            "crown_sqm": p.crown_sqm,
        })
    return sorted(out, key=lambda r: (-r["score"], r["plant_id"]))


def count_for_area(area_sqm: float, crown_sqm: float, coverage: float = 0.4) -> int:
    """Сколько деревьев одного вида занимает `coverage` площади (проекция крон)."""
    if crown_sqm <= 0:
        return 0
    return max(1, int(area_sqm * coverage / crown_sqm))
