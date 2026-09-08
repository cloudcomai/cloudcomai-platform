import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const appRoot = fileURLToPath(new URL('../', import.meta.url));
const variant = process.argv[2] || 'preview';
if (!['preview', 'release'].includes(variant)) throw new Error('Usage: build-android.mjs preview|release');
const env = { ...process.env, CLOUDCOMAI_NATIVE_BUILD: variant, CI: '1', EXPO_NO_TELEMETRY: '1' };
const apiUrl = new URL(env.EXPO_PUBLIC_API_BASE_URL || '');
if (apiUrl.protocol !== 'https:' || apiUrl.username || apiUrl.password || apiUrl.search || apiUrl.hash) {
  throw new Error('EXPO_PUBLIC_API_BASE_URL must be an HTTPS API URL without credentials, query or fragment.');
}
if (variant === 'release') {
  for (const name of ['ANDROID_VERSION_CODE', 'ANDROID_KEYSTORE_PATH', 'ANDROID_KEYSTORE_PASSWORD', 'ANDROID_KEY_ALIAS', 'ANDROID_KEY_PASSWORD']) {
    if (!env[name]) throw new Error(`Missing ${name}. See docs/android-without-eas.md.`);
  }
  if (!existsSync(env.ANDROID_KEYSTORE_PATH)) throw new Error('Android release keystore file was not found.');
}
function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
// This repository uses generated native projects. Keep native customizations in config plugins.
run('pnpm', ['exec', 'expo', 'prebuild', '--platform', 'android', '--clean', '--no-install'], appRoot);
env.NODE_ENV = 'production';
run(process.platform === 'win32' ? 'gradlew.bat' : './gradlew', [
  ':app:assembleRelease', ...(variant === 'release' ? [':app:bundleRelease'] : []),
  '--no-daemon', '--max-workers=2', '-PreactNativeArchitectures=arm64-v8a,armeabi-v7a',
], `${appRoot}/android`);
