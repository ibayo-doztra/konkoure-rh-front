---
name: konkoure-api-contracts
description: Use automatically when creating or changing Konkouré API routes, controllers, request validators, response serializers, errors, pagination, filters, idempotency, versioning, or public and webhook endpoints.
---

# Konkouré API contracts

## Use this skill when

Work touches HTTP behavior under `/api/v1`, request/response shapes, status codes, validators, serializers, pagination, or endpoint compatibility.

## Read first

- `docs/backend/01-architecture.md` §§3–10
- The exact endpoint in `docs/backend/06-api-reference.md`
- `docs/backend/05-multi-tenant-securite.md` §§3–4 and §§8–11
- `docs/backend/13-skills-claude.md` §§2–4

## Contract rules

- Keep routes in `/api/v1`; breaking changes require `/api/v2` with at least 90 days of coexistence.
- `/org/*` requires authentication and `X-Organization-Id`; `/platform/*` requires an active platform admin.
- Public routes expose no personal data. Webhooks verify the raw body signature and replay window before parsing or enqueueing.
- Validate every field with VineJS and explicit bounds. Generate slugs server-side.
- Guinean phone numbers use the exact format `NNN NN NN NN` (regex `/^\d{3} \d{2} \d{2} \d{2}$/`) wherever the documented contract requires it; client formatting never replaces server validation.
- Return `{ data }` for success and the canonical `{ error: { code, message, requestId, details? } }` shape for errors.
- Return `404 E_NOT_FOUND`, not 403, for a resource outside the current tenant.
- Whitelist sortable/filterable fields. Use cursor pagination for high-volume resources.
- Sensitive mutations marked in the reference use `Idempotency-Key` and replay the original response.
- Never expose stacks, hashes, tokens, secrets, raw NFC UID, private file paths, or unapproved salary/identity fields.

## Implementation sequence

1. Locate the documented endpoint and permission.
2. Define the validator and normalized DTO.
3. Authorize with Bouncer before mutation.
4. Call one service operation.
5. Serialize only fields authorized for the actor.
6. Map expected domain exceptions to canonical codes in the global handler.
7. Update `06-api-reference.md` only if the approved contract changes.

## Tests and completion

- Test success, malformed input, unauthenticated access, forbidden role, foreign tenant, and documented conflicts.
- Test pagination boundaries, filter allowlists, and idempotent replay where relevant.
- For uploads, test magic bytes, maximum size, and a misleading extension.
- For webhooks, test invalid signature, stale timestamp, duplicate event, and asynchronous acceptance.
