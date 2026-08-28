from enum import Enum

from pydantic import BaseModel, Field


class AreaType(str, Enum):
    urban = "urban"
    suburban = "suburban"
    forest = "forest"
    wetland = "wetland"


class RegionalContext(BaseModel):
    """Pre-computed regional ecological context from S-C-D-O model."""
    gbif_obs_count: int = Field(ge=0, default=0)
    wnv_cases: int = Field(ge=0, default=0)
    dengue_cases: int = Field(ge=0, default=0)
    chikungunya_cases: int = Field(ge=0, default=0)
    population_density: float | None = None
    mosquito_alert_count: int = Field(ge=0, default=0)
    gbif_citizen_count: int = Field(ge=0, default=0)


class PredictionRequest(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    temperature_celsius: float
    humidity_percent: float = Field(ge=0, le=100)
    precipitation_mm: float = Field(ge=0)
    wind_speed_ms: float = Field(ge=0, default=0.0)
    rain_accumulation_3d_mm: float = Field(ge=0, default=0.0)
    avg_temp_3d_celsius: float | None = None
    area_type: AreaType = AreaType.urban
    regional_context: RegionalContext | None = None


class LocationRequest(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    area_type: AreaType = AreaType.urban


class RiskFactors(BaseModel):
    standing_water_factor: float
    temperature_factor: float
    humidity_factor: float
    wind_factor: float
    season_factor: float
    environment_factor: float
    # Regional context factors (present when regional_context is provided)
    species_factor: float | None = None
    disease_factor: float | None = None
    observation_factor: float | None = None


class PredictionResponse(BaseModel):
    latitude: float
    longitude: float
    risk_score: int = Field(ge=0, le=100)
    risk_class: str = Field(pattern=r"^[A-E]$")
    risk_level: str
    factors: RiskFactors


class BatchLocationRequest(BaseModel):
    locations: list[LocationRequest] = Field(max_length=100)
