import { executeRequest, type RequestInput } from "./executeRequest";

const inFlightGets = new Map<string, Promise<unknown>>();

function sharable(input: RequestInput): boolean {
  return (
    input.method === "GET" &&
    !input.signal &&
    !input.onResponse &&
    !input.headers
  );
}

export function request(input: RequestInput): Promise<unknown> {
  if (!sharable(input)) return executeRequest(input);
  const key = `${input.path}::${input.allowRefresh !== false}`;
  const inFlight = inFlightGets.get(key);
  if (inFlight) return inFlight;
  const promise = executeRequest(input).finally(() => {
    inFlightGets.delete(key);
  });
  inFlightGets.set(key, promise);
  return promise;
}
