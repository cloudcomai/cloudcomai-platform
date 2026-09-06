import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const projectId = process.env.EAS_PROJECT_ID?.trim();

if (!projectId) {
  throw new Error('EAS_PROJECT_ID is required.');
}

if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(projectId)) {
  throw new Error('EAS_PROJECT_ID must be a valid UUID.');
}

const appConfigPath = fileURLToPath(new URL('../app.json', import.meta.url));
const appConfig = JSON.parse(await readFile(appConfigPath, 'utf8'));

if (!appConfig.expo) {
  throw new Error('apps/mobile/app.json must contain an expo object.');
}

appConfig.expo.extra ??= {};
appConfig.expo.extra.eas ??= {};
appConfig.expo.extra.eas.projectId = projectId;
appConfig.expo.updates ??= {};
appConfig.expo.updates.url = `https://u.expo.dev/${projectId}`;

await writeFile(appConfigPath, `${JSON.stringify(appConfig, null, 2)}\n`);
console.log(`Configured Expo project ${projectId}.`);
