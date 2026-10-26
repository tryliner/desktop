import { memo } from "react";
import { useTheme } from "next-themes";
import { useCoverFluidColors } from "../hooks/useCoverFluidColors";
import { withLightness } from "../lib/lightFluidColors";
import styles from "./MixFluidSquare.module.css";

export interface MixFluidSquareProps {
  coverUrl?: string;
  className?: string;
}

function MixFluidSquare({ coverUrl, className = "" }: MixFluidSquareProps) {
  const fluid = useCoverFluidColors(coverUrl);
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme === "light";
  const color1 = isLight ? withLightness(fluid.color1, 0.62) : fluid.color1;
  const color2 = isLight ? withLightness(fluid.color2, 0.74) : fluid.color2;

  return (
    <div className={`${styles.container} ${className}`}>
      <div className={styles.base} style={{ backgroundColor: color1 }} />
      <div
        className={styles.blobBottomRight}
        style={{ backgroundColor: color2 }}
      />
      <div
        className={styles.blobCenterSwirl}
        style={{ backgroundColor: color2 }}
      />
      <div className={styles.blobTopLeft} style={{ backgroundColor: color1 }} />
    </div>
  );
}

export default memo(MixFluidSquare);
