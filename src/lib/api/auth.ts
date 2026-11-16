// Authentication endpoints — 06-api-reference §1, §2, §3 (`POST /organizations`).
import { api, setAccessToken } from "@/lib/api/client";
import type { AuthTokens, Me } from "@/lib/api/types";

export const meQueryKey = ["me"] as const;

export function fetchMe(): Promise<Me> {
  return api.get<Me>("/me");
}

export async function login(input: { email: string; password: string; rememberDevice?: boolean }) {
  const res = await api.post<AuthTokens>("/auth/login", input);
  setAccessToken(res.accessToken);
  return res;
}

export async function register(input: {
  email: string;
  password: string;
  password_confirmation: string;
  fullName: string;
  preferredLanguage?: "fr" | "en";
  acceptTerms: boolean;
}) {
  const res = await api.post<AuthTokens>("/auth/register", input);
  setAccessToken(res.accessToken);
  return res;
}

export async function logout() {
  try {
    await api.post("/auth/logout");
  } finally {
    setAccessToken(null);
  }
}

export function forgotPassword(email: string) {
  return api.post<void>("/auth/forgot-password", { email });
}

export function resetPassword(input: {
  token: string;
  password: string;
  password_confirmation: string;
}) {
  return api.post<void>("/auth/reset-password", input);
}

export interface InvitationPreview {
  organizationName: string;
  email: string;
  role: string;
}

export function getInvitation(token: string) {
  return api.get<InvitationPreview>(`/auth/invitations/${encodeURIComponent(token)}`);
}

export async function acceptInvitation(
  token: string,
  input: { password: string; password_confirmation: string; fullName?: string },
) {
  const res = await api.post<AuthTokens>(
    `/auth/invitations/${encodeURIComponent(token)}/accept`,
    input,
  );
  if (res?.accessToken) setAccessToken(res.accessToken);
  return res;
}

export function createOrganization(input: {
  name: string;
  slug?: string;
  defaultLanguage?: "fr" | "en";
}) {
  return api.post<{ id: string; slug: string }>("/organizations", input);
}
