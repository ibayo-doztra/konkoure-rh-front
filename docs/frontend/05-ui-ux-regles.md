# Règles UI/UX établies (à préserver)

## Général
Jetons sémantiques uniquement, thème clair/sombre, FR/EN complet, polices Roboto/Helvetica/Arial, modales au standard, tableaux à défilement horizontal propre sans élargir la page (`min-w-0`, `overflow-x-auto`).

## Formats
- Téléphone : `XXX XX XX XX`, saisie formatée en direct, 12 caractères max.
- Montants : GNF via `Intl.NumberFormat` de la langue active.
- Dates : `Africa/Conakry`.

## Recrutement
- Kanban : 6 colonnes stables, défilement horizontal complet sur tous les écrans, glisser-déposer (colonne cible en surbrillance, appui long sur mobile) + bouton de déplacement ; badge score `{score}/100` coloré sur chaque carte.
- Vue tableau : colonnes Nom complet (ouvre la fiche), Téléphone, Profil (titre de l'offre), Score (ou « Non analysé »), Justification (3 lignes max), Points forts (texte, séparés par « • », 3 lignes), Étape (liste déroulante colorée, ne déclenche pas l'ouverture de la fiche), CV (aperçu dans la page). Largeur minimale 1280 px.
- Sélecteur de vue Pipeline/Tableau à icônes avec infobulles, mémorisé dans `localStorage['konkoure.candidates.view']`.
- Filtres communs : recherche (sans icône loupe), offre (toutes les offres publiées, même sans candidat), score minimum, étape.
- Pas de bouton de scoring/re-scoring.

## Candidature publique
Modale centrée non fermable, voile léger, phases préparation/envoi/analyse ; titre « Analyse de votre CV en cours » ; après 30 s « Cela peut prendre jusqu'à une minute, merci de ne pas fermer la page. » ; après 3 min message d'attente prolongée ; « injoignable » seulement en vraie panne. Message de doublon lisible.

## Congés
Solde « Mon solde de congé » avec compteur animé de 0 au solde réel (~900 ms, ease-out, respect de `prefers-reduced-motion`), jours en attente, avertissement de solde négatif ; même compteur dans la fiche employé.

## Offres
Libellé « Publié » pour une offre publiée.
