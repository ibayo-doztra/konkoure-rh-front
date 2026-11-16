---
name: konkoure-feature-workflow
description: Use automatically when adding, modifying, reviewing, or fixing any Konkouré AdonisJS backend feature, endpoint, module, or business workflow. Covers the mandatory end-to-end implementation order and definition of done.
---

# Konkouré feature workflow

## Use this skill when

Any backend task creates or changes a feature. Compose it with the relevant domain skill and with `konkoure-tenant-security`, `konkoure-api-contracts`, and `konkoure-testing-quality`.

Do not use it for the existing TanStack frontend or for the employee competency feature alone without backend work.

## Read first

- `docs/backend/00-README.md` §§3–6
- `docs/backend/01-architecture.md` §§1–5
- `docs/backend/13-skills-claude.md` §§1–8
- The relevant sections of `02-schema-db.md`, `04-auth-rbac.md`, `06-api-reference.md`, and `07-regles-metier.md`

## Mandatory order

1. Confirm the feature and API contract are documented. Never invent a field, endpoint, role, or business rule.
2. Search for an existing module implementing at least 80% of the pattern.
3. Check module entitlement requirements.
4. Create, in order: migration, model, validator, tenant-scoped repository, service, policy, controller, routes, fr/en translations, tests, documentation.
5. Put sensitive mutations and their audit rows in the same transaction.
6. Dispatch e-mail, HTTP, event, and queue work only after commit.
7. Run the focused tests, then `node ace check`.

## Non-negotiable invariants

- Controllers contain HTTP concerns only: no Lucid query, business calculation, generic `try/catch`, or environment access.
- Services contain business rules and transactions, not `HttpContext`.
- Repositories own all queries and always scope tenant data by `organization_id`.
- Bouncer authorizes before every mutation.
- Every input reaches a VineJS validator before the service.
- Code identifiers are English; user messages exist in French and English.
- No `any`, `@ts-ignore`, `console.log`, hardcoded secret, or unapproved dependency.

## Ask before deciding

Ask before adding a dependency, changing an existing API contract or documented rule, writing a destructive migration, adding a provider, weakening security, or storing a new category of personal data.

## Done checklist

- Migration is reversible, indexed, constrained, and backward compatible.
- Model, validator, repository, service, policy, controller, route, translations, and docs agree.
- Success, role refusal, validation, and cross-tenant isolation tests pass.
- Audit, notifications, entitlement, idempotency, and rate limit are handled where required.
- No external I/O occurs inside a transaction.
- `node ace check` and focused tests pass.
