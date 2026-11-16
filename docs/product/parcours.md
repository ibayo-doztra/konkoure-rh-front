# Parcours de bout en bout

Chaque parcours doit être couvert par un test fonctionnel dans le nouveau système.

1. **Inscription standard** : `/signup` → confirmation e-mail → `/onboarding/organization` (nom, slug, logo ; modèle SAP imposé) → organisation créée côté serveur avec le créateur `owner`, essai 30 jours, jours fériés initialisés → `/app`.
2. **Paiement avant inscription** : `/paiement` → choix de l'offre → code envoyé par e-mail (5/h max) → paiement Djomy → `/paiement/suivi` et `/paiement/retour` → inscription → rattachement du paiement (claim) à l'organisation. Si le paiement échoue, le code redevient utilisable.
3. **Paiement abonné** : `/app/billing` → checkout → retour → webhook Djomy idempotent → abonnement actif.
4. **Invitation** : RH invite un employé → e-mail → `/invitation` → mot de passe → compte lié à la fiche.
5. **Mot de passe oublié** : `/login` → e-mail → `/reset-password`.
6. **Candidature publique** : page carrières → formulaire (téléphone formaté) → contrôle doublon → URLs d'envoi signées → envoi fichiers → enregistrement → appel n8n → score affiché aux recruteurs.
7. **Traitement recruteur** : Kanban/tableau → filtre → aperçu CV dans la page → changement d'étape (glisser, bouton ou liste) → note.
8. **Demande de congé** : employé → type + dates → jours ouvrés calculés → solde prévisionnel → validation manager/RH → solde ajusté → notification.
9. **Pointage mobile** : connexion Flutter → scan NFC ou GPS → contrôle zone → enregistrement ARRIVEE/DEPART.
10. **Revue de performance** : plan → objectifs → auto-évaluation → évaluation manager → finalisation.
11. **Session expirée** : toute requête 401 → déconnexion locale propre → `/login` (jamais d'écran « permission denied »).
