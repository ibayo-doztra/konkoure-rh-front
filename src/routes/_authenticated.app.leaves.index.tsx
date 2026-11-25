import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { Check, Eye, Plus, Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { apiErrorMessage, newIdempotencyKey } from "@/lib/api/client";
import { allEmployeesQuery, hrKey } from "@/lib/api/hr";
import {
  approveLeave,
  BALANCE_TYPES,
  cancelLeave,
  createLeave,
  estimateLeaveDays,
  holidaysQuery,
  LEAVE_TYPES,
  leaveBalancesQuery,
  leaveQuery,
  leavesKey,
  leavesQuery,
  rejectLeave,
  LEAVE_STATUS_VARIANT,
  type LeaveRow,
  type LeaveStatus,
  type LeaveType,
} from "@/lib/api/leaves";
import { LeaveDetailSheet } from "@/components/leaves/LeaveDetailSheet";
import { ListPager, useClampedPage } from "@/components/ListPager";
import { PageHeader } from "@/components/PageHeader";
import { ResponsiveTable } from "@/components/ResponsiveTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useOrg } from "@/hooks/useOrg";
import { useRole } from "@/hooks/useRole";
import { useMyEmployee } from "@/hooks/useMyEmployee";
import { useCountUp, formatDayCount } from "@/hooks/useCountUp";

export const Route = createFileRoute("/_authenticated/app/leaves/")({
  component: LeavesPage,
});

type Filter = "all" | "mine" | "pending";

const fmt = (date: string) => format(new Date(date), "dd/MM/yyyy");
const todayIso = () => new Date().toISOString().slice(0, 10);
const statusKey = (s: LeaveStatus) => `leaves.status${s[0].toUpperCase()}${s.slice(1)}`;

/** Refreshes the leave screens and the employee records (their balance). */
function useRefresh(organizationId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: leavesKey(organizationId) }),
      queryClient.invalidateQueries({ queryKey: hrKey(organizationId) }),
    ]);
}

function LeavesPage() {
  const { t, i18n } = useTranslation();
  const { org } = useOrg();
  const { roles, isAdmin } = useRole();
  const { myEmployee } = useMyEmployee();
  const organizationId = org?.id ?? "";
  const refresh = useRefresh(organizationId);
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [toApprove, setToApprove] = useState<LeaveRow | null>(null);
  const [toReject, setToReject] = useState<LeaveRow | null>(null);
  const [toCancel, setToCancel] = useState<LeaveRow | null>(null);
  const [detail, setDetail] = useState<LeaveRow | null>(null);

  // Owner, hr_admin and managers decide; the API limits managers to their team.
  const decider = isAdmin || roles.includes("manager");
  const myId = myEmployee?.id;

  const leaves = useQuery({
    ...leavesQuery(organizationId, {
      page,
      status: filter === "pending" ? "pending" : undefined,
      employeeId: filter === "mine" ? myId : undefined,
    }),
    enabled: !!org && (filter !== "mine" || !!myId),
  });
  const lastPage = leaves.data?.meta.lastPage ?? 1;
  useClampedPage(lastPage, page, setPage);

  // Names come from the employees the reader may see (team for a manager, self otherwise).
  const employees = useQuery({ ...allEmployeesQuery(organizationId), enabled: !!org });
  const rows = useMemo<LeaveRow[]>(() => {
    const byId = new Map((employees.data ?? []).map((e) => [e.id, e]));
    return (leaves.data?.data ?? []).map((leave) => {
      const employee = byId.get(leave.employeeId);
      return {
        ...leave,
        employeeName: employee ? `${employee.firstName} ${employee.lastName}` : "",
        jobTitle: employee?.jobTitle ?? null,
      };
    });
  }, [leaves.data, employees.data]);

  const balances = useQuery({
    ...leaveBalancesQuery(organizationId, myId ?? ""),
    enabled: !!org && !!myId,
  });
  const annual = balances.data?.find((b) => b.leaveType === "annual");
  const animatedBalance = useCountUp(annual?.balance ?? null);
  const animatedPending = useCountUp(annual?.pendingDays ?? 0);

  const canDecide = (r: LeaveRow) => decider && r.status === "pending" && r.employeeId !== myId;
  const canCancel = (r: LeaveRow) =>
    (r.status === "pending" && (r.employeeId === myId || decider)) ||
    (r.status === "approved" && isAdmin && r.startDate > todayIso());
  const canAttach = (r: LeaveRow) => isAdmin || (r.employeeId === myId && r.status === "pending");

  const decision = (success: string) => ({
    onSuccess: () => {
      toast.success(success);
      void refresh();
    },
    onError: (error: unknown) =>
      toast.error(t("leaves.genericError"), { description: apiErrorMessage(error) }),
  });
  const approve = useMutation({
    mutationFn: (id: string) => approveLeave(id),
    ...decision(t("leaves.approved")),
  });
  const reject = useMutation({
    mutationFn: ({ id, comment }: { id: string; comment: string }) => rejectLeave(id, comment),
    ...decision(t("leaves.rejected")),
  });
  const cancel = useMutation({
    mutationFn: (id: string) => cancelLeave(id),
    ...decision(t("leaves.cancelled")),
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("leaves.title")}
        description={t("leaves.description")}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-1 h-4 w-4" /> {t("leaves.newRequest")}
              </Button>
            </DialogTrigger>
            {open && <NewLeaveDialog onClose={() => setOpen(false)} />}
          </Dialog>
        }
      />

      {myId && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-x-10 gap-y-3 py-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("leaves.myBalance")}
              </p>
              <p className="mt-0.5 text-2xl font-semibold tabular-nums" data-testid="my-balance">
                {/* A balance is opened by the API on the first request of the year. */}
                {balances.isPending
                  ? "…"
                  : annual === undefined
                    ? "—"
                    : t("leaves.daysUnit", {
                        count: formatDayCount(animatedBalance, i18n.language),
                      })}
              </p>
            </div>
            {(annual?.pendingDays ?? 0) > 0 && (
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
            onValueChange={(v) => {
              setFilter(v as Filter);
              setPage(1);
            }}
            className="w-full min-w-0 sm:w-auto"
          >
            <TabsList className="w-full justify-start overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:w-auto">
              <TabsTrigger value="all" className="shrink-0">
                {t("leaves.tabAll")}
              </TabsTrigger>
              <TabsTrigger value="pending" className="shrink-0">
                {t("leaves.tabPending")}
              </TabsTrigger>
              {myId && (
                <TabsTrigger value="mine" className="shrink-0">
                  {t("leaves.tabMine")}
                </TabsTrigger>
              )}
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          <ResponsiveTable
            data={rows}
            getRowKey={(r) => r.id}
            onRowClick={(r) => setDetail(r)}
            empty={t("leaves.empty")}
            columns={[
              {
                key: "employee",
                header: t("leaves.colEmployee"),
                priority: "primary",
                cell: (r) => r.employeeName || "—",
              },
              {
                key: "type",
                header: t("leaves.colType"),
                cell: (r) => t(`leaves.types.${r.type}`),
              },
              {
                key: "period",
                header: t("leaves.colPeriod"),
                className: "whitespace-nowrap",
                cell: (r) => (
                  <span className="whitespace-nowrap">
                    {fmt(r.startDate)} → {fmt(r.endDate)}
                  </span>
                ),
              },
              {
                key: "days",
                header: t("leaves.colDays"),
                align: "right",
                className: "text-right tabular-nums",
                cell: (r) => formatDayCount(r.requestedDays, i18n.language),
              },
              {
                key: "status",
                header: t("leaves.colStatus"),
                cell: (r) => (
                  <Badge variant={LEAVE_STATUS_VARIANT[r.status]}>{t(statusKey(r.status))}</Badge>
                ),
              },
              {
                key: "actions",
                header: "",
                priority: "actions",
                align: "right",
                cell: (r) => {
                  const stop = (fn: () => void) => (e: React.MouseEvent) => {
                    e.stopPropagation();
                    fn();
                  };
                  return (
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={stop(() => setDetail(r))}
                        title={t("leaves.details")}
                        aria-label={t("leaves.details")}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {canDecide(r) && (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={stop(() => setToApprove(r))}
                            title={t("leaves.approve")}
                            aria-label={t("leaves.approve")}
                          >
                            <Check className="h-4 w-4 text-primary" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={stop(() => setToReject(r))}
                            title={t("leaves.reject")}
                            aria-label={t("leaves.reject")}
                          >
                            <X className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                      {canCancel(r) && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={stop(() => setToCancel(r))}
                          title={t("leaves.cancel")}
                          aria-label={t("leaves.cancel")}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  );
                },
              },
            ]}
          />
          <ListPager page={page} lastPage={lastPage} onChange={setPage} />
        </CardContent>
      </Card>

      <LeaveDetailSheet
        organizationId={organizationId}
        request={detail}
        canDecide={!!detail && canDecide(detail)}
        canCancel={!!detail && canCancel(detail)}
        canAttach={!!detail && canAttach(detail)}
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
        organizationId={organizationId}
        request={toApprove}
        onClose={() => setToApprove(null)}
        onConfirm={async () => {
          if (toApprove) await approve.mutateAsync(toApprove.id).catch(() => undefined);
          setToApprove(null);
        }}
      />

      <RejectLeaveDialog
        request={toReject}
        onClose={() => setToReject(null)}
        onConfirm={async (comment) => {
          if (toReject) {
            await reject.mutateAsync({ id: toReject.id, comment }).catch(() => undefined);
          }
          setToReject(null);
        }}
      />

      <CancelLeaveDialog
        request={toCancel}
        onClose={() => setToCancel(null)}
        onConfirm={async () => {
          if (toCancel) await cancel.mutateAsync(toCancel.id).catch(() => undefined);
          setToCancel(null);
        }}
      />
    </div>
  );
}

function RequestSummary({ request }: { request: LeaveRow }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <div className="space-y-1 text-sm">
        <p className="font-medium">{request.employeeName || t("leaves.employeeFallback")}</p>
        <p className="text-muted-foreground">
          {t(`leaves.types.${request.type}`)} — {fmt(request.startDate)} → {fmt(request.endDate)}
        </p>
      </div>
      <div className="divide-y divide-border rounded-lg border border-border">
        <div className="flex items-center justify-between px-4 py-2.5 text-sm">
          <span className="text-muted-foreground">{t("leaves.requestedDays")}</span>
          <span className="font-medium tabular-nums">
            {t("leaves.daysUnit", { count: request.requestedDays })}
          </span>
        </div>
      </div>
    </div>
  );
}

function ConfirmButton({
  onConfirm,
  disabled,
  variant,
  children,
}: {
  onConfirm: () => Promise<void>;
  disabled?: boolean;
  variant?: "default" | "destructive";
  children: React.ReactNode;
}) {
  const [submitting, setSubmitting] = useState(false);
  return (
    <Button
      variant={variant}
      disabled={submitting || disabled}
      onClick={async () => {
        setSubmitting(true);
        try {
          await onConfirm();
        } finally {
          setSubmitting(false);
        }
      }}
    >
      {children}
    </Button>
  );
}

function CancelLeaveDialog({
  request,
  onClose,
  onConfirm,
}: {
  request: LeaveRow | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={!!request} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("leaves.cancelTitle")}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          {request && (
            <div className="space-y-4">
              <RequestSummary request={request} />
              <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {t("leaves.cancelWarning")}
              </p>
            </div>
          )}
          <DialogActions>
            <Button variant="outline" onClick={onClose}>
              {t("leaves.back")}
            </Button>
            <ConfirmButton variant="destructive" onConfirm={onConfirm}>
              {t("leaves.confirmCancel")}
            </ConfirmButton>
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
  request: LeaveRow | null;
  onClose: () => void;
  onConfirm: (comment: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (request) setComment("");
  }, [request]);

  const valid = comment.trim().length >= 5;

  return (
    <Dialog open={!!request} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("leaves.rejectTitle")}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          {request && (
            <div className="space-y-4">
              <RequestSummary request={request} />
              <div className="space-y-2">
                <Label htmlFor="reject-comment">{t("leaves.rejectReasonLabel")}</Label>
                <Textarea
                  id="reject-comment"
                  rows={3}
                  maxLength={1000}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={t("leaves.rejectReasonPlaceholder")}
                />
                {comment.length > 0 && !valid && (
                  <p className="text-xs text-destructive">{t("leaves.rejectReasonMin")}</p>
                )}
              </div>
              <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {t("leaves.rejectWarning", {
                  name: request.employeeName || t("leaves.theEmployee"),
                })}
              </p>
            </div>
          )}
          <DialogActions>
            <Button variant="outline" onClick={onClose}>
              {t("leaves.cancel")}
            </Button>
            <ConfirmButton
              variant="destructive"
              disabled={!valid}
              onConfirm={() => onConfirm(comment.trim())}
            >
              {t("leaves.confirmReject")}
            </ConfirmButton>
          </DialogActions>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

function ApproveLeaveDialog({
  organizationId,
  request,
  onClose,
  onConfirm,
}: {
  organizationId: string;
  request: LeaveRow | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const detail = useQuery({
    ...leaveQuery(organizationId, request?.id ?? ""),
    enabled: !!request,
  });
  const withBalance = !!request && BALANCE_TYPES.includes(request.type);
  const after = detail.data?.balanceAfter ?? null;
  const days = request?.requestedDays ?? 0;

  return (
    <Dialog open={!!request} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("leaves.approveTitle")}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          {request && (
            <div className="space-y-4">
              <RequestSummary request={request} />
              {withBalance ? (
                <div className="divide-y divide-border rounded-lg border border-border">
                  <div className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span className="text-muted-foreground">{t("leaves.balanceBefore")}</span>
                    <span className="font-medium tabular-nums">
                      {after === null ? "…" : t("leaves.daysUnit", { count: after + days })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span className="text-muted-foreground">{t("leaves.remainingBalance")}</span>
                    <span
                      className={`font-semibold tabular-nums ${after !== null && after < 0 ? "text-destructive" : "text-foreground"}`}
                    >
                      {after === null ? "…" : t("leaves.daysUnit", { count: after })}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">{t("leaves.nonAnnualHint")}</p>
              )}
            </div>
          )}
          <DialogActions>
            <Button variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <ConfirmButton onConfirm={onConfirm}>{t("leaves.confirmApprove")}</ConfirmButton>
          </DialogActions>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

function NewLeaveDialog({ onClose }: { onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const { org } = useOrg();
  const { isAdmin } = useRole();
  const { myEmployee } = useMyEmployee();
  const organizationId = org?.id ?? "";
  const refresh = useRefresh(organizationId);
  const idempotencyKey = useRef(newIdempotencyKey());

  const [employeeId, setEmployeeId] = useState(myEmployee?.id ?? "");
  const [type, setType] = useState<LeaveType>("annual");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [halfDayStart, setHalfDayStart] = useState(false);
  const [halfDayEnd, setHalfDayEnd] = useState(false);
  const [reason, setReason] = useState("");

  const validRange = !!start && !!end && end >= start;
  const year = Number((start || todayIso()).slice(0, 4));

  // Owner and hr_admin may file a request for any employee.
  const employees = useQuery({ ...allEmployeesQuery(organizationId), enabled: !!org && isAdmin });
  const holidays = useQuery({ ...holidaysQuery(organizationId, year), enabled: !!org });
  const balances = useQuery({
    ...leaveBalancesQuery(organizationId, employeeId),
    enabled: !!org && !!employeeId,
  });

  const holidayDates = useMemo(
    () => new Set((holidays.data ?? []).map((h) => h.date)),
    [holidays.data],
  );
  const includedHolidays = useMemo(
    () =>
      validRange
        ? (holidays.data ?? [])
            .filter((h) => h.date >= start && h.date <= end)
            .sort((a, b) => a.date.localeCompare(b.date))
        : [],
    [holidays.data, start, end, validRange],
  );
  const estimate = validRange
    ? estimateLeaveDays(start, end, holidayDates, halfDayStart, halfDayEnd)
    : null;
  const withBalance = BALANCE_TYPES.includes(type);
  const balance = balances.data?.find((b) => b.leaveType === type)?.balance ?? null;

  const returnDate = useMemo(() => {
    if (!validRange) return null;
    const next = new Date(`${end}T00:00:00Z`);
    for (let i = 0; i < 30; i++) {
      next.setUTCDate(next.getUTCDate() + 1);
      const dow = next.getUTCDay();
      if (dow !== 0 && dow !== 6 && !holidayDates.has(next.toISOString().slice(0, 10))) {
        return next.toISOString().slice(0, 10);
      }
    }
    return null;
  }, [end, validRange, holidayDates]);

  const create = useMutation({
    mutationFn: () =>
      createLeave(
        {
          employeeId: isAdmin && employeeId !== myEmployee?.id ? employeeId : undefined,
          type,
          startDate: start,
          endDate: end,
          halfDayStart,
          halfDayEnd,
          reason: reason.trim() || undefined,
        },
        idempotencyKey.current,
      ),
    onSuccess: () => {
      toast.success(t("leaves.requestSent"));
      void refresh();
      onClose();
    },
    onError: (error) => {
      // A refused request may be corrected and sent again: it needs a new key.
      idempotencyKey.current = newIdempotencyKey();
      toast.error(t("leaves.genericError"), { description: apiErrorMessage(error) });
    },
  });

  const days = (n: number) => t("leaves.daysUnit", { count: formatDayCount(n, i18n.language) });

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{t("leaves.newLeaveTitle")}</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <div className="grid gap-4">
          {isAdmin && (
            <div className="grid gap-1.5">
              <Label>{t("leaves.forEmployee")}</Label>
              <Select value={employeeId} onValueChange={setEmployeeId}>
                <SelectTrigger className="w-full" aria-label={t("leaves.forEmployee")}>
                  <SelectValue placeholder={t("leaves.chooseEmployee")} />
                </SelectTrigger>
                <SelectContent>
                  {(employees.data ?? [])
                    .filter((e) => e.status !== "terminated")
                    .map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.firstName} {e.lastName}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {!myEmployee && (
                <p className="text-xs text-muted-foreground">{t("leaves.noEmployeeRecord")}</p>
              )}
            </div>
          )}
          <div className="grid gap-1.5">
            <Label>{t("leaves.type")}</Label>
            <Select value={type} onValueChange={(v) => setType(v as LeaveType)}>
              <SelectTrigger className="w-full" aria-label={t("leaves.type")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEAVE_TYPES.map((k) => (
                  <SelectItem key={k} value={k}>
                    {t(`leaves.types.${k}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="leave-start">{t("leaves.startDate")}</Label>
              <Input
                id="leave-start"
                type="date"
                className="w-full"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox
                  checked={halfDayStart}
                  onCheckedChange={(v) => setHalfDayStart(v === true)}
                />
                {t("leaves.halfDayStart")}
              </label>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="leave-end">{t("leaves.endDate")}</Label>
              <Input
                id="leave-end"
                type="date"
                className="w-full"
                value={end}
                min={start || undefined}
                onChange={(e) => setEnd(e.target.value)}
              />
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox checked={halfDayEnd} onCheckedChange={(v) => setHalfDayEnd(v === true)} />
                {t("leaves.halfDayEnd")}
              </label>
            </div>
          </div>

          <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t("leaves.workingDaysLabel")}</span>
              <span className="font-medium tabular-nums">
                {estimate === null ? "—" : days(estimate)}
              </span>
            </div>
            {estimate !== null && (
              <p className="mt-1 text-xs text-muted-foreground">
                {t("leaves.estimatedDays", { count: estimate })}
              </p>
            )}
          </div>

          {withBalance && employeeId && (
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("leaves.leaveBalance")}</span>
                <span className="font-medium tabular-nums">
                  {balance === null ? "—" : days(balance)}
                </span>
              </div>
              {estimate !== null && balance !== null && (
                <div className="mt-1 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{t("leaves.remainingAfterRequest")}</span>
                  <span
                    className={`font-medium tabular-nums ${balance - estimate < 0 ? "text-destructive" : ""}`}
                  >
                    {balance - estimate < 0
                      ? t("leaves.overBalance", {
                          count: formatDayCount(estimate - balance, i18n.language),
                        })
                      : days(balance - estimate)}
                  </span>
                </div>
              )}
            </div>
          )}

          {validRange && (
            <>
              <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm">
                <span className="text-muted-foreground">{t("leaves.effectiveReturn")}</span>
                <span className="font-medium tabular-nums">
                  {returnDate ? fmt(returnDate) : "—"}
                </span>
              </div>
              <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm">
                <div className="mb-1 text-muted-foreground">{t("leaves.holidays")}</div>
                {includedHolidays.length === 0 ? (
                  <div className="text-xs text-muted-foreground">
                    {t("leaves.noHolidaysInPeriod")}
                  </div>
                ) : (
                  <ul className="space-y-1">
                    {includedHolidays.map((h) => (
                      <li key={h.id} className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-medium tabular-nums">{fmt(h.date)}</span>
                        <span className="truncate text-muted-foreground">{h.name}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="leave-reason">{t("leaves.reason")}</Label>
            <Textarea
              id="leave-reason"
              value={reason}
              maxLength={1000}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogActions>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={() => create.mutate()}
            disabled={!validRange || !employeeId || create.isPending}
          >
            {t("leaves.send")}
          </Button>
        </DialogActions>
      </DialogBody>
    </DialogContent>
  );
}
