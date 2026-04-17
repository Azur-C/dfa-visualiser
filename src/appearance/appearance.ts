import type { AppearanceTheme } from "../appTypes"

export const APPEARANCE_STORAGE_KEY = "dfa-editor.appearance-theme"

export const APPEARANCE_THEMES: Array<{ id: AppearanceTheme; label: string; description: string }> = [
  {
    id: "light",
    label: "Light",
    description: "Default bright workspace theme.",
  },
  {
    id: "dark",
    label: "Dark",
    description: "Low-glare theme for dimmer environments.",
  },
  {
    id: "colourBlind",
    label: "Colour-blind",
    description: "High-contrast blue/orange palette that avoids red-green reliance.",
  },
]

export function isAppearanceTheme(value: string | null): value is AppearanceTheme {
  return APPEARANCE_THEMES.some((theme) => theme.id === value)
}

export function getInitialAppearanceTheme(): AppearanceTheme {
  try {
    const storedTheme = window.localStorage.getItem(APPEARANCE_STORAGE_KEY)
    if (isAppearanceTheme(storedTheme)) return storedTheme
  } catch {
    // Ignore storage access errors and fall back to the default theme.
  }

  return "light"
}
