export interface ColorBucket {
  count: number;
  sSum: number;
  hSum: number;
}

export function createColorBuckets(count = 12): ColorBucket[] {
  return Array.from({ length: count }, () => ({
    count: 0,
    sSum: 0,
    hSum: 0,
  }));
}

export function findBestBucket(
  buckets: ColorBucket[],
  excludeBin = -1,
  minCountRatio = 0,
): number {
  let bestBin = -1;
  let bestScore = -1;
  const threshold =
    excludeBin >= 0 && minCountRatio > 0
      ? (buckets[excludeBin]?.count ?? 0) * minCountRatio
      : 0;

  for (let i = 0; i < buckets.length; i++) {
    if (i === excludeBin) continue;
    const b = buckets[i];
    if (!b || b.count === 0 || b.count < threshold) continue;
    if (excludeBin >= 0) {
      const diff = Math.abs(i - excludeBin);
      if (Math.min(diff, buckets.length - diff) < 2) continue;
    }
    const score = b.count * (0.3 + (b.sSum / b.count) * 0.7);
    if (score > bestScore) {
      bestScore = score;
      bestBin = i;
    }
  }

  return bestBin;
}

export function getMonochromePalette(
  darkSum: number[],
  darkCount: number,
  brightSum: number[],
  brightCount: number,
) {
  const d =
    darkCount > 0
      ? darkSum.map((v) => Math.min(Math.round(v / darkCount), 30))
      : [18, 20, 24];
  const b =
    brightCount > 0
      ? brightSum.map((v) => Math.max(Math.round(v / brightCount), 180))
      : [190, 200, 215];
  return {
    color1: `rgb(${d[0]}, ${d[1]}, ${d[2]})`,
    color2: `rgb(${b[0]}, ${b[1]}, ${b[2]})`,
    logoColor: "rgb(235, 242, 250)",
  };
}
