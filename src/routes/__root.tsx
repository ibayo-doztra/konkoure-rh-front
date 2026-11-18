import { Outlet, Link, createRootRouteWithContext, HeadContent, Scripts, useRouterState, type ErrorComponentProps } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { AuthProvider } from "@/hooks/useAuth";
import { OrgProvider } from "@/hooks/useOrg";
import { RoleProvider } from "@/hooks/useRole";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { storedLanguage } from "@/lib/i18n";


interface RouterContext {
  queryClient: QueryClient;
}

import appCss from "../styles.css?url";

function NotFoundComponent() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">{t("notFound.title")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("notFound.subtitle")}</p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
          >
            {t("notFound.home")}
          </Link>
        </div>
      </div>
    </div>
  );
}

function RootErrorComponent({ error }: ErrorComponentProps) {
  const { t } = useTranslation();
  console.error(error);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">{t("errorPage.title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("errorPage.subtitle")}</p>
        {import.meta.env.DEV && error instanceof Error && (
          <p className="mt-2 break-words text-xs text-muted-foreground/80">{error.message}</p>
        )}
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") window.location.reload();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
          >
            {t("errorPage.reload")}
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            {t("common.home")}
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<RouterContext>()({

  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "google-site-verification", content: "M1vXc2KcZCUopIVmm81x8qgz5pJSSApVy6B3OTTGuxs" },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Konkouré" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/favicon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700;900&display=swap" },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: RootErrorComponent,

});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function ToastRouteReset() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => {
    toast.dismiss();
  }, [pathname]);
  return null;
}

function HtmlLangSync() {
  const { i18n } = useTranslation();
  useEffect(() => {
    if (storedLanguage && storedLanguage !== i18n.language) {
      void i18n.changeLanguage(storedLanguage);
    }
    const apply = () => {
      const lng = (i18n.resolvedLanguage || i18n.language || "fr").slice(0, 2);
      if (typeof document !== "undefined") document.documentElement.lang = lng;
    };
    apply();
    i18n.on("languageChanged", apply);
    return () => i18n.off("languageChanged", apply);
  }, [i18n]);
  return null;
}


function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <AuthProvider>
          <OrgProvider>
            <RoleProvider>
              <HtmlLangSync />
              <ToastRouteReset />
              <Outlet />
              <Toaster richColors position="top-right" />
            </RoleProvider>
          </OrgProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
