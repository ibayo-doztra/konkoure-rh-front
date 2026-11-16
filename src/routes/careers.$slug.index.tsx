import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { pendingQuery } from "@/lib/api/pending";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, ArrowRight } from "lucide-react";
import { hasApplied, pruneExpired } from "@/lib/applied-jobs";
import { getPublicOrganization } from "@/lib/api/legacy-functions";
import i18n from "@/lib/i18n";

export const Route = createFileRoute("/careers/$slug/")({
  head: ({ params }) => {
    const url = `https://konkoure.lovable.app/careers/${params.slug}`;
    const title = i18n.t("careers.listMetaTitle", { slug: params.slug });
    const desc = i18n.t("careers.listMetaDesc", { slug: params.slug });
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:url", content: url },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: CareersPage,
});

function contractLabel(t: (k: string) => string, value?: string | null) {
  if (!value) return "";
  if (value === "stage") return t("careers.contractStage");
  if (value === "cdd") return t("careers.contractCdd");
  if (value === "cdi") return t("careers.contractCdi");
  return value;
}

function CareersPage() {
  const { t, i18n: i18nInst } = useTranslation();
  const { slug } = Route.useParams();
  const [org, setOrg] = useState<any>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [appliedMap, setAppliedMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    pruneExpired();
    void (async () => {
      const o = await getPublicOrganization({ data: { slug } });
      setOrg(o);
      if (o) {
        const { data: j } = await pendingQuery("GET /org/recruitment/jobs");
        const list = j ?? [];
        setJobs(list);
        const map: Record<string, boolean> = {};
        for (const item of list) map[item.id] = hasApplied(item.id, item.deadline);
        setAppliedMap(map);
      }
    })();
  }, [slug]);

  if (!org) return <div className="p-8 text-center text-muted-foreground">{t("careers.orgNotFound")}</div>;

  const locale = (i18nInst.resolvedLanguage || "fr").slice(0, 2) === "en" ? "en-US" : "fr-FR";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-4xl items-center gap-4 px-6 py-12">
          {org.logo_url ? (
            <img src={org.logo_url} alt={t("careers.logoAlt", { name: org.name })} className="h-16 w-16 rounded-md border object-contain bg-white" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-md border bg-muted text-xl font-semibold text-muted-foreground">
              {org.name?.charAt(0)?.toUpperCase() ?? "?"}
            </div>
          )}
          <div>
            <h1 className="text-4xl font-bold">{t("careers.heroTitle", { name: org.name })}</h1>
            <p className="mt-2 text-muted-foreground">{t("careers.heroSub")}</p>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl space-y-3 px-6 py-12">
        {jobs.map((j) => {
          const deadline = j.deadline ? new Date(j.deadline) : null;
          const expired = deadline ? deadline < new Date() : false;
          const applied = !!appliedMap[j.id];
          const inner = (
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="font-semibold">{j.title}</h3>
                  <p className="text-sm text-muted-foreground">{j.location || t("careers.remote")}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    {j.contract_type && (
                      <Badge variant="outline">{contractLabel(t, j.contract_type)}</Badge>
                    )}
                    {deadline && (
                      <span className={`inline-flex items-center gap-1 ${expired ? "text-destructive" : "text-muted-foreground"}`}>
                        <CalendarClock className="h-3 w-3"/>
                        {expired ? t("careers.closed") : t("careers.untilDate", { date: deadline.toLocaleDateString(locale) })}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {expired ? (
                    <Badge variant="secondary">{t("careers.badgeClosed")}</Badge>
                  ) : applied ? (
                    <Badge variant="secondary">{t("careers.badgeApplied")}</Badge>
                  ) : (
                    <Badge>{t("careers.badgeApply")}<ArrowRight className="ml-1 h-3 w-3"/></Badge>
                  )}
                </div>
              </div>
              {j.description && <p className="mt-3 line-clamp-2 text-sm whitespace-pre-line">{j.description}</p>}
            </CardContent>
          );
          return j.slug && !expired && !applied ? (
            <Link key={j.id} to="/careers/$slug/$jobSlug" params={{ slug, jobSlug: j.slug }} className="block transition-opacity hover:opacity-80">
              <Card>{inner}</Card>
            </Link>
          ) : (
            <Card key={j.id} className={expired || applied ? "opacity-70" : ""}>{inner}</Card>
          );
        })}
        {jobs.length === 0 && <p className="text-center text-muted-foreground">{t("careers.noJobs")}</p>}
      </main>
    </div>
  );
}
