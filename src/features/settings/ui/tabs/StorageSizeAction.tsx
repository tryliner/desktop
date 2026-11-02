import { ConfirmPill } from "@/shared/ui";
import { formatStorageBytes } from "@/shared/utils/cacheManager";
import { useTweenedNumber } from "./StorageOverview";

export function StorageSizeAction({
  bytes,
  actionLabel,
  confirmLabel,
  onConfirm,
  disabled = false,
}: {
  bytes: number;
  actionLabel: string;
  confirmLabel: string;
  onConfirm: () => void;
  disabled?: boolean;
}) {
  const tweened = useTweenedNumber(bytes);

  return (
    <ConfirmPill
      label={formatStorageBytes(Math.round(tweened))}
      actionLabel={actionLabel}
      confirmLabel={confirmLabel}
      onConfirm={onConfirm}
      disabled={disabled}
    />
  );
}
