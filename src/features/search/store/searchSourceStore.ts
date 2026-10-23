import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { CatalogSource, SearchSource } from "@/shared/contracts";
import { debouncedStorage } from "@/shared/utils/storage";

export const AVAILABLE_SEARCH_SOURCES = ["youtube", "soundcloud"] as const;

export interface SearchSourceState {
  enabledSources: CatalogSource[];
  selectedSources: CatalogSource[];
  setSourceEnabled: (source: CatalogSource, enabled: boolean) => void;
  toggleSourceSelected: (source: CatalogSource) => void;
  selectSearchSource: (source: SearchSource) => void;
}

function canonicalSources(value: unknown): CatalogSource[] {
  if (!Array.isArray(value)) return [];
  return AVAILABLE_SEARCH_SOURCES.filter((source) => value.includes(source));
}

function normalizePersistedState(value: unknown): Pick<SearchSourceState, "enabledSources" | "selectedSources"> {
  const persisted = value && typeof value === "object"
    ? value as Partial<Pick<SearchSourceState, "enabledSources" | "selectedSources">>
    : {};
  const storedEnabled = canonicalSources(persisted.enabledSources);
  const enabledSources = storedEnabled.length > 0
    ? storedEnabled
    : [...AVAILABLE_SEARCH_SOURCES];
  const storedSelected = canonicalSources(persisted.selectedSources)
    .filter((source) => enabledSources.includes(source));
  const selectedSources = storedSelected.length > 0
    ? storedSelected
    : [...enabledSources];

  return { enabledSources, selectedSources };
}

export function effectiveSearchSource(selectedSources: readonly CatalogSource[]): SearchSource {
  const selected = canonicalSources(selectedSources);
  return selected.length === 1 ? selected[0] : "all";
}

export const useSearchSourceStore = create<SearchSourceState>()(
  persist(
    (set) => ({
      enabledSources: [...AVAILABLE_SEARCH_SOURCES],
      selectedSources: [...AVAILABLE_SEARCH_SOURCES],
      setSourceEnabled: (source, enabled) =>
        set((state) => {
          const isEnabled = state.enabledSources.includes(source);
          if (enabled === isEnabled) return state;

          if (enabled) {
            return {
              enabledSources: canonicalSources([...state.enabledSources, source]),
            };
          }

          if (state.enabledSources.length === 1) return state;
          const enabledSources = state.enabledSources.filter((item) => item !== source);
          const remainingSelected = state.selectedSources.filter((item) => item !== source);
          return {
            enabledSources: canonicalSources(enabledSources),
            selectedSources: remainingSelected.length > 0
              ? canonicalSources(remainingSelected)
              : canonicalSources(enabledSources),
          };
        }),
      toggleSourceSelected: (source) =>
        set((state) => {
          if (!state.enabledSources.includes(source)) return state;
          if (state.selectedSources.includes(source)) {
            if (state.selectedSources.length === 1) return state;
            return {
              selectedSources: state.selectedSources.filter((item) => item !== source),
            };
          }
          return {
            selectedSources: canonicalSources([...state.selectedSources, source]),
          };
        }),
      selectSearchSource: (source) =>
        set((state) => ({
          selectedSources: source === "all" || !state.enabledSources.includes(source)
            ? [...state.enabledSources]
            : [source],
        })),
    }),
    {
      name: "liner_search_sources",
      storage: createJSONStorage(() => debouncedStorage),
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...normalizePersistedState(persistedState),
      }),
      partialize: ({ enabledSources, selectedSources }) => ({
        enabledSources,
        selectedSources,
      }),
    },
  ),
);
