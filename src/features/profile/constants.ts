import type { AvatarPreset, UserProfileModel } from "./types";

export const PROFILE_CACHE_KEY = "liner_user_profile_cache";
export const PROFILE_STORAGE_KEY = "liner_user_profile";

export const PRESET_AVATARS: AvatarPreset[] = [
  {
    id: "preset_1",
    name: "Synthwave",
    url: "https://assets.liner.fun/avatars/preset_1.png",
    accentColor: "#ec4899",
  },
  {
    id: "preset_2",
    name: "Sunset",
    url: "https://assets.liner.fun/avatars/preset_2.png",
    accentColor: "#f97316",
  },
  {
    id: "preset_3",
    name: "Emerald",
    url: "https://assets.liner.fun/avatars/preset_3.png",
    accentColor: "#10b981",
  },
  {
    id: "preset_4",
    name: "Violet",
    url: "https://assets.liner.fun/avatars/preset_4.png",
    accentColor: "#8b5cf6",
  },
  {
    id: "preset_5",
    name: "Vinyl",
    url: "https://assets.liner.fun/avatars/preset_5.png",
    accentColor: "#eab308",
  },
  {
    id: "preset_6",
    name: "Aurora",
    url: "https://assets.liner.fun/avatars/preset_6.png",
    accentColor: "#06b6d4",
  },
];

export const GUEST_PROFILE: UserProfileModel = {
  id: "guest",
  handle: "guest",
  username: "Guest Listener",
  displayName: "Guest Listener",
  bio: "Sign in to save your profile and track listening statistics.",
  avatarUrl: "/default-avatar.png",
  createdAt: "2026-01-01T00:00:00Z",
  isGuest: true,
  isPublic: false,
};
