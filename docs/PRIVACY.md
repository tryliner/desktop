# Privacy

What the Liner desktop app sends off your device, to whom, and when. This describes the
code in this repository. What the Liner server does with the data it receives is not
covered here.

If you change what the app sends, update this file in the same pull request.

## Summary

- **No telemetry, analytics or crash reporting.** The telemetry client is a stub that
  sends nothing. The error screen's report is only copied to your clipboard when you
  click "Copy error details".
- **Searches and the music catalog go to YouTube Music directly from your device.** The
  Liner server is asked only when that fails.
- **The Liner server gets what it needs for your account:** sign-in, your library and
  playlists, what you played (for history and recommendations), lyrics lookups and an
  online heartbeat.
- **Your own audio files never leave the device.** Not the files, not their names or
  paths, not their tags (except to Discord, see below).
- **Lyric romanization runs locally.** Korean, Mandarin and Japanese readings are
  generated on your device. The Japanese dictionary ships with the app; no lyrics
  are sent to a romanization service. Reading-language choices are saved locally
  for each song and version of its lyrics; these preferences are not sent off-device.
- **There is no hardware or device identifier.** Every id the app generates is a random
  UUID per request, per session or per sign-in.

## Liner server (`api.tryliner.fun`)

Every request carries:

- the access token, when you are signed in;
- your user id and username (`x-user-id`, `x-user-name`);
- the app version and your OS family (`windows`, `macos`, `linux`);
- a random request id;
- a request signature (HMAC over the method, path, time and body; it contains no device
  data);
- the id of the track playing now (`x-session-id`). Local files are left out.

What is sent, and when:

| Data                                                                                                                                                                                                               | When                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Email and password; username and display name when signing up                                                                                                                                                      | Signing in or up                                                            |
| Profile fields you edit (username, display name, avatar, bio, visibility settings)                                                                                                                                 | Saving your profile                                                         |
| Liked tracks, saved albums, artists and playlists, with a snapshot (title, artists, album, cover URL, duration)                                                                                                    | Liking or saving                                                            |
| Your playlists: title, description, visibility, tracks and their order                                                                                                                                             | Editing playlists                                                           |
| **Play events**: track id and snapshot, how long you listened, whether you finished or skipped, loops, backward seeks, where you played it from (playlist id, album, radio), random play and listening session ids | After 3 seconds of listening, on every track change and when the app closes |
| **Lyrics lookups**: track id, title, first artist, duration                                                                                                                                                        | When a track starts, and for the next track in the queue                    |
| **Heartbeat**: username, display name, app version, OS family. **No email.**                                                                                                                                       | Every 60 seconds (the server may set 15 to 300) while signed in             |
| Search query, catalog id or radio seed with your last 20 queue ids                                                                                                                                                 | Only when the same request to YouTube failed                                |
| YouTube video id                                                                                                                                                                                                   | Asking the server for a cached copy of a track, when signed in              |

Playlist imports from Spotify, Apple Music, Deezer, SoundCloud and YouTube run on your
device. The server receives only the finished playlist.

## YouTube and Google

The app talks to YouTube Music the way its web and TV clients do, from your own IP:

- **Visitor data** from `youtube.com` at launch, which Google uses as an anonymous
  session id.
- **Search queries**, album, artist and playlist pages, radio, and video ids for playback.
- **Audio** from `googlevideo.com`, with a proof-of-origin token that a hidden YouTube
  page generates on your device.
- **Titles and artists** of tracks that need a YouTube match, during playlist imports and
  for SoundCloud tracks that fail to play.

If you sign in with your YouTube account (TV device-code sign-in):

- The app asks for access to your YouTube and YouTube Music account and paid content.
- Playback and the library sync run as your account, or as the brand channel you pick.
  Google can link what you play to your account.
- The tokens are stored in `userData/auth/youtube-session.json`, encrypted with the OS
  keychain when it is available. If it is not, they are stored unencrypted, readable only
  by your user.
- Your YouTube library is only read, to show it in Liner. It is not sent to the Liner
  server. The app does not like, rate or report anything to YouTube.
- Signing out revokes the token with Google.

## Other services

| Service                                                                                                                                 | What it gets                                                                                               | When                                                                                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Discord** (local Discord app)                                                                                                         | Track title, artist, album, cover URL, position, artist picture, and a "Listen on Liner" link to the track | While Rich Presence is on (it is on by default; turn it off in Settings → Discord). Local files show title and artist only, without the link or cover |
| **SoundCloud**                                                                                                                          | The SoundCloud link you paste, and stream requests                                                         | Only for SoundCloud links and tracks. Free-text searches never go to SoundCloud                                                                       |
| **Spotify, Apple Music, Deezer**                                                                                                        | The playlist link you paste, with an anonymous guest token                                                 | Importing a playlist                                                                                                                                  |
| **Google Fonts**                                                                                                                        | Your IP and browser user agent                                                                             | At launch, to load the fonts                                                                                                                          |
| **Image hosts** (YouTube, Google, SoundCloud, `covers.tryliner.fun`)                                                                    | Requests for cover images                                                                                  | Showing covers                                                                                                                                        |
| **GitHub releases**, `updates.tryliner.fun`                                                                                             | Your IP and user agent                                                                                     | Update checks: 4 seconds after launch, then every 15 minutes                                                                                          |
| **Connectivity checks** (`api`, `covers` and `link.tryliner.fun`, `google.com/generate_204`, Cloudflare trace, a traceroute to the API) | Your IP                                                                                                    | When several requests fail in a row, or when you run the check. Results are shown only to you                                                         |

## Your own audio files

Files you add under "On this device" are copied into `userData/local-tracks/` and played
from there. Their id is a hash of the file content. The app never:

- uploads the files, their names or their paths;
- sends their tags to the Liner server or YouTube (no play events, lyrics lookups, radio,
  likes, playlist adds or share links for them);
- looks them up on YouTube to find a replacement.

The only place a local track's title and artist go is Discord Rich Presence, when it is
on.

## What stays on your device

- Search history, settings, the queue and the audio, cover and lyrics caches. See
  [STORAGE.md](./STORAGE.md).
- The error report on the crash screen, unless you copy it and send it yourself.
- In development builds only, `renderer.log` with the app's console output.
