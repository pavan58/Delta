import type { Subscription } from "@prisma/client";
import type { Ctx } from "@/lib/sim/engine";

export type FsNode = { type: "file" | "dir"; content?: string; mode: string; mtime: string };
export type ShellState = {
  cwd: string;
  fs: Record<string, FsNode>;
  env: Record<string, string>;
  az: { loggedIn: boolean; identity: string | null; aksContext: { cluster: string; resourceGroup: string } | null };
  services: Record<string, "running" | "stopped">;
};

export type Term = {
  ctx: Ctx;
  state: ShellState;
  sub: Subscription;
  userName: string;
  changes: string[];
};

export type CmdResult = { stdout: string; stderr?: string; exitCode?: number; data?: unknown };

export class CliError extends Error {
  constructor(message: string, public exitCode = 1) {
    super(message);
  }
}

export const HOME = "/home/learner";

export function defaultState(): ShellState {
  const now = new Date().toISOString();
  return {
    cwd: HOME,
    fs: {
      "/": { type: "dir", mode: "755", mtime: now },
      "/home": { type: "dir", mode: "755", mtime: now },
      [HOME]: { type: "dir", mode: "755", mtime: now },
      [`${HOME}/README.txt`]: { type: "file", mode: "644", mtime: now, content: "Welcome to the Azure Gigs sandbox shell.\nThis is a simulated Linux environment: files live in your learner profile, not on a real server.\nTry: az group list -o table | ls -la | cat notes/runbook.md\n" },
      [`${HOME}/notes`]: { type: "dir", mode: "755", mtime: now },
      [`${HOME}/notes/runbook.md`]: { type: "file", mode: "644", mtime: now, content: "# Contoso web tier runbook\n1. Check VM power state: az vm get-instance-view\n2. Check NSG rules: az network nsg rule list\n3. Check app service: az webapp show\n4. Escalate to Rahul Sharma if production impact > 30 min\n" },
      [`${HOME}/Dockerfile`]: { type: "file", mode: "644", mtime: now, content: "FROM node:20-alpine\nWORKDIR /app\nCOPY . .\nRUN npm ci --omit=dev\nEXPOSE 8080\nCMD [\"node\", \"server.js\"]\n" },
      [`${HOME}/deployment.yaml`]: { type: "file", mode: "644", mtime: now, content: "apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: web\nspec:\n  replicas: 2\n  template:\n    spec:\n      containers:\n        - name: web\n          image: nginx:1.27\n          ports:\n            - containerPort: 80\n" },
      ["/var"]: { type: "dir", mode: "755", mtime: now },
      ["/var/log"]: { type: "dir", mode: "755", mtime: now },
      ["/var/log/syslog"]: { type: "file", mode: "640", mtime: now, content: "Nov  9 10:00:01 sandbox CRON[812]: (root) CMD (run-parts /etc/cron.hourly)\nNov  9 10:05:44 sandbox sshd[903]: Accepted publickey for learner\nNov  9 10:06:12 sandbox nginx[1022]: [error] connect() failed (111: Connection refused)\n" },
      ["/etc"]: { type: "dir", mode: "755", mtime: now },
      ["/etc/hostname"]: { type: "file", mode: "644", mtime: now, content: "learner-sandbox\n" },
      ["/etc/os-release"]: { type: "file", mode: "644", mtime: now, content: 'PRETTY_NAME="Ubuntu 22.04.4 LTS (Azure Gigs sandbox)"\n' },
      ["/tmp"]: { type: "dir", mode: "777", mtime: now },
    },
    env: { HOME, USER: "learner", SHELL: "/bin/bash", PATH: "/usr/local/bin:/usr/bin:/bin", AZURE_GIGS: "simulated" },
    az: { loggedIn: false, identity: null, aksContext: null },
    services: { ssh: "running", cron: "running", nginx: "stopped", docker: "running" },
  };
}
