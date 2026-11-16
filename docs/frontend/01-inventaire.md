# Inventaire du frontend

Généré à partir de `src/routes` (77 fichiers). Colonnes : accès directs actuels aux tables Supabase et fonctions serveur appelées.
Chaque ligne doit être remplacée par des appels à l'API AdonisJS (voir `03-integration-api.md`).

Règles d'accès : `App (auth)` = session requise + membre de l'organisation ; `Back office` = super-admin plateforme ;
`API publique` = point d'entrée externe (webhook, mobile, cron) qui vérifie lui-même l'appelant.

| Chemin | Fichier | Accès | Tables lues/écrites | Fonctions serveur |
|---|---|---|---|---|
| `//lovable/oauth/consent` | `[.]lovable.oauth.consent.tsx` | Public | — | — |
| `/app/billing/checkout` | `_authenticated.app.billing.checkout.tsx` | App (auth) | — | createDirectPayment, createDjomyPayment, refreshPaymentStatus |
| `/app/billing` | `_authenticated.app.billing.index.tsx` | App (auth) | — | cancelSubscription, claimPrepaidPayment |
| `/app/billing/return` | `_authenticated.app.billing.return.tsx` | App (auth) | — | getPaymentStatus |
| `/app/contracts` | `_authenticated.app.contracts.tsx` | App (auth) | contracts, employees | — |
| `/app/departments` | `_authenticated.app.departments.tsx` | App (auth) | departments, employees | — |
| `/app/employees/:id` | `_authenticated.app.employees.$id.tsx` | App (auth) | avatars, departments, employees | getEmployeeBadgeInfo, getEmployeeSensitive, inviteEmployeeUser, updateEmployeeProfileDetails |
| `/app/employees` | `_authenticated.app.employees.index.tsx` | App (auth) | departments, employees | createEmployee, getEmployeeAccountStates, inviteEmployeeUser |
| `/app/employees` | `_authenticated.app.employees.tsx` | App (auth) | — | — |
| `/app` | `_authenticated.app.index.tsx` | App (auth) | contracts, employees | — |
| `/app/leaves/holidays` | `_authenticated.app.leaves.holidays.tsx` | App (auth) | — | deleteHoliday, listHolidays, upsertHoliday |
| `/app/leaves` | `_authenticated.app.leaves.index.tsx` | App (auth) | — | cancelLeaveRequest, computeWorkingDays, createLeaveRequest, decideLeaveRequest, getEmployeeLeaveBalance, listHolidays, listLeaveRequests |
| `/app/module-indisponible` | `_authenticated.app.module-indisponible.tsx` | App (auth) | — | — |
| `/app/performance/achievements` | `_authenticated.app.performance.achievements.tsx` | App (auth) | achievements, goals | — |
| `/app/performance/activities` | `_authenticated.app.performance.activities.tsx` | App (auth) | goal_activities, goals | — |
| `/app/performance/feedback` | `_authenticated.app.performance.feedback.tsx` | App (auth) | employees, feedbacks, notifications, okrs | — |
| `/app/performance/goals` | `_authenticated.app.performance.goals.tsx` | App (auth) | employees, goals, performance_reviews | — |
| `/app/performance/okrs` | `_authenticated.app.performance.okrs.tsx` | App (auth) | employees, notifications, okr_checkins, okrs | — |
| `/app/performance/reviews/:id` | `_authenticated.app.performance.reviews.$id.tsx` | App (auth) | employees, goals, notifications, okrs, performance_reviews, review_goal_comments | — |
| `/app/performance/reviews` | `_authenticated.app.performance.reviews.index.tsx` | App (auth) | employees, performance_reviews | — |
| `/app/performance/reviews/new/:planId/:employeeId` | `_authenticated.app.performance.reviews.new.$planId.$employeeId.tsx` | App (auth) | employees, goals, notifications, performance_reviews, review_goal_comments | — |
| `/app/recruitment/candidates` | `_authenticated.app.recruitment.candidates.tsx` | App (auth) | candidate_activities, candidate_notes, candidates, jobs, profiles | — |
| `/app/recruitment/jobs/:id/edit` | `_authenticated.app.recruitment.jobs.$id.edit.tsx` | App (auth) | jobs | — |
| `/app/recruitment/jobs` | `_authenticated.app.recruitment.jobs.index.tsx` | App (auth) | jobs | — |
| `/app/recruitment/jobs/new` | `_authenticated.app.recruitment.jobs.new.tsx` | App (auth) | — | — |
| `/app/settings` | `_authenticated.app.settings.index.tsx` | App (auth) | employees, notifications, organizations, performance_cycles, performance_reviews | — |
| `/app/settings/integrations` | `_authenticated.app.settings.integrations.tsx` | App (auth) | — | checkProviderConfig, disconnectSocialAccount, listSocialAccounts |
| `/app/settings/platform` | `_authenticated.app.settings.platform.tsx` | App (auth) | — | getPlatformAdminStatus, pingRecruitmentWebhook, updateRecruitmentWebhookConfig |
| `/app/talents/9box` | `_authenticated.app.talents.9box.tsx` | App (auth) | reviews | — |
| `/app/talents/skills` | `_authenticated.app.talents.skills.tsx` | App (auth) | skills | — |
| `/app/talents/succession` | `_authenticated.app.talents.succession.tsx` | App (auth) | succession_plans | — |
| `/app/timeclock/logs` | `_authenticated.app.timeclock.logs.tsx` | App (auth) | time_logs | — |
| `/app/timeclock/scan` | `_authenticated.app.timeclock.scan.tsx` | App (auth) | — | scanNfcBadge |
| `/app/timeclock/zones` | `_authenticated.app.timeclock.zones.tsx` | App (auth) | work_zones | — |
| `/app` | `_authenticated.app.tsx` | App (auth) | — | — |
| `/` | `_authenticated.tsx` | App (auth) | — | — |
| `/api/public/billing/djomy-webhook/:token` | `api.public.billing.djomy-webhook.$token.ts` | API publique | webhook_events | — |
| `/api/public/billing/lifecycle` | `api.public.billing.lifecycle.ts` | API publique | notifications, organizations, plans, user_roles | — |
| `/api/public/billing/reconcile` | `api.public.billing.reconcile.ts` | API publique | subscription_payments | — |
| `/api/public/employees/:id/badge` | `api.public.employees.$id.badge.ts` | API publique | employees, nfc_badge_history, user_roles | — |
| `/api/public/employees/assign-badge` | `api.public.employees.assign-badge.ts` | API publique | employees, user_roles | — |
| `/api/public/employees/revoke-badge` | `api.public.employees.revoke-badge.ts` | API publique | employees, user_roles | — |
| `/api/public/oauth/:provider/:action` | `api.public.oauth.$provider.$action.ts` | API publique | social_accounts, user_roles | — |
| `/api/public/timeclock/scan` | `api.public.timeclock.scan.ts` | API publique | — | — |
| `/careers/:slug/:jobSlug` | `careers.$slug.$jobSlug.tsx` | Public | applications, jobs | — |
| `/careers/:slug` | `careers.$slug.index.tsx` | Public | jobs | — |
| `/demo` | `demo.tsx` | Public | — | submitDemoRequest |
| `/employes/:id` | `employes.$id.tsx` | Public | — | — |
| `/` | `index.tsx` | Public | — | — |
| `/invitation` | `invitation.tsx` | Public | — | — |
| `/konkoureoffice/demandes` | `konkoureoffice.demandes.tsx` | Back office | — | listAdminDemoRequests, updateAdminDemoRequest |
| `/konkoureoffice` | `konkoureoffice.index.tsx` | Back office | — | getAdminOverview |
| `/konkoureoffice/journal` | `konkoureoffice.journal.tsx` | Back office | — | getAdminUsageStats, listAdminLogs |
| `/konkoureoffice/offres` | `konkoureoffice.offres.tsx` | Back office | — | deleteAdminPlan, listAdminPlans, upsertAdminPlan |
| `/konkoureoffice/organisations` | `konkoureoffice.organisations.tsx` | Back office | — | getAdminOrganization, listAdminOrganizations, listAdminPlans, updateAdminOrganization |
| `/konkoureoffice/paiements` | `konkoureoffice.paiements.tsx` | Back office | — | listAdminPayments |
| `/konkoureoffice/reglages` | `konkoureoffice.reglages.tsx` | Back office | — | getPlatformSettings, updatePlatformSettings |
| `/konkoureoffice` | `konkoureoffice.tsx` | Back office | — | getAdminStatus |
| `/konkoureoffice/utilisateurs` | `konkoureoffice.utilisateurs.tsx` | Back office | — | searchAdminUsers, sendAdminPasswordReset, setAdminUserBanned, setPlatformAdmin |
| `/login` | `login.tsx` | Public | — | — |
| `/mcp` | `mcp.ts` | Public | — | — |
| `/onboarding/organization` | `onboarding.organization.tsx` | Public | — | claimPrepaidPayment, createOrganization |
| `/paiement` | `paiement.index.tsx` | Public | — | listPublicPlans, requestPrepaidEmailCode, startPrepaidPayment |
| `/paiement/retour` | `paiement.retour.tsx` | Public | — | — |
| `/paiement/suivi` | `paiement.suivi.tsx` | Public | — | — |
| `/reset-password` | `reset-password.tsx` | Public | — | — |
| `/resources/guide-tableau-de-bord-rh` | `resources.guide-tableau-de-bord-rh.tsx` | Public | — | — |
| `/resources/modele-fiche-de-poste-pme` | `resources.modele-fiche-de-poste-pme.tsx` | Public | — | — |
| `/resources/onboarding-guide-africa` | `resources.onboarding-guide-africa.tsx` | Public | — | — |
| `/rh/departements` | `rh.departements.tsx` | Public | — | — |
| `/rh/employes` | `rh.employes.tsx` | Public | — | — |
| `/signup` | `signup.tsx` | Public | — | — |
| `/sitemap/xml` | `sitemap[.]xml.ts` | Public | jobs | — |

## Hooks et composants qui accèdent aux données
| Fichier | Tables |
|---|---|
| `src/hooks/useMyEmployee.tsx` | employees, profiles, user_roles |
| `src/hooks/useOrg.tsx` | organization_members |
| `src/hooks/useProfile.tsx` | profiles |
| `src/hooks/useRole.tsx` | user_roles |
| `src/hooks/useAuth.tsx` | auth (session, refresh, `forceLocalSignOut`) |
| `src/components/NotificationBell.tsx` | notifications |
| `src/components/employees/NfcBadgeCard.tsx` | nfc_badge_history |
| `src/components/jobs/JobForm.tsx` | jobs |
| `src/components/recruitment/CvPreviewDialog.tsx` | stockage `applications` (URL signée) |
