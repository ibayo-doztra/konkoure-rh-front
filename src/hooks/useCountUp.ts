import { useEffect, useRef, useState } from "react";

type CountUpOptions = { active?: boolean; durationMs?: number };

/**
 * Animates a displayed value from 0 to `target` with an ease-out curve.
 * Client-side only (requestAnimationFrame); restarts whenever `target` or
 * `active` changes. While `active` is false, holds 0.
 * Accepts either a duration in ms (`useCountUp(5, 900)`) or an options object
 * (`useCountUp(5, { active })`) — used by the landing trust-band counters.
 * Returns the raw animated float — format it at the call site.
 */
export function useCountUp(
  target: number | null | undefined,
  options?: number | CountUpOptions,
): number {
  const durationMs = typeof options === "number" ? options : (options?.durationMs ?? 900);
  const active = typeof options === "number" || options == null ? true : options.active !== false;

  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (!active) {
      setValue(0);
      return;
    }
    if (target === null || target === undefined || !Number.isFinite(target)) {
      setValue(0);
      return;
    }
    const from = 0;
    const start = performance.now();
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      setValue(from + (target - from) * easeOutCubic(t));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [target, durationMs, active]);

  return value;
}

/** Formats an animated day count in the active language (e.g. "4,5" in fr). */
export function formatDayCount(value: number, language: string): string {
  return new Intl.NumberFormat(language, {
    maximumFractionDigits: 1,
  }).format(value);
}
