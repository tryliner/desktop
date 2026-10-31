import type { LyricsStreamEvent } from "@/shared/contracts";

function takeEvent(buffer: string): [LyricsStreamEvent | null, string] | null {
  const sep = buffer.indexOf("\n\n");
  if (sep === -1) return null;
  const rest = buffer.slice(sep + 2);
  const dataLines = buffer
    .slice(0, sep)
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim());
  if (dataLines.length === 0) return [null, rest];
  try {
    return [JSON.parse(dataLines.join("\n")) as LyricsStreamEvent, rest];
  } catch {
    return [null, rest];
  }
}

export async function* readLyricsEvents(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<LyricsStreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    let finished = false;
    while (!finished) {
      const { done, value } = await reader.read();
      finished = done;
      buffer += done
        ? decoder.decode()
        : decoder.decode(value, { stream: true });
      let next = takeEvent(buffer);
      while (next) {
        const [event, rest] = next;
        buffer = rest;
        if (event) yield event;
        next = takeEvent(buffer);
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export function instrumentalAnswer(body: unknown): LyricsStreamEvent {
  const instrumental =
    typeof body === "object" &&
    body !== null &&
    "instrumental" in body &&
    body.instrumental === true;
  return instrumental
    ? { type: "done", cached: true, status: "not_found", instrumental: true }
    : { type: "done", cached: true, status: "not_found" };
}
