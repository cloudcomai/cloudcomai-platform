import { AppState, Platform, Vibration } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import appConfig from '../../app.json';
import { shouldNotifyWithFeedback } from './notificationFeedback';
import { DEFAULT_NOTIFICATION_PREFERENCES, notificationChannelId, shouldSuppressSameChat } from './notificationPolicy';

const PREFERENCE_KEY = 'cloudcomai.notification.preferences';
let activeChatId = null;
let appState = AppState.currentState || 'active';
AppState.addEventListener('change', nextState => { appState = nextState; });
export { DEFAULT_NOTIFICATION_PREFERENCES, notificationChannelId };

export async function getNotificationPreferences() {
  try { const value = JSON.parse((await SecureStore.getItemAsync(PREFERENCE_KEY)) || 'null'); return { ...DEFAULT_NOTIFICATION_PREFERENCES, ...(value || {}) }; }
  catch { return { ...DEFAULT_NOTIFICATION_PREFERENCES }; }
}
export async function setNotificationPreferences(preferences) {
  const next = { ...DEFAULT_NOTIFICATION_PREFERENCES, ...(preferences || {}) };
  await SecureStore.setItemAsync(PREFERENCE_KEY, JSON.stringify(next));
  if (Platform.OS === 'android') await configureAndroidNotificationChannels();
  return next;
}
export function setActiveChatId(chatId) { activeChatId = Number.isSafeInteger(Number(chatId)) && Number(chatId) > 0 ? Number(chatId) : null; }
export function getActiveChatId() { return activeChatId; }
export function shouldSuppressForegroundMessage(notification) {
  return shouldSuppressSameChat({ appState, activeChatId, notificationChatId: notification?.request?.content?.data?.chat_id, category: notification?.request?.content?.data?.category || 'system' });
}
async function configureAndroidNotificationChannels() {
  if (Platform.OS !== 'android') return;
  const definitions = [
    ['messages_alerts_v2', 'Messages', true, true],
    ['messages_sound_v2', 'Messages · Sound only', true, false],
    ['messages_vibration_v2', 'Messages · Vibration only', false, true],
    ['messages_silent_v2', 'Messages · Silent', false, false],
  ];
  await Promise.all(definitions.map(async ([id, name, sound, vibration]) => Notifications.setNotificationChannelAsync(id, {
    name, importance: Notifications.AndroidImportance.HIGH, sound: sound ? 'default' : null, enableVibrate: vibration,
    vibrationPattern: vibration ? [0, 250, 150, 250] : null, lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE, showBadge: true,
  })));
  await Notifications.setNotificationChannelAsync('messages', { name: 'Messages (legacy)', importance: Notifications.AndroidImportance.LOW, sound: null, enableVibrate: false, lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE, showBadge: true });
}
Notifications.setNotificationHandler({ handleNotification: async notification => {
  const preferences = await getNotificationPreferences();
  const category = notification?.request?.content?.data?.category || 'system';
  const show = preferences.enabled && preferences[category] !== false && !shouldSuppressForegroundMessage(notification);
  return { shouldPlaySound: show && preferences.sound, shouldSetBadge: show, shouldShowBanner: show, shouldShowList: show };
} });
export async function requestNotificationPermission() {
  const preferences = await getNotificationPreferences();
  if (!preferences.enabled) return null;
  if (Platform.OS === 'android') await configureAndroidNotificationChannels();
  const current = await Notifications.getPermissionsAsync();
  if (current.status !== 'granted') { const requested = await Notifications.requestPermissionsAsync(); if (requested.status !== 'granted') return null; }
  return Notifications.getExpoPushTokenAsync({ projectId: appConfig.expo.extra.eas.projectId });
}
export const subscribeToNotifications = async onNotification => Notifications.addNotificationReceivedListener(async event => {
  const preferences = await getNotificationPreferences();
  const category = event?.request?.content?.data?.category || 'system';
  const show = preferences.enabled && preferences[category] !== false && !shouldSuppressForegroundMessage(event);
  if (show && shouldNotifyWithFeedback(event, preferences) && preferences.vibration) Vibration.vibrate([0, 250, 150, 250]);
  if (show) onNotification(event);
});
export const rememberDeviceToken = token => SecureStore.setItemAsync('cloudcomai.push.token', token);
export async function forgetDeviceToken(api) {
  const token = await SecureStore.getItemAsync('cloudcomai.push.token');
  if (token) await api.unregisterDeviceToken({ body: { token } });
  await SecureStore.deleteItemAsync('cloudcomai.push.token'); await setApplicationBadge(0);
}
export const subscribeToNotificationResponses = onResponse => Notifications.addNotificationResponseReceivedListener(async response => {
  const chatId = Number(response?.notification?.request?.content?.data?.chat_id);
  if (Number.isSafeInteger(chatId) && chatId > 0) await dismissChatNotifications(chatId);
  onResponse(response);
});
export async function getLastNotificationResponse() { return Notifications.getLastNotificationResponseAsync(); }
export async function setApplicationBadge(count) { try { await Notifications.setBadgeCountAsync(Math.max(0, Number(count) || 0)); } catch {} }
export async function dismissChatNotifications(chatId) {
  const target = Number(chatId);
  if (!Number.isSafeInteger(target) || target <= 0) return;
  try {
    const presented = await Notifications.getPresentedNotificationsAsync();
    await Promise.all((presented || []).filter(item => Number(item?.request?.content?.data?.chat_id) === target).map(item => Notifications.dismissNotificationAsync(item.request.identifier)));
  } catch {}
}
