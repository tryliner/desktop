import { useRef, useState, useCallback, useEffect } from "react";
import { useTranslation } from "@/languages";
import { CloseLine } from "@mingcute/react";
import Dialog from "../../../shared/ui/Dialog";
import { ScrollableText } from "../../../shared/ui";
import CoverImage from "../../covers/ui/CoverImage";
import { toMaxQualityAvatarUrl } from "@/shared/api";

interface ArtistProfileModalProps {
  open: boolean;
  onClose: () => void;
  name: string;
  geniusImageUrl?: string;
  fallbackImageUrl?: string;
  geniusUsername?: string;
  geniusAka?: string[];
  bio?: string;
}

// parses inline markdown links, bold text and bare urls
function renderInlineText(text: string): React.ReactNode {
  const regex = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|(https?:\/\/[^\s<]+)/g;
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    if (match[1] && match[2]) {
      const label = match[1].trim();
      const rawUrl = match[2].trim();
      const url = rawUrl.startsWith("/") ? `https://genius.com${rawUrl}` : rawUrl;
      nodes.push(
        <a
          key={`${match.index}-link`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#5491f5] hover:underline cursor-pointer transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          {label}
        </a>
      );
    } else if (match[3]) {
      nodes.push(
        <strong key={`${match.index}-bold`} className="font-[600] text-text-primary">
          {match[3]}
        </strong>
      );
    } else if (match[4]) {
      const url = match[4];
      nodes.push(
        <a
          key={`${match.index}-url`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#5491f5] hover:underline cursor-pointer transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          {url}
        </a>
      );
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes.length === 1 ? nodes[0] : <>{nodes}</>;
}

// failsafe for unformatted plain text with smushed list items
function formatSmushedText(bio: string): string {
  return bio
    .replace(/(Дискография)(Официальный)/g, "$1\n\n• $2")
    .replace(/(сайт|ВКонтакте|канал|#\d|TikTok)(Официальный|Сообщество|Страница|Телеграм|YouTube|TikTok|Twitch)/g, "$1\n• $2");
}

// formats genius biography blocks, bullet lists, headings and interactive links
function BioContent({ bio }: { bio: string }) {
  const formattedBio = formatSmushedText(bio);
  const lines = formattedBio.split("\n");

  return (
    <div className="space-y-[4px]">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={idx} className="h-[6px]" />;
        }

        // section heading
        if (
          (trimmed.startsWith("**") && trimmed.endsWith("**") && trimmed.length > 4) ||
          trimmed.startsWith("### ") ||
          trimmed.startsWith("## ") ||
          trimmed.startsWith("# ")
        ) {
          const headingText = trimmed.startsWith("### ")
            ? trimmed.slice(4)
            : trimmed.startsWith("## ")
              ? trimmed.slice(3)
              : trimmed.startsWith("# ")
                ? trimmed.slice(2)
                : trimmed.slice(2, -2);
          return (
            <div
              key={idx}
              className="font-[600] text-text-primary text-[13px] pt-[8px] pb-[2px]"
            >
              {renderInlineText(headingText)}
            </div>
          );
        }

        // list item: bullet or dash
        if (trimmed.startsWith("• ") || trimmed.startsWith("- ")) {
          const itemText = trimmed.slice(2);
          return (
            <div key={idx} className="flex items-start gap-[6px] pl-[4px] py-[1px]">
              <span className="text-text-tertiary select-none text-[12px] leading-[1.6]">•</span>
              <span className="flex-1 min-w-0">{renderInlineText(itemText)}</span>
            </div>
          );
        }

        return (
          <p key={idx} className="m-0">
            {renderInlineText(line)}
          </p>
        );
      })}
    </div>
  );
}

// compact artist profile modal with genius avatar, hover-scrolling aka and formatted bio
export default function ArtistProfileModal({
  open,
  onClose,
  name,
  geniusImageUrl,
  fallbackImageUrl,
  geniusUsername,
  geniusAka,
  bio,
}: ArtistProfileModalProps) {
  const { t } = useTranslation();
  const avatarSrc = geniusImageUrl || toMaxQualityAvatarUrl(fallbackImageUrl);
  const bioScrollRef = useRef<HTMLDivElement>(null);
  const [bioScrollMask, setBioScrollMask] = useState(
    "linear-gradient(to bottom, black 0%, black 100%)",
  );

  // dynamic edge fade matching search modal scroll behaviour
  const updateScrollMask = useCallback(() => {
    const el = bioScrollRef.current;
    if (!el) return;
    const { scrollTop, clientHeight, scrollHeight } = el;
    const showTop = scrollTop > 2;
    const showBottom = scrollTop + clientHeight < scrollHeight - 2;

    let stops = "";
    if (showTop) stops += "transparent 0%, black 7%, ";
    else stops += "black 0%, black 7%, ";
    if (showBottom) stops += "black 93%, transparent 100%";
    else stops += "black 93%, black 100%";

    setBioScrollMask(`linear-gradient(to bottom, ${stops})`);
  }, []);

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(updateScrollMask);
    const el = bioScrollRef.current;
    if (!el) return () => cancelAnimationFrame(id);
    const ro = new ResizeObserver(() => {
      updateScrollMask();
    });
    ro.observe(el);
    return () => {
      cancelAnimationFrame(id);
      ro.disconnect();
    };
  }, [open, bio, updateScrollMask]);

  const subtitleParts: string[] = [];
  if (geniusUsername) {
    subtitleParts.push(`@${geniusUsername.replace(/^@/, "")}`);
  }
  if (geniusAka && geniusAka.length > 0) {
    subtitleParts.push(`AKA: ${geniusAka.join(", ")}`);
  }
  const subtitle = subtitleParts.join(" • ");

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (!next ? onClose() : undefined)}
      maxWidth={440}
      className="p-[18px] relative"
    >
      {/* subtle close button */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-[14px] right-[14px] inline-flex h-[24px] w-[24px] items-center justify-center rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-panel transition-colors cursor-pointer border-0 bg-transparent"
        title={t("common.close")}
      >
        <CloseLine size={16} />
      </button>

      {/* artist header */}
      <div className="flex items-center gap-[12px] pr-[28px]">
        {avatarSrc ? (
          <div className="relative h-[48px] w-[48px] shrink-0 overflow-hidden rounded-full bg-bg-panel">
            <CoverImage
              src={avatarSrc}
              alt={name}
              fill
              sizes="48px"
              className="object-cover object-center"
              draggable={false}
            />
          </div>
        ) : (
          <div className="h-[48px] w-[48px] shrink-0 rounded-full bg-bg-panel flex items-center justify-center text-text-tertiary text-[18px] font-[600]">
            {name.charAt(0).toUpperCase()}
          </div>
        )}

        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-[6px] min-w-0">
            <ScrollableText
              text={name}
              className="shrink min-w-0 text-[16px] font-[600] tracking-[-0.01em] text-text-primary"
              style={{ fontFamily: "var(--font-inter), sans-serif" }}
              fadeColorClass="from-bg-primary"
            />
            {/* twitter / md3 wavy verified badge */}
            <svg
              viewBox="0 0 24 24"
              className="h-[18px] w-[18px] shrink-0 text-[#1d9bf0]"
              fill="currentColor"
              aria-label="Verified"
            >
              <path d="M10.007 2.10377C8.60544 1.65006 7.08181 2.28116 6.41156 3.59306L5.60578 5.17023C5.51004 5.35763 5.35763 5.51004 5.17023 5.60578L3.59306 6.41156C2.28116 7.08181 1.65006 8.60544 2.10377 10.007L2.64923 11.692C2.71404 11.8922 2.71404 12.1078 2.64923 12.308L2.10377 13.993C1.65006 15.3946 2.28116 16.9182 3.59306 17.5885L5.17023 18.3942C5.35763 18.49 5.51004 18.6424 5.60578 18.8298L6.41156 20.407C7.08181 21.7189 8.60544 22.35 10.007 21.8963L11.692 21.3508C11.8922 21.286 12.1078 21.286 12.308 21.3508L13.993 21.8963C15.3946 22.35 16.9182 21.7189 17.5885 20.407L18.3942 18.8298C18.49 18.6424 18.6424 18.49 18.8298 18.3942L20.407 17.5885C21.7189 16.9182 22.35 15.3946 21.8963 13.993L21.3508 12.308C21.286 12.1078 21.286 11.8922 21.3508 11.692L21.8963 10.007C22.35 8.60544 21.7189 7.08181 20.407 6.41156L18.8298 5.60578C18.6424 5.51004 18.49 5.35763 18.3942 5.17023L17.5885 3.59306C16.9182 2.28116 15.3946 1.65006 13.993 2.10377L12.308 2.64923C12.1078 2.71403 11.8922 2.71404 11.692 2.64923L10.007 2.10377Z" />
              <path
                d="M6.75977 11.7573L8.17399 10.343L11.0024 13.1715L16.6593 7.51465L18.0735 8.92886L11.0024 15.9999L6.75977 11.7573Z"
                fill="#ffffff"
              />
            </svg>
          </div>

          {subtitle && (
            <ScrollableText
              text={subtitle}
              className="text-[12px] text-text-tertiary mt-[2px]"
              fadeColorClass="from-bg-primary"
            />
          )}
        </div>
      </div>

      {/* biography */}
      <div className="mt-[14px]">
        {bio ? (
          <div
            ref={bioScrollRef}
            onScroll={updateScrollMask}
            className="m-0 text-[13px] leading-[1.6] text-text-secondary font-[400] select-text max-h-[340px] overflow-y-auto pr-[4px]"
            style={{
              WebkitMaskImage: bioScrollMask,
              maskImage: bioScrollMask,
              fontFamily: "var(--font-inter), sans-serif",
            }}
          >
            <BioContent bio={bio} />
          </div>
        ) : (
          <p
            className="m-0 text-[13px] text-text-tertiary italic"
            style={{ fontFamily: "var(--font-inter), sans-serif" }}
          >
            {t("artist.no_biography")}
          </p>
        )}
      </div>
    </Dialog>
  );
}
