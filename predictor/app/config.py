from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    host: str = "0.0.0.0"
    port: int = 8000
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:8080"]

    # OpenWeather API
    openweather_api_key: str = ""

    # Prediction algorithm weights (must sum to 1.0)
    weight_standing_water: float = 0.25
    weight_temperature: float = 0.20
    weight_humidity: float = 0.15
    weight_wind: float = 0.10
    weight_season: float = 0.20
    weight_environment: float = 0.10

    model_config = {
        "env_prefix": "PREDICTOR_",
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


settings = Settings()
