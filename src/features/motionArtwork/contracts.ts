export interface MotionArtworkResolution {
  /** Primary square canvas; HLS (m3u8) for most Apple releases. */
  videoUrl: string;
  tallVideoUrl?: string;
  albumName?: string;
}

export interface MotionArtworkSettings {
  enabled: boolean;
}

export const DEFAULT_MOTION_ARTWORK_SETTINGS: MotionArtworkSettings = {
  enabled: false,
};
