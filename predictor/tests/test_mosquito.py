from datetime import date

from app.services.mosquito import (
    compute_risk,
    disease_factor,
    environment_factor,
    humidity_factor,
    observation_factor,
    risk_class,
    season_factor,
    species_factor,
    standing_water_factor,
    temperature_factor,
    wind_factor,
)


class TestStandingWaterFactor:
    def test_no_rain(self):
        assert standing_water_factor(0, 50) == 0.0

    def test_heavy_rain_dry(self):
        """Lots of rain but low humidity."""
        score = standing_water_factor(30, 50)
        assert 0.7 < score < 1.0

    def test_heavy_rain_humid(self):
        """Lots of rain + high humidity = boosted."""
        dry = standing_water_factor(30, 50)
        humid = standing_water_factor(30, 80)
        assert humid > dry

    def test_moderate_rain(self):
        score = standing_water_factor(10, 60)
        assert 0.05 < score < 0.5


class TestTemperatureFactor:
    def test_optimal_temperature(self):
        assert temperature_factor(26) > 0.95

    def test_cold(self):
        assert temperature_factor(5) == 0.0

    def test_hot(self):
        assert temperature_factor(42) == 0.0

    def test_moderate(self):
        score = temperature_factor(20)
        assert 0.3 < score < 0.8


class TestHumidityFactor:
    def test_dry(self):
        assert humidity_factor(30) == 0.0

    def test_threshold(self):
        assert humidity_factor(40) == 0.0

    def test_saturated(self):
        assert humidity_factor(95) == 1.0

    def test_mid_range(self):
        score = humidity_factor(65)
        assert 0.4 < score < 0.6


class TestWindFactor:
    def test_no_wind(self):
        assert wind_factor(0) == 1.0

    def test_strong_wind(self):
        assert wind_factor(10) == 0.0

    def test_moderate_wind(self):
        score = wind_factor(4)
        assert 0.4 < score < 0.6

    def test_light_breeze(self):
        score = wind_factor(2)
        assert 0.7 < score < 0.8


class TestSeasonFactor:
    def test_summer_peak(self):
        """July should be near peak."""
        score = season_factor(date(2025, 7, 15))
        assert score > 0.9

    def test_winter(self):
        """January should be near zero."""
        score = season_factor(date(2025, 1, 15))
        assert score < 0.1

    def test_spring(self):
        """May should be moderate."""
        score = season_factor(date(2025, 5, 15))
        assert 0.4 < score < 0.8

    def test_autumn(self):
        """October should be declining but still active."""
        score = season_factor(date(2025, 10, 15))
        assert 0.2 < score < 0.8


class TestEnvironmentFactor:
    def test_wetland(self):
        assert environment_factor("wetland") == 1.0

    def test_urban(self):
        assert environment_factor("urban") == 0.4

    def test_unknown(self):
        assert environment_factor("desert") == 0.5


# --- New regional context factor tests ---

class TestSpeciesFactor:
    def test_no_observations(self):
        assert species_factor(0) == 0.0

    def test_endemic(self):
        assert species_factor(200) == 1.0
        assert species_factor(500) == 1.0

    def test_sparse(self):
        assert species_factor(1) == 0.12

    def test_moderate(self):
        score = species_factor(50)
        assert 0.5 < score < 0.9

    def test_monotonic(self):
        """Higher counts always yield higher or equal scores."""
        prev = 0.0
        for count in [0, 1, 3, 10, 20, 50, 100, 200]:
            current = species_factor(count)
            assert current >= prev
            prev = current


class TestDiseaseFactor:
    def test_no_cases(self):
        assert disease_factor() == 0.0

    def test_wnv_only(self):
        score = disease_factor(wnv_cases=100)
        assert 0.2 < score < 0.5

    def test_all_diseases_high(self):
        score = disease_factor(wnv_cases=500, dengue_cases=1000, chikungunya_cases=50)
        assert score >= 0.8

    def test_density_bonus(self):
        """High population density increases disease risk."""
        low_dens = disease_factor(wnv_cases=10, population_density=30)
        high_dens = disease_factor(wnv_cases=10, population_density=3500)
        assert high_dens > low_dens

    def test_capped_at_one(self):
        score = disease_factor(
            wnv_cases=10000, dengue_cases=10000,
            chikungunya_cases=10000, population_density=5000,
        )
        assert score == 1.0


class TestObservationFactor:
    def test_no_observations(self):
        assert observation_factor() == 0.0

    def test_high_ma(self):
        assert observation_factor(mosquito_alert_count=3000) == 1.0

    def test_gbif_fallback(self):
        """GBIF is weighted 2x when MA is sparse (<50)."""
        ma_only = observation_factor(mosquito_alert_count=10)
        with_gbif = observation_factor(mosquito_alert_count=10, gbif_count=50)
        assert with_gbif > ma_only

    def test_gbif_ignored_when_ma_sufficient(self):
        """When MA >= 50, GBIF doesn't add to the total."""
        ma_50 = observation_factor(mosquito_alert_count=50)
        ma_50_gbif = observation_factor(mosquito_alert_count=50, gbif_count=100)
        assert ma_50 == ma_50_gbif


class TestRiskClass:
    def test_classes(self):
        assert risk_class(0) == "A"
        assert risk_class(24) == "A"
        assert risk_class(25) == "B"
        assert risk_class(39) == "B"
        assert risk_class(40) == "C"
        assert risk_class(54) == "C"
        assert risk_class(55) == "D"
        assert risk_class(74) == "D"
        assert risk_class(75) == "E"
        assert risk_class(100) == "E"


# --- Integration tests ---

class TestComputeRisk:
    def test_summer_high_risk(self):
        """Hot, humid, rainy, calm, summer, wetland -> high risk."""
        score, cls, level, factors = compute_risk(
            avg_temp_3d=26, humidity_pct=85, rain_3d_mm=30,
            wind_speed_ms=1, area_type="wetland",
            today=date(2025, 7, 15),
        )
        assert score > 60
        assert level in ("moderate", "high", "critical")
        assert len(factors) == 6

    def test_winter_low_risk(self):
        """Cold, dry, no rain, windy, winter, urban -> low risk."""
        score, cls, level, factors = compute_risk(
            avg_temp_3d=5, humidity_pct=30, rain_3d_mm=0,
            wind_speed_ms=10, area_type="urban",
            today=date(2025, 1, 15),
        )
        assert score < 25
        assert cls == "A"
        assert level == "very_low"

    def test_score_bounds(self):
        """Score always between 0 and 100."""
        for temp in [0, 15, 26, 35, 45]:
            for hum in [0, 50, 100]:
                for rain in [0, 10, 50]:
                    score, _, _, _ = compute_risk(
                        avg_temp_3d=temp, humidity_pct=hum, rain_3d_mm=rain,
                        wind_speed_ms=3, area_type="urban",
                        today=date(2025, 6, 1),
                    )
                    assert 0 <= score <= 100

    def test_all_weather_factors_present(self):
        _, _, _, factors = compute_risk(
            avg_temp_3d=26, humidity_pct=80, rain_3d_mm=10,
            wind_speed_ms=2, area_type="forest",
            today=date(2025, 8, 1),
        )
        expected_keys = {
            "standing_water_factor", "temperature_factor", "humidity_factor",
            "wind_factor", "season_factor", "environment_factor",
        }
        assert set(factors.keys()) == expected_keys

    def test_returns_risk_class(self):
        """v3 returns 4-tuple with risk_class."""
        score, cls, level, factors = compute_risk(
            avg_temp_3d=26, humidity_pct=80, rain_3d_mm=10,
            wind_speed_ms=2, area_type="forest",
            today=date(2025, 8, 1),
        )
        assert cls in ("A", "B", "C", "D", "E")
        assert level in ("very_low", "low", "moderate", "high", "critical")

    def test_with_regional_context(self):
        """Regional context adds species/disease/observation factors."""
        ctx = {
            "gbif_obs_count": 150,
            "wnv_cases": 50,
            "dengue_cases": 10,
            "chikungunya_cases": 0,
            "population_density": 800,
            "mosquito_alert_count": 200,
            "gbif_citizen_count": 30,
        }
        score, cls, level, factors = compute_risk(
            avg_temp_3d=26, humidity_pct=80, rain_3d_mm=20,
            wind_speed_ms=2, area_type="suburban",
            today=date(2025, 7, 15),
            regional_context=ctx,
        )
        assert 0 <= score <= 100
        assert "species_factor" in factors
        assert "disease_factor" in factors
        assert "observation_factor" in factors
        assert len(factors) == 9

    def test_context_increases_risk_in_endemic_area(self):
        """In an area with species presence and disease history,
        regional context should push risk higher than weather alone."""
        base_args = dict(
            avg_temp_3d=22, humidity_pct=60, rain_3d_mm=5,
            wind_speed_ms=3, area_type="urban",
            today=date(2025, 6, 1),
        )
        score_weather_only, _, _, _ = compute_risk(**base_args)

        ctx = {
            "gbif_obs_count": 300,
            "wnv_cases": 200,
            "dengue_cases": 100,
            "mosquito_alert_count": 1000,
            "population_density": 2000,
        }
        score_with_ctx, _, _, _ = compute_risk(**base_args, regional_context=ctx)
        assert score_with_ctx > score_weather_only

    def test_empty_context_same_as_no_context(self):
        """Empty regional context (all zeros) should give lower or equal score."""
        base_args = dict(
            avg_temp_3d=26, humidity_pct=80, rain_3d_mm=20,
            wind_speed_ms=2, area_type="suburban",
            today=date(2025, 7, 15),
        )
        score_none, _, _, _ = compute_risk(**base_args)
        score_empty, _, _, _ = compute_risk(**base_args, regional_context={})
        # With empty context (all zeros), blending should reduce score
        # since context contributes 40% of zeros
        assert score_empty <= score_none
