import { useEffect, useState } from "react";

// useMediaQuery: tracks whether a CSS media query currently matches, updating on viewport changes.
// Used to switch sidebar behavior between "persistent, collapsible panel" (desktop) and "off-canvas
// drawer" (mobile) — those are different UX patterns, not just a width difference, so JS-level branching
// is needed in addition to responsive Tailwind classes.
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => (typeof window !== "undefined" ? window.matchMedia(query).matches : false));

  useEffect(() => {
    const mediaQueryList = window.matchMedia(query);
    const listener = () => setMatches(mediaQueryList.matches);
    listener();
    mediaQueryList.addEventListener("change", listener);
    return () => mediaQueryList.removeEventListener("change", listener);
  }, [query]);

  return matches;
}
