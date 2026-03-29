import type { TaskFileStore } from "./task-store.js";
import type { AgentLauncher } from "./agent-launcher.js";
import type { AgentStatus, Column } from "./types.js";

export interface HookEvent {
  taskId: string;
  event: string;
  data?: Record<string, unknown>;
}

export class HookEngine {
  private store: TaskFileStore;
  private agentLauncher: AgentLauncher;

  constructor(store: TaskFileStore, agentLauncher: AgentLauncher) {
    this.store = store;
    this.agentLauncher = agentLauncher;
  }

  /** Process an incoming hook event and apply state transitions */
  ingest(hookEvent: HookEvent): { applied: boolean; transition?: string } {
    const { taskId, event, data } = hookEvent;

    const task = this.store.list().find((t) => t.id === taskId);
    if (!task) return { applied: false };
    if (!task.agent) return { applied: false };

    const config = this.agentLauncher.getConfig(task.agent.agentName);
    if (!config) return { applied: false };

    // Determine transition
    let newStatus: AgentStatus | null = null;
    let newColumn: Column | null = null;

    if (config.hookMap.toReview.includes(event)) {
      // Only transition if currently working
      if (task.agent.status === "working") {
        newStatus = "needs_review";
        newColumn = "review";
      }
    } else if (config.hookMap.toInProgress.includes(event)) {
      // Only transition if currently in review
      if (task.agent.status === "needs_review") {
        newStatus = "working";
        newColumn = "in_progress";
      }
    }

    if (!newStatus) return { applied: false };

    // Build activity message from event
    const activity = this.formatActivity(event, data);

    // Apply the transition
    this.store.update(taskId, {
      column: newColumn ?? undefined,
      agent: {
        ...task.agent,
        status: newStatus,
        lastActivity: activity,
      },
    });

    return {
      applied: true,
      transition: `${task.agent.status} -> ${newStatus}`,
    };
  }

  /** Handle direct status updates (e.g., agent completed, errored) */
  setAgentStatus(
    taskId: string,
    status: AgentStatus,
    activity?: string,
  ): boolean {
    const task = this.store.list().find((t) => t.id === taskId);
    if (!task?.agent) return false;

    const columnMap: Partial<Record<AgentStatus, Column>> = {
      working: "in_progress",
      needs_review: "review",
      done: "done",
    };

    this.store.update(taskId, {
      column: columnMap[status],
      agent: {
        ...task.agent,
        status,
        lastActivity: activity ?? task.agent.lastActivity,
      },
    });

    return true;
  }

  private formatActivity(event: string, data?: Record<string, unknown>): string {
    // Format agent events into human-readable activity strings
    switch (event) {
      case "Stop":
      case "stop":
        return "Agent stopped — waiting for review";
      case "PermissionRequest":
      case "permission_request":
      case "permission":
        return `Permission requested: ${(data?.tool as string) || "unknown tool"}`;
      case "UserPromptSubmit":
      case "user_prompt":
      case "prompt":
        return "User sent a message — agent resumed";
      case "PostToolUse":
      case "tool_use":
      case "tool":
        return `Used tool: ${(data?.tool as string) || "unknown"}`;
      default:
        return event;
    }
  }
}
