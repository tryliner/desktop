import { LuPin, LuPinOff } from "react-icons/lu";
import { useTranslation } from "@/languages";
import { showToast } from "@/shared/ui";
import type { DropdownMenuItem } from "@/shared/ui/DropdownMenu";
import { usePinStore, type PinnedItem } from "../store/pinStore";

export function usePinMenuItem(
  item: PinnedItem | null,
): DropdownMenuItem | null {
  const { t } = useTranslation();
  const pinned = usePinStore((state) =>
    item ? state.items.some((pin) => pin.key === item.key) : false,
  );
  const toggle = usePinStore((state) => state.toggle);

  if (!item) return null;

  return {
    id: pinned ? "unpin" : "pin",
    label: pinned ? t("pins.unpin") : t("pins.pin"),
    icon: pinned ? <LuPinOff size={15} /> : <LuPin size={15} />,
    onClick: () => {
      toggle(item);
      showToast(pinned ? t("pins.unpinned") : t("pins.pinned"), "checkmark", {
        description: item.title,
      });
    },
  };
}
