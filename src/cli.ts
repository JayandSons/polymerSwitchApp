import { Command } from "commander";
import { createServer } from "./server.js";
import { setupWebSocket } from "./ws-broadcast.js";
import open from "open";

const program = new Command();

program
  .name("kanban")
  .description("Kanban Agent Runner — run CLI coding agents in parallel")
  .version("0.1.0");

// Main server command (default)
program
  .option("-p, --port <number>", "port to listen on", "3100")
  .option("--no-open", "do not open browser on start")
  .action(async (opts) => {
    const port = parseInt(opts.port, 10);
    const { app, store, ptyManager } = createServer(undefined, port);

    const httpServer = app.listen(port, () => {
      const url = `http://localhost:${port}`;
      console.log(`\n  Kanban Agent Runner listening at ${url}\n`);

      if (opts.open) {
        open(url).catch(() => {});
      }
    });

    setupWebSocket(httpServer, store, ptyManager);
  });

// Hook ingest subcommand — called by agent hooks
program
  .command("hooks")
  .command("ingest")
  .requiredOption("--event <event>", "hook event name (e.g., Stop, PermissionRequest)")
  .option("--task-id <taskId>", "task ID (defaults to KANBAN_TASK_ID env var)")
  .option("--port <port>", "kanban server port (defaults to KANBAN_HOOK_PORT env var)")
  .option("--data <json>", "optional JSON data")
  .action(async (opts) => {
    const taskId = opts.taskId || process.env.KANBAN_TASK_ID;
    const port = opts.port || process.env.KANBAN_HOOK_PORT || "3100";

    if (!taskId) {
      console.error("Error: --task-id or KANBAN_TASK_ID env var required");
      process.exit(1);
    }

    let data: Record<string, unknown> | undefined;
    if (opts.data) {
      try {
        data = JSON.parse(opts.data);
      } catch {
        console.error("Error: --data must be valid JSON");
        process.exit(1);
      }
    }

    // Send hook to the running kanban server via HTTP
    try {
      const res = await fetch(`http://localhost:${port}/trpc/hooks.ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, event: opts.event, data }),
      });
      const result = await res.json();
      if ((result as any).result?.data?.applied) {
        console.log(`Hook applied: ${(result as any).result.data.transition}`);
      } else {
        console.log("Hook received but no transition applied");
      }
    } catch (err) {
      console.error(`Failed to send hook to kanban server on port ${port}:`, err);
      process.exit(1);
    }
  });

program.parse();
