export interface SpotifyCallbackPayload {
  code?: string;
  state?: string;
  error?: string;
}

export function parseSpotifyCallback(callbackUrl: string): SpotifyCallbackPayload {
  if (!callbackUrl || typeof callbackUrl !== "string") {
    throw new Error("Invalid Spotify callback URL: empty URL");
  }

  const trimmed = callbackUrl.trim();
  let searchParams: URLSearchParams;

  if (trimmed.startsWith("liner://") || trimmed.startsWith("liner:")) {
    const queryIndex = trimmed.indexOf("?");
    if (queryIndex !== -1) {
      searchParams = new URLSearchParams(trimmed.slice(queryIndex + 1));
    } else {
      searchParams = new URLSearchParams();
    }
  } else {
    try {
      const url = new URL(trimmed);
      searchParams = url.searchParams;
      if (!searchParams.has("code") && !searchParams.has("error") && url.hash) {
        const hashQuery = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;
        searchParams = new URLSearchParams(hashQuery);
      }
    } catch {
      const queryIndex = trimmed.indexOf("?");
      if (queryIndex !== -1) {
        searchParams = new URLSearchParams(trimmed.slice(queryIndex + 1));
      } else {
        throw new Error("Invalid Spotify callback URL format");
      }
    }
  }

  return {
    code: searchParams.get("code") || undefined,
    state: searchParams.get("state") || undefined,
    error: searchParams.get("error") || undefined,
  };
}

export function validateAndExtractCallback(
  callbackUrl: string,
  expectedState?: string
): { code: string; state?: string } {
  const payload = parseSpotifyCallback(callbackUrl);

  if (payload.error) {
    throw new Error(`Spotify authorization failed: ${payload.error}`);
  }

  if (expectedState && payload.state !== expectedState) {
    throw new Error("Invalid OAuth state parameter: CSRF token mismatch");
  }

  if (!payload.code) {
    throw new Error("Missing authorization code in Spotify callback URL");
  }

  return { code: payload.code, state: payload.state };
}
