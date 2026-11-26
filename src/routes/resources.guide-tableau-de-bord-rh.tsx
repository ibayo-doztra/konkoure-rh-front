import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { SITE_URL } from "@/lib/site";

const CANONICAL = `${SITE_URL}/resources/guide-tableau-de-bord-rh`;

const TITLE = "Tableau de bord RH : le guide 2026 | Konkouré";
const DESCRIPTION =
  "Construisez un tableau de bord RH pour piloter productivité, absentéisme, masse salariale et conformité multi-sites en Afrique. Indicateurs et modèle prêts.";

export const Route = createFileRoute("/resources/guide-tableau-de-bord-rh")({
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
          "tableau de bord rh, tableau de bord ressources humaines, indicateurs rh, kpi rh, reporting rh, sirh afrique, pilotage rh multi-sites, dashboard rh",
      },
    ],
    links: [{ rel: "canonical", href: CANONICAL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: "Tableau de bord RH : le guide complet pour piloter vos équipes en Afrique",
          description: DESCRIPTION,
          author: { "@type": "Organization", name: "Konkouré" },
          publisher: {
            "@type": "Organization",
            name: "Konkouré",
            logo: { "@type": "ImageObject", url: `${SITE_URL}/favicon.png` },
          },
          mainEntityOfPage: CANONICAL,
          inLanguage: ["fr", "en"],
          about: ["Tableau de bord RH", "Indicateurs RH", "Pilotage multi-sites", "SIRH Afrique"],
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
              name: "Qu'est-ce qu'un tableau de bord RH ?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Un tableau de bord RH est une vue synthétique et visuelle des indicateurs clés (effectifs, absentéisme, masse salariale, turnover, performance) qui permet à la direction et aux RH de piloter les décisions humaines en temps réel.",
              },
            },
            {
              "@type": "Question",
              name: "Quels sont les indicateurs RH indispensables ?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Les KPI incontournables sont : l'effectif total et par site, le taux d'absentéisme, le turnover, la masse salariale, le coût moyen d'embauche, le délai de recrutement, le taux de conformité aux déclarations sociales (CNSS/CNPS) et la productivité mesurée par le pointage géolocalisé.",
              },
            },
            {
              "@type": "Question",
              name: "Comment piloter un tableau de bord RH multi-sites en Afrique ?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Utilisez un SIRH cloud avec pointage géolocalisé, consolidation automatique par site et pays, et suivi bilingue français / anglais. Les données remontent en temps réel, même depuis des zones à connectivité faible.",
              },
            },
          ],
        }),
      },
    ],
  }),
  component: HrDashboardGuide,
});

function HrDashboardGuide() {
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
          <ul>{c.s1.list.map((x) => <li key={x}>{x}</li>)}</ul>

          <h2>{c.s2.h}</h2>
          <p>{c.s2.p}</p>
          <h3>{c.s2.d1.h}</h3>
          <ul>{c.s2.d1.list.map((x) => <li key={x}>{x}</li>)}</ul>
          <h3>{c.s2.d2.h}</h3>
          <ul>{c.s2.d2.list.map((x) => <li key={x}>{x}</li>)}</ul>
          <h3>{c.s2.d3.h}</h3>
          <ul>{c.s2.d3.list.map((x) => <li key={x}>{x}</li>)}</ul>
          <h3>{c.s2.d4.h}</h3>
          <ul>{c.s2.d4.list.map((x) => <li key={x}>{x}</li>)}</ul>

          <h2>{c.s3.h}</h2>
          <p>{c.s3.p}</p>
          <ul>{c.s3.list.map((x) => <li key={x}>{x}</li>)}</ul>

          <h2>{c.s4.h}</h2>
          <p>{c.s4.p}</p>
          <ul>{c.s4.list.map((x) => <li key={x}>{x}</li>)}</ul>

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

const fr = {
  backHome: "Retour à l'accueil",
  home: "Accueil",
  resources: "Ressources",
  breadcrumb: "Guide du tableau de bord RH",
  h1: "Tableau de bord RH : le guide complet pour piloter vos équipes en Afrique",
  intro:
    "Un tableau de bord RH transforme des données éparses en décisions. Ce guide détaille les indicateurs à suivre, comment consolider plusieurs sites et pays, et comment garantir la conformité (CNSS, CNPS, OHADA) sans multiplier les fichiers Excel.",
  s1: {
    h: "Qu'est-ce qu'un tableau de bord RH ?",
    p: "Un tableau de bord RH (dashboard RH) est une vue unique, mise à jour en continu, qui rassemble les indicateurs clés de la fonction ressources humaines : effectifs, absentéisme, masse salariale, performance, recrutement, conformité. Il permet à la direction générale et aux DRH de piloter par la donnée plutôt que par intuition.",
    list: [
      "Une source de vérité unique pour toute l'entreprise",
      "Des indicateurs mis à jour automatiquement",
      "Une vue consolidée multi-sites et multi-pays",
      "Des alertes en cas de dérive (absentéisme, turnover, coûts)",
    ],
  },
  s2: {
    h: "Les 4 familles d'indicateurs RH à suivre",
    p: "Un bon tableau de bord RH couvre quatre familles d'indicateurs, chacune répondant à une question métier claire.",
    d1: {
      h: "1. Effectifs et démographie",
      list: [
        "Effectif total, par site, par département, par contrat (CDI, CDD, stage)",
        "Pyramide des âges et répartition par genre",
        "Ancienneté moyenne et taux d'ancienneté par équipe",
        "Répartition géographique multi-sites",
      ],
    },
    d2: {
      h: "2. Absentéisme et présence",
      list: [
        "Taux d'absentéisme global et par site",
        "Heures pointées vs heures théoriques (pointage géolocalisé)",
        "Retards, absences non justifiées, congés maladie",
        "Taux de présence par zone de pointage",
      ],
    },
    d3: {
      h: "3. Recrutement et talents",
      list: [
        "Délai moyen de recrutement (time-to-hire)",
        "Coût moyen par embauche",
        "Taux de conversion candidat → offre → embauche",
        "Turnover volontaire et involontaire, par ancienneté",
        "Taux de complétion des évaluations de performance",
      ],
    },
    d4: {
      h: "4. Masse salariale et conformité",
      list: [
        "Masse salariale mensuelle, par site et par département",
        "Ratio masse salariale / chiffre d'affaires",
        "Taux de conformité des déclarations CNSS / CNPS",
        "Respect des périodes d'essai et échéances contractuelles",
        "Suivi des formations obligatoires",
      ],
    },
  },
  s3: {
    h: "Piloter plusieurs sites : les spécificités africaines",
    p: "En Afrique, une entreprise gère souvent plusieurs sites répartis dans plusieurs villes ou pays. Le tableau de bord RH doit consolider ces réalités sans perdre en granularité locale.",
    list: [
      "Pointage géolocalisé pour vérifier la présence sur chaque site",
      "Consolidation multi-devises et multi-pays de la masse salariale",
      "Documentation et interface bilingues (français / anglais)",
      "Fonctionnement dégradé pour les zones à connectivité instable",
      "Respect du droit OHADA et des codes du travail nationaux",
      "Vue « site » filtrable par pays, région, département, chef de site",
    ],
  },
  s4: {
    h: "Construire son tableau de bord RH : la checklist",
    p: "Suivez ces étapes pour bâtir un tableau de bord RH utile dès le premier mois.",
    list: [
      "Définir 8 à 12 KPI prioritaires alignés sur la stratégie",
      "Choisir une source unique — un SIRH — pour éviter les doublons",
      "Automatiser la collecte : contrats, paie, pointage, évaluations",
      "Segmenter par site, département, type de contrat et pays",
      "Fixer des seuils d'alerte (ex. absentéisme > 8 %, turnover > 15 %)",
      "Partager une vue direction (synthèse) et une vue manager (opérationnelle)",
      "Réviser les KPI tous les 6 mois pour rester aligné avec les objectifs",
    ],
  },
  s5: {
    h: "Comment Konkouré simplifie votre tableau de bord RH",
    p: "Konkouré consolide en temps réel effectifs, pointage géolocalisé, contrats, paie, performance et recrutement dans un SIRH bilingue conçu pour l'Afrique. Le tableau de bord multi-sites s'active sans configuration : chaque décision — embauche, promotion, arbitrage budgétaire — s'appuie sur la même source de vérité.",
  },
  faq: {
    h: "Questions fréquentes",
    items: [
      {
        q: "Combien de KPI faut-il dans un tableau de bord RH ?",
        a: "Entre 8 et 12 indicateurs prioritaires. Au-delà, le tableau devient illisible et personne ne l'utilise. Mieux vaut peu d'indicateurs bien suivis que beaucoup ignorés.",
      },
      {
        q: "À quelle fréquence rafraîchir un tableau de bord RH ?",
        a: "Les données opérationnelles (présence, pointage) doivent être en temps réel. Les indicateurs stratégiques (turnover, masse salariale) se pilotent au mois. Un comité de pilotage mensuel suffit à la plupart des organisations.",
      },
      {
        q: "Excel suffit-il pour un tableau de bord RH multi-sites ?",
        a: "Non. Excel ne consolide pas plusieurs sites en temps réel, ne trace pas les modifications, et casse dès que deux personnes éditent en parallèle. Un SIRH cloud est le seul moyen fiable pour piloter des équipes réparties.",
      },
      {
        q: "Comment mesurer la productivité sur plusieurs sites ?",
        a: "En combinant pointage géolocalisé, heures pointées par zone et objectifs de performance par équipe. Le tableau de bord affiche alors le ratio heures productives / effectif par site.",
      },
    ],
  },
  cta: {
    h: "Activez votre tableau de bord RH en quelques minutes",
    p: "Konkouré fournit un tableau de bord RH multi-sites prêt à l'emploi : effectifs, absentéisme, masse salariale et conformité, consolidés en temps réel.",
    primary: "Démarrer gratuitement",
    secondary: "Voir les modules",
  },
};

const en = {
  backHome: "Back to home",
  home: "Home",
  resources: "Resources",
  breadcrumb: "HR dashboard guide",
  h1: "HR Dashboard: The Complete Guide to Steering Your Teams in Africa",
  intro:
    "An HR dashboard turns scattered data into decisions. This guide covers the KPIs to track, how to consolidate multiple sites and countries, and how to stay compliant (CNSS, CNPS, OHADA) without a pile of spreadsheets.",
  s1: {
    h: "What is an HR dashboard?",
    p: "An HR dashboard is a single, continuously updated view of the key HR indicators: headcount, absenteeism, payroll, performance, recruitment, compliance. It lets leadership and HR steer decisions by data, not intuition.",
    list: [
      "One source of truth for the whole company",
      "Automatically refreshed indicators",
      "Consolidated multi-site and multi-country view",
      "Alerts when drift appears (absenteeism, turnover, costs)",
    ],
  },
  s2: {
    h: "The four families of HR indicators to track",
    p: "A good HR dashboard covers four families of indicators, each answering a clear business question.",
    d1: {
      h: "1. Headcount and demographics",
      list: [
        "Total headcount by site, department, and contract type (CDI, CDD, internship)",
        "Age pyramid and gender distribution",
        "Average tenure and tenure by team",
        "Geographic distribution across sites",
      ],
    },
    d2: {
      h: "2. Absenteeism and attendance",
      list: [
        "Global absenteeism rate and rate by site",
        "Clocked hours vs planned hours (geolocated time clock)",
        "Late arrivals, unjustified absences, sick leave",
        "Attendance rate by clock-in zone",
      ],
    },
    d3: {
      h: "3. Recruitment and talent",
      list: [
        "Average time-to-hire",
        "Average cost per hire",
        "Candidate → offer → hire conversion rate",
        "Voluntary and involuntary turnover, by tenure",
        "Performance-review completion rate",
      ],
    },
    d4: {
      h: "4. Payroll and compliance",
      list: [
        "Monthly payroll by site and department",
        "Payroll / revenue ratio",
        "CNSS / CNPS declaration compliance rate",
        "Trial-period and contract-milestone tracking",
        "Mandatory-training compliance",
      ],
    },
  },
  s3: {
    h: "Multi-site steering: African specifics",
    p: "In Africa, one company often runs several sites across cities and countries. The HR dashboard must consolidate these realities without losing local granularity.",
    list: [
      "Geolocated time clock to verify presence per site",
      "Multi-currency, multi-country payroll consolidation",
      "Bilingual (French / English) UI and documentation",
      "Offline-friendly behavior for low-connectivity zones",
      "OHADA compliance and national labor codes",
      "Site view filterable by country, region, department, site manager",
    ],
  },
  s4: {
    h: "Building your HR dashboard: the checklist",
    p: "Follow these steps to ship a useful HR dashboard within the first month.",
    list: [
      "Define 8–12 priority KPIs aligned with strategy",
      "Choose one source — an HRIS — to eliminate duplicates",
      "Automate collection: contracts, payroll, time clock, reviews",
      "Segment by site, department, contract type, and country",
      "Set alert thresholds (e.g. absenteeism > 8%, turnover > 15%)",
      "Ship a leadership view (summary) and a manager view (operational)",
      "Review KPIs every 6 months to stay aligned with objectives",
    ],
  },
  s5: {
    h: "How Konkouré simplifies your HR dashboard",
    p: "Konkouré consolidates headcount, geolocated attendance, contracts, payroll, performance, and recruitment in real time inside a bilingual HRIS built for Africa. The multi-site dashboard works out of the box — every decision (hire, promotion, budget) is grounded in the same source of truth.",
  },
  faq: {
    h: "Frequently asked questions",
    items: [
      {
        q: "How many KPIs should an HR dashboard have?",
        a: "Between 8 and 12 priority indicators. Beyond that the dashboard becomes unreadable and no one uses it. Better to track a few KPIs well than many poorly.",
      },
      {
        q: "How often should an HR dashboard refresh?",
        a: "Operational data (attendance, time clock) should be real-time. Strategic indicators (turnover, payroll) run monthly. A monthly steering committee is enough for most organizations.",
      },
      {
        q: "Is Excel enough for a multi-site HR dashboard?",
        a: "No. Excel can't consolidate multiple sites in real time, doesn't track changes, and breaks the moment two people edit in parallel. A cloud HRIS is the only reliable way to steer distributed teams.",
      },
      {
        q: "How do you measure productivity across multiple sites?",
        a: "By combining geolocated time clock, hours clocked per zone, and per-team performance objectives. The dashboard then shows productive hours / headcount ratio per site.",
      },
    ],
  },
  cta: {
    h: "Turn on your HR dashboard in minutes",
    p: "Konkouré ships a ready-to-use multi-site HR dashboard: headcount, absenteeism, payroll, and compliance, consolidated in real time.",
    primary: "Start free",
    secondary: "See modules",
  },
};
