import { NotificationBell } from "./NotificationBell";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "./ThemeToggle";


import { LanguageSwitcher } from "./LanguageSwitcher";

import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useMyEmployee } from "@/hooks/useMyEmployee";
import { useRole } from "@/hooks/useRole";
import { ROLE_LABELS, canAccess } from "@/lib/permissions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getAdminStatus } from "@/lib/api/legacy-functions";


export function AppHeader() {
  const { t } = useTranslation();
  const { user, signOut, loading: authLoading } = useAuth();
  const { role } = useRole();
  const { myEmployee } = useMyEmployee();
  const navigate = useNavigate();
  const adminStatusFn = getAdminStatus;
  const { data: adminStatus } = useQuery({
    queryKey: ["admin-status", user?.id ?? null],
    queryFn: () => adminStatusFn(),
    enabled: !authLoading && !!user,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  // L'identité affichée vient du profil de l'utilisateur connecté
  // (les métadonnées d'authentification peuvent être périmées).
  const { fullName, avatarUrl, initials } = useProfile();

  const displayName = fullName ?? user?.email ?? "";



  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-md">
      <SidebarTrigger
        aria-label={t("sidebar.toggle")}
        className="h-9 w-9 shrink-0 px-0 text-foreground [&_svg]:!h-4 [&_svg]:!w-4"
      />
      

      <div className="flex-1" />
      <div className="ml-auto flex items-center gap-1">
        <LanguageSwitcher />
        
        <ThemeToggle />
        <NotificationBell />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 px-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={avatarUrl ?? undefined} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="hidden max-w-[200px] text-left md:block">
                <div className="truncate text-sm font-medium leading-tight">
                  {displayName}
                </div>
                <div className="truncate text-[11px] text-muted-foreground">{user?.email}</div>
              </div>

            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="space-y-0.5">
              <div className="truncate text-sm font-medium">
                {displayName}
              </div>
              <div className="truncate text-xs font-normal text-muted-foreground">{user?.email}</div>
              {role && (
                <div className="text-xs font-normal text-muted-foreground">{ROLE_LABELS[role]}</div>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {myEmployee?.id && (
              <DropdownMenuItem onClick={() => navigate({ to: `/app/employees/${myEmployee.id}` })}>
                {t("sidebar.myProfile")}
              </DropdownMenuItem>
            )}
            {canAccess("/app/settings", role) && (
              <DropdownMenuItem onClick={() => navigate({ to: "/app/settings" })}>
                {t("common.settings")}
              </DropdownMenuItem>
            )}
            {adminStatus?.isPlatformAdmin && (
              <DropdownMenuItem onClick={() => navigate({ to: "/konkoureoffice" })}>
                {t("sidebar.platformAdmin")}
              </DropdownMenuItem>
            )}

            <DropdownMenuItem
              onClick={async () => {
                await signOut();
                navigate({ to: "/login" });
              }}
            >
              {t("common.signout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
