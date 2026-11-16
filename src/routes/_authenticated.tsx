import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { useOrg } from "@/hooks/useOrg";
import { useRole } from "@/hooks/useRole";
import { canAccess } from "@/lib/permissions";
import { moduleForPath } from "@/lib/entitlements";
import { useSubscription } from "@/hooks/useSubscription";
import { onApiEvent } from "@/lib/api/client";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AppHeader } from "@/components/AppHeader";
import { AppBreadcrumbs } from "@/components/AppBreadcrumbs";
import { AppFooter } from "@/components/AppFooter";
import { SplashScreen } from "@/components/SplashScreen";


export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});

function AuthLayout() {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const { org, loading: orgLoading } = useOrg();
  const { role, loading: roleLoading } = useRole();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { subscription, hasModule, loading: subLoading } = useSubscription();
  const nav = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      nav({ to: "/login", replace: true, search: {} });
      return;
    }
    if (user.mustChangePassword) {
      nav({ to: "/invitation", replace: true });
      return;
    }
    if (!orgLoading && !org) {
      nav({ to: "/onboarding/organization", replace: true });
    }
  }, [loading, user, orgLoading, org, nav]);

  // Role-based guard: block direct URL access to unauthorized pages.
  useEffect(() => {
    if (loading || orgLoading || roleLoading) return;
    if (!user || !org || !role) return;
    if (path === "/app") return;
    if (!canAccess(path, role)) {
      toast.error(t("common.unauthorized"));
      nav({ to: "/app", replace: true });
    }
  }, [loading, orgLoading, roleLoading, user, org, role, path, nav, t]);


  // Module guard: an org may only open the modules included in its plan.
  useEffect(() => {
    if (loading || orgLoading || subLoading) return;
    if (!user || !org) return;
    const mod = moduleForPath(path);
    if (!mod || hasModule(mod)) return;
    nav({
      to: "/app/module-indisponible",
      replace: true,
      search: { module: mod },
    });
  }, [loading, orgLoading, subLoading, user, org, path, subscription.modules, hasModule, nav]);

  // The API is the authority on plan modules: a 403 E_MODULE_NOT_INCLUDED from any
  // call sends the user to the "module unavailable" page.
  useEffect(
    () =>
      onApiEvent("module-forbidden", () => {
        nav({
          to: "/app/module-indisponible",
          replace: true,
          search: { module: moduleForPath(path) ?? undefined },
        });
      }),
    [nav, path],
  );

  // Single splash: only block when we truly have nothing to show.
  if (loading || (user && !org && orgLoading)) {
    return <SplashScreen />;
  }


  if (!org) {
    // No org and not loading: onboarding redirect already triggered above.
    return null;
  }


  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full min-w-0">
        <AppSidebar />
        <SidebarInset className="flex min-h-screen min-w-0 max-w-full flex-col">
          <AppHeader />
          <AppBreadcrumbs />
          <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 bg-muted/20 p-6 focus:outline-none">
            <Outlet />
          </main>
          <AppFooter />
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

