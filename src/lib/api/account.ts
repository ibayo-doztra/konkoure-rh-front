// Profile, password and sessions of the signed-in user — 06-api-reference §2.
import { queryOptions } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

/**
 * The response carries no organization context (`subscription: null`, `modules: []`):
 * callers must re-read the session with `useAuth().reload()` rather than use it.
 */
export function updateProfile(changes: { fullName?: string; preferredLanguage?: "fr" | "en" }) {
  return api.patch<unknown>("/me", changes);
}

export function changePassword(input: {
  currentPassword: string;
  password: string;
  password_confirmation: string;
}) {
  return api.post<void>("/me/password", input);
}

export interface UserSession {
  id: string;
  deviceLabel: string | null;
  ip: string | null;
  userAgent: string | null;
  startedAt: string;
  lastActivityAt: string | null;
  expiresAt: string;
  current: boolean;
}

export const sessionsKey = ["me", "sessions"] as const;

export const sessionsQuery = () =>
  queryOptions({
    queryKey: sessionsKey,
    queryFn: () => api.get<UserSession[]>("/me/sessions"),
  });

export function revokeSession(id: string) {
  return api.delete(`/me/sessions/${encodeURIComponent(id)}`);
}

/**
 * `GET /me/export` (06 §2): queues the personal-data export, `202 { jobId }`. The API
 * e-mails a link valid 24 h. One per hour (`429 E_RATE_LIMITED`), refused while
 * impersonating.
 */
export function requestDataExport() {
  return api.get<{ jobId: string }>("/me/export");
}

/**
 * `DELETE /me` (06 §2): anonymizes the account and closes every session. `422` on
 * `password`; `409 E_CONFLICT` with one `organizations.<id>` detail (rule `lastOwner`)
 * per organization the user is the only active owner of, or `platform` (`lastRoot`).
 */
export function deleteAccount(password: string) {
  return api.delete("/me", { body: { password } });
}
