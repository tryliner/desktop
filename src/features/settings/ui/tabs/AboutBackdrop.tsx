const ZIGZAG_PATH =
  "M-57.5167 290.49L-76 85.3588L105.852 329.114L83.195 -65.2714L333.614 351L310.361 -76L534.546 334.263L547.663 -54.9719L621 123.982";

export function AboutBackdrop() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 538 328"
      preserveAspectRatio="xMidYMid slice"
      className="pointer-events-none absolute inset-0 size-full text-text-primary"
    >
      <path
        d={ZIGZAG_PATH}
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.02}
        strokeWidth={56}
      />
    </svg>
  );
}
