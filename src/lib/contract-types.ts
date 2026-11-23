import i18n from "@/lib/i18n";
import type { ContractType } from "@/lib/api/hr";

export type { ContractType };

/** Contract types of the API (06 §4 and §8), in display order. */
export const CONTRACT_TYPES: readonly ContractType[] = [
  "cdi",
  "cdd",
  "stage",
  "freelance",
  "apprenticeship",
  "daily",
];

/** The locale key of `daily` predates the API value. */
const LABEL_KEY: Partial<Record<string, string>> = { daily: "journalier" };

export function contractTypeLabel(v?: string | null): string {
  if (!v) return i18n.t("hrm.contractTypes.unknown");
  const key = `hrm.contractTypes.${LABEL_KEY[v] ?? v}`;
  const translated = i18n.t(key);
  return translated === key ? v : translated;
}
