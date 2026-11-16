import { Link } from "@tanstack/react-router";
import { Check, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "./primitives/Reveal";
import { HERO_PIPELINE } from "@/lib/landing/copy";
import { useLandingCopy } from "@/lib/landing/useLandingCopy";
import { useParallax } from "@/hooks/useParallax";

/** Aperçu produit décoratif : pipeline de recrutement + pastille de pointage. */
function HeroProductMock() {
  const { copy } = useLandingCopy();
  const m = copy.hero.mockup;
  const mockOffset = useParallax(-0.035);
  const chipOffset = useParallax(0.05);

  return (
    <div className="relative">
      <div
        className="overflow-hidden rounded-2xl border bg-card shadow-float"
        style={{ transform: `translateY(${mockOffset}px)` }}
      >
        <div className="flex items-center gap-2.5 px-4 py-3">
          <span
            aria-hidden
            className="grid h-[26px] w-[26px] place-items-center rounded-lg gradient-primary text-xs font-black text-primary-foreground"
          >
            K
          </span>
          <p className="text-[13px] font-bold">{m.title}</p>
          <span className="ml-auto rounded-full bg-primary-soft px-2.5 py-1 text-[10px] font-medium text-primary-strong">
            {m.aiBadge}
          </span>
        </div>

        <div aria-hidden className="grid grid-cols-3 items-start gap-2.5 bg-background p-4 pb-[74px]">
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              {m.colShortlist}
            </p>
            {HERO_PIPELINE.shortlist.map((c) => (
              <div key={c.name} className="rounded-md border bg-card p-2.5 shadow-card">
                <p className="truncate text-xs font-medium">{c.name}</p>
                <div className="mt-2 h-[5px] overflow-hidden rounded-full bg-primary-soft">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${c.score}%` }} />
                </div>
                <p className="mt-1.5 text-[10px] text-muted-foreground">
                  {m.scoreLabel} {c.score}
                </p>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              {m.colInterview}
            </p>
            <div className="rounded-md border bg-card p-2.5 shadow-card">
              <p className="truncate text-xs font-medium">{HERO_PIPELINE.interview}</p>
              <p className="mt-1.5 text-[10px] text-muted-foreground">{m.interviewAt}</p>
            </div>
            <div className="rounded-md border border-dashed p-2.5 text-center text-[10px] text-muted-foreground">
              {m.dropHint}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              {m.colOffer}
            </p>
            <div className="rounded-md border bg-card p-2.5 shadow-card">
              <p className="truncate text-xs font-medium">{HERO_PIPELINE.offer}</p>
              <p className="mt-1.5 text-[10px] font-medium text-success">{m.offerSent}</p>
            </div>
          </div>
        </div>
      </div>

      <div
        aria-hidden
        className="absolute -bottom-[26px] right-2.5 w-[218px] max-w-[calc(100%-20px)] rounded-[18px] border border-card/70 bg-card/70 p-3.5 shadow-glass backdrop-blur-[12px]"
        style={{ transform: `translateY(${chipOffset}px)` }}
      >
        <p className="flex items-center gap-1.5 text-xs font-bold text-primary-strong">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          {m.chipTitle}
        </p>
        <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">{m.chipDetail}</p>
        <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium text-success">
          <Check className="h-3.5 w-3.5 shrink-0" />
          {m.chipStatus}
        </p>
      </div>
    </div>
  );
}

export function HeroSection() {
  const { copy } = useLandingCopy();
  const h = copy.hero;

  return (
    <section className="relative overflow-hidden pb-16 pt-10 md:pb-20 md:pt-14">
      <div
        aria-hidden
        className="hero-halo pointer-events-none absolute left-1/2 top-0 h-[420px] w-[900px] max-w-none -translate-x-1/2"
      />
      <div className="relative mx-auto grid w-full max-w-[1160px] grid-cols-[repeat(auto-fit,minmax(330px,1fr))] items-center gap-10 px-5">
        <Reveal>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1.5 text-xs text-primary-strong">
            {h.badge}
          </span>
          <h1 className="mt-5 max-w-[15ch] text-[clamp(28px,4.4vw,46px)] font-black leading-[1.08] tracking-[-0.01em]">
            {h.title}
          </h1>
          <p className="mt-5 max-w-[52ch] text-base leading-relaxed text-muted-foreground">
            {h.subtitle}
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Button
              asChild
              className="h-[46px] rounded-md px-[22px] font-medium shadow-cta transition-transform hover:-translate-y-0.5"
            >
              <Link to="/signup">{h.ctaPrimary}</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-[46px] rounded-md border-border bg-card px-[22px] font-medium transition-transform hover:-translate-y-0.5 hover:bg-accent hover:text-primary-strong"
            >
              <Link to="/demo">{h.ctaSecondary}</Link>
            </Button>
          </div>
          <p className="mt-5 text-xs text-muted-foreground">{h.reassurance}</p>
        </Reveal>

        <Reveal index={1}>
          <HeroProductMock />
        </Reveal>
      </div>
    </section>
  );
}
