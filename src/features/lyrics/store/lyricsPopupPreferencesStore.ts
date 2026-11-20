import { create } from "zustand";

export const LYRICS_POPUP_PREFERENCES_KEY =
  "liner_lyrics_popup_preferences_v1";

export interface LyricsPopupPreferences {
  lyricsOnly: boolean;
  showBackground: boolean;
  backgroundDim: number;
  textShadow: boolean;
  shadowSize: number;
  windowShadow: boolean;
  lyricsOpacity: number;
  lyricsColor: string;
  useCustomLyricsColor: boolean;
  textGlow: boolean;
  glowSize: number;
  showSpeedPitchButton: boolean;
  showEqualizerButton: boolean;
  autoHideControls: boolean;
}

export const DEFAULT_LYRICS_POPUP_PREFERENCES: LyricsPopupPreferences = {
  lyricsOnly: false,
  showBackground: true,
  backgroundDim: 0.42,
  textShadow: true,
  shadowSize: 24,
  windowShadow: true,
  lyricsOpacity: 1,
  lyricsColor: "#ffffff",
  useCustomLyricsColor: true,
  textGlow: true,
  glowSize: 16,
  showSpeedPitchButton: true,
  showEqualizerButton: true,
  autoHideControls: true,
};

function normalizePreferences(saved: unknown): LyricsPopupPreferences {
  if (!saved || typeof saved !== "object")
    return DEFAULT_LYRICS_POPUP_PREFERENCES;
  const value = saved as Partial<LyricsPopupPreferences>;
  return {
    lyricsOnly:
      typeof value.lyricsOnly === "boolean"
        ? value.lyricsOnly
        : DEFAULT_LYRICS_POPUP_PREFERENCES.lyricsOnly,
    showBackground:
      typeof value.showBackground === "boolean"
        ? value.showBackground
        : DEFAULT_LYRICS_POPUP_PREFERENCES.showBackground,
    textShadow:
      typeof value.textShadow === "boolean"
        ? value.textShadow
        : DEFAULT_LYRICS_POPUP_PREFERENCES.textShadow,
    textGlow:
      typeof value.textGlow === "boolean"
        ? value.textGlow
        : DEFAULT_LYRICS_POPUP_PREFERENCES.textGlow,
    showSpeedPitchButton:
      typeof value.showSpeedPitchButton === "boolean"
        ? value.showSpeedPitchButton
        : DEFAULT_LYRICS_POPUP_PREFERENCES.showSpeedPitchButton,
    showEqualizerButton:
      typeof value.showEqualizerButton === "boolean"
        ? value.showEqualizerButton
        : DEFAULT_LYRICS_POPUP_PREFERENCES.showEqualizerButton,
    autoHideControls:
      typeof value.autoHideControls === "boolean"
        ? value.autoHideControls
        : DEFAULT_LYRICS_POPUP_PREFERENCES.autoHideControls,
    useCustomLyricsColor:
      typeof value.useCustomLyricsColor === "boolean"
        ? value.useCustomLyricsColor
        : DEFAULT_LYRICS_POPUP_PREFERENCES.useCustomLyricsColor,
    windowShadow:
      typeof value.windowShadow === "boolean"
        ? value.windowShadow
        : DEFAULT_LYRICS_POPUP_PREFERENCES.windowShadow,
    backgroundDim: Math.min(
      0.85,
      Math.max(0.1, Number(value.backgroundDim) || 0.42),
    ),
    shadowSize: Math.min(48, Math.max(0, Number(value.shadowSize) || 0)),
    lyricsOpacity: Math.min(
      1,
      Math.max(0.35, Number(value.lyricsOpacity) || 1),
    ),
    lyricsColor:
      typeof value.lyricsColor === "string" &&
      /^#[\da-f]{6}$/i.test(value.lyricsColor)
        ? value.lyricsColor
        : DEFAULT_LYRICS_POPUP_PREFERENCES.lyricsColor,
    glowSize: Math.min(36, Math.max(0, Number(value.glowSize) || 0)),
  };
}

function readPreferences(): LyricsPopupPreferences {
  try {
    return normalizePreferences(
      JSON.parse(localStorage.getItem(LYRICS_POPUP_PREFERENCES_KEY) || "null"),
    );
  } catch {
    return DEFAULT_LYRICS_POPUP_PREFERENCES;
  }
}

interface LyricsPopupPreferencesState extends LyricsPopupPreferences {
  applyPreferences: (preferences: unknown) => void;
  updatePreference: <K extends keyof LyricsPopupPreferences>(
    key: K,
    value: LyricsPopupPreferences[K],
  ) => void;
}

export const useLyricsPopupPreferencesStore =
  create<LyricsPopupPreferencesState>((set, get) => ({
    ...readPreferences(),
    applyPreferences: (incoming) => {
      const preferences = normalizePreferences(incoming);
      const serialized = JSON.stringify(preferences);
      if (localStorage.getItem(LYRICS_POPUP_PREFERENCES_KEY) !== serialized)
        localStorage.setItem(LYRICS_POPUP_PREFERENCES_KEY, serialized);
      set(preferences);
    },
    updatePreference: (key, value) => {
      const preferences = normalizePreferences({ ...get(), [key]: value });
      localStorage.setItem(
        LYRICS_POPUP_PREFERENCES_KEY,
        JSON.stringify(preferences),
      );
      set({ [key]: value } as Pick<LyricsPopupPreferencesState, typeof key>);
      window.linerElectron?.lyricsPopupUpdatePreferences?.(preferences);
    },
  }));

export function getLyricsPopupPreferences(): LyricsPopupPreferences {
  return normalizePreferences(useLyricsPopupPreferencesStore.getState());
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (
      event.key !== LYRICS_POPUP_PREFERENCES_KEY ||
      event.newValue === null
    ) {
      return;
    }
    try {
      const saved = normalizePreferences(JSON.parse(event.newValue));
      const updatePreference =
        useLyricsPopupPreferencesStore.getState().updatePreference;
      const applyPreferences =
        useLyricsPopupPreferencesStore.getState().applyPreferences;
      useLyricsPopupPreferencesStore.setState({
        ...DEFAULT_LYRICS_POPUP_PREFERENCES,
        ...saved,
        updatePreference,
        applyPreferences,
      });
    } catch {
      // Ignore invalid values written by another renderer.
    }
  });

  window.linerElectron?.onLyricsPopupPreferences?.((preferences: unknown) => {
    useLyricsPopupPreferencesStore
      .getState()
      .applyPreferences(preferences);
  });
  void window.linerElectron?.lyricsPopupGetPreferences?.().then((preferences) => {
    if (preferences) {
      useLyricsPopupPreferencesStore
        .getState()
        .applyPreferences(preferences);
    }
  });
}
