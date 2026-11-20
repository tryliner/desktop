import { Search2Line, CloseCircleFill } from "@mingcute/react";
import TextInput from "@/shared/ui/TextInput";
import { useTranslation } from "@/languages";

const INPUT_CLASS =
  "!h-[36px] w-full rounded-control !border-transparent bg-bg-elevated text-body";

interface PickerSearchProps {
  value: string;
  onChange: (value: string) => void;
}

export function PickerSearch({ value, onChange }: PickerSearchProps) {
  const { t } = useTranslation();
  return (
    <div className="px-[8px]">
      <TextInput
        size="sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("library.search_playlists")}
        icon={<Search2Line size={16} />}
        rightSlot={
          value ? (
            <button
              type="button"
              aria-label={t("playlist_picker.clear_search")}
              onClick={() => onChange("")}
              className="flex cursor-pointer items-center justify-center border-none bg-transparent p-0 text-text-tertiary hover:text-text-primary"
            >
              <CloseCircleFill size={15} />
            </button>
          ) : null
        }
        className={INPUT_CLASS}
      />
    </div>
  );
}

interface PickerNewTitleProps {
  value: string;
  maxLength: number;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function PickerNewTitle({
  value,
  maxLength,
  onChange,
  onSubmit,
  onCancel,
}: PickerNewTitleProps) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-[8px] px-[8px]">
      <TextInput
        size="sm"
        autoFocus
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.stopPropagation();
            onSubmit();
          } else if (e.key === "Escape") {
            e.stopPropagation();
            onCancel();
          }
        }}
        placeholder={t("playlist_picker.new_playlist")}
        className={INPUT_CLASS}
      />
    </div>
  );
}
