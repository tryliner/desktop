import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api, toClientTrack } from "@/shared/api";
import { playerEngine } from "@/features/player";

interface DeeplinkTarget {
  type: "artist" | "album" | "playlist" | "track";
  id: string;
}

// user playlist ids are uuids or pl- tokens, everything else is a catalog id
function isUserPlaylistId(id: string): boolean {
  return (
    id.startsWith("pl-") ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  );
}

// opens shared entities arriving via liner:// deeplinks (main pre-validates)
export default function DeeplinkHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    const off = window.linerElectron?.onDeeplink((target: DeeplinkTarget) => {
      void (async () => {
        try {
          switch (target.type) {
            case "artist":
              navigate(`/artist?id=${encodeURIComponent(target.id)}`);
              break;
            case "album":
              navigate(`/collection?type=album&id=${encodeURIComponent(target.id)}`);
              break;
            case "playlist":
              navigate(`/collection?type=playlist&id=${encodeURIComponent(target.id)}`);
              break;
            case "track": {
              const track = toClientTrack(await api.getTrack(target.id));
              playerEngine.playTrack(track, [track], track.artists, track.coverUrl);
              navigate("/player");
              break;
            }
          }
        } catch {
          // unknown id or offline, stay where we are
        }
      })();
    });
    return off;
  }, [navigate]);

  return null;
}
