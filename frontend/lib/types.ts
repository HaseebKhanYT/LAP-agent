export type RunStatus =
  | "pending"
  | "running"
  | "paused"
  | "completed"
  | "failed";

export interface Run {
  id: string;
  platform_name: string;
  base_url: string;
  status: RunStatus;
  phase: string;
  coverage: {
    states: number;
    elements: number;
    workflows: number;
    verified: number;
  };
  created_at: string;
  updated_at: string;
}

export interface RunEvent {
  run_id: string;
  ts: string;
  type: string;
  node: string;
  message: string;
  data?: Record<string, unknown>;
}

export type ApprovalStatus = "pending" | "approved" | "denied" | "skipped";

export interface Approval {
  id: string;
  run_id: string;
  action: string;
  risk_class: string;
  target: string;
  state_id: string;
  status: ApprovalStatus;
  created_at: string;
}

export interface Platform {
  name: string;
  base_url: string;
  last_learned: string | null;
  capability_count: number;
  state_count: number;
  freshness: string;
}

export interface Capability {
  id: string;
  name: string;
  goal: string;
  status: string;
  confidence: number;
  parameters: { name: string; type: string; required: boolean }[];
}

export interface RecipeStep {
  index: number;
  state: string;
  action: string;
  element: string;
  expected: string;
}

export interface Recipe {
  capability: string;
  platform: string;
  parameters: { name: string; type: string; required: boolean }[];
  steps: RecipeStep[];
  provenance: string[];
  confidence: number;
  last_verified: string | null;
}

export interface UIMapNode {
  id: string;
  label: string;
  url_pattern: string;
  region: string;
}

export interface UIMapEdge {
  from: string;
  to: string;
  action: string;
  element: string;
}

export interface UIMap {
  platform: string;
  states: UIMapNode[];
  transitions: UIMapEdge[];
}

export interface Health {
  status: string;
  redis: boolean;
  llm_configured: boolean;
}

/** Discriminated result type returned by every API client call. */
export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/** Payload for creating a new learning run. */
export interface CreateRunInput {
  platform_name: string;
  base_url: string;
  allowlist?: string[];
  max_steps?: number;
}

export type ApprovalDecision = "approve" | "deny" | "skip";
