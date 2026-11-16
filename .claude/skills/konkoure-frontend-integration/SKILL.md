---
name: konkoure-frontend-integration
description: Use automatically when migrating, building, or fixing the Konkouré web frontend (apps/web, TanStack Start) against the AdonisJS API: API client, auth session, queries, mutations, file uploads, i18n, route guards, or removal of Supabase calls.
---

# Konkouré frontend integration

## Read first
- `docs/00-HANDOFF.md`
- `docs/frontend/01-inventaire.md` → find the screen and its current data access
- `docs/frontend/03-integration-api.md` → target endpoint
- `docs/frontend/04-auth-session-front.md`, `05-ui-ux-regles.md`, `06-migration-front-plan.md`
- Endpoint contract in `docs/backend/06-api-reference.md`

Also load `konkoure-api-contracts`, the domain skill, and `konkoure-testing-quality`.

## Invariants
- No `@supabase/*` import or `createServerFn` data access in migrated screens; one API source per resource.
- Initial reads: route loader `ensureQueryData` + `useSuspenseQuery`.
- Never decide authorization in the browser; only hide UI. 401 → local sign-out + `/login`; module 403 → `/app/module-indisponible`.
- Missing endpoint: add it to `06-api-reference.md` and the API first; never call tables directly.
- Preserve UI rules: semantic tokens, dark mode, FR/EN keys (no raw keys), modal standard, phone `XXX XX XX XX`, GNF formatting.
- Files only through API-issued signed URLs.

## Done when
Screen works against the API in FR and EN, light and dark, mobile and desktop; e2e test of the related journey passes; no Supabase reference remains in the batch.
