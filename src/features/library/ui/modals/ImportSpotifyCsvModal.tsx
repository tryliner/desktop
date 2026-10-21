import { useRef, useState } from "react";
import Button from "@/shared/ui/Button";
import Dialog from "@/shared/ui/Dialog";
import { useTranslation } from "@/languages";
import { useModalStore } from "../../store/modalStore";
import { useSpotifyCsvImportStore } from "../../store/spotifyCsvImportStore";

const EXPORTIFY_URL = "https://exportify.net";

export default function ImportSpotifyCsvModal() {
  const { t } = useTranslation();

  const open = useModalStore((state) => state.importSpotifyCsvOpen);
  const close = useModalStore((state) => state.closeImportSpotifyCsv);

  const phase = useSpotifyCsvImportStore((state) => state.phase);
  const rows = useSpotifyCsvImportStore((state) => state.rows);
  const fileName = useSpotifyCsvImportStore((state) => state.fileName);
  const progress = useSpotifyCsvImportStore((state) => state.progress);
  const loadFile = useSpotifyCsvImportStore((state) => state.loadFile);
  const run = useSpotifyCsvImportStore((state) => state.run);
  const stop = useSpotifyCsvImportStore((state) => state.stop);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pickError, setPickError] = useState("");

  const font = { fontFamily: "var(--font-inter), sans-serif" } as const;
  const running = phase === "running";
  const percent = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setPickError("");
    try {
      await loadFile(file);
      if (useSpotifyCsvImportStore.getState().rows.length === 0) {
        setPickError(t("common.spotify_csv_invalid"));
      }
    } catch {
      setPickError(t("common.spotify_csv_invalid"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? close() : undefined)} maxWidth={360}>
      <div className="flex flex-col gap-[12px] px-[16px] pb-[16px]">
        <div className="flex flex-col gap-[2px]">
          <p className="text-text-primary text-[13px] font-[500] m-0" style={{ ...font, letterSpacing: "-0.01em" }}>
            {t("common.import_spotify_likes")}
          </p>
          <p className="text-text-tertiary text-[12px] m-0 font-[350]" style={font}>
            {t("common.import_spotify_description")}
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => void handleFileChange(e)}
        />

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={running}
          onClick={() => fileInputRef.current?.click()}
          className="w-full !rounded-md"
        >
          {fileName || t("common.spotify_csv_choose")}
        </Button>

        {pickError && (
          <p className="text-accent-secondary text-[12px] m-0 font-[350]" style={font}>
            {pickError}
          </p>
        )}

        {(phase === "ready" || running || phase === "done") && (
          <div className="flex flex-col gap-[8px] rounded-md bg-bg-panel p-[12px]">
            <div className="flex items-center justify-between text-[12px] text-text-secondary" style={font}>
              <span className="truncate">
                {running
                  ? t("common.spotify_csv_progress", { done: progress.done, total: progress.total })
                  : phase === "done"
                    ? t("common.spotify_csv_done", {
                        liked: progress.liked,
                        skipped: progress.skipped,
                        failed: progress.failed,
                      })
                    : t("common.spotify_csv_ready", { count: rows.length })}
              </span>
              <span className="text-text-tertiary shrink-0">{percent}%</span>
            </div>
            <div className="h-[4px] w-full overflow-hidden rounded-full bg-border-alpha-14">
              <div
                className="h-full rounded-full bg-btn-primary-bg transition-[width] duration-200"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        )}

        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={phase === "idle"}
          onClick={() => (running ? stop() : void run())}
          className="w-full !rounded-md"
        >
          {running ? t("common.spotify_csv_stop") : phase === "done" ? t("common.spotify_csv_rerun") : t("common.import_likes")}
        </Button>

        <p className="text-text-tertiary text-[11px] m-0 font-[350]" style={font}>
          {t("common.spotify_csv_hint", { url: EXPORTIFY_URL })}
        </p>
      </div>
    </Dialog>
  );
}
