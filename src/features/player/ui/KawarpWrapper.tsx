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
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLoaded(false);
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [src]);

  return (
    <motion.div
      key={src}
      initial={{ opacity: 0 }}
      animate={{ opacity: loaded ? 1 : 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6, ease: "easeInOut" }}
      className="absolute inset-0 blur-2xl scale-[1.2] transform-gpu"
    >
      <Kawarp
        src={src}
        className="w-full h-full"
        animationSpeed={1.25}
        dithering={0.012}
        onLoad={() => {
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          timeoutRef.current = setTimeout(() => {
            setLoaded(true);
            onLoad?.();
          }, 300);
        }}
        onError={(err) => {
          onError?.(err);
        }}
      />
    </motion.div>
  );
}

export default KawarpWrapper;
