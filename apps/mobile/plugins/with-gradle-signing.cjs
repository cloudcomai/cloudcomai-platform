const { withAppBuildGradle } = require('expo/config-plugins');

module.exports = config => withAppBuildGradle(config, mod => {
  if (process.env.CLOUDCOMAI_NATIVE_BUILD !== 'release') return mod;
  if (mod.modResults.language !== 'groovy') throw new Error('Expected a Groovy Android app build file.');
  const marker = '// CloudComAI standalone release signing';
  if (!mod.modResults.contents.includes(marker)) {
    mod.modResults.contents += `
${marker}
android {
    signingConfigs {
        cloudcomaiRelease {
            def requiredSigningValue = { name ->
                def value = System.getenv(name)
                if (!value) throw new GradleException("Missing Android signing variable: " + name)
                return value
            }
            storeFile file(requiredSigningValue("ANDROID_KEYSTORE_PATH"))
            storePassword requiredSigningValue("ANDROID_KEYSTORE_PASSWORD")
            keyAlias requiredSigningValue("ANDROID_KEY_ALIAS")
            keyPassword requiredSigningValue("ANDROID_KEY_PASSWORD")
        }
    }
    buildTypes.release.signingConfig = signingConfigs.cloudcomaiRelease
}
`;
  }
  return mod;
});
