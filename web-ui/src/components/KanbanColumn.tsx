import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { TaskCard } from "./TaskCard.js";
import type { Task, Column } from "../lib/types.js";

interface KanbanColumnProps {
  id: Column;
  label: string;
  tasks: Task[];
  onUpdate: (id: string, patch: Partial<Pick<Task, "title" | "description">>) => void;
  onDelete: (id: string) => void;
  onStart?: (id: string) => void;
  onTrash?: (id: string) => void;
  onOpenTerminal?: (sessionId: string) => void;
}

export function KanbanColumn({ id, label, tasks, onUpdate, onDelete, onStart, onTrash, onOpenTerminal }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  const sorted = [...tasks].sort((a, b) => a.order - b.order);

  return (
    <div
      ref={setNodeRef}
      style={{
        flex: "1 1 0",
        minWidth: 240,
        maxWidth: 340,
        background: isOver ? "#e0f2fe" : "#f1f5f9",
        borderRadius: 8,
        padding: 12,
        display: "flex",
        flexDirection: "column",
        transition: "background 150ms",
      }}
    >
      <div style={{
        fontWeight: 700,
        fontSize: 13,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        color: "#475569",
        marginBottom: 12,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        <span>{label}</span>
        <span style={{
          background: "#cbd5e1",
          borderRadius: 10,
          padding: "1px 8px",
          fontSize: 12,
          fontWeight: 600,
          color: "#334155",
        }}>
          {sorted.length}
        </span>
      </div>
      <div style={{ flex: 1, minHeight: 40 }}>
        <SortableContext items={sorted.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {sorted.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onStart={onStart}
              onTrash={onTrash}
              onOpenTerminal={onOpenTerminal}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}
