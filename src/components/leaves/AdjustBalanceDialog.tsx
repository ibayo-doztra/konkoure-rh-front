import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { apiErrorMessage } from "@/lib/api/client";
import { hrKey } from "@/lib/api/hr";
import { adjustLeaveBalance, BALANCE_TYPES, leavesKey, type LeaveType } from "@/lib/api/leaves";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import { Textarea } from "@/components/ui/textarea";

const MAX_DELTA = 365;

/** Manual correction of a leave balance by owner or hr_admin (06 §7), for the current year. */
export function AdjustBalanceDialog({
  organizationId,
  employeeId,
  employeeName,
  onClose,
}: {
  organizationId: string;
  employeeId: string;
  employeeName: string;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [leaveType, setLeaveType] = useState<LeaveType>("annual");
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");

  const deltaDays = Number(delta.replace(",", "."));
  const deltaValid =
    delta.trim() !== "" &&
    Number.isFinite(deltaDays) &&
    deltaDays !== 0 &&
    Math.abs(deltaDays) <= MAX_DELTA &&
    Math.round(deltaDays * 100) === deltaDays * 100;
  const reasonValid = reason.trim().length >= 5;

  const save = useMutation({
    mutationFn: () =>
      adjustLeaveBalance({ employeeId, leaveType, deltaDays, reason: reason.trim() }),
    onSuccess: (balance) => {
      toast.success(
        t("leaves.adjust.saved", { balance: balance.balance.toLocaleString(i18n.language) }),
      );
      onClose();
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: leavesKey(organizationId) }),
        queryClient.invalidateQueries({ queryKey: [...hrKey(organizationId), "employees"] }),
      ]);
    },
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (deltaValid && reasonValid) save.mutate();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("leaves.adjust.title")}</DialogTitle>
          <DialogDescription>
            {t("leaves.adjust.description", { name: employeeName, year: new Date().getFullYear() })}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="adjust-type">{t("leaves.adjust.type")}</Label>
                <Select value={leaveType} onValueChange={(v) => setLeaveType(v as LeaveType)}>
                  <SelectTrigger id="adjust-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BALANCE_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {t(`leaves.types.${type}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="adjust-delta">{t("leaves.adjust.delta")}</Label>
                <Input
                  id="adjust-delta"
                  inputMode="decimal"
                  required
                  placeholder="+2 / -1,5"
                  aria-invalid={(delta !== "" && !deltaValid) || undefined}
                  aria-describedby="adjust-delta-hint"
                  value={delta}
                  onChange={(e) => setDelta(e.target.value)}
                />
                <p id="adjust-delta-hint" className="text-xs text-muted-foreground">
                  {t("leaves.adjust.deltaHint", { max: MAX_DELTA })}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="adjust-reason">{t("leaves.adjust.reason")}</Label>
              <Textarea
                id="adjust-reason"
                required
                minLength={5}
                maxLength={500}
                rows={3}
                placeholder={t("leaves.adjust.reasonPlaceholder")}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">{t("leaves.adjust.audited")}</p>
            </div>
            {save.error && (
              <p role="alert" className="text-sm text-destructive">
                {apiErrorMessage(save.error)}
              </p>
            )}
            <DialogActions>
              <Button type="button" variant="outline" onClick={onClose}>
                {t("leaves.adjust.cancel")}
              </Button>
              <Button type="submit" disabled={!deltaValid || !reasonValid || save.isPending}>
                {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("leaves.adjust.submit")}
              </Button>
            </DialogActions>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
