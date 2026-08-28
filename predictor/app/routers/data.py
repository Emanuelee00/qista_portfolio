import json
import os
from pathlib import Path

from fastapi import APIRouter, HTTPException

router = APIRouter()

# Data directory: configurable via env, defaults to client/public/data relative to project root
DATA_DIR = Path(os.environ.get(
    "PREDICTOR_DATA_DIR",
    Path(__file__).resolve().parents[3] / "client" / "public" / "data",
))


@router.get("/data")
async def list_data_files() -> dict:
    """List available precomputed data files."""
    if not DATA_DIR.is_dir():
        return {"files": [], "data_dir": str(DATA_DIR)}
    files = sorted(f.name for f in DATA_DIR.iterdir() if f.suffix in (".json", ".geojson"))
    return {"files": files, "data_dir": str(DATA_DIR)}


@router.get("/data/{filename}")
async def get_data_file(filename: str) -> dict | list:
    """Serve a precomputed data file."""
    if ".." in filename or "/" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    filepath = DATA_DIR / filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail=f"File not found: {filename}")
    with open(filepath) as f:
        return json.load(f)
