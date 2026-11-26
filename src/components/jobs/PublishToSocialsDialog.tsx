import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ExternalLink, Loader2, RefreshCw, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PROVIDER_META } from "@/components/social-providers";
import { useOrg } from "@/hooks/useOrg";
import { useRole } from "@/hooks/useRole";
import { apiErrorMessage, isApiError } from "@/lib/api/client";
import { aiErrorMessage } from "@/lib/api/ai";
import type { Job } from "@/lib/api/recruitment";
import {
  isInactiveAccount,
  isJobNotPublished,
  isSocialUnavailable,
  jobSocialPostsQuery,
  MAX_ACCOUNTS_PER_POST,
  MAX_POST_LENGTH,
  publishJobToSocials,
  SOCIAL_PROVIDERS,
  socialAccountsQuery,
  suggestSocialPost,
  type SocialPostStatus,
  type SocialProvider,
} from "@/lib/api/social";
import { formatDateTime } from "@/lib/format";

const POST_STATUS_VARIANT: Record<SocialPostStatus, "default" | "secondary" | "destructive"> = {
  pending: "secondary",
  published: "default",
  failed: "destructive",
};

const EMPTY_TEXTS: Record<SocialProvider, string> = { linkedin: "", facebook: "" };

/** Shares a published offer on the organization's LinkedIn and Facebook pages. */
export function PublishToSocialsDialog({
  job,
  onOpenChange,
}: {
  job: Pick<Job, "id" | "title"> | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { t, i18n } = useTranslation();
  const { org } = useOrg();
  const { isAdmin } = useRole();
  const organizationId = org?.id ?? "";
  const queryClient = useQueryClient();
  const open = !!job;

  const accounts = useQuery({ ...socialAccountsQuery(organizationId), enabled: open && !!org });
  const history = useQuery({
    ...jobSocialPostsQuery(organizationId, job?.id ?? ""),
    enabled: open && !!org,
    // Posts are sent by the API's queue: follow them until they settle.
    refetchInterval: (query) =>
      query.state.data?.some((p) => p.status === "pending") ? 5000 : false,
  });

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [texts, setTexts] = useState(EMPTY_TEXTS);

  useEffect(() => {
    if (!open) {
      setSelected(new Set());
      setTexts(EMPTY_TEXTS);
    }
  }, [open]);

  const active = (accounts.data ?? []).filter((a) => a.status === "active");
  const chosen = active.filter((a) => selected.has(a.id));
  const chosenProviders = SOCIAL_PROVIDERS.filter((p) => chosen.some((a) => a.provider === p));

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const suggest = useMutation({
    mutationFn: (provider: SocialProvider) =>
      suggestSocialPost(job!.id, provider, i18n.language?.startsWith("en") ? "en" : "fr"),
    onSuccess: (content, provider) => {
      setTexts((prev) => ({ ...prev, [provider]: content }));
      toast.success(t("recruitment.social.textGenerated"));
    },
    onError: (e) => toast.error(aiErrorMessage(e)),
  });

  const socialError = (e: unknown) => {
    if (isJobNotPublished(e)) return t("recruitment.social.notPublished");
    if (isInactiveAccount(e)) return t("recruitment.social.inactiveAccount");
    if (isSocialUnavailable(e)) return t("recruitment.social.unavailable");
    return undefined;
  };

  const publish = useMutation({
    // One post per network, each with its own text, to the chosen pages of that network.
    mutationFn: async () => {
      const results = await Promise.allSettled(
        chosenProviders.map((provider) =>
          publishJobToSocials(
            job!.id,
            chosen.filter((a) => a.provider === provider).map((a) => a.id),
            texts[provider].trim(),
          ),
        ),
      );
      const sent = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
      const failure = results.find((r) => r.status === "rejected");
      return { sent, error: failure?.status === "rejected" ? failure.reason : undefined };
    },
    onSuccess: async ({ sent, error }) => {
      if (sent.length) toast.success(t("recruitment.social.sent", { count: sent.length }));
      if (error) toast.error(socialError(error) ?? apiErrorMessage(error));
      await queryClient.invalidateQueries({
        queryKey: jobSocialPostsQuery(organizationId, job!.id).queryKey,
      });
      if (isInactiveAccount(error)) {
        await queryClient.invalidateQueries({
          queryKey: socialAccountsQuery(organizationId).queryKey,
        });
      }
      if (!error) setSelected(new Set());
    },
  });

  const submit = () => {
    if (chosen.length === 0) return toast.error(t("recruitment.social.selectAtLeastOne"));
    if (chosen.length > MAX_ACCOUNTS_PER_POST) {
      return toast.error(t("recruitment.social.maxAccounts", { max: MAX_ACCOUNTS_PER_POST }));
    }
    for (const provider of chosenProviders) {
      const label = PROVIDER_META[provider].label;
      const text = texts[provider].trim();
      if (!text) return toast.error(t("recruitment.social.emptyText", { provider: label }));
      if (text.length > MAX_POST_LENGTH) {
        return toast.error(
          t("recruitment.social.overLimit", { provider: label, limit: MAX_POST_LENGTH }),
        );
      }
    }
    publish.mutate();
  };

  const forbidden = isApiError(accounts.error) && accounts.error.status === 403;
  const noAccounts = accounts.isSuccess && active.length === 0;
  const posts = history.data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("recruitment.social.title")}</DialogTitle>
          {job && <p className="text-sm text-muted-foreground">{job.title}</p>}
        </DialogHeader>
        <DialogBody className="space-y-6">
          {accounts.isPending ? (
            <Skeleton className="h-24 w-full" />
          ) : forbidden ? (
            <p className="text-sm text-muted-foreground">
              {t("recruitment.social.accountsForbidden")}
            </p>
          ) : accounts.isError ? (
            <p className="text-sm text-destructive">{t("recruitment.social.accountsError")}</p>
          ) : noAccounts ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm">
              <p className="font-medium">{t("recruitment.social.noAccountsTitle")}</p>
              <p className="mb-3 text-muted-foreground">
                {isAdmin
                  ? t("recruitment.social.noAccountsDesc")
                  : t("recruitment.social.noAccountsDescMember")}
              </p>
              {isAdmin && (
                <Button asChild>
                  <Link to="/app/settings/integrations">
                    {t("recruitment.social.goToIntegrations")}
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <>
              <section className="space-y-3">
                <h3 className="text-sm font-semibold">{t("recruitment.social.step1")}</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {SOCIAL_PROVIDERS.map((provider) => {
                    const pages = active.filter((a) => a.provider === provider);
                    if (!pages.length) return null;
                    const meta = PROVIDER_META[provider];
                    return (
                      <div key={provider} className="space-y-1 rounded-lg border p-3">
                        <p className="flex items-center gap-2 text-sm font-medium">
                          <meta.icon className={`h-4 w-4 ${meta.color}`} aria-hidden />
                          {meta.label}
                        </p>
                        {pages.map((a) => (
                          <label
                            key={a.id}
                            className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted"
                          >
                            <Checkbox
                              checked={selected.has(a.id)}
                              onCheckedChange={() => toggle(a.id)}
                            />
                            <span className="min-w-0 truncate">{a.accountName}</span>
                          </label>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </section>

              {chosenProviders.length > 0 && (
                <section className="space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold">{t("recruitment.social.step2")}</h3>
                    <p className="text-xs text-muted-foreground">
                      {t("recruitment.social.step2Desc")}
                    </p>
                  </div>
                  {chosenProviders.map((provider) => {
                    const meta = PROVIDER_META[provider];
                    const id = `social-text-${provider}`;
                    const suggesting = suggest.isPending && suggest.variables === provider;
                    return (
                      <div key={provider} className="space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Label htmlFor={id} className="flex items-center gap-2">
                            <meta.icon className={`h-4 w-4 ${meta.color}`} aria-hidden />
                            {t("recruitment.social.textFor", { provider: meta.label })}
                          </Label>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => suggest.mutate(provider)}
                            disabled={suggest.isPending}
                            aria-label={t("recruitment.social.suggestFor", {
                              provider: meta.label,
                            })}
                          >
                            {suggesting ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Sparkles className="mr-2 h-4 w-4" />
                            )}
                            {t("recruitment.social.suggest")}
                          </Button>
                        </div>
                        <Textarea
                          id={id}
                          rows={5}
                          maxLength={MAX_POST_LENGTH}
                          value={texts[provider]}
                          onChange={(e) =>
                            setTexts((prev) => ({ ...prev, [provider]: e.target.value }))
                          }
                          placeholder={t("recruitment.social.placeholderFor", {
                            provider: meta.label,
                          })}
                        />
                        <p className="text-right text-xs text-muted-foreground tabular-nums">
                          {texts[provider].length}/{MAX_POST_LENGTH}
                        </p>
                      </div>
                    );
                  })}
                </section>
              )}
            </>
          )}

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">{t("recruitment.social.historyTitle")}</h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void history.refetch()}
                disabled={history.isFetching}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${history.isFetching ? "animate-spin" : ""}`} />
                {t("recruitment.social.refreshHistory")}
              </Button>
            </div>
            {history.isPending ? (
              <Skeleton className="h-12 w-full" />
            ) : history.isError ? (
              <p className="text-sm text-muted-foreground">
                {t("recruitment.social.historyError")}
              </p>
            ) : posts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("recruitment.social.historyEmpty")}
              </p>
            ) : (
              <ul className="space-y-2">
                {posts.map((post) => {
                  const meta = PROVIDER_META[post.provider];
                  return (
                    <li
                      key={post.id}
                      data-testid="social-post"
                      className="flex items-start justify-between gap-3 rounded-lg border p-3 text-sm"
                    >
                      <div className="min-w-0 space-y-1">
                        <p className="flex flex-wrap items-center gap-2">
                          {meta && <meta.icon className={`h-4 w-4 ${meta.color}`} aria-hidden />}
                          <span className="font-medium">
                            {post.accountName ?? t("recruitment.social.removedAccount")}
                          </span>
                          <Badge variant={POST_STATUS_VARIANT[post.status]}>
                            {t(`recruitment.social.statuses.${post.status}`)}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDateTime(post.publishedAt ?? post.createdAt)}
                          </span>
                        </p>
                        {post.errorMessage && (
                          <p className="break-words text-xs text-destructive">
                            {post.errorMessage}
                          </p>
                        )}
                      </div>
                      {post.externalUrl && (
                        <Button size="icon" variant="ghost" asChild>
                          <a
                            href={post.externalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={t("recruitment.social.viewPost")}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <DialogActions>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t("recruitment.social.close")}
            </Button>
            {!noAccounts && !forbidden && active.length > 0 && (
              <Button onClick={submit} disabled={publish.isPending || chosen.length === 0}>
                {publish.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {chosen.length
                  ? t("recruitment.social.publishWithCount", { count: chosen.length })
                  : t("recruitment.social.publish")}
              </Button>
            )}
          </DialogActions>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
