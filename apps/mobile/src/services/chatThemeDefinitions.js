const LIGHT_THEME_TEXT = '#172033';
const DARK_THEME_TEXT = '#f8fafc';

export const CHAT_THEME_IDS = ['system', 'light', 'dark', 'amoled', 'nature', 'ocean', 'sunset', 'royal', 'minimal', 'gradient', 'wallpaper'];

export const CHAT_THEMES = {
  system: { id: 'system', label: 'System Default', colors: { background: '#f5f7fb', header: '#3157d5', incoming: '#ffffff', outgoing: '#dfe6ff', text: LIGHT_THEME_TEXT, secondary: '#536078', accent: '#3157d5', border: '#dfe4ee', composer: '#ffffff' } },
  light: { id: 'light', label: 'Light', colors: { background: '#f5f7fb', header: '#3157d5', incoming: '#ffffff', outgoing: '#dfe6ff', text: LIGHT_THEME_TEXT, secondary: '#536078', accent: '#3157d5', border: '#dfe4ee', composer: '#ffffff' } },
  dark: { id: 'dark', label: 'Dark', colors: { background: '#20242b', header: '#3157d5', incoming: '#30353d', outgoing: '#3157d5', text: DARK_THEME_TEXT, secondary: '#c3cad5', accent: '#9eb1ff', border: '#3a414c', composer: '#252a32' } },
  amoled: { id: 'amoled', label: 'AMOLED', colors: { background: '#000000', header: '#09090b', incoming: '#111113', outgoing: '#5b46d6', text: DARK_THEME_TEXT, secondary: '#c4c7ce', accent: '#a89cff', border: '#1e1e22', composer: '#050505' } },
  nature: { id: 'nature', label: 'Nature Green', colors: { background: '#f3f7ed', header: '#245c3a', incoming: '#fffdf5', outgoing: '#dff1e3', text: '#173221', secondary: '#496053', accent: '#245c3a', border: '#d5e2d2', composer: '#fffdf8' } },
  ocean: { id: 'ocean', label: 'Ocean Blue', colors: { background: '#eef8ff', header: '#164e73', incoming: '#ffffff', outgoing: '#dceff8', text: '#102a3a', secondary: '#496879', accent: '#164e73', border: '#cfe5f1', composer: '#ffffff' } },
  sunset: { id: 'sunset', label: 'Sunset', colors: { background: '#fff2ed', header: '#d65a4a', incoming: '#fffaf7', outgoing: '#ffe1d9', text: '#3b2522', secondary: '#735953', accent: '#a33d30', border: '#f2d4cc', composer: '#fffaf7' } },
  royal: { id: 'royal', label: 'Royal Purple', colors: { background: '#f5f0ff', header: '#512a83', incoming: '#ffffff', outgoing: '#eee5fb', text: '#241b31', secondary: '#5e536a', accent: '#512a83', border: '#dfd4ef', composer: '#ffffff' } },
  minimal: { id: 'minimal', label: 'Minimal', colors: { background: '#fafafa', header: '#242424', incoming: '#ffffff', outgoing: '#eeeeee', text: '#181818', secondary: '#5f5f5f', accent: '#242424', border: '#e2e2e2', composer: '#ffffff' } },
  gradient: { id: 'gradient', label: 'Gradient', colors: { background: '#f3efff', header: '#5b4bb7', incoming: '#ffffff', outgoing: '#f0ebff', text: '#171329', secondary: '#5b566b', accent: '#5b4bb7', border: '#ddd6f2', composer: '#ffffff' }, gradient: ['#eef9ff', '#f2edff', '#fff0f7'] },
  wallpaper: { id: 'wallpaper', label: 'Wallpaper', colors: { background: '#20242b', header: '#3157d5', incoming: '#30353d', outgoing: '#3157d5', text: DARK_THEME_TEXT, secondary: '#c3cad5', accent: '#9eb1ff', border: '#3a414c', composer: '#252a32' } },
};

export function resolveChatTheme(settings = {}, systemScheme = 'light') {
  const requested = CHAT_THEMES[settings.id] ? settings.id : 'system';
  if (requested === 'system') return CHAT_THEMES[systemScheme === 'dark' ? 'dark' : 'light'];
  return CHAT_THEMES[requested] || CHAT_THEMES.light;
}
