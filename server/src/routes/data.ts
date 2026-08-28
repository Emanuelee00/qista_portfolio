import { Router, Request, Response } from "express";
import { config } from "../config.js";

export const dataRouter = Router();

// GET /api/data — list available data files
dataRouter.get("/", async (_req: Request, res: Response) => {
  try {
    const response = await fetch(`${config.predictorUrl}/data`);
    if (!response.ok) {
      res.status(response.status).json({ error: "Failed to list data files" });
      return;
    }
    const data = await response.json();
    res.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(502).json({ error: `Data service error: ${message}` });
  }
});

// GET /api/data/:filename — serve a specific data file
dataRouter.get("/:filename", async (req: Request, res: Response) => {
  const { filename } = req.params;
  try {
    const response = await fetch(`${config.predictorUrl}/data/${filename}`);
    if (!response.ok) {
      res.status(response.status).json({ error: `File not found: ${filename}` });
      return;
    }
    const data = await response.json();
    res.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(502).json({ error: `Data service error: ${message}` });
  }
});
