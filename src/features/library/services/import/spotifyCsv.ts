// parsing and match scoring for spotify csv exports (the files exportify.net
// produces for a liked songs playlist). kept free of app state so it can be
// tested on its own.

export interface SpotifyCsvRow {
  title: string;
  artist: string;
  durationMs?: number;
}

export interface MatchCandidate {
  id: string;
  title: string;
  artists: unknown;
  durationMs?: number;
}

export interface MatchScore {
  overall: number;
  title: number;
  artist: number;
}

// version suffixes and filler words that should not count for or against a
// match when only one side carries them
const FILLER_TOKEN =
  /^(remaster|remastered|live|edit|radio|mix|version|single|mono|stereo|acapella|instrumental|bonus|deluxe|expanded|anniversary|explicit|feat|ft|original)\b/;

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value: string): string[] {
  const all = normalize(value).split(" ").filter(Boolean);
  const filtered = all.filter(
    (token) => !FILLER_TOKEN.test(token) && !/^\d{4}$/.test(token),
  );
  // a title that consists only of a year or filler words still deserves a match
  return filtered.length > 0 ? filtered : all;
}

function tokenScore(query: string, target: string): number {
  const queryTokens = tokens(query);
  const targetTokens = new Set(tokens(target));
  if (queryTokens.length === 0 || targetTokens.size === 0) return 0;
  let hits = 0;
  for (const token of queryTokens) {
    if (targetTokens.has(token)) hits++;
  }
  return hits / queryTokens.length;
}

export function artistNamesOf(candidate: MatchCandidate): string {
  if (typeof candidate.artists === "string") return candidate.artists;
  if (Array.isArray(candidate.artists)) {
    return candidate.artists
      .map((artist) => (typeof artist === "string" ? artist : artist?.name ?? ""))
      .join(" ");
  }
  return "";
}

// catalog placeholders are never a real match — whole values only, so that
// titles like "Into the Unknown" or the artist "Unknown Mortal Orchestra"
// are not caught
function isPlaceholder(value: string): boolean {
  return /^(unknown|unknown title|unknown artist|n\/?a|not found|)\s*$/i.test(value.trim());
}

export function looksLikeStub(candidate: MatchCandidate): boolean {
  return isPlaceholder(candidate.title ?? "") || isPlaceholder(artistNamesOf(candidate));
}

export function scoreMatch(row: SpotifyCsvRow, candidate: MatchCandidate): MatchScore {
  const title = tokenScore(row.title, candidate.title);
  const artist = row.artist ? tokenScore(row.artist, artistNamesOf(candidate)) : 1;

  let overall = title * 0.55 + artist * 0.35;
  if (row.durationMs && candidate.durationMs) {
    const diff = Math.abs(row.durationMs - candidate.durationMs);
    if (diff < 2500) overall += 0.1;
    else if (diff < 8000) overall += 0.05;
  }
  return { overall, title, artist };
}

// a candidate only counts as a match when the title really lines up and the
// artist does too — a fuzzy overall score alone invites wrong likes
export function isConfidentMatch(score: MatchScore, rowHasArtist: boolean): boolean {
  return score.overall >= 0.55 && score.title >= 0.5 && (!rowHasArtist || score.artist >= 0.3);
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }

  row.push(field);
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  return rows;
}

export function parseSpotifyCsv(text: string): SpotifyCsvRow[] {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];

  const headerRow = rows[0].map((cell) => cell.trim().toLowerCase());
  const titleIdx = headerRow.findIndex((cell) => cell === "track name" || cell === "name");
  const artistIdx = headerRow.findIndex(
    (cell) => cell === "artist name(s)" || cell === "artist" || cell === "artists",
  );
  const durationIdx = headerRow.findIndex((cell) => cell.includes("duration"));
  if (titleIdx === -1) return [];

  const out: SpotifyCsvRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i];
    const title = (cells[titleIdx] ?? "").trim();
    if (!title) continue;
    out.push({
      title,
      artist: artistIdx >= 0 ? (cells[artistIdx] ?? "").trim() : "",
      durationMs: durationIdx >= 0 ? Number(cells[durationIdx]) || undefined : undefined,
    });
  }
  return out;
}
