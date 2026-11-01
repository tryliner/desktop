import { useEffect, useState } from "react";
import {
  fetchYoutubeAccounts,
  getYoutubeSessionKey,
  onYoutubeAuthChanged,
  selectedYoutubeAccount,
  type YoutubeAccount,
} from "@/shared/youtube";

export interface YoutubeAccountState {
  signedIn: boolean;
  account: YoutubeAccount | null;
  accounts: YoutubeAccount[];
  loading: boolean;
}

interface LoadedAccounts {
  session: string;
  accounts: YoutubeAccount[];
}

const currentSession = getYoutubeSessionKey;
const CACHE_STORAGE_KEY = "liner_youtube_accounts_cache_v1";

function readCachedAccounts(sessionKey: string | null): LoadedAccounts | null {
  if (!sessionKey || typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      parsed.session === sessionKey &&
      Array.isArray(parsed.accounts)
    ) {
      return parsed as LoadedAccounts;
    }
  } catch {}
  return null;
}

function writeCachedAccounts(data: LoadedAccounts) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

function clearCachedAccounts() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(CACHE_STORAGE_KEY);
  } catch {}
}

export function useYoutubeAccount(): YoutubeAccountState {
  const [session, setSession] = useState(currentSession);
  const [loaded, setLoaded] = useState<LoadedAccounts | null>(() =>
    readCachedAccounts(currentSession()),
  );

  useEffect(() => {
    return onYoutubeAuthChanged(() => {
      const nextSession = currentSession();
      setSession(nextSession);
      if (!nextSession) {
        setLoaded(null);
        clearCachedAccounts();
      } else {
        const cached = readCachedAccounts(nextSession);
        if (cached) {
          setLoaded(cached);
        }
      }
    });
  }, []);

  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();
    let didFail = false;
    fetchYoutubeAccounts(controller.signal)
      .catch((): YoutubeAccount[] => {
        didFail = true;
        return [];
      })
      .then((accounts) => {
        if (!controller.signal.aborted) {
          if (accounts.length > 0) {
            const nextLoaded = { session, accounts };
            setLoaded(nextLoaded);
            writeCachedAccounts(nextLoaded);
          } else if (didFail) {
            // Keep previously cached accounts for this session on fetch failure
            setLoaded((prev) => {
              if (prev && prev.session === session && prev.accounts.length > 0) {
                return prev;
              }
              return { session, accounts: [] };
            });
          } else {
            // Successful response with zero accounts
            const emptyLoaded = { session, accounts: [] };
            setLoaded(emptyLoaded);
            writeCachedAccounts(emptyLoaded);
          }
        }
      });
    return () => controller.abort();
  }, [session]);

  const current = session && loaded?.session === session ? loaded : null;
  const accounts = current?.accounts ?? [];
  return {
    signedIn: session !== null,
    account: selectedYoutubeAccount(accounts),
    accounts,
    loading: session !== null && current === null,
  };
}
