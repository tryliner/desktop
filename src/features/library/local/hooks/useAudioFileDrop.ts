import { useEffect, useRef, useState } from "react";

const AUDIO_EXTENSION = /\.(mp3|flac|m4a|aac|ogg|opus|wav|webm)$/i;

const carriesFiles = (event: DragEvent) =>
  Array.from(event.dataTransfer?.types ?? []).includes("Files");

const draggedFileCount = (event: DragEvent) =>
  Array.from(event.dataTransfer?.items ?? []).filter(
    (item) => item.kind === "file",
  ).length;

/**
 * Places that take their own file drops (playlist cover, wallpaper gallery)
 * mark themselves with `data-own-drop`; "screen" means the whole open dialog
 * or tab owns drops while it's shown. The audio import stays out of the way.
 */
function ownedElsewhere(event: DragEvent): boolean {
  const target = event.target;
  if (target instanceof Element && target.closest("[data-own-drop]")) {
    return true;
  }
  return (
    typeof document !== "undefined" &&
    Boolean(document.querySelector('[data-own-drop="screen"]'))
  );
}

export function isAudioFile(file: File): boolean {
  return AUDIO_EXTENSION.test(file.name);
}

export function useAudioFileDrop(onDrop: (files: File[]) => void) {
  const [dragging, setDragging] = useState(false);
  const [fileCount, setFileCount] = useState(0);
  const depth = useRef(0);
  const onDropRef = useRef(onDrop);

  useEffect(() => {
    onDropRef.current = onDrop;
  }, [onDrop]);

  useEffect(() => {
    const enter = (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      if (ownedElsewhere(event)) {
        depth.current = 0;
        setDragging(false);
        return;
      }
      event.preventDefault();
      depth.current += 1;
      setFileCount(draggedFileCount(event));
      setDragging(true);
    };
    const over = (event: DragEvent) => {
      if (!carriesFiles(event) || ownedElsewhere(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    };
    const leave = (event: DragEvent) => {
      if (!carriesFiles(event) || ownedElsewhere(event)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setDragging(false);
    };
    const drop = (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      depth.current = 0;
      setDragging(false);
      if (ownedElsewhere(event)) return;
      event.preventDefault();
      onDropRef.current(Array.from(event.dataTransfer?.files ?? []));
    };

    window.addEventListener("dragenter", enter);
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
    };
  }, []);

  return { dragging, fileCount };
}
