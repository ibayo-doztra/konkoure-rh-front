import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { Check, X, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { getEmployeeLeaveBalance } from "@/lib/api/legacy-functions";

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "outline" | "destructive" | "success"
> = {
  pending: "secondary",
  approved: "success",
  rejected: "destructive",
  cancelled: "outline",
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-2.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

export function LeaveDetailSheet({
  request,
  canManage,
  isMine,
  onClose,
  onApprove,
  onReject,
  onCancel,
}: {
  request: any | null;
  canManage: boolean;
  isMine: boolean;
  onClose: () => void;
  onApprove: (r: any) => void;
  onReject: (r: any) => void;
  onCancel: (r: any) => void;
}) {
  const { t } = useTranslation();
  const balanceFn = getEmployeeLeaveBalance;

  const TYPE_LABEL: Record<string, string> = {
    annuel: t("leaves.typeAnnuel"),
    maladie: t("leaves.typeMaladie"),
    maternite: t("leaves.typeMaternite"),
    sans_solde: t("leaves.typeSansSolde"),
  };
  const STATUS_LABEL: Record<string, string> = {
    pending: t("leaves.statusPending"),
    approved: t("leaves.statusApproved"),
    rejected: t("leaves.statusRejected"),
    cancelled: t("leaves.statusCancelled"),
  };

  const { data: balanceData, isLoading: balanceLoading } = useQuery({
    queryKey: ["leave-balance", request?.employee_id],
    queryFn: () => balanceFn({ data: { employeeId: request!.employee_id } }),
    enabled: !!request?.employee_id && (canManage || isMine),
  });

  const emp = request?.employees;
  const empName = emp
    ? `${emp.first_name ?? ""} ${emp.last_name ?? ""}`.trim() || t("leaves.employeeFallback")
    : t("leaves.employeeFallback");
  const days = Number(request?.requested_days ?? 0);
  const balance = balanceData?.balance ?? null;
  const isAnnual = request?.type === "annuel";
  const remaining = balance === null ? null : isAnnual ? balance - days : balance;
  const showActions =
    request?.status === "pending" && (canManage || isMine);

  return (
    <Sheet open={!!request} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-md"
      >
        {request && (
          <>
            <SheetHeader className="space-y-2 border-b border-border p-6 text-left">
              <SheetTitle className="truncate">{empName}</SheetTitle>
              <SheetDescription className="flex flex-wrap items-center gap-2">
                {emp?.job_title ? <span>{emp.job_title}</span> : null}
                <Badge variant={STATUS_VARIANT[request.status]}>
                  {STATUS_LABEL[request.status] ?? request.status}
                </Badge>
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 space-y-6 p-6">
              <section className="space-y-2">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("leaves.detailsRequest")}
                </h3>
                <div className="divide-y divide-border rounded-lg border border-border">
                  <Row label={t("leaves.colType")} value={TYPE_LABEL[request.type] ?? request.type} />
                  <Row
                    label={t("leaves.startDate")}
                    value={format(new Date(request.start_date), "dd/MM/yyyy")}
                  />
                  <Row
                    label={t("leaves.endDate")}
                    value={format(new Date(request.end_date), "dd/MM/yyyy")}
                  />
                  <Row
                    label={t("leaves.requestedDays")}
                    value={
                      <span className="tabular-nums">
                        {t("leaves.daysUnit", { count: days })}
                      </span>
                    }
                  />
                  {request.created_at && (
                    <Row
                      label={t("leaves.createdAt")}
                      value={format(new Date(request.created_at), "dd/MM/yyyy HH:mm")}
                    />
                  )}
                </div>
              </section>

              {(canManage || isMine) && (
                <section className="space-y-2">
                  <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t("leaves.detailsBalance")}
                  </h3>
                  <div className="divide-y divide-border rounded-lg border border-border">
                    <Row
                      label={t("leaves.acquiredBalance")}
                      value={
                        <span className="tabular-nums">
                          {balanceLoading || balance === null ? "…" : `${balance} j`}
                        </span>
                      }
                    />
                    <Row
                      label={t("leaves.requestedDays")}
                      value={<span className="tabular-nums">{days} j</span>}
                    />
                    <Row
                      label={t("leaves.remainingBalance")}
                      value={
                        <span
                          className={`tabular-nums ${
                            remaining !== null && remaining < 0
                              ? "text-destructive"
                              : "text-foreground"
                          }`}
                        >
                          {balanceLoading || remaining === null ? "…" : `${remaining} j`}
                        </span>
                      }
                    />
                  </div>
                  {!isAnnual && (
                    <p className="text-xs text-muted-foreground">{t("leaves.nonAnnualHint")}</p>
                  )}
                </section>
              )}

              <section className="space-y-2">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("leaves.detailsReason")}
                </h3>
                <p className="whitespace-pre-wrap rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-foreground">
                  {request.reason?.trim() ? request.reason : t("leaves.noReason")}
                </p>
              </section>

              {(request.status === "approved" || request.status === "rejected") && (
                <section className="space-y-2">
                  <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t("leaves.detailsDecision")}
                  </h3>
                  <div className="divide-y divide-border rounded-lg border border-border">
                    <Row
                      label={t("leaves.colStatus")}
                      value={STATUS_LABEL[request.status] ?? request.status}
                    />
                    {request.decided_at && (
                      <Row
                        label={t("leaves.decidedAt")}
                        value={format(new Date(request.decided_at), "dd/MM/yyyy HH:mm")}
                      />
                    )}
                    {request.status === "rejected" && request.decision_comment?.trim() && (
                      <div className="space-y-1 px-4 py-2.5 text-sm">
                        <span className="text-muted-foreground">
                          {t("leaves.decisionComment")}
                        </span>
                        <p className="whitespace-pre-wrap text-foreground">
                          {request.decision_comment}
                        </p>
                      </div>
                    )}
                  </div>
                </section>
              )}
            </div>

            {showActions && (
              <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t border-border bg-background p-4">
                {canManage && (
                  <>
                    <Button variant="outlineDanger" onClick={() => onReject(request)}>
                      <X className="mr-1 h-4 w-4" /> {t("leaves.reject")}
                    </Button>
                    <Button onClick={() => onApprove(request)}>
                      <Check className="mr-1 h-4 w-4" /> {t("leaves.approve")}
                    </Button>
                  </>
                )}
                {isMine && (
                  <Button variant="outline" onClick={() => onCancel(request)}>
                    <Trash2 className="mr-1 h-4 w-4" /> {t("leaves.cancel")}
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
