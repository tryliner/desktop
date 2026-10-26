import { rgbToHsl, hslToRgb } from "@/shared/lib/color";
import {
  createColorBuckets,
  findBestBucket,
  getMonochromePalette,
} from "./colorAnalysis";

export interface FluidColors {
  color1: string;
  color2: string;
  logoColor: string;
}

export const DEFAULT_FLUID_COLORS: FluidColors = {
  color1: "rgb(20, 22, 28)",
  color2: "rgb(120, 140, 175)",
  logoColor: "rgb(235, 242, 250)",
};

export function extractColorsFromImage(img: HTMLImageElement): FluidColors {
  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return DEFAULT_FLUID_COLORS;

    const size = 48;
    canvas.width = size;
    canvas.height = size;
    ctx.drawImage(img, 0, 0, size, size);

    const imgData = ctx.getImageData(0, 0, size, size).data;
    const buckets = createColorBuckets(12);

    let coloredCount = 0;
    let totalCount = 0;
    const darkSum = [0, 0, 0];
    let darkCount = 0;
    const brightSum = [0, 0, 0];
    let brightCount = 0;

    for (let i = 0; i < imgData.length; i += 4) {
      if (imgData[i + 3]! < 128) continue;
      const r = imgData[i]!;
      const g = imgData[i + 1]!;
      const b = imgData[i + 2]!;
      totalCount++;

      const [h, s, l] = rgbToHsl(r, g, b);

      if (l < 0.25) {
        darkSum[0] += r;
        darkSum[1] += g;
        darkSum[2] += b;
        darkCount++;
      } else if (l > 0.65) {
        brightSum[0] += r;
        brightSum[1] += g;
        brightSum[2] += b;
        brightCount++;
      }

      if (s >= 0.16 && l >= 0.12 && l <= 0.88) {
        coloredCount++;
        const bucket = buckets[Math.min(11, Math.floor(h * 12))]!;
        bucket.count++;
        bucket.sSum += s;
        bucket.hSum += h;
      }
    }

    if (totalCount === 0) return DEFAULT_FLUID_COLORS;

    if (coloredCount / totalCount < 0.05) {
      return getMonochromePalette(darkSum, darkCount, brightSum, brightCount);
    }

    const bestBin = findBestBucket(buckets);
    if (bestBin === -1) return DEFAULT_FLUID_COLORS;

    const dom = buckets[bestBin]!;
    const domH = dom.hSum / dom.count;
    const domS = dom.sSum / dom.count;
    const bright = hslToRgb(domH, Math.min(domS * 1.15, 0.95), 0.52);
    const color2 = `rgb(${bright[0]}, ${bright[1]}, ${bright[2]})`;
    const logoRgb = hslToRgb(domH, Math.min(domS * 0.7, 0.45), 0.88);
    const logoColor = `rgb(${logoRgb[0]}, ${logoRgb[1]}, ${logoRgb[2]})`;

    const secondBin = findBestBucket(buckets, bestBin, 0.2);
    if (secondBin !== -1) {
      const sec = buckets[secondBin]!;
      const dark = hslToRgb(
        sec.hSum / sec.count,
        Math.max((sec.sSum / sec.count) * 0.85, 0.35),
        0.24,
      );
      return {
        color1: `rgb(${dark[0]}, ${dark[1]}, ${dark[2]})`,
        color2,
        logoColor,
      };
    }

    const dark = hslToRgb(domH, Math.max(domS * 0.9, 0.35), 0.24);
    return {
      color1: `rgb(${dark[0]}, ${dark[1]}, ${dark[2]})`,
      color2,
      logoColor,
    };
  } catch {
    return DEFAULT_FLUID_COLORS;
  }
}
