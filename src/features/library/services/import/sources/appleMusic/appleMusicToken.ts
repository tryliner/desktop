const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

let cachedAppleMusicToken: { token: string; expiresAt: number } | null = null;

function pickIndexScript(html: string): string | undefined {
  const scripts = [...html.matchAll(/src="([^"]+\.js)"/g)].map(
    (match) => match[1],
  );
  return (
    scripts.find(
      (src) =>
        src.includes("index~") ||
        src.includes("index-") ||
        src.includes("index.js"),
    ) ?? scripts[0]
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function extractAppleMusicToken(jsText: string): string | undefined {
  const developerMatch = jsText.match(/developerToken:\s*([a-zA-Z0-9_$]+)/);
  if (developerMatch?.[1]) {
    const name = escapeRegExp(developerMatch[1]);
    const valueMatch =
      jsText.match(
        new RegExp(`(?:const|let|var|,|;)\\s*${name}\\s*=\\s*"([^"]+)"`),
      ) ?? jsText.match(new RegExp(`${name}\\s*=\\s*"([^"]+)"`));
    if (valueMatch?.[1]) return valueMatch[1];
  }
  return jsText.match(/eyJhbGciOiJ[a-zA-Z0-9_\-.]+/)?.[0];
}

export async function getAppleMusicWebToken(
  forceRefresh = false,
  signal?: AbortSignal,
): Promise<string> {
  if (
    !forceRefresh &&
    cachedAppleMusicToken &&
    Date.now() < cachedAppleMusicToken.expiresAt
  ) {
    return cachedAppleMusicToken.token;
  }

  const browseResponse = await fetch("https://music.apple.com/us/browse", {
    signal,
  });
  if (!browseResponse.ok) {
    throw new Error(
      `Failed to fetch Apple Music web player (${browseResponse.status}).`,
    );
  }
  const indexJs = pickIndexScript(await browseResponse.text());
  if (!indexJs) throw new Error("Apple Music web scripts not found.");

  const jsUrl = indexJs.startsWith("http")
    ? indexJs
    : `https://music.apple.com${indexJs}`;
  const jsResponse = await fetch(jsUrl, { signal });
  if (!jsResponse.ok) {
    throw new Error(
      `Failed to fetch Apple Music script bundle (${jsResponse.status}).`,
    );
  }

  const token = extractAppleMusicToken(await jsResponse.text());
  if (!token)
    throw new Error(
      "Could not extract Apple Music developer token from web bundle.",
    );
  cachedAppleMusicToken = { token, expiresAt: Date.now() + TOKEN_TTL_MS };
  return token;
}
