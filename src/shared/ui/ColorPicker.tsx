import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ColorPickerLine } from "@mingcute/react";
import { cn } from "@/shared/lib/utils";
import { acquireEscapeGuard } from "@/shared/utils/escapeGuard";
import { PANEL_GLASS_CLASS } from "./Panel";

/** hue 0-360, saturation and value 0-1 */
export interface Hsv {
  h: number;
  s: number;
  v: number;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export function hexToHsv(hex: string): Hsv | null {
  const match = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(hex.trim());
  if (!match) return null;
  let digits = match[1];
  if (digits.length === 3) digits = [...digits].map((c) => c + c).join("");
  const n = Number.parseInt(digits, 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max ? d / max : 0, v: max };
}

export function hsvToHex({ h, s, v }: Hsv): `#${string}` {
  const f = (k: number) => {
    const x = (k + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(x, 4 - x, 1));
  };
  const hex = [f(5), f(3), f(1)]
    .map((c) =>
      Math.round(clamp01(c) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");
  return `#${hex}`;
}

/** follows a pointer drag over an element, reporting 0-1 positions */
function useDrag(onMove: (x: number, y: number) => void) {
  const ref = useRef<HTMLDivElement>(null);
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setPointerCapture(e.pointerId);
    const report = (cx: number, cy: number) => {
      const rect = el.getBoundingClientRect();
      onMoveRef.current(
        clamp01((cx - rect.left) / rect.width),
        clamp01((cy - rect.top) / rect.height),
      );
    };
    report(e.clientX, e.clientY);
    const move = (ev: PointerEvent) => report(ev.clientX, ev.clientY);
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  };
  return { ref, onPointerDown };
}

const HANDLE =
  "pointer-events-none absolute h-[16px] w-[16px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[2.5px] border-white shadow-[0_1px_4px_rgba(0,0,0,0.4),0_0_0_0.5px_rgba(0,0,0,0.2)]";
const FOCUS =
  "outline-none focus-visible:ring-2 focus-visible:ring-text-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent";

export interface ColorPickerLabels {
  saturation: string;
  hue: string;
  hex: string;
  eyedropper: string;
}

interface PanelProps {
  value: string;
  onChange: (hex: `#${string}`) => void;
  labels: ColorPickerLabels;
}

type EyeDropperCtor = new () => { open: () => Promise<{ sRGBHex: string }> };

function ColorPanel({ value, onChange, labels }: PanelProps) {
  // keep HSV here: hue would be lost going through grey or black otherwise
  const [hsv, setHsv] = useState<Hsv>(
    () => hexToHsv(value) ?? { h: 0, s: 1, v: 1 },
  );
  const [text, setText] = useState(value.replace("#", "").toUpperCase());
  const lastEmitted = useRef(value.toLowerCase());

  // follow outside changes (a swatch clicked elsewhere, an imported theme)
  useEffect(() => {
    if (value.toLowerCase() === lastEmitted.current) return;
    const next = hexToHsv(value);
    if (!next) return;
    lastEmitted.current = value.toLowerCase();
    setHsv(next);
    setText(value.replace("#", "").toUpperCase());
  }, [value]);

  const commit = useCallback(
    (next: Hsv) => {
      setHsv(next);
      const hex = hsvToHex(next);
      setText(hex.slice(1).toUpperCase());
      if (hex !== lastEmitted.current) {
        lastEmitted.current = hex;
        onChange(hex);
      }
    },
    [onChange],
  );

  const area = useDrag((x, y) => commit({ ...hsv, s: x, v: 1 - y }));
  const hue = useDrag((x) => commit({ ...hsv, h: Math.min(359.9, x * 360) }));

  const areaKeys = (e: ReactKeyboardEvent) => {
    const step = e.shiftKey ? 0.1 : 0.02;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    };
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    commit({
      ...hsv,
      s: clamp01(hsv.s + move[0]),
      v: clamp01(hsv.v + move[1]),
    });
  };

  const hueKeys = (e: ReactKeyboardEvent) => {
    const step = e.shiftKey ? 15 : 3;
    const delta =
      e.key === "ArrowLeft" || e.key === "ArrowDown"
        ? -step
        : e.key === "ArrowRight" || e.key === "ArrowUp"
          ? step
          : 0;
    if (!delta) return;
    e.preventDefault();
    commit({ ...hsv, h: (hsv.h + delta + 360) % 360 });
  };

  const applyText = (raw: string) => {
    const next = hexToHsv(raw);
    if (next) commit(next);
    else setText(hsvToHex(hsv).slice(1).toUpperCase());
  };

  const eyeDropper =
    typeof window !== "undefined" && "EyeDropper" in window
      ? (window as unknown as { EyeDropper: EyeDropperCtor }).EyeDropper
      : null;

  const pure = hsvToHex({ h: hsv.h, s: 1, v: 1 });
  const current = hsvToHex(hsv);

  return (
    <div className="flex w-[232px] flex-col gap-[12px] p-[12px]">
      <div
        ref={area.ref}
        role="slider"
        tabIndex={0}
        aria-label={labels.saturation}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(hsv.s * 100)}
        aria-valuetext={`${Math.round(hsv.s * 100)}%, ${Math.round(hsv.v * 100)}%`}
        onPointerDown={area.onPointerDown}
        onKeyDown={areaKeys}
        className={cn(
          "relative h-[148px] w-full cursor-crosshair touch-none rounded-[10px]",
          FOCUS,
        )}
        style={{
          background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${pure})`,
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)",
        }}
      >
        <span
          className={HANDLE}
          style={{
            left: `${hsv.s * 100}%`,
            top: `${(1 - hsv.v) * 100}%`,
            background: current,
          }}
        />
      </div>

      <div
        ref={hue.ref}
        role="slider"
        tabIndex={0}
        aria-label={labels.hue}
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={Math.round(hsv.h)}
        onPointerDown={hue.onPointerDown}
        onKeyDown={hueKeys}
        className={cn(
          "relative mx-[8px] h-[12px] cursor-pointer touch-none rounded-full",
          FOCUS,
        )}
        style={{
          background:
            "linear-gradient(to right, #f00 0%, #ff0 16.66%, #0f0 33.33%, #0ff 50%, #00f 66.66%, #f0f 83.33%, #f00 100%)",
        }}
      >
        {/* the bar runs past its hit area by the handle's radius on both
            sides, so the handle centre can reach each end of the range */}
        <span
          className="pointer-events-none absolute inset-y-0 -left-[8px] w-[8px] rounded-l-full"
          style={{ background: "#f00" }}
        />
        <span
          className="pointer-events-none absolute inset-y-0 -right-[8px] w-[8px] rounded-r-full"
          style={{ background: "#f00" }}
        />
        <span
          className={HANDLE}
          style={{
            left: `${(hsv.h / 360) * 100}%`,
            top: "50%",
            background: pure,
          }}
        />
      </div>

      <div className="flex items-center gap-[8px]">
        <span
          className="h-[30px] w-[30px] shrink-0 rounded-full"
          style={{
            background: current,
            boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.12)",
          }}
        />
        <label className="flex h-[30px] min-w-0 flex-1 items-center gap-[2px] rounded-control bg-fill px-[10px] transition-shadow focus-within:ring-2 focus-within:ring-text-primary/25">
          <span className="text-caption font-[500] text-text-tertiary">#</span>
          <input
            value={text}
            aria-label={labels.hex}
            spellCheck={false}
            maxLength={7}
            onChange={(e) =>
              setText(e.target.value.replace(/[^0-9a-f]/gi, "").toUpperCase())
            }
            onBlur={(e) => applyText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") applyText(e.currentTarget.value);
            }}
            className="w-full min-w-0 border-none bg-transparent p-0 font-mono text-caption font-[500] uppercase tracking-[0.04em] text-text-primary outline-none"
          />
        </label>
        {eyeDropper && (
          <button
            type="button"
            aria-label={labels.eyedropper}
            title={labels.eyedropper}
            onClick={async () => {
              try {
                const { sRGBHex } = await new eyeDropper().open();
                const next = hexToHsv(sRGBHex);
                if (next) commit(next);
              } catch {
                // the user pressed Escape in the eyedropper
              }
            }}
            className="flex h-[30px] w-[30px] shrink-0 cursor-pointer items-center justify-center rounded-control border-none bg-fill p-0 text-text-secondary transition-colors hover:bg-fill-hover hover:text-text-primary"
          >
            <ColorPickerLine size={15} />
          </button>
        )}
      </div>
    </div>
  );
}

export interface ColorPickerProps {
  value: string;
  onChange: (hex: `#${string}`) => void;
  /** accessible name of the trigger and the popover */
  label: string;
  labels: ColorPickerLabels;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

const GAP = 8;
const MARGIN = 12;

/**
 * Colour picker that lives in the app instead of the OS dialog: a
 * saturation/brightness pad, a hue bar, a hex field and an eyedropper on
 * the app's glass surface, updating live while you drag.
 */
export function ColorPicker({
  value,
  onChange,
  label,
  labels,
  className,
  style,
  children,
}: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{
    top: number;
    left: number;
    above: boolean;
  } | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    const place = () => {
      const trigger = triggerRef.current?.getBoundingClientRect();
      const panel = panelRef.current;
      if (!trigger || !panel) return;
      const { offsetWidth: w, offsetHeight: h } = panel;
      const above =
        trigger.bottom + GAP + h > window.innerHeight - MARGIN &&
        trigger.top - GAP - h > MARGIN;
      const left = Math.min(
        window.innerWidth - w - MARGIN,
        Math.max(MARGIN, trigger.left + trigger.width / 2 - w / 2),
      );
      setPosition({
        top: above ? trigger.top - GAP - h : trigger.bottom + GAP,
        left,
        above,
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    // the settings dialog listens for Escape too; it should only close us
    const release = acquireEscapeGuard();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    };
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (
        panelRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("pointerdown", onDown, true);
    return () => {
      release();
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("pointerdown", onDown, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={className}
        style={style}
      >
        {children}
      </button>
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                ref={panelRef}
                role="dialog"
                aria-label={label}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: position ? 1 : 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                className={cn(
                  PANEL_GLASS_CLASS,
                  "fixed z-[100000] rounded-[16px] shadow-[0_12px_40px_rgba(0,0,0,0.35)] ring-1 ring-border-alpha-14",
                )}
                style={{
                  top: position?.top ?? -9999,
                  left: position?.left ?? -9999,
                  transformOrigin: position?.above
                    ? "bottom center"
                    : "top center",
                }}
              >
                <ColorPanel value={value} onChange={onChange} labels={labels} />
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}

export default ColorPicker;
