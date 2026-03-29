// Shared types re-exported for the UI
// Mirrors src/types.ts — kept in sync manually for now

export type Column = "backlog" | "in_progress" | "review" | "done" | "trash";

export const COLUMNS: { id: Column; label: string }[] = [
  { id: "backlog", label: "Backlog" },
  { id: "in_progress", label: "In Progress" },
  { id: "review", label: "Review" },
  { id: "done", label: "Done" },
  { id: "trash", label: "Trash" },
];

export interface Task {
  id: string;
  title: string;
  description: string;
  column: Column;
  order: number;
  createdAt: string;
  updatedAt: string;
}
