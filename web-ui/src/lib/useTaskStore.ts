import { useEffect, useRef, useState, useCallback } from "react";
import { trpc } from "./trpc.js";
import type { Task, Column } from "./types.js";

export function useTaskStore() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  // Connect WebSocket for real-time updates
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "tasks:updated") {
        setTasks(data.tasks);
      }
    };

    ws.onclose = () => {
      // Reconnect after 2s
      setTimeout(() => {
        wsRef.current = null;
      }, 2000);
    };

    return () => {
      ws.close();
    };
  }, []);

  // Fallback: load tasks via tRPC on mount
  useEffect(() => {
    trpc.tasks.list.query().then(setTasks).catch(console.error);
  }, []);

  const createTask = useCallback(async (title: string, description: string) => {
    await trpc.tasks.create.mutate({ title, description });
  }, []);

  const updateTask = useCallback(async (id: string, patch: Partial<Pick<Task, "title" | "description">>) => {
    await trpc.tasks.update.mutate({ id, ...patch });
  }, []);

  const deleteTask = useCallback(async (id: string) => {
    await trpc.tasks.delete.mutate({ id });
  }, []);

  const reorderTask = useCallback(async (taskId: string, column: Column, order: number) => {
    // Optimistic update
    setTasks((prev) => {
      const updated = prev.map((t) => (t.id === taskId ? { ...t, column, order } : t));
      return updated;
    });
    await trpc.tasks.reorder.mutate({ taskId, column, order });
  }, []);

  const startTask = useCallback(async (id: string, agentName?: string) => {
    await trpc.tasks.start.mutate({ id, agentName });
  }, []);

  const trashTask = useCallback(async (id: string) => {
    const task = tasks.find((t) => t.id === id);
    // Clean up worktree if present
    if (task?.worktree) {
      await trpc.worktrees.remove.mutate({ taskId: id }).catch(() => {});
    }
    await trpc.tasks.reorder.mutate({ taskId: id, column: "trash", order: 0 });
  }, [tasks]);

  return { tasks, createTask, updateTask, deleteTask, reorderTask, startTask, trashTask };
}
