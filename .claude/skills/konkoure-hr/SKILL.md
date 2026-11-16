---
name: konkoure-hr
description: Use automatically when building or modifying Konkouré organizations, members, employees, departments, contracts, reporting hierarchy, employee import, employee documents, or employee competency records. This is the HR domain, not an AI coding skill definition.
---

# Konkouré HR domain

## Read first

- HR schema in `docs/backend/02-schema-db.md`
- HR permissions in `docs/backend/04-auth-rbac.md` §5
- Organization, employee, department, contract, and skill endpoints in `docs/backend/06-api-reference.md`
- `docs/backend/07-regles-metier.md` §1

Also load `konkoure-feature-workflow`, `konkoure-tenant-security`, `konkoure-api-contracts`, and `konkoure-testing-quality`.

## Domain invariants

- Enforce plan employee quota on creation and reactivation; terminated employees do not count.
- A user links to at most one employee per organization.
- Prevent self-management and hierarchy cycles to depth 10.
- Manager choices include only active department heads, existing supervisors, or users with manager role.
- Termination closes the active contract, revokes badges, cancels pending leave, removes roles, and reassigns reports while preserving history.
- Employee deletion is soft delete.
- Bulk import is previewed, bounded, duplicate-checked, and committed all-or-nothing with a line report.
- Salary, identity, passport, phone, and personal e-mail serialization follow the role matrix.
- Employee competencies (`skills`, `employee_skills`) are business data and remain separate from `.claude/skills`.

## Required tests

- Quota boundary, duplicate account link, hierarchy cycle, eligible-manager filtering, termination cascade, soft delete, import rollback, salary/document visibility, and cross-tenant IDs.
- Verify employee, department, manager, contract, and competency foreign keys all belong to the same organization.
