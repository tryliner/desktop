import { useTheme } from "next-themes";
import likesCover from "@/assets/likes-cover.svg";
import { buildLightLikesCoverSvg, svgToDataUrl } from "../lib/likesCoverPalette";

let lightCover: string | null = null;

function getLightCover(): string {
  lightCover ??= svgToDataUrl(buildLightLikesCoverSvg());
  return lightCover;
}

export function useLikesCover(): string {
  const { resolvedTheme } = useTheme();
  if (resolvedTheme === "light") return getLightCover();
  return likesCover;
}
