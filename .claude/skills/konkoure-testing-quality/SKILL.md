---
name: konkoure-testing-quality
description: Use automatically when writing, changing, reviewing, or debugging Konkouré tests, Japa suites, factories, CI, lint rules, coverage, load tests, or when completing any backend feature.
---

# Konkouré testing and quality

## Read first

- `docs/backend/10-tests-qualite-ci.md`
- `docs/backend/13-skills-claude.md` §6
- Domain scenarios in `docs/backend/07-regles-metier.md`

## Required test shape

Every endpoint has at least:

1. authorized success;
2. forbidden role or scope;
3. foreign-tenant resource returning 404;
4. invalid input returning canonical 422.

Add documented conflict/state/idempotency/security scenarios. An endpoint without a tenant-isolation test is incomplete.

## Test levels

- Unit: pure calculations and state transitions.
- Integration: repositories, transactions, SQL constraints, triggers, and RLS defense.
- Functional: full route, middleware, validator, policy, service, serialization, and error contract.
- Load: critical pointage, HR navigation, evaluations, and candidature bursts.

Use the dedicated test database, global rollback transactions, isolated Redis, frozen time for temporal behavior, and fakes for Djomy, Resend, AI, social providers, and object storage. CI makes no real external calls.

## Quality gates

- Maintain at least 80% overall and 95% for policies, entitlements, billing, timeclock, leaves, and auth.
- TypeScript strict, no implicit `any`, no unjustified suppression, no `console.log`.
- `node ace check`, focused tests, migration reversibility, security checks, and documentation pass before completion.
- Tests assert outcomes and side effects: audit rows, ledger movements, events/jobs, notification creation, and absence of sensitive output.
