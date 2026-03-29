import { initTRPC } from "@trpc/server";
import { z } from "zod";
import type { TaskFileStore } from "./task-store.js";
import type { PtyManager } from "./pty-manager.js";
import type { WorktreeManager } from "./worktree-manager.js";
import type { AgentLauncher } from "./agent-launcher.js";
import type { HookEngine } from "./hook-engine.js";
import type { Column } from "./types.js";

const t = initTRPC.create();

const columnSchema = z.enum(["backlog", "in_progress", "review", "done", "trash"]);

export function createAppRouter(
  store: TaskFileStore,
  ptyManager: PtyManager,
  worktreeManager: WorktreeManager,
  agentLauncher: AgentLauncher,
  hookEngine: HookEngine,
) {
  return t.router({
    tasks: t.router({
      list: t.procedure.query(() => {
        return store.list();
      }),

      create: t.procedure
        .input(z.object({
          title: z.string().min(1),
          description: z.string().default(""),
          column: columnSchema.default("backlog"),
        }))
        .mutation(({ input }) => {
          return store.create(input.title, input.description, input.column as Column);
        }),

      update: t.procedure
        .input(z.object({
          id: z.string(),
          title: z.string().min(1).optional(),
          description: z.string().optional(),
          column: columnSchema.optional(),
          order: z.number().optional(),
        }))
        .mutation(({ input }) => {
          const { id, ...patch } = input;
          return store.update(id, patch);
        }),

      delete: t.procedure
        .input(z.object({ id: z.string() }))
        .mutation(({ input }) => {
          return store.delete(input.id);
        }),

      reorder: t.procedure
        .input(z.object({
          taskId: z.string(),
          column: columnSchema,
          order: z.number(),
        }))
        .mutation(({ input }) => {
          return store.reorder(input.taskId, input.column as Column, input.order);
        }),

      start: t.procedure
        .input(z.object({
          id: z.string(),
          agentName: z.string().optional(),
        }))
        .mutation(({ input }) => {
          const task = store.list().find((t) => t.id === input.id);
          if (!task) throw new Error("Task not found");

          // Create worktree if not already present
          if (!task.worktree) {
            const wt = worktreeManager.create(task.id);
            store.update(task.id, {
              column: "in_progress",
              worktree: { path: wt.path, branch: wt.branch },
            });
          }

          // Re-read task after worktree update
          const updated = store.list().find((t) => t.id === input.id)!;

          // Launch agent
          const { agentState } = agentLauncher.launch(updated, input.agentName);

          return store.update(task.id, {
            column: "in_progress",
            agent: agentState,
          });
        }),
    }),

    terminal: t.router({
      create: t.procedure
        .input(z.object({
          cwd: z.string().optional(),
        }).optional())
        .mutation(({ input }) => {
          const id = crypto.randomUUID();
          const session = ptyManager.create(id, input?.cwd);
          return { id: session.id, cwd: session.cwd, createdAt: session.createdAt };
        }),

      list: t.procedure.query(() => {
        return ptyManager.list();
      }),

      resize: t.procedure
        .input(z.object({
          id: z.string(),
          cols: z.number().min(1),
          rows: z.number().min(1),
        }))
        .mutation(({ input }) => {
          return ptyManager.resize(input.id, input.cols, input.rows);
        }),

      kill: t.procedure
        .input(z.object({ id: z.string() }))
        .mutation(({ input }) => {
          return ptyManager.kill(input.id);
        }),
    }),

    worktrees: t.router({
      list: t.procedure.query(() => {
        return worktreeManager.list();
      }),

      create: t.procedure
        .input(z.object({ taskId: z.string() }))
        .mutation(({ input }) => {
          return worktreeManager.create(input.taskId);
        }),

      remove: t.procedure
        .input(z.object({ taskId: z.string() }))
        .mutation(({ input }) => {
          const result = worktreeManager.remove(input.taskId);
          const task = store.list().find((t) => t.id === input.taskId);
          if (task) {
            store.update(input.taskId, { worktree: undefined });
          }
          return result;
        }),

      status: t.procedure
        .input(z.object({ taskId: z.string() }))
        .query(({ input }) => {
          return {
            exists: worktreeManager.has(input.taskId),
            path: worktreeManager.getPath(input.taskId),
          };
        }),
    }),

    agents: t.router({
      detect: t.procedure.query(() => {
        return agentLauncher.detectAgents().map((a) => ({
          name: a.name,
          command: a.command,
        }));
      }),

      known: t.procedure.query(() => {
        return agentLauncher.getKnownAgents().map((a) => ({
          name: a.name,
          command: a.command,
        }));
      }),
    }),

    hooks: t.router({
      ingest: t.procedure
        .input(z.object({
          taskId: z.string(),
          event: z.string(),
          data: z.record(z.unknown()).optional(),
        }))
        .mutation(({ input }) => {
          return hookEngine.ingest({
            taskId: input.taskId,
            event: input.event,
            data: input.data as Record<string, unknown> | undefined,
          });
        }),
    }),
  });
}

export type AppRouter = ReturnType<typeof createAppRouter>;
