---
name: konkoure-recruitment
description: Use automatically when implementing or changing Konkouré jobs, careers pages, candidate applications, Guinean phone format, CV documents, recruitment pipeline, candidate notes, hiring, n8n AI CV scoring, CV validity or fraud alerts, recruitment webhooks, or recruitment entitlements.
---

# Konkouré recruitment

## Read first

- Recruitment schema in `docs/backend/02-schema-db.md`
- Recruitment permissions in `docs/backend/04-auth-rbac.md` §5
- Recruitment/public endpoints in `docs/backend/06-api-reference.md` §§8 and 11
- `docs/backend/07-regles-metier.md` §4 (including §4.4 and §4.4bis)
- `docs/backend/08-jobs-events-integrations.md` §§5–7

## Domain invariants

- Apply the `recruitment` entitlement to all private recruitment routes. The free trial excludes this module.
- Generate unique slugs server-side; public pages expose published, non-expired jobs only.
- Public applications enforce rate limits, honeypot/captcha setting, duplicate e-mail rule, required documents, real MIME checks, and private storage.
- Applicant phone is mandatory and must match the Guinean format `NNN NN NN NN` (9 digits, 12 characters) on both client and server; store it as displayed.
- AI scoring runs **only** on application submission through the n8n workflow. Never add a manual score/re-score button, endpoint, service method, or job trigger.
- Accept the n8n payload as a single-element array or object, and normalize both formats into `ai_candidate_name`, `ai_is_valid_cv`, `ai_score`, `ai_justification`, `ai_strengths`, `ai_weaknesses`, `ai_fraud_alert`, `ai_scored_at`.
- An invalid or unparsable AI response keeps the previously stored values and is logged; retries use the documented backoff and have no side effect on terminal failure.
- `ai_is_valid_cv = false` and `ai_fraud_alert = true` are advisory signals surfaced in the UI only. No automatic rejection, stage change, or rejection notification.
- Score display thresholds: below 40, 40 to 69, 70 and above.
- Follow only documented pipeline transitions; hired is terminal, and only HR/admin may move backward.
- Note deletion is limited to the authorized author or HR/admin and emits an event/audit.
- Hiring is transactional, respects employee quota, creates the employee, links the candidate, and closes the job when appropriate.
- Share candidate files only through short-lived scoped signed URLs, including in-page CV preview; do not send unrelated personal or sensitive data to AI/webhooks, and never persist a received `cv_url` as a public link.

## Required tests

- Draft/expired public visibility, duplicate application, invalid phone formats (too short, too long, wrong separators), missing/invalid documents, abuse limits, each pipeline transition, unauthorized note deletion, hiring quota/rollback, legacy and new AI payload normalization, malformed AI response preserving prior values, retry behavior, invalid-CV and fraud-alert rendering without automatic decisions, webhook signature/replay, signed-URL expiry, field redaction, and tenant isolation.


## Candidatures en double et crédits IA

- Avant tout appel au workflow de scoring IA (n8n), vérifier qu'aucune candidature n'existe déjà pour la même offre avec le même email (insensible à la casse) ou le même téléphone.
- Si oui : refuser avec `already_applied`, ne pas émettre d'URL d'upload, ne jamais appeler le workflow. Si la vérification échoue, ne pas appeler le workflow (fail closed).
