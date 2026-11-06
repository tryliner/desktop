import { api } from "@/shared/api";

const resolvedArtistIds = new Map<string, string | null>();
const pendingArtistIds = new Map<string, Promise<string | null>>();

export function isArtistId(id: string | undefined): id is string {
  return Boolean(id && id !== "unknown");
}

function normalizeArtistName(name: string): string {
  return name.normalize("NFKC").trim().toLocaleLowerCase();
}

async function searchArtistId(name: string): Promise<string | null> {
  const response = await api.search(name, "artist");
  const artists = response.items.filter((item) => item.type === "artist");
  const wanted = normalizeArtistName(name);
  const exact = artists.find(
    (artist) => normalizeArtistName(artist.name) === wanted,
  );
  const match = exact ?? artists[0];
  return match && isArtistId(match.id) ? match.id : null;
}

export function cachedArtistIdByName(name: string): string | null | undefined {
  return resolvedArtistIds.get(normalizeArtistName(name));
}

export function resolveArtistIdByName(name: string): Promise<string | null> {
  const key = normalizeArtistName(name);
  if (!key) return Promise.resolve(null);
  const cached = resolvedArtistIds.get(key);
  if (cached !== undefined) return Promise.resolve(cached);
  const pending = pendingArtistIds.get(key);
  if (pending) return pending;

  const request = searchArtistId(name)
    .then((id) => {
      resolvedArtistIds.set(key, id);
      return id;
    })
    .catch(() => null)
    .finally(() => {
      pendingArtistIds.delete(key);
    });
  pendingArtistIds.set(key, request);
  return request;
}
