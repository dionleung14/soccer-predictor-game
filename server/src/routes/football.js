import { Router } from "express";

const FOOTBALL_API_BASE = "https://api.football-data.org";

export const footballRouter = Router();

/**
 * Proxies football-data.org v4 requests so the React client never holds the API token.
 * Client:  GET /api/football/v4/competitions/WC
 * Upstream: GET https://api.football-data.org/v4/competitions/WC
 */
footballRouter.use(async (req, res, next) => {
  const token = process.env.FOOTBALL_DATA_API_TOKEN;
  if (!token) {
    res.status(500).json({
      error: "FOOTBALL_DATA_API_TOKEN is not configured on the server",
    });
    return;
  }

  const targetPath = req.originalUrl.replace(/^\/api\/football/, "") || "/";
  const upstreamUrl = new URL(targetPath, FOOTBALL_API_BASE);

  try {
    const upstream = await fetch(upstreamUrl, {
      method: req.method,
      headers: {
        Accept: "application/json",
        "X-Auth-Token": token,
      },
    });

    const contentType = upstream.headers.get("content-type") || "";
    const body = contentType.includes("application/json")
      ? await upstream.json()
      : await upstream.text();

    // console.log("body", body);

    res.status(upstream.status);
    if (typeof body === "string") {
      res.type(contentType || "text/plain").send(body);
      return;
    }
    res.json(body);
  } catch (err) {
    next(err);
  }
});
