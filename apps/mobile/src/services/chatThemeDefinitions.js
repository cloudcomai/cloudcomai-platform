export const CHAT_THEME_IDS = ['system', 'light', 'dark', 'amoled', 'nature', 'ocean', 'sunset', 'royal', 'minimal', 'gradient', 'wallpaper'];

export const CHAT_THEMES = {
  system: { id: 'system', label: 'System Default', colors: { background: '#f5f7fb', header: '#3157d5', incoming: '#ffffff', outgoing: '#dfe6ff', text: '#172033', secondary: '#778196', accent: '#3157d5', border: '#dfe4ee', composer: '#ffffff' } },
  light: { id: 'light', label: 'Light', colors: { background: '#f5f7fb', header: '#3157d5', incoming: '#ffffff', outgoing: '#dfe6ff', text: '#172033', secondary: '#778196', accent: '#3157d5', border: '#dfe4ee', composer: '#ffffff' } },
  dark: { id: 'dark', label: 'Dark', colors: { background: '#20242b', header: '#3157d5', incoming: '#30353d', outgoing: '#3157d5', text: '#f8fafc', secondary: '#a6afbd', accent: '#7f9cff', border: '#3a414c', composer: '#252a32' } },
  amoled: { id: 'amoled', label: 'AMOLED', colors: { background: '#000000', header: '#09090b', incoming: '#111113', outgoing: '#5b46d6', text: '#ffffff', secondary: '#8b8f98', accent: '#8b7cff', border: '#1e1e22', composer: '#050505' } },
  nature: { id: 'nature', label: 'Nature Green', colors: { background: '#f3f7ed', header: '#245c3a', incoming: '#fffdf5', outgoing: '#347a4b', text: '#173221', secondary: '#687a6d', accent: '#347a4b', border: '#d5e2d2', composer: '#fffdf8' } },
  ocean: { id: 'ocean', label: 'Ocean Blue', colors: { background: '#eef8ff', header: '#164e73', incoming: '#ffffff', outgoing: '#1675ad', text: '#102a3a', secondary: '#60798a', accent: '#20a8d8', border: '#cfe5f1', composer: '#ffffff' } },
  sunset: { id: 'sunset', label: 'Sunset', colors: { background: '#fff2ed', header: '#d65a4a', incoming: '#fffaf7', outgoing: '#e96b58', text: '#3b2522', secondary: '#8c706b', accent: '#e96b58', border: '#f2d4cc', composer: '#fffaf7' } },
  royal: { id: 'royal', label: 'Royal Purple', colors: { background: '#f5f0ff', header: '#512a83', incoming: '#ffffff', outgoing: '#7047b8', text: '#241b31', secondary: '#766b82', accent: '#8a63d2', border: '#dfd4ef', composer: '#ffffff' } },
  minimal: { id: 'minimal', label: 'Minimal', colors: { background: '#fafafa', header: '#242424', incoming: '#ffffff', outgoing: '#2f2f2f', text: '#181818', secondary: '#777777', accent: '#444444', border: '#e2e2e2', composer: '#ffffff' } },
  gradient: { id: 'gradient', label: 'Gradient', colors: { background: '#f3efff', header: '#5b4bb7', incoming: '#ffffff', outgoing: '#6650cf', text: '#171329', secondary: '#6f6a7e', accent: '#7c5cff', border: '#ddd6f2', composer: '#ffffff' }, gradient: ['#eef9ff', '#f2edff', '#fff0f7'] },
  wallpaper: { id: 'wallpaper', label: 'Wallpaper', colors: { background: '#20242b', header: '#3157d5', incoming: '#ffffff', outgoing: '#3157d5', text: '#172033', secondary: '#778196', accent: '#3157d5', border: '#dfe4ee', composer: '#ffffff' } },
};

export function resolveChatTheme(settings = {}, systemScheme = 'light') {
  const requested = CHAT_THEMES[settings.id] ? settings.id : 'system';
  if (requested === 'system') return CHAT_THEMES[systemScheme === 'dark' ? 'dark' : 'light'];
  return CHAT_THEMES[requested] || CHAT_THEMES.light;
}
