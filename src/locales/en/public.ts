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
      "First pay for your plan via Orange Money, MTN MoMo or card (GNF). You'll create your account right after: the subscription will be linked automatically.",
    emailLabel: "Email address (the one for your future account)",
    emailPlaceholder: "you@company.com",
    emailInvalid: "Invalid email address.",
    codeLabel: "Verification code",
    codePlaceholder: "6-digit code",
    sendCode: "Get a code",
    resendCode: "Resend code",
    codeSent: "Code sent. Check your inbox.",
    codeSendError: "Could not send the code. Please try again.",
    codeHint: "A code is sent to this address to confirm it is you before payment.",
    payerPhoneCardLabel: "Phone number (required by the payment provider)",
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
    startingPaymentError: "Could not start the payment",

    retourTitle: "Payment confirmation",
    retourSubtitle:
      "This screen updates automatically as soon as your operator confirms the payment.",
    missingClaim: "Missing tracking code. Enter it on the tracking page to find your payment.",
    trackingPage: "Tracking page",
    backToPayment: "Back to payment",

    suiviTitle: "Payment tracking",
    suiviSubtitle:
      "Find the status of your subscription payment at any time using your tracking code.",
    claimLabel: "Tracking code",
    claimInvalid: "Invalid code: use the one shown after your payment.",
    showStatus: "Show payment status",
    notPaidYet: "Haven't paid yet?",
    choosePlan: "Choose a plan",
  },
} as const;
