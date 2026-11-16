> **Transition AdonisJS** : ce document décrit l'intégration actuelle (Lovable Cloud). Dans la cible, l'app n'utilise plus `supabase_flutter` : authentification via `POST /v1/auth/login` (jeton opaque stocké dans le stockage sécurisé), pointage via `POST /v1/timeclock/punches`, base `API_URL=https://api.konkoure.doztra.cloud`. Les contrats font foi dans `docs/backend/06-api-reference.md`.

# App mobile Flutter — Pointage NFC

Guide d'intégration destiné à **Claude Code** pour construire l'app mobile
utilisée par les agents de sécurité afin de pointer les employés via leur
badge NFC. Ce document est la source de vérité côté mobile.

---

## 1. Contexte

- Un **agent de sécurité** (rôle `security_agent`, `hr_admin` ou `owner`) est
  posté à l'entrée d'un site.
- Chaque employé possède un **badge NFC** (UID unique) associé dans le
  back-office web (fiche employé → carte NFC).
- L'agent se connecte une fois avec son email/mot de passe. Son
  **organisation est déterminée automatiquement** à partir de son compte
  (pas de sélection manuelle en V1).
- L'agent approche successivement les badges du smartphone. **Un seul bouton
  « Scanner »** : le client n'envoie jamais le type de pointage.
- Le backend décide **automatiquement** s'il s'agit d'une ARRIVEE ou d'un
  DEPART, en se basant sur le dernier pointage de l'employé (transaction
  verrouillée, fenêtre anti double-scan de 7 s côté serveur).
- **V1 — pas de zones, pas de géofencing.** L'app envoie uniquement les
  coordonnées GPS pour audit ; le backend ne rejette jamais un scan sur
  base d'une position.

Plateformes cibles : Android (NFC natif) et iOS 13+ (Core NFC). Le NFC n'est
pas disponible dans un navigateur mobile → app native obligatoire.

---

## 2. URLs de base & endpoints

### 2.1 URLs de base

Le mobile a besoin de **deux types d'URLs** distinctes :

**Backend Lovable** — pour l'endpoint métier du pointage :

| Env  | Base URL API (`BASE_URL`)                                                     |
| ---- | ----------------------------------------------------------------------------- |
| Prod | `https://project--6327e517-24e0-4247-892c-b1564311a161.lovable.app`           |
| Dev  | `https://project--6327e517-24e0-4247-892c-b1564311a161-dev.lovable.app`       |

> ⚠️ Le segment après `project--` est l'**ID du projet Lovable**, PAS le ref Supabase (`rvmpporrsxdnbkwntyqh`). L'ancienne URL `project--rvmpporrsxdnbkwntyqh.lovable.app` renvoie une page HTML 404 « Project not found » — l'app reçoit alors du HTML au lieu de JSON et affiche « Réponse inattendue du serveur ». Alternative : l'URL publiée `https://konkoure.lovable.app` fonctionne aussi pour la prod.

**Supabase Auth** — pour le login et la gestion de session utilisateur uniquement :

| Variable              | Valeur                                          |
| --------------------- | ----------------------------------------------- |
| `SUPABASE_URL`        | `https://rvmpporrsxdnbkwntyqh.supabase.co`      |
| `SUPABASE_ANON_KEY`   | `<publishable_key>` (clé publique Supabase)     |

Ces URLs sont **stables** (ne changent pas si le projet est renommé).

> **Pourquoi deux URLs ?** L'application mobile s'authentifie directement auprès de **Supabase Auth** (`signInWithPassword`, refresh, etc.). Une fois connectée, elle obtient un `access_token` qu'elle envoie au **backend Lovable** pour l'endpoint `/api/public/timeclock/scan`. Le backend Lovable gère lui-même la connexion à la base Supabase côté serveur : le mobile n'a pas besoin du `SUPABASE_SERVICE_ROLE_KEY` ni d'accéder directement à la base de données.

`SUPABASE_ANON_KEY` = clé publishable Supabase (publique, safe à embarquer dans l'APK). À passer via `--dart-define` :

```
flutter run \
  --dart-define=BASE_URL=https://project--6327e517-24e0-4247-892c-b1564311a161-dev.lovable.app \
  --dart-define=SUPABASE_URL=https://rvmpporrsxdnbkwntyqh.supabase.co \
  --dart-define=SUPABASE_ANON_KEY=<publishable_key>
```

#### Option B — Fichier `lib/core/config.dart` (développement local uniquement)

Oui, tu peux aussi stocker ces valeurs dans `lib/core/config.dart` :

```dart
// lib/core/config.dart
class Config {
  static const String baseUrl = 'https://project--6327e517-24e0-4247-892c-b1564311a161-dev.lovable.app';
  static const String supabaseUrl = 'https://rvmpporrsxdnbkwntyqh.supabase.co';
  static const String supabaseAnonKey = '<publishable_key>';
}
```

Dans `main.dart` :
```dart
await Supabase.initialize(
  url: Config.supabaseUrl,
  anonKey: Config.supabaseAnonKey,
);
```

Et dans `api_client.dart` / `checkin_api.dart` :
```dart
final dio = Dio(BaseOptions(baseUrl: Config.baseUrl));
```

> ⚠️ **Recommandation** : garde `config.dart` pour le développement local. Pour la production, préfère `--dart-define` ou un fichier `.env` non versionné, afin de ne pas embarquer la clé `SUPABASE_ANON_KEY` dans le dépôt source.

### 2.2 Endpoints nécessaires

Les appels **Supabase Auth** (login, refresh, logout) sont gérés par le package `supabase_flutter` qui ajoute automatiquement les bons headers.

Seuls les appels au **backend Lovable** (`/api/public/timeclock/scan`) exigent explicitement l'en-tête :

```
Authorization: Bearer <access_token>
```

où `<access_token>` est le token obtenu après `signInWithPassword`.

#### A. Authentification (Supabase Auth — direct)

Utiliser le package **`supabase_flutter`** qui gère login, refresh
automatique et persistance sécurisée.

| Méthode | Endpoint                                                  | Usage                     |
| ------- | --------------------------------------------------------- | ------------------------- |
| POST    | `{SUPABASE_URL}/auth/v1/token?grant_type=password`        | Login email + mot de passe|
| POST    | `{SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`   | Refresh du token          |
| POST    | `{SUPABASE_URL}/auth/v1/logout`                           | Déconnexion               |
| GET     | `{SUPABASE_URL}/auth/v1/user`                             | Récupérer le user courant |

En Dart :
```dart
final res = await supabase.auth.signInWithPassword(
  email: email, password: password,
);
final user = supabase.auth.currentUser;
await supabase.auth.signOut();
```

#### B. Données via PostgREST (`supabase_flutter`, RLS appliquée)

**Organisation de l'agent (à charger juste après le login).** En V1,
l'agent appartient à une seule organisation ; s'il en a plusieurs, prendre
la première :

```dart
final row = await supabase
    .from('organization_members')
    .select('organization_id, organizations(id, name)')
    .eq('user_id', supabase.auth.currentUser!.id)
    .limit(1)
    .maybeSingle();

final orgId   = row?['organization_id'] as String?;
final orgName = (row?['organizations'] as Map?)?['name'] as String?;
```

Persister `orgId` en mémoire / `SharedPreferences` pour toute la session.

Aucun autre appel PostgREST n'est requis pour la V1 (pas de liste de
zones, pas de liste d'employés côté mobile).

#### C. Endpoint métier — pointage NFC

`POST {BASE_URL}/api/public/timeclock/scan`

Headers :
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

Body :
```json
{
  "organization_id": "uuid",
  "badge_uid": "04:A2:1B:C3:2D:5E:80",
  "latitude": 9.6412,
  "longitude": -13.5784,
  "device_id": "android-…"           // optionnel, pour audit futur
}
```

> **Le mobile n'envoie JAMAIS le type de pointage.** Un seul bouton « Scanner ».
> Le backend décide automatiquement (ARRIVEE ou DEPART) en fonction du dernier
> pointage de l'employé, dans une transaction verrouillée côté base. Une
> fenêtre anti double-scan de 7 secondes ignore les re-scans accidentels.

L'app **doit** envoyer `latitude`/`longitude` quand la position GPS est
disponible ; le backend les stocke pour audit. Si la position est
indisponible, envoyer `null` — le scan reste accepté.

Réponses :

**200 OK**
```json
{
  "ok": true,
  "type": "ARRIVEE",                 // ou "DEPART"
  "timestamp": "2026-07-11T08:03:12.482Z",
  "deduped": false,                  // true si scan ignoré (fenêtre 7 s)
  "employee": {
    "id": "uuid",
    "first_name": "Mamadou",
    "last_name": "Diallo",
    "photo_url": "https://…"
  }
}
```

Affichage recommandé : `"Arrivée enregistrée à 08:03"` (ou « Sortie … »).
Si `deduped === true`, afficher un feedback discret « Scan déjà pris en
compte » sans double son/vibration.

**Erreurs** (toujours `{ ok:false, error, message }`) :

| HTTP | `error`                     | Cause typique                                                                            | Action mobile suggérée                                    |
| ---- | --------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| 400  | `VALIDATION_ERROR`          | Payload invalide (uuid, uid badge, coords hors bornes)                                   | Bug côté app — logger, ne pas retenter                    |
| 401  | `UNAUTHORIZED`              | Header `Authorization` manquant / jeton vide / jeton expiré                              | Refresh session Supabase puis retry une fois              |
| 403  | `FORBIDDEN`                 | Utilisateur n'a pas `owner` / `hr_admin` / `security_agent` dans l'org                   | Déconnexion + message « compte non autorisé »             |
| 404  | `BADGE_UNKNOWN_OR_INACTIVE` | UID inconnu dans l'org, badge désactivé, ou employé pas en statut `active`               | Toast « Badge inconnu ou désactivé », rescan possible     |
| 500  | `SERVER_MISCONFIGURED`      | Secrets serveur absents                                                                  | Alerte support, pas de retry auto                         |
| 500  | `INTERNAL_ERROR`            | `record_punch` a échoué (DB)                                                             | Retry manuel après quelques secondes                      |

Le champ `message` est déjà en français, l'afficher tel quel.

> **Rien à changer côté mobile pour la lecture des badges.** Le backend
> résout `badge_uid → employé` via son propre accès admin **après** avoir
> vérifié le rôle de l'agent. L'app mobile n'a **aucune permission Supabase
> supplémentaire** à demander et ne doit **jamais** interroger directement
> la table `employees` ni les colonnes `nfc_badge_*` depuis Flutter — même
> avec `supabase_flutter`. Toute la logique NFC passe uniquement par
> `POST /api/public/timeclock/scan`.

##### Résolution de `BADGE_UNKNOWN_OR_INACTIVE`

Ce code **ne concerne pas** les permissions de l'agent qui scanne (celles-ci
retournent `FORBIDDEN`). Checklist à faire dans le back-office web :

1. Fiche employé → carte NFC : l'UID correspond **exactement** (majuscules,
   séparateurs `:` conservés, ex. `25:FE:6B:3E`).
2. Le switch « Badge actif » est bien ON.
3. L'employé a `status = active`.
4. Le badge est attribué dans **la même organisation** que le compte de
   l'agent qui scanne.

Si tout est OK côté admin : vérifier que Flutter envoie le bon
`organization_id` (celui du compte connecté, résolu au bootstrap) et un
`badge_uid` **non transformé** (pas de trim excessif, pas de changement de
casse, pas de retrait des `:`).

##### Exemple Dart — parsing et mapping UX

```dart
// lib/features/timeclock/scan_api.dart
class ScanError implements Exception {
  final String code;      // BADGE_UNKNOWN_OR_INACTIVE, FORBIDDEN, ...
  final String message;   // message serveur (déjà en français)
  final int httpStatus;
  ScanError(this.code, this.message, this.httpStatus);
}

Future<ScanResult> scanBadge({
  required String accessToken,
  required Map<String, dynamic> payload,
}) async {
  final res = await http.post(
    Uri.parse('$baseUrl/api/public/timeclock/scan'),
    headers: {
      'Authorization': 'Bearer $accessToken',
      'Content-Type': 'application/json',
    },
    body: jsonEncode(payload),
  );

  Map<String, dynamic> body;
  try {
    body = jsonDecode(res.body) as Map<String, dynamic>;
  } catch (_) {
    throw ScanError('UNEXPECTED', 'Réponse inattendue du serveur.', res.statusCode);
  }

  if (body['ok'] == true) return ScanResult.fromJson(body);
  throw ScanError(
    body['error'] as String? ?? 'UNKNOWN',
    body['message'] as String? ?? 'Erreur inconnue',
    res.statusCode,
  );
}

// Côté UI — mapping code → message affiché
String messageUx(ScanError e) => switch (e.code) {
  'BADGE_UNKNOWN_OR_INACTIVE' =>
    'Badge inconnu ou désactivé. Vérifiez qu\'il est bien attribué à un employé actif.',
  'FORBIDDEN'        => 'Compte non autorisé pour cette organisation.',
  'UNAUTHORIZED'     => 'Session expirée, reconnectez-vous.',
  'VALIDATION_ERROR' => 'Données invalides, contactez le support.',
  'SERVER_MISCONFIGURED' => 'Service indisponible, contactez le support.',
  _ => 'Erreur serveur, réessayez.',
};
```

---

## 3. Architecture app (existante)

Le projet Flutter `konkoure_badge/` est **déjà initialisé** avec une clean
architecture par feature (`data/` `domain/` `presentation/`). Cette section
décrit **où brancher** le code de pointage NFC dans l'arborescence
existante. Ne pas créer de dossier `features/timeclock/` parallèle : la
feature de pointage s'appelle **`checkin`** et existe déjà.

```text
lib/
  main.dart
  app.dart
  core/
    config.dart              // BASE_URL, SUPABASE_URL, SUPABASE_ANON_KEY (dart-define)
    api/
      api_client.dart        // Dio + interceptor bearer + refresh 401
    result.dart              // sealed Result<T, ScanError>
    services/
      nfc_service.dart       // wraps nfc_manager
      location_service.dart  // wraps geolocator (audit uniquement)
      feedback_service.dart  // bip + vibration
  features/
    auth/
      data/         auth_repository.dart
      presentation/ login_screen.dart
    session/
      data/         session_repository.dart   // bootstrapOrgId()
    checkin/                                    // = pointage NFC (DÉJÀ PRÉSENT)
      data/
        checkin_api.dart                       // POST /api/public/timeclock/scan
        models/     scan_request.dart, scan_response.dart
        pending_scan_dao.dart                  // sqflite (offline v2)
      domain/
        checkin_repository.dart
        entities/   scan_result.dart, employee_lite.dart
      presentation/
        checkin_controller.dart                // DÉJÀ PRÉSENT — enrichir
        checkin_state.dart                     // DÉJÀ PRÉSENT — enrichir
        checkin_screen.dart                    // DÉJÀ PRÉSENT — un seul bouton « Scanner »
        widgets/    result_overlay.dart
    history/                                    // DÉJÀ PRÉSENT — liste scans récents
    settings/                                   // DÉJÀ PRÉSENT — logout, infos agent/org
```

Règles :

- **Ne pas dupliquer** la feature : tout le code de pointage NFC va sous
  `features/checkin/`. Aucun dossier `features/timeclock/`.
- **Enrichir** `checkin_controller.dart`, `checkin_state.dart`,
  `checkin_screen.dart` (déjà présents) plutôt que les remplacer.
- `history/` et `settings/` restent à leur emplacement actuel.
- Les services transverses (NFC, GPS, feedback) vivent sous `core/services/`
  pour être réutilisables (ex. depuis `history/` pour re-tester un scan).

Packages recommandés :
- `supabase_flutter` — auth + PostgREST
- `nfc_manager` — lecture NFC iOS + Android
- `geolocator` + `permission_handler` — position GPS
- `dio` — HTTP + intercepteurs (retry, refresh 401)
- `flutter_secure_storage` — stockage token/refresh
- `sqflite` — file de scans offline (v2)
- `connectivity_plus` — détection connexion
- `audioplayers` + `vibration` — feedback scan (bip + vibration)
- `riverpod` ou `bloc` — state management (aligner sur ce qui est déjà utilisé dans `checkin_controller.dart`)


---

## 4. Snippets Dart

### 4.1 Entités & modèles

Emplacement : entités partagées sous
`lib/features/checkin/domain/entities/`, DTO de requête sous
`lib/features/checkin/data/models/`.

```dart
// features/checkin/data/models/scan_request.dart
class ScanRequest {
  final String organizationId;
  final String badgeUid;
  final double? latitude;
  final double? longitude;
  final String? deviceId;

  Map<String, dynamic> toJson() => {
        'organization_id': organizationId,
        'badge_uid': badgeUid,
        if (latitude != null) 'latitude': latitude,
        if (longitude != null) 'longitude': longitude,
        if (deviceId != null) 'device_id': deviceId,
      };
}

// features/checkin/domain/entities/scan_result.dart
sealed class ScanResult {}
class ScanOk extends ScanResult {
  final String type;        // "ARRIVEE" | "DEPART"
  final DateTime timestamp;
  final bool deduped;       // true si scan ignoré (fenêtre 7 s)
  final EmployeeLite employee;
  ScanOk(this.type, this.timestamp, this.deduped, this.employee);
}
class ScanFail extends ScanResult {
  final String code;    // BADGE_UNKNOWN_OR_INACTIVE, FORBIDDEN, ...
  final String message;
  ScanFail(this.code, this.message);
}

// features/checkin/domain/entities/employee_lite.dart
class EmployeeLite {
  final String id;
  final String firstName;
  final String lastName;
  final String? photoUrl;
  EmployeeLite(this.id, this.firstName, this.lastName, this.photoUrl);
}
```

### 4.2 Bootstrap de session (org auto)

Emplacement : `lib/features/session/data/session_repository.dart`.

```dart
class SessionRepository {
  final SupabaseClient _sb;
  SessionRepository(this._sb);

  Future<String> bootstrapOrgId() async {
    final row = await _sb
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', _sb.auth.currentUser!.id)
        .limit(1)
        .maybeSingle();
    final id = row?['organization_id'] as String?;
    if (id == null) {
      throw 'Aucune organisation associée à ce compte.';
    }
    return id;
  }
}
```

### 4.3 Service API

Emplacement : `lib/features/checkin/data/checkin_api.dart`.

```dart
class CheckinApi {
  final Dio _dio;
  final SupabaseClient _sb;

  CheckinApi(this._dio, this._sb);

  Future<ScanResult> scan(ScanRequest req) async {
    final token = _sb.auth.currentSession?.accessToken;
    if (token == null) return ScanFail('UNAUTHORIZED', 'Session expirée');

    try {
      final res = await _dio.post(
        '/api/public/timeclock/scan',
        data: req.toJson(),
        options: Options(
          headers: {'Authorization': 'Bearer $token'},
          sendTimeout: const Duration(seconds: 10),
          receiveTimeout: const Duration(seconds: 10),
          validateStatus: (_) => true,
        ),
      );
      final body = res.data as Map<String, dynamic>;
      if (body['ok'] == true) {
        final emp = body['employee'] as Map<String, dynamic>;
        return ScanOk(
          body['type'] as String,
          DateTime.parse(body['timestamp'] as String),
          (body['deduped'] as bool?) ?? false,
          EmployeeLite(emp['id'], emp['first_name'], emp['last_name'], emp['photo_url']),
        );
      }
      return ScanFail(body['error'] as String, body['message'] as String);
    } on DioException catch (e) {
      return ScanFail('NETWORK', 'Réseau indisponible: ${e.message}');
    }
  }
}
```


### 4.4 Lecture NFC (nfc_manager v3)

Emplacement : `lib/core/services/nfc_service.dart` (service transverse).

```dart
class NfcService {
  Future<void> startSession(void Function(String uid) onTag) async {
    final available = await NfcManager.instance.isAvailable();
    if (!available) throw 'NFC indisponible';

    await NfcManager.instance.startSession(
      pollingOptions: {NfcPollingOption.iso14443, NfcPollingOption.iso15693},
      onDiscovered: (tag) async {
        final id = tag.data['nfca']?['identifier'] ??
                   tag.data['mifare']?['identifier'] ??
                   tag.data['iso7816']?['identifier'];
        if (id is List<int>) {
          final hex = id.map((b) => b.toRadixString(16).padLeft(2, '0').toUpperCase()).join(':');
          onTag(hex); // ex: "04:A2:1B:C3:2D:5E:80"
        }
        await NfcManager.instance.stopSession();
      },
    );
  }
}
```

**Format UID** : hex majuscule, séparé par `:` — identique au format saisi
dans le back-office web. Ne pas changer le format sans mettre à jour le
stockage côté web.

### 4.5 Boucle de scan (dans `CheckinController`)

Emplacement : méthode du `CheckinController` existant
(`lib/features/checkin/presentation/checkin_controller.dart`). Le
`CheckinScreen` n'expose **qu'un seul bouton « Scanner »** qui appelle
cette méthode ; jamais de choix Arrivée/Départ côté UI.

```dart
// dans CheckinController
Future<void> onTagRead(String uid) async {
  await _feedback.beepAndVibrate();

  final pos = await _location.currentPositionOrNull();

  final res = await _checkinApi.scan(ScanRequest(
    organizationId: state.orgId, // injecté depuis SessionRepository
    badgeUid: uid,
    latitude: pos?.latitude,
    longitude: pos?.longitude,
    deviceId: state.deviceId,
  ));

  state = state.copyWith(lastResult: res); // consommé par CheckinScreen → ResultOverlay
  await _nfc.startSession(onTagRead);      // redémarre pour le tag suivant
}
```


---

## 5. Permissions

### AndroidManifest.xml
```xml
<uses-permission android:name="android.permission.INTERNET"/>
<uses-permission android:name="android.permission.NFC"/>
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
<uses-feature android:name="android.hardware.nfc" android:required="true"/>
```

### iOS Info.plist
```xml
<key>NFCReaderUsageDescription</key>
<string>Utilisé pour lire les badges d'employé au pointage.</string>
<key>NSLocationWhenInUseUsageDescription</key>
<string>Utilisée pour enregistrer la position du pointage à des fins d'audit.</string>
<key>com.apple.developer.nfc.readersession.formats</key>
<array><string>TAG</string></array>
```
Activer la capability **Near Field Communication Tag Reading** dans Xcode.

---

## 6. Sécurité

- Le **backend Lovable gère la connexion Supabase côté serveur** : le mobile
  n'envoie jamais de requête SQL directe et n'a pas besoin de la clé
  `SUPABASE_SERVICE_ROLE_KEY`.
- **Ne jamais** embarquer `SUPABASE_SERVICE_ROLE_KEY` ni de secret HMAC dans
  l'APK. Seule la clé publishable (`SUPABASE_ANON_KEY`) est autorisée, et
  uniquement pour l'authentification Supabase.
- `access_token` et `refresh_token` : `flutter_secure_storage` uniquement
  (Keychain iOS / EncryptedSharedPreferences Android).
- Timeout HTTP 10 s. Ne pas rejouer automatiquement un scan sans feedback :
  la fenêtre anti double-scan (7 s) côté serveur gère les re-scans très
  rapprochés, mais l'agent doit voir les erreurs et agir.
- Sur 401, forcer un `supabase.auth.refreshSession()` ; si ça échoue,
  déconnecter et retour au login.
- Ne pas logger le body des requêtes en prod (contient noms d'employés).

---

## 7. Mode hors-ligne (optionnel v2)

Si le site a une couverture instable :
1. À l'échec réseau, enfiler `{req, timestamp_local}` dans `sqflite`.
2. `connectivity_plus` déclenche un worker qui rejoue chaque scan dans
   l'ordre chronologique dès que la connexion revient.
3. Le backend décide toujours du type ARRIVEE/DEPART **au moment où il
   reçoit** la requête (le mobile ne pilote pas le type). Prévenir clairement
   l'agent qu'un scan est en file d'attente tant qu'il n'a pas été rejoué.

---

## 8. Checklist Claude Code

1. Projet Flutter `konkoure_badge/` **déjà initialisé** — ne pas relancer `flutter create`.
2. Compléter `pubspec.yaml` avec les packages listés en §3 s'ils manquent, puis `flutter pub get`.
3. Créer/compléter `lib/core/config.dart` lu via `--dart-define=BASE_URL=... --dart-define=SUPABASE_URL=... --dart-define=SUPABASE_ANON_KEY=...`.
4. `features/auth/` : écran login `signInWithPassword` (email + mot de passe) via `AuthRepository`.
5. Après login : appeler `SessionRepository.bootstrapOrgId()` (`features/session/data/`) pour récupérer automatiquement l'organisation de l'agent et la stocker (mémoire + `SharedPreferences`). Aucun écran de sélection.
6. Enrichir `CheckinScreen` / `CheckinController` (déjà présents dans `features/checkin/presentation/`) : un **seul bouton « Scanner »**, démarrer la session NFC via `NfcService`, à chaque tag → `CheckinApi.scan` (avec GPS si dispo), afficher `ResultOverlay`, redémarrer la session.
7. Gérer permissions NFC + géoloc au premier lancement (`permission_handler`).
8. Ajouter la capability NFC Xcode + entitlements.
9. Tests manuels :
   - Badge inconnu → overlay rouge "Badge inconnu ou désactivé".
   - Double scan rapproché (< 7 s) → overlay vert avec mention "Scan déjà pris en compte" (`deduped: true`).
   - Arrivée puis départ du même employé → deux overlays verts (`type: "ARRIVEE"` puis `"DEPART"`).
   - Sans GPS → succès, overlay vert (position non transmise).
   - Avec GPS → succès, coordonnées stockées côté serveur pour audit.
   - Token expiré → refresh transparent, sinon retour login.

10. Build release signé, distribuer via Play Console interne / TestFlight.

---

## 9. Points d'extension (post-V1)

- Contrôle de zone (géofencing) : réintroduire `work_zone_id` dans le body et un champ `within_zone` dans la réponse.
- Signature HMAC device en plus du bearer (pour lier un smartphone à un agent).
- Endpoint de dédoublonnage (fenêtre anti-rebond 5 s).
- Push notifications au superviseur en cas de refus.
- Photo prise automatiquement au check-in (upload storage bucket dédié).
