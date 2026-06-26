import type {
  ApiResult,
  Approval,
  ApprovalDecision,
  Capability,
  CreateRunInput,
  Health,
  Platform,
  Recipe,
  Run,
  UIMap,
} from "./types";

/** Base URL of the LAP backend. Inlined at build time for the client bundle. */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
  "http://localhost:8000";

const API_PREFIX = "/api/v1";

/** Default request timeout in milliseconds. Keeps SSR fast when backend is down. */
const DEFAULT_TIMEOUT_MS = 5000;

interface RequestOptions extends RequestInit {
  /** Override the default timeout. */
  timeoutMs?: number;
}

/**
 * Wraps fetch with a timeout, JSON parsing, and a typed discriminated result.
 * Never throws: failures (network, timeout, non-2xx, bad JSON) become
 * `{ ok: false, error }` so callers can render fallback UI without try/catch.
 */
async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiResult<T>> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...init } = options;
  const url = `${API_BASE_URL}${API_PREFIX}${path}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
      // Always hit the network; this is operator console data, not static.
      cache: "no-store",
    });

    if (!res.ok) {
      const body = await safeReadText(res);
      return {
        ok: false,
        error: `Request failed (${res.status} ${res.statusText})${
          body ? `: ${truncate(body, 200)}` : ""
        }`,
      };
    }

    // Some endpoints (e.g. 204) may have no body.
    const text = await safeReadText(res);
    if (!text) {
      return { ok: true, data: undefined as unknown as T };
    }

    try {
      return { ok: true, data: JSON.parse(text) as T };
    } catch {
      return { ok: false, error: "Invalid JSON response from backend." };
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return { ok: false, error: "Backend request timed out." };
    }
    return {
      ok: false,
      error:
        err instanceof Error
          ? `Backend unavailable: ${err.message}`
          : "Backend unavailable.",
    };
  } finally {
    clearTimeout(timer);
  }
}

async function safeReadText(res: Response): Promise<string> {
  try {
    return (await res.text()).trim();
  } catch {
    return "";
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

/** Builds the absolute SSE URL for a run's event stream (client-side EventSource). */
export function runEventsUrl(runId: string): string {
  return `${API_BASE_URL}${API_PREFIX}/runs/${encodeURIComponent(
    runId,
  )}/events`;
}

export const api = {
  health(): Promise<ApiResult<Health>> {
    return request<Health>("/health", { timeoutMs: 3000 });
  },

  listRuns(): Promise<ApiResult<Run[]>> {
    return request<Run[]>("/runs");
  },

  getRun(runId: string): Promise<ApiResult<Run>> {
    return request<Run>(`/runs/${encodeURIComponent(runId)}`);
  },

  createRun(input: CreateRunInput): Promise<ApiResult<Run>> {
    return request<Run>("/runs", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  listApprovals(runId: string): Promise<ApiResult<Approval[]>> {
    return request<Approval[]>(
      `/runs/${encodeURIComponent(runId)}/approvals`,
    );
  },

  decideApproval(
    approvalId: string,
    decision: ApprovalDecision,
    note?: string,
  ): Promise<ApiResult<Approval>> {
    return request<Approval>(
      `/approvals/${encodeURIComponent(approvalId)}/decision`,
      {
        method: "POST",
        body: JSON.stringify({ decision, ...(note ? { note } : {}) }),
      },
    );
  },

  listPlatforms(): Promise<ApiResult<Platform[]>> {
    return request<Platform[]>("/platforms");
  },

  listCapabilities(
    platform: string,
    query?: string,
  ): Promise<ApiResult<Capability[]>> {
    const qs = query ? `?query=${encodeURIComponent(query)}` : "";
    return request<Capability[]>(
      `/platforms/${encodeURIComponent(platform)}/capabilities${qs}`,
    );
  },

  getRecipe(
    platform: string,
    capability: string,
  ): Promise<ApiResult<Recipe>> {
    return request<Recipe>(
      `/platforms/${encodeURIComponent(
        platform,
      )}/recipes/${encodeURIComponent(capability)}`,
    );
  },

  getUiMap(platform: string, region?: string): Promise<ApiResult<UIMap>> {
    const qs = region ? `?region=${encodeURIComponent(region)}` : "";
    return request<UIMap>(
      `/platforms/${encodeURIComponent(platform)}/ui-map${qs}`,
    );
  },
};
