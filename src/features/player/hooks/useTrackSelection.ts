import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  useTrackSelectionStore,
  selectionKey,
  type SelectableTrack,
  type SelectionScopeMeta,
} from "../store/trackSelectionStore";

export interface RowSelectionProps {
  selected: boolean;
  /**
   * called for every row click; returns true when the click was a selection
   * gesture (Ctrl/Cmd toggles, Shift selects a range) and must not play
   */
  onSelectClick: (event: React.MouseEvent) => boolean;
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/**
 * Multi-select for one track list. Ctrl/Cmd-click toggles a row, Shift-click
 * extends from the last toggled row, Ctrl/Cmd+A selects the whole list once a
 * selection exists in it, Escape clears. A plain click clears the selection
 * and plays as usual, so nothing changes for people who never use it.
 */
export function useTrackSelection(
  scope: string,
  ordered: SelectableTrack[],
  meta: SelectionScopeMeta = {},
) {
  const orderedRef = useRef(ordered);
  orderedRef.current = ordered;
  const metaRef = useRef(meta);
  metaRef.current = meta;

  const active = useTrackSelectionStore((s) => s.scope === scope);
  const keys = useTrackSelectionStore((s) =>
    s.scope === scope ? s.keys : EMPTY_KEYS,
  );
  const selectedSet = useMemo(() => new Set(keys), [keys]);

  const onSelectClick = useCallback(
    (track: SelectableTrack, event: React.MouseEvent): boolean => {
      const store = useTrackSelectionStore.getState();
      if (event.shiftKey) {
        store.selectRange(scope, metaRef.current, orderedRef.current, track);
        return true;
      }
      if (event.metaKey || event.ctrlKey) {
        store.toggle(scope, metaRef.current, orderedRef.current, track);
        return true;
      }
      if (store.keys.length > 0) store.clear();
      return false;
    },
    [scope],
  );

  const rowProps = useCallback(
    (track: SelectableTrack): RowSelectionProps => ({
      selected: selectedSet.has(selectionKey(track)),
      onSelectClick: (event) => onSelectClick(track, event),
    }),
    [selectedSet, onSelectClick],
  );

  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isTyping(event.target)) return;
      if (event.key === "Escape") {
        useTrackSelectionStore.getState().clear();
        event.preventDefault();
        return;
      }
      if (
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        event.key.toLowerCase() === "a"
      ) {
        event.preventDefault();
        useTrackSelectionStore
          .getState()
          .selectAll(scope, metaRef.current, orderedRef.current);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active, scope]);

  // leaving the list (navigation, unmount) drops its selection
  useEffect(
    () => () => {
      if (useTrackSelectionStore.getState().scope === scope) {
        useTrackSelectionStore.getState().clear();
      }
    },
    [scope],
  );

  const isSelected = useCallback(
    (track: SelectableTrack) => selectedSet.has(selectionKey(track)),
    [selectedSet],
  );

  return { rowProps, isSelected, onSelectClick, selectedCount: keys.length };
}

const EMPTY_KEYS: string[] = [];
