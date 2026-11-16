/**
 * Escapes one CSV cell and neutralises spreadsheet formulas: values starting
 * with =, +, -, @, tab or carriage return are prefixed with an apostrophe.
 */
export function csvCell(value: unknown): string {
  let s = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}
