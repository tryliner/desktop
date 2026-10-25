import type { FormatStream } from "googlevideo/shared-types";
import {
  asArray,
  asRecord,
  numberValue,
  recordAt,
  stringValue,
} from "@/shared/utils/json";
import { InnertubeError } from "../innertube/innertubeClient";

export interface TvPlayerData {
  serverAbrStreamingUrl: string;
  ustreamerConfig: string;
  formats: FormatStream[];
}

function readFormat(raw: unknown): FormatStream | null {
  const format = asRecord(raw);
  const itag = numberValue(format?.itag);
  const bitrate = numberValue(format?.bitrate);
  if (!format || itag === undefined || bitrate === undefined) return null;
  const audioTrackId = stringValue(asRecord(format.audioTrack)?.id);
  return {
    itag,
    bitrate,
    mimeType: stringValue(format.mimeType),
    lastModified: stringValue(format.lastModified),
    xtags: stringValue(format.xtags),
    audioQuality: stringValue(format.audioQuality),
    averageBitrate: numberValue(format.averageBitrate),
    contentLength: stringValue(format.contentLength),
    approxDurationMs: stringValue(format.approxDurationMs),
    audioChannels: numberValue(format.audioChannels),
    width: numberValue(format.width),
    height: numberValue(format.height),
    qualityLabel: stringValue(format.qualityLabel),
    isDrc: format.isDrc === true,
    ...(audioTrackId ? { audioTrackId } : {}),
  };
}

export function readTvPlayerResponse(body: unknown): TvPlayerData {
  const status = recordAt(body, "playabilityStatus");
  if (stringValue(status?.status) !== "OK") {
    const reason = stringValue(status?.reason) ?? stringValue(status?.status);
    throw new InnertubeError(reason ?? "YouTube TV player refused.", 403);
  }
  const streaming = recordAt(body, "streamingData");
  const serverAbrStreamingUrl = stringValue(streaming?.serverAbrStreamingUrl);
  const ustreamerConfig = stringValue(
    recordAt(
      body,
      "playerConfig",
      "mediaCommonConfig",
      "mediaUstreamerRequestConfig",
    )?.videoPlaybackUstreamerConfig,
  );
  const formats = asArray(streaming?.adaptiveFormats)
    .map(readFormat)
    .filter((format): format is FormatStream => format !== null);
  if (!serverAbrStreamingUrl || !ustreamerConfig || formats.length === 0)
    throw new InnertubeError("YouTube TV player has no SABR stream.", 502);
  return { serverAbrStreamingUrl, ustreamerConfig, formats };
}
