// Mémorise le code de rattachement d'un paiement effectué AVANT la création
// du compte, pour l'appliquer à l'organisation dès qu'elle existe.
const KEY = "konkoure.pendingClaim";

export function savePendingClaim(token: string) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(KEY, token);
    localStorage.setItem(KEY, token);
  } catch {
    /* ignore */
  }
}

export function peekPendingClaim(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(KEY) ?? localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** Lit puis efface le code mémorisé. */
export function takePendingClaim(): string | null {
  const value = peekPendingClaim();
  clearPendingClaim();
  return value;
}

export function clearPendingClaim() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(KEY);
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
