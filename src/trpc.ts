import { initTRPC } from "@trpc/server";
import { z } from "zod";
import type { TaskFileStore } from "./task-store.js";
import type { PtyManager } from "./pty-manager.js";
import type { WorktreeManager } from "./worktree-manager.js";
import type { Column } from "./types.js";

const t = initTRPC.create();

const columnSchema = z.enum(["backlog", "in_progress", "review", "done", "trash"]);

export function createAppRouter(
  store: TaskFileStore,
  ptyManager: PtyManager,
  worktreeManager: WorktreeManager,
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
        .input(z.object({ id: z.string() }))
        .mutation(({ input }) => {
          const task = store.list().find((t) => t.id === input.id);
          if (!task) throw new Error("Task not found");

          // Create worktree
          const wt = worktreeManager.create(task.id);

          // Update task with worktree info and move to in_progress
          return store.update(task.id, {
            column: "in_progress",
            worktree: { path: wt.path, branch: wt.branch },
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
          // Clear worktree info from the task
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
  });
}

export type AppRouter = ReturnType<typeof createAppRouter>;
