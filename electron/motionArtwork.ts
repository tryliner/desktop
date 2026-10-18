import { ipcMain } from "electron";

// Animated album artwork ("motion canvases") resolution against the Apple
// Music catalog. The concept mirrors other YT Music clients: search Apple's
// catalog with the YouTube Music metadata, resolve the album, and read the
// editorialVideo motion assets. No Liner backend is involved; requests go
// straight to Apple with the web player's public token.

export const MOTION_ARTWORK_TTL_MS = 24 * 60 * 60 * 1000;

export interface MotionArtworkRequest {
  title: string;
  artist: string;
  album?: string;
  storefront?: string;
}

export interface MotionArtworkResponse {
  /** Primary square canvas (HLS m3u8 in most cases). */
  videoUrl: string;
  /** Optional taller variant the renderer may prefer when space allows. */
  tallVideoUrl?: string;
  albumName?: string;
}

// Public JWT used by the Apple Music web player for unauthenticated catalog
// reads. Scraped dynamically as a primary path; this is just the fallback.
const FALLBACK_WEB_TOKEN =
  "eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NiIsImtpZCI6IldlYlBsYXlLaWQifQ" +
  ".eyJpc3MiOiJBTVBXZWJQbGF5IiwiaWF0IjoxNzgxMDMyODU1LCJleHAiOjE3ODQw" +
  "NTY4NTUsInJvb3RfaHR0cHNfb3JpZ2luIjpbImFwcGxlLmNvbSJdfQ" +
  ".fiMFcJWkfSlxKP9NVA0UW9CbItD1Rge0SISuepz203XcpU762OqdCpU9M-YkmtKkjRmaIWtjsfGgqZPrlMonpA";

const AMP_BASE = "https://amp-api.music.apple.com";

const REQUEST_TIMEOUT_MS = 20_000;

export interface MotionArtworkFetchLike {
  (
    url: string,
    init?: { headers?: Record<string, string>; signal?: AbortSignal },
  ): Promise<{
    status: number;
    ok: boolean;
    headers: { get(name: string): string | null };
    text(): Promise<string>;
  }>;
}

export interface MotionArtworkDeps {
  fetchImpl?: MotionArtworkFetchLike;
  now?: () => number;
}

// ---- pure helpers (exported for tests) -------------------------------------

export function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ARTIST_SPLIT_RE =
  /(?:\s*,\s*|\s*&\s*|\s+×\s+|\s+x\s+|\bfeat\.?\b|\bft\.?\b|\bfeaturing\b|\bwith\b)/i;

export function splitArtistNames(value: string): string[] {
  return value
    .split(ARTIST_SPLIT_RE)
    .map((part) => normalizeName(part))
    .filter(Boolean);
}

export function matchesArtists(requested: string, returned: string): boolean {
  const requestedList = splitArtistNames(requested);
  const returnedList = splitArtistNames(returned);
  if (requestedList.length === 0 || returnedList.length === 0) return false;
  return requestedList.every((req) => returnedList.some((res) => res === req));
}

const BLACKLIST_TERMS = [
  "playlist",
  "set list",
  "essentials",
  "dj mix",
  "mixed",
  "apple music",
  "today's hits",
  "session",
] as const;

export function isBlacklistedName(name: string): boolean {
  const lowered = name.toLowerCase();
  return BLACKLIST_TERMS.some((term) => lowered.includes(term));
}

const EDITION_WORDS = [
  "deluxe",
  "expanded",
  "remastered",
  "remix",
  "version",
  "edit",
  "mix",
  "bonus",
] as const;

const NAME_MATCH_EXACT_SCORE = 15;
const NAME_MATCH_FUZZY_SCORE = 7;
const NAME_MISMATCH_SCORE = -10;
const ARTIST_MATCH_SCORE = 10;
const ALBUM_EXACT_SCORE = 20;
const ALBUM_FUZZY_SCORE = 10;
const EDITION_ALIGNMENT_SCORE = 5;
const EDITION_MISMATCH_SCORE = -3;
const MIN_CANDIDATE_SCORE = 12;

export function scoreCandidate(options: {
  requestedTitle: string;
  requestedAlbum?: string;
  resultName: string;
  resultAlbumName?: string;
}): number {
  const normTerm = normalizeName(options.requestedTitle);
  const normName = normalizeName(options.resultName);
  let score = ARTIST_MATCH_SCORE;

  if (normName === normTerm) {
    score += NAME_MATCH_EXACT_SCORE;
  } else if (normName.includes(normTerm) || normTerm.includes(normName)) {
    score += NAME_MATCH_FUZZY_SCORE;
  } else {
    score += NAME_MISMATCH_SCORE;
  }

  const termEditions = EDITION_WORDS.filter((word) =>
    options.requestedTitle.toLowerCase().includes(word)
  );
  for (const word of EDITION_WORDS) {
    const inResult = options.resultName.toLowerCase().includes(word);
    const inTerm = termEditions.includes(word);
    if (inTerm && inResult) score += EDITION_ALIGNMENT_SCORE;
    else if (!inTerm && inResult) score += EDITION_MISMATCH_SCORE;
  }

  if (options.requestedAlbum && options.resultAlbumName) {
    const normAlbum = normalizeName(options.requestedAlbum);
    const normCollection = normalizeName(options.resultAlbumName);
    if (normCollection === normAlbum) score += ALBUM_EXACT_SCORE;
    else if (normCollection.includes(normAlbum) || normAlbum.includes(normCollection))
      score += ALBUM_FUZZY_SCORE;
  }

  return score;
}

interface JsonLike {
  attributes?: {
    name?: string;
    artistName?: string;
    albumName?: string;
    collectionName?: string;
    url?: string;
    editorialVideo?: Record<string, unknown> | undefined;
  };
  id?: string;
  type?: string;
  relationships?: {
    albums?: {
      data?: Array<{ id?: string }>;
    };
  };
}

function pickAsset(obj: Record<string, unknown> | undefined): string | null {
  if (!obj) return null;
  const url =
    (typeof obj.video === "string" && obj.video) ||
    (typeof obj.videoUrl === "string" && obj.videoUrl) ||
    (typeof obj.hlsUrl === "string" && obj.hlsUrl) ||
    (typeof obj.url === "string" && obj.url) ||
    null;
  return url && url.trim() ? url.trim() : null;
}

const SQUARE_ORDER = ["motionDetailSquare", "motionDetailRaw", "motionDetailTall", "motionDetailStatic"];
const TALL_ORDER = ["motionDetailTall", "motionDetailRaw", "motionDetailSquare", "motionDetailStatic"];

export function extractMotionVideoUrls(
  editorialVideo: Record<string, unknown> | undefined,
): { videoUrl: string | null; tallVideoUrl: string | null } {
  if (!editorialVideo || typeof editorialVideo !== "object") {
    return { videoUrl: null, tallVideoUrl: null };
  }
  const record = editorialVideo as Record<string, Record<string, unknown>>;
  const pick = (order: string[]) => {
    for (const key of order) {
      const url = pickAsset(record[key]);
      if (url) return url;
    }
    return null;
  };
  return { videoUrl: pick(SQUARE_ORDER), tallVideoUrl: pick(TALL_ORDER) };
}

function asRecordArray(value: unknown): JsonLike[] {
  return Array.isArray(value) ? (value as JsonLike[]) : [];
}

export function extractVideoUrlFromEditorialVideo(
  editorialVideo: Record<string, unknown> | undefined,
): string | null {
  return extractMotionVideoUrls(editorialVideo).videoUrl;
}

// ---- service ---------------------------------------------------------------

interface CacheEntry {
  value: MotionArtworkResponse;
  expiresAtMs: number;
}

export function validateCanvasMatch(options: {
  canvasTitle: string | undefined;
  canvasArtist: string | undefined;
  canvasAlbum: string | undefined;
  requestedTitle: string;
  requestedArtist: string;
  requestedAlbum?: string;
}): boolean {
  const { canvasTitle, canvasArtist, canvasAlbum, requestedTitle, requestedArtist, requestedAlbum } = options;
  if (!canvasTitle || !canvasArtist) return false;
  if (!matchesArtists(requestedArtist, canvasArtist)) return false;

  const normCanvasTitle = normalizeName(canvasTitle);
  const normRequestedTitle = normalizeName(requestedTitle);
  const titleMatches = normCanvasTitle === normRequestedTitle || normCanvasTitle.includes(normRequestedTitle);
  if (!titleMatches) return false;

  if (requestedAlbum) {
    const normRequestedAlbum = normalizeName(requestedAlbum);
    // The player can fill the album field with the track title (singles and
    // radio entries); such a value carries no album information, so the
    // strict album comparison is skipped for it.
    const albumFieldCarriesTitle =
      normRequestedAlbum === normRequestedTitle ||
      normRequestedTitle.includes(normRequestedAlbum) ||
      normRequestedAlbum.includes(normRequestedTitle);
    if (!albumFieldCarriesTitle) {
      if (!canvasAlbum) return false;
      const normCanvasAlbum = normalizeName(canvasAlbum);
      const albumMatches =
        normCanvasAlbum === normRequestedAlbum ||
        normCanvasAlbum.includes(normRequestedAlbum) ||
        normRequestedAlbum.includes(normCanvasAlbum);
      if (!albumMatches) return false;
    }
  }
  return true;
}

export class MotionArtworkManager {
  private readonly fetchImpl: MotionArtworkFetchLike;
  private readonly now: () => number;
  private readonly cache = new Map<string, CacheEntry>();
  private readonly inFlight = new Map<string, Promise<MotionArtworkResponse | null>>();

  private cachedToken: string | null = null;
  private tokenExpiresAtMs = 0;

  constructor(deps: MotionArtworkDeps = {}) {
    this.fetchImpl = deps.fetchImpl ?? (globalThis.fetch as MotionArtworkFetchLike);
    this.now = deps.now ?? Date.now;
  }

  register(): void {
    ipcMain.handle("motion-artwork:get", async (_event, raw: unknown) => {
      const input = this.sanitizeRequest(raw);
      if (!input) return null;
      return this.get(input);
    });
  }

  private sanitizeRequest(raw: unknown): MotionArtworkRequest | null {
    if (!raw || typeof raw !== "object") return null;
    const value = raw as Record<string, unknown>;
    const title = typeof value.title === "string" ? value.title.trim() : "";
    const artist = typeof value.artist === "string" ? value.artist.trim() : "";
    const album = typeof value.album === "string" ? value.album.trim() : "";
    const storefront = typeof value.storefront === "string" ? value.storefront.trim() : "";
    if (!title || !artist) return null;
    return {
      title,
      artist,
      album: album || undefined,
      storefront: /^[a-z]{2}$/i.test(storefront) ? storefront.toLowerCase() : "us",
    };
  }

  async get(input: MotionArtworkRequest): Promise<MotionArtworkResponse | null> {
    const key = `${input.title}|${input.artist}|${input.album ?? ""}|${input.storefront}`;
    const cached = this.cache.get(key);
    if (cached && cached.expiresAtMs > this.now()) return cached.value;

    const pending = this.inFlight.get(key);
    if (pending) return pending;

    const promise = this.resolve(input)
      .then((result) => {
        if (result) {
          this.cache.set(key, { value: result, expiresAtMs: this.now() + MOTION_ARTWORK_TTL_MS });
        }
        return result;
      })
      .finally(() => {
        this.inFlight.delete(key);
      });
    this.inFlight.set(key, promise);
    return promise;
  }

  private async resolve(input: MotionArtworkRequest): Promise<MotionArtworkResponse | null> {
    try {
      const headers = await this.catalogHeaders();
      if (!headers) return null;
      const searchUrl =
        `${AMP_BASE}/v1/catalog/${input.storefront}/search` +
        `?term=${encodeURIComponent(`${input.artist} ${input.title} ${input.album ?? ""}`.trim())}` +
        `&types=songs&limit=10&extend=editorialVideo&include=albums`;
      const searchResponse = await this.fetch(searchUrl, headers);
      if (!searchResponse.ok) return null;

      const searchPayload = (await safeJson(searchResponse)) as
        | { results?: { songs?: { data?: unknown } } }
        | null;
      const candidates = asRecordArray(searchPayload?.results?.songs?.data);
      if (candidates.length === 0) return null;

      const scored = candidates
        .filter((candidate) => {
          const artistName = candidate.attributes?.artistName ?? "";
          return artistName ? matchesArtists(input.artist, artistName) : false;
        })
        .map((candidate) => ({
          candidate,
          score: scoreCandidate({
            requestedTitle: input.title,
            requestedAlbum: input.album,
            resultName: candidate.attributes?.name ?? "",
            resultAlbumName:
              candidate.attributes?.albumName ?? candidate.attributes?.collectionName ?? "",
          }),
        }))
        .filter((entry) => entry.score >= MIN_CANDIDATE_SCORE)
        .sort((a, b) => b.score - a.score);

      for (const { candidate } of scored) {
        const resolved = await this.tryResolveCandidate(candidate, headers, input);
        if (resolved) return resolved;
      }
      return null;
    } catch {
      return null;
    }
  }

  private async tryResolveCandidate(
    candidate: JsonLike,
    headers: Record<string, string>,
    input: MotionArtworkRequest,
  ): Promise<MotionArtworkResponse | null> {
    const candidateName = candidate.attributes?.name ?? "";
    const candidateArtist = candidate.attributes?.artistName ?? "";
    if (isBlacklistedName(candidateName)) return null;

    const candidateId = typeof candidate.id === "string" ? candidate.id : "";
    if (!candidateId || candidateId.startsWith("pl.")) return null;

    // Search results do not expand relationships; a direct song lookup does.
    const lookupUrl = `${AMP_BASE}/v1/catalog/${input.storefront}/songs/${candidateId}?extend=editorialVideo&include=albums`;
    const lookupResponse = await this.fetch(lookupUrl, headers);
    if (!lookupResponse.ok) return null;
    const lookupPayload = (await safeJson(lookupResponse)) as { data?: unknown } | null;
    const song = asRecordArray(lookupPayload?.data)[0];
    if (!song) return null;

    const songAttributes = song.attributes ?? {};
    const songEditorial = songAttributes.editorialVideo;
    const directUrls = extractMotionVideoUrls(songEditorial);

    let albumId =
      song.relationships?.albums?.data?.[0]?.id ??
      (typeof songAttributes.url === "string" && songAttributes.url.includes("/album/")
        ? songAttributes.url.split("/album/")[1]?.split("?")[0]?.split("/").pop() ?? null
        : null);
    if (!albumId) return null;
    if (albumId.startsWith("pl.")) return null;

    const albumUrl = `${AMP_BASE}/v1/catalog/${input.storefront}/albums/${albumId}?extend=editorialVideo&include=tracks`;
    const albumResponse = await this.fetch(albumUrl, headers);
    if (!albumResponse.ok) return null;
    const albumPayload = (await safeJson(albumResponse)) as { data?: unknown } | null;
    const album = asRecordArray(albumPayload?.data)[0];
    if (!album) return null;

    const albumAttributes = album.attributes ?? {};
    if (isBlacklistedName(albumAttributes.name ?? "")) return null;

    const albumUrls = extractMotionVideoUrls(albumAttributes.editorialVideo);
    const videoUrl = directUrls.videoUrl ?? albumUrls.videoUrl;
    const tallVideoUrl = albumUrls.tallVideoUrl ?? null;
    if (!videoUrl) return null;

    const passes = validateCanvasMatch({
      canvasTitle: candidateName,
      canvasArtist: candidateArtist,
      canvasAlbum: albumAttributes.name,
      requestedTitle: input.title,
      requestedArtist: input.artist,
      requestedAlbum: input.album,
    });
    if (!passes) return null;

    const response: MotionArtworkResponse = {
      videoUrl,
      ...(tallVideoUrl ? { tallVideoUrl } : {}),
      ...(albumAttributes.name ? { albumName: albumAttributes.name } : {}),
    };
    return response;
  }

  private fetch(url: string, headers: Record<string, string>) {
    return this.fetchImpl(url, { headers, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  }

  private async catalogHeaders(): Promise<Record<string, string> | null> {
    const token = await this.getOrRefreshToken();
    if (!token) return null;
    return {
      Authorization: `Bearer ${token}`,
      Origin: "https://music.apple.com",
      Referer: "https://music.apple.com/",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    };
  }

  private async getOrRefreshToken(): Promise<string | null> {
    const now = this.now();
    if (this.cachedToken && now < this.tokenExpiresAtMs - 60_000) return this.cachedToken;
    try {
      return await this.refreshToken(now);
    } catch {
      const fallbackPayload = decodeJwtPayload(FALLBACK_WEB_TOKEN);
      const exp = typeof fallbackPayload?.exp === "number" ? fallbackPayload.exp : 0;
      if (exp * 1000 > this.now()) return FALLBACK_WEB_TOKEN;
      return null;
    }
  }

  private async refreshToken(now: number): Promise<string> {
    const page = await this.fetchImpl("https://music.apple.com/us/browse", {
      headers: { "User-Agent": WEB_UA },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!page.ok) throw new Error("browse page unavailable");
    const html = await page.text();
    const scriptUrls = [...html.matchAll(/(?:src="|href=")(\/assets\/[^"]+\.js)/g)].map(
      (match) => match[1],
    );

    for (const path of [...new Set(scriptUrls)].slice(0, 12)) {
      const script = await this.fetchImpl(`https://music.apple.com${path}`, {
        headers: { "User-Agent": WEB_UA },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!script.ok) continue;
      const text = await script.text();
      const tokens = text.match(/ey[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g) ?? [];
      for (const token of tokens) {
        const payload = decodeJwtPayload(token);
        if (!payload) continue;
        const exp = typeof payload.exp === "number" ? payload.exp : 0;
        if (typeof payload.iss === "string" && exp * 1000 > now) {
          this.cachedToken = token;
          this.tokenExpiresAtMs = exp * 1000;
          return token;
        }
      }
    }
    throw new Error("no valid web token found");
  }
}

const WEB_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

function decodeJwtPayload(token: string): { iss?: unknown; exp?: number } | null {
  try {
    const part = token.split(".")[1];
    const json = JSON.parse(
      Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"),
    );
    return typeof json === "object" && json !== null ? json : null;
  } catch {
    return null;
  }
}

async function safeJson(response: Awaited<ReturnType<MotionArtworkFetchLike>>): Promise<unknown> {
  try {
    return JSON.parse(await response.text());
  } catch {
    return null;
  }
}
