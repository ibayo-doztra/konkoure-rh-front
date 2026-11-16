import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { pendingQuery } from "@/lib/api/pending";
import { useOrg } from "@/hooks/useOrg";
import { useRole } from "@/hooks/useRole";
import { useMyEmployee } from "@/hooks/useMyEmployee";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/PageHeader";
import { ResponsiveTable } from "@/components/ResponsiveTable";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_authenticated/app/timeclock/logs")({
  component: LogsPage,
});

type Punch = {
  id: string;
  employee_id: string;
  type: "ARRIVEE" | "DEPART";
  timestamp: string;
  latitude: number | null;
  longitude: number | null;
  employees: { first_name: string; last_name: string } | null;
};

type Session = {
  employee: string;
  arrivee: string;
  depart: string | null;
  durationMs: number | null;
};

const ANOMALY_MS = 24 * 60 * 60 * 1000;

function formatDuration(ms: number): string {
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

function formatDate(ts: string): string {
  return new Date(ts).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function sessionStatus(s: Session, now: number, t: (k: string) => string): { label: string; variant: "default" | "secondary" | "destructive" | "outline" } {
  if (s.depart) return { label: t("timeclock.logs.status.finished"), variant: "secondary" };
  const openMs = now - new Date(s.arrivee).getTime();
  if (openMs > ANOMALY_MS) return { label: t("timeclock.logs.status.anomaly"), variant: "destructive" };
  return { label: t("timeclock.logs.status.ongoing"), variant: "default" };
}

function LogsPage() {
  const { t } = useTranslation();
  const { org } = useOrg();
  const { role } = useRole();
  const { myEmployee, loading: employeeLoading } = useMyEmployee();
  // Un employé simple ne voit que son propre historique de pointage.
  const seesAll = role === "owner" || role === "hr_admin" || role === "manager" || role === "security_agent";
  const [items, setItems] = useState<Punch[]>([]);

  useEffect(() => {
    if (!org) return;
    if (!seesAll && employeeLoading) return;
    void (async () => {
      if (!seesAll && !myEmployee?.id) {
        setItems([]);
        return;
      }
      // GET /org/timeclock/logs?filter[employeeId]=… (cursor pagination, 01 §7)
      const { data } = await pendingQuery("GET /org/timeclock/logs");
      setItems((data as unknown as Punch[]) ?? []);
    })();
  }, [org, seesAll, employeeLoading, myEmployee?.id]);

  const sessions = useMemo(() => {
    const byEmp = new Map<string, Punch[]>();
    for (const p of [...items].sort((a, b) => a.timestamp.localeCompare(b.timestamp))) {
      const arr = byEmp.get(p.employee_id) ?? [];
      arr.push(p);
      byEmp.set(p.employee_id, arr);
    }
    const result: Session[] = [];
    for (const [, punches] of byEmp) {
      let openArrivee: Punch | null = null;
      for (const p of punches) {
        if (p.type === "ARRIVEE") {
          if (openArrivee) {
            result.push({
              employee: fullName(openArrivee),
              arrivee: openArrivee.timestamp,
              depart: null,
              durationMs: null,
            });
          }
          openArrivee = p;
        } else if (p.type === "DEPART" && openArrivee) {
          result.push({
            employee: fullName(openArrivee),
            arrivee: openArrivee.timestamp,
            depart: p.timestamp,
            durationMs: new Date(p.timestamp).getTime() - new Date(openArrivee.timestamp).getTime(),
          });
          openArrivee = null;
        }
      }
      if (openArrivee) {
        result.push({
          employee: fullName(openArrivee),
          arrivee: openArrivee.timestamp,
          depart: null,
          durationMs: null,
        });
      }
    }
    result.sort((a, b) => b.arrivee.localeCompare(a.arrivee));
    return result;
  }, [items]);

  const now = Date.now();

  return (
    <div>
      <PageHeader
        title={t("timeclock.logs.title")}
        description={t("timeclock.logs.description")}
      />

      <Card>
        <CardContent className="p-0">
          <div className="border-b bg-muted/30 p-3 text-sm font-semibold">{t("timeclock.logs.sessionsTitle")}</div>
          <ResponsiveTable
            data={sessions}
            getRowKey={(s) => `${s.employee}-${s.arrivee}`}
            empty={t("timeclock.logs.empty")}
            columns={[
              {
                key: "employee",
                header: t("timeclock.logs.columns.employee"),
                priority: "primary",
                cell: (s) => <span className="break-words">{s.employee}</span>,
              },
              {
                key: "arrivee",
                header: t("timeclock.logs.columns.arrivee"),
                cell: (s) => (
                  <span className="whitespace-nowrap text-muted-foreground">
                    {formatDate(s.arrivee)}
                  </span>
                ),
              },
              {
                key: "depart",
                header: t("timeclock.logs.columns.depart"),
                cell: (s) => (
                  <span className="whitespace-nowrap text-muted-foreground">
                    {s.depart ? formatDate(s.depart) : "—"}
                  </span>
                ),
              },
              {
                key: "duree",
                header: t("timeclock.logs.columns.duree"),
                cell: (s) =>
                  s.durationMs !== null ? formatDuration(s.durationMs) : "—",
              },
              {
                key: "statut",
                header: t("timeclock.logs.columns.statut"),
                priority: "actions",
                cell: (s) => {
                  const status = sessionStatus(s, now, t);
                  return <Badge variant={status.variant}>{status.label}</Badge>;
                },
              },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function fullName(p: Punch): string {
  const e = p.employees;
  return e ? `${e.first_name} ${e.last_name}` : p.employee_id.slice(0, 8);
}
