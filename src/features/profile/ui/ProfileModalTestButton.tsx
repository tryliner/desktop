import { useMemo, useState } from "react";
import { useAuthStore } from "@/features/auth";
import type { PublicUser } from "@/entities/user";
import { useTranslation } from "@/languages";
import type { ProfileCard, ProfileModule } from "../model/types";
import HandPointIcon from "~icons/streamline-pixel/hand-point";
import ProfileModal from "./ProfileModal";
import bannerFixture from "./fixtures/banner.webp";
import avatarFixture from "./fixtures/avatar.webp";
import friendFixture1 from "./fixtures/friend-1.webp";
import friendFixture2 from "./fixtures/friend-2.webp";
import friendFixture3 from "./fixtures/friend-3.webp";
import trackCoverFixture from "./fixtures/track-cover.webp";
import trackGlowFixture from "./fixtures/track-glow.webp";
import artistFixture1 from "./fixtures/artist-1.webp";
import artistFixture2 from "./fixtures/artist-2.webp";
import artistFixture3 from "./fixtures/artist-3.webp";
import artistFixture4 from "./fixtures/artist-4.webp";
import artistFixture5 from "./fixtures/artist-5.webp";
import playlistFixture1 from "./fixtures/playlist-1.webp";
import playlistFixture2 from "./fixtures/playlist-2.webp";

const TEST_FRIENDS = [
  { displayName: "Alex", avatarUrl: friendFixture1 },
  { displayName: "Mira", avatarUrl: friendFixture2 },
  { displayName: "Theo", avatarUrl: friendFixture3 },
];

const TEST_TRACK = {
  title: "Schroom Clouds",
  artist: "A$AP Rocky",
  coverUrl: trackCoverFixture,
};

function testModules(): ProfileModule[] {
  const now = Date.now();
  return [
    {
      kind: "top-tracks",
      tracks: Array.from({ length: 5 }, () => TEST_TRACK),
      listenedMs: (24 * 60 + 12) * 60000,
    },
    {
      kind: "top-artists",
      artists: [
        { name: "Drake", imageUrl: artistFixture1 },
        { name: "Olivia Rodrigo", imageUrl: artistFixture2 },
        { name: "Glaive", imageUrl: artistFixture3 },
        { name: "Yeat", imageUrl: artistFixture4 },
        { name: "Joji", imageUrl: artistFixture5 },
      ],
    },
    {
      kind: "pinned-playlists",
      playlists: [
        {
          title: "Ночная смена",
          coverUrl: playlistFixture1,
          trackCount: 48,
          durationMs: (2 * 60 + 51) * 60000,
        },
        {
          title: "Летнее",
          coverUrl: playlistFixture2,
          trackCount: 12,
          durationMs: 51 * 60000,
        },
      ],
    },
    {
      kind: "recent",
      tracks: [5, 6, 8, 10, 12].map((minutes) => ({
        title: "Objects In The Mirror",
        artist: "Mac Miller",
        coverUrl: trackGlowFixture,
        playedAt: now - minutes * 60000,
      })),
    },
    {
      kind: "on-repeat",
      track: {
        title: "Кусай локти",
        artist: "MAYOT",
        coverUrl: playlistFixture1,
      },
      playCount: 23,
      dailyPlays: [3, 1, 2, 1, 3, 2, 4],
    },
  ];
}

function testProfile(user: PublicUser | null): ProfileCard {
  const username = user?.username ?? "bystraksk";
  return {
    displayName: user?.displayName ?? "bystrak",
    username,
    avatarUrl: user?.avatarUrl || avatarFixture,
    bannerUrl: bannerFixture,
    bio: user?.bio || "Здравствуйте я крутой бла бла бла не пишите мне пж",
    badge: <HandPointIcon width={24} height={24} />,
    nameFont: "medeo-pixel",
    friends: { count: 5, online: 2, preview: TEST_FRIENDS },
    links: { telegram: `@${username}`, discord: `@${username}_` },
    modules: testModules(),
  };
}

export default function ProfileModalTestButton() {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const [open, setOpen] = useState(false);
  const profile = useMemo(() => testProfile(user), [user]);

  return (
    <>
      <button
        type="button"
        aria-label={t("profile.title")}
        onClick={() => setOpen(true)}
        className="flex h-[40px] w-[40px] shrink-0 cursor-pointer overflow-hidden rounded-control border-0 bg-bg-elevated p-0 select-none active:scale-[0.96] transition-transform duration-100"
      >
        <img
          src={profile.avatarUrl ?? undefined}
          alt=""
          className="h-full w-full object-cover"
          draggable={false}
        />
      </button>
      <ProfileModal
        open={open}
        onClose={() => setOpen(false)}
        profile={profile}
        isOwner
      />
    </>
  );
}
