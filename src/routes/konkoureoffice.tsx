import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  Building2,
  CreditCard,
  Gauge,
  HeartPulse,
  LayoutList,
  MessageSquare,
  ScrollText,
  Settings,
  ShieldAlert,
  Users,
  ArrowLeft,
} from "lucide-react";
import { usePlatformAdmin } from "@/hooks/usePlatformAdmin";
import { useAuth } from "@/hooks/useAuth";
import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SplashScreen } from "@/components/SplashScreen";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/konkoureoffice")({
  ssr: false,
  component: AdminLayout,
  head: () => ({
    meta: [
      { title: "Administration plateforme — Konkouré RH" },
      { name: "robots", content: "noindex, nofollow" },
      {
        name: "description",
        content: "Back-office réservé aux super-administrateurs de Konkouré RH.",
      },
    ],
  }),
});

const NAV = [
  { to: "/konkoureoffice", label: "Vue d'ensemble", icon: Gauge, exact: true },
  { to: "/konkoureoffice/organisations", label: "Organisations", icon: Building2 },
  { to: "/konkoureoffice/offres", label: "Offres & tarifs", icon: LayoutList },
  { to: "/konkoureoffice/utilisateurs", label: "Utilisateurs", icon: Users },
  { to: "/konkoureoffice/demandes", label: "Demandes de démo", icon: MessageSquare },
  { to: "/konkoureoffice/paiements", label: "Paiements", icon: CreditCard },
  { to: "/konkoureoffice/reglages", label: "Réglages", icon: Settings },
  { to: "/konkoureoffice/journal", label: "Journal", icon: ScrollText },
  { to: "/konkoureoffice/sante", label: "Santé", icon: HeartPulse },
];

function AdminLayout() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { isAdmin, level } = usePlatformAdmin();

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login", replace: true, search: {} });
  }, [loading, user, nav]);

  if (loading) return <SplashScreen />;
  if (!user) return null;

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/20 p-6">
        <Card className="max-w-md">
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <ShieldAlert className="h-10 w-10 text-destructive" />
            <h1 className="text-lg font-semibold">Accès restreint</h1>
            <p className="text-sm text-muted-foreground">
              Cet espace est réservé aux super-administrateurs de la plateforme.
            </p>
            <Button asChild variant="outline">
              <Link to="/app">Retour à l'application</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isActive = (to: string, exact?: boolean) =>
    exact ? path === to : path === to || path.startsWith(to + "/");

  return (
    <div className="flex min-h-screen w-full bg-muted/20">
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-sidebar md:flex">
        <div className="flex h-16 items-center gap-2 border-b px-4">
          <Logo />
          <Badge variant="secondary" className="ml-auto text-[10px] font-semibold uppercase">
            Admin
          </Badge>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                isActive(item.to, item.exact)
                  ? "bg-primary/10 font-medium text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="border-t p-3">
          <Button asChild variant="ghost" size="sm" className="w-full justify-start gap-2">
            <Link to="/app">
              <ArrowLeft className="h-4 w-4" />
              Retour à l'app
            </Link>
          </Button>
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-md">
          <div className="md:hidden">
            <Logo responsive />
          </div>
          <div className="hidden text-sm text-muted-foreground md:block">
            Administration plateforme · {user.email}
          </div>
          <div className="ml-auto flex items-center gap-2">
            {level && (
              <Badge variant="outline" className="uppercase">
                {level}
              </Badge>
            )}
            <ThemeToggle />
          </div>
        </header>

        <nav className="flex gap-1 overflow-x-auto border-b bg-background px-3 py-2 md:hidden">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "shrink-0 rounded-md px-3 py-1.5 text-xs",
                isActive(item.to, item.exact)
                  ? "bg-primary/10 font-medium text-primary"
                  : "text-muted-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <main className="min-w-0 flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
