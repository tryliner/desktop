interface ProgressRingProps {
  value: number;
}

export function ProgressRing({ value }: ProgressRingProps) {
  const radius = 8;
  const circumference = 2 * Math.PI * radius;
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
      <circle
        cx="10"
        cy="10"
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="2"
      />
      <circle
        cx="10"
        cy="10"
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={
          circumference * (1 - Math.min(1, Math.max(0.04, value)))
        }
        transform="rotate(-90 10 10)"
        className="transition-[stroke-dashoffset] duration-300"
      />
      <path
        d="M10 6.5v6m0 0-2.4-2.4M10 12.5l2.4-2.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
