import { cn } from "@/shared/lib";

// a plain swatch of the theme: its background with "Aa" in its text colour
function Swatch({
  mode,
  align = "center",
}: {
  mode: "light" | "dark";
  align?: "left" | "center" | "right";
}) {
  const dark = mode === "dark";
  return (
    <span
      className={cn(
        "flex h-full w-full items-center px-[18px] text-[22px] font-[600] tracking-[-0.02em]",
        dark ? "bg-[#0a0a0a] text-white" : "bg-[#f5f5f7] text-[#18181b]",
        align === "left" && "justify-start",
        align === "center" && "justify-center",
        align === "right" && "justify-end",
      )}
    >
      Aa
    </span>
  );
}

export function ThemeCard({
  mode,
  label,
  active,
  disabled = false,
  disabledReason,
  onSelect,
}: {
  mode: "light" | "dark" | "system";
  label: string;
  active: boolean;
  disabled?: boolean;
  disabledReason?: string;
  onSelect: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={disabled ? undefined : onSelect}
      aria-pressed={active}
      aria-disabled={disabled}
      title={disabled ? disabledReason : undefined}
      className={cn(
        "group flex flex-col gap-[8px] rounded-item border-0 p-[6px] pb-[9px] text-left transition-colors",
        active ? "bg-fill-hover" : "bg-fill hover:bg-fill-hover",
        disabled
          ? "cursor-not-allowed opacity-40 select-none"
          : "cursor-pointer",
      )}
    >
      <span className="relative block h-[72px] w-full overflow-hidden rounded-control ring-1 ring-inset ring-black/[0.06] dark:ring-white/[0.06]">
        {mode === "system" ? (
          <>
            <Swatch mode="light" align="left" />
            {/* the dark half cuts in on a diagonal */}
            <span
              className="absolute inset-0"
              style={{
                clipPath: "polygon(58% 0, 100% 0, 100% 100%, 42% 100%)",
              }}
            >
              <Swatch mode="dark" align="right" />
            </span>
          </>
        ) : (
          <Swatch mode={mode} />
        )}
      </span>
      <span className="flex items-center gap-[8px] px-[3px]">
        <span
          aria-hidden
          className={cn(
            "flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors",
            active
              ? "border-text-primary"
              : "border-text-tertiary group-hover:border-text-secondary",
          )}
        >
          {active ? (
            <span className="h-[6px] w-[6px] rounded-full bg-text-primary" />
          ) : null}
        </span>
        <span
          className={cn(
            "text-body leading-none",
            active ? "text-text-primary" : "text-text-secondary",
          )}
          style={{ fontWeight: active ? 500 : 400 }}
        >
          {label}
        </span>
      </span>
    </button>
  );
}
