// Current organization, members and invitations — 06-api-reference §3.
import { queryOptions } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { AppRole } from "@/lib/permissions";

export const LIST_PAGE_SIZE = 25;

export interface OrganizationDetail {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  countryCode: string;
  timezone: string;
  defaultLanguage: string;
  defaultCurrency: string;
  performanceModel: "classic" | "sap";
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationChanges {
  name?: string;
  defaultLanguage?: "fr" | "en";
  performanceModel?: "classic" | "sap";
}

export const organizationQuery = (organizationId: string) =>
  queryOptions({
    queryKey: ["org", organizationId, "detail"],
    queryFn: () => api.get<OrganizationDetail>("/org"),
  });

/**
 * `PUT /org/settings` replaces the whole block (absent keys take their
 * default): callers merge their change into the settings read from `GET /org`.
 */
export function updateOrganizationSettings(settings: Record<string, unknown>) {
  return api.put<OrganizationDetail>("/org/settings", settings);
}

export function updateOrganization(changes: OrganizationChanges) {
  return api.patch<OrganizationDetail>("/org", changes);
}

/** The API checks the real file type and the 2 MB limit. */
export function uploadOrganizationLogo(file: File) {
  const form = new FormData();
  form.append("logo", file);
  return api.post<OrganizationDetail>("/org/logo", form);
}

export function deleteOrganization(confirmName: string) {
  return api.delete("/org", { body: { confirmName } });
}

export interface Member {
  userId: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  roles: AppRole[];
  joinedAt: string;
}

export const membersKey = (organizationId: string) => ["org", organizationId, "members"] as const;

export const membersQuery = (organizationId: string, page: number) =>
  queryOptions({
    queryKey: [...membersKey(organizationId), page],
    queryFn: () => api.list<Member>("/org/members", { page, perPage: LIST_PAGE_SIZE }),
  });

export function updateMemberRoles(userId: string, roles: AppRole[]) {
  return api.patch<Member>(`/org/members/${encodeURIComponent(userId)}/roles`, { roles });
}

export function removeMember(userId: string) {
  return api.delete(`/org/members/${encodeURIComponent(userId)}`);
}

export interface Invitation {
  id: string;
  email: string;
  role: AppRole;
  /** Employee record linked to the account when the invitation is accepted. */
  employeeId: string | null;
  status: "pending" | "accepted" | "revoked" | "expired";
  expiresAt: string;
  invitedBy: string | null;
  sendCount: number;
  lastSentAt: string | null;
  acceptedAt: string | null;
  createdAt: string;
}

export const invitationsKey = (organizationId: string) =>
  ["org", organizationId, "invitations"] as const;

export const pendingInvitationsQuery = (organizationId: string, page: number) =>
  queryOptions({
    queryKey: [...invitationsKey(organizationId), "pending", page],
    queryFn: () =>
      api.list<Invitation>("/org/invitations", {
        page,
        perPage: LIST_PAGE_SIZE,
        "filter[status]": "pending",
      }),
  });

export const allPendingInvitationsQuery = (organizationId: string) =>
  queryOptions({
    queryKey: [...invitationsKey(organizationId), "pending", "all"],
    queryFn: () => api.all<Invitation>("/org/invitations", { "filter[status]": "pending" }),
  });

export function createInvitation(
  input: { email: string; role: AppRole; employeeId?: string },
  idempotencyKey: string,
) {
  return api.post<Invitation>("/org/invitations", input, { idempotencyKey });
}

export function resendInvitation(id: string) {
  return api.post<Invitation>(`/org/invitations/${encodeURIComponent(id)}/resend`);
}

export function revokeInvitation(id: string) {
  return api.delete(`/org/invitations/${encodeURIComponent(id)}`);
}
