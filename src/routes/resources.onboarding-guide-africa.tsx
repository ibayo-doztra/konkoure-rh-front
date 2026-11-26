import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { SITE_URL } from "@/lib/site";

const CANONICAL = `${SITE_URL}/resources/onboarding-guide-africa`;

const TITLE = "Employee Onboarding in Africa: 2026 Guide | Konkouré";
const DESCRIPTION =
  "Practical onboarding guide for African companies: OHADA/CNSS compliance, cultural fit, remote-first checklists, and a 30-60-90 day plan.";

export const Route = createFileRoute("/resources/onboarding-guide-africa")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "article" },
      { property: "og:url", content: CANONICAL },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
      {
        name: "keywords",
        content:
          "employee onboarding, onboarding Africa, HR onboarding, onboarding checklist, onboarding best practices, HRIS Africa, SIRH Afrique, intégration employé",
      },
    ],
    links: [{ rel: "canonical", href: CANONICAL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: "Employee Onboarding in Africa: The Complete 2026 Guide",
          description: DESCRIPTION,
          author: { "@type": "Organization", name: "Konkouré" },
          publisher: {
            "@type": "Organization",
            name: "Konkouré",
            logo: {
              "@type": "ImageObject",
              url: `${SITE_URL}/favicon.png`,
            },
          },
          mainEntityOfPage: CANONICAL,
          inLanguage: ["en", "fr"],
          about: [
            "Employee onboarding",
            "Human resources",
            "Africa",
            "OHADA compliance",
          ],
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "What is employee onboarding?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Employee onboarding is the structured process of integrating a new hire into an organization — from paperwork and compliance to culture, tools, and their first productive weeks.",
              },
            },
            {
              "@type": "Question",
              name: "How long should onboarding last in African companies?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "The most effective programs run 90 days, following a 30-60-90 day plan that covers administrative setup, role ramp-up, and full productivity milestones.",
              },
            },
            {
              "@type": "Question",
              name: "What local compliance matters for onboarding in Africa?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "For OHADA-member states, employers must register the contract, declare the employee to social security (CNSS/CNPS), collect tax IDs (NIF), and respect trial period rules that vary by contract type (CDI, CDD, stage).",
              },
            },
          ],
        }),
      },
    ],
  }),
  component: OnboardingGuide,
});

function OnboardingGuide() {
  const { i18n } = useTranslation();
  const isFr = (i18n.resolvedLanguage || i18n.language || "fr").startsWith("fr");
  const c = isFr ? fr : en;

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground">
              K
            </div>
            <span className="font-display text-base font-bold">Konkouré</span>
          </Link>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← {c.backHome}
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-4 py-12">
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted-foreground">
          <ol className="flex flex-wrap gap-1">
            <li>
              <Link to="/" className="hover:text-foreground">
                {c.home}
              </Link>
            </li>
            <li>/</li>
            <li>{c.resources}</li>
            <li>/</li>
            <li aria-current="page" className="text-foreground">
              {c.breadcrumb}
            </li>
          </ol>
        </nav>

        <h1 className="text-4xl font-bold tracking-tight md:text-5xl">{c.h1}</h1>
        <p className="mt-4 text-lg text-muted-foreground">{c.intro}</p>

        <div className="prose prose-neutral mt-10 max-w-none dark:prose-invert">
          <h2>{c.s1.h}</h2>
          <p>{c.s1.p}</p>
          <ul>
            {c.s1.list.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>

          <h2>{c.s2.h}</h2>
          <p>{c.s2.p}</p>
          <ul>
            {c.s2.list.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>

          <h2>{c.s3.h}</h2>
          <p>{c.s3.p}</p>
          <h3>{c.s3.d1.h}</h3>
          <ul>
            {c.s3.d1.list.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
          <h3>{c.s3.d2.h}</h3>
          <ul>
            {c.s3.d2.list.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
          <h3>{c.s3.d3.h}</h3>
          <ul>
            {c.s3.d3.list.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>

          <h2>{c.s4.h}</h2>
          <p>{c.s4.p}</p>
          <ul>
            {c.s4.list.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>

          <h2>{c.s5.h}</h2>
          <p>{c.s5.p}</p>

          <h2>{c.faq.h}</h2>
          {c.faq.items.map((it) => (
            <div key={it.q}>
              <h3>{it.q}</h3>
              <p>{it.a}</p>
            </div>
          ))}
        </div>

        <aside className="mt-12 rounded-xl border bg-card p-6">
          <h2 className="text-xl font-semibold">{c.cta.h}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{c.cta.p}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              to="/signup"
              className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              {c.cta.primary}
            </Link>
            <Link
              to="/"
              className="inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              {c.cta.secondary}
            </Link>
          </div>
        </aside>
      </article>
    </main>
  );
}

const en = {
  backHome: "Back to home",
  home: "Home",
  resources: "Resources",
  breadcrumb: "Employee onboarding in Africa",
  h1: "Employee Onboarding in Africa: The Complete 2026 Guide",
  intro:
    "A practical playbook for HR teams in Africa: local compliance, cultural integration, remote-friendly checklists, and a 30-60-90 day plan that actually gets new hires productive.",
  s1: {
    h: "What is employee onboarding?",
    p: "Employee onboarding is the structured process that turns a signed contract into a productive, engaged team member. Done well, it reduces first-year turnover by up to 82% and speeds time-to-productivity by more than a third.",
    list: [
      "Administrative setup (contract, tax ID, social security)",
      "Tools and access provisioning",
      "Role clarity, goals, and success metrics",
      "Cultural integration and manager relationship",
      "Continuous check-ins over 30, 60 and 90 days",
    ],
  },
  s2: {
    h: "Why onboarding is different in Africa",
    p: "Global onboarding templates rarely fit African realities. Effective programs account for local labor law, multilingual teams, unstable connectivity, and strong community-based work cultures.",
    list: [
      "OHADA labor law + national codes (CDI, CDD, stage/internship)",
      "Social declarations to CNSS / CNPS within statutory deadlines",
      "Tax identification (NIF) and payroll setup in local currency",
      "Bilingual documentation (French / English) for cross-border teams",
      "Offline-friendly materials for regions with unreliable internet",
      "Explicit mentorship — community and hierarchy matter",
    ],
  },
  s3: {
    h: "The 30-60-90 day onboarding plan",
    p: "Break the first 90 days into three focused phases so the new hire always knows what 'good' looks like.",
    d1: {
      h: "Days 1–30: Land",
      list: [
        "Signed contract archived and declared to social security",
        "Workstation, email, HRIS and business tools provisioned on day one",
        "Welcome pack: org chart, mission, values, code of conduct",
        "Meet-and-greet with manager, team, and cross-functional peers",
        "Assigned buddy for questions outside the reporting line",
      ],
    },
    d2: {
      h: "Days 31–60: Learn",
      list: [
        "Role-specific training and shadowing",
        "First delivered task with clear acceptance criteria",
        "Weekly 1:1 with manager, structured feedback both ways",
        "Discovery of internal processes: leave, expenses, performance",
      ],
    },
    d3: {
      h: "Days 61–90: Contribute",
      list: [
        "First OKRs / goals set and tracked in the HRIS",
        "Independent ownership of a scoped project",
        "90-day review: performance, engagement, next objectives",
        "Confirmation of end of trial period (if applicable)",
      ],
    },
  },
  s4: {
    h: "Onboarding checklist for African HR teams",
    p: "Use this as a copy-ready checklist. Konkouré automates each item so nothing falls through the cracks.",
    list: [
      "Collect ID, tax number, bank details, emergency contact",
      "Sign contract with correct type (CDI, CDD, stage) and trial period",
      "Declare hire to CNSS / CNPS and store proof",
      "Add to payroll in local currency with correct tax bracket",
      "Provision email, HRIS access, business tools, and geo-fenced time clock zones",
      "Schedule week-1, day-30, day-60 and day-90 check-ins",
      "Assign a buddy and a first mentor from another team",
      "Document the role: mission, scope, success metrics, first OKRs",
    ],
  },
  s5: {
    h: "How Konkouré supports onboarding across Africa",
    p: "Konkouré centralizes contracts, social declarations, geolocated attendance, performance reviews and AI-scored recruitment in one bilingual HRIS built for African organizations — so onboarding stops being a spreadsheet and becomes a repeatable, measurable process.",
  },
  faq: {
    h: "Frequently asked questions",
    items: [
      {
        q: "How long should onboarding last?",
        a: "Plan for 90 days. The first month covers administrative and cultural landing, the second builds skills, the third delivers real ownership and a formal review.",
      },
      {
        q: "What documents are mandatory when hiring in an OHADA country?",
        a: "A written contract (CDI, CDD or stage), a copy of ID, tax identification number (NIF), and proof of declaration to the national social security fund (CNSS/CNPS).",
      },
      {
        q: "How do you onboard remote employees across several African countries?",
        a: "Use a cloud HRIS with bilingual documentation, offline-capable materials, geo-fenced time clocking for hybrid staff, and structured async check-ins on days 30, 60 and 90.",
      },
    ],
  },
  cta: {
    h: "Run this playbook automatically",
    p: "Konkouré ships onboarding workflows, digital contracts, social-security-ready records and 30-60-90 day reviews out of the box.",
    primary: "Start free",
    secondary: "See modules",
  },
};

const fr = {
  backHome: "Retour à l'accueil",
  home: "Accueil",
  resources: "Ressources",
  breadcrumb: "Onboarding des employés en Afrique",
  h1: "Onboarding des employés en Afrique : le guide complet 2026",
  intro:
    "Un manuel pratique pour les équipes RH en Afrique : conformité locale, intégration culturelle, checklists compatibles télétravail et un plan 30-60-90 jours qui rend vraiment les nouveaux collaborateurs productifs.",
  s1: {
    h: "Qu'est-ce que l'onboarding des employés ?",
    p: "L'onboarding est le processus structuré qui transforme un contrat signé en collaborateur productif et engagé. Bien mené, il réduit jusqu'à 82 % le turnover la première année et accélère d'un tiers la montée en compétence.",
    list: [
      "Formalités administratives (contrat, NIF, sécurité sociale)",
      "Provisionnement des outils et des accès",
      "Clarté du poste, objectifs et indicateurs de succès",
      "Intégration culturelle et relation avec le manager",
      "Points de suivi à 30, 60 et 90 jours",
    ],
  },
  s2: {
    h: "Pourquoi l'onboarding est différent en Afrique",
    p: "Les modèles globaux d'onboarding sont rarement adaptés aux réalités africaines. Les programmes efficaces tiennent compte du droit du travail local, du multilinguisme, d'une connectivité parfois instable et de cultures de travail très communautaires.",
    list: [
      "Droit OHADA et codes nationaux (CDI, CDD, stage)",
      "Déclarations sociales à la CNSS / CNPS dans les délais légaux",
      "NIF et paie configurés en devise locale",
      "Documentation bilingue (français / anglais) pour les équipes transfrontalières",
      "Supports utilisables hors ligne pour les zones à connexion instable",
      "Mentorat explicite — la communauté et la hiérarchie comptent",
    ],
  },
  s3: {
    h: "Le plan d'onboarding 30-60-90 jours",
    p: "Découpez les 90 premiers jours en trois phases claires pour que le collaborateur sache toujours ce qui est attendu.",
    d1: {
      h: "Jours 1–30 : atterrir",
      list: [
        "Contrat signé, archivé et déclaré à la sécurité sociale",
        "Poste, e-mail, SIRH et outils métier prêts dès le jour 1",
        "Pack d'accueil : organigramme, mission, valeurs, code de conduite",
        "Rencontres avec le manager, l'équipe et les fonctions transverses",
        "Un buddy dédié aux questions hors ligne hiérarchique",
      ],
    },
    d2: {
      h: "Jours 31–60 : apprendre",
      list: [
        "Formation et shadowing sur les tâches clés du poste",
        "Première livraison avec critères d'acceptation clairs",
        "1:1 hebdomadaire avec feedback structuré des deux côtés",
        "Découverte des processus internes : congés, notes de frais, performance",
      ],
    },
    d3: {
      h: "Jours 61–90 : contribuer",
      list: [
        "Premiers OKR / objectifs définis et suivis dans le SIRH",
        "Prise d'autonomie sur un projet cadré",
        "Bilan à 90 jours : performance, engagement, objectifs suivants",
        "Confirmation de fin de période d'essai (le cas échéant)",
      ],
    },
  },
  s4: {
    h: "Checklist onboarding pour les équipes RH en Afrique",
    p: "Une checklist prête à copier. Konkouré automatise chaque étape pour ne rien oublier.",
    list: [
      "Collecter pièce d'identité, NIF, RIB, contact d'urgence",
      "Signer le contrat au bon type (CDI, CDD, stage) et fixer l'essai",
      "Déclarer l'embauche à la CNSS / CNPS et archiver la preuve",
      "Ajouter à la paie en devise locale avec la bonne tranche fiscale",
      "Provisionner e-mail, SIRH, outils métier et zones de pointage géolocalisées",
      "Planifier les points à J+7, J+30, J+60 et J+90",
      "Assigner un buddy et un mentor d'une autre équipe",
      "Documenter le poste : mission, périmètre, indicateurs, premiers OKR",
    ],
  },
  s5: {
    h: "Comment Konkouré accompagne l'onboarding en Afrique",
    p: "Konkouré centralise contrats, déclarations sociales, pointage géolocalisé, évaluations de performance et recrutement scoré par IA dans un SIRH bilingue pensé pour les organisations africaines — pour transformer l'onboarding en processus répétable et mesurable.",
  },
  faq: {
    h: "Questions fréquentes",
    items: [
      {
        q: "Combien de temps doit durer l'onboarding ?",
        a: "Prévoir 90 jours. Le premier mois pour l'atterrissage administratif et culturel, le deuxième pour la montée en compétences, le troisième pour la prise d'autonomie et un bilan formel.",
      },
      {
        q: "Quels documents sont obligatoires à l'embauche en zone OHADA ?",
        a: "Un contrat écrit (CDI, CDD ou stage), une copie de pièce d'identité, le NIF, et la preuve de déclaration à la caisse nationale de sécurité sociale (CNSS/CNPS).",
      },
      {
        q: "Comment onboarder des employés à distance dans plusieurs pays africains ?",
        a: "Utiliser un SIRH cloud avec documentation bilingue, supports hors ligne, pointage géolocalisé pour l'hybride, et points de suivi asynchrones à 30, 60 et 90 jours.",
      },
    ],
  },
  cta: {
    h: "Déroulez ce playbook automatiquement",
    p: "Konkouré propose des workflows d'onboarding, contrats digitaux, dossiers prêts pour la sécurité sociale et bilans 30-60-90 jours en standard.",
    primary: "Démarrer gratuitement",
    secondary: "Voir les modules",
  },
};
