import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight, CalendarClock } from "lucide-react";
import { fetchCareersPage } from "@/lib/api/recruitment";
import { contractTypeLabel } from "@/lib/contract-types";
import { appliedKey, hasApplied, pruneExpired } from "@/lib/applied-jobs";
import i18n from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/careers/$slug/")({
  // Public page, rendered on the server for search engines (06 §11).
  loader: ({ params }) => fetchCareersPage(params.slug),
  head: ({ params, loaderData }) => {
    const url = `https://konkoure.lovable.app/careers/${params.slug}`;
    const name = loaderData?.organization.name ?? params.slug;
    const title = i18n.t("careers.listMetaTitle", { slug: name });
    const desc = i18n.t("careers.listMetaDesc", { slug: name });
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

function CareersPage() {
  const { t, i18n: i18nInst } = useTranslation();
  const { slug } = Route.useParams();
  const page = Route.useLoaderData();
  const [appliedMap, setAppliedMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    pruneExpired();
    const map: Record<string, boolean> = {};
    for (const job of page?.jobs ?? []) {
      map[job.slug] = hasApplied(appliedKey(slug, job.slug), job.deadline);
    }
    setAppliedMap(map);
  }, [page, slug]);

  if (!page) {
    return <div className="p-8 text-center text-muted-foreground">{t("careers.orgNotFound")}</div>;
  }
  const { organization: org, jobs } = page;
  const locale = (i18nInst.resolvedLanguage || "fr").slice(0, 2) === "en" ? "en-US" : "fr-FR";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-4xl items-center gap-4 px-4 py-12 sm:px-6">
          {org.logoUrl ? (
            <img
              src={org.logoUrl}
              alt={t("careers.logoAlt", { name: org.name })}
              className="h-16 w-16 rounded-md border bg-white object-contain"
            />
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border bg-muted text-xl font-semibold text-muted-foreground">
              {org.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-3xl font-bold sm:text-4xl">
              {t("careers.heroTitle", { name: org.name })}
            </h1>
            <p className="mt-2 text-muted-foreground">{t("careers.heroSub")}</p>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl space-y-3 px-4 py-12 sm:px-6">
        {jobs.map((j) => {
          // The API lists only offers whose deadline has not passed.
          const deadline = j.deadline ? new Date(j.deadline) : null;
          const applied = !!appliedMap[j.slug];
          const inner = (
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="font-semibold">{j.title}</h2>
                  <p className="text-sm text-muted-foreground">
                    {[j.department, j.location || t("careers.remote")].filter(Boolean).join(" · ")}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <Badge variant="outline">{contractTypeLabel(j.contractType)}</Badge>
                    {deadline && (
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <CalendarClock className="h-3 w-3" />
                        {t("careers.untilDate", { date: deadline.toLocaleDateString(locale) })}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {applied ? (
                    <Badge variant="secondary">{t("careers.badgeApplied")}</Badge>
                  ) : (
                    <Badge>
                      {t("careers.badgeApply")}
                      <ArrowRight className="ml-1 h-3 w-3" />
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          );
          return applied ? (
            <Card key={j.slug} className="opacity-70">
              {inner}
            </Card>
          ) : (
            <Link
              key={j.slug}
              to="/careers/$slug/$jobSlug"
              params={{ slug, jobSlug: j.slug }}
              className="block transition-opacity hover:opacity-80"
            >
              <Card>{inner}</Card>
            </Link>
          );
        })}
        {jobs.length === 0 && (
          <p className="text-center text-muted-foreground">{t("careers.noJobs")}</p>
        )}
      </main>
    </div>
  );
}
