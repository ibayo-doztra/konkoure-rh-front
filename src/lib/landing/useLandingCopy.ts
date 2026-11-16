import { useTranslation } from "react-i18next";
import { landingCopy, type LandingCopy } from "./copy";

/** Résout le contenu de la landing page selon la langue active d'i18next. */
export function useLandingCopy(): { copy: LandingCopy; lang: "fr" | "en" } {
  const { i18n } = useTranslation();
  const raw = (i18n.resolvedLanguage || i18n.language || "fr").slice(0, 2);
  const lang: "fr" | "en" = raw === "en" ? "en" : "fr";
  return { copy: landingCopy[lang], lang };
}

/** Formatage monétaire commun à la grille tarifaire (espaces fines, sans décimales). */
export function formatGnf(value: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 })
    .format(Math.round(value))
    .replace(/\u202f|\u00a0/g, " ");
}
