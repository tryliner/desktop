import { asRecord, findFirst, trimmedString } from "@/shared/utils/json";
import { postInnertube } from "../innertube/innertubeClient";
import { rethrowIfAborted } from "@/shared/utils/abort";

function commandToken(endpoint: unknown): string | undefined {
  return trimmedString(
    asRecord(asRecord(endpoint)?.continuationCommand)?.token,
  );
}

export function extractInnertubeContinuationToken(
  body: unknown,
): string | undefined {
  return (
    commandToken(
      findFirst(body, "continuationItemRenderer")?.continuationEndpoint,
    ) ??
    trimmedString(findFirst(body, "continuationCommand")?.token) ??
    commandToken(findFirst(body, "continuationEndpoint")) ??
    trimmedString(findFirst(body, "nextContinuationData")?.continuation) ??
    trimmedString(findFirst(body, "reloadContinuationData")?.continuation)
  );
}

export async function fetchInnertubeContinuation(
  token: string,
  signal?: AbortSignal,
): Promise<unknown> {
  try {
    return await postInnertube("browse", { continuation: token }, { signal });
  } catch {
    rethrowIfAborted(signal);
    return undefined;
  }
}
