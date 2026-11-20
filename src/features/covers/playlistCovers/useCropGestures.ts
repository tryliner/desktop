import { useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent, WheelEvent, DragEvent } from "react";
import type { Point } from "./coverCrop";
import { CENTER, type CropState } from "./useCropState";

const KEY_ZOOM = 1.15;

function carriesFile(e: DragEvent<HTMLElement>): boolean {
  return [...e.dataTransfer.items].some((item) => item.kind === "file");
}

export function useCropGestures(
  crop: CropState,
  enabled: boolean,
  onFile: (file: File) => void,
) {
  const [dragOver, setDragOver] = useState(false);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ id: number; start: Point; from: Point } | null>(null);
  const endDrag = () => {
    drag.current = null;
    setDragging(false);
  };

  return {
    dragOver,
    dragging,
    handlers: {
      onDragOver: (e: DragEvent<HTMLDivElement>) => {
        if (!carriesFile(e)) return;
        e.preventDefault();
        setDragOver(true);
      },
      onDragLeave: () => setDragOver(false),
      onDrop: (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) onFile(file);
      },
      onWheel: (e: WheelEvent<HTMLDivElement>) => {
        if (!enabled) return;
        const rect = e.currentTarget.getBoundingClientRect();
        crop.zoomAt(crop.zoom * Math.exp(-e.deltaY * 0.0025), {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
      },
      onPointerDown: (e: PointerEvent<HTMLDivElement>) => {
        if (!enabled) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = {
          id: e.pointerId,
          start: { x: e.clientX, y: e.clientY },
          from: crop.offset,
        };
        setDragging(true);
      },
      onPointerMove: (e: PointerEvent<HTMLDivElement>) => {
        const current = drag.current;
        if (!current || current.id !== e.pointerId) return;
        crop.moveTo({
          x: current.from.x + e.clientX - current.start.x,
          y: current.from.y + e.clientY - current.start.y,
        });
      },
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
      onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
        if (!enabled) return;
        const step = e.shiftKey ? 40 : 10;
        const moves: Record<string, Point> = {
          ArrowLeft: { x: step, y: 0 },
          ArrowRight: { x: -step, y: 0 },
          ArrowUp: { x: 0, y: step },
          ArrowDown: { x: 0, y: -step },
        };
        const move = moves[e.key];
        if (move) {
          e.preventDefault();
          crop.moveTo({ x: crop.offset.x + move.x, y: crop.offset.y + move.y });
        } else if (e.key === "+" || e.key === "=") {
          crop.zoomAt(crop.zoom * KEY_ZOOM, CENTER);
        } else if (e.key === "-") {
          crop.zoomAt(crop.zoom / KEY_ZOOM, CENTER);
        } else if (e.key === "0") {
          crop.reset();
        }
      },
    },
  };
}
