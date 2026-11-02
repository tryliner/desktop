import { useLayoutEffect, useRef, type ReactNode } from "react";

export default function KeepAlivePage({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollTopsRef = useRef(new Map<Element, number>());

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const scrollTops = scrollTopsRef.current;
    for (const [element, top] of scrollTops) {
      if (root.contains(element)) element.scrollTop = top;
      else scrollTops.delete(element);
    }
    const remember = (event: Event) => {
      const target = event.target;
      if (target instanceof Element) scrollTops.set(target, target.scrollTop);
    };
    root.addEventListener("scroll", remember, { capture: true, passive: true });
    return () =>
      root.removeEventListener("scroll", remember, { capture: true });
  }, []);

  return (
    <div ref={rootRef} data-keep-alive className="page-transition-kept">
      {children}
    </div>
  );
}
