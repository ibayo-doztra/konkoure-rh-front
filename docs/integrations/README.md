# Intégrations externes

Toutes les intégrations passent par des services AdonisJS dédiés (`docs/backend/08-jobs-events-integrations.md`), avec délais d'expiration, reprises, idempotence et journalisation sans secret.

## Djomy (paiements Orange Money, MTN, Visa)
- Création de paiement serveur (montant en GNF tiré de l'offre, jamais du client), redirection vers Djomy, page de retour.
- Webhook `POST /v1/webhooks/djomy/:token` : jeton de chemin secret + vérification de signature si disponible ; stockage brut dans `webhook_events` ; traitement idempotent par identifiant de transaction.
- Réconciliation planifiée des paiements en attente ; cycle de vie (expiration, rappels) en job planifié.
- Secrets : `DJOMY_BASE_URL`, `DJOMY_CLIENT_ID`, `DJOMY_CLIENT_SECRET`, `DJOMY_WEBHOOK_PATH_TOKEN`.

## n8n (scoring IA des CV)
- Configuration par plateforme (`recruitment_webhook_configs`) : URL du webhook de production, secret ; modifiable par super-admin ; URL contrôlée contre le SSRF.
- Ping : `{ "ping": true, "source": "konkoure" }` ; le workflow doit répondre immédiatement sur cette branche.
- Appel à la soumission d'une candidature, après enregistrement, avec l'URL signée du CV ; attente synchrone jusqu'à 3 min (le frontend affiche la modale) ; peut devenir asynchrone (job + statut) si le contrat évolue — à valider avant.
- Réponse attendue : tableau `[{ candidate_name, is_valid_cv, match_score (0–100), strengths[], weakness_or_missing[], summary_opinion, fraud_alert, cv_url }]`. Normalisation actuelle : `src/lib/recruitment-webhooks.server.ts` (`match_score` ou `score`).
- Stockage sur le candidat : score, validité, points forts, manques, avis, alerte fraude ; activité `scored`.
- Aucun re-scoring manuel. Un doublon ne déclenche jamais d'appel.

## Resend (e-mails transactionnels)
- Expéditeur `EMAIL_FROM = Konkouré <support@konkoure.doztra.cloud>` ; domaine `konkoure.doztra.cloud` vérifié dans Resend.
- Dans la cible, **tous** les e-mails (y compris authentification : confirmation, réinitialisation, invitation) partent par Resend via `@adonisjs/mail`, gabarits FR/EN.
- Demandes de démo envoyées à l'équipe commerciale.
- Secrets : `RESEND_API_KEY`, `EMAIL_FROM`.

## Google
- **Maps** : carte des zones de travail (`WorkZoneMap.tsx`). Utiliser une clé propre restreinte aux référents `konkoure.doztra.cloud` (la clé gérée par Lovable ne fonctionne pas sur le domaine personnalisé). Variable front `VITE_GOOGLE_MAPS_API_KEY`.
- **Connexion Google** : OAuth via l'API. Secrets `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
- **Search Console** : vérification du domaine, sitemap `/sitemap.xml`.

## Réseaux sociaux (Facebook, LinkedIn, Twitter/X)
OAuth par organisation, jetons chiffrés au repos, publication d'offre avec image (hôtes autorisés `SOCIAL_MEDIA_ALLOWED_HOSTS`), suivi `social_posts`. Secrets client OAuth par fournisseur.

## Liste des variables (sans valeurs)
API : `APP_KEY`, `DATABASE_URL`, `REDIS_URL`, `S3_*`, `SITE_URL`, `CORS_ORIGINS`, `PLATFORM_ADMIN_EMAILS`, `DJOMY_*`, `RESEND_API_KEY`, `EMAIL_FROM`, `GOOGLE_CLIENT_*`, `SOCIAL_*`, `SOCIAL_MEDIA_ALLOWED_HOSTS`, `CRON_TOKEN` (si cron externe).
Web : `VITE_API_URL`, `VITE_GOOGLE_MAPS_API_KEY`, `VITE_SITE_URL`.
Les valeurs actuelles sont dans les secrets Lovable Cloud et doivent être recréées par le propriétaire ; elles ne sont jamais copiées dans le dépôt.
