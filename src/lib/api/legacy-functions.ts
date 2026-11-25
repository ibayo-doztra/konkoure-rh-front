// Former TanStack server functions (src/lib/*.functions.ts, now archived in
// konkoure-rh-api/docs/legacy-supabase/front/). Each name is kept so screens compile,
// mapped to its target endpoint (06-api-reference.md). Migrating a screen means
// replacing these imports with a real `src/lib/api/<domain>.ts` module.
import { pendingFn } from "@/lib/api/pending";

// Recruitment / careers
export const getPublicOrganization = pendingFn("GET /public/careers/:orgSlug");
export const createPublicApplicationUpload = pendingFn(
  "POST /public/careers/:orgSlug/jobs/:jobSlug/apply",
);
export const recordPublicApplication = pendingFn(
  "POST /public/careers/:orgSlug/jobs/:jobSlug/apply",
);

// Public
export const submitDemoRequest = pendingFn("POST /public/demo-requests");

// Platform back office (/konkoureoffice)
export const getPlatformSettings = pendingFn("GET /platform/settings");
export const updatePlatformSettings = pendingFn("PUT /platform/settings");
export const listAdminLogs = pendingFn("GET /platform/logs/audit");
export const getAdminUsageStats = pendingFn("GET /platform/logs/usage");
export const listAdminPayments = pendingFn("GET /platform/payments");
export const listAdminDemoRequests = pendingFn("GET /platform/demo-requests");
export const updateAdminDemoRequest = pendingFn("PATCH /platform/demo-requests/:id");

// Social publishing
export const listSocialAccounts = pendingFn("GET /org/integrations/social/accounts");
export const disconnectSocialAccount = pendingFn("DELETE /org/integrations/social/accounts/:id");
export const checkProviderConfig = pendingFn("GET /org/integrations/social/accounts");
export const publishJobToSocials = pendingFn("POST /org/recruitment/jobs/:id/social-posts");
export const listJobSocialPosts = pendingFn("GET /org/recruitment/jobs/:id/social-posts");

// Platform back office — organizations & users
export const searchAdminUsers = pendingFn("GET /platform/users");
export const sendAdminPasswordReset = pendingFn(
  "POST /platform/users/:id/password-reset (absent de 06)",
);
export const setAdminUserBanned = pendingFn("POST /platform/users/:id/ban (absent de 06)");
export const setPlatformAdmin = pendingFn("POST|DELETE /platform/admins");
