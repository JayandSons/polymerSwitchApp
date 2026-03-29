import { useState, useCallback, useEffect, useRef } from "react";
import { TerminalView } from "./TerminalView.js";
import { trpc } from "../lib/trpc.js";

interface TermTab {
  id: string;
  sessionId: string;
  label: string;
}

interface TerminalPanelProps {
  open: boolean;
  onToggle: () => void;
  focusSessionId?: string | null;
}

export function TerminalPanel({ open, onToggle, focusSessionId }: TerminalPanelProps) {
  const [tabs, setTabs] = useState<TermTab[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [height, setHeight] = useState(300);
  const resizing = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);

  const createTab = useCallback(async () => {
    const session = await trpc.terminal.create.mutate({});
    const tab: TermTab = {
      id: crypto.randomUUID(),
      sessionId: session.id,
      label: `Terminal ${tabs.length + 1}`,
    };
    setTabs((prev) => [...prev, tab]);
    setActiveTab(tab.id);
  }, [tabs.length]);

  const closeTab = useCallback(async (tabId: string) => {
    const tab = tabs.find((t) => t.id === tabId);
    if (tab) {
      await trpc.terminal.kill.mutate({ id: tab.sessionId }).catch(() => {});
    }
    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== tabId);
      if (activeTab === tabId) {
        setActiveTab(next.length > 0 ? next[next.length - 1].id : null);
      }
      return next;
    });
  }, [tabs, activeTab]);

  // Auto-create first terminal when panel opens (unless focusing an agent session)
  useEffect(() => {
    if (open && tabs.length === 0 && !focusSessionId) {
      createTab();
    }
  }, [open]);

  // Focus an agent's terminal session
  useEffect(() => {
    if (!open || !focusSessionId) return;

    // Check if we already have a tab for this session
    const existing = tabs.find((t) => t.sessionId === focusSessionId);
    if (existing) {
      setActiveTab(existing.id);
      return;
    }

    // Create a new tab for the agent session
    const tab: TermTab = {
      id: crypto.randomUUID(),
      sessionId: focusSessionId,
      label: `Agent`,
    };
    setTabs((prev) => [...prev, tab]);
    setActiveTab(tab.id);
  }, [focusSessionId, open]);

  // Resize drag handling
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    resizing.current = true;
    startY.current = e.clientY;
    startHeight.current = height;
    e.preventDefault();
  }, [height]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!resizing.current) return;
      const delta = startY.current - e.clientY;
      setHeight(Math.max(150, Math.min(window.innerHeight - 100, startHeight.current + delta)));
    };
    const onUp = () => { resizing.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  if (!open) return null;

  return (
    <div style={{
      position: "fixed",
      bottom: 0,
      left: 0,
      right: 0,
      height,
      display: "flex",
      flexDirection: "column",
      background: "#1e1e2e",
      borderTop: "2px solid #313244",
      zIndex: 900,
    }}>
      {/* Resize handle */}
      <div
        onMouseDown={handleMouseDown}
        style={{
          height: 4,
          cursor: "ns-resize",
          background: "transparent",
          position: "absolute",
          top: -2,
          left: 0,
          right: 0,
          zIndex: 10,
        }}
      />

      {/* Tab bar */}
      <div style={{
        display: "flex",
        alignItems: "center",
        background: "#181825",
        borderBottom: "1px solid #313244",
        padding: "0 8px",
        height: 36,
        flexShrink: 0,
      }}>
        {tabs.map((tab) => (
          <div
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "4px 12px",
              fontSize: 13,
              color: activeTab === tab.id ? "#cdd6f4" : "#6c7086",
              background: activeTab === tab.id ? "#313244" : "transparent",
              borderRadius: "4px 4px 0 0",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginRight: 2,
            }}
          >
            <span>{tab.label}</span>
            <span
              onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
              style={{ fontSize: 14, color: "#6c7086", cursor: "pointer", lineHeight: 1 }}
            >
              &times;
            </span>
          </div>
        ))}
        <button
          onClick={createTab}
          style={{
            background: "none",
            border: "none",
            color: "#6c7086",
            fontSize: 18,
            cursor: "pointer",
            padding: "2px 8px",
            lineHeight: 1,
          }}
          title="New terminal"
        >
          +
        </button>
        <div style={{ flex: 1 }} />
        <button
          onClick={onToggle}
          style={{
            background: "none",
            border: "none",
            color: "#6c7086",
            fontSize: 14,
            cursor: "pointer",
            padding: "2px 8px",
          }}
          title="Close terminal (⌘J)"
        >
          &#9660;
        </button>
      </div>

      {/* Terminal views */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        {tabs.map((tab) => (
          <TerminalView
            key={tab.id}
            sessionId={tab.sessionId}
            active={tab.id === activeTab}
          />
        ))}
      </div>
    </div>
  );
}
