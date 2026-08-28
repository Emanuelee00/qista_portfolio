from fastapi import APIRouter

from app.config import settings
from app.models.schemas import (
    BatchLocationRequest,
    LocationRequest,
    PredictionRequest,
    PredictionResponse,
    RiskFactors,
)
from app.services.mosquito import compute_risk
from app.services.weather import fetch_weather

router = APIRouter()


def _build_response(
    lat: float,
    lon: float,
    avg_temp_3d: float,
    humidity_pct: float,
    rain_3d_mm: float,
    wind_speed_ms: float,
    area_type: str,
    regional_context: dict | None = None,
) -> PredictionResponse:
    score, cls, level, factors = compute_risk(
        avg_temp_3d=avg_temp_3d,
        humidity_pct=humidity_pct,
        rain_3d_mm=rain_3d_mm,
        wind_speed_ms=wind_speed_ms,
        area_type=area_type,
        w_standing_water=settings.weight_standing_water,
        w_temperature=settings.weight_temperature,
        w_humidity=settings.weight_humidity,
        w_wind=settings.weight_wind,
        w_season=settings.weight_season,
        w_environment=settings.weight_environment,
        regional_context=regional_context,
    )
    return PredictionResponse(
        latitude=lat,
        longitude=lon,
        risk_score=score,
        risk_class=cls,
        risk_level=level,
        factors=RiskFactors(**factors),
    )


@router.post("/predict", response_model=PredictionResponse)
async def predict(req: PredictionRequest) -> PredictionResponse:
    """Predict mosquito risk from explicit weather data."""
    avg_temp = req.avg_temp_3d_celsius if req.avg_temp_3d_celsius is not None else req.temperature_celsius
    ctx = req.regional_context.model_dump() if req.regional_context else None
    return _build_response(
        req.latitude,
        req.longitude,
        avg_temp,
        req.humidity_percent,
        req.rain_accumulation_3d_mm,
        req.wind_speed_ms,
        req.area_type.value,
        regional_context=ctx,
    )


@router.post("/predict/auto", response_model=PredictionResponse)
async def predict_auto(req: LocationRequest) -> PredictionResponse:
    """Predict mosquito risk by fetching live weather from OpenWeather."""
    weather = await fetch_weather(req.latitude, req.longitude)
    return _build_response(
        req.latitude,
        req.longitude,
        weather.avg_temp_3d_celsius,
        weather.humidity_percent,
        weather.rain_accumulation_3d_mm,
        weather.wind_speed_ms,
        req.area_type.value,
    )


@router.post("/predict/batch", response_model=list[PredictionResponse])
async def predict_batch(req: BatchLocationRequest) -> list[PredictionResponse]:
    """Predict mosquito risk for multiple locations at once."""
    import asyncio

    async def _predict_one(loc: LocationRequest) -> PredictionResponse:
        weather = await fetch_weather(loc.latitude, loc.longitude)
        return _build_response(
            loc.latitude,
            loc.longitude,
            weather.avg_temp_3d_celsius,
            weather.humidity_percent,
            weather.rain_accumulation_3d_mm,
            weather.wind_speed_ms,
            loc.area_type.value,
        )

    results = await asyncio.gather(*[_predict_one(loc) for loc in req.locations])
    return list(results)
