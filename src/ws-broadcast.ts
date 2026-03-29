import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "node:http";
import type { TaskFileStore } from "./task-store.js";
import type { PtyManager } from "./pty-manager.js";

export function setupWebSocket(
  httpServer: Server,
  store: TaskFileStore,
  ptyManager: PtyManager,
) {
  // Task sync channel
  const taskWss = new WebSocketServer({ noServer: true });

  function broadcast(data: unknown) {
    const msg = JSON.stringify(data);
    for (const client of taskWss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    }
  }

  store.onChange(() => {
    broadcast({ type: "tasks:updated", tasks: store.list() });
  });

  taskWss.on("connection", (ws) => {
    ws.send(JSON.stringify({ type: "tasks:updated", tasks: store.list() }));
  });

  // Terminal data channel
  const termWss = new WebSocketServer({ noServer: true });

  termWss.on("connection", (ws) => {
    let sessionId: string | null = null;
    let unsubData: (() => void) | null = null;
    let unsubExit: (() => void) | null = null;

    ws.on("message", (raw) => {
      const msg = JSON.parse(raw.toString());

      switch (msg.type) {
        case "terminal:attach": {
          const id = msg.sessionId as string;
          if (!ptyManager.has(id)) {
            ws.send(JSON.stringify({ type: "terminal:error", error: "Session not found" }));
            return;
          }
          sessionId = id;

          unsubData = ptyManager.onData(id, (data) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "terminal:data", data }));
            }
          });

          unsubExit = ptyManager.onExit(id, (code) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "terminal:exit", code }));
            }
          });

          ws.send(JSON.stringify({ type: "terminal:attached", sessionId: id }));
          break;
        }

        case "terminal:data": {
          if (sessionId) {
            ptyManager.write(sessionId, msg.data);
          }
          break;
        }

        case "terminal:resize": {
          if (sessionId) {
            ptyManager.resize(sessionId, msg.cols, msg.rows);
          }
          break;
        }
      }
    });

    ws.on("close", () => {
      unsubData?.();
      unsubExit?.();
    });
  });

  // Route upgrade requests to the correct WSS
  httpServer.on("upgrade", (req, socket, head) => {
    const { pathname } = new URL(req.url || "", `http://${req.headers.host}`);

    if (pathname === "/ws") {
      taskWss.handleUpgrade(req, socket, head, (ws) => {
        taskWss.emit("connection", ws, req);
      });
    } else if (pathname === "/ws/terminal") {
      termWss.handleUpgrade(req, socket, head, (ws) => {
        termWss.emit("connection", ws, req);
      });
    } else {
      socket.destroy();
    }
  });

  return { taskWss, termWss };
}
