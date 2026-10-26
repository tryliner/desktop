const ZIGZAG_PATH =
  "M113.26 280.51L0 155.32L321.65 280.51L202.12 95.77L459.83 309L282.96 0L504 142.58";

export default function LogoPattern() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 504 309"
      overflow="visible"
      className="pointer-events-none absolute -bottom-[70px] -right-[90px] h-[309px] w-[504px] text-text-primary blur-[8px]"
    >
      <path
        d={ZIGZAG_PATH}
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.05}
        strokeWidth={34}
        strokeLinejoin="miter"
      />
    </svg>
  );
}
