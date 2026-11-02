import { useEffect, useRef, useState } from "react";
import { animate } from "framer-motion";

export const SMOOTH_EASE = [0.22, 1, 0.36, 1] as const;

/** Follows `value` with a 0.7s eased tween, for numbers that count up/down. */
export function useTweenedNumber(value: number) {
  const [current, setCurrent] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    const controls = animate(fromRef.current, value, {
      duration: 0.7,
      ease: SMOOTH_EASE,
      onUpdate: (next) => {
        fromRef.current = next;
        setCurrent(next);
      },
    });
    return () => controls.stop();
  }, [value]);

  return current;
}
