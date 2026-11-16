import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useLandingCopy } from "@/lib/landing/useLandingCopy";
import { Logo } from "@/components/brand/Logo";


/** Liens d'ancre de la barre de navigation, partagés avec le pied de page. */
export const LANDING_NAV = [
  { href: "#benefices", key: "features" },
  { href: "#modules", key: "modules" },
  { href: "#tarifs", key: "pricing" },
] as const;

/** Logo partagé (source unique dans @/components/brand/Logo). */
export { Logo };


export function SiteHeader() {
  const { copy } = useLandingCopy();
  const [open, setOpen] = useState(false);

  const links = LANDING_NAV.map((l) => ({ href: l.href, label: copy.nav[l.key] }));

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-[14px]">
      <div className="mx-auto flex w-full max-w-[1160px] flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
        <Logo />

        <nav className="ml-auto hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-md px-3 py-2.5 text-sm text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <LanguageSwitcher />
          <ThemeToggle />
          <Button asChild variant="ghost" className="hidden h-10 sm:inline-flex">
            <Link to="/login">{copy.nav.signin}</Link>
          </Button>
          <Button
            asChild
            className="hidden h-10 rounded-md px-[18px] transition-transform hover:-translate-y-px hover:bg-primary/90 hover:shadow-cta sm:inline-flex"
          >
            <Link to="/signup">{copy.nav.start}</Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 md:hidden"
            aria-label={copy.nav.menuAria}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {open && (
        <div className="border-t bg-background md:hidden">
          <nav className="mx-auto flex max-w-[1160px] flex-col gap-1 px-5 py-4">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-2 py-3 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                {l.label}
              </a>
            ))}
            <div className="mt-2 flex gap-2">
              <Button asChild variant="outline" className="h-11 flex-1 rounded-md">
                <Link to="/login">{copy.nav.signin}</Link>
              </Button>
              <Button asChild className="h-11 flex-1 rounded-md">
                <Link to="/signup">{copy.nav.start}</Link>
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
