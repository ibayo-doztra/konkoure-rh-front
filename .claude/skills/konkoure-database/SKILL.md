---
name: konkoure-database
description: Use automatically when designing or changing Konkouré PostgreSQL tables, Lucid migrations, models, repositories, constraints, indexes, triggers, partitions, seeders, factories, or transactional data access.
---

# Konkouré database and Lucid

## Read first

- `docs/backend/02-schema-db.md`
- `docs/backend/03-migrations-models.md`
- `docs/backend/05-multi-tenant-securite.md` §§1–3 and §7
- `docs/backend/09-performance-scalabilite.md` §§2–6

## Schema invariants

- Use UUID v7 application-generated IDs and UTC `timestamptz`; use `date` for date-only business facts.
- Every business table has a non-null `organization_id`, its foreign key, and tenant-leading indexes. Global/platform tables must be explicitly documented exceptions.
- Money is `numeric(14,2)` with ISO 4217 currency; GNF is the default.
- Referenced entities use `deleted_at`; repositories exclude deleted rows by default.
- Add database constraints for invariant structure and application validation for contextual rules.
- Time-dependent checks do not use PostgreSQL `CHECK` constraints.
- High-volume tables follow documented monthly partitioning.
- Never edit a deployed migration; add a new reversible migration.

## Migration workflow

1. Confirm the table/column exists in `02-schema-db.md` and the migration order in `03-migrations-models.md`.
2. Implement `up()` and `down()`, foreign keys, constraints, tenant-leading indexes, and the updated-at trigger.
3. Add the Lucid model with explicit serialization and relations.
4. Put all data access in a repository that cannot operate without tenant context.
5. Use `withTenant()` so `SET LOCAL app.org_id` and the mutation share one transaction.
6. Add factories and seed reference data only where documented.

## Forbidden patterns

- `Model.find(id)` or unscoped `Model.query()` on client-provided IDs.
- Raw SQL outside migrations and justified aggregate/reporting queries.
- Cross-tenant foreign keys, nullable tenant IDs, hidden N+1 access, or high OFFSET pagination.
- External calls inside transactions or silent catch-and-continue around data errors.

## Verification

- Test `up → down → up`, constraints, triggers, uniqueness, and tenant isolation.
- Run `EXPLAIN ANALYZE` for new list queries expected to exceed 10,000 rows.
- Confirm soft-delete behavior and serialized sensitive-field exclusions.
