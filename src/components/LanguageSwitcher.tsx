import { Check, Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const LANGS = [
  { code: "fr", label: "Français" },
  { code: "en", label: "English" },
] as const;

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const active = (i18n.resolvedLanguage || i18n.language || "fr").slice(0, 2);
  const change = (lng: string) => {
    void i18n.changeLanguage(lng);
  };
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="gap-2" aria-label="Change language">
          <Globe className="h-4 w-4" aria-hidden="true" />
          <span className="text-xs uppercase">{active}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onCloseAutoFocus={(e) => e.preventDefault()}>
        {LANGS.map((l) => (
          <DropdownMenuItem
            key={l.code}
            onSelect={(e) => {
              e.preventDefault();
              change(l.code);
            }}
            className="justify-between gap-4"
          >
            <span>{l.label}</span>
            {active === l.code && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
