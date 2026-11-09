import { useCallback, useEffect, useState } from "react";

export interface ElementSize {
  width: number;
  height: number;
}

export interface MeasuredElement<T extends HTMLElement> {
  attach: (node: T | null) => void;
  size: ElementSize | null;
}

export function useElementSize<T extends HTMLElement>(): MeasuredElement<T> {
  const [node, setNode] = useState<T | null>(null);
  const [size, setSize] = useState<ElementSize | null>(null);

  const attach = useCallback((next: T | null) => setNode(next), []);

  useEffect(() => {
    if (!node || typeof ResizeObserver === "undefined") return;
    const read = () => {
      const width = node.offsetWidth;
      const height = node.offsetHeight;
      setSize((prev) =>
        prev && prev.width === width && prev.height === height
          ? prev
          : { width, height },
      );
    };
    read();
    const observer = new ResizeObserver(read);
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);

  return { attach, size };
}
