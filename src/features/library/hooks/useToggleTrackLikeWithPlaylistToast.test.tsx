import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { toLocalTrackId } from "@/shared/media/local";
import type { ToastOptions } from "@/shared/ui/Toast";
import { useModalStore } from "../store/modalStore";
import { useToggleTrackLike } from "./useLibraryMutations";
import { useToggleTrackLikeWithPlaylistToast } from "./useToggleTrackLikeWithPlaylistToast";

vi.mock("./useLibraryMutations", () => ({
  useToggleTrackLike: vi.fn(),
}));

// @ts-expect-error - act support flag in vitest browserless DOM environment
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

it("offers to add the track to a playlist only after a successful like", async () => {
  const mutation = vi.fn<ReturnType<typeof useToggleTrackLike>>();
  vi.mocked(useToggleTrackLike).mockReturnValue(mutation);
  const track = {
    id: "track-1",
    title: "Song",
    artists: "Artist",
    coverUrl: "",
  };
  const onToast = vi.fn<(event: Event) => void>();
  const container = document.createElement("div");
  const root = createRoot(container);
  window.addEventListener("liner:toast", onToast);

  function LikeButtons() {
    const toggle = useToggleTrackLikeWithPlaylistToast();
    return (
      <>
        <button onClick={() => toggle(track)}>Like</button>
        <button
          onClick={() => toggle({ ...track, id: toLocalTrackId(track.id) })}
        >
          Local
        </button>
      </>
    );
  }

  try {
    await act(async () => root.render(<LikeButtons />));
    const [like, local] = container.querySelectorAll("button");
    local.click();
    expect(mutation).not.toHaveBeenCalled();

    like.click();
    expect(mutation).toHaveBeenCalledWith(track.id, expect.anything());
    expect(onToast).not.toHaveBeenCalled();

    const options = mutation.mock.lastCall?.[1];
    options?.onSuccess?.(false);
    expect(onToast).not.toHaveBeenCalled();

    like.click();
    mutation.mock.lastCall?.[1]?.onError?.(new Error("Like failed"));
    expect(onToast).not.toHaveBeenCalled();

    like.click();
    mutation.mock.lastCall?.[1]?.onSuccess?.(true);
    expect(onToast).toHaveBeenCalledTimes(1);
    const { message, options: toast } = (
      onToast.mock.calls[0][0] as CustomEvent<{
        message: string;
        options: ToastOptions;
      }>
    ).detail;
    expect(message).toBe("Added to Likes");
    expect(toast.action?.label).toBe("Add to playlist");
    expect(toast.duration).toBeUndefined();
    toast.action?.onClick?.();
    expect(useModalStore.getState().addToPlaylistTrack).toEqual(track);
    expect(useModalStore.getState().addToPlaylistOpen).toBe(true);
  } finally {
    window.removeEventListener("liner:toast", onToast);
    useModalStore.getState().closeAddToPlaylist();
    await act(async () => root.unmount());
  }
});
