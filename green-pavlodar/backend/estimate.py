"""Смета посадки и оценка экологического эффекта."""
from typing import Iterable, Tuple

from config import CostModel
from plants import Plant, get_plant


def calculate_estimate(area_sqm: float, items: Iterable[Tuple[int, int]], care_years: int = 3,
                       cost: CostModel = CostModel()) -> dict:
    """items — пары (plant_id, count). Неизвестный plant_id — ValueError."""
    material = 0.0
    co2_yr = 0.0
    for plant_id, count in items:
        plant: Plant = get_plant(plant_id)
        if plant is None:
            raise ValueError(f"Неизвестный вид растения: {plant_id}")
        material += count * plant.unit_cost
        co2_yr += count * plant.co2_yr

    prep = area_sqm * cost.soil_prep_per_sqm
    work = material * cost.planting_work_share
    care = area_sqm * cost.care_per_sqm_year * care_years
    reserve = material * cost.survival_reserve_share
    total = material + prep + work + care + reserve

    return {
        "summary_kzt": round(total, 2),
        "breakdown": {
            "planting_materials_kzt": round(material, 2),
            "soil_preparation_kzt": round(prep, 2),
            "planting_works_kzt": round(work, 2),
            "care_maintenance_kzt": round(care, 2),
            "risk_reserve_kzt": round(reserve, 2),
        },
        "ecological_effect_5yr": {
            "co2_absorption_tons": round(co2_yr * 5 / 1000.0, 2),
            "dust_reduction_kg": round(co2_yr * cost.dust_kg_per_co2_kg, 1),
        },
    }
