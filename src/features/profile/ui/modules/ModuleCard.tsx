import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/shared/lib";

interface ModuleCardProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title?: ReactNode;
  action?: ReactNode;
  /** blurred art behind the content, usually the first cover */
  glow?: ReactNode;
}

/** A profile showcase block: quiet fill, optional heading and cover glow. */
export function ModuleCard({
  title,
  action,
  glow,
  className,
  children,
  ...rest
}: ModuleCardProps) {
  return (
    <section
      className={cn(
        "relative isolate flex min-w-0 flex-col gap-3 overflow-hidden rounded-item bg-fill-subtle p-3",
        className,
      )}
      {...rest}
    >
      {glow}
      {title || action ? (
        <header className="relative z-10 flex min-w-0 items-baseline justify-between gap-3">
          {title ? (
            <h3 className="m-0 truncate text-xl font-[600] tracking-[-0.04em] text-text-primary/80">
              {title}
            </h3>
          ) : null}
          {action}
        </header>
      ) : null}
      {children}
    </section>
  );
}

interface ModuleGlowProps {
  src?: string;
  color?: string;
  className?: string;
}

export function ModuleGlow({ src, color, className }: ModuleGlowProps) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute -inset-x-8 -bottom-16 -z-10 h-36 blur-3xl",
        className,
      )}
      style={color ? { backgroundColor: color } : undefined}
    >
      {src ? <img src={src} alt="" className="size-full object-cover" /> : null}
    </div>
  );
}

export function TrackCover({
  src,
  className,
}: {
  src: string;
  className?: string;
}) {
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      className={cn(
        "size-8 shrink-0 rounded-control object-cover select-none",
        className,
      )}
    />
  );
}

interface TrackTextProps {
  title: string;
  artist: string;
  className?: string;
  titleClassName?: string;
}

export function TrackText({
  title,
  artist,
  className,
  titleClassName,
}: TrackTextProps) {
  return (
    <div
      className={cn("flex min-w-0 flex-col gap-0.5 leading-tight", className)}
    >
      <span
        className={cn(
          "truncate text-label font-[500] text-text-primary",
          titleClassName,
        )}
      >
        {title}
      </span>
      <span className="truncate text-caption text-text-secondary">
        {artist}
      </span>
    </div>
  );
}
