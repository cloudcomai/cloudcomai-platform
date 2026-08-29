import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';

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
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermission() {
  const preferences = await getNotificationPreferences();
  if (!preferences.enabled) return null;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('messages', {
      name: 'Messages', importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    if (requested.status !== 'granted') return null;
  }
  return Notifications.getDevicePushTokenAsync();
}

// Device-token registration is intentionally isolated until the PHP API gains
// an approved device-token endpoint. No token is sent to an unregistered URL.
export const subscribeToNotifications = onNotification =>
  Notifications.addNotificationReceivedListener(onNotification);
