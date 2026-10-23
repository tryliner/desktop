import type { ComponentType } from "react";
import {
  Home7Fill,
  Search3Fill,
  BookmarksFill,
  Settings4Fill,
  User3Fill,
} from "@mingcute/react";

export interface NavItem {
  id: string;
  label: string;
  href?: string;
  Icon: ComponentType<{ size?: number; className?: string }>;
}

export const sidebarNavItems: NavItem[] = [
  { id: "home", label: "Home", href: "/", Icon: Home7Fill },
  { id: "search", label: "Search", Icon: Search3Fill },
  { id: "library", label: "Library", href: "/library", Icon: BookmarksFill },
  { id: "profile", label: "Profile", href: "/profile", Icon: User3Fill },
  { id: "settings", label: "Settings", Icon: Settings4Fill },
];
