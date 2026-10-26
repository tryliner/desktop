export interface LastfmCredentials {
  apiKey: string;
  secret: string;
}

export interface LastfmTrack {
  artist: string;
  track: string;
  album?: string;
  duration: number;
  chosenByUser?: 0 | 1;
}

export interface LastfmListen extends LastfmTrack {
  id: string;
  timestamp: number;
}

export interface LastfmStatus {
  ownerId?: string;
  configured: boolean;
  connected: boolean;
  username?: string;
  authorizing: boolean;
  enabled: boolean;
  nowPlaying: boolean;
  pending: number;
  sessionOnly: boolean;
  error?: string;
}

export interface LastfmBridge {
  status: () => Promise<LastfmStatus>;
  connect: (credentials?: LastfmCredentials) => Promise<LastfmStatus>;
  finish: () => Promise<LastfmStatus>;
  cancel: () => Promise<LastfmStatus>;
  disconnect: () => Promise<LastfmStatus>;
  settings: (patch: {
    enabled?: boolean;
    nowPlaying?: boolean;
  }) => Promise<LastfmStatus>;
  retry: () => Promise<LastfmStatus>;
  updateNowPlaying: (track: LastfmListen) => void;
  scrobble: (listen: LastfmListen) => Promise<boolean>;
  onChange: (cb: (status: LastfmStatus) => void) => () => void;
}
