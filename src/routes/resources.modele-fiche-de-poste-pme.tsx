import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

const CANONICAL = "https://konkoure.lovable.app/resources/modele-fiche-de-poste-pme";

const TITLE = "Modèle de fiche de poste PME : guide et trame 2026 | Konkouré";
const DESCRIPTION =
  "Rédigez une fiche de poste claire en 7 rubriques : missions, compétences, rattachement, indicateurs. Trame prête à copier pour PME et recrutement en Afrique.";

export const Route = createFileRoute("/resources/modele-fiche-de-poste-pme")({
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
          "fiche de poste, modèle fiche de poste, exemple fiche de poste, trame fiche de poste, description de poste, fiche de poste pme, recrutement afrique, sirh",
      },
    ],
    links: [{ rel: "canonical", href: CANONICAL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: "Modèle de fiche de poste : la trame complète pour les PME",
          description: DESCRIPTION,
          author: { "@type": "Organization", name: "Konkouré" },
          publisher: {
            "@type": "Organization",
            name: "Konkouré",
            logo: { "@type": "ImageObject", url: "https://konkoure.lovable.app/favicon.ico" },
          },
          mainEntityOfPage: CANONICAL,
          inLanguage: ["fr", "en"],
          about: ["Fiche de poste", "Description de poste", "Recrutement", "Gestion RH PME"],
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
              name: "Qu'est-ce qu'une fiche de poste ?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Une fiche de poste est un document qui décrit l'intitulé, la finalité, les missions, les compétences requises, le rattachement hiérarchique et les indicateurs de réussite d'un emploi. Elle sert de référence commune au recrutement, à l'intégration et à l'évaluation.",
              },
            },
            {
              "@type": "Question",
              name: "Quelle différence entre fiche de poste et offre d'emploi ?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "La fiche de poste est un document interne et durable qui cadre le rôle. L'offre d'emploi est une communication externe, plus courte et marketing, qui s'appuie sur la fiche de poste pour attirer des candidats.",
              },
            },
            {
              "@type": "Question",
              name: "Qui rédige la fiche de poste dans une PME ?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Le manager du poste rédige les missions et les indicateurs, les RH cadrent la forme, la classification et la conformité. Une relecture par un titulaire du poste, quand il existe, évite les écarts avec la réalité du terrain.",
              },
            },
            {
              "@type": "Question",
              name: "À quelle fréquence mettre à jour une fiche de poste ?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Au minimum une fois par an, lors de l'entretien annuel, et systématiquement en cas de réorganisation, de changement d'outils ou d'évolution des missions.",
              },
            },
          ],
        }),
      },
    ],
  }),
  component: JobDescriptionTemplateGuide,
});

function JobDescriptionTemplateGuide() {
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
          {c.s2.blocks.map((b) => (
            <div key={b.h}>
              <h3>{b.h}</h3>
              <p>{b.p}</p>
            </div>
          ))}

          <h2>{c.s3.h}</h2>
          <p>{c.s3.p}</p>
          <pre className="whitespace-pre-wrap">{c.s3.template}</pre>

          <h2>{c.s4.h}</h2>
          <p>{c.s4.p}</p>
          <ul>{c.s4.list.map((x) => <li key={x}>{x}</li>)}</ul>

          <h2>{c.s5.h}</h2>
          <p>{c.s5.p}</p>
          <ul>{c.s5.list.map((x) => <li key={x}>{x}</li>)}</ul>

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
              to="/resources/guide-tableau-de-bord-rh"
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
  breadcrumb: "Modèle de fiche de poste",
  h1: "Modèle de fiche de poste : la trame complète pour les PME",
  intro:
    "La fiche de poste est le socle d'un recrutement réussi, d'une intégration rapide et d'une évaluation juste. Voici les 7 rubriques indispensables, une trame prête à copier et les erreurs à éviter dans une PME africaine.",
  s1: {
    h: "À quoi sert une fiche de poste ?",
    p: "Une fiche de poste décrit ce que l'on attend réellement d'un emploi, indépendamment de la personne qui l'occupe. Elle devient la référence commune du manager, des RH et du collaborateur tout au long du cycle de vie du poste.",
    list: [
      "Cadrer le besoin avant de publier une offre d'emploi",
      "Comparer les candidatures sur des critères identiques",
      "Accélérer l'intégration : le nouvel arrivant sait ce qui est attendu",
      "Servir de base objective à l'entretien annuel et aux objectifs",
      "Sécuriser la classification, la rémunération et la conformité (CNSS, OHADA)",
    ],
  },
  s2: {
    h: "Les 7 rubriques d'une fiche de poste efficace",
    p: "Une bonne fiche de poste tient sur une à deux pages. Chaque rubrique doit être factuelle et vérifiable.",
    blocks: [
      {
        h: "1. Identification du poste",
        p: "Intitulé exact, département ou direction, site de rattachement, type de contrat (CDI, CDD, stage), et date de mise à jour du document.",
      },
      {
        h: "2. Finalité du poste",
        p: "Deux à trois phrases qui expliquent pourquoi le poste existe et à quel résultat d'entreprise il contribue.",
      },
      {
        h: "3. Missions principales",
        p: "Cinq à huit missions maximum, chacune commençant par un verbe d'action. Évitez la liste de tâches interminable : regroupez par domaine de responsabilité.",
      },
      {
        h: "4. Rattachement et interactions",
        p: "Manager (N+1), équipe encadrée le cas échéant, interlocuteurs internes et partenaires externes réguliers.",
      },
      {
        h: "5. Compétences requises",
        p: "Distinguez les compétences techniques (outils, langues, certifications), les compétences comportementales et le niveau attendu : notion, autonome, expert.",
      },
      {
        h: "6. Indicateurs de réussite",
        p: "Trois à cinq indicateurs mesurables sur douze mois : délai, volume, qualité, satisfaction, conformité. C'est ce qui rend l'évaluation objective.",
      },
      {
        h: "7. Conditions d'exercice",
        p: "Horaires, déplacements, travail terrain ou multi-sites, équipements fournis, contraintes de sécurité et modalités de pointage.",
      },
    ],
  },
  s3: {
    h: "Trame de fiche de poste à copier",
    p: "Copiez cette trame dans votre document ou directement dans le module Recrutement de votre SIRH.",
    template: `INTITULÉ DU POSTE :
Département / Direction :
Site :
Type de contrat :
Rattachement hiérarchique (N+1) :
Date de mise à jour :

FINALITÉ DU POSTE
(2 à 3 phrases : pourquoi ce poste existe)

MISSIONS PRINCIPALES
1.
2.
3.
4.
5.

COMPÉTENCES TECHNIQUES
-
-

COMPÉTENCES COMPORTEMENTALES
-
-

FORMATION ET EXPÉRIENCE
- Niveau de formation :
- Expérience minimale :

INDICATEURS DE RÉUSSITE (12 mois)
1.
2.
3.

CONDITIONS D'EXERCICE
- Horaires / déplacements :
- Équipements :
- Modalités de pointage :`,
  },
  s4: {
    h: "Cinq erreurs fréquentes à éviter",
    p: "Ces erreurs sont les plus coûteuses en recrutement comme en management.",
    list: [
      "Décrire la personne en poste plutôt que le poste lui-même",
      "Aligner vingt missions sans hiérarchie ni priorité",
      "Oublier les indicateurs de réussite, ce qui rend l'évaluation subjective",
      "Copier une fiche générique sans l'adapter au contexte local et légal",
      "Ne jamais mettre à jour le document après une réorganisation",
    ],
  },
  s5: {
    h: "De la fiche de poste à l'offre d'emploi",
    p: "Une fois la fiche validée, l'offre d'emploi en reprend l'essentiel dans un format court et attractif.",
    list: [
      "Reprenez la finalité du poste comme accroche",
      "Gardez les 4 à 5 missions les plus parlantes",
      "Traduisez les compétences en critères de sélection clairs",
      "Ajoutez lieu, type de contrat, date limite de candidature",
      "Publiez sur une page carrière dédiée pour centraliser les candidatures",
    ],
  },
  faq: {
    h: "Questions fréquentes",
    items: [
      {
        q: "Qu'est-ce qu'une fiche de poste ?",
        a: "C'est un document qui décrit l'intitulé, la finalité, les missions, les compétences, le rattachement et les indicateurs de réussite d'un emploi. Elle sert de référence au recrutement, à l'intégration et à l'évaluation.",
      },
      {
        q: "Quelle différence entre fiche de poste et offre d'emploi ?",
        a: "La fiche de poste est interne et durable : elle cadre le rôle. L'offre d'emploi est externe, plus courte et orientée attractivité ; elle s'appuie sur la fiche de poste.",
      },
      {
        q: "Qui rédige la fiche de poste dans une PME ?",
        a: "Le manager rédige les missions et les indicateurs, les RH cadrent la forme, la classification et la conformité. Faites relire par un titulaire du poste quand il existe.",
      },
      {
        q: "À quelle fréquence la mettre à jour ?",
        a: "Au minimum une fois par an, lors de l'entretien annuel, et à chaque réorganisation ou évolution significative des missions.",
      },
    ],
  },
  cta: {
    h: "Créez vos fiches de poste directement dans Konkouré",
    p: "Le module Recrutement génère offres, pages carrière et suivi des candidatures à partir de vos fiches de poste, en français comme en anglais.",
    primary: "Créer un compte gratuit",
    secondary: "Guide du tableau de bord RH",
  },
};

const en = {
  backHome: "Back to home",
  home: "Home",
  resources: "Resources",
  breadcrumb: "Job description template",
  h1: "Job description template: the complete framework for SMEs",
  intro:
    "A job description is the foundation of good hiring, fast onboarding and fair reviews. Here are the 7 essential sections, a ready-to-copy template, and the mistakes to avoid in a growing company.",
  s1: {
    h: "What is a job description for?",
    p: "A job description defines what a role requires, independently of the person holding it. It becomes the shared reference for managers, HR and employees throughout the role's life cycle.",
    list: [
      "Frame the need before publishing a job ad",
      "Compare applications against identical criteria",
      "Speed up onboarding: new hires know what is expected",
      "Provide an objective base for annual reviews and goals",
      "Secure grading, pay bands and legal compliance",
    ],
  },
  s2: {
    h: "The 7 sections of an effective job description",
    p: "A good job description fits on one or two pages. Every section should be factual and verifiable.",
    blocks: [
      {
        h: "1. Role identification",
        p: "Exact job title, department, site, contract type (permanent, fixed-term, internship) and last update date.",
      },
      {
        h: "2. Purpose of the role",
        p: "Two or three sentences explaining why the role exists and which business outcome it supports.",
      },
      {
        h: "3. Core missions",
        p: "Five to eight missions maximum, each starting with an action verb. Group tasks by area of responsibility instead of listing everything.",
      },
      {
        h: "4. Reporting line and interactions",
        p: "Direct manager, team managed if any, internal stakeholders and regular external partners.",
      },
      {
        h: "5. Required skills",
        p: "Separate technical skills (tools, languages, certifications) from behavioural skills, and state the expected level: aware, autonomous, expert.",
      },
      {
        h: "6. Success indicators",
        p: "Three to five measurable indicators over twelve months: lead time, volume, quality, satisfaction, compliance. This is what makes reviews objective.",
      },
      {
        h: "7. Working conditions",
        p: "Hours, travel, field or multi-site work, equipment provided, safety constraints and time-tracking rules.",
      },
    ],
  },
  s3: {
    h: "Job description template to copy",
    p: "Copy this template into your document or straight into your HR system's recruitment module.",
    template: `JOB TITLE:
Department:
Site:
Contract type:
Reports to:
Last updated:

PURPOSE OF THE ROLE
(2-3 sentences: why this role exists)

CORE MISSIONS
1.
2.
3.
4.
5.

TECHNICAL SKILLS
-
-

BEHAVIOURAL SKILLS
-
-

EDUCATION AND EXPERIENCE
- Education level:
- Minimum experience:

SUCCESS INDICATORS (12 months)
1.
2.
3.

WORKING CONDITIONS
- Hours / travel:
- Equipment:
- Time-tracking rules:`,
  },
  s4: {
    h: "Five common mistakes to avoid",
    p: "These mistakes are the most costly, both in hiring and in management.",
    list: [
      "Describing the current jobholder instead of the role",
      "Listing twenty missions with no priority",
      "Skipping success indicators, which makes reviews subjective",
      "Copying a generic description without adapting it to local law and context",
      "Never updating the document after a reorganisation",
    ],
  },
  s5: {
    h: "From job description to job ad",
    p: "Once approved, the job ad reuses the essentials in a shorter, more attractive format.",
    list: [
      "Use the purpose of the role as the opening hook",
      "Keep the 4-5 most meaningful missions",
      "Turn skills into clear selection criteria",
      "Add location, contract type and application deadline",
      "Publish on a dedicated careers page to centralise applications",
    ],
  },
  faq: {
    h: "Frequently asked questions",
    items: [
      {
        q: "What is a job description?",
        a: "A document describing the title, purpose, missions, skills, reporting line and success indicators of a role. It supports hiring, onboarding and reviews.",
      },
      {
        q: "How is it different from a job ad?",
        a: "The job description is internal and durable: it frames the role. The job ad is external, shorter and attraction-oriented, and is built from the job description.",
      },
      {
        q: "Who writes it in a small company?",
        a: "The manager writes the missions and indicators; HR handles format, grading and compliance. Have it reviewed by the current jobholder when there is one.",
      },
      {
        q: "How often should it be updated?",
        a: "At least once a year during the annual review, and whenever the role or the organisation changes significantly.",
      },
    ],
  },
  cta: {
    h: "Build your job descriptions inside Konkouré",
    p: "The recruitment module turns your job descriptions into job ads, careers pages and application tracking, in French and English.",
    primary: "Create a free account",
    secondary: "HR dashboard guide",
  },
};
