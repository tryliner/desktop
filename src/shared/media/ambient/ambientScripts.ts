import { getApiBaseUrl } from "@/shared/api/baseUrl";
import { buildRoute } from "@/shared/api/route";
import { isLocalTrackId } from "@/shared/media/local";

const DEV_OVERRIDE_KEY = "liner_ambient_dev_script";
const scripts = new Map<string, string | null>();
const inFlight = new Map<string, Promise<string | null>>();

function devOverride(): string | null {
  if (!import.meta.env.DEV) return null;
  try {
    return localStorage.getItem(DEV_OVERRIDE_KEY);
  } catch {
    return null;
  }
}

async function download(trackId: string): Promise<string | null> {
  const { path } = buildRoute("GET /v1/tracks/:trackId/ambient", {
    params: { trackId },
  });
  const response = await fetch(`${getApiBaseUrl()}${path}`);
  if (response.status === 404) return null;
  if (!response.ok)
    throw new Error(`ambient request failed: ${response.status}`);
  return response.text();
}

export function cachedAmbientScript(
  trackId: string,
): string | null | undefined {
  return devOverride() ?? scripts.get(trackId);
}

export function loadAmbientScript(trackId: string): Promise<string | null> {
  const override = devOverride();
  if (override) return Promise.resolve(override);
  if (!trackId || isLocalTrackId(trackId)) return Promise.resolve(null);
  if (scripts.has(trackId))
    return Promise.resolve(scripts.get(trackId) ?? null);
  const pending = inFlight.get(trackId);
  if (pending) return pending;
  const request = download(trackId)
    .then((script) => {
      scripts.set(trackId, script);
      return script;
    })
    .catch(() => null)
    .finally(() => inFlight.delete(trackId));
  inFlight.set(trackId, request);
  return request;
}
