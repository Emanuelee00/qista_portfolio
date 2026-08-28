import express from "express";
import { config } from "./config.js";
import { dataRouter } from "./routes/data.js";
import { predictionsRouter } from "./routes/predictions.js";

const app = express();

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/predictions", predictionsRouter);
app.use("/api/data", dataRouter);

app.listen(config.port, () => {
  console.log(`Qista server running on port ${config.port}`);
  console.log(`Predictor service: ${config.predictorUrl}`);
});
