import { useEffect, useState } from "react";
import {
  fetchYoutubeAccount,
  getYoutubeAuthTokens,
  onYoutubeAuthChanged,
  type YoutubeAccount,
} from "@/shared/youtube";

export interface YoutubeAccountState {
  signedIn: boolean;
  account: YoutubeAccount | null;
  loading: boolean;
}

interface LoadedAccount {
  session: string;
  account: YoutubeAccount | null;
}

const currentSession = () => getYoutubeAuthTokens()?.refreshToken ?? null;

export function useYoutubeAccount(): YoutubeAccountState {
  const [session, setSession] = useState(currentSession);
  const [loaded, setLoaded] = useState<LoadedAccount | null>(null);

  useEffect(() => onYoutubeAuthChanged(() => setSession(currentSession())), []);

  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();
    fetchYoutubeAccount(controller.signal)
      .catch(() => null)
      .then((account) => {
        if (!controller.signal.aborted) setLoaded({ session, account });
      });
    return () => controller.abort();
  }, [session]);

  const current = session && loaded?.session === session ? loaded : null;
  return {
    signedIn: session !== null,
    account: current?.account ?? null,
    loading: session !== null && current === null,
  };
}
