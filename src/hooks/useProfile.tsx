import { useAuth } from "@/hooks/useAuth";

export interface ProfileInfo {
  fullName: string | null;
  avatarUrl: string | null;
  email: string | null;
  /** Prénom de l'utilisateur connecté, ou début de l'e-mail en repli. */
  firstName: string;
  /** Initiales calculées depuis le nom du profil (repli : e-mail). */
  initials: string;
}

/** Identité de l'utilisateur connecté, lue depuis `GET /me`. */
export function useProfile(): ProfileInfo {
  const { user } = useAuth();

  const email = user?.email ?? null;
  const fullName = user?.fullName?.trim() || null;
  const emailPrefix = email?.split("@")[0] ?? "";
  const parts = (fullName ?? "").split(/\s+/).filter(Boolean);

  const firstName = parts[0] ?? emailPrefix;
  const initials =
    parts.length >= 2
      ? `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase()
      : (parts[0]?.slice(0, 2) ?? emailPrefix.slice(0, 2) ?? "?").toUpperCase() || "?";

  return { fullName, avatarUrl: user?.avatarUrl ?? null, email, firstName, initials };
}
