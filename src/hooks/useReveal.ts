import { useEffect, useRef, useState, type RefObject } from "react";
import { useReducedMotion } from "./useReducedMotion";

/**
 * Apparition au scroll.
 *
 * Un IntersectionObserver seul ne suffit pas : un saut de scroll (clic sur une
 * ancre, `scrollTo`) peut faire passer un élément de « sous le viewport » à
 * « au-dessus du viewport » sans aucune frame d'intersection — il resterait
 * alors invisible définitivement. On ajoute donc un balayage initial et un
 * écouteur de scroll throttlé qui révèle tout élément déjà dépassé.
 */
export function useReveal<T extends HTMLElement>(): {
  ref: RefObject<T | null>;
  isVisible: boolean;
} {
  const ref = useRef<T>(null);
  const reduced = useReducedMotion();
  const [isVisible, setVisible] = useState(false);

  useEffect(() => {
    if (reduced) {
      setVisible(true);
      return;
    }
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }

    let done = false;
    const reveal = () => {
      if (done) return;
      done = true;
      setVisible(true);
      io.unobserve(node);
      window.removeEventListener("scroll", onScroll);
    };

    const isPassed = () => {
      const r = node.getBoundingClientRect();
      return r.bottom < 0 || r.top < window.innerHeight * 0.95;
    };

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) reveal();
      },
      { threshold: 0.08, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(node);

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.setTimeout(() => {
        ticking = false;
        if (isPassed()) reveal();
      }, 120);
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    // Rattrapage au montage : élément déjà visible ou déjà dépassé.
    const raf = requestAnimationFrame(() => {
      if (isPassed()) reveal();
    });

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, [reduced]);

  return { ref, isVisible };
}
