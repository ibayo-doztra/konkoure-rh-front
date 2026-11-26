import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { AlertTriangle, ArrowLeft, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useOrg } from "@/hooks/useOrg";
import { useConfirm } from "@/hooks/useConfirm";
import { PageHeader } from "@/components/PageHeader";
import { PROVIDER_META } from "@/components/social-providers";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiErrorMessage } from "@/lib/api/client";
import { formatDate } from "@/lib/format";
import {
  disconnectSocialAccount,
  invalidateSocialAccounts,
  isSocialUnavailable,
  SOCIAL_CONNECT_ERRORS,
  SOCIAL_PROVIDERS,
  socialAccountsQuery,
  startSocialConnection,
  type SocialAccount,
  type SocialAccountStatus,
} from "@/lib/api/social";

// The API sends the browser back here after the network's consent screen.
const searchSchema = z.object({
  connected: z.enum(["linkedin", "facebook"]).optional().catch(undefined),
  count: z.coerce.number().int().min(0).optional().catch(undefined),
  error: z.enum(SOCIAL_CONNECT_ERRORS).optional().catch(undefined),
});

export const Route = createFileRoute("/_authenticated/app/settings/integrations")({
  head: () => ({ meta: [{ title: "Intégrations — Konkouré" }] }),
  validateSearch: searchSchema,
  component: IntegrationsPage,
});

const STATUS_VARIANT: Record<SocialAccountStatus, "default" | "secondary" | "destructive"> = {
  active: "default",
  expired: "destructive",
  revoked: "secondary",
};

function IntegrationsPage() {
  const { t } = useTranslation();
  const { confirm, confirmDialog } = useConfirm();
  const { org } = useOrg();
  const organizationId = org?.id ?? "";
  const queryClient = useQueryClient();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const accounts = useQuery({ ...socialAccountsQuery(organizationId), enabled: !!org });

  // Outcome of the OAuth round trip, shown once, then removed from the URL.
  const handled = useRef(false);
  useEffect(() => {
    if (handled.current || (!search.connected && !search.error)) return;
    handled.current = true;
    if (search.connected) {
      toast.success(
        t("settings.connected", {
          count: search.count ?? 1,
          provider: PROVIDER_META[search.connected].label,
        }),
      );
    } else if (search.error) {
      toast.error(t(`settings.connectErrors.${search.error}`));
    }
    void navigate({ search: {}, replace: true });
  }, [search, navigate, t]);

  const connect = useMutation({
    mutationFn: startSocialConnection,
    onSuccess: (authorizationUrl) => {
      window.location.assign(authorizationUrl);
    },
    onError: (e, provider) =>
      toast.error(
        isSocialUnavailable(e)
          ? t("settings.unavailable", { provider: PROVIDER_META[provider].label })
          : apiErrorMessage(e),
      ),
  });

  const disconnect = useMutation({
    mutationFn: (account: SocialAccount) => disconnectSocialAccount(account.id),
    onSuccess: async () => {
      toast.success(t("settings.accountDisconnected"));
      await queryClient.invalidateQueries(invalidateSocialAccounts(organizationId));
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const askDisconnect = async (account: SocialAccount) => {
    const ok = await confirm({
      title: t("settings.disconnectConfirm"),
      description: t("settings.disconnectConfirmDesc"),
      actionLabel: t("settings.disconnect"),
      actionVariant: "destructive",
    });
    if (ok) disconnect.mutate(account);
  };

  const list = accounts.data ?? [];

  return (
    <div className="space-y-6">
      {confirmDialog}
      <PageHeader
        title={t("settings.integrationsTitle")}
        actions={
          <Button variant="ghost" size="sm" asChild>
            <Link to="/app/settings">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("settings.backToSettings")}
            </Link>
          </Button>
        }
      />

      <Card>
        <CardContent className="space-y-1 p-4 text-sm">
          <p className="font-medium">{t("settings.howItWorks")}</p>
          <p className="text-muted-foreground">{t("settings.howItWorksDesc")}</p>
        </CardContent>
      </Card>

      {accounts.isError && <p className="text-sm text-destructive">{t("settings.loadError")}</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        {SOCIAL_PROVIDERS.map((provider) => {
          const meta = PROVIDER_META[provider];
          const mine = list.filter((a) => a.provider === provider);
          const hasExpired = mine.some((a) => a.status !== "active");
          const connecting = connect.isPending && connect.variables === provider;
          return (
            <Card key={provider} data-testid={`social-provider-${provider}`}>
              <CardContent className="space-y-4 p-4 sm:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3">
                    <meta.icon className={`mt-0.5 h-6 w-6 shrink-0 ${meta.color}`} aria-hidden />
                    <div>
                      <h2 className="font-semibold">
                        {t("settings.connectAccount", { provider: meta.label })}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {t(`settings.connectDesc_${provider}`)}
                      </p>
                    </div>
                  </div>
                  <Button
                    className="shrink-0"
                    onClick={() => connect.mutate(provider)}
                    disabled={!org || connect.isPending}
                  >
                    {connecting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <meta.icon className="mr-2 h-4 w-4" aria-hidden />
                    )}
                    {mine.length ? t("settings.reconnect") : t("settings.connect")}
                  </Button>
                </div>

                {hasExpired && (
                  <p className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                    {t("settings.expiredHint", { provider: meta.label })}
                  </p>
                )}

                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground">
                    {t("settings.connectedAccounts")}
                  </h3>
                  {accounts.isPending ? (
                    <Skeleton className="h-14 w-full" />
                  ) : mine.length === 0 ? (
                    <p className="rounded-md border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
                      {t("settings.noAccountConnected", { provider: meta.label })}
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {mine.map((a) => (
                        <li
                          key={a.id}
                          data-testid="social-account"
                          className="flex items-center justify-between gap-3 rounded-md border bg-card p-3"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium">{a.accountName}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <Badge variant={STATUS_VARIANT[a.status]}>
                                {t(`settings.accountStatus.${a.status}`)}
                              </Badge>
                              {t("settings.connectedOn", { date: formatDate(a.createdAt) })}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void askDisconnect(a)}
                            disabled={disconnect.isPending}
                            aria-label={t("settings.disconnectAria", { name: a.accountName })}
                          >
                            <Trash2 className="h-4 w-4 text-destructive sm:mr-1" />
                            <span className="hidden sm:inline">{t("settings.disconnect")}</span>
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
