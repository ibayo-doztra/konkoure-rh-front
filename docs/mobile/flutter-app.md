> **Transition AdonisJS** : ce document décrit l'intégration actuelle (Lovable Cloud). Dans la cible, l'app n'utilise plus `supabase_flutter` : authentification via `POST /v1/auth/login` (jeton opaque stocké dans le stockage sécurisé), pointage via `POST /v1/timeclock/punches`, base `API_URL=https://api.konkoure.doztra.cloud`. Les contrats font foi dans `docs/backend/06-api-reference.md`.

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
14. [Annexes — exemples Dart & checklist](#14-annexes)

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

## 2. Stack Flutter & bootstrap

### 2.1 Packages recommandés

```yaml
# pubspec.yaml
dependencies:
  flutter:
    sdk: flutter
  supabase_flutter: ^2.5.0       # Auth + PostgREST + Storage + Realtime
  nfc_manager: ^3.3.0            # Lecture UID NFC (Android + iOS 13+)
  dio: ^5.4.0                    # Appels /api/public/* (Lovable backend)
  flutter_riverpod: ^2.5.1       # State management
  go_router: ^13.2.0             # Navigation
  flutter_secure_storage: ^9.0.0 # Stockage sécurisé (fallback tokens si besoin)
  intl: ^0.19.0
  cached_network_image: ^3.3.0
  google_maps_flutter: ^2.6.0    # Optionnel : carte des zones
```

### 2.2 Configuration (`--dart-define`)

Trois URLs / clés à injecter au build.

| Variable | Valeur (prod) | Rôle |
| --- | --- | --- |
| `SUPABASE_URL` | `https://rvmpporrsxdnbkwntyqh.supabase.co` | Auth + Data API + Storage |
| `SUPABASE_ANON_KEY` | Clé publishable (voir `.env` web : `VITE_SUPABASE_PUBLISHABLE_KEY`) | Publique, safe à embarquer |
| `BASE_URL` | `https://konkoure.lovable.app` (prod) ou `https://project--6327e517-24e0-4247-892c-b1564311a161-dev.lovable.app` (dev) | Backend Lovable (endpoints `/api/public/*`) |

> ⚠️ Ne jamais embarquer `SUPABASE_SERVICE_ROLE_KEY` dans l'APK.
> Toute action privilégiée passe par un endpoint serveur qui vérifie le rôle.

Lancement typique :

```bash
flutter run \
  --dart-define=SUPABASE_URL=https://rvmpporrsxdnbkwntyqh.supabase.co \
  --dart-define=SUPABASE_ANON_KEY=<publishable_key> \
  --dart-define=BASE_URL=https://konkoure.lovable.app
```

### 2.3 `lib/core/config.dart`

```dart
class Config {
  static const supabaseUrl = String.fromEnvironment('SUPABASE_URL');
  static const supabaseAnonKey = String.fromEnvironment('SUPABASE_ANON_KEY');
  static const baseUrl = String.fromEnvironment('BASE_URL');
}
```

### 2.4 `main.dart`

```dart
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Supabase.initialize(
    url: Config.supabaseUrl,
    anonKey: Config.supabaseAnonKey,
    authOptions: const FlutterAuthClientOptions(
      authFlowType: AuthFlowType.pkce,
    ),
  );
  runApp(const ProviderScope(child: KonkoureApp()));
}
```

### 2.5 Client Dio pour `/api/public/*`

```dart
final dio = Dio(BaseOptions(
  baseUrl: Config.baseUrl,
  connectTimeout: const Duration(seconds: 10),
  receiveTimeout: const Duration(seconds: 20),
  headers: {'Content-Type': 'application/json'},
));

dio.interceptors.add(InterceptorsWrapper(
  onRequest: (options, handler) {
    final session = Supabase.instance.client.auth.currentSession;
    if (session != null) {
      options.headers['Authorization'] = 'Bearer ${session.accessToken}';
    }
    handler.next(options);
  },
));
```

Pour tout appel Supabase Data API / Storage / Auth, utilisez le SDK
`supabase_flutter` — il gère automatiquement les headers `apikey` et
`Authorization`.

---

## 3. Authentification & session

### 3.1 Sign-in email/mot de passe

SDK : `Supabase.instance.client.auth.signInWithPassword(email:, password:)`

Endpoint sous-jacent :

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

Géré automatiquement par `supabase_flutter`. Endpoints :

```
POST {SUPABASE_URL}/auth/v1/token?grant_type=refresh_token
POST {SUPABASE_URL}/auth/v1/logout          (Authorization: Bearer <access>)
```

### 3.3 Google OAuth (mobile)

> ⚠️ Le broker `lovable.auth.signInWithOAuth` **n'est pas utilisable côté
> mobile** (il repose sur postMessage entre iframes). Sur mobile on utilise
> l'OAuth Supabase natif avec deep link.

1. Déclarer un schéma custom dans `AndroidManifest.xml` et `Info.plist`,
   ex. `io.konkoure.app://login-callback`.
2. Ajouter ce redirect dans la config Supabase Auth (déjà présente pour
   Google) : **Authentication → URL Configuration → Redirect URLs**.
3. Code Flutter :

```dart
await Supabase.instance.client.auth.signInWithOAuth(
  OAuthProvider.google,
  redirectTo: 'io.konkoure.app://login-callback',
  authScreenLaunchMode: LaunchMode.externalApplication,
);
```

Le SDK écoute `onAuthStateChange`. Redirigez vers le home lorsque
`event == AuthChangeEvent.signedIn`.

### 3.4 Reset password

```dart
await supabase.auth.resetPasswordForEmail(
  email,
  redirectTo: 'io.konkoure.app://reset-password',
);
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

`supabase_flutter` persiste automatiquement la session dans `SharedPreferences`
(chiffrées sur iOS via Keychain avec `authOptions.pkceAsyncStorage`). Pas
d'action requise.

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

Policies :

- SELECT : `is_org_member(auth.uid(), organization_id)`
- INSERT : admins
- UPDATE : admins OU l'employé sur sa propre fiche (`user_id = auth.uid()`)
- DELETE : admins

### 4.5 `departments`

`id`, `organization_id`, `name`, `description`, `manager_id`,
`deleted_at`.

Lecture : membres. Écriture : admins.

### 4.6 `jobs`

`id`, `organization_id`, `title`, `department_id`, `location`, `description`,
`requirements`, `status` (`draft|published|closed`), `inclusive_score`,
`created_by`, `deadline`, `slug`, `required_documents` (JSONB),
`contract_type` (`cdi|cdd|stage|freelance|apprentissage`).

Lecture : membres. Insert/Update/Delete : admins.
Une politique INSERT publique existe (formulaire carrières) mais ne concerne
pas le mobile.

### 4.7 `candidates`

`id`, `organization_id`, `job_id`, `full_name`, `email`, `phone`, `cv_url`,
`cv_text`, `ai_score`, `ai_justification`, `stage`
(`new|reviewing|interview|offer|hired|rejected`),
`cover_letter_url`, `documents` (JSONB).

Lecture : membres. Update : membres. Delete : admins.
Insert : membres OR public (via job publié — pas utilisé par mobile).

### 4.8 `candidate_notes`

`id`, `organization_id`, `candidate_id`, `author_id`, `body`.

Lecture : membres. Insert : membre + `author_id = auth.uid()`.
Delete : auteur ou admin.

### 4.9 `candidate_activities`

`id`, `organization_id`, `candidate_id`, `actor_id`, `type`
(`created|stage_changed|scored|note_added|note_deleted`),
`payload` (JSONB).

Lecture : membres. **Insert restreint** : uniquement `type` ∈
{`note_added`, `note_deleted`} et `actor_id = auth.uid()`. Les autres
types sont posés par triggers serveur (ex. `stage_changed` lors d'un
UPDATE `candidates.stage`).

### 4.10 `goals`

`id`, `organization_id`, `employee_id` (obligatoire), `parent_goal_id`,
`title`, `description`, `category`, `weight`, `progress` (0-100),
`status`, `start_date`, `due_date`, `end_date`, `measurement`,
`owner_id` (obligatoire — trigger `goals_require_owner`), `created_by_id`,
`review_id`, `plan_id`.

Lecture/Écriture : membres de l'org (RLS large — vérifiez côté UI qui
peut éditer quoi).

### 4.11 `goal_activities`

`id`, `organization_id`, `goal_id`, `employee_id` (obligatoire — trigger),
`title`, `description`, `status`, `planned_date`, `completed_at`.

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

### 4.13 `feedbacks`

`id`, `organization_id`, `from_employee_id`, `to_employee_id`,
`kind` (`kudos|constructive|coaching`), `message`.

### 4.14 `achievements`

`id`, `organization_id`, `goal_id` (nullable), `employee_id` (obligatoire),
`title`, `description`, `impact`, `achieved_at`.

### 4.15 `performance_plans`

`id`, `organization_id`, `name`, `period_start`, `period_end`,
`status`, `created_by`.

Lecture seule côté mobile.

### 4.16 `performance_cycles`

`id`, `organization_id`, `name`, `frequency`, `period_start`,
`period_end`, `self_eval_opens_at`, `self_eval_closes_at`, `status`.

### 4.17 `performance_reviews`

`id`, `organization_id`, `cycle_id`, `plan_id`, `employee_id`,
`manager_id`, `status`, `self_global_comment`, `self_score`,
`submitted_at`, `manager_score`, `manager_global_comment`,
`manager_submitted_at`.

Trigger : `plan_id` OU `cycle_id` obligatoire.

### 4.18 `time_logs`

`id`, `organization_id`, `employee_id`, `type` (`ARRIVEE|DEPART`),
`timestamp`, `latitude`, `longitude`, `source`.

**Lecture seule mobile.** Les INSERT passent uniquement par la RPC
`record_punch` (utilisée par l'app pointage dédiée, pas par cette app).

### 4.19 `work_zones`

`id`, `organization_id`, `name`, `latitude`, `longitude`, `radius_meters`,
plus champs d'adresse.

Lecture seule mobile.

### 4.20 `nfc_badge_history`

`id`, `organization_id`, `employee_id`, `uid`, `event`
(`assigned|revoked|deactivated|reactivated`), `reason`, `actor_user_id`.

Lecture : admins. Écriture : trigger backend uniquement.

### 4.21 `notifications`

`id`, `organization_id`, `user_id`, `type`, `title`, `body`, `link`,
`read_at`.

Lecture/Update : `user_id = auth.uid()`. Delete : idem.

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

Un employé standard peut PATCHer sa propre fiche (RLS le limite aux
colonnes visibles ; en pratique, éviter d'exposer `base_salary`,
`department_id`, `manager_id`, `status` à l'employé côté UI).

### 5.4 Assignation d'un badge NFC (scan)

**Accès : `owner` ou `hr_admin` uniquement** (contrôle dans la RPC).

#### 5.4.1 Lecture UID via NFC

Utiliser `nfc_manager`. Le badge est un tag NFC standard (MIFARE
Ultralight / NTAG213 / carte ISO 14443A) dont on lit l'UID.

```dart
Future<String?> scanBadgeUid() async {
  final available = await NfcManager.instance.isAvailable();
  if (!available) throw 'NFC indisponible sur cet appareil';

  final completer = Completer<String?>();
  NfcManager.instance.startSession(
    onDiscovered: (tag) async {
      final id = _extractUid(tag);
      await NfcManager.instance.stopSession();
      completer.complete(id);
    },
    onError: (e) async => completer.completeError(e),
  );
  return completer.future;
}

String _extractUid(NfcTag tag) {
  // Android
  final nfca = tag.data['nfca'] as Map?;
  final idBytes = (nfca?['identifier'] ?? tag.data['isodep']?['identifier']
      ?? tag.data['mifare']?['identifier'] ?? tag.data['nfcf']?['identifier']) as List?;
  if (idBytes == null) return '';
  return idBytes
      .map((b) => (b as int).toRadixString(16).padLeft(2, '0').toUpperCase())
      .join(':');
}
```

**Format canonique de l'UID** : hex majuscule séparé par `:`, ex
`04:A2:1B:C3:2D:5E:80`. Ce format est celui utilisé par l'app pointage,
il **doit** être identique pour que le badge soit reconnu au pointage.

#### 5.4.2 Assignation serveur (via RPC PostgREST)

L'app web utilise une **server function TanStack** (`assignEmployeeBadge`)
non appelable depuis Flutter. Alternative directe : appeler la RPC
Postgres `admin_assign_employee_badge` qui vérifie elle-même le rôle et
journalise dans `nfc_badge_history`.

```
POST {SUPABASE_URL}/rest/v1/rpc/admin_assign_employee_badge
Headers:
  apikey: <ANON>
  Authorization: Bearer <token>
  Content-Type: application/json
  Accept: application/json
Body:
  {
    "p_employee": "<employeeId>",
    "p_uid": "04:A2:1B:C3:2D:5E:80",
    "p_active": true,
    "p_actor":  "<auth.user.id>"
  }
```

Réponse : tableau avec une ligne

```json
[{ "out_id": "...", "out_nfc_badge_uid": "04:...",
   "out_nfc_badge_active": true,
   "out_nfc_badge_assigned_at": "2026-07-14T10:00:00Z" }]
```

Erreurs possibles :

- `Non autorisé` → l'utilisateur n'est pas `owner|hr_admin` de l'org.
- `Employé introuvable` → id inconnu.
- Contrainte unique `employees_org_badge_unique` → l'UID est déjà attribué
  à un autre employé actif de l'organisation. Proposer à l'utilisateur de
  **révoquer** l'ancien attribution.

#### 5.4.3 Révocation

```
POST {SUPABASE_URL}/rest/v1/rpc/admin_revoke_employee_badge
Body:
  { "p_employee": "<employeeId>", "p_actor": "<auth.user.id>" }
```

Passe `nfc_badge_uid` à `NULL` et réactive `nfc_badge_active`. L'événement
`revoked` est enregistré dans `nfc_badge_history`.

#### 5.4.4 Désactivation temporaire

Pour désactiver sans révoquer (perte temporaire de badge par ex.) :
appeler `admin_assign_employee_badge` en repassant le même UID avec
`p_active = false`. Un événement `deactivated` est enregistré.

#### 5.4.5 Lecture de l'état du badge

Il n'existe pas encore de RPC/endpoint public dédié.

**Recommandation** (à créer côté backend Lovable — voir §5.5) : endpoint
`GET /api/public/employees/{id}/badge`. En attendant, faire lire la fiche
badge par un admin via **la web** ou proposer côté mobile :

- Afficher l'historique via `GET /rest/v1/nfc_badge_history?employee_id=eq.<id>&order=created_at.desc&limit=20`
  (accessible aux admins uniquement). Le dernier événement `assigned` sans
  `revoked` postérieur donne l'UID courant.

#### 5.4.6 Historique complet

```
GET /rest/v1/nfc_badge_history
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
`applications`) :

```dart
final signed = await Supabase.instance.client.storage
  .from('cvs')
  .createSignedUrl(pathFromUrl(candidate.cvUrl), 3600); // 1h
```

Convertir `cv_url` public → chemin :
- Si `cv_url` commence par `http` et contient `/storage/v1/object/public/cvs/`, extraire
  la partie après `/cvs/`.
- Sinon supposer qu'`cv_url` est déjà le chemin dans le bucket.

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

### 8.2 Zones de travail (`work_zones`)

```
GET /rest/v1/work_zones?organization_id=eq.<org>&select=*
```

Colonnes attendues (à confirmer) : `latitude`, `longitude`, `radius_meters`,
`name`, `address`. À afficher sur une `GoogleMap` avec `Circle` de rayon.
Aucune écriture depuis le mobile en V1.

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

```dart
final channel = Supabase.instance.client
  .channel('notifications:$userId')
  .onPostgresChanges(
    event: PostgresChangeEvent.insert,
    schema: 'public',
    table: 'notifications',
    filter: PostgresChangeFilter(
      type: PostgresChangeFilterType.eq,
      column: 'user_id',
      value: userId,
    ),
    callback: (payload) => _onNewNotification(payload.newRecord),
  )
  .subscribe();
```

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

```dart
final url = await supabase.storage
  .from('cvs')
  .createSignedUrl(path, 3600); // TTL 1h
```

### 10.3 Upload photo employé

```dart
await supabase.storage.from('avatars').uploadBinary(
  'employees/$employeeId/photo.jpg',
  bytes,
  fileOptions: const FileOptions(upsert: true, contentType: 'image/jpeg'),
);
final publicUrl = supabase.storage.from('avatars').getPublicUrl('employees/$employeeId/photo.jpg');
await supabase.from('employees').update({'photo_url': publicUrl}).eq('id', employeeId);
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

| Méthode | Endpoint | Auth | Rôles requis | Notes |
| --- | --- | --- | --- | --- |
| POST | `{S}/auth/v1/token?grant_type=password` | apikey | – | Login email |
| POST | `{S}/auth/v1/token?grant_type=refresh_token` | apikey | – | Refresh |
| POST | `{S}/auth/v1/logout` | Bearer | – | Logout |
| GET | `{S}/rest/v1/profiles?id=eq.<uid>` | Bearer | self | Profil |
| GET | `{S}/rest/v1/user_roles?user_id=eq.<uid>` | Bearer | self / admin | Rôles |
| GET | `{S}/rest/v1/organizations?id=in.(...)` | Bearer | membre | Org info |
| GET | `{S}/rest/v1/employees?organization_id=eq.<org>` | Bearer | membre | Liste employés |
| PATCH | `{S}/rest/v1/employees?id=eq.<id>` | Bearer | admin ou self | Édition |
| POST | `{S}/rest/v1/rpc/admin_assign_employee_badge` | Bearer | owner/hr_admin | Assigner badge NFC |
| POST | `{S}/rest/v1/rpc/admin_revoke_employee_badge` | Bearer | owner/hr_admin | Révoquer badge NFC |
| GET | `{S}/rest/v1/nfc_badge_history?employee_id=eq.<id>` | Bearer | owner/hr_admin | Historique badges |
| GET | `{S}/rest/v1/departments?organization_id=eq.<org>` | Bearer | membre | Liste départements |
| GET | `{S}/rest/v1/jobs?organization_id=eq.<org>` | Bearer | membre | Liste offres |
| POST | `{S}/rest/v1/jobs` | Bearer | admin | Créer offre |
| PATCH | `{S}/rest/v1/jobs?id=eq.<id>` | Bearer | admin | Modifier offre |
| GET | `{S}/rest/v1/candidates?job_id=eq.<id>` | Bearer | membre | Candidats |
| PATCH | `{S}/rest/v1/candidates?id=eq.<id>` | Bearer | membre | Changer étape |
| POST | `{S}/rest/v1/candidate_notes` | Bearer | membre + `author_id=uid` | Note |
| GET | `{S}/rest/v1/candidate_activities?candidate_id=eq.<id>` | Bearer | membre | Timeline |
| GET | `{S}/rest/v1/goals?employee_id=eq.<id>` | Bearer | membre | Objectifs |
| POST | `{S}/rest/v1/goals` | Bearer | membre | Créer (owner_id requis) |
| PATCH | `{S}/rest/v1/goals?id=eq.<id>` | Bearer | membre | Update |
| GET/POST/PATCH | `{S}/rest/v1/goal_activities` | Bearer | membre | employee_id requis |
| GET/POST/PATCH | `{S}/rest/v1/okrs` | Bearer | membre | employee_id requis |
| GET/POST | `{S}/rest/v1/feedbacks` | Bearer | membre | – |
| GET/POST | `{S}/rest/v1/achievements` | Bearer | membre | employee_id requis |
| GET | `{S}/rest/v1/performance_plans` | Bearer | membre | Lecture |
| GET | `{S}/rest/v1/performance_cycles` | Bearer | membre | Lecture |
| GET | `{S}/rest/v1/performance_reviews?employee_id=eq.<me>` | Bearer | membre | Self read |
| PATCH | `{S}/rest/v1/performance_reviews?id=eq.<id>` | Bearer | self (self_*) / manager (manager_*) | – |
| GET | `{S}/rest/v1/time_logs?organization_id=eq.<org>` | Bearer | RLS (voir §8.1) | Consultation |
| GET | `{S}/rest/v1/work_zones?organization_id=eq.<org>` | Bearer | membre | Zones |
| GET | `{S}/rest/v1/notifications?user_id=eq.<uid>` | Bearer | self | Notifs |
| PATCH | `{S}/rest/v1/notifications?id=eq.<id>` | Bearer | self | Marquer lu |
| POST | `{S}/storage/v1/object/sign/<bucket>/<path>` | Bearer | RLS storage | Signed URL |
| POST | `{S}/storage/v1/object/<bucket>/<path>` | Bearer | RLS storage | Upload |
| POST | `{BASE}/api/public/timeclock/scan` | Bearer | owner/hr_admin/security_agent | Pointage (non utilisé V1 mobile) |

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

### 13.3 Convention Dart

```dart
sealed class ApiError implements Exception {
  const ApiError(this.message);
  final String message;
}
class UnauthorizedError extends ApiError { const UnauthorizedError(super.m); }
class ForbiddenError    extends ApiError { const ForbiddenError(super.m); }
class NotFoundError     extends ApiError { const NotFoundError(super.m); }
class ValidationError   extends ApiError { const ValidationError(super.m); }
class ServerError       extends ApiError { const ServerError(super.m); }

ApiError mapError(Object e) {
  if (e is PostgrestException) {
    if (e.code == '42501') return ForbiddenError(e.message);
    if (e.code == 'PGRST116') return NotFoundError(e.message);
    return ServerError(e.message);
  }
  if (e is AuthException) return UnauthorizedError(e.message);
  return ServerError(e.toString());
}
```

---

## 14. Annexes

### 14.1 Exemple — provider employés (Riverpod + Supabase)

```dart
final employeesProvider = FutureProvider.family<List<Employee>, String>(
  (ref, orgId) async {
    final rows = await Supabase.instance.client
      .from('employees')
      .select('id,first_name,last_name,job_title,photo_url,status,'
              'department:departments(id,name)')
      .eq('organization_id', orgId)
      .order('last_name', ascending: true);
    return (rows as List).map(Employee.fromJson).toList();
  },
);
```

### 14.2 Exemple — écran « Scanner un badge » (owner/hr_admin)

```dart
class AssignBadgeScreen extends ConsumerStatefulWidget {
  const AssignBadgeScreen({required this.employeeId, super.key});
  final String employeeId;
  @override
  ConsumerState<AssignBadgeScreen> createState() => _S();
}

class _S extends ConsumerState<AssignBadgeScreen> {
  String? uid;
  bool loading = false;

  Future<void> _startScan() async {
    setState(() => uid = null);
    final scanned = await scanBadgeUid();          // helper §5.4.1
    setState(() => uid = scanned);
  }

  Future<void> _confirm() async {
    if (uid == null) return;
    setState(() => loading = true);
    try {
      final userId = Supabase.instance.client.auth.currentUser!.id;
      final res = await Supabase.instance.client
        .rpc('admin_assign_employee_badge', params: {
          'p_employee': widget.employeeId,
          'p_uid': uid,
          'p_active': true,
          'p_actor': userId,
        });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Badge attribué')),
        );
        Navigator.pop(context, res);
      }
    } on PostgrestException catch (e) {
      final err = mapError(e);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(err.message)),
      );
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Attribuer un badge NFC')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text('Approchez le badge NFC de l\'arrière du téléphone.'),
            const SizedBox(height: 24),
            if (uid == null)
              FilledButton.icon(
                onPressed: loading ? null : _startScan,
                icon: const Icon(Icons.nfc),
                label: const Text('Démarrer le scan'),
              )
            else ...[
              Card(
                child: ListTile(
                  leading: const Icon(Icons.credit_card),
                  title: const Text('UID détecté'),
                  subtitle: Text(uid!, style: const TextStyle(fontFamily: 'monospace')),
                ),
              ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: loading ? null : _confirm,
                child: loading
                  ? const CircularProgressIndicator()
                  : const Text('Attribuer à cet employé'),
              ),
              TextButton(onPressed: _startScan, child: const Text('Scanner un autre badge')),
            ],
          ],
        ),
      ),
    );
  }
}
```

### 14.3 Checklist de sortie V1

- [ ] Login email + Google OAuth (deep link) fonctionnels sur Android + iOS.
- [ ] Sélecteur d'organisation si plusieurs `user_roles`.
- [ ] Liste + fiche employé (RLS respectée).
- [ ] **Scanner + assigner + révoquer un badge NFC** (owner/hr_admin).
- [ ] Historique NFC visible pour un employé (owner/hr_admin).
- [ ] Liste jobs, détail, création/édition.
- [ ] Liste candidats, changement d'étape, ajout de notes, timeline.
- [ ] Ouverture CV via signed URL.
- [ ] Objectifs / OKR / Feedback / Achievements : CRUD respectant les
      triggers (`employee_id`, `owner_id`).
- [ ] Consultation `performance_reviews` + optionnellement self-eval.
- [ ] Consultation `time_logs` + carte des `work_zones`.
- [ ] Notifications (liste, marquer lu, Realtime).
- [ ] Gestion 401 → refresh silencieux ; sinon logout.
- [ ] Traductions FR (langue par défaut) + i18n prêt pour EN.
- [ ] Zone par défaut Guinée/Conakry (`lat 9.6412`, `lng -13.5784`) pour
      toute UI géographique manquant de contexte.

### 14.4 Références internes

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
