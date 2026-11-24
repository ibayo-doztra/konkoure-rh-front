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

// Billing
export const getSubscription = pendingFn("GET /org/billing/subscription");
export const getPaymentStatus = pendingFn("GET /org/billing/payments/:id");
export const cancelSubscription = pendingFn("POST /org/billing/cancel");
export const startSubscriptionPayment = pendingFn("POST /org/billing/checkout");
export const listPublicPlans = pendingFn("GET /public/plans");
export const requestPrepaidEmailCode = pendingFn("POST /public/prepaid/codes");
export const startPrepaidPayment = pendingFn("POST /public/payments/checkout");
export const getPrepaidSummary = pendingFn("GET /public/payments/:merchantReference");
export const claimPrepaidPayment = pendingFn("POST /public/payments/:merchantReference/claim");

// Public
export const submitDemoRequest = pendingFn("POST /public/demo-requests");

// Platform back office (/konkoureoffice)
export const getAdminStatus = pendingFn("GET /me (isPlatformAdmin)");
export const getAdminOverview = pendingFn("GET /platform/dashboard");
export const getPlatformSettings = pendingFn("GET /platform/settings");
export const updatePlatformSettings = pendingFn("PUT /platform/settings");
export const listAdminLogs = pendingFn("GET /platform/logs/audit");
export const getAdminUsageStats = pendingFn("GET /platform/logs/usage");
export const listAdminPayments = pendingFn("GET /platform/payments");
export const listAdminDemoRequests = pendingFn("GET /platform/demo-requests");
export const updateAdminDemoRequest = pendingFn("PATCH /platform/demo-requests/:id");
export const listAdminPlans = pendingFn("GET /platform/plans");
export const upsertAdminPlan = pendingFn("POST|PATCH /platform/plans");
export const deleteAdminPlan = pendingFn("DELETE /platform/plans/:id");

// Social publishing
export const listSocialAccounts = pendingFn("GET /org/integrations/social/accounts");
export const disconnectSocialAccount = pendingFn("DELETE /org/integrations/social/accounts/:id");
export const checkProviderConfig = pendingFn("GET /org/integrations/social/accounts");
export const publishJobToSocials = pendingFn("POST /org/recruitment/jobs/:id/social-posts");
export const listJobSocialPosts = pendingFn("GET /org/recruitment/jobs/:id/social-posts");

// Billing checkout
export const createDirectPayment = pendingFn("POST /org/billing/checkout");
export const createDjomyPayment = pendingFn("POST /org/billing/checkout");
export const refreshPaymentStatus = pendingFn("GET /org/billing/payments/:id");

// Platform back office — organizations & users
export const listAdminOrganizations = pendingFn("GET /platform/organizations");
export const getAdminOrganization = pendingFn("GET /platform/organizations/:id");
export const updateAdminOrganization = pendingFn("PATCH /platform/organizations/:id/subscription");
export const searchAdminUsers = pendingFn("GET /platform/users");
export const sendAdminPasswordReset = pendingFn(
  "POST /platform/users/:id/password-reset (absent de 06)",
);
export const setAdminUserBanned = pendingFn("POST /platform/users/:id/ban (absent de 06)");
export const setPlatformAdmin = pendingFn("POST|DELETE /platform/admins");
