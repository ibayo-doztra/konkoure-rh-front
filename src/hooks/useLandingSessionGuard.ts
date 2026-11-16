import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";

/**
 * Redirige un visiteur déjà authentifié vers l'application.
 * Renvoie "checking" tant que la session n'est pas tranchée, pour afficher
 * l'écran de démarrage au lieu d'un flash de la landing page.
 */
export function useLandingSessionGuard(): "checking" | "guest" {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/app", replace: true });
  }, [loading, user, navigate]);

  return loading || user ? "checking" : "guest";
}
