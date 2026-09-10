import { useRef, useState, useLayoutEffect, useCallback, useEffect, type CSSProperties } from "react";

export interface ScrollableTextProps {
  text: string;
  className?: string;
  style?: CSSProperties;
  isParentHovered?: boolean;
  fadeColorClass?: string;
}

// scrolls horizontally on hover when text overflows container
export default function ScrollableText({
  text,
  className = "",
  style,
  isParentHovered = false,
  fadeColorClass = "from-bg-elevated",
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

  return (
    <span
      ref={outerRef}
      className={`relative block min-w-0 overflow-hidden text-left ${className}`}
      style={style}
      onMouseEnter={() => {
        measure();
        setSelfHovered(true);
      }}
      onMouseLeave={() => setSelfHovered(false)}
    >
      {/* left shadow fade in on scroll */}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute left-0 top-0 bottom-0 w-[14px] z-10 bg-gradient-to-r ${fadeColorClass} to-transparent transition-opacity duration-300 ease-out`}
        style={{ opacity: isHovered && delta > 0 ? 1 : 0 }}
      />

      {/* right shadow fade when truncated */}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute right-0 top-0 bottom-0 w-[14px] z-10 bg-gradient-to-l ${fadeColorClass} to-transparent transition-opacity duration-300 ease-out`}
        style={{ opacity: delta > 0 ? 1 : 0 }}
      />

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
