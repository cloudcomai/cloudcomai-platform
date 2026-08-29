import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermission() {
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
