export type Codec = 'opus' | 'aac';

export type CodecPreference = Codec | undefined;

export interface PlaybackSessionResponse {
  sessionId: string;
  trackId: string;
  streamUrl: string;
  codec: Codec;
  bitrate: number;
  mimeType: string;
  expiresAt: string;
  transport?: 'proxy';
  playbackId?: string;
}

export type ApiPlaybackSession = PlaybackSessionResponse;
export type PlaybackSession = PlaybackSessionResponse;
