import { useCallback, useEffect, useRef, useState } from "react";

export interface UseListReorderOptions<T> {
  items: T[];
  scrollContainerRef: React.RefObject<HTMLElement | null>;
  listContainerRef?: React.RefObject<HTMLElement | null>;
  itemHeight?: number;
  onReorder: (fromIndex: number, toIndex: number, item: T) => void;
  edgeThreshold?: number;
  maxScrollSpeed?: number;
}

export interface UseListReorderReturn<T> {
  isDragging: boolean;
  dragIndex: number | null;
  dropIndex: number | null;
  draggedItem: T | null;
  pointerPos: { x: number; y: number };
  grabOffset: { x: number; y: number };
  itemWidth: number;
  handleCardGrab: (
    index: number,
    item: T,
    e: React.PointerEvent<HTMLDivElement>,
  ) => void;
}

declare global {
  interface Window {
    __linerWasDragging?: boolean;
  }
}

export function useListReorder<T>({
  items,
  scrollContainerRef,
  listContainerRef,
  itemHeight = 64,
  onReorder,
  edgeThreshold = 75,
  maxScrollSpeed = 20,
}: UseListReorderOptions<T>): UseListReorderReturn<T> {
  const [isDragging, setIsDragging] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [draggedItem, setDraggedItem] = useState<T | null>(null);
  const [pointerPos, setPointerPos] = useState({ x: 0, y: 0 });
  const [grabOffset, setGrabOffset] = useState({ x: 0, y: 0 });
  const [itemWidth, setItemWidth] = useState(300);

  const isDraggingRef = useRef(false);
  const dragIndexRef = useRef<number | null>(null);
  const dropIndexRef = useRef<number | null>(null);
  const draggedItemRef = useRef<T | null>(null);
  const pointerPosRef = useRef({ x: 0, y: 0 });
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const onReorderRef = useRef(onReorder);
  onReorderRef.current = onReorder;

  const autoScrollRafRef = useRef<number | null>(null);

  const calculateDropIndex = useCallback(
    (clientY: number, currentDrop: number | null): number => {
      const total = itemsRef.current.length;
      if (total <= 1) return 0;

      const container = scrollContainerRef.current;
      if (!container) return currentDrop ?? 0;

      const targetEl = listContainerRef?.current ?? container;
      const rect = targetEl.getBoundingClientRect();
      const relativeY = clientY - rect.top;

      const h = itemHeight || 64;
      const raw = Math.floor(relativeY / h);
      const clamped = Math.max(0, Math.min(total - 1, raw));

      if (currentDrop === null) return clamped;

      const slotTop = clamped * h;
      const slotProgress = (relativeY - slotTop) / h;

      if (clamped > currentDrop && slotProgress < 0.25) {
        return currentDrop;
      }
      if (clamped < currentDrop && slotProgress > 0.75) {
        return currentDrop;
      }

      return clamped;
    },
    [itemHeight, listContainerRef, scrollContainerRef],
  );

  const startAutoScroll = useCallback(() => {
    const scrollTick = () => {
      if (!isDraggingRef.current) return;

      const container = scrollContainerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        const currentY = pointerPosRef.current.y;
        const topThreshold = rect.top + edgeThreshold;
        const bottomThreshold = rect.bottom - edgeThreshold;

        let delta = 0;
        if (currentY < topThreshold) {
          const dist = Math.min(edgeThreshold, topThreshold - currentY);
          const ratio = dist / edgeThreshold;
          delta = -Math.round(ratio * ratio * maxScrollSpeed + 2);
        } else if (currentY > bottomThreshold) {
          const dist = Math.min(edgeThreshold, currentY - bottomThreshold);
          const ratio = dist / edgeThreshold;
          delta = Math.round(ratio * ratio * maxScrollSpeed + 2);
        }

        if (delta !== 0) {
          container.scrollTop += delta;
          const newDrop = calculateDropIndex(currentY, dropIndexRef.current);
          if (newDrop !== dropIndexRef.current) {
            dropIndexRef.current = newDrop;
            setDropIndex(newDrop);
          }
        }
      }

      autoScrollRafRef.current = requestAnimationFrame(scrollTick);
    };

    autoScrollRafRef.current = requestAnimationFrame(scrollTick);
  }, [calculateDropIndex, edgeThreshold, maxScrollSpeed, scrollContainerRef]);

  const stopAutoScroll = useCallback(() => {
    if (autoScrollRafRef.current !== null) {
      cancelAnimationFrame(autoScrollRafRef.current);
      autoScrollRafRef.current = null;
    }
  }, []);

  const handleCardGrab = useCallback(
    (index: number, item: T, e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;

      const target = e.target as HTMLElement;
      if (
        target.closest("button") ||
        target.closest("a") ||
        target.closest("[role='menuitem']") ||
        target.closest("[data-prevent-drag]")
      ) {
        return;
      }

      const startX = e.clientX;
      const startY = e.clientY;

      const cardEl =
        (e.currentTarget.closest(
          "[data-reorder-item]",
        ) as HTMLElement | null) ?? e.currentTarget;

      const cardRect = cardEl.getBoundingClientRect();
      const offsetX = startX - cardRect.left;
      const offsetY = startY - cardRect.top;
      const width = cardRect.width;

      let hasActivated = false;

      const onPointerMove = (moveEvent: PointerEvent) => {
        const currentX = moveEvent.clientX;
        const currentY = moveEvent.clientY;

        if (!hasActivated) {
          const dist = Math.hypot(currentX - startX, currentY - startY);
          if (dist < 6) return;

          hasActivated = true;
          isDraggingRef.current = true;
          dragIndexRef.current = index;
          dropIndexRef.current = index;
          draggedItemRef.current = item;

          if (typeof window !== "undefined") {
            window.__linerWasDragging = true;
          }

          setIsDragging(true);
          setDragIndex(index);
          setDropIndex(index);
          setDraggedItem(item);
          setGrabOffset({ x: offsetX, y: offsetY });
          setItemWidth(width);

          document.body.style.cursor = "grabbing";
          document.body.style.userSelect = "none";

          startAutoScroll();
        }

        pointerPosRef.current = { x: currentX, y: currentY };
        setPointerPos({ x: currentX, y: currentY });

        const nextDrop = calculateDropIndex(currentY, dropIndexRef.current);
        if (nextDrop !== dropIndexRef.current) {
          dropIndexRef.current = nextDrop;
          setDropIndex(nextDrop);
        }
      };

      const onPointerUp = () => {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("pointercancel", onPointerUp);

        stopAutoScroll();

        document.body.style.cursor = "";
        document.body.style.userSelect = "";

        if (hasActivated) {
          const from = dragIndexRef.current;
          const to = dropIndexRef.current;
          const moving = draggedItemRef.current;

          if (from !== null && to !== null && from !== to && moving !== null) {
            onReorderRef.current(from, to, moving);
          }

          const suppressClick = (clickEvent: MouseEvent) => {
            clickEvent.stopPropagation();
            clickEvent.stopImmediatePropagation();
            clickEvent.preventDefault();
          };
          window.addEventListener("click", suppressClick, {
            capture: true,
            once: true,
          });

          setTimeout(() => {
            window.removeEventListener("click", suppressClick, true);
            if (typeof window !== "undefined") {
              window.__linerWasDragging = false;
            }
          }, 400);
        }

        hasActivated = false;
        isDraggingRef.current = false;
        dragIndexRef.current = null;
        dropIndexRef.current = null;
        draggedItemRef.current = null;

        setIsDragging(false);
        setDragIndex(null);
        setDropIndex(null);
        setDraggedItem(null);
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerUp);
    },
    [calculateDropIndex, startAutoScroll, stopAutoScroll],
  );

  useEffect(() => {
    return () => {
      stopAutoScroll();
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [stopAutoScroll]);

  return {
    isDragging,
    dragIndex,
    dropIndex,
    draggedItem,
    pointerPos,
    grabOffset,
    itemWidth,
    handleCardGrab,
  };
}
