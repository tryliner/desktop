# Last.fm audit and implementation plan

Liner is an Electron music player with a React renderer and one audio runtime. This review assumes one desktop user, one active audio stream, and separate Liner accounts sharing an installation.

## Audit

1. `playerEngine.ts` starts its playback telemetry only when the track ID changes. Repeat-one and consecutive copies of the same track therefore share one session. A hydrated track can also resume without a telemetry session. Last.fm needs a separate identifier for each actual play.
2. The existing tracker uses player status and wall-clock ticks. Status changes are optimistic, and buffering is deliberately hidden for 300 ms. Scrobbling must count confirmed audio progress, exclude seeks, pauses, stalls, and suspend time, and use a monotonic clock.
3. `AuthSessionStore` stores Liner access/refresh tokens and supports an unencrypted fallback. Last.fm sessions have a different lifecycle. Reuse the OS encryption and atomic-file patterns, but keep Last.fm credentials out of the renderer and use memory-only storage when secure storage is unavailable.
4. `Track` already supplies title, structured artists, album, and duration. Preserve catalog metadata when playback uses a YouTube stand-in. SoundCloud currently identifies the uploader as artist; its publisher artist is a better structured source when provided.
5. Settings already has an integrations group, searchable controls, and English translation fallback. Add Last.fm there. Do not introduce a new settings framework or provider abstraction.
6. Playback tests cover transport and sign-out, but do not establish Last.fm eligibility, retries, or per-play identity. Add focused tests at those boundaries.

## Implementation order

1. Main-process Last.fm client: HTTPS form requests, sorted UTF-8 MD5 signatures using Node crypto, JSON/API error validation, request timeout, desktop token authorization in the system browser, and session exchange after the user returns.
2. Account-scoped service: securely persisted session, settings, and FIFO pending queue; persist before send; one flush at a time; batches up to 50; backoff for offline/service/rate-limit errors; reauthentication for revoked sessions; consume terminal ignored responses; expose sanitized status only.
3. Playback integration: distinct play identity even for the same track; first audible start timestamp; measured listening time; threshold `duration > 30 s && listened >= min(duration / 2, 240 s)`; one submission per play; independent Now Playing; original catalog metadata.
4. IPC and lifecycle: validate both sender and payload, authorize only the main app window, stop delivery on logout/account switch, isolate queues by Liner and Last.fm account, and clear session/pending data on disconnect. Aborted requests must not update a new account.
5. Settings: connect/finish/cancel authorization, connected username, enable toggle, Now Playing toggle, queue/error status, retry, disconnect, and optional local API credentials. Build credentials belong only in the Electron bundle.
6. Validation: fake-clock playback tests; signed-request fixtures; authentication/cancellation tests; queue persistence, partial response, retry, and account-switch tests; IPC rejection tests; settings behavior tests; TypeScript, lint, relevant existing playback tests, then the full suite and build using Bun.

## Product boundaries

No Last.fm password collection, loved-track synchronization, historical backfill, profile charts, generic scrobbling provider framework, or new dependencies. Scrobbling starts after opt-in; turning it off pauses pending delivery. Disconnect deletes pending submissions. Local disconnect does not revoke Last.fm's server-side authorization.

Retries use the original play timestamp. Delivery is at least once: if Last.fm accepts a request but its response is lost, a retry can be a duplicate. An unacknowledged request cannot be made exactly once by a client alone.

## Release prerequisites

Supply a registered Last.fm API key and shared secret at build time, or enter application credentials locally in Settings. Desktop bundle credentials are extractable; main-process isolation protects them from ordinary renderer access, not from inspection of the installed app. Without OS-backed secure storage, credentials and pending listens last only for the current process.

Set `LASTFM_API_KEY` and `LASTFM_API_SECRET` in `.env` for local development, or configure the matching repository secrets for release builds. Neither variable uses the `VITE_` prefix. A local override is encrypted with the session and never returned by IPC.

## Manual test with Bun

1. Run `bun install` if dependencies are missing, then `bun run dev`.
2. Sign in to Liner and open **Settings → Last.fm**. If application credentials are not configured, enter a registered API key and shared secret on that screen.
3. Click **Connect Last.fm**, approve access in the system browser, return to Liner, and click **I have authorized Liner**.
4. Start a track longer than 30 seconds. Check that Now Playing appears on Last.fm. Listen for half its duration or four minutes, whichever is shorter, and check Last.fm's recent tracks.
5. Repeat the same track and verify a second entry. A seek forward must not immediately create an entry. Disable scrobbling and verify new listens stop being recorded.
6. For offline delivery, play already cached audio without network access, then reconnect or click **Retry pending scrobbles**. Restart with pending listens to verify persistence when secure storage is available.

Automated coverage includes signatures and HTTP/API errors, authorization and cancellation, encrypted storage, account changes, retries and batches, ignored responses, timing rules, seeks and buffering, repeat-one, restored tracks, and Settings controls. Use `bun run test`, `bun x tsc --noEmit`, and `bun run build` for validation.

Live authorization and scrobbling require real credentials and user approval; automated tests use mocked Last.fm responses. Audio gaps over five seconds are conservatively excluded to avoid counting system sleep. SoundCloud currently supplies uploader names as artists; this integration preserves that existing metadata rather than guessing from titles. The broader catalog, lyrics, downloads, and native-window features were outside this focused audit.

## References

- [Scrobbling rules and cached submissions](https://www.last.fm/api/scrobbling)
- [Desktop authentication](https://www.last.fm/api/desktopauth)
- [Signature construction and session lifetime](https://www.last.fm/api/authspec)
- [Scrobble parameters and ignored codes](https://www.last.fm/api/show/track.scrobble)
- [Now Playing](https://www.last.fm/api/show/track.updateNowPlaying)
