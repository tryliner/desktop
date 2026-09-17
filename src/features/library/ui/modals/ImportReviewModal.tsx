import { useEffect, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  CheckLine,
  CloseLine,
  InformationLine,
  PauseFill,
  PlayFill,
  PlaylistFill,
  TimeLine,
} from "@mingcute/react";
import Dialog from "@/shared/ui/Dialog";
import Button from "@/shared/ui/Button";
import CoverImage from "@/features/covers/ui/CoverImage";
import { useTranslation } from "@/languages";
import { useModalStore } from "../../store/modalStore";
import { useImportStore } from "../../store/importStore";
import {
  api,
  mediaUrl,
  toClientTrack,
  resolveApiErrorMessage,
  type ImportReview,
  type ImportReviewDecision,
} from "@/shared/api";
import { playerEngine, usePlayerState } from "@/features/player";
import { useToast } from "@/shared/ui";
import { notifyLibraryChanged } from "../../hooks/usePlaylists";

function formatDuration(ms?: number): string {
  if (!ms || ms <= 0) return "";
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
}


function deduplicateReviewItems(reviewItems: ImportReview[]): ImportReview[] {
  const seen = new Set<string>();
  const unique: ImportReview[] = [];
  for (const it of reviewItems) {
    const trackKey = it.sourceTrack?.sourceId
      ? `${it.sourceTrack.sourceId}:${it.position}`
      : `${it.sourceTrack?.title ?? ""}:${it.sourceTrack?.artists?.join(",") ?? ""}:${it.position}`;
    const key = it.id ? `${it.id}` : trackKey;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(it);
    }
  }
  return unique;
}

function deriveInitialDecisions(
  reviewItems: ImportReview[],
): Record<string, "approve" | "deny"> {
  const initialDecisions: Record<string, "approve" | "deny"> = {};
  for (const it of reviewItems) {
    if (
      it.proposedTrack &&
      (it.score === undefined || it.score >= 50 || it.reason === "auto_matched")
    ) {
      initialDecisions[it.id] = "approve";
    } else {
      initialDecisions[it.id] = "deny";
    }
  }
  return initialDecisions;
}

function ImportReviewSkeletonRows() {
  return (
    <>
      {Array.from({ length: 3 }, (_, i) => (
        <div
          key={i}
          className="flex flex-col gap-[10px] p-[12px] rounded-lg border border-border-primary/40 bg-bg-elevated/50"
        >
          <div className="flex items-center justify-between">
            <div className="h-[13px] w-[58%] animate-pulse rounded bg-border-alpha-33" />
            <div className="h-[19px] w-[68px] animate-pulse rounded-md bg-border-alpha-14" />
          </div>
          <div className="flex items-center gap-[10px] p-[8px] rounded-md border border-border-primary/60 bg-bg-primary/80">
            <div className="h-[38px] w-[38px] shrink-0 animate-pulse rounded-md bg-border-alpha-14" />
            <div className="flex flex-col gap-[6px] flex-1 min-w-0">
              <div className="h-[12px] w-[46%] animate-pulse rounded bg-border-alpha-33" />
              <div className="h-[10px] w-[28%] animate-pulse rounded bg-border-alpha-14" />
            </div>
            <div className="h-[27px] w-[118px] shrink-0 animate-pulse rounded-md bg-border-alpha-14" />
          </div>
        </div>
      ))}
    </>
  );
}

export default function ImportReviewModal() {
  const { t } = useTranslation();
  const { toast } = useToast();

  const open = useModalStore((state) => state.importReviewOpen);
  const jobId = useModalStore((state) => state.importReviewJobId);
  const close = useModalStore((state) => state.closeImportReview);
  const pollJob = useImportStore((state) => state.pollJob);

  const { currentTrack, status: playerStatus } = usePlayerState();
  const isPlaying = playerStatus === "playing";

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [items, setItems] = useState<ImportReview[]>([]);
  const [decisions, setDecisions] = useState<Record<string, "approve" | "deny">>({});

  const listRef = useRef<HTMLDivElement>(null);

  // estimate size with 10px gap matches card height + spacing
  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 124,
    getItemKey: (index) => items[index]?.id || index,
    gap: 10,
    overscan: 5,
  });

  const handleTogglePlay = (proposedTrack: any) => {
    const isThisCurrent = currentTrack?.id === proposedTrack.id;
    if (isThisCurrent) {
      playerEngine.togglePlayPause();
      return;
    }
    playerEngine.primeUserGesture();
    const clientTrack = toClientTrack(proposedTrack);
    void playerEngine.playTrack(
      clientTrack,
      [clientTrack],
      t("import.review_title"),
      clientTrack.coverUrl,
    );
  };

  useEffect(() => {
    if (!open || !jobId) {
      setItems([]);
      setDecisions({});
      return;
    }

    const prefetched = useModalStore.getState().importReviewPrefetched;
    if (prefetched && prefetched.length > 0) {
      useModalStore.setState({ importReviewPrefetched: null });
      const unique = deduplicateReviewItems(prefetched);
      setItems(unique);
      setDecisions(deriveInitialDecisions(unique));
      return;
    }

    let active = true;
    setLoading(true);

    api
      .getPlaylistImportReview(jobId)
      .then(async (res) => {
        if (!active) return;
        const allItems = deduplicateReviewItems(res.items || []);
        if (allItems.length === 0) {
          const r = await api.skipPlaylistImportReview(jobId).catch(() => null);
          if (!active) return;
          if (r?.finalized) {
            const finalJob = await api.getPlaylistImport(jobId).catch(() => null);
            useImportStore.setState({ job: finalJob ?? null, isPolling: false });
            notifyLibraryChanged();
            close();
          }
          return;
        }

        setItems(allItems);
        setDecisions(deriveInitialDecisions(allItems));
      })
      .catch((err) => {
        if (!active) return;
        const msg = resolveApiErrorMessage(err, t, "import.status_failed");
        toast(msg, "error");
        close();
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open, jobId, close, t, toast]);

  const toggleDecision = (reviewId: string, decision: "approve" | "deny") => {
    setDecisions((prev) => ({
      ...prev,
      [reviewId]: decision,
    }));
  };

  const handleApply = async () => {
    if (!jobId || submitting) return;
    setSubmitting(true);

    try {
      const decisionList: ImportReviewDecision[] = items.map((item) => ({
        reviewId: item.id,
        decision: decisions[item.id] || "deny",
      }));

      const res = await api.decidePlaylistImportReview(jobId, decisionList);

      if (res.finalized) {
        const finalJob = await api.getPlaylistImport(jobId).catch(() => null);
        useImportStore.setState({ job: finalJob ?? null, isPolling: false });
        notifyLibraryChanged();
        close();
      } else {
        close();
        void pollJob(jobId);
      }
    } catch (err) {
      const msg = resolveApiErrorMessage(err, t, "import.status_failed");
      toast(msg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkipAll = async () => {
    if (!jobId || submitting) return;
    setSubmitting(true);

    try {
      const res = await api.skipPlaylistImportReview(jobId);

      if (res.finalized) {
        const finalJob = await api.getPlaylistImport(jobId).catch(() => null);
        useImportStore.setState({ job: finalJob ?? null, isPolling: false });
        notifyLibraryChanged();
        close();
      } else {
        close();
        void pollJob(jobId);
      }
    } catch (err) {
      const msg = resolveApiErrorMessage(err, t, "import.status_failed");
      toast(msg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const approvedCount = Object.values(decisions).filter((d) => d === "approve").length;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (!next ? close() : undefined)}
      maxWidth={540}
    >
      <div className="flex flex-col gap-[16px] px-[20px] pb-[20px] min-h-0">
        {/* Header */}
        <div className="flex flex-col gap-[4px]">
          <h2
            className="m-0 text-[18px] font-[500] text-text-primary flex items-center gap-[8px]"
            style={{ fontFamily: "var(--font-inter), sans-serif" }}
          >
            {t("import.review_title")}
            {items.length > 0 && (
              <span className="text-[12px] px-[8px] py-[2px] rounded-full bg-border-alpha-14 text-text-secondary font-normal">
                {items.length}
              </span>
            )}
          </h2>
          <p
            className="m-0 text-[13px] text-text-tertiary"
            style={{ fontFamily: "var(--font-inter), sans-serif" }}
          >
            {t("import.review_description")}
          </p>
        </div>

        {/* Content list */}
        <div
          ref={listRef}
          className="flex-1 min-h-[140px] max-h-[460px] overflow-y-auto overscroll-contain -mx-[8px] px-[8px]"
        >
          {!loading && items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-[48px] gap-[10px] text-text-tertiary">
              <PlaylistFill size={28} className="opacity-70" />
              <span className="text-[13px]">{t("common.no_results")}</span>
            </div>
          ) : loading ? (
            <div className="flex flex-col gap-[10px]">
              <ImportReviewSkeletonRows />
            </div>
          ) : (
            <div
              className="relative w-full"
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const item = items[virtualRow.index];
                if (!item) return null;

                const currentDecision = decisions[item.id] || "deny";
                const isApproved = currentDecision === "approve";
                const proposed = item.proposedTrack;
                const isAutoMatched = item.reason === "auto_matched";

                const score =
                  item.score !== undefined
                    ? Math.max(0, Math.min(100, Math.round(item.score)))
                    : undefined;

                return (
                  <div
                    key={virtualRow.key}
                    ref={rowVirtualizer.measureElement}
                    data-index={virtualRow.index}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    className={`flex flex-col gap-[10px] p-[12px] rounded-lg border transition-all ${
                      isApproved
                        ? "bg-bg-elevated border-border-primary/80"
                        : "bg-bg-elevated/50 border-border-primary/40 opacity-75 hover:opacity-100"
                    }`}
                  >
                  {/* Original track row */}
                  <div className="flex items-start justify-between gap-[10px]">
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-[13px] font-[500] text-text-primary truncate">
                        {item.sourceTrack.title}
                      </span>
                      <span className="text-[12px] text-text-tertiary truncate">
                        {item.sourceTrack.artists.join(", ")}
                        {item.sourceTrack.durationMs ? (
                          <> • {formatDuration(item.sourceTrack.durationMs)}</>
                        ) : null}
                      </span>
                    </div>

                    {/* Reason Badge */}
                    <div className="shrink-0">
                      <span
                        className={`inline-flex items-center gap-[4px] text-[11px] px-[8px] py-[3px] rounded-md font-[450] ${
                          isAutoMatched
                            ? "bg-accent-primary/15 text-accent-primary"
                            : "bg-accent-secondary/15 text-accent-secondary"
                        }`}
                      >
                        {isAutoMatched ? (
                          <CheckLine size={12} />
                        ) : (
                          <InformationLine size={12} />
                        )}
                        {t(`import.reason_${item.reason}`) || (isAutoMatched ? "Matched" : item.reason)}
                      </span>
                    </div>
                  </div>

                  {/* Proposed candidate */}
                  {proposed ? (
                    (() => {
                      const isThisCurrent = currentTrack?.id === proposed.id;
                      const isThisPlaying = isThisCurrent && isPlaying;

                      return (
                        <div className="flex items-center justify-between gap-[12px] p-[8px] rounded-md bg-bg-primary/80 border border-border-primary/60">
                          <div className="flex items-center gap-[10px] min-w-0 flex-1">
                            <div
                              className="relative h-[38px] w-[38px] rounded-md bg-border-alpha-14 overflow-hidden shrink-0 flex items-center justify-center group/cover cursor-pointer select-none"
                              onClick={() => handleTogglePlay(proposed)}
                              title={isThisPlaying ? "Pause" : "Play"}
                            >
                              {proposed.cover ? (
                                <CoverImage
                                  src={mediaUrl(proposed.cover.url)}
                                  alt={proposed.title}
                                  fill
                                  sizes="38px"
                                  className="object-cover"
                                />
                              ) : (
                                <PlaylistFill size={18} className="text-text-tertiary" />
                              )}

                              {/* Quick Play/Pause overlay */}
                              <div
                                className={`absolute inset-0 flex items-center justify-center bg-black/45 text-white transition-opacity duration-150 ${
                                  isThisCurrent
                                    ? "opacity-100"
                                    : "opacity-0 group-hover/cover:opacity-100 hover:bg-black/55"
                                }`}
                              >
                                {isThisPlaying ? (
                                  <PauseFill size={18} className="text-white" />
                                ) : (
                                  <PlayFill size={18} className="text-white ml-[2px]" />
                                )}
                              </div>
                            </div>

                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="text-[13px] font-[500] truncate text-text-primary">
                                {proposed.title}
                              </span>
                              <div className="flex items-center gap-[6px] text-[11px] text-text-tertiary truncate">
                                <span className="truncate">
                                  {proposed.artists.map((a: any) => a.name).join(", ")}
                                </span>
                                {proposed.durationMs ? (
                                  <span className="shrink-0 flex items-center gap-[2px]">
                                    <TimeLine size={10} />
                                    {formatDuration(proposed.durationMs)}
                                  </span>
                                ) : null}
                                {score !== undefined ? (
                                  <span
                                    className={`shrink-0 font-medium ${
                                      score >= 80
                                        ? "text-accent-primary"
                                        : score >= 50
                                          ? "text-accent-secondary"
                                          : "text-text-tertiary"
                                    }`}
                                  >
                                    {score}%
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </div>

                          {/* Decision buttons */}
                          <div className="flex items-center gap-[4px] shrink-0">
                            <button
                              type="button"
                              onClick={() => toggleDecision(item.id, "approve")}
                              className={`inline-flex items-center justify-center gap-[4px] px-[10px] py-[5px] rounded-md text-[12px] font-[500] transition-all duration-150 cursor-pointer border active:scale-[0.96] ${
                                isApproved
                                  ? "bg-btn-primary-bg text-btn-primary-text border-transparent"
                                  : "bg-transparent text-text-secondary border-border-primary hover:bg-border-alpha-14 hover:text-text-primary"
                              }`}
                            >
                              <CheckLine size={14} />
                              <span>{t("import.approve")}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleDecision(item.id, "deny")}
                              className={`inline-flex items-center justify-center gap-[4px] px-[10px] py-[5px] rounded-md text-[12px] font-[500] transition-all duration-150 cursor-pointer border active:scale-[0.96] ${
                                !isApproved
                                  ? "bg-border-alpha-14 text-text-primary border-border-primary"
                                  : "bg-transparent text-text-tertiary border-transparent hover:text-text-secondary"
                              }`}
                            >
                              <CloseLine size={14} />
                              <span>{t("import.deny")}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="flex items-center justify-between gap-[12px] p-[8px] rounded-md bg-bg-primary/40 border border-border-primary/40 text-text-tertiary text-[12px]">
                      <span>{t("import.no_candidate_found")}</span>
                      <span className="text-[11px] px-[8px] py-[3px] rounded bg-border-alpha-14 text-text-tertiary font-medium">
                        {t("import.skipped")}
                      </span>
                    </div>
                  )}
                </div>
              );
              })
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between pt-[8px] border-t border-border-primary mt-[4px]">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void handleSkipAll()}
            disabled={submitting || loading || items.length === 0}
            className="!text-text-tertiary hover:!text-text-primary"
          >
            {t("import.skip_all")}
          </Button>

          <div className="flex items-center gap-[8px]">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={close}
              disabled={submitting}
            >
              {t("common.close")}
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => void handleApply()}
              disabled={submitting || loading || items.length === 0}
            >
              {submitting
                ? t("import.applying")
                : `${t("import.apply_decisions")} (${approvedCount})`}
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
