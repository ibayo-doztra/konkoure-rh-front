import { Check, MapPin } from "lucide-react";
import { Reveal } from "./primitives/Reveal";
import { Section } from "./primitives/Section";
import { useLandingCopy } from "@/lib/landing/useLandingCopy";
import { cn } from "@/lib/utils";

export function GeoAttendanceSection() {
  const { copy } = useLandingCopy();
  const t = copy.timeclock;

  return (
    <Section id="pointage">
      <Reveal>
        <div className="rounded-2xl border bg-card p-6 shadow-card">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] items-center gap-7">
            <div>
              <p className="text-xs font-medium text-primary-strong">{t.eyebrow}</p>
              <h2 className="mt-2 text-2xl font-bold leading-tight tracking-[-0.01em]">{t.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t.desc}</p>
              <ul className="mt-5 space-y-2.5 text-sm">
                {t.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2.5">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border bg-background p-[18px]">
              <p className="text-xs font-bold text-muted-foreground">{t.panelTitle}</p>
              <ul className="mt-3 space-y-2.5">
                {t.sites.map((s) => (
                  <li
                    key={s.name}
                    className="flex items-center justify-between gap-3 rounded-md border bg-card p-3"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <MapPin className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                      <span className="truncate text-sm font-medium">{s.name}</span>
                    </span>
                    <span
                      className={cn(
                        "shrink-0 whitespace-nowrap text-xs",
                        s.warning ? "font-medium text-warning" : "text-muted-foreground",
                      )}
                    >
                      {s.status}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[10px] text-muted-foreground">{t.footnote}</p>
            </div>
          </div>
        </div>
      </Reveal>
    </Section>
  );
}
