import { Link } from "react-router-dom";
import { User3Fill } from "@mingcute/react";

interface GuestProfileBannerProps {
  onSignInClick?: () => void;
}

export function GuestProfileBanner({ onSignInClick }: GuestProfileBannerProps) {
  return (
    <div
      role="alert"
      className="w-full mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 flex flex-col sm:flex-row items-center justify-between gap-4 backdrop-blur-md"
    >
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-amber-500/20 text-amber-300 shrink-0">
          <User3Fill size={20} />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-text-primary">
            Guest Listener Mode
          </h4>
          <p className="text-xs text-text-secondary mt-0.5">
            Sign in to save your profile and track listening statistics.
          </p>
        </div>
      </div>
      <Link
        to="/login"
        onClick={onSignInClick}
        className="px-4 py-2 rounded-lg bg-accent text-accent-foreground text-xs font-medium hover:opacity-90 active:scale-95 transition-all whitespace-nowrap"
      >
        Sign In
      </Link>
    </div>
  );
}

export default GuestProfileBanner;
