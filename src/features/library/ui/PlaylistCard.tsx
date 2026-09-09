import { Link } from "react-router-dom";
import { memo, useCallback, useState } from "react";
import { PlaylistFill } from "@mingcute/react";
import DropdownMenu from "@/shared/ui/DropdownMenu";
import type { DropdownMenuItem } from "@/shared/ui/DropdownMenu";
import type { PlaylistVariant } from "../types";
import CoverImage from "@/features/covers/ui/CoverImage";

export interface PlaylistCardProps {
  title: string;
  author: string;
  imageUrl: string;
  coverUrls?: string[];
  variant?: PlaylistVariant;
  href?: string;
  onClick?: () => void;
  className?: string;
  menuItems?: DropdownMenuItem[];
}

function CoverCollage({ urls, title }: { urls: string[]; title: string }) {
  const count = Math.min(urls.length, 4);

  if (count === 1) {
    return (
      <CoverImage
        src={urls[0]}
        alt={title}
        fill
        sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 16vw"
        className="object-cover transition-all duration-300 group-hover:brightness-[1.15]"
        draggable={false}
        unoptimized
      />
    );
  }

  const cells = urls.slice(0, count);

  return (
    <div className="absolute inset-0 grid grid-cols-2 gap-[1.5px] bg-border-alpha-8">
      {cells.map((url, i) => {
        const spanFull = count === 3 && i === 0;
        return (
          <div
            key={i}
            className={`relative overflow-hidden${spanFull ? " row-span-2" : ""}`}
          >
            <CoverImage
              src={url}
              alt={`${title} cover ${i + 1}`}
              fill
              sizes="(max-width: 768px) 25vw, 12vw"
              className="object-cover transition-all duration-300 group-hover:brightness-[1.15]"
              draggable={false}
              unoptimized
            />
          </div>
        );
      })}
    </div>
  );
}

function PlaylistCard({
  title,
  author,
  imageUrl,
  coverUrls,
  variant = "playlist",
  href,
  onClick,
  className = "",
  menuItems,
}: PlaylistCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const effectiveUrls =
    coverUrls && coverUrls.length > 0
      ? coverUrls
      : imageUrl
        ? [imageUrl]
        : [];
  const hasCollage = effectiveUrls.length >= 2;

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

  const cardContent = (
    <>
      <div
        className={`relative aspect-square w-full overflow-hidden bg-border-alpha-14 ${
          variant === "artist" ? "rounded-full" : "rounded-md"
        } flex items-center justify-center`}
      >
        {effectiveUrls.length > 0 ? (
          hasCollage ? (
            <CoverCollage urls={effectiveUrls} title={title} />
          ) : (
            <CoverImage
              src={effectiveUrls[0]}
              alt={title}
              fill
              sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 16vw"
              className="object-cover transition-all duration-300 group-hover:brightness-[1.15]"
              draggable={false}
              unoptimized
            />
          )
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <PlaylistFill
              size={32}
              color="var(--color-border-alpha-33)"
              className="text-border-alpha-33"
            />
          </div>
        )}
      </div>
      <div
        className={`flex flex-col ${
          variant === "artist" ? "items-center text-center" : ""
        }`}
      >
        <span className="truncate text-[14px] font-[500] text-text-primary">
          {title}
        </span>
        <span className="truncate text-[13px] text-text-tertiary">
          {author}
        </span>
      </div>
    </>
  );

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

  if (href) {
    return (
      <div onContextMenu={handleContextMenu}>
        <Link
          to={href}
          className={`group flex flex-col gap-[8px] no-underline ${className}`}
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
        >
          {cardContent}
        </Link>
        {menu}
      </div>
    );
  }

  if (onClick) {
    return (
      <div onContextMenu={handleContextMenu}>
        <button
          type="button"
          onClick={onClick}
          className={`group flex flex-col gap-[8px] text-left border-0 bg-transparent p-0 w-full cursor-pointer transition-transform active:scale-[0.98] ${className}`}
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
        >
          {cardContent}
        </button>
        {menu}
      </div>
    );
  }

  return (
    <div onContextMenu={handleContextMenu}>
      <div
        className={`group flex flex-col gap-[8px] ${className}`}
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
      >
        {cardContent}
      </div>
      {menu}
    </div>
  );
}

export default memo(PlaylistCard);
