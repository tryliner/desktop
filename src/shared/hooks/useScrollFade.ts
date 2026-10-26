import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";

const EDGE_TOLERANCE = 4;
const FADE_SIZE = "28px";

function maskFor(top: boolean, bottom: boolean): string {
  const start = top ? `transparent 0, black ${FADE_SIZE}` : "black 0";
  const end = bottom
    ? `black calc(100% - ${FADE_SIZE}), transparent 100%`
    : "black 100%";
  return `linear-gradient(to bottom, ${start}, ${end})`;
}

export interface ScrollFade<T extends HTMLElement> {
  attach: (node: T | null) => void;
  style: CSSProperties;
  onScroll: () => void;
}

export function useScrollFade<T extends HTMLElement>(): ScrollFade<T> {
  const nodeRef = useRef<T | null>(null);
  const [edges, setEdges] = useState({ top: false, bottom: false });

  const update = useCallback(() => {
    const node = nodeRef.current;
    if (!node) return;
    const { scrollTop, clientHeight, scrollHeight } = node;
    const top = scrollTop > EDGE_TOLERANCE;
    const bottom = scrollTop + clientHeight < scrollHeight - EDGE_TOLERANCE;
    setEdges((current) =>
      current.top === top && current.bottom === bottom
        ? current
        : { top, bottom },
    );
  }, []);

  const [node, setNode] = useState<T | null>(null);
  const attach = useCallback((next: T | null) => {
    nodeRef.current = next;
    setNode(next);
  }, []);

  useEffect(() => {
    if (!node) return;
    const resizes = new ResizeObserver(update);
    const observeChildren = () =>
      Array.from(node.children).forEach((child) => resizes.observe(child));
    const mutations = new MutationObserver(() => {
      observeChildren();
      update();
    });
    resizes.observe(node);
    observeChildren();
    mutations.observe(node, { childList: true, subtree: true });
    return () => {
      resizes.disconnect();
      mutations.disconnect();
    };
  }, [node, update]);

  const mask = maskFor(edges.top, edges.bottom);
  return {
    attach,
    onScroll: update,
    style: { maskImage: mask, WebkitMaskImage: mask },
  };
}
