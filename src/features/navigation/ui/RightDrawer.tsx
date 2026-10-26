import { useState, useEffect, useRef, memo, useCallback, useMemo } from "react";
import {
  usePlayerState,
  playerEngine,
  isRadioContext,
  nextRepeatMode,
} from "@/features/player";
import SongCardWithMenu from "@/features/player/ui/SongCardWithMenu";
import { useTranslation } from "@/languages";
import { ReorderDropPlaceholder, FloatingDragCard } from "@/shared/ui";
import { useListReorder } from "@/shared/hooks";
import RightDrawerHeader from "./RightDrawerHeader";

const QUEUE_ITEM_HEIGHT = 68;

function getQueueScrollTarget(container: HTMLDivElement, currentIndex: number) {
  return Math.max(
    0,
    Math.round(
      6 +
        currentIndex * QUEUE_ITEM_HEIGHT +
        QUEUE_ITEM_HEIGHT / 2 -
        (container.clientHeight || 500) / 2,
    ),
  );
}

const QueueList = memo(function QueueList({
  queue,
  queueLimit,
  currentIndex,
  playbackContext,
  playbackContextCover,
  scrollContainerRef,
}: {
  queue: any[];
  queueLimit: number;
  currentIndex: number;
  playbackContext: any;
  playbackContextCover: any;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const effectiveLimit = Math.max(
    queueLimit,
    currentIndex >= 0 ? currentIndex + 25 : 0,
  );
  const visibleQueue = useMemo(
    () => queue.slice(0, effectiveLimit),
    [queue, effectiveLimit],
  );

  const queueContainerRef = useRef<HTMLDivElement>(null);

  const handleReorder = useCallback((fromIndex: number, toIndex: number) => {
    playerEngine.reorderQueue(fromIndex, toIndex);
  }, []);

  const {
    isDragging,
    dragIndex,
    dropIndex,
    draggedItem,
    pointerPos,
    grabOffset,
    itemWidth,
    handleCardGrab,
  } = useListReorder<any>({
    items: visibleQueue,
    scrollContainerRef,
    listContainerRef: queueContainerRef,
    itemHeight: QUEUE_ITEM_HEIGHT,
    onReorder: handleReorder,
    edgeThreshold: QUEUE_ITEM_HEIGHT,
    maxScrollSpeed: 18,
  });

  return (
    <div
      ref={queueContainerRef}
      className="relative w-full"
      style={{ height: `${visibleQueue.length * QUEUE_ITEM_HEIGHT}px` }}
    >
      {isDragging && dropIndex !== null && (
        <div
          style={{
            position: "absolute",
            top: `${dropIndex * QUEUE_ITEM_HEIGHT}px`,
            left: 0,
            width: "100%",
            height: `${QUEUE_ITEM_HEIGHT}px`,
            pointerEvents: "none",
            zIndex: 0,
          }}
          className="px-0 py-[2px]"
        >
          <ReorderDropPlaceholder />
        </div>
      )}

      {visibleQueue.map((item, index) => {
        const isCurrent = index === currentIndex;
        const isThisDragged = isDragging && index === dragIndex;

        let shiftY = 0;
        if (isDragging && dragIndex !== null && dropIndex !== null && index !== dragIndex) {
          if (dragIndex < dropIndex) {
            if (index > dragIndex && index <= dropIndex) shiftY = -QUEUE_ITEM_HEIGHT;
          } else if (dragIndex > dropIndex) {
            if (index >= dropIndex && index < dragIndex) shiftY = QUEUE_ITEM_HEIGHT;
          }
        }

        return (
          <div
            key={`${item.id}-${index}`}
            style={{
              position: "absolute",
              top: `${index * QUEUE_ITEM_HEIGHT}px`,
              left: 0,
              width: "100%",
              height: `${QUEUE_ITEM_HEIGHT}px`,
              transform: shiftY ? `translateY(${shiftY}px)` : undefined,
              transition: isDragging
                ? "transform 180ms cubic-bezier(0.2, 0, 0, 1)"
                : undefined,
              opacity: isThisDragged ? 0 : 1,
              zIndex: 1,
            }}
            className="px-0 py-[2px]"
          >
            <SongCardWithMenu
              id={item.id}
              title={item.title}
              artists={item.artists}
              artistId={item.artistId}
              artistList={item.artistList}
              explicit={item.explicit}
              durationMs={item.durationMs}
              coverUrl={
                item.coverUrl ?? (item as { cover_url?: string }).cover_url ?? ""
              }
              showReorderHandle
              onGrabStart={
                !isDragging
                  ? (e) => handleCardGrab(index, item, e)
                  : undefined
              }
              className={`p-[8px] rounded-[12px] transition-colors duration-150 ${
                isCurrent
                  ? "bg-black/[0.065] dark:bg-white/[0.08]"
                  : "bg-transparent hover:bg-black/[0.035] dark:hover:bg-white/[0.04]"
              }`}
              imageShape="square"
              onPlay={() => {
                if (typeof window !== "undefined" && window.__linerWasDragging) return;
                void playerEngine.playTrack(
                  item,
                  queue,
                  playbackContext,
                  playbackContextCover,
                  index,
                  true,
                );
              }}
            />
          </div>
        );
      })}

      {isDragging && draggedItem && (
        <FloatingDragCard
          x={pointerPos.x}
          y={pointerPos.y}
          offsetX={grabOffset.x}
          offsetY={grabOffset.y}
          width={itemWidth}
        >
          <SongCardWithMenu
            id={draggedItem.id}
            title={draggedItem.title}
            artists={draggedItem.artists}
            artistId={draggedItem.artistId}
            artistList={draggedItem.artistList}
            explicit={draggedItem.explicit}
            durationMs={draggedItem.durationMs}
            coverUrl={
              draggedItem.coverUrl ??
              (draggedItem as { cover_url?: string }).cover_url ??
              ""
            }
            className="p-[8px] rounded-[10px] bg-bg-elevated border border-white/10"
            imageShape="square"
          />
        </FloatingDragCard>
      )}
    </div>
  );
});

export interface RightDrawerProps {
  onClose?: () => void;
}

function RightDrawer({ onClose }: RightDrawerProps) {
  const player = usePlayerState();
  const { t } = useTranslation();
  const queueScrollRef = useRef<HTMLDivElement>(null);
  const [queueLimit, setQueueLimit] = useState(() =>
    Math.max(50, Math.ceil(((player.currentIndex >= 0 ? player.currentIndex : 0) + 30) / 50) * 50),
  );
  const [isQueueScrolled, setIsQueueScrolled] = useState(false);

  useEffect(() => {
    if (player.currentIndex >= 0) {
      setQueueLimit((prev) =>
        Math.max(
          prev,
          Math.min(player.queue.length, Math.ceil((player.currentIndex + 30) / 50) * 50),
        ),
      );
    }
  }, [player.currentIndex, player.queue.length]);

  const scrollQueueToCurrent = useCallback(() => {
    const container = queueScrollRef.current;
    if (!container || player.currentIndex < 0 || player.queue.length === 0) return;
    const targetY = getQueueScrollTarget(container, player.currentIndex);
    setIsQueueScrolled(targetY > 2);
    container.scrollTo({ top: targetY, behavior: "smooth" });
  }, [player.currentIndex, player.queue.length]);

  const queueScrollCallbackRef = useCallback((node: HTMLDivElement | null) => {
    queueScrollRef.current = node;
    const { currentIndex, queue } = playerEngine.getSnapshot();
    if (node && currentIndex >= 0 && queue.length > 0) {
      const targetY = getQueueScrollTarget(node, currentIndex);
      node.scrollTop = targetY;
      setIsQueueScrolled(targetY > 2);
    }
  }, []);

  const prevQueueTrackIdRef = useRef<string | null>(player.currentTrack?.id ?? null);

  useEffect(() => {
    const currentId = player.currentTrack?.id ?? null;
    if (currentId !== null && currentId !== prevQueueTrackIdRef.current) {
      scrollQueueToCurrent();
    }
    prevQueueTrackIdRef.current = currentId;
  }, [player.currentTrack?.id, scrollQueueToCurrent]);

  return (
    <div
      className="relative flex flex-col h-full w-full overflow-hidden rounded-[14px] select-none bg-bg-glass backdrop-blur-[48px]"
    >
      <RightDrawerHeader
        trackCount={player.queue.length}
        shuffle={player.shuffle}
        repeat={player.repeat}
        canClear={player.queue.length > 1}
        onShuffleToggle={() => playerEngine.setShuffle(!player.shuffle)}
        onRepeatCycle={() =>
          playerEngine.setRepeat(
            nextRepeatMode(player.repeat, isRadioContext(player.playbackContext)),
          )
        }
        onClear={() => playerEngine.clearQueue()}
        onClose={onClose}
      />

      <div className="flex-1 overflow-hidden relative z-10">
        <div
          ref={queueScrollCallbackRef}
          className="absolute inset-0 overflow-y-auto px-[10px] pt-[6px] pb-[16px]"
          style={
            isQueueScrolled
              ? {
                  maskImage:
                    "linear-gradient(to bottom, transparent 0px, black 18px, black 100%)",
                  WebkitMaskImage:
                    "linear-gradient(to bottom, transparent 0px, black 18px, black 100%)",
                  transition:
                    "mask-image 200ms ease, -webkit-mask-image 200ms ease",
                }
              : undefined
          }
          onScroll={(e) => {
            const target = e.currentTarget;
            const next = target.scrollTop > 2;
            setIsQueueScrolled((prev) => (prev === next ? prev : next));
            if (
              target.scrollHeight - target.scrollTop <=
              target.clientHeight * 1.5
            ) {
              setQueueLimit((prev) =>
                Math.min(prev + 50, player.queue.length),
              );
            }
          }}
        >
          {player.queue.length > 0 ? (
            <QueueList
              queue={player.queue}
              queueLimit={queueLimit}
              currentIndex={player.currentIndex}
              playbackContext={player.playbackContext}
              playbackContextCover={player.playbackContextCover}
              scrollContainerRef={queueScrollRef}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-text-tertiary text-[14px]">
              {t("player.queue_empty")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(RightDrawer);
