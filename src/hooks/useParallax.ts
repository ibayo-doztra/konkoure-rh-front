import { useEffect, useState } from "react";
import { useReducedMotion } from "./useReducedMotion";

/**
 * Parallaxe très légère : renvoie le décalage vertical à appliquer,
 * limité aux 700 premiers pixels de défilement et désactivé en
 * `prefers-reduced-motion`.
 */
export function useParallax(factor: number): number {
  const reduced = useReducedMotion();
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (reduced || typeof window === "undefined") return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const y = window.scrollY;
        setOffset(y < 700 ? y * factor : 700 * factor);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [factor, reduced]);

  return offset;
}
