import { initTRPC } from "@trpc/server";
import { z } from "zod";
import type { TaskFileStore } from "./task-store.js";
import type { Column } from "./types.js";

const t = initTRPC.create();

const columnSchema = z.enum(["backlog", "in_progress", "review", "done", "trash"]);

export function createAppRouter(store: TaskFileStore) {
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
    }),
  });
}

export type AppRouter = ReturnType<typeof createAppRouter>;
