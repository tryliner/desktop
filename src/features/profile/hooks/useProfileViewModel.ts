import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuthStore } from "@/features/auth/store/authStore";
import { api } from "@/shared/api";
import { useToast } from "@/shared/ui";
import { useTranslation } from "@/languages";
import { usePlaylistsList } from "@/features/library/hooks/usePlaylists";
import { useExternalItems } from "@/features/library/hooks/useExternalItems";
import type { PlaybackHistoryItem } from "@/shared/contracts/history";
import type { UserProfile } from "@/shared/contracts/users";
import type { UserPlaylist } from "@/shared/contracts/playlists";
import {
  PROFILE_CACHE_KEY,
  PROFILE_STORAGE_KEY,
  GUEST_PROFILE,
} from "../constants";
import { validateProfile, sanitizeBio } from "../validation";
import { computeListeningStats } from "../stats";
import { copyProfileShareLink } from "../share";
import type { UserProfileModel, UserListeningStats } from "../types";

export type ProfileTab = "playlists" | "stats" | "history";

export interface ProfilePlaylistItem {
  id: string;
  title: string;
  description?: string;
  coverUrl?: string;
  coverUrls?: string[];
  trackCount: number;
  source?: "local" | "spotify";
  originalSpotifyUrl?: string;
  isPublic?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export function useProfileViewModel(idOrUsername?: string) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const authUser = useAuthStore((s) => s.user);
  const updateAuthProfile = useAuthStore((s) => s.updateProfile);

  const [activeTab, setActiveTab] = useState<ProfileTab>("playlists");
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [isAvatarModalOpen, setAvatarModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Determine if viewing own profile
  const isOwner = useMemo(() => {
    if (!idOrUsername || idOrUsername === "me") return true;
    if (!authUser) return false;
    const target = idOrUsername.toLowerCase();
    const currentId = authUser.id?.toLowerCase();
    const currentUsername = authUser.username?.toLowerCase();
    return target === currentId || target === currentUsername;
  }, [idOrUsername, authUser]);

  // Determine if guest viewer
  const isGuest = useMemo(() => {
    return isOwner && !authUser;
  }, [isOwner, authUser]);

  // Public user fetched state when !isOwner
  const [publicUser, setPublicUser] = useState<UserProfile | null>(null);
  const [publicPlaylists, setPublicPlaylists] = useState<ProfilePlaylistItem[]>([]);
  const [publicHistory, setPublicHistory] = useState<PlaybackHistoryItem[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);

  // Playlists for owner
  const { data: libraryPlaylistsData } = usePlaylistsList();
  const { data: externalPlaylists = [] } = useExternalItems("playlist");

  // Read local playback history from localStorage
  const localHistory: PlaybackHistoryItem[] = useMemo(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem("liner_playback_history");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  }, []);

  // Fetch public user if !isOwner
  useEffect(() => {
    if (!isOwner && idOrUsername) {
      let isCancelled = false;
      setIsLoading(true);
      setError(null);

      Promise.all([
        api.getUserProfile(idOrUsername).catch(() => null),
        api.getUserPlaylists(idOrUsername).catch(() => ({ items: [] })),
        api.getUserHistory(idOrUsername).catch(() => ({ items: [] })),
      ])
        .then(([userRes, plRes, histRes]) => {
          if (isCancelled) return;
          if (userRes) {
            setPublicUser(userRes);
            setIsFollowing(Boolean(userRes.isFollowing));
          } else {
            setError("User not found");
          }

          if (plRes && Array.isArray(plRes.items)) {
            const mapped: ProfilePlaylistItem[] = plRes.items.map((p) => ({
              id: p.id,
              title: p.title,
              description: p.description,
              coverUrl: (p as any).coverUrl,
              trackCount: (p as any).trackCount ?? 0,
              source: "local",
              isPublic: p.isPublic,
              createdAt: p.createdAt,
              updatedAt: p.updatedAt,
            }));
            setPublicPlaylists(mapped);
          }

          if (histRes && Array.isArray(histRes.items)) {
            setPublicHistory(histRes.items as PlaybackHistoryItem[]);
          }
        })
        .catch((err) => {
          if (!isCancelled) {
            setError(err?.message || "Failed to load user profile");
          }
        })
        .finally(() => {
          if (!isCancelled) setIsLoading(false);
        });

      return () => {
        isCancelled = true;
      };
    }
  }, [isOwner, idOrUsername]);

  // Construct active profile model
  const profile: UserProfileModel = useMemo(() => {
    if (isOwner) {
      if (!authUser) {
        // Try reading stored profile cache first
        if (typeof window !== "undefined") {
          try {
            const cached =
              localStorage.getItem(PROFILE_STORAGE_KEY) ||
              localStorage.getItem(PROFILE_CACHE_KEY);
            if (cached) {
              const parsed = JSON.parse(cached);
              if (parsed && typeof parsed === "object" && parsed.id) {
                return {
                  ...GUEST_PROFILE,
                  ...parsed,
                  isGuest: parsed.id === "guest",
                };
              }
            }
          } catch {}
        }
        return GUEST_PROFILE;
      }

      // Check if custom profile data exists in local storage cache
      let cachedOverride: Partial<UserProfileModel> = {};
      if (typeof window !== "undefined") {
        try {
          const cached =
            localStorage.getItem(PROFILE_STORAGE_KEY) ||
            localStorage.getItem(PROFILE_CACHE_KEY);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed && parsed.id === authUser.id) {
              cachedOverride = parsed;
            }
          }
        } catch {}
      }

      return {
        id: authUser.id,
        username: cachedOverride.handle || cachedOverride.username || authUser.username || "user",
        handle: cachedOverride.handle || authUser.username || "user",
        displayName: cachedOverride.displayName !== undefined ? cachedOverride.displayName : (authUser.displayName || authUser.username),
        bio: cachedOverride.bio !== undefined ? cachedOverride.bio : (authUser.bio || ""),
        avatarUrl: cachedOverride.avatarUrl || authUser.avatarUrl || "/default-avatar.png",
        createdAt: (authUser as any).createdAt || "2026-01-01T00:00:00Z",
        isGuest: false,
        isPublic: authUser.isPublic ?? true,
      };
    }

    // Public user
    if (publicUser) {
      return {
        id: publicUser.id,
        username: publicUser.username || "user",
        handle: publicUser.username || "user",
        displayName: publicUser.displayName || publicUser.username,
        bio: publicUser.bio || "",
        avatarUrl: publicUser.avatarUrl || "/default-avatar.png",
        createdAt: publicUser.createdAt || "2026-01-01T00:00:00Z",
        isGuest: false,
        isPublic: publicUser.isPublic ?? true,
      };
    }

    return GUEST_PROFILE;
  }, [isOwner, authUser, publicUser]);

  // Aggregate playlists (local + Spotify imported for XF-6)
  const playlists: ProfilePlaylistItem[] = useMemo(() => {
    if (!isOwner) {
      return publicPlaylists;
    }

    const result: ProfilePlaylistItem[] = [];

    // Local library playlists
    if (libraryPlaylistsData?.playlists) {
      for (const pl of libraryPlaylistsData.playlists) {
        result.push({
          id: pl.id,
          title: pl.title,
          description: pl.description,
          coverUrl: pl.coverUrl,
          coverUrls: pl.coverUrls,
          trackCount: pl.trackCount,
          source: (pl as any).source === "spotify" ? "spotify" : "local",
          originalSpotifyUrl: (pl as any).originalSpotifyUrl,
          createdAt: pl.createdAt,
          updatedAt: pl.updatedAt,
        });
      }
    }

    // Spotify external playlists
    for (const ext of externalPlaylists) {
      if (ext.kind === "playlist" && !result.some((r) => r.id === ext.id)) {
        result.push({
          id: ext.id,
          title: ext.title,
          description: ext.subtitle,
          coverUrl: ext.imageUrl,
          coverUrls: ext.coverUrls,
          trackCount: 0,
          source: "spotify",
          originalSpotifyUrl: (ext as any).originalSpotifyUrl || (ext as any).spotifyUrl,
          createdAt: ext.addedAt,
        });
      }
    }

    return result;
  }, [isOwner, publicPlaylists, libraryPlaylistsData, externalPlaylists]);

  // Playback history
  const history: PlaybackHistoryItem[] = useMemo(() => {
    if (!isOwner) return publicHistory;
    return localHistory;
  }, [isOwner, publicHistory, localHistory]);

  // Listening stats calculated from history
  const stats: UserListeningStats = useMemo(() => {
    return computeListeningStats(history);
  }, [history]);

  // Profile save action with validation & error rollback
  const saveProfile = useCallback(
    async (patch: {
      handle?: string;
      displayName?: string;
      bio?: string;
      avatarUrl?: string;
    }) => {
      const handleToValidate = patch.handle ?? profile.handle;
      const bioToValidate = patch.bio !== undefined ? patch.bio : profile.bio;

      const validation = validateProfile({
        handle: handleToValidate,
        bio: bioToValidate,
      });

      if (!validation.valid) {
        const firstError = validation.errors[0] || "Invalid profile data";
        toast(firstError, "error");
        throw new Error(firstError);
      }

      const sanitizedBio = patch.bio !== undefined ? sanitizeBio(patch.bio) : undefined;
      const sanitizedHandle = handleToValidate.trim();

      setIsSaving(true);
      try {
        let updatedUser: any = null;
        if (authUser) {
          updatedUser = await updateAuthProfile({
            username: sanitizedHandle,
            displayName: patch.displayName,
            bio: sanitizedBio,
            avatarUrl: patch.avatarUrl,
          });
        }

        const updatedModel: UserProfileModel = {
          ...profile,
          ...(updatedUser || {}),
          handle: sanitizedHandle,
          username: sanitizedHandle,
          displayName: patch.displayName !== undefined ? patch.displayName : profile.displayName,
          bio: sanitizedBio !== undefined ? sanitizedBio : profile.bio,
          avatarUrl: patch.avatarUrl !== undefined ? patch.avatarUrl : profile.avatarUrl,
        };

        // Cache locally in both keys
        if (typeof window !== "undefined") {
          try {
            const serialized = JSON.stringify(updatedModel);
            localStorage.setItem(PROFILE_STORAGE_KEY, serialized);
            localStorage.setItem(PROFILE_CACHE_KEY, serialized);
          } catch {}
        }

        toast(t("profile.saved_success") || "Profile updated", "checkmark");
        setEditModalOpen(false);
        setAvatarModalOpen(false);
        return updatedModel;
      } catch (err: any) {
        // R2-C4: If remote update fails, DO NOT update local storage or profile
        toast(t("profile.save_failed") || "Failed to update profile", "error", {
          description: err?.message,
        });
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [profile, authUser, updateAuthProfile, toast, t]
  );

  // Share profile
  const shareProfile = useCallback(async () => {
    const handle = profile.handle || profile.username || "listener";
    try {
      const url = await copyProfileShareLink(handle);
      toast(t("common.link_copied") || "Link copied", "checkmark", {
        description: url,
      });
      return url;
    } catch {
      toast("Failed to copy link", "error");
      return null;
    }
  }, [profile, toast, t]);

  // Follow / Unfollow
  const toggleFollow = useCallback(async () => {
    if (!idOrUsername || isOwner) return;
    try {
      if (isFollowing) {
        await api.unfollowUser(idOrUsername);
        setIsFollowing(false);
        toast("Unfollowed user", "checkmark");
      } else {
        await api.followUser(idOrUsername);
        setIsFollowing(true);
        toast("Following user", "checkmark");
      }
    } catch (err: any) {
      toast("Action failed", "error", { description: err?.message });
    }
  }, [idOrUsername, isOwner, isFollowing, toast]);

  return {
    profile,
    isOwner,
    isGuest,
    activeTab,
    setActiveTab,
    playlists,
    stats,
    history,
    isLoading,
    isSaving,
    error,
    isFollowing,
    toggleFollow,
    saveProfile,
    shareProfile,
    isEditModalOpen,
    setEditModalOpen,
    isAvatarModalOpen,
    setAvatarModalOpen,
  };
}
