import * as SecureStore from 'expo-secure-store';

const ENABLED_KEY = 'cloudcomai.app_lock.enabled';
const PIN_KEY = 'cloudcomai.app_lock.pin';

export async function isAppLockEnabled() {
  return (await SecureStore.getItemAsync(ENABLED_KEY)) === 'true';
}

export async function setAppLockPin(pin) {
  const value = String(pin || '').trim();
  if (!/^\d{4,6}$/.test(value)) throw new Error('Use a 4 to 6 digit PIN.');
  await SecureStore.setItemAsync(PIN_KEY, value);
  await SecureStore.setItemAsync(ENABLED_KEY, 'true');
}

export async function verifyAppLockPin(pin) {
  const saved = await SecureStore.getItemAsync(PIN_KEY);
  return Boolean(saved) && String(pin || '') === saved;
}

export async function disableAppLock() {
  await SecureStore.deleteItemAsync(PIN_KEY);
  await SecureStore.setItemAsync(ENABLED_KEY, 'false');
}
