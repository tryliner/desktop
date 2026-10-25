import type { ReactNode } from "react";
import { getTranslationsForAllLocales } from "@/languages";

const font = { fontFamily: "var(--font-inter), sans-serif" } as const;

const rowCard = "rounded-[12px] bg-black/[0.04] px-[16px] dark:bg-white/[0.08]";

// single-line row: label on the left, control pinned right, like the reference mock
export function SettingRow({
  title,
  description,
  control,
  icon,
  explained = false,
  titleKey,
  descKey,
  searchQuery,
}: {
  title: string;
  description?: string;
  control?: ReactNode;
  icon?: ReactNode;
  explained?: boolean;
  titleKey?: string;
  descKey?: string;
  searchQuery?: string;
}) {
  if (searchQuery && searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    let isMatch =
      title.toLowerCase().includes(q) ||
      (description ? description.toLowerCase().includes(q) : false);

    if (!isMatch && (titleKey || descKey)) {
      const allTexts: string[] = [];
      if (titleKey) allTexts.push(...getTranslationsForAllLocales(titleKey));
      if (descKey) allTexts.push(...getTranslationsForAllLocales(descKey));
      isMatch = allTexts.some((text) => text.toLowerCase().includes(q));
    }

    if (!isMatch) return null;
  }

  return (
    <div
      className={`${rowCard} flex min-h-[46px] items-center justify-between gap-[12px] py-[10px]`}
    >
      {icon ? (
        <span className="flex shrink-0 text-text-primary">{icon}</span>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
        <span
          className="truncate text-text-primary text-[14px] font-[500] leading-snug"
          style={font}
        >
          {title}
        </span>
        {explained && description ? (
          <span
            className="max-w-[420px] text-text-tertiary text-[12px] leading-[1.4]"
            style={font}
          >
            {description}
          </span>
        ) : null}
      </div>
      {control ? <div className="shrink-0">{control}</div> : null}
    </div>
  );
}

// stacked block: label on top, wide control (cards, grids) below
export function SettingBlock({
  title,
  description,
  children,
  titleKey,
  descKey,
  searchQuery,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  titleKey?: string;
  descKey?: string;
  searchQuery?: string;
}) {
  if (searchQuery && searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    let isMatch =
      title.toLowerCase().includes(q) ||
      (description ? description.toLowerCase().includes(q) : false);

    if (!isMatch && (titleKey || descKey)) {
      const allTexts: string[] = [];
      if (titleKey) allTexts.push(...getTranslationsForAllLocales(titleKey));
      if (descKey) allTexts.push(...getTranslationsForAllLocales(descKey));
      isMatch = allTexts.some((text) => text.toLowerCase().includes(q));
    }

    if (!isMatch) return null;
  }

  return (
    <div className={`${rowCard} flex flex-col gap-[10px] py-[13px]`}>
      <div className="flex min-w-0 max-w-[460px] flex-col gap-[2px]">
        <span
          className="text-text-primary text-[14px] font-[500] leading-snug"
          style={font}
        >
          {title}
        </span>
        {description ? (
          <span
            className="text-text-tertiary text-[12px] leading-[1.45]"
            style={font}
          >
            {description}
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

// faint uppercase group label, keeps long tabs scannable without extra prose
export function SettingSection({
  label,
  children,
}: {
  label?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col">
      {label ? (
        <h4
          className="text-text-secondary text-[14px] font-[500] m-0 pt-[4px] pb-[10px]"
          style={font}
        >
          {label}
        </h4>
      ) : null}
      <div className="flex flex-col gap-[8px]">{children}</div>
    </section>
  );
}

// compact pill switcher reused by language / playback / mini-player rows
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  disabled = false,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  ariaLabel?: string;
  disabled?: boolean;
}) {
  return (
    <div
      role={ariaLabel ? "group" : undefined}
      aria-label={ariaLabel}
      className={`inline-flex w-fit shrink-0 items-center gap-[6px] transition-opacity ${
        disabled ? "opacity-50 cursor-not-allowed pointer-events-none" : ""
      }`}
    >
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => !disabled && onChange(opt.value)}
            aria-pressed={isActive}
            className={`inline-flex h-[32px] items-center whitespace-nowrap rounded-[10px] border-0 px-[14px] text-[13px] leading-none transition-colors ${
              disabled
                ? isActive
                  ? "bg-text-primary/40 text-bg-primary/80 cursor-not-allowed"
                  : "bg-black/[0.06] text-text-tertiary cursor-not-allowed dark:bg-black/30"
                : isActive
                  ? "bg-text-primary/70 text-bg-primary cursor-pointer"
                  : "bg-black/[0.06] text-text-primary hover:bg-black/[0.1] cursor-pointer dark:bg-black/30 dark:hover:bg-black/40"
            }`}
            style={{ ...font, fontWeight: isActive ? 500 : 400 }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
