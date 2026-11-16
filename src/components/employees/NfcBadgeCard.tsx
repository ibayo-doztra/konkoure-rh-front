import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { pendingQuery } from "@/lib/api/pending";
import { useMyEmployee } from "@/hooks/useMyEmployee";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { CreditCard, History } from "lucide-react";
import { toast } from "sonner";
import { getEmployeeBadgeInfo, assignEmployeeBadge, revokeEmployeeBadge } from "@/lib/api/legacy-functions";
import { useConfirm } from "@/hooks/useConfirm";

interface Props {
  employeeId: string;
  onUpdated?: () => void;
}

interface HistoryRow {
  id: string;
  uid: string;
  event: string;
  reason: string | null;
  created_at: string;
}

export function NfcBadgeCard({ employeeId, onUpdated }: Props) {
  const { t, i18n } = useTranslation();
  const { confirm, confirmDialog } = useConfirm();
  const { isSuperAdmin } = useMyEmployee();
  const getBadgeInfo = getEmployeeBadgeInfo;
  const assignBadge = assignEmployeeBadge;
  const revokeBadge = revokeEmployeeBadge;
  const [uid, setUid] = useState("");
  const [active, setActive] = useState(true);
  const [assignedAt, setAssignedAt] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const locale = i18n.language?.startsWith("en") ? "en-US" : "fr-FR";

  const load = async () => {
    setLoading(true);
    const [badge, { data: hist }] = await Promise.all([
      getBadgeInfo({ data: { employeeId } }),
      pendingQuery("GET /org/timeclock/badge-events"),
    ]);
    setUid(badge.uid ?? "");
    setActive(badge.active ?? true);
    setAssignedAt(badge.assignedAt ?? null);
    setHistory((hist as HistoryRow[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [employeeId]);

  if (!isSuperAdmin) return null;

  const save = async () => {
    setSaving(true);
    try {
      const clean = uid.trim() || null;
      const res = await assignBadge({ data: { employeeId, uid: clean, active } });
      setUid(res.uid ?? "");
      setActive(res.active ?? true);
      setAssignedAt(res.assignedAt ?? null);
      toast.success(t("employees.badge.updated"));
      onUpdated?.();
      void load();
    } catch (e: any) {
      toast.error(e?.message ?? t("employees.badge.updateError"));
    } finally {
      setSaving(false);
    }
  };

  const revoke = async () => {
    if (!(await confirm({ title: t("employees.badge.revokeConfirm"), description: t("employees.badge.revokeConfirmDesc"), actionLabel: t("common.confirm"), actionVariant: "destructive" }))) return;
    setSaving(true);
    try {
      await revokeBadge({ data: { employeeId } });
      setUid("");
      toast.success(t("employees.badge.revoked"));
      onUpdated?.();
      void load();
    } catch (e: any) {
      toast.error(e?.message ?? t("employees.badge.revokeError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-[10px] bg-card text-card-foreground p-6 shadow-md">
      {confirmDialog}
      <div className="mb-5 flex items-center gap-2">
        <CreditCard className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">{t("employees.badge.title")}</h2>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">{t("employees.badge.loading")}</div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="nfc-uid">{t("employees.badge.uid")}</Label>
              <Input
                id="nfc-uid"
                value={uid}
                onChange={(e) => setUid(e.target.value)}
                placeholder={t("employees.badge.uidPlaceholder")}
                autoComplete="off"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {t("employees.badge.uidHint")}
              </p>
            </div>
            <div className="flex flex-col justify-center gap-2">
              <div className="flex items-center gap-3">
                <Switch checked={active} onCheckedChange={setActive} id="nfc-active" />
                <Label htmlFor="nfc-active">{t("employees.badge.active")}</Label>
              </div>
              {assignedAt && (
                <p className="text-xs text-muted-foreground">
                  {t("employees.badge.assignedOn", { date: new Date(assignedAt).toLocaleString(locale) })}
                </p>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={save} disabled={saving} className="bg-primary hover:bg-primary/90">
              {t("employees.badge.save")}
            </Button>
            {uid && (
              <Button variant="outline" onClick={revoke} disabled={saving}>
                {t("employees.badge.revokeReassign")}
              </Button>
            )}
          </div>

          {history.length > 0 && (
            <div className="mt-6">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                <History className="h-4 w-4" /> {t("employees.badge.history")}
              </div>
              <ul className="divide-y rounded-md border">
                {history.map((h) => (
                  <li key={h.id} className="flex items-center justify-between p-3 text-sm">
                    <div>
                      <div className="font-mono text-xs text-muted-foreground">{h.uid}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(h.created_at).toLocaleString(locale)}
                      </div>
                    </div>
                    <Badge variant={h.event === "assigned" || h.event === "reactivated" ? "default" : "outline"}>
                      {eventLabel(h.event, t)}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function eventLabel(e: string, t: (key: string) => string): string {
  switch (e) {
    case "assigned": return t("employees.badge.eventAssigned");
    case "revoked": return t("employees.badge.eventRevoked");
    case "reactivated": return t("employees.badge.eventReactivated");
    case "deactivated": return t("employees.badge.eventDeactivated");
    default: return e;
  }
}
