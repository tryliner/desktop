import { useId } from "react";

export default function LocalFilesIcon({ size = 18 }: { size?: number }) {
  const maskId = `local-files-${useId().replace(/[^a-zA-Z0-9-]/g, "")}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="220 220 560 560"
      fill="none"
      aria-hidden
    >
      <mask
        id={maskId}
        maskUnits="userSpaceOnUse"
        x="220"
        y="220"
        width="560"
        height="560"
      >
        <rect x="220" y="220" width="560" height="560" fill="white" />
        <path
          transform="translate(365 401) scale(10)"
          d="M18.633 9.177 14 10.72v6.78a4.5 4.5 0 1 1-2-3.743V6.442a3 3 0 0 1 2.051-2.846l3.975-1.325A1.5 1.5 0 0 1 20 3.694v3.585a2 2 0 0 1-1.367 1.898"
          fill="black"
        />
      </mask>
      <path
        mask={`url(#${maskId})`}
        d="M300 320H418C426.5 320 434.4 324.3 439 331.4L460 364H700C722.1 364 740 381.9 740 404V640C740 662.1 722.1 680 700 680H300C277.9 680 260 662.1 260 640V360C260 337.9 277.9 320 300 320Z"
        fill="currentColor"
      />
    </svg>
  );
}
