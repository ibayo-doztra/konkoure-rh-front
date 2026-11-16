/**
 * Traduction des erreurs techniques de la base en messages compréhensibles.
 * Les codes PostgREST/Postgres et les messages RLS ne doivent jamais être
 * affichés tels quels à un utilisateur.
 */
import i18n from "@/lib/i18n";

interface MaybePgError {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
}

function t(key: string, fallback: string): string {
  const value = i18n.t(key);
  return value === key ? fallback : value;
}

/** Message utilisateur pour une erreur de base de données (ou d'appel serveur). */
export function humanizeDbError(error: unknown, fallbackMessage?: string): string {
  const err = (error ?? {}) as MaybePgError;
  const raw = `${err.message ?? ""} ${err.details ?? ""} ${err.hint ?? ""}`.toLowerCase();
  const code = err.code ?? "";

  if (raw.includes("row-level security") || code === "42501" || raw.includes("permission denied")) {
    if (raw.includes("module")) {
      return t("dbErrors.moduleNotIncluded", "Ce module n'est pas inclus dans votre offre.");
    }
    return t(
      "dbErrors.notAllowed",
      "Vous n'avez pas les droits nécessaires pour cette action. Contactez un administrateur de votre entreprise.",
    );
  }
  if (code === "23505" || raw.includes("duplicate key")) {
    return t("dbErrors.duplicate", "Cette valeur existe déjà. Modifiez-la puis réessayez.");
  }
  if (code === "23503" || raw.includes("foreign key")) {
    return t(
      "dbErrors.linkedRecord",
      "Cet élément est lié à d'autres données : retirez d'abord les liens puis réessayez.",
    );
  }
  if (code === "23502" || raw.includes("not-null") || raw.includes("null value")) {
    return t("dbErrors.missingField", "Un champ obligatoire est manquant.");
  }
  if (code === "PGRST301" || raw.includes("jwt") || raw.includes("token")) {
    return t("dbErrors.sessionExpired", "Votre session a expiré. Reconnectez-vous puis réessayez.");
  }

  const message = (err.message ?? "").trim();
  if (message && !message.toLowerCase().includes("row-level security")) return message;
  return fallbackMessage ?? t("dbErrors.generic", "Une erreur est survenue. Réessayez dans un instant.");
}
