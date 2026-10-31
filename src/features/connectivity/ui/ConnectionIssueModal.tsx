import { useState } from "react";
import { ServerLine, WifiOffLine, YoutubeLine } from "@mingcute/react";
import { useTranslation } from "@/languages";
import { DialogActions, DialogButton } from "@/shared/ui";
import Dialog from "@/shared/ui/Dialog";
import { cn } from "@/shared/lib";
import { useOfflineModeStore } from "../store/offlineModeStore";
import {
  enterOfflineForIssue,
  retryConnection,
} from "../engine/offlineController";
import type { ConnectionIssue } from "../lib/classify";

const font = { fontFamily: "var(--font-inter), sans-serif" } as const;

const COPY: Record<ConnectionIssue, { title: string; desc: string }> = {
  youtube_blocked: {
    title: "offline.issue_youtube_blocked_title",
    desc: "offline.issue_youtube_blocked_desc",
  },
  youtube_unreachable: {
    title: "offline.issue_youtube_unreachable_title",
    desc: "offline.issue_youtube_unreachable_desc",
  },
  youtube_refused: {
    title: "offline.issue_youtube_refused_title",
    desc: "offline.issue_youtube_refused_desc",
  },
  server: {
    title: "offline.issue_server_title",
    desc: "offline.issue_server_desc",
  },
  offline: {
    title: "offline.issue_offline_title",
    desc: "offline.issue_offline_desc",
  },
};

function countryName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

function IssueIcon({ issue }: { issue: ConnectionIssue }) {
  const youtube = issue.startsWith("youtube");
  const Icon = youtube
    ? YoutubeLine
    : issue === "server"
      ? ServerLine
      : WifiOffLine;
  return (
    <span
      className={cn(
        "flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-full",
        youtube
          ? "bg-red-500/15 text-red-400"
          : "bg-black/[0.06] text-text-secondary dark:bg-white/[0.08]",
      )}
    >
      <Icon size={18} />
    </span>
  );
}

export default function ConnectionIssueModal() {
  const { t, locale } = useTranslation();
  const issue = useOfflineModeStore((state) => state.issue);
  const country = useOfflineModeStore((state) => state.country);
  const dismiss = useOfflineModeStore((state) => state.dismissIssue);
  const [retrying, setRetrying] = useState(false);
  const [shown, setShown] = useState<ConnectionIssue>("offline");

  if (issue && issue !== shown) setShown(issue);
  const current = issue ?? shown;
  const copy = COPY[current];
  const title =
    current === "youtube_blocked" && !country
      ? t("offline.issue_youtube_blocked_title_unknown")
      : t(copy.title, { country: country ? countryName(country, locale) : "" });

  const retry = async () => {
    setRetrying(true);
    try {
      await retryConnection();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <Dialog
      open={issue !== null}
      onOpenChange={(next) => (next ? undefined : dismiss())}
      maxWidth={480}
      zIndex={260}
    >
      <div className="flex flex-col px-[20px] pb-[20px]" role="alertdialog">
        <div className="flex items-start gap-[12px]">
          <IssueIcon issue={current} />
          <div className="flex min-w-0 flex-1 flex-col gap-[4px] pt-[6px]">
            <h2
              className="m-0 text-[17px] font-[600] leading-[1.25] tracking-[-0.01em] text-text-primary"
              style={font}
            >
              {title}
            </h2>
            <p
              className="m-0 text-[13px] leading-[1.45] text-text-tertiary"
              style={font}
            >
              {t(copy.desc)}
            </p>
          </div>
        </div>
        <DialogActions className="mt-[20px] !flex-nowrap">
          <DialogButton
            variant="primary"
            className="!min-w-0 !flex-auto !px-[10px] dark:!bg-white dark:!text-black dark:hover:!bg-white/90"
            onClick={enterOfflineForIssue}
          >
            {t("offline.use_offline")}
          </DialogButton>
          <DialogButton
            className="!min-w-0 !flex-auto !px-[10px]"
            loading={retrying}
            onClick={() => void retry()}
          >
            {t("offline.try_again")}
          </DialogButton>
          <DialogButton
            className="!min-w-0 !flex-auto !px-[10px] !bg-black/[0.03] !text-text-secondary dark:!bg-white/[0.04]"
            onClick={dismiss}
          >
            {t("offline.dont_show_again")}
          </DialogButton>
        </DialogActions>
      </div>
    </Dialog>
  );
}
