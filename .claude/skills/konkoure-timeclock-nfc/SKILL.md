---
name: konkoure-timeclock-nfc
description: Use automatically when implementing or changing Konkouré NFC badges, UID normalization or hashing, clock-in/out, punches, work zones, geofencing, kiosk/device tokens, attendance aggregates, or Flutter offline timeclock synchronization.
---

# Konkouré timeclock and NFC

## Read first

- Timeclock schema in `docs/backend/02-schema-db.md`
- Pointage permissions in `docs/backend/04-auth-rbac.md` §5
- Timeclock endpoints in `docs/backend/06-api-reference.md` §6
- `docs/backend/07-regles-metier.md` §2
- `docs/backend/05-multi-tenant-securite.md` §6

## Domain invariants

- Normalize badge UIDs exactly as documented, then store and compare only SHA-256 of normalized UID plus server pepper.
- Never log or return a raw UID. Dedicated authorized views may expose only the documented masked/enriched form.
- Badge lookup is active, non-revoked, and tenant-scoped. A badge in another organization is indistinguishable from unknown.
- Scan is authenticated; kiosk tokens have only `timeclock:scan` ability and are revocable.
- Deduce in/out from the employee’s last same-day punch when omitted.
- Enforce duplicate window and idempotent `clientPunchId` behavior.
- Validate circle/polygon zones and accuracy. Apply the configured out-of-zone policy; low accuracy is an anomaly, not silent rejection.
- Offline client time is bounded to −72 hours/+5 minutes; flag clock drift.
- Keep scan fast and free of synchronous provider calls. Recompute daily aggregates asynchronously with nightly consolidation.

## Required tests

- Hex, separated, lowercase, decimal, and leading-zero UID equivalents.
- Unknown/disabled/foreign badge, rate limits, kiosk abilities, duplicate punches, idempotent replay, in/out deduction, zone edge, poor accuracy, offline batch of 200, clock drift, audit on correction, and peak load budget.
