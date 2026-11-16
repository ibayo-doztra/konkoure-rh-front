# Offres et droits

- Types d'offre : `trial`, `starter`, `pro`, `enterprise` (table `plans`, gérée depuis le back office : prix GNF, quotas, modules).
- **Essai** : 30 jours, tous modules sauf `recruitment` et `talents`.
- Contrôle d'accès à un module : côté serveur à chaque requête (équivalent actuel : `private.org_has_module` dans 23 politiques RLS + `src/lib/entitlements.server.ts`). Le frontend masque seulement ; page `/app/module-indisponible`.
- Quota d'employés appliqué à la création (actuel : trigger `employees_enforce_plan_quota`).
- Colonnes d'abonnement de l'organisation modifiables uniquement par le serveur de facturation.
- Réglage plateforme `modules_open_for_testing` : ouvre tous les modules à toutes les organisations. **Actif temporairement, à désactiver avant le lancement commercial.**
