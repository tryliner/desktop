type Translate = (
  key: string,
  vars?: Record<string, string | number>,
) => string;

export function formatListenedTime(ms: number, t: Translate): string {
  const minutes = Math.floor(ms / 60000);
  return t("profile.listened_time", {
    hours: Math.floor(minutes / 60),
    minutes: minutes % 60,
  });
}

export function formatPlaylistMeta(
  trackCount: number,
  durationMs: number,
  t: Translate,
): string {
  const minutes = Math.floor(durationMs / 60000);
  const hours = Math.floor(minutes / 60);
  const duration =
    hours > 0
      ? `${hours} ${t("playlist.hr")} ${minutes % 60} ${t("playlist.min")}`
      : `${minutes} ${t("playlist.min")}`;
  return `${t("profile.tracks", { count: trackCount })} · ${duration}`;
}

export function formatPlayedAgo(playedAt: number, t: Translate): string {
  const minutes = Math.max(1, Math.floor((Date.now() - playedAt) / 60000));
  if (minutes < 60) return t("profile.minutes_ago", { count: minutes });
  return t("profile.hours_ago", { count: Math.floor(minutes / 60) });
}

export function weekdayLabels(locale: string): string[] {
  const format = new Intl.DateTimeFormat(locale, { weekday: "short" });
  // 2024-01-01 is a monday
  return Array.from({ length: 7 }, (_, day) =>
    format.format(new Date(2024, 0, 1 + day)),
  );
}
