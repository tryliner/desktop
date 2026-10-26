const CORS_HEADERS = new Set([
  "access-control-allow-origin",
  "access-control-allow-headers",
  "access-control-allow-methods",
  "access-control-allow-credentials",
  "access-control-expose-headers",
  "access-control-max-age",
]);

const PREFLIGHT_STATUS_LINE = "HTTP/1.1 200 OK";

// hosts the renderer calls cross-origin (fetch, <audio crossorigin>, cors images
// for the webgl/canvas cover effects). each entry also matches its subdomains.
const OPEN_CORS_DOMAINS = [
  // liner api, covers proxy, telemetry
  "tryliner.fun",
  // innertube, tv oauth, player js, audio streams, thumbnails and avatars
  "youtube.com",
  "googlevideo.com",
  "ytimg.com",
  "ggpht.com",
  "googleusercontent.com",
  // soundcloud api, client id scrape, progressive and hls streams, artwork
  "soundcloud.com",
  "sndcdn.com",
  "soundcloud.cloud",
  // spotify import: token, pathfinder, web player js, short links, covers
  "spotify.com",
  "spotifycdn.com",
  "spotify.link",
  "scdn.co",
  // deezer and apple music import, covers
  "deezer.com",
  "dzcdn.net",
  "music.apple.com",
  "mzstatic.com",
  // artist avatars
  "genius.com",
  // presigned liner audio urls
  "r2.cloudflarestorage.com",
  // google fonts from index.html
  "fonts.googleapis.com",
  "fonts.gstatic.com",
];

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function needsOpenCors(url: string, allowLoopback = false): boolean {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return false;
  }
  if (allowLoopback && LOOPBACK_HOSTS.has(host)) return true;
  return OPEN_CORS_DOMAINS.some(
    (domain) => host === domain || host.endsWith(`.${domain}`),
  );
}

export type ResponseHeaders = Record<string, string[]>;

export interface CorsResponse {
  responseHeaders: ResponseHeaders;
  statusLine?: string;
}

export function withOpenCors(
  headers: ResponseHeaders | undefined,
  method: string,
): CorsResponse {
  const responseHeaders: ResponseHeaders = {};
  for (const [name, value] of Object.entries(headers ?? {})) {
    if (!CORS_HEADERS.has(name.toLowerCase())) responseHeaders[name] = value;
  }
  responseHeaders["access-control-allow-origin"] = ["*"];
  responseHeaders["access-control-allow-headers"] = ["*, authorization"];
  responseHeaders["access-control-allow-methods"] = [
    "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS",
  ];
  responseHeaders["access-control-expose-headers"] = ["*"];
  responseHeaders["access-control-max-age"] = ["600"];
  return method === "OPTIONS"
    ? { responseHeaders, statusLine: PREFLIGHT_STATUS_LINE }
    : { responseHeaders };
}
