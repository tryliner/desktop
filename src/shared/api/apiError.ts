import type { PlanLimitDetails } from "@/shared/contracts";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
    public readonly requestId?: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }

  get traceInfo(): string | undefined {
    return this.requestId ? `[reqId: ${this.requestId}]` : undefined;
  }
}

const RESOURCES: readonly PlanLimitDetails["resource"][] = [
  "playlists",
  "tracksPerPlaylist",
  "likedTracks",
  "savedCollections",
  "profileModules",
  "imageUploadsPerHour",
  "avatarBytes",
  "bannerBytes",
];

type Translate = (
  key: string,
  vars?: Record<string, string | number>,
) => string;

function numberField(value: object, key: string): number | null {
  const field: unknown = Reflect.get(value, key);
  return typeof field === "number" && Number.isFinite(field) ? field : null;
}

export function planLimitOf(err: unknown): PlanLimitDetails | null {
  if (!(err instanceof ApiError) || err.code !== "PLAN_LIMIT_REACHED") {
    return null;
  }
  const details = err.details;
  if (typeof details !== "object" || details === null) return null;
  const resource = RESOURCES.find(
    (known) => known === Reflect.get(details, "resource"),
  );
  const limit = numberField(details, "limit");
  const count = numberField(details, "count");
  const plusLimit = numberField(details, "plusLimit");
  if (!resource || limit === null || count === null || plusLimit === null) {
    return null;
  }
  return { resource, limit, count, plusLimit };
}

export function planLimitMessage(err: unknown, t: Translate): string | null {
  const reached = planLimitOf(err);
  if (!reached) return null;
  return t("common.error_plan_limit", {
    used: reached.count,
    limit: reached.limit,
    plusLimit: reached.plusLimit,
  });
}

export function resolveApiErrorMessage(
  err: unknown,
  t: Translate,
  fallbackKey: string,
): string {
  const limitMessage = planLimitMessage(err, t);
  if (limitMessage) return limitMessage;
  if (err instanceof ApiError) {
    if (err.status === 0) return t("common.error_network");
    if (err.status === 401 || err.status === 403)
      return t("common.error_session_expired");
    if (err.status === 404) return t("common.error_not_found");
    if (err.status === 429) return t("common.error_too_many");
    if (err.status >= 500) return t("common.error_server");
    return t(fallbackKey);
  }
  return t(fallbackKey);
}
