export const APP_THEME_IDS = ['modern-blue', 'teal-green', 'purple-accent', 'midnight'];

export const APP_THEMES = {
  'modern-blue': {
    id: 'modern-blue', label: 'CloudCom Blue',
    colors: {
      primary: '#0877D1', primaryDark: '#075FA8', primaryLight: '#EAF5FF', background: '#F7FAFC', surface: '#FFFFFF', surfaceSecondary: '#F0F6FB',
      textPrimary: '#102A43', textSecondary: '#52667A', textMuted: '#718096', textOnPrimary: '#FFFFFF', placeholder: '#718096', disabled: '#A0AEC0',
      border: '#D7E3EF', divider: '#E7EEF5', incomingBubble: '#FFFFFF', incomingBubbleText: '#102A43', outgoingBubble: '#0877D1', outgoingBubbleText: '#FFFFFF',
      success: '#137333', warning: '#A15C00', error: '#B42318', iconPrimary: '#0877D1', iconSecondary: '#52667A', headerBackground: '#0877D1', headerText: '#FFFFFF',
      navigationBackground: '#FFFFFF', navigationText: '#52667A', navigationActive: '#0877D1', modalBackground: '#FFFFFF', modalText: '#102A43', accent: '#0877D1', highlight: '#138A5B',
    },
  },
  'teal-green': {
    id: 'teal-green', label: 'Emerald / Teal',
    colors: {
      primary: '#0F8F83', primaryDark: '#0B6B63', primaryLight: '#E6FFFB', background: '#F5FBFA', surface: '#FFFFFF', surfaceSecondary: '#EDF8F6',
      textPrimary: '#12302C', textSecondary: '#4E6B66', textMuted: '#718783', textOnPrimary: '#FFFFFF', placeholder: '#718783', disabled: '#A5B8B4',
      border: '#CFE5E1', divider: '#E0EFEC', incomingBubble: '#FFFFFF', incomingBubbleText: '#12302C', outgoingBubble: '#0F8F83', outgoingBubbleText: '#FFFFFF',
      success: '#137333', warning: '#A15C00', error: '#B42318', iconPrimary: '#0F8F83', iconSecondary: '#4E6B66', headerBackground: '#0F8F83', headerText: '#FFFFFF',
      navigationBackground: '#FFFFFF', navigationText: '#4E6B66', navigationActive: '#0F8F83', modalBackground: '#FFFFFF', modalText: '#12302C', accent: '#0F8F83', highlight: '#0C7A4D',
    },
  },
  'purple-accent': {
    id: 'purple-accent', label: 'Purple',
    colors: {
      primary: '#6D3FD1', primaryDark: '#5730AE', primaryLight: '#F3EEFF', background: '#FAF8FE', surface: '#FFFFFF', surfaceSecondary: '#F5F1FC',
      textPrimary: '#241A3A', textSecondary: '#675C78', textMuted: '#827895', textOnPrimary: '#FFFFFF', placeholder: '#827895', disabled: '#B2A9C0',
      border: '#DDD3EE', divider: '#ECE6F5', incomingBubble: '#FFFFFF', incomingBubbleText: '#241A3A', outgoingBubble: '#6D3FD1', outgoingBubbleText: '#FFFFFF',
      success: '#137333', warning: '#A15C00', error: '#B42318', iconPrimary: '#6D3FD1', iconSecondary: '#675C78', headerBackground: '#6D3FD1', headerText: '#FFFFFF',
      navigationBackground: '#FFFFFF', navigationText: '#675C78', navigationActive: '#6D3FD1', modalBackground: '#FFFFFF', modalText: '#241A3A', accent: '#6D3FD1', highlight: '#15835E',
    },
  },
  midnight: {
    id: 'midnight', label: 'Midnight',
    colors: {
      primary: '#4DA3FF', primaryDark: '#2D7DCC', primaryLight: '#173A5F', background: '#0B1220', surface: '#111B2E', surfaceSecondary: '#16233A',
      textPrimary: '#F3F7FC', textSecondary: '#B6C3D6', textMuted: '#8C9BB2', textOnPrimary: '#FFFFFF', placeholder: '#8C9BB2', disabled: '#5F6F86',
      border: '#2B3B54', divider: '#22314A', incomingBubble: '#16233A', incomingBubbleText: '#F3F7FC', outgoingBubble: '#2D7DCC', outgoingBubbleText: '#FFFFFF',
      success: '#4CCB7A', warning: '#F4B860', error: '#FF7A7A', iconPrimary: '#4DA3FF', iconSecondary: '#B6C3D6', headerBackground: '#102E50', headerText: '#FFFFFF',
      navigationBackground: '#111B2E', navigationText: '#B6C3D6', navigationActive: '#4DA3FF', modalBackground: '#111B2E', modalText: '#F3F7FC', accent: '#4DA3FF', highlight: '#35C98A',
    },
  },
};

export const DEFAULT_APP_THEME_ID = 'modern-blue';
export function resolveAppTheme(id) { return APP_THEMES[id] || APP_THEMES[DEFAULT_APP_THEME_ID]; }

const KEY='cloudcomai.app.theme.v2';
export function getStoredAppTheme(){ try { const id=localStorage.getItem(KEY); return APP_THEMES[id] ? id : null; } catch { return null; } }
export function saveAppTheme(id){ const safe=APP_THEMES[id] ? id : DEFAULT_APP_THEME_ID; try { localStorage.setItem(KEY,safe); } catch {} return safe; }
export function applyAppTheme(id){
  const theme=resolveAppTheme(id);
  const root=document.documentElement;
  root.dataset.appTheme=theme.id;
  root.style.colorScheme=theme.id==='midnight'?'dark':'light';
  for (const [key,value] of Object.entries(theme.colors)) root.style.setProperty(`--app-${key.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`)}`,value);
  return theme;
}
