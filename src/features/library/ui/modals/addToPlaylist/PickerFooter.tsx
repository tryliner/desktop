import { AddLine } from "@mingcute/react";
import { DialogActions, DialogButton } from "@/shared/ui";
import { useTranslation } from "@/languages";

interface PickerFooterProps {
  creating: boolean;
  creatingPending: boolean;
  canCreate: boolean;
  selectedCount: number;
  submitting: boolean;
  onStartCreate: () => void;
  onCreate: () => void;
  onSubmit: () => void;
}

export function PickerFooter({
  creating,
  creatingPending,
  canCreate,
  selectedCount,
  submitting,
  onStartCreate,
  onCreate,
  onSubmit,
}: PickerFooterProps) {
  const { t } = useTranslation();
  return (
    <div className="px-[8px] pb-[8px]">
      <DialogActions>
        {creating ? (
          <DialogButton
            type="button"
            loading={creatingPending}
            disabled={!canCreate}
            onClick={onCreate}
          >
            {t("library.create_playlist")}
          </DialogButton>
        ) : (
          <DialogButton type="button" onClick={onStartCreate}>
            <span className="inline-flex items-center gap-[6px]">
              <AddLine size={16} />
              {t("playlist_picker.new_playlist")}
            </span>
          </DialogButton>
        )}
        <DialogButton
          type="button"
          variant="primary"
          loading={submitting}
          disabled={selectedCount === 0}
          onClick={onSubmit}
        >
          {selectedCount > 0
            ? t("playlist_picker.add_to", { count: selectedCount })
            : t("playlist_picker.pick_playlists")}
        </DialogButton>
      </DialogActions>
    </div>
  );
}
