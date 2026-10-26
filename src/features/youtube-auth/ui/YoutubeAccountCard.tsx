import { useState } from "react";
import { YoutubeFill } from "@mingcute/react";
import { useTranslation } from "@/languages";
import { cn } from "@/shared/lib";
import { AccountCard, accountCardActionClassName } from "@/shared/ui";
import { AppImage } from "@/features/covers";
import { signOutYoutube } from "@/shared/youtube";
import { useYoutubeAccount } from "../hooks/useYoutubeAccount";
import { useYoutubeSignInStore } from "../store/youtubeSignInStore";

export default function YoutubeAccountCard() {
  const { t } = useTranslation();
  const { signedIn, account, loading } = useYoutubeAccount();
  const showSignIn = useYoutubeSignInStore((state) => state.show);
  const [signingOut, setSigningOut] = useState(false);

  const signOut = () => {
    setSigningOut(true);
    void signOutYoutube().finally(() => setSigningOut(false));
  };

  const title = signedIn
    ? (account?.name ?? "")
    : t("settings.youtube.signed_out_title") || "Not signed in";
  const subtitle = signedIn
    ? (account?.email ?? account?.handle ?? "")
    : t("settings.youtube.signed_out_description") ||
      "Sign in to keep YouTube playback working";

  return (
    <AccountCard
      media={
        account?.photoUrl ? (
          <AppImage src={account.photoUrl} alt="" fill />
        ) : undefined
      }
      placeholderIcon={<YoutubeFill size={24} />}
      title={title}
      subtitle={subtitle}
      loading={loading}
      action={
        signedIn ? (
          <button
            type="button"
            onClick={signOut}
            disabled={signingOut}
            className={cn(
              accountCardActionClassName,
              "bg-text-primary/70 text-bg-primary/85 hover:bg-text-primary/85",
            )}
          >
            {t("settings.youtube.sign_out") || "Sign out"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => showSignIn("manual")}
            className={cn(
              accountCardActionClassName,
              "bg-text-primary/85 text-bg-primary hover:bg-text-primary",
            )}
          >
            {t("settings.youtube.sign_in") || "Sign in"}
          </button>
        )
      }
    />
  );
}
