import { useState, useRef, useEffect } from "react";
import Dialog from "@/shared/ui/Dialog";
import { useTranslation } from "@/languages";
import { useModalStore } from "../../store/modalStore";
import { PickerSelectionHeader } from "./addToPlaylist/PickerSelectionHeader";
import { PickerList } from "./addToPlaylist/PickerList";
import { PickerNewTitle, PickerSearch } from "./addToPlaylist/PickerInputs";
import { PickerFooter } from "./addToPlaylist/PickerFooter";
import { usePickerRows } from "./addToPlaylist/usePickerRows";
import { usePickerActions } from "./addToPlaylist/usePickerActions";
import { useScrollMask } from "./addToPlaylist/useScrollMask";

export default function AddToPlaylistModal() {
  const { t } = useTranslation();
  const open = useModalStore((state) => state.addToPlaylistOpen);
  const tracks = useModalStore((state) => state.addToPlaylistTracks);
  const close = useModalStore((state) => state.closeAddToPlaylist);

  const [searchQuery, setSearchQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollMask = useScrollMask(scrollRef);

  const rows = usePickerRows(open, tracks, searchQuery);
  const actions = usePickerActions(tracks, rows.all, close, scrollRef);
  const { resetSelection } = actions;
  const updateMask = scrollMask.update;

  useEffect(() => {
    if (open) return;
    setSearchQuery("");
    resetSelection();
    setCreating(false);
    setNewTitle("");
  }, [open, resetSelection]);

  const visibleCount = rows.recentRows.length + rows.otherRows.length;
  useEffect(() => {
    if (rows.searchable) updateMask();
  }, [open, rows.searchable, visibleCount, updateMask]);

  const submitSelected = () => void actions.submit([...actions.selected]);
  const handleCreate = async () => {
    if (!(await actions.create(newTitle))) return;
    setCreating(false);
    setNewTitle("");
    setSearchQuery("");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (!next ? close() : undefined)}
      maxWidth={400}
    >
      <div
        className="flex flex-col gap-[12px] px-[12px] pb-[12px]"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !creating && actions.selected.size > 0) {
            e.preventDefault();
            submitSelected();
          }
        }}
      >
        <div className="px-[8px] pt-[4px]">
          <h2 className="m-0 text-heading font-[600] tracking-[-0.01em] text-text-primary">
            {t("playlist_picker.title", { count: tracks.length })}
          </h2>
          <PickerSelectionHeader tracks={tracks} />
        </div>
        {rows.searchable && (
          <PickerSearch value={searchQuery} onChange={setSearchQuery} />
        )}
        {creating && (
          <PickerNewTitle
            value={newTitle}
            maxLength={actions.titleMax}
            onChange={setNewTitle}
            onSubmit={() => void handleCreate()}
            onCancel={() => setCreating(false)}
          />
        )}
        <PickerList
          ref={scrollRef}
          rows={rows}
          trackCount={tracks.length}
          selected={actions.selected}
          submitting={actions.submitting}
          hasQuery={Boolean(searchQuery)}
          scrollMask={rows.searchable ? scrollMask.mask : undefined}
          onScroll={rows.searchable ? updateMask : undefined}
          onToggle={actions.toggle}
          onSubmitOne={(id) => void actions.submit([id])}
        />
        <PickerFooter
          creating={creating}
          creatingPending={actions.creatingPending}
          canCreate={Boolean(newTitle.trim())}
          selectedCount={actions.selected.size}
          submitting={actions.submitting}
          onStartCreate={() => setCreating(true)}
          onCreate={() => void handleCreate()}
          onSubmit={submitSelected}
        />
      </div>
    </Dialog>
  );
}
