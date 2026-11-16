import { useLandingCopy } from "@/lib/landing/useLandingCopy";
import doztraLogoAsset from "@/assets/doztra-logo.png";

export function AppFooter() {
  const { copy } = useLandingCopy();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t bg-background px-6 py-4">
      <div className="flex flex-wrap items-center gap-2.5 text-xs text-muted-foreground">
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
      </div>
    </footer>
  );
}
