import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { Check, Eye, Paperclip, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { apiErrorMessage } from "@/lib/api/client";
import { openSignedUrl } from "@/lib/signed-url";
import {
  BALANCE_TYPES,
  leaveAttachmentUrl,
  leaveQuery,
  leavesKey,
  uploadLeaveAttachment,
  LEAVE_STATUS_VARIANT,
  type LeaveRow,
} from "@/lib/api/leaves";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-2.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

export function LeaveDetailSheet({
  organizationId,
  request,
  canDecide,
  canCancel,
  canAttach,
  onClose,
  onApprove,
  onReject,
  onCancel,
}: {
  organizationId: string;
  request: LeaveRow | null;
  canDecide: boolean;
  canCancel: boolean;
  canAttach: boolean;
  onClose: () => void;
  onApprove: (r: LeaveRow) => void;
  onReject: (r: LeaveRow) => void;
  onCancel: (r: LeaveRow) => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);

  // The detail adds the balance once this request is counted.
  const detail = useQuery({
    ...leaveQuery(organizationId, request?.id ?? ""),
    enabled: !!request,
  });

  const upload = useMutation({
    mutationFn: (file: File) => uploadLeaveAttachment(request!.id, file),
    onSuccess: () => {
      toast.success(t("leaves.attachmentUploaded"));
      void queryClient.invalidateQueries({ queryKey: leavesKey(organizationId) });
    },
    onError: (error) =>
      toast.error(t("leaves.attachmentError"), { description: apiErrorMessage(error) }),
  });

  const current = request ? { ...request, ...detail.data } : null;
  const days = current?.requestedDays ?? 0;
  const withBalance = !!current && BALANCE_TYPES.includes(current.type);
  const balanceAfter = detail.data?.balanceAfter ?? null;
  // A pending request is already deducted from `balanceAfter`.
  const balanceBefore =
    balanceAfter === null
      ? null
      : current?.status === "pending"
        ? balanceAfter + days
        : balanceAfter;

  const onFile = (file: File | undefined) => {
    if (fileInput.current) fileInput.current.value = "";
    if (!file) return;
    if (file.size > ATTACHMENT_MAX_BYTES) {
      toast.error(t("leaves.attachmentTooLarge"));
      return;
    }
    upload.mutate(file);
  };

  const showActions = canDecide || canCancel;

  return (
    <Sheet open={!!request} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-md"
      >
        {current && (
          <>
            <SheetHeader className="space-y-2 border-b border-border p-6 text-left">
              <SheetTitle className="truncate">
                {current.employeeName || t("leaves.employeeFallback")}
              </SheetTitle>
              <SheetDescription className="flex flex-wrap items-center gap-2">
                {current.jobTitle ? <span>{current.jobTitle}</span> : null}
                <Badge variant={LEAVE_STATUS_VARIANT[current.status]}>
                  {t(`leaves.status${current.status[0].toUpperCase()}${current.status.slice(1)}`)}
                </Badge>
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 space-y-6 p-6">
              <section className="space-y-2">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("leaves.detailsRequest")}
                </h3>
                <div className="divide-y divide-border rounded-lg border border-border">
                  <Row label={t("leaves.colType")} value={t(`leaves.types.${current.type}`)} />
                  <Row
                    label={t("leaves.startDate")}
                    value={`${format(new Date(current.startDate), "dd/MM/yyyy")}${
                      current.halfDayStart ? ` · ${t("leaves.halfDayStart")}` : ""
                    }`}
                  />
                  <Row
                    label={t("leaves.endDate")}
                    value={`${format(new Date(current.endDate), "dd/MM/yyyy")}${
                      current.halfDayEnd ? ` · ${t("leaves.halfDayEnd")}` : ""
                    }`}
                  />
                  <Row
                    label={t("leaves.requestedDays")}
                    value={
                      <span className="tabular-nums">{t("leaves.daysUnit", { count: days })}</span>
                    }
                  />
                  <Row
                    label={t("leaves.createdAt")}
                    value={format(new Date(current.createdAt), "dd/MM/yyyy HH:mm")}
                  />
                </div>
              </section>

              <section className="space-y-2">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("leaves.detailsBalance")}
                </h3>
                {withBalance ? (
                  <div className="divide-y divide-border rounded-lg border border-border">
                    <Row
                      label={t("leaves.balanceBefore")}
                      value={
                        <span className="tabular-nums">
                          {balanceBefore === null
                            ? "…"
                            : t("leaves.daysUnit", { count: balanceBefore })}
                        </span>
                      }
                    />
                    <Row
                      label={t("leaves.requestedDays")}
                      value={
                        <span className="tabular-nums">
                          {t("leaves.daysUnit", { count: days })}
                        </span>
                      }
                    />
                    <Row
                      label={t("leaves.remainingBalance")}
                      value={
                        <span
                          className={`tabular-nums ${
                            balanceAfter !== null && balanceAfter < 0
                              ? "text-destructive"
                              : "text-foreground"
                          }`}
                        >
                          {balanceAfter === null
                            ? "…"
                            : t("leaves.daysUnit", { count: balanceAfter })}
                        </span>
                      }
                    />
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">{t("leaves.nonAnnualHint")}</p>
                )}
              </section>

              <section className="space-y-2">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("leaves.detailsReason")}
                </h3>
                <p className="whitespace-pre-wrap rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-foreground">
                  {current.reason?.trim() ? current.reason : t("leaves.noReason")}
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("leaves.attachment")}
                </h3>
                <div className="flex flex-wrap items-center gap-2">
                  {current.hasAttachment ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        void openSignedUrl(
                          () => leaveAttachmentUrl(current.id),
                          (error) =>
                            toast.error(t("leaves.attachmentError"), {
                              description: apiErrorMessage(error),
                            }),
                        )
                      }
                    >
                      <Eye className="mr-1 h-4 w-4" /> {t("leaves.viewAttachment")}
                    </Button>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      {t("leaves.noAttachment")}
                    </span>
                  )}
                  {canAttach && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInput.current?.click()}
                      disabled={upload.isPending}
                    >
                      <Paperclip className="mr-1 h-4 w-4" /> {t("leaves.attach")}
                    </Button>
                  )}
                </div>
                {canAttach && (
                  <p className="text-xs text-muted-foreground">{t("leaves.attachmentHint")}</p>
                )}
                <input
                  ref={fileInput}
                  type="file"
                  accept="application/pdf,image/png,image/jpeg,image/webp"
                  className="hidden"
                  aria-label={t("leaves.attach")}
                  onChange={(e) => onFile(e.target.files?.[0])}
                />
              </section>

              {(current.status === "approved" || current.status === "rejected") && (
                <section className="space-y-2">
                  <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t("leaves.detailsDecision")}
                  </h3>
                  <div className="divide-y divide-border rounded-lg border border-border">
                    {current.decidedAt && (
                      <Row
                        label={t("leaves.decidedAt")}
                        value={format(new Date(current.decidedAt), "dd/MM/yyyy HH:mm")}
                      />
                    )}
                    {current.decisionComment?.trim() && (
                      <div className="space-y-1 px-4 py-2.5 text-sm">
                        <span className="text-muted-foreground">{t("leaves.decisionComment")}</span>
                        <p className="whitespace-pre-wrap text-foreground">
                          {current.decisionComment}
                        </p>
                      </div>
                    )}
                  </div>
                </section>
              )}
            </div>

            {showActions && (
              <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t border-border bg-background p-4">
                {canCancel && (
                  <Button variant="outline" onClick={() => onCancel(current)}>
                    <Trash2 className="mr-1 h-4 w-4" /> {t("leaves.cancel")}
                  </Button>
                )}
                {canDecide && (
                  <>
                    <Button variant="outlineDanger" onClick={() => onReject(current)}>
                      <X className="mr-1 h-4 w-4" /> {t("leaves.reject")}
                    </Button>
                    <Button onClick={() => onApprove(current)}>
                      <Check className="mr-1 h-4 w-4" /> {t("leaves.approve")}
                    </Button>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
