export type Column = "backlog" | "in_progress" | "review" | "done" | "trash";

export const COLUMNS: { id: Column; label: string }[] = [
  { id: "backlog", label: "Backlog" },
  { id: "in_progress", label: "In Progress" },
  { id: "review", label: "Review" },
  { id: "done", label: "Done" },
  { id: "trash", label: "Trash" },
];

export type AgentStatus = "idle" | "working" | "needs_review" | "error" | "done";

export interface AgentState {
  status: AgentStatus;
  agentName: string;
  terminalSessionId?: string;
  lastActivity?: string;
  startedAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  column: Column;
  order: number;
  createdAt: string;
  updatedAt: string;
  worktree?: {
    path: string;
    branch: string;
  };
  agent?: AgentState;
}

export interface TaskStore {
  version: number;
  tasks: Task[];
}
