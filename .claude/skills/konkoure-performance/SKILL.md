---
name: konkoure-performance
description: Use automatically when implementing or changing Konkouré goals, OKRs, key results, check-ins, performance cycles or plans, self or manager reviews, review signature, feedback, achievements, talent 9-box, or succession planning.
---

# Konkouré performance, OKR, and talent

## Read first

- Performance/talent schema in `docs/backend/02-schema-db.md`
- Performance permissions in `docs/backend/04-auth-rbac.md` §5
- Performance endpoints in `docs/backend/06-api-reference.md` §9
- `docs/backend/07-regles-metier.md` §5

## Domain invariants

- Respect the organization performance model while allowing classic and OKR records to coexist.
- Goal weights cannot exceed 100 per employee and active plan. Only managers/admins may choose another owner within scope.
- OKR lifecycle is `draft → pending → validated` or `pending → needs_revision → pending`; revision comments are required.
- Validated OKR content is frozen; progress and check-ins remain editable. Trigger-derived progress is authoritative.
- Manager validates, requests revision, follows check-ins, and reads OKRs in reviews; the manager does not rewrite a validated OKR for the employee.
- Reviews follow the documented self → manager → sent-back/validated → employee-signed lifecycle.
- Manager feedback remains visible read-only after sent-back, validation, and signature. Signed reviews are immutable.
- Feedback has a recipient and recorded author; concerns notify HR. Apply privacy rules without making feedback anonymous to authorized HR.
- AI suggestions/summaries are quota-gated, asynchronous where documented, strictly validated, and exclude sensitive fields.

## Required tests

- Goal weight overflow, owner scope, all OKR transitions, trigger progress, monthly check-ins, review send-back/resubmit/validate/sign, manager-comment visibility, signed immutability, feedback privacy/concern notification, 9-box calculation, AI malformed response, and tenant isolation.
