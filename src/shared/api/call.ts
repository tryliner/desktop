import type { ApiRoute } from "@/shared/contracts";
import { request } from "./http/request";
import { buildRouteParts, type RouteAnswer, type RouteArgs } from "./route";

export interface CallOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  allowRefresh?: boolean;
  headers?: Record<string, string>;
  onResponse?: (res: Response) => void;
}

export async function call<R extends ApiRoute>(
  route: R,
  ...args: RouteArgs<R, [options?: CallOptions]>
): Promise<RouteAnswer<R>> {
  const [input, options] = args;
  const built = buildRouteParts(route, input);
  const answer = await request({ ...built, ...options });
  return answer as RouteAnswer<R>;
}
