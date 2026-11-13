import type { PinKind } from "../store/pinStore";

export function entityHref(kind: PinKind, id: string): string | undefined {
  const encoded = encodeURIComponent(id);
  if (kind === "artist") return `/artist?id=${encoded}`;
  if (kind === "album") return `/collection?type=album&id=${encoded}`;
  if (kind === "playlist") return `/collection?type=playlist&id=${encoded}`;
  return undefined;
}
