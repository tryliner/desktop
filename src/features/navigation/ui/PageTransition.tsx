import { memo, Suspense } from "react";

interface PageTransitionProps {
  children: React.ReactNode;
}

function TransitionContent({ children }: PageTransitionProps) {
  return (
    <div className="h-full w-full">
      {children}
    </div>
  );
}

function PageTransition({ children }: PageTransitionProps) {
  return (
    <Suspense fallback={<div className="h-full w-full">{children}</div>}>
      <TransitionContent>{children}</TransitionContent>
    </Suspense>
  );
}

export default memo(PageTransition);
