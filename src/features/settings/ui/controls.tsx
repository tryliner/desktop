import type { ReactNode } from "react";
import { getTranslationsForAllLocales } from "@/languages";

const font = { fontFamily: "var(--font-inter), sans-serif" } as const;

// single-line row: label on the left, control pinned right, like the reference mock
export function SettingRow({
  title,
  description,
  control,
  titleKey,
  descKey,
  searchQuery,
}: {
  title: string;
  description?: string;
  control: ReactNode;
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
    <div className="flex items-center justify-between gap-[16px] py-[13px]">
      <div className="flex min-w-0 max-w-[360px] flex-col gap-[2px]">
        <span
          className="text-text-primary text-[13px] font-[500] leading-snug"
          style={font}
        >
          {title}
        </span>
        {description ? (
          <span
            className="text-text-tertiary text-[12.5px] leading-relaxed"
            style={font}
          >
            {description}
          </span>
        ) : null}
      </div>
      <div className="shrink-0">{control}</div>
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
    <div className="flex flex-col gap-[10px] py-[13px]">
      <div className="flex min-w-0 max-w-[460px] flex-col gap-[2px]">
        <span
          className="text-text-primary text-[13px] font-[500] leading-snug"
          style={font}
        >
          {title}
        </span>
        {description ? (
          <span
            className="text-text-tertiary text-[12.5px] leading-relaxed"
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
          className="text-text-tertiary text-[11px] font-[600] uppercase tracking-[0.07em] m-0 pt-[4px]"
          style={font}
        >
          {label}
        </h4>
      ) : null}
      <div className="flex flex-col divide-y divide-solid divide-border-primary">
        {children}
      </div>
    </section>
  );
}

// compact pill switcher reused by language / playback / mini-player rows
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  ariaLabel?: string;
}) {
  return (
    <div
      role={ariaLabel ? "group" : undefined}
      aria-label={ariaLabel}
      className="inline-flex w-fit shrink-0 items-center gap-[1px] rounded-lg bg-border-alpha-14 p-[3px]"
    >
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={isActive}
            className={`inline-flex h-[26px] cursor-pointer items-center whitespace-nowrap rounded-md border-0 px-[11px] text-[12.5px] leading-none transition-colors ${
              isActive
                ? "bg-bg-primary text-text-primary shadow-sm"
                : "bg-transparent text-text-secondary hover:text-text-primary"
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
