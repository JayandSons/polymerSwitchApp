import { Command } from "commander";
import { createServer } from "./server.js";
import { setupWebSocket } from "./ws-broadcast.js";
import open from "open";

const program = new Command();

program
  .name("kanban")
  .description("Kanban Agent Runner — run CLI coding agents in parallel")
  .version("0.1.0")
  .option("-p, --port <number>", "port to listen on", "3100")
  .option("--no-open", "do not open browser on start")
  .action(async (opts) => {
    const port = parseInt(opts.port, 10);
    const { app, store, ptyManager } = createServer();

    const httpServer = app.listen(port, () => {
      const url = `http://localhost:${port}`;
      console.log(`\n  Kanban Agent Runner listening at ${url}\n`);

      if (opts.open) {
        open(url).catch(() => {});
      }
    });

    setupWebSocket(httpServer, store, ptyManager);
  });

program.parse();
