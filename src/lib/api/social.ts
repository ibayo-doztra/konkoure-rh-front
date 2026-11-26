// Social publishing of job offers — 06-api-reference §8 « Publication sur les réseaux
// sociaux » (modules `integrations`, and `recruitment` to publish). LinkedIn company
// pages and Facebook pages; X stays in the API enum but is not connected.
import { queryOptions } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api/client";
import { recruitmentKey } from "@/lib/api/recruitment";

/** Networks a member can connect. `twitter` exists in the API but answers 422. */
export type SocialProvider = "linkedin" | "facebook";
export const SOCIAL_PROVIDERS: SocialProvider[] = ["linkedin", "facebook"];

export type SocialAccountStatus = "active" | "expired" | "revoked";

/**
 * One LinkedIn or Facebook page, as a recruiter sees it (enough to publish).
 * Tokens are never sent by the API.
 */
export interface SocialAccountSummary {
  id: string;
  provider: SocialProvider;
  accountName: string;
  status: SocialAccountStatus;
}

/** Full view, for owner and hr_admin. */
export interface SocialAccount extends SocialAccountSummary {
  accountId: string;
  scopes: string[];
  tokenExpiresAt: string | null;
  connectedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export type SocialPostStatus = "pending" | "published" | "failed";

export interface SocialPost {
  id: string;
  jobId: string;
  /** `null` once the account has been disconnected. */
  socialAccountId: string | null;
  accountName: string | null;
  provider: SocialProvider;
  content: string;
  status: SocialPostStatus;
  externalPostId: string | null;
  externalUrl: string | null;
  errorMessage: string | null;
  publishedAt: string | null;
  createdAt: string;
}

/** Bounds of `POST /org/recruitment/jobs/:id/social-posts`. */
export const MAX_ACCOUNTS_PER_POST = 10;
export const MAX_POST_LENGTH = 3000;

const socialKey = (organizationId: string) => ["org", organizationId, "social"] as const;

/**
 * Owner and hr_admin get {@link SocialAccount}; a recruiter gets the
 * {@link SocialAccountSummary} only, so readers outside the settings page must
 * not rely on the other fields.
 */
export const socialAccountsQuery = (organizationId: string) =>
  queryOptions({
    queryKey: [...socialKey(organizationId), "accounts"],
    queryFn: () => api.get<SocialAccount[]>("/org/integrations/social/accounts"),
    retry: false,
  });

export const invalidateSocialAccounts = (organizationId: string) => ({
  queryKey: [...socialKey(organizationId), "accounts"],
});

/**
 * Starts the OAuth flow: the browser goes to the returned URL, and the API sends it
 * back to `/app/settings/integrations?connected=<provider>&count=<n>` or `?error=<code>`.
 * 503 `E_DEPENDENCY_UNAVAILABLE` while the network's credentials are not configured.
 */
export async function startSocialConnection(provider: SocialProvider) {
  const { authorizationUrl } = await api.post<{ authorizationUrl: string }>(
    "/org/integrations/social/accounts",
    { provider },
  );
  return authorizationUrl;
}

export function disconnectSocialAccount(id: string) {
  return api.delete(`/org/integrations/social/accounts/${encodeURIComponent(id)}`);
}

/** Codes of `?error=` on the way back from the network. */
export const SOCIAL_CONNECT_ERRORS = [
  "invalid_state",
  "denied",
  "forbidden",
  "no_pages",
  "provider_error",
  "unavailable",
] as const;
export type SocialConnectError = (typeof SOCIAL_CONNECT_ERRORS)[number];

const postsPath = (jobId: string) =>
  `/org/recruitment/jobs/${encodeURIComponent(jobId)}/social-posts`;

/** Most recent first, 100 at most. */
export const jobSocialPostsQuery = (organizationId: string, jobId: string) =>
  queryOptions({
    queryKey: [...recruitmentKey(organizationId), "jobs", "detail", jobId, "social-posts"],
    queryFn: () => api.get<SocialPost[]>(postsPath(jobId)),
    retry: false,
  });

/**
 * One `pending` post per account, sent by the API's queue with the link to the offer
 * on the careers page. 409 `rule = "notPublished"`; 422 `field = "accountIds"` when an
 * account is unknown or not active.
 */
export function publishJobToSocials(jobId: string, accountIds: string[], content: string) {
  return api.post<SocialPost[]>(postsPath(jobId), { accountIds, content });
}

/** AI text and hashtags for one network (1 credit), without link nor salary. */
export async function suggestSocialPost(jobId: string, provider: SocialProvider, language: string) {
  const { content } = await api.post<{ content: string }>(`${postsPath(jobId)}/suggest`, {
    provider,
    language,
  });
  return content;
}

/** The network's credentials are not configured on the API. */
export const isSocialUnavailable = (e: unknown) =>
  e instanceof ApiError && (e.code === "E_DEPENDENCY_UNAVAILABLE" || e.status === 503);

export const isJobNotPublished = (e: unknown) =>
  e instanceof ApiError && e.status === 409 && e.details.some((d) => d.rule === "notPublished");

export const isInactiveAccount = (e: unknown) =>
  e instanceof ApiError && e.status === 422 && e.details.some((d) => d.field === "accountIds");
