"""OpenWeather API client.

Uses two free-tier endpoints:
- Current Weather (/data/2.5/weather) — temp, humidity, rain, wind
- 5-Day Forecast (/data/2.5/forecast) — rain accumulation, avg temp over 3 days

Docs: https://openweathermap.org/current
      https://openweathermap.org/forecast5
"""

import logging
import math
import random
from dataclasses import dataclass

import httpx

from app.config import settings

_CURRENT_URL = "https://api.openweathermap.org/data/2.5/weather"
_FORECAST_URL = "https://api.openweathermap.org/data/2.5/forecast"
_log = logging.getLogger(__name__)

# 3 days = 24 forecast entries (every 3h)
_FORECAST_ENTRIES_3D = 24


@dataclass
class WeatherData:
    temperature_celsius: float
    humidity_percent: float
    precipitation_mm: float
    wind_speed_ms: float
    rain_accumulation_3d_mm: float
    avg_temp_3d_celsius: float


async def _fetch_current(client: httpx.AsyncClient, lat: float, lon: float) -> dict:
    """Fetch current weather."""
    params = {
        "lat": lat, "lon": lon,
        "appid": settings.openweather_api_key, "units": "metric",
    }
    resp = await client.get(_CURRENT_URL, params=params)
    resp.raise_for_status()
    return resp.json()


async def _fetch_forecast(client: httpx.AsyncClient, lat: float, lon: float) -> dict:
    """Fetch 5-day/3h forecast."""
    params = {
        "lat": lat, "lon": lon,
        "appid": settings.openweather_api_key, "units": "metric",
        "cnt": _FORECAST_ENTRIES_3D,
    }
    resp = await client.get(_FORECAST_URL, params=params)
    resp.raise_for_status()
    return resp.json()


def _parse_forecast(data: dict) -> tuple[float, float]:
    """Extract rain_accumulation_3d and avg_temp_3d from forecast response."""
    entries = data.get("list", [])
    if not entries:
        return 0.0, 20.0

    total_rain = 0.0
    total_temp = 0.0
    for entry in entries:
        total_rain += entry.get("rain", {}).get("3h", 0.0)
        total_temp += entry["main"]["temp"]

    avg_temp = total_temp / len(entries)
    return round(total_rain, 1), round(avg_temp, 1)


async def _fetch_openweather(latitude: float, longitude: float) -> WeatherData:
    """Call current + forecast APIs and combine."""
    async with httpx.AsyncClient(timeout=15) as client:
        current = await _fetch_current(client, latitude, longitude)
        forecast = await _fetch_forecast(client, latitude, longitude)

    rain_1h = current.get("rain", {}).get("1h", 0.0)
    wind_speed = current.get("wind", {}).get("speed", 0.0)
    rain_3d, avg_temp_3d = _parse_forecast(forecast)

    return WeatherData(
        temperature_celsius=current["main"]["temp"],
        humidity_percent=current["main"]["humidity"],
        precipitation_mm=rain_1h,
        wind_speed_ms=wind_speed,
        rain_accumulation_3d_mm=rain_3d,
        avg_temp_3d_celsius=avg_temp_3d,
    )


def _mock_weather(latitude: float) -> WeatherData:
    """Generate plausible mock weather based on latitude.
    Southern France is warmer/more humid than northern."""
    south_factor = max(0, min(1, (51 - latitude) / 9))
    temp = 14 + south_factor * 14 + random.uniform(-2, 2)
    humidity = 45 + south_factor * 35 + random.uniform(-5, 5)
    precip = max(0, south_factor * 8 + random.uniform(-2, 4))
    wind = max(0, 4 - south_factor * 2 + random.uniform(-1, 2))
    rain_3d = max(0, precip * 3 * random.uniform(0.5, 2.0))
    avg_temp_3d = temp + random.uniform(-2, 2)

    return WeatherData(
        temperature_celsius=round(temp, 1),
        humidity_percent=round(min(humidity, 100), 1),
        precipitation_mm=round(precip, 1),
        wind_speed_ms=round(wind, 1),
        rain_accumulation_3d_mm=round(rain_3d, 1),
        avg_temp_3d_celsius=round(avg_temp_3d, 1),
    )


async def fetch_weather(latitude: float, longitude: float) -> WeatherData:
    """Fetch weather. Falls back to mock data if the API key is missing or invalid."""
    if not settings.openweather_api_key:
        _log.warning("No API key set — using mock weather data")
        return _mock_weather(latitude)

    try:
        return await _fetch_openweather(latitude, longitude)
    except httpx.HTTPStatusError as exc:
        _log.warning(
            "OpenWeather API error %s — falling back to mock data",
            exc.response.status_code,
        )
        return _mock_weather(latitude)
