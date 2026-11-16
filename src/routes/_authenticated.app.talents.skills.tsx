import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { pendingQuery } from "@/lib/api/pending";
import { useOrg } from "@/hooks/useOrg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_authenticated/app/talents/skills")({
  component: SkillsPage,
});

function SkillsPage() {
  const { t } = useTranslation();
  const { org } = useOrg();
  const [items, setItems] = useState<any[]>([]);
  const [name, setName] = useState("");
  const load = async () => {
    if (!org) return;
    const { data } = await pendingQuery("GET /org/skills");
    setItems(data ?? []);
  };
  useEffect(() => { void load(); }, [org]);
  const add = async () => {
    if (!org || !name.trim()) return;
    const { error } = await pendingQuery("POST /org/skills");
    if (error) return toast.error(error.message);
    setName(""); void load();
  };
  return (
    <div>
      <PageHeader title={t("talents.skills.title")} description={t("talents.skills.description")} />
      <div className="mb-4 flex gap-2">
        <Input placeholder={t("talents.skills.newSkillPlaceholder")} value={name} onChange={(e) => setName(e.target.value)} />
        <Button onClick={add}><Plus className="mr-2 h-4 w-4"/>{t("talents.skills.add")}</Button>
      </div>
      <Card><CardContent className="flex flex-wrap gap-2 p-4">
        {items.map((s) => <Badge key={s.id} variant="secondary">{s.name}</Badge>)}
        {items.length === 0 && <p className="text-sm text-muted-foreground">{t("talents.skills.empty")}</p>}
      </CardContent></Card>
    </div>
  );
}
