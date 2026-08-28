export const config = {
  port: parseInt(process.env.PORT || "3000", 10),
  predictorUrl: process.env.PREDICTOR_URL || "http://localhost:8000",
};
