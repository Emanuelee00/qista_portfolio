"""Integration tests for FastAPI endpoints."""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.fixture
def client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


@pytest.mark.anyio
async def test_health(client):
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


@pytest.mark.anyio
async def test_predict_explicit(client):
    resp = await client.post("/predict", json={
        "latitude": 43.3,
        "longitude": 5.4,
        "temperature_celsius": 28.0,
        "humidity_percent": 70.0,
        "precipitation_mm": 5.0,
        "wind_speed_ms": 2.0,
        "rain_accumulation_3d_mm": 15.0,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert 0 <= data["risk_score"] <= 100
    assert data["risk_level"] in ("very_low", "low", "moderate", "high", "critical")
    assert data["risk_class"] in ("A", "B", "C", "D", "E")
    factors = data["factors"]
    for key in ("standing_water_factor", "temperature_factor", "humidity_factor",
                "wind_factor", "season_factor", "environment_factor"):
        assert key in factors
        assert 0.0 <= factors[key] <= 1.0


@pytest.mark.anyio
async def test_predict_with_regional_context(client):
    """Prediction with regional context includes all 9 factors."""
    resp = await client.post("/predict", json={
        "latitude": 43.3,
        "longitude": 5.4,
        "temperature_celsius": 28.0,
        "humidity_percent": 70.0,
        "precipitation_mm": 5.0,
        "wind_speed_ms": 2.0,
        "rain_accumulation_3d_mm": 15.0,
        "regional_context": {
            "gbif_obs_count": 100,
            "wnv_cases": 20,
            "dengue_cases": 5,
            "mosquito_alert_count": 150,
            "population_density": 500.0,
        },
    })
    assert resp.status_code == 200
    data = resp.json()
    assert 0 <= data["risk_score"] <= 100
    assert data["risk_class"] in ("A", "B", "C", "D", "E")
    factors = data["factors"]
    assert "species_factor" in factors
    assert "disease_factor" in factors
    assert "observation_factor" in factors


@pytest.mark.anyio
async def test_predict_auto_mock(client):
    """Auto prediction uses mock weather when no API key is set."""
    resp = await client.post("/predict/auto", json={
        "latitude": 43.3,
        "longitude": 5.4,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert 0 <= data["risk_score"] <= 100
    assert "factors" in data


@pytest.mark.anyio
async def test_predict_batch(client):
    """Batch endpoint returns predictions for multiple locations."""
    resp = await client.post("/predict/batch", json={
        "locations": [
            {"latitude": 43.3, "longitude": 5.4},
            {"latitude": 48.9, "longitude": 2.3},
            {"latitude": 41.9, "longitude": 12.5},
        ]
    })
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 3
    for pred in data:
        assert 0 <= pred["risk_score"] <= 100
        assert "factors" in pred


@pytest.mark.anyio
async def test_predict_batch_empty(client):
    """Batch with empty locations returns empty list."""
    resp = await client.post("/predict/batch", json={"locations": []})
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.anyio
async def test_data_list(client):
    """Data listing endpoint should return files list."""
    resp = await client.get("/data")
    assert resp.status_code == 200
    data = resp.json()
    assert "files" in data
    assert isinstance(data["files"], list)


@pytest.mark.anyio
async def test_predict_validation(client):
    """Invalid coordinates should fail validation."""
    resp = await client.post("/predict", json={
        "latitude": 200.0,
        "longitude": 5.4,
        "temperature_celsius": 28.0,
        "humidity_percent": 70.0,
        "precipitation_mm": 5.0,
    })
    assert resp.status_code == 422
