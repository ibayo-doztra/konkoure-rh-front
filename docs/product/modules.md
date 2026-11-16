# Modules fonctionnels

Chaque module est rattaché à une organisation. L'accès dépend du rôle (`docs/backend/04-auth-rbac.md`) et de l'offre (`plans-entitlements.md`).

## RH de base
- **Employés** : liste filtrable, fiche détaillée (identité, poste, département, manager, statut `active|on_leave|terminated`, avatar, badge NFC, solde de congé, compte utilisateur). Création unitaire, import CSV, invitation à créer un compte (si l'e-mail existe déjà, rattachement au compte existant). Données sensibles lisibles par owner/hr_admin uniquement. Quota d'employés selon l'offre.
- **Départements** : CRUD, chef de département.
- **Contrats** : types `cdi, cdd, stage, freelance, apprenticeship`, statut `draft|active|terminated`, devise GNF.
- **Tableau de bord** : KPIs en direct (effectif, présents, congés, recrutement) avec filtre de période.

## Congés
- Types : `annuel` (débite le solde), `maladie`, `maternite`, `sans_solde` (ne débitent pas le solde annuel).
- Statuts : `pending → approved | rejected | cancelled`.
- Jours ouvrés calculés hors week-end et jours fériés de l'organisation (fériés fixes et mobiles guinéens initialisés à la création).
- Solde : acquisition mensuelle, ajusté à l'approbation/annulation ; peut devenir négatif avec avertissement. Affiché dans la fiche employé et sur la page des congés (compteur animé).
- Décision par owner/hr_admin/manager habilité ; notification à l'employé.

## Pointage
- Zones de travail géolocalisées (carte Google Maps, rayon).
- Pointage `ARRIVEE`/`DEPART` par badge NFC (scan web ou mobile Flutter) ou GPS dans une zone.
- Badges : attribution/révocation auditée (`nfc_badge_history`), UID jamais exposé en clair hors ayants droit.
- Journaux avec statut `pending|approved|rejected`.

## Performance
- Cycles/plans (`draft|open|closed`, fréquence annual/semestrial/quarterly/custom), objectifs (business/development/behavioral), activités, réalisations, OKR + check-ins, revues (auto-évaluation puis manager, commentaires par objectif), feedback (`kudos|suggestion|concern`).
- Modèle `sap` (CPM) par défaut ; `classic` conservé pour les organisations existantes.

## Recrutement et carrières
- Offres `draft|published|closed`, éditeur riche (HTML assaini), QR code, publication réseaux sociaux.
- Page carrières publique `/careers/:slug` et `/careers/:slug/:jobSlug` ; candidature anonyme avec CV + pièces (2 Mo max).
- Anti-doublon e-mail/téléphone avant envoi ; modale non fermable « Analyse de votre CV en cours » pendant l'appel n8n (jusqu'à 3 min).
- Résultat IA stocké : validité du CV, score, points forts, manques, avis, alerte fraude.
- Pipeline Kanban (glisser-déposer + bouton de déplacement) et vue tableau (Nom complet, Téléphone, Profil, Score, Justification, Points forts, Étape modifiable, CV) ; choix de vue mémorisé ; filtres recherche/offre/score min/étape.
- Notes et historique d'activité par candidat (`created, stage_changed, scored, note_added, note_deleted`).

## Talents
Compétences des employés, matrice 9-box (à partir des revues), plans de succession.

## Réseaux sociaux
Connexion OAuth Facebook/LinkedIn/Twitter par organisation, publication d'une offre, suivi des posts (`pending|published|failed`). Jetons chiffrés, jamais renvoyés au client.

## Facturation
Paiement direct (`/app/billing/checkout`) et paiement avant inscription (`/paiement` avec code e-mail), via Djomy. Cycle de vie des abonnements (expiration, rappels), réconciliation.

## Back office plateforme `/konkoureoffice`
Réservé aux super-admins : organisations, offres, utilisateurs (rôle, bannissement, réinitialisation), paiements, demandes de démo, journal, réglages plateforme (dont `modules_open_for_testing`).

## Démo et contenu public
`/demo` (demande envoyée par e-mail à l'équipe), landing, ressources SEO, sitemap.
