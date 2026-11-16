export function formatCurrency(value: number | null | undefined, currency: string = "GNF", locale = "fr-FR") {
  if (value == null || isNaN(value)) return "—";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${value.toLocaleString(locale)} ${currency}`;
  }
}
