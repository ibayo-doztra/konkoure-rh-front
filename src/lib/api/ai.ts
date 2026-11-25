// AI assistance — 06-api-reference « IA : règles communes ». One credit per call,
// reserved before the call and given back when the provider fails.
import i18n from "@/lib/i18n";
import { ApiError, apiErrorMessage } from "@/lib/api/client";

/** The monthly AI credits of the plan are used up. */
export const isAiQuotaExceeded = (e: unknown) =>
  e instanceof ApiError && e.code === "E_AI_QUOTA_EXCEEDED";

/** Message of a failed AI call: quota, provider not configured or down, or the API's own. */
export function aiErrorMessage(error: unknown): string {
  if (isAiQuotaExceeded(error)) return i18n.t("ai.quotaExceeded");
  if (error instanceof ApiError && (error.code === "E_AI_UNAVAILABLE" || error.status === 503)) {
    return i18n.t("ai.unavailable");
  }
  return apiErrorMessage(error);
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * The AI answers in plain text with line breaks: paragraphs become `<p>`,
 * lines starting with `-`, `*` or `•` become a list, for the rich text editor.
 */
export function plainTextToHtml(text: string): string {
  const html: string[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) html.push(`<ul>${list.map((li) => `<li>${li}</li>`).join("")}</ul>`);
    list = [];
  };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    const item = line.match(/^[-*•]\s+(.*)$/);
    if (item) {
      list.push(escapeHtml(item[1]));
      continue;
    }
    flush();
    if (line) html.push(`<p>${escapeHtml(line)}</p>`);
  }
  flush();
  return html.join("");
}
