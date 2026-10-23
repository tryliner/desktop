# Original User Request

## 2026-10-22T20:35:00Z

Major multi-feature evolution of the Liner desktop music player (https://github.com/tryliner/desktop) delivering Spotify playlist integration, a rich user profile system, enhanced Windows desktop integration, dynamic lyrics/visualizer, and offline audio caching.

Working directory: C:\Users\ahmed\.gemini\antigravity\scratch\liner-desktop
Integrity mode: development

## Requirements

### R1. Spotify Playlist Integration
Provide a hybrid Spotify import experience: allow users to connect their Spotify account via OAuth to browse and import private/public playlists directly into their Liner library, and provide instant import of public Spotify playlists via URL or playlist ID with metadata and track resolution.

### R2. User Profile System
Implement a full-featured `/profile` page and state model. Include user avatar display and customization, username/handle, bio editing, user listening statistics (top tracks, hours listened, favorite artists), created playlists, and public profile sharing.

### R3. Windows Desktop Experience & Controls
Integrate Windows System Media Transport Controls (SMTC) and global keyboard media shortcuts via Electron IPC so play, pause, skip, and metadata update natively in Windows overlays and taskbar thumbnail previews.

### R4. Dynamic Lyrics & Audio Visualizer
Implement synced dynamic lyrics rendering that highlights lines in real time matched to track timestamps, alongside an interactive audio visualizer reacting to playback frequencies.

### R5. Offline Audio Cache & Storage
Provide local audio caching for streamed tracks with configurable disk storage limits, offline playback capability when disconnected, and a cache management UI in settings.

## Acceptance Criteria

### Functionality & Integration
- [ ] Spotify import service fetches and normalizes playlist items (title, artist, album art, duration) from both OAuth-authenticated user accounts and direct public URLs.
- [ ] `/profile` route renders user profile details, editable fields with input validation, listening stats summary, and user playlist collections.
- [ ] Profile state updates persist across app restarts using local storage and auth store sync.
- [ ] Electron main-to-renderer bridge registers and responds to Windows media transport control events (play, pause, next, previous) and updates system track metadata.
- [ ] Dynamic lyrics component parses synced LRC timestamps and updates active line smoothly during playback.
- [ ] Offline audio cache stores downloaded track audio, honors cache size caps, and permits offline playback when network connectivity is lost.

### Quality & Verification
- [ ] Unit & integration test suites run via `pnpm test` / `vitest run` and pass with 0 failures.
- [ ] TypeScript typecheck passes cleanly with `pnpm build` (`tsc -b && vite build`) with zero diagnostic errors.
- [ ] Accessibility review confirms keyboard navigation and ARIA attributes for new modal dialogs, profile forms, and media controls.


## Follow-up — 2026-10-23T09:37:36Z

Server restarted. Please resume execution of project milestones from current state. Complete M2 Gate evaluation if pending, and advance through M3, M4, M5, M6 according to PROJECT.md. Keep me updated.
