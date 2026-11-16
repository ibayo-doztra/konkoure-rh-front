# Authentification côté frontend

- Remplacer `useAuth` (Supabase) par un `AuthProvider` qui stocke le jeton d'accès opaque émis par AdonisJS (`docs/backend/04-auth-rbac.md`). Stockage : cookie HttpOnly posé par l'API (préféré, même domaine parent `konkoure.doztra.cloud`) ou mémoire + rafraîchissement.
- Écrans : `/login`, `/signup`, `/reset-password`, `/invitation`, `/onboarding/organization`.
- Connexion Google : flux OAuth géré par l'API (`/v1/auth/google/start` → callback → redirection vers `window.location.origin`, puis navigation vers la page demandée mémorisée).
- `GET /v1/me` au démarrage : profil, rôles, organisation active, employé lié, statut super-admin, abonnement et modules ; mis en cache TanStack Query.
- Session expirée : comportement actuel `forceLocalSignOut` à conserver (effacer la session locale, vider le cache, aller à `/login`) ; aucun message « permission denied » affiché.
- Garde de route `_authenticated` : redirection si absence de session ; `/konkoureoffice` : `is_platform_admin` requis ; garde par module selon `/v1/me`.
- Toutes les autorisations restent vérifiées par l'API ; le frontend ne fait que masquer.
- Migration des comptes : voir `docs/backend/12-migration-donnees.md` (réinitialisation forcée si les hachages ne sont pas importables).
