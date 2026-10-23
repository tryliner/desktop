# Liner Desktop E2E Test Infrastructure Specification (TEST_INFRA)

## 1. Executive Summary & Testing Architecture

This document defines the comprehensive end-to-end (E2E) testing infrastructure for the **Liner Desktop Music Player Evolution** (Requirements R1 through R5).

### Testing Philosophy: Opaque-Box & Decoupled Verification
The test suite operates strictly on the **opaque-box paradigm**:
- **Interface-Driven**: Tests assert behavior against documented interface contracts (`PROJECT.md` § Interface Contracts) and user-facing requirements (`ORIGINAL_REQUEST.md`), rather than transient private implementation details.
- **Independent & Isolated**: Each test case provisions its own isolated state, avoids order-dependent side effects, and cleans up after itself.
- **No Facade Testing**: Every test exercises real logic, real data structures, real contract inputs/outputs, and verifiable state transitions.
- **Deterministic Mocking**: Native external dependencies (Spotify OAuth/APIs, Windows SMTC / Electron IPC, Web Audio API context, offline network connectivity) are mocked via dedicated, high-fidelity mock harnesses in `tests/e2e/mocks/`.

---

## 2. Test Suite Directory Structure

```
tests/e2e/
├── mocks/
│   ├── spotifyMock.ts           # Spotify OAuth PKCE, Web API, and URL/ID scraper mock
│   ├── webAudioMock.ts          # Web Audio API AudioContext & AnalyserNode mock for jsdom
│   ├── electronSmtcMock.ts      # Windows SMTC IPC bridge & global keyboard shortcut mock
│   ├── offlineMock.ts           # Online/Offline network state & storage quota mock
│   └── index.ts                 # Central mock harness exports
├── tier1-feature-coverage.test.ts     # Tier 1: Core feature contract coverage (>=5 tests per R1-R5)
├── tier2-boundary-corner.test.ts      # Tier 2: Boundary value analysis & corner cases (>=5 tests per R1-R5)
├── tier3-cross-feature.test.ts        # Tier 3: Pairwise & cross-feature integration
└── tier4-application-scenarios.test.ts # Tier 4: Real-world multi-step user workflows (>=5 scenarios)
```

---

## 3. Four-Tier Opaque-Box Testing Strategy

| Tier | Category | Methodology | Objective | Minimum Count |
|---|---|---|---|---|
| **Tier 1** | Feature Coverage | Category-Partition | Validate core happy-path contracts and primary behavior for R1-R5 | $\ge 5$ tests per feature (25+ total) |
| **Tier 2** | Boundary & Corner Cases | Boundary Value Analysis (BVA) | Validate edge cases, invalid inputs, rate limits, audio disconnects, quota overflow, and network drops | $\ge 5$ tests per feature (25+ total) |
| **Tier 3** | Cross-Feature Combinations | Pairwise Interaction Testing | Validate interoperability between features (e.g. Spotify import + offline caching, Profile stats + playback, SMTC + lyrics) | $\ge 7$ pairwise tests |
| **Tier 4** | Real-World Application Scenarios | Workload & Journey Testing | Validate realistic multi-step user workflows from end to end | $\ge 5$ complex workflows |

---

## 4. Requirements Traceability Matrix

### R1. Spotify Playlist Integration
- **Source**: `ORIGINAL_REQUEST.md` § R1, `PROJECT.md` § Interface Contracts
- **Tier 1**: OAuth PKCE authorize URL generation, authorization code exchange, user playlists fetching (`/v1/me/playlists`), public playlist URL import, track normalization, token refresh.
- **Tier 2**: Empty playlist import (0 tracks), invalid/malformed Spotify URLs, API rate limiting (HTTP 429 with `Retry-After`), OAuth access denial/invalid state, missing track metadata fallbacks.
- **Tier 3**: Spotify playlist import feeding offline audio cache; Spotify track playback updating profile listening statistics; Spotify imported playlist saved to user profile created playlists.
- **Tier 4**: Scenario 1: Complete Spotify Onboarding & Import Journey.

### R2. User Profile System
- **Source**: `ORIGINAL_REQUEST.md` § R2, `PROJECT.md` § Interface Contracts
- **Tier 1**: Profile view data model, listening statistics calculation (total hours, top tracks, favorite artists), profile editing & validation, avatar customization (presets vs URL), persistence across reload.
- **Tier 2**: Zero playback history calculation (zero-division guard), boundary handle lengths/special characters, unauthenticated guest fallback, API update failure recovery, rapid consecutive edits debouncing.
- **Tier 3**: Continuous player playback driving profile statistics; Profile created playlists syncing with library; Profile public share link generation with track list.
- **Tier 4**: Scenario 2: Profile Customization & Statistics Growth.

### R3. Windows Desktop Experience & Controls
- **Source**: `ORIGINAL_REQUEST.md` § R3, `PROJECT.md` § Interface Contracts
- **Tier 1**: SMTC metadata synchronization (`desktop:media-update`), SMTC playback status updates, global media shortcuts registration (`MediaPlayPause`, `MediaNextTrack`, etc.), SMTC action dispatch to player runtime, taskbar thumbar button sync.
- **Tier 2**: Window destroyed / IPC not ready error handling, rapid sequential media key spamming, long title/artist string truncation (>200 chars), missing cover art placeholder fallback, global shortcut registration collision.
- **Tier 3**: SMTC hardware next/prev action resetting lyric timestamp clock; SMTC continuous playback state across offline network drops; Web Audio visualizer responding to SMTC play/pause.
- **Tier 4**: Scenario 4: Desktop Windows Immersion & Karaoke.

### R4. Dynamic Lyrics & Audio Visualizer
- **Source**: `ORIGINAL_REQUEST.md` § R4, `PROJECT.md` § Interface Contracts
- **Tier 1**: Synced LRC parser (millisecond timestamps), real-time active lyric line identification, lyric scroll position calculation, Web Audio `AnalyserNode` graph connection, non-zero frequency spectrum data sampling.
- **Tier 2**: Empty or malformed LRC file handling, playback position before first lyric line, playback position after final lyric line, suspended AudioContext safety, zero volume / silence visualizer safety.
- **Tier 3**: SMTC track skip re-syncing dynamic lyrics; Audio visualizer responding to master gain volume changes; Lyrics click-to-seek updating player position.
- **Tier 4**: Scenario 4: Desktop Windows Immersion & Karaoke.

### R5. Offline Audio Cache & Storage
- **Source**: `ORIGINAL_REQUEST.md` § R5, `PROJECT.md` § Interface Contracts
- **Tier 1**: Audio blob download and storage in `audioCache`, cache hit verification (`hasAudio`), offline detection via `navigator.onLine` and window events, stream resolution fallback to local cache when offline, cache byte quota calculation.
- **Tier 2**: Uncached track playback attempt offline returning clear error, storage quota limit exceeded triggering LRU eviction, network drop during download cleaning partial data, corrupt cache blob recovery, rapid online/offline connection flapping.
- **Tier 3**: Spotify imported tracks pre-cached for offline travel; Storage quota pruning in settings while track is actively playing; Offline fallback maintaining SMTC metadata continuity.
- **Tier 4**: Scenario 3: Commuter Airplane Offline Mode; Scenario 5: Storage Limit Recovery & Cache Management.

---

## 5. Mock Harness Implementations

### 5.1 Spotify API & OAuth Mock (`tests/e2e/mocks/spotifyMock.ts`)
- **`MockSpotifyService`**:
  - Implements `SpotifyOAuthClient` contract.
  - Implements PKCE challenge/verifier generation and token exchange.
  - Generates paginated `/v1/me/playlists` responses.
  - Parses Spotify URLs (desktop, embed, mobile link, URI, bare ID).
  - Normalizes Spotify track schemas into standard `Track` objects.
  - Configurable fault injection: `simulateRateLimit`, `retryAfterSeconds`, `simulateAuthError`, `simulateNetworkError`.

### 5.2 Web Audio AnalyserNode Mock (`tests/e2e/mocks/webAudioMock.ts`)
- **`MockAudioContext` & `MockAnalyserNode`**:
  - Provides full jsdom polyfill for `window.AudioContext`, `window.webkitAudioContext`, and `window.AnalyserNode`.
  - Implements `fftSize` validation (power-of-two 32 to 32768) and `frequencyBinCount`.
  - Simulates `getByteFrequencyData`, `getByteTimeDomainData`, and `getFloatFrequencyData`.
  - Connects gain nodes, destination nodes, and source nodes with disconnect tracking.
  - Supports custom frequency curves via `setMockFrequencySpectrum()`.

### 5.3 Electron SMTC & Shortcuts Mock (`tests/e2e/mocks/electronSmtcMock.ts`)
- **`MockElectronSmtcBridge`**:
  - Bridges `desktop:media-update` and `desktop:media-action` channels.
  - Intercepts and logs track metadata, status ("playing" | "paused" | "idle"), positionMs, and durationMs.
  - Implements `globalShortcut` registry simulation (`MediaPlayPause`, `MediaNextTrack`, `MediaPreviousTrack`, `MediaStop`).
  - Supports hardware key press simulation (`triggerHardwareKey()`).
  - Polyfills `window.linerElectron` for renderer and IPC dispatchers.

### 5.4 Offline Network & Storage Mock (`tests/e2e/mocks/offlineMock.ts`)
- **`MockOfflineEnvironment`**:
  - Toggles `navigator.onLine` and fires DOM `online` / `offline` events.
  - Intercepts stream resolution, returning cached audio blobs when offline and throwing appropriate offline errors when uncached.
  - Simulates storage limits and LRU eviction over `linerDb` / `audioCache`.

---

## 6. Execution Instructions

### Running the E2E Test Suite
```bash
npx vitest run tests/e2e
```

### Running Specific Tiers
```bash
# Tier 1: Feature Coverage
npx vitest run tests/e2e/tier1-feature-coverage.test.ts

# Tier 2: Boundary & Corner Cases
npx vitest run tests/e2e/tier2-boundary-corner.test.ts

# Tier 3: Cross-Feature Combinations
npx vitest run tests/e2e/tier3-cross-feature.test.ts

# Tier 4: Real-World Application Scenarios
npx vitest run tests/e2e/tier4-application-scenarios.test.ts
```

### Quality Gate Pass Criteria
1. Zero test failures across all 4 tiers ($\ge 65$ total automated tests).
2. All mock harnesses cleanly decoupled from private internal modules.
3. Strict adherence to TypeScript compilation without diagnostic errors.
