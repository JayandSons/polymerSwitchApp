import express from "express";
import { createHTTPHandler } from "@trpc/server/adapters/standalone";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import { TaskFileStore } from "./task-store.js";
import { PtyManager } from "./pty-manager.js";
import { createAppRouter } from "./trpc.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createServer(repoRoot?: string) {
  const root = repoRoot ?? process.cwd();
  const store = new TaskFileStore(root);
  const ptyManager = new PtyManager();
  const app = express();
  const router = createAppRouter(store, ptyManager);

  // tRPC handler
  const trpcHandler = createHTTPHandler({ router });
  app.all("/trpc/{*splat}", (req, res) => {
    req.url = req.url.replace(/^\/trpc/, "");
    trpcHandler(req, res);
  });

  // Health check endpoint
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", uptime: process.uptime() });
  });

  // Serve built web-ui in production
  const staticDir = path.resolve(__dirname, "../web-ui/dist");
  if (fs.existsSync(staticDir)) {
    app.use(express.static(staticDir));
    app.get("/{*splat}", (_req, res) => {
      res.sendFile(path.join(staticDir, "index.html"));
    });
  }

  // Clean up PTY sessions on exit
  process.on("SIGINT", () => { ptyManager.killAll(); process.exit(0); });
  process.on("SIGTERM", () => { ptyManager.killAll(); process.exit(0); });

  return { app, store, ptyManager, router };
}
