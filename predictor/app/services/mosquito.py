"""Mosquito risk prediction algorithm — v3.

Combines real-time weather factors with regional ecological context (S-C-D-O model).

Weather factors (each 0.0–1.0, 60% of final score):
1. Standing water index (rain accumulation + humidity boost)
2. Temperature dynamics (3-day avg, Gaussian peak at 26°C)
3. Humidity (linear 40%–90%)
4. Wind (suppression above 8 m/s)
5. Seasonality (sine curve peaking July/August)
6. Environment type (static multiplier)

Regional context factors (each 0.0–1.0, 40% of final score):
7. Species presence — Aedes albopictus observation density in region
8. Disease risk — WNV/dengue/chikungunya case history + population density
9. Observation density — citizen science reports (Mosquito Alert + GBIF)

Final score 0–100, classified into 5 risk classes (A–E).
"""

import math
from datetime import date


# --- Weather factor functions (unchanged from v2) ---

def standing_water_factor(rain_3d_mm: float, humidity_pct: float) -> float:
    """Score 0-1. Rain accumulation over 3 days creates breeding sites.
    High humidity slows evaporation, boosting the effect."""
    if rain_3d_mm <= 0:
        return 0.0
    base = 1 / (1 + math.exp(-0.2 * (rain_3d_mm - 20)))
    humidity_boost = 1.0 + 0.3 * (humidity_pct > 70)
    return min(base * humidity_boost, 1.0)


def temperature_factor(avg_temp_3d: float) -> float:
    """Score 0-1. Gaussian peak at 26°C on 3-day average.
    Models accumulated heat needed for mosquito lifecycle."""
    if avg_temp_3d < 10 or avg_temp_3d > 40:
        return 0.0
    optimal = 26.0
    sigma = 6.0
    return math.exp(-((avg_temp_3d - optimal) ** 2) / (2 * sigma**2))


def humidity_factor(humidity_pct: float) -> float:
    """Score 0-1. Linear from 40% to 90%."""
    if humidity_pct <= 40:
        return 0.0
    if humidity_pct >= 90:
        return 1.0
    return (humidity_pct - 40) / 50


def wind_factor(wind_speed_ms: float) -> float:
    """Score 0-1. High wind suppresses mosquito activity.
    0 m/s -> 1.0, >=8 m/s -> 0.0."""
    return max(0.0, 1.0 - wind_speed_ms / 8.0)


def season_factor(today: date | None = None) -> float:
    """Score 0-1. Sine curve peaking July/August, ~0 in winter.
    Day 80 (late March) to day 355 (late December) active window."""
    if today is None:
        today = date.today()
    doy = today.timetuple().tm_yday
    return max(0.0, math.sin(math.pi * (doy - 80) / 275))


def environment_factor(area_type: str) -> float:
    """Score 0-1. Static multiplier based on area classification."""
    multipliers = {
        "wetland": 1.0,
        "forest": 0.8,
        "suburban": 0.6,
        "urban": 0.4,
    }
    return multipliers.get(area_type, 0.5)


# --- Regional context factor functions (from S-C-D-O model) ---

def species_factor(gbif_obs_count: int) -> float:
    """Score 0-1. Aedes albopictus observation density in region.
    Based on GBIF point-in-polygon counts per NUTS3 region.
    Thresholds derived from script 08 (precise NUTS3 scoring)."""
    if gbif_obs_count >= 200:
        return 1.0
    if gbif_obs_count >= 100:
        return 0.88
    if gbif_obs_count >= 50:
        return 0.72
    if gbif_obs_count >= 20:
        return 0.56
    if gbif_obs_count >= 10:
        return 0.40
    if gbif_obs_count >= 3:
        return 0.24
    if gbif_obs_count >= 1:
        return 0.12
    return 0.0


def disease_factor(
    wnv_cases: int = 0,
    dengue_cases: int = 0,
    chikungunya_cases: int = 0,
    population_density: float | None = None,
) -> float:
    """Score 0-1. Disease risk from recent vectorborne case history.
    WNV weighted 1.5x (local transmission), chikungunya 0.8x.
    Population density adds a bonus (urban exposure)."""
    total = 0.0

    # WNV — strongest signal for local mosquito-borne transmission
    if wnv_cases >= 500:
        total += 8 * 1.5
    elif wnv_cases >= 100:
        total += 5 * 1.5
    elif wnv_cases >= 20:
        total += 3 * 1.5
    elif wnv_cases >= 1:
        total += 1 * 1.5

    # Dengue
    if dengue_cases >= 1000:
        total += 8
    elif dengue_cases >= 200:
        total += 5
    elif dengue_cases >= 50:
        total += 3
    elif dengue_cases >= 1:
        total += 1

    # Chikungunya
    if chikungunya_cases >= 50:
        total += 5 * 0.8
    elif chikungunya_cases >= 10:
        total += 3 * 0.8
    elif chikungunya_cases >= 1:
        total += 1 * 0.8

    base = min(20.0, total)

    # Population density modulation (0–5 extra points on /25 scale)
    density_bonus = 0.0
    if population_density is not None:
        if population_density > 3000:
            density_bonus = 5.0
        elif population_density > 1000:
            density_bonus = 4.0
        elif population_density > 500:
            density_bonus = 3.0
        elif population_density > 200:
            density_bonus = 2.0
        elif population_density > 50:
            density_bonus = 1.0

    return min(1.0, (base + density_bonus) / 25.0)


def observation_factor(
    mosquito_alert_count: int = 0,
    gbif_count: int = 0,
) -> float:
    """Score 0-1. Citizen science observation density.
    Combines Mosquito Alert (primary) + GBIF (fallback, weighted 2x when MA is sparse)."""
    total = mosquito_alert_count
    if mosquito_alert_count < 50:
        total += gbif_count * 2

    if total >= 3000:
        return 1.0
    if total >= 1500:
        return 0.88
    if total >= 500:
        return 0.72
    if total >= 200:
        return 0.56
    if total >= 100:
        return 0.40
    if total >= 30:
        return 0.28
    if total >= 10:
        return 0.16
    if total >= 1:
        return 0.08
    return 0.0


# --- Risk classification ---

def risk_class(score: int) -> str:
    """5-level risk classification A (very low) to E (critical).
    Aligned with the S-C-D-O regional model thresholds."""
    if score >= 75:
        return "E"
    if score >= 55:
        return "D"
    if score >= 40:
        return "C"
    if score >= 25:
        return "B"
    return "A"


RISK_CLASS_LABELS = {
    "A": "very_low",
    "B": "low",
    "C": "moderate",
    "D": "high",
    "E": "critical",
}


# --- Main risk computation ---

def compute_risk(
    avg_temp_3d: float,
    humidity_pct: float,
    rain_3d_mm: float,
    wind_speed_ms: float,
    area_type: str = "urban",
    today: date | None = None,
    # Weather weights (sum to 1.0 within weather group)
    w_standing_water: float = 0.25,
    w_temperature: float = 0.20,
    w_humidity: float = 0.15,
    w_wind: float = 0.10,
    w_season: float = 0.20,
    w_environment: float = 0.10,
    # Regional context (optional — when provided, blended at 40%)
    regional_context: dict | None = None,
) -> tuple[int, str, str, dict[str, float]]:
    """Compute mosquito risk score from weather + optional regional context.

    When regional_context is provided, weather accounts for 60% and context for 40%.
    When absent, weather accounts for 100% (backward compatible).

    regional_context keys:
        gbif_obs_count (int): GBIF Aedes albopictus observations in region
        wnv_cases (int): recent West Nile virus cases
        dengue_cases (int): recent dengue cases
        chikungunya_cases (int): recent chikungunya cases
        population_density (float): people/km² in region
        mosquito_alert_count (int): citizen science reports
        gbif_citizen_count (int): GBIF citizen observation count

    Returns (risk_score 0-100, risk_class A-E, risk_level, factor_dict).
    """
    # Weather factors
    sw = standing_water_factor(rain_3d_mm, humidity_pct)
    temp = temperature_factor(avg_temp_3d)
    hum = humidity_factor(humidity_pct)
    wind = wind_factor(wind_speed_ms)
    season = season_factor(today)
    env = environment_factor(area_type)

    weather_raw = (
        w_standing_water * sw
        + w_temperature * temp
        + w_humidity * hum
        + w_wind * wind
        + w_season * season
        + w_environment * env
    )
    weather_raw = min(max(weather_raw, 0.0), 1.0)

    factors: dict[str, float] = {
        "standing_water_factor": round(sw, 3),
        "temperature_factor": round(temp, 3),
        "humidity_factor": round(hum, 3),
        "wind_factor": round(wind, 3),
        "season_factor": round(season, 3),
        "environment_factor": round(env, 3),
    }

    if regional_context is not None:
        ctx = regional_context
        sp = species_factor(ctx.get("gbif_obs_count", 0))
        dis = disease_factor(
            wnv_cases=ctx.get("wnv_cases", 0),
            dengue_cases=ctx.get("dengue_cases", 0),
            chikungunya_cases=ctx.get("chikungunya_cases", 0),
            population_density=ctx.get("population_density"),
        )
        obs = observation_factor(
            mosquito_alert_count=ctx.get("mosquito_alert_count", 0),
            gbif_count=ctx.get("gbif_citizen_count", 0),
        )

        # Context weights within the context group (sum to 1.0)
        context_raw = 0.40 * sp + 0.35 * dis + 0.25 * obs

        # Blend: 60% weather, 40% regional context
        blended = 0.60 * weather_raw + 0.40 * context_raw

        factors["species_factor"] = round(sp, 3)
        factors["disease_factor"] = round(dis, 3)
        factors["observation_factor"] = round(obs, 3)
    else:
        blended = weather_raw

    score = round(min(max(blended, 0.0), 1.0) * 100)
    cls = risk_class(score)
    level = RISK_CLASS_LABELS[cls]

    return score, cls, level, factors
