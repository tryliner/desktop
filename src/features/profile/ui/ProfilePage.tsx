import { useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useProfileViewModel } from "../hooks/useProfileViewModel";
import { ProfileHeader } from "./ProfileHeader";
import { ProfileTabs } from "./ProfileTabs";
import { ProfilePlaylistsTab } from "./ProfilePlaylistsTab";
import { ProfileStatsTab } from "./ProfileStatsTab";
import { ProfileHistoryTab } from "./ProfileHistoryTab";
import { EditProfileModal } from "./EditProfileModal";
import { AvatarPickerModal } from "./AvatarPickerModal";
import { GuestProfileBanner } from "./GuestProfileBanner";
import { ProfilePageSkeleton } from "./ProfilePageSkeleton";

export function ProfilePage() {
  const { idOrUsername } = useParams<{ idOrUsername?: string }>();
  const {
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
  } = useProfileViewModel(idOrUsername);

  if (isLoading) {
    return <ProfilePageSkeleton />;
  }

  if (error && !profile) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <h2 className="text-xl font-bold text-text-primary mb-2">Profile Not Found</h2>
        <p className="text-sm text-text-secondary max-w-sm mb-4">
          The requested profile could not be loaded or does not exist.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto min-h-0 bg-transparent">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {isGuest && <GuestProfileBanner />}

        <ProfileHeader
          profile={profile}
          stats={stats}
          playlistsCount={playlists.length}
          isOwner={isOwner}
          isGuest={isGuest}
          isFollowing={isFollowing}
          onEditClick={() => setEditModalOpen(true)}
          onAvatarClick={() => setAvatarModalOpen(true)}
          onShareClick={shareProfile}
          onToggleFollow={toggleFollow}
        />

        <ProfileTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          playlistsCount={playlists.length}
          historyCount={history.length}
        />

        <div className="mt-2 min-h-[300px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
            >
              {activeTab === "playlists" && (
                <ProfilePlaylistsTab
                  playlists={playlists}
                  isOwner={isOwner}
                  isGuest={isGuest}
                  ownerDisplayName={profile.displayName || profile.username}
                />
              )}

              {activeTab === "stats" && (
                <ProfileStatsTab stats={stats} />
              )}

              {activeTab === "history" && (
                <ProfileHistoryTab history={history} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Edit Profile Modal */}
      <EditProfileModal
        isOpen={isEditModalOpen}
        onClose={() => setEditModalOpen(false)}
        profile={profile}
        onSave={saveProfile}
        isSaving={isSaving}
      />

      {/* Avatar Picker Modal */}
      <AvatarPickerModal
        isOpen={isAvatarModalOpen}
        onClose={() => setAvatarModalOpen(false)}
        currentAvatarUrl={profile.avatarUrl}
        onSave={saveProfile}
        isSaving={isSaving}
      />
    </div>
  );
}

export default ProfilePage;
