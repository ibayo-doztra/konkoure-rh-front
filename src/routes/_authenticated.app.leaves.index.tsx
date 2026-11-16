import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { Plus, Check, X, Trash2, Eye } from "lucide-react";
import { LeaveDetailSheet } from "@/components/leaves/LeaveDetailSheet";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ResponsiveTable } from "@/components/ResponsiveTable";
import {
  Dialog, DialogActions, DialogBody, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOrg } from "@/hooks/useOrg";
import { useMyEmployee } from "@/hooks/useMyEmployee";
import { useCountUp, formatDayCount } from "@/hooks/useCountUp";
import {
  listLeaveRequests, createLeaveRequest, decideLeaveRequest,
  cancelLeaveRequest, computeWorkingDays, listHolidays, getEmployeeLeaveBalance,
} from "@/lib/api/legacy-functions";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_authenticated/app/leaves/")({
  component: LeavesPage,
});

function useTypeLabel(t: (k: string) => string): Record<string, string> {
  return {
    annuel: t("leaves.typeAnnuel"),
    maladie: t("leaves.typeMaladie"),
    maternite: t("leaves.typeMaternite"),
    sans_solde: t("leaves.typeSansSolde"),
  };
}
function useStatusLabel(t: (k: string) => string): Record<string, string> {
  return {
    pending: t("leaves.statusPending"),
    approved: t("leaves.statusApproved"),
    rejected: t("leaves.statusRejected"),
    cancelled: t("leaves.statusCancelled"),
  };
}
const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "outline" | "destructive" | "success"
> = {
  pending: "secondary",
  approved: "success",
  rejected: "destructive",
  cancelled: "outline",
};

function LeavesPage() {
  const { t, i18n } = useTranslation();
  const TYPE_LABEL = useTypeLabel(t);
  const STATUS_LABEL = useStatusLabel(t);
  const { org } = useOrg();
  const { myEmployee, isSuperAdmin } = useMyEmployee();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "mine" | "pending">("all");
  const [open, setOpen] = useState(false);

  const listFn = listLeaveRequests;
  const decideFn = decideLeaveRequest;
  const cancelFn = cancelLeaveRequest;
  const balanceFn = getEmployeeLeaveBalance;

  const { data: rows = [] } = useQuery({
    queryKey: ["leave-requests", org?.id, filter, myEmployee?.id],
    queryFn: () => listFn({
      data: {
        organizationId: org!.id,
        ...(filter === "pending" ? { status: "pending" as const } : {}),
        ...(filter === "mine" && myEmployee?.id ? { employeeId: myEmployee.id } : {}),
      },
    }),
    enabled: !!org,
  });

  const { data: myBalanceData } = useQuery({
    queryKey: ["leave-balance", myEmployee?.id],
    queryFn: () => balanceFn({ data: { employeeId: myEmployee!.id } }),
    enabled: !!myEmployee?.id,
  });
  const myBalance = myBalanceData?.balance ?? null;
  const pendingDays = useMemo(
    () =>
      (rows as any[])
        .filter((r) => r.status === "pending" && r.employee_id === myEmployee?.id && r.type === "annuel")
        .reduce((sum, r) => sum + Number(r.requested_days ?? 0), 0),
    [rows, myEmployee?.id],
  );
  const animatedBalance = useCountUp(myBalance);
  const animatedPending = useCountUp(pendingDays);

  const canManage = isSuperAdmin;

  const [toApprove, setToApprove] = useState<any | null>(null);
  const [toReject, setToReject] = useState<any | null>(null);
  const [toCancel, setToCancel] = useState<any | null>(null);
  const [detail, setDetail] = useState<any | null>(null);

  const decide = async (id: string, decision: "approved" | "rejected", comment?: string) => {
    try {
      await decideFn({ data: { id, decision, comment: comment?.trim() || null } });
      toast.success(decision === "approved" ? t("leaves.approved") : t("leaves.rejected"));
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["leave-requests"] }),
        qc.invalidateQueries({ queryKey: ["leave-balance"] }),
      ]);
    } catch (e: any) {
      toast.error(e?.message ?? t("leaves.genericError"));
    }
  };


  const cancel = async (id: string) => {
    try {
      await cancelFn({ data: { id } });
      toast.success(t("leaves.cancelled"));
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["leave-requests"] }),
        qc.invalidateQueries({ queryKey: ["leave-balance"] }),
      ]);
    } catch (e: any) {
      toast.error(e?.message ?? t("leaves.genericError"));
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("leaves.title")}
        description={t("leaves.description")}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="mr-1 h-4 w-4" /> {t("leaves.newRequest")}</Button>
            </DialogTrigger>
            <NewLeaveDialog onClose={() => setOpen(false)} />
          </Dialog>
        }
      />

      {myEmployee?.id && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-x-10 gap-y-3 py-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("leaves.myBalance")}
              </p>
              <p className="mt-0.5 text-2xl font-semibold tabular-nums">
                {myBalance === null ? (
                  "…"
                ) : (
                  <span>{t("leaves.daysUnit", { count: formatDayCount(animatedBalance, i18n.language) })}</span>
                )}
              </p>
            </div>
            {pendingDays > 0 && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("leaves.pendingDays")}
                </p>
                <p className="mt-0.5 text-2xl font-semibold tabular-nums text-muted-foreground">
                  {t("leaves.daysUnit", { count: formatDayCount(animatedPending, i18n.language) })}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-col items-start gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base font-medium">{t("leaves.requestsTitle")}</CardTitle>
          <Tabs
            value={filter}
            onValueChange={(v) => setFilter(v as any)}
            className="w-full min-w-0 sm:w-auto"
          >
            <TabsList className="w-full justify-start overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:w-auto">
              <TabsTrigger value="all" className="shrink-0">{t("leaves.tabAll")}</TabsTrigger>
              <TabsTrigger value="pending" className="shrink-0">{t("leaves.tabPending")}</TabsTrigger>
              <TabsTrigger value="mine" className="shrink-0">{t("leaves.tabMine")}</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          <ResponsiveTable
            data={rows as any[]}
            getRowKey={(r: any) => r.id}
            onRowClick={(r: any) => setDetail(r)}
            empty={t("leaves.empty")}
            columns={[
              {
                key: "employee",
                header: t("leaves.colEmployee"),
                priority: "primary",
                cell: (r: any) => {
                  const emp = r.employees;
                  return emp ? `${emp.first_name ?? ""} ${emp.last_name ?? ""}`.trim() : "—";
                },
              },
              {
                key: "type",
                header: t("leaves.colType"),
                cell: (r: any) => TYPE_LABEL[r.type] ?? r.type,
              },
              {
                key: "period",
                header: t("leaves.colPeriod"),
                className: "whitespace-nowrap",
                cell: (r: any) => (
                  <span className="whitespace-nowrap">
                    {format(new Date(r.start_date), "dd/MM/yyyy")} →{" "}
                    {format(new Date(r.end_date), "dd/MM/yyyy")}
                  </span>
                ),
              },
              {
                key: "days",
                header: t("leaves.colDays"),
                align: "right",
                className: "text-right tabular-nums",
                cell: (r: any) => r.requested_days,
              },
              {
                key: "status",
                header: t("leaves.colStatus"),
                cell: (r: any) => (
                  <Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                ),
              },
              {
                key: "actions",
                header: "",
                priority: "actions",
                align: "right",
                cell: (r: any) => {
                  const isMine = r.employee_id === myEmployee?.id;
                  const stop = (fn: () => void) => (e: React.MouseEvent) => {
                    e.stopPropagation();
                    fn();
                  };
                  return (
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={stop(() => setDetail(r))} title={t("leaves.details")}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {canManage && r.status === "pending" && (
                        <>
                          <Button size="icon" variant="ghost" onClick={stop(() => setToApprove(r))} title={t("leaves.approve")}>
                            <Check className="h-4 w-4 text-primary" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={stop(() => setToReject(r))} title={t("leaves.reject")}>
                            <X className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                      {isMine && r.status === "pending" && (
                        <Button size="icon" variant="ghost" onClick={stop(() => setToCancel(r))} title={t("leaves.cancel")}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  );
                },
              },
            ]}
          />
        </CardContent>
      </Card>

      <LeaveDetailSheet
        request={detail}
        canManage={canManage}
        isMine={detail?.employee_id === myEmployee?.id}
        onClose={() => setDetail(null)}
        onApprove={(r) => {
          setDetail(null);
          setToApprove(r);
        }}
        onReject={(r) => {
          setDetail(null);
          setToReject(r);
        }}
        onCancel={(r) => {
          setDetail(null);
          setToCancel(r);
        }}
      />


      <ApproveLeaveDialog
        request={toApprove}
        onClose={() => setToApprove(null)}
        onConfirm={async () => {
          const id = toApprove?.id;
          setToApprove(null);
          if (id) await decide(id, "approved");
        }}
      />

      <RejectLeaveDialog
        request={toReject}
        onClose={() => setToReject(null)}
        onConfirm={async (comment) => {
          const id = toReject?.id;
          setToReject(null);
          if (id) await decide(id, "rejected", comment);
        }}
      />

      <CancelLeaveDialog
        request={toCancel}
        onClose={() => setToCancel(null)}
        onConfirm={async () => {
          const id = toCancel?.id;
          setToCancel(null);
          if (id) await cancel(id);
        }}
      />
    </div>
  );
}

function CancelLeaveDialog({
  request,
  onClose,
  onConfirm,
}: {
  request: any | null;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const TYPE_LABEL = useTypeLabel(t);
  const [submitting, setSubmitting] = useState(false);
  const emp = request?.employees;
  const empName = emp
    ? `${emp.first_name ?? ""} ${emp.last_name ?? ""}`.trim() || t("leaves.employeeFallback")
    : t("leaves.employeeFallback");

  return (
    <Dialog open={!!request} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("leaves.cancelTitle")}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          {request && (
            <div className="space-y-4">
              <div className="space-y-1 text-sm">
                <p className="font-medium">{empName}</p>
                <p className="text-muted-foreground">
                  {TYPE_LABEL[request.type] ?? request.type} —{" "}
                  {format(new Date(request.start_date), "dd/MM/yyyy")} →{" "}
                  {format(new Date(request.end_date), "dd/MM/yyyy")}
                </p>
              </div>

              <div className="divide-y divide-border rounded-lg border border-border">
                <div className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="text-muted-foreground">{t("leaves.requestedDays")}</span>
                  <span className="font-medium tabular-nums">
                    {t("leaves.daysUnit", { count: Number(request.requested_days ?? 0) })}
                  </span>
                </div>
              </div>

              <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {t("leaves.cancelWarning")}
              </p>
            </div>
          )}
          <DialogActions>
            <Button variant="outline" onClick={onClose} disabled={submitting}>
              {t("leaves.back")}
            </Button>
            <Button
              variant="destructive"
              disabled={submitting}
              onClick={async () => {
                setSubmitting(true);
                try {
                  await onConfirm();
                } finally {
                  setSubmitting(false);
                }
              }}
            >
              {t("leaves.confirmCancel")}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

function RejectLeaveDialog({
  request,
  onClose,
  onConfirm,
}: {
  request: any | null;
  onClose: () => void;
  onConfirm: (comment: string) => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const TYPE_LABEL = useTypeLabel(t);
  const [submitting, setSubmitting] = useState(false);
  const [comment, setComment] = useState("");
  const emp = request?.employees;

  useEffect(() => {
    if (request) setComment("");
  }, [request]);

  return (
    <Dialog open={!!request} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("leaves.rejectTitle")}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          {request && (
            <div className="space-y-4">
              <div className="space-y-1 text-sm">
                <p className="font-medium">
                  {emp ? `${emp.first_name ?? ""} ${emp.last_name ?? ""}`.trim() : t("leaves.employeeFallback")}
                </p>
                <p className="text-muted-foreground">
                  {TYPE_LABEL[request.type] ?? request.type} —{" "}
                  {format(new Date(request.start_date), "dd/MM/yyyy")} →{" "}
                  {format(new Date(request.end_date), "dd/MM/yyyy")}
                </p>
              </div>

              <div className="divide-y divide-border rounded-lg border border-border">
                <div className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="text-muted-foreground">{t("leaves.requestedDays")}</span>
                  <span className="font-medium tabular-nums">
                    {t("leaves.daysUnit", { count: Number(request.requested_days ?? 0) })}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reject-comment">{t("leaves.rejectReasonLabel")}</Label>
                <Textarea
                  id="reject-comment"
                  rows={3}
                  maxLength={500}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={t("leaves.rejectReasonPlaceholder")}
                />
              </div>

              <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {t("leaves.rejectWarning", { name: emp
                  ? `${emp.first_name ?? ""} ${emp.last_name ?? ""}`.trim() || t("leaves.theEmployee")
                  : t("leaves.theEmployee") })}
              </p>
            </div>
          )}
          <DialogActions>
            <Button variant="outline" onClick={onClose} disabled={submitting}>
              {t("leaves.cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={submitting}
              onClick={async () => {
                setSubmitting(true);
                try {
                  await onConfirm(comment);
                } finally {
                  setSubmitting(false);
                }
              }}
            >
              {t("leaves.confirmReject")}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}


function ApproveLeaveDialog({
  request,
  onClose,
  onConfirm,
}: {
  request: any | null;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const TYPE_LABEL = useTypeLabel(t);
  const balanceFn = getEmployeeLeaveBalance;
  const [submitting, setSubmitting] = useState(false);

  const { data: balanceData, isLoading } = useQuery({
    queryKey: ["leave-balance", request?.employee_id],
    queryFn: () => balanceFn({ data: { employeeId: request!.employee_id } }),
    enabled: !!request?.employee_id,
  });

  const balance = balanceData?.balance ?? null;
  const days = Number(request?.requested_days ?? 0);
  const isAnnual = request?.type === "annuel";
  const remaining = balance === null ? null : isAnnual ? balance - days : balance;
  const negative = remaining !== null && remaining < 0;
  const emp = request?.employees;

  return (
    <Dialog open={!!request} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("leaves.approveTitle")}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          {request && (
            <div className="space-y-4">
              <div className="space-y-1 text-sm">
                <p className="font-medium">
                  {emp ? `${emp.first_name ?? ""} ${emp.last_name ?? ""}`.trim() : t("leaves.employeeFallback")}
                </p>
                <p className="text-muted-foreground">
                  {TYPE_LABEL[request.type] ?? request.type} —{" "}
                  {format(new Date(request.start_date), "dd/MM/yyyy")} →{" "}
                  {format(new Date(request.end_date), "dd/MM/yyyy")}
                </p>
              </div>

              <div className="divide-y divide-border rounded-lg border border-border">
                <div className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="text-muted-foreground">{t("leaves.acquiredBalance")}</span>
                  <span className="font-medium tabular-nums">
                    {isLoading || balance === null ? "…" : `${balance} j`}
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="text-muted-foreground">{t("leaves.requestedDays")}</span>
                  <span className="font-medium tabular-nums">{days} j</span>
                </div>
                <div className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="text-muted-foreground">{t("leaves.remainingBalance")}</span>
                  <span
                    className={`font-semibold tabular-nums ${negative ? "text-destructive" : "text-foreground"}`}
                  >
                    {isLoading || remaining === null ? "…" : `${remaining} j`}
                  </span>
                </div>
              </div>

              {!isAnnual && (
                <p className="text-xs text-muted-foreground">
                  Ce type de congé ne débite pas le solde annuel.
                </p>
              )}
              {negative && (
                <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  Le solde deviendra négatif. Le déficit sera récupéré au fur et à mesure sur les
                  acquisitions mensuelles à venir.
                </p>
              )}
            </div>
          )}
          <DialogActions>
            <Button variant="outline" onClick={onClose} disabled={submitting}>
              Annuler
            </Button>
            <Button
              disabled={submitting}
              onClick={async () => {
                setSubmitting(true);
                try {
                  await onConfirm();
                } finally {
                  setSubmitting(false);
                }
              }}
            >
              {t("leaves.confirmApprove")}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}


function NewLeaveDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const TYPE_LABEL = useTypeLabel(t);
  const { org } = useOrg();
  const { myEmployee, ensureMyEmployee } = useMyEmployee();
  const qc = useQueryClient();
  const createFn = createLeaveRequest;
  const computeFn = computeWorkingDays;
  const holidaysFn = listHolidays;
  const balanceFn = getEmployeeLeaveBalance;

  const [type, setType] = useState<"annuel" | "maladie" | "maternite" | "sans_solde">("annuel");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");
  const [days, setDays] = useState<number | null>(null);
  const [computing, setComputing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canCompute = useMemo(() => !!(org && start && end && end >= start), [org, start, end]);

  const { data: holidays = [] } = useQuery({
    queryKey: ["holidays", org?.id],
    queryFn: () => holidaysFn({ data: { organizationId: org!.id } }),
    enabled: !!org,
  });

  const { data: balanceData } = useQuery({
    queryKey: ["leave-balance", myEmployee?.id],
    queryFn: () => balanceFn({ data: { employeeId: myEmployee!.id } }),
    enabled: !!myEmployee?.id,
  });
  const balance = balanceData?.balance ?? null;

  const includedHolidays = useMemo(() => {
    if (!start || !end) return [];
    return (holidays as any[])
      .filter((h) => h.date >= start && h.date <= end)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [holidays, start, end]);

  useEffect(() => {
    if (!canCompute || !org) {
      setDays(null);
      return;
    }
    let cancelled = false;
    setComputing(true);
    const timer = setTimeout(async () => {
      try {
        const res = await computeFn({
          data: { organizationId: org.id, startDate: start, endDate: end },
        });
        if (!cancelled) setDays(res.days);
      } catch {
        if (!cancelled) setDays(null);
      } finally {
        if (!cancelled) setComputing(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      setComputing(false);
    };
  }, [canCompute, org, start, end, computeFn]);

  const submit = async () => {
    if (!org) return;
    setSubmitting(true);
    try {
      const employeeId = myEmployee?.id ?? (await ensureMyEmployee());
      if (!employeeId) return;
      await createFn({
        data: {
          organizationId: org.id,
          employeeId,
          type,
          startDate: start,
          endDate: end,
          reason: reason || null,
        },
      });
      toast.success(t("leaves.requestSent"));
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["leave-requests"] }),
        qc.invalidateQueries({ queryKey: ["leave-balance"] }),
      ]);
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? t("leaves.genericError"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{t("leaves.newLeaveTitle")}</DialogTitle>
      </DialogHeader>
      <DialogBody>
      <div className="grid gap-4">
        <div className="grid gap-1.5">
          <Label>{t("leaves.type")}</Label>
          <Select value={type} onValueChange={(v) => setType(v as any)}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(TYPE_LABEL).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>{t("leaves.startDate")}</Label>
            <Input type="date" className="w-full" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>{t("leaves.endDate")}</Label>
            <Input type="date" className="w-full" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>
        {(() => {
          const parse = (s: string) => {
            const [y, m, d] = s.split("-").map(Number);
            return new Date(y, (m ?? 1) - 1, d ?? 1);
          };
          const holidaySet = new Set((holidays as any[]).map((h) => h.date as string));
          const toIso = (d: Date) =>
            `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          let weekdays = 0;
          if (canCompute) {
            const s = parse(start);
            const e = parse(end);
            for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
              const dow = d.getDay();
              if (dow !== 0 && dow !== 6) weekdays += 1;
            }
          }
          const holidaysCount = includedHolidays.length;
          let returnDate: Date | null = null;
          if (canCompute) {
            const next = parse(end);
            next.setDate(next.getDate() + 1);
            for (let i = 0; i < 30; i++) {
              const dow = next.getDay();
              if (dow !== 0 && dow !== 6 && !holidaySet.has(toIso(next))) {
                returnDate = new Date(next);
                break;
              }
              next.setDate(next.getDate() + 1);
            }
          }
          return (
            <>
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t("leaves.workingDaysLabel")}</span>
                  <span className="font-medium tabular-nums">
                    {!canCompute ? "—" : computing ? t("leaves.computing") : (days ?? "—")}
                  </span>
                </div>
                {canCompute && days !== null && !computing && (
                  <div className="mt-1 text-xs text-muted-foreground tabular-nums">
                    {weekdays} jour{weekdays > 1 ? "s" : ""} ouvré{weekdays > 1 ? "s" : ""}
                    {holidaysCount > 0 ? ` − ${holidaysCount} férié${holidaysCount > 1 ? "s" : ""}` : ""}
                    {" = "}{days} jour{days > 1 ? "s" : ""}
                  </div>
                )}
              </div>
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t("leaves.leaveBalance")}</span>
                  <span className="font-medium tabular-nums">
                    {balance === null ? "—" : `${balance} jour${balance > 1 ? "s" : ""}`}
                  </span>
                </div>
                {type === "annuel" && canCompute && days !== null && !computing && balance !== null && (() => {
                  const remaining = balance - days;
                  const over = remaining < 0;
                  return (
                    <div className="mt-1 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{t("leaves.remainingAfterRequest")}</span>
                      <span className={`font-medium tabular-nums ${over ? "text-destructive" : ""}`}>
                        {over
                          ? `Dépassement de ${Math.abs(remaining)} jour${Math.abs(remaining) > 1 ? "s" : ""}`
                          : `${remaining} jour${remaining > 1 ? "s" : ""}`}
                      </span>
                    </div>
                  );
                })()}
              </div>
              {canCompute && (
                <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm">
                  <span className="text-muted-foreground">{t("leaves.effectiveReturn")}</span>
                  <span className="font-medium tabular-nums">
                    {returnDate ? format(returnDate, "dd/MM/yyyy") : "—"}
                  </span>
                </div>
              )}
              {canCompute && (
                <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm">
                  <div className="mb-1 text-muted-foreground">{t("leaves.holidays")}</div>
                  {includedHolidays.length === 0 ? (
                    <div className="text-xs text-muted-foreground">{t("leaves.noHolidaysInPeriod")}</div>
                  ) : (
                    <ul className="space-y-1">
                      {includedHolidays.map((h) => (
                        <li key={h.id} className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-medium tabular-nums">{format(new Date(h.date), "dd/MM/yyyy")}</span>
                          <span className="text-muted-foreground truncate">{h.name}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </>
          );
        })()}
        <div className="grid gap-1.5">
          <Label>{t("leaves.reason")}</Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
        </div>
      </div>
      <DialogActions>
        <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
        <Button onClick={submit} disabled={!canCompute || computing || submitting}>{t("leaves.send")}</Button>
      </DialogActions>
      </DialogBody>
    </DialogContent>
  );
}
