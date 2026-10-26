import { InnertubeError } from "./innertubeClient";

const PROBE_OFFSET = 1_048_576 + 4096;

export async function assertStreamReachable(
  url: string,
  contentLength: number | undefined,
  signal?: AbortSignal,
): Promise<void> {
  const probe = new URL(url);
  const offset =
    contentLength && contentLength > PROBE_OFFSET ? PROBE_OFFSET : 0;
  probe.searchParams.set("range", `${offset}-${offset}`);
  const response = await fetch(probe.toString(), { signal });
  await response.body?.cancel().catch(() => undefined);
  if (!response.ok)
    throw new InnertubeError(
      `stream url rejected with ${response.status}`,
      response.status,
    );
}
