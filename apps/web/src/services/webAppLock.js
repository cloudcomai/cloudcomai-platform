const STORAGE_PREFIX = 'cloudcomai.web.app-lock.';
const ITERATIONS = 600000;
const VERSION = 1;

const bytesToHex = bytes => Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
const hexToBytes = value => {
  if (typeof value !== 'string' || !/^(?:[0-9a-f]{2})+$/i.test(value)) return null;
  return new Uint8Array(value.match(/.{2}/g).map(pair => parseInt(pair, 16)));
};
const storageKey = userId => STORAGE_PREFIX + String(userId);

export function readWebAppLockConfig(userId) {
  if (!userId || typeof window === 'undefined') return null;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey(userId)) || 'null');
    if (parsed?.version !== VERSION || parsed.enabled !== true || !hexToBytes(parsed.salt) || !hexToBytes(parsed.hash) || !Number.isInteger(parsed.iterations)) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function derivePinHash(pin, saltHex, iterations) {
  if (!globalThis.crypto?.subtle) throw new Error('App Lock requires a browser with Web Crypto in a secure context (HTTPS or localhost).');
  const material = await globalThis.crypto.subtle.importKey('raw', new TextEncoder().encode(String(pin)), 'PBKDF2', false, ['deriveBits']);
  const salt = hexToBytes(saltHex);
  if (!salt) throw new Error('App Lock configuration is invalid. Disable and configure it again.');
  const bits = await globalThis.crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, material, 256);
  return bytesToHex(new Uint8Array(bits));
}

export async function saveWebAppLockPin(userId, pin) {
  const value = String(pin || '');
  if (!userId) throw new Error('A signed-in account is required.');
  if (!/^\\d{4,6}$/.test(value)) throw new Error('Use a 4 to 6 digit PIN.');
  if (!globalThis.crypto?.getRandomValues || !globalThis.crypto?.subtle) throw new Error('App Lock requires a browser with Web Crypto in a secure context (HTTPS or localhost).');
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const saltHex = bytesToHex(salt);
  const hash = await derivePinHash(value, saltHex, ITERATIONS);
  window.localStorage.setItem(storageKey(userId), JSON.stringify({ version: VERSION, enabled: true, salt: saltHex, hash, iterations: ITERATIONS }));
  window.dispatchEvent(new CustomEvent('cloudcomai:web-app-lock-changed'));
}

export async function verifyWebAppLockPin(userId, pin) {
  const config = readWebAppLockConfig(userId);
  if (!config || !/^\\d{4,6}$/.test(String(pin || ''))) return false;
  try {
    const candidate = await derivePinHash(String(pin), config.salt, config.iterations);
    if (candidate.length !== config.hash.length) return false;
    let difference = 0;
    for (let index = 0; index < candidate.length; index += 1) difference |= candidate.charCodeAt(index) ^ config.hash.charCodeAt(index);
    return difference === 0;
  } catch {
    return false;
  }
}

export async function disableWebAppLock(userId, pin) {
  if (!(await verifyWebAppLockPin(userId, pin))) return false;
  window.localStorage.removeItem(storageKey(userId));
  window.dispatchEvent(new CustomEvent('cloudcomai:web-app-lock-changed'));
  return true;
}
