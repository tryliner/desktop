import { Link } from "react-router-dom";
import { useCallback, useState } from "react";
import ExplicitBadge from "@/shared/ui/ExplicitBadge";
import CoverImage from "@/features/covers/ui/CoverImage";
import { useSongMenuItems } from "@/features/player/hooks/useSongMenuItems";
import DropdownMenu from "@/shared/ui/DropdownMenu";

export interface ReleaseCardProps {
  id: string;
  title: string;
  coverUrl: string;
  releaseType: "single" | "ep";
  year?: string;
  explicit?: boolean;
  className?: string;
}

export default function ReleaseCard({
  id,
  title,
  coverUrl,
  releaseType,
  year,
  explicit = false,
  className = "",
}: ReleaseCardProps) {
  const label = releaseType === "ep" ? "EP" : "Single";

  const menuItems = useSongMenuItems({
    id,
    title,
    artists: "",
    coverUrl,
    searchType: "album",
  });

  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (menuItems.length === 0) return;
      e.preventDefault();
      e.stopPropagation();
      setMenuPosition({ x: e.clientX, y: e.clientY });
      setMenuOpen(true);
    },
    [menuItems],
  );

  const handleMenuOpenChange = useCallback((isOpen: boolean) => {
    setMenuOpen(isOpen);
    if (!isOpen) setMenuPosition(null);
  }, []);

  return (
    <div onContextMenu={handleContextMenu} className="relative">
      <Link
        to={`/collection?type=release&id=${encodeURIComponent(id)}`}
        className={`group flex flex-col gap-[8px] no-underline cursor-pointer ${className}`}
      >
        <div className="relative aspect-square w-full overflow-hidden rounded-md bg-border-alpha-14">
          {coverUrl ? (
            <CoverImage
              src={coverUrl}
              alt={title}
              fill
              sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 16vw"
              className="object-cover transition-all duration-300 group-hover:brightness-[1.15]"
            />
          ) : null}
        </div>
        <div className="flex flex-col">
          <span className="truncate text-[14px] font-[500] text-text-primary">
            {title}
          </span>
          <span className="flex items-center gap-[5px] truncate text-[13px] text-text-tertiary">
            {explicit && <ExplicitBadge />}
            <span>{year ? `${label} • ${year}` : label}</span>
          </span>
        </div>
      </Link>
      {menuItems.length > 0 && (
        <DropdownMenu
          trigger={<span />}
          items={menuItems}
          open={menuOpen}
          onOpenChange={handleMenuOpenChange}
          position={menuPosition}
        />
      )}
    </div>
  );
}
