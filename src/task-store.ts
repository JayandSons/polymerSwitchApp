import fs from "node:fs";
import path from "node:path";
import type { Task, TaskStore, Column } from "./types.js";

const STORE_VERSION = 1;

export class TaskFileStore {
  private filePath: string;
  private data: TaskStore;
  private listeners: Set<() => void> = new Set();

  constructor(repoRoot: string) {
    const kanbanDir = path.join(repoRoot, ".kanban");
    fs.mkdirSync(kanbanDir, { recursive: true });
    this.filePath = path.join(kanbanDir, "tasks.json");
    this.data = this.load();
  }

  private load(): TaskStore {
    try {
      const raw = fs.readFileSync(this.filePath, "utf-8");
      return JSON.parse(raw) as TaskStore;
    } catch {
      return { version: STORE_VERSION, tasks: [] };
    }
  }

  private save(): void {
    const tmp = this.filePath + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmp, this.filePath);
    this.notify();
  }

  private notify(): void {
    for (const fn of this.listeners) fn();
  }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  list(): Task[] {
    return this.data.tasks;
  }

  create(title: string, description: string, column: Column = "backlog"): Task {
    const now = new Date().toISOString();
    const maxOrder = this.data.tasks
      .filter((t) => t.column === column)
      .reduce((m, t) => Math.max(m, t.order), -1);
    const task: Task = {
      id: crypto.randomUUID(),
      title,
      description,
      column,
      order: maxOrder + 1,
      createdAt: now,
      updatedAt: now,
    };
    this.data.tasks.push(task);
    this.save();
    return task;
  }

  update(id: string, patch: Partial<Pick<Task, "title" | "description" | "column" | "order" | "worktree">>): Task | null {
    const task = this.data.tasks.find((t) => t.id === id);
    if (!task) return null;
    if (patch.title !== undefined) task.title = patch.title;
    if (patch.description !== undefined) task.description = patch.description;
    if (patch.column !== undefined) task.column = patch.column;
    if (patch.order !== undefined) task.order = patch.order;
    if (patch.worktree !== undefined) task.worktree = patch.worktree;
    task.updatedAt = new Date().toISOString();
    this.save();
    return task;
  }

  delete(id: string): boolean {
    const idx = this.data.tasks.findIndex((t) => t.id === id);
    if (idx === -1) return false;
    this.data.tasks.splice(idx, 1);
    this.save();
    return true;
  }

  reorder(taskId: string, targetColumn: Column, targetOrder: number): Task | null {
    const task = this.data.tasks.find((t) => t.id === taskId);
    if (!task) return null;

    const oldColumn = task.column;
    const oldOrder = task.order;

    // Remove from old position: shift items down in old column
    if (oldColumn === targetColumn) {
      // Same column reorder
      const siblings = this.data.tasks
        .filter((t) => t.column === targetColumn && t.id !== taskId)
        .sort((a, b) => a.order - b.order);
      // Insert at target position
      siblings.splice(targetOrder, 0, task);
      siblings.forEach((t, i) => {
        t.order = i;
      });
    } else {
      // Moving to a different column
      // Fix old column orders
      this.data.tasks
        .filter((t) => t.column === oldColumn && t.id !== taskId)
        .sort((a, b) => a.order - b.order)
        .forEach((t, i) => { t.order = i; });

      // Insert into new column
      const newSiblings = this.data.tasks
        .filter((t) => t.column === targetColumn)
        .sort((a, b) => a.order - b.order);
      newSiblings.splice(targetOrder, 0, task);
      newSiblings.forEach((t, i) => { t.order = i; });

      task.column = targetColumn;
    }

    task.order = targetOrder;
    task.updatedAt = new Date().toISOString();
    this.save();
    return task;
  }
}
