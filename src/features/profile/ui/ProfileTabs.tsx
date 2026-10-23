import type { ProfileTab } from "../hooks/useProfileViewModel";

interface ProfileTabsProps {
  activeTab: ProfileTab;
  onTabChange: (tab: ProfileTab) => void;
  playlistsCount: number;
  historyCount: number;
}

export function ProfileTabs({
  activeTab,
  onTabChange,
  playlistsCount,
  historyCount,
}: ProfileTabsProps) {
  const tabs: Array<{ id: ProfileTab; label: string; badge?: number }> = [
    { id: "playlists", label: "Playlists", badge: playlistsCount },
    { id: "stats", label: "Listening Stats" },
    { id: "history", label: "History", badge: historyCount },
  ];

  return (
    <div
      role="tablist"
      aria-label="Profile Sections"
      className="flex items-center gap-2 border-b border-border-subtle pt-4 pb-2"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onTabChange(tab.id)}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
              isActive
                ? "bg-bg-tertiary text-text-primary shadow-sm"
                : "text-text-secondary hover:text-text-primary hover:bg-bg-hover/50"
            }`}
          >
            <span>{tab.label}</span>
            {tab.badge !== undefined && tab.badge > 0 && (
              <span
                className={`px-1.5 py-0.2 text-[10px] rounded-full font-mono ${
                  isActive
                    ? "bg-bg-primary text-text-primary border border-border-subtle"
                    : "bg-bg-secondary text-text-secondary"
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default ProfileTabs;
