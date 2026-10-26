import { memo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { AddLine, CheckLine, CloseLine } from "@mingcute/react";
import { useTranslation } from "@/languages";
import { cn } from "@/shared/lib";
import { usePlayerState } from "../hooks/usePlayerState";
import { playerEngine } from "../engine/playerEngine";
import {
  EQ_BANDS,
  EQ_MAX_CUSTOM_PRESETS,
  EQ_MAX_DB,
  EQ_MIN_DB,
  EQ_PRESETS,
  EQ_PRESET_CATEGORIES,
  EQ_PRESET_NAME_MAX,
  FLAT_EQ,
  clampEqGain,
  findEqCustomPreset,
  findEqPreset,
  formatEqFrequency,
  type EqPresetCategory,
} from "../engine/equalizer";
import { OptionToggle } from "./speed/OptionToggle";

export interface EqualizerPickerProps {
  className?: string;
}

type EqTab = EqPresetCategory | "custom";
const EQ_TABS: EqTab[] = [...EQ_PRESET_CATEGORIES, "custom"];

const formatDb = (db: number) =>
  `${db > 0 ? "+" : ""}${Number.isInteger(db) ? db : db.toFixed(1)}`;

const toRatio = (db: number) => (db - EQ_MIN_DB) / (EQ_MAX_DB - EQ_MIN_DB);

const chipClass =
  "relative flex h-[26px] min-w-0 items-center justify-center rounded-[6px] border-0 px-[6px] text-[11px] font-[600] transition-colors";
const idleChipClass =
  "bg-black/[0.06] text-text-secondary hover:text-text-primary dark:bg-white/[0.06]";

interface BandSliderProps {
  frequency: number;
  value: number;
  dimmed: boolean;
  onChange: (db: number) => void;
}

function BandSlider({ frequency, value, dimmed, onChange }: BandSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const label = `${formatEqFrequency(frequency)} Hz`;

  const setFromPointer = (clientY: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.height <= 0) return;
    const ratio = 1 - (clientY - rect.top) / rect.height;
    const db = clampEqGain(EQ_MIN_DB + ratio * (EQ_MAX_DB - EQ_MIN_DB));
    if (db !== value) onChange(db);
  };

  const ratio = toRatio(value);
  const zero = toRatio(0);
  const fillTop = Math.min(ratio, zero);
  const fillHeight = Math.abs(ratio - zero);

  return (
    <div className="flex flex-col items-center gap-[6px]">
      <span
        className={cn(
          "h-[13px] text-[10px] font-[600] tabular-nums transition-colors",
          Math.abs(value) > 0.01 ? "text-text-primary" : "text-text-tertiary",
        )}
      >
        {formatDb(value)}
      </span>
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-orientation="vertical"
        aria-valuemin={EQ_MIN_DB}
        aria-valuemax={EQ_MAX_DB}
        aria-valuenow={value}
        aria-valuetext={`${formatDb(value)} dB`}
        title={label}
        className={cn(
          "group relative h-[112px] w-[18px] cursor-ns-resize touch-none outline-none transition-opacity",
          dimmed && "opacity-45",
        )}
        onPointerDown={(event) => {
          event.stopPropagation();
          event.currentTarget.setPointerCapture(event.pointerId);
          setFromPointer(event.clientY);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            setFromPointer(event.clientY);
        }}
        onDoubleClick={() => onChange(0)}
        onWheel={(event) => {
          event.stopPropagation();
          onChange(clampEqGain(value + (event.deltaY < 0 ? 0.5 : -0.5)));
        }}
        onKeyDown={(event) => {
          const delta =
            event.key === "ArrowUp"
              ? 0.5
              : event.key === "ArrowDown"
                ? -0.5
                : 0;
          if (!delta) return;
          event.preventDefault();
          onChange(clampEqGain(value + delta));
        }}
      >
        <div className="absolute inset-y-0 left-1/2 w-[4px] -translate-x-1/2 rounded-full bg-black/[0.08] dark:bg-white/[0.08]" />
        <div
          className="absolute left-1/2 w-[4px] -translate-x-1/2 rounded-full bg-text-primary/80"
          style={{
            bottom: `${fillTop * 100}%`,
            height: `${fillHeight * 100}%`,
          }}
        />
        <div
          className="absolute left-1/2 h-[10px] w-[14px] -translate-x-1/2 translate-y-1/2 rounded-[4px] bg-text-primary shadow-sm transition-transform group-hover:scale-110 group-focus-visible:scale-110"
          style={{ bottom: `${ratio * 100}%` }}
        />
      </div>
      <span className="text-[10px] font-[500] text-text-tertiary">
        {formatEqFrequency(frequency)}
      </span>
    </div>
  );
}

export const EqualizerPicker = memo(function EqualizerPicker({
  className,
}: EqualizerPickerProps) {
  const { t } = useTranslation();
  const player = usePlayerState();
  const isEqEnabled = player.isEqEnabled ?? false;
  const eqGains = player.eqGains ?? FLAT_EQ;
  const customPresets = player.eqCustomPresets ?? [];
  const activePreset = findEqPreset(eqGains);
  const activeCustom = activePreset
    ? null
    : findEqCustomPreset(customPresets, eqGains);

  // open on the tab that holds the curve in use
  const [tab, setTab] = useState<EqTab>(() =>
    activeCustom ? "custom" : (activePreset?.category ?? "enhance"),
  );
  const [isNaming, setIsNaming] = useState(false);
  const [draftName, setDraftName] = useState("");

  // touching a band or a preset means "I want the EQ": switch it on
  const applyGains = (gains: number[]) => {
    playerEngine.setEqGains(gains);
    if (!isEqEnabled) playerEngine.setIsEqEnabled(true);
  };

  const setBand = (index: number, db: number) => {
    const gains = [...eqGains];
    gains[index] = db;
    applyGains(gains);
  };

  const commitName = () => {
    if (draftName.trim()) playerEngine.saveEqPreset(draftName);
    setDraftName("");
    setIsNaming(false);
  };

  const canSaveMore = customPresets.length < EQ_MAX_CUSTOM_PRESETS;

  return (
    <div
      className={cn(
        "flex flex-col gap-[14px] text-text-primary select-none",
        className,
      )}
      onClick={(event) => event.stopPropagation()}
    >
      <OptionToggle
        title={t("player.equalizer")}
        hint={t("player.equalizer_hint")}
        checked={isEqEnabled}
        ariaLabel={t("player.equalizer")}
        onChange={(enabled) => playerEngine.setIsEqEnabled(enabled)}
      />

      <div className="flex flex-col gap-[8px]">
        <div className="grid grid-cols-4 gap-[2px] rounded-[8px] bg-black/[0.04] p-[2px] dark:bg-white/[0.04]">
          {EQ_TABS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "relative h-[24px] rounded-[6px] border-0 text-[11px] font-[600] transition-colors",
                tab === id
                  ? "text-text-primary"
                  : "text-text-tertiary hover:text-text-secondary",
              )}
            >
              {tab === id && (
                <motion.span
                  layoutId="active-eq-tab"
                  className="absolute inset-0 rounded-[6px] bg-black/[0.07] dark:bg-white/[0.1]"
                  transition={{ type: "spring", stiffness: 450, damping: 32 }}
                />
              )}
              <span className="relative">{t(`player.eq_tab_${id}`)}</span>
            </button>
          ))}
        </div>

        {tab !== "custom" ? (
          <div className="grid grid-cols-3 gap-[4px]">
            {EQ_PRESETS.filter((preset) => preset.category === tab).map(
              (preset) => {
                const active = isEqEnabled && activePreset?.id === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    title={t(`player.eq_preset_${preset.id}_hint`)}
                    onClick={() => applyGains(preset.gains)}
                    className={cn(
                      chipClass,
                      active ? "text-bg-primary" : idleChipClass,
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId="active-eq-preset"
                        className="absolute inset-0 rounded-[6px] bg-text-primary/80"
                        transition={{
                          type: "spring",
                          stiffness: 450,
                          damping: 32,
                        }}
                      />
                    )}
                    <span className="relative truncate">
                      {t(`player.eq_preset_${preset.id}`)}
                    </span>
                  </button>
                );
              },
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-[4px]">
            {customPresets.length > 0 && (
              <div className="grid grid-cols-3 gap-[4px]">
                {customPresets.map((preset) => {
                  const active = isEqEnabled && activeCustom?.id === preset.id;
                  return (
                    <div key={preset.id} className="group relative min-w-0">
                      <button
                        type="button"
                        title={preset.name}
                        onClick={() => applyGains(preset.gains)}
                        className={cn(
                          chipClass,
                          "w-full",
                          active ? "text-bg-primary" : idleChipClass,
                        )}
                      >
                        {active && (
                          <motion.span
                            layoutId="active-eq-preset"
                            className="absolute inset-0 rounded-[6px] bg-text-primary/80"
                            transition={{
                              type: "spring",
                              stiffness: 450,
                              damping: 32,
                            }}
                          />
                        )}
                        <span className="relative truncate">{preset.name}</span>
                      </button>
                      <button
                        type="button"
                        aria-label={t("player.eq_delete_preset")}
                        title={t("player.eq_delete_preset")}
                        onClick={() => playerEngine.deleteEqPreset(preset.id)}
                        className="absolute -right-[4px] -top-[4px] flex h-[16px] w-[16px] items-center justify-center rounded-full border-0 bg-text-primary text-bg-primary opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                      >
                        <CloseLine size={10} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {isNaming ? (
              <form
                className="flex gap-[4px]"
                onSubmit={(event) => {
                  event.preventDefault();
                  commitName();
                }}
              >
                <input
                  autoFocus
                  value={draftName}
                  maxLength={EQ_PRESET_NAME_MAX}
                  placeholder={t("player.eq_preset_name")}
                  onChange={(event) => setDraftName(event.target.value)}
                  onBlur={() => {
                    if (!draftName.trim()) setIsNaming(false);
                  }}
                  className="h-[26px] min-w-0 flex-1 rounded-[6px] border-0 bg-black/[0.06] px-[8px] text-[11px] font-[500] text-text-primary outline-none placeholder:text-text-tertiary dark:bg-white/[0.06]"
                />
                <button
                  type="submit"
                  aria-label={t("player.eq_save_preset")}
                  disabled={!draftName.trim()}
                  className="flex h-[26px] w-[32px] items-center justify-center rounded-[6px] border-0 bg-text-primary/80 text-bg-primary transition-opacity disabled:opacity-40"
                >
                  <CheckLine size={14} />
                </button>
              </form>
            ) : (
              <button
                type="button"
                disabled={!canSaveMore}
                onClick={() => setIsNaming(true)}
                className={cn(
                  chipClass,
                  "gap-[4px] border border-dashed border-black/[0.12] bg-transparent text-text-secondary hover:text-text-primary disabled:opacity-40 dark:border-white/[0.12]",
                )}
              >
                <AddLine size={12} />
                {canSaveMore
                  ? t("player.eq_save_preset")
                  : t("player.eq_presets_full")}
              </button>
            )}

            {customPresets.length === 0 && !isNaming && (
              <span className="text-[11px] leading-[1.35] text-text-tertiary">
                {t("player.eq_custom_empty")}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-10">
        {EQ_BANDS.map((frequency, i) => (
          <BandSlider
            key={frequency}
            frequency={frequency}
            value={eqGains[i] ?? 0}
            dimmed={!isEqEnabled}
            onChange={(db) => setBand(i, db)}
          />
        ))}
      </div>
    </div>
  );
});

export default EqualizerPicker;
