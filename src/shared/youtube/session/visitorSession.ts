import { parseVisitorData } from "./visitorData";

/**
 * Client-side YouTube visitorData session manager.
 * Fetches fresh, authentic visitorData directly from the client's residential IP
 * and caches it in-memory / session for up to 6 hours.
 */

interface VisitorSession {
  visitorData: string;
  expiresAt: number;
}

let cachedSession: VisitorSession | null = null;
let pendingFetch: Promise<string> | null = null;

const SESSION_TTL_MS = 5.5 * 60 * 60 * 1000; // 5.5 hours

export function resetClientVisitorData(): void {
  cachedSession = null;
}

export async function getClientVisitorData(): Promise<string> {
  const now = Date.now();
  if (cachedSession && cachedSession.expiresAt > now) {
    return cachedSession.visitorData;
  }

  if (pendingFetch) {
    return pendingFetch;
  }

  pendingFetch = (async () => {
    try {
      const res = await fetch("https://www.youtube.com/sw.js_data", {
        headers: {
          "user-agent":
            typeof navigator !== "undefined"
              ? navigator.userAgent
              : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });

      if (!res.ok) {
        throw new Error(`sw.js_data returned ${res.status}`);
      }

      const text = await res.text();
      const visitorData = parseVisitorData(text);
      if (!visitorData) {
        throw new Error("Could not parse visitorData from sw.js_data");
      }

      cachedSession = {
        visitorData,
        expiresAt: Date.now() + SESSION_TTL_MS,
      };

      console.info(
        `%c[VisitorSession]%c Ready: ${visitorData.slice(0, 16)}... (valid 5.5h)`,
        "color: #10b981; font-weight: bold;",
        "color: inherit;",
      );

      return visitorData;
    } catch (err) {
      console.warn("[VisitorSession] Failed to fetch fresh visitorData:", err);
      // Fallback: if cached exists even if slightly expired, keep it
      if (cachedSession?.visitorData) {
        return cachedSession.visitorData;
      }
      return "";
    } finally {
      pendingFetch = null;
    }
  })();

  return pendingFetch;
}

/**
 * Eagerly warm up the client's visitorData on app launch in the background.
 */
export function initClientVisitorSession(): void {
  void getClientVisitorData().catch(() => {});
}
