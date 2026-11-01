import { ipcMain, net } from "electron";

export interface ListenBrainzResponse {
  ok: boolean;
  status: number;
  data: unknown;
  error?: string;
}

interface ListenBrainzRequest {
  method?: unknown;
  path?: unknown;
  token?: unknown;
  body?: unknown;
}

// Main-process proxy so the renderer never hits CORS on the ListenBrainz API.
export function setupListenBrainz() {
  ipcMain.handle(
    "listenbrainz:request",
    async (_event, input: ListenBrainzRequest): Promise<ListenBrainzResponse> => {
      const method = input?.method === "POST" ? "POST" : "GET";
      const requestPath =
        typeof input?.path === "string" && input.path.startsWith("/1/")
          ? input.path
          : null;
      const token = typeof input?.token === "string" ? input.token.trim() : "";
      if (!requestPath || token.length === 0) {
        return { ok: false, status: 0, data: null, error: "Invalid request" };
      }
      try {
        const response = await net.fetch(
          `https://api.listenbrainz.org${requestPath}`,
          {
            method,
            headers: {
              Authorization: `Token ${token}`,
              "Content-Type": "application/json",
            },
            body:
              method === "POST" && input.body !== undefined
                ? JSON.stringify(input.body)
                : undefined,
          },
        );
        const text = await response.text();
        let data: unknown = null;
        try {
          data = text ? JSON.parse(text) : null;
        } catch {
          data = text;
        }
        return { ok: response.ok, status: response.status, data };
      } catch (error) {
        return {
          ok: false,
          status: 0,
          data: null,
          error: error instanceof Error ? error.message : "Network error",
        };
      }
    },
  );
}
