# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Konkouré — Instructions Claude Code

## État actuel du dépôt

Ce dépôt est le **frontend web** de Konkouré (TanStack Start, issu de Lovable). **Supabase a été entièrement retiré** : le seul backend est l'API AdonisJS du dépôt voisin `D:/Projects/konkoure-rh-api` (spécifications : `konkoure-rh-api/docs/backend/`, contrat d'API : `06-api-reference.md`). Ne jamais réintroduire `@supabase/*`, `createServerFn` ni un accès direct à une base. L'ancien code Supabase et les server functions Lovable sont archivés, pour référence uniquement, dans `konkoure-rh-api/docs/legacy-supabase/`.

Ce dossier a son propre dépôt git (branche `main`), distinct du dépôt parent `D:/Projects`.

## Commandes

Gestionnaire de paquets : **pnpm** (version épinglée par `packageManager` dans `package.json`, via corepack : `corepack pnpm …` si pnpm n'est pas installé globalement). Ne pas utiliser npm, yarn ni bun.

La configuration pnpm est dans `pnpm-workspace.yaml` (pas dans `package.json`) : `minimumReleaseAge` (24 h), `overrides` de sécurité (dont `brace-expansion` ciblé par version majeure, car `minimatch@3` casse avec la v5) et `allowBuilds` (seuls `esbuild` et `workerd` peuvent exécuter leurs scripts d'installation).

```bash
pnpm install
pnpm dev             # vite dev
pnpm build           # build de production (Cloudflare Workers via wrangler.jsonc)
pnpm build:dev       # build en mode development
pnpm lint            # eslint . (inclut prettier via eslint-plugin-prettier)
pnpm format          # prettier --write .
pnpm exec tsc --noEmit  # vérification de types (aucun script dédié)
```

Particularité pnpm à conserver : `publicHoistPattern: "@tanstack/*"` est nécessaire : la config Lovable déduplique `@tanstack/*` depuis la racine, sinon le build échoue (« failed to resolve import "@tanstack/query-core" »).

Aucun framework de test n'est configuré dans ce frontend.

## Architecture

- Variable d'environnement : `VITE_API_URL` (URL de l'API sans `/api/v1`, voir `.env.example`).
- `vite.config.ts` utilise `@lovable.dev/vite-tanstack-config`, qui inclut déjà tanstackStart, React, Tailwind, tsconfig paths, Cloudflare, l'alias `@` → `src/` : **ne jamais rajouter ces plugins**, sinon l'application casse.
- Routage par fichiers à plat dans `src/routes/` (notation à points : `_authenticated.app.employees.$id.tsx`). `src/routeTree.gen.ts` est généré : ne jamais l'éditer. Espaces : `_authenticated.app.*` (application), `konkoureoffice.*` (back office plateforme), `careers.*` / `paiement.*` / `resources.*` (public).
- Couche API dans `src/lib/api/` :
  - `client.ts` : `api.get/list/post/put/patch/delete` vers `${VITE_API_URL}/api/v1`, enveloppe `{ data, meta }`, `ApiError` (codes de `01-architecture §6`), jeton d'accès **en mémoire uniquement**, refresh par cookie httpOnly (un seul rejeu par requête), en-têtes `X-Organization-Id` (chemins `/org/*`), `Accept-Language` et `Idempotency-Key`. Événements globaux via `onApiEvent` : 401 → déconnexion locale ; `E_MODULE_NOT_INCLUDED` → `/app/module-indisponible` (branché dans `_authenticated.tsx`).
  - `auth.ts` + `types.ts` : endpoints `/auth/*`, `/me`, `POST /organizations`. La forme de `Me` est une **proposition**, à inscrire dans `06-api-reference.md`.
  - `pending.ts` + `legacy-functions.ts` : écrans **pas encore migrés**. Chaque ancien appel est devenu `pendingQuery("MÉTHODE /chemin")` ou une fonction `pendingFn`, qui échoue avec `E_NOT_MIGRATED` et indique l'endpoint cible. `grep -rln "pendingQuery\|legacy-functions" src` liste ce qu'il reste à migrer.
- Session : `useAuth` (lit `GET /me`) alimente `useOrg`, `useRole`, `useProfile`, `useMyEmployee` et `useSubscription`, qui gardent leurs anciennes interfaces (champs snake_case pour `Organization`). Rôles et modules viennent de l'API : le client ne fait que masquer l'interface.
- Migrer un écran : créer `src/lib/api/<domaine>.ts` (`queryOptions` + mutations TanStack Query), remplacer ses `pending*`, lecture initiale via `loader` + `ensureQueryData` puis `useSuspenseQuery` (skill `konkoure-frontend-integration`, lots de `docs/frontend/06-migration-front-plan.md`). Un endpoint absent de `06-api-reference.md` s'y ajoute d'abord, côté backend.
- Les URL canoniques et SEO pointent encore vers `konkoure.lovable.app` ; le domaine cible est `konkoure.doztra.cloud`.
- Images : les vrais fichiers sont dans `src/assets/*.png` et s'importent directement (`import icon from "@/assets/konkoure-icon.png"` donne l'URL). Les anciennes références Lovable `*.png.asset.json` (avec `.url`) n'existent plus : ne pas les réintroduire.
- UI : shadcn/ui (`src/components/ui`, style new-york), Tailwind v4 avec jetons sémantiques définis dans `src/styles.css`, i18n via `src/lib/i18n.ts` et `src/locales/{fr,en}/*.ts` (chaque clé dans les deux langues). Règles UI détaillées (modales sans `DialogFooter`, couleurs, SEO) : `docs/frontend/02-architecture-front.md` et `05-ui-ux-regles.md`.

## Source de vérité

Point d'entrée unique : `docs/00-HANDOFF.md`. Ordre de lecture global : handoff → `docs/product/` → `docs/backend/` → `docs/integrations/` → `docs/frontend/` → `docs/mobile/`.

Le dossier `docs/backend/` n'est plus dans ce dépôt : il se trouve dans `konkoure-rh-api/docs/backend/`. Pour tout travail sur le backend AdonisJS, lire d'abord `konkoure-rh-api/docs/backend/00-README.md`, puis les sections pertinentes. En cas de contradiction avec le frontend historique ou le backend Supabase existant, les spécifications backend font foi.

Les fichiers `.claude/skills/*/SKILL.md` sont des procédures opérationnelles pour l'agent de développement. Ils sont totalement distincts des `skills` métier représentant les compétences des employés.

Un miroir de consultation est disponible dans `docs/backend/skills/*/SKILL.md` ; seul `.claude/skills/` est actif pour le chargement automatique.

## Chargement automatique des skills

Charger automatiquement le ou les skills dont la description correspond à la tâche. Pour toute création, modification ou correction fonctionnelle du backend, composer au minimum :

- `konkoure-feature-workflow` ;
- le skill du domaine concerné ;
- `konkoure-api-contracts` si une route, une entrée ou une réponse est touchée ;
- `konkoure-tenant-security` dès qu'une donnée, une requête ou une autorisation est touchée ;
- `konkoure-testing-quality` avant de considérer la tâche terminée.

Ajouter selon l'impact :

- `konkoure-database` pour schéma, migration, modèle, repository, index ou transaction ;
- `konkoure-auth-rbac` pour identité, session, rôle ou policy ;
- `konkoure-performance-scale` pour cache, volume, requête, file ou chemin critique ;
- `konkoure-integrations-jobs` pour fournisseur, webhook, e-mail, fichier, IA, événement ou job ;
- `konkoure-operations` pour configuration, déploiement, observabilité ou incident ;
- `konkoure-legacy-migration` uniquement pour la reprise depuis le système existant ;
- `konkoure-frontend-integration` pour tout travail sur `apps/web` (client API, session, écrans, suppression de Supabase).

Si plusieurs skills s'appliquent, leurs règles se cumulent. Le document backend le plus spécifique tranche ; aucune règle métier ne doit être inventée.

## Règles universelles

- Référence par défaut : Guinée, Conakry, `Africa/Conakry`, GNF. Jamais Dakar/Sénégal comme exemple ou repli.
- Langue du code : anglais. Messages utilisateur : français et anglais, français par défaut.
- Toute donnée métier est isolée par organisation et toute autorisation est vérifiée côté serveur.
- Toute mutation sensible est auditée dans la même transaction.
- Aucun secret, token, mot de passe, salaire, document d'identité ou UID NFC en clair dans les logs ou réponses non autorisées.
- Demander avant une dépendance externe, un changement de contrat, une migration destructive, une règle métier modifiée, un fournisseur ajouté, un contrôle de sécurité affaibli ou une nouvelle catégorie de donnée personnelle.
