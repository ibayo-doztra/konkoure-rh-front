---
name: konkoure-tenant-security
description: Use automatically whenever Konkouré code touches organization_id, tenant context, repositories, RLS, authorization boundaries, sensitive data, uploads, audit logs, rate limiting, CORS, SSRF, secrets, public routes, or webhooks.
---

# Konkouré tenant security

## Read first

- `docs/backend/00-README.md` §6
- `docs/backend/05-multi-tenant-securite.md`
- `docs/backend/04-auth-rbac.md` permission matrices
- `docs/backend/13-skills-claude.md` §§4 and 8

## Three mandatory tenant barriers

1. Tenant middleware validates `X-Organization-Id` against `user_roles`.
2. Repositories require an organization ID and add the scope to every query.
3. PostgreSQL residual RLS reads `app.org_id` set locally inside each tenant transaction.

Only explicitly marked platform operations may cross tenants. Background workers use their dedicated role and must receive an explicit organization for tenant jobs.

## Security rules

- Re-read every client-supplied foreign key inside the current organization.
- Return 404 for foreign-tenant resources; reveal no existence signal.
- Validate input bounds and real file signatures. Store private documents behind short-lived signed URLs.
- Redact credentials, tokens, salary, identity documents, NFC UID, and provider secrets from default serialization and logs.
- Write sensitive audit records in the same transaction as the mutation; audit tables are append-only.
- Public endpoints use narrow outputs, honeypots/captcha where documented, and dedicated IP/e-mail limits.
- Incoming webhooks verify raw-body HMAC, timestamp, and event uniqueness before async processing.
- Outbound client URLs pass the complete anti-SSRF procedure before worker execution.
- Secrets come only from validated environment configuration or encrypted database fields.

## Security review checklist

- Enumerate every query path, relation preload, count, export, job, and cache key touched by the change.
- Confirm tenant and role scope on each path.
- Confirm logs and API output contain no sensitive values.
- Add abuse, cross-tenant, upload, webhook, and audit tests relevant to the feature.
- Never weaken a documented control without explicit approval.
