import type {
  ArtistAlbum,
  ArtistDetails,
  ArtistRelease,
} from "@/shared/contracts";
import { asArray, asRecord, findFirst, walkRecords } from "@/shared/utils/json";
import { getPageType, getRuns, getText, yearFromRuns } from "./innertubeJson";
import { coverFromThumbnail } from "./innertubeThumbnail";
import { hasExplicitBadge } from "./innertubeTrackMapper";
import {
  mapInnertubeBrowseTracks,
  microformatCover,
} from "./innertubeCollectionMapper";
import { isVerifiedArtist } from "./monthlyListeners";

const LISTENERS_PATTERN =
  /[\d.,]+[KMBkmb]?\s*(?:monthly (?:audience|listeners)|слушателей за месяц|слухачів за місяць)/i;

function artistHeader(body: unknown) {
  return (
    findFirst(body, "musicImmersiveHeaderRenderer") ??
    findFirst(body, "musicVisualHeaderRenderer") ??
    findFirst(body, "musicHeaderRenderer") ??
    findFirst(body, "musicResponsiveHeaderRenderer")
  );
}

function parseMonthlyListeners(
  header: Record<string, unknown> | undefined,
): string | undefined {
  if (!header) return undefined;
  const direct = getText(header.monthlyListenerCount);
  if (direct) return direct;
  const label = asRecord(
    asRecord(asRecord(header.monthlyListenerCount)?.accessibility)
      ?.accessibilityData,
  )?.label;
  if (typeof label === "string" && label.trim()) return label.trim();
  return (
    getText(header.subtitle)?.match(LISTENERS_PATTERN)?.[0] ??
    getText(header.secondSubtitle)?.match(LISTENERS_PATTERN)?.[0]
  );
}

function mapReleaseItem(raw: unknown): ArtistAlbum | null {
  const item = asRecord(asRecord(raw)?.musicTwoRowItemRenderer);
  const titleRun = getRuns(item?.title)[0];
  const endpoint =
    asRecord(asRecord(titleRun?.navigationEndpoint)?.browseEndpoint) ??
    asRecord(asRecord(item?.navigationEndpoint)?.browseEndpoint);
  const title = getText(item?.title);
  if (
    getPageType(endpoint) !== "MUSIC_PAGE_TYPE_ALBUM" ||
    typeof endpoint?.browseId !== "string" ||
    !title
  ) {
    return null;
  }
  const year = yearFromRuns(item?.subtitle);
  const cover = coverFromThumbnail(item?.thumbnailRenderer);
  return {
    id: endpoint.browseId,
    title,
    ...(year ? { year } : {}),
    ...(cover ? { cover } : {}),
    explicit: hasExplicitBadge(item),
  };
}

function releaseTypeOf(raw: unknown): ArtistRelease["releaseType"] {
  const item = asRecord(asRecord(raw)?.musicTwoRowItemRenderer);
  const first = getRuns(item?.subtitle)[0]?.text;
  return typeof first === "string" && first.trim().toLowerCase() === "ep"
    ? "ep"
    : "single";
}

function mapArtistReleases(body: unknown): {
  albums: ArtistAlbum[];
  singles: ArtistRelease[];
} {
  const albums: ArtistAlbum[] = [];
  const singles: ArtistRelease[] = [];
  const seen = new Set<string>();
  walkRecords(body, (record) => {
    const carousel = asRecord(record.musicCarouselShelfRenderer);
    if (!carousel) return false;
    const header = asRecord(
      asRecord(carousel.header)?.musicCarouselShelfBasicHeaderRenderer,
    );
    const shelfTitle = getText(header?.title)?.toLowerCase();
    if (shelfTitle !== "albums" && shelfTitle !== "singles & eps") return true;
    for (const raw of asArray(carousel.contents)) {
      const release = mapReleaseItem(raw);
      if (!release || seen.has(release.id)) continue;
      seen.add(release.id);
      if (shelfTitle === "albums") albums.push(release);
      else singles.push({ ...release, releaseType: releaseTypeOf(raw) });
    }
    return true;
  });
  return { albums, singles };
}

export function mapInnertubeArtistDetails(
  id: string,
  body: unknown,
): ArtistDetails | null {
  const header = artistHeader(body);
  const name = getText(header?.title);
  if (!name) return null;
  const monthlyListeners = parseMonthlyListeners(header);
  const cover =
    microformatCover(body, true) ??
    coverFromThumbnail(header?.thumbnail, { isArtist: true });
  const releases = mapArtistReleases(body);
  return {
    type: "artist",
    id,
    name,
    verified: isVerifiedArtist(monthlyListeners),
    ...(cover ? { cover } : {}),
    ...(monthlyListeners ? { monthlyListeners } : {}),
    tracks: mapInnertubeBrowseTracks(body, [{ id, name }]),
    albums: releases.albums,
    singles: releases.singles,
  };
}

export function getArtistTopSongsBrowse(
  body: unknown,
): { browseId: string; params?: string } | undefined {
  let found: { browseId: string; params?: string } | undefined;
  walkRecords(body, (record) => {
    if (found) return true;
    const shelf = asRecord(record.musicShelfRenderer);
    if (!shelf) return false;
    const titleRun = getRuns(shelf.title)[0];
    const endpoint =
      asRecord(asRecord(titleRun?.navigationEndpoint)?.browseEndpoint) ??
      asRecord(asRecord(shelf.bottomEndpoint)?.browseEndpoint);
    if (typeof endpoint?.browseId !== "string") return false;
    found = {
      browseId: endpoint.browseId,
      ...(typeof endpoint.params === "string"
        ? { params: endpoint.params }
        : {}),
    };
    return true;
  });
  return found;
}
