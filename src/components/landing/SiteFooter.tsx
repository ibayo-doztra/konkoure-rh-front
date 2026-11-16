import { useTranslation } from "react-i18next";
import { LANDING_NAV } from "./SiteHeader";
import { Logo } from "@/components/brand/Logo";
import { useLandingCopy } from "@/lib/landing/useLandingCopy";
import { cn } from "@/lib/utils";
import doztraLogoAsset from "@/assets/doztra-logo.png";

const LANGS = ["fr", "en"] as const;

function LanguagePills() {
  const { i18n } = useTranslation();
  const active = (i18n.resolvedLanguage || i18n.language || "fr").slice(0, 2);

  return (
    <div className="flex items-center gap-2">
      {LANGS.map((code) => (
        <button
          key={code}
          type="button"
          aria-pressed={active === code}
          onClick={() => void i18n.changeLanguage(code)}
          className={cn(
            "h-9 min-w-[44px] rounded-full border px-3 text-xs font-medium uppercase transition-colors",
            active === code
              ? "border-primary bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {code}
        </button>
      ))}
    </div>
  );
}

export function SiteFooter() {
  const { copy } = useLandingCopy();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t bg-card pb-7 pt-10">
      <div className="mx-auto w-full max-w-[1160px] px-5">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-7">
          <div>
            <Logo />
            <p className="mt-3 max-w-[34ch] text-xs text-muted-foreground">{copy.footer.pitch}</p>
          </div>

          <div>
            <p className="text-xs font-bold">{copy.footer.productTitle}</p>
            <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
              {LANDING_NAV.map((l) => (
                <li key={l.href}>
                  <a href={l.href} className="hover:text-foreground">
                    {copy.nav[l.key]}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-bold">{copy.footer.resourcesTitle}</p>
            <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
              {copy.footer.resources.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-bold">{copy.footer.langTitle}</p>
            <div className="mt-3">
              <LanguagePills />
            </div>
          </div>
        </div>

        <div className="mt-7 flex flex-wrap items-center gap-2.5 border-t pt-5 text-xs text-muted-foreground">
          <span>{copy.footer.rights.replace("{{year}}", String(year))}</span>
          <a
            href="https://doztra.com/"
            target="_blank"
            rel="noopener"
            className="ml-auto inline-flex items-center gap-1.5 text-primary hover:text-primary-strong"
          >
            <span>{copy.footer.builtBy}</span>
          <span className="dark:inline-flex dark:bg-white dark:rounded-sm dark:px-1 dark:py-0.5">
            <img
              src={doztraLogoAsset}
              alt="Doztra"
              width={64}
              height={16}
              className="h-4 w-auto object-contain"
            />
          </span>
            <strong className="font-bold">Doztra</strong>
          </a>
          <span className="ml-auto">{copy.footer.taxNote}</span>
        </div>
      </div>
    </footer>
  );
}
