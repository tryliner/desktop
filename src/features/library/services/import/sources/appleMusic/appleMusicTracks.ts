import {
  asRecord,
  type JsonRecord,
  numberValue,
  stringValue,
} from "@/shared/utils/json";
import type { ClientImportedTrack } from "../../importTypes";

export function mapAppleMusicTrack(
  raw: unknown,
): ClientImportedTrack | undefined {
  const item = asRecord(raw);
  const attributes = asRecord(item?.attributes);
  if (!item || !attributes) return undefined;
  const title =
    typeof attributes.name === "string" ? attributes.name.trim() : undefined;
  if (!title) return undefined;

  const rawArtist =
    typeof attributes.artistName === "string"
      ? attributes.artistName.trim()
      : "";
  const artists = rawArtist
    ? rawArtist
        .split(/(?:,\s*|\s*&\s*)/)
        .map((artist) => artist.trim())
        .filter(Boolean)
    : ["Apple Music Artist"];
  const album =
    typeof attributes.albumName === "string"
      ? attributes.albumName.trim()
      : undefined;
  const coverUrl = stringValue(asRecord(attributes.artwork)?.url)
    ?.replace("{w}", "400")
    .replace("{h}", "400");

  return {
    sourceId: String(asRecord(attributes.playParams)?.id ?? item.id ?? ""),
    title,
    artists: artists.length > 0 ? artists : [rawArtist || "Apple Music Artist"],
    durationMs: numberValue(attributes.durationInMillis),
    ...(album ? { album } : {}),
    ...(coverUrl ? { coverUrl } : {}),
  };
}

export function appendAppleMusicTracks(
  tracks: ClientImportedTrack[],
  items: unknown[],
): void {
  for (const item of items) {
    const track = mapAppleMusicTrack(item);
    if (track) tracks.push(track);
  }
}

export function appleMusicPlaylistMeta(resource: JsonRecord): {
  title: string;
  description?: string;
} {
  const attributes = asRecord(resource.attributes);
  const title =
    (typeof attributes?.name === "string" && attributes.name.trim()) ||
    (typeof attributes?.title === "string" && attributes.title.trim()) ||
    "Imported Apple Music playlist";
  const descriptionRecord = asRecord(attributes?.description);
  const description =
    typeof descriptionRecord?.standard === "string"
      ? descriptionRecord.standard.trim()
      : typeof descriptionRecord?.short === "string"
        ? descriptionRecord.short.trim()
        : undefined;
  return { title, ...(description ? { description } : {}) };
}
