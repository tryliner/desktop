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

export function useYoutubeAccount(): YoutubeAccountState {
  const [session, setSession] = useState(currentSession);
  const [loaded, setLoaded] = useState<LoadedAccounts | null>(null);

  useEffect(() => onYoutubeAuthChanged(() => setSession(currentSession())), []);

  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();
    fetchYoutubeAccounts(controller.signal)
      .catch((): YoutubeAccount[] => [])
      .then((accounts) => {
        if (!controller.signal.aborted) setLoaded({ session, accounts });
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
