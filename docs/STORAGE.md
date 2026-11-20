# Storage

Where Liner keeps data on the device, what "Clear cache" removes, and where new data
should go.

All paths below are under Electron's `userData` folder:

| OS      | `userData`                                                      |
| ------- | --------------------------------------------------------------- |
| Linux   | `~/.config/@liner/client` (dev) or `~/.config/Liner` (packaged) |
| Windows | `%APPDATA%\Liner`                                               |
| macOS   | `~/Library/Application Support/Liner`                           |

## IndexedDB: `liner_db_v1`

`src/shared/storage/linerDb.ts`, schema version 4. Each store has a small in-memory map
in front of it.

| Store     | Key       | Holds                                                 | Memory cap |
| --------- | --------- | ----------------------------------------------------- | ---------- |
| `audio`   | `trackId` | Downloaded audio blobs with size and last-played time | 3 records  |
| `tracks`  | `id`      | Track metadata saved next to cached audio             | 500        |
| `lyrics`  | `trackId` | Lyrics and the providers that had them                | 100        |
| `artists` | `id`      | Cached artist pages                                   | 100        |

The audio cache is limited to 3 GB by default (`liner_audio_cache_limit_bytes`, minimum
250 MB, changed in Settings → Cache & Storage). Over the limit, the least recently
played tracks are evicted (`src/shared/storage/audioCache.ts`).

## Files managed by the main process

| Path                               | Holds                                          | Code                               |
| ---------------------------------- | ---------------------------------------------- | ---------------------------------- |
| `auth/session.json`                | Liner session, encrypted with `safeStorage`    | `electron/auth-session-store.ts`   |
| `auth/youtube-session.json`        | YouTube account tokens, encrypted the same way | `electron/auth-session-ipc.ts`     |
| `local-tracks/library.json`        | Index of imported audio files                  | `electron/local-tracks/library.ts` |
| `local-tracks/audio/<hash>.<ext>`  | Copies of imported audio files                 | same                               |
| `local-tracks/covers/<hash>.<ext>` | Artwork taken from their tags                  | same                               |

Imported files are copies, so the originals can be moved or deleted. They are served to
the renderer through the `liner-local://audio/<hash>` and `liner-local://cover/<hash>`
protocol (`electron/local-tracks/protocol.ts`), never through IndexedDB.

## localStorage

Settings and small state, as zustand `persist` stores or plain keys.

| Key                                                                   | Holds                                                                                                    |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `liner_player_session_v2`                                             | Repeat, shuffle, volume and player settings; the queue and position only when "resume" is the start mode |
| `liner_lyrics_session_v1`                                             | Lyrics view settings                                                                                     |
| `liner_customization_v1`                                              | Appearance settings                                                                                      |
| `liner_shortcuts_settings_v1`                                         | Keyboard shortcuts                                                                                       |
| `liner_overlay_settings_v1`                                           | Overlay settings                                                                                         |
| `liner_discord_settings_v1`                                           | Discord Rich Presence settings                                                                           |
| `liner_youtube_preferences`                                           | YouTube playback and sync settings                                                                       |
| `liner_youtube_page_id`                                               | The brand channel picked for the YouTube account                                                         |
| `liner_search_history`                                                | Recent searches                                                                                          |
| `liner_downloads_v1`                                                  | Songs, playlists and albums picked for download, per account (the files are in `saved-tracks/`)          |
| `liner_library_view_mode`                                             | Grid or list in the library                                                                              |
| `liner_locale`, `theme`                                               | Language and theme                                                                                       |
| `liner_lyrics_*`, `liner:artist:*`, `liner:search:*`, `liner:query:*` | Small caches                                                                                             |

`liner_auth_session` and `liner_youtube_tv_session` are legacy keys. They are moved
into the encrypted files above on first launch and then removed.

## Other Chromium storage

- **CacheStorage** and the service worker folder hold cover images.
- **HTTP cache** (`Cache`, `Code Cache`) is Chromium's own.
- In-memory only: `queryCache` (album and playlist pages, stale after 5 minutes,
  dropped after 30) and the lyrics LRU.

## What "Clear cache" removes

`clearStorageCategories` in `src/shared/utils/cacheManager.ts`, with the IPC handlers in
`electron/main.ts`.

| Category | Removes                                                                                                                                     |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Audio    | `audio` and `tracks` stores, then **every** `*.indexeddb.blob` folder and `blob_storage`; with all categories selected, the whole IndexedDB |
| Covers   | CacheStorage and the service worker folder                                                                                                  |
| Lyrics   | `lyrics` store, `liner_lyrics_*` keys and the lyrics session                                                                                |
| Metadata | `artists` store, `queryCache`, search caches and search history                                                                             |
| Any      | Chromium's HTTP cache                                                                                                                       |

Never removed: the sign-in sessions, `liner_locale`, `theme`, settings stores and
`local-tracks/`.

## Where to put new data

- **Can be downloaded again** (audio, covers, lyrics, catalog pages): IndexedDB or
  CacheStorage, inside a "Clear cache" category, with a size limit.
- **Settings**: a zustand `persist` store with a versioned key (`liner_<name>_v1`).
  Bump the version or add a `migrate` when the shape changes.
- **Secrets** (tokens, sessions): the main process, encrypted with `safeStorage`. Never
  in localStorage.
- **Data the user cannot get back** (their own files, anything they created offline):
  files under `userData`, owned by the main process. Do not store it as IndexedDB blobs:
  clearing the audio cache deletes the blob folders of every IndexedDB database.
- Covers and audio shown to the renderer need a stable URL that survives a restart.
  `blob:` URLs die with the page, so do not persist them.
