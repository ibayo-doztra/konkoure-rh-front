// Former TanStack server functions (src/lib/*.functions.ts, now archived in
// konkoure-rh-api/docs/legacy-supabase/front/). Each name is kept so screens compile,
// mapped to its target endpoint (06-api-reference.md). Migrating a screen means
// replacing these imports with a real `src/lib/api/<domain>.ts` module.
import { pendingFn } from "@/lib/api/pending";

// Leaves
export const listHolidays = pendingFn("GET /org/holidays");
export const upsertHoliday = pendingFn("POST|PATCH /org/holidays");
export const deleteHoliday = pendingFn("DELETE /org/holidays/:id");
export const getEmployeeLeaveBalance = pendingFn("GET /org/leaves/balances");

// Timeclock
export const scanNfcBadge = pendingFn("POST /org/timeclock/scan");
export type ScanNfcBadgeResult =
  | {
      ok: true;
      type: "ARRIVEE" | "DEPART";
      timestamp: string;
      deduped: boolean;
      employee: { id: string; first_name: string; last_name: string; photo_url: string | null };
    }
  | {
      ok: false;
      error: "FORBIDDEN" | "BADGE_UNKNOWN_OR_INACTIVE" | "INTERNAL_ERROR";
      message: string;
    };

// Recruitment / careers
export const getPublicOrganization = pendingFn("GET /public/careers/:orgSlug");
export const createPublicApplicationUpload = pendingFn(
  "POST /public/careers/:orgSlug/jobs/:jobSlug/apply",
);
export const recordPublicApplication = pendingFn(
  "POST /public/careers/:orgSlug/jobs/:jobSlug/apply",
);
export const getPlatformAdminStatus = pendingFn("GET /me (isPlatformAdmin)");

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

// Leaves (requests)
export const listLeaveRequests = pendingFn("GET /org/leaves");
export const createLeaveRequest = pendingFn("POST /org/leaves");
export const decideLeaveRequest = pendingFn("POST /org/leaves/:id/approve|reject");
export const cancelLeaveRequest = pendingFn("POST /org/leaves/:id/cancel");
export const computeWorkingDays = pendingFn("GET /org/leaves/calendar");

// Social publishing
export const listSocialAccounts = pendingFn("GET /org/integrations/social/accounts");
export const disconnectSocialAccount = pendingFn("DELETE /org/integrations/social/accounts/:id");
export const checkProviderConfig = pendingFn("GET /org/integrations/social/accounts");
export const publishJobToSocials = pendingFn("POST /org/recruitment/jobs/:id/social-posts");
export const listJobSocialPosts = pendingFn("GET /org/recruitment/jobs/:id/social-posts");

// Recruitment webhook (n8n)
export const updateRecruitmentWebhookConfig = pendingFn("PUT /org/recruitment/webhooks");
export const pingRecruitmentWebhook = pendingFn("POST /org/recruitment/webhooks/ping");

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
