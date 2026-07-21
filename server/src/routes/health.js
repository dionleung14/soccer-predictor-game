import { Router } from "express";

export const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  console.log("health check");
  res.json({
    ok: true,
    service: "soccer-predictor-api",
  });
});
