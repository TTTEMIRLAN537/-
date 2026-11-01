"""Настройки из переменных окружения. Ничего секретного в коде не хранится."""
import os
from dataclasses import dataclass


def _float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, default))
    except ValueError:
        return default


@dataclass(frozen=True)
class CostModel:
    """Рабочие коэффициенты сметы. Это допущения прототипа, а не утверждённые расценки."""
    soil_prep_per_sqm: float = 850.0        # ₸ за м² подготовки грунта
    care_per_sqm_year: float = 450.0        # ₸ за м² в год (полив, уход)
    planting_work_share: float = 0.30       # посадка, доля от стоимости саженцев
    survival_reserve_share: float = 0.12    # резерв на приживаемость
    dust_kg_per_co2_kg: float = 3.2         # оценочный коэффициент, источник не подтверждён

    @classmethod
    def from_env(cls) -> "CostModel":
        d = cls()
        return cls(
            soil_prep_per_sqm=_float("COST_SOIL_PREP_PER_SQM", d.soil_prep_per_sqm),
            care_per_sqm_year=_float("COST_CARE_PER_SQM_YEAR", d.care_per_sqm_year),
            planting_work_share=_float("COST_PLANTING_WORK_SHARE", d.planting_work_share),
            survival_reserve_share=_float("COST_SURVIVAL_RESERVE_SHARE", d.survival_reserve_share),
            dust_kg_per_co2_kg=_float("COST_DUST_KG_PER_CO2_KG", d.dust_kg_per_co2_kg),
        )


def problem_green_radius_m() -> float:
    """Если в этом радиусе от «проблемной» зоны есть парк или лесной массив — зона проблемной не считается."""
    return _float("PROBLEM_GREEN_RADIUS_M", 500.0)


def target_density_per_ha() -> dict:
    """Целевая плотность деревьев на гектар по категориям зон (рабочие значения, не норматив)."""
    return {
        "park": _float("TARGET_TREES_PER_HA_PARK", 50.0),
        "problem": _float("TARGET_TREES_PER_HA_PROBLEM", 15.0),
        "zone": _float("TARGET_TREES_PER_HA_ZONE", 20.0),
        # лесные массивы — природные, дефицит посадок для них не считается
    }


ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-5-5")
ANTHROPIC_API_URL = os.getenv("ANTHROPIC_API_URL", "https://api.anthropic.com/v1/messages")
AI_TIMEOUT_S = _float("AI_TIMEOUT_S", 25.0)
AI_RATE_LIMIT_PER_MIN = int(_float("AI_RATE_LIMIT_PER_MIN", 10))
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",") if o.strip()]


# Хранилище и доступ редактора
DATABASE_URL = os.getenv("DATABASE_URL", "")
DATA_FILE = os.getenv("DATA_FILE", os.path.join(os.path.dirname(os.path.abspath(__file__)), "storage", "state.json"))
# Пароля нет: править данные может любой посетитель. Перед сдачей работы жюри поставьте EDITING_ENABLED=false —
# сайт станет «только для просмотра», а все сохранённые данные останутся.
EDITING_ENABLED = os.getenv("EDITING_ENABLED", "true").strip().lower() not in ("0", "false", "no", "off")
