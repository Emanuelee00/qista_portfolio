import { config } from "../config.js";

export interface PredictionInput {
  latitude: number;
  longitude: number;
  temperature_celsius: number;
  humidity_percent: number;
  precipitation_mm: number;
}

export interface PredictionResult {
  latitude: number;
  longitude: number;
  risk_score: number;
  risk_level: string;
  factors: {
    standing_water_factor: number;
    temperature_factor: number;
    humidity_factor: number;
    wind_factor: number;
    season_factor: number;
    environment_factor: number;
  };
}

export interface LocationInput {
  latitude: number;
  longitude: number;
}

async function postPredictor<T>(path: string, body: T): Promise<PredictionResult> {
  const response = await fetch(`${config.predictorUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Predictor error (${response.status}): ${text}`);
  }

  return response.json() as Promise<PredictionResult>;
}

export async function getPrediction(input: PredictionInput): Promise<PredictionResult> {
  return postPredictor("/predict", input);
}

export async function getAutoPrediction(input: LocationInput): Promise<PredictionResult> {
  return postPredictor("/predict/auto", input);
}

export interface BatchLocationInput {
  locations: Array<{ latitude: number; longitude: number; area_type?: string }>;
}

export async function getBatchPredictions(input: BatchLocationInput): Promise<PredictionResult[]> {
  const response = await fetch(`${config.predictorUrl}/predict/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Predictor error (${response.status}): ${text}`);
  }

  return response.json() as Promise<PredictionResult[]>;
}
