---
name: konkoure-leaves
description: Use automatically when implementing or changing Konkouré leave requests, leave approvals or rejection, requested-day calculation, balances, ledgers, negative balance, holidays, cancellation, carry-over, or manager approval routing.
---

# Konkouré leave management

## Read first

- Leave schema in `docs/backend/02-schema-db.md`
- Leave permissions in `docs/backend/04-auth-rbac.md` §5
- Leave endpoints in `docs/backend/06-api-reference.md` §7
- `docs/backend/07-regles-metier.md` §3 and §9

## Domain invariants

- Calculate `requested_days` server-side in the organization timezone. Never accept it from the client.
- Apply organization weekend/holiday and half-day settings; reject non-positive results.
- Block overlap with pending/approved leave using application checks and the documented database exclusion constraint.
- Only annual and special leave consume their respective balance rules.
- Respect configured negative-balance limits and show the projected balance to approvers.
- A manager never approves their own request; route upward, then to HR/admin.
- Rejection requires a 5–1000 character decision comment.
- Every balance mutation is represented by an immutable ledger entry in the same transaction.
- Approved past leave is locked. Cancellation reverses the ledger only where documented.
- Annual carry-over uses organization settings and Guinea calendar defaults.

## Required tests

- Weekends, fixed/movable holidays, half-days, overlap, negative limits, self-approval, approver fallback, rejection comment, all state transitions, approval/cancellation ledger equality, annual carry-over, timezone boundary, role visibility, and tenant isolation.
