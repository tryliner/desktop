export const YOUTUBE_REQUEST_URLS = [
  "*://*.youtube.com/*",
  "*://*.googlevideo.com/*",
];

export function youtubeOriginFor(url: string): string {
  return url.includes("://www.youtube.com/")
    ? "https://www.youtube.com"
    : "https://music.youtube.com";
}
