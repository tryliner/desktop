import type { ReactNode } from "react";

export interface SectionHeadingProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  badge?: ReactNode;
  marginTop?: string;
}

export function SectionHeading({
  title,
  subtitle,
  icon,
  badge,
  marginTop = "mt-[22px]",
}: SectionHeadingProps) {
  return (
    <div className={`${marginTop} px-3 flex items-center justify-between`}>
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2.5">
          {icon && (
            <div className="flex items-center justify-center shrink-0 w-5 h-5 text-text-tertiary [&>svg]:w-5 [&>svg]:h-5">
              {icon}
            </div>
          )}
          <h2 className="font-roboto-flex-heading text-text-primary text-[22px] m-0 leading-none tracking-[-0.02em]">
            {title}
          </h2>
          {badge}
        </div>
        {subtitle && (
          <p className="text-body text-text-tertiary m-0 mt-0.5 font-normal">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

export default SectionHeading;
