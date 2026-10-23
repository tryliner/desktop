import { useState, useId } from "react";
import { CloseLine } from "@mingcute/react";
import { validateProfile, HANDLE_MAX_LENGTH, BIO_MAX_LENGTH } from "../validation";
import type { UserProfileModel } from "../types";

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfileModel;
  onSave: (patch: {
    handle?: string;
    displayName?: string;
    bio?: string;
  }) => Promise<any>;
  isSaving: boolean;
}

export function EditProfileModal({
  isOpen,
  onClose,
  profile,
  onSave,
  isSaving,
}: EditProfileModalProps) {
  const titleId = useId();
  const [handle, setHandle] = useState(profile.handle || profile.username || "");
  const [displayName, setDisplayName] = useState(profile.displayName || "");
  const [bio, setBio] = useState(profile.bio || "");
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (!isOpen) return null;

  const validation = validateProfile({ handle, bio, displayName });
  const isFormValid = validation.valid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!isFormValid) {
      setSubmitError(validation.errors[0] || "Please resolve form validation errors");
      return;
    }

    try {
      await onSave({
        handle: handle.trim(),
        displayName: displayName.trim() || undefined,
        bio: bio.trim(),
      });
      onClose();
    } catch (err: any) {
      setSubmitError(err?.message || "Failed to update profile");
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
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
          <h2 id={titleId} className="text-base font-semibold text-text-primary">
            Edit Profile
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

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {submitError && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
              {submitError}
            </div>
          )}

          {/* Handle Field */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
              Handle / Username
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3 text-text-secondary font-mono text-sm pointer-events-none">
                @
              </span>
              <input
                type="text"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                maxLength={HANDLE_MAX_LENGTH + 5}
                placeholder="username"
                className={`w-full pl-8 pr-3 py-2 rounded-xl bg-bg-tertiary border text-sm text-text-primary placeholder:text-text-secondary/40 focus:outline-none transition-all ${
                  validation.fieldErrors.handle
                    ? "border-red-500/50 focus:border-red-500"
                    : "border-border-subtle focus:border-accent"
                }`}
              />
            </div>
            {validation.fieldErrors.handle ? (
              <p className="text-[11px] text-red-400 mt-1">
                {validation.fieldErrors.handle}
              </p>
            ) : (
              <p className="text-[11px] text-text-secondary/70 mt-1">
                3 to 30 characters, alphanumeric and underscore only.
              </p>
            )}
          </div>

          {/* Display Name Field */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={50}
              placeholder="Your Name"
              className="w-full px-3 py-2 rounded-xl bg-bg-tertiary border border-border-subtle text-sm text-text-primary placeholder:text-text-secondary/40 focus:outline-none focus:border-accent transition-all"
            />
          </div>

          {/* Bio Field */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider">
                Bio
              </label>
              <span
                className={`text-[11px] font-mono ${
                  bio.length > BIO_MAX_LENGTH
                    ? "text-red-400 font-bold"
                    : "text-text-secondary/70"
                }`}
              >
                {bio.length}/{BIO_MAX_LENGTH}
              </span>
            </div>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              placeholder="Tell listeners about yourself..."
              className={`w-full p-3 rounded-xl bg-bg-tertiary border text-sm text-text-primary placeholder:text-text-secondary/40 focus:outline-none transition-all resize-none ${
                validation.fieldErrors.bio
                  ? "border-red-500/50 focus:border-red-500"
                  : "border-border-subtle focus:border-accent"
              }`}
            />
            {validation.fieldErrors.bio && (
              <p className="text-[11px] text-red-400 mt-1">
                {validation.fieldErrors.bio}
              </p>
            )}
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
              type="submit"
              disabled={!isFormValid || isSaving}
              className="px-5 py-2 text-xs font-semibold rounded-xl bg-accent text-accent-foreground hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none shadow-md"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditProfileModal;
