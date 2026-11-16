/**
 * Contenu éditorial de la landing page (FR / EN).
 * Les composants de `src/components/landing` ne contiennent aucun texte en dur :
 * ajouter un module, une offre ou une question revient à ajouter une entrée ici.
 */

export type IconKey =
  | "sparkles"
  | "handshake"
  | "shield"
  | "trending"
  | "users"
  | "kanban"
  | "target"
  | "pin"
  | "calendar"
  | "grid";

export interface LabeledItem {
  readonly title: string;
  readonly desc: string;
}

export interface IconItem extends LabeledItem {
  readonly icon: IconKey;
}

export interface SiteRow {
  readonly name: string;
  readonly status: string;
  readonly warning?: boolean;
}

export interface PlanCopy {
  readonly id: "free" | "essential" | "pro" | "enterprise";
  readonly name: string;
  readonly seats: string;
  readonly pitch: string;
  readonly cta: string;
  readonly includedLabel: string;
  readonly features: readonly LabeledItem[];
  readonly popular?: boolean;
}

export interface LandingCopy {
  readonly nav: {
    readonly features: string;
    readonly modules: string;
    readonly pricing: string;
    readonly signin: string;
    readonly start: string;
    readonly menuAria: string;
  };
  readonly hero: {
    readonly badge: string;
    readonly title: string;
    readonly subtitle: string;
    readonly ctaPrimary: string;
    readonly ctaSecondary: string;
    readonly reassurance: string;
    readonly mockup: {
      readonly title: string;
      readonly aiBadge: string;
      readonly colShortlist: string;
      readonly colInterview: string;
      readonly colOffer: string;
      readonly scoreLabel: string;
      readonly dropHint: string;
      readonly offerSent: string;
      readonly interviewAt: string;
      readonly chipTitle: string;
      readonly chipDetail: string;
      readonly chipStatus: string;
    };
  };
  readonly stats: {
    readonly title: string;
    readonly items: readonly { readonly value: number; readonly suffix?: string; readonly label: string }[];
  };
  readonly benefits: {
    readonly eyebrow: string;
    readonly title: string;
    readonly subtitle: string;
    readonly items: readonly IconItem[];
  };
  readonly modules: {
    readonly eyebrow: string;
    readonly title: string;
    readonly subtitle: string;
    readonly items: readonly IconItem[];
  };
  readonly timeclock: {
    readonly eyebrow: string;
    readonly title: string;
    readonly desc: string;
    readonly bullets: readonly string[];
    readonly panelTitle: string;
    readonly sites: readonly SiteRow[];
    readonly footnote: string;
  };
  readonly pricing: {
    readonly eyebrow: string;
    readonly title: string;
    readonly subtitle: string;
    readonly monthly: string;
    readonly annual: string;
    readonly perMonth: string;
    readonly popularLabel: string;
    readonly billedMonthly: string;
    readonly billedAnnually: string;
    readonly plans: readonly PlanCopy[];
    readonly notes: readonly string[];
    
  };
  readonly faq: {
    readonly eyebrow: string;
    readonly title: string;
    readonly items: readonly { readonly q: string; readonly a: string }[];
  };
  readonly cta: {
    readonly title: string;
    readonly desc: string;
    readonly button: string;
  };
  readonly footer: {
    readonly pitch: string;
    readonly productTitle: string;
    readonly resourcesTitle: string;
    readonly resources: readonly string[];
    readonly langTitle: string;
    readonly rights: string;
    readonly builtBy: string;
    readonly taxNote: string;
  };
}

/** Candidats fictifs du visuel du hero (noms propres, identiques FR/EN). */
export const HERO_PIPELINE = {
  shortlist: [
    { name: "Aïssatou C.", score: 88 },
    { name: "Mamadou D.", score: 74 },
  ] as ReadonlyArray<{ readonly name: string; readonly score: number }>,
  interview: "Fatoumata B.",
  offer: "Ibrahima S.",
} as const;

/** Prix de base mensuels, en GNF. Partagés entre les deux langues. */
export const PLAN_MONTHLY_PRICE: Record<PlanCopy["id"], number> = {
  free: 0,
  essential: 440_000,
  pro: 1_100_000,
  enterprise: 2_200_000,
};

/** Facturation annuelle : 2 mois offerts. */
export const ANNUAL_FACTOR = 10 / 12;

const fr: LandingCopy = {
  nav: {
    features: "Fonctionnalités",
    modules: "Modules",
    pricing: "Tarifs",
    signin: "Se connecter",
    start: "Démarrer",
    menuAria: "Menu",
  },
  hero: {
    badge: "SIRH conçu pour les PME de l'Afrique",
    title: "L’ADN RH des entreprises africaines.",
    subtitle:
      "Konkouré réunit le recrutement avec scoring des CV par IA, la gestion des talents, le pointage géolocalisé multi-sites et le pilotage de la performance dans une seule interface, pensée pour vos équipes en Guinée.",
    ctaPrimary: "Démarrer gratuitement",
    ctaSecondary: "Demander une démo",
    reassurance: "Essai gratuit 30 jours · Sans carte bancaire · Paiement Mobile Money",
    mockup: {
      title: "Pipeline de recrutement",
      aiBadge: "Scoring IA actif",
      colShortlist: "Pré-sélection",
      colInterview: "Entretien",
      colOffer: "Offre",
      scoreLabel: "Score IA",
      dropHint: "Glisser une carte ici",
      offerSent: "Offre envoyée",
      interviewAt: "14/07/2026 · 10h00",
      chipTitle: "Pointage · Conakry",
      chipDetail: "Arrivée 07:52 · Zone de travail validée",
      chipStatus: "18 présences · 0 anomalie",
    },
  },
  stats: {
    title: "Une plateforme RH complète qui vous fait gagner du temps, chaque semaine.",
    items: [
      { value: 6, label: "modules RH intégrés" },
      { value: 1, label: "interface unique, zéro fichier dispersé" },
      { value: 2, label: "mois offerts en facturation annuelle" },
      { value: 100, suffix: " %", label: "tarifs en GNF, sans surprise" },
    ],
  },
  benefits: {
    eyebrow: "Bénéfices clés",
    title: "Ce que vos équipes RH y gagnent concrètement",
    subtitle:
      "Moins de tableurs, moins d’allers-retours, des décisions appuyées sur des données fiables.",
    items: [
      {
        icon: "sparkles",
        title: "Recruter mieux, avec l’IA",
        desc: "Les CV reçus sont analysés et notés automatiquement. Vous comparez les candidats sur les compétences, sans biais et sans lecture manuelle.",
      },
      {
        icon: "handshake",
        title: "Engager les équipes",
        desc: "Chaque employé suit ses objectifs, demande ses congés et reçoit du feedback au fil de l’eau, depuis son téléphone.",
      },
      {
        icon: "shield",
        title: "Rester conforme",
        desc: "Contrats, congés et pointages sont tracés, horodatés et exportables en CSV. Vous justifiez vos dossiers en quelques clics.",
      },
      {
        icon: "trending",
        title: "Booster la productivité",
        desc: "Objectifs OKR, revues et feedback continu alignent les priorités de chaque site sur celles de la direction.",
      },
    ],
  },
  modules: {
    eyebrow: "La plateforme",
    title: "Six modules, un seul outil pour tout le cycle RH",
    subtitle: "Du dossier employé jusqu’aux plans de succession, sans ressaisie ni logiciel supplémentaire.",
    items: [
      {
        icon: "users",
        title: "Personnel",
        desc: "Dossiers employés complets — informations personnelles, contact d’urgence, formation, expérience, Badge UID — avec départements et contrats. Annuaire en cartes, filtres et export CSV.",
      },
      {
        icon: "kanban",
        title: "Recrutement",
        desc: "Pipeline Kanban (Nouveau → Pré-sélection → Entretien → Offre) en glisser-déposer, et scoring automatique des CV par IA pour classer les candidats sans biais.",
      },
      {
        icon: "target",
        title: "Performance",
        desc: "Plans d’objectifs OKR rattachés à l’organisation (terminé, en cours, à démarrer), revues et feedback continu pour aligner et motiver les équipes.",
      },
      {
        icon: "pin",
        title: "Pointage",
        desc: "Sessions de présence (arrivée, départ, durée) avec détection des anomalies et zones de travail géolocalisées par site — pensé pour les équipes terrain.",
      },
      {
        icon: "calendar",
        title: "Congés & jours fériés",
        desc: "Demandes avec workflow de validation (Toutes, En attente, Mes demandes), suivi des soldes et calendrier des jours fériés automatisé.",
      },
      {
        icon: "grid",
        title: "Talents",
        desc: "Référentiel de compétences, matrice 9-Box (performance × potentiel, de « Sous-performeur » à « Star ») et plans de succession.",
      },
    ],
  },
  timeclock: {
    eyebrow: "Pointage géolocalisé",
    title: "Vos sites, vos équipes terrain, un seul tableau de présence",
    desc: "Définissez une zone de travail par site : le pointage n’est validé que sur place. Les arrivées, départs et durées remontent en temps réel, et les anomalies sont signalées automatiquement — même quand le réseau est lent.",
    bullets: [
      "Planification simple des équipes, site par site",
      "Détection des retards, oublis et pointages hors zone",
      "Registres horodatés, exportables pour la paie et les contrôles",
    ],
    panelTitle: "Sites suivis en Guinée",
    sites: [
      { name: "Conakry — Siège", status: "42 présents" },
      { name: "Kankan — Agence", status: "17 présents" },
      { name: "N’zérékoré — Dépôt", status: "1 anomalie", warning: true },
      { name: "Mamou — Chantier", status: "9 présents" },
    ],
    footnote: "Relevé du 28/07/2026 · Zones de travail actives",
  },
  pricing: {
    eyebrow: "Tarifs",
    title: "Une tarification pensée pour les PME, en GNF, sans surprise.",
    subtitle:
      "Chaque palier ajoute des modules concrets. Vous changez de palier quand votre effectif grandit, pas avant.",
    monthly: "Mensuel",
    annual: "Annuel · 2 mois offerts",
    perMonth: "GNF / mois",
    popularLabel: "Populaire",
    billedMonthly: "Facturé mensuellement, sans engagement",
    billedAnnually: "Facturé annuellement · 2 mois offerts",
    plans: [
      {
        id: "free",
        name: "Gratuit",
        seats: "Jusqu’à 5 employés",
        pitch: "Essai de 30 jours, sans carte bancaire.",
        cta: "Créer mon compte",
        includedLabel: "30 jours d’essai gratuit",
        features: [
          {
            title: "Pendant 30 jours",
            desc: "Personnel, Départements, Pointage géolocalisé, Congés & jours fériés, Contrats, Performance et Intégrations.",
          },
          {
            title: "Ensuite",
            desc: "Personnel et Départements restent gratuits, jusqu’à 5 employés ;\nles autres modules s’activent avec une offre payante.",
          },
        ],
      },
      {
        id: "essential",
        name: "Essentiel",
        seats: "Jusqu’à 25 employés",
        pitch: "Le cœur RH d’une TPE qui se structure.",
        cta: "Choisir Essentiel",
        includedLabel: "Personnel et Départements, plus",
        features: [
          {
            title: "Pointage géolocalisé",
            desc: "sessions de présence (arrivée, départ, durée), zones de travail par site, détection automatique des anomalies.\nIdéal pour le suivi terrain.",
          },
          {
            title: "Congés & jours fériés",
            desc: "demandes, soldes et validation ;\ncalendrier des jours fériés guinéens.",
          },
          {
            title: "Contrats",
            desc: "CDI, CDD, stage et freelance :\néchéances, périodes d’essai et alertes de conformité.",
          },
        ],
      },
      {
        id: "pro",
        name: "Professionnel",
        seats: "Jusqu’à 75 employés",
        pitch: "Recruter et piloter la performance, avec l’IA.",
        cta: "Choisir Professionnel",
        includedLabel: "Tout Essentiel, plus",
        popular: true,
        features: [
            {
              title: "Recrutement",
              desc: "pipeline Kanban (Nouveau → Pré-sélection → Entretien → Offre) et scoring des CV par IA\npour comparer les candidats objectivement.",
            },
            {
              title: "Performance",
              desc: "objectifs OKR par équipe,\nrevues et feedback continu pour aligner et motiver.",
            },
        ],
      },
      {
        id: "enterprise",
        name: "Entreprise",
        seats: "Jusqu’à 200 employés",
        pitch: "La suite complète pour gérer et faire grandir les talents.",
        cta: "Parler à un conseiller",
        includedLabel: "Tout Professionnel, plus",
        features: [
            {
              title: "Talents",
              desc: "référentiel de compétences, matrice 9-Box (performance × potentiel)\net plans de succession.",
            },
            {
              title: "Intégrations",
              desc: "publication des offres sur les réseaux sociaux\net connexions aux outils de l’entreprise.",
            },
            {
              title: "Support prioritaire",
              desc: "accompagnement dédié\net délais de réponse réduits.",
            },
        ],
      },
    ],
    notes: [
      "Facturation annuelle : 2 mois offerts (environ –17 %).",
      "Paiement Mobile Money (Orange, MTN) ou virement.",
      "Au-delà de 200 employés : sur devis (environ 9 000 GNF / employé).",
    ],
  },
  faq: {
    eyebrow: "Questions fréquentes",
    title: "Tout ce qu’il faut savoir avant de démarrer",
    items: [
      {
        q: "Comment se passe le paiement par Mobile Money ?",
        a: "Vous réglez votre abonnement en GNF depuis Orange Money ou MTN MoMo, mensuellement ou annuellement. Une facture est générée automatiquement après chaque paiement et reste disponible dans votre espace.",
      },
      {
        q: "L’essai est-il vraiment gratuit ?",
        a: "Oui. Pendant 30 jours, votre organisation accède à tous les modules sauf Recrutement et Talents, sans carte bancaire. À l’issue de l’essai, les modules Personnel et Départements restent gratuits jusqu’à 5 employés ; les autres s’activent en choisissant une offre payante, quand vous le décidez.",
      },
      {
        q: "Puis-je reprendre mes données existantes ?",
        a: "Vos dossiers employés, départements et contrats s’importent depuis un fichier CSV ou Excel. Notre équipe vérifie le fichier avec vous avant l’import, et l’export CSV reste disponible à tout moment.",
      },
      {
        q: "Où sont hébergées les données et qui peut les consulter ?",
        a: "Les données sont chiffrées en transit et au repos, et sauvegardées quotidiennement. Les accès sont contrôlés par rôle : un responsable de site ne voit que son périmètre, la direction voit l’ensemble.",
      },
      {
        q: "Quel accompagnement est prévu au démarrage ?",
        a: "Le support répond en français par WhatsApp et par courriel, avec une prise en main guidée pour paramétrer vos départements, vos zones de travail et vos règles de congés. Le palier Entreprise bénéficie d’un accompagnement dédié.",
      },
    ],
  },
  cta: {
    title: "Donnez à vos équipes RH l’outil qu’elles attendaient.",
    desc: "Créez votre espace en quelques minutes, importez vos employés et testez le pointage géolocalisé dès aujourd’hui.",
    button: "Démarrer gratuitement",
  },
  footer: {
    pitch: "Le SIRH des PME multi-sites d’Afrique de l’Ouest. Conçu en Guinée, pour la Guinée et l'Afrique.",
    productTitle: "Produit",
    resourcesTitle: "Ressources",
    resources: ["Guide de démarrage", "Sécurité des données", "Contact"],
    langTitle: "Langue",
    rights: "© {{year}} Konkouré. Tous droits réservés.",
    builtBy: "Une plateforme conçue et développée par",
    taxNote: "Tarifs en francs guinéens (GNF), hors taxes applicables.",
  },
};

const en: LandingCopy = {
  nav: {
    features: "Features",
    modules: "Modules",
    pricing: "Pricing",
    signin: "Sign in",
    start: "Get started",
    menuAria: "Menu",
  },
  hero: {
    badge: "HRIS designed for African SMEs",
    title: "The HR DNA of African companies.",
    subtitle:
      "Konkouré brings AI-scored recruitment, talent management, multi-site geolocated time tracking and performance management together in one interface, designed for your teams in Guinea.",
    ctaPrimary: "Start for free",
    ctaSecondary: "Request a demo",
    reassurance: "30-day free trial · No credit card · Mobile Money payment",
    mockup: {
      title: "Recruitment pipeline",
      aiBadge: "AI scoring on",
      colShortlist: "Shortlist",
      colInterview: "Interview",
      colOffer: "Offer",
      scoreLabel: "AI score",
      dropHint: "Drop a card here",
      offerSent: "Offer sent",
      interviewAt: "14/07/2026 · 10:00",
      chipTitle: "Time tracking · Conakry",
      chipDetail: "Clock-in 07:52 · Work zone verified",
      chipStatus: "18 check-ins · 0 anomaly",
    },
  },
  stats: {
    title: "A complete HR platform that saves your team time, every week.",
    items: [
      { value: 6, label: "integrated HR modules" },
      { value: 1, label: "single interface, no scattered files" },
      { value: 2, label: "months free on annual billing" },
      { value: 100, suffix: " %", label: "GNF pricing, no surprises" },
    ],
  },
  benefits: {
    eyebrow: "Key benefits",
    title: "What your HR teams actually gain",
    subtitle: "Fewer spreadsheets, fewer back-and-forths, decisions backed by reliable data.",
    items: [
      {
        icon: "sparkles",
        title: "Hire better, with AI",
        desc: "Incoming CVs are analysed and scored automatically. You compare candidates on skills, without bias and without manual reading.",
      },
      {
        icon: "handshake",
        title: "Engage your teams",
        desc: "Every employee tracks their goals, requests leave and receives feedback continuously, straight from their phone.",
      },
      {
        icon: "shield",
        title: "Stay compliant",
        desc: "Contracts, leave and time records are tracked, timestamped and exportable to CSV. Justify any file in a few clicks.",
      },
      {
        icon: "trending",
        title: "Boost productivity",
        desc: "OKRs, reviews and continuous feedback align every site's priorities with management's.",
      },
    ],
  },
  modules: {
    eyebrow: "The platform",
    title: "Six modules, one tool for the entire HR cycle",
    subtitle: "From the employee record to succession plans, with no re-entry and no extra software.",
    items: [
      {
        icon: "users",
        title: "People",
        desc: "Complete employee records — personal details, emergency contact, education, experience, badge UID — with departments and contracts. Card directory, filters and CSV export.",
      },
      {
        icon: "kanban",
        title: "Recruitment",
        desc: "Drag-and-drop Kanban pipeline (New → Shortlist → Interview → Offer), plus automatic AI CV scoring to rank candidates without bias.",
      },
      {
        icon: "target",
        title: "Performance",
        desc: "Organisation-wide OKR plans (done, in progress, not started), reviews and continuous feedback to align and motivate teams.",
      },
      {
        icon: "pin",
        title: "Time tracking",
        desc: "Attendance sessions (clock-in, clock-out, duration) with anomaly detection and geolocated work zones per site — built for field teams.",
      },
      {
        icon: "calendar",
        title: "Leave & holidays",
        desc: "Requests with an approval workflow (All, Pending, My requests), balance tracking and an automated public holiday calendar.",
      },
      {
        icon: "grid",
        title: "Talent",
        desc: "Skills repository, 9-Box matrix (performance × potential, from “Underperformer” to “Star”) and succession plans.",
      },
    ],
  },
  timeclock: {
    eyebrow: "Geolocated time tracking",
    title: "Your sites, your field teams, one attendance dashboard",
    desc: "Define a work zone per site: check-ins are only validated on location. Arrivals, departures and durations sync in real time, and anomalies are flagged automatically — even on a slow network.",
    bullets: [
      "Simple team scheduling, site by site",
      "Detection of lateness, missed and out-of-zone check-ins",
      "Timestamped logs, exportable for payroll and audits",
    ],
    panelTitle: "Sites tracked in Guinea",
    sites: [
      { name: "Conakry — Headquarters", status: "42 present" },
      { name: "Kankan — Branch", status: "17 present" },
      { name: "N’zérékoré — Warehouse", status: "1 anomaly", warning: true },
      { name: "Mamou — Site", status: "9 present" },
    ],
    footnote: "Report of 28/07/2026 · Active work zones",
  },
  pricing: {
    eyebrow: "Pricing",
    title: "Pricing designed for SMEs, in GNF, with no surprises.",
    subtitle: "Each tier adds concrete modules. You move up when your headcount grows, not before.",
    monthly: "Monthly",
    annual: "Annual · 2 months free",
    perMonth: "GNF / month",
    popularLabel: "Most popular",
    billedMonthly: "Billed monthly, no commitment",
    billedAnnually: "Billed annually · 2 months free",
    plans: [
      {
        id: "free",
        name: "Free",
        seats: "Up to 5 employees",
        pitch: "A 30-day trial, no credit card.",
        cta: "Create my account",
        includedLabel: "30-day free trial",
        features: [
          {
            title: "For 30 days",
            desc: "People, Departments, Geolocated time tracking, Leave & holidays, Contracts, Performance and Integrations.",
          },
          {
            title: "After that",
            desc: "People and Departments stay free, up to 5 employees; the other modules unlock with a paid tier.",
          },
        ],
      },
      {
        id: "essential",
        name: "Essential",
        seats: "Up to 25 employees",
        pitch: "The HR core of a small business getting organised.",
        cta: "Choose Essential",
        includedLabel: "People and Departments, plus",
        features: [
          {
            title: "Geolocated time tracking",
            desc: "attendance sessions (clock-in, clock-out, duration), work zones per site, automatic anomaly detection. Ideal for field teams.",
          },
          { title: "Leave & holidays", desc: "requests, balances and approval; Guinean public holiday calendar." },
          {
            title: "Contracts",
            desc: "permanent, fixed-term, internship and freelance: end dates, trial periods and compliance alerts.",
          },
        ],
      },
      {
        id: "pro",
        name: "Professional",
        seats: "Up to 75 employees",
        pitch: "Recruit and steer performance, with AI.",
        cta: "Choose Professional",
        includedLabel: "Everything in Essential, plus",
        popular: true,
        features: [
          {
            title: "Recruitment",
            desc: "Kanban pipeline (New → Shortlist → Interview → Offer) and AI CV scoring to compare candidates objectively.",
          },
          { title: "Performance", desc: "team OKRs, reviews and continuous feedback to align and motivate." },
        ],
      },
      {
        id: "enterprise",
        name: "Enterprise",
        seats: "Up to 200 employees",
        pitch: "The complete suite to manage and grow talent.",
        cta: "Talk to an advisor",
        includedLabel: "Everything in Professional, plus",
        features: [
          { title: "Talent", desc: "skills repository, 9-Box matrix (performance × potential) and succession plans." },
          { title: "Integrations", desc: "publish job openings to social networks and connect your company tools." },
          { title: "Priority support", desc: "dedicated onboarding and reduced response times." },
        ],
      },
    ],
    notes: [
      "Annual billing: 2 months free (about –17 %).",
      "Mobile Money payment (Orange, MTN) or bank transfer.",
      "Above 200 employees: on quote (about 9,000 GNF / employee).",
    ],
  },
  faq: {
    eyebrow: "Frequently asked questions",
    title: "Everything you need to know before starting",
    items: [
      {
        q: "How does Mobile Money payment work?",
        a: "You pay your subscription in GNF from Orange Money or MTN MoMo, monthly or annually. An invoice is generated automatically after each payment and stays available in your workspace.",
      },
      {
        q: "Is the trial really free?",
        a: "Yes. For 30 days your organisation gets every module except Recruitment and Talent, with no credit card. After the trial, People and Departments stay free up to 5 employees; the other modules unlock when you pick a paid tier.",
      },
      {
        q: "Can I bring my existing data?",
        a: "Employee records, departments and contracts import from a CSV or Excel file. Our team reviews the file with you before importing, and CSV export stays available at any time.",
      },
      {
        q: "Where is the data hosted and who can see it?",
        a: "Data is encrypted in transit and at rest, and backed up daily. Access is role-based: a site manager only sees their scope, management sees everything.",
      },
      {
        q: "What support is provided at launch?",
        a: "Support answers in French via WhatsApp and email, with guided setup for your departments, work zones and leave rules. The Enterprise tier gets dedicated onboarding.",
      },
    ],
  },
  cta: {
    title: "Give your HR teams the tool they have been waiting for.",
    desc: "Create your workspace in minutes, import your employees and try geolocated time tracking today.",
    button: "Start for free",
  },
  footer: {
    pitch: "The HRIS for multi-site SMEs in West Africa. Built in Guinea, for Guinea and Africa.",
    productTitle: "Product",
    resourcesTitle: "Resources",
    resources: ["Getting started guide", "Data security", "Contact"],
    langTitle: "Language",
    rights: "© {{year}} Konkouré. All rights reserved.",
    builtBy: "A platform designed and built by",
    taxNote: "Prices in Guinean francs (GNF), excluding applicable taxes.",
  },
};

export const landingCopy: Record<"fr" | "en", LandingCopy> = { fr, en };
