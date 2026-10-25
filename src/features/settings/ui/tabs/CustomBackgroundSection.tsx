import { useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { Delete2Line, Pic2Line, Upload2Line } from "@mingcute/react";
import { useTranslation } from "@/languages";
import { Button, Slider, ToggleSwitch, useToast } from "@/shared/ui";
import {
  useCustomBackgroundStore,
  BACKGROUND_ACCEPT,
  MAX_BACKGROUND_BLUR,
  MAX_BACKGROUND_DIM,
  MAX_PANEL_TRANSPARENCY,
  type BackgroundFileError,
} from "@/features/custom-background";
import { SettingBlock, SettingRow } from "../controls";

const font = { fontFamily: "var(--font-inter), sans-serif" } as const;

const ERROR_KEYS: Record<BackgroundFileError, string> = {
  type: "settings.background.error_type",
  size: "settings.background.error_size",
  save: "settings.background.error_save",
};

function SliderField({
  label,
  value,
  max,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  unit: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex flex-col gap-[2px]">
      <span className="text-text-secondary text-[12px]" style={font}>
        {label}
      </span>
      <Slider
        value={value}
        onChange={onChange}
        min={0}
        max={max}
        unit={unit}
        ariaLabel={label}
      />
    </div>
  );
}

export function CustomBackgroundSection({
  searchQuery,
}: {
  searchQuery?: string;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const reducedMotion = useReducedMotion() ?? false;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [busy, setBusy] = useState(false);

  const media = useCustomBackgroundStore((s) => s.media);
  const mediaUrl = useCustomBackgroundStore((s) => s.mediaUrl);
  const blur = useCustomBackgroundStore((s) => s.blur);
  const dim = useCustomBackgroundStore((s) => s.dim);
  const panelTransparency = useCustomBackgroundStore(
    (s) => s.panelTransparency,
  );
  const useCoversOnPages = useCustomBackgroundStore((s) => s.useCoversOnPages);
  const setMediaFile = useCustomBackgroundStore((s) => s.setMediaFile);
  const removeMedia = useCustomBackgroundStore((s) => s.removeMedia);
  const setBlur = useCustomBackgroundStore((s) => s.setBlur);
  const setDim = useCustomBackgroundStore((s) => s.setDim);
  const setPanelTransparency = useCustomBackgroundStore(
    (s) => s.setPanelTransparency,
  );
  const setUseCoversOnPages = useCustomBackgroundStore(
    (s) => s.setUseCoversOnPages,
  );

  const applyFile = async (file: File) => {
    setBusy(true);
    const error = await setMediaFile(file);
    setBusy(false);
    if (error) {
      toast(t(ERROR_KEYS[error]), "error");
      return;
    }
    toast(t("settings.background.applied"), "success");
  };

  const openPicker = () => {
    if (!busy) fileInputRef.current?.click();
  };

  const handleRemove = async () => {
    setBusy(true);
    const removed = await removeMedia();
    setBusy(false);
    if (removed) toast(t("settings.background.removed"), "info");
    else toast(t("settings.background.error_remove"), "error");
  };

  const previewStyle = {
    filter: blur > 0 ? `blur(${Math.round(blur / 3)}px)` : undefined,
    transform: blur > 0 ? "scale(1.06)" : undefined,
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept={BACKGROUND_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void applyFile(file);
        }}
      />

      <SettingBlock
        title={t("settings.background.title")}
        description={t("settings.background.description")}
        titleKey="settings.background.title"
        descKey="settings.background.description"
        searchQuery={searchQuery}
      >
        {media ? (
          <div className="flex flex-col gap-[12px]">
            <div className="relative h-[132px] w-full overflow-hidden rounded-[10px] bg-black/40">
              {mediaUrl ? (
                media.kind === "video" ? (
                  <video
                    key={mediaUrl}
                    src={mediaUrl}
                    muted
                    loop
                    playsInline
                    autoPlay={!reducedMotion}
                    className="h-full w-full object-cover"
                    style={previewStyle}
                  />
                ) : (
                  <img
                    src={mediaUrl}
                    alt={t("settings.background.preview_alt")}
                    draggable={false}
                    className="h-full w-full object-cover select-none"
                    style={previewStyle}
                  />
                )
              ) : null}
              {dim > 0 ? (
                <div
                  className="pointer-events-none absolute inset-0 bg-black"
                  style={{ opacity: dim / 100 }}
                />
              ) : null}
              <div className="absolute right-[8px] top-[8px] flex items-center gap-[6px]">
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  disabled={busy}
                  onClick={openPicker}
                  className="!h-[28px] !px-[10px] gap-[5px] !text-[12px] rounded-[8px] !bg-black/60 hover:!bg-black/80 !text-white backdrop-blur-md"
                >
                  <Upload2Line size={14} />
                  {t("settings.background.change")}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  disabled={busy}
                  onClick={() => void handleRemove()}
                  className="!h-[28px] !px-[10px] gap-[5px] !text-[12px] rounded-[8px] !bg-black/60 hover:!bg-[#ff4d4d]/80 !text-white backdrop-blur-md"
                >
                  <Delete2Line size={14} />
                  {t("settings.background.remove")}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-[16px]">
              <SliderField
                label={t("settings.background.blur")}
                value={blur}
                max={MAX_BACKGROUND_BLUR}
                unit="px"
                onChange={setBlur}
              />
              <SliderField
                label={t("settings.background.dim")}
                value={dim}
                max={MAX_BACKGROUND_DIM}
                unit="%"
                onChange={setDim}
              />
            </div>

            <div className="flex flex-col gap-[2px]">
              <SliderField
                label={t("settings.background.panel_transparency")}
                value={panelTransparency}
                max={MAX_PANEL_TRANSPARENCY}
                unit="%"
                onChange={setPanelTransparency}
              />
              <span className="text-text-tertiary text-[11.5px]" style={font}>
                {t("settings.background.panel_transparency_description")}
              </span>
            </div>
          </div>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={openPicker}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file) void applyFile(file);
            }}
            className={`flex w-full flex-col items-center justify-center gap-[8px] rounded-[10px] border border-dashed bg-transparent px-[16px] py-[22px] text-center transition-colors ${
              busy ? "cursor-wait opacity-60" : "cursor-pointer"
            } ${
              isDragOver
                ? "border-text-primary bg-border-alpha-14"
                : "border-border-secondary hover:border-text-tertiary hover:bg-border-alpha-14"
            }`}
          >
            <span className="flex h-[36px] w-[36px] items-center justify-center rounded-full bg-border-alpha-14 text-text-tertiary">
              <Pic2Line size={20} />
            </span>
            <span className="flex flex-col gap-[2px]">
              <span
                className="text-text-primary text-[13px] font-[500]"
                style={font}
              >
                {t("settings.background.upload_title")}
              </span>
              <span className="text-text-tertiary text-[11.5px]" style={font}>
                {t("settings.background.upload_hint")}
              </span>
            </span>
          </button>
        )}
      </SettingBlock>

      {media ? (
        <SettingRow
          title={t("settings.background.use_covers")}
          description={t("settings.background.use_covers_description")}
          titleKey="settings.background.use_covers"
          descKey="settings.background.use_covers_description"
          searchQuery={searchQuery}
          explained
          control={
            <ToggleSwitch
              checked={useCoversOnPages}
              onChange={setUseCoversOnPages}
              ariaLabel={t("settings.background.use_covers")}
            />
          }
        />
      ) : null}
    </>
  );
}
