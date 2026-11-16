import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { pendingQuery } from "@/lib/api/pending";
import { useOrg } from "@/hooks/useOrg";
import { useRole } from "@/hooks/useRole";
import { useMyEmployee } from "@/hooks/useMyEmployee";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/PageHeader";
import { formatCurrency } from "@/lib/currency";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  FileText,
  Plus,
  Trash2,
  Pencil,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { ActionMenu } from "@/components/ActionMenu";
import { ResponsiveTable } from "@/components/ResponsiveTable";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_authenticated/app/contracts")({
  component: ContractsPage,
});

// ----------------- Helpers droit du travail Guinée -----------------
type Category = "execution" | "maitrise" | "cadre";

function getEmployeeCategory(position?: string | null): Category {
  const p = (position ?? "").toLowerCase();
  if (/cadre|manager|director|directeur|chef de département|head|lead/.test(p)) return "cadre";
  if (/chef|superviseur|technicien|maitrise|maîtrise|coordin/.test(p)) return "maitrise";
  return "execution";
}

function useCategoryLabel(t: (k: string) => string): Record<Category, string> {
  return {
    execution: t("contracts.categoryExecution"),
    maitrise: t("contracts.categoryMaitrise"),
    cadre: t("contracts.categoryCadre"),
  };
}

function getNoticeMonths(cat: Category): number {
  return cat === "cadre" ? 3 : cat === "maitrise" ? 2 : 1;
}

function monthsBetween(start: string | Date, end: string | Date): number {
  const s = new Date(start);
  const e = new Date(end);
  const months = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
  const dayDiff = (e.getDate() - s.getDate()) / 30;
  return Math.max(0, months + dayDiff);
}

function getNoticeStartDate(end: string, months: number): Date {
  const d = new Date(end);
  d.setMonth(d.getMonth() - months);
  return d;
}

function isCDDOverLimit(start: string, end?: string | null): boolean {
  if (!end) return false;
  return monthsBetween(start, end) > 24;
}

function computeIndemnity(salary: number | null | undefined, start: string, end: string): number {
  if (!salary) return 0;
  return Math.round(salary * monthsBetween(start, end) * 0.05);
}

function daysUntil(date: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

function fmtDate(d: string | Date | null | undefined, locale = "fr-FR") {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(locale);
}

const CONTRACT_TYPES = ["cdi", "cdd", "stage", "freelance", "apprenticeship", "Journalier"] as const;
type ContractType = (typeof CONTRACT_TYPES)[number];
function useContractTypeLabel(t: (k: string) => string): Record<string, string> {
  return {
    cdi: t("contracts.typeCdi"),
    cdd: t("contracts.typeCdd"),
    stage: t("contracts.typeStage"),
    freelance: t("contracts.typeFreelance"),
    apprenticeship: t("contracts.typeApprenticeship"),
    Journalier: t("contracts.typeJournalier"),
  };
}

type EmployeeRef = { id: string; first_name: string; last_name: string; position: string | null };

type ContractRow = {
  id: string;
  employee_id: string;
  type: string;
  status: string;
  start_date: string;
  end_date: string | null;
  salary: number | null;
  currency: string | null;
  trial_period_end: string | null;
  notes: string | null;
  employees: { first_name: string; last_name: string; position?: string | null } | null;
};

type DisplayStatus = "actif" | "expire" | "preavis" | "brouillon" | "termine";

function getDisplayStatus(c: ContractRow): { key: DisplayStatus; noticeStart?: Date; noticeDays?: number } {
  if (c.status === "draft") return { key: "brouillon" };
  if (c.status === "terminated") return { key: "termine" };
  if (c.end_date) {
    const end = new Date(c.end_date);
    const today = new Date();
    if (end < today) return { key: "expire" };
    const cat = getEmployeeCategory(c.employees?.position);
    const noticeStart = getNoticeStartDate(c.end_date, getNoticeMonths(cat));
    const days = daysUntil(noticeStart);
    if (days <= 0) return { key: "preavis", noticeStart, noticeDays: days };
    return { key: "actif", noticeStart, noticeDays: days };
  }
  return { key: "actif" };
}

function StatusBadge({ s }: { s: DisplayStatus }) {
  const { t } = useTranslation();
  const map: Record<DisplayStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    actif: { label: t("contracts.statusActive"), variant: "default" },
    preavis: { label: t("contracts.statusOnNotice"), variant: "destructive" },
    expire: { label: t("contracts.statusExpired"), variant: "destructive" },
    brouillon: { label: t("contracts.statusDraft"), variant: "outline" },
    termine: { label: t("contracts.statusTerminated"), variant: "secondary" },
  };
  const { label, variant } = map[s];
  return <Badge variant={variant}>{label}</Badge>;
}

// ----------------- Form types -----------------
type FormState = {
  id?: string;
  employee_id: string;
  type: ContractType;
  status: "draft" | "active" | "terminated";
  start_date: string;
  end_date: string;
  salary: string;
  trial_period_end: string;
  notes: string;
};

const emptyForm = (): FormState => ({
  employee_id: "",
  type: "cdi",
  status: "draft",
  start_date: new Date().toISOString().slice(0, 10),
  end_date: "",
  salary: "",
  trial_period_end: "",
  notes: "",
});

// ----------------- Page -----------------
function ContractsPage() {
  const { t, i18n } = useTranslation();
  const CATEGORY_LABEL = useCategoryLabel(t);
  const CONTRACT_TYPE_LABEL = useContractTypeLabel(t);
  const { org } = useOrg();
  const { isAdmin } = useRole();
  const { myEmployee, loading: employeeLoading } = useMyEmployee();
  // Seuls les RH / propriétaires gèrent les contrats.
  // Les autres rôles n'accèdent qu'à leur propre contrat, en lecture seule.
  const canManage = isAdmin;
  const [items, setItems] = useState<ContractRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeRef[]>([]);
  const [closing, setClosing] = useState<ContractRow | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ContractRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<FormState | null>(null);

  const load = useCallback(async () => {
    if (!org) return;
    if (!canManage) {
      if (employeeLoading) return;
      if (!myEmployee?.id) {
        setItems([]);
        setEmployees([]);
        return;
      }
      const { data: mine } = await pendingQuery("GET /org/contracts");
      setItems((mine as ContractRow[]) ?? []);
      setEmployees([]);
      return;
    }
    const [{ data: contracts }, { data: emps }] = await Promise.all([
      pendingQuery("GET /org/contracts"),
      pendingQuery("GET /org/employees"),
    ]);
    setItems((contracts as ContractRow[]) ?? []);
    setEmployees((emps as EmployeeRef[]) ?? []);
  }, [org, canManage, employeeLoading, myEmployee?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const nonCompliantCDD = useMemo(
    () =>
      items.filter(
        (c) =>
          c.type === "cdd" &&
          c.status !== "terminated" &&
          getDisplayStatus(c).key !== "termine" &&
          isCDDOverLimit(c.start_date, c.end_date),
      ),
    [items],
  );

  const upcomingNotices = useMemo(
    () =>
      items
        .map((c) => ({ c, d: getDisplayStatus(c) }))
        .filter(
          ({ d }) => d.noticeDays !== undefined && d.noticeDays > 0 && d.noticeDays <= 30 && d.key !== "termine",
        ),
    [items],
  );

  const inNotice = useMemo(() => items.filter((c) => getDisplayStatus(c).key === "preavis"), [items]);

  const activeCount = useMemo(
    () => items.filter((c) => getDisplayStatus(c).key === "actif" || getDisplayStatus(c).key === "preavis").length,
    [items],
  );

  const monthlyPayroll = useMemo(
    () =>
      items
        .filter((c) => c.status === "active")
        .reduce((sum, c) => sum + (Number(c.salary) || 0), 0),
    [items],
  );

  async function confirmClose() {
    if (!closing) return;
    setLoading(true);
    const { error } = await pendingQuery("PATCH /org/contracts");
    setLoading(false);
    if (error) {
      toast.error(t("contracts.closeError"), { description: error.message });
      return;
    }
    toast.success(t("contracts.closed"));
    setClosing(null);
    void load();
  }

  async function saveContract() {
    if (!editing || !org) return;
    if (!editing.employee_id) {
      toast.error(t("contracts.selectEmployeeError"));
      return;
    }
    if (!editing.start_date) {
      toast.error(t("contracts.startDateRequiredError"));
      return;
    }
    if ((editing.type === "cdd" || editing.type === "stage") && !editing.end_date) {
      toast.error(t("contracts.endDateRequiredError"));
      return;
    }
    setLoading(true);
    const payload = {
      organization_id: org.id,
      employee_id: editing.employee_id,
      type: editing.type,
      status: editing.status,
      start_date: editing.start_date,
      end_date: editing.end_date || null,
      salary: editing.salary ? Number(editing.salary) : null,
      
      trial_period_end: editing.trial_period_end || null,
      notes: editing.notes || null,
    };
    const { error } = editing.id
      ? await pendingQuery("PATCH /org/contracts")
      : await pendingQuery("POST /org/contracts");
    setLoading(false);
    if (error) {
      toast.error(t("contracts.saveError"), { description: error.message });
      return;
    }
    toast.success(editing.id ? t("contracts.updatedToast") : t("contracts.createdToast"));
    setEditing(null);
    void load();
  }

  async function performDelete() {
    if (!pendingDelete) return;
    const { error } = await pendingQuery("DELETE /org/contracts");
    if (error) {
      toast.error(t("contracts.deleteError"), { description: error.message });
      return;
    }
    toast.success(t("contracts.deletedToast"));
    setPendingDelete(null);
    void load();
  }

  function openEdit(c: ContractRow) {
    setEditing({
      id: c.id,
      employee_id: c.employee_id,
      type: (c.type as ContractType) ?? "cdi",
      status: (c.status as "draft" | "active" | "terminated") ?? "draft",
      start_date: c.start_date,
      end_date: c.end_date ?? "",
      salary: c.salary != null ? String(c.salary) : "",
      trial_period_end: c.trial_period_end ?? "",
      notes: c.notes ?? "",
    });
  }

  // Live preview helpers for the form
  const formEmployee = employees.find((e) => e.id === editing?.employee_id);
  const formCategory = formEmployee ? getEmployeeCategory(formEmployee.position) : null;
  const formMonths =
    editing && editing.start_date && editing.end_date
      ? monthsBetween(editing.start_date, editing.end_date)
      : null;
  const formOverLimit =
    editing?.type === "cdd" && editing.end_date && isCDDOverLimit(editing.start_date, editing.end_date);

  return (
    <div className="space-y-4">
      <PageHeader
        title={canManage ? t("contracts.title") : t("contracts.myContract")}
        description={
          canManage
            ? t("contracts.description")
            : t("contracts.myDescription")
        }
        actions={
          canManage ? (
            <Button onClick={() => setEditing(emptyForm())}>
              <Plus className="mr-2 h-4 w-4" /> {t("contracts.newContract")}
            </Button>
          ) : undefined
        }
      />

      {/* KPIs */}
      {canManage && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard icon={<FileText className="h-4 w-4" />} label={t("contracts.kpiActive")} value={String(activeCount)} />
          <KpiCard
            icon={<AlertTriangle className="h-4 w-4 text-destructive" />}
            label={t("contracts.kpiNonCompliantCdd")}
            value={String(nonCompliantCDD.length)}
            tone={nonCompliantCDD.length ? "destructive" : "default"}
          />
          <KpiCard
            icon={<BellRing className="h-4 w-4" />}
            label={t("contracts.kpiUpcomingNotice")}
            value={String(upcomingNotices.length + inNotice.length)}
          />
          <KpiCard
            icon={<Wallet className="h-4 w-4" />}
            label={t("contracts.kpiPayroll")}
            value={formatCurrency(monthlyPayroll)}
          />
        </div>
      )}

      {canManage && nonCompliantCDD.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{t("contracts.nonCompliantTitle", { count: nonCompliantCDD.length })}</AlertTitle>
          <AlertDescription>
            {t("contracts.nonCompliantDesc")}{" "}
            {nonCompliantCDD
              .map((c) => `${c.employees?.first_name ?? ""} ${c.employees?.last_name ?? ""}`.trim())
              .join(", ")}
          </AlertDescription>
        </Alert>
      )}

      {canManage && (upcomingNotices.length > 0 || inNotice.length > 0) && (
        <Alert>
          <BellRing className="h-4 w-4" />
          <AlertTitle>{t("contracts.upcomingNoticeTitle", { count: upcomingNotices.length + inNotice.length })}</AlertTitle>
          <AlertDescription>
            {[...inNotice.map((c) => ({ c, d: getDisplayStatus(c) })), ...upcomingNotices]
              .map(
                ({ c, d }) =>
                  `${c.employees?.first_name ?? ""} ${c.employees?.last_name ?? ""} (${t("contracts.noticePrefix", { date: fmtDate(d.noticeStart, i18n.language === "en" ? "en-US" : "fr-FR") })})`,
              )
              .join(" • ")}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="p-0">
          <ResponsiveTable
            data={items}
            getRowKey={(c) => c.id}
            empty={
              canManage
                ? t("contracts.emptyManaged")
                : t("contracts.emptySelf")
            }
            columns={[
              {
                key: "employee",
                header: t("contracts.colEmployee"),
                priority: "primary",
                cell: (c) => `${c.employees?.first_name ?? ""} ${c.employees?.last_name ?? ""}`.trim() || "—",
              },
              {
                key: "type",
                header: t("contracts.colType"),
                cell: (c) => (
                  <Badge variant="outline">{CONTRACT_TYPE_LABEL[c.type] ?? c.type}</Badge>
                ),
              },
              {
                key: "category",
                header: t("contracts.colCategory"),
                className: "text-muted-foreground",
                cell: (c) => {
                  const cat = getEmployeeCategory(c.employees?.position);
                  return (
                    <>
                      {CATEGORY_LABEL[cat]}
                      <div className="text-xs">{t("contracts.noticeMonths", { count: getNoticeMonths(cat) })}</div>
                    </>
                  );
                },
              },
              {
                key: "period",
                header: t("contracts.colPeriod"),
                className: "text-muted-foreground",
                cell: (c) => (
                  <>
                    <span className="whitespace-nowrap">
                      {fmtDate(c.start_date, i18n.language === "en" ? "en-US" : "fr-FR")} → {fmtDate(c.end_date, i18n.language === "en" ? "en-US" : "fr-FR")}
                    </span>
                    {c.end_date && (
                      <div className="text-xs">
                        {t("contracts.monthsShort", { count: monthsBetween(c.start_date, c.end_date).toFixed(1) })}
                      </div>
                    )}
                  </>
                ),
              },
              {
                key: "salary",
                header: t("contracts.colSalary"),
                cell: (c) => formatCurrency(c.salary),
              },
              {
                key: "status",
                header: t("contracts.colStatus"),
                cell: (c) => <StatusBadge s={getDisplayStatus(c).key} />,
              },
              {
                key: "compliance",
                header: t("contracts.colCompliance"),
                className: "space-y-1",
                cell: (c) => {
                  const disp = getDisplayStatus(c);
                  const overLimit = c.type === "cdd" && isCDDOverLimit(c.start_date, c.end_date);
                  const noticeImminent =
                    disp.noticeDays !== undefined && disp.noticeDays > 0 && disp.noticeDays <= 30;
                  return (
                    <div className="space-y-1">
                      {overLimit && (
                        <Badge variant="destructive" className="block w-fit">
                          {t("contracts.cddOverLimit")}
                        </Badge>
                      )}
                      {noticeImminent && disp.key !== "preavis" && (
                        <Badge variant="secondary" className="block w-fit">
                          {t("contracts.noticeImminent", { date: fmtDate(disp.noticeStart, i18n.language === "en" ? "en-US" : "fr-FR") })}
                        </Badge>
                      )}
                      {disp.key === "preavis" && disp.noticeStart && (
                        <Badge variant="destructive" className="block w-fit">
                          {t("contracts.noticeSince", { date: fmtDate(disp.noticeStart, i18n.language === "en" ? "en-US" : "fr-FR") })}
                        </Badge>
                      )}
                      {!overLimit && !noticeImminent && disp.key === "actif" && (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <CheckCircle2 className="h-3 w-3" /> {t("contracts.compliant")}
                        </span>
                      )}
                    </div>
                  );
                },
              },
              ...(canManage
                ? ([
                    {
                      key: "actions",
                      header: t("contracts.colActions"),
                      priority: "actions" as const,
                      align: "right" as const,
                      className: "text-right whitespace-nowrap",
                      cell: (c: (typeof items)[number]) => {
                        const canClose = c.status === "active" || c.status === "draft";
                        return (
                          <div className="inline-flex items-center gap-1">
                            <Button size="sm" variant="outline" onClick={() => openEdit(c)}>
                              <Pencil className="mr-1 h-4 w-4" />
                              {t("contracts.edit")}
                            </Button>
                            <ActionMenu
                              items={[
                                {
                                  label: t("contracts.close"),
                                  icon: <CheckCircle2 className="h-4 w-4" />,
                                  onSelect: () => setClosing(c),
                                  hidden: !canClose,
                                },
                                { type: "separator", hidden: !canClose },
                                {
                                  label: t("contracts.delete"),
                                  icon: <Trash2 className="h-4 w-4" />,
                                  onSelect: () => setPendingDelete(c),
                                  variant: "destructive",
                                },
                              ]}
                            />
                          </div>
                        );
                      },
                    },
                  ])
                : []),
            ]}
          />
        </CardContent>
      </Card>

      {/* Clôture dialog */}
      <Dialog open={!!closing} onOpenChange={(o) => !o && setClosing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("contracts.closeTitle")}</DialogTitle>
            <DialogDescription>
              {closing && (
                <>
                  {closing.employees?.first_name} {closing.employees?.last_name} —{" "}
                  {CONTRACT_TYPE_LABEL[closing.type] ?? closing.type}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {closing && (
            <DialogBody>
              <div className="space-y-3 text-sm">
              {(() => {
                const end = closing.end_date ?? new Date().toISOString().slice(0, 10);
                const months = monthsBetween(closing.start_date, end);
                const indemnity = computeIndemnity(closing.salary, closing.start_date, end);
                return (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("contracts.grossSalary")}</span>
                      <span>{formatCurrency(closing.salary)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("contracts.totalDuration")}</span>
                      <span>{t("contracts.monthsShort", { count: months.toFixed(1) })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("contracts.totalGross")}</span>
                      <span>{formatCurrency((closing.salary ?? 0) * months)}</span>
                    </div>
                    {closing.type === "cdd" ? (
                      <div className="flex justify-between border-t pt-3 font-medium">
                        <span>{t("contracts.cddIndemnity")}</span>
                        <span className="text-primary">{formatCurrency(indemnity)}</span>
                      </div>
                    ) : (
                      <Alert>
                        <AlertDescription>
                          {t("contracts.indemnityNoticeOther", { type: CONTRACT_TYPE_LABEL[closing.type] ?? closing.type })}
                        </AlertDescription>
                      </Alert>
                    )}
                  </>
                );
              })()}
              </div>
              <DialogActions>
                <Button variant="outline" onClick={() => setClosing(null)}>
                  {t("contracts.cancel")}
                </Button>
                <Button onClick={confirmClose} disabled={loading}>
                  {loading ? t("contracts.closing") : t("contracts.confirmClose")}
                </Button>
              </DialogActions>
            </DialogBody>
          )}
        </DialogContent>
      </Dialog>

      {/* Création / édition dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? t("contracts.editContract") : t("contracts.newContract")}</DialogTitle>
            <DialogDescription>
              {t("contracts.contractLegalHint")}
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <DialogBody>
              <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>{t("contracts.employee")}</Label>
                <Select
                  value={editing.employee_id}
                  onValueChange={(v) => setEditing({ ...editing, employee_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("contracts.chooseEmployee")} />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.first_name} {e.last_name}
                        {e.position ? ` — ${e.position}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formCategory && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("contracts.deducedCategory", { category: CATEGORY_LABEL[formCategory], months: getNoticeMonths(formCategory) })}
                  </p>
                )}
              </div>
              <div>
                <Label>{t("contracts.type")}</Label>
                <Select
                  value={editing.type}
                  onValueChange={(v) => setEditing({ ...editing, type: v as ContractType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTRACT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {CONTRACT_TYPE_LABEL[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("contracts.status")}</Label>
                <Select
                  value={editing.status}
                  onValueChange={(v) => setEditing({ ...editing, status: v as FormState["status"] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">{t("contracts.statusDraft")}</SelectItem>
                    <SelectItem value="active">{t("contracts.statusActive")}</SelectItem>
                    <SelectItem value="terminated">{t("contracts.statusTerminated")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("contracts.startDate")}</Label>
                <Input
                  type="date"
                  value={editing.start_date}
                  onChange={(e) => setEditing({ ...editing, start_date: e.target.value })}
                />
              </div>
              <div>
                <Label>
                  {t("contracts.endDate")} {(editing.type === "cdd" || editing.type === "stage") && <span className="text-destructive">*</span>}
                </Label>
                <Input
                  type="date"
                  value={editing.end_date}
                  onChange={(e) => setEditing({ ...editing, end_date: e.target.value })}
                />
                {formMonths !== null && (
                  <p className="mt-1 text-xs text-muted-foreground">{t("contracts.duration", { months: formMonths.toFixed(1) })}</p>
                )}
                {formOverLimit && (
                  <p className="mt-1 text-xs text-destructive">
                    {t("contracts.cddOverLimitWarning")}
                  </p>
                )}
              </div>
              <div>
                <Label>{t("contracts.salary")}</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={editing.salary}
                  onChange={(e) => setEditing({ ...editing, salary: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <Label>{t("contracts.trialPeriodEnd")}</Label>
                <Input
                  type="date"
                  value={editing.trial_period_end}
                  onChange={(e) => setEditing({ ...editing, trial_period_end: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <Label>{t("contracts.notes")}</Label>
                <Textarea
                  rows={3}
                  value={editing.notes}
                  onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                />
              </div>
              </div>
              <DialogActions>
                <Button variant="outline" onClick={() => setEditing(null)}>
                  {t("contracts.cancel")}
                </Button>
                <Button onClick={saveContract} disabled={loading}>
                  {loading ? t("contracts.saving") : editing?.id ? t("contracts.update") : t("contracts.create")}
                </Button>
              </DialogActions>
            </DialogBody>
          )}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title={t("contracts.deleteTitle")}
        description={
          pendingDelete
            ? t("contracts.deleteDesc", { name: `${pendingDelete.employees?.first_name ?? ""} ${pendingDelete.employees?.last_name ?? ""}`.trim() })
            : ""
        }
        cancelLabel={t("contracts.cancel")}
        actionLabel={t("contracts.delete")}
        actionVariant="destructive"
        onConfirm={() => void performDelete()}
      />
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "default" | "destructive";
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{label}</span>
          {icon}
        </div>
        <div className={`mt-1 text-2xl font-semibold ${tone === "destructive" ? "text-destructive" : ""}`}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
