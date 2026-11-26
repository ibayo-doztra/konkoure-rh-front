import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarDays, SlidersHorizontal } from "lucide-react";
import { AdjustBalanceDialog } from "@/components/leaves/AdjustBalanceDialog";
import { Button } from "@/components/ui/button";
import { useCountUp, formatDayCount } from "@/hooks/useCountUp";

interface Props {
  /** Current balance in days, `null` when the reader may not see it. */
  balance: number | null;
  /** Owner and hr_admin may correct the balance (06 §7). */
  adjust?: { organizationId: string; employeeId: string; employeeName: string };
}

export function LeaveBalanceCard({ balance, adjust }: Props) {
  const { t, i18n } = useTranslation();
  const [adjusting, setAdjusting] = useState(false);
  const animatedBalance = useCountUp(balance);
  const animatedDays = formatDayCount(animatedBalance, i18n.language);

  return (
    <div className="rounded-[10px] border border-border bg-card p-6 text-card-foreground shadow-sm">
      <div className="mb-5 flex items-center gap-2">
        <CalendarDays className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">{t("leaves.leaveBalance")}</h2>
        {adjust && (
          <Button
            size="sm"
            variant="outline"
            className="ml-auto"
            onClick={() => setAdjusting(true)}
          >
            <SlidersHorizontal className="mr-2 h-4 w-4" />
            {t("leaves.adjust.open")}
          </Button>
        )}
      </div>
      <div className="flex items-baseline gap-2">
        {balance === null ? (
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
            <span className="text-sm text-muted-foreground">{t("leaves.daysUnitShort")}</span>
          </>
        )}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{t("leaves.balanceHint")}</p>
      {adjust && adjusting && (
        <AdjustBalanceDialog {...adjust} onClose={() => setAdjusting(false)} />
      )}
    </div>
  );
}
