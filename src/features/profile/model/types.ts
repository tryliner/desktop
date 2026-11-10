import type { ReactNode } from "react";
import type { PublicUser } from "@/entities/user";

export type ProfilePerson = Pick<
  PublicUser,
  "displayName" | "username" | "avatarUrl"
>;

export interface ProfileFriends {
  count: number;
  online: number;
  preview: ProfilePerson[];
}

export interface ProfileLinks {
  telegram?: string;
  discord?: string;
}

export type ProfileNameFont =
  | "medeo"
  | "medeo-pixel"
  | "pixelify"
  | "playfair"
  | "barcode"
  | "broken-fax"
  | "comic";

export interface ProfileCard extends ProfilePerson {
  bannerUrl?: string | null;
  nameFont?: ProfileNameFont;
  bio?: string | null;
  badge?: ReactNode;
  friends?: ProfileFriends;
  links?: ProfileLinks;
  modules?: ProfileModule[];
}

export interface ProfileTrack {
  title: string;
  artist: string;
  coverUrl: string;
}

export interface ProfileRecentTrack extends ProfileTrack {
  playedAt: number;
}

export interface ProfileArtist {
  name: string;
  imageUrl: string;
}

export interface ProfilePlaylist {
  title: string;
  coverUrl: string;
  trackCount: number;
  durationMs: number;
}

export type ProfileModule =
  | { kind: "top-tracks"; tracks: ProfileTrack[]; listenedMs: number }
  | { kind: "top-artists"; artists: ProfileArtist[] }
  | { kind: "pinned-playlists"; playlists: ProfilePlaylist[] }
  | { kind: "recent"; tracks: ProfileRecentTrack[] }
  | {
      kind: "on-repeat";
      track: ProfileTrack;
      playCount: number;
      /** plays per weekday, monday first */
      dailyPlays: number[];
    };
