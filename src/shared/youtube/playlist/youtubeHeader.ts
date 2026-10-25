import { findFirst, stringValue } from "@/shared/utils/json";
import { getText } from "../innertube/innertubeJson";

export interface YoutubePlaylistHeader {
  title: string;
  description?: string;
}

export function parseYoutubePlaylistHeader(
  body: unknown,
): YoutubePlaylistHeader {
  const responsive = findFirst(body, "musicResponsiveHeaderRenderer");
  const editable = findFirst(body, "musicEditablePlaylistDetailHeaderRenderer");
  const detail =
    findFirst(body, "musicDetailHeaderRenderer") ??
    findFirst(editable?.header, "musicDetailHeaderRenderer");
  const generic = findFirst(body, "musicHeaderRenderer");
  const playlist = findFirst(body, "playlistHeaderRenderer");
  const microformat = findFirst(body, "microformatDataRenderer");

  const title =
    getText(responsive?.title) ??
    getText(editable?.header) ??
    getText(detail?.title) ??
    getText(generic?.title) ??
    getText(playlist?.title) ??
    stringValue(microformat?.title) ??
    "Imported playlist";

  const description =
    getText(responsive?.description) ??
    getText(detail?.description) ??
    stringValue(microformat?.description);

  return { title, ...(description ? { description } : {}) };
}
