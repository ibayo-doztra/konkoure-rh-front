import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Copy, Loader2, Plus, Tablet } from "lucide-react";
import { apiErrorMessage } from "@/lib/api/client";
import {
  createDeviceToken,
  DEFAULT_DEVICE_TOKEN_DAYS,
  deviceTokensQuery,
  MAX_DEVICE_TOKEN_DAYS,
  revokeDeviceToken,
  type DeviceToken,
} from "@/lib/api/timeclock";
import { formatDateTime } from "@/lib/format";
import { useOrg } from "@/hooks/useOrg";
import { useConfirm } from "@/hooks/useConfirm";
import { PageHeader } from "@/components/PageHeader";
import { ResponsiveTable } from "@/components/ResponsiveTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

export const Route = createFileRoute("/_authenticated/app/timeclock/kiosks")({
  component: KiosksPage,
});

type TokenStatus = "active" | "expired" | "revoked";

function statusOf(token: DeviceToken): TokenStatus {
  if (token.revokedAt) return "revoked";
  if (token.expiresAt && Date.parse(token.expiresAt) <= Date.now()) return "expired";
  return "active";
}

/**
 * Kiosk tokens (06 §6, owner and hr_admin): a fixed tablet running the mobile
 * kiosk scans badges with this token instead of a member session.
 */
function KiosksPage() {
  const { t } = useTranslation();
  const { org } = useOrg();
  const organizationId = org?.id ?? "";
  const queryClient = useQueryClient();
  const { confirm, confirmDialog } = useConfirm();
  const [creating, setCreating] = useState(false);

  const tokens = useQuery({ ...deviceTokensQuery(organizationId), enabled: !!org });

  const revoke = useMutation({
    mutationFn: (token: DeviceToken) => revokeDeviceToken(token.id),
    onSuccess: () => {
      toast.success(t("timeclock.kiosks.revoked"));
      return queryClient.invalidateQueries({
        queryKey: deviceTokensQuery(organizationId).queryKey,
      });
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  const onRevoke = async (token: DeviceToken) => {
    const confirmed = await confirm({
      title: t("timeclock.kiosks.revokeTitle"),
      subtitle: token.name,
      description: t("timeclock.kiosks.revokeDescription"),
      actionLabel: t("timeclock.kiosks.revoke"),
      actionVariant: "destructive",
    });
    if (confirmed) revoke.mutate(token);
  };

  const statusBadge = (token: DeviceToken) => {
    const status = statusOf(token);
    const variant =
      status === "active" ? "default" : status === "expired" ? "secondary" : "destructive";
    return <Badge variant={variant}>{t(`timeclock.kiosks.status.${status}`)}</Badge>;
  };

  return (
    <div className="space-y-6">
      {confirmDialog}
      <PageHeader
        title={t("timeclock.kiosks.title")}
        description={t("timeclock.kiosks.description")}
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t("timeclock.kiosks.new")}
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          <ResponsiveTable
            data={tokens.data ?? []}
            getRowKey={(token) => token.id}
            empty={
              <div className="flex flex-col items-center gap-2 p-6 text-center">
                <Tablet className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
                <p>{t("timeclock.kiosks.empty")}</p>
              </div>
            }
            columns={[
              {
                key: "name",
                header: t("timeclock.kiosks.columns.name"),
                priority: "primary",
                cell: (token) => <span className="break-words font-medium">{token.name}</span>,
              },
              {
                key: "status",
                header: t("timeclock.kiosks.columns.status"),
                cell: statusBadge,
              },
              {
                key: "lastUsed",
                header: t("timeclock.kiosks.columns.lastUsed"),
                cell: (token) => (
                  <span className="text-muted-foreground">
                    {token.lastUsedAt
                      ? formatDateTime(token.lastUsedAt)
                      : t("timeclock.kiosks.never")}
                  </span>
                ),
              },
              {
                key: "expires",
                header: t("timeclock.kiosks.columns.expires"),
                cell: (token) => (
                  <span className="text-muted-foreground">
                    {token.expiresAt ? formatDateTime(token.expiresAt) : "—"}
                  </span>
                ),
              },
              {
                key: "actions",
                header: "",
                priority: "actions",
                cell: (token) =>
                  statusOf(token) === "active" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={revoke.isPending}
                      aria-label={t("timeclock.kiosks.revokeFor", { name: token.name })}
                      onClick={() => void onRevoke(token)}
                    >
                      {t("timeclock.kiosks.revoke")}
                    </Button>
                  ) : null,
              },
            ]}
          />
        </CardContent>
      </Card>

      {creating && <CreateTokenDialog onClose={() => setCreating(false)} />}
    </div>
  );
}

function CreateTokenDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { org } = useOrg();
  const organizationId = org?.id ?? "";
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [days, setDays] = useState(String(DEFAULT_DEVICE_TOKEN_DAYS));
  const [token, setToken] = useState<string | null>(null);

  const daysNumber = Number(days);
  const daysValid =
    Number.isInteger(daysNumber) && daysNumber >= 1 && daysNumber <= MAX_DEVICE_TOKEN_DAYS;

  const create = useMutation({
    mutationFn: () => createDeviceToken({ name: name.trim(), expiresInDays: daysNumber }),
    onSuccess: (created) => {
      setToken(created.token);
      return queryClient.invalidateQueries({
        queryKey: deviceTokensQuery(organizationId).queryKey,
      });
    },
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (daysValid) create.mutate();
  };

  const copy = async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      toast.success(t("timeclock.kiosks.copied"));
    } catch {
      toast.error(t("timeclock.kiosks.copyFailed"));
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {token ? t("timeclock.kiosks.createdTitle") : t("timeclock.kiosks.newTitle")}
          </DialogTitle>
          <DialogDescription>
            {token
              ? t("timeclock.kiosks.createdDescription")
              : t("timeclock.kiosks.newDescription")}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {token ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="kiosk-token">{t("timeclock.kiosks.token")}</Label>
                <div className="flex gap-2">
                  <Input id="kiosk-token" readOnly value={token} className="font-mono text-xs" />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label={t("timeclock.kiosks.copy")}
                    onClick={() => void copy()}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p
                role="alert"
                className="rounded-md bg-warning/10 p-3 text-sm font-medium text-warning"
              >
                {t("timeclock.kiosks.shownOnce")}
              </p>
              <DialogActions align="full">
                <Button onClick={onClose}>{t("timeclock.kiosks.done")}</Button>
              </DialogActions>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="kiosk-name">{t("timeclock.kiosks.name")}</Label>
                <Input
                  id="kiosk-name"
                  required
                  minLength={2}
                  maxLength={80}
                  placeholder={t("timeclock.kiosks.namePlaceholder")}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="kiosk-days">{t("timeclock.kiosks.expiresInDays")}</Label>
                <Input
                  id="kiosk-days"
                  type="number"
                  required
                  min={1}
                  max={MAX_DEVICE_TOKEN_DAYS}
                  className="w-32"
                  aria-invalid={!daysValid || undefined}
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                />
              </div>
              {create.error && (
                <p role="alert" className="text-sm text-destructive">
                  {apiErrorMessage(create.error)}
                </p>
              )}
              <DialogActions>
                <Button type="button" variant="outline" onClick={onClose}>
                  {t("timeclock.kiosks.cancel")}
                </Button>
                <Button type="submit" disabled={!daysValid || create.isPending}>
                  {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t("timeclock.kiosks.create")}
                </Button>
              </DialogActions>
            </form>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
