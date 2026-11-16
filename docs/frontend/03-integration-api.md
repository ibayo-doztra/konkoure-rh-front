# Intégration du frontend avec l'API AdonisJS

## Principe
1. Supprimer `@supabase/supabase-js`, `src/integrations/supabase/*` et toutes les `createServerFn` qui touchent aux données.
2. Créer `src/lib/api/client.ts` : `fetch` typé vers `import.meta.env.VITE_API_URL`, en-tête `Authorization: Bearer <token>`, `Accept-Language` = langue active, `Idempotency-Key` sur les mutations sensibles, gestion d'erreurs selon le format de `docs/backend/06-api-reference.md`.
3. Sur 401 : déconnexion locale + redirection `/login`. Sur 403 module : `/app/module-indisponible`.
4. Un module `src/lib/api/<domaine>.ts` par domaine qui expose des `queryOptions` et mutations TanStack Query.
5. Types partagés : générés depuis les validateurs VineJS ou un schéma OpenAPI publié par l'API.
6. Les fichiers (CV, avatars, logos) passent par des URLs signées émises par l'API.

## Correspondance des fonctions serveur actuelles → endpoints
Les chemins exacts font foi dans `docs/backend/06-api-reference.md` ; ajouter tout endpoint manquant là-bas avant de l'utiliser.

| Fichier actuel | Fonction | Endpoint cible |
|---|---|---|
| organizations.functions | createOrganization | `POST /v1/organizations` |
| organizations.functions | uploadOrgLogo | `POST /v1/organizations/:id/logo-upload-url` |
| invitations.functions | inviteEmployeeUser / getEmployeeAccountStates | `POST /v1/employees/:id/invitation`, `GET /v1/employees/account-states` |
| employees.functions | createEmployee / importEmployees | `POST /v1/employees`, `POST /v1/employees/import` |
| employees.functions | getEmployeeSensitive / updateEmployeeProfileDetails | `GET/PATCH /v1/employees/:id/sensitive` |
| employees.functions | getEmployeeBadgeInfo / assignEmployeeBadge / revokeEmployeeBadge | `GET/PUT/DELETE /v1/employees/:id/badge` |
| leaves.functions | listHolidays / upsertHoliday / deleteHoliday | `GET/PUT/DELETE /v1/holidays` |
| leaves.functions | computeWorkingDays | `GET /v1/leaves/working-days` |
| leaves.functions | getEmployeeLeaveBalance | `GET /v1/employees/:id/leave-balance` |
| leaves.functions | listLeaveRequests / createLeaveRequest | `GET/POST /v1/leave-requests` |
| leaves.functions | decideLeaveRequest / cancelLeaveRequest | `POST /v1/leave-requests/:id/decision`, `POST /v1/leave-requests/:id/cancel` |
| timeclock.functions | scanNfcBadge | `POST /v1/timeclock/punches` |
| careers.functions | getPublicOrganization | `GET /v1/public/organizations/:slug` |
| recruitment-webhooks.functions | createPublicApplicationUpload | `POST /v1/public/jobs/:id/application-uploads` (contrôle doublon inclus) |
| recruitment-webhooks.functions | recordPublicApplication | `POST /v1/public/jobs/:id/applications` |
| recruitment-webhooks.functions | updateRecruitmentWebhookConfig / pingRecruitmentWebhook | `PUT /v1/admin/recruitment-webhook`, `POST .../ping` |
| social.functions | listSocialAccounts / disconnectSocialAccount / checkProviderConfig | `GET/DELETE /v1/social-accounts` |
| social.functions | publishJobToSocials / listJobSocialPosts | `POST/GET /v1/jobs/:id/social-posts` |
| billing.functions | createDirectPayment / createDjomyPayment | `POST /v1/billing/payments` |
| billing.functions | refreshPaymentStatus / getPaymentStatus | `GET /v1/billing/payments/:id` |
| billing.functions | getSubscription / cancelSubscription | `GET /v1/billing/subscription`, `POST .../cancel` |
| public-billing.functions | listPublicPlans | `GET /v1/public/plans` |
| public-billing.functions | requestPrepaidEmailCode / startPrepaidPayment | `POST /v1/public/prepaid/codes`, `POST /v1/public/prepaid/payments` |
| public-billing.functions | refreshPrepaidStatus / getPrepaidSummary / claimPrepaidPayment | `GET /v1/public/prepaid/payments/:id`, `POST .../claim` |
| demo-requests.functions | submitDemoRequest | `POST /v1/public/demo-requests` |
| admin/core | getAdminStatus / getAdminOverview / get/updatePlatformSettings | `/v1/platform/*` |
| admin/logs | listAdminLogs / getAdminUsageStats / listAdminDemoRequests / updateAdminDemoRequest / listAdminPayments | `/v1/platform/logs`, `/usage`, `/demo-requests`, `/payments` |
| admin/plans | listAdminPlans / upsertAdminPlan / deleteAdminPlan | `/v1/platform/plans` |
| admin/users | searchAdminUsers / setAdminUserRole / sendAdminPasswordReset / setAdminUserBanned / setPlatformAdmin | `/v1/platform/users/*` |
| admin/organizations | listAdminOrganizations / getAdminOrganization / updateAdminOrganization | `/v1/platform/organizations` |

## Correspondance des accès directs aux tables → endpoints
| Table | Écrans | Endpoint cible |
|---|---|---|
| employees, departments, contracts | employés, départements, contrats, tableau de bord | `/v1/employees`, `/v1/departments`, `/v1/contracts`, `GET /v1/dashboard/kpis?period=` |
| profiles, user_roles, organization_members | hooks de session | `GET /v1/me` (profil, organisation active, rôles, employé lié, abonnement, modules) |
| notifications | cloche | `GET /v1/notifications`, `POST /v1/notifications/:id/read` |
| goals, goal_activities, achievements, okrs, okr_checkins, feedbacks, performance_reviews, review_goal_comments, performance_cycles | performance | `/v1/performance/*` |
| jobs | offres, carrières, sitemap | `/v1/jobs`, `/v1/public/organizations/:slug/jobs` |
| candidates, candidate_notes, candidate_activities | candidats | `/v1/candidates`, `PATCH /v1/candidates/:id/stage`, `/notes`, `/activities`, `GET /v1/candidates/:id/cv-url` |
| skills, reviews, succession_plans | talents | `/v1/talents/*` |
| time_logs, work_zones | pointage | `/v1/timeclock/logs`, `/v1/work-zones` |
| nfc_badge_history | fiche employé | `GET /v1/employees/:id/badge/history` |
| organizations (réglages) | paramètres | `GET/PATCH /v1/organization` |

## Routes API publiques actuelles → API
| Actuel | Cible |
|---|---|
| `api.public.timeclock.scan` | `POST /v1/timeclock/punches` (mobile, token) |
| `api.public.employees.$id.badge`, `assign-badge`, `revoke-badge` | `/v1/employees/:id/badge` |
| `api.public.billing.djomy-webhook.$token` | `POST /v1/webhooks/djomy/:token` |
| `api.public.billing.lifecycle`, `reconcile` | jobs planifiés BullMQ (plus d'URL publique) |
| `api.public.oauth.$provider.$action` | `GET /v1/social/oauth/:provider/{start,callback}` |

Les routes `mcp`, `.mcp`, `.well-known`, `.lovable.oauth.consent` sont propres à Lovable : à supprimer.
