import type { Track } from "@/shared/types";

interface ListenBrainzClientResponse {
  ok: boolean;
  status: number;
  data: unknown;
  error?: string;
}

function request(input: {
  method?: "GET" | "POST";
  path: string;
  token: string;
  body?: unknown;
}): Promise<ListenBrainzClientResponse> {
  const bridge = window.linerElectron;
  if (!bridge?.listenBrainzRequest) {
    return Promise.resolve({
      ok: false,
      status: 0,
      data: null,
      error: "ListenBrainz is only available in the desktop app",
    });
  }
  return bridge.listenBrainzRequest(input);
}

function trackMetadata(track: Track) {
  return {
    artist_name: track.artists || "Unknown artist",
    track_name: track.title,
    ...(track.album?.title ? { release_name: track.album.title } : {}),
    additional_info: {
      submission_client: "Liner",
      media_player: "Liner",
      ...(track.durationMs > 0 ? { duration_ms: track.durationMs } : {}),
    },
  };
}

export async function validateListenBrainzToken(
  token: string,
): Promise<{ username: string | null; error?: string }> {
  const response = await request({ path: "/1/validate-token", token });
  const data = response.data as
    | { valid?: boolean; user_name?: string; message?: string }
    | null;
  if (!response.ok || !data?.valid) {
    return {
      username: null,
      error:
        typeof data?.message === "string"
          ? data.message
          : "Could not validate the token",
    };
  }
  return { username: data.user_name || "ListenBrainz user" };
}

export function submitPlayingNow(token: string, track: Track) {
  return request({
    method: "POST",
    path: "/1/submit-listens",
    token,
    body: {
      listen_type: "playing_now",
      payload: [{ track_metadata: trackMetadata(track) }],
    },
  });
}

export function submitListen(
  token: string,
  track: Track,
  listenedAtSeconds: number,
) {
  return request({
    method: "POST",
    path: "/1/submit-listens",
    token,
    body: {
      listen_type: "single",
      payload: [
        {
          listened_at: listenedAtSeconds,
          track_metadata: trackMetadata(track),
        },
      ],
    },
  });
}
