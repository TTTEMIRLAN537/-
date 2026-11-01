"""GreenPavlodar AI — backend API.

Слои: main.py (HTTP и валидация) → analysis/plants/estimate/geo (расчёты) → ai (языковая модель).
"""
from typing import List, Literal, Optional, Tuple

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ConfigDict, Field

import logging
import os

import ai
import analysis
import config
import plants as plants_mod
from config import CostModel
from estimate import calculate_estimate
from ratelimit import RateLimiter
from store import RevConflict, make_store

app = FastAPI(
    title="GreenPavlodar AI - Core Engine",
    version="2.0.0",
    description="Backend API для ассистента озеленения Павлодара",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_methods=["GET", "POST", "PUT"],
    allow_headers=["Content-Type"],
)

log = logging.getLogger("uvicorn.error")
llm = ai.make_client()
ai_limiter = RateLimiter(config.AI_RATE_LIMIT_PER_MIN)
COST = CostModel.from_env()
store = make_store()
write_limiter = RateLimiter(120)  # записей в минуту с одного IP (автосохранение при частой расстановке)


def ai_guard(request: Request) -> None:
    ip = request.client.host if request.client else "unknown"
    if not ai_limiter.allow(ip):
        raise HTTPException(status_code=429, detail="Слишком много запросов к ИИ, попробуйте через минуту")


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def require_editing(request: Request) -> None:
    if not write_limiter.allow(_client_ip(request)):
        raise HTTPException(status_code=429, detail="Слишком много сохранений, подождите минуту")
    if not config.EDITING_ENABLED:
        raise HTTPException(status_code=403, detail="Редактирование закрыто: сайт открыт только для просмотра")


# ---------- Модели ----------
Category = Literal["park", "forest", "problem", "zone"]
Kind = Literal["tree", "shrub", "bench", "bin", "other"]


class ZoneDetails(BaseModel):
    model_config = ConfigDict(extra="allow")
    trees: int = Field(0, ge=0, le=10_000_000)
    benches: int = Field(0, ge=0, le=1_000_000)
    bins: int = Field(0, ge=0, le=1_000_000)
    ph: Optional[str] = Field(None, max_length=64)
    salinity: Optional[float] = Field(None, ge=0, le=100)
    isIndustrial: bool = False
    nearSensitive: bool = False


class ZoneIn(BaseModel):
    id: str = Field(max_length=64)
    name: str = Field(max_length=200)
    category: Category
    coordinates: List[Tuple[float, float]] = Field(min_length=4, max_length=1000)
    details: ZoneDetails = Field(default_factory=ZoneDetails)


class PlacedItemIn(BaseModel):
    id: str = Field(max_length=100)
    type: str = Field(max_length=40)
    kind: Optional[Kind] = None
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)


class PlantRecommendationRequest(BaseModel):
    zone_id: str = ""
    area_sqm: float = Field(gt=0, le=1e9)
    soil_ph: float = Field(ge=0, le=14)
    salinity_ds_m: float = Field(ge=0, le=100)
    is_near_school_or_hospital: bool = False
    is_industrial_zone: bool = False


class PlantScore(BaseModel):
    plant_id: int
    name_ru: str
    score: float
    recommended_count: int
    reasoning: str


class SelectedPlant(BaseModel):
    plant_id: int
    count: int = Field(ge=0, le=1_000_000)


class EstimateRequest(BaseModel):
    area_sqm: float = Field(gt=0, le=1e9)
    selected_plants: List[SelectedPlant] = Field(max_length=100)
    care_years: int = Field(3, ge=0, le=50)


class ZoneRequest(BaseModel):
    zone: ZoneIn
    other_zones: List[ZoneIn] = Field(default_factory=list, max_length=2000)  # нужны для правила «рядом парк/лес»
    placed_items: List[PlacedItemIn] = Field(default_factory=list, max_length=20_000)


class ScanRequest(BaseModel):
    zones: List[ZoneIn] = Field(max_length=2000)
    placed_items: List[PlacedItemIn] = Field(default_factory=list, max_length=20_000)


class StoredZone(ZoneIn):
    color: str = Field("#22c55e", max_length=40)


class StoredItem(BaseModel):
    id: str = Field(max_length=100)
    type: str = Field(max_length=40)
    kind: Kind = "tree"
    name: str = Field("", max_length=100)
    icon: str = Field("📍", max_length=16)
    color: str = Field("#16a34a", max_length=40)
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)


class StoredTool(BaseModel):
    id: str = Field(max_length=100)
    name: str = Field("", max_length=100)
    icon: str = Field("📍", max_length=16)
    color: str = Field("#16a34a", max_length=40)
    type: str = Field(max_length=40)
    kind: Kind = "tree"


class StateData(BaseModel):
    zones: List[StoredZone] = Field(max_length=2000)
    placed_items: List[StoredItem] = Field(max_length=50_000)
    palette: List[StoredTool] = Field(max_length=200)


class StateWrite(BaseModel):
    base_rev: int = Field(ge=0)
    data: StateData


class SpeciesRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)


def _dump(model: BaseModel) -> dict:
    return model.model_dump()


def _analyze(req: "ZoneRequest") -> dict:
    zone = _dump(req.zone)
    others = [_dump(z) for z in req.other_zones]
    return analysis.analyze_zone(zone, [_dump(i) for i in req.placed_items], COST, all_zones=[zone] + others)


# ---------- Эндпоинты ----------
@app.exception_handler(Exception)
async def unhandled_error(request: Request, exc: Exception):
    log.exception("Необработанная ошибка: %s", request.url.path)
    return JSONResponse(status_code=500, content={
        "detail": "Внутренняя ошибка сервера. Подробности — в журнале (Logs) сервиса на Render."})


@app.get("/api/v1/ai/status", dependencies=[Depends(ai_guard)])
def ai_status():
    """Диагностика: делает крошечный запрос к ИИ и показывает результат или причину сбоя (ключ не показывается)."""
    if not llm.available:
        return {"ok": False, "model": None, "error": "Ключ API не задан на сервере"}
    try:
        text = llm.complete("Отвечай одним словом.", "Скажи: ок", 20)
        return {"ok": True, "model": llm.model, "reply": text.strip()[:80]}
    except Exception as e:
        return {"ok": False, "model": llm.model, "error": str(e) if isinstance(e, ai.AIError) else type(e).__name__}


@app.get("/api/v1/health")
def health():
    return {"status": "ok", "ai_available": llm.available, "ai_model": llm.model if llm.available else None,
            "storage": store.kind, "storage_persistent": store.persistent,
            "editing_enabled": config.EDITING_ENABLED}


@app.get("/api/v1/state")
def get_state():
    """Публичное чтение: то, что видят все посетители (и жюри)."""
    rev, data = store.get()
    return {"rev": rev, "data": data}


@app.put("/api/v1/state", dependencies=[Depends(require_editing)])
def put_state(req: StateWrite):
    try:
        rev = store.save(req.data.model_dump(), req.base_rev)
    except RevConflict as e:
        raise HTTPException(status_code=409, detail="Данные на сервере новее. Обновите страницу.",
                            headers={"X-Current-Rev": str(e.current_rev)})
    return {"rev": rev}


@app.get("/api/v1/plants")
def list_plants():
    return [p.__dict__ for p in plants_mod.PLANTS]


@app.post("/api/v1/recommend-plants", response_model=List[PlantScore])
def recommend_plants(req: PlantRecommendationRequest):
    recs = plants_mod.recommend(req.soil_ph, req.salinity_ds_m, req.is_industrial_zone,
                                req.is_near_school_or_hospital)
    return [
        PlantScore(plant_id=r["plant_id"], name_ru=r["name_ru"], score=r["score"],
                   recommended_count=plants_mod.count_for_area(req.area_sqm, r["crown_sqm"]),
                   reasoning=r["reasoning"])
        for r in recs
    ]


@app.post("/api/v1/calculate-estimate")
def calculate_estimate_endpoint(req: EstimateRequest):
    try:
        return calculate_estimate(req.area_sqm, [(p.plant_id, p.count) for p in req.selected_plants],
                                  req.care_years, COST)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@app.post("/api/v1/analyze-zone")
def analyze_zone(req: ZoneRequest):
    try:
        return _analyze(req)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@app.post("/api/v1/scan")
def scan(req: ScanRequest):
    return analysis.scan_zones([_dump(z) for z in req.zones], [_dump(i) for i in req.placed_items], COST)


@app.post("/api/v1/ai/species", dependencies=[Depends(ai_guard)])
def ai_species(req: SpeciesRequest):
    try:
        return ai.generate_species(req.name, llm)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@app.post("/api/v1/ai/auto-detect-problems", dependencies=[Depends(ai_guard)])
def ai_auto_detect_problems(req: ScanRequest):
    """ИИ анализирует все зоны и находит районы с наибольшими проблемами озеленения."""
    zones_list = [_dump(z) for z in req.zones]
    items_list = [_dump(i) for i in req.placed_items]
    scan = analysis.scan_zones(zones_list, items_list, COST)
    return ai.auto_detect_problems(scan["results"], llm)


@app.post("/api/v1/ai/zone-report", dependencies=[Depends(ai_guard)])
def ai_zone_report(req: ZoneRequest):
    try:
        result = _analyze(req)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    return {"analysis": result, **ai.zone_report(result, llm)}


# Продакшен-образ кладёт собранный фронтенд в ./static — тогда сайт и API работают с одного адреса.
# Монтирование идёт последним, чтобы не перекрывать маршруты /api и /docs.
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
if os.path.isdir(STATIC_DIR):
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
