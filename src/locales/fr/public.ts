/** Textes des pages publiques de paiement prépayé (checkout, retour, suivi). */
export default {
  paiement: {
    metaCheckoutTitle: "Payer votre abonnement Konkouré RH (GNF)",
    metaCheckoutDesc:
      "Réglez votre abonnement Konkouré RH en Orange Money, MTN MoMo ou carte bancaire, puis créez votre compte pour activer votre espace RH.",
    metaCheckoutOgDesc:
      "Paiement en francs guinéens par Orange Money, MTN MoMo ou carte bancaire, avant la création de votre compte.",
    metaRetourTitle: "Confirmation de votre paiement — Konkouré RH",
    metaRetourDesc:
      "Suivi de la confirmation de votre paiement d'abonnement Konkouré RH avant la création de votre compte.",
    metaSuiviTitle: "Suivi de votre paiement — Konkouré RH",
    metaSuiviDesc:
      "Suivez en temps réel l'état de votre paiement d'abonnement Konkouré RH : en attente, confirmé ou échoué.",
    metaSuiviOgDesc: "État en temps réel de votre paiement d'abonnement Konkouré RH.",

    validateOnPhone: "Validez le paiement sur votre téléphone",
    requestSentTo: "Une demande de {{amount}} GNF a été envoyée au {{phone}}.",
    dialConfirmation:
      "Composez le code de confirmation de votre opérateur : l'état ci-dessous se met à jour automatiquement.",
    trackThisPayment: "Suivre ce paiement",
    keepTrackingCode:
      "Conservez votre code de suivi : il permet de retrouver ce paiement à tout moment sur la page de suivi.",

    payTitle: "Payer votre abonnement",
    paySubtitle:
      "Réglez d'abord votre offre en Orange Money, MTN MoMo ou carte bancaire (GNF). Créez ensuite votre compte avec la même adresse e-mail pour ouvrir l'organisation de votre abonnement.",
    emailLabel: "Adresse e-mail de votre futur compte",
    emailPlaceholder: "vous@entreprise.com",
    emailInvalid: "Adresse e-mail invalide.",
    payerPhoneMomoLabel: "Numéro Mobile Money",
    phonePlaceholder: "624 00 00 00",
    phoneInvalid: "Numéro invalide : 9 chiffres commençant par 6 (ex. 624 00 00 00).",
    cardHint:
      "La carte bancaire exige une validation 3-D Secure : vous serez redirigé vers la page sécurisée de notre prestataire.",
    momoHint:
      "Vous recevrez une demande de confirmation sur votre téléphone. Restez sur cette page jusqu'à la validation.",
    continueToCard: "Continuer vers le paiement sécurisé",
    payAmount: "Payer {{amount}} GNF",
    alreadyAccount: "Vous avez déjà un compte ?",
    signIn: "Se connecter",

    retourTitle: "Confirmation de votre paiement",
    retourSubtitle:
      "Cet écran se met à jour automatiquement dès que votre opérateur confirme le paiement.",
    missingClaim:
      "Ce paiement n'a pas été lancé depuis ce navigateur. Ouvrez votre lien de suivi, ou saisissez sa référence et son code sur la page de suivi.",
    trackingPage: "Page de suivi",
    backToPayment: "Retour au paiement",

    suiviTitle: "Suivi de votre paiement",
    suiviSubtitle:
      "Retrouvez à tout moment l'état de votre paiement grâce à votre lien de suivi, ou à sa référence et à son code.",
    claimLabel: "Code de suivi",
    claimInvalid: "Code invalide : il commence par « clm_ ».",
    showStatus: "Afficher l'état du paiement",
    notPaidYet: "Pas encore payé ?",
    choosePlan: "Choisir une offre",
    emailHint:
      "Créez ensuite votre compte avec cette même adresse : c'est elle qui permet d'utiliser le paiement.",
    providerUnavailable:
      "Le paiement en ligne est momentanément indisponible. Réessayez dans quelques minutes.",
    refLabel: "Référence du paiement",
    refInvalid: "Référence invalide : reprenez celle de votre lien de suivi.",
    trackAnother: "Suivre un autre paiement",
  },
} as const;
