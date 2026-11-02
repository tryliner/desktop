import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
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
import {
  useToast,
  DialogActions,
  DialogButton,
  UsageOverview,
} from "@/shared/ui";
import { useTweenedNumber } from "@/shared/hooks";
import { cn } from "@/shared/lib";
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
    if (!it.proposedTrack || it.reason === "no_catalog_candidates") {
      continue;
    }
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
    if (it.proposedTrack) {
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
          className="flex flex-col gap-[10px] p-[12px] rounded-item bg-fill"
        >
          <div className="flex items-center justify-between">
            <div className="h-[13px] w-[58%] animate-pulse rounded-full bg-fill-hover" />
            <div className="h-[19px] w-[68px] animate-pulse rounded-full bg-fill" />
          </div>
          <div className="flex items-center gap-[10px] p-[8px] rounded-control bg-fill-subtle">
            <div className="h-[38px] w-[38px] shrink-0 animate-pulse rounded-control bg-fill" />
            <div className="flex flex-col gap-[6px] flex-1 min-w-0">
              <div className="h-[12px] w-[46%] animate-pulse rounded-full bg-fill-hover" />
              <div className="h-[10px] w-[28%] animate-pulse rounded-full bg-fill" />
            </div>
            <div className="h-[30px] w-[132px] shrink-0 animate-pulse rounded-item bg-fill" />
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

  const { currentTrack, status: playerStatus } = usePlayerState();
  const isPlaying = playerStatus === "playing";

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [items, setItems] = useState<ImportReview[]>([]);
  const [decisions, setDecisions] = useState<
    Record<string, "approve" | "deny">
  >({});

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

    const modalState = useModalStore.getState();
    const importState = useImportStore.getState();
    const prefetched =
      modalState.importReviewPrefetched ||
      (importState.job?.id === jobId ? importState.reviewItems : null);

    if (prefetched && prefetched.length > 0) {
      const unique = deduplicateReviewItems(prefetched);
      setItems(unique);
      setDecisions(deriveInitialDecisions(unique));
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);

    const loadItems = async () => {
      let attempts = 0;
      while (active && attempts < 6) {
        attempts++;
        try {
          const res = await api.getPlaylistImportReview(jobId);
          if (!active) return;
          const allItems = deduplicateReviewItems(res.items || []);
          if (allItems.length > 0) {
            setItems(allItems);
            setDecisions(deriveInitialDecisions(allItems));
            setLoading(false);
            return;
          }
        } catch {}
        if (attempts < 6) {
          await new Promise((r) => setTimeout(r, 400));
        }
      }

      if (!active) return;
      setLoading(false);

      const autoMatchedTracks =
        useModalStore.getState().importReviewApprovedTracks ||
        (useImportStore.getState().job?.id === jobId
          ? useImportStore.getState().approvedTracks
          : null) ||
        [];
      const jobMeta = useImportStore.getState().job;
      if (
        autoMatchedTracks.length > 0 &&
        jobMeta?.status === "awaiting_decision"
      ) {
        const r = await api
          .skipPlaylistImportReview(
            jobId,
            autoMatchedTracks,
            jobMeta?.title,
            jobMeta?.description,
          )
          .catch(() => null);
        if (!active) return;
        if (r?.finalized) {
          const finalJob = await api.getPlaylistImport(jobId).catch(() => null);
          useImportStore.setState({
            job: finalJob ?? null,
            isPolling: false,
            reviewItems: null,
            approvedTracks: null,
          });
          notifyLibraryChanged();
          close();
        }
      }
    };

    void loadItems();

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

      const userApprovedTracks = items
        .filter(
          (item) =>
            (decisions[item.id] || "deny") === "approve" &&
            Boolean(item.proposedTrack),
        )
        .map((item) => item.proposedTrack!);

      const autoMatchedTracks =
        useModalStore.getState().importReviewApprovedTracks ||
        (useImportStore.getState().job?.id === jobId
          ? useImportStore.getState().approvedTracks
          : null) ||
        [];
      const allApprovedTracks = [...autoMatchedTracks, ...userApprovedTracks];

      const jobMeta = useImportStore.getState().job;
      const res = await api.decidePlaylistImportReview(
        jobId,
        decisionList,
        allApprovedTracks,
        jobMeta?.title,
        jobMeta?.description,
      );

      const finalJob = await api.getPlaylistImport(jobId).catch(() => null);
      useImportStore.setState({
        job: finalJob ?? null,
        isPolling: false,
        reviewItems: null,
        approvedTracks: null,
      });
      if (res.finalized) notifyLibraryChanged();
      close();
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
      const autoMatchedTracks =
        useModalStore.getState().importReviewApprovedTracks ||
        (useImportStore.getState().job?.id === jobId
          ? useImportStore.getState().approvedTracks
          : null) ||
        [];
      const jobMeta = useImportStore.getState().job;
      const res = await api.skipPlaylistImportReview(
        jobId,
        autoMatchedTracks,
        jobMeta?.title,
        jobMeta?.description,
      );

      const finalJob = await api.getPlaylistImport(jobId).catch(() => null);
      useImportStore.setState({
        job: finalJob ?? null,
        isPolling: false,
        reviewItems: null,
        approvedTracks: null,
      });
      if (res.finalized) notifyLibraryChanged();
      close();
    } catch (err) {
      const msg = resolveApiErrorMessage(err, t, "import.status_failed");
      toast(msg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectAll = () => {
    const next: Record<string, "approve" | "deny"> = {};
    for (const it of items) {
      if (it.proposedTrack) {
        next[it.id] = "approve";
      } else {
        next[it.id] = "deny";
      }
    }
    setDecisions(next);
  };

  const handleDeselectAll = () => {
    const next: Record<string, "approve" | "deny"> = {};
    for (const it of items) {
      next[it.id] = "deny";
    }
    setDecisions(next);
  };

  const approvedCount = Object.values(decisions).filter(
    (d) => d === "approve",
  ).length;
  const autoMatchedCount = useModalStore(
    (state) => state.importReviewApprovedTracks?.length ?? null,
  );
  const storeMatchedCount = useImportStore((state) =>
    state.job?.id === jobId ? (state.approvedTracks?.length ?? 0) : 0,
  );
  const matchedCount = autoMatchedCount ?? storeMatchedCount;
  const skippedCount = items.length - approvedCount;
  const addCount = Math.round(useTweenedNumber(matchedCount + approvedCount));

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (!next ? close() : undefined)}
      maxWidth={540}
    >
      <div className="flex flex-col gap-[16px] px-[20px] pb-[20px] min-h-0">
        {/* Header */}
        <div className="flex items-start justify-between gap-[12px]">
          <div className="flex flex-col gap-[4px] min-w-0 flex-1">
            <h2 className="m-0 text-heading font-[500] text-text-primary flex items-center gap-[8px]">
              {t("import.review_title")}
              {items.length > 0 && (
                <span className="text-caption px-[8px] py-[2px] rounded-full bg-fill text-text-secondary font-normal tabular-nums">
                  {items.length}
                </span>
              )}
            </h2>
            <p className="m-0 text-body text-text-tertiary">
              {t("import.review_description")}
            </p>
          </div>

          {items.length > 0 && !loading && (
            <div className="flex items-center gap-[6px] shrink-0 pt-[2px]">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-caption font-[500] text-text-secondary hover:text-text-primary px-[8px] py-[4px] rounded-control bg-transparent hover:bg-fill transition-colors cursor-pointer border-0"
              >
                {t("import.select_all")}
              </button>
              <span className="text-text-tertiary text-[11px]">•</span>
              <button
                type="button"
                onClick={handleDeselectAll}
                className="text-caption font-[500] text-text-secondary hover:text-text-primary px-[8px] py-[4px] rounded-control bg-transparent hover:bg-fill transition-colors cursor-pointer border-0"
              >
                {t("import.deselect_all")}
              </button>
            </div>
          )}
        </div>

        {!loading && items.length > 0 && (
          <UsageOverview
            value={String(addCount)}
            unit={t("import.overview_unit", { count: addCount })}
            meta={
              <span className="text-body tabular-nums text-text-tertiary">
                {t("import.overview_review", { count: items.length })}
              </span>
            }
            segments={[
              {
                key: "matched",
                value: matchedCount,
                swatch: "bg-text-primary",
                label: t("import.overview_matched", { count: matchedCount }),
              },
              {
                key: "added",
                value: approvedCount,
                swatch: "bg-text-secondary",
                label: t("import.overview_added", { count: approvedCount }),
              },
              {
                key: "skipped",
                value: skippedCount,
                swatch: "bg-text-tertiary/40",
                label: t("import.overview_skipped", { count: skippedCount }),
              },
            ]}
          />
        )}

        {/* Content list */}
        <div
          ref={listRef}
          className="flex-1 min-h-[140px] max-h-[460px] overflow-y-auto overscroll-contain -mx-[8px] px-[8px]"
        >
          {!loading && items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-[48px] gap-[10px] text-text-tertiary">
              <PlaylistFill size={28} className="opacity-70" />
              <span className="text-body">{t("common.no_results")}</span>
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
                    className={cn(
                      "flex flex-col gap-[10px] p-[12px] rounded-item bg-fill transition-opacity duration-300",
                      !isApproved && "opacity-60 hover:opacity-100",
                    )}
                  >
                    {/* Original track row */}
                    <div className="flex items-start justify-between gap-[10px]">
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-body font-[500] text-text-primary truncate">
                          {item.sourceTrack.title}
                        </span>
                        <span className="text-caption text-text-tertiary truncate">
                          {item.sourceTrack.artists.join(", ")}
                          {item.sourceTrack.durationMs ? (
                            <>
                              {" "}
                              • {formatDuration(item.sourceTrack.durationMs)}
                            </>
                          ) : null}
                        </span>
                      </div>

                      {/* Reason Badge */}
                      <div className="shrink-0">
                        <span
                          className={cn(
                            "inline-flex items-center gap-[4px] text-[11px] px-[8px] py-[3px] rounded-full font-[500]",
                            isAutoMatched
                              ? "bg-fill-hover text-text-primary"
                              : "bg-fill text-text-secondary",
                          )}
                        >
                          {isAutoMatched ? (
                            <CheckLine size={12} />
                          ) : (
                            <InformationLine size={12} />
                          )}
                          {t(`import.reason_${item.reason}`) ||
                            (isAutoMatched ? "Matched" : item.reason)}
                        </span>
                      </div>
                    </div>

                    {/* Proposed candidate */}
                    {proposed ? (
                      (() => {
                        const isThisCurrent = currentTrack?.id === proposed.id;
                        const isThisPlaying = isThisCurrent && isPlaying;

                        return (
                          <div className="flex items-center justify-between gap-[12px] p-[8px] rounded-control bg-fill-subtle">
                            <div className="flex items-center gap-[10px] min-w-0 flex-1">
                              <div
                                className="relative h-[38px] w-[38px] rounded-control bg-fill overflow-hidden shrink-0 flex items-center justify-center group/cover cursor-pointer select-none"
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
                                  <PlaylistFill
                                    size={18}
                                    className="text-text-tertiary"
                                  />
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
                                    <PauseFill
                                      size={18}
                                      className="text-white"
                                    />
                                  ) : (
                                    <PlayFill
                                      size={18}
                                      className="text-white ml-[2px]"
                                    />
                                  )}
                                </div>
                              </div>

                              <div className="flex flex-col min-w-0 flex-1">
                                <span className="text-body font-[500] truncate text-text-primary">
                                  {proposed.title}
                                </span>
                                <div className="flex items-center gap-[6px] text-[11px] text-text-tertiary truncate">
                                  <span className="truncate">
                                    {proposed.artists
                                      .map((a: any) => a.name)
                                      .join(", ")}
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
                                          ? "text-text-primary"
                                          : "text-text-secondary"
                                      }`}
                                    >
                                      {score}%
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            </div>

                            {/* Decision: the settings segmented look */}
                            <div className="inline-flex h-[30px] shrink-0 items-center rounded-item bg-fill p-[3px]">
                              {(
                                [
                                  {
                                    value: "approve",
                                    icon: <CheckLine size={14} />,
                                    label: t("import.approve"),
                                  },
                                  {
                                    value: "deny",
                                    icon: <CloseLine size={14} />,
                                    label: t("import.deny"),
                                  },
                                ] as const
                              ).map((option) => {
                                const active = currentDecision === option.value;
                                return (
                                  <button
                                    key={option.value}
                                    type="button"
                                    aria-pressed={active}
                                    onClick={() =>
                                      toggleDecision(item.id, option.value)
                                    }
                                    className={cn(
                                      "relative inline-flex h-full cursor-pointer items-center gap-[4px] rounded-control border-0 bg-transparent px-[10px] text-caption font-[500] transition-colors",
                                      active
                                        ? "text-text-primary"
                                        : "text-text-tertiary hover:text-text-primary",
                                    )}
                                  >
                                    {active ? (
                                      <motion.span
                                        layoutId={`import-decision-${item.id}`}
                                        transition={{
                                          type: "spring",
                                          stiffness: 500,
                                          damping: 38,
                                        }}
                                        className="absolute inset-0 rounded-control bg-fill-hover"
                                      />
                                    ) : null}
                                    <span className="relative flex items-center gap-[4px]">
                                      {option.icon}
                                      {option.label}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()
                    ) : (
                      <div className="flex items-center justify-between gap-[12px] p-[8px] rounded-control bg-fill-subtle text-text-tertiary text-caption">
                        <span>{t("import.no_candidate_found")}</span>
                        <span className="text-[11px] px-[8px] py-[3px] rounded-full bg-fill text-text-tertiary font-[500]">
                          {t("import.skipped")}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <DialogActions className="mt-[4px]">
          <DialogButton type="button" onClick={close} disabled={submitting}>
            {t("common.close")}
          </DialogButton>
          <DialogButton
            type="button"
            onClick={() => void handleSkipAll()}
            disabled={submitting || loading || items.length === 0}
          >
            {t("import.skip_all")}
          </DialogButton>
          <DialogButton
            type="button"
            variant="primary"
            onClick={() => void handleApply()}
            disabled={loading || items.length === 0}
            loading={submitting}
          >
            {submitting
              ? t("import.applying")
              : `${t("import.apply_decisions")} (${approvedCount})`}
          </DialogButton>
        </DialogActions>
      </div>
    </Dialog>
  );
}
