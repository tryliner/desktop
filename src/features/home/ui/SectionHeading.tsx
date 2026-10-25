import type { CSSProperties, ReactNode } from "react";

export interface SectionHeadingProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  badge?: ReactNode;
  marginTop?: string;
}

const headingStyle: CSSProperties = {
  fontFamily: "var(--font-roboto-flex), sans-serif",
  fontWeight: 564,
  fontVariationSettings:
    "'wght' 564, 'GRAD' 105, 'XOPQ' 100, 'wdth' 134, 'opsz' 144",
};

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
            <div className="flex items-center justify-center shrink-0 w-6 h-6 [&>svg]:w-6 [&>svg]:h-6">
              {icon}
            </div>
          )}
          <h2
            className="font-roboto-flex-heading text-text-primary text-[24px] m-0 leading-none tracking-tight"
            style={headingStyle}
          >
            {title}
          </h2>
          {badge}
        </div>
        {subtitle && (
          <p className="text-[13px] text-text-tertiary m-0 mt-0.5 font-normal">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

export default SectionHeading;
