const THEMES = {
  'modern-blue': { id:'modern-blue', label:'Modern Blue', colors:{ background:'#0F172A', header:'#2563EB', incoming:'#0F172A', outgoing:'#3B82F6', text:'#E0E7FF', secondary:'#E0E7FF', accent:'#3B82F6', border:'#2563EB', composer:'#0F172A', highlight:'#10B981' } },
  'purple-accent': { id:'purple-accent', label:'Purple Accent', colors:{ background:'#1E1B4B', header:'#7C3AED', incoming:'#1E1B4B', outgoing:'#A78BFA', text:'#EDE9FE', secondary:'#EDE9FE', accent:'#A78BFA', border:'#7C3AED', composer:'#1E1B4B', highlight:'#34D399' } },
  'teal-green': { id:'teal-green', label:'Teal / Green Accent', colors:{ background:'#0B2F2A', header:'#14B8A6', incoming:'#0B2F2A', outgoing:'#2DD4BF', text:'#E6FFFB', secondary:'#E6FFFB', accent:'#2DD4BF', border:'#14B8A6', composer:'#0B2F2A', highlight:'#F59E0B' } },
};
export const CHAT_THEMES=THEMES;
export const CHAT_THEME_IDS=Object.keys(THEMES);
export const DEFAULT_CHAT_THEME_ID='modern-blue';
export function resolveChatTheme(settings={}) { return THEMES[settings.id] || THEMES[DEFAULT_CHAT_THEME_ID]; }
export function readableMessageColor(background, preferred='#E0E7FF') { return preferred; }
