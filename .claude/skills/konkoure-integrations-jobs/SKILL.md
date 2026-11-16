---
name: konkoure-integrations-jobs
description: Use automatically when implementing or changing Konkouré BullMQ jobs, domain events, scheduled tasks, Resend e-mail, S3-compatible files, AI services or prompts, n8n, social OAuth or publishing, inbound or outbound webhooks, notifications, or asynchronous exports.
---

# Konkouré jobs, events, and integrations

## Read first

- `docs/backend/08-jobs-events-integrations.md`
- `docs/backend/05-multi-tenant-securite.md` §§3–4 and §§10–12
- `docs/backend/09-performance-scalabilite.md` §§5, 7, 9
- Related domain rules in `docs/backend/07-regles-metier.md`

## Integration invariants

- Enqueue only after transaction commit. Jobs carry explicit organization and correlation IDs.
- Make handlers idempotent and safe under retry, duplicate delivery, reordering, and partial provider failure.
- Use documented queues, retry/backoff limits, dead-letter handling, metrics, and alerts.
- Verify inbound signatures, timestamp, raw payload, and unique event ID before work.
- Validate outbound URLs against SSRF and sign organization webhooks.
- Resend uses bilingual templates and records delivery status without leaking addresses in logs.
- Private files require real MIME validation, checksum, registry entry, malware state when enabled, and short signed URLs.
- Social tokens are encrypted and never returned. Provider calls happen in workers.
- AI calls go through one service, use versioned prompts, omit sensitive fields, enforce entitlements/credits, and validate structured output before side effects.
- Exports are asynchronous, bounded, private, expiring, and rate-limited.

## Required tests

- Retry and terminal failure, duplicate job/event, after-commit dispatch, signature and replay, SSRF redirects/private DNS, provider timeout, malformed AI output, quota exhaustion, token redaction, file MIME/checksum/orphan cleanup, expired signed URL, and export abuse limits.
