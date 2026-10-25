import { asArray, asRecord, type JsonRecord } from "@/shared/utils/json";

export function getRuns(value: unknown): JsonRecord[] {
  return asArray(asRecord(value)?.runs)
    .map(asRecord)
    .filter((run): run is JsonRecord => Boolean(run));
}

export function getText(value: unknown): string | undefined {
  const record = asRecord(value);
  if (typeof record?.simpleText === "string" && record.simpleText.trim()) {
    return record.simpleText.trim();
  }
  const text = getRuns(value)
    .map((run) => run.text)
    .filter((part): part is string => typeof part === "string")
    .join("")
    .trim();
  return text || undefined;
}

export function getBrowseEndpoint(value: unknown): JsonRecord | undefined {
  return asRecord(
    asRecord(asRecord(value)?.navigationEndpoint)?.browseEndpoint,
  );
}

export function getPageType(
  endpoint: JsonRecord | undefined,
): string | undefined {
  const config = asRecord(
    asRecord(endpoint?.browseEndpointContextSupportedConfigs)
      ?.browseEndpointContextMusicConfig,
  );
  return typeof config?.pageType === "string" ? config.pageType : undefined;
}

export function runPageType(run: JsonRecord): string | undefined {
  return getPageType(getBrowseEndpoint(run));
}

export function isArtistPage(pageType: string | undefined): boolean {
  return (
    pageType === "MUSIC_PAGE_TYPE_ARTIST" ||
    pageType === "MUSIC_PAGE_TYPE_USER_CHANNEL"
  );
}

export function runsToArtists(
  runs: JsonRecord[],
  accept: (pageType: string | undefined) => boolean = isArtistPage,
): { id: string; name: string }[] {
  return runs.flatMap((run) => {
    const endpoint = getBrowseEndpoint(run);
    const name = typeof run.text === "string" ? run.text.trim() : "";
    return accept(getPageType(endpoint)) &&
      typeof endpoint?.browseId === "string" &&
      name
      ? [{ id: endpoint.browseId, name }]
      : [];
  });
}

export function runsToAlbum(
  runs: JsonRecord[],
): { id: string; title: string } | undefined {
  const albumRun = runs.find(
    (run) => runPageType(run) === "MUSIC_PAGE_TYPE_ALBUM",
  );
  const endpoint = albumRun ? getBrowseEndpoint(albumRun) : undefined;
  return typeof endpoint?.browseId === "string" &&
    typeof albumRun?.text === "string"
    ? { id: endpoint.browseId, title: albumRun.text }
    : undefined;
}

export function yearFromRuns(value: unknown): number | undefined {
  return getRuns(value)
    .map((run) =>
      typeof run.text === "string" && /^\d{4}$/.test(run.text)
        ? Number(run.text)
        : undefined,
    )
    .find((year): year is number => year !== undefined);
}
