/** Public prepaid payment pages copy (checkout, return, tracking). */
export default {
  paiement: {
    metaCheckoutTitle: "Pay your Konkouré HR subscription (GNF)",
    metaCheckoutDesc:
      "Pay your Konkouré HR subscription via Orange Money, MTN MoMo or card, then create your account to activate your HR workspace.",
    metaCheckoutOgDesc:
      "Payment in Guinean francs via Orange Money, MTN MoMo or card, before creating your account.",
    metaRetourTitle: "Payment confirmation — Konkouré HR",
    metaRetourDesc:
      "Track the confirmation of your Konkouré HR subscription payment before creating your account.",
    metaSuiviTitle: "Payment tracking — Konkouré HR",
    metaSuiviDesc:
      "Track in real time the status of your Konkouré HR subscription payment: pending, confirmed or failed.",
    metaSuiviOgDesc: "Real-time status of your Konkouré HR subscription payment.",

    validateOnPhone: "Confirm the payment on your phone",
    requestSentTo: "A request for {{amount}} GNF was sent to {{phone}}.",
    dialConfirmation:
      "Dial your operator's confirmation code: the status below updates automatically.",
    trackThisPayment: "Track this payment",
    keepTrackingCode:
      "Keep your tracking code: it lets you find this payment again at any time on the tracking page.",

    payTitle: "Pay your subscription",
    paySubtitle:
      "Pay for your plan first with Orange Money, MTN MoMo or bank card (GNF). Then create your account with the same email address to open the organization of your subscription.",
    emailLabel: "Email address of your future account",
    emailPlaceholder: "you@company.com",
    emailInvalid: "Invalid email address.",
    payerPhoneMomoLabel: "Mobile Money number",
    phonePlaceholder: "624 00 00 00",
    phoneInvalid: "Invalid number: 9 digits starting with 6 (e.g. 624 00 00 00).",
    cardHint:
      "Card payments require 3-D Secure validation: you'll be redirected to our provider's secure page.",
    momoHint:
      "You'll receive a confirmation request on your phone. Stay on this page until it's validated.",
    continueToCard: "Continue to secure payment",
    payAmount: "Pay {{amount}} GNF",
    alreadyAccount: "Already have an account?",
    signIn: "Sign in",

    retourTitle: "Payment confirmation",
    retourSubtitle:
      "This screen updates automatically as soon as your operator confirms the payment.",
    missingClaim:
      "This payment was not started from this browser. Open your tracking link, or enter its reference and code on the tracking page.",
    trackingPage: "Tracking page",
    backToPayment: "Back to payment",

    suiviTitle: "Payment tracking",
    suiviSubtitle:
      "Find the status of your payment at any time with your tracking link, or with its reference and code.",
    claimLabel: "Tracking code",
    claimInvalid: "Invalid code: it starts with « clm_ ».",
    showStatus: "Show payment status",
    notPaidYet: "Haven't paid yet?",
    choosePlan: "Choose a plan",
    emailHint:
      "Then create your account with this same address: it is what lets you use the payment.",
    providerUnavailable: "Online payment is temporarily unavailable. Try again in a few minutes.",
    refLabel: "Payment reference",
    refInvalid: "Invalid reference: use the one in your tracking link.",
    trackAnother: "Track another payment",
  },
} as const;
