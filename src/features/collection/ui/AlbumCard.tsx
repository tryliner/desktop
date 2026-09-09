import { Link } from "react-router-dom";
import { memo, useCallback, useState } from "react";
import DropdownMenu from "@/shared/ui/DropdownMenu";
import type { DropdownMenuItem } from "@/shared/ui/DropdownMenu";
import ExplicitBadge from "@/shared/ui/ExplicitBadge";
import CoverImage from "@/features/covers/ui/CoverImage";

export interface AlbumCardProps {
  id: string;
  title: string;
  coverUrl: string;
  year?: string;
  explicit?: boolean;
  trackCount?: number;
  className?: string;
  menuItems?: DropdownMenuItem[];
}

function AlbumCard({
  id,
  title,
  coverUrl,
  year,
  explicit = false,
  trackCount,
  className = "",
  menuItems,
}: AlbumCardProps) {
  const subtitle = [year, trackCount ? `${trackCount} tracks` : undefined]
    .filter(Boolean)
    .join(" • ");

  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (!menuItems || menuItems.length === 0) return;
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

  const menu =
    menuItems && menuItems.length > 0 ? (
      <DropdownMenu
        trigger={<span />}
        items={menuItems}
        open={menuOpen}
        onOpenChange={handleMenuOpenChange}
        position={menuPosition}
      />
    ) : null;

  return (
    <div onContextMenu={handleContextMenu}>
      <Link
        to={`/collection?type=album&id=${encodeURIComponent(id)}`}
        className={`group flex flex-col gap-[8px] no-underline cursor-pointer ${className}`}
      >
        <div className="relative aspect-square w-full overflow-hidden rounded-md bg-border-alpha-14">
          {coverUrl && (
            <CoverImage
              src={coverUrl}
              alt={title}
              fill
              sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 16vw"
              className="object-cover transition-all duration-300 group-hover:brightness-[1.15]"
            />
          )}
        </div>
        <div className="flex flex-col">
          <span className="truncate text-[14px] font-[500] text-text-primary">
            {title}
          </span>
          <span className="flex items-center gap-[5px] truncate text-[13px] text-text-tertiary">
            {explicit && <ExplicitBadge />}
            <span className="truncate">{subtitle}</span>
          </span>
        </div>
      </Link>
      {menu}
    </div>
  );
}

export default memo(AlbumCard);
