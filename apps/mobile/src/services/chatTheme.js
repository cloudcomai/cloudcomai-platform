import * as SecureStore from 'expo-secure-store';
import { CHAT_THEME_IDS, CHAT_THEMES, DEFAULT_CHAT_THEME_ID, resolveChatTheme } from './chatThemeDefinitions';
import { setGlobalTheme } from './globalTheme';
export { CHAT_THEME_IDS, CHAT_THEMES, DEFAULT_CHAT_THEME_ID, resolveChatTheme };
const KEY='cloudcomai.chat.theme.v2';
export async function hasChatThemeSelection(){ try { return Boolean(await SecureStore.getItemAsync(KEY)); } catch { return false; } }
export async function getChatThemeSettings(){ try { const raw=await SecureStore.getItemAsync(KEY); if(!raw){ setGlobalTheme(DEFAULT_CHAT_THEME_ID); return {id:DEFAULT_CHAT_THEME_ID,selected:false}; } const parsed=JSON.parse(raw); const id=CHAT_THEMES[parsed.id]?parsed.id:DEFAULT_CHAT_THEME_ID; setGlobalTheme(id); return {id,selected:true}; } catch { setGlobalTheme(DEFAULT_CHAT_THEME_ID); return {id:DEFAULT_CHAT_THEME_ID,selected:false}; } }
export async function setChatThemeSettings(settings){ const next={id:CHAT_THEMES[settings?.id]?settings.id:DEFAULT_CHAT_THEME_ID,selected:true}; await SecureStore.setItemAsync(KEY,JSON.stringify(next)); setGlobalTheme(next.id); return next; }
export async function resetChatThemeSettings(){ const next={id:DEFAULT_CHAT_THEME_ID,selected:true}; await SecureStore.setItemAsync(KEY,JSON.stringify(next)); setGlobalTheme(next.id); return next; }
