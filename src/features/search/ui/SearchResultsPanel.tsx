import type { ReactNode } from "react";

export interface SearchResultsPanelProps {
  children: ReactNode;
  partialWarning?: string;
}

export function SearchResultsPanel({
  children,
  partialWarning,
}: SearchResultsPanelProps) {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      {partialWarning ? (
        <div
          role="status"
          aria-live="polite"
          className="shrink-0 px-[22px] py-[7px] text-[12px] text-accent-tertiary"
        >
          {partialWarning}
        </div>
      ) : null}
      <div className="relative min-h-0 flex-1 overflow-hidden">{children}</div>
    </div>
  );
}

export default SearchResultsPanel;
