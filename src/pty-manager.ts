import * as pty from "node-pty";
import os from "node:os";

export interface PtySession {
  id: string;
  pty: pty.IPty;
  cwd: string;
  createdAt: string;
}

export class PtyManager {
  private sessions = new Map<string, PtySession>();
  private dataListeners = new Map<string, Set<(data: string) => void>>();
  private exitListeners = new Map<string, Set<(code: number | undefined) => void>>();

  create(id: string, cwd?: string): PtySession {
    if (this.sessions.has(id)) {
      return this.sessions.get(id)!;
    }

    const shell = os.platform() === "win32" ? "powershell.exe" : process.env.SHELL || "/bin/bash";
    const workingDir = cwd || process.cwd();

    const ptyProcess = pty.spawn(shell, [], {
      name: "xterm-256color",
      cols: 120,
      rows: 30,
      cwd: workingDir,
      env: { ...process.env } as Record<string, string>,
    });

    const session: PtySession = {
      id,
      pty: ptyProcess,
      cwd: workingDir,
      createdAt: new Date().toISOString(),
    };

    this.sessions.set(id, session);
    this.dataListeners.set(id, new Set());
    this.exitListeners.set(id, new Set());

    ptyProcess.onData((data) => {
      const listeners = this.dataListeners.get(id);
      if (listeners) {
        for (const fn of listeners) fn(data);
      }
    });

    ptyProcess.onExit(({ exitCode }) => {
      const listeners = this.exitListeners.get(id);
      if (listeners) {
        for (const fn of listeners) fn(exitCode);
      }
      this.sessions.delete(id);
      this.dataListeners.delete(id);
      this.exitListeners.delete(id);
    });

    return session;
  }

  write(id: string, data: string): boolean {
    const session = this.sessions.get(id);
    if (!session) return false;
    session.pty.write(data);
    return true;
  }

  resize(id: string, cols: number, rows: number): boolean {
    const session = this.sessions.get(id);
    if (!session) return false;
    session.pty.resize(cols, rows);
    return true;
  }

  kill(id: string): boolean {
    const session = this.sessions.get(id);
    if (!session) return false;
    session.pty.kill();
    this.sessions.delete(id);
    this.dataListeners.delete(id);
    this.exitListeners.delete(id);
    return true;
  }

  onData(id: string, fn: (data: string) => void): () => void {
    const listeners = this.dataListeners.get(id);
    if (!listeners) return () => {};
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  onExit(id: string, fn: (code: number | undefined) => void): () => void {
    const listeners = this.exitListeners.get(id);
    if (!listeners) return () => {};
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  list(): { id: string; cwd: string; createdAt: string }[] {
    return Array.from(this.sessions.values()).map((s) => ({
      id: s.id,
      cwd: s.cwd,
      createdAt: s.createdAt,
    }));
  }

  has(id: string): boolean {
    return this.sessions.has(id);
  }

  killAll(): void {
    for (const id of this.sessions.keys()) {
      this.kill(id);
    }
  }
}
