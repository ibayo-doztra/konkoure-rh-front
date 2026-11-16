# Plan de migration du frontend

Chaque lot se termine quand : écrans du lot fonctionnels contre l'API, aucune référence Supabase restante dans le lot, tests e2e du parcours associé verts, FR/EN complet.

| Lot | Contenu | Pré-requis API |
|---|---|---|
| 0 | Monorepo `apps/web`, client API, `VITE_API_URL`, gestion d'erreurs, `AuthProvider`, `/v1/me` | auth, me |
| 1 | Login, signup, reset, invitation, onboarding | auth, organizations |
| 2 | Layout app, notifications, paramètres organisation, tableau de bord | notifications, dashboard |
| 3 | Employés, départements, contrats, import, badge | hr |
| 4 | Congés, jours fériés, solde | leaves |
| 5 | Pointage (scan, journaux, zones) + mobile Flutter | timeclock |
| 6 | Performance | performance |
| 7 | Recrutement + carrières publiques + n8n + réseaux sociaux | recruitment, integrations |
| 8 | Talents | talents |
| 9 | Facturation (checkout, paiement avant inscription) | billing, Djomy |
| 10 | Back office `/konkoureoffice` | platform |
| 11 | Nettoyage : suppression Supabase, routes Lovable, server functions ; bascule DNS | migration des données |

Ne jamais mélanger dans un même écran des appels Supabase et API pour une même ressource.
