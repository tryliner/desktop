import { memo, useMemo } from "react";

export function ambientGlowClass(hour: number): string {
  if (hour >= 5 && hour < 12) {
    return "from-amber-500/30 via-orange-500/15 to-transparent";
  }
  if (hour >= 12 && hour < 17) {
    return "from-amber-400/30 via-sky-500/15 to-transparent";
  }
  if (hour >= 17 && hour < 22) {
    return "from-rose-500/30 via-purple-500/15 to-transparent";
  }
  return "from-indigo-600/35 via-violet-600/22 to-transparent";
}

function AmbientTopGlow() {
  const glowClass = useMemo(() => ambientGlowClass(new Date().getHours()), []);

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute top-0 left-0 z-0 w-[520px] h-[280px] bg-gradient-to-br ${glowClass} blur-3xl`}
    />
  );
}

export default memo(AmbientTopGlow);
