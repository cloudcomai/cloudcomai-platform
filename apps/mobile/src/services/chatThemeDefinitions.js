const THEMES = {
  'modern-blue': {
    id: 'modern-blue',
    label: 'CloudCom Blue',
    colors: {
      primary: '#0877D1', primaryDark: '#075FA8', primaryLight: '#EAF5FF', background: '#F7FAFC', surface: '#FFFFFF', surfaceSecondary: '#F0F6FB', incoming: '#FFFFFF', outgoing: '#0877D1', text: '#102A43', textPrimary: '#102A43', textSecondary: '#52667A', textMuted: '#718096', textOnPrimary: '#FFFFFF', secondary: '#52667A', placeholder: '#718096', disabled: '#A0AEC0', accent: '#0877D1', border: '#D7E3EF', divider: '#E7EEF5', composer: '#FFFFFF', highlight: '#138A5B', success: '#137333', warning: '#A15C00', error: '#B42318', iconPrimary: '#0877D1', iconSecondary: '#52667A', header: '#0877D1', headerText: '#FFFFFF', navigationBackground: '#FFFFFF', navigationText: '#52667A', navigationActive: '#0877D1', modalBackground: '#FFFFFF', modalText: '#102A43',
    },
  },
  'teal-green': {
    id: 'teal-green',
    label: 'Emerald / Teal',
    colors: {
      primary: '#0F8F83', primaryDark: '#0B6B63', primaryLight: '#E6FFFB', background: '#F5FBFA', surface: '#FFFFFF', surfaceSecondary: '#EDF8F6', incoming: '#FFFFFF', outgoing: '#0F8F83', text: '#12302C', textPrimary: '#12302C', textSecondary: '#4E6B66', textMuted: '#718783', textOnPrimary: '#FFFFFF', secondary: '#4E6B66', placeholder: '#718783', disabled: '#A5B8B4', accent: '#0F8F83', border: '#CFE5E1', divider: '#E0EFEC', composer: '#FFFFFF', highlight: '#0C7A4D', success: '#137333', warning: '#A15C00', error: '#B42318', iconPrimary: '#0F8F83', iconSecondary: '#4E6B66', header: '#0F8F83', headerText: '#FFFFFF', navigationBackground: '#FFFFFF', navigationText: '#4E6B66', navigationActive: '#0F8F83', modalBackground: '#FFFFFF', modalText: '#12302C',
    },
  },
  'purple-accent': {
    id: 'purple-accent',
    label: 'Purple',
    colors: {
      primary: '#6D3FD1', primaryDark: '#5730AE', primaryLight: '#F3EEFF', background: '#FAF8FE', surface: '#FFFFFF', surfaceSecondary: '#F5F1FC', incoming: '#FFFFFF', outgoing: '#6D3FD1', text: '#241A3A', textPrimary: '#241A3A', textSecondary: '#675C78', textMuted: '#827895', textOnPrimary: '#FFFFFF', secondary: '#675C78', placeholder: '#827895', disabled: '#B2A9C0', accent: '#6D3FD1', border: '#DDD3EE', divider: '#ECE6F5', composer: '#FFFFFF', highlight: '#15835E', success: '#137333', warning: '#A15C00', error: '#B42318', iconPrimary: '#6D3FD1', iconSecondary: '#675C78', header: '#6D3FD1', headerText: '#FFFFFF', navigationBackground: '#FFFFFF', navigationText: '#675C78', navigationActive: '#6D3FD1', modalBackground: '#FFFFFF', modalText: '#241A3A',
    },
  },
  midnight: {
    id: 'midnight',
    label: 'Midnight',
    colors: {
      primary: '#4DA3FF', primaryDark: '#2D7DCC', primaryLight: '#173A5F', background: '#0B1220', surface: '#111B2E', surfaceSecondary: '#16233A', incoming: '#16233A', outgoing: '#2D7DCC', text: '#F3F7FC', textPrimary: '#F3F7FC', textSecondary: '#B6C3D6', textMuted: '#8C9BB2', textOnPrimary: '#FFFFFF', secondary: '#B6C3D6', placeholder: '#8C9BB2', disabled: '#5F6F86', accent: '#4DA3FF', border: '#2B3B54', divider: '#22314A', composer: '#111B2E', highlight: '#35C98A', success: '#4CCB7A', warning: '#F4B860', error: '#FF7A7A', iconPrimary: '#4DA3FF', iconSecondary: '#B6C3D6', header: '#102E50', headerText: '#FFFFFF', navigationBackground: '#111B2E', navigationText: '#B6C3D6', navigationActive: '#4DA3FF', modalBackground: '#111B2E', modalText: '#F3F7FC',
    },
  },
};

export const CHAT_THEMES = THEMES;
export const CHAT_THEME_IDS = Object.keys(THEMES);
export const DEFAULT_CHAT_THEME_ID = 'modern-blue';

export function resolveChatTheme(settings = {}) {
  return THEMES[settings.id] || THEMES[DEFAULT_CHAT_THEME_ID];
}

function hexToRgb(hex) {
  const value = String(hex || '').replace('#', '');
  if (value.length !== 6) return null;
  const number = Number.parseInt(value, 16);
  if (!Number.isFinite(number)) return null;
  return { r: (number >> 16) & 255, g: (number >> 8) & 255, b: number & 255 };
}

export function readableMessageColor(background, preferred) {
  const rgb = hexToRgb(background);
  if (!rgb) return preferred || '#102A43';
  const luminance = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
  if (luminance < 0.48) return '#FFFFFF';
  return preferred || '#102A43';
}
