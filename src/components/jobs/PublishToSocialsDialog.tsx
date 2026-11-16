import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { pendingQuery } from "@/lib/api/pending";
import { useOrg } from "@/hooks/useOrg";
import { Dialog, DialogActions, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Facebook, Linkedin, Twitter, Sparkles, Loader2, ExternalLink, AlertTriangle, CheckCircle2, ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  listSocialAccounts,
  publishJobToSocials,
  listJobSocialPosts,
} from "@/lib/api/legacy-functions";

type Provider = "facebook" | "linkedin" | "twitter";

const ICONS: Record<Provider, any> = { facebook: Facebook, linkedin: Linkedin, twitter: Twitter };
const COLORS: Record<Provider, string> = { facebook: "text-[#1877F2]", linkedin: "text-[#0A66C2]", twitter: "text-foreground" };
const LIMITS: Partial<Record<Provider, number>> = { twitter: 280 };

export interface Job {
  id: string;
  title: string;
  location?: string | null;
  description?: string | null;
  requirements?: string | null;
  slug?: string | null;
}

export function PublishToSocialsDialog({
  job,
  open,
  onOpenChange,
  orgSlug,
}: {
  job: Job | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  orgSlug?: string;
}) {
  const { t } = useTranslation();
  const { org } = useOrg();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const MAX_FILES = 4;
  const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
  const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

  const listFn = listSocialAccounts;
  const publishFn = publishJobToSocials;
  const historyFn = listJobSocialPosts;

  const authedCall = async <T,>(fn: (args: any) => Promise<T>, args: any = {}): Promise<T> => {
    return fn(args);
  };

  const accountsQ = useQuery({
    queryKey: ["social_accounts"],
    queryFn: () => authedCall(listFn),
    enabled: open,
    retry: false,
  });
  const historyQ = useQuery({
    queryKey: ["social_posts", job?.id],
    queryFn: () => authedCall(historyFn, { data: { jobId: job!.id } }),
    enabled: open && !!job?.id,
    retry: false,
  });

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [contents, setContents] = useState<Record<Provider, string>>({ facebook: "", linkedin: "", twitter: "" });
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);

  type MediaItem = {
    id: string;
    name: string;
    previewUrl: string;
    publicUrl?: string;
    path?: string;
    status: "uploading" | "ready" | "error";
    error?: string;
  };
  const [media, setMedia] = useState<MediaItem[]>([]);

  useEffect(() => {
    if (!open) {
      setSelected(new Set());
      setContents({ facebook: "", linkedin: "", twitter: "" });
      setMedia((prev) => {
        prev.forEach((m) => URL.revokeObjectURL(m.previewUrl));
        return [];
      });
    }
  }, [open]);

  const accounts = (accountsQ.data?.accounts ?? []) as Array<any>;
  const grouped: Record<Provider, Array<any>> = {
    facebook: accounts.filter((a) => a.provider === "facebook" && a.status === "active"),
    linkedin: accounts.filter((a) => a.provider === "linkedin" && a.status === "active"),
    twitter: accounts.filter((a) => a.provider === "twitter" && a.status === "active"),
  };
  const activeProviders = (Object.keys(grouped) as Provider[]).filter((p) => grouped[p].length > 0);

  const publicUrl =
    job && job.slug && orgSlug
      ? `${typeof window !== "undefined" ? window.location.origin : ""}/careers/${orgSlug}/${job.slug}`
      : "";

  const generate = async () => {
    if (!job) return;
    setGenerating(true);
    try {
      const { data, error } = await pendingQuery("POST /org/recruitment/jobs/:id/social-posts");
      if (error) throw error;
      setContents({
        facebook: data.facebook ?? "",
        linkedin: data.linkedin ?? "",
        twitter: data.twitter ?? "",
      });
      toast.success(t("recruitment.social.textGenerated"));
    } catch (e: any) {
      toast.error(e.message ?? t("recruitment.social.generationError"));
    } finally {
      setGenerating(false);
    }
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!org) { toast.error(t("recruitment.social.orgNotFound")); return; }
    if (!job) return;

    const incoming = Array.from(files);
    const slotsLeft = MAX_FILES - media.length;
    if (slotsLeft <= 0) { toast.error(t("recruitment.social.maxImages", { max: MAX_FILES })); return; }
    const accepted: File[] = [];
    for (const f of incoming.slice(0, slotsLeft)) {
      if (!ACCEPTED.includes(f.type)) { toast.error(t("recruitment.social.unsupportedFormat", { name: f.name })); continue; }
      if (f.size > MAX_SIZE) { toast.error(t("recruitment.social.tooLarge", { name: f.name })); continue; }
      accepted.push(f);
    }
    if (incoming.length > slotsLeft) toast.warning(t("recruitment.social.onlyAdded", { count: slotsLeft, max: MAX_FILES }));

    const newItems: MediaItem[] = accepted.map((f) => ({
      id: crypto.randomUUID(),
      name: f.name,
      previewUrl: URL.createObjectURL(f),
      status: "uploading",
    }));
    setMedia((prev) => [...prev, ...newItems]);

    await Promise.all(accepted.map(async (file, idx) => {
      const item = newItems[idx];
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${org.id}/${job.id}/${item.id}.${ext}`;
      const { error } = await pendingQuery("POST signed-url (storage social-media.upload)");
      if (error) {
        setMedia((prev) => prev.map((m) => m.id === item.id ? { ...m, status: "error", error: error.message } : m));
        toast.error(t("recruitment.social.uploadFailedNamed", { name: file.name }));
        return;
      }
      const { data: pub } = await pendingQuery("GET signed-url (storage social-media.getPublicUrl)");
      setMedia((prev) => prev.map((m) => m.id === item.id ? { ...m, status: "ready", publicUrl: pub.publicUrl, path } : m));
    }));

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeMedia = async (id: string) => {
    const item = media.find((m) => m.id === id);
    if (!item) return;
    URL.revokeObjectURL(item.previewUrl);
    setMedia((prev) => prev.filter((m) => m.id !== id));
    if (item.path) {
      void pendingQuery("DELETE signed-url (storage social-media.remove)");
    }
  };

  const uploading = media.some((m) => m.status === "uploading");
  const mediaUrls = media.filter((m) => m.status === "ready" && m.publicUrl).map((m) => m.publicUrl!) as string[];

  const publish = async () => {
    if (!job) return;
    if (selected.size === 0) { toast.error(t("recruitment.social.selectAtLeastOne")); return; }
    if (uploading) { toast.error(t("recruitment.social.waitUploads")); return; }
    const items: Array<{ accountId: string; content: string }> = [];
    let hasTwitter = false;
    for (const accId of selected) {
      const acc = accounts.find((a) => a.id === accId);
      if (!acc) continue;
      const text = contents[acc.provider as Provider]?.trim();
      if (!text) { toast.error(t("recruitment.social.emptyText", { provider: acc.provider })); return; }
      const limit = LIMITS[acc.provider as Provider];
      if (limit && text.length > limit) { toast.error(t("recruitment.social.overLimit", { provider: acc.provider, length: text.length, limit })); return; }
      if (acc.provider === "twitter") hasTwitter = true;
      items.push({ accountId: accId, content: text });
    }
    if (hasTwitter && mediaUrls.length > 0) {
      toast.warning(t("recruitment.social.twitterImagesWarning"));
    }
    setPublishing(true);
    try {
      const res = await authedCall(publishFn, { data: { jobId: job.id, items, mediaUrls } });
      const ok = res.results.filter((r: any) => r.status === "published").length;
      const failed = res.results.length - ok;
      if (failed === 0) toast.success(t("recruitment.social.publishedSuccess", { count: ok }));
      else toast.warning(t("recruitment.social.partialSuccess", { ok, failed }));
      historyQ.refetch();
      if (failed === 0) onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? t("recruitment.social.genericError"));
    } finally {
      setPublishing(false);
    }
  };

  const noAccounts = !accountsQ.isLoading && accounts.length === 0;
  const history = (historyQ.data?.posts ?? []) as Array<any>;


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] max-w-3xl overflow-y-auto p-6 sm:p-8"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{t("recruitment.social.title")}</DialogTitle>
        </DialogHeader>

        {noAccounts && (
          <div className="rounded-md border border-dashed p-6 text-center text-sm">
            <AlertTriangle className="mx-auto mb-2 h-6 w-6 text-amber-500" />
            <p className="font-medium">{t("recruitment.social.noAccountsTitle")}</p>
            <p className="mb-3 text-muted-foreground">{t("recruitment.social.noAccountsDesc")}</p>
            <Button asChild><Link to="/app/settings/integrations">{t("recruitment.social.goToIntegrations")}</Link></Button>
          </div>
        )}

        {!noAccounts && (
          <div className="space-y-6 py-2">
            {/* 1. Account selection */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">{t("recruitment.social.step1")}</h3>
              <div className="space-y-3">
                {(["facebook", "linkedin", "twitter"] as Provider[]).map((p) => {
                  const list = grouped[p];
                  if (list.length === 0) return null;
                  const Icon = ICONS[p];
                  return (
                    <div key={p} className="space-y-2 rounded-lg border bg-card p-4">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Icon className={`h-4 w-4 ${COLORS[p]}`} /> {p === "twitter" ? "X" : p[0].toUpperCase() + p.slice(1)}
                      </div>
                      <div className="space-y-1">
                        {list.map((a) => (
                          <label key={a.id} className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors hover:bg-muted">
                            <Checkbox checked={selected.has(a.id)} onCheckedChange={() => toggle(a.id)} />
                            <span>{a.account_name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* 2. AI generate */}
            <section className="flex flex-col gap-4 rounded-lg border bg-primary-soft/30 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-foreground">{t("recruitment.social.step2")}</h3>
                <p className="text-xs text-muted-foreground">{t("recruitment.social.step2Desc")}</p>
              </div>
              <Button
                onClick={generate}
                disabled={generating}
                className="group relative overflow-hidden bg-gradient-to-r from-primary via-primary to-primary/80 text-primary-foreground shadow-md transition-all duration-200 hover:from-primary/90 hover:via-primary hover:to-primary hover:shadow-lg hover:scale-[1.02] active:scale-[0.97] active:shadow-sm"
              >
                {generating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110" />
                )}
                {t("recruitment.social.generateWithAi")}
              </Button>
            </section>

            {/* Images */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">{t("recruitment.social.imagesTitle")}</h3>
                  <p className="text-xs text-muted-foreground">{t("recruitment.social.imagesDesc", { max: MAX_FILES })}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={media.length >= MAX_FILES}
                >
                  <ImagePlus className="mr-2 h-4 w-4" />
                  {t("recruitment.social.add")}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="hidden"
                  onChange={(e) => void handleFiles(e.target.files)}
                />
              </div>
              {media.length > 0 && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {media.map((m) => (
                    <div key={m.id} className="group relative aspect-square overflow-hidden rounded-md border bg-muted">
                      <img src={m.previewUrl} alt={m.name} className="h-full w-full object-cover" />
                      {m.status === "uploading" && (
                        <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                          <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        </div>
                      )}
                      {m.status === "error" && (
                        <div className="absolute inset-0 flex items-center justify-center bg-destructive/40 text-xs text-destructive-foreground">
                          {t("recruitment.social.uploadFailed")}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => void removeMedia(m.id)}
                        className="absolute right-1 top-1 rounded-full bg-background/90 p-1 text-foreground shadow transition-opacity hover:bg-background"
                        aria-label={t("recruitment.social.removeImage")}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 3. Editable contents */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">{t("recruitment.social.step3")}</h3>
              <div className="space-y-4">
                {(["facebook", "linkedin", "twitter"] as Provider[]).map((p) => {
                  if (grouped[p].length === 0) return null;
                  const Icon = ICONS[p];
                  const limit = LIMITS[p];
                  const len = contents[p].length;
                  const over = limit ? len > limit : false;
                  return (
                    <div key={p} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2">
                          <Icon className={`h-4 w-4 ${COLORS[p]}`} /> {t("recruitment.social.textFor", { provider: p === "twitter" ? "X" : p[0].toUpperCase() + p.slice(1) })}
                        </Label>
                        {limit && <span className={`text-xs ${over ? "text-destructive" : "text-muted-foreground"}`}>{len}/{limit}</span>}
                      </div>
                      <Textarea
                        rows={p === "twitter" ? 3 : 5}
                        value={contents[p]}
                        onChange={(e) => setContents({ ...contents, [p]: e.target.value })}
                        placeholder={t("recruitment.social.placeholderFor", { provider: p })}
                        className="resize-y"
                      />
                    </div>
                  );
                })}
              </div>
            </section>

            {/* History */}
            {history.length > 0 && (
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">{t("recruitment.social.historyTitle")}</h3>
                <div className="space-y-2">
                  {history.map((h) => {
                    const Icon = ICONS[h.provider as Provider];
                    return (
                      <div key={h.id} className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3 text-sm">
                        <span className="flex flex-wrap items-center gap-2">
                          <Icon className={`h-4 w-4 ${COLORS[h.provider as Provider]}`} />
                          {h.status === "published" ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <AlertTriangle className="h-4 w-4 text-destructive" />}
                          <Badge variant={h.status === "published" ? "default" : "destructive"}>{h.status}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(h.created_at).toLocaleString("fr-FR")}
                          </span>
                          {h.error_message && <span className="text-xs text-destructive">— {h.error_message}</span>}
                        </span>
                        {h.external_url && (
                          <Button size="sm" variant="ghost" asChild>
                            <a href={h.external_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3 w-3" /></a>
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        )}

        <DialogActions>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("recruitment.social.close")}</Button>
          {!noAccounts && (
            <Button onClick={publish} disabled={publishing || selected.size === 0 || uploading}>
              {publishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {uploading ? t("recruitment.social.uploading") : (selected.size > 0 ? t("recruitment.social.publishWithCount", { count: selected.size }) : t("recruitment.social.publish"))}
            </Button>
          )}
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
}
