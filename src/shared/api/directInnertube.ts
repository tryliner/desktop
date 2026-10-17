import { getClientVisitorData } from "./visitorSession";

interface ResolvedAudioStream {
  url: string;
  mimeType: string;
  codec: string;
  bitrate: number;
  expiresAt: string | null;
}

export async function resolveDirectInnertubeStream(plan: {
  endpoint: string;
  method?: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}, signal?: AbortSignal): Promise<ResolvedAudioStream> {
  // Obtain fresh local client visitorData so YouTube trusts the residential IP
  const localVisitorData = await getClientVisitorData().catch(() => "");

  const headers = { ...plan.headers };
  const body = JSON.parse(JSON.stringify(plan.body)) as Record<string, any>;

  if (localVisitorData) {
    headers["x-goog-visitor-id"] = localVisitorData;
    if (body.context?.client) {
      body.context.client.visitorData = localVisitorData;
    }
  }

  // Remove datacenter-bound poToken from direct requests to prevent botguard failure
  if (body.context?.serviceIntegrityDimensions) {
    delete body.context.serviceIntegrityDimensions;
  }

  const res = await fetch(plan.endpoint, {
    method: plan.method || 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    throw new Error(`Innertube player returned HTTP ${res.status}`);
  }

  const data = await res.json();
  const playability = data.playabilityStatus?.status;
  if (playability && playability !== 'OK') {
    throw new Error(data.playabilityStatus?.reason || 'Track not playable via direct Innertube');
  }

  const formats: any[] = data.streamingData?.adaptiveFormats || [];
  const audioFormats = formats.filter(
    (f: any) => typeof f.mimeType === 'string' && f.mimeType.includes('audio') && f.url,
  );

  if (audioFormats.length === 0) {
    throw new Error('No direct audio formats returned by Innertube');
  }

  // Prefer Opus (audio/webm, itag 251) or highest bitrate audio/mp4
  const opus = audioFormats.find((f: any) => f.mimeType.includes('webm') || f.mimeType.includes('opus'));
  const best = opus || audioFormats.sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0))[0];

  const codec = best.mimeType.includes('opus') ? 'opus' : 'aac';
  const mimeType = best.mimeType.split(';')[0] || 'audio/webm';
  const bitrate = best.bitrate || best.averageBitrate || 160000;

  // Extract expiration timestamp if present in query params (&expire=...)
  let expiresAt: string | null = null;
  try {
    const u = new URL(best.url);
    const exp = u.searchParams.get('expire');
    if (exp) {
      expiresAt = new Date(Number(exp) * 1000).toISOString();
    }
  } catch {}

  return {
    url: best.url,
    mimeType,
    codec,
    bitrate,
    expiresAt,
  };
}
