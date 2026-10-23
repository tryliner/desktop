import { UserAvatar } from "@/shared/ui/UserAvatar";
import { formatListeningHours } from "../stats";
import type { UserProfileModel, UserListeningStats } from "../types";
import {
  LinkLine,
  User3Fill,
} from "@mingcute/react";

interface ProfileHeaderProps {
  profile: UserProfileModel;
  stats: UserListeningStats;
  playlistsCount: number;
  isOwner: boolean;
  isGuest: boolean;
  isFollowing?: boolean;
  onEditClick: () => void;
  onAvatarClick: () => void;
  onShareClick: () => void;
  onToggleFollow?: () => void;
}

export function ProfileHeader({
  profile,
  stats,
  playlistsCount,
  isOwner,
  isGuest,
  isFollowing,
  onEditClick,
  onAvatarClick,
  onShareClick,
  onToggleFollow,
}: ProfileHeaderProps) {
  const avatarUser = {
    avatarUrl: profile.avatarUrl || undefined,
    displayName: profile.displayName || undefined,
    username: profile.username || profile.handle,
  };

  return (
    <div className="w-full flex flex-col md:flex-row items-center md:items-start gap-6 pb-6 border-b border-border-subtle">
      {/* Avatar Container */}
      <div className="relative group shrink-0">
        <div
          onClick={isOwner && !isGuest ? onAvatarClick : undefined}
          className={`relative rounded-full overflow-hidden shadow-lg ${
            isOwner && !isGuest
              ? "cursor-pointer ring-2 ring-transparent hover:ring-accent transition-all duration-200"
              : ""
          }`}
          title={isOwner && !isGuest ? "Change avatar" : undefined}
          role={isOwner && !isGuest ? "button" : undefined}
          aria-label={isOwner && !isGuest ? "Change avatar" : undefined}
        >
          <UserAvatar user={avatarUser} size={96} className="w-24 h-24 text-2xl font-semibold" />
          {isOwner && !isGuest && (
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white text-[10px] font-medium transition-opacity duration-150">
              <span>Change</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Info */}
      <div className="flex-1 flex flex-col items-center md:items-start text-center md:text-left min-w-0">
        <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
          <h1 className="text-2xl font-bold text-text-primary tracking-tight truncate max-w-[320px]">
            {profile.displayName || profile.username || "Listener"}
          </h1>
          {profile.isGuest && (
            <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
              Guest
            </span>
          )}
        </div>

        <p className="text-sm text-text-secondary mt-0.5 font-mono">
          @{profile.handle || profile.username || "listener"}
        </p>

        {profile.bio ? (
          <p className="text-sm text-text-secondary/90 mt-2.5 max-w-xl whitespace-pre-wrap break-words leading-relaxed">
            {profile.bio}
          </p>
        ) : (
          <p className="text-xs text-text-secondary/60 italic mt-2">
            No bio provided yet.
          </p>
        )}

        {/* Stats Summary Pills */}
        <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5 mt-4">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-bg-tertiary border border-border-subtle text-xs text-text-secondary">
            <span className="font-semibold text-text-primary">
              {formatListeningHours(stats.totalHoursListened)}
            </span>
            <span>listened</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-bg-tertiary border border-border-subtle text-xs text-text-secondary">
            <span className="font-semibold text-text-primary">
              {stats.totalTracksPlayed}
            </span>
            <span>plays</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-bg-tertiary border border-border-subtle text-xs text-text-secondary">
            <span className="font-semibold text-text-primary">
              {playlistsCount}
            </span>
            <span>playlists</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2.5 shrink-0 pt-2">
        {isOwner && !isGuest && (
          <button
            type="button"
            onClick={onEditClick}
            className="px-4 py-2 text-xs font-medium rounded-lg bg-bg-tertiary border border-border-subtle hover:bg-bg-hover active:scale-95 text-text-primary transition-all flex items-center gap-1.5 shadow-sm"
          >
            <span>Edit Profile</span>
          </button>
        )}

        {!isOwner && (
          <button
            type="button"
            onClick={onToggleFollow}
            className={`px-4 py-2 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 shadow-sm active:scale-95 ${
              isFollowing
                ? "bg-bg-tertiary border border-border-subtle text-text-primary hover:bg-bg-hover"
                : "bg-accent text-accent-foreground hover:opacity-90"
            }`}
          >
            <User3Fill size={14} />
            <span>{isFollowing ? "Following" : "Follow"}</span>
          </button>
        )}

        <button
          type="button"
          onClick={onShareClick}
          aria-label="Share profile"
          className="p-2 rounded-lg bg-bg-tertiary border border-border-subtle hover:bg-bg-hover active:scale-95 text-text-secondary hover:text-text-primary transition-all shadow-sm"
          title="Share profile link"
        >
          <LinkLine size={16} />
        </button>
      </div>
    </div>
  );
}

export default ProfileHeader;
