import { execFileSync } from "node:child_process";
import type { PtyManager } from "./pty-manager.js";
import type { Task, AgentState } from "./types.js";

export interface AgentConfig {
  name: string;
  command: string;
  args: string[];
  /** Map agent-specific events to kanban transitions */
  hookMap: {
    toReview: string[];
    toInProgress: string[];
  };
}

const KNOWN_AGENTS: AgentConfig[] = [
  {
    name: "claude",
    command: "claude",
    args: ["--dangerously-skip-permissions"],
    hookMap: {
      toReview: ["Stop", "PermissionRequest"],
      toInProgress: ["UserPromptSubmit", "PostToolUse"],
    },
  },
  {
    name: "codex",
    command: "codex",
    args: [],
    hookMap: {
      toReview: ["stop", "permission_request"],
      toInProgress: ["user_prompt", "tool_use"],
    },
  },
  {
    name: "gemini",
    command: "gemini",
    args: [],
    hookMap: {
      toReview: ["stop", "permission"],
      toInProgress: ["prompt", "tool"],
    },
  },
];

export class AgentLauncher {
  private ptyManager: PtyManager;
  private port: number;

  constructor(ptyManager: PtyManager, port: number) {
    this.ptyManager = ptyManager;
    this.port = port;
  }

  /** Scan PATH for installed CLI agents */
  detectAgents(): AgentConfig[] {
    return KNOWN_AGENTS.filter((agent) => {
      try {
        execFileSync("which", [agent.command], { stdio: "pipe" });
        return true;
      } catch {
        return false;
      }
    });
  }

  /** Prepare and launch an agent for a task in its worktree */
  launch(
    task: Task,
    agentName?: string,
  ): { terminalSessionId: string; agentState: AgentState } {
    if (!task.worktree) {
      throw new Error("Task must have a worktree before launching an agent");
    }

    const available = this.detectAgents();
    const agent = agentName
      ? available.find((a) => a.name === agentName)
      : available[0];

    if (!agent) {
      throw new Error(
        agentName
          ? `Agent "${agentName}" not found. Available: ${available.map((a) => a.name).join(", ") || "none"}`
          : "No CLI agents detected on PATH",
      );
    }

    // Create a PTY session in the worktree directory
    const sessionId = `agent-${task.id}`;
    this.ptyManager.create(sessionId, task.worktree.path);

    // Build the command with the task description as the prompt
    const prompt = `${task.title}\n\n${task.description}`.trim();
    const fullCommand = this.buildCommand(agent, prompt, task.id);

    // Send the command to the PTY
    this.ptyManager.write(sessionId, fullCommand + "\n");

    const agentState: AgentState = {
      status: "working",
      agentName: agent.name,
      terminalSessionId: sessionId,
      lastActivity: "Agent started",
      startedAt: new Date().toISOString(),
    };

    return { terminalSessionId: sessionId, agentState };
  }

  private buildCommand(agent: AgentConfig, prompt: string, taskId: string): string {
    // Set env vars for hooks
    const envPrefix = [
      `KANBAN_TASK_ID=${taskId}`,
      `KANBAN_HOOK_PORT=${this.port}`,
    ].join(" ");

    // Escape prompt for shell
    const escapedPrompt = prompt.replace(/'/g, "'\\''");

    const args = [...agent.args];

    // For Claude Code, pass prompt via -p flag
    if (agent.name === "claude") {
      args.push("-p", `'${escapedPrompt}'`);
      return `${envPrefix} ${agent.command} ${args.join(" ")}`;
    }

    // For others, pass prompt as last arg or via stdin
    return `${envPrefix} ${agent.command} ${args.join(" ")} '${escapedPrompt}'`;
  }

  getConfig(agentName: string): AgentConfig | undefined {
    return KNOWN_AGENTS.find((a) => a.name === agentName);
  }

  getKnownAgents(): AgentConfig[] {
    return KNOWN_AGENTS;
  }
}
