import { innertubeCatalog } from "@/shared/media/innertube";
import { api, toClientTrack } from "@/shared/api";
import { getLocalListeningHistory } from "./localHistoryService";
import type { DailyMix } from "../hooks/useDailyMixes";
import type { Track as ClientTrack } from "@/shared/types";
import type { Track as ContractTrack } from "@/shared/contracts";

const FALLBACK_SEEDS: MixSeed[] = [
  {
    trackId: "dQw4w9WgXcQ",
    artistName: "Rick Astley",
    title: "Never Gonna Give You Up",
    affinityScore: 0,
  },
  {
    trackId: "9bZkp7q19f0",
    artistName: "Wiz Khalifa",
    title: "Black and Yellow",
    affinityScore: 0,
  },
  {
    trackId: "kXYiU_JCYtU",
    artistName: "Linkin Park",
    title: "Numb",
    affinityScore: 0,
  },
  {
    trackId: "fJ9rUzIMcZQ",
    artistName: "Queen",
    title: "Bohemian Rhapsody",
    affinityScore: 0,
  },
];

interface MixSeed {
  trackId: string;
  artistName: string;
  title: string;
  affinityScore: number;
}

export async function generateYtDailyMixes(signal?: AbortSignal): Promise<DailyMix[]> {
  const seeds = await resolveUserMixSeeds(signal);
  const mixes: DailyMix[] = [];
  const usedTrackIds = new Set<string>();

  const initialMixes = await Promise.allSettled(
    seeds.slice(0, 4).map((seed, idx) => generateSingleMix(seed, idx + 1, signal))
  );

  for (let i = 0; i < initialMixes.length; i++) {
    const res = initialMixes[i];
    if (res.status === "fulfilled" && res.value && res.value.tracks.length > 0) {
      mixes.push(res.value);
      usedTrackIds.add(seeds[i].trackId);
    }
  }

  if (mixes.length > 0 && mixes.length < 4) {
    const candidateTracks: ClientTrack[] = [];
    for (const mix of mixes) {
      for (const track of mix.tracks) {
        if (!usedTrackIds.has(track.id)) {
          candidateTracks.push(track);
        }
      }
    }

    const seenArtists = new Set(
      mixes
        .map((m) => m.clusterArtists[0]?.toLowerCase())
        .filter((s): s is string => Boolean(s))
    );

    for (const track of candidateTracks) {
      if (mixes.length >= 4) break;
      const artist = track.artists?.split(",")?.[0]?.trim() || "";
      const lower = artist.toLowerCase();
      if (artist && !seenArtists.has(lower) && !usedTrackIds.has(track.id)) {
        seenArtists.add(lower);
        usedTrackIds.add(track.id);
        try {
          const mix = await generateSingleMix(
            {
              trackId: track.id,
              artistName: artist,
              title: track.title,
              affinityScore: 1,
            },
            mixes.length + 1,
            signal
          );
          if (mix && mix.tracks.length > 0) {
            mixes.push(mix);
          }
        } catch {}
      }
    }
  }

  if (mixes.length < 4) {
    for (const fallback of FALLBACK_SEEDS) {
      if (mixes.length >= 4) break;
      if (usedTrackIds.has(fallback.trackId)) continue;
      usedTrackIds.add(fallback.trackId);
      try {
        const mix = await generateSingleMix(fallback, mixes.length + 1, signal);
        if (mix && mix.tracks.length > 0) {
          mixes.push(mix);
        }
      } catch {}
    }
  }

  return mixes.slice(0, 4).map((m, idx) => ({
    ...m,
    id: `daily-mix-${idx + 1}-${m.tracks[0]?.id || idx + 1}`,
    title: `Daily Mix ${idx + 1}`,
  }));
}

async function fetchRemoteHistoryBounded(
  signal?: AbortSignal,
  timeoutMs = 3500
): Promise<{ items?: any[] }> {
  return new Promise((resolve) => {
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve({ items: [] });
      }
    }, timeoutMs);

    const onAbort = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve({ items: [] });
      }
    };

    if (signal?.aborted) {
      onAbort();
      return;
    }

    signal?.addEventListener("abort", onAbort, { once: true });

    api
      .getHistory(undefined, 50)
      .then((res) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          signal?.removeEventListener("abort", onAbort);
          resolve(res || { items: [] });
        }
      })
      .catch(() => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          signal?.removeEventListener("abort", onAbort);
          resolve({ items: [] });
        }
      });
  });
}

async function resolveUserMixSeeds(signal?: AbortSignal): Promise<MixSeed[]> {
  const localHistory = getLocalListeningHistory();
  const remoteHistory = await fetchRemoteHistoryBounded(signal, 3500);

  const artistAffinity = new Map<
    string,
    { bestTrackId: string; bestTrackTitle: string; displayName: string; totalScore: number }
  >();

  for (const entry of localHistory) {
    const artist = entry.artist.split(",")[0]?.trim() || "Artist";
    const key = artist.toLowerCase();
    const score =
      (entry.completed ? 3 : 1) +
      Math.floor(entry.playedDurationMs / 30000) +
      entry.loopCount * 2;

    const existing = artistAffinity.get(key);
    if (!existing || existing.totalScore < score) {
      artistAffinity.set(key, {
        bestTrackId: entry.trackId,
        bestTrackTitle: entry.title,
        displayName: artist,
        totalScore: (existing?.totalScore || 0) + score,
      });
    } else {
      existing.totalScore += score;
    }
  }

  for (const item of remoteHistory.items || []) {
    const track = item.track;
    if (!track?.id) continue;
    const artist = track.artists?.[0]?.name || "Artist";
    const key = artist.toLowerCase();
    const score = (item.completed ? 3 : 1) + Math.floor((item.playedDurationMs || 0) / 30000);

    const existing = artistAffinity.get(key);
    if (!existing) {
      artistAffinity.set(key, {
        bestTrackId: track.id,
        bestTrackTitle: track.title,
        displayName: artist,
        totalScore: score,
      });
    } else {
      existing.totalScore += score;
    }
  }

  const sortedClusters = [...artistAffinity.entries()]
    .sort((a, b) => b[1].totalScore - a[1].totalScore)
    .slice(0, 4);

  if (sortedClusters.length > 0) {
    return sortedClusters.map(([, data]) => ({
      trackId: data.bestTrackId,
      artistName: data.displayName,
      title: data.bestTrackTitle,
      affinityScore: data.totalScore,
    }));
  }

  return FALLBACK_SEEDS;
}

async function generateSingleMix(seed: MixSeed, mixNumber: number, signal?: AbortSignal): Promise<DailyMix> {
  const radio = await innertubeCatalog.getRadio(seed.trackId, { k: 25, signal });
  const clientTracks: ClientTrack[] = (radio.items || []).map((t: ContractTrack) => toClientTrack(t));

  const uniqueArtists: string[] = [];
  const seen = new Set<string>();

  for (const track of clientTracks) {
    const names = (track.artists || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    for (const name of names) {
      const lower = name.toLowerCase();
      if (!seen.has(lower) && lower !== "unknown") {
        seen.add(lower);
        uniqueArtists.push(name);
      }
    }
  }

  const primaryCover = clientTracks.find((t) => Boolean(t.coverUrl))?.coverUrl || "";

  return {
    id: `daily-mix-${mixNumber}-${seed.trackId}`,
    title: `Daily Mix ${mixNumber}`,
    description: `Curated around ${seed.artistName} and related styles`,
    clusterArtists: uniqueArtists.slice(0, 4),
    coverUrl: primaryCover,
    trackCount: clientTracks.length,
    tracks: clientTracks,
  };
}
