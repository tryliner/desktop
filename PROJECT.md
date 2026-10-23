# Project: Liner Desktop Music Player Evolution

## Architecture
- **Desktop Shell**: Electron 44 with isolated context bridge (`window.linerElectron`), managing native Windows window framing, deep links (`liner://`), global media shortcuts, taskbar thumbar controls, and disk cache stats.
- **Renderer UI**: React 19 + React Router v7 (`HashRouter`) + Tailwind CSS 4 + Framer Motion. Main layout in `<AppFrame>` with `<Sidebar>`, `<MiniPlayer>`, and `<FullscreenPlayer>`.
- **State Management**: Zustand v5 stores (`playerStore`, `authStore`, `lyricsStore`, `connectivityStore`, `modalStore`) with local storage persistence and IPC synchronization.
- **Audio Engine**: Singleton `playerEngine` dispatching playback intent; `playerRuntime` operating `<audio id="liner-audio">` with IndexedDB blob caching and stream resolution; `pitchShifter` hosting Web Audio API `AudioContext` graph (`masterOutputGain`).
- **Storage Subsystem**: IndexedDB `liner_db_v1` (`audioCache.ts`, `linerDb.ts`) providing local blob caching, LRU quota enforcement, and offline audio playback.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Spotify OAuth PKCE Flow | RFC 7636 PKCE auth flow for user accounts with deep link callback (`liner://spotify-callback`) | M1_SPOTIFY | ORIGINAL_REQUEST §R1 |
| 2 | Spotify User Playlists Import | Fetch and browse private/public playlists from `/v1/me/playlists` and import into library | M1_SPOTIFY | ORIGINAL_REQUEST §R1 |
| 3 | Public Spotify URL & ID Import | Fast import and resolution of public playlists via URL or bare ID | M1_SPOTIFY | ORIGINAL_REQUEST §R1 |
| 4 | Spotify Track Normalization | Normalize imported Spotify tracks (title, artists, album, duration, artwork, ISRC) | M1_SPOTIFY | ORIGINAL_REQUEST §R1 |
| 5 | User Profile Route & View | Full `/profile` page rendering user identity, bio, created playlists, and share link | M2_PROFILE | ORIGINAL_REQUEST §R2 |
| 6 | User Listening Statistics | Calculate total listening hours, top tracks, and favorite artists from playback history | M2_PROFILE | ORIGINAL_REQUEST §R2 |
| 7 | Profile Customization & Avatars | Avatar customization (presets / image upload), bio editing, and validation | M2_PROFILE | ORIGINAL_REQUEST §R2 |
| 8 | Profile Persistence & Sync | Persist profile updates across app restarts via `authStore` and local storage | M2_PROFILE | ORIGINAL_REQUEST §R2 |
| 9 | Electron Global Media Shortcuts | Register hardware media keys (`MediaPlayPause`, `MediaNextTrack`, etc.) via `globalShortcut` | M3_WINDOWS | ORIGINAL_REQUEST §R3 |
| 10 | Windows SMTC IPC Bridge | Electron IPC bridge updating system media transport controls metadata and playback state | M3_WINDOWS | ORIGINAL_REQUEST §R3 |
| 11 | Windows Taskbar & Thumbar Sync | Synchronize taskbar thumbnail buttons, tooltip, and overlay icons with playback state | M3_WINDOWS | ORIGINAL_REQUEST §R3 |
| 12 | Synced LRC Lyrics Rendering | Parse and render synced LRC lines with real-time active line highlighting and smooth scroll | M4_LYRICS_VIS | ORIGINAL_REQUEST §R4 |
| 13 | Interactive Audio Visualizer | Web Audio `AnalyserNode` connected to `masterOutputGain` driving reactive canvas visualizer | M4_LYRICS_VIS | ORIGINAL_REQUEST §R4 |
| 14 | Offline Audio Playback | Stream resolution fallback to local cached audio blobs when disconnected | M5_OFFLINE | ORIGINAL_REQUEST §R5 |
| 15 | Audio Download Management | Explicit download capability for offline tracks/playlists with status indicators | M5_OFFLINE | ORIGINAL_REQUEST §R5 |
| 16 | Storage Quota & Cache UI | Settings UI for managing audio storage limits, viewing cached tracks, and pruning | M5_OFFLINE | ORIGINAL_REQUEST §R5 |
| 17 | E2E Opaque-Box Test Suite | Comprehensive 4-tier test suite covering R1-R5 user journeys independently | M0_TEST | ORIGINAL_REQUEST Acceptance |
| 18 | Final Integration & Gate Verification | 100% E2E test pass + typecheck + adversarial coverage hardening (Tier 5) | M6_FINAL | ORIGINAL_REQUEST Acceptance |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 0 | M0_TEST | E2E Testing Track: 4-tier test harness, runners, and suites for R1-R5 | none | DONE |
| 1 | M1_SPOTIFY | R1: Spotify OAuth PKCE, user playlist browsing, public URL/ID import | none | DONE |
| 2 | M2_PROFILE | R2: `/profile` route, user stats calculation, avatar customization, persistence | none | DONE |
| 3 | M3_WINDOWS | R3: Windows SMTC IPC bridge, global media shortcuts, taskbar sync | none | DONE |
| 4 | M4_LYRICS_VIS | R4: LRC parser & synced line renderer, AnalyserNode audio visualizer | none | IN_PROGRESS |
| 5 | M5_OFFLINE | R5: Offline stream fallback, download manager, storage quota & settings UI | none | PLANNED |
| 6 | M6_FINAL | Final Integration: Pass 100% E2E tests (Tiers 1-4) + Tier 5 adversarial hardening | M0_TEST, M1, M2, M3, M4, M5 | PLANNED |

## Interface Contracts

### Spotify Integration (`src/features/library/services/import/sources/spotify/`)
```ts
export interface SpotifyOAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope: string;
  tokenType: string;
}

export interface SpotifyOAuthClient {
  generateAuthorizeUrl(): Promise<{ url: string; codeVerifier: string }>;
  exchangeCode(code: string, codeVerifier: string): Promise<SpotifyOAuthTokens>;
  refreshTokens(refreshToken: string): Promise<SpotifyOAuthTokens>;
  getUserPlaylists(accessToken: string): Promise<SpotifyUserPlaylistSummary[]>;
}

export interface SpotifyUserPlaylistSummary {
  id: string;
  name: string;
  description: string | null;
  images: { url: string }[];
  tracksCount: number;
  isPublic: boolean;
  ownerName: string;
  spotifyUrl: string;
}
```

### Profile & Stats (`src/features/profile/`)
```ts
export interface UserListeningStats {
  totalHoursListened: number;
  totalTracksPlayed: number;
  topTracks: Array<{ track: Track; playCount: number; totalPlayedMs: number }>;
  topArtists: Array<{ artistName: string; playCount: number }>;
  calculatedAt: string;
}

export function computeListeningStats(history: PlaybackHistoryItem[]): UserListeningStats;
```

### Windows Media Desktop IPC (`electron/main.ts` ↔ `electron/preload.ts` ↔ `src/features/player/`)
```ts
// Renderer -> Main
"desktop:media-update": (payload: {
  status: "playing" | "paused" | "loading" | "idle";
  track: { id: string; title: string; artists: string; coverUrl?: string; durationMs: number } | null;
  positionMs: number;
  durationMs: number;
}) => void;

// Main -> Renderer
"desktop:media-action": (action: "play" | "pause" | "togglePlay" | "next" | "prev" | "stop") => void;
```

### Visualizer & Lyrics (`src/features/lyrics/` & `src/features/player/`)
```ts
export interface SyncedLrcLine {
  id: string;
  timeMs: number;
  durationMs?: number;
  text: string;
}

export interface AudioVisualizerNode {
  analyser: AnalyserNode;
  getFrequencyData(): Uint8Array;
}
```

### Offline Audio Storage (`src/shared/storage/`)
```ts
export interface OfflineAudioService {
  isOffline(): boolean;
  hasCachedAudio(trackId: string): Promise<boolean>;
  downloadTrackForOffline(track: Track): Promise<void>;
  getCachedTracksCount(): Promise<number>;
  clearOfflineCache(): Promise<void>;
}
```

## Code Layout
- `electron/`: Main process (`main.ts`, `thumbar.ts`, `overlay.ts`, `deeplink.ts`, `mediaShortcuts.ts`)
- `electron/preload.ts`: Preload bridge exposing `window.linerElectron`
- `src/app/`: App root, router (`routes.tsx`), layout providers
- `src/features/auth/`: Auth store and session persistence
- `src/features/profile/`: `/profile` route, profile page, stats calculation, avatar picker
- `src/features/library/services/import/sources/spotify/`: Spotify OAuth, public scraper, Pathfinder
- `src/features/player/`: Player engine, player runtime, pitch shifter, audio visualizer, SMTC hooks
- `src/features/lyrics/`: LRC parser, synced lyrics renderer, lyrics store
- `src/features/settings/ui/tabs/StorageTab.tsx`: Cache storage management UI
- `src/shared/storage/`: IndexedDB database (`linerDb.ts`), blob cache (`audioCache.ts`), offline service
- `src/shared/contracts/`: Shared domain contracts
- `tests/e2e/`: E2E opaque-box test suites (Tiers 1-4)
