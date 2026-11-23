import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { pendingFn } from "@/lib/api/pending";
import { fetchCareersJob, type RequiredDocument } from "@/lib/api/recruitment";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogTitle,
} from "@/components/ui/dialog";
import { CalendarClock, ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { appliedKey, hasApplied, markApplied, pruneExpired } from "@/lib/applied-jobs";
import { contractTypeLabel } from "@/lib/contract-types";
import i18n from "@/lib/i18n";

export const Route = createFileRoute("/careers/$slug/$jobSlug")({
  // Public page, rendered on the server for search engines (06 §11).
  loader: async ({ params }) => {
    const page = await fetchCareersJob(params.slug, params.jobSlug);
    return { org: page?.organization ?? null, job: page?.job ?? null };
  },
  pendingComponent: CareersLoadingState,
  pendingMs: 0,
  head: ({ params, loaderData }) => {
    const url = `https://konkoure.lovable.app/careers/${params.slug}/${params.jobSlug}`;
    const job = loaderData?.job;
    const org = loaderData?.org;
    const title = job?.title
      ? `${job.title} — ${org?.name ?? params.slug}`
      : i18n.t("careers.jobMetaTitle", { slug: params.jobSlug });
    const desc = job?.description
      ? job.description.replace(/<[^>]+>/g, "").slice(0, 155)
      : i18n.t("careers.jobMetaDesc", { slug: params.slug });
    const meta: Array<Record<string, string>> = [
      { title },
      { name: "description", content: desc },
      { property: "og:title", content: title },
      { property: "og:description", content: desc },
      { property: "og:url", content: url },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ];
    const scripts: Array<{ type: string; children: string }> = [];
    if (job && org) {
      scripts.push({
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "JobPosting",
          title: job.title,
          description: job.description ?? desc,
          datePublished: job.publishedAt ?? undefined,
          validThrough: job.deadline ?? undefined,
          employmentType: job.contractType,
          hiringOrganization: { "@type": "Organization", name: org.name },
          jobLocation: job.location
            ? {
                "@type": "Place",
                address: { "@type": "PostalAddress", addressLocality: job.location },
              }
            : undefined,
        }),
      });
    }
    return { meta, links: [{ rel: "canonical", href: url }], scripts };
  },
  component: JobApplicationPage,
});

type SubmissionPhase = "idle" | "preparing" | "uploading" | "processing";

/** `POST /public/careers/:orgSlug/jobs/:jobSlug/apply` (multipart) comes with lot 7 part 2. */
const submitApplication = pendingFn("POST /public/careers/:orgSlug/jobs/:jobSlug/apply");

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
];

const PHONE_REGEX = /^\d{3} \d{2} \d{2} \d{2}$/;

/** Formate un numéro guinéen en "622 00 00 00" (9 chiffres, 12 caractères). */
function formatGnPhone(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 9);
  return [d.slice(0, 3), d.slice(3, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean).join(" ");
}

function buildSchema(t: (k: string) => string) {
  return z.object({
    full_name: z.string().trim().min(2, t("careers.errors.nameRequired")).max(120),
    email: z.string().trim().email(t("careers.errors.invalidEmail")).max(200),
    phone: z.string().trim().regex(PHONE_REGEX, t("careers.errors.phoneInvalid")),
  });
}

function CareersLoadingState() {
  const { t } = useTranslation();
  return (
    <div
      className="flex min-h-[50vh] flex-col items-center justify-center gap-3 p-12 text-muted-foreground"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm">{t("careers.loading")}</p>
    </div>
  );
}

function SafeJobHtml({ html }: { html: string }) {
  const [sanitizedHtml, setSanitizedHtml] = useState("");

  useEffect(() => {
    let active = true;
    void import("dompurify").then(({ default: DOMPurify }) => {
      if (active) setSanitizedHtml(DOMPurify.sanitize(html));
    });
    return () => {
      active = false;
    };
  }, [html]);

  if (!sanitizedHtml) {
    return (
      <p className="whitespace-pre-line">
        {html
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()}
      </p>
    );
  }

  return <div dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />;
}

function JobApplicationPage() {
  const { t, i18n: i18nInst } = useTranslation();
  const { slug, jobSlug } = Route.useParams();
  const { org, job } = Route.useLoaderData();
  const [submitting, setSubmitting] = useState(false);
  const [submissionPhase, setSubmissionPhase] = useState<SubmissionPhase>("idle");
  const [submitted, setSubmitted] = useState(false);
  const [alreadyApplied, setAlreadyApplied] = useState(false);
  const [showProcessingHint, setShowProcessingHint] = useState(false);
  useEffect(() => {
    if (submissionPhase !== "processing") {
      setShowProcessingHint(false);
      return;
    }
    const id = setTimeout(() => setShowProcessingHint(true), 30_000);
    return () => clearTimeout(id);
  }, [submissionPhase]);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "" });
  const [files, setFiles] = useState<Record<string, File | null>>({});

  useEffect(() => {
    pruneExpired();
    if (job) setAlreadyApplied(hasApplied(appliedKey(slug, jobSlug), job.deadline));
  }, [job, slug, jobSlug]);

  if (!org || !job)
    return (
      <div className="p-12 text-center">
        <p className="text-muted-foreground">{t("careers.jobNotFound")}</p>
        <Button variant="link" asChild>
          <Link to="/careers/$slug" params={{ slug }}>
            {t("careers.allJobs")}
          </Link>
        </Button>
      </div>
    );

  // The CV is always required, on top of the pieces of the offer.
  const docs: RequiredDocument[] = [
    { key: "cv", label: t("careers.cvLabel"), required: true },
    ...job.requiredDocuments.filter((d) => d.key !== "cv"),
  ];
  const applied = appliedKey(slug, jobSlug);
  const deadline = job.deadline ? new Date(job.deadline) : null;
  const expired = deadline ? deadline < new Date() : false;
  const locale = (i18nInst.resolvedLanguage || "fr").slice(0, 2) === "en" ? "en-US" : "fr-FR";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || expired) return;
    if (hasApplied(applied, job.deadline)) {
      setAlreadyApplied(true);
      return;
    }

    const parsed = buildSchema(t).safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message, { duration: 3000 });
      return;
    }

    for (const d of docs) {
      const f = files[d.key];
      if (d.required && !f) {
        toast.error(t("careers.errors.docRequired", { label: d.label }), { duration: 3000 });
        return;
      }
      if (f) {
        if (f.size > MAX_FILE_SIZE) {
          toast.error(t("careers.errors.docTooLarge", { label: d.label }), { duration: 3000 });
          return;
        }
        if (!ALLOWED_TYPES.includes(f.type)) {
          toast.error(t("careers.errors.docInvalidType", { label: d.label }), { duration: 3000 });
          return;
        }
      }
    }

    setSubmitting(true);
    setSubmissionPhase("preparing");
    let activePhase: SubmissionPhase = "preparing";
    try {
      // Let React paint the blocking overlay before file or network work begins.
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
      activePhase = "uploading";
      setSubmissionPhase(activePhase);
      const body = new FormData();
      body.append("fullName", parsed.data.full_name);
      body.append("email", parsed.data.email);
      body.append("phone", parsed.data.phone);
      for (const d of docs) {
        const f = files[d.key];
        if (!f) continue;
        body.append(d.key === "cv" ? "cv" : `documents[${d.key}]`, f);
      }
      await submitApplication({ orgSlug: slug, jobSlug, body });
      markApplied(applied, job.deadline);
      setSubmitted(true);
      toast.success(t("careers.submittedTitle"), { duration: 3000 });
    } catch {
      toast.error(
        activePhase === "uploading"
          ? t("careers.errors.uploadFailed")
          : t("careers.errors.network"),
        { duration: 4000 },
      );
    } finally {
      setSubmitting(false);
      setSubmissionPhase("idle");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-6 py-6">
          {org.logoUrl ? (
            <img
              src={org.logoUrl}
              alt={t("careers.logoAlt", { name: org.name })}
              className="h-12 w-12 rounded-md border object-contain bg-white"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-md border bg-muted text-sm font-semibold text-muted-foreground">
              {org.name?.charAt(0)?.toUpperCase() ?? "?"}
            </div>
          )}
          <div className="flex-1">
            <p className="text-sm font-semibold">{org.name}</p>
            <Button variant="ghost" size="sm" asChild className="-ml-2 h-auto px-2 py-1 text-xs">
              <Link to="/careers/$slug" params={{ slug }}>
                <ArrowLeft className="mr-1 h-3 w-3" />
                {t("careers.backToList")}
              </Link>
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-6 px-6 py-8">
        <div>
          <h1 className="text-3xl font-bold">{job.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {job.location && <Badge variant="secondary">{job.location}</Badge>}
            {job.department && <Badge variant="secondary">{job.department}</Badge>}
            <Badge>{contractTypeLabel(job.contractType)}</Badge>
            {deadline && (
              <span
                className={`inline-flex items-center gap-1 ${expired ? "text-destructive" : ""}`}
              >
                <CalendarClock className="h-4 w-4" />
                {expired ? t("careers.closedOn") : t("careers.deadlinePrefix")}
                {deadline.toLocaleDateString(locale, {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
            )}
          </div>
        </div>

        {job.description && (
          <Card>
            <CardContent className="p-6">
              <div className="prose prose-sm max-w-none">
                <SafeJobHtml html={job.description} />
              </div>
            </CardContent>
          </Card>
        )}

        {job.requirements && (
          <Card>
            <CardContent className="p-6">
              <h2 className="mb-3 font-semibold">{t("careers.requirements")}</h2>
              <div className="prose prose-sm max-w-none">
                <SafeJobHtml html={job.requirements} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Modale de progression pendant l'envoi : page visible derrière un voile léger. */}
        <Dialog
          open={submitting}
          onOpenChange={() => {
            /* Non fermable pendant l'envoi */
          }}
        >
          <DialogContent
            overlayClassName="bg-background/40"
            className="max-w-sm [&>button]:hidden"
            aria-busy={submitting}
          >
            <DialogHeader className="text-center">
              <DialogTitle>{t("careers.sending")}</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <div
                className="flex flex-col items-center gap-4 text-center"
                role="status"
                aria-live="polite"
              >
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm font-medium text-foreground">
                  {submissionPhase === "uploading"
                    ? t("careers.uploadingTitle")
                    : submissionPhase === "processing"
                      ? t("careers.processingTitle")
                      : t("careers.preparingTitle")}
                </p>
                {submissionPhase === "processing" && showProcessingHint && (
                  <p className="text-xs text-muted-foreground">{t("careers.processingHint")}</p>
                )}
              </div>
            </DialogBody>
          </DialogContent>
        </Dialog>

        {submitted ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 p-8 text-center">
              <CheckCircle2 className="h-12 w-12 text-primary" />
              <h2 className="text-xl font-semibold">{t("careers.submittedTitle")}</h2>
              <p className="text-sm text-muted-foreground">
                {t("careers.submittedThanks", { name: org.name })}
              </p>
            </CardContent>
          </Card>
        ) : expired || alreadyApplied ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              {alreadyApplied ? t("careers.alreadyApplied") : t("careers.jobClosed")}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-6">
              <h2 className="mb-4 text-lg font-semibold">{t("careers.apply")}</h2>
              <form onSubmit={submit} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>{t("careers.fullNameReq")}</Label>
                    <Input
                      required
                      disabled={submitting}
                      value={form.full_name}
                      onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>{t("careers.emailReq")}</Label>
                    <Input
                      type="email"
                      required
                      disabled={submitting}
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label>{t("careers.phoneReq")}</Label>
                  <Input
                    type="tel"
                    required
                    disabled={submitting}
                    inputMode="numeric"
                    maxLength={12}
                    placeholder="622 00 00 00"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: formatGnPhone(e.target.value) })}
                  />
                </div>

                <div className="space-y-3 rounded-lg border p-4">
                  <p className="text-sm font-medium">{t("careers.docsTitle")}</p>
                  {docs.length === 0 && (
                    <p className="text-sm text-muted-foreground">{t("careers.noDocs")}</p>
                  )}
                  {docs.map((d) => (
                    <div key={d.key}>
                      <Label className="text-sm">
                        {d.label} {d.required && <span className="text-destructive">*</span>}
                      </Label>
                      <Input
                        type="file"
                        disabled={submitting}
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                        onChange={(e) =>
                          setFiles({ ...files, [d.key]: e.target.files?.[0] ?? null })
                        }
                      />
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground">{t("careers.docsHint")}</p>
                </div>

                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {submitting ? t("careers.sending") : t("careers.sendApp")}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
