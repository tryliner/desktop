import type { Cover as ApiCover } from "./api.generated";

export type { ApiCover };

// artwork as the app holds it: the api Cover (sizes null when unknown), plus
// the fallback url only the client catalogs (soundcloud) know
export type Cover = ApiCover & { fallbackUrl?: string };
