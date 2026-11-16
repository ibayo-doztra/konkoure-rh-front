import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CalendarDays } from "lucide-react";
import { getEmployeeLeaveBalance } from "@/lib/api/legacy-functions";
import { useCountUp, formatDayCount } from "@/hooks/useCountUp";

interface Props {
  employeeId: string;
}

export function LeaveBalanceCard({ employeeId }: Props) {
  const { t, i18n } = useTranslation();
  const balanceFn = getEmployeeLeaveBalance;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["leave-balance", employeeId],
    queryFn: () => balanceFn({ data: { employeeId } }),
    enabled: !!employeeId,
  });

  const balance = data?.balance ?? null;
  const animatedBalance = useCountUp(balance);
  const animatedDays = formatDayCount(animatedBalance, i18n.language);

  return (
    <div className="rounded-[10px] border border-border bg-card p-6 text-card-foreground shadow-sm">
      <div className="mb-5 flex items-center gap-2">
        <CalendarDays className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">{t("leaves.leaveBalance")}</h2>
      </div>
      <div className="flex items-baseline gap-2">
        {isLoading ? (
          <span className="text-sm text-muted-foreground">…</span>
        ) : isError || balance === null ? (
          <span className="text-sm text-muted-foreground">—</span>
        ) : (
          <>
            <span
              className={`text-3xl font-semibold tabular-nums ${
                balance < 0 ? "text-destructive" : "text-foreground"
              }`}
            >
              {animatedDays}
            </span>
            <span className="text-sm text-muted-foreground">
              {t("leaves.daysUnitShort")}
            </span>
          </>
        )}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{t("leaves.balanceHint")}</p>
    </div>
  );
}
