import { flushSync } from "react-dom";

const REVEAL_DURATION_MS = 520;
const REVEAL_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

export interface RevealOrigin {
  x: number;
  y: number;
}

function prefersReducedMotion(): boolean {
  return (
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
  );
}

function revealRadius({ x, y }: RevealOrigin): number {
  return Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y),
  );
}

export function revealThemeChange(
  apply: () => void,
  origin: RevealOrigin,
): void {
  if (
    typeof document.startViewTransition !== "function" ||
    prefersReducedMotion()
  ) {
    apply();
    return;
  }
  const transition = document.startViewTransition(() => {
    flushSync(apply);
  });
  void transition.ready
    .then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${origin.x}px ${origin.y}px)`,
            `circle(${revealRadius(origin)}px at ${origin.x}px ${origin.y}px)`,
          ],
        },
        {
          duration: REVEAL_DURATION_MS,
          easing: REVEAL_EASING,
          pseudoElement: "::view-transition-new(root)",
        },
      );
    })
    .catch(() => undefined);
}
