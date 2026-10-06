import { memo, useRef, Suspense } from "react";
import { useLocation, useSearchParams } from "react-router-dom";

interface PageTransitionProps {
  children: React.ReactNode;
}

function TransitionContent({ children }: PageTransitionProps) {
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const currentKey = `${pathname}?${searchParams.toString()}`;
  const shellKeyRef = useRef(currentKey);
  if (pathname !== "/player") {
    shellKeyRef.current = currentKey;
  }
  const key = pathname === "/player" ? shellKeyRef.current : currentKey;
  return (
    <div
      key={key}
      className={`h-full w-full ${pathname === "/player" ? "" : "page-transition"}`}
    >
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
