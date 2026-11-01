import type { LocalTrackRecord } from "@/shared/media/local";

export interface DuplicateGroup {
  keep: LocalTrackRecord;
  remove: LocalTrackRecord[];
}

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

const DURATION_TOLERANCE_MS = 5_000;

function similarDuration(a: number, b: number) {
  if (a <= 0 || b <= 0) return false;
  return Math.abs(a - b) <= DURATION_TOLERANCE_MS;
}

// Records arrive newest-first, so the first copy of each group is kept.
export function findDuplicateGroups(
  records: LocalTrackRecord[],
): DuplicateGroup[] {
  const buckets = new Map<string, LocalTrackRecord[]>();
  for (const record of records) {
    const title = normalize(record.title);
    if (!title) continue;
    const key = `${title}::${normalize(record.artist)}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(record);
    else buckets.set(key, [record]);
  }

  const groups: DuplicateGroup[] = [];
  for (const bucket of buckets.values()) {
    const [keep, ...rest] = bucket;
    const remove = rest.filter((record) =>
      similarDuration(keep.durationMs, record.durationMs),
    );
    if (remove.length > 0) groups.push({ keep, remove });
  }
  return groups;
}
