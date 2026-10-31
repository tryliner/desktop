import type {
  ApiBody,
  ApiParams,
  ApiQuery,
  ApiRoute,
  ApiRoutes,
} from "@/shared/contracts";

type Empty = Record<never, never>;

type IsOptional<V> = Empty extends V
  ? true
  : null extends V
    ? true
    : undefined extends V
      ? true
      : false;

type Slot<K extends string, V> = [V] extends [never]
  ? { [P in K]?: never }
  : IsOptional<V> extends true
    ? { [P in K]?: V }
    : { [P in K]: V };

export type RouteInput<R extends ApiRoute> = Slot<"params", ApiParams<R>> &
  Slot<"query", ApiQuery<R>> &
  Slot<"body", ApiBody<R>>;

export type RouteArgs<R extends ApiRoute, Rest extends unknown[] = []> =
  Empty extends RouteInput<R>
    ? [input?: RouteInput<R>, ...rest: Rest]
    : [input: RouteInput<R>, ...rest: Rest];

type Responses<R extends ApiRoute> = ApiRoutes[R]["responses"];

type SuccessStatus = 200 | 201 | 202 | 204;

type SuccessAnswer<R extends ApiRoute> = {
  [S in Extract<keyof Responses<R>, SuccessStatus>]: S extends 204
    ? undefined
    : Responses<R>[S];
}[Extract<keyof Responses<R>, SuccessStatus>];

export type RouteAnswer<R extends ApiRoute> = number extends keyof Responses<R>
  ? unknown
  : SuccessAnswer<R>;

export interface BuiltRoute {
  method: string;
  path: string;
  body?: string;
}

export interface RouteParts {
  params?: object | null;
  query?: object | null;
  body?: unknown;
}

function fillParams(template: string, params: object): string {
  const values = new Map<string, unknown>(Object.entries(params));
  return template.replace(/:([A-Za-z]+)/g, (_, name: string) => {
    const value = values.get(name);
    if (typeof value !== "string" && typeof value !== "number") {
      throw new Error(`missing route param ${name} in ${template}`);
    }
    return encodeURIComponent(String(value));
  });
}

function queryString(query: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

export function buildRoute<R extends ApiRoute>(
  route: R,
  ...args: RouteArgs<R>
): BuiltRoute;
export function buildRoute(route: string, input?: RouteParts): BuiltRoute {
  return buildRouteParts(route, input);
}

export function buildRouteParts(route: string, input?: RouteParts): BuiltRoute {
  const space = route.indexOf(" ");
  const method = route.slice(0, space);
  const template = route.slice(space + 1);
  const path =
    fillParams(template, input?.params ?? {}) + queryString(input?.query ?? {});
  const body =
    input?.body === undefined || input.body === null
      ? undefined
      : JSON.stringify(input.body);
  return body === undefined ? { method, path } : { method, path, body };
}
