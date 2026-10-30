from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel
from typing import List, Optional
import numpy as np

app = FastAPI(
    title="GreenPavlodar AI - Core Engine",
    version="1.0.0",
    description="Backend API для AI-ассистента озеленения Павлодара"
)

# --- Модели данных ---
class PlantRecommendationRequest(BaseModel):
    zone_id: str
    area_sqm: float
    soil_ph: float
    salinity_ds_m: float
    is_near_school_or_hospital: bool = False
    is_industrial_zone: bool = False

class PlantScore(BaseModel):
    plant_id: int
    name_ru: str
    score: float
    recommended_count: int
    reasoning: str

class EstimateRequest(BaseModel):
    area_sqm: float
    selected_plants: List[dict] # [{"plant_id": 1, "count": 50}]
    care_years: int = 3

# --- База знаний растений (In-Memory Mock/DB) ---
PLANTS_DB = [
    {
        "id": 1, "name_ru": "Вяз приземистый (Карагач)", "type": "Tree",
        "min_ph": 6.0, "max_ph": 8.5, "max_salinity": 5.5, "drought_res": 5, "gas_res": 5,
        "is_allergen": False, "unit_cost": 6000, "co2_yr": 28.0, "crown_sqm": 15.0
    },
    {
        "id": 2, "name_ru": "Тополь белый (безпуховый)", "type": "Tree",
        "min_ph": 6.5, "max_ph": 8.0, "max_salinity": 4.0, "drought_res": 4, "gas_res": 5,
        "is_allergen": False, "unit_cost": 8500, "co2_yr": 45.0, "crown_sqm": 25.0
    },
    {
        "id": 3, "name_ru": "Сосна обыкновенная", "type": "Tree",
        "min_ph": 5.5, "max_ph": 7.2, "max_salinity": 1.5, "drought_res": 4, "gas_res": 2,
        "is_allergen": False, "unit_cost": 25000, "co2_yr": 35.0, "crown_sqm": 20.0
    },
    {
        "id": 4, "name_ru": "Кизильник блестящий", "type": "Shrub",
        "min_ph": 6.0, "max_ph": 8.2, "max_salinity": 3.0, "drought_res": 4, "gas_res": 4,
        "is_allergen": False, "unit_cost": 4200, "co2_yr": 6.5, "crown_sqm": 2.0
    }
]

@app.post("/api/v1/recommend-plants", response_model=List[PlantScore])
def recommend_plants(req: PlantRecommendationRequest):
    results = []
    for plant in PLANTS_DB:
        # 1. Hard constraints
        if req.is_near_school_or_hospital and plant["is_allergen"]:
            continue
        if req.soil_ph < plant["min_ph"] or req.soil_ph > plant["max_ph"]:
            continue
        if req.salinity_ds_m > plant["max_salinity"]:
            continue
            
        # 2. Soft scoring
        score = 100.0
        reasons = []
        
        # Штраф за засоление
        salinity_diff = plant["max_salinity"] - req.salinity_ds_m
        if salinity_diff < 1.0:
            score -= 15
            reasons.append("Почвы близки к пределу засоления для вида")
            
        # Бонус за газоустойчивость в промзоне Павлодара
        if req.is_industrial_zone and plant["gas_res"] >= 4:
            score += 10
            reasons.append("Высокая устойчивость к выбросам промпредприятий")
            
        score = min(100.0, max(0.0, score))
        
        # Расчет рекомендуемого количества по площади кроны
        target_coverage = req.area_sqm * 0.4 # 40% под посадку
        rec_count = int(target_coverage / plant["crown_sqm"]) if plant["crown_sqm"] > 0 else 0
        
        results.append(PlantScore(
            plant_id=plant["id"],
            name_ru=plant["name_ru"],
            score=round(score, 1),
            recommended_count=max(1, rec_count),
            reasoning="; ".join(reasons) if reasons else "Отлично подходит под почвенно-климатические условия"
        ))
        
    return sorted(results, key=lambda x: x.score, reverse=True)

@app.post("/api/v1/calculate-estimate")
def calculate_estimate(req: EstimateRequest):
    material_cost = 0.0
    eco_co2_total = 0.0
    
    for item in req.selected_plants:
        plant_info = next((p for p in PLANTS_DB if p["id"] == item["plant_id"]), None)
        if plant_info:
            count = item["count"]
            material_cost += count * plant_info["unit_cost"]
            eco_co2_total += count * plant_info["co2_yr"]
            
    prep_cost = req.area_sqm * 850.0 # 850 ₸/кв.м подготовка грунта в Павлодаре
    work_cost = material_cost * 0.30 # 30% от стоимости саженцев - посадка
    care_cost_annual = req.area_sqm * 450.0 # 450 ₸/кв.м в год (полив водовозами/уход)
    total_care_cost = care_cost_annual * req.care_years
    
    # Резерв на приживаемость (оценка 12% риска)
    reserve_cost = material_cost * 0.12
    
    total_sum = material_cost + prep_cost + work_cost + total_care_cost + reserve_cost
    
    return {
        "summary_kzt": round(total_sum, 2),
        "breakdown": {
            "planting_materials_kzt": round(material_cost, 2),
            "soil_preparation_kzt": round(prep_cost, 2),
            "planting_works_kzt": round(work_cost, 2),
            "care_maintenance_kzt": round(total_care_cost, 2),
            "risk_reserve_kzt": round(reserve_cost, 2)
        },
        "ecological_effect_5yr": {
            "co2_absorption_tons": round((eco_co2_total * 5) / 1000.0, 2),
            "dust_reduction_kg": round(eco_co2_total * 3.2, 1)
        }
    }
