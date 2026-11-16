---
name: konkoure-billing
description: Use automatically when implementing or changing Konkouré plans, subscriptions, free trials, module entitlements, quotas, Djomy checkout or webhooks, Orange Money, MTN MoMo, card payments, invoices, pre-signup payment claims, cancellation, or reconciliation.
---

# Konkouré billing, Djomy, and entitlements

## Read first

- Billing schema in `docs/backend/02-schema-db.md`
- Billing permissions in `docs/backend/04-auth-rbac.md` §5
- Billing/public/webhook endpoints in `docs/backend/06-api-reference.md` §§10–12
- `docs/backend/07-regles-metier.md` §§6–7
- Relevant integration rules in `docs/backend/08-jobs-events-integrations.md`

## Domain invariants

- Resolve modules centrally through `EntitlementService`; enforce server-side middleware, never client visibility alone.
- The 30-day free trial includes all modules except recruitment and talents. Expiry preserves data and allows HR read-only plus billing.
- Cancellation never cuts access immediately; access lasts through `current_period_end`. Apply grace and suspended/expired behavior exactly as documented.
- Compute expected payment amount server-side from plan and cycle. Never accept an authoritative amount from the client.
- Create a pending payment before calling Djomy. Direct mobile money uses Guinean phone format; card may return the provider portal URL.
- Mark success only after signed webhook receipt and server-side transaction verification of status and amount.
- Webhooks are raw-body verified, replay-safe, quickly acknowledged, and processed asynchronously.
- Activation extends an existing valid period, emits audit/e-mail, invalidates entitlement cache, and generates the invoice.
- Pre-signup claim tokens are random, hashed, e-mail-bound, expiring, and single-use; claim creates organization/subscription atomically.
- Only owners operate organization billing; only platform root performs manual reconciliation/overrides.

## Required tests

- Trial modules/expiry, every subscription state, cancellation grace, quota, upgrade prorata, downgrade refusal, amount tampering, each method, bad/duplicate/late webhook, underpayment, provider outage, idempotency, claim expiry/reuse/e-mail mismatch, period extension, cache invalidation, and audit.
