export const APP_THEME_IDS = ['modern-blue', 'purple-accent', 'teal-green'];

export const APP_THEMES = {
  'modern-blue': { id: 'modern-blue', label: 'Modern Blue', colors: { background: '#0F172A', panel: '#2563EB', accent: '#3B82F6', text: '#E0E7FF', highlight: '#10B981' } },
  'purple-accent': { id: 'purple-accent', label: 'Purple Accent', colors: { background: '#1E1B4B', panel: '#7C3AED', accent: '#A78BFA', text: '#EDE9FE', highlight: '#34D399' } },
  'teal-green': { id: 'teal-green', label: 'Teal / Green Accent', colors: { background: '#0B2F2A', panel: '#14B8A6', accent: '#2DD4BF', text: '#E6FFFB', highlight: '#F59E0B' } },
};
export const DEFAULT_APP_THEME_ID = 'modern-blue';
export function resolveAppTheme(id) { return APP_THEMES[id] || APP_THEMES[DEFAULT_APP_THEME_ID]; }

const KEY='cloudcomai.app.theme.v1';
export function getStoredAppTheme(){ try { const id=localStorage.getItem(KEY); return APP_THEMES[id] ? id : null; } catch { return null; } }
export function saveAppTheme(id){ const safe=APP_THEMES[id] ? id : DEFAULT_APP_THEME_ID; localStorage.setItem(KEY,safe); return safe; }
export function applyAppTheme(id){ const theme=resolveAppTheme(id); const root=document.documentElement; root.dataset.appTheme=theme.id; root.style.setProperty('--app-bg',theme.colors.background); root.style.setProperty('--app-panel',theme.colors.panel); root.style.setProperty('--app-accent',theme.colors.accent); root.style.setProperty('--app-text',theme.colors.text); root.style.setProperty('--app-highlight',theme.colors.highlight); return theme; }
