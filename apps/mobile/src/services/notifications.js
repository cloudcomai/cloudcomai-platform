import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import appConfig from '../../app.json';

const PREFERENCE_KEY = 'cloudcomai.notification.preferences';
export const DEFAULT_NOTIFICATION_PREFERENCES = Object.freeze({ enabled: true, message: true, group: true, attachment: true, system: true });

export async function getNotificationPreferences() {
  try { const value = JSON.parse((await SecureStore.getItemAsync(PREFERENCE_KEY)) || 'null'); return { ...DEFAULT_NOTIFICATION_PREFERENCES, ...(value || {}) }; }
  catch { return { ...DEFAULT_NOTIFICATION_PREFERENCES }; }
}

export async function setNotificationPreferences(preferences) {
  const next = { ...DEFAULT_NOTIFICATION_PREFERENCES, ...preferences };
  await SecureStore.setItemAsync(PREFERENCE_KEY, JSON.stringify(next));
  return next;
}

Notifications.setNotificationHandler({
  handleNotification: async notification => {
    const preferences = await getNotificationPreferences();
    const category = notification?.request?.content?.data?.category || 'system';
    const show = preferences.enabled && preferences[category] !== false;
    return { shouldPlaySound: show, shouldSetBadge: show, shouldShowBanner: show, shouldShowList: show };
  },
});

export async function requestNotificationPermission() {
  const preferences = await getNotificationPreferences();
  if (!preferences.enabled) return null;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('messages', {
      name: 'Messages', importance: Notifications.AndroidImportance.HIGH, sound: 'default', enableVibrate: true,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    if (requested.status !== 'granted') return null;
  }
  return Notifications.getExpoPushTokenAsync({ projectId: appConfig.expo.extra.eas.projectId });
}

export const subscribeToNotifications = async onNotification => {
  const preferences = await getNotificationPreferences();
  return Notifications.addNotificationReceivedListener(event => {
    const category = event?.request?.content?.data?.category || 'system';
    if (preferences.enabled && preferences[category] !== false) onNotification(event);
  });
};

export const subscribeToNotificationResponses = onResponse =>
  Notifications.addNotificationResponseReceivedListener(onResponse);

export async function getLastNotificationResponse() {
  return Notifications.getLastNotificationResponseAsync();
}

export async function setApplicationBadge(count) {
  try { await Notifications.setBadgeCountAsync(Math.max(0, Number(count) || 0)); } catch {}
}
