import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export function scorePassword(pwd: string): number {
  if (!pwd) return 0;
  let s = 0;
  if (pwd.length >= 8) s++;
  if (pwd.length >= 12) s++;
  if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) s++;
  if (/\d/.test(pwd)) s++;
  if (/[^A-Za-z0-9]/.test(pwd)) s++;
  return Math.min(s, 4);
}

const LABELS = ["weak", "weak", "fair", "good", "strong"] as const;
const COLORS = [
  "bg-muted",
  "bg-destructive",
  "bg-orange-500",
  "bg-yellow-500",
  "bg-green-500",
];

export function PasswordStrength({ value }: { value: string }) {
  const { t } = useTranslation();
  const score = scorePassword(value);
  const label = t(`auth.passwordStrength.${LABELS[score]}`);
  return (
    <div className="space-y-1">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              i <= score ? COLORS[score] : "bg-muted",
            )}
          />
        ))}
      </div>
      {value && (
        <p className="text-xs text-muted-foreground">
          {t("auth.passwordStrengthLabel")}: <span className="font-medium">{label}</span>
        </p>
      )}
    </div>
  );
}
