import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiErrorMessage } from "@/lib/api/client";
import { openSignedUrl } from "@/lib/signed-url";
import {
  allEmployeesQuery,
  contractDocumentUrl,
  contractsQuery,
  createContract,
  deleteContract,
  employeeQuery,
  hrKey,
  terminateContract,
  updateContract,
  uploadContractDocument,
  type Contract,
  type ContractInput,
  type ContractType,
} from "@/lib/api/hr";
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
  Eye,
  FileText,
  Paperclip,
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

const CONTRACT_TYPES: ContractType[] = [
  "cdi",
  "cdd",
  "stage",
  "freelance",
  "apprenticeship",
  "daily",
];
function useContractTypeLabel(t: (k: string) => string): Record<string, string> {
  return {
    cdi: t("contracts.typeCdi"),
    cdd: t("contracts.typeCdd"),
    stage: t("contracts.typeStage"),
    freelance: t("contracts.typeFreelance"),
    apprenticeship: t("contracts.typeApprenticeship"),
    daily: t("contracts.typeJournalier"),
  };
}

type EmployeeRef = { firstName: string; lastName: string; jobTitle: string | null };

type ContractRow = Contract & { employee: EmployeeRef | null };

const employeeName = (c: ContractRow) =>
  `${c.employee?.firstName ?? ""} ${c.employee?.lastName ?? ""}`.trim();

type DisplayStatus = "actif" | "expire" | "preavis" | "brouillon" | "suspendu" | "termine";

function getDisplayStatus(c: ContractRow): {
  key: DisplayStatus;
  noticeStart?: Date;
  noticeDays?: number;
} {
  if (c.status === "draft") return { key: "brouillon" };
  if (c.status === "terminated") return { key: "termine" };
  if (c.status === "suspended") return { key: "suspendu" };
  if (c.endDate) {
    const end = new Date(c.endDate);
    const today = new Date();
    if (end < today) return { key: "expire" };
    const cat = getEmployeeCategory(c.employee?.jobTitle);
    const noticeStart = getNoticeStartDate(c.endDate, getNoticeMonths(cat));
    const days = daysUntil(noticeStart);
    if (days <= 0) return { key: "preavis", noticeStart, noticeDays: days };
    return { key: "actif", noticeStart, noticeDays: days };
  }
  return { key: "actif" };
}

function StatusBadge({ s }: { s: DisplayStatus }) {
  const { t } = useTranslation();
  const map: Record<
    DisplayStatus,
    { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
  > = {
    actif: { label: t("contracts.statusActive"), variant: "default" },
    preavis: { label: t("contracts.statusOnNotice"), variant: "destructive" },
    expire: { label: t("contracts.statusExpired"), variant: "destructive" },
    brouillon: { label: t("contracts.statusDraft"), variant: "outline" },
    suspendu: { label: t("contracts.statusSuspended"), variant: "secondary" },
    termine: { label: t("contracts.statusTerminated"), variant: "secondary" },
  };
  const { label, variant } = map[s];
  return <Badge variant={variant}>{label}</Badge>;
}

// ----------------- Form types -----------------
type FormState = {
  id?: string;
  employeeId: string;
  type: ContractType;
  status: ContractInput["status"];
  startDate: string;
  endDate: string;
  salary: string;
  weeklyHours: string;
  trialPeriodEnd: string;
  notes: string;
};

const today = () => new Date().toISOString().slice(0, 10);

const emptyForm = (): FormState => ({
  employeeId: "",
  type: "cdi",
  status: "draft",
  startDate: today(),
  endDate: "",
  salary: "",
  weeklyHours: "",
  trialPeriodEnd: "",
  notes: "",
});

const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

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
  const queryClient = useQueryClient();
  const organizationId = org?.id ?? "";
  const [closing, setClosing] = useState<ContractRow | null>(null);
  const [closeDate, setCloseDate] = useState(today());
  const [pendingDelete, setPendingDelete] = useState<ContractRow | null>(null);
  const [editing, setEditing] = useState<FormState | null>(null);
  const documentInput = useRef<HTMLInputElement>(null);
  const [documentFor, setDocumentFor] = useState<string | null>(null);

  // Owner and hr_admin manage every contract; everyone else only reads their own.
  const selfId = canManage ? undefined : myEmployee?.id;
  const contracts = useQuery({
    ...contractsQuery(organizationId, selfId),
    enabled: !!org && (canManage || (!employeeLoading && !!selfId)),
  });
  const allEmployees = useQuery({
    ...allEmployeesQuery(organizationId),
    enabled: !!org && canManage,
  });
  const self = useQuery({
    ...employeeQuery(organizationId, selfId ?? ""),
    enabled: !!org && !!selfId,
  });

  const employees = useMemo(() => allEmployees.data ?? [], [allEmployees.data]);
  const items = useMemo<ContractRow[]>(() => {
    const byId = new Map<string, EmployeeRef>(employees.map((e) => [e.id, e]));
    if (self.data) byId.set(self.data.id, self.data);
    if (!selfId && !canManage) return [];
    return (contracts.data ?? []).map((c) => ({ ...c, employee: byId.get(c.employeeId) ?? null }));
  }, [contracts.data, employees, self.data, selfId, canManage]);

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: [...hrKey(organizationId), "contracts"] });

  const closeMutation = useMutation({
    mutationFn: ({ id, endDate }: { id: string; endDate: string }) =>
      terminateContract(id, endDate),
    onSuccess: () => {
      toast.success(t("contracts.closed"));
      setClosing(null);
      void refresh();
    },
    onError: (error) =>
      toast.error(t("contracts.closeError"), { description: apiErrorMessage(error) }),
  });

  const saveMutation = useMutation({
    mutationFn: ({ id, input }: { id?: string; input: ContractInput }) =>
      id ? updateContract(id, input) : createContract(input),
    onSuccess: (_contract, { id }) => {
      toast.success(id ? t("contracts.updatedToast") : t("contracts.createdToast"));
      setEditing(null);
      void refresh();
    },
    onError: (error) =>
      toast.error(t("contracts.saveError"), { description: apiErrorMessage(error) }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteContract(id),
    onSuccess: () => {
      toast.success(t("contracts.deletedToast"));
      setPendingDelete(null);
      void refresh();
    },
    onError: (error) =>
      toast.error(t("contracts.deleteError"), { description: apiErrorMessage(error) }),
  });

  const uploadMutation = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => uploadContractDocument(id, file),
    onSuccess: () => {
      toast.success(t("contracts.documentUploaded"));
      void refresh();
    },
    onError: (error) =>
      toast.error(t("contracts.documentError"), { description: apiErrorMessage(error) }),
  });

  const loading = closeMutation.isPending || saveMutation.isPending;

  function openDocument(c: ContractRow) {
    void openSignedUrl(
      () => contractDocumentUrl(c.id),
      (error) => toast.error(t("contracts.documentError"), { description: apiErrorMessage(error) }),
    );
  }

  function pickDocument(c: ContractRow) {
    setDocumentFor(c.id);
    documentInput.current?.click();
  }

  function onDocumentPicked(file: File | undefined) {
    if (documentInput.current) documentInput.current.value = "";
    if (!file || !documentFor) return;
    if (file.size > DOCUMENT_MAX_BYTES) {
      toast.error(t("contracts.documentTooLarge"));
      return;
    }
    uploadMutation.mutate({ id: documentFor, file });
  }

  const nonCompliantCDD = useMemo(
    () =>
      items.filter(
        (c) =>
          c.type === "cdd" &&
          c.status !== "terminated" &&
          getDisplayStatus(c).key !== "termine" &&
          isCDDOverLimit(c.startDate, c.endDate),
      ),
    [items],
  );

  const upcomingNotices = useMemo(
    () =>
      items
        .map((c) => ({ c, d: getDisplayStatus(c) }))
        .filter(
          ({ d }) =>
            d.noticeDays !== undefined &&
            d.noticeDays > 0 &&
            d.noticeDays <= 30 &&
            d.key !== "termine",
        ),
    [items],
  );

  const inNotice = useMemo(
    () => items.filter((c) => getDisplayStatus(c).key === "preavis"),
    [items],
  );

  const activeCount = useMemo(
    () =>
      items.filter(
        (c) => getDisplayStatus(c).key === "actif" || getDisplayStatus(c).key === "preavis",
      ).length,
    [items],
  );

  const monthlyPayroll = useMemo(
    () =>
      items
        .filter((c) => c.status === "active")
        .reduce((sum, c) => sum + (Number(c.salary) || 0), 0),
    [items],
  );

  function openClose(c: ContractRow) {
    setCloseDate(today());
    setClosing(c);
  }

  function saveContract() {
    if (!editing || !org) return;
    if (!editing.employeeId) {
      toast.error(t("contracts.selectEmployeeError"));
      return;
    }
    if (!editing.startDate) {
      toast.error(t("contracts.startDateRequiredError"));
      return;
    }
    if ((editing.type === "cdd" || editing.type === "stage") && !editing.endDate) {
      toast.error(t("contracts.endDateRequiredError"));
      return;
    }
    saveMutation.mutate({
      id: editing.id,
      input: {
        employeeId: editing.employeeId,
        type: editing.type,
        status: editing.status,
        startDate: editing.startDate,
        endDate: editing.endDate || null,
        salary: editing.salary ? Number(editing.salary) : null,
        weeklyHours: editing.weeklyHours ? Number(editing.weeklyHours) : null,
        trialPeriodEnd: editing.trialPeriodEnd || null,
        notes: editing.notes || null,
      },
    });
  }

  function openEdit(c: ContractRow) {
    setEditing({
      id: c.id,
      employeeId: c.employeeId,
      type: c.type,
      status: c.status === "terminated" ? "active" : c.status,
      startDate: c.startDate,
      endDate: c.endDate ?? "",
      salary: c.salary != null ? String(c.salary) : "",
      weeklyHours: c.weeklyHours != null ? String(c.weeklyHours) : "",
      trialPeriodEnd: c.trialPeriodEnd ?? "",
      notes: c.notes ?? "",
    });
  }

  // Live preview helpers for the form
  const formEmployee = employees.find((e) => e.id === editing?.employeeId);
  const formCategory = formEmployee ? getEmployeeCategory(formEmployee.jobTitle) : null;
  const formMonths =
    editing && editing.startDate && editing.endDate
      ? monthsBetween(editing.startDate, editing.endDate)
      : null;
  const formOverLimit =
    editing?.type === "cdd" &&
    editing.endDate &&
    isCDDOverLimit(editing.startDate, editing.endDate);
  const locale = i18n.language === "en" ? "en-US" : "fr-FR";

  return (
    <div className="space-y-4">
      <PageHeader
        title={canManage ? t("contracts.title") : t("contracts.myContract")}
        description={canManage ? t("contracts.description") : t("contracts.myDescription")}
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
          <KpiCard
            icon={<FileText className="h-4 w-4" />}
            label={t("contracts.kpiActive")}
            value={String(activeCount)}
          />
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
          <AlertTitle>
            {t("contracts.nonCompliantTitle", { count: nonCompliantCDD.length })}
          </AlertTitle>
          <AlertDescription>
            {t("contracts.nonCompliantDesc")} {nonCompliantCDD.map(employeeName).join(", ")}
          </AlertDescription>
        </Alert>
      )}

      {canManage && (upcomingNotices.length > 0 || inNotice.length > 0) && (
        <Alert>
          <BellRing className="h-4 w-4" />
          <AlertTitle>
            {t("contracts.upcomingNoticeTitle", {
              count: upcomingNotices.length + inNotice.length,
            })}
          </AlertTitle>
          <AlertDescription>
            {[...inNotice.map((c) => ({ c, d: getDisplayStatus(c) })), ...upcomingNotices]
              .map(
                ({ c, d }) =>
                  `${employeeName(c)} (${t("contracts.noticePrefix", { date: fmtDate(d.noticeStart, locale) })})`,
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
            empty={canManage ? t("contracts.emptyManaged") : t("contracts.emptySelf")}
            columns={[
              {
                key: "employee",
                header: t("contracts.colEmployee"),
                priority: "primary",
                cell: (c) => employeeName(c) || "—",
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
                  const cat = getEmployeeCategory(c.employee?.jobTitle);
                  return (
                    <>
                      {CATEGORY_LABEL[cat]}
                      <div className="text-xs">
                        {t("contracts.noticeMonths", { count: getNoticeMonths(cat) })}
                      </div>
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
                      {fmtDate(c.startDate, locale)} → {fmtDate(c.endDate, locale)}
                    </span>
                    {c.endDate && (
                      <div className="text-xs">
                        {t("contracts.monthsShort", {
                          count: monthsBetween(c.startDate, c.endDate).toFixed(1),
                        })}
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
                  const overLimit = c.type === "cdd" && isCDDOverLimit(c.startDate, c.endDate);
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
                          {t("contracts.noticeImminent", {
                            date: fmtDate(disp.noticeStart, locale),
                          })}
                        </Badge>
                      )}
                      {disp.key === "preavis" && disp.noticeStart && (
                        <Badge variant="destructive" className="block w-fit">
                          {t("contracts.noticeSince", { date: fmtDate(disp.noticeStart, locale) })}
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
              {
                key: "actions",
                header: t("contracts.colActions"),
                priority: "actions" as const,
                align: "right" as const,
                className: "text-right whitespace-nowrap",
                cell: (c: ContractRow) => {
                  const canClose = c.status === "active" || c.status === "suspended";
                  const editable = c.status !== "terminated";
                  return (
                    <div className="inline-flex items-center gap-1">
                      {canManage && editable && (
                        <Button size="sm" variant="outline" onClick={() => openEdit(c)}>
                          <Pencil className="mr-1 h-4 w-4" />
                          {t("contracts.edit")}
                        </Button>
                      )}
                      <ActionMenu
                        label={t("contracts.colActions")}
                        items={[
                          {
                            label: t("contracts.viewDocument"),
                            icon: <Eye className="h-4 w-4" />,
                            onSelect: () => openDocument(c),
                            hidden: !c.hasDocument,
                          },
                          {
                            label: t("contracts.attachDocument"),
                            icon: <Paperclip className="h-4 w-4" />,
                            onSelect: () => pickDocument(c),
                            hidden: !canManage,
                            disabled: uploadMutation.isPending,
                          },
                          { type: "separator", hidden: !canManage },
                          {
                            label: t("contracts.close"),
                            icon: <CheckCircle2 className="h-4 w-4" />,
                            onSelect: () => openClose(c),
                            hidden: !canManage || !canClose,
                          },
                          {
                            label: t("contracts.delete"),
                            icon: <Trash2 className="h-4 w-4" />,
                            onSelect: () => setPendingDelete(c),
                            variant: "destructive",
                            hidden: !canManage,
                          },
                        ]}
                      />
                    </div>
                  );
                },
              },
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
                  {employeeName(closing)} — {CONTRACT_TYPE_LABEL[closing.type] ?? closing.type}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {closing && (
            <DialogBody>
              <div className="space-y-3 text-sm">
                <div>
                  <Label htmlFor="contract-close-date">{t("contracts.closeDate")}</Label>
                  <Input
                    id="contract-close-date"
                    type="date"
                    value={closeDate}
                    min={closing.startDate}
                    onChange={(e) => setCloseDate(e.target.value)}
                  />
                </div>
                {(() => {
                  const end = closeDate || today();
                  const months = monthsBetween(closing.startDate, end);
                  const indemnity = computeIndemnity(closing.salary, closing.startDate, end);
                  return (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t("contracts.grossSalary")}</span>
                        <span>{formatCurrency(closing.salary)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          {t("contracts.totalDuration")}
                        </span>
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
                            {t("contracts.indemnityNoticeOther", {
                              type: CONTRACT_TYPE_LABEL[closing.type] ?? closing.type,
                            })}
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
                <Button
                  onClick={() => closeMutation.mutate({ id: closing.id, endDate: closeDate })}
                  disabled={loading || !closeDate}
                >
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
            <DialogTitle>
              {editing?.id ? t("contracts.editContract") : t("contracts.newContract")}
            </DialogTitle>
            <DialogDescription>{t("contracts.contractLegalHint")}</DialogDescription>
          </DialogHeader>
          {editing && (
            <DialogBody>
              <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label>{t("contracts.employee")}</Label>
                  <Select
                    value={editing.employeeId}
                    onValueChange={(v) => setEditing({ ...editing, employeeId: v })}
                    disabled={!!editing.id}
                  >
                    <SelectTrigger aria-label={t("contracts.employee")}>
                      <SelectValue placeholder={t("contracts.chooseEmployee")} />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.firstName} {e.lastName}
                          {e.jobTitle ? ` — ${e.jobTitle}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formCategory && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("contracts.deducedCategory", {
                        category: CATEGORY_LABEL[formCategory],
                        months: getNoticeMonths(formCategory),
                      })}
                    </p>
                  )}
                </div>
                <div>
                  <Label>{t("contracts.type")}</Label>
                  <Select
                    value={editing.type}
                    onValueChange={(v) => setEditing({ ...editing, type: v as ContractType })}
                  >
                    <SelectTrigger aria-label={t("contracts.type")}>
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
                    onValueChange={(v) =>
                      setEditing({ ...editing, status: v as FormState["status"] })
                    }
                  >
                    <SelectTrigger aria-label={t("contracts.status")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">{t("contracts.statusDraft")}</SelectItem>
                      <SelectItem value="active">{t("contracts.statusActive")}</SelectItem>
                      <SelectItem value="suspended">{t("contracts.statusSuspended")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="contract-start">{t("contracts.startDate")}</Label>
                  <Input
                    id="contract-start"
                    type="date"
                    value={editing.startDate}
                    onChange={(e) => setEditing({ ...editing, startDate: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="contract-end">
                    {t("contracts.endDate")}{" "}
                    {(editing.type === "cdd" || editing.type === "stage") && (
                      <span className="text-destructive">*</span>
                    )}
                  </Label>
                  <Input
                    id="contract-end"
                    type="date"
                    value={editing.endDate}
                    onChange={(e) => setEditing({ ...editing, endDate: e.target.value })}
                  />
                  {formMonths !== null && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("contracts.duration", { months: formMonths.toFixed(1) })}
                    </p>
                  )}
                  {formOverLimit && (
                    <p className="mt-1 text-xs text-destructive">
                      {t("contracts.cddOverLimitWarning")}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="contract-salary">{t("contracts.salary")}</Label>
                  <Input
                    id="contract-salary"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={editing.salary}
                    onChange={(e) => setEditing({ ...editing, salary: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="contract-hours">{t("contracts.weeklyHours")}</Label>
                  <Input
                    id="contract-hours"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={168}
                    value={editing.weeklyHours}
                    onChange={(e) => setEditing({ ...editing, weeklyHours: e.target.value })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="contract-trial">{t("contracts.trialPeriodEnd")}</Label>
                  <Input
                    id="contract-trial"
                    type="date"
                    value={editing.trialPeriodEnd}
                    onChange={(e) => setEditing({ ...editing, trialPeriodEnd: e.target.value })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="contract-notes">{t("contracts.notes")}</Label>
                  <Textarea
                    id="contract-notes"
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
                  {loading
                    ? t("contracts.saving")
                    : editing?.id
                      ? t("contracts.update")
                      : t("contracts.create")}
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
          pendingDelete ? t("contracts.deleteDesc", { name: employeeName(pendingDelete) }) : ""
        }
        cancelLabel={t("contracts.cancel")}
        actionLabel={t("contracts.delete")}
        actionVariant="destructive"
        onConfirm={() => pendingDelete && deleteMutation.mutate(pendingDelete.id)}
      />
      <input
        ref={documentInput}
        type="file"
        accept="application/pdf,image/png,image/jpeg,image/webp"
        className="hidden"
        aria-label={t("contracts.attachDocument")}
        onChange={(e) => onDocumentPicked(e.target.files?.[0])}
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
        <div
          className={`mt-1 text-2xl font-semibold ${tone === "destructive" ? "text-destructive" : ""}`}
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
