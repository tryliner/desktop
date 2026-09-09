"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { gsap } from "gsap";
import styles from "./GridMotion.module.css";

export interface GridMotionProps {
  items?: ReactNode[];
  gradientColor?: string;
  className?: string;
}

const TOTAL_ITEMS = 35;
const ROWS = 5;
const COLUMNS = 7;

function isImageUrl(value: ReactNode): value is string {
  return typeof value === "string" && /^(?:https?:\/\/|\/|data:image\/)/.test(value);
}

function GridImage({ src }: { src: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className={`${styles.image} ${loaded ? styles.imageLoaded : ""}`}
      onLoad={() => setLoaded(true)}
      draggable={false}
    />
  );
}

export default function GridMotion({ items = [], gradientColor = "#313131", className = "" }: GridMotionProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Array<HTMLDivElement | null>>([]);

  const content = Array.from({ length: TOTAL_ITEMS }, (_, index) => items[index % Math.max(items.length, 1)] ?? `${index + 1}`);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const targets = rowRefs.current.filter((row): row is HTMLDivElement => Boolean(row));
    if (!targets.length || reducedMotion) return;

    let pointerTarget = 0;
    let pointerPosition = 0;
    const positions = targets.map(() => 0);

    const update = (clientX: number) => {
      pointerTarget = Math.max(-1, Math.min(1, (clientX / window.innerWidth - 0.5) * 2));
    };

    const handlePointerMove = (event: PointerEvent) => update(event.clientX);
    window.addEventListener("pointermove", handlePointerMove, { passive: true });

    const tick = (time: number) => {
      // Smooth the pointer itself as well as each row. In particular, leaving
      // the panel now eases back to rest instead of changing the target at once.
      pointerPosition += (pointerTarget - pointerPosition) * 0.035;
      targets.forEach((row, index) => {
        const direction = index % 2 === 0 ? 1 : -1;
        const pointerOffset = pointerPosition * 150 * direction;
        const idleOffset = Math.sin(time * (0.38 + index * 0.05) + index * 1.3) * (4 + index);
        const destination = pointerOffset + idleOffset;
        positions[index] += (destination - positions[index]) * (0.055 + index * 0.008);
        gsap.set(row, { x: positions[index] });
      });
    };
    gsap.ticker.add(tick);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      gsap.ticker.remove(tick);
      gsap.set(targets, { clearProps: "transform" });
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={`${styles.root} ${className}`.trim()}
      style={{ "--grid-motion-gradient": gradientColor } as CSSProperties}
      aria-hidden="true"
    >
      <div className={styles.glow} />
      <div className={styles.grid}>
        {Array.from({ length: ROWS }, (_, rowIndex) => (
          <div
            key={rowIndex}
            ref={(element) => { rowRefs.current[rowIndex] = element; }}
            className={styles.row}
          >
            {Array.from({ length: COLUMNS }, (_, itemIndex) => {
              const item = content[rowIndex * COLUMNS + itemIndex];
              return (
                <div key={itemIndex} className={styles.item}>
                  {isImageUrl(item) ? (
                    <GridImage src={item} />
                  ) : (
                    <div className={styles.content}>{item}</div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
