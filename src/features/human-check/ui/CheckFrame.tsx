import { useEffect, useRef } from "react";
import { cn } from "@/shared/lib";
import {
  humanCheckOrigin,
  humanCheckPageUrl,
  type HumanCheckAction,
} from "@/shared/api";
import { useHumanCheckStore } from "../store/humanCheckStore";

interface CheckMessage {
  source?: string;
  action?: string;
  type?: "token" | "error" | "expired";
  token?: string;
}

export interface CheckFrameProps {
  action: HumanCheckAction;
  attempt: number;
}

export default function CheckFrame({ action, attempt }: CheckFrameProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const phase = useHumanCheckStore((state) => state.phase);
  const setPhase = useHumanCheckStore((state) => state.setPhase);
  const solve = useHumanCheckStore((state) => state.solve);
  const ready = phase !== "loading";

  useEffect(() => {
    const origin = humanCheckOrigin();
    const onMessage = (event: MessageEvent<CheckMessage>) => {
      if (event.origin !== origin) return;
      if (event.source !== frameRef.current?.contentWindow) return;
      const data = event.data;
      if (data?.source !== "liner-turnstile" || data.action !== action) return;
      if (data.type === "token" && data.token) solve(data.token);
      else if (data.type === "expired") setPhase("expired");
      else if (data.type === "error") setPhase("error");
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [action, setPhase, solve]);

  const markLoaded = () => {
    if (useHumanCheckStore.getState().phase === "loading") setPhase("ready");
  };

  return (
    <div className="relative mx-auto h-[88px] w-[320px] shrink-0">
      <div
        className={cn(
          "absolute inset-x-[10px] top-[11px] h-[65px] animate-pulse rounded-[10px] bg-black/[0.08] transition-opacity duration-300 dark:bg-white/[0.1]",
          ready && "opacity-0",
        )}
      />
      <iframe
        key={attempt}
        ref={frameRef}
        src={humanCheckPageUrl(action)}
        title="Cloudflare Turnstile"
        scrolling="no"
        onLoad={markLoaded}
        className={cn(
          "absolute inset-0 size-full border-0 bg-transparent opacity-0 transition-opacity duration-300 ease-out [color-scheme:dark]",
          ready && "opacity-100",
        )}
      />
    </div>
  );
}
