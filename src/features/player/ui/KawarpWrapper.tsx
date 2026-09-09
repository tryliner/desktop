import { useEffect, useRef, useState } from "react";
import { Kawarp } from "@kawarp/react";
import { motion } from "framer-motion";

interface KawarpWrapperProps {
  src?: string;
  onLoad?: () => void;
  onError?: (err: Error) => void;
}

/**
 * KawarpWrapper: WebGL dynamic background shader.
 * Shows blurred backdrop first until WebGL texture finishes loading,
 * then smoothly crossfades into the active shader canvas without visual glitches.
 */
export function KawarpWrapper({ src, onLoad, onError }: KawarpWrapperProps) {
  const [loaded, setLoaded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: loaded ? 1 : 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: "easeInOut" }}
      className="absolute inset-0 scale-[1.2] transform-gpu pointer-events-none"
    >
      <Kawarp
        src={src}
        className="w-full h-full"
        animationSpeed={1.0}
        warpIntensity={1.1}
        blurPasses={8}
        transitionDuration={1000}
        saturation={1.4}
        scale={1.2}
        dithering={0.012}
        onLoad={() => {
          setLoaded(true);
          onLoad?.();
        }}
        onError={(err) => {
          onError?.(err);
        }}
      />
    </motion.div>
  );
}

export default KawarpWrapper;
