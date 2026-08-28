import { Router, Request, Response } from "express";
import {
  getPrediction,
  getAutoPrediction,
  getBatchPredictions,
  PredictionInput,
  LocationInput,
  BatchLocationInput,
} from "../services/predictor-client.js";

export const predictionsRouter = Router();

// POST /api/predictions — explicit weather data
predictionsRouter.post("/", async (req: Request, res: Response) => {
  const { latitude, longitude, temperature_celsius, humidity_percent, precipitation_mm } =
    req.body as PredictionInput;

  if (
    latitude == null ||
    longitude == null ||
    temperature_celsius == null ||
    humidity_percent == null ||
    precipitation_mm == null
  ) {
    res.status(400).json({
      error: "Missing required fields: latitude, longitude, temperature_celsius, humidity_percent, precipitation_mm",
    });
    return;
  }

  try {
    const result = await getPrediction({
      latitude,
      longitude,
      temperature_celsius,
      humidity_percent,
      precipitation_mm,
    });
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(502).json({ error: `Prediction service error: ${message}` });
  }
});

// POST /api/predictions/auto — fetch weather from OpenWeather automatically
predictionsRouter.post("/auto", async (req: Request, res: Response) => {
  const { latitude, longitude } = req.body as LocationInput;

  if (latitude == null || longitude == null) {
    res.status(400).json({
      error: "Missing required fields: latitude, longitude",
    });
    return;
  }

  try {
    const result = await getAutoPrediction({ latitude, longitude });
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(502).json({ error: `Prediction service error: ${message}` });
  }
});

// POST /api/predictions/batch — batch predictions for multiple locations
predictionsRouter.post("/batch", async (req: Request, res: Response) => {
  const { locations } = req.body as BatchLocationInput;

  if (!Array.isArray(locations) || locations.length === 0) {
    res.status(400).json({
      error: "Missing required field: locations (non-empty array)",
    });
    return;
  }

  if (locations.length > 100) {
    res.status(400).json({ error: "Maximum 100 locations per batch" });
    return;
  }

  try {
    const results = await getBatchPredictions({ locations });
    res.json(results);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(502).json({ error: `Prediction service error: ${message}` });
  }
});
