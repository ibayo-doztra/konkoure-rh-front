import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CreditCard, History } from "lucide-react";
import { toast } from "sonner";
import { apiErrorMessage, newIdempotencyKey } from "@/lib/api/client";
import {
  assignBadge,
  badgeEventsQuery,
  employeeBadgeQuery,
  hrKey,
  revokeBadge,
} from "@/lib/api/hr";
import { useConfirm } from "@/hooks/useConfirm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface Props {
  organizationId: string;
  employeeId: string;
}

/** NFC badge of an employee (timeclock module). Only shown to owner and hr_admin. */
export function NfcBadgeCard({ organizationId, employeeId }: Props) {
  const { t, i18n } = useTranslation();
  const { confirm, confirmDialog } = useConfirm();
  const queryClient = useQueryClient();
  const badge = useQuery(employeeBadgeQuery(organizationId, employeeId));
  const events = useQuery(badgeEventsQuery(organizationId, employeeId));
  const [uid, setUid] = useState("");
  const assignKey = useRef(newIdempotencyKey());

  const locale = i18n.language?.startsWith("en") ? "en-US" : "fr-FR";
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: [...hrKey(organizationId), "badge", employeeId] });

  const assign = useMutation({
    mutationFn: () => assignBadge(employeeId, uid.trim(), assignKey.current),
    onSuccess: () => {
      toast.success(t("employees.badge.assigned"));
      setUid("");
      assignKey.current = newIdempotencyKey();
      void refresh();
    },
    onError: (error) =>
      toast.error(t("employees.badge.updateError"), { description: apiErrorMessage(error) }),
  });

  const revoke = useMutation({
    mutationFn: () => revokeBadge(employeeId),
    onSuccess: () => {
      toast.success(t("employees.badge.revoked"));
      void refresh();
    },
    onError: (error) =>
      toast.error(t("employees.badge.revokeError"), { description: apiErrorMessage(error) }),
  });

  const askRevoke = async () => {
    const confirmed = await confirm({
      title: t("employees.badge.revokeConfirm"),
      description: t("employees.badge.revokeConfirmDesc"),
      actionLabel: t("employees.badge.revoke"),
      actionVariant: "destructive",
    });
    if (confirmed) revoke.mutate();
  };

  const history = (events.data ?? []).filter((e) => KNOWN_EVENTS.has(e.event));
  const trimmed = uid.trim();
  const uidValid = trimmed.length >= 4 && trimmed.length <= 64;
  const current = badge.data;
  const busy = assign.isPending || revoke.isPending;

  return (
    <div className="rounded-[10px] bg-card p-6 text-card-foreground shadow-md">
      {confirmDialog}
      <div className="mb-5 flex items-center gap-2">
        <CreditCard className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">{t("employees.badge.title")}</h2>
      </div>

      {badge.isPending ? (
        <div className="text-sm text-muted-foreground">{t("employees.badge.loading")}</div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3">
            {current ? (
              <div>
                <div className="text-xs text-muted-foreground">{t("employees.badge.current")}</div>
                <div className="font-mono text-sm" data-testid="badge-uid">
                  {current.uid}
                </div>
                <div className="text-xs text-muted-foreground">
                  {t("employees.badge.assignedOn", {
                    date: new Date(current.assignedAt).toLocaleString(locale),
                  })}
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">{t("employees.badge.none")}</div>
            )}
            {current && (
              <Button variant="outline" size="sm" onClick={() => void askRevoke()} disabled={busy}>
                {t("employees.badge.revoke")}
              </Button>
            )}
          </div>

          <form
            className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              if (uidValid) assign.mutate();
            }}
          >
            <div className="flex-1">
              <Label htmlFor="nfc-uid">{t("employees.badge.newUid")}</Label>
              <Input
                id="nfc-uid"
                value={uid}
                onChange={(e) => setUid(e.target.value)}
                placeholder={t("employees.badge.uidPlaceholder")}
                autoComplete="off"
                maxLength={64}
              />
            </div>
            <Button type="submit" disabled={!uidValid || busy}>
              {t("employees.badge.assign")}
            </Button>
          </form>
          <p className="mt-1 text-xs text-muted-foreground">
            {trimmed && !uidValid ? t("employees.badge.uidLength") : t("employees.badge.uidHint")}
          </p>

          {history.length > 0 && (
            <div className="mt-6">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                <History className="h-4 w-4" /> {t("employees.badge.history")}
              </div>
              <ul className="divide-y divide-border rounded-md border border-border">
                {history.map((event) => (
                  <li key={event.id} className="flex items-center justify-between p-3 text-sm">
                    <div>
                      <div className="font-mono text-xs text-muted-foreground">{event.uid}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(event.createdAt).toLocaleString(locale)}
                      </div>
                    </div>
                    <Badge variant={event.event === "assigned" ? "default" : "outline"}>
                      {eventLabel(event.event, t)}
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

const KNOWN_EVENTS = new Set(["assigned", "revoked", "reassigned"]);

function eventLabel(event: string, t: (key: string) => string): string {
  switch (event) {
    case "assigned":
      return t("employees.badge.eventAssigned");
    case "revoked":
      return t("employees.badge.eventRevoked");
    case "reassigned":
      return t("employees.badge.eventReassigned");
    default:
      return event;
  }
}
