from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers.data import router as data_router
from app.routers.predict import router as predict_router

app = FastAPI(title="Qista Predictor", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(predict_router)
app.include_router(data_router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
