import {
  Fragment,
  useRef,
  useState,
  useLayoutEffect,
  useEffect,
  useCallback,
} from "react";
import { useNavigate } from "react-router-dom";
import type { TrackArtist } from "@/shared/types";

export interface ArtistLinkProps {
  name?: string;
  artistId?: string;
  artists?: string;
  artistList?: TrackArtist[];
  className?: string;
  separator?: string;
  onNavigate?: () => void;
}

export default function ArtistLink({
  name,
  artistId,
  artists,
  artistList,
  className = "",
  separator = ", ",
  onNavigate,
}: ArtistLinkProps) {
  const navigate = useNavigate();
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
  });

  useEffect(() => {
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  let innerContent: React.ReactNode = null;

  if (artistList && artistList.length > 0) {
    innerContent = artistList.map((artist, index) => {
      const targetId =
        artist.id && artist.id !== "unknown"
          ? artist.id
          : artistList.length === 1 && artistId && artistId !== "unknown"
            ? artistId
            : artist.name;
      const isClickable = Boolean(targetId && targetId !== "unknown");
      return (
        <Fragment key={artist.id || `${artist.name}-${index}`}>
          {index > 0 && (
            <span className="select-none whitespace-pre">
              {separator}
            </span>
          )}
          <span
            role={isClickable ? "button" : undefined}
            tabIndex={isClickable ? 0 : undefined}
            className={
              isClickable
                ? "cursor-pointer hover:text-text-primary transition-colors duration-150 prevent-seek"
                : ""
            }
            onPointerDown={
              isClickable
                ? (e) => {
                    e.stopPropagation();
                  }
                : undefined
            }
            onClick={
              isClickable
                ? (e) => {
                    e.stopPropagation();
                    onNavigate?.();
                    navigate(`/artist?id=${encodeURIComponent(targetId)}`);
                  }
                : undefined
            }
            onKeyDown={
              isClickable
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      onNavigate?.();
                      navigate(`/artist?id=${encodeURIComponent(targetId)}`);
                    }
                  }
                : undefined
            }
          >
            {artist.name}
          </span>
        </Fragment>
      );
    });
  } else {
    const text = name ?? artists;
    if (!text) return null;

    if (artistId && artistId !== "unknown") {
      innerContent = (
        <span
          role="button"
          tabIndex={0}
          className="cursor-pointer hover:text-text-primary transition-colors duration-150 prevent-seek"
          onPointerDown={(e) => {
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.stopPropagation();
            onNavigate?.();
            navigate(`/artist?id=${encodeURIComponent(artistId)}`);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              onNavigate?.();
              navigate(`/artist?id=${encodeURIComponent(artistId)}`);
            }
          }}
        >
          {text}
        </span>
      );
    } else {
      const parts = text
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
      if (parts.length > 1) {
        innerContent = parts.map((part, index) => (
          <Fragment key={`${part}-${index}`}>
            {index > 0 && (
              <span className="select-none whitespace-pre">
                {separator}
              </span>
            )}
            <span
              role="button"
              tabIndex={0}
              className="cursor-pointer hover:text-text-primary transition-colors duration-150 prevent-seek"
              onPointerDown={(e) => {
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.stopPropagation();
                onNavigate?.();
                navigate(`/artist?id=${encodeURIComponent(part)}`);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  onNavigate?.();
                  navigate(`/artist?id=${encodeURIComponent(part)}`);
                }
              }}
            >
              {part}
            </span>
          </Fragment>
        ));
      } else {
        innerContent = (
          <span
            role="button"
            tabIndex={0}
            className="cursor-pointer hover:text-text-primary transition-colors duration-150 prevent-seek"
            onPointerDown={(e) => {
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.stopPropagation();
              onNavigate?.();
              navigate(`/artist?id=${encodeURIComponent(text)}`);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                onNavigate?.();
                navigate(`/artist?id=${encodeURIComponent(text)}`);
              }
            }}
          >
            {text}
          </span>
        );
      }
    }
  }

  return (
    <span
      ref={outerRef}
      className={`relative inline-flex items-center min-w-0 max-w-full overflow-hidden text-left ${className}`}
      style={
        delta > 0 && !hovered
          ? {
              maskImage:
                "linear-gradient(to right, black calc(100% - 16px), transparent 100%)",
              WebkitMaskImage:
                "linear-gradient(to right, black calc(100% - 16px), transparent 100%)",
            }
          : undefined
      }
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

