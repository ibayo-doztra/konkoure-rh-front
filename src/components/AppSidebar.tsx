import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import {
  LayoutDashboard,
  Users,
  Building2,
  FileText,
  Briefcase,
  UserPlus,
  Target,
  MessageSquare,
  ClipboardCheck,
  MapPin,
  Clock,
  Sparkles,
  Grid3x3,
  Crown,
  CreditCard,
  Settings,
  Share2,
  ChevronDown,
  Users2,
  TrendingUp,
  Timer,
  Star,
  SlidersHorizontal,
  Bot,
  Nfc,
  FileCode2,
  CalendarDays,
  CalendarCheck,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useOrg } from "@/hooks/useOrg";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { canAccess } from "@/lib/permissions";
import { moduleForPath } from "@/lib/entitlements";
import { useSubscription } from "@/hooks/useSubscription";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Logo } from "@/components/brand/Logo";

type Item = { to: string; icon: LucideIcon; label: string; exact?: boolean; badge?: string };
type Group = { label: string; icon: LucideIcon; items: Item[] };

export function AppSidebar() {
  const { t } = useTranslation();
  const { state, isMobile, setOpenMobile } = useSidebar();
  const navigate = useNavigate();
  const { org, organizations, selectOrganization } = useOrg();
  const { me } = useAuth();
  const { role } = useRole();
  const { hasModule } = useSubscription();
  const perfModel = org?.performance_model ?? "classic";
  const collapsed = state === "collapsed";

  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };
  // `GET /me` says whether the user may open the platform back office.
  const isPlatformAdmin = me?.isPlatformAdmin === true;
  const path = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (p: string, exact?: boolean) =>
    exact || p === "/app" ? path === p : path === p || path.startsWith(p + "/");

  const performanceItems: Item[] =
    perfModel === "sap"
      ? [
          { to: "/app/performance/goals", icon: Target, label: t("nav.goals") },
          { to: "/app/performance/reviews", icon: ClipboardCheck, label: t("nav.reviews") },
          { to: "/app/performance/feedback", icon: MessageSquare, label: t("nav.feedback") },
        ]
      : [
          { to: "/app/performance/okrs", icon: Target, label: t("nav.okrs"), badge: "OKR" },
          { to: "/app/performance/reviews", icon: ClipboardCheck, label: t("nav.reviews") },
          { to: "/app/performance/feedback", icon: MessageSquare, label: t("nav.feedback") },
        ];

  const allGroups: Group[] = [
    {
      label: t("nav.hrm"),
      icon: Users2,
      items: [
        { to: "/app/employees", icon: Users, label: t("nav.employees"), exact: true },
        { to: "/app/departments", icon: Building2, label: t("nav.departments") },
        { to: "/app/contracts", icon: FileText, label: t("nav.contracts") },
      ],
    },
    {
      label: t("nav.recruitment"),
      icon: Briefcase,
      items: [
        { to: "/app/recruitment/jobs", icon: Briefcase, label: t("nav.jobs") },
        { to: "/app/recruitment/candidates", icon: UserPlus, label: t("nav.candidates") },
        { to: "/app/recruitment/scoring", icon: Bot, label: t("nav.scoring") },
      ],
    },
    {
      label: t("nav.performance"),
      icon: TrendingUp,
      items: performanceItems,
    },
    {
      label: t("nav.timeclock"),
      icon: Timer,
      items: [
        { to: "/app/timeclock/logs", icon: Clock, label: t("nav.logs") },
        { to: "/app/timeclock/zones", icon: MapPin, label: t("nav.zones") },
      ],
    },

    {
      label: t("nav.leaves"),
      icon: CalendarDays,
      items: [
        { to: "/app/leaves", icon: CalendarCheck, label: t("nav.leaveRequests"), exact: true },
        { to: "/app/leaves/holidays", icon: CalendarDays, label: t("nav.holidays") },
      ],
    },

    {
      label: t("nav.talents"),
      icon: Star,
      items: [
        { to: "/app/talents/skills", icon: Sparkles, label: t("nav.skills") },
        { to: "/app/talents/9box", icon: Grid3x3, label: t("nav.nineBox") },
        { to: "/app/talents/succession", icon: Crown, label: t("nav.succession") },
      ],
    },
    {
      label: t("common.settings"),
      icon: SlidersHorizontal,
      items: [
        { to: "/app/settings", icon: Settings, label: t("sidebar.generalSettings"), exact: true },
        { to: "/app/settings/members", icon: Users, label: t("sidebar.members") },
        { to: "/app/billing", icon: CreditCard, label: t("sidebar.subscription"), exact: true },
        { to: "/app/settings/integrations", icon: Share2, label: t("sidebar.socialNetworks") },
      ],
    },
  ];

  // Filtrage par rôle ET par modules inclus dans l'offre.
  const allowed = (to: string) => {
    const mod = moduleForPath(to);
    return !mod || hasModule(mod);
  };
  const groups: Group[] = isPlatformAdmin
    ? allGroups
    : allGroups
        .map((g) => ({
          ...g,
          items: g.items.filter((it) => canAccess(it.to, role) && allowed(it.to)),
        }))
        .filter((g) => g.items.length > 0);

  const activeGroupLabel =
    groups.find((g) => g.items.some((it) => isActive(it.to, it.exact)))?.label ?? null;
  const [openGroup, setOpenGroup] = useState<string | null>(activeGroupLabel);
  const [popoverGroup, setPopoverGroup] = useState<string | null>(null);
  useEffect(() => {
    if (activeGroupLabel && activeGroupLabel !== openGroup) {
      setOpenGroup(activeGroupLabel);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGroupLabel]);

  const idPrefix = useId();
  const triggerRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const focusTrigger = (idx: number) => {
    const len = groups.length;
    const next = ((idx % len) + len) % len;
    triggerRefs.current[next]?.focus();
  };

  const focusSubItem = (groupIdx: number, itemIdx: number) => {
    const group = groups[groupIdx];
    if (!group) return;
    const len = group.items.length;
    const next = ((itemIdx % len) + len) % len;
    const el = document.querySelector<HTMLElement>(`[data-sidebar-subitem="${groupIdx}-${next}"]`);
    el?.focus();
  };

  const onTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>, idx: number, label: string) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        focusTrigger(idx + 1);
        break;
      case "ArrowUp":
        e.preventDefault();
        focusTrigger(idx - 1);
        break;
      case "Home":
        e.preventDefault();
        focusTrigger(0);
        break;
      case "End":
        e.preventDefault();
        focusTrigger(groups.length - 1);
        break;
      case "ArrowRight":
        e.preventDefault();
        if (openGroup !== label) {
          setOpenGroup(label);
          // wait for content to mount before focusing
          setTimeout(() => focusSubItem(idx, 0), 0);
        } else {
          focusSubItem(idx, 0);
        }
        break;
      case "ArrowLeft":
        if (openGroup === label) {
          e.preventDefault();
          setOpenGroup(null);
        }
        break;
    }
  };

  const onSubItemKeyDown = (
    e: KeyboardEvent<HTMLAnchorElement>,
    groupIdx: number,
    itemIdx: number,
  ) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        focusSubItem(groupIdx, itemIdx + 1);
        break;
      case "ArrowUp":
        e.preventDefault();
        focusSubItem(groupIdx, itemIdx - 1);
        break;
      case "ArrowLeft":
        e.preventDefault();
        setOpenGroup(null);
        triggerRefs.current[groupIdx]?.focus();
        break;
      case "Home":
        e.preventDefault();
        focusSubItem(groupIdx, 0);
        break;
      case "End":
        e.preventDefault();
        focusSubItem(groupIdx, groups[groupIdx].items.length - 1);
        break;
    }
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-1.5 focus:text-primary-foreground focus:shadow"
        >
          {t("sidebar.skipToContent")}
        </a>
        <div
          className={
            collapsed
              ? "flex items-center justify-center overflow-hidden px-0 py-1.5"
              : "flex items-center gap-2 overflow-hidden px-2 py-1.5"
          }
        >
          <Link
            to="/app"
            onClick={handleNavClick}
            title={org?.name ?? undefined}
            aria-label={org?.name ?? t("sidebar.orgFallback")}
            className="shrink-0"
          >
            {org?.logo_url ? (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                <img src={org.logo_url} alt={org.name} className="h-full w-full object-contain" />
              </div>
            ) : (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg gradient-primary text-primary-foreground font-semibold">
                {(org?.name?.[0] ?? "K").toUpperCase()}
              </div>
            )}
          </Link>
          {!collapsed && (
            <Logo variant="full" onClick={handleNavClick} className="min-w-0 [&_img]:h-[22px]" />
          )}
        </div>
        {!collapsed && organizations.length > 1 && org && (
          <Select
            value={org.id}
            onValueChange={(id) => {
              void selectOrganization(id).then(() => navigate({ to: "/app" }));
            }}
          >
            <SelectTrigger aria-label={t("sidebar.switchOrganization")} className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {organizations.map((organization) => (
                <SelectItem key={organization.id} value={organization.id}>
                  {organization.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </SidebarHeader>
      <SidebarContent>
        {/* Main */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/app")} tooltip={t("nav.dashboard")}>
                  <Link to="/app" onClick={handleNavClick} className="flex items-center gap-2">
                    <LayoutDashboard className="h-4 w-4 shrink-0" />
                    {!collapsed && <span>{t("nav.dashboard")}</span>}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Dev-only: doc Flutter timeclock */}
        {import.meta.env.DEV && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Doc Flutter (dev)">
                    <a
                      href="/api/public/docs/flutter-timeclock"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={handleNavClick}
                      className="flex items-center gap-2"
                    >
                      <FileCode2 className="h-4 w-4 shrink-0" />
                      {!collapsed && (
                        <>
                          <span className="flex-1 text-left">Doc Flutter</span>
                          <Badge
                            variant="secondary"
                            className="ml-auto px-1.5 py-0 text-[10px] font-semibold"
                          >
                            DEV
                          </Badge>
                        </>
                      )}
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Modules as collapsible dropdowns */}
        {groups.map((g, gIdx) => {
          const groupActive = g.items.some((it) => isActive(it.to, it.exact));
          const contentId = `${idPrefix}-group-${gIdx}`;
          const triggerId = `${idPrefix}-trigger-${gIdx}`;

          if (collapsed) {
            return (
              <SidebarGroup key={g.label}>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <Popover
                        open={popoverGroup === g.label}
                        onOpenChange={(o) => setPopoverGroup(o ? g.label : null)}
                      >
                        <PopoverTrigger asChild>
                          <SidebarMenuButton
                            id={triggerId}
                            aria-label={g.label}
                            className={groupActive ? "text-primary" : ""}
                          >
                            <g.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                          </SidebarMenuButton>
                        </PopoverTrigger>
                        <PopoverContent
                          side="right"
                          align="start"
                          sideOffset={8}
                          className="w-56 p-1"
                        >
                          <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                            {g.label}
                          </p>
                          <nav aria-label={g.label} className="flex flex-col">
                            {g.items.map((it) => {
                              const active = isActive(it.to, it.exact);
                              return (
                                <Link
                                  key={it.to}
                                  to={it.to}
                                  aria-current={active ? "page" : undefined}
                                  onClick={() => {
                                    setPopoverGroup(null);
                                    handleNavClick();
                                  }}
                                  className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground ${
                                    active ? "bg-accent text-primary" : "text-foreground"
                                  }`}
                                >
                                  <it.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                                  <span className="flex-1 truncate">{it.label}</span>
                                  {it.badge && (
                                    <Badge
                                      variant="secondary"
                                      className="px-1.5 py-0 text-[10px] font-semibold"
                                    >
                                      {it.badge}
                                    </Badge>
                                  )}
                                </Link>
                              );
                            })}
                          </nav>
                        </PopoverContent>
                      </Popover>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            );
          }

          return (
            <SidebarGroup key={g.label}>
              <SidebarGroupContent>
                <SidebarMenu>
                  <Collapsible
                    open={openGroup === g.label}
                    onOpenChange={(o) => setOpenGroup(o ? g.label : null)}
                    className="group/collapsible"
                  >
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton
                          ref={(el) => {
                            triggerRefs.current[gIdx] = el as HTMLButtonElement | null;
                          }}
                          id={triggerId}
                          aria-controls={contentId}
                          tooltip={g.label}
                          className={groupActive ? "text-primary" : ""}
                          onKeyDown={(e) => onTriggerKeyDown(e, gIdx, g.label)}
                        >
                          <g.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                          <span className="flex-1 text-left">{g.label}</span>
                          <ChevronDown
                            className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180"
                            aria-hidden="true"
                          />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent id={contentId} aria-labelledby={triggerId}>
                        <SidebarMenuSub role="group" aria-label={g.label}>
                          {g.items.map((it, iIdx) => {
                            const active = isActive(it.to, it.exact);
                            return (
                              <SidebarMenuSubItem key={it.to}>
                                <SidebarMenuSubButton asChild isActive={active}>
                                  <Link
                                    to={it.to}
                                    data-sidebar-subitem={`${gIdx}-${iIdx}`}
                                    aria-current={active ? "page" : undefined}
                                    onClick={handleNavClick}
                                    onKeyDown={(e) => onSubItemKeyDown(e, gIdx, iIdx)}
                                    className="flex items-center gap-2"
                                  >
                                    <span className={active ? "text-primary" : ""}>{it.label}</span>
                                    {it.badge && (
                                      <Badge
                                        variant="secondary"
                                        className="ml-auto px-1.5 py-0 text-[10px] font-semibold"
                                      >
                                        {it.badge}
                                      </Badge>
                                    )}
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            );
                          })}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
    </Sidebar>
  );
}
