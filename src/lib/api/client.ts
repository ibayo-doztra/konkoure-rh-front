// Typed HTTP client for the Konkouré AdonisJS API (konkoure-rh-api).
// Contract: konkoure-rh-api/docs/backend/06-api-reference.md (base `/api/v1`,
// envelope `{ data, meta }`, errors `{ error: { code, message, requestId, details } }`).
import i18n from "@/lib/i18n";

export const API_BASE_URL = `${String(import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "")}/api/v1`;

export type ApiErrorCode =
  | "E_BAD_REQUEST"
  | "E_UNAUTHORIZED"
  | "E_TOKEN_EXPIRED"
  | "E_FORBIDDEN"
  | "E_MODULE_NOT_INCLUDED"
  | "E_SUBSCRIPTION_INACTIVE"
  | "E_NOT_FOUND"
  | "E_CONFLICT"
  | "E_PAYLOAD_TOO_LARGE"
  | "E_VALIDATION"
  | "E_ACCOUNT_LOCKED"
  | "E_PASSWORD_RESET_REQUIRED"
  | "E_RATE_LIMITED"
  | "E_INTERNAL"
  | "E_DEPENDENCY_UNAVAILABLE"
  /** Client-side only: the network request itself failed. */
  | "E_NETWORK"
  /** Client-side only: the screen has not been migrated to the API yet. */
  | "E_NOT_MIGRATED"
  | (string & {});

export interface ApiErrorDetail {
  field: string;
  rule: string;
  message: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly requestId?: string;
  readonly details: ApiErrorDetail[];

  constructor(
    status: number,
    code: ApiErrorCode,
    message: string,
    opts: { requestId?: string; details?: ApiErrorDetail[] } = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.requestId = opts.requestId;
    this.details = opts.details ?? [];
  }
}

export function isApiError(e: unknown, code?: ApiErrorCode): e is ApiError {
  return e instanceof ApiError && (code === undefined || e.code === code);
}

export interface Paginated<T> {
  data: T[];
  meta: {
    total?: number;
    perPage?: number;
    currentPage?: number;
    lastPage?: number;
    nextCursor?: string | null;
  };
}

// ---------------------------------------------------------------------------
// Session state. The access token lives in memory only (never localStorage);
// the refresh token is an httpOnly cookie set by the API (04-auth-rbac §1).
// Only ever mutated in the browser — never during SSR.
// ---------------------------------------------------------------------------

let accessToken: string | null = null;
let organizationId: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}
export function getAccessToken() {
  return accessToken;
}
export function setOrganizationId(id: string | null) {
  organizationId = id;
}
export function getOrganizationId() {
  return organizationId;
}

type ApiEvent = "unauthorized" | "module-forbidden";
const listeners = new Map<ApiEvent, Set<(e: ApiError) => void>>();

/** Subscribe to global API failures (401 after refresh, module 403). */
export function onApiEvent(event: ApiEvent, fn: (e: ApiError) => void): () => void {
  const set = listeners.get(event) ?? new Set();
  set.add(fn);
  listeners.set(event, set);
  return () => set.delete(fn);
}
function emit(event: ApiEvent, e: ApiError) {
  listeners.get(event)?.forEach((fn) => fn(e));
}

// ---------------------------------------------------------------------------
// Refresh across tabs. Tabs share the refresh cookie, and the API revokes the
// whole session when a consumed refresh token is presented again (04-auth-rbac
// §1), so only one tab may rotate at a time. A rotation also invalidates the
// previous access token: the new one is handed to the other tabs, in memory.
// ---------------------------------------------------------------------------

const REFRESH_LOCK = "konkoure.auth.refresh";
const SESSION_CHANNEL = "konkoure.auth.session";

let sessionChannel: BroadcastChannel | null | undefined;

function getSessionChannel(): BroadcastChannel | null {
  if (sessionChannel === undefined) {
    sessionChannel =
      typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(SESSION_CHANNEL);
    sessionChannel?.addEventListener(
      "message",
      (event: MessageEvent<{ accessToken?: unknown }>) => {
        if (typeof event.data?.accessToken === "string") accessToken = event.data.accessToken;
      },
    );
  }
  return sessionChannel;
}

function withRefreshLock<T>(fn: () => Promise<T>): Promise<T> {
  if (typeof navigator === "undefined" || !navigator.locks) return fn();
  return navigator.locks.request(REFRESH_LOCK, fn) as Promise<T>;
}

let refreshing: Promise<boolean> | null = null;

/**
 * Rotates tokens with the refresh cookie. Single-flight inside a tab, serialized
 * between tabs; a tab that received a fresher token while waiting does not rotate.
 */
export function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    const channel = getSessionChannel();
    const tokenBefore = accessToken;
    try {
      return await withRefreshLock(async () => {
        if (accessToken && accessToken !== tokenBefore) return true;
        const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: "POST",
          credentials: "include",
          headers: { Accept: "application/json", "Content-Type": "application/json" },
          body: "{}",
        });
        if (!res.ok) {
          accessToken = null;
          return false;
        }
        const json = (await res.json()) as { data: { accessToken: string } };
        accessToken = json.data.accessToken;
        channel?.postMessage({ accessToken });
        return true;
      });
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
  /** Required by the API on mutations marked ⚡ in 06-api-reference. */
  idempotencyKey?: string;
  /** Send `X-Organization-Id` (default: true for `/org/*` paths). */
  withOrganization?: boolean;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: RequestOptions["query"]) {
  const url = new URL(`${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`);
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  return url.toString();
}

async function toApiError(res: Response): Promise<ApiError> {
  try {
    const json = (await res.json()) as {
      error?: { code?: string; message?: string; requestId?: string; details?: ApiErrorDetail[] };
    };
    const err = json.error ?? {};
    return new ApiError(
      res.status,
      err.code ?? `HTTP_${res.status}`,
      err.message ?? res.statusText,
      {
        requestId: err.requestId,
        details: err.details,
      },
    );
  } catch {
    return new ApiError(res.status, `HTTP_${res.status}`, res.statusText);
  }
}

/** Low-level request returning the full JSON body (`{ data, meta }`). */
export async function apiRequest<T>(
  path: string,
  opts: RequestOptions = {},
  retried = false,
): Promise<T> {
  const method = opts.method ?? "GET";
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Accept-Language": (i18n.resolvedLanguage || i18n.language || "fr").slice(0, 2),
  };
  if (opts.body !== undefined && !(opts.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  const sentToken = accessToken;
  if (sentToken) headers.Authorization = `Bearer ${sentToken}`;
  const withOrg = opts.withOrganization ?? (path === "/org" || path.startsWith("/org/"));
  if (withOrg && organizationId) headers["X-Organization-Id"] = organizationId;
  if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;

  let res: Response;
  try {
    res = await fetch(buildUrl(path, opts.query), {
      method,
      headers,
      credentials: "include",
      body:
        opts.body === undefined
          ? undefined
          : opts.body instanceof FormData
            ? opts.body
            : JSON.stringify(opts.body),
      signal: opts.signal,
    });
  } catch (e) {
    if ((e as Error)?.name === "AbortError") throw e;
    throw new ApiError(0, "E_NETWORK", (e as Error)?.message ?? "Network error");
  }

  if (res.status === 204) return undefined as T;
  if (res.ok) return (await res.json()) as T;

  const error = await toApiError(res);

  // `/auth/*` calls are public, where a 401 means bad credentials, except these.
  // Logout must reach the API: otherwise the refresh cookie keeps the session alive.
  const usesSession =
    !path.startsWith("/auth/") || path === "/auth/resend-verification" || path === "/auth/logout";

  // Expired access token: refresh once, then replay. Never loop (04-auth-rbac §1).
  // Another tab may already have rotated the session while this request was in flight.
  if (res.status === 401 && !retried && usesSession) {
    const alreadyRenewed = accessToken !== null && accessToken !== sentToken;
    if (alreadyRenewed || (await refreshSession())) return apiRequest<T>(path, opts, true);
  }
  if (res.status === 401 && usesSession) emit("unauthorized", error);
  if (error.code === "E_MODULE_NOT_INCLUDED") emit("module-forbidden", error);
  throw error;
}

/** Unwraps the `data` envelope. */
async function data<T>(path: string, opts: RequestOptions): Promise<T> {
  const json = await apiRequest<{ data: T }>(path, opts);
  return json?.data as T;
}

export const api = {
  get: <T>(
    path: string,
    query?: RequestOptions["query"],
    opts: Omit<RequestOptions, "method" | "query" | "body"> = {},
  ) => data<T>(path, { ...opts, method: "GET", query }),
  list: <T>(
    path: string,
    query?: RequestOptions["query"],
    opts: Omit<RequestOptions, "method" | "query" | "body"> = {},
  ) => apiRequest<Paginated<T>>(path, { ...opts, method: "GET", query }),
  post: <T>(path: string, body?: unknown, opts: Omit<RequestOptions, "method" | "body"> = {}) =>
    data<T>(path, { ...opts, method: "POST", body }),
  put: <T>(path: string, body?: unknown, opts: Omit<RequestOptions, "method" | "body"> = {}) =>
    data<T>(path, { ...opts, method: "PUT", body }),
  patch: <T>(path: string, body?: unknown, opts: Omit<RequestOptions, "method" | "body"> = {}) =>
    data<T>(path, { ...opts, method: "PATCH", body }),
  delete: <T = void>(path: string, opts: Omit<RequestOptions, "method"> = {}) =>
    data<T>(path, { ...opts, method: "DELETE" }),
};

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}
