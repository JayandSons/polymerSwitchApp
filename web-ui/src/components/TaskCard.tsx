import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Task } from "../lib/types.js";

interface TaskCardProps {
  task: Task;
  onUpdate: (id: string, patch: Partial<Pick<Task, "title" | "description">>) => void;
  onDelete: (id: string) => void;
}

export function TaskCard({ task, onUpdate, onDelete }: TaskCardProps) {
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

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    padding: "10px 12px",
    marginBottom: 8,
    background: "#fff",
    borderRadius: 6,
    border: "1px solid #e2e8f0",
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div
          style={{ fontWeight: 600, fontSize: 14, flex: 1, cursor: "pointer" }}
          onDoubleClick={() => setEditing(true)}
        >
          {task.title}
        </div>
        <div style={{ display: "flex", gap: 4, flexShrink: 0, marginLeft: 8 }}>
          <button
            onClick={(e) => { e.stopPropagation(); setEditing(true); }}
            style={{ ...iconBtnStyle, color: "#64748b" }}
            title="Edit"
          >
            &#9998;
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
            style={{ ...iconBtnStyle, color: "#ef4444" }}
            title="Delete"
          >
            &times;
          </button>
        </div>
      </div>
      {task.description && (
        <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
          {task.description}
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
