import * as SecureStore from 'expo-secure-store';
import { CHAT_THEME_IDS, CHAT_THEMES, resolveChatTheme } from './chatThemeDefinitions';

export { CHAT_THEME_IDS, CHAT_THEMES, resolveChatTheme };

const KEY = 'cloudcomai.chat.theme.v1';
const DEFAULT_SETTINGS = { id: 'system', accentColor: null, wallpaperUri: null, wallpaperOpacity: 0.35, textScale: 1 };

export async function getChatThemeSettings() {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function setChatThemeSettings(settings) {
  const next = {
    id: CHAT_THEMES[settings?.id] ? settings.id : 'system',
    accentColor: settings?.accentColor || null,
    wallpaperUri: settings?.wallpaperUri || null,
    wallpaperOpacity: Math.max(0, Math.min(1, Number(settings?.wallpaperOpacity ?? 0.35))),
    textScale: Math.max(0.9, Math.min(1.2, Number(settings?.textScale ?? 1))),
  };
  await SecureStore.setItemAsync(KEY, JSON.stringify(next));
  return next;
}

export async function resetChatThemeSettings() {
  const next = { ...DEFAULT_SETTINGS };
  await SecureStore.setItemAsync(KEY, JSON.stringify(next));
  return next;
}
