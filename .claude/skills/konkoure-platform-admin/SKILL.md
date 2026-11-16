---
name: konkoure-platform-admin
description: Use automatically when implementing or changing the Konkouré platform back-office, root or support access, cross-organization administration, platform settings, plan management, user lookup, impersonation, global logs, demo requests, system health, or manual payment reconciliation.
---

# Konkouré platform administration

## Read first

- Platform schema in `docs/backend/02-schema-db.md` §10
- Platform roles and matrix in `docs/backend/04-auth-rbac.md`
- Platform endpoints in `docs/backend/06-api-reference.md` §13
- Platform audit requirements in `docs/backend/05-multi-tenant-securite.md` §7

## Domain invariants

- Platform roles exist only in `platform_admins`; no production fallback e-mail list.
- `support` is read-oriented plus documented demo-request updates. `root` performs plan, subscription, role, settings, admin, suspend, impersonation, and reconciliation mutations.
- Mark intentional cross-tenant operations explicitly with platform scope. Never let ordinary repositories gain implicit cross-tenant behavior.
- Every root action and impersonation is audited with actor, target, request, before/after, and redaction.
- Impersonation is short-lived, visibly marked, limited, and cannot silently become a permanent credential.
- Platform settings marked secret never serialize their values.
- Global log lists use cursor pagination and documented maximum size.
- Back-office responses still minimize personal and sensitive fields.

## Required tests

- No admin, inactive admin, support vs root matrix, platform/tenant scope separation, last-root protection if implemented, impersonation expiry/audit, secret setting redaction, log pagination/filtering, destructive confirmation, and manual reconciliation audit/idempotency.
