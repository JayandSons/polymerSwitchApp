import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "node:http";
import type { TaskFileStore } from "./task-store.js";

export function setupWebSocket(httpServer: Server, store: TaskFileStore) {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  function broadcast(data: unknown) {
    const msg = JSON.stringify(data);
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    }
  }

  // When the store changes, push the full task list to all clients
  store.onChange(() => {
    broadcast({ type: "tasks:updated", tasks: store.list() });
  });

  // Send initial state on connect
  wss.on("connection", (ws) => {
    ws.send(JSON.stringify({ type: "tasks:updated", tasks: store.list() }));
  });

  return wss;
}
