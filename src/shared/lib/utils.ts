import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// the design token scales from globals.css; without them twMerge reads
// text-body as a text color and drops it next to text-text-primary
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["caption", "body", "label", "title", "heading"],
      radius: ["control", "item", "panel"],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
