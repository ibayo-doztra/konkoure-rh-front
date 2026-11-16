import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { pendingQuery } from "@/lib/api/pending";
import { useOrg } from "@/hooks/useOrg";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/PageHeader";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_authenticated/app/talents/succession")({
  component: SuccessionPage,
});

function SuccessionPage() {
  const { t } = useTranslation();
  const { org } = useOrg();
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    if (!org) return;
    void pendingQuery("GET /org/talents/succession");
  }, [org]);
  return (
    <div>
      <PageHeader title={t("talents.succession.title")} />
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((s) => (
          <Card key={s.id}><CardContent className="p-4">
            <p className="font-semibold">{s.position_title}</p>
            <p className="text-sm text-muted-foreground">{t("talents.succession.successorIdentified")} — {s.readiness ?? "—"}</p>
          </CardContent></Card>
        ))}
        {items.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">{t("talents.succession.empty")}</p>}
      </div>
    </div>
  );
}
