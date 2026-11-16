import i18n from "@/lib/i18n";

export const CONTRACT_TYPES = [
  { value: "stage", label: "Stage" },
  { value: "cdd", label: "CDD" },
  { value: "cdi", label: "CDI" },
] as const;

export type ContractType = (typeof CONTRACT_TYPES)[number]["value"];

export function contractTypeLabel(v?: string | null): string {
  if (!v) return i18n.t("hrm.contractTypes.unknown");
  const key = `hrm.contractTypes.${v}`;
  const translated = i18n.t(key);
  return translated === key ? (CONTRACT_TYPES.find((c) => c.value === v)?.label ?? i18n.t("hrm.contractTypes.unknown")) : translated;
}
