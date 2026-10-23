import { useState, useRef, useId } from "react";
import { CloseLine, Upload2Line, CheckLine } from "@mingcute/react";
import { PRESET_AVATARS } from "../constants";
import { readImageFileAsDataUrl } from "../upload";

interface AvatarPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAvatarUrl?: string | null;
  onSave: (patch: { avatarUrl: string }) => Promise<any>;
  isSaving: boolean;
}

export function AvatarPickerModal({
  isOpen,
  onClose,
  currentAvatarUrl,
  onSave,
  isSaving,
}: AvatarPickerModalProps) {
  const titleId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedAvatar, setSelectedAvatar] = useState<string>(
    currentAvatarUrl || PRESET_AVATARS[0].url
  );
  const [customUrl, setCustomUrl] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePresetSelect = (url: string) => {
    setSelectedAvatar(url);
    setUploadError(null);
  };

  const handleCustomUrlApply = () => {
    if (customUrl.trim()) {
      setSelectedAvatar(customUrl.trim());
      setUploadError(null);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadError(null);
      const dataUrl = await readImageFileAsDataUrl(file);
      setSelectedAvatar(dataUrl);
    } catch (err: any) {
      setUploadError(err?.message || "Failed to process image file");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleConfirm = async () => {
    try {
      await onSave({ avatarUrl: selectedAvatar });
      onClose();
    } catch (err: any) {
      setUploadError(err?.message || "Failed to update avatar");
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="w-full max-w-md bg-bg-secondary border border-border-subtle rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
          <h2 id={titleId} className="text-base font-semibold text-text-primary">
            Choose Avatar
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
          >
            <CloseLine size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Active Preview */}
          <div className="flex items-center justify-center">
            <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-accent shadow-xl bg-bg-primary">
              <img
                src={selectedAvatar}
                alt="Selected avatar preview"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = "/default-avatar.png";
                }}
              />
            </div>
          </div>

          {uploadError && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
              {uploadError}
            </div>
          )}

          {/* Preset Gallery */}
          <div>
            <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
              Preset Avatars
            </h3>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {PRESET_AVATARS.map((preset) => {
                const isSelected = selectedAvatar === preset.url;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handlePresetSelect(preset.url)}
                    className={`relative rounded-xl overflow-hidden aspect-square border-2 transition-all cursor-pointer ${
                      isSelected
                        ? "border-accent scale-105 shadow-md"
                        : "border-transparent hover:border-border-subtle hover:scale-102"
                    }`}
                    title={preset.name}
                  >
                    <img
                      src={preset.url}
                      alt={preset.name}
                      className="w-full h-full object-cover"
                    />
                    {isSelected && (
                      <div className="absolute inset-0 bg-accent/20 flex items-center justify-center text-accent">
                        <CheckLine size={20} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom File Upload */}
          <div>
            <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
              Upload Custom Image
            </h3>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-2.5 px-4 rounded-xl border border-dashed border-border-subtle hover:border-accent hover:bg-bg-hover text-text-secondary hover:text-text-primary text-xs font-medium transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Upload2Line size={16} />
              <span>Upload image from computer (max 3MB)</span>
            </button>
          </div>

          {/* Custom URL Input */}
          <div>
            <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
              Or Image URL
            </h3>
            <div className="flex gap-2">
              <input
                type="url"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder="https://example.com/avatar.png"
                className="flex-1 px-3 py-2 rounded-xl bg-bg-tertiary border border-border-subtle text-xs text-text-primary placeholder:text-text-secondary/40 focus:outline-none focus:border-accent"
              />
              <button
                type="button"
                onClick={handleCustomUrlApply}
                disabled={!customUrl.trim()}
                className="px-3 py-2 text-xs font-medium rounded-xl bg-bg-tertiary border border-border-subtle hover:bg-bg-hover text-text-primary disabled:opacity-50 transition-all"
              >
                Apply
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-subtle">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-xs font-medium rounded-xl bg-bg-tertiary border border-border-subtle hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isSaving}
              className="px-5 py-2 text-xs font-semibold rounded-xl bg-accent text-accent-foreground hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 shadow-md"
            >
              {isSaving ? "Saving..." : "Save Avatar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AvatarPickerModal;
