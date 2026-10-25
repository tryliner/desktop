import { useMemo } from "react";
import { encode } from "uqr";
import { cn } from "@/shared/lib";

export interface QrCodeProps {
  value: string;
  className?: string;
  label?: string;
}

function modulesPath(data: boolean[][]): string {
  const parts: string[] = [];
  data.forEach((row, y) =>
    row.forEach((filled, x) => {
      if (filled) parts.push(`M${x} ${y}h1v1h-1z`);
    }),
  );
  return parts.join("");
}

export default function QrCode({ value, className, label }: QrCodeProps) {
  const { size, path } = useMemo(() => {
    const qr = encode(value, { ecc: "M", border: 0 });
    return { size: qr.size, path: modulesPath(qr.data) };
  }, [value]);

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={label ?? value}
      shapeRendering="crispEdges"
      className={cn("block", className)}
    >
      <path d={path} fill="currentColor" />
    </svg>
  );
}
