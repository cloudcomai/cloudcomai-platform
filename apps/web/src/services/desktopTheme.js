export const DESKTOP_THEME_IDS = ['light', 'dark', 'system'];
export const DEFAULT_DESKTOP_THEME_ID = 'system';
export const DESKTOP_THEME_STORAGE_KEY = 'cloudcomai.web.desktopTheme.v1';

export function resolveDesktopTheme(id) {
  return DESKTOP_THEME_IDS.includes(id) ? id : DEFAULT_DESKTOP_THEME_ID;
}

export function getStoredDesktopTheme() {
  try {
    return resolveDesktopTheme(window.localStorage.getItem(DESKTOP_THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_DESKTOP_THEME_ID;
  }
}

export function saveDesktopTheme(id) {
  const theme = resolveDesktopTheme(id);
  try {
    window.localStorage.setItem(DESKTOP_THEME_STORAGE_KEY, theme);
  } catch {
    // Private browsing or storage restrictions must not prevent theme selection.
  }
  return theme;
}

export function applyDesktopTheme(id) {
  const theme = resolveDesktopTheme(id);
  if (typeof document === 'undefined' || !document.documentElement) return theme;
  const root = document.documentElement;
  root.dataset.desktopTheme = theme;
  return theme;
}
