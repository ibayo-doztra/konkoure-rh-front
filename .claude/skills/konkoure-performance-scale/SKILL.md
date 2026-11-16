---
name: konkoure-performance-scale
description: Use automatically when optimizing Konkouré throughput, latency, PostgreSQL queries or indexes, Redis cache, BullMQ load, pagination, reporting, partitions, concurrency, dashboards, exports, or peak timeclock traffic.
---

# Konkouré performance and scalability

## Read first

- `docs/backend/09-performance-scalabilite.md`
- `docs/backend/01-architecture.md` §§1, 7–10
- `docs/backend/03-migrations-models.md` partition/index guidance
- `docs/backend/08-jobs-events-integrations.md` queue guidance

## Targets and rules

- Protect the pointage path: no synchronous external call and p99 under the documented budget.
- Keep API replicas stateless; shared state belongs in PostgreSQL or Redis.
- Use tenant-leading indexes, explicit selects, preloads/withCount, cursor pagination, aggregates, and short transactions.
- Never perform N+1 relation access or high OFFSET scans.
- Cache keys include organization and role scope when authorization affects content.
- Use cache-aside and anti-stampede locking; invalidate on documented mutations.
- Queue work over 200 ms unless the response requires it. Audit writes remain synchronous.
- Keep queue Redis free from eviction and separate from cache/limiter data.

## Workflow

1. Identify the route budget and expected cardinality.
2. Capture the query plan and query count.
3. Fix query shape before adding cache; add an index only with a demonstrated access pattern.
4. Define cache TTL, scope, and invalidation together.
5. Move nonessential work after commit and into the correct queue.
6. Exercise concurrency, duplicate delivery, retries, and idempotency.

## Verification

- `EXPLAIN ANALYZE` shows no inappropriate sequential scan over large tables.
- Functional output is unchanged across cached/uncached paths.
- Required k6 scenario meets p95/error/queue/database thresholds.
- Metrics and alerts expose regressions and queue saturation.
