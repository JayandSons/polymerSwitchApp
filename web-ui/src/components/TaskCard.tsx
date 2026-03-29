import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Task, AgentStatus } from "../lib/types.js";

interface TaskCardProps {
  task: Task;
  onUpdate: (id: string, patch: Partial<Pick<Task, "title" | "description">>) => void;
  onDelete: (id: string) => void;
  onStart?: (id: string) => void;
  onTrash?: (id: string) => void;
  onOpenTerminal?: (sessionId: string) => void;
}

const STATUS_BADGE: Record<AgentStatus, { label: string; color: string; bg: string }> = {
  idle: { label: "Idle", color: "#64748b", bg: "#f1f5f9" },
  working: { label: "Working", color: "#16a34a", bg: "#f0fdf4" },
  needs_review: { label: "Needs Review", color: "#d97706", bg: "#fefce8" },
  error: { label: "Error", color: "#dc2626", bg: "#fef2f2" },
  done: { label: "Done", color: "#6366f1", bg: "#eef2ff" },
};

export function TaskCard({ task, onUpdate, onDelete, onStart, onTrash, onOpenTerminal }: TaskCardProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const hasWorktree = !!task.worktree;
  const hasAgent = !!task.agent;
  const isBacklog = task.column === "backlog";
  const agentBadge = task.agent ? STATUS_BADGE[task.agent.status] : null;

  const borderColor = hasAgent
    ? (task.agent!.status === "working" ? "#86efac" : task.agent!.status === "needs_review" ? "#fde68a" : "#e2e8f0")
    : hasWorktree ? "#86efac" : "#e2e8f0";

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    padding: "10px 12px",
    marginBottom: 8,
    background: "#fff",
    borderRadius: 6,
    border: `1px solid ${borderColor}`,
    boxShadow: isDragging ? "0 4px 12px rgba(0,0,0,0.15)" : "0 1px 3px rgba(0,0,0,0.06)",
    cursor: "grab",
  };

  const handleSave = () => {
    onUpdate(task.id, { title, description });
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === "Escape") {
      setTitle(task.title);
      setDescription(task.description);
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <div ref={setNodeRef} style={{ ...style, cursor: "default" }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          style={{
            width: "100%",
            border: "1px solid #cbd5e1",
            borderRadius: 4,
            padding: "4px 6px",
            marginBottom: 6,
            fontSize: 14,
            fontWeight: 600,
            boxSizing: "border-box",
          }}
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          style={{
            width: "100%",
            border: "1px solid #cbd5e1",
            borderRadius: 4,
            padding: "4px 6px",
            fontSize: 13,
            resize: "vertical",
            boxSizing: "border-box",
          }}
        />
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          <button onClick={handleSave} style={btnStyle("#3b82f6", "#fff")}>Save</button>
          <button onClick={() => { setTitle(task.title); setDescription(task.description); setEditing(false); }} style={btnStyle("#e2e8f0", "#334155")}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {/* Header: title + action buttons */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div
          style={{ fontWeight: 600, fontSize: 14, flex: 1, cursor: "pointer" }}
          onDoubleClick={() => setEditing(true)}
        >
          {task.title}
        </div>
        <div style={{ display: "flex", gap: 4, flexShrink: 0, marginLeft: 8 }}>
          {isBacklog && !hasAgent && onStart && (
            <button
              onClick={(e) => { e.stopPropagation(); onStart(task.id); }}
              style={{ ...iconBtnStyle, color: "#22c55e" }}
              title="Start task (creates worktree + launches agent)"
            >
              &#9654;
            </button>
          )}
          {hasAgent && task.agent!.terminalSessionId && onOpenTerminal && (
            <button
              onClick={(e) => { e.stopPropagation(); onOpenTerminal(task.agent!.terminalSessionId!); }}
              style={{ ...iconBtnStyle, color: "#3b82f6" }}
              title="Open agent terminal"
            >
              &#9638;
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); setEditing(true); }}
            style={{ ...iconBtnStyle, color: "#64748b" }}
            title="Edit"
          >
            &#9998;
          </button>
          {onTrash ? (
            <button
              onClick={(e) => { e.stopPropagation(); onTrash(task.id); }}
              style={{ ...iconBtnStyle, color: "#ef4444" }}
              title="Move to trash"
            >
              &times;
            </button>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
              style={{ ...iconBtnStyle, color: "#ef4444" }}
              title="Delete"
            >
              &times;
            </button>
          )}
        </div>
      </div>

      {/* Description */}
      {task.description && (
        <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
          {task.description}
        </div>
      )}

      {/* Agent status badge + activity */}
      {hasAgent && agentBadge && (
        <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{
              fontSize: 11,
              fontWeight: 600,
              color: agentBadge.color,
              background: agentBadge.bg,
              padding: "2px 8px",
              borderRadius: 10,
            }}>
              {agentBadge.label}
            </span>
            <span style={{ fontSize: 11, color: "#94a3b8" }}>
              {task.agent!.agentName}
            </span>
          </div>
          {task.agent!.lastActivity && (
            <div style={{
              fontSize: 11,
              color: "#64748b",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>
              {task.agent!.lastActivity}
            </div>
          )}
        </div>
      )}

      {/* Worktree branch */}
      {hasWorktree && !hasAgent && (
        <div style={{
          fontSize: 11,
          color: "#16a34a",
          marginTop: 6,
          padding: "3px 6px",
          background: "#f0fdf4",
          borderRadius: 4,
          fontFamily: "monospace",
        }}>
          {task.worktree!.branch}
        </div>
      )}
    </div>
  );
}

const iconBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  fontSize: 16,
  padding: "0 2px",
  lineHeight: 1,
};

function btnStyle(bg: string, color: string): React.CSSProperties {
  return {
    background: bg,
    color,
    border: "none",
    borderRadius: 4,
    padding: "4px 12px",
    fontSize: 13,
    cursor: "pointer",
    fontWeight: 500,
  };
}
