import { execSync, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export interface WorktreeInfo {
  path: string;
  branch: string;
  head: string;
}

export class WorktreeManager {
  private repoRoot: string;
  private worktreeDir: string;

  constructor(repoRoot: string) {
    this.repoRoot = repoRoot;
    this.worktreeDir = path.join(repoRoot, ".kanban", "worktrees");
    fs.mkdirSync(this.worktreeDir, { recursive: true });
  }

  create(taskId: string): WorktreeInfo {
    const wtPath = path.join(this.worktreeDir, taskId);
    const branch = `kanban/${taskId}`;

    if (fs.existsSync(wtPath)) {
      // Already exists, return its info
      return this.getInfo(wtPath, branch);
    }

    // Create worktree with a new branch
    execFileSync("git", ["worktree", "add", wtPath, "-b", branch], {
      cwd: this.repoRoot,
      stdio: "pipe",
    });

    // Symlink common dependency directories to avoid redundant installs
    this.symlinkDeps(wtPath);

    return this.getInfo(wtPath, branch);
  }

  remove(taskId: string): boolean {
    const wtPath = path.join(this.worktreeDir, taskId);
    const branch = `kanban/${taskId}`;

    if (!fs.existsSync(wtPath)) return false;

    // Remove the worktree
    try {
      execFileSync("git", ["worktree", "remove", wtPath, "--force"], {
        cwd: this.repoRoot,
        stdio: "pipe",
      });
    } catch {
      // If git worktree remove fails, clean up manually
      fs.rmSync(wtPath, { recursive: true, force: true });
      try {
        execFileSync("git", ["worktree", "prune"], {
          cwd: this.repoRoot,
          stdio: "pipe",
        });
      } catch {}
    }

    // Delete the branch
    try {
      execFileSync("git", ["branch", "-D", branch], {
        cwd: this.repoRoot,
        stdio: "pipe",
      });
    } catch {
      // Branch may already be gone
    }

    return true;
  }

  list(): WorktreeInfo[] {
    const output = execFileSync("git", ["worktree", "list", "--porcelain"], {
      cwd: this.repoRoot,
      encoding: "utf-8",
    });

    const worktrees: WorktreeInfo[] = [];
    const entries = output.split("\n\n").filter(Boolean);

    for (const entry of entries) {
      const lines = entry.trim().split("\n");
      let wtPath = "";
      let head = "";
      let branch = "";

      for (const line of lines) {
        if (line.startsWith("worktree ")) {
          wtPath = line.slice("worktree ".length);
        } else if (line.startsWith("HEAD ")) {
          head = line.slice("HEAD ".length);
        } else if (line.startsWith("branch ")) {
          branch = line.slice("branch refs/heads/".length);
        }
      }

      // Only include kanban worktrees
      if (branch.startsWith("kanban/")) {
        worktrees.push({ path: wtPath, branch, head });
      }
    }

    return worktrees;
  }

  has(taskId: string): boolean {
    const wtPath = path.join(this.worktreeDir, taskId);
    return fs.existsSync(wtPath);
  }

  getPath(taskId: string): string {
    return path.join(this.worktreeDir, taskId);
  }

  private getInfo(wtPath: string, branch: string): WorktreeInfo {
    let head = "";
    try {
      head = execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: wtPath,
        encoding: "utf-8",
      }).trim();
    } catch {}

    return { path: wtPath, branch, head };
  }

  private symlinkDeps(wtPath: string) {
    // Common directories to symlink instead of copy
    const dirs = ["node_modules", ".venv", "vendor"];

    for (const dir of dirs) {
      const source = path.join(this.repoRoot, dir);
      const target = path.join(wtPath, dir);

      if (fs.existsSync(source) && !fs.existsSync(target)) {
        try {
          fs.symlinkSync(source, target, "dir");
        } catch {
          // Symlink may fail on some systems, that's ok
        }
      }
    }
  }
}
