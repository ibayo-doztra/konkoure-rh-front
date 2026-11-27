import { Fragment } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

const SEG_TO_KEY: Record<string, string> = {
  app: "app",
  employees: "employees",
  departments: "departments",
  contracts: "contracts",
  recruitment: "recruitment",
  jobs: "jobs",
  candidates: "candidates",
  performance: "performance",
  okrs: "okrs",
  feedback: "feedback",
  reviews: "reviews",
  goals: "goals",
  activities: "activities",
  achievements: "achievements",
  timeclock: "timeclock",
  zones: "zones",
  schedules: "schedules",
  leaves: "leaves",
  holidays: "holidays",
  calendar: "calendar",
  kiosks: "kiosks",
  badges: "badges",
  today: "today",
  logs: "logs",
  talents: "talents",
  skills: "skills",
  "9box": "nineBox",
  succession: "succession",
  settings: "settings",
  integrations: "integrations",
  scoring: "scoring",
  members: "members",
  account: "account",
  new: "new",
  edit: "edit",
};

const DYNAMIC_PARENT_KEY: Record<string, string> = {
  employees: "profile",
};

// Sidebar group segments without a dedicated page — skip in breadcrumbs
const SKIP_SEGMENTS = new Set(["recruitment", "performance", "timeclock", "talents"]);

function isDynamicSegment(seg: string) {
  return (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(seg) || /^\d+$/.test(seg)
  );
}

export function AppBreadcrumbs() {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0 || segments[0] !== "app") return null;

  const crumbs: { label: string; href: string }[] = [];
  let acc = "";
  segments.forEach((seg, i) => {
    acc += "/" + seg;
    if (SKIP_SEGMENTS.has(seg)) return;
    let label: string;
    if (isDynamicSegment(seg)) {
      const parent = segments[i - 1];
      const k = parent ? DYNAMIC_PARENT_KEY[parent] : undefined;
      label = k ? t(`breadcrumbs.${k}`) : t("breadcrumbs.details");
    } else {
      const k = SEG_TO_KEY[seg];
      label = k ? t(`breadcrumbs.${k}`) : seg.charAt(0).toUpperCase() + seg.slice(1);
    }
    crumbs.push({ label, href: acc });
  });

  if (crumbs.length <= 1) return null;

  return (
    <nav className="sticky top-16 z-20 border-b bg-background px-6 py-4">
      <Breadcrumb>
        <BreadcrumbList>
          {crumbs.map((c, i) => {
            const isLast = i === crumbs.length - 1;
            return (
              <Fragment key={c.href}>
                <BreadcrumbItem>
                  {isLast ? (
                    <BreadcrumbPage className="font-semibold text-foreground">
                      {c.label}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link
                        to={c.href as never}
                        className="font-medium text-primary hover:underline"
                      >
                        {c.label}
                      </Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {!isLast && (
                  <BreadcrumbSeparator>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </BreadcrumbSeparator>
                )}
              </Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
    </nav>
  );
}
