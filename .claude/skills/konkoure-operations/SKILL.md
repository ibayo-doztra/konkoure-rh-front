---
name: konkoure-operations
description: Use automatically when changing Konkouré environment configuration, Docker images, deployment, workers, PostgreSQL or Redis operations, secrets, logging, metrics, health checks, backups, restoration, incidents, maintenance mode, or rollback procedures.
---

# Konkouré deployment and operations

## Read first

- `docs/backend/11-deploiement-ops.md`
- `docs/backend/09-performance-scalabilite.md` §§8–11
- `docs/backend/05-multi-tenant-securite.md` §§9, 12–13

## Operational invariants

- Validate every environment variable in `start/env.ts`; use `env.get()` elsewhere.
- No production `.env`, hardcoded credential, token in logs, or secret in an image.
- Build and run as non-root. API and worker share an immutable image but use separate commands.
- Deploy backward-compatible migrations before API replicas, then workers.
- Column removal uses expand/migrate/contract across releases.
- Health readiness checks PostgreSQL, Redis, and migration state; liveness only checks process health.
- Structured Pino logs include request and tenant correlation, with sensitive-key redaction.
- Backups, PITR, and object versioning are incomplete until restoration is tested.

## Change workflow

1. Classify impact on API, worker, database, Redis, object storage, and providers.
2. Define deployment order and compatibility with the previous release.
3. Define metrics, alerts, rollback, and any maintenance behavior.
4. Test image build, migration reversibility, readiness, graceful shutdown, and worker retry behavior.
5. Update the runbook when response steps or thresholds change.

## Ask before deciding

Ask before destructive migration, provider change, secret-rotation policy change, retention reduction, or rollback that can discard data.
