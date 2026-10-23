import ProfilePage from "./ui/ProfilePage";
export { ProfilePage };
export default ProfilePage;

export { ProfileHeader } from "./ui/ProfileHeader";
export { ProfileTabs } from "./ui/ProfileTabs";
export { ProfilePlaylistsTab } from "./ui/ProfilePlaylistsTab";
export { ProfileStatsTab } from "./ui/ProfileStatsTab";
export { ProfileHistoryTab } from "./ui/ProfileHistoryTab";
export { EditProfileModal } from "./ui/EditProfileModal";
export { AvatarPickerModal } from "./ui/AvatarPickerModal";
export { GuestProfileBanner } from "./ui/GuestProfileBanner";
export { ProfilePageSkeleton } from "./ui/ProfilePageSkeleton";

export { useProfileViewModel, type ProfileTab, type ProfilePlaylistItem } from "./hooks/useProfileViewModel";
export { computeListeningStats, formatListeningHours, extractArtistName } from "./stats";
export { validateProfile, sanitizeBio, HANDLE_REGEX, BIO_MAX_LENGTH } from "./validation";
export { readImageFileAsDataUrl, MAX_AVATAR_BYTES } from "./upload";
export { buildProfileShareUrl, copyProfileShareLink, type ProfileShareMode } from "./share";
export { PRESET_AVATARS, GUEST_PROFILE, PROFILE_CACHE_KEY, PROFILE_STORAGE_KEY } from "./constants";
export type {
  UserProfileModel,
  UserListeningStats,
  TopTrackItem,
  TopArtistItem,
  AvatarPreset,
  ProfileValidationResult,
  ComputeStatsOptions,
} from "./types";
