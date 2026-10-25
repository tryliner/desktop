const iconProps = {
  width: 14,
  height: 14,
  viewBox: "0 0 14 14",
  fill: "none",
  xmlns: "http://www.w3.org/2000/svg",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className: "pointer-events-none",
};

export function MinimizeIcon() {
  return (
    <svg {...iconProps}>
      <path d="M2 7H12" />
    </svg>
  );
}

export function MaximizeIcon({ isMaximized }: { isMaximized?: boolean }) {
  if (isMaximized) {
    return (
      <svg {...iconProps}>
        <rect x="2" y="4.25" width="7.75" height="7.75" rx="1.75" />
        <path d="M4.5 2H10.25C11.22 2 12 2.78 12 3.75V9.5" />
      </svg>
    );
  }

  return (
    <svg {...iconProps}>
      <rect x="2" y="2" width="10" height="10" rx="2" />
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg {...iconProps}>
      <path d="M2.5 2.5L11.5 11.5M11.5 2.5L2.5 11.5" />
    </svg>
  );
}
