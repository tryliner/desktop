import { useRef, useState, useLayoutEffect, useCallback, useEffect, useMemo, type CSSProperties } from "react";

export interface ScrollableTextProps {
  text: string;
  className?: string;
  style?: CSSProperties;
  isParentHovered?: boolean;
  fadeColorClass?: string;
}

// scrolls horizontally on hover when text overflows container with adaptive alpha mask fading
export default function ScrollableText({
  text,
  className = "",
  style,
  isParentHovered = false,
}: ScrollableTextProps) {
  const outerRef = useRef<HTMLSpanElement>(null);
  const innerRef = useRef<HTMLSpanElement>(null);
  const [delta, setDelta] = useState(0);
  const [selfHovered, setSelfHovered] = useState(false);

  const measure = useCallback(() => {
    if (!outerRef.current || !innerRef.current) return;
    const diff = innerRef.current.scrollWidth - outerRef.current.clientWidth;
    setDelta(Math.max(0, diff));
  }, []);

  useLayoutEffect(() => {
    measure();
  }, [text, measure]);

  useEffect(() => {
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  const isHovered = isParentHovered || selfHovered;

  const maskStyle = useMemo<CSSProperties>(() => {
    if (delta <= 0) return {};
    if (isHovered) {
      return {
        maskImage:
          "linear-gradient(to right, transparent 0px, black 14px, black calc(100% - 14px), transparent 100%)",
        WebkitMaskImage:
          "linear-gradient(to right, transparent 0px, black 14px, black calc(100% - 14px), transparent 100%)",
        transition: "mask-image 200ms ease, -webkit-mask-image 200ms ease",
      };
    }
    return {
      maskImage:
        "linear-gradient(to right, black 0px, black calc(100% - 14px), transparent 100%)",
      WebkitMaskImage:
        "linear-gradient(to right, black 0px, black calc(100% - 14px), transparent 100%)",
      transition: "mask-image 200ms ease, -webkit-mask-image 200ms ease",
    };
  }, [delta, isHovered]);

  return (
    <span
      ref={outerRef}
      className={`relative block min-w-0 overflow-hidden text-left ${className}`}
      style={{ ...style, ...maskStyle }}
      onMouseEnter={() => {
        measure();
        setSelfHovered(true);
      }}
      onMouseLeave={() => setSelfHovered(false)}
    >
      <span
        ref={innerRef}
        className="inline-block whitespace-nowrap"
        style={{
          transform: isHovered && delta > 0 ? `translateX(-${delta + 4}px)` : "translateX(0)",
          transition: isHovered
            ? `transform ${Math.max(1000, delta * 18)}ms linear`
            : "transform 300ms ease",
        }}
      >
        {text}
      </span>
    </span>
  );
}

export { ScrollableText };

