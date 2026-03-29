import express from "express";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createServer() {
  const app = express();

  // --- tRPC will be mounted here in Loop 1 ---

  // Health check endpoint
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", uptime: process.uptime() });
  });

  // Serve built web-ui in production
  const staticDir = path.resolve(__dirname, "../web-ui/dist");
  if (fs.existsSync(staticDir)) {
    app.use(express.static(staticDir));
    // SPA fallback — serve index.html for all non-API routes
    app.get("/{*splat}", (_req, res) => {
      res.sendFile(path.join(staticDir, "index.html"));
    });
  }

  return app;
}
