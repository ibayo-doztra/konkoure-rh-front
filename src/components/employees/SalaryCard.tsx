import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff, Loader2, Pencil, Wallet } from "lucide-react";
import { toast } from "sonner";
import { apiErrorMessage, isApiError } from "@/lib/api/client";
import { employeeSalaryQuery, updateEmployee, type EmployeeSalary } from "@/lib/api/hr";
import { formatCurrency } from "@/lib/currency";
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

const DEFAULT_CURRENCY = "GNF";
const MAX_SALARY = 1_000_000_000;

interface Props {
  organizationId: string;
  employeeId: string;
  /** Owner and hr_admin change the base salary; the employee only reads it. */
  canEdit: boolean;
}

/** Base salary of an employee, read on demand because each read is audited (06 §4). */
export function SalaryCard({ organizationId, employeeId, canEdit }: Props) {
  const { t, i18n } = useTranslation();
  const [revealed, setRevealed] = useState(false);
  const [editing, setEditing] = useState(false);
  const salary = useQuery({
    ...employeeSalaryQuery(organizationId, employeeId),
    enabled: revealed,
  });
  const locale = i18n.language?.startsWith("en") ? "en-US" : "fr-FR";

  let content;
  if (!revealed) {
    content = (
      <span className="text-3xl font-semibold tracking-widest text-muted-foreground">•••••</span>
    );
  } else if (salary.isPending) {
    content = <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />;
  } else if (salary.error) {
    content = (
      <p className="text-sm text-destructive">
        {isApiError(salary.error, "E_FORBIDDEN")
          ? t("employee.salary.forbidden")
          : apiErrorMessage(salary.error)}
      </p>
    );
  } else if (salary.data.baseSalary === null) {
    content = (
      <p className="text-sm text-muted-foreground" data-testid="base-salary">
        {t("employee.salary.none")}
      </p>
    );
  } else {
    content = (
      <p className="text-3xl font-semibold tabular-nums text-foreground" data-testid="base-salary">
        {formatCurrency(
          salary.data.baseSalary,
          salary.data.salaryCurrency ?? DEFAULT_CURRENCY,
          locale,
        )}
      </p>
    );
  }

  return (
    <div className="rounded-[10px] border border-border bg-card p-6 text-card-foreground shadow-sm">
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Wallet className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">{t("employee.salary.title")}</h2>
        <div className="ml-auto flex gap-2">
          {revealed && canEdit && salary.data && (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              {t("employee.salary.edit")}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setRevealed((value) => !value)}>
            {revealed ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
            {revealed ? t("employee.salary.hide") : t("employee.salary.show")}
          </Button>
        </div>
      </div>
      {content}
      <p className="mt-2 text-xs text-muted-foreground">{t("employee.salary.hint")}</p>

      {editing && salary.data && (
        <SalaryDialog
          organizationId={organizationId}
          employeeId={employeeId}
          current={salary.data}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}

function SalaryDialog({
  organizationId,
  employeeId,
  current,
  onClose,
}: {
  organizationId: string;
  employeeId: string;
  current: EmployeeSalary;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState(current.baseSalary?.toString() ?? "");
  const [currency, setCurrency] = useState(current.salaryCurrency ?? DEFAULT_CURRENCY);

  const trimmed = amount.trim();
  const value = trimmed === "" ? null : Number(trimmed);
  const amountValid =
    value === null || (Number.isFinite(value) && value >= 0 && value <= MAX_SALARY);
  const code = currency.trim().toUpperCase();
  const currencyValid = /^[A-Z]{3}$/.test(code);
  const next: EmployeeSalary = { baseSalary: value, salaryCurrency: value === null ? null : code };

  const save = useMutation({
    mutationFn: () => updateEmployee(employeeId, next),
    onSuccess: () => {
      // The answer carries no salary: show what was sent rather than read it again,
      // since every read is audited.
      queryClient.setQueryData(employeeSalaryQuery(organizationId, employeeId).queryKey, next);
      toast.success(t("employee.salary.saved"));
      onClose();
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (amountValid && currencyValid) save.mutate();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("employee.salary.editTitle")}</DialogTitle>
          <DialogDescription>{t("employee.salary.editHint")}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
              <div className="space-y-2">
                <Label htmlFor="base-salary">{t("employee.salary.amount")}</Label>
                <Input
                  id="base-salary"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={MAX_SALARY}
                  step="any"
                  value={amount}
                  aria-invalid={!amountValid || undefined}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="salary-currency">{t("employee.salary.currency")}</Label>
                <Input
                  id="salary-currency"
                  value={currency}
                  maxLength={3}
                  aria-invalid={!currencyValid || undefined}
                  onChange={(event) => setCurrency(event.target.value.toUpperCase())}
                />
              </div>
            </div>
            {!amountValid && (
              <p className="text-sm text-destructive">{t("employee.salary.amountInvalid")}</p>
            )}
            {!currencyValid && (
              <p className="text-sm text-destructive">{t("employee.salary.currencyInvalid")}</p>
            )}
            <DialogActions>
              <Button type="button" variant="outline" onClick={onClose}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={save.isPending || !amountValid || !currencyValid}>
                {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("common.save")}
              </Button>
            </DialogActions>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
