const YOUTUBE_HOSTS = [
  "youtube.com",
  "music.youtube.com",
  "m.youtube.com",
  "youtu.be",
];

export const YOUTUBE_THUMBNAIL_HOST = "i.ytimg.com";

export function isYoutubeHost(host: string): boolean {
  return YOUTUBE_HOSTS.includes(host);
}

export function playlistIdFromYoutube(rawUrl: string): string | undefined {
  try {
    const id = new URL(rawUrl).searchParams.get("list");
    if (!id) return undefined;
    return id.startsWith("VL") ? id : `VL${id}`;
  } catch {
    return undefined;
  }
}

export function videoIdFromYoutube(rawUrl: string): string | undefined {
  try {
    const url = new URL(rawUrl);
    if (url.hostname === "youtu.be") {
      const id = url.pathname.slice(1).split("/")[0]?.split("?")[0];
      return id && id.length === 11 ? id : undefined;
    }
    const v = url.searchParams.get("v");
    if (v && v.length === 11) return v;
    const paths = url.pathname.split("/");
    const vIndex =
      paths.indexOf("v") !== -1
        ? paths.indexOf("v") + 1
        : paths.indexOf("embed") !== -1
          ? paths.indexOf("embed") + 1
          : -1;
    if (vIndex > 0 && paths[vIndex]?.length === 11) return paths[vIndex];
  } catch {
    return undefined;
  }
  return undefined;
}

export function youtubeThumbnailUrl(videoId: string): string {
  return `https://${YOUTUBE_THUMBNAIL_HOST}/vi/${videoId}/hqdefault.jpg`;
}
