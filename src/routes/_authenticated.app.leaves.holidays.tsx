import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Download, Plus, Trash2 } from "lucide-react";
import { apiErrorMessage } from "@/lib/api/client";
import {
  createHoliday,
  deleteHoliday,
  holidaysQuery,
  importHolidays,
  leavesKey,
  type Holiday,
} from "@/lib/api/leaves";
import { isFutureMovableHoliday } from "@/lib/holidays";
import { PageHeader } from "@/components/PageHeader";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ResponsiveTable } from "@/components/ResponsiveTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFormGrid,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOrg } from "@/hooks/useOrg";

export const Route = createFileRoute("/_authenticated/app/leaves/holidays")({
  component: HolidaysPage,
});

/** Owner and hr_admin only (src/lib/permissions.ts); the API enforces it. */
function HolidaysPage() {
  const { t } = useTranslation();
  const { org } = useOrg();
  const queryClient = useQueryClient();
  const organizationId = org?.id ?? "";
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [isMovable, setIsMovable] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [toDelete, setToDelete] = useState<Holiday | null>(null);

  const holidays = useQuery({ ...holidaysQuery(organizationId, year), enabled: !!org });
  const rows = [...(holidays.data ?? [])].sort((a, b) => a.date.localeCompare(b.date));

  const refresh = () => queryClient.invalidateQueries({ queryKey: leavesKey(organizationId) });
  const onError = (error: unknown) =>
    toast.error(t("leaves.holidaysPage.genericError"), { description: apiErrorMessage(error) });

  const create = useMutation({
    mutationFn: () => createHoliday({ name: name.trim(), date, isMovable, isRecurring }),
    onSuccess: (holiday) => {
      toast.success(t("leaves.holidaysPage.added"));
      setName("");
      setDate("");
      setIsMovable(false);
      setIsRecurring(false);
      setOpen(false);
      setYear(Number(holiday.date.slice(0, 4)));
      void refresh();
    },
    onError,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteHoliday(id),
    onSuccess: () => {
      toast.success(t("leaves.holidaysPage.deleted"));
      setToDelete(null);
      void refresh();
    },
    onError,
  });

  const runImport = useMutation({
    mutationFn: () => importHolidays(year),
    onSuccess: () => {
      toast.success(t("leaves.holidaysPage.imported", { year }));
      void refresh();
    },
    onError,
  });

  const nameValid = name.trim().length >= 2 && name.trim().length <= 120;

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("leaves.holidaysPage.title")}
        description={t("leaves.holidaysPage.description", { year })}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => runImport.mutate()}
              disabled={runImport.isPending}
            >
              <Download className="mr-1 h-4 w-4" /> {t("leaves.holidaysPage.import")}
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-1 h-4 w-4" /> {t("leaves.holidaysPage.add")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("leaves.holidaysPage.newHoliday")}</DialogTitle>
                </DialogHeader>
                <DialogBody>
                  <DialogFormGrid>
                    <div>
                      <Label htmlFor="holiday-name">{t("leaves.holidaysPage.name")}</Label>
                      <Input
                        id="holiday-name"
                        value={name}
                        maxLength={120}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={t("leaves.holidaysPage.namePlaceholder")}
                      />
                    </div>
                    <div>
                      <Label htmlFor="holiday-date">{t("leaves.holidaysPage.date")}</Label>
                      <Input
                        id="holiday-date"
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                      />
                    </div>
                  </DialogFormGrid>
                  <div className="mt-4 space-y-2 text-sm">
                    <label className="flex items-center gap-2">
                      <Checkbox
                        checked={isMovable}
                        onCheckedChange={(v) => setIsMovable(v === true)}
                      />
                      {t("leaves.holidaysPage.movable")}
                    </label>
                    <label className="flex items-center gap-2">
                      <Checkbox
                        checked={isRecurring}
                        onCheckedChange={(v) => setIsRecurring(v === true)}
                      />
                      {t("leaves.holidaysPage.recurring")}
                    </label>
                  </div>
                  <Button
                    onClick={() => create.mutate()}
                    disabled={!nameValid || !date || create.isPending}
                    className="mt-6 w-full"
                  >
                    {t("leaves.holidaysPage.save")}
                  </Button>
                </DialogBody>
              </DialogContent>
            </Dialog>
          </div>
        }
      />
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base font-medium">
            {t("leaves.holidaysPage.calendar", { year })}
          </CardTitle>
          <div className="flex gap-1">
            <Button
              size="icon"
              variant="outline"
              onClick={() => setYear(year - 1)}
              aria-label={t("leaves.holidaysPage.previousYear")}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              onClick={() => setYear(year + 1)}
              aria-label={t("leaves.holidaysPage.nextYear")}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          <div className="max-h-[calc(100vh-16rem)] overflow-y-auto">
            <ResponsiveTable
              data={rows}
              getRowKey={(h) => h.id}
              empty={t("leaves.holidaysPage.empty")}
              columns={[
                {
                  key: "date",
                  header: t("leaves.holidaysPage.colDate"),
                  className: "tabular-nums whitespace-nowrap",
                  cell: (h) => (
                    <span className="whitespace-nowrap tabular-nums">
                      {format(new Date(h.date), "dd/MM/yyyy")}
                    </span>
                  ),
                },
                {
                  key: "name",
                  header: t("leaves.holidaysPage.colName"),
                  priority: "primary",
                  cell: (h) => (
                    <div className="flex flex-wrap items-center gap-2">
                      <span>{h.name}</span>
                      {isFutureMovableHoliday(h) && (
                        <Badge variant="success">{t("leaves.holidaysPage.toConfirm")}</Badge>
                      )}
                      {h.isRecurring && (
                        <Badge variant="outline">{t("leaves.holidaysPage.recurringBadge")}</Badge>
                      )}
                    </div>
                  ),
                },
                {
                  key: "actions",
                  header: "",
                  priority: "actions",
                  align: "right",
                  cell: (h) => (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setToDelete(h)}
                      title={t("leaves.holidaysPage.delete")}
                      aria-label={t("leaves.holidaysPage.delete")}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  ),
                },
              ]}
            />
          </div>
        </CardContent>
      </Card>
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={t("leaves.holidaysPage.deleteTitle")}
        subtitle={
          toDelete ? `${toDelete.name} — ${format(new Date(toDelete.date), "dd/MM/yyyy")}` : ""
        }
        actionLabel={t("leaves.holidaysPage.delete")}
        actionVariant="destructive"
        loading={remove.isPending}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
      />
    </div>
  );
}
