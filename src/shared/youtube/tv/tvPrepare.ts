import { InnertubeError } from "../innertube/innertubeClient";
import { getYoutubeAuthorization } from "../auth/youtubeAuthSession";
import { getTvSession, solveTvN } from "./tvWorker";
import { createCpn, requestTvPlayer } from "./tvPlayerRequest";
import { readTvPlayerResponse } from "./tvPlayerResponse";
import type { TvSabrDownload } from "./tvSabr";

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted)
    throw signal.reason ?? new DOMException("Aborted", "AbortError");
}

export async function prepareTvDownload(
  videoId: string,
  signal?: AbortSignal,
): Promise<TvSabrDownload> {
  const authorization = await getYoutubeAuthorization(signal);
  if (!authorization)
    throw new InnertubeError("YouTube sign-in is required.", 401);
  const session = await getTvSession();
  throwIfAborted(signal);
  const { signatureTimestamp } = await solveTvN(session.playerId, []);
  const cpn = createCpn();
  const player = readTvPlayerResponse(
    await requestTvPlayer({
      videoId,
      session,
      signatureTimestamp,
      authorization,
      cpn,
      signal,
    }),
  );
  const url = new URL(player.serverAbrStreamingUrl);
  const rawN = url.searchParams.get("n");
  if (rawN) {
    const [solved] = (await solveTvN(session.playerId, [rawN])).values;
    if (solved) url.searchParams.set("n", solved);
  }
  url.searchParams.set("cpn", cpn);
  url.searchParams.set("alr", "yes");
  throwIfAborted(signal);
  return {
    url: url.toString(),
    player,
    clientVersion: session.clientVersion,
    poToken: session.poToken,
    videoId,
  };
}
