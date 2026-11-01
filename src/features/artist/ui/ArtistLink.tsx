import {
  Fragment,
  useRef,
  useState,
  useLayoutEffect,
  useCallback,
} from "react";
import { useStableNavigate } from "@/shared/hooks/useStableNavigate";
import type { TrackArtist } from "@/shared/types";
import { useOfflineModeStore } from "@/features/connectivity/store/offlineModeStore";
import {
  cachedArtistIdByName,
  isArtistId,
  resolveArtistIdByName,
} from "../lib/artistResolver";

function ArtistName({
  name,
  artistId,
  onNavigate,
}: {
  name: string;
  artistId?: string;
  onNavigate?: () => void;
}) {
  const navigate = useStableNavigate();
  const [unresolved, setUnresolved] = useState(
    () => !artistId && cachedArtistIdByName(name) === null,
  );

  const open = useCallback(async () => {
    const targetId = artistId ?? (await resolveArtistIdByName(name));
    if (!targetId) {
      setUnresolved(true);
      return;
    }
    onNavigate?.();
    navigate(`/artist?id=${encodeURIComponent(targetId)}`);
  }, [artistId, name, navigate, onNavigate]);

  const warmUp = useCallback(() => {
    if (!artistId) void resolveArtistIdByName(name);
  }, [artistId, name]);

  if (!name.trim() || unresolved) return <span>{name}</span>;

  return (
    <span
      role="button"
      tabIndex={0}
      className="cursor-pointer hover:text-text-primary transition-colors duration-150 prevent-seek"
      onMouseEnter={warmUp}
      onFocus={warmUp}
      onPointerDown={(e) => {
        e.stopPropagation();
      }}
      onClick={(e) => {
        e.stopPropagation();
        void open();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          void open();
        }
      }}
    >
      {name}
    </span>
  );
}

export interface ArtistLinkProps {
  name?: string;
  artistId?: string;
  artists?: string;
  artistList?: TrackArtist[];
  className?: string;
  separator?: string;
  onNavigate?: () => void;
  plain?: boolean;
}

export default function ArtistLink({
  name,
  artistId,
  artists,
  artistList,
  className = "",
  separator = ", ",
  onNavigate,
  plain = false,
}: ArtistLinkProps) {
  const offline = useOfflineModeStore((state) => state.offline);
  const outerRef = useRef<HTMLSpanElement>(null);
  const innerRef = useRef<HTMLSpanElement>(null);
  const [delta, setDelta] = useState(0);
  const [hovered, setHovered] = useState(false);

  const measure = useCallback(() => {
    if (!outerRef.current || !innerRef.current) return;
    const diff = innerRef.current.scrollWidth - outerRef.current.clientWidth;
    setDelta(Math.max(0, diff));
  }, []);

  useLayoutEffect(() => {
    measure();
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const observer = new ResizeObserver(measure);
    observer.observe(outer);
    observer.observe(inner);
    return () => observer.disconnect();
  }, [measure]);

  let innerContent: React.ReactNode = null;

  if (plain || offline) {
    const text =
      name ??
      artists ??
      artistList?.map((artist) => artist.name).join(separator);
    if (!text) return null;
    innerContent = <span>{text}</span>;
  } else if (artistList && artistList.length > 0) {
    innerContent = artistList.map((artist, index) => {
      const targetId = isArtistId(artist.id)
        ? artist.id
        : artistList.length === 1 && isArtistId(artistId)
          ? artistId
          : undefined;
      return (
        <Fragment key={artist.id || `${artist.name}-${index}`}>
          {index > 0 && (
            <span className="select-none whitespace-pre">{separator}</span>
          )}
          <ArtistName
            name={artist.name}
            artistId={targetId}
            onNavigate={onNavigate}
          />
        </Fragment>
      );
    });
  } else {
    const text = name ?? artists;
    if (!text) return null;

    if (isArtistId(artistId)) {
      innerContent = (
        <ArtistName name={text} artistId={artistId} onNavigate={onNavigate} />
      );
    } else {
      const parts = text
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
      innerContent = parts.map((part, index) => (
        <Fragment key={`${part}-${index}`}>
          {index > 0 && (
            <span className="select-none whitespace-pre">{separator}</span>
          )}
          <ArtistName name={part} onNavigate={onNavigate} />
        </Fragment>
      ));
    }
  }

  const maskStyle =
    delta > 0
      ? {
          maskImage: hovered
            ? "linear-gradient(to right, transparent 0px, black 12px, black calc(100% - 14px), transparent 100%)"
            : "linear-gradient(to right, black 0px, black calc(100% - 14px), transparent 100%)",
          WebkitMaskImage: hovered
            ? "linear-gradient(to right, transparent 0px, black 12px, black calc(100% - 14px), transparent 100%)"
            : "linear-gradient(to right, black 0px, black calc(100% - 14px), transparent 100%)",
          transition: "mask-image 200ms ease, -webkit-mask-image 200ms ease",
        }
      : undefined;

  return (
    <span
      ref={outerRef}
      className={`relative inline-flex items-center min-w-0 max-w-full overflow-hidden text-left ${className}`}
      style={maskStyle}

      onMouseEnter={() => {
        measure();
        setHovered(true);
      }}
      onMouseLeave={() => setHovered(false)}
    >
      <span
        ref={innerRef}
        className="inline-flex items-center whitespace-nowrap flex-nowrap shrink-0"
        style={{
          transform:
            hovered && delta > 0
              ? `translateX(-${delta + 6}px)`
              : "translateX(0)",
          transition: hovered
            ? `transform ${Math.max(800, delta * 14)}ms linear`
            : "transform 300ms ease",
        }}
      >
        {innerContent}
      </span>
    </span>
  );
}
