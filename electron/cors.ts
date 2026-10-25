const CORS_HEADERS = new Set([
  "access-control-allow-origin",
  "access-control-allow-headers",
  "access-control-allow-methods",
  "access-control-allow-credentials",
  "access-control-expose-headers",
  "access-control-max-age",
]);

const PREFLIGHT_STATUS_LINE = "HTTP/1.1 200 OK";

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
