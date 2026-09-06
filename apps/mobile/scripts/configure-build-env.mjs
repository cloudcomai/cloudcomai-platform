import fs from 'node:fs';

const apiBaseUrl = (process.env.EXPO_PUBLIC_API_BASE_URL || '').trim();
const profiles = process.argv.slice(2);

if (!apiBaseUrl) {
  throw new Error('EXPO_PUBLIC_API_BASE_URL is required.');
}

let parsed;
try {
  parsed = new URL(apiBaseUrl);
} catch {
  throw new Error('EXPO_PUBLIC_API_BASE_URL must be a valid absolute URL.');
}

if (parsed.protocol !== 'https:') {
  throw new Error('EXPO_PUBLIC_API_BASE_URL must use HTTPS.');
}

if (!parsed.pathname.endsWith('/apiapp/api')) {
  throw new Error('EXPO_PUBLIC_API_BASE_URL must end with /apiapp/api.');
}

if (!profiles.length) {
  throw new Error('At least one EAS build profile must be provided.');
}

const easPath = new URL('../eas.json', import.meta.url);
const easConfig = JSON.parse(fs.readFileSync(easPath, 'utf8'));

for (const profile of profiles) {
  if (!easConfig.build?.[profile]) {
    throw new Error(`Unknown EAS build profile: ${profile}`);
  }

  easConfig.build[profile].env = {
    ...(easConfig.build[profile].env || {}),
    EXPO_PUBLIC_API_BASE_URL: apiBaseUrl,
  };
}

fs.writeFileSync(easPath, JSON.stringify(easConfig, null, 2) + '\n');

console.log(`Configured EXPO_PUBLIC_API_BASE_URL for EAS profiles: ${profiles.join(', ')}`);
console.log(`EXPO_PUBLIC_API_BASE_URL=${apiBaseUrl}`);
