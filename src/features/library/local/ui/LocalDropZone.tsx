import { useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "@/languages";
import { showToast } from "@/shared/ui";
import { isAudioFile, useAudioFileDrop } from "../hooks/useAudioFileDrop";
import { useLocalImport } from "../hooks/useLocalImport";
import LocalDropStack from "./LocalDropStack";

const EASE = [0.22, 1, 0.36, 1] as const;

export default function LocalDropZone() {
  const { t } = useTranslation();
  const { importFiles } = useLocalImport();

  const handleDrop = useCallback(
    (files: File[]) => {
      const audio = files.filter(isAudioFile);
      if (audio.length === 0) {
        if (files.length > 0)
          showToast(t("library.local.unsupported"), "error");
        return;
      }
      void importFiles(audio);
    },
    [importFiles, t],
  );

  const { dragging, fileCount } = useAudioFileDrop(handleDrop);

  if (!window.linerElectron) return null;

  return (
    <AnimatePresence>
      {dragging && (
        <motion.div
          key="local-drop-zone"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="pointer-events-none fixed inset-0 z-[9998] flex items-center justify-center bg-black/45 backdrop-blur-2xl backdrop-saturate-150"
        >
          <motion.div
            initial={{ opacity: 0, scale: 1.015 }}
            animate={{ opacity: [0.55, 1, 0.55], scale: 1 }}
            transition={{
              opacity: { duration: 1.8, repeat: Infinity, ease: "easeInOut" },
              scale: { duration: 0.3, ease: EASE },
            }}
            className="absolute inset-[10px] rounded-[18px] ring-2 ring-white/20"
          />
          <motion.div
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 8, opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="flex flex-col items-center gap-[22px] text-center"
          >
            <LocalDropStack fileCount={fileCount} />
            <div className="flex flex-col items-center gap-[6px]">
              <p className="m-0 text-[22px] font-[600] tracking-[-0.01em] text-white">
                {t("library.local.drop_title")}
              </p>
              <p className="m-0 text-[13.5px] text-white/60">
                {t("library.local.drop_subtitle")}
              </p>
            </div>
            {fileCount > 0 && (
              <span className="rounded-full bg-white/10 px-[12px] py-[5px] text-[12.5px] font-[500] text-white/85">
                {t("library.local.drop_count", { count: fileCount })}
              </span>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
