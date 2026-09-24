import { StyleSheet } from 'react-native';
import { DEFAULT_CHAT_THEME_ID, resolveChatTheme } from './chatThemeDefinitions.js';

let activeTheme = resolveChatTheme({ id: DEFAULT_CHAT_THEME_ID });

export function setGlobalTheme(themeOrId) {
  activeTheme = resolveChatTheme(typeof themeOrId === 'string' ? { id: themeOrId } : (themeOrId || {}));
  return activeTheme;
}

export function getGlobalTheme() {
  return activeTheme;
}

const COLOR_PROPERTIES = new Set([
  'color', 'backgroundColor', 'borderColor', 'borderTopColor', 'borderRightColor',
  'borderBottomColor', 'borderLeftColor', 'shadowColor', 'textShadowColor', 'tintColor',
]);

const normalize = value => String(value || '').toLowerCase();

function mapColor(property, original) {
  if (typeof original !== 'string' || !original.startsWith('#')) return original;
  const value = normalize(original);
  const colors = activeTheme.colors;
  const primary = normalize(colors.primary);
  const secondary = normalize(colors.textSecondary);
  const muted = normalize(colors.textMuted);
  const background = normalize(colors.background);
  const surface = normalize(colors.surface);
  const border = normalize(colors.border);
  const error = normalize(colors.error);
  const success = normalize(colors.success);
  const warning = normalize(colors.warning);

  if (property === 'backgroundColor') {
    if (value === '#ffffff' || value === '#fff') return colors.surface;
    if (value === '#3157d5' || value === '#2563eb' || value === '#0877d1' || value === '#7c3aed' || value === '#14b8a6') return colors.primary;
    if (value === '#eef2ff' || value === '#eaf5ff' || value === '#f2f5fa' || value === '#fbfcff' || value === '#f8faff' || value === '#f5f7fb') return colors.background;
    if (value === '#edf0f5' || value === '#dfe4ee' || value === '#d8deea') return colors.surfaceSecondary;
    if (value === '#fff1f2' || value === '#fee2e2') return `${colors.error}18`;
    if (value === '#fff7ed' || value === '#fffbeb') return `${colors.warning}18`;
  }

  if (property === 'color' || property === 'textShadowColor') {
    if (value === '#ffffff' || value === '#fff') return colors.textOnPrimary;
    if (value === '#3157d5' || value === '#2563eb' || value === '#0877d1' || value === '#7c3aed' || value === '#14b8a6') return colors.primary;
    if (value === '#172033' || value === '#102a43' || value === '#1f2937' || value === '#111827') return colors.textPrimary;
    if (value === '#68748a' || value === '#52667a' || value === '#64748b') return colors.textSecondary;
    if (value === '#7f8aa3' || value === '#8a94a6') return colors.placeholder;
    if (value === '#dc2626' || value === '#b91c1c') return colors.error;
    if (value === '#166534' || value === '#137333') return colors.success;
    if (value === '#a15c00' || value === '#a16207') return colors.warning;
  }

  if (property.toLowerCase().includes('border')) {
    if (value === '#3157d5' || value === '#2563eb' || value === '#0877d1' || value === '#7c3aed' || value === '#14b8a6') return colors.border;
    if (value === '#d8deea' || value === '#dfe4ee' || value === '#edf0f5' || value === '#e5e7eb') return colors.border;
    if (value === '#dc2626' || value === '#b91c1c') return colors.error;
  }

  if (value === primary || value === secondary || value === muted || value === background || value === surface || value === border || value === error || value === success || value === warning) return original;
  return original;
}

function createThemedStyle(style) {
  if (!style || typeof style !== 'object') return style;
  return new Proxy(style, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (COLOR_PROPERTIES.has(property)) return mapColor(property, value);
      return value;
    },
  });
}

if (!StyleSheet.__cloudcomaiGlobalThemePatched) {
  const nativeCreate = StyleSheet.create.bind(StyleSheet);
  StyleSheet.create = styles => {
    const registered = nativeCreate(styles);
    const themed = {};
    for (const [key, value] of Object.entries(registered)) {
      themed[key] = createThemedStyle(StyleSheet.flatten(value));
    }
    return themed;
  };
  StyleSheet.__cloudcomaiGlobalThemePatched = true;
}
