import { AnimatePresence, motion } from "framer-motion";
import { QrCode } from "@/shared/ui";
import { useTranslation } from "@/languages";

export interface QrTileProps {
  value: string | null;
}

const fade = { duration: 0.35, ease: "easeOut" } as const;

export default function QrTile({ value }: QrTileProps) {
  const { t } = useTranslation();

  return (
    <div className="relative aspect-square max-h-[132px] min-h-0 max-w-full flex-1">
      <div className="absolute inset-0 animate-pulse rounded-[16px] bg-black/[0.08] dark:bg-white/[0.1]" />
      <AnimatePresence initial={false}>
        {value && (
          <motion.div
            key={value}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={fade}
            className="absolute inset-0 rounded-[16px] bg-white p-[10px] text-black"
          >
            <QrCode
              value={value}
              className="size-full"
              label={t("youtube_auth.qr_label") || "Sign-in QR code"}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
