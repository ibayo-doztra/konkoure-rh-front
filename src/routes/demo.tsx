import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLandingCopy } from "@/lib/landing/useLandingCopy";
import { submitDemoRequest } from "@/lib/api/platform";
import { ApiError, apiErrorMessage } from "@/lib/api/client";
import { COMPANY_SIZES, createDemoRequestSchema } from "@/lib/demo-requests.schema";
import { SITE_URL } from "@/lib/site";

const TEXT = {
  fr: {
    eyebrow: "Démonstration",
    title: "Demander une démo de Konkouré",
    subtitle:
      "Dites-nous en quelques mots qui vous êtes et ce dont vous avez besoin. Notre équipe vous rappelle sous 24 h pour une démonstration adaptée à votre entreprise.",
    fullName: "Nom complet",
    email: "E-mail professionnel",
    phone: "Téléphone",
    companyName: "Nom de l'entreprise",
    companySize: "Taille de l'entreprise",
    sizePlaceholder: "Sélectionner",
    message: "Décrivez votre besoin (optionnel)",
    messagePlaceholder:
      "Ex. : nous gérons 60 employés sur 3 sites et cherchons un pointage géolocalisé et la gestion des congés.",
    submit: "Envoyer ma demande",
    submitting: "Envoi en cours…",
    successTitle: "Demande envoyée",
    successBody: "Merci ! Notre équipe vous contacte sous 24 heures ouvrées.",
    again: "Envoyer une autre demande",
    unexpectedError: "Erreur inattendue",
    rateLimited: "Trop de demandes envoyées. Réessayez dans une heure.",
  },
  en: {
    eyebrow: "Demo",
    title: "Request a Konkouré demo",
    subtitle:
      "Tell us who you are and what you need. Our team gets back to you within 24 hours with a demo tailored to your company.",
    fullName: "Full name",
    email: "Work email",
    phone: "Phone",
    companyName: "Company name",
    companySize: "Company size",
    sizePlaceholder: "Select",
    message: "Describe your needs (optional)",
    messagePlaceholder:
      "E.g. we manage 60 employees across 3 sites and need geolocated time tracking and leave management.",
    submit: "Send my request",
    submitting: "Sending…",
    successTitle: "Request sent",
    successBody: "Thank you! Our team will contact you within 24 business hours.",
    again: "Send another request",
    unexpectedError: "Unexpected error",
    rateLimited: "Too many requests sent. Please try again in an hour.",
  },
} as const;

const TITLE = "Demander une démo — Konkouré SIRH";
const DESCRIPTION =
  "Demandez une démonstration personnalisée de Konkouré : indiquez votre entreprise, sa taille et votre besoin RH.";

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/demo` }],
  }),
  component: DemoRequestPage,
});

const EMPTY = {
  fullName: "",
  email: "",
  phone: "",
  companyName: "",
  companySize: "",
  message: "",
};

function DemoRequestPage() {
  const { lang } = useLandingCopy();
  const t = TEXT[lang];

  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  // Revalide les erreurs déjà affichées quand la langue change.
  useEffect(() => {
    setErrors((prev) => {
      if (Object.keys(prev).length === 0) return prev;
      const parsed = createDemoRequestSchema(lang).safeParse(form);
      if (parsed.success) return {};
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "");
        if (key && !next[key]) next[key] = issue.message;
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  const set = (key: keyof typeof EMPTY, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = createDemoRequestSchema(lang).safeParse(form);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "");
        if (key && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setPending(true);
    try {
      const { message, ...rest } = parsed.data;
      await submitDemoRequest({ ...rest, ...(message ? { message } : {}) });
      setForm(EMPTY);
      setSent(true);
    } catch (err) {
      toast.error(
        err instanceof ApiError && err.status === 429
          ? t.rateLimited
          : err instanceof ApiError
            ? apiErrorMessage(err)
            : t.unexpectedError,
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-[720px] px-5 py-14">
        <p className="text-xs font-bold uppercase tracking-wide text-primary-strong">{t.eyebrow}</p>
        <h1 className="mt-3 text-[clamp(26px,4vw,38px)] font-black leading-tight tracking-[-0.01em]">
          {t.title}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">{t.subtitle}</p>

        {sent ? (
          <div className="mt-8 rounded-2xl border bg-card p-6 shadow-card">
            <p className="flex items-center gap-2 text-base font-bold text-success">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              {t.successTitle}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">{t.successBody}</p>
            <Button variant="outline" className="mt-5" onClick={() => setSent(false)}>
              {t.again}
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-8 rounded-2xl border bg-card p-6 shadow-card">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={t.fullName} error={errors["fullName"]} htmlFor="fullName" required>
                <Input
                  id="fullName"
                  value={form.fullName}
                  maxLength={120}
                  onChange={(e) => set("fullName", e.target.value)}
                />
              </Field>
              <Field label={t.email} error={errors["email"]} htmlFor="email" required>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  maxLength={255}
                  onChange={(e) => set("email", e.target.value)}
                />
              </Field>
              <Field label={t.phone} error={errors["phone"]} htmlFor="phone" required>
                <Input
                  id="phone"
                  value={form.phone}
                  maxLength={40}
                  placeholder="+224 6XX XX XX XX"
                  onChange={(e) => set("phone", e.target.value)}
                />
              </Field>
              <Field
                label={t.companyName}
                error={errors["companyName"]}
                htmlFor="companyName"
                required
              >
                <Input
                  id="companyName"
                  value={form.companyName}
                  maxLength={160}
                  onChange={(e) => set("companyName", e.target.value)}
                />
              </Field>
              <Field
                label={t.companySize}
                error={errors["companySize"]}
                htmlFor="companySize"
                required
              >
                <Select value={form.companySize} onValueChange={(v) => set("companySize", v)}>
                  <SelectTrigger id="companySize">
                    <SelectValue placeholder={t.sizePlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPANY_SIZES.map((size) => (
                      <SelectItem key={size} value={size}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <div className="sm:col-span-2">
                <Field label={t.message} error={errors["message"]} htmlFor="message">
                  <Textarea
                    id="message"
                    rows={5}
                    maxLength={2000}
                    value={form.message}
                    placeholder={t.messagePlaceholder}
                    onChange={(e) => set("message", e.target.value)}
                  />
                </Field>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button type="submit" disabled={pending} className="h-11 px-6 font-medium">
                {pending ? t.submitting : t.submit}
              </Button>
            </div>
          </form>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function Field({
  label,
  htmlFor,
  error,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
