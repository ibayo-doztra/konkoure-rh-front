---
name: konkoure-auth-rbac
description: Use automatically when implementing or reviewing Konkouré login, registration, access or refresh tokens, password flows, invitations, sessions, organization roles, platform roles, Bouncer policies, or authorization matrices.
---

# Konkouré authentication and RBAC

## Read first

- `docs/backend/04-auth-rbac.md`
- `docs/backend/05-multi-tenant-securite.md` §§1–2, §5, §7–9
- Auth, `/me`, membership, and platform endpoints in `docs/backend/06-api-reference.md`

## Authentication invariants

- Use native AdonisJS access tokens: 15-minute access tokens and rotating hashed refresh tokens.
- Refresh reuse revokes the whole family, emits the security audit event, and notifies the user.
- Passwords use the documented Argon2id parameters and strength checks.
- Login responses remain indistinguishable for known and unknown e-mails; enforce lockout and Redis limits.
- Registration does not auto-confirm e-mail. Password reset and invitation tokens are random, hashed, expiring, and single-use.
- Imported legacy users with unavailable hashes must reset their password on first login.

## Authorization invariants

- Roles live in `user_roles`; platform access lives in `platform_admins`. Never store roles on users or employees.
- Organization-role permissions are the union of roles, but team/self/department scopes still apply.
- Every protected action is authorized server-side through Bouncer before the service call.
- Keep at least one active owner. Users cannot remove their own final owner role.
- `root` and `support` are platform roles and never bypass tenant rules accidentally.
- Never infer authorization from client state, token abilities alone, environment e-mail lists, or hidden UI.

## Tests

- Test every endpoint against each relevant role and scope: self, team, department, tenant, platform.
- Test refresh rotation/reuse, lockout, logout-all, invitation expiry/reuse, password reset, disabled users, and last-owner protection.
- Assert that denied cross-tenant resources return 404 and that protected fields never serialize without explicit authorization.
