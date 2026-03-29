import { useState, useCallback, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { KanbanColumn } from "./KanbanColumn.js";
import { CreateTaskModal } from "./CreateTaskModal.js";
import { TerminalPanel } from "./TerminalPanel.js";
import { useTaskStore } from "../lib/useTaskStore.js";
import { COLUMNS, type Column, type Task } from "../lib/types.js";

export function Board() {
  const { tasks, createTask, updateTask, deleteTask, reorderTask } = useTaskStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [terminalOpen, setTerminalOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const tasksByColumn = (col: Column) =>
    tasks.filter((t) => t.column === col);

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null;

  // Cmd+J / Ctrl+J to toggle terminal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "j") {
        e.preventDefault();
        setTerminalOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);
      if (!over) return;

      const taskId = active.id as string;
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;

      let targetColumn: Column;
      let targetOrder: number;

      const columnIds = COLUMNS.map((c) => c.id);
      if (columnIds.includes(over.id as Column)) {
        targetColumn = over.id as Column;
        targetOrder = tasksByColumn(targetColumn).filter((t) => t.id !== taskId).length;
      } else {
        const overTask = tasks.find((t) => t.id === over.id);
        if (!overTask) return;
        targetColumn = overTask.column;
        const columnTasks = tasksByColumn(targetColumn)
          .filter((t) => t.id !== taskId)
          .sort((a, b) => a.order - b.order);
        const overIndex = columnTasks.findIndex((t) => t.id === over.id);
        targetOrder = overIndex >= 0 ? overIndex : columnTasks.length;
      }

      if (task.column === targetColumn && task.order === targetOrder) return;
      reorderTask(taskId, targetColumn, targetOrder);
    },
    [tasks, reorderTask],
  );

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#f8fafc" }}>
      {/* Header */}
      <header style={{
        padding: "12px 24px",
        borderBottom: "1px solid #e2e8f0",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "#fff",
      }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#0f172a" }}>
          Kanban Agent Runner
        </h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={() => setTerminalOpen((v) => !v)}
            style={{
              padding: "8px 12px",
              background: terminalOpen ? "#334155" : "#e2e8f0",
              color: terminalOpen ? "#fff" : "#334155",
              border: "none",
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
            }}
            title="Toggle terminal (⌘J)"
          >
            Terminal
          </button>
          <button
            onClick={() => setModalOpen(true)}
            style={{
              padding: "8px 16px",
              background: "#3b82f6",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            + New Task
          </button>
        </div>
      </header>

      {/* Board */}
      <div style={{ flex: 1, overflow: "auto", padding: 20, paddingBottom: terminalOpen ? 320 : 20 }}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div style={{ display: "flex", gap: 16, minHeight: "100%" }}>
            {COLUMNS.map((col) => (
              <KanbanColumn
                key={col.id}
                id={col.id}
                label={col.label}
                tasks={tasksByColumn(col.id)}
                onUpdate={updateTask}
                onDelete={deleteTask}
              />
            ))}
          </div>
          <DragOverlay>
            {activeTask ? (
              <div style={{
                padding: "10px 12px",
                background: "#fff",
                borderRadius: 6,
                border: "1px solid #e2e8f0",
                boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                maxWidth: 300,
              }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{activeTask.title}</div>
                {activeTask.description && (
                  <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>{activeTask.description}</div>
                )}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      <CreateTaskModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreate={createTask}
      />

      <TerminalPanel
        open={terminalOpen}
        onToggle={() => setTerminalOpen((v) => !v)}
      />
    </div>
  );
}
