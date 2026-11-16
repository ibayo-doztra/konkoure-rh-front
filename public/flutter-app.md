# App mobile Flutter — Konkoure RH (multi-rôles)

> **Destinataire : Claude Code.** Ce document est la source de vérité pour développer
> l'application mobile Flutter compagnon de la plateforme Konkoure RH. Il liste
> **tous les endpoints, headers, corps de requêtes et contraintes d'accès**
> nécessaires. Il ne traite **pas** le pointage NFC — celui-ci fait l'objet
> d'une application dédiée déjà documentée dans
> [`flutter-timeclock.md`](./flutter-timeclock.md).
>
> Version : 1.0 — 14 juillet 2026.
> Périmètre V1 confirmé : **Employés + Badges NFC (scan/assign)**,
> **Recrutement**, **Performance**, **Timeclock (consultation uniquement)**.

---

## Table des matières

1. [Contexte & audience](#1-contexte--audience)
2. [Stack Flutter & bootstrap](#2-stack-flutter--bootstrap)
3. [Authentification & session](#3-authentification--session)
4. [Modèle de données](#4-modèle-de-données)
5. [Module Employés & Badges NFC](#5-module-employés--badges-nfc)
6. [Module Recrutement](#6-module-recrutement)
7. [Module Performance](#7-module-performance)
8. [Module Timeclock (consultation)](#8-module-timeclock-consultation)
9. [Notifications](#9-notifications)
10. [Stockage (avatars, docs, CV)](#10-stockage-avatars-docs-cv)
11. [Endpoint public de pointage (référence)](#11-endpoint-public-de-pointage-référence)
12. [Récapitulatif endpoints & headers](#12-récapitulatif-endpoints--headers)
13. [Gestion d'erreurs](#13-gestion-derreurs)
14. [Références internes](#14-références-internes)

---

## 1. Contexte & audience

Konkoure RH est une plateforme RH multi-organisations. La plateforme web est
construite avec TanStack Start + Lovable Cloud (Supabase géré). L'app mobile
Flutter est destinée à **tous les utilisateurs de l'entreprise** :

| Rôle (`user_roles.role`) | Description | Périmètre mobile |
| --- | --- | --- |
| `owner` | Propriétaire de l'organisation, accès total | Tout |
| `hr_admin` | Responsable RH | Tout sauf facturation |
| `manager` | Responsable d'équipe | Son équipe (via `employees.manager_id`) |
| `security_agent` | Agent de sécurité (rôle utilisé par l'app pointage dédiée) | N/A ici |
| `employee` | Employé standard | Sa propre fiche + soumissions personnelles |

Un utilisateur possède **une entrée `user_roles` par organisation**. Un
employé est rattaché à son compte auth via `employees.user_id`.

### Matrice de visibilité (résumé)

| Module | owner / hr_admin | manager | employee |
| --- | --- | --- | --- |
| Employés (liste org) | ✅ lecture + édition | ✅ lecture (équipe + org lecture seule via RLS `is_org_member`) | ⚠️ voit tous les membres de l'org (SELECT `is_org_member`) mais n'édite que sa fiche |
| **Badges NFC (assign/révoque)** | ✅ | ❌ | ❌ |
| Jobs & Candidats | ✅ | ✅ (lecture) | ❌ |
| Objectifs / OKR / Feedback / Achievements | ✅ | ✅ (équipe) | ✅ (les siens) |
| Reviews | ✅ | ✅ (manager_id = lui) | ✅ (self-eval) |
| Time logs | ✅ | ✅ (son équipe) | ✅ (les siens) |
| Zones de travail | ✅ (lecture V1) | ✅ (lecture) | ✅ (lecture) |
| Notifications | Personnelles uniquement (`user_id = auth.uid()`) | idem | idem |

### Fonctionnalité clé : assignation des badges NFC

Un administrateur/RH peut :

1. Ouvrir la fiche d'un employé,
2. Appuyer sur « Scanner un nouveau badge »,
3. Approcher le badge NFC du téléphone → l'UID est lu,
4. Le backend enregistre l'UID sur `employees.nfc_badge_uid` et journalise
   l'événement dans `nfc_badge_history`.

L'app de pointage (documentée séparément) utilisera ensuite ce badge pour
enregistrer les pointages.

---

## 2. Configuration & variables d'environnement

Trois valeurs à injecter dans le client mobile (au build ou via un mécanisme
de configuration équivalent) :

| Variable | Valeur (prod) | Rôle |
| --- | --- | --- |
| `SUPABASE_URL` | `https://rvmpporrsxdnbkwntyqh.supabase.co` | Auth + Data API + Storage |
| `SUPABASE_ANON_KEY` | Clé publishable (`.env` web : `VITE_SUPABASE_PUBLISHABLE_KEY`) | Publique, safe à embarquer |
| `BASE_URL` | `https://konkoure.lovable.app` (prod) ou `https://project--6327e517-24e0-4247-892c-b1564311a161-dev.lovable.app` (dev) | Backend Lovable (endpoints `/api/public/*`) |

> ⚠️ Ne jamais embarquer `SUPABASE_SERVICE_ROLE_KEY` dans l'app. Toute action
> privilégiée passe par un endpoint serveur qui vérifie le rôle.

Toutes les requêtes Data API / Auth / Storage utilisent `SUPABASE_URL` comme
base. Les endpoints `/api/public/*` utilisent `BASE_URL`. Les headers
standards sont récapitulés au §12.1.


---

## 3. Authentification & session

### 3.1 Sign-in email/mot de passe

```
POST {SUPABASE_URL}/auth/v1/token?grant_type=password
Headers:
  apikey: <SUPABASE_ANON_KEY>
  Content-Type: application/json
Body:
  { "email": "...", "password": "..." }
```

Réponse : `{ access_token, refresh_token, expires_in, user }`.

### 3.2 Refresh & logout

```
POST {SUPABASE_URL}/auth/v1/token?grant_type=refresh_token
Headers:
  apikey: <SUPABASE_ANON_KEY>
  Content-Type: application/json
Body: { "refresh_token": "..." }

POST {SUPABASE_URL}/auth/v1/logout
Headers:
  apikey: <SUPABASE_ANON_KEY>
  Authorization: Bearer <access_token>
```

### 3.3 Google OAuth (mobile)

> ⚠️ Le broker `lovable.auth.signInWithOAuth` **n'est pas utilisable côté
> mobile** (il repose sur postMessage entre iframes). Sur mobile on utilise
> l'OAuth Supabase natif avec deep link.

1. Déclarer un schéma custom côté app (ex. `io.konkoure.app://login-callback`).
2. Ajouter ce redirect dans la config Supabase Auth (déjà présente pour
   Google) : **Authentication → URL Configuration → Redirect URLs**.
3. Ouvrir l'URL d'autorisation dans un navigateur externe :

```
GET {SUPABASE_URL}/auth/v1/authorize
  ?provider=google
  &redirect_to=io.konkoure.app://login-callback
```

Après consentement, Supabase redirige vers le deep link avec
`access_token` / `refresh_token` dans le fragment (`#access_token=...`).
L'app doit intercepter le deep link et créer la session localement.

### 3.4 Reset password

```
POST {SUPABASE_URL}/auth/v1/recover
Headers:
  apikey: <SUPABASE_ANON_KEY>
  Content-Type: application/json
Body:
  {
    "email": "user@example.com",
    "redirect_to": "io.konkoure.app://reset-password"
  }
```

### 3.5 Bootstrap du contexte utilisateur (post-login)

À exécuter juste après login, en parallèle :

```
GET  {SUPABASE_URL}/rest/v1/profiles?id=eq.<uid>&select=id,full_name,avatar_url,preferred_language
GET  {SUPABASE_URL}/rest/v1/user_roles?user_id=eq.<uid>&select=role,organization_id
GET  {SUPABASE_URL}/rest/v1/employees?user_id=eq.<uid>&select=id,organization_id,first_name,last_name,job_title,photo_url,department_id,manager_id
GET  {SUPABASE_URL}/rest/v1/organizations?id=in.(<orgIds>)&select=id,name,slug,default_language,default_currency,logo_url
```

Headers pour toute requête Data API :

```
apikey: <SUPABASE_ANON_KEY>
Authorization: Bearer <access_token>
Accept: application/json
```

**Règles UI :**

- Si `user_roles` est vide → écran « Compte non associé à une organisation.
  Contactez votre administrateur. » (pas de logout automatique).
- Si l'utilisateur a plusieurs `organization_id`, afficher un sélecteur.
  L'organisation active se propage à toutes les requêtes suivantes.
- La liste des rôles pour l'org active pilote le menu :
  - `owner|hr_admin` → tous les modules + « Gestion badges NFC ».
  - `manager` → équipe + performance équipe.
  - `employee` → mon espace uniquement.

### 3.6 Persistance session

La session (`access_token` + `refresh_token`) doit être persistée côté
client dans un stockage sécurisé (Keychain iOS / Keystore Android) et
rechargée au démarrage. Rafraîchir avant expiration via l'endpoint
`grant_type=refresh_token` (§3.2).

---

## 4. Modèle de données

Les tables ci-dessous sont accessibles via **PostgREST** (`/rest/v1/<table>`).
Toutes ont **RLS activée**. Les rôles Postgres pertinents pour l'app sont
`authenticated` et `anon` — mobile utilise toujours `authenticated`.

Helpers RLS (fonctions `SECURITY DEFINER` dans le schéma `private`) :

- `private.is_org_member(uid, org_id)` : vrai si l'utilisateur possède au
  moins un rôle dans `organization_id`.
- `private.is_org_admin(uid, org_id)` : vrai pour `owner` ou `hr_admin`.

### 4.1 `organizations`

Colonnes : `id`, `name`, `slug`, `default_language`, `default_currency`,
`plan`, `logo_url`, `performance_model`.

Lecture : membres. Écriture : admins.

### 4.2 `profiles`

Colonnes : `id` (= `auth.users.id`), `full_name`, `avatar_url`,
`preferred_language`.

RLS : chaque utilisateur lit/édite son propre profil.

### 4.3 `user_roles`

Colonnes : `id`, `user_id`, `organization_id`, `role`
(`owner | hr_admin | manager | security_agent | employee`).

Lecture : le user lui-même + admins de l'org. Écriture : admins.

### 4.4 `employees`

Colonnes clés : `id`, `organization_id`, `user_id` (nullable),
`first_name`, `last_name`, `email`, `phone`, `photo_url`, `job_title`,
`department_id`, `manager_id`, `hire_date`, `status`
(`active|inactive|on_leave|terminated`), `position`, `base_salary`,
`profile_details` (JSONB), `nfc_badge_uid`, `nfc_badge_active`,
`nfc_badge_assigned_at`.

**Colonnes NFC : lecture non exposée aux clients `authenticated`.** Les
lire passe obligatoirement par la RPC `get_employee_badge_info` (à créer
côté backend si besoin) ou par l'endpoint public dédié (§5). Les autres
colonnes sont SELECTables par tous les membres de l'org.

Autorisations d'écriture (RLS) :
- INSERT : `is_org_admin` (owner / hr_admin).
- UPDATE : `is_org_admin` **ou** `self` (`user_id = auth.uid()`).
- DELETE : `is_org_admin`.
- Colonnes restreintes : `base_salary`, `profile_details`, `nfc_badge_uid`,
  `nfc_badge_active`, `nfc_badge_assigned_at` — lecture/écriture bloquées
  pour le rôle `authenticated`. Passer par les server functions Lovable
  (`getEmployeeSensitive`, `updateEmployeeProfileDetails`) ou les endpoints
  publics badge (§5.5).

### 4.5 `departments`

`id`, `organization_id`, `name` (obligatoire, 2–100 car.),
`description` (max 500 car.), `manager_id` (FK `employees.id`, nullable),
`deleted_at` (soft delete). `created_at`, `updated_at`.

Autorisations d'écriture (RLS) :
- INSERT : `is_org_member`.
- UPDATE : `is_org_member` (inclut le soft-delete `deleted_at=now()`).
- DELETE : `is_org_admin` (suppression physique — préférer le soft-delete
  via `PATCH deleted_at=now()`, utilisé par le web). Filtrer les lectures
  avec `deleted_at=is.null`.

### 4.6 `jobs`

`id`, `organization_id`, `title`, `department_id`, `location`, `description`,
`requirements`, `status` (`draft|published|closed`), `inclusive_score`,
`created_by`, `deadline`, `slug`, `required_documents` (JSONB),
`contract_type` (`cdi|cdd|stage|freelance|apprentissage`).

Autorisations d'écriture (RLS) :
- INSERT : `is_org_member`.
- UPDATE : `is_org_member`.
- DELETE : `is_org_admin`.
- SELECT public : lignes `status='published'` uniquement (page carrières) —
  sinon `is_org_member`.

### 4.7 `candidates`

`id`, `organization_id`, `job_id`, `full_name`, `email`, `phone`, `cv_url`,
`cv_text`, `ai_score`, `ai_justification`, `stage`
(`new|reviewing|interview|offer|hired|rejected`),
`cover_letter_url`, `documents` (JSONB).

Autorisations d'écriture (RLS) :
- INSERT : `is_org_member` **ou** `public/anon` si `job_id` référence une
  offre `status='published'` (candidature publique /careers). Le mobile
  passe par le chemin membre.
- UPDATE : `is_org_member` (changement d'étape, notes IA, etc.).
- DELETE : `is_org_admin`.

### 4.8 `candidate_notes`

`id`, `organization_id`, `candidate_id`, `author_id`, `body`.

Autorisations d'écriture (RLS) :
- INSERT : `is_org_member` avec `author_id = auth.uid()`.
- UPDATE : **interdit** (aucune policy — corriger par delete + insert).
- DELETE : auteur (`author_id = auth.uid()`) ou `is_org_admin`.

### 4.9 `candidate_activities`

`id`, `organization_id`, `candidate_id`, `actor_id`, `type`
(`created|stage_changed|scored|note_added|note_deleted`),
`payload` (JSONB).

Autorisations d'écriture (RLS) :
- INSERT : `is_org_member` (rôle `authenticated` uniquement) avec
  `actor_id = auth.uid()` **et** `type ∈ {note_added, note_deleted}`.
  Les autres types (`created`, `stage_changed`, `scored`) sont posés par
  triggers serveur.
- UPDATE : `is_org_admin`.
- DELETE : `is_org_admin`.

### 4.10 `goals`

`id`, `organization_id`, `employee_id` (obligatoire), `parent_goal_id`,
`title`, `description`, `category`, `weight`, `progress` (0-100),
`status`, `start_date`, `due_date`, `end_date`, `measurement`,
`owner_id` (obligatoire — trigger `goals_require_owner`), `created_by_id`,
`review_id`, `plan_id`.

Autorisations d'écriture (RLS) :
- INSERT / UPDATE : `is_org_member` (trigger `goals_require_owner` :
  `owner_id` obligatoire).
- DELETE : `is_org_admin`.

### 4.11 `goal_activities`

`id`, `organization_id`, `goal_id`, `employee_id` (obligatoire — trigger),
`title`, `description`, `status`, `planned_date`, `completed_at`.

Autorisations d'écriture (RLS) :
- INSERT / UPDATE : `is_org_member` (trigger : `employee_id` obligatoire).
- DELETE : `is_org_admin`.

### 4.12 `okrs`

`id`, `organization_id`, `employee_id` (obligatoire — trigger),
`quarter` (`Q1-2026`…), `objective`, `key_results` (JSONB),
`progress`, `status`.

Format `key_results` :

```json
[
  { "title": "Réduire le temps de recrutement", "target": 30, "current": 45, "unit": "jours", "weight": 40 }
]
```

Autorisations d'écriture (RLS) :
- INSERT / UPDATE : `is_org_member` (trigger : `employee_id` obligatoire).
- DELETE : `is_org_admin`.

### 4.13 `feedbacks`

`id`, `organization_id`, `from_employee_id`, `to_employee_id`,
`kind` (`kudos|constructive|coaching`), `message`.

Autorisations d'écriture (RLS) :
- INSERT / UPDATE : `is_org_member` (côté UI, verrouiller à
  `from_employee_id` = employé courant).
- DELETE : `is_org_admin`.

### 4.14 `achievements`

`id`, `organization_id`, `goal_id` (nullable), `employee_id` (obligatoire),
`title`, `description`, `impact`, `achieved_at`.

Autorisations d'écriture (RLS) :
- INSERT / UPDATE : `is_org_member` (trigger `achievements_require_employee` :
  `employee_id` obligatoire ; côté UI, réserver aux admins/RH ou à l'employé
  concerné).
- DELETE : `is_org_admin`.

### 4.15 `performance_plans`

`id`, `organization_id`, `name`, `period_start`, `period_end`,
`status`, `created_by`.

Autorisations d'écriture (RLS) :
- INSERT / UPDATE / DELETE : `is_org_admin` uniquement. Lecture seule
  côté mobile pour les non-admins.

### 4.16 `performance_cycles`

`id`, `organization_id`, `name`, `frequency`, `period_start`,
`period_end`, `self_eval_opens_at`, `self_eval_closes_at`, `status`.

Autorisations d'écriture (RLS) :
- INSERT / UPDATE / DELETE : `is_org_admin` uniquement.

### 4.17 `performance_reviews`

`id`, `organization_id`, `cycle_id`, `plan_id`, `employee_id`,
`manager_id`, `status`, `self_global_comment`, `self_score`,
`submitted_at`, `manager_score`, `manager_global_comment`,
`manager_submitted_at`.

Trigger : `plan_id` OU `cycle_id` obligatoire.

Autorisations d'écriture (RLS) :
- INSERT : `is_org_admin` uniquement.
- UPDATE : `is_org_admin`, **ou** l'employé évalué (`employee_id.user_id
  = auth.uid()`) pour sa self-évaluation, **ou** le manager
  (`manager_id.user_id = auth.uid()`) pour sa partie manager.
- DELETE : `is_org_admin`.
- Côté UI, restreindre les colonnes écrites : self ne touche que
  `self_*` / `submitted_at` ; manager que `manager_*` /
  `manager_submitted_at`.

### 4.18 `time_logs`

`id`, `organization_id`, `employee_id`, `type` (`ARRIVEE|DEPART`),
`timestamp`, `latitude`, `longitude`, `source`.

Autorisations d'écriture (RLS) :
- INSERT / UPDATE / DELETE directes : **interdites** côté mobile
  (aucune policy d'écriture ouverte à `authenticated`).
- Seule voie d'écriture : RPC `record_punch` (app pointage dédiée) ou
  endpoint public `/api/public/timeclock/scan`. Cette app est en
  lecture seule sur `time_logs`.

### 4.19 `work_zones`

Colonnes exactes :
- `id` uuid, `organization_id` uuid,
- `name` text (obligatoire),
- `shape` text (`circle` | `polygon`, obligatoire, défaut `circle`),
- `latitude` double precision (nullable — utilisé si `shape=circle`, ou
  premier sommet du polygone à titre indicatif),
- `longitude` double precision (nullable),
- `radius_meters` integer (obligatoire si `shape=circle`, nullable sinon),
- `polygon` jsonb (obligatoire si `shape=polygon`) — tableau ordonné
  d'objets `{ "lat": <double>, "lng": <double> }`, min. 3 sommets.
- `created_at` timestamptz.

Autorisations d'écriture (RLS) :
- INSERT : `is_org_member`.
- UPDATE : `is_org_member`.
- DELETE : `is_org_admin`.

Le module mobile V1 doit supporter la lecture **et la création/édition**
des zones (voir §8.2).

### 4.20 `nfc_badge_history`

`id`, `organization_id`, `employee_id`, `uid`, `event`
(`assigned|revoked|deactivated|reactivated`), `reason`, `actor_user_id`.

Autorisations d'écriture (RLS) :
- INSERT / UPDATE / DELETE : **aucun accès direct**. Les lignes sont
  écrites exclusivement par le trigger `employees_badge_audit` lors des
  assign/revoke/(dé)activation via les RPC `admin_assign_employee_badge`
  / `admin_revoke_employee_badge`.
- SELECT : `is_org_admin` (audit).

### 4.21 `notifications`

`id`, `organization_id`, `user_id`, `type`, `title`, `body`, `link`,
`read_at`.

Autorisations d'écriture (RLS) :
- INSERT : `authenticated` avec `is_org_admin` **ou** `user_id =
  auth.uid()` (en pratique, les notifications sont créées par le
  serveur ; le mobile n'insère pas).
- UPDATE : destinataire uniquement (`user_id = auth.uid()`) — sert à
  positionner `read_at`.
- DELETE : `is_org_admin`.

### 4.22 `contracts`

Table des contrats de travail des employés (CDI/CDD/stage/etc.).

Colonnes exactes :
- `id` uuid PK, `organization_id` uuid, `employee_id` uuid (FK
  `employees.id`, obligatoire),
- `type` enum `contract_type` (`cdi | cdd | stage | freelance |
  apprenticeship | Journalier`) — obligatoire,
- `status` enum `contract_status` (`draft | active | terminated`) —
  obligatoire, défaut `draft`,
- `start_date` date (obligatoire), `end_date` date (nullable),
- `trial_period_end` date (nullable — fin période d'essai),
- `salary` numeric (nullable), `currency` text (nullable, ex. `GNF`,
  `XOF`, `EUR`),
- `document_url` text (nullable — chemin dans le bucket
  `employee-docs`, à signer pour l'affichage),
- `notes` text (nullable),
- `created_at`, `updated_at` timestamptz.

Autorisations d'écriture (RLS) :
- SELECT : `is_org_admin` **ou** l'employé propriétaire
  (`employees.user_id = auth.uid()` sur `employee_id`).
- INSERT / UPDATE / DELETE : `is_org_admin` uniquement.
- `document_url` : chemin dans le bucket privé `employee-docs` — servir
  via URL signée.

Endpoints REST (PostgREST) :

```
GET    /rest/v1/contracts?organization_id=eq.<org>&select=*,employees(first_name,last_name)&order=start_date.desc
GET    /rest/v1/contracts?employee_id=eq.<id>&select=*&order=start_date.desc
GET    /rest/v1/contracts?id=eq.<id>&select=*
POST   /rest/v1/contracts
       body: { organization_id, employee_id, type, status, start_date,
               end_date?, trial_period_end?, salary?, currency?,
               document_url?, notes? }
PATCH  /rest/v1/contracts?id=eq.<id>
       body: <champs modifiés>
DELETE /rest/v1/contracts?id=eq.<id>
```

En mobile, l'employé peut lister/consulter ses propres contrats ; seuls
les admins peuvent créer / modifier / supprimer.

### 4.23 `skills`

Référentiel de compétences par organisation.

Colonnes : `id`, `organization_id`, `name` text (obligatoire),
`category` text (nullable — ex. `technical`, `soft`, `language`),
`created_at`.

Autorisations d'écriture (RLS) :
- INSERT : `is_org_member`.
- UPDATE : `is_org_member`.
- DELETE : `is_org_admin`.

### 4.24 `employee_skills`

Association N‑N employé ↔ compétence avec un niveau.

Colonnes : `id`, `organization_id`, `employee_id` (FK), `skill_id`
(FK), `level` integer (obligatoire, échelle **1 à 5** utilisée par le
web : 1 = notion, 5 = expert).

Contrainte unique attendue : `(employee_id, skill_id)` — utiliser
`PATCH` pour mettre à jour un niveau existant.

Autorisations d'écriture (RLS) — identiques à `skills` :
- INSERT : `is_org_member`.
- UPDATE : `is_org_member` (mettre à jour `level` via `PATCH` sur la
  ligne existante).
- DELETE : `is_org_admin`.
Les lectures se filtrent par `organization_id` et/ou `employee_id`.

Endpoints REST :

```
GET    /rest/v1/skills?organization_id=eq.<org>&order=name
POST   /rest/v1/skills               body: { organization_id, name, category? }
PATCH  /rest/v1/skills?id=eq.<id>    body: { name?, category? }
DELETE /rest/v1/skills?id=eq.<id>

GET    /rest/v1/employee_skills?employee_id=eq.<id>&select=*,skills(name,category)
POST   /rest/v1/employee_skills      body: { organization_id, employee_id, skill_id, level }
PATCH  /rest/v1/employee_skills?id=eq.<id>   body: { level }
DELETE /rest/v1/employee_skills?id=eq.<id>
```

### 4.25 `social_accounts` & `social_posts` (info)

Comptes et publications de la vitrine réseaux sociaux (Facebook / Instagram
/ LinkedIn). **Non exposé au mobile en V1.**

Autorisations d'écriture (RLS) :
- `social_accounts` — INSERT / UPDATE / DELETE : `is_org_admin` uniquement.
  Les tokens OAuth (`access_token`, `refresh_token`) vivent dans le schéma
  `private` et sont inaccessibles au client ; la colonne `metadata` est
  masquée aux rôles `anon` / `authenticated`.
- `social_posts` — INSERT / UPDATE : `is_org_member` ; DELETE :
  `is_org_admin`. Les publications passent en pratique par des server
  functions côté web (Lovable) et ne doivent pas être créées directement
  depuis le mobile.

---

## 5. Module Employés & Badges NFC

### 5.1 Liste des employés

```
GET {SUPABASE_URL}/rest/v1/employees
  ?organization_id=eq.<orgId>
  &select=id,first_name,last_name,job_title,photo_url,status,department:departments(id,name)
  &order=last_name.asc
Headers:
  apikey: <ANON>
  Authorization: Bearer <token>
```

Recherche : ajouter `&or=(first_name.ilike.*<q>*,last_name.ilike.*<q>*,email.ilike.*<q>*)`.

Filtrer par statut : `&status=eq.active`.

### 5.2 Fiche employé

```
GET /rest/v1/employees?id=eq.<id>&select=
  id,first_name,last_name,email,phone,photo_url,job_title,position,
  hire_date,status,base_salary,profile_details,
  department:departments(id,name),
  manager:employees!manager_id(id,first_name,last_name,photo_url)
```

L'UI doit masquer `base_salary` aux non-admins (RLS renvoie la colonne à
tout membre — filtrage applicatif). **Les colonnes `nfc_badge_*` ne sont
PAS retournées par PostgREST** (voir §5.4).

### 5.3 Mise à jour employé (admin)

```
PATCH /rest/v1/employees?id=eq.<id>
Headers:
  apikey: <ANON>
  Authorization: Bearer <token>
  Content-Type: application/json
  Prefer: return=representation
Body:
  { "first_name":"...", "last_name":"...", "phone":"...", "job_title":"...",
    "department_id":"<uuid>", "manager_id":"<uuid>", "status":"active" }
```

**Peuplement de la liste Manager (N+1)** — ne pas lister tous les employés. Seuls
les **responsables de département** sont des valeurs valides pour `manager_id`.
Charger d'abord les IDs des responsables, puis les employés correspondants :

```
GET {SUPABASE_URL}/rest/v1/departments
    ?organization_id=eq.<org>
    &manager_id=not.is.null
    &select=manager_id

GET {SUPABASE_URL}/rest/v1/employees
    ?id=in.(<uuid1>,<uuid2>,...)
    &select=id,first_name,last_name,department_id
```

Si aucun département n'a de responsable, la liste est vide et l'utilisateur
choisit "Aucun manager" (champ `manager_id` omis ou `null` dans le POST).

Un employé standard peut PATCHer sa propre fiche (RLS le limite aux
colonnes visibles ; en pratique, éviter d'exposer `base_salary`,
`department_id`, `manager_id`, `status` à l'employé côté UI).

### 5.4 Assignation d'un badge NFC (scan)

**Accès : `owner` ou `hr_admin` uniquement** (contrôle dans la RPC).

#### 5.4.1 Format canonique de l'UID

Le badge est un tag NFC standard (MIFARE Ultralight / NTAG213 / carte
ISO 14443A) dont l'UID est lu côté device.

**Format canonique attendu par le backend** : hex majuscule séparé par
`:`, ex. `04:A2:1B:C3:2D:5E:80`. Ce format est celui utilisé par l'app
pointage — il **doit** être identique pour que le badge soit reconnu.

L'app est responsable de la lecture NFC et de la normalisation vers ce
format avant d'appeler §5.4.2.


#### 5.4.2 Assignation serveur (endpoint REST public — OBLIGATOIRE)

> ⚠️ **Ne PAS appeler `POST /rest/v1/rpc/admin_assign_employee_badge` ni
> `admin_revoke_employee_badge` directement via PostgREST.** L'`EXECUTE` sur
> ces fonctions a été révoqué pour les rôles `anon` et `authenticated` pour
> raisons de sécurité (finding `SUPA_authenticated_security_definer_function_executable`).
> Seul `service_role` peut les exécuter. Un appel direct depuis Flutter
> renvoie systématiquement :
> `permission denied for function admin_assign_employee_badge`.
>
> L'app mobile **doit** passer par les endpoints REST publics ci-dessous,
> qui exécutent la RPC côté serveur avec le service role après avoir
> vérifié que l'appelant est `owner` ou `hr_admin` de l'organisation.

```
POST {BASE}/api/public/employees/assign-badge
Headers:
  Authorization: Bearer <access_token utilisateur Supabase>
  Content-Type: application/json
Body:
  {
    "employee_id": "<uuid>",
    "uid": "04:A2:1B:C3:2D:5E:80",
    "active": true
  }
```

Réponse succès (200) :

```json
{ "ok": true, "uid": "04:A2:1B:C3:2D:5E:80",
  "active": true, "assigned_at": "2026-07-14T10:00:00Z" }
```

Codes d'erreur :

| HTTP | `error`                   | Cause / action mobile                                                                 |
| ---- | ------------------------- | ------------------------------------------------------------------------------------- |
| 400  | `VALIDATION_ERROR`        | Corps JSON invalide ou `uid`/`employee_id` manquant. Vérifier le payload.             |
| 401  | `UNAUTHORIZED`            | Jeton manquant, vide, invalide ou expiré. Rafraîchir la session Supabase.             |
| 403  | `FORBIDDEN`               | L'utilisateur n'est pas `owner`/`hr_admin` de l'org de l'employé.                     |
| 404  | `EMPLOYEE_NOT_FOUND`      | `employee_id` inconnu ou hors organisation autorisée.                                 |
| 409  | `BADGE_ALREADY_ASSIGNED`  | UID déjà attribué à un autre employé actif. Proposer révocation de l'ancien.          |
| 500  | `INTERNAL_ERROR`          | Erreur serveur — réessayer, remonter le message.                                      |

#### 5.4.3 Révocation

```
POST {BASE}/api/public/employees/revoke-badge
Headers:
  Authorization: Bearer <access_token>
  Content-Type: application/json
Body:
  { "employee_id": "<uuid>" }
```

Passe `nfc_badge_uid` à `NULL` et réactive `nfc_badge_active`. L'événement
`revoked` est enregistré dans `nfc_badge_history` avec l'`actor_user_id`
correct.

#### 5.4.4 Désactivation temporaire

Pour désactiver sans révoquer (perte temporaire de badge par ex.) :
rappeler `POST /api/public/employees/assign-badge` avec le même `uid` et
`"active": false`. Un événement `deactivated` est enregistré.

#### 5.4.5 Lecture de l'état du badge

```
GET {BASE}/api/public/employees/{id}/badge
Headers:
  Authorization: Bearer <access_token>
```

Accès : `owner` / `hr_admin` de l'org, ou l'employé lui-même (self).

#### 5.4.6 Historique complet

```
GET {S}/rest/v1/nfc_badge_history
  ?employee_id=eq.<id>
  &select=id,uid,event,reason,actor_user_id,created_at
  &order=created_at.desc&limit=50
```

Accès : owner / hr_admin uniquement (RLS).

### 5.5 TODO backend (endpoints REST à ajouter)

Pour éviter d'exposer PostgREST + RPC bruts côté mobile, la V2 mobile
devrait s'appuyer sur deux endpoints REST publics :

```text
POST /api/public/employees/assign-badge
  Auth: Bearer <access_token>  (owner | hr_admin)
  Body: { "employee_id":"uuid", "uid":"04:...", "active":true }
  Resp: { "ok":true, "uid":"04:...", "active":true, "assigned_at":"..." }

POST /api/public/employees/revoke-badge
  Auth: Bearer <access_token>  (owner | hr_admin)
  Body: { "employee_id":"uuid" }
  Resp: { "ok":true }

GET /api/public/employees/{id}/badge
  Auth: Bearer <access_token>  (owner | hr_admin | self)
  Resp: { "uid":"04:..."|null, "active":true, "assigned_at":"..."|null,
          "history": [ { "uid":"...", "event":"assigned", "created_at":"..." } ] }
```

Template de handler (à ajouter dans `src/routes/api.public.employees.*` côté web) :

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { assignEmployeeBadge } from "@/lib/employees.functions";
// … voir src/routes/api.public.timeclock.scan.ts pour le pattern complet
```

**Tant que ces endpoints n'existent pas, utiliser les RPC PostgREST du §5.4.**

---

## 6. Module Recrutement

### 6.1 Offres (`jobs`)

**Liste :**

```
GET /rest/v1/jobs
  ?organization_id=eq.<org>
  &select=id,title,status,location,contract_type,deadline,slug,inclusive_score,
          department:departments(id,name),
          candidates_count:candidates(count)
  &order=created_at.desc
```

Filtres :
- `&status=eq.published` — offres actives
- `&department_id=eq.<id>`

**Détail :**

```
GET /rest/v1/jobs?id=eq.<id>&select=*,department:departments(id,name)
```

**Créer :** (owner / hr_admin)

```
POST /rest/v1/jobs
Headers: apikey, Authorization, Content-Type, Prefer: return=representation
Body: {
  "organization_id":"<org>",
  "title":"Développeur mobile",
  "description":"...",
  "requirements":"...",
  "location":"Conakry",
  "contract_type":"cdi",
  "status":"draft",
  "deadline":"2026-09-01T00:00:00Z",
  "required_documents": { "cv": true, "cover_letter": false, "documents": [] },
  "created_by":"<auth.user.id>"
}
```

**Mettre à jour :**

```
PATCH /rest/v1/jobs?id=eq.<id>
Body: { "title":"...", "status":"published", ... }
```

**Publier sur les réseaux sociaux :** non exposé en V1 mobile (repose sur
des server functions `publishJobToSocials` non appelables depuis Flutter).
Renvoyer l'utilisateur vers le back-office web.

### 6.2 Candidats (`candidates`)

**Liste pour une offre :**

```
GET /rest/v1/candidates
  ?job_id=eq.<jobId>
  &select=id,full_name,email,phone,stage,ai_score,ai_justification,cv_url,created_at
  &order=ai_score.desc.nullslast
```

Filtres :
- `&stage=in.(new,reviewing)` — candidats non traités
- `&or=(full_name.ilike.*<q>*,email.ilike.*<q>*)` — recherche

**Détail candidat :**

```
GET /rest/v1/candidates?id=eq.<id>&select=*
```

**Ouvrir le CV / cover letter / documents** (buckets privés `cvs`,
`applications`) : générer une signed URL (§10.2) à partir du chemin.

Convertir `cv_url` public → chemin :
- Si `cv_url` commence par `http` et contient `/storage/v1/object/public/cvs/`, extraire
  la partie après `/cvs/`.
- Sinon supposer que `cv_url` est déjà le chemin dans le bucket.


**Changer l'étape :**

```
PATCH /rest/v1/candidates?id=eq.<id>
Body: { "stage": "interview" }
```

Un trigger backend créera automatiquement une entrée
`candidate_activities` de type `stage_changed`.

**Ajouter une note :**

```
POST /rest/v1/candidate_notes
Body: {
  "candidate_id":"<id>",
  "organization_id":"<org>",
  "author_id":"<auth.user.id>",
  "body":"Excellente présentation..."
}
```

⚠️ **Ne PAS** insérer directement dans `candidate_activities` — les
policies l'interdisent sauf pour `type` ∈ {`note_added`, `note_deleted`}
et un trigger côté `candidate_notes` s'en charge.

**Supprimer une note :** `DELETE /rest/v1/candidate_notes?id=eq.<id>`
(auteur ou admin).

**Timeline (activités) :**

```
GET /rest/v1/candidate_activities
  ?candidate_id=eq.<id>
  &select=id,type,payload,actor_id,created_at,
          actor:profiles!actor_id(full_name,avatar_url)
  &order=created_at.desc
```

---

## 7. Module Performance

Rappels de contrainte :

- **`goals.owner_id`** obligatoire (trigger `goals_require_owner`).
- **`goals.employee_id`** obligatoire dans `okrs`, `achievements`,
  `goal_activities` (triggers).
- **`performance_reviews`** : `plan_id` OU `cycle_id` obligatoire.

### 7.1 Objectifs (`goals`)

> ⚠️ **Colonnes disponibles sur `goals`** : `employee_id` **ET** `owner_id`
> existent bien tous les deux (vérifié sur le schéma live). Un 400
> `column goals.employee_id does not exist` **n'est pas possible** —
> si vous en recevez un, la vraie cause est ailleurs. Causes réelles
> de 400 sur PostgREST :
>
> 1. **Embed FK invalide** dans le `select=` — ex. `owner:employees!owner_id(...)`
>    quand la FK PostgREST n'est pas détectée. Solution : commencer par un
>    `select=*` (ou colonnes plates) sans embed pour isoler le problème,
>    puis rajouter les embeds un par un.
> 2. **`in.()` vide** — `.inFilter('employee_id', [])` produit `employee_id=in.()`
>    → 400 `failed to parse filter`. Toujours court-circuiter la requête
>    quand la liste d'IDs est vide.
> 3. **Header manquant** — `apikey` + `Authorization: Bearer <token>` requis
>    sur toutes les requêtes PostgREST.
>
> **Debug obligatoire côté Flutter** : logger `response.body` (pas seulement
> le `statusCode`) — PostgREST renvoie un JSON `{ "code", "message", "hint",
> "details" }` qui nomme exactement la colonne ou la relation en cause.
>
> Filtrer "mes objectifs" par `employee_id=eq.<me>` **ou** par
> `owner_id=eq.<me>` est valide ; `owner_id` reste la colonne exigée par
> le trigger à l'INSERT.



**Mes objectifs (employé courant) :**

```
GET /rest/v1/goals
  ?employee_id=eq.<myEmployeeId>
  &select=id,title,description,progress,status,due_date,category,weight,
          owner:employees!owner_id(id,first_name,last_name)
  &order=due_date.asc.nullslast
```

**Objectifs de l'équipe (manager) :**

```
GET /rest/v1/goals
  ?organization_id=eq.<org>
  &employee_id=in.(<memberIds>)
  &select=...
```

où `<memberIds>` est la liste des `employees.id` où
`manager_id = <myEmployeeId>`.

**Créer :**

```
POST /rest/v1/goals
Body: {
  "organization_id":"<org>",
  "employee_id":"<empId>",
  "owner_id":"<empId>",           // requis
  "created_by_id":"<myEmployeeId>",
  "title":"...",
  "description":"...",
  "category":"performance",
  "weight":30,
  "progress":0,
  "status":"in_progress",
  "start_date":"2026-01-01",
  "due_date":"2026-06-30",
  "measurement":"..."
}
```

**Update progression :**

```
PATCH /rest/v1/goals?id=eq.<id>
Body: { "progress": 60, "status": "on_track" }
```

### 7.2 Activités (`goal_activities`)

```
GET /rest/v1/goal_activities?goal_id=eq.<id>&order=planned_date.asc

POST /rest/v1/goal_activities
Body: {
  "organization_id":"<org>",
  "goal_id":"<goalId>",
  "employee_id":"<empId>",       // requis
  "title":"Publier le rapport Q2",
  "status":"planned",
  "planned_date":"2026-06-15"
}
```

### 7.3 OKR (`okrs`)

```
GET /rest/v1/okrs
  ?employee_id=eq.<empId>
  &quarter=eq.Q3-2026
  &select=id,objective,key_results,progress,status,quarter
```

```
POST /rest/v1/okrs
Body: {
  "organization_id":"<org>",
  "employee_id":"<empId>",
  "quarter":"Q3-2026",
  "objective":"Améliorer la satisfaction client",
  "key_results":[
    {"title":"NPS ≥ 60","target":60,"current":45,"weight":50},
    {"title":"CSAT ≥ 4,5/5","target":4.5,"current":4.1,"weight":50}
  ],
  "progress":0,
  "status":"active"
}
```

Mise à jour progression :
`PATCH /rest/v1/okrs?id=eq.<id>` body `{ "key_results":[...], "progress":68 }`.

### 7.4 Feedback (`feedbacks`)

```
GET /rest/v1/feedbacks
  ?to_employee_id=eq.<me>
  &select=id,kind,message,created_at,
          from:employees!from_employee_id(id,first_name,last_name,photo_url)
  &order=created_at.desc

POST /rest/v1/feedbacks
Body: {
  "organization_id":"<org>",
  "from_employee_id":"<me>",
  "to_employee_id":"<targetEmpId>",
  "kind":"kudos",
  "message":"Bravo pour la démo client !"
}
```

### 7.5 Réalisations (`achievements`)

```
GET /rest/v1/achievements
  ?employee_id=eq.<empId>
  &select=id,title,description,impact,achieved_at,
          goal:goals(id,title)
  &order=achieved_at.desc

POST /rest/v1/achievements
Body: {
  "organization_id":"<org>",
  "employee_id":"<empId>",         // requis
  "goal_id":"<goalId>"|null,
  "title":"...",
  "description":"...",
  "impact":"...",
  "achieved_at":"2026-07-01T00:00:00Z"
}
```

### 7.6 Plans, cycles & évaluations (lecture)

```
GET /rest/v1/performance_plans?organization_id=eq.<org>&order=period_start.desc
GET /rest/v1/performance_cycles?organization_id=eq.<org>&status=eq.open

GET /rest/v1/performance_reviews
  ?employee_id=eq.<me>
  &select=id,status,self_score,self_global_comment,manager_score,manager_global_comment,
          submitted_at,manager_submitted_at,
          cycle:performance_cycles(id,name,self_eval_opens_at,self_eval_closes_at),
          plan:performance_plans(id,name,period_start,period_end),
          manager:employees!manager_id(id,first_name,last_name,photo_url)
```

**Self-évaluation (optionnel V1)** :

```
PATCH /rest/v1/performance_reviews?id=eq.<id>&employee_id=eq.<me>
Body: {
  "self_global_comment":"...",
  "self_score": 4,
  "submitted_at": "2026-07-14T10:00:00Z"
}
```

Ne PAS toucher `manager_*` (contrôlé côté web par le manager).

---

## 8. Module Timeclock (consultation)

> Rappel : **aucune fonction de pointage** dans cette app. Le pointage NFC
> quotidien est géré par l'app dédiée (voir `flutter-timeclock.md`).

### 8.1 Historique des pointages

```
GET /rest/v1/time_logs
  ?organization_id=eq.<org>
  &select=id,employee_id,type,timestamp,latitude,longitude,source,
          employee:employees(id,first_name,last_name,photo_url)
  &order=timestamp.desc
  &limit=100
```

Filtres :
- `&employee_id=eq.<id>`
- `&timestamp=gte.2026-07-01T00:00:00Z&timestamp=lt.2026-08-01T00:00:00Z`
- `&type=eq.ARRIVEE`

RLS :
- owner / hr_admin → toutes les lignes de l'org.
- manager → uniquement son équipe (via jointure implicite).
- employee → uniquement `employee_id` correspondant à son `user_id`.

### 8.2 Zones de travail (`work_zones`) — CRUD

Autorisations :
- SELECT / INSERT / UPDATE : tout membre de l'org.
- DELETE : admin (`owner` / `hr_admin`) uniquement.

#### 8.2.1 Lister

```
GET /rest/v1/work_zones?organization_id=eq.<org>&select=*
```

Rendu carte : afficher un `Circle` (rayon `radius_meters`) pour
`shape='circle'`, un `Polygon` (sommets `polygon`) pour
`shape='polygon'`.

#### 8.2.2 Créer une zone circulaire

```
POST /rest/v1/work_zones
Prefer: return=representation
{
  "organization_id": "<org>",
  "name": "Siège Conakry",
  "shape": "circle",
  "latitude": 9.6412,
  "longitude": -13.5784,
  "radius_meters": 150,
  "polygon": null
}
```

#### 8.2.3 Créer une zone polygonale

```
POST /rest/v1/work_zones
Prefer: return=representation
{
  "organization_id": "<org>",
  "name": "Chantier A",
  "shape": "polygon",
  "latitude": 9.6412,           // premier sommet (indicatif)
  "longitude": -13.5784,
  "radius_meters": null,
  "polygon": [
    { "lat": 9.6412, "lng": -13.5784 },
    { "lat": 9.6420, "lng": -13.5770 },
    { "lat": 9.6405, "lng": -13.5760 }
  ]
}
```

Validation Flutter avant appel : `shape='polygon'` ⇒ `polygon.length ≥ 3`.

#### 8.2.4 Mettre à jour / renommer / repositionner

```
PATCH /rest/v1/work_zones?id=eq.<id>
{ "name": "…", "radius_meters": 200, "polygon": [...] }
```

#### 8.2.5 Supprimer (admin)

```
DELETE /rest/v1/work_zones?id=eq.<id>
```

Retourne `403` pour un membre non admin (RLS).

#### 8.2.6 Test « suis-je dans la zone ? »

Le calcul se fait **côté client** en Flutter avant d'appeler le pointage :
- `circle` : distance haversine < `radius_meters`.
- `polygon` : algorithme ray‑casting sur la liste de sommets.

Le serveur de pointage (`POST /api/public/timeclock/scan`) vérifie de
nouveau la position, mais bloquer l'appel côté mobile évite un aller‑
retour inutile.

---

## 8bis. Module Départements (CRUD)

Table : `departments` (cf. §4.5). Toutes les opérations passent par
PostgREST — pas d'endpoint dédié.

Autorisations :
- SELECT / INSERT / UPDATE : membre de l'org.
- DELETE physique : admin uniquement.
- **Suppression logique** (recommandée, alignée sur le web) :
  `PATCH deleted_at=now()` — autorisée aux membres.

```
GET   /rest/v1/departments?organization_id=eq.<org>&deleted_at=is.null
      &select=id,name,description,manager_id,employees:employees(id)
      &order=name

POST  /rest/v1/departments
      { "organization_id": "<org>", "name": "RH",
        "description": "Ressources humaines", "manager_id": null }

PATCH /rest/v1/departments?id=eq.<id>
      { "name": "…", "description": "…", "manager_id": "<emp>|null" }

PATCH /rest/v1/departments?id=eq.<id>          // suppression logique
      { "deleted_at": "2026-07-16T10:00:00Z" }

DELETE /rest/v1/departments?id=eq.<id>         // admin uniquement
```

Contraintes fonctionnelles :
- `name` : 2 à 100 caractères, unique conseillé côté UI.
- `description` : max 500 caractères.
- `manager_id` : doit référencer un `employees.id` de la même org.
- Compter les employés rattachés :
  `GET /rest/v1/employees?department_id=eq.<id>&select=id`.

---

## 8ter. Module Contrats (CRUD)

Table : `contracts` (cf. §4.22). RLS : lecture admin **ou** self,
écriture admin uniquement.

```
GET   /rest/v1/contracts?organization_id=eq.<org>
      &select=*,employees(id,first_name,last_name)
      &order=start_date.desc

GET   /rest/v1/contracts?employee_id=eq.<me>&select=*     // employé : ses contrats

POST  /rest/v1/contracts                                   // admin
      { "organization_id": "<org>", "employee_id": "<emp>",
        "type": "cdi", "status": "active",
        "start_date": "2026-07-01", "end_date": null,
        "trial_period_end": "2026-10-01",
        "salary": 5000000, "currency": "GNF",
        "document_url": "employee-docs/<org>/<emp>/contract.pdf",
        "notes": null }

PATCH /rest/v1/contracts?id=eq.<id>                        // admin
      { "status": "terminated", "end_date": "2026-12-31" }

DELETE /rest/v1/contracts?id=eq.<id>                       // admin
```

Notes UX :
- Alertes fin de contrat : filtrer `end_date` entre `now()` et
  `now()+30j` côté client.
- Alertes fin période d'essai : filtrer `trial_period_end`.
- Le PDF `document_url` doit être servi via une **URL signée**
  (`POST /storage/v1/object/sign/employee-docs/<path>`, cf. §10.2).

---

## 8quater. Module Compétences (CRUD)

Deux tables : `skills` (référentiel org, §4.23) et `employee_skills`
(association N‑N + niveau 1–5, §4.24).

### Référentiel `skills`

```
GET    /rest/v1/skills?organization_id=eq.<org>&order=category,name
POST   /rest/v1/skills        { "organization_id": "<org>", "name": "SQL",
                                "category": "technical" }
PATCH  /rest/v1/skills?id=eq.<id>       { "name": "…", "category": "…" }
DELETE /rest/v1/skills?id=eq.<id>       // admin
```

### Compétences par employé

```
GET   /rest/v1/employee_skills?employee_id=eq.<id>
      &select=id,level,skill:skills(id,name,category)

POST  /rest/v1/employee_skills
      { "organization_id": "<org>", "employee_id": "<emp>",
        "skill_id": "<sk>", "level": 3 }

PATCH /rest/v1/employee_skills?id=eq.<id>     { "level": 4 }

DELETE /rest/v1/employee_skills?id=eq.<id>    // admin
```

`level` ∈ [1..5]. Contrainte d'unicité `(employee_id, skill_id)` :
avant `POST`, vérifier via `GET …&skill_id=eq.<id>` et faire un `PATCH`
si la ligne existe déjà.

---

## 9. Notifications

### 9.1 Liste

```
GET /rest/v1/notifications
  ?user_id=eq.<auth.user.id>
  &order=created_at.desc
  &limit=50
  &select=id,type,title,body,link,read_at,created_at,organization_id
```

### 9.2 Marquer lu

```
PATCH /rest/v1/notifications?id=eq.<id>
Body: { "read_at": "2026-07-14T10:00:00Z" }
```

### 9.3 Realtime

S'abonner au canal Supabase Realtime sur `public.notifications` avec un
filtre `user_id=eq.<auth.user.id>` et l'événement `INSERT`. Chaque nouvel
enregistrement pousse un payload contenant la ligne créée.

Nécessite que Realtime soit activé sur la table `notifications` (déjà
configuré côté plateforme).


---

## 10. Stockage (avatars, docs, CV)

### 10.1 Buckets

| Bucket | Public ? | Contenu | Accès mobile |
| --- | --- | --- | --- |
| `avatars` | Oui (non sensible) | Photos profil, photos employés (`avatars/employees/<id>/photo.jpg`) | Lecture publique (URL directe), Upload authentifié |
| `employee-docs` | Non | Passeport, contrats, docs RH | **Signed URL** obligatoire ; owner/hr_admin/self uniquement |
| `cvs` | Non | CV candidats | Signed URL ; membres de l'org |
| `applications` | Non | Documents joints candidatures | Signed URL ; membres |
| `org-logos` | Oui | Logo organisation | Lecture publique |
| `social-media` | Non | Assets posts sociaux | Signed URL |

### 10.2 Signed URL

```
POST {SUPABASE_URL}/storage/v1/object/sign/<bucket>/<path>
Headers:
  apikey: <SUPABASE_ANON_KEY>
  Authorization: Bearer <access_token>
  Content-Type: application/json
Body:  { "expiresIn": 3600 }
Resp:  { "signedURL": "/object/sign/<bucket>/<path>?token=..." }
```

Concaténer avec `SUPABASE_URL/storage/v1` pour obtenir l'URL absolue.

### 10.3 Upload photo employé

Bucket public `avatars`, chemin `employees/<employeeId>/photo.jpg` :

```
POST {SUPABASE_URL}/storage/v1/object/avatars/employees/<id>/photo.jpg
Headers:
  apikey: <SUPABASE_ANON_KEY>
  Authorization: Bearer <access_token>
  Content-Type: image/jpeg
  x-upsert: true
Body:  <binaire>
```

URL publique retournée par
`GET {SUPABASE_URL}/storage/v1/object/public/avatars/employees/<id>/photo.jpg`.

Après upload, mettre à jour la colonne applicative :

```
PATCH {SUPABASE_URL}/rest/v1/employees?id=eq.<id>
Body: { "photo_url": "https://…/storage/v1/object/public/avatars/employees/<id>/photo.jpg" }
```


### 10.4 Upload document employé

Bucket privé `employee-docs`, chemin
`employees/<employeeId>/<type>-<uuid>.<ext>`. Sauvegarder **le chemin**
dans la colonne applicative (pas d'URL publique).

---

## 11. Endpoint public de pointage (référence)

Non utilisé par cette app en V1 (une app dédiée le gère), documenté ici
pour référence en cas de besoin d'un mode de secours.

```
POST {BASE_URL}/api/public/timeclock/scan
Headers:
  Authorization: Bearer <access_token>
  Content-Type: application/json
Body:
  {
    "organization_id":"<org>",
    "badge_uid":"04:A2:1B:C3:2D:5E:80",
    "latitude": 9.6412,     // optionnel (Guinée-Conakry par défaut)
    "longitude": -13.5784,  // optionnel
    "device_id":"..."       // optionnel
  }
Réponse OK:
  { "ok":true, "type":"ARRIVEE|DEPART", "timestamp":"...", "deduped":false,
    "employee": { "id":"...", "first_name":"...", "last_name":"...", "photo_url":"..." } }
```

Autorisation : `owner | hr_admin | security_agent` sur l'organisation.
Voir `flutter-timeclock.md` pour le détail complet.

---

## 12. Récapitulatif endpoints & headers

### 12.1 Headers standard

**Data API (Supabase REST) :**

```
apikey: <SUPABASE_ANON_KEY>
Authorization: Bearer <access_token>
Content-Type: application/json          (POST/PATCH)
Accept: application/json
Prefer: return=representation           (POST/PATCH quand on veut la ligne)
Prefer: return=minimal                  (POST/PATCH sinon)
```

**Auth (Supabase) :**

```
apikey: <SUPABASE_ANON_KEY>
Content-Type: application/json
```

**Backend Lovable `/api/public/*` :**

```
Authorization: Bearer <access_token>
Content-Type: application/json
```

### 12.2 Tableau global

**Légende des rôles requis** (colonne « Rôles requis ») :

- `public` : aucun token requis (endpoint anonyme / policy `TO anon`).
- `self` : l'utilisateur agit sur sa propre ressource (`auth.uid()` =
  colonne `user_id` / `author_id` / …).
- `membre` : `is_org_member(auth.uid(), organization_id)` — tout rôle
  Konkouré rattaché à l'org (`employee`, `manager`, `security_agent`,
  `hr_admin`, `owner`).
- `manager` : employé référencé comme `manager_id` de la ressource
  (utilisé pour `performance_reviews`).
- `admin` : `is_org_admin` — `owner` **ou** `hr_admin` uniquement.

| Méthode | Endpoint | Auth | Rôles requis | Notes |
| --- | --- | --- | --- | --- |
| POST | `{S}/auth/v1/token?grant_type=password` | apikey | public | Login email |
| POST | `{S}/auth/v1/token?grant_type=refresh_token` | apikey | public | Refresh |
| POST | `{S}/auth/v1/logout` | Bearer | self | Logout |
| GET | `{S}/rest/v1/profiles?id=eq.<uid>` | Bearer | self | Profil |
| PATCH | `{S}/rest/v1/profiles?id=eq.<uid>` | Bearer | self | Modifier profil |
| GET | `{S}/rest/v1/user_roles?user_id=eq.<uid>` | Bearer | self / admin | Rôles |
| GET | `{S}/rest/v1/organizations?id=in.(...)` | Bearer | membre | Org info |
| GET | `{S}/rest/v1/employees?organization_id=eq.<org>` | Bearer | membre | Liste employés |
| POST | `{S}/rest/v1/employees` | Bearer | admin | Créer employé |
| PATCH | `{S}/rest/v1/employees?id=eq.<id>` | Bearer | admin ou self | Édition (colonnes NFC / salariales exclues) |
| DELETE | `{S}/rest/v1/employees?id=eq.<id>` | Bearer | admin | Supprimer employé |
| POST | `{BASE}/api/public/employees/assign-badge` | Bearer | admin | Assigner badge NFC (⚠️ ne PAS appeler la RPC PostgREST) |
| POST | `{BASE}/api/public/employees/revoke-badge` | Bearer | admin | Révoquer badge NFC (⚠️ ne PAS appeler la RPC PostgREST) |
| GET | `{S}/rest/v1/nfc_badge_history?employee_id=eq.<id>` | Bearer | admin | Historique badges |
| GET | `{S}/rest/v1/departments?organization_id=eq.<org>&deleted_at=is.null` | Bearer | membre | Liste départements |
| POST | `{S}/rest/v1/departments` | Bearer | membre | Créer département |
| PATCH | `{S}/rest/v1/departments?id=eq.<id>` | Bearer | membre | Modifier / soft-delete (`deleted_at`) |
| DELETE | `{S}/rest/v1/departments?id=eq.<id>` | Bearer | admin | Suppression physique |
| GET | `{S}/rest/v1/contracts?organization_id=eq.<org>` | Bearer | admin ou self | Contrats |
| POST | `{S}/rest/v1/contracts` | Bearer | admin | Créer contrat |
| PATCH | `{S}/rest/v1/contracts?id=eq.<id>` | Bearer | admin | Modifier contrat |
| DELETE | `{S}/rest/v1/contracts?id=eq.<id>` | Bearer | admin | Supprimer contrat |
| GET | `{S}/rest/v1/skills?organization_id=eq.<org>` | Bearer | membre | Référentiel |
| POST | `{S}/rest/v1/skills` | Bearer | membre | Créer compétence |
| PATCH | `{S}/rest/v1/skills?id=eq.<id>` | Bearer | membre | Modifier compétence |
| DELETE | `{S}/rest/v1/skills?id=eq.<id>` | Bearer | admin | Suppr. compétence |
| GET | `{S}/rest/v1/employee_skills?employee_id=eq.<id>` | Bearer | membre | Compétences d'un employé |
| POST | `{S}/rest/v1/employee_skills` | Bearer | membre | Attribuer |
| PATCH | `{S}/rest/v1/employee_skills?id=eq.<id>` | Bearer | membre | Modifier `level` (1–5) |
| DELETE | `{S}/rest/v1/employee_skills?id=eq.<id>` | Bearer | admin | Retirer |
| GET | `{S}/rest/v1/jobs?organization_id=eq.<org>` | Bearer | membre | Liste offres |
| POST | `{S}/rest/v1/jobs` | Bearer | membre | Créer offre |
| PATCH | `{S}/rest/v1/jobs?id=eq.<id>` | Bearer | membre | Modifier offre |
| DELETE | `{S}/rest/v1/jobs?id=eq.<id>` | Bearer | admin | Supprimer offre |
| GET | `{S}/rest/v1/candidates?job_id=eq.<id>` | Bearer | membre | Candidats |
| POST | `{S}/rest/v1/candidates` | Bearer | membre / public | Publique uniquement si `job.status='published'` |
| PATCH | `{S}/rest/v1/candidates?id=eq.<id>` | Bearer | membre | Changer étape |
| DELETE | `{S}/rest/v1/candidates?id=eq.<id>` | Bearer | admin | – |
| POST | `{S}/rest/v1/candidate_notes` | Bearer | membre + `author_id=uid` | Note |
| DELETE | `{S}/rest/v1/candidate_notes?id=eq.<id>` | Bearer | auteur / admin | – |
| GET | `{S}/rest/v1/candidate_activities?candidate_id=eq.<id>` | Bearer | membre | Timeline |
| POST | `{S}/rest/v1/candidate_activities` | Bearer | membre + `actor_id=uid` | `type ∈ {note_added, note_deleted}` uniquement |
| GET | `{S}/rest/v1/goals?employee_id=eq.<id>` | Bearer | membre | Objectifs |
| POST | `{S}/rest/v1/goals` | Bearer | membre | `owner_id` requis |
| PATCH | `{S}/rest/v1/goals?id=eq.<id>` | Bearer | membre | Update |
| DELETE | `{S}/rest/v1/goals?id=eq.<id>` | Bearer | admin | – |
| GET/POST/PATCH | `{S}/rest/v1/goal_activities` | Bearer | membre | `employee_id` requis |
| DELETE | `{S}/rest/v1/goal_activities?id=eq.<id>` | Bearer | admin | – |
| GET/POST/PATCH | `{S}/rest/v1/okrs` | Bearer | membre | `employee_id` requis |
| DELETE | `{S}/rest/v1/okrs?id=eq.<id>` | Bearer | admin | – |
| GET/POST/PATCH | `{S}/rest/v1/feedbacks` | Bearer | membre | – |
| DELETE | `{S}/rest/v1/feedbacks?id=eq.<id>` | Bearer | admin | – |
| GET/POST/PATCH | `{S}/rest/v1/achievements` | Bearer | membre | `employee_id` requis |
| DELETE | `{S}/rest/v1/achievements?id=eq.<id>` | Bearer | admin | – |
| GET | `{S}/rest/v1/performance_plans` | Bearer | membre | Lecture |
| POST/PATCH/DELETE | `{S}/rest/v1/performance_plans` | Bearer | admin | Gestion des plans |
| GET | `{S}/rest/v1/performance_cycles` | Bearer | membre | Lecture |
| POST/PATCH/DELETE | `{S}/rest/v1/performance_cycles` | Bearer | admin | Gestion des cycles |
| GET | `{S}/rest/v1/performance_reviews?employee_id=eq.<me>` | Bearer | membre | Self read |
| POST | `{S}/rest/v1/performance_reviews` | Bearer | admin | Créer évaluation |
| PATCH | `{S}/rest/v1/performance_reviews?id=eq.<id>` | Bearer | admin / self (`self_*`) / manager (`manager_*`) | Restreindre colonnes côté UI |
| DELETE | `{S}/rest/v1/performance_reviews?id=eq.<id>` | Bearer | admin | – |
| GET | `{S}/rest/v1/time_logs?organization_id=eq.<org>` | Bearer | membre (RLS §8.1) | Consultation |
| POST/PATCH/DELETE | `{S}/rest/v1/time_logs` | – | **interdit** | Passer par `record_punch` / endpoint public scan |
| GET | `{S}/rest/v1/work_zones?organization_id=eq.<org>` | Bearer | membre | Zones (liste) |
| POST | `{S}/rest/v1/work_zones` | Bearer | membre | Créer zone (cercle ou polygone) |
| PATCH | `{S}/rest/v1/work_zones?id=eq.<id>` | Bearer | membre | Modifier zone |
| DELETE | `{S}/rest/v1/work_zones?id=eq.<id>` | Bearer | admin | Supprimer zone |
| GET | `{S}/rest/v1/notifications?user_id=eq.<uid>` | Bearer | self | Notifs |
| PATCH | `{S}/rest/v1/notifications?id=eq.<id>` | Bearer | self | Marquer lu (`read_at`) |
| DELETE | `{S}/rest/v1/notifications?id=eq.<id>` | Bearer | admin | – (INSERT interdit côté mobile) |
| POST | `{S}/storage/v1/object/sign/<bucket>/<path>` | Bearer | RLS storage | Signed URL |
| POST | `{S}/storage/v1/object/<bucket>/<path>` | Bearer | RLS storage | Upload |
| POST | `{BASE}/api/public/timeclock/scan` | Bearer | admin / security_agent | Pointage (app dédiée) |
| POST | `{BASE}/api/public/employees/assign-badge` | Bearer | admin | Assigner badge NFC (endpoint public REST) |
| POST | `{BASE}/api/public/employees/revoke-badge` | Bearer | admin | Révoquer badge NFC |
| GET | `{BASE}/api/public/employees/{id}/badge` | Bearer | admin ou self | État badge d'un employé |

`{S}` = `SUPABASE_URL`. `{BASE}` = `BASE_URL` Lovable.

### 12.3 Endpoints REST à créer côté backend (V2)

Voir §5.5. Non bloquants pour la V1 mobile (RPC équivalentes existent déjà).

---

## 13. Gestion d'erreurs

### 13.1 Codes HTTP

| Code | Signification | Action UI |
| --- | --- | --- |
| 401 | Token invalide / expiré | Rafraîchir la session ; sinon rediriger vers login |
| 403 | RLS refuse / rôle insuffisant | Toast « Vous n'avez pas les droits nécessaires » |
| 404 | Ressource inexistante | Écran « Non trouvé » |
| 409 | Conflit (ex. UID badge déjà attribué) | Proposer résolution |
| 422 | Validation (mauvais format) | Afficher détails champ par champ |
| 429 | Rate limit (Supabase Auth) | Attente + retry exponentiel |
| 5xx | Erreur serveur | Retry + toast + Sentry |

### 13.2 Format des erreurs

**PostgREST** :

```json
{ "code":"42501", "details":null, "hint":null, "message":"new row violates row-level security policy" }
```

**Supabase Auth** :

```json
{ "error":"invalid_grant", "error_description":"Invalid login credentials" }
```

**Endpoints `/api/public/*`** :

```json
{ "ok":false, "error":"FORBIDDEN|VALIDATION_ERROR|UNAUTHORIZED|INTERNAL_ERROR", "message":"..." }
```

---

## 14. Références internes


- `docs/mobile/flutter-timeclock.md` — app pointage NFC (compagnon).
- `src/lib/employees.functions.ts` — logique badges NFC côté web.
- `src/lib/timeclock.server.ts` — RPC `record_punch` (référence).
- `src/routes/api.public.timeclock.scan.ts` — pattern d'endpoint REST
  public à copier pour §5.5.
- Fonctions Postgres :
  - `public.admin_assign_employee_badge(p_employee, p_uid, p_active, p_actor)`
  - `public.admin_revoke_employee_badge(p_employee, p_actor)`
  - `public.record_punch(p_org, p_employee, p_lat, p_lng, p_source, p_dedupe_seconds)` (référence)
  - `private.is_org_member(uid, org_id)` — utilisé par RLS
  - `private.is_org_admin(uid, org_id)` — utilisé par RLS
