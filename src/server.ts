import express from "express";
import { createHTTPHandler } from "@trpc/server/adapters/standalone";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import { TaskFileStore } from "./task-store.js";
import { PtyManager } from "./pty-manager.js";
import { WorktreeManager } from "./worktree-manager.js";
import { AgentLauncher } from "./agent-launcher.js";
import { HookEngine } from "./hook-engine.js";
import { createAppRouter } from "./trpc.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createServer(repoRoot?: string, port = 3100) {
  const root = repoRoot ?? process.cwd();
  const store = new TaskFileStore(root);
  const ptyManager = new PtyManager();
  const worktreeManager = new WorktreeManager(root);
  const agentLauncher = new AgentLauncher(ptyManager, port);
  const hookEngine = new HookEngine(store, agentLauncher);
  const app = express();
  const router = createAppRouter(store, ptyManager, worktreeManager, agentLauncher, hookEngine);

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

  return { app, store, ptyManager, worktreeManager, agentLauncher, hookEngine, router };
}
