module.exports = ({ config }) => {
  const variant = process.env.CLOUDCOMAI_NATIVE_BUILD;
  if (!variant) return config;
  if (!['preview', 'release'].includes(variant)) throw new Error('Invalid CLOUDCOMAI_NATIVE_BUILD variant.');
  const versionCode = Number(process.env.ANDROID_VERSION_CODE || (variant === 'preview' ? 1 : 0));
  if (!Number.isSafeInteger(versionCode) || versionCode < 1 || versionCode > 2100000000) throw new Error('ANDROID_VERSION_CODE must be a positive integer, higher than your last published build.');
  return {
    ...config,
    name: variant === 'preview' ? 'CloudComAI Test' : config.name,
    scheme: variant === 'preview' ? 'cloudcomai-test' : config.scheme,
    updates: { ...config.updates, enabled: false },
    android: {
      ...config.android,
      package: variant === 'preview' ? 'com.cloudcomai.mobile.preview' : config.android.package,
      versionCode,
      ...(process.env.ANDROID_GOOGLE_SERVICES_FILE ? { googleServicesFile: process.env.ANDROID_GOOGLE_SERVICES_FILE } : {}),
    },
    plugins: [
      ...(config.plugins || []),
      ['expo-contacts', { contactsPermission: 'Allow CloudComAI to access your contacts so you can find registered friends.' }],
      './plugins/with-gradle-signing.cjs',
    ],
  };
};
