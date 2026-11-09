export type Category = "configuration" | "execution" | "security" | "documentation";

export type Cond = {
  path: string;
  op: "eq" | "neq" | "regex" | "gte" | "lte" | "exists" | "notExists" | "contains" | "in" | "lengthGte" | "some" | "none";
  value?: unknown;
  where?: Cond[];
};

type Base = { category: Category; label: string; hint?: string };

export type Check = Base &
  (
    | { kind: "resource"; type: string; name?: string; resourceGroup?: string; where?: Cond[]; min?: number }
    | { kind: "command"; shell?: "az" | "pwsh" | "bash" | "kql" | "any"; pattern: string; successOnly?: boolean }
    | { kind: "activity"; operation: string; min?: number }
    | { kind: "connectivity"; vm: string; port: number; expect: "Reachable" | "Unreachable"; source?: string }
    | { kind: "nsgNoOpenPort"; ports: number[] }
    | { kind: "rbac"; principal: string; action: string; scope: string; expect: boolean }
    | { kind: "incidentResolved"; faultType: string }
    | { kind: "notes"; minLength: number; keywords?: string[] }
    | { kind: "pipelineRun"; status: "succeeded" | "failed"; project?: string }
    | { kind: "siteHttp"; site: string; status: number }
    | { kind: "storageNoPublic" }
  );

export type LabStepDef = { title: string; body: string };

export type LabDef = {
  slug: string;
  title: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  category: string;
  objective: string;
  scenario: string;
  prerequisites: string[];
  durationMinutes: number;
  steps: LabStepDef[];
  expectedOutcome: string;
  commands: string[];
  commonMistakes: string[];
  hints: string[];
  solution: string;
  interviewQuestions: { q: string; a: string }[];
  checks: Check[];
  isCapstone?: boolean;
  setupFault?: string; // incident fault injected when the lab starts
};
