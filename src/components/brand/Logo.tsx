import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import iconAsset from "@/assets/konkoure-icon.png";
import wordmarkAsset from "@/assets/konkoure-wordmark.png";

type LogoVariant = "auto" | "icon" | "full";

interface LogoProps {
  /** "auto" (défaut) : icône sur mobile, logo complet dès `sm`. */
  variant?: LogoVariant;
  /** Alias historique de variant="auto". */
  responsive?: boolean;
  className?: string;
  onClick?: () => void;
}

/**
 * Logo Konkouré cliquable vers la landing page.
 * Les visuels étant en bleu nuit, une plaque blanche est appliquée en thème
 * sombre pour garantir la lisibilité (blanc technique, comme les QR codes).
 */
export function Logo({ variant = "auto", responsive = false, className, onClick }: LogoProps) {
  const resolved: LogoVariant = responsive ? "auto" : variant;

  const plate =
    "rounded-lg dark:bg-white dark:px-1.5 dark:py-1 dark:shadow-[0_1px_2px_rgba(0,0,0,0.25)]";

  return (
    <Link
      to="/"
      onClick={onClick}
      aria-label="Konkouré – accueil"
      className={cn("flex shrink-0 items-center", className)}
    >
      {resolved !== "full" && (
        <span className={cn("inline-flex items-center", plate, resolved === "auto" && "sm:hidden")}>
          <img
            src={iconAsset}
            alt="Konkouré"
            width={34}
            height={34}
            loading="eager"
            className="h-[34px] w-[34px] object-contain"
          />
        </span>
      )}
      {resolved !== "icon" && (
        <span
          className={cn(
            "inline-flex items-center",
            plate,
            resolved === "auto" && "hidden sm:inline-flex",
          )}
        >
          <img
            src={wordmarkAsset}
            alt="Konkouré"
            width={197}
            height={30}
            loading="eager"
            className="h-[30px] w-auto object-contain"
          />
        </span>
      )}
    </Link>
  );
}
