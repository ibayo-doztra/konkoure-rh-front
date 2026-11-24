import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { pendingQuery } from "@/lib/api/pending";
import { useOrg } from "@/hooks/useOrg";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/PageHeader";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_authenticated/app/talents/9box")({
  component: NineBoxPage,
});

const LABEL_KEYS = [
  ["riskTalent", "performer", "star"],
  ["inconsistent", "solidContributor", "highPotential"],
  ["underperformer", "toDevelop", "roughDiamond"],
];

function NineBoxPage() {
  const { t } = useTranslation();
  const { org } = useOrg();
  const [reviews, setReviews] = useState<any[]>([]);

  useEffect(() => {
    if (!org) return;
    void pendingQuery("GET /org/performance/reviews");
  }, [org]);

  const cell = (perf: number, pot: number) => {
    return reviews.filter((r) => {
      const p = r.performance_score ?? 0;
      const o = r.potential_score ?? 0;
      return Math.min(2, Math.floor(p / 4)) === perf && Math.min(2, Math.floor(o / 4)) === pot;
    });
  };

  return (
    <div>
      <PageHeader
        title={t("talents.nineBox.title")}
        description={t("talents.nineBox.description")}
      />
      <div
        className="grid grid-cols-3 gap-3"
        style={{ gridTemplateRows: "repeat(3, minmax(140px, 1fr))" }}
      >
        {[2, 1, 0].map((row) =>
          LABEL_KEYS[row].map((labelKey, col) => (
            <Card key={`${row}-${col}`} className="bg-card/50">
              <CardContent className="p-3">
                <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                  {t(`talents.nineBox.labels.${labelKey}`)}
                </p>
                <div className="space-y-1">
                  {cell(col, row).map((r) => (
                    <div key={r.id} className="rounded-md border bg-card p-2 text-xs">
                      {r.employees?.first_name} {r.employees?.last_name}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )),
        )}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">{t("talents.nineBox.footer")}</p>
    </div>
  );
}
