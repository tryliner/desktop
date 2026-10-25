import { InnertubeError } from "../innertube/innertubeClient";

export interface TvSession {
  poToken: string;
  livingRoomPoTokenId: string;
  visitorData: string;
  clientVersion: string;
  playerId: string;
}

export interface TvSolveResult {
  signatureTimestamp: number;
  values: string[];
}

function electronApi() {
  const api = typeof window === "undefined" ? undefined : window.linerElectron;
  if (!api?.youtubeTvSession || !api.youtubeSolveN)
    throw new InnertubeError("YouTube TV playback needs the desktop app.", 501);
  return api;
}

export function getTvSession(): Promise<TvSession> {
  return electronApi().youtubeTvSession();
}

export function solveTvN(
  playerId: string,
  values: string[],
): Promise<TvSolveResult> {
  return electronApi().youtubeSolveN(playerId, values);
}
