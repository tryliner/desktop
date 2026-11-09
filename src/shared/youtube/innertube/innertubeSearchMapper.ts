import type { SearchResult, TrackArtist } from "@/shared/contracts";
import { asArray, asRecord, type JsonRecord } from "@/shared/utils/json";
import {
  getBrowseEndpoint,
  getPageType,
  getRuns,
  getText,
  runsToArtists,
} from "./innertubeJson";
import { mapCardShelf } from "./innertubeCardMapper";
import { coverFromThumbnail } from "./innertubeThumbnail";
import { mapInnertubeTrack } from "./innertubeTrackMapper";

interface ListRow {
  renderer: JsonRecord;
  browseId: string;
  pageType: string | undefined;
  title: string;
  metadata: JsonRecord[];
}

function readListRow(raw: unknown): ListRow | null {
  const renderer = asRecord(asRecord(raw)?.musicResponsiveListItemRenderer);
  if (!renderer) return null;
  const endpoint = getBrowseEndpoint(renderer);
  const columnText = (index: number) =>
    asRecord(
      asRecord(
        asRecord(asArray(renderer.flexColumns)[index])
          ?.musicResponsiveListItemFlexColumnRenderer,
      )?.text,
    );
  const title = getText(columnText(0));
  if (typeof endpoint?.browseId !== "string" || !title) return null;
  return {
    renderer,
    browseId: endpoint.browseId,
    pageType: getPageType(endpoint),
    title,
    metadata: getRuns(columnText(1)),
  };
}

function mapListRow(row: ListRow): SearchResult | null {
  if (row.pageType === "MUSIC_PAGE_TYPE_ARTIST") {
    const cover = coverFromThumbnail(row.renderer.thumbnail, {
      isArtist: true,
    });
    return {
      type: "artist",
      id: row.browseId,
      name: row.title,
      ...(cover ? { cover } : {}),
    };
  }
  const cover = coverFromThumbnail(row.renderer.thumbnail);
  const coverPart = cover ? { cover } : {};
  if (row.pageType === "MUSIC_PAGE_TYPE_ALBUM") {
    const year = row.metadata
      .map((run) =>
        typeof run.text === "string" && /^\d{4}$/.test(run.text)
          ? Number(run.text)
          : undefined,
      )
      .find((value): value is number => value !== undefined);
    const artists = runsToArtists(
      row.metadata,
      (type) => type === "MUSIC_PAGE_TYPE_ARTIST",
    );
    return {
      type: "album",
      id: row.browseId,
      title: row.title,
      artists,
      year,
      ...coverPart,
    };
  }
  if (row.pageType === "MUSIC_PAGE_TYPE_PLAYLIST") {
    const author = row.metadata
      .map((run) => (typeof run.text === "string" ? run.text.trim() : ""))
      .find(Boolean);
    return {
      type: "playlist",
      id: row.browseId,
      title: row.title,
      author,
      ...coverPart,
    };
  }
  return null;
}

export function mapInnertubeSearchResult(
  raw: unknown,
  fallbackArtists: TrackArtist[] = [],
): SearchResult | null {
  const card = mapCardShelf(raw);
  if (card) return card;
  const track = mapInnertubeTrack(raw, fallbackArtists);
  if (track) return { type: "track", ...track };
  const row = readListRow(raw);
  return row ? mapListRow(row) : null;
}

interface SearchEntry {
  item: unknown;
  fallbackArtists: TrackArtist[];
}

function cardArtists(card: SearchResult | null): TrackArtist[] {
  if (!card) return [];
  if (card.type === "artist") return [{ id: card.id, name: card.name }];
  if (card.type === "track" || card.type === "album")
    return card.artists.filter((artist) => artist.id !== "unknown");
  return [];
}

function getSearchEntries(response: unknown): SearchEntry[] {
  const tabs = asArray(
    asRecord(
      asRecord(asRecord(response)?.contents)?.tabbedSearchResultsRenderer,
    )?.tabs,
  );
  const tabContent = asRecord(
    asRecord(asRecord(tabs[0])?.tabRenderer)?.content,
  );
  const sections = asRecord(tabContent?.sectionListRenderer)?.contents;
  if (!Array.isArray(sections)) return [];
  const plain = (item: unknown): SearchEntry => ({
    item,
    fallbackArtists: [],
  });
  return sections.flatMap((section): SearchEntry[] => {
    const record = asRecord(section);
    const cardShelf = asRecord(record?.musicCardShelfRenderer);
    if (cardShelf) {
      const fallbackArtists = cardArtists(
        mapCardShelf({ musicCardShelfRenderer: cardShelf }),
      );
      return [
        plain(cardShelf),
        ...asArray(cardShelf.contents).map((item) => ({
          item,
          fallbackArtists,
        })),
      ];
    }
    const shelf = asRecord(record?.musicShelfRenderer);
    if (Array.isArray(shelf?.contents)) return shelf.contents.map(plain);
    return asArray(asRecord(record?.itemSectionRenderer)?.contents).map(plain);
  });
}

export function getSearchItems(response: unknown): unknown[] {
  return getSearchEntries(response).map((entry) => entry.item);
}

export function mapSearchResponse(response: unknown): SearchResult[] {
  const results: SearchResult[] = [];
  const seen = new Set<string>();
  for (const { item, fallbackArtists } of getSearchEntries(response)) {
    const mapped = mapInnertubeSearchResult(item, fallbackArtists);
    if (!mapped) continue;
    const key = `${mapped.type}:${mapped.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(mapped);
  }
  return results;
}
