// Former TanStack server functions (src/lib/*.functions.ts, now archived in
// konkoure-rh-api/docs/legacy-supabase/front/). Each name is kept so screens compile,
// mapped to its target endpoint (06-api-reference.md). Migrating a screen means
// replacing these imports with a real `src/lib/api/<domain>.ts` module.
import { pendingFn } from "@/lib/api/pending";

// Social publishing
export const listSocialAccounts = pendingFn("GET /org/integrations/social/accounts");
export const disconnectSocialAccount = pendingFn("DELETE /org/integrations/social/accounts/:id");
export const checkProviderConfig = pendingFn("GET /org/integrations/social/accounts");
export const publishJobToSocials = pendingFn("POST /org/recruitment/jobs/:id/social-posts");
export const listJobSocialPosts = pendingFn("GET /org/recruitment/jobs/:id/social-posts");
