import { useCallback, useState, type RefObject } from "react";

const FULL = "linear-gradient(to bottom, black 0%, black 100%)";

export function useScrollMask(ref: RefObject<HTMLDivElement | null>) {
  const [mask, setMask] = useState(FULL);
  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const { scrollTop, clientHeight, scrollHeight } = el;
    const top =
      scrollTop > 4 ? "transparent 0%, black 6%, " : "black 0%, black 6%, ";
    const bottom =
      scrollTop + clientHeight < scrollHeight - 4
        ? "black 94%, transparent 100%"
        : "black 94%, black 100%";
    setMask(`linear-gradient(to bottom, ${top}${bottom})`);
  }, [ref]);
  return { mask, update };
}
