# Qista — Mosquito Risk Prediction Platform

Predicts mosquito risk based on weather data and environmental factors for locations in France. Built for Qista, a mosquito trap company, to help clients anticipate mosquito activity.

## Architecture

Three services:

```
client (nginx :8080)  -->  server (Express :3000)  -->  predictor (FastAPI :8000)
     static map UI          REST gateway                 prediction engine
                                                         + OpenWeather API
```

## Quick Start

```bash
# 1. Set your OpenWeather API key
cp .env
# Edit .env with your key (free tier: https://openweathermap.org/api)

# 2. Run all services
docker-compose up

# 3. Open the map
open http://localhost:3000
```

## Prediction Algorithm (v2)

Six factors, each scored **0.0–1.0**, weighted and combined into a **0–100 risk score**.

### Formula

```
risk_score = (w1 * standing_water + w2 * temperature + w3 * humidity
            + w4 * wind + w5 * season + w6 * environment) * 100
```

### Factors

#### 1. Standing Water Index (weight: 0.25)

The most important factor. Rain creates breeding sites; high humidity slows evaporation.

```
base = sigmoid(rain_3d, inflection=20mm)     # 1 / (1 + e^(-0.2 * (rain - 20)))
humidity_boost = 1.3 if humidity > 70% else 1.0
standing_water = min(base * humidity_boost, 1.0)
```

- **Input**: rain accumulation over 3 days (mm), current humidity (%)
- **Data source**: OpenWeather 5-day forecast API (summed `rain.3h` over 24 entries)
- 0mm rain -> 0.0, 20mm -> ~0.5, 40mm+ -> ~1.0

#### 2. Temperature Dynamics (weight: 0.20)

Mosquito lifecycle depends on accumulated heat, not just current temperature. Uses 3-day average from forecast data.

```
temperature = gaussian(avg_temp_3d, peak=26°C, sigma=6)
            = e^(-(temp - 26)^2 / 72)
```

- **Input**: average temperature over 3-day forecast (°C)
- **Data source**: OpenWeather 5-day forecast API (mean of `main.temp`)
- Below 10°C or above 40°C -> 0.0, 26°C -> 1.0, 20°C -> ~0.61

#### 3. Humidity (weight: 0.15)

Linear scale — mosquitoes need moisture.

```
humidity = 0                     if humidity <= 40%
         = (humidity - 40) / 50  if 40% < humidity < 90%
         = 1.0                   if humidity >= 90%
```

- **Input**: current humidity (%)
- **Data source**: OpenWeather current weather API (`main.humidity`)

#### 4. Wind Suppression (weight: 0.10)

High wind reduces mosquito activity and biting probability.

```
wind = max(0, 1 - wind_speed / 8)
```

- **Input**: wind speed (m/s)
- **Data source**: OpenWeather current weather API (`wind.speed`)
- 0 m/s (calm) -> 1.0, 4 m/s -> 0.5, 8+ m/s -> 0.0

#### 5. Seasonality (weight: 0.20)

Smooth sine curve peaking in July/August, near zero in winter.

```
season = max(0, sin(pi * (day_of_year - 80) / 275))
```

- **Input**: current date
- **Data source**: system clock
- January -> ~0.0, April -> ~0.5, July -> ~1.0, October -> ~0.7

#### 6. Environment Type (weight: 0.10)

Static multiplier based on area classification around the location.

| Area type | Score |
|-----------|-------|
| Wetland   | 1.0   |
| Forest    | 0.8   |
| Suburban  | 0.6   |
| Urban     | 0.4   |

- **Input**: `area_type` parameter (default: `urban`)
- **Data source**: request parameter (manual classification)

### Risk Levels

| Score  | Level    |
|--------|----------|
| 0–33   | Low      |
| 34–66  | Moderate |
| 67–100 | High     |

### Example

Paris in July, 28°C avg, 80% humidity, 25mm rain over 3 days, light wind (2 m/s), urban:

```
standing_water = sigmoid(25, 20) * 1.3   = 0.73 * 1.3 = 0.95  -> * 0.25 = 0.237
temperature    = gaussian(28, 26, 6)     = 0.95                -> * 0.20 = 0.189
humidity       = (80 - 40) / 50          = 0.80                -> * 0.15 = 0.120
wind           = 1 - 2/8                 = 0.75                -> * 0.10 = 0.075
season         = sin(mid-july)           = 0.99                -> * 0.20 = 0.198
environment    = urban                   = 0.40                -> * 0.10 = 0.040
                                                          TOTAL = 0.859 -> 86/100 (HIGH)
```

## API

### Public (via Node server, port 3000)

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| POST | `/api/predictions` | `{latitude, longitude, temperature_celsius, humidity_percent, precipitation_mm, ...}` | Predict from explicit weather data |
| POST | `/api/predictions/auto` | `{latitude, longitude, area_type?}` | Predict using live OpenWeather data |
| GET | `/api/health` | — | Health check |

### Internal (Python predictor, port 8000)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/predict` | Compute risk from explicit data |
| POST | `/predict/auto` | Compute risk with live weather |
| GET | `/health` | Health check |

## Project Structure

```
qista/
├── client/          # Static frontend (nginx, Leaflet.js map)
├── server/          # Node.js REST gateway (Express + TypeScript)
├── predictor/       # Python prediction engine (FastAPI)
│   ├── app/
│   │   ├── services/
│   │   │   ├── mosquito.py   # Prediction algorithm
│   │   │   └── weather.py    # OpenWeather API client
│   │   ├── models/schemas.py # Pydantic models
│   │   └── routers/predict.py
│   └── tests/
├── docker-compose.yml
└── .env.example     # Template for API keys
```

## Configuration

All weights are configurable via environment variables (prefix `PREDICTOR_`):

```bash
PREDICTOR_OPENWEATHER_API_KEY=your_key
PREDICTOR_WEIGHT_STANDING_WATER=0.25
PREDICTOR_WEIGHT_TEMPERATURE=0.20
PREDICTOR_WEIGHT_HUMIDITY=0.15
PREDICTOR_WEIGHT_WIND=0.10
PREDICTOR_WEIGHT_SEASON=0.20
PREDICTOR_WEIGHT_ENVIRONMENT=0.10
```

## Tests

```bash
cd predictor
pip install -r requirements.txt
python -m pytest tests/ -v
```
