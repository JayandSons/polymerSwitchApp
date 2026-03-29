import { useState, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { KanbanColumn } from "./KanbanColumn.js";
import { CreateTaskModal } from "./CreateTaskModal.js";
import { useTaskStore } from "../lib/useTaskStore.js";
import { COLUMNS, type Column, type Task } from "../lib/types.js";

export function Board() {
  const { tasks, createTask, updateTask, deleteTask, reorderTask } = useTaskStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const tasksByColumn = (col: Column) =>
    tasks.filter((t) => t.column === col);

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null;

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

      // Determine target column and order
      let targetColumn: Column;
      let targetOrder: number;

      // Check if dropped over a column
      const columnIds = COLUMNS.map((c) => c.id);
      if (columnIds.includes(over.id as Column)) {
        targetColumn = over.id as Column;
        targetOrder = tasksByColumn(targetColumn).filter((t) => t.id !== taskId).length;
      } else {
        // Dropped over another task
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
      </header>

      {/* Board */}
      <div style={{ flex: 1, overflow: "auto", padding: 20 }}>
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
    </div>
  );
}
