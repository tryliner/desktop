import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { debouncedStorage } from "@/shared/utils/storage";
import type { SearchSource } from "@/shared/contracts";

export type SearchHistoryItemType =
  | "track"
  | "artist"
  | "album"
  | "playlist"
  | "query";

export interface SearchHistoryItem {
  id: string;
  type: SearchHistoryItemType;
  title: string;
  subtitle?: string;
  coverUrl?: string;
  explicit?: boolean;
  duration?: string;
  durationMs?: number;
  itemData?: any;
  source?: SearchSource;
  timestamp: number;
}

function normalizedQuery(title: string): string {
  return title.trim().toLowerCase();
}

export function queryHistoryId(title: string, source: SearchSource): string {
  return `query:${source}:${normalizedQuery(title)}`;
}

export interface SearchHistoryState {
  items: SearchHistoryItem[];
  addItem: (item: Omit<SearchHistoryItem, "timestamp">) => void;
  removeItem: (id: string) => void;
  clearHistory: () => void;
}

const SEARCH_HISTORY_STORAGE_KEY = "liner_search_history";
const MAX_HISTORY_ITEMS = 30;

export const useSearchHistoryStore = create<SearchHistoryState>()(
  persist(
    (set) => ({
      items: [],
      addItem: (item) =>
        set((state) => {
          const filtered = state.items.filter((it) => {
            if (item.type === "query" && it.type === "query") {
              const sameQuery = normalizedQuery(it.title) === normalizedQuery(item.title);
              const sameSource = (it.source ?? "all") === (item.source ?? "all");
              return !(sameQuery && sameSource);
            }
            return it.id !== item.id;
          });
          const newItem: SearchHistoryItem = {
            ...item,
            timestamp: Date.now(),
          };
          return {
            items: [newItem, ...filtered].slice(0, MAX_HISTORY_ITEMS),
          };
        }),
      removeItem: (id) =>
        set((state) => ({
          items: state.items.filter((it) => it.id !== id),
        })),
      clearHistory: () => set({ items: [] }),
    }),
    {
      name: SEARCH_HISTORY_STORAGE_KEY,
      storage: createJSONStorage(() => debouncedStorage),
    },
  ),
);
