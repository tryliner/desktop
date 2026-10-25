import { asArray, asRecord, type JsonRecord } from "@/shared/utils/json";
import { getText } from "../innertube/innertubeJson";

const SEPARATOR = "•";
const PLAYLIST_LABELS = new Set([
  "Auto playlist",
  "Playlist",
  "Album",
  "EP",
  "Single",
]);
const NON_AUTHOR_TEXT =
  /^(\d[\d,.]*\s*\w*\s+(songs?|videos?|tracks?)|\d{4}|Updated .+|Private|Public|Unlisted)$/i;

function bylineTexts(entity: JsonRecord | undefined): string[] {
  return asArray(entity?.bylines).flatMap((line) =>
    asArray(asRecord(asRecord(line)?.lineRenderer)?.items).flatMap((item) => {
      const text = getText(asRecord(asRecord(item)?.lineItemRenderer)?.text);
      return text && text !== SEPARATOR ? [text] : [];
    }),
  );
}

export function parsePlaylistAuthor(
  entity: JsonRecord | undefined,
): string | undefined {
  return bylineTexts(entity).find(
    (text) => !PLAYLIST_LABELS.has(text) && !NON_AUTHOR_TEXT.test(text),
  );
}
