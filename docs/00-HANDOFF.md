# Konkouré — Dossier de reprise (point d'entrée unique)

> Lire ce fichier en premier. Il oriente Claude Code vers tous les autres documents.

## 1. Produit
Konkouré est un SIRH SaaS B2B multi-tenant pour les PME africaines (référence : Guinée, Conakry, `Africa/Conakry`, GNF).
Modules : RH (employés, départements, contrats), congés et jours fériés, pointage NFC/GPS (web + mobile Flutter),
performance (objectifs, OKR, revues, feedback, réalisations, modèle CPM/SAP), recrutement (offres, page carrières publique,
scoring IA des CV via n8n, Kanban + vue tableau), talents (compétences, 9-box, succession), publication sociale,
facturation (Djomy : Orange Money, MTN, Visa), back office plateforme `/konkoureoffice`, demandes de démo.

## 2. Cible
```text
konkoure/
  apps/api/   AdonisJS v7 (remplace Lovable Cloud / Supabase)
  apps/web/   frontend TanStack Start actuel, rebranché sur l'API
  apps/mobile Flutter (pointage) — dépôt séparé possible
  docs/       ce dossier
```
Le frontend fourni reste la référence visuelle et fonctionnelle. Le backend Supabase actuel (112 migrations, RLS,
fonctions SQL, server functions TanStack) est la référence fonctionnelle à reproduire, **pas** l'architecture cible.

## 3. Ordre de lecture
1. `docs/00-HANDOFF.md` (ce fichier)
2. `docs/product/` — modules, parcours, offres et droits
3. `docs/backend/00-README.md` puis `01` → `15` (source de vérité du backend)
4. `docs/integrations/` — Djomy, n8n, Resend, Google, réseaux sociaux, secrets
5. `docs/frontend/` — inventaire, architecture, intégration API, auth, règles UI, plan de migration
6. `docs/mobile/` — application Flutter
7. `CLAUDE.md` et `.claude/skills/` — procédures de travail

## 4. Décisions déjà prises (ne pas rediscuter)
| Sujet | Décision |
|---|---|
| Géographie | Guinée/Conakry par défaut ; jamais Dakar/Sénégal |
| Devise | GNF uniquement (abonnements) ; `default_currency = 'GNF'` ; aucun salaire géré |
| Fuseau | `Africa/Conakry` (UTC+0), stockage UTC |
| Langues | FR par défaut, EN ; code en anglais |
| Essai | 30 jours, sans recrutement ni talents |
| Performance | modèle `sap` (CPM) par défaut à la création d'organisation, aucun choix proposé |
| Scoring CV | uniquement via n8n à la soumission ; aucun re-scoring manuel ; score lecture seule |
| Couleurs score | < 40 rouge, 40–69 orange, ≥ 70 vert ; affichage `{score}/100` |
| Téléphone | format `XXX XX XX XX` (12 caractères), regex `^\d{3} \d{2} \d{2} \d{2}$`, stocké tel quel |
| Fichiers de candidature | 2 Mo max par fichier, PDF/DOC/DOCX/JPG/PNG |
| Doublons de candidature | bloqués par e-mail/téléphone **avant** l'envoi des fichiers |
| E-mails | expéditeur `Konkouré <support@konkoure.doztra.cloud>` |
| Domaine | `konkoure.doztra.cloud` |
| Rôles | `owner`, `hr_admin`, `manager`, `employee`, `recruiter` + super-admin plateforme |
| Manager | ne voit que les chefs de département / son sous-arbre |
| Modales | `DialogContent > DialogHeader + DialogBody`, `DialogFormGrid`, `DialogActions` ; jamais `DialogFooter` |
| Thèmes | clair/sombre via jetons sémantiques uniquement |
| Test | `modules_open_for_testing` actif temporairement ; à désactiver avant lancement commercial |

## 5. Glossaire
| FR | EN | Code |
|---|---|---|
| Organisation | Organization | `organization` |
| Employé | Employee | `employee` |
| Congé | Leave | `leave_request` |
| Jour férié | Public holiday | `public_holiday` |
| Pointage | Time clock / punch | `time_log` (`ARRIVEE`/`DEPART`) |
| Zone de travail | Work zone | `work_zone` |
| Offre d'emploi | Job | `job` |
| Candidat | Candidate | `candidate` |
| Étape | Stage | `new, screening, interview, offer, hired, rejected` |
| Offre (abonnement) | Plan | `plan` |
| Droits par offre | Entitlements | `org_has_module` |

## 6. Ce qu'il ne faut jamais faire
- Copier des secrets, salaires, documents d'identité ou UID NFC dans les logs ou la doc.
- Contourner l'isolation par organisation.
- Inventer une règle métier absente de `docs/`. En cas de doute : demander.
