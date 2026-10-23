import Dialog from "@/shared/ui/Dialog";
import Button from "@/shared/ui/Button";
import { Download2Line, CloseLine, Delete2Line, CheckLine } from "@mingcute/react";
import { useDownloadStore, type DownloadItem } from "../store/downloadStore";

export interface DownloadManagerModalProps {
  open: boolean;
  onClose: () => void;
}

export function DownloadManagerModal({ open, onClose }: DownloadManagerModalProps) {
  const downloads = useDownloadStore((s) => Array.from(s.downloads.values()));
  const cancelDownload = useDownloadStore((s) => s.cancelDownload);
  const clearCompleted = useDownloadStore((s) => s.clearCompleted);
  const activeCount = useDownloadStore((s) => s.activeCount);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()} maxWidth={440}>
      <div className="flex flex-col gap-4 max-h-[60vh] min-h-[220px]">
        <div className="flex items-center justify-between border-b border-border-primary/40 pb-3">
          <div className="flex items-center gap-2">
            <Download2Line size={18} className="text-text-secondary" />
            <h2 className="text-[15px] font-semibold text-text-primary m-0">Downloads</h2>
            <span className="text-[12px] text-text-tertiary ml-1">
              ({activeCount > 0 ? `${activeCount} downloading` : "idle"})
            </span>
          </div>
          {downloads.some((d) => d.status === "complete" || d.status === "error") && (
            <Button
              variant="secondary"
              size="sm"
              onClick={clearCompleted}
              className="flex items-center gap-1.5 !text-[12px] !py-1 !px-2.5"
            >
              <Delete2Line size={14} />
              <span>Clear finished</span>
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1">
          {downloads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-text-tertiary">
              <Download2Line size={32} className="mb-2 opacity-40" />
              <p className="text-[13px]">No downloads in progress or completed</p>
            </div>
          ) : (
            downloads.map((item: DownloadItem) => (
              <div
                key={item.trackId}
                className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-border-primary/30"
              >
                <div className="flex flex-col gap-1 min-w-0 flex-1 mr-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-medium text-text-primary truncate">
                      {item.trackId}
                    </span>
                    <span className="text-[11px] uppercase tracking-wider text-text-tertiary ml-2">
                      {item.status}
                    </span>
                  </div>

                  {item.status === "downloading" && (
                    <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden mt-1">
                      <div
                        className="bg-accent-primary h-full transition-all duration-200"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  )}

                  {item.error && (
                    <span className="text-[11px] text-rose-400 truncate">
                      {item.error}
                    </span>
                  )}
                </div>

                <div className="flex items-center shrink-0">
                  {item.status === "complete" ? (
                    <span className="text-emerald-500 p-1">
                      <CheckLine size={16} />
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => cancelDownload(item.trackId)}
                      title="Cancel download"
                      className="p-1 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-white/10 transition-colors"
                    >
                      <CloseLine size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Dialog>
  );
}

export default DownloadManagerModal;
