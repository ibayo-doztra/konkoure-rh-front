import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveTable } from "@/components/ResponsiveTable";
import {
  Dialog, DialogBody, DialogContent, DialogFormGrid, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useOrg } from "@/hooks/useOrg";
import { listHolidays, upsertHoliday, deleteHoliday } from "@/lib/api/legacy-functions";
import { isFutureMovableHoliday } from "@/lib/holidays";

export const Route = createFileRoute("/_authenticated/app/leaves/holidays")({
  component: HolidaysPage,
});

function HolidaysPage() {
  const { t } = useTranslation();
  const { org } = useOrg();
  const qc = useQueryClient();
  const listFn = listHolidays;
  const upsertFn = upsertHoliday;
  const delFn = deleteHoliday;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");

  const year = new Date().getFullYear();
  const { data: rows = [] } = useQuery({
    queryKey: ["holidays", org?.id, year],
    queryFn: () => listFn({ data: { organizationId: org!.id, year } }),
    enabled: !!org,
  });

  const submit = async () => {
    if (!org || !name || !date) return;
    try {
      await upsertFn({ data: { organizationId: org.id, name, date } });
      toast.success(t("leaves.holidaysPage.added"));
      setName(""); setDate(""); setOpen(false);
      await qc.invalidateQueries({ queryKey: ["holidays"] });
    } catch (e: any) {
      toast.error(e?.message ?? t("leaves.holidaysPage.genericError"));
    }
  };

  const remove = async (id: string) => {
    try {
      await delFn({ data: { id } });
      await qc.invalidateQueries({ queryKey: ["holidays"] });
    } catch (e: any) {
      toast.error(e?.message ?? t("leaves.holidaysPage.genericError"));
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("leaves.holidaysPage.title")}
        description={t("leaves.holidaysPage.description", { year })}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="mr-1 h-4 w-4" /> {t("leaves.holidaysPage.add")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t("leaves.holidaysPage.newHoliday")}</DialogTitle></DialogHeader>
              <DialogBody>
                <DialogFormGrid>
                  <div>
                    <Label>{t("leaves.holidaysPage.name")}</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("leaves.holidaysPage.namePlaceholder")} />
                  </div>
                  <div>
                    <Label>{t("leaves.holidaysPage.date")}</Label>
                    <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                  </div>
                </DialogFormGrid>
                <Button onClick={submit} className="mt-6 w-full">{t("leaves.holidaysPage.save")}</Button>
              </DialogBody>
            </DialogContent>
          </Dialog>
        }
      />
      <Card>
        <CardHeader><CardTitle className="text-base font-medium">{t("leaves.holidaysPage.calendar", { year })}</CardTitle></CardHeader>
        <CardContent className="px-0 sm:px-6">
          <div className="max-h-[calc(100vh-16rem)] overflow-y-auto">
            <ResponsiveTable
              data={rows as any[]}
              getRowKey={(h: any) => h.id}
              empty={t("leaves.holidaysPage.empty")}
              columns={[
                {
                  key: "date",
                  header: t("leaves.holidaysPage.colDate"),
                  className: "tabular-nums whitespace-nowrap",
                  cell: (h: any) => (
                    <span className="whitespace-nowrap tabular-nums">
                      {format(new Date(h.date), "dd/MM/yyyy")}
                    </span>
                  ),
                },
                {
                  key: "name",
                  header: t("leaves.holidaysPage.colName"),
                  priority: "primary",
                  cell: (h: any) => (
                    <div className="flex flex-wrap items-center gap-2">
                      <span>{h.name}</span>
                      {isFutureMovableHoliday(h) && <Badge variant="success">{t("leaves.holidaysPage.toConfirm")}</Badge>}
                    </div>
                  ),
                },
                {
                  key: "actions",
                  header: "",
                  priority: "actions",
                  align: "right",
                  cell: (h: any) => (
                    <Button size="icon" variant="ghost" onClick={() => remove(h.id)} title={t("leaves.holidaysPage.delete")}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  ),
                },
              ]}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
