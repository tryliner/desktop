import { LuRadio, LuStepForward, LuListPlus, LuHeart } from "react-icons/lu";
import { ShareForwardLine } from "@mingcute/react";
import type { DropdownMenuItem } from "@/shared/ui/DropdownMenu";
import { showToast } from "@/shared/ui";
import { cn } from "@/shared/lib";
import { playerEngine } from "../../engine/playerEngine";
import type { SongMenuActions, SongMenuContext, Translate } from "./types";

function toTrack(ctx: SongMenuContext, id: string) {
  return {
    id,
    title: ctx.title,
    artists: ctx.artists,
    coverUrl: ctx.coverUrl,
    durationMs: ctx.durationMs ?? 0,
    playCount: 0,
  };
}

export function playbackItems(
  ctx: SongMenuContext,
  t: Translate,
): DropdownMenuItem[] {
  const { id, title, artists } = ctx;
  return [
    {
      id: "start-radio",
      label: t("common.start_radio"),
      icon: <LuRadio size={15} />,
      onClick: () => {
        if (!id) return;
        void playerEngine.startRadioStation(toTrack(ctx, id));
      },
    },
    {
      id: "play-next",
      label: t("common.play_next"),
      icon: <LuStepForward size={15} />,
      onClick: () => {
        if (!id) return;
        playerEngine.playNext(toTrack(ctx, id));
      },
    },
    {
      id: "add-to-queue",
      label: t("common.add_to_queue"),
      icon: <LuListPlus size={15} />,
      onClick: () => {
        if (!id) return;
        playerEngine.addToQueue(toTrack(ctx, id));
        showToast(t("common.added_to_queue"), "checkmark", {
          description: artists ? `${title} — ${artists}` : title,
        });
      },
    },
  ];
}

export function likeItem(
  actions: SongMenuActions,
  t: Translate,
): DropdownMenuItem {
  const { liked, handleLike } = actions;
  return {
    id: liked ? "unlike-track" : "like-track",
    label: liked ? t("common.unlike") : t("common.like"),
    icon: (
      <LuHeart
        size={15}
        className={cn(
          liked ? "fill-red-500 text-red-500" : "text-text-secondary",
        )}
      />
    ),
    onClick: handleLike,
  };
}

export function shareItem(
  actions: SongMenuActions,
  t: Translate,
): DropdownMenuItem {
  return {
    id: "share",
    label: t("common.share"),
    icon: <ShareForwardLine size={15} />,
    onClick: actions.handleShare,
  };
}
