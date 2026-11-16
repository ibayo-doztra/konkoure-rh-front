---
name: konkoure-legacy-migration
description: Use automatically when writing, reviewing, or running Konkouré legacy data migration from the existing Supabase PostgreSQL application to the new AdonisJS schema, including ETL, table mapping, files, password reset, rehearsal, cutover, validation, or rollback.
---

# Konkouré legacy migration

## Read first

- `docs/backend/12-migration-donnees.md`
- Target schema in `docs/backend/02-schema-db.md`
- Migration/model conventions in `docs/backend/03-migrations-models.md`
- Operational rollback in `docs/backend/11-deploiement-ops.md`

## Migration invariants

- Follow preparation, rehearsal, and final cutover; do not introduce bidirectional dual-write.
- The Ace ETL is table-selectable, dry-runnable, batched, restartable, and idempotent with a durable legacy ID map.
- Preserve valid UUIDs where possible and follow the documented import dependency order.
- Apply every documented source-to-target transformation exactly, including enum translations, review fusion, OKR key-result expansion, and ledger/attendance recalculation.
- Password hashes are not recoverable; imported users require password reset at first login.
- Do not migrate social tokens or public document URLs. Copy files to private storage and verify checksums.
- Do not log source credentials or personal payloads. Migration reports contain counts and safe identifiers only.
- Cutover remains blocked until all automated cardinality, orphan, tenant, badge, balance, OKR, owner, and subscription checks pass.

## Workflow

1. Rehearse from a fresh anonymized copy in staging.
2. Run dry-run and per-table reports, then full import in dependency order.
3. Verify automated checks and representative organizations.
4. During the approved window, freeze legacy writes, back up, import, verify, switch clients/integrations, and smoke test.
5. Abort and restore legacy writes on any blocking check or window overrun.

## Required tests

- Idempotent rerun, batch restart, invalid legacy values, ID remapping, cross-tenant FK prevention, merge conflicts, file missing/checksum mismatch, password-reset flag, cardinality equality, and rollback rehearsal.
