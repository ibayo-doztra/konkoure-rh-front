// Placeholders for data access that has not been migrated to the AdonisJS API yet.
//
// Every former Supabase query / server function now calls one of these helpers with
// the target endpoint from konkoure-rh-api/docs/backend/06-api-reference.md. They
// reject with `E_NOT_MIGRATED`, so screens render their error/empty state instead of
// crashing. Migrating a screen = replacing its `pending*` calls with `api.*` calls
// (docs/frontend/06-migration-front-plan.md). `grep -rn "pending" src` lists what is left.
import { ApiError } from "@/lib/api/client";

/** Legacy screens are untyped until migrated; the real types come with each API module. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Untyped = any;

export function notMigratedError(endpoint: string): ApiError {
  return new ApiError(501, "E_NOT_MIGRATED", `Non migré vers l'API : ${endpoint}`);
}

/**
 * Former Supabase query builder. Resolves to the `{ data, error }` shape the screen
 * still destructures, with `error` always set, so existing error branches run.
 */
export async function pendingQuery(
  endpoint: string,
): Promise<{ data: Untyped; error: ApiError; count: null }> {
  return { data: null, error: notMigratedError(endpoint), count: null };
}

/** Former TanStack server function. Same call signature, always rejects. */
export function pendingFn(endpoint: string): (input?: Untyped) => Promise<Untyped> {
  return async () => {
    throw notMigratedError(endpoint);
  };
}
